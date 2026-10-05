// Offline-first outbox for the drafter's BOQ work. Drafters work where the signal drops or lags,
// so every text edit and photo is stored on the device first (IndexedDB) and sent in the
// background with retries. Photo uploads resume from the last finished chunk. Text edits are
// merged per field with the server version; a field changed differently by two drafters becomes
// a conflict the drafter resolves explicitly — nothing is overwritten silently.
import { useSyncExternalStore } from 'react';
import {
  MAX_PHOTO_BYTES, PHOTO_CHUNK_BYTES, customBOQItemFromInput, deleteBOQPhoto, newCustomBOQItemId,
  publishBOQPhoto, putBOQItem, putBOQPhotoChunk, readBOQItemFromServer,
} from '@/api/boq';
import type { BOQEditableField, BOQFields, BOQItem, BOQOverride, BOQPhoto, NewBOQItemInput } from '@/types/boq';
import { BOQ_EDITABLE_FIELDS, validateBOQFields } from './boqValidation';

interface OpBase { key: string; uid: string; itemId: string; createdAt: number; attempts: number; nextAttemptAt: number; error?: string }
export interface BOQConflict { fields: BOQEditableField[]; server: BOQFields; serverRevision: number; updatedByName?: string; updatedAt?: number }
export interface BOQTextOp extends OpBase {
  kind: 'text'; item: BOQItem;
  // `base` is what the drafter saw before editing; together with the server version it tells
  // which fields each side changed.
  base: BOQFields; fields: BOQFields; deleted: boolean; create: boolean;
  status: 'pending' | 'conflict'; conflict?: BOQConflict;
}
interface PhotoOp extends OpBase {
  kind: 'photo'; photoId: string; name: string; contentType: string; size: number; totalChunks: number;
  doneChunks: number[]; replaces?: { id: string; totalChunks?: number };
}
interface DeletePhotoOp extends OpBase { kind: 'deletePhoto'; photoId: string; totalChunks?: number }
type Op = BOQTextOp | PhotoOp | DeletePhotoOp;
interface BlobRecord { key: string; blob: Blob; thumb: Blob }

export interface BOQPhotoJob { key: string; itemId: string; photoId: string; name: string; size: number; progress: number; previewUrl: string; error?: string; waiting: boolean }
export type BOQSyncStatus = 'online' | 'syncing' | 'weak' | 'offline';
export interface BOQOutboxSnapshot {
  ready: boolean; status: BOQSyncStatus; running: boolean;
  pendingTexts: number; pendingPhotos: number; pendingDeletes: number; conflicts: number;
  texts: Record<string, BOQTextOp>; photoJobs: BOQPhotoJob[]; deletingPhotoIds: Set<string>;
  lastError: string;
}
export type BOQOutboxEvent =
  | { type: 'text'; itemId: string; value: BOQOverride }
  | { type: 'photo'; itemId: string; photo: BOQPhoto; replacedId?: string }
  | { type: 'photo-deleted'; itemId: string; photoId: string };

const DB_NAME = 'dwimitra-boq-outbox-v1';
const LEGACY_PHOTO_QUEUE = 'dwimitra-boq-photo-queue-v1';
const THUMB_EDGE = 360;
const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ---------------------------------------------------------------- IndexedDB
let dbPromise: Promise<IDBDatabase> | null = null;
function openDB(): Promise<IDBDatabase> {
  dbPromise ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('ops', { keyPath: 'key' });
      request.result.createObjectStore('blobs', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => { dbPromise = null; throw error; });
  return dbPromise;
}
async function store<T>(name: 'ops' | 'blobs', mode: IDBTransactionMode, run: (objectStore: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDB();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(name, mode);
    const request = run(transaction.objectStore(name));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Penyimpanan HP penuh atau ditolak browser.'));
  });
}
const saveOp = (op: Op) => store('ops', 'readwrite', s => s.put(op));
const deleteOpRecord = (key: string) => store('ops', 'readwrite', s => s.delete(key));
const saveBlob = (record: BlobRecord) => store('blobs', 'readwrite', s => s.put(record));
const readBlob = (key: string) => store<BlobRecord | undefined>('blobs', 'readonly', s => s.get(key));
const deleteBlob = (key: string) => store('blobs', 'readwrite', s => s.delete(key));

