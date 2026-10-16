import { getAppUpdateSnapshot, requireAppUpdate } from './appUpdate';

let activeRegistration: ServiceWorkerRegistration | null = null;
let lastCheck = 0;

/**
 * Cek versi baru di server (paling sering sekali per 30 detik). Selain saat load, tab aktif lagi,
 * dan tiap 30 menit, dipanggil juga saat pindah menu / buka modal upload supaya tab yang lama
 * terbuka tidak tertinggal versi. Tanpa service worker (dev, browser lama) tidak melakukan apa-apa.
 */
export function checkForAppUpdate() {
  if (!activeRegistration || !navigator.onLine || Date.now() - lastCheck < 30000) return;
  lastCheck = Date.now();
  void activeRegistration.update().catch(() => undefined);
}

export async function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const container = navigator.serviceWorker;
    const registration = await container.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    activeRegistration = registration;
    let hasController = Boolean(container.controller);
    const activateAndReload = async () => {
      if (registration.waiting) {
        await new Promise<void>((resolve, reject) => {
          const changed = () => { cleanup(); resolve(); };
          const timeout = window.setTimeout(() => {
            cleanup(); reject(new Error('Pembaruan belum berhasil diaktifkan. Silakan coba lagi.'));
          }, 20000);
          const cleanup = () => { window.clearTimeout(timeout); container.removeEventListener('controllerchange', changed); };
          container.addEventListener('controllerchange', changed);
          try { registration.waiting!.postMessage({ type: 'SKIP_WAITING' }); }
          catch (error) { cleanup(); reject(error); }
        });
      }
      window.location.reload();
    };
    const announce = () => requireAppUpdate(activateAndReload);
    if (registration.waiting && hasController) announce();
    const watchInstalling = () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && container.controller) announce();
      });
    };
    watchInstalling();
    registration.addEventListener('updatefound', watchInstalling);
    container.addEventListener('controllerchange', () => {
      // Updating another tab must not reload this tab's unsaved form.
      if (hasController && getAppUpdateSnapshot().phase !== 'updating') announce();
      hasController = true;
    });
    checkForAppUpdate();
    window.setInterval(checkForAppUpdate, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForAppUpdate(); });
  } catch (error) {
    console.warn('[AppUpdate] Service worker registration failed:', error);
  }
}
