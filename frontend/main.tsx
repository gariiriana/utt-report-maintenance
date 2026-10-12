// ============================================================================
// FILE: frontend/main.tsx
// Deskripsi: Titik Masuk Utama (Main Entry Point) Aplikasi React Client-Side.
//            Menginisialisasi pendaftaran Progressive Web App (PWA Service Worker),
//            menerapkan DOM Polyfill pengaman crash React DOM `removeChild`/`insertBefore`,
//            dan merender komponen utama `<App />` ke elemen DOM `#root`.
// ============================================================================

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./themes/index.css";
import "./api/firebase";
import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

// Auto-redirect dari domain default Firebase ke Custom Domain resmi
if (typeof window !== 'undefined') {
  try {
    const h = window.location.hostname.toLowerCase();
    if (h === 'report-utt.web.app' || h === 'report-utt.firebaseapp.com') {
      window.location.replace('https://dwimitrasystem.com' + window.location.pathname + window.location.search + window.location.hash);
    }
  } catch (_) {}
}

// Keep the PWA service worker in production; unregister stale workers during local development
// so Vite always serves the current source instead of a cached production bundle.
if (import.meta.env.PROD) {
  const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;
  const updateSW = registerSW({
    immediate: true,
    // Versi baru menunggu persetujuan user: reload otomatis bisa menghapus form yang sedang diisi.
    onNeedRefresh() {
      toast.info('Versi baru aplikasi tersedia', {
        id: 'pwa-update',
        duration: Infinity,
        description: 'Simpan dulu pekerjaan Anda, lalu tekan Perbarui.',
        action: { label: 'Perbarui', onClick: () => { void updateSW(true); } },
      });
    },
    // Aplikasi terpasang bisa terbuka berhari-hari tanpa reload: cek versi baru berkala & saat dibuka lagi.
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      let lastCheck = Date.now();
      const checkForUpdate = () => {
        if (!navigator.onLine || Date.now() - lastCheck < UPDATE_CHECK_INTERVAL) return;
        lastCheck = Date.now();
        registration.update().catch(() => undefined);
      };
      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    },
  });
} else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => { void registration.unregister(); });
  });
}

/**
 * Polyfill DOM Node Prototype Pengaman Crash React
 * Junior Dev Notes: Ekstensi browser (seperti Google Translate atau Password Manager)
 * dan Framer Motion sering memanipulasi node DOM secara langsung tanpa sepengetahuan React.
 * Polyfill ini mencegah error fatal `NotFoundError: Failed to execute 'removeChild' on 'Node'`.
 */
if (typeof window !== 'undefined') {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (child.parentNode) {
        return child.parentNode.removeChild(child);
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (referenceNode.parentNode) {
        return referenceNode.parentNode.insertBefore(newNode, referenceNode);
      }
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

// Render Komponen Utama React <App /> ke elemen <div id="root">
createRoot(document.getElementById("root")!).render(<App />);