// ---------------------------------------------------------------- state
let uid = '';
let userName = '';
const ops = new Map<string, Op>();
const previews = new Map<string, string>();
const progress = new Map<string, number>();
let running = false;
let failures = 0;
let lastError = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let ready = false;
const snapshotListeners = new Set<() => void>();
const eventListeners = new Set<(event: BOQOutboxEvent) => void>();

function computeStatus(): BOQSyncStatus {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  const effectiveType = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
  if (failures > 0 || effectiveType === 'slow-2g' || effectiveType === '2g') return 'weak';
  return running ? 'syncing' : 'online';
}
function buildSnapshot(): BOQOutboxSnapshot {
  const all = [...ops.values()];
  const texts: Record<string, BOQTextOp> = {};
  const photoJobs: BOQPhotoJob[] = [];
  const deletingPhotoIds = new Set<string>();
  const now = Date.now();
  for (const op of all) {
    if (op.kind === 'text') texts[op.itemId] = op;
    else if (op.kind === 'deletePhoto') deletingPhotoIds.add(op.photoId);
    else photoJobs.push({
      key: op.key, itemId: op.itemId, photoId: op.photoId, name: op.name, size: op.size,
      progress: Math.round((progress.get(op.key) ?? op.doneChunks.length / op.totalChunks) * 100),
      previewUrl: previews.get(op.key) || '', error: op.error, waiting: op.nextAttemptAt > now || !navigator.onLine,
    });
  }
  photoJobs.sort((a, b) => a.key.localeCompare(b.key));
  return {
    ready, status: computeStatus(), running,
    pendingTexts: all.filter(op => op.kind === 'text' && op.status === 'pending').length,
    pendingPhotos: photoJobs.length,
    pendingDeletes: deletingPhotoIds.size,
    conflicts: all.filter(op => op.kind === 'text' && op.status === 'conflict').length,
    texts, photoJobs, deletingPhotoIds, lastError,
  };
}
let snapshot = buildSnapshot();
function notify() {
  snapshot = buildSnapshot();
  snapshotListeners.forEach(listener => listener());
}
function emit(event: BOQOutboxEvent) { eventListeners.forEach(listener => listener(event)); }

export function useBOQOutbox() {
  return useSyncExternalStore(listener => { snapshotListeners.add(listener); return () => snapshotListeners.delete(listener); }, () => snapshot);
}
export function onBOQOutboxEvent(listener: (event: BOQOutboxEvent) => void) {
  eventListeners.add(listener);
  return () => { eventListeners.delete(listener); };
}
export const hasPendingBOQWork = () => ops.size > 0;

// ---------------------------------------------------------------- lifecycle
const onConnectivity = () => { notify(); if (navigator.onLine) syncBOQNow(); };
export async function startBOQOutbox(user: { uid: string; name?: string }) {
  if (uid === user.uid) return;
  stopBOQOutbox();
  uid = user.uid; userName = user.name || '';
  // Ask the browser not to evict queued photos when the device runs low on storage.
  navigator.storage?.persist?.().catch(() => undefined);
  window.addEventListener('online', onConnectivity);
  window.addEventListener('offline', onConnectivity);
  try {
    const records = await store<Op[]>('ops', 'readonly', s => s.getAll());
    if (uid !== user.uid) return;
    for (const op of records) if (op.uid === uid) ops.set(op.key, op);
    for (const op of ops.values()) if (op.kind === 'photo') await loadPreview(op.key);
    await migrateLegacyPhotoQueue();
  } catch (error) {
    lastError = 'Antrean di HP tidak bisa dibuka: ' + messageOf(error);
  }
  ready = true;
  notify();
  syncBOQNow();
}
export function stopBOQOutbox() {
  clearTimeout(timer);
  window.removeEventListener('online', onConnectivity);
  window.removeEventListener('offline', onConnectivity);
  uid = ''; ready = false; failures = 0; lastError = '';
  ops.clear(); progress.clear();
  previews.forEach(url => URL.revokeObjectURL(url));
  previews.clear();
  notify();
}
async function loadPreview(key: string) {
  const record = await readBlob(key).catch(() => undefined);
  if (record && !previews.has(key)) previews.set(key, URL.createObjectURL(record.thumb));
}
async function removeOp(op: Op) {
  ops.delete(op.key);
  progress.delete(op.key);
  await deleteOpRecord(op.key);
  if (op.kind === 'photo') {
    await deleteBlob(op.key).catch(() => undefined);
    const url = previews.get(op.key);
    if (url) URL.revokeObjectURL(url);
    previews.delete(op.key);
  }
}
async function putOp(op: Op) {
  await saveOp(op);
  ops.set(op.key, op);
}

