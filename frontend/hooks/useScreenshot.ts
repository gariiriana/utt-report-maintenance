// ============================================================================
// FILE: frontend/hooks/useScreenshot.ts
// Deskripsi: Custom React Hook Pengambil Gambar Tangkapan Layar (Screenshot Element Canvas).
//            Menggunakan `html2canvas` untuk merender DOM elemen ke gambar PNG 2x resolusi
//            dan mengunduhnya secara otomatis ke perangkat user.
// ============================================================================

import { useCallback } from 'react';
import { safeHtml2Canvas } from '@/utils/ReportPdfExport';

/** Hook `useScreenshot()` untuk mengambil screenshot elemen HTML */
export function useScreenshot() {
  const takeScreenshot = useCallback(async (elementId: string, fileName: string = 'screenshot.png') => {
    // 1. Cari elemen DOM target berdasarkan ID
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element with id ${elementId} not found`);
      return false;
    }

    try {
      // 2. Sembunyikan elemen background video agar tidak menutupi hasil screenshot
      const bgVideo = document.getElementById('bg-video-container');
      if (bgVideo) bgVideo.style.display = 'none';

      // 3. Render elemen HTML menjadi HTML5 Canvas
      const canvas = await safeHtml2Canvas(element, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#020617',
        scale: 2, // Scale 2x agar gambar tajam
        logging: false,
      });

      // 4. Tampilkan kembali background video setelah capture
      if (bgVideo) bgVideo.style.display = 'block';

      // 5. Konversi canvas ke Data URL PNG dan picu unduhan otomatis
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = fileName;
      link.click();

      return true;
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return false;
    }
  }, []);

  return { takeScreenshot };
}
