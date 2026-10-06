// ============================================================================
// FILE: frontend/utils/faceRecognitionService.ts
// Deskripsi: Deteksi wajah + ekstraksi descriptor 128-D (ResNet, @vladmandic/face-api)
//            dan estimasi tolehan kepala (yaw) di browser.
//            Pencocokan wajah TIDAK dilakukan di sini: descriptor dikirim ke
//            Cloud Function (faceVerify / faceEnroll) yang memegang data wajah.
// ============================================================================

import type * as FaceApi from '@vladmandic/face-api';

const MODEL_URL = '/models/face';

let faceapi: typeof FaceApi | null = null;
let loadPromise: Promise<typeof FaceApi> | null = null;
let forceCpu = false;

// Tipe tf bawaan face-api tidak mengekspor fungsi backend, tapi runtime-nya ada.
type Tf = {
  setBackend(name: string): Promise<boolean>;
  ready(): Promise<void>;
  getBackend(): string;
  env(): { getBool(flag: string): boolean };
};

/**
 * Pilih backend TensorFlow. WebGL (GPU) dipakai hanya jika berhasil diinisialisasi DAN
 * mendukung float32. setBackend mengembalikan false (tidak throw) saat WebGL gagal,
 * misalnya driver GPU diblokir browser. GPU tanpa float32 (sebagian HP lama) menghitung
 * dengan presisi 16-bit sehingga descriptor wajah bisa melenceng dan gagal dicocokkan.
 * Selain itu, pakai CPU: lebih lambat, tapi hasilnya sama di semua perangkat.
 */
async function pickBackend(tf: Tf) {
  let useWebgl = false;
  if (!forceCpu) {
    const ok = await tf.setBackend('webgl').catch(() => false);
    try {
      useWebgl = ok && tf.env().getBool('WEBGL_RENDER_FLOAT32_CAPABLE');
    } catch {
      useWebgl = false;
    }
  }
  if (!useWebgl) await tf.setBackend('cpu');
  await tf.ready();
}

/** Backend yang sedang dipakai ('webgl' / 'cpu'), untuk laporan kendala. */
export function currentBackend(): string {
  try {
    return faceapi ? (faceapi.tf as unknown as Tf).getBackend() : '';
  } catch {
    return '';
  }
}

/**
 * Pindah ke CPU bila GPU bermasalah di tengah scan (misal konteks WebGL hilang di HP
 * dengan RAM kecil). Model dimuat ulang agar bobotnya ada di backend CPU.
 * Mengembalikan false jika sudah memakai CPU.
 */
export async function fallbackToCpu(): Promise<boolean> {
  if (forceCpu) return false;
  forceCpu = true;
  faceapi = null;
  loadPromise = null;
  await loadFaceModels();
  return true;
}

/** Muat library + model (±7 MB, sekali per sesi browser). */
export function loadFaceModels(): Promise<typeof FaceApi> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const lib = await import('@vladmandic/face-api');
      await pickBackend(lib.tf as unknown as Tf);
      await Promise.all([
        lib.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        lib.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        lib.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      faceapi = lib;
      return lib;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

export interface FaceSample {
  descriptor: number[];
  box: { x: number; y: number; width: number; height: number };
  score: number;
  /** Tolehan kepala: ~0 menghadap lurus, |yaw| > 0.3 menoleh ke samping. */
  yaw: number;
  faceCount: number;
}

type Point = { x: number; y: number };

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Deteksi satu wajah pada frame video. Mengembalikan null jika tidak ada wajah.
 * faceCount > 1 berarti ada lebih dari satu orang di depan kamera.
 */
export async function detectFace(video: HTMLVideoElement): Promise<FaceSample | null> {
  const lib = faceapi || (await loadFaceModels());
  if (!video.videoWidth) return null;

  // inputSize 416 + threshold 0.3: lebih toleran untuk wajah sangat dekat / cahaya redup.
  const options = new lib.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 });
  const results = await lib.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors();
  if (results.length === 0) return null;

  const main = results.reduce((a, b) => (a.detection.box.area > b.detection.box.area ? a : b));
  const lm = main.landmarks;
  const leftEye = lm.getLeftEye();
  const rightEye = lm.getRightEye();
  const nose = lm.getNose()[3]; // ujung batang hidung
  const eyeMid = { x: (leftEye[0].x + rightEye[3].x) / 2, y: (leftEye[0].y + rightEye[3].y) / 2 };
  const eyeSpan = dist(leftEye[0], rightEye[3]) || 1;
  const box = main.detection.box;

  return {
    descriptor: Array.from(main.descriptor),
    box: { x: box.x, y: box.y, width: box.width, height: box.height },
    score: main.detection.score,
    yaw: (nose.x - eyeMid.x) / eyeSpan,
    faceCount: results.length
  };
}

/** Jarak Euclidean antar descriptor (dipakai untuk memastikan sampel konsisten). */
export function descriptorDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/** Foto wajah ter-crop (JPEG kecil) untuk ditinjau QC saat approval. */
export function captureFacePhoto(video: HTMLVideoElement, box: FaceSample['box'], size = 200): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const side = Math.max(box.width, box.height) * 1.5;
  const sx = Math.max(0, box.x + box.width / 2 - side / 2);
  const sy = Math.max(0, box.y + box.height / 2 - side / 2);
  const sw = Math.min(side, video.videoWidth - sx);
  const sh = Math.min(side, video.videoHeight - sy);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Ringkasan perangkat untuk QC dan log audit (bukan untuk keamanan), misalnya
 * "Chrome 129 di Android 14". Versi dan aplikasi pembuka (WhatsApp/Instagram) ikut
 * dicatat agar perangkat yang bermasalah mudah dikenali.
 */
export function describeDevice(): string {
  const ua = navigator.userAgent;
  const v = (re: RegExp) => ua.match(re)?.[1] || '';
  const os = /Android/.test(ua) ? `Android ${v(/Android (\d+)/)}`
    : /iPhone|iPad|iPod/.test(ua) ? `iOS ${v(/OS (\d+)_/)}`
    : /Windows NT/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux' : 'Lainnya';
  const browser = /SamsungBrowser\//.test(ua) ? `Samsung Internet ${v(/SamsungBrowser\/(\d+)/)}`
    : /Edg\//.test(ua) ? `Edge ${v(/Edg\/(\d+)/)}`
    : /OPR\//.test(ua) ? `Opera ${v(/OPR\/(\d+)/)}`
    : /Firefox\/|FxiOS\//.test(ua) ? `Firefox ${v(/(?:Firefox|FxiOS)\/(\d+)/)}`
    : /CriOS\//.test(ua) ? `Chrome ${v(/CriOS\/(\d+)/)}`
    : /Chrome\//.test(ua) ? `Chrome ${v(/Chrome\/(\d+)/)}`
    : /Safari\//.test(ua) ? `Safari ${v(/Version\/(\d+)/)}` : 'Browser';
  const inApp = /FBAN|FBAV/.test(ua) ? ' (dalam Facebook)'
    : /Instagram/.test(ua) ? ' (dalam Instagram)'
    : /WhatsApp/.test(ua) ? ' (dalam WhatsApp)'
    : /Line\//.test(ua) ? ' (dalam LINE)'
    : /; wv\)/.test(ua) ? ' (WebView)' : '';
  return `${browser.trim()} di ${os.trim()}${inApp}`;
}
