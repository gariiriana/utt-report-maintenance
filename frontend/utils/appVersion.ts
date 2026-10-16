// ============================================================================
// FILE: frontend/utils/appVersion.ts
// Deskripsi: Versi build yang sedang berjalan (hash commit + waktu build WIB).
//            Ditampilkan di sidebar supaya saat ada laporan "masih error" bisa langsung
//            dicek apakah user masih memakai versi lama (belum menekan "Perbarui Sekarang").
// ============================================================================

// `typeof` aman dipakai walau konstanta tidak di-define (misalnya saat diimpor dari test Node)
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const builtAt = typeof __APP_BUILD_TIME__ === 'string' ? new Date(__APP_BUILD_TIME__) : null;

/** Waktu build WIB, contoh: "16 Okt 13.35". Kosong bila tidak tersedia. */
export const APP_BUILD_LABEL = builtAt && !Number.isNaN(builtAt.getTime())
  ? `${builtAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })} ${builtAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`
  : '';

/** Contoh: "Versi 949e134e · 16 Okt 13.35" */
export const APP_VERSION_LABEL = `Versi ${APP_VERSION}${APP_BUILD_LABEL ? ` · ${APP_BUILD_LABEL}` : ''}`;
