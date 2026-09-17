// ============================================================================
// FILE: frontend/utils/modalScrollLock.ts
// Deskripsi: Utilitas Universal Modal Scroll Lock & Background Containment.
//            Secara otomatis mendeteksi kemunculan popup/modal apa pun di layar
//            (termasuk Predictive Report, MOP, PTW, CM, Monthly Report, dsb.)
//            dan mengunci scrolling halaman latar belakang (document.body & html)
//            hingga seluruh popup ditutup kembali.
// ============================================================================

import { useEffect } from 'react';

// Counter untuk melacak jumlah modal yang sedang terbuka
let programmaticLockCount = 0;
let isGloballyLocked = false;
let observerInitialized = false;
let savedScrollY = 0;

/**
 * Memeriksa apakah sebuah elemen DOM merupakan modal/popup/overlay aktif.
 */
export function isModalOverlayElement(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;

  // 1. Abaikan elemen dekorasi background (seperti DataCenterBackground)
  if (
    el.classList.contains('pointer-events-none') ||
    el.getAttribute('aria-hidden') === 'true' ||
    el.id === 'root'
  ) {
    return false;
  }

  // 2. Abaikan elemen yang sedang disembunyikan (display: none / visibility: hidden)
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  // 3. Deteksi standar aksesibilitas ARIA Dialog
  const role = el.getAttribute('role');
  const isAriaModal = el.getAttribute('aria-modal') === 'true';
  if ((role === 'dialog' || role === 'alertdialog' || isAriaModal) && style.position === 'fixed') {
    return true;
  }

  // 4. Deteksi elemen fixed inset-0 (overlay / backdrop / modal wrapper)
  const className = typeof el.className === 'string' ? el.className : '';
  const isFixed = className.includes('fixed') || style.position === 'fixed';
  if (!isFixed) return false;

  const isInset0 =
    className.includes('inset-0') ||
    (style.top === '0px' && style.left === '0px' && (style.width === '100vw' || style.width === '100%'));

  if (!isInset0) return false;

  // 5. Evaluasi z-index (modal harus memiliki z-index signifikan, minimal >= 30)
  const zVal = parseInt(style.zIndex || '0', 10);
  const hasHighZIndex =
    zVal >= 30 ||
    /z-(?:\[?(?:[3-9]\d|\d{3,})\]?|50)/.test(className);

  if (!hasHighZIndex) return false;

  // 6. Pastikan elemen memiliki backdrop / latar visual atau berisi card dialog
  // (mencegah false-positive pada transparent backdrop penutup dropdown)
  const hasBackdropStyle =
    /bg-(black|slate|zinc|gray|neutral|stone|indigo)/i.test(className) ||
    className.includes('backdrop-blur') ||
    style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
    style.backdropFilter !== 'none';

  const hasDialogContent =
    el.querySelector('[role="dialog"], [role="alertdialog"], .bg-white, .rounded-2xl, .rounded-xl, .shadow-2xl') !== null;

  return hasBackdropStyle || hasDialogContent;
}

/**
 * Memindai seluruh dokumen untuk memeriksa apakah ada setidaknya satu modal aktif.
 */
export function hasActiveModalsInDOM(): boolean {
  if (typeof document === 'undefined') return false;

  // Periksa elemen dialog atau radix portal aktif
  const dialogs = document.querySelectorAll(
    '[role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-radix-portal] [data-state="open"]'
  );
  for (let i = 0; i < dialogs.length; i++) {
    const d = dialogs[i];
    if (d instanceof HTMLElement) {
      const style = window.getComputedStyle(d);
      if (style.display !== 'none' && style.visibility !== 'hidden' && !d.classList.contains('pointer-events-none')) {
        return true;
      }
    }
  }

  // Periksa elemen fixed overlay
  const fixedOverlays = document.querySelectorAll('.fixed.inset-0, div[class*="fixed"][class*="inset-0"]');
  for (let i = 0; i < fixedOverlays.length; i++) {
    const el = fixedOverlays[i];
    if (isModalOverlayElement(el)) {
      return true;
    }
  }

  return false;
}

/**
 * Mencegah event wheel / touch scroll bocor ke background page saat modal aktif.
 */
