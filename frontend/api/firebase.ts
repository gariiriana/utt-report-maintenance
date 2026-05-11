import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getAnalytics, isSupported } from "firebase/analytics";

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

const app = initializeApp(firebaseConfig);

let analyticsPromise: Promise<any> | null = null;
let analyticsInitialized = false;

function initAnalytics(): Promise<any> {
  if (analyticsInitialized) return analyticsPromise!;
  analyticsInitialized = true;

  analyticsPromise = isSupported().then(supported => {
    if (supported) {
      return getAnalytics(app);
    }
    return null;
  });
  return analyticsPromise;
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    setTimeout(initAnalytics, 100);
  } else {
    window.addEventListener('load', () => {
      setTimeout(initAnalytics, 100);
    }, { once: true });
  }
}

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

if (import.meta.env.DEV) {
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const storage = getStorage(app);
export const rtdb = getDatabase(app);

