// ============================================================================
// FILE: safeStorage.ts
// Deskripsi: Wrapper aman untuk localStorage browser.
//            Beberapa browser/mode (Incognito, iOS Safari) bisa memblokir
//            akses ke localStorage. File ini menangani error tersebut
//            supaya aplikasi tidak crash.
// Cara pakai: import { safeStorage } from '@/utils/safeStorage';
//             safeStorage.getItem('key');  // Baca data
//             safeStorage.setItem('key', 'value');  // Simpan data
//             safeStorage.removeItem('key');  // Hapus data
// ============================================================================

export const safeStorage = {
    // Ambil data dari localStorage berdasarkan key
    // Return null kalau localStorage diblokir browser
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('localStorage access denied:', e);
            return null;
        }
    },

    // Simpan data ke localStorage
    // Kalau browser blokir, cuma log warning (tidak crash)
    setItem: (key: string, value: string): void => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('localStorage access denied:', e);
        }
    },

    // Hapus data dari localStorage berdasarkan key
    removeItem: (key: string): void => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('localStorage access denied:', e);
        }
    }
};
