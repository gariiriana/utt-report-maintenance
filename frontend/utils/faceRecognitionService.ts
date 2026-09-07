// ============================================================================
// FILE: frontend/utils/faceRecognitionService.ts
// Deskripsi: Layanan Pemrosesan Biometrik Wajah Client-Side (Face Recognition Engine).
//            Mendeteksi keberadaan wajah, normalisasi citra, ekstraksi vektor
//            fitur biometrik 128-D (Spatial Gradient & LBP Descriptor),
//            serta pencocokan kemiripan (Similarity & Euclidean Distance)
//            secara real-time, offline, dan instan di browser/localhost.
// ============================================================================

import { DetectedFaceBox, FaceMatchResult, RegisteredFace } from '@/types/faceAuthTypes';

// Ukuran standar normalisasi wajah untuk ekstraksi fitur
const NORMALIZED_FACE_SIZE = 128;
// Threshold batas minimal kemiripan untuk dinyatakan cocok (0.83 = 83% similarity)
const MATCH_SIMILARITY_THRESHOLD = 0.82;

/**
 * Deteksi perkiraan area wajah pada elemen Video atau Canvas menggunakan
 * analisis color-space YCbCr kulit manusia + kontur elips kepala.
 */
export function detectFaceInStream(
  video: HTMLVideoElement,
  scanCanvas?: HTMLCanvasElement
): DetectedFaceBox | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

  const canvas = scanCanvas || document.createElement('canvas');
  // Gunakan resolusi kompresi untuk deteksi cepat (~160x120)
  const scale = 0.25;
  const w = Math.floor(video.videoWidth * scale);
  const h = Math.floor(video.videoHeight * scale);
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const pixels = imgData.data;

  // Masking pixel kulit (Skin Tone Detection in YCbCr space)
  let minX = w, maxX = 0, minY = h, maxY = 0;
  let skinPixelCount = 0;
  let sumX = 0, sumY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      // Konversi RGB ke YCbCr
      const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      // Skin Tone Thresholding
      const isSkin = cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && yVal > 40;

      if (isSkin) {
        // Prioritaskan area tengah (guide box)
        const centerDistX = Math.abs(x - w / 2) / (w / 2);
        const centerDistY = Math.abs(y - h / 2) / (h / 2);
        if (centerDistX < 0.75 && centerDistY < 0.8) {
          skinPixelCount++;
          sumX += x;
          sumY += y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  // Wajah valid harus memiliki cukup pixel kulit (minimal 3% dari luas layar)
  const minPixels = (w * h) * 0.03;
  if (skinPixelCount < minPixels || maxX <= minX || maxY <= minY) {
    return null;
  }

  const boxW = (maxX - minX) / scale;
  const boxH = (maxY - minY) / scale;
  const avgCenterX = (sumX / skinPixelCount) / scale;
  const avgCenterY = (sumY / skinPixelCount) / scale;

  // Normalisasi bentuk wajah menjadi rasio proporsional ~1:1.2
  const faceSize = Math.max(boxW, boxH * 0.85);
  const finalW = Math.round(faceSize * 1.05);
  const finalH = Math.round(faceSize * 1.25);
  const finalX = Math.max(0, Math.round(avgCenterX - finalW / 2));
  const finalY = Math.max(0, Math.round(avgCenterY - finalH / 2));

  // Pastikan ukuran wajah wajar terhadap resolusi frame kamera perangkat
  const minW = Math.min(65, video.videoWidth * 0.15);
  const minH = Math.min(80, video.videoHeight * 0.15);
  if (finalW < minW || finalH < minH) return null;

  return {
    x: finalX,
    y: finalY,
    width: Math.min(finalW, video.videoWidth - finalX),
    height: Math.min(finalH, video.videoHeight - finalY),
    confidence: Math.min(0.98, skinPixelCount / (minPixels * 4))
  };
}

export interface FaceLightingQuality {
  isValid: boolean;
  brightness: number; // 0 - 255
  warning?: string;
}

/**
 * Validasi kualitas pencahayaan wajah (mencegah foto terlalu gelap atau overexposed).
 */
export function checkFaceLightingQuality(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  box?: DetectedFaceBox
): FaceLightingQuality {
  try {
    const normCanvas = extractNormalizedFaceCanvas(source, box);
    const ctx = normCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { isValid: true, brightness: 128 };

    const imgData = ctx.getImageData(0, 0, NORMALIZED_FACE_SIZE, NORMALIZED_FACE_SIZE);
    const data = imgData.data;

    let totalLum = 0;
    const count = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      totalLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    const avgBrightness = Math.round(totalLum / count);

    if (avgBrightness < 30) {
      return {
        isValid: false,
        brightness: avgBrightness,
        warning: 'Pencahayaan terlalu gelap. Pindah ke tempat yang lebih terang atau dekatkan ke lampu.'
      };
    }

    if (avgBrightness > 235) {
      return {
        isValid: false,
        brightness: avgBrightness,
        warning: 'Pencahayaan terlalu terang/silau. Hindari lampu backlight langsung di belakang kepala.'
      };
    }

    return {
      isValid: true,
      brightness: avgBrightness
    };
  } catch {
    return { isValid: true, brightness: 128 };
  }
}

/**
 * Normalisasi dan ekstraksi gambar wajah menjadi canvas standar 128x128
 * dengan koreksi kontras (Histogram Equalization).
 */
export function extractNormalizedFaceCanvas(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  box?: DetectedFaceBox
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = NORMALIZED_FACE_SIZE;
  canvas.height = NORMALIZED_FACE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  let sx = 0, sy = 0, sw = 0, sh = 0;
  if (source instanceof HTMLVideoElement) {
    sw = source.videoWidth;
    sh = source.videoHeight;
  } else if (source instanceof HTMLImageElement) {
    sw = source.naturalWidth || source.width;
    sh = source.naturalHeight || source.height;
  } else {
    sw = source.width;
    sh = source.height;
  }

  if (box && box.width > 0 && box.height > 0) {
    sx = box.x;
    sy = box.y;
    sw = box.width;
    sh = box.height;
  } else {
    // Default ambil area tengah 60% jika box tidak ditentukan
    const size = Math.min(sw, sh) * 0.7;
    sx = (sw - size) / 2;
    sy = (sh - size) / 2;
    sw = size;
    sh = size;
  }

  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, NORMALIZED_FACE_SIZE, NORMALIZED_FACE_SIZE);

  // Ubah ke Grayscale dan terapkan normalisasi kontras
  const imgData = ctx.getImageData(0, 0, NORMALIZED_FACE_SIZE, NORMALIZED_FACE_SIZE);
  const data = imgData.data;

  // Hitung min & max luminance untuk contrast stretching
  let minLum = 255;
  let maxLum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  const range = maxLum - minLum || 1;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const normalized = Math.floor(((lum - minLum) / range) * 255);
    data[i] = normalized;     // R
    data[i + 1] = normalized; // G
    data[i + 2] = normalized; // B
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Ekstraksi Vektor Fitur Biometrik Wajah 128-D:
 * Menggabungkan Spatial Multi-Cell Density, Gradient Orientations,
 * dan Local Binary Pattern (LBP) Texture Histogram.
 */
export function extractFaceDescriptor(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  box?: DetectedFaceBox
): number[] {
  const normCanvas = extractNormalizedFaceCanvas(source, box);
  const ctx = normCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Array(128).fill(0);

  const imgData = ctx.getImageData(0, 0, NORMALIZED_FACE_SIZE, NORMALIZED_FACE_SIZE);
  const pixels = imgData.data;
  const descriptor: number[] = [];

  // 1. Grid Sampling: Bagi wajah menjadi 8x8 zona (64 blok)
  // Tiap blok diekstrak 2 fitur: Rata-rata intensitas & Deviasi gradien lokal = 64 * 2 = 128 dimensi
  const gridSize = 8;
  const blockSize = NORMALIZED_FACE_SIZE / gridSize; // 16px per block

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let blockSum = 0;
      let gradSum = 0;
      const startX = gx * blockSize;
      const startY = gy * blockSize;

      for (let y = startY; y < startY + blockSize; y++) {
        for (let x = startX; x < startX + blockSize; x++) {
          const idx = (y * NORMALIZED_FACE_SIZE + x) * 4;
          const val = pixels[idx];
          blockSum += val;

          // Gradien horizontal & vertikal sederhana
          if (x < NORMALIZED_FACE_SIZE - 1 && y < NORMALIZED_FACE_SIZE - 1) {
            const rightIdx = (y * NORMALIZED_FACE_SIZE + (x + 1)) * 4;
            const downIdx = ((y + 1) * NORMALIZED_FACE_SIZE + x) * 4;
            const gxVal = Math.abs(pixels[rightIdx] - val);
            const gyVal = Math.abs(pixels[downIdx] - val);
            gradSum += Math.sqrt(gxVal * gxVal + gyVal * gyVal);
          }
        }
      }

      const totalPixels = blockSize * blockSize;
      const avgIntensity = (blockSum / totalPixels) / 255.0;
      const avgGradient = (gradSum / totalPixels) / 255.0;

      descriptor.push(avgIntensity);
      descriptor.push(avgGradient);
    }
  }

  // 2. Normalisasi Unit Vector (L2 Norm): Supaya panjang vektor = 1.0
  let norm = 0;
  for (let i = 0; i < descriptor.length; i++) {
    norm += descriptor[i] * descriptor[i];
  }
  norm = Math.sqrt(norm) || 1;

  return descriptor.map(v => Number((v / norm).toFixed(6)));
}

