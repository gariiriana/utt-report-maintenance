// ============================================================================
// FILE: frontend/components/FaceScanner.tsx
// Deskripsi: Kamera + instruksi langkah demi langkah untuk scan wajah.
//            mode 'verify': cukup hadap kamera; ambil 3 sampel wajah lurus untuk
//                           dicocokkan server (tanpa kedip/toleh).
//            mode 'enroll': ambil sampel lurus dan toleh ke dua sisi, beserta
//                           foto untuk ditinjau QC DME.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { Loader2, CameraOff, Camera } from 'lucide-react';
import { loadFaceModels, detectFace, captureFacePhoto, descriptorDistance, currentBackend, fallbackToCpu, FaceSample } from '@/utils/faceRecognitionService';

export interface FaceScanResult {
  descriptors: number[][];
  photos: string[];
}

/** Kendala teknis scan; dilaporkan ke server agar perangkat bermasalah terlihat QC. */
export type ScanIssue = 'camera_denied' | 'camera_missing' | 'camera_busy' | 'camera_unsupported' | 'model_load' | 'detect_error' | 'timeout';

const ISSUE_MESSAGES: Record<Exclude<ScanIssue, 'detect_error'>, string> = {
  camera_denied: 'Akses kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu muat ulang halaman.',
  camera_missing: 'Kamera tidak ditemukan di perangkat ini. Login dari HP atau laptop yang punya kamera.',
  camera_busy: 'Kamera tidak bisa dibuka. Biasanya karena sedang dipakai aplikasi lain (Zoom, Teams, WhatsApp). Tutup aplikasi itu, lalu coba lagi.',
  camera_unsupported: 'Browser ini tidak bisa membuka kamera. Buka lewat Chrome (Android/PC) atau Safari (iPhone), bukan dari dalam WhatsApp/Instagram.',
  model_load: 'Model pengenal wajah gagal diunduh. Periksa koneksi internet, lalu coba lagi.',
  timeout: 'Waktu scan habis. Pastikan wajah terlihat jelas dan cahaya cukup, lalu coba lagi.'
};

function cameraIssue(err: any): Exclude<ScanIssue, 'detect_error'> {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'camera_denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'camera_missing';
    case 'CameraUnsupported':
      return 'camera_unsupported';
    default:
      return 'camera_busy'; // NotReadableError, TrackStartError, AbortError, dll.
  }
}

function errorDetail(err: any): string {
  return `${err?.name || 'Error'}: ${err?.message || ''}`.slice(0, 150);
}

async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    // Halaman non-HTTPS, browser lama, atau browser di dalam aplikasi lain.
    throw Object.assign(new Error('getUserMedia tidak tersedia'), { name: 'CameraUnsupported' });
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  } catch (err: any) {
    // Sebagian kamera/driver lama menolak syarat resolusi atau kamera depan: coba sekali tanpa syarat.
    if (['OverconstrainedError', 'NotReadableError', 'AbortError', 'TypeError'].includes(err?.name)) {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    throw err;
  }
}

type Step =
  | { kind: 'front'; samples: number; photo: boolean }
  | { kind: 'side'; order: 'first' | 'second' };

const STEP_TIMEOUT_MS = 30_000;
const FRONT_YAW = 0.12;
const SIDE_MIN_YAW = 0.15;
const SIDE_MAX_YAW = 0.5;
const SAMPLE_GAP_MS = 250;
const SAME_FACE_DISTANCE = 0.45;
const MIN_SAMPLE_SCORE = 0.45;

function buildSteps(mode: 'verify' | 'enroll'): Step[] {
  if (mode === 'enroll') {
    // Tanpa kedip: landmark mata model ringan tidak andal (terutama mata sipit / webcam
    // resolusi rendah). Keaslian orang dipastikan QC saat meninjau foto pengajuan.
    return [
      { kind: 'front', samples: 1, photo: true },
      { kind: 'side', order: 'first' },
      { kind: 'side', order: 'second' },
      { kind: 'front', samples: 1, photo: true }
    ];
  }
  // Login: cukup hadap kamera (keputusan Gari, 6 Okt 2026). Liveness hanya saat pendaftaran.
  return [{ kind: 'front', samples: 3, photo: false }];
}

