export interface PendingBOQPhoto { key: string; uid: string; itemId: string; id: string; file: File }
export type QueuedBOQPhoto = Omit<PendingBOQPhoto, 'file'> & { name: string; size: number };
function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('dwimitra-boq-photo-queue-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function execute<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openQueue();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('photos', mode);
      const request = operation(transaction.objectStore('photos'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Antrean foto gagal disimpan.'));
    });
  } finally { database.close(); }
}
export const enqueueBOQPhoto = (photo: PendingBOQPhoto) => execute('readwrite', store => store.put(photo));
export const removeBOQPhotoFromQueue = (key: string) => execute('readwrite', store => store.delete(key));
export const getQueuedBOQPhoto = (key: string) => execute<PendingBOQPhoto | undefined>('readonly', store => store.get(key));
export async function readBOQPhotoQueue(uid: string, itemId: string): Promise<QueuedBOQPhoto[]> {
  const database = await openQueue();
  try {
    return await new Promise((resolve, reject) => {
      const prefix = uid + ':' + itemId + ':';
      const transaction = database.transaction('photos', 'readonly');
      const request = transaction.objectStore('photos').openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'));
      const result: QueuedBOQPhoto[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const photo = cursor.value as PendingBOQPhoto;
        result.push({ key: photo.key, uid, itemId, id: photo.id, name: photo.file.name, size: photo.file.size });
        cursor.continue();
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}
