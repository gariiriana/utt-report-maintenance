// ============================================================================
// FILE: frontend/utils/cropUtils.ts
// Deskripsi: Utilitas pemotongan foto dokumentasi abnormal, termasuk
//            pemotongan otomatis untuk membuang teks/slide di bagian atas foto
//            sehingga hanya menyisakan dokumentasi foto unit peralatan.
// ============================================================================

/**
 * Memotong (crop) bagian atas gambar (yang berisi teks, judul slide, atau catatan)
 * dan hanya menyisakan area foto bukti dokumentasi peralatan di bagian bawah.
 * 
 * @param base64Str Data URL gambar (image/png atau image/jpeg)
 * @param topCropPercent Persentase tinggi dari atas yang dibuang (default: 0.46 = 46%)
 * @returns Promise<string> Data URL JPEG hasil pemotongan
 */
export function autoCropTextFromImage(base64Str: string, topCropPercent = 0.46): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!base64Str) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const startY = Math.floor(img.height * topCropPercent);
        const cropHeight = Math.max(10, img.height - startY);

        canvas.width = img.width;
        canvas.height = cropHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }

        // Gambar bagian bawah (foto dokumentasi saja)
        ctx.drawImage(
          img,
          0,
          startY,
          img.width,
          cropHeight,
          0,
          0,
          img.width,
          cropHeight
        );

        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        console.error('Error in autoCropTextFromImage:', err);
        reject(err);
      }
    };

    img.onerror = (err) => {
      console.error('Error loading image for auto crop:', err);
      reject(new Error('Gagal memuat berkas gambar untuk dipotong.'));
    };

    img.src = base64Str;
  });
}
