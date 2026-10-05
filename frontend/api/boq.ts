import { Bytes, collection, collectionGroup, deleteDoc, doc, documentId, getDoc, getDocFromServer, getDocs, limit, orderBy, query, serverTimestamp, setDoc, startAfter, where, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { BOQFields, BOQItem, BOQOverride, BOQPhoto, NewBOQItemInput } from '@/types/boq';
import { BOQ_EDITABLE_FIELDS, validateBOQFields, validateNewBOQItem } from '@/utils/boqValidation';
const itemRef = (id: string) => doc(db, 'boq_items', id);
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
// Firestore accepts at most 30 values in an `in` filter.
const IN_LIMIT = 30;
// Only changed items have documents; the inspected workbook remains the baseline.
export async function readBOQPage(ids: string[]): Promise<Record<string, BOQOverride>> {
  const batches = Array.from({ length: Math.ceil(ids.length / IN_LIMIT) }, (_, index) => ids.slice(index * IN_LIMIT, (index + 1) * IN_LIMIT));
  const results = await Promise.all(batches.map(batch => getDocs(query(collection(db, 'boq_items'), where(documentId(), 'in', batch)))));
  return Object.fromEntries(results.flatMap(result => result.docs.map(snapshot => [snapshot.id, snapshot.data() as BOQOverride])));
}
export async function readBOQItem(id: string): Promise<BOQOverride | null> {
  const snapshot = await getDoc(itemRef(id));
  return snapshot.exists() ? snapshot.data() as BOQOverride : null;
}
const fieldsOfDoc = (value: Partial<BOQFields>): BOQFields =>
  Object.fromEntries(BOQ_EDITABLE_FIELDS.map(field => [field, value[field] || ''])) as BOQFields;
// Custom items (added by a drafter) keep their placement in the document itself. Older custom
// documents have no category; they are listed under "Item Tambahan".
const customFieldsOf = (item: BOQItem) => item.custom
  ? { custom: true, room: item.room, classId: item.classId, floor: item.floor, ...(item.sheet && item.sheet !== 'Item Tambahan' ? { category: item.sheet } : {}) }
  : {};
export const customBOQItemOf = (id: string, data: BOQOverride): BOQItem => ({
  ...fieldsOfDoc(data),
  id, tableId: 'custom', sheet: data.category || 'Item Tambahan', sourceSheet: 'CUSTOM', sourceRow: 0, custom: true, values: [],
  room: data.room || '', roomFromLookup: false, classId: data.classId || '', floor: data.floor || '',
});
// Items added in the app: every document with `custom: true` that is not deleted.
export async function readCustomBOQItems(): Promise<BOQItem[]> {
  const result = await getDocs(query(collection(db, 'boq_items'), where('custom', '==', true)));
  return result.docs
    .filter(snapshot => !snapshot.data().deleted)
    .map(snapshot => customBOQItemOf(snapshot.id, snapshot.data() as BOQOverride))
    .sort((a, b) => a.room.localeCompare(b.room) || a.classId.localeCompare(b.classId) || a.ciName.localeCompare(b.ciName));
}
// Baseline items hidden by a drafter. A tombstone is kept instead of removing the document.
export async function readDeletedBOQIds(): Promise<Set<string>> {
  const result = await getDocs(query(collection(db, 'boq_items'), where('deleted', '==', true)));
  return new Set(result.docs.map(snapshot => snapshot.id));
}
export const newCustomBOQItemId = () => 'boq-v2-custom-' + crypto.randomUUID().replace(/-/g, '');
export function customBOQItemFromInput(id: string, input: NewBOQItemInput): BOQItem {
  const { category, ...clean } = validateNewBOQItem(input);
  return customBOQItemOf(id, { ...clean, ...(category ? { category } : {}), revision: 1 });
}

// Writes go through the offline outbox (utils/boqOutbox), which reads the server version first,
// merges per field and then writes the next revision. The rules reject a write whose revision
// is not exactly one above the stored one, so concurrent edits are never silently overwritten.
export interface ServerBOQItem {
  exists: boolean; fields: BOQFields; revision: number; deleted: boolean;
  updatedBy?: string; updatedByName?: string; updatedAt?: number;
}
export async function readBOQItemFromServer(item: BOQItem): Promise<ServerBOQItem> {
  const snapshot = await getDocFromServer(itemRef(item.id));
  // Older documents may lack newer fields; those keep the workbook value.
  if (!snapshot.exists()) return { exists: false, fields: fieldsOfDoc(item), revision: 0, deleted: false };
  const data = snapshot.data();
  return {
    exists: true, fields: fieldsOfDoc({ ...fieldsOfDoc(item), ...data }), revision: data.revision || 0, deleted: !!data.deleted,
    updatedBy: data.updatedBy, updatedByName: data.updatedByName, updatedAt: data.updatedAt?.toMillis?.(),
  };
}
export async function putBOQItem(item: BOQItem, fields: BOQFields, revision: number, user: { uid: string; name?: string }, deleted: boolean): Promise<BOQOverride> {
  const clean = validateBOQFields(fields);
  await setDoc(itemRef(item.id), {
    ...clean,
    ...customFieldsOf(item),
    ...(deleted ? { deleted: true } : {}),
    revision,
    sourceSheet: item.sourceSheet,
    sourceRow: item.sourceRow,
    updatedBy: user.uid,
    ...(user.name ? { updatedByName: user.name.slice(0, 200) } : {}),
    updatedAt: serverTimestamp(),
  });
  return { ...clean, revision, ...(deleted ? { deleted: true } : {}), ...(item.custom ? { custom: true, room: item.room, classId: item.classId, floor: item.floor } : {}) };
}

export async function readBOQPhotos(id: string, cursor?: QueryDocumentSnapshot) {
  const photos = collection(db, 'boq_items', id, 'photos');
  const snapshot = await getDocs(query(photos, orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(21)));
  const visible = snapshot.docs.slice(0, 20);
  return { photos: visible.map(snapshot => ({ ...snapshot.data(), id: snapshot.id }) as BOQPhoto), cursor: visible[visible.length - 1], hasMore: snapshot.docs.length > 20 };
}

// Small chunks keep each request short on a weak connection; the outbox records finished
// chunks, so an interrupted upload resumes instead of starting over. Chunk IDs are
// positional within a content-addressed photo, so repeating a write is harmless.
export const PHOTO_CHUNK_BYTES = 256 * 1024;
export async function putBOQPhotoChunk(itemId: string, photoId: string, index: number, bytes: Uint8Array) {
  const chunkRef = doc(db, 'boq_items', itemId, 'photos', photoId, 'chunks', String(index).padStart(5, '0'));
  await setDoc(chunkRef, { index, data: Bytes.fromUint8Array(bytes), createdAt: serverTimestamp() });
}
// Published last: an incomplete upload stays invisible to readers.
export async function publishBOQPhoto(itemId: string, photo: Pick<BOQPhoto, 'id' | 'totalChunks' | 'name' | 'size' | 'contentType' | 'uploadedBy'>, thumb: Uint8Array): Promise<BOQPhoto> {
  const value = {
    path: `boq_items/${itemId}/photos/${photo.id}`,
    storageType: 'firestore-bytes' as const,
    totalChunks: photo.totalChunks,
    name: photo.name.slice(0, 500),
    size: photo.size,
    contentType: photo.contentType,
    uploadedBy: photo.uploadedBy,
    thumb: Bytes.fromUint8Array(thumb),
  };
  await setDoc(doc(db, 'boq_items', itemId, 'photos', photo.id), { ...value, createdAt: serverTimestamp() });
  return { ...value, id: photo.id };
}
// Thumbnails are stored inside the photo document, so listing photos does not download full images.
export const getBOQThumbURL = (photo: BOQPhoto) => photo.thumb ? URL.createObjectURL(new Blob([photo.thumb.toUint8Array() as BlobPart], { type: 'image/jpeg' })) : '';

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
