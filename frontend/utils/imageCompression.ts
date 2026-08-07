// ============================================================================
// FILE: imageCompression.ts
// Deskripsi: Utility untuk mengompres gambar sebelum disimpan/diupload.
//            Mengurangi ukuran file foto dari kamera HP (biasanya 3-8MB)
//            menjadi lebih kecil (~50-200KB) supaya upload lebih cepat
//            dan tidak boros kuota Firebase Storage.
// Dipakai di: ReportForm, CMReportFormModal, HSEReportForm, dll.
// ============================================================================

// Interface opsi kompresi gambar
// maxWidth/maxHeight = batas maksimum dimensi piksel
// quality = kualitas JPEG (0.0 - 1.0, makin kecil makin kecil ukurannya)
export interface CompressionOptions {
    maxWidth?: number;     // Default: 800px
    maxHeight?: number;    // Default: 800px
    quality?: number;      // Default: 0.5 (50% kualitas — cukup untuk laporan)
}

// Fungsi utama: kompres gambar dari File object (biasanya dari input file / kamera)
// Input: File dari <input type="file"> atau kamera
// Output: string base64 JPEG yang sudah dikompres
// Cara pakai: const compressed = await compressImage(file, { quality: 0.6 });
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<string> {
    const {
        maxWidth = 800,
        maxHeight = 800,
        quality = 0.5,
    } = options;

    return new Promise((resolve, reject) => {
        // Step 1: Baca file sebagai DataURL (base64)
        const reader = new FileReader();

        reader.onload = (e) => {
            // Step 2: Load gambar ke Image element untuk dapat dimensi asli
            const img = new Image();

            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Step 3: Resize kalau dimensi melebihi batas
                // Menjaga aspect ratio (tidak stretch/distort gambar)
                if (width > maxWidth || height > maxHeight) {
                    const aspectRatio = width / height;

                    if (width > height) {
                        // Gambar landscape: batasi width
                        width = maxWidth;
                        height = width / aspectRatio;
                    } else {
                        // Gambar portrait: batasi height
                        height = maxHeight;
                        width = height * aspectRatio;
                    }
                }

                // Step 4: Gambar ulang ke canvas dengan dimensi baru
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // Aktifkan smoothing supaya hasil resize halus (tidak pecah/pixelated)
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.drawImage(img, 0, 0, width, height);

                // Step 5: Export canvas sebagai JPEG base64 dengan kualitas yang ditentukan
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            img.src = e.target?.result as string;
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
    });
}

// Fungsi kedua: kompres gambar yang sudah dalam format base64 string
// Berguna kalau gambar sudah tersimpan sebagai base64 (misalnya dari draft)
// dan perlu dikompres ulang sebelum upload
export async function compressBase64Image(
    base64String: string,
    options: CompressionOptions = {}
): Promise<string> {
    const {
        maxWidth = 800,
        maxHeight = 800,
        quality = 0.5,
    } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // Resize dengan menjaga aspect ratio (sama seperti fungsi di atas)
            if (width > maxWidth || height > maxHeight) {
                const aspectRatio = width / height;

                if (width > height) {
                    width = maxWidth;
                    height = width / aspectRatio;
                } else {
                    height = maxHeight;
                    width = height * aspectRatio;
                }
            }

            // Gambar ulang ke canvas dan export sebagai JPEG
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = base64String;
    });
}

// Fungsi helper: hitung ukuran file base64 dalam KB
// Berguna untuk menampilkan info ukuran file ke user (contoh: "Foto: 150 KB")
// Rumus: panjang base64 * 3/4 = ukuran asli dalam bytes
export function getBase64SizeKB(base64String: string): number {
    const base64Length = base64String.length - (base64String.indexOf(',') + 1);
    const sizeInBytes = (base64Length * 3) / 4;
    return Math.round(sizeInBytes / 1024);
}