// The earlier per-item photo queue: move anything still waiting into the outbox.
async function migrateLegacyPhotoQueue() {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LEGACY_PHOTO_QUEUE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const records = await new Promise<Array<{ key: string; uid: string; itemId: string; file: File }>>((resolve, reject) => {
      const request = database.transaction('photos', 'readonly').objectStore('photos').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    for (const record of records.filter(entry => entry.uid === uid)) {
      await queueBOQPhotos(record.itemId, [record.file]).catch(() => undefined);
      await new Promise<void>(resolve => {
        const transaction = database.transaction('photos', 'readwrite');
        transaction.objectStore('photos').delete(record.key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      });
    }
  } finally { database.close(); }
}

// ---------------------------------------------------------------- sync engine
const RANK = { text: 0, deletePhoto: 1, photo: 2 } as const;
const backoff = (attempts: number) => Math.min(5000 * 2 ** Math.max(0, attempts - 1), 5 * 60_000);
class TimeoutError extends Error { code = 'deadline-exceeded'; }
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new TimeoutError('Sinyal terlalu lemah, pengiriman habis waktu.')), ms);
    promise.then(value => { clearTimeout(id); resolve(value); }, error => { clearTimeout(id); reject(error); });
  });
}
const codeOf = (error: unknown) => (error as { code?: string })?.code || '';
const messageOf = (error: unknown) => {
  const code = codeOf(error);
  if (code.includes('permission-denied')) return 'Ditolak server: aturan BOQ belum aktif atau role berubah.';
  if (code.includes('resource-exhausted')) return 'Kuota Firestore sedang penuh, dicoba lagi nanti.';
  if (code.includes('unavailable') || code.includes('cancelled')) return 'Koneksi terputus.';
  if (code.includes('deadline-exceeded')) return 'Sinyal terlalu lemah, pengiriman habis waktu.';
  return error instanceof Error ? error.message : String(error);
};
const isConnectionError = (error: unknown) => !navigator.onLine || ['deadline-exceeded', 'unavailable', 'cancelled'].some(code => codeOf(error).includes(code));
class RetrySoon extends Error {}

export function syncBOQNow() {
  for (const op of ops.values()) if (!(op.kind === 'text' && op.status === 'conflict')) op.nextAttemptAt = 0;
  void run();
}
function scheduleNext() {
  clearTimeout(timer);
  const waiting = [...ops.values()].filter(op => !(op.kind === 'text' && op.status === 'conflict'));
  if (!uid || !waiting.length) return;
  const delay = Math.max(1000, Math.min(...waiting.map(op => op.nextAttemptAt)) - Date.now());
  timer = setTimeout(() => void run(), delay);
}
async function run() {
  if (running || !uid || !ready) return;
  running = true;
  notify();
  const owner = uid;
  try {
    const due = [...ops.values()]
      .filter(op => !(op.kind === 'text' && op.status === 'conflict') && op.nextAttemptAt <= Date.now())
      .sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.createdAt - b.createdAt);
    for (const op of due) {
      if (!navigator.onLine || uid !== owner) break;
      if (!ops.has(op.key)) continue;
      try {
        if (op.kind === 'text') await processText(op.key);
        else if (op.kind === 'photo') await processPhoto(op.key);
        else await processDeletePhoto(op.key);
        failures = 0; lastError = '';
      } catch (error) {
        const current = ops.get(op.key);
        if (error instanceof RetrySoon) { if (current) current.nextAttemptAt = 0; continue; }
        failures++;
        lastError = messageOf(error);
        if (current) {
          current.attempts++;
          current.error = lastError;
          current.nextAttemptAt = Date.now() + backoff(current.attempts);
          await saveOp(current).catch(() => undefined);
        }
        // With no connection every other item would fail the same way; wait for the next round.
        if (isConnectionError(error)) break;
      } finally { notify(); }
    }
  } finally {
    running = false;
    notify();
    scheduleNext();
  }
}