function instruction(step: Step | undefined): string {
  if (!step) return 'Memproses...';
  switch (step.kind) {
    case 'front': return 'Hadap lurus ke kamera dan diam sejenak';
    case 'side': return step.order === 'first' ? 'Tolehkan kepala sedikit ke kiri atau kanan' : 'Sekarang tolehkan sedikit ke sisi sebaliknya';
  }
}

interface Props {
  mode: 'verify' | 'enroll';
  onComplete: (result: FaceScanResult) => void;
  onCancel?: () => void;
  /** Dipanggil saat scan gagal karena kendala teknis (kamera, model, GPU, waktu habis). */
  onIssue?: (issue: ScanIssue, detail: string) => void;
}

export function FaceScanner({ mode, onComplete, onCancel, onIssue }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'tap' | 'running' | 'error'>('loading');
  const [error, setError] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [warning, setWarning] = useState('');
  const stepsRef = useRef<Step[]>(buildSteps(mode));
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onIssueRef = useRef(onIssue);
  onIssueRef.current = onIssue;
  // Diisi saat browser menolak memutar video otomatis (misal iPhone mode hemat daya):
  // video harus diputar dari ketukan pengguna.
  const tapToStartRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const steps = stepsRef.current;
    let index = 0;
    const descriptors: number[][] = [];
    const photos: string[] = [];
    // Status per langkah
    let firstSideSign = 0;
    let frontSamples: number[][] = [];
    let lastSampleAt = 0;
    let stepStartedAt = Date.now();
    // Diagnostik untuk laporan kendala (perangkat lambat / kamera buruk).
    let frames = 0;
    let framesWithFace = 0;
    let detectMsTotal = 0;
    let errorStreak = 0;

    const stopCamera = () => stream?.getTracks().forEach((t) => t.stop());
    const fail = (issue: Exclude<ScanIssue, 'detect_error'>, detail: string) => {
      stopCamera();
      setStatus('error');
      setError(ISSUE_MESSAGES[issue]);
      onIssueRef.current?.(issue, detail);
    };

    const advance = () => {
      index++;
      frontSamples = [];
      stepStartedAt = Date.now();
      setStepIndex(index);
    };

    const handle = (s: FaceSample, video: HTMLVideoElement) => {
      const step = steps[index];
      const absYaw = Math.abs(s.yaw);

      switch (step.kind) {
        case 'side': {
          const sign = Math.sign(s.yaw);
          const okAngle = absYaw > SIDE_MIN_YAW && absYaw < SIDE_MAX_YAW;
          const okSide = step.order === 'first' || sign === -firstSideSign;
          if (okAngle && okSide && s.score > MIN_SAMPLE_SCORE) {
            if (step.order === 'first') firstSideSign = sign;
            descriptors.push(s.descriptor);
            photos.push(captureFacePhoto(video, s.box));
            advance();
          }
          break;
        }
        case 'front':
          if (absYaw < FRONT_YAW && s.score > MIN_SAMPLE_SCORE && Date.now() - lastSampleAt > SAMPLE_GAP_MS) {
            const prev = frontSamples[frontSamples.length - 1];
            if (prev && descriptorDistance(prev, s.descriptor) > SAME_FACE_DISTANCE) {
              frontSamples = []; // wajah berganti di tengah pengambilan
            }
            frontSamples.push(s.descriptor);
            lastSampleAt = Date.now();
            if (frontSamples.length >= step.samples) {
              descriptors.push(...frontSamples);
              if (step.photo) photos.push(captureFacePhoto(video, s.box));
              advance();
            }
          }
          break;
      }
    };

    const loop = async () => {
      const video = videoRef.current;
      if (cancelled || !video) return;
      if (Date.now() - stepStartedAt > STEP_TIMEOUT_MS) {
        const avgMs = frames ? Math.round(detectMsTotal / frames) : 0;
        fail('timeout', `step=${steps[index]?.kind} backend=${currentBackend()} frames=${frames} withFace=${framesWithFace} avgMs=${avgMs}`);
        return;
      }
      try {
        const startedAt = performance.now();
        const sample = await detectFace(video);
        if (cancelled) return;
        frames++;
        detectMsTotal += performance.now() - startedAt;
        errorStreak = 0;
        if (!sample) setWarning('Wajah tidak terdeteksi. Posisikan wajah di dalam lingkaran.');
        else if (sample.faceCount > 1) setWarning('Terdeteksi lebih dari satu wajah. Pastikan hanya Anda di depan kamera.');
        else {
          framesWithFace++;
          setWarning('');
          handle(sample, video);
        }
      } catch (err) {
        console.warn('[FaceScanner] detect error', err);
        if (cancelled) return;
        // GPU bermasalah (misal konteks WebGL hilang): pindah ke CPU sekali, lalu lanjut.
        if (++errorStreak >= 3) {
          errorStreak = 0;
          const backend = currentBackend();
          setWarning('Beralih ke mode kompatibel, mohon tunggu...');
          try {
            if (await fallbackToCpu()) onIssueRef.current?.('detect_error', `${errorDetail(err)} backend=${backend}->cpu`);
          } catch (loadErr) {
            if (!cancelled) fail('model_load', errorDetail(loadErr));
            return;
          }
          stepStartedAt = Date.now();
        } else {
          setWarning('Gagal memproses gambar kamera, mencoba lagi...');
        }
      }
      if (cancelled) return;
      if (index >= steps.length) {
        stopCamera();
        onCompleteRef.current({ descriptors, photos });
        return;
      }
      timer = setTimeout(loop, 80);
    };

    const start = () => {
      if (cancelled) return;
      setStatus('running');
      // Timer langkah dimulai setelah kamera siap, bukan saat model/izin kamera masih dimuat.
      stepStartedAt = Date.now();
      loop();
    };

    (async () => {
      // Model diunduh bersamaan dengan permintaan izin kamera.
      const models = loadFaceModels();
      models.catch(() => undefined); // ditangani di bawah
      try {
        stream = await openCamera();
      } catch (err) {
        if (!cancelled) fail(cameraIssue(err), errorDetail(err));
        return;
      }
      if (cancelled) { stopCamera(); return; }
      try {
        await models;
      } catch (err) {
        if (!cancelled) fail('model_load', errorDetail(err));
        return;
      }
      const video = videoRef.current;
      if (cancelled || !video) { stopCamera(); return; }
      video.srcObject = stream;
      try {
        await video.play();
        start();
      } catch {
        // Autoplay diblokir: putar dari ketukan pengguna.
        tapToStartRef.current = () => {
          tapToStartRef.current = null;
          video.play().then(start).catch((err) => fail('camera_busy', errorDetail(err)));
        };
        setStatus('tap');
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stopCamera();
    };
  }, []);

  const steps = stepsRef.current;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden bg-slate-900 ring-4 ring-blue-500/40">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
        {status === 'tap' && (
          <button
            type="button"
            onClick={() => tapToStartRef.current?.()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/70 text-white"
          >
            <Camera className="w-8 h-8" />
            <span className="text-sm font-medium">Ketuk untuk menyalakan kamera</span>
          </button>
        )}
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-xs">Menyiapkan kamera...</span>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <CameraOff className="w-10 h-10 opacity-70" />
          </div>
        )}
      </div>

      {status === 'error' ? (
        <p className="text-sm text-red-600 text-center max-w-xs">{error}</p>
      ) : (
        <>
          <p className="text-base font-semibold text-slate-800 text-center">{instruction(steps[stepIndex])}</p>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 w-8 rounded-full ${i < stepIndex ? 'bg-emerald-500' : i === stepIndex ? 'bg-blue-500' : 'bg-slate-200'}`} />
            ))}
          </div>
          <p className="text-xs text-amber-600 min-h-4 text-center">{warning}</p>
        </>
      )}

      {onCancel && (
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700 underline">
          Batal
        </button>
      )}
    </div>
  );
}