function handleBackgroundScrollEvents(e: WheelEvent | TouchEvent) {
  if (!isGloballyLocked) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Cari apakah event terjadi di dalam container modal
  const modalContainer = target.closest(
    '[role="dialog"], [role="alertdialog"], [aria-modal="true"], .fixed.inset-0:not(.pointer-events-none)'
  );

  // Jika event terjadi di luar modal (misal di background atau body), batalkan scroll
  if (!modalContainer) {
    if (e.cancelable) {
      e.preventDefault();
    }
    return;
  }

  // Jika target tepat pada elemen backdrop non-scrollable di sekeliling modal card,
  // cegah scroll agar tidak menggeser halaman latar belakang
  if (target === modalContainer) {
    const isScrollable = modalContainer.scrollHeight > modalContainer.clientHeight;
    if (!isScrollable && e.cancelable) {
      e.preventDefault();
    }
  }
}

/**
 * Terapkan penguncian scrolling pada body & html.
 */
function applyScrollLock() {
  if (isGloballyLocked || typeof document === 'undefined') return;

  savedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;

  isGloballyLocked = true;
  document.documentElement.classList.add('modal-scroll-locked');
  document.body.classList.add('modal-scroll-locked');

  document.documentElement.style.setProperty('overflow', 'hidden', 'important');
  document.body.style.setProperty('overflow', 'hidden', 'important');
  document.documentElement.style.setProperty('overscroll-behavior', 'contain', 'important');
  document.body.style.setProperty('overscroll-behavior', 'contain', 'important');

  // Pasang listener intervensi wheel & touchmove dengan passive: false
  window.addEventListener('wheel', handleBackgroundScrollEvents, { passive: false });
  window.addEventListener('touchmove', handleBackgroundScrollEvents, { passive: false });
}

/**
 * Buka kembali kunci scrolling setelah semua modal tertutup.
 */
function removeScrollLock() {
  if (!isGloballyLocked || typeof document === 'undefined') return;

  // Jangan buka kunci jika masih ada modal aktif via programmatic count atau DOM
  if (programmaticLockCount > 0 || hasActiveModalsInDOM()) {
    return;
  }

  isGloballyLocked = false;
  document.documentElement.classList.remove('modal-scroll-locked');
  document.body.classList.remove('modal-scroll-locked');

  document.documentElement.style.removeProperty('overflow');
  document.body.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('overscroll-behavior');
  document.body.style.removeProperty('overscroll-behavior');

  window.removeEventListener('wheel', handleBackgroundScrollEvents);
  window.removeEventListener('touchmove', handleBackgroundScrollEvents);

  // Pertahankan posisi scroll sebelumnya agar tidak meloncat
  if (savedScrollY > 0) {
    window.scrollTo({ top: savedScrollY, behavior: 'instant' as ScrollBehavior });
  }
}

/**
 * Lock scroll secara programatik (misal via React Hook)
 */
export function lockBackgroundScroll() {
  programmaticLockCount++;
  applyScrollLock();
}

/**
 * Unlock scroll secara programatik
 */
export function unlockBackgroundScroll() {
  programmaticLockCount = Math.max(0, programmaticLockCount - 1);
  if (programmaticLockCount === 0) {
    // Beri sedikit jeda mikro agar animasi keluar (exit animation) selesai sebelum membuka kunci
    setTimeout(() => {
      if (programmaticLockCount === 0 && !hasActiveModalsInDOM()) {
        removeScrollLock();
      }
    }, 50);
  }
}

/**
 * Inisialisasi MutationObserver Global untuk memantau kemunculan modal otomatis di seluruh aplikasi.
 * Hanya dijalankan 1 kali di root aplikasi (App.tsx).
 */
export function initGlobalModalObserver(): () => void {
  if (observerInitialized || typeof window === 'undefined' || typeof document === 'undefined') {
    return () => { };
  }

  observerInitialized = true;

  let animationFrameId: number | null = null;

  const checkDOM = () => {
    const hasModals = hasActiveModalsInDOM();
    if (hasModals) {
      applyScrollLock();
    } else if (programmaticLockCount === 0) {
      removeScrollLock();
    }
  };

  const scheduleCheck = () => {
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(() => {
      animationFrameId = null;
      checkDOM();
    });
  };

  // Pantau perubahan penambahan node DOM atau perubahan atribut class/style
  const observer = new MutationObserver(scheduleCheck);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'role', 'aria-modal', 'data-state']
  });

  // Jalankan pemeriksaan awal
  checkDOM();

  return () => {
    observer.disconnect();
    observerInitialized = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}

/**
 * React Hook untuk mengunci background scroll saat komponen modal dibuka.
 * Contoh pemakaian di modal:
 *   useModalScrollLock(isOpen);
 */
export function useModalScrollLock(isOpen: boolean = true) {
  useEffect(() => {
    if (!isOpen) return;

    lockBackgroundScroll();
    return () => {
      unlockBackgroundScroll();
    };
  }, [isOpen]);
}