const same = (a: string, b: string) => (a || '').trim() === (b || '').trim();
const sameFields = (a: BOQFields, b: BOQFields) => BOQ_EDITABLE_FIELDS.every(field => same(a[field], b[field]));
// Per-field three-way merge: a side "changed" a field when it differs from the shared base.
export function mergeBOQFields(base: BOQFields, mine: BOQFields, theirs: BOQFields) {
  const merged = { ...theirs };
  const conflicts: BOQEditableField[] = [];
  for (const field of BOQ_EDITABLE_FIELDS) {
    const mineChanged = !same(mine[field], base[field]);
    const theirsChanged = !same(theirs[field], base[field]);
    if (mineChanged && theirsChanged && !same(mine[field], theirs[field])) conflicts.push(field);
    if (mineChanged) merged[field] = mine[field];
  }
  return { merged, conflicts };
}

async function processText(key: string) {
  const start = ops.get(key) as BOQTextOp | undefined;
  if (!start) return;
  const server = await withTimeout(readBOQItemFromServer(start.item), 20_000);
  const op = ops.get(key) as BOQTextOp | undefined;
  if (!op || op.status === 'conflict') return;
  const sent = op.fields;
  const user = { uid: op.uid, name: userName };
  let value: BOQOverride;
  if (op.create && !server.exists) {
    value = await withTimeout(putBOQItem(op.item, sent, 1, user, op.deleted), 30_000);
  } else {
    // A retried create that already reached the server is our own version, not someone else's edit.
    const base = op.create && server.updatedBy === op.uid && server.revision === 1 ? server.fields : op.base;
    const { merged, conflicts } = mergeBOQFields(base, sent, server.fields);
    if (conflicts.length) {
      op.status = 'conflict';
      op.conflict = { fields: conflicts, server: server.fields, serverRevision: server.revision, updatedByName: server.updatedByName, updatedAt: server.updatedAt };
      await putOp(op);
      return;
    }
    const deleted = op.deleted || server.deleted;
    if (server.exists && sameFields(merged, server.fields) && deleted === server.deleted) {
      value = { ...server.fields, revision: server.revision, ...(deleted ? { deleted } : {}) };
    } else {
      try {
        value = await withTimeout(putBOQItem(op.item, merged, server.revision + 1, user, deleted), 30_000);
      } catch (error) {
        // Rejected because another drafter saved in between: read and merge again right away.
        if (codeOf(error).includes('permission-denied')) {
          const latest = await withTimeout(readBOQItemFromServer(op.item), 20_000);
          if (latest.revision !== server.revision) throw new RetrySoon();
        }
        throw error;
      }
    }
  }
  const latest = ops.get(key) as BOQTextOp | undefined;
  if (latest && latest.fields !== sent) {
    // Edited again while sending: what was sent is now the shared base for the newer edit.
    await putOp({ ...latest, base: { ...sent }, create: false, attempts: 0, nextAttemptAt: 0, error: undefined });
  } else if (latest) {
    await removeOp(latest);
  }
  emit({ type: 'text', itemId: op.itemId, value });
}

