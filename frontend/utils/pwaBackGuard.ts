// ============================================================================
// FILE: frontend/utils/pwaBackGuard.ts
// Deskripsi: Penjaga tombol Kembali (Back) Android / gesture kembali saat aplikasi
//            berjalan sebagai PWA terpasang.
//            Aplikasi ini menyimpan halaman aktif di state React (bukan URL), jadi tanpa
//            penjaga ini satu kali tekan Back langsung menutup aplikasi dan form yang
//            sedang diisi hilang. Dengan penjaga:
//            1. Back saat ada popup/drawer terbuka → popup/drawer ditutup.
//            2. Back di halaman biasa → muncul "Tekan Kembali sekali lagi untuk keluar".
// ============================================================================

import { toast } from 'sonner';
import { hasActiveModalsInDOM, isModalOverlayElement } from '@/utils/modalScrollLock';

const GUARD_STATE = { dwimitraBackGuard: true };
const EXIT_WINDOW_MS = 2500;

let guardActive = false;
let rearmTimer: number | null = null;

function pushGuard() {
  if (guardActive) return;
  guardActive = true;
  window.history.pushState(GUARD_STATE, '', window.location.href);
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

function onPopState() {
  guardActive = false;
  if (rearmTimer !== null) {
    window.clearTimeout(rearmTimer);
    rearmTimer = null;
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
  const onPointerDown = () => pushGuard();
  pushGuard();
  window.addEventListener('popstate', onPopState);
  window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  return () => {
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('pointerdown', onPointerDown, { capture: true });
    if (rearmTimer !== null) window.clearTimeout(rearmTimer);
    rearmTimer = null;
  };
}
