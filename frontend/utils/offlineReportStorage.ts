// ============================================================================
// FILE: offlineReportStorage.ts
// Deskripsi: Sistem Penyimpanan Laporan & Foto Offline Terpusat (IndexedDB).
//            Menjamin data laporan beserta seluruh foto base64 tersimpan aman
//            di storage lokal browser saat teknisi bekerja tanpa internet.
//            Data ini dapat di-preview, diekspor PDF/Excel secara instan,
//            serta disinkronkan ke Cloud Firestore ketika internet aktif.
// Database: 'DwimitraOfflineDB' | Stores: 'reports', 'photos'
// ============================================================================

export interface OfflinePhotoItem {
  id?: string;
  reportId: string;
  index: number;
  photoBase64: string;
  description: string;
  parameter?: string;
  hasPhoto: boolean;
  savedAt?: number;
}

export interface OfflineReportItem {
  id: string;                    // Firestore docId or generated offline ID
  fileName: string;
  maintenanceName: string;
  maintenanceTime: string;
  specificDetail?: string;
  companyType?: 'neutra' | 'bri' | 'k2';
  documentType: 'pdf' | 'excel' | 'hse';
  fileSize?: number;
  totalPhotos?: number;
  photosWithImage?: number;
  hasAbnormal?: boolean;
  serviceReportPayload?: any;
  hasServiceReport?: boolean;
  attachedSrFile?: any;
  attachedSrBase64?: string;
  createdBy: string;
  createdAt?: number;             // Timestamp in ms
  updatedAt?: number;
  isSynced?: boolean;             // True if synced to Cloud Firestore
  syncError?: string;
}

const DB_NAME = 'DwimitraOfflineDB';
const DB_VERSION = 1;
const STORE_REPORTS = 'reports';
const STORE_PHOTOS = 'photos';

const openOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_REPORTS)) {
        const reportStore = db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
        reportStore.createIndex('createdBy', 'createdBy', { unique: false });
        reportStore.createIndex('isSynced', 'isSynced', { unique: false });
        reportStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        const photoStore = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        photoStore.createIndex('reportId', 'reportId', { unique: false });
        photoStore.createIndex('reportId_index', ['reportId', 'index'], { unique: true });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const offlineReportStorage = {
  /**
   * Simpan dokumen laporan utama beserta foto-fotonya ke IndexedDB lokal.
   */
  async saveReport(
    report: Omit<OfflineReportItem, 'updatedAt'>,
    photos: Array<{ index: number; photoBase64: string; description: string; parameter?: string; hasPhoto?: boolean }> = []
  ): Promise<void> {
    try {
      const db = await openOfflineDB();
      const now = Date.now();

      // 1. Simpan data laporan
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(photos.length > 0 ? [STORE_REPORTS, STORE_PHOTOS] : [STORE_REPORTS], 'readwrite');
        const reportStore = tx.objectStore(STORE_REPORTS);
        const photoStore = photos.length > 0 ? tx.objectStore(STORE_PHOTOS) : null;

        const fullReport: OfflineReportItem = {
          totalPhotos: photos.length,
          photosWithImage: photos.filter(p => !!p.photoBase64).length,
          createdAt: report.createdAt || now,
          ...report,
          updatedAt: now,
          isSynced: report.isSynced ?? false,
        };

        reportStore.put(fullReport);

        // 2. Simpan setiap foto dengan key unik reportId_index jika ada
        if (photoStore && photos.length > 0) {
          photos.forEach((p, idx) => {
            const photoIndex = p.index || idx + 1;
            const photoItem: OfflinePhotoItem = {
              id: `${report.id}_photo_${photoIndex}`,
              reportId: report.id,
              index: photoIndex,
              photoBase64: p.photoBase64 || '',
              description: p.description || '',
              parameter: p.parameter || '',
              hasPhoto: !!p.photoBase64,
              savedAt: now,
            };
            photoStore.put(photoItem);
          });
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (err) {
      console.error('[offlineReportStorage] saveReport error:', err);
    }
  },

  /**
   * Ambil laporan berdasarkan id.
   */
  async getReport(id: string): Promise<OfflineReportItem | null> {
    try {
      const db = await openOfflineDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_REPORTS, 'readonly');
        const store = tx.objectStore(STORE_REPORTS);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('[offlineReportStorage] getReport error:', err);
      return null;
    }
  },

  /**
   * Ambil seluruh foto milik suatu laporan.
   */
  async getPhotos(reportId: string): Promise<OfflinePhotoItem[]> {
    try {
      const db = await openOfflineDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readonly');
        const store = tx.objectStore(STORE_PHOTOS);
        const index = store.index('reportId');
        const request = index.getAll(reportId);

        request.onsuccess = () => {
          const list: OfflinePhotoItem[] = request.result || [];
          list.sort((a, b) => a.index - b.index);
          resolve(list);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('[offlineReportStorage] getPhotos error:', err);
      return [];
    }
  },

  /**
   * Ambil semua laporan offline milik user (atau semua jika tidak difilter).
   */
  async getAllReports(userEmail?: string): Promise<OfflineReportItem[]> {
    try {
      const db = await openOfflineDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_REPORTS, 'readonly');
        const store = tx.objectStore(STORE_REPORTS);
        const request = store.getAll();

        request.onsuccess = () => {
          let list: OfflineReportItem[] = request.result || [];
          if (userEmail) {
            const cleanEmail = userEmail.toLowerCase().trim();
            list = list.filter(r => (r.createdBy || '').toLowerCase().trim() === cleanEmail);
          }
          list.sort((a, b) => ((b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)));
          resolve(list);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('[offlineReportStorage] getAllReports error:', err);
      return [];
    }
  },

  /**
   * Ambil semua laporan yang belum tersinkronisasi (isSynced === false).
   */
  async getUnsyncedReports(): Promise<OfflineReportItem[]> {
    try {
      const all = await this.getAllReports();
      return all.filter(r => !r.isSynced);
    } catch (err) {
      console.error('[offlineReportStorage] getUnsyncedReports error:', err);
      return [];
    }
  },

  /**
   * Tandai laporan sudah berhasil sinkron ke cloud Firestore.
   */
  async markSynced(id: string): Promise<void> {
    try {
      const db = await openOfflineDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_REPORTS, 'readwrite');
        const store = tx.objectStore(STORE_REPORTS);
        const getReq = store.get(id);

        getReq.onsuccess = () => {
          if (getReq.result) {
            const updated: OfflineReportItem = {
              ...getReq.result,
              isSynced: true,
              updatedAt: Date.now(),
            };
            store.put(updated);
          }
          resolve();
        };
        getReq.onerror = () => reject(getReq.error);
      });
    } catch (err) {
      console.error('[offlineReportStorage] markSynced error:', err);
    }
  },

  /**
   * Hapus laporan dan foto-fotonya dari penyimpanan lokal.
   */
  async deleteReport(id: string): Promise<void> {
    try {
      const db = await openOfflineDB();
      const photos = await this.getPhotos(id);

      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_REPORTS, STORE_PHOTOS], 'readwrite');
        const reportStore = tx.objectStore(STORE_REPORTS);
        const photoStore = tx.objectStore(STORE_PHOTOS);

        reportStore.delete(id);
        photos.forEach(p => {
          if (p.id) photoStore.delete(p.id);
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('[offlineReportStorage] deleteReport error:', err);
    }
  }
};
