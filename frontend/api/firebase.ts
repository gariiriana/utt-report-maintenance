// ============================================================================
// FILE: firebase.ts
// Deskripsi: File konfigurasi utama Firebase untuk DwimitraSystem.
//            Semua koneksi ke layanan Firebase (Auth, Firestore, Storage,
//            Realtime Database, Analytics) diinisialisasi di sini.
//            File ini di-import oleh hampir seluruh komponen frontend.
// ============================================================================

// Import modul-modul Firebase yang dibutuhkan
import { initializeApp } from "firebase/app";             // Inisialisasi app Firebase
import { getAuth } from "firebase/auth";                   // Autentikasi (login/logout)
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore"; // Database NoSQL (Firestore)
import { getStorage } from "firebase/storage";             // Penyimpanan file (foto, dokumen)
import { getDatabase } from "firebase/database";           // Realtime Database (untuk data live/realtime)
import { getAnalytics, isSupported } from "firebase/analytics"; // Analytics (tracking penggunaan app)
import { getFunctions } from "firebase/functions";         // Cloud Functions (HTTPS Callable & Cloud Tasks)

// Konfigurasi Firebase — semua value diambil dari file .env (environment variables)
// PENTING: Jangan pernah hardcode API key di sini, selalu pakai import.meta.env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: "https://report-utt-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Inisialisasi Firebase App — ini adalah titik awal semua layanan Firebase
const app = initializeApp(firebaseConfig);

// === ANALYTICS (Lazy Initialization) ===
// Analytics tidak langsung dijalankan supaya tidak memperlambat loading awal aplikasi.
// Baru diaktifkan setelah halaman selesai dimuat (window 'load' event).
let analyticsPromise: Promise<any> | null = null;
let analyticsInitialized = false;

// Fungsi untuk inisialisasi Analytics secara lazy (ditunda)
// Mengecek dulu apakah browser mendukung Analytics sebelum mengaktifkannya
function initAnalytics(): Promise<any> {
  if (analyticsInitialized) return analyticsPromise!; // Kalau sudah pernah init, skip
  analyticsInitialized = true;

  analyticsPromise = isSupported().then(supported => {
    if (supported) {
      return getAnalytics(app); // Aktifkan analytics kalau browser support
    }
    return null; // Kalau browser tidak support (misal: incognito mode), skip
  });
  return analyticsPromise;
}

// Jalankan analytics setelah halaman selesai dimuat di browser
// Pakai setTimeout 100ms supaya tidak blocking render awal
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    setTimeout(initAnalytics, 100);
  } else {
    window.addEventListener('load', () => {
      setTimeout(initAnalytics, 100);
    }, { once: true });
  }
}

// Fungsi untuk mencatat event analytics (contoh: user klik tombol tertentu)
// Cara pakai: logFirebaseEvent('button_click', { buttonName: 'submit_report' })
export const logFirebaseEvent = async (eventName: string, params?: Record<string, any>) => {
  if (!analyticsInitialized) {
    initAnalytics();
  }
  if (analyticsPromise) {
    const analytics = await analyticsPromise;
    if (analytics) {
      const { logEvent } = await import('firebase/analytics');
      logEvent(analytics, eventName, params);
    }
  }
};

export { analyticsPromise as analytics };

// Mode Development: aktifkan debug token untuk App Check
// Ini supaya App Check tidak memblokir request saat develop di localhost
if (import.meta.env.DEV) {
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// === EXPORT LAYANAN FIREBASE UTAMA ===
// Semua komponen frontend mengimpor variabel-variabel ini untuk akses database, auth, dll.

// Auth — untuk login, logout, cek status user
export const auth = getAuth(app);

// Firestore — database utama NoSQL untuk menyimpan laporan, user data, dll.
// Menggunakan persistent local cache + multi-tab manager supaya data tetap tersedia
// meskipun offline, dan sinkron antar tab browser yang terbuka
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Storage — untuk upload/download file (foto laporan, dokumen PDF, dll.)
export const storage = getStorage(app);

// Realtime Database — untuk fitur yang butuh data live/realtime
// (contoh: status online user, notifikasi instant)
export const rtdb = getDatabase(app);

// Cloud Functions — untuk memanggil callable functions (AI, WhatsApp Cloud Reminder, dll)
export const functions = getFunctions(app, "asia-southeast1");

