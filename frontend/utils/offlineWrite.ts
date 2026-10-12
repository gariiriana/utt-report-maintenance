// ============================================================================
// FILE: frontend/utils/offlineWrite.ts
// Deskripsi: Simpan ke Firestore tanpa tombol "Menyimpan..." berputar terus saat sinyal hilang.
//            Firestore (persistentLocalCache) langsung menaruh setiap tulisan di antrean lokal HP
//            (IndexedDB) dan mengirimnya otomatis begitu sinyal kembali — juga setelah aplikasi
//            ditutup lalu dibuka lagi. Masalahnya, promise addDoc/setDoc/updateDoc baru selesai
//            setelah server menjawab. Helper di sini berhenti menunggu bila HP offline atau server
//            belum menjawab dalam beberapa detik, memberi tahu user bahwa data aman di HP, lalu
//            memberi kabar lagi saat semuanya sudah sampai di server.
// ============================================================================

import {
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  waitForPendingWrites,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type SetOptions,
  type WriteBatch,
} from 'firebase/firestore';
import { toast } from 'sonner';

// Batas tunggu jawaban server saat HP masih "online" tapi sinyalnya lemah
const SERVER_WAIT_MS = 6000;

export type WriteOutcome = 'synced' | 'queued';

// Jumlah tulisan yang sudah kita "lepas" (tersimpan di HP) tapi belum dikonfirmasi server
let queuedCount = 0;
let failedSinceLastSync = false;
const listeners = new Set<(hasQueued: boolean) => void>();

const setQueuedCount = (next: number, silent = false) => {
  const wasQueued = queuedCount > 0;
  queuedCount = Math.max(0, next);
  if (wasQueued !== queuedCount > 0) listeners.forEach((listener) => listener(queuedCount > 0));
  if (wasQueued && queuedCount === 0) {
    if (!failedSinceLastSync && !silent) {
      toast.success('Data yang tersimpan di HP sudah terkirim ke server ✓', { id: 'offline-synced', duration: 5000 });
    }
    failedSinceLastSync = false;
  }
};

/** Ada data tersimpan di HP yang belum sampai di server (untuk penanda offline & peringatan logout). */
export const hasQueuedWrites = () => queuedCount > 0;

export function subscribeQueuedWrites(listener: (hasQueued: boolean) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const isOffline = () => typeof navigator !== 'undefined' && !navigator.onLine;

/**
 * Tunggu tulisan Firestore selesai, tapi paling lama beberapa detik (langsung bila offline).
 * 'queued' = data sudah aman di antrean HP dan akan dikirim otomatis.
 * Error yang datang sebelum batas waktu tetap dilempar ke pemanggil seperti biasa.
 */
export async function trackWrite(write: Promise<unknown>): Promise<WriteOutcome> {
  let released = false;
  const settled = write.then(
    () => {
      if (released) setQueuedCount(queuedCount - 1);
      return 'synced' as const;
    },
    (error) => {
      if (released) {
        failedSinceLastSync = true;
        setQueuedCount(queuedCount - 1);
        console.error('[offlineWrite] Tulisan antrean ditolak server:', error);
        toast.error('Ada data yang gagal terkirim ke server', {
          id: 'offline-failed',
          description: `${error?.message || 'Ditolak server'}. Silakan simpan ulang data terakhir Anda.`,
          duration: 15000,
        });
      }
      throw error;
    },
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<'queued'>((resolve) => {
    timer = setTimeout(() => resolve('queued'), isOffline() || queuedCount > 0 ? 0 : SERVER_WAIT_MS);
  });

  try {
    const outcome = await Promise.race([settled, limit]);
    if (outcome === 'queued') {
      released = true;
      settled.catch(() => undefined); // kegagalan sesudahnya sudah diberitahukan lewat toast di atas
      setQueuedCount(queuedCount + 1);
      toast.info('Tersimpan di HP — terkirim otomatis begitu ada sinyal', {
        id: 'offline-queued',
        description: 'Boleh lanjut kerja. Jangan uninstall aplikasi / hapus data browser sebelum terkirim.',
        duration: 6000,
      });
    }
    return outcome;
  } finally {
    clearTimeout(timer);
  }
}

// Pengganti addDoc/setDoc/updateDoc/deleteDoc/batch.commit dengan perilaku trackWrite.
// addDoc diganti doc() + setDoc agar ID dokumen sudah diketahui walau server belum menjawab.

export async function addDocQueued(ref: CollectionReference<DocumentData>, data: DocumentData): Promise<DocumentReference<DocumentData>> {
  const newRef = doc(ref);
  await trackWrite(setDoc(newRef, data));
  return newRef;
}

export async function setDocQueued(ref: DocumentReference<DocumentData>, data: DocumentData, options?: SetOptions): Promise<WriteOutcome> {
  return trackWrite(options ? setDoc(ref, data, options) : setDoc(ref, data));
}

export async function updateDocQueued(ref: DocumentReference<DocumentData>, data: { [field: string]: any }): Promise<WriteOutcome> {
  return trackWrite(updateDoc(ref, data));
}

export async function deleteDocQueued(ref: DocumentReference<DocumentData>): Promise<WriteOutcome> {
  return trackWrite(deleteDoc(ref));
}

export async function commitBatchQueued(batch: WriteBatch): Promise<WriteOutcome> {
  return trackWrite(batch.commit());
}

/** Close a save spinner without claiming server success while writes are queued. */
export function toastWriteSuccess(message: string, options?: Parameters<typeof toast.success>[1]) {
  if (hasQueuedWrites()) {
    if (options?.id !== undefined) toast.dismiss(options.id);
    return;
  }
  toast.success(message, options);
}

/**
 * Setelah aplikasi dibuka lagi, tulisan yang tertinggal dari sesi sebelumnya (mis. disimpan
 * tanpa sinyal lalu aplikasi ditutup) dikirim otomatis oleh Firestore. Pantau supaya penanda
 * offline tahu masih ada data tertunda dan user dapat kabar saat semuanya terkirim.
 */
export function watchRestoredQueue(db: Firestore): () => void {
  let active = true;
  let counted = false;
  const timer = setTimeout(() => {
    if (!active) return;
    counted = true;
    setQueuedCount(queuedCount + 1);
  }, 1500);
  let succeeded = false;
  waitForPendingWrites(db)
    .then(() => { succeeded = true; })
    .catch(() => undefined)
    .finally(() => {
      clearTimeout(timer);
      if (counted) setQueuedCount(queuedCount - 1, !succeeded);
      counted = false;
    });
  // Ganti akun / logout: berhenti memantau tanpa mengabarkan "terkirim"
  return () => {
    active = false;
    clearTimeout(timer);
    if (counted) setQueuedCount(queuedCount - 1, true);
    counted = false;
  };
}