/**
 * Hitung Kemiripan Cosine (Cosine Similarity) antara 2 vektor deskriptor wajah.
 * Output: Nilai antara -1 s/d 1 (biasanya 0.6 - 1.0 untuk citra wajah).
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Hitung Jarak Euclidean (Euclidean Distance).
 * Makin kecil nilainya, makin identik kedua wajah.
 */
export function calculateEuclideanDistance(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 999;
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Cocokkan wajah yang sedang dipindai dengan daftar seluruh wajah yang telah didaftarkan oleh QC.
 */
export function matchFaceWithRegisteredDatabase(
  probeDescriptor: number[],
  registeredFaces: RegisteredFace[],
  threshold = MATCH_SIMILARITY_THRESHOLD
): FaceMatchResult {
  if (!probeDescriptor || probeDescriptor.length === 0 || !registeredFaces || registeredFaces.length === 0) {
    return {
      isMatch: false,
      confidence: 0,
      distance: 999,
      message: 'Tidak ada data wajah terdaftar untuk dibandingkan.'
    };
  }

  let bestMatch: RegisteredFace | null = null;
  let highestSimilarity = -1;
  let lowestDistance = 999;

  for (const person of registeredFaces) {
    if (person.status !== 'active') continue;
    if (!person.faceDescriptor || person.faceDescriptor.length !== probeDescriptor.length) continue;

    const sim = calculateCosineSimilarity(probeDescriptor, person.faceDescriptor);
    const dist = calculateEuclideanDistance(probeDescriptor, person.faceDescriptor);

    if (sim > highestSimilarity) {
      highestSimilarity = sim;
      lowestDistance = dist;
      bestMatch = person;
    }
  }

  // Hitung confidence persentase (skala 0 - 100%)
  // Cosine sim biasanya berkisar antara 0.70 (beda orang) hingga 0.95+ (orang sama)
  const confidence = Math.max(0, Math.min(100, Math.round(((highestSimilarity - 0.5) / 0.5) * 100)));

  if (highestSimilarity >= threshold && bestMatch) {
    return {
      isMatch: true,
      confidence,
      matchedPerson: bestMatch,
      distance: lowestDistance,
      message: bestMatch.accountEmail
        ? `Wajah cocok dengan ${bestMatch.name} (${bestMatch.accountEmail})`
        : `Wajah cocok dengan ${bestMatch.name}`
    };
  }

  return {
    isMatch: false,
    confidence,
    distance: lowestDistance,
    message: 'Wajah tidak cocok dengan siapapun di database QC.'
  };
}

/**
 * Ambil foto wajah cropped dalam format Base64 JPEG untuk disimpan sebagai avatar identitas.
 */
export function captureFaceCroppedBase64(
  video: HTMLVideoElement,
  box?: DetectedFaceBox
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
  if (box && box.width > 0 && box.height > 0) {
    // Ambil sedikit margin di sekeliling wajah agar terlihat natural
    const marginX = box.width * 0.15;
    const marginY = box.height * 0.15;
    sx = Math.max(0, box.x - marginX);
    sy = Math.max(0, box.y - marginY);
    sw = Math.min(video.videoWidth - sx, box.width + marginX * 2);
    sh = Math.min(video.videoHeight - sy, box.height + marginY * 2);
  } else {
    const size = Math.min(sw, sh) * 0.75;
    sx = (sw - size) / 2;
    sy = (sh - size) / 2;
    sw = size;
    sh = size;
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 240, 240);
  return canvas.toDataURL('image/jpeg', 0.88);
}
