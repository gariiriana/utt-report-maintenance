import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getAnalytics, isSupported } from "firebase/analytics";
// import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

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

// ============================================================
// Initialize Firebase
// ============================================================
const app = initializeApp(firebaseConfig);

// Initialize Analytics
let analyticsPromise: Promise<any> | null = null;
if (typeof window !== 'undefined') {
  analyticsPromise = isSupported().then(supported => {
    if (supported) {
      return getAnalytics(app);
    }
    return null;
  });
}

/**
 * Helper to log events safely
 */
export const logFirebaseEvent = async (eventName: string, params?: Record<string, any>) => {
  if (analyticsPromise) {
    const analytics = await analyticsPromise;
    if (analytics) {
      const { logEvent } = await import('firebase/analytics');
      logEvent(analytics, eventName, params);
    }
  }
};

export { analyticsPromise as analytics };

// ============================================================
// Firebase App Check — Proteksi dari bot, scraper, dan DDoS
// Menggunakan reCAPTCHA v3 (invisible, tidak mengganggu UX)
//
// SETUP (1x manual di Firebase Console):
// 1. Buka: https://console.firebase.google.com/project/report-utt/appcheck
// 2. Register app dengan provider "reCAPTCHA v3"
// 3. Buka: https://www.google.com/recaptcha/admin → buat site baru (v3)
// 4. Copy Site Key → masukkan ke VITE_RECAPTCHA_SITE_KEY di .env
// 5. Di Firebase Console App Check → klik "Enforce" untuk Firestore, Auth, Storage
// ============================================================
if (import.meta.env.DEV) {
  // Dev mode: pakai debug token supaya local dev tetap bisa akses Firebase
  // @ts-ignore - global token untuk App Check debug
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

// TEMPORARY: Dimatikan sementara karena error 403 (invalid token) di production
/*
if (recaptchaSiteKey) {
  // App Check aktif hanya jika site key sudah dikonfigurasi
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
*/

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
