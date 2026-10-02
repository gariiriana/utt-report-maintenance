import { Bytes, collection, collectionGroup, deleteDoc, doc, documentId, getDoc, getDocFromServer, getDocs, limit, orderBy, query, serverTimestamp, setDoc, startAfter, where, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { BOQFields, BOQOverride, BOQPhoto, RoomBOQItem } from '@/types/boq';
import { BOQConflictError, assertBOQRevision, validateBOQFields } from '@/utils/boqValidation';
const itemRef = (id: string) => doc(db, 'boq_items', id);
const PHOTO_CHUNK_BYTES = 900 * 1024;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
// Only changed items have documents; the inspected workbook remains the baseline.
export async function readBOQPage(ids: string[]): Promise<Record<string, BOQOverride>> {
  if (!ids.length) return {};
  const result = await getDocs(query(collection(db, 'boq_items'), where(documentId(), 'in', ids)));
  return Object.fromEntries(result.docs.map(snapshot => [snapshot.id, snapshot.data() as BOQOverride]));
}
export async function readBOQItem(id: string): Promise<BOQOverride | null> {
  const snapshot = await getDoc(itemRef(id));
  return snapshot.exists() ? snapshot.data() as BOQOverride : null;
}
export async function saveBOQItem(item: RoomBOQItem, fields: BOQFields, expectedRevision: number, uid: string) {
  const clean = validateBOQFields(fields);
  const nextRevision = expectedRevision + 1;
  const ref = itemRef(item.id);
  try {
    // Firestore rules compare this revision with the stored document atomically,
    // so a transaction read is unnecessary and would double the request count.
    await setDoc(ref, {
      ...clean,
      revision: nextRevision,
      sourceSheet: item.sourceSheet,
      sourceRow: item.sourceRow,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    // An update rejected by the revision rule is a concurrent edit. Confirm only
    // on this error path so normal saves stay a single Firestore write.
    if ((error as { code?: string })?.code === 'permission-denied') {
      try {
        const latest = await getDocFromServer(ref);
        const currentRevision = latest.exists() ? latest.data().revision : 0;
        if (currentRevision !== expectedRevision) assertBOQRevision(currentRevision, expectedRevision);
      } catch (checkError) {
        if (checkError instanceof BOQConflictError) throw checkError;
      }
    }
    throw error;
  }
  return { ...clean, revision: nextRevision };
}
export async function readBOQPhotos(id: string, cursor?: QueryDocumentSnapshot) {
  const photos = collection(db, 'boq_items', id, 'photos');
  const snapshot = await getDocs(query(photos, orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(21)));
  const visible = snapshot.docs.slice(0, 20);
  return { photos: visible.map(snapshot => ({ ...snapshot.data(), id: snapshot.id }) as BOQPhoto), cursor: visible[visible.length - 1], hasMore: snapshot.docs.length > 20 };
}
export async function photoDigest(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
    throw new Error(file.name + ': gunakan JPG, PNG, atau WebP maksimal 10 MB per foto.');
  }
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
// Content-addressed chunk IDs make retries idempotent without a Firestore read.
export async function uploadBOQPhoto(itemId: string, id: string, file: File, uid: string, progress: (value: number) => void) {
  const metadataRef = doc(db, 'boq_items', itemId, 'photos', id);
  const totalChunks = Math.ceil(file.size / PHOTO_CHUNK_BYTES);
  let nextIndex = 0;
  let uploadedBytes = 0;
  const workers = Array.from({ length: Math.min(3, totalChunks) }, async () => {
    while (nextIndex < totalChunks) {
      const index = nextIndex++;
      const start = index * PHOTO_CHUNK_BYTES;
      const bytes = new Uint8Array(await file.slice(start, Math.min(start + PHOTO_CHUNK_BYTES, file.size)).arrayBuffer());
      const chunkRef = doc(db, 'boq_items', itemId, 'photos', id, 'chunks', String(index).padStart(5, '0'));
      await setDoc(chunkRef, { index, data: Bytes.fromUint8Array(bytes), createdAt: serverTimestamp() });
      uploadedBytes += bytes.byteLength;
      progress(Math.min(99, Math.round(uploadedBytes / file.size * 100)));
    }
  });
  await Promise.all(workers);

  const photo: BOQPhoto = {
    id,
    path: `boq_items/${itemId}/photos/${id}`,
    storageType: 'firestore-bytes',
    totalChunks,
    name: file.name.slice(0, 500),
    size: file.size,
    contentType: file.type,
    uploadedBy: uid,
  };
  // Publish the manifest last: interrupted uploads remain invisible and can be retried safely.
  await setDoc(metadataRef, {
    path: photo.path,
    storageType: photo.storageType,
    totalChunks: photo.totalChunks,
    name: photo.name,
    size: photo.size,
    contentType: photo.contentType,
    uploadedBy: photo.uploadedBy,
    createdAt: serverTimestamp(),
  });
  progress(100);
  return photo;
}

export async function getBOQPhotoURL(photo: BOQPhoto): Promise<string> {
  return URL.createObjectURL(await getBOQPhotoBlob(photo));
}

export async function getBOQPhotoBlob(photo: BOQPhoto): Promise<Blob> {
  if (photo.storageType !== 'firestore-bytes') throw new Error('Foto BOQ ini belum memakai format Bytes Firestore.');
  if (!Number.isInteger(photo.totalChunks) || !photo.totalChunks || photo.size > MAX_PHOTO_BYTES) {
    throw new Error('Metadata foto BOQ tidak valid.');
  }
  const chunkSnapshots = await getDocs(query(
    collection(db, 'boq_items', photo.path.split('/')[1], 'photos', photo.id, 'chunks'),
    orderBy('index'),
  ));
  if (chunkSnapshots.size !== photo.totalChunks) throw new Error('Sebagian potongan foto belum tersedia. Muat ulang atau unggah ulang foto.');
  const parts: Uint8Array[] = [];
  let expectedIndex = 0;
  let byteLength = 0;
  for (const chunk of chunkSnapshots.docs) {
    const value = chunk.data();
    if (value.index !== expectedIndex || !(value.data instanceof Bytes)) throw new Error('Urutan atau format potongan foto tidak valid.');
    const bytes = value.data.toUint8Array();
    parts.push(bytes);
    byteLength += bytes.byteLength;
    expectedIndex++;
  }
  if (byteLength !== photo.size) throw new Error('Ukuran foto tidak cocok dengan metadata.');
  return new Blob(parts as unknown as BlobPart[], { type: photo.contentType });
}

export interface BOQPhotoRef { itemId: string; photo: BOQPhoto; createdAt: number }

// Every item that has a saved text override (a document exists only after the first edit).
export async function readAllBOQOverrides(): Promise<Record<string, BOQOverride>> {
  const result = await getDocs(collection(db, 'boq_items'));
  return Object.fromEntries(result.docs.map(snapshot => [snapshot.id, snapshot.data() as BOQOverride]));
}

const photoRefOf = (snapshot: QueryDocumentSnapshot): BOQPhotoRef | null => {
  const itemId = snapshot.ref.parent.parent?.id;
  if (!itemId || !snapshot.ref.path.startsWith('boq_items/')) return null;
  const data = snapshot.data();
  return { itemId, photo: { ...data, id: snapshot.id } as BOQPhoto, createdAt: data.createdAt?.toMillis?.() ?? 0 };
};

// Photos can exist for items that never had a text edit, so they are discovered through
// a collection-group query. Needs the scoped `photos` rule + index override to be deployed.
export async function readAllBOQPhotoRefs(): Promise<BOQPhotoRef[]> {
  const result = await getDocs(query(collectionGroup(db, 'photos'), where('storageType', '==', 'firestore-bytes')));
  return result.docs.map(photoRefOf).filter((ref): ref is BOQPhotoRef => ref !== null);
}

export async function readBOQItemPhotoRefs(itemId: string): Promise<BOQPhotoRef[]> {
  const result = await getDocs(collection(db, 'boq_items', itemId, 'photos'));
  return result.docs.map(photoRefOf).filter((ref): ref is BOQPhotoRef => ref !== null);
}

export async function deleteBOQPhoto(itemId: string, photo: Pick<BOQPhoto, 'id' | 'totalChunks'>): Promise<void> {
  const chunks = Math.max(1, photo.totalChunks || 12);
  const chunkDeletes = Array.from({ length: chunks }, (_, index) => {
    const chunkRef = doc(db, 'boq_items', itemId, 'photos', photo.id, 'chunks', String(index).padStart(5, '0'));
    return deleteDoc(chunkRef).catch(() => {});
  });
  await Promise.all(chunkDeletes);
  const metadataRef = doc(db, 'boq_items', itemId, 'photos', photo.id);
  await deleteDoc(metadataRef);
}
