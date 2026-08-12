// ============================================================================
// FILE: frontend/service_reports/common/pdfUtils.ts
// Deskripsi: Shared Helper Loader Gambar Logo & Aset Base64 PDF Service Reports.
//            Menyediakan fungsi pemuatan logo PT Dwimitra & NeutraDC secara asynchronous
//            untuk disisipkan pada kop header dokumen jsPDF.
// ============================================================================

import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import logoK2 from '@/assets/logo_k2.png';

/**
 * Helper 1: Mengonversi URL Sumber Gambar ke Format Base64 PNG
 * Junior Dev Notes: Menggunakan elemen HTML5 Canvas untuk menggambar ulang gambar
 * dengan latar belakang putih agar transparansi PNG tidak menjadi hitam di PDF.
 */
export async function loadImageBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Helper 2: Memuat Logo Kiri (Dwimitra) & Logo Kanan (NeutraDC / K2)
 */
export async function loadCompanyLogos(companyType?: 'neutra' | 'bri' | 'k2') {
  let logoLeft: string | null = null;
  let logoRight: string | null = null;

  try {
    logoLeft = await loadImageBase64(logoDwimitra);
  } catch (e) {
    console.warn('Failed to load left logo:', e);
  }

  try {
    const rightSrc = companyType === 'k2' ? logoK2 : logoNeutraDC;
    logoRight = await loadImageBase64(rightSrc);
  } catch (e) {
    console.warn('Failed to load right logo:', e);
  }

  return { logoLeft, logoRight };
}

