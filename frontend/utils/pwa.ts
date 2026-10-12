// ============================================================================
// FILE: frontend/utils/pwa.ts
// Deskripsi: Helper untuk perilaku aplikasi saat dipasang sebagai PWA
//            (dibuka dari ikon di layar utama HP, bukan dari tab browser).
// ============================================================================

import { saveAs } from 'file-saver';
import { toast } from 'sonner';

/** True saat aplikasi berjalan sebagai aplikasi terpasang (PWA), bukan di tab browser. */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  const media = (query: string) => window.matchMedia?.(query).matches === true;
  return media('(display-mode: standalone)')
    || media('(display-mode: fullscreen)')
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Simpan blob ke perangkat sebagai file unduhan. */
export function downloadBlob(blob: Blob, fileName: string): void {
  try {
    saveAs(blob, fileName);
  } catch {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

/**
 * Buka blob (PDF/gambar) di tab baru untuk pratinjau.
 * Di aplikasi terpasang, tab baru dengan alamat blob: sering kosong (iOS) atau diblokir
 * karena dibuka setelah proses unduh yang lama, jadi file langsung diunduh saja.
 * @returns true bila pratinjau terbuka di tab baru, false bila jatuh ke unduhan.
 */
export function openBlobPreview(blob: Blob, fileName: string): boolean {
  if (!isStandaloneApp()) {
    const url = URL.createObjectURL(blob);
    const previewWindow = window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (previewWindow) return true;
  }
  downloadBlob(blob, fileName);
  toast.info(`File "${fileName}" diunduh. Buka dari folder Unduhan / notifikasi unduhan.`);
  return false;
}