async function processPhoto(key: string) {
  const op = ops.get(key) as PhotoOp | undefined;
  if (!op) return;
  const record = await readBlob(key);
  if (!record) {
    await removeOp(op);
    throw new Error(`File foto "${op.name}" tidak ada lagi di HP; pilih ulang fotonya.`);
  }
  const done = new Set(op.doneChunks);
  const remaining = Array.from({ length: op.totalChunks }, (_, index) => index).filter(index => !done.has(index));
  let next = 0;
  let failed: unknown = null;
  // Two parallel chunks: faster on a lagging link without flooding it.
  await Promise.all(Array.from({ length: Math.min(2, remaining.length) }, async () => {
    while (next < remaining.length && !failed && ops.has(key)) {
      const index = remaining[next++];
      const start = index * PHOTO_CHUNK_BYTES;
      try {
        const bytes = new Uint8Array(await record.blob.slice(start, Math.min(start + PHOTO_CHUNK_BYTES, record.blob.size)).arrayBuffer());
        await withTimeout(putBOQPhotoChunk(op.itemId, op.photoId, index, bytes), 60_000);
        op.doneChunks = [...new Set([...op.doneChunks, index])];
        progress.set(key, op.doneChunks.length / op.totalChunks * 0.97);
        await saveOp(op);
        notify();
      } catch (error) { failed = error; }
    }
  }));
  if (failed) throw failed;
  if (!ops.has(key)) return; // cancelled while uploading
  const photo = await withTimeout(publishBOQPhoto(op.itemId, {
    id: op.photoId, totalChunks: op.totalChunks, name: op.name, size: op.size, contentType: op.contentType, uploadedBy: op.uid,
  }, new Uint8Array(await record.thumb.arrayBuffer())), 30_000);
  await removeOp(op);
  if (op.replaces) await queueBOQPhotoDelete(op.itemId, { id: op.replaces.id, totalChunks: op.replaces.totalChunks });
  emit({ type: 'photo', itemId: op.itemId, photo, replacedId: op.replaces?.id });
}

async function processDeletePhoto(key: string) {
  const op = ops.get(key) as DeletePhotoOp | undefined;
  if (!op) return;
  await withTimeout(deleteBOQPhoto(op.itemId, { id: op.photoId, totalChunks: op.totalChunks }), 45_000);
  await removeOp(op);
  emit({ type: 'photo-deleted', itemId: op.itemId, photoId: op.photoId });
}

