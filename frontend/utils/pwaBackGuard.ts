// ============================================================================
// FILE: frontend/utils/pwaBackGuard.ts
// Deskripsi: Penjaga tombol Kembali (Back) Android / gesture kembali saat aplikasi
//            berjalan sebagai PWA terpasang.
//            Riwayat URL menangani navigasi halaman/folder. Penjaga hanya menangani
//            popup dan batas awal sesi PWA. Dengan penjaga:
//            1. Back saat ada popup/drawer terbuka → popup/drawer ditutup.
//            2. Back mengikuti riwayat halaman/folder; di awal sesi, tekan dua kali untuk keluar.
// ============================================================================

import { toast } from 'sonner';
import { hasActiveModalsInDOM, isModalOverlayElement } from '@/utils/modalScrollLock';
import { NAVIGATION_EVENT } from '@/utils/appNavigation';

const GUARD_STATE = { dwimitraBackGuard: true };
const EXIT_WINDOW_MS = 2500;

let guardActive = false;
let rearmTimer: number | null = null;
let currentIndex = 0;
let restoringModalRoute = false;

function cancelRearm() {
  if (rearmTimer !== null) window.clearTimeout(rearmTimer);
  rearmTimer = null;
}

function pushGuard() {
  if (guardActive) return;
  guardActive = true;
  window.history.pushState({ ...window.history.state, dwimitraBackBoundary: false, ...GUARD_STATE }, '', window.location.href);
}

function zIndexOf(el: HTMLElement): number {
  const z = parseInt(window.getComputedStyle(el).zIndex, 10);
  return Number.isFinite(z) ? z : 0;
}

/** Popup/overlay paling atas yang sedang tampil (fixed inset-0 dengan backdrop). */
function topmostOverlay(): HTMLElement | null {
  const overlays = Array.from(
    document.querySelectorAll<HTMLElement>('.fixed.inset-0, div[class*="fixed"][class*="inset-0"]'),
  ).filter(isModalOverlayElement);
  let top: HTMLElement | null = null;
  for (const el of overlays) {
    if (!top || zIndexOf(el) >= zIndexOf(top)) top = el;
  }
  return top;
}

/**
 * Titik di tepi overlay yang mengenai backdrop-nya sendiri (bukan tombol/kartu di dalamnya).
 * Klik di titik itu sama dengan user mengetuk area gelap di luar popup.
 */
function findBackdropTarget(overlay: HTMLElement): HTMLElement | null {
  const r = overlay.getBoundingClientRect();
  const points: Array<[number, number]> = [
    [r.left + 6, r.top + 6], [r.left + 6, r.bottom - 6],
    [r.right - 6, r.top + 6], [r.right - 6, r.bottom - 6],
    [r.left + 6, r.top + r.height / 2], [r.right - 6, r.top + r.height / 2],
  ];
  for (const [x, y] of points) {
    const hit = document.elementFromPoint(x, y);
    if (!(hit instanceof HTMLElement) || !overlay.contains(hit)) continue;
    if (hit === overlay) return hit;
    const cls = typeof hit.className === 'string' ? hit.className : '';
    const isBackdrop = cls.includes('inset-0') && !hit.querySelector('button, input, select, textarea, a');
    if (isBackdrop) return hit;
  }
  return null;
}

/** Tutup popup/drawer paling atas. Mengembalikan false bila tidak ada popup terbuka. */
function closeTopLayer(): boolean {
  if (!hasActiveModalsInDOM()) return false;
  const overlay = topmostOverlay();

  // Dialog Radix & popup yang mendukung Escape menutup diri dari event ini.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));

  const stillOpen = () => !!overlay && overlay.isConnected && isModalOverlayElement(overlay);
  const showHint = () => toast.info('Tutup jendela ini dengan tombol ✕ atau Batal.', { id: 'pwa-back-hint', duration: 2500 });

  // Popup lain: ketuk backdrop-nya, persis seperti user mengetuk area di luar popup.
  // Tombol di dalam popup (mis. "Batal") sengaja tidak diklik: di beberapa popup tombol itu punya aksi lain.
  window.setTimeout(() => {
    if (!stillOpen()) return;
    const target = findBackdropTarget(overlay!);
    if (!target) {
      showHint();
      return;
    }
    target.click();
    // Popup yang tidak bisa ditutup dari luar tetap terbuka: beri tahu user caranya.
    window.setTimeout(() => { if (stillOpen()) showHint(); }, 600);
  }, 80);
  return true;
}

function onPopState(event: PopStateEvent) {
  const previousIndex = currentIndex;
  currentIndex = event.state?.dwimitraNavigationIndex || 0;
  guardActive = Boolean(event.state?.dwimitraBackGuard);
  cancelRearm();

  if (restoringModalRoute) {
    restoringModalRoute = false;
    return;
  }

  // Real route traversal must keep Back/Forward intact, including its forward stack.
  if (!event.state?.dwimitraBackBoundary && (event.state?.dwimitraNavigation || event.state?.dwimitraBackGuard)) {
    if (closeTopLayer()) {
      restoringModalRoute = true;
      window.history.go(previousIndex > currentIndex ? 1 : -1);
    }
    return;
  }

  if (closeTopLayer()) {
    pushGuard();
    return;
  }

  // Penjaga dibiarkan lepas sebentar: Back berikutnya dalam 2,5 detik menutup aplikasi.
  toast.info('Tekan Kembali sekali lagi untuk keluar dari aplikasi.', { id: 'pwa-back-exit', duration: EXIT_WINDOW_MS });
  rearmTimer = window.setTimeout(() => {
    rearmTimer = null;
    pushGuard();
  }, EXIT_WINDOW_MS);
}

/** Pasang penjaga tombol Back. Panggil hanya saat aplikasi berjalan sebagai PWA terpasang. */
export function initPwaBackGuard(): () => void {
  if (typeof window === 'undefined') return () => {};
  // Entri penjaga dibuat ulang saat user mengetuk layar, supaya browser tidak melewatinya.
  const onPointerDown = () => {
    if (window.history.state?.dwimitraBackBoundary || !window.history.state?.dwimitraNavigation) pushGuard();
  };
  const onNavigation = () => {
    currentIndex = window.history.state?.dwimitraNavigationIndex || 0;
    guardActive = Boolean(window.history.state?.dwimitraBackGuard);
    if (window.history.state?.dwimitraBackBoundary) return;
    cancelRearm();
    toast.dismiss('pwa-back-exit');
  };
  guardActive = Boolean(window.history.state?.dwimitraBackGuard);
  currentIndex = window.history.state?.dwimitraNavigationIndex || 0;
  // Refreshing a routed entry must not insert a duplicate entry ahead of it.
  if (!window.history.state?.dwimitraNavigation && !guardActive) {
    window.history.replaceState({ ...window.history.state, dwimitraBackBoundary: true }, '', window.location.href);
    pushGuard();
  }
  window.addEventListener('popstate', onPopState);
  window.addEventListener(NAVIGATION_EVENT, onNavigation);
  window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  return () => {
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener(NAVIGATION_EVENT, onNavigation);
    window.removeEventListener('pointerdown', onPointerDown, { capture: true });
    cancelRearm();
    guardActive = false;
    restoringModalRoute = false;
  };
}
