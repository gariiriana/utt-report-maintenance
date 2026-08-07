// ============================================================================
// FILE: draftStorage.ts
// Deskripsi: Penyimpanan draft laporan menggunakan IndexedDB browser.
//            Dipakai untuk menyimpan progress pengisian form laporan
//            supaya kalau browser ditutup / refresh, data tidak hilang.
//            IndexedDB dipilih (bukan localStorage) karena bisa menyimpan
//            data lebih besar (foto base64, form data kompleks).
// Database: 'ReportDraftsDB', Store: 'drafts'
// ============================================================================

// Konfigurasi IndexedDB
const DB_NAME = 'ReportDraftsDB';  // Nama database di browser
const DB_VERSION = 1;               // Versi database (naikkan kalau ada perubahan struktur)
const STORE_NAME = 'drafts';        // Nama object store (seperti "tabel" di database)

// Fungsi internal untuk membuka koneksi ke IndexedDB
// Return Promise karena IndexedDB bersifat asynchronous
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // Event ini dipanggil saat pertama kali buat database atau upgrade versi
        // Di sini kita buat object store 'drafts' kalau belum ada
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        // Koneksi berhasil dibuka
        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        // Gagal buka koneksi (mungkin browser tidak support)
        request.onerror = (event) => {
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
};

// Object utama untuk operasi CRUD draft
// Cara pakai:
//   await draftStorage.set('form_pm', formData);   // Simpan draft
//   const data = await draftStorage.get('form_pm'); // Baca draft
//   await draftStorage.remove('form_pm');           // Hapus draft
export const draftStorage = {
    // Simpan data draft ke IndexedDB
    // key = identifier unik (contoh: 'pm_report_draft')
    // value = data yang mau disimpan (bisa object, string, array, dll.)
    async set(key: string, value: any): Promise<void> {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(value, key); // put = insert or update

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('draftStorage.set error:', error);
            throw error;
        }
    },

    // Ambil data draft dari IndexedDB berdasarkan key
    // Return null kalau data tidak ditemukan atau terjadi error
    async get(key: string): Promise<any> {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('draftStorage.get error:', error);
            return null;
        }
    },

    // Hapus data draft dari IndexedDB berdasarkan key
    // Dipanggil setelah laporan berhasil disubmit (draft tidak diperlukan lagi)
    async remove(key: string): Promise<void> {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(key);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('draftStorage.remove error:', error);
        }
    }
};