// ---------------------------------------------------------------- photo preparation
// Option agreed with the team: keep the original resolution, re-encode as JPEG quality 85%.
// Phone cameras save at a much higher quality, so files shrink considerably while nameplates
// stay readable. If re-encoding does not make the file smaller, the original is kept.
async function encodeJpeg(source: ImageBitmap, width: number, height: number, quality: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas tidak tersedia.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas tidak tersedia.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Foto gagal dikompres.')), 'image/jpeg', quality));
}
export async function prepareBOQPhoto(file: File): Promise<{ blob: Blob; thumb: Blob; name: string; contentType: string }> {
  if (!ACCEPTED_TYPES.includes(file.type) || !file.size || file.size > MAX_INPUT_BYTES) {
    throw new Error(`${file.name}: gunakan JPG, PNG, atau WebP maksimal 40 MB.`);
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  let blob: Blob = file;
  let name = file.name;
  let contentType = file.type;
  let thumb: Blob;
  try {
    try {
      const encoded = await encodeJpeg(bitmap, bitmap.width, bitmap.height, 0.85);
      if (encoded.size < file.size) { blob = encoded; contentType = 'image/jpeg'; name = (file.name.replace(/\.[^.]+$/, '') || 'foto') + '.jpg'; }
    } catch { /* Not enough memory for a full-size canvas on this phone: upload the original file. */ }
    const scale = Math.min(1, THUMB_EDGE / Math.max(bitmap.width, bitmap.height));
    thumb = await encodeJpeg(bitmap, Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)), 0.7);
  } finally { bitmap.close(); }
  if (blob.size > MAX_PHOTO_BYTES) {
    throw new Error(`${file.name}: masih ${(blob.size / 1024 / 1024).toFixed(1)} MB setelah dikompres (maks. 10 MB).`);
  }
  return { blob, thumb, name, contentType };
}
async function sha256(blob: Blob) {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- queueing (called by the UI)
const requireUser = () => { if (!uid) throw new Error('Sesi login diperlukan.'); return uid; };

export async function queueBOQPhotos(itemId: string, files: File[], replaces?: BOQPhoto): Promise<{ queued: number; errors: string[] }> {
  const owner = requireUser();
  const errors: string[] = [];
  let queued = 0;
  for (const file of files) {
    try {
      const prepared = await prepareBOQPhoto(file);
      const photoId = await sha256(prepared.blob);
      const key = `photo:${owner}:${itemId}:${photoId}`;
      if (ops.has(key) || photoId === replaces?.id) continue;
      await saveBlob({ key, blob: prepared.blob, thumb: prepared.thumb });
      await putOp({
        key, kind: 'photo', uid: owner, itemId, photoId, name: prepared.name.slice(0, 500), contentType: prepared.contentType, size: prepared.blob.size,
        totalChunks: Math.ceil(prepared.blob.size / PHOTO_CHUNK_BYTES), doneChunks: [],
        ...(replaces ? { replaces: { id: replaces.id, totalChunks: replaces.totalChunks } } : {}),
        createdAt: Date.now(), attempts: 0, nextAttemptAt: 0,
      });
      previews.set(key, URL.createObjectURL(prepared.thumb));
      queued++;
    } catch (error) { errors.push(messageOf(error)); }
  }
  notify();
  void run();
  return { queued, errors };
}
export async function queueBOQPhotoDelete(itemId: string, photo: Pick<BOQPhoto, 'id' | 'totalChunks'>) {
  const owner = requireUser();
  const key = `del:${owner}:${itemId}:${photo.id}`;
  if (!ops.has(key)) await putOp({ key, kind: 'deletePhoto', uid: owner, itemId, photoId: photo.id, totalChunks: photo.totalChunks, createdAt: Date.now(), attempts: 0, nextAttemptAt: 0 });
  notify();
  void run();
}
// A photo that has not been sent yet is simply dropped from the queue.
export async function cancelBOQPhotoUpload(key: string) {
  const op = ops.get(key);
  if (op?.kind === 'photo') await removeOp(op);
  notify();
}

export async function queueBOQText(item: BOQItem, base: BOQFields, fields: BOQFields, deleted = false) {
  const owner = requireUser();
  const clean = validateBOQFields(fields);
  const key = `text:${owner}:${item.id}`;
  const existing = ops.get(key) as BOQTextOp | undefined;
  await putOp(existing
    ? { ...existing, item, fields: clean, deleted: existing.deleted || deleted, attempts: 0, nextAttemptAt: 0, error: undefined }
    : { key, kind: 'text', uid: owner, itemId: item.id, item, base: { ...base }, fields: clean, deleted, create: false, status: 'pending', createdAt: Date.now(), attempts: 0, nextAttemptAt: 0 });
  notify();
  void run();
}
export async function queueBOQCreate(input: NewBOQItemInput): Promise<BOQItem> {
  const owner = requireUser();
  const item = customBOQItemFromInput(newCustomBOQItemId(), input);
  const fields = validateBOQFields(input);
  await putOp({ key: `text:${owner}:${item.id}`, kind: 'text', uid: owner, itemId: item.id, item, base: fields, fields, deleted: false, create: true, status: 'pending', createdAt: Date.now(), attempts: 0, nextAttemptAt: 0 });
  notify();
  void run();
  return item;
}
// Field by field choice between the drafter's value and the server value.
export async function resolveBOQConflict(itemId: string, choice: Partial<Record<BOQEditableField, 'mine' | 'server'>>) {
  const owner = requireUser();
  const op = ops.get(`text:${owner}:${itemId}`) as BOQTextOp | undefined;
  if (!op?.conflict) return;
  const server = op.conflict.server;
  const { merged } = mergeBOQFields(op.base, op.fields, server);
  for (const field of op.conflict.fields) merged[field] = choice[field] === 'server' ? server[field] : op.fields[field];
  // The server version becomes the base, so only the drafter's remaining differences are sent.
  await putOp({ ...op, base: { ...server }, fields: merged, status: 'pending', conflict: undefined, attempts: 0, nextAttemptAt: 0, error: undefined });
  notify();
  void run();
}

// Fields as the drafter currently sees them: queued edits on top of the last known server value.
export function pendingBOQFields(itemId: string): BOQFields | undefined {
  return snapshot.texts[itemId]?.fields;
}
