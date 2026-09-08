// ============================================================================
// FILE: Login.tsx
// Deskripsi: Halaman Login autentikasi utama DwimitraSystem.
//            Mendukung 2 Metode Login:
//            1. 📸 SCAN WAJAH (Face ID Biometric) — Memindai wajah personel via webcam
//               dan mencocokkannya secara real-time dengan database wajah terdaftar dari QC.
//            2. 🔑 KREDENSIAL MANUAL (Email & Password) — Dilengkapi Turnstile anti-bot.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/components/AuthContext';
import { toast } from 'sonner';
import { Lock, Mail, Eye, EyeOff, LogIn, Camera, CheckCircle2, AlertCircle, RefreshCw, Sparkles, SwitchCamera, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { db, auth as firebaseAuth } from '@/api/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { RegisteredFace, DetectedFaceBox } from '@/types/faceAuthTypes';
import {
  detectFaceInStream,
  extractFaceDescriptor,
  matchFaceWithRegisteredDatabase
} from '@/utils/faceRecognitionService';

import logoDwimitra from '@/assets/logo_dwimitra_v2.png';

export function Login() {
  // Mode Login: langsung manual (Email & Password → Face Verify)
  const [authMode, setAuthMode] = useState<'face' | 'manual'>('manual');

  // State Form Login Manual
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // State Multi-Step Login Manual: 'credentials' → 'face_verify'
  const [manualLoginStep, setManualLoginStep] = useState<'credentials' | 'face_verify'>('credentials');
  const pendingCredentialsRef = useRef<{ email: string; password: string } | null>(null);
  const faceVerifyVideoRef = useRef<HTMLVideoElement>(null);
  const faceVerifyStreamRef = useRef<MediaStream | null>(null);
  const faceVerifyAnimRef = useRef<number | null>(null);
  const faceVerifyMatchRef = useRef<boolean>(false);
  const faceVerifyConsecutiveRef = useRef<number>(0);
  const [fvCameraActive, setFvCameraActive] = useState(false);
  const [fvDetectedBox, setFvDetectedBox] = useState<DetectedFaceBox | null>(null);
  const [fvScanStatus, setFvScanStatus] = useState<'searching' | 'detecting' | 'matched' | 'unrecognized'>('searching');
  const [fvMatchedPerson, setFvMatchedPerson] = useState<RegisteredFace | null>(null);
  const [fvMatchConfidence, setFvMatchConfidence] = useState<number>(0);
  const [fvCameraError, setFvCameraError] = useState<string | null>(null);
  const [fvFacingMode, setFvFacingMode] = useState<'user' | 'environment'>('user');
  const [fvLoggingIn, setFvLoggingIn] = useState(false);

  // State Face Biometric Login
  const [registeredFaces, setRegisteredFaces] = useState<RegisteredFace[]>([]);
  const [loadingFaces, setLoadingFaces] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [detectedBox, setDetectedBox] = useState<DetectedFaceBox | null>(null);
  const [scanStatus, setScanStatus] = useState<'searching' | 'detecting' | 'verifying' | 'matched' | 'unrecognized'>('searching');
  const [matchedPerson, setMatchedPerson] = useState<RegisteredFace | null>(null);
  const [matchConfidence, setMatchConfidence] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Context Auth
  const { login, loginWithFaceVerified } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const matchSuccessRef = useRef<boolean>(false);
  const consecutiveMatchesRef = useRef<number>(0);

  // 1. Ambil Data Wajah Terdaftar dari Firestore ('registered_faces')
  const fetchRegisteredFaces = async () => {
    setLoadingFaces(true);
    try {
      const q = query(collection(db, 'registered_faces'), where('status', '==', 'active'));
      const snap = await getDocs(q);
      const faces: RegisteredFace[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<RegisteredFace, 'id'>)
      }));
      setRegisteredFaces(faces);
    } catch (err) {
      console.warn('Gagal memuat database wajah QC:', err);
    } finally {
      setLoadingFaces(false);
    }
  };

  useEffect(() => {
    fetchRegisteredFaces();
  }, []);

  // 2. Kontrol Kamera Webcam Multi-Device
  const startCamera = async (overrideFacingMode?: 'user' | 'environment') => {
    const targetMode = overrideFacingMode || facingMode;
    setCameraError(null);
    matchSuccessRef.current = false;
    consecutiveMatchesRef.current = 0;
    setMatchedPerson(null);
    setScanStatus('searching');

    try {
      // Periksa Secure Context (WebRTC mewajibkan HTTPS atau localhost)
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        throw new Error('Akses kamera di browser memerlukan protokol HTTPS yang aman atau dijalankan di localhost.');
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser atau perangkat ini tidak mendukung akses kamera langsung (WebRTC).');
      }

      let mediaStream: MediaStream;
      try {
        // Coba constraint ideal (640x480)
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: targetMode,
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
      } catch (constraintErr) {
        // Fallback untuk perangkat/kamera yang tidak mendukung constraint ideal (OverconstrainedError)
        console.warn('Constraint kamera ideal gagal, mencoba fallback standar:', constraintErr);
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: targetMode },
            audio: false
          });
        } catch {
          // Fallback paling mendasar untuk webcams lawas
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Kamera gagal diakses:', err);
      let friendlyMsg = err.message || 'Kamera gagal diakses.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyMsg = 'Izin akses kamera ditolak. Izinkan akses kamera pada browser atau pengaturan perangkat Anda.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendlyMsg = 'Tidak ditemukan perangkat kamera fisik pada perangkat Anda.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        friendlyMsg = 'Kamera sedang digunakan aplikasi lain (Zoom, Teams, Meet). Tutup aplikasi tersebut lalu coba lagi.';
      }
      setCameraError(friendlyMsg);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsCameraActive(false);
    setDetectedBox(null);
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    stopCamera();
    setTimeout(() => {
      startCamera(nextMode);
    }, 250);
  };

  // Otomatis aktifkan kamera saat masuk ke mode 'face'
  useEffect(() => {
    if (authMode === 'face') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [authMode]);

  // Loop Pemindaian & Pencocokan Wajah Real-Time
  useEffect(() => {
    if (isCameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.warn('Video play err:', e));

      let lastScanTime = 0;

      const scanLoop = (timestamp: number) => {
        if (!videoRef.current || matchSuccessRef.current) return;

        if (videoRef.current.readyState >= 2) {
          // 1. Deteksi Box Wajah di Video
          const box = detectFaceInStream(videoRef.current);
          setDetectedBox(box);

          // 2. Lakukan ekstraksi & matching tiap ~200ms
          if (box && timestamp - lastScanTime > 200) {
            lastScanTime = timestamp;
            setScanStatus('detecting');

            try {
              const probeDescriptor = extractFaceDescriptor(videoRef.current, box);

              if (registeredFaces.length > 0) {
                const matchResult = matchFaceWithRegisteredDatabase(probeDescriptor, registeredFaces);

                if (matchResult.isMatch && matchResult.matchedPerson) {
                  consecutiveMatchesRef.current += 1;

                  // Wajah harus stabil cocok minimal 2 scan berturut-turut untuk menghindari salah deteksi
                  if (consecutiveMatchesRef.current >= 2) {
                    matchSuccessRef.current = true;
                    setScanStatus('matched');
                    setMatchedPerson(matchResult.matchedPerson);
                    setMatchConfidence(matchResult.confidence);

                    toast.success(`Wajah Dikenali: ${matchResult.matchedPerson.name}!`, {
                      description: matchResult.matchedPerson.accountEmail
                        ? `Menghubungkan ke akun ${matchResult.matchedPerson.accountEmail}...`
                        : `Memverifikasi identitas personel ${matchResult.matchedPerson.name}...`
                    });

                    // Eksekusi Login Otomatis setelah jeda animasi 800ms
                    setTimeout(async () => {
                      try {
                        await loginWithFaceVerified(matchResult.matchedPerson!);
                        toast.success('Login Berhasil via Face ID!');
                        stopCamera();
                      } catch (loginErr: any) {
                        console.error('Face Login Error:', loginErr);
                        toast.error(`Login gagal: ${loginErr.message}`);
                        matchSuccessRef.current = false;
                        consecutiveMatchesRef.current = 0;
                        setScanStatus('searching');
                      }
                    }, 800);
                  }
                } else {
                  consecutiveMatchesRef.current = 0;
                  setScanStatus('unrecognized');
                }
              } else {
                setScanStatus('unrecognized');
              }
            } catch (err) {
              console.warn('Face match error:', err);
            }
          } else if (!box) {
            consecutiveMatchesRef.current = 0;
            setScanStatus('searching');
          }
        }

        if (!matchSuccessRef.current) {
          animFrameRef.current = requestAnimationFrame(scanLoop);
        }
      };

      animFrameRef.current = requestAnimationFrame(scanLoop);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isCameraActive, stream, registeredFaces]);

  // 3. Handler Submit Form Login Manual — Step 1: Validasi Credential
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Mohon isi semua field');
      return;
    }

    if (!turnstileToken) {
      toast.error('Mohon selesaikan verifikasi keamanan Turnstile terlebih dahulu');
      return;
    }

    setLoading(true);
    try {
      // Validasi credential Firebase Auth terlebih dahulu (tanpa benar-benar login)
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      // Credential valid! Segera signOut agar belum dianggap login
      await signOut(firebaseAuth);

      // Simpan credential sementara di memory untuk dipakai setelah face verify
      pendingCredentialsRef.current = { email, password };

      // Pindah ke step face verify
      toast.success('Kredensial valid! Lanjutkan verifikasi wajah...', {
        icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />
      });
      setManualLoginStep('face_verify');
    } catch (error: any) {
      console.error('Credential validation error:', error);
      let errorMessage = 'Login gagal. Silakan coba lagi.';
      if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Koneksi jaringan ke server gagal. Pastikan internet Anda lancar.';
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Email atau password salah';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Terlalu banyak percobaan login. Coba lagi nanti.';
      }
      toast.error(errorMessage);
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  };

  // 4. Face Verify Step — Kontrol Kamera
  const startFvCamera = async (overrideMode?: 'user' | 'environment') => {
    const targetMode = overrideMode || fvFacingMode;
    setFvCameraError(null);
    faceVerifyMatchRef.current = false;
    faceVerifyConsecutiveRef.current = 0;
    setFvMatchedPerson(null);
    setFvScanStatus('searching');

    try {
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        throw new Error('Akses kamera memerlukan HTTPS atau localhost.');
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera langsung.');
      }

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: targetMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
      } catch {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: targetMode }, audio: false });
        } catch {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      faceVerifyStreamRef.current = mediaStream;
      setFvCameraActive(true);
    } catch (err: any) {
      console.error('FV camera error:', err);
      let friendlyMsg = err.message || 'Kamera gagal diakses.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyMsg = 'Izin akses kamera ditolak browser.';
      } else if (err.name === 'NotFoundError') {
        friendlyMsg = 'Tidak ditemukan kamera pada perangkat.';
      } else if (err.name === 'NotReadableError') {
        friendlyMsg = 'Kamera sedang digunakan aplikasi lain.';
      }
      setFvCameraError(friendlyMsg);
    }
  };

  const stopFvCamera = () => {
    if (faceVerifyStreamRef.current) {
      faceVerifyStreamRef.current.getTracks().forEach(t => t.stop());
      faceVerifyStreamRef.current = null;
    }
    if (faceVerifyAnimRef.current) {
      cancelAnimationFrame(faceVerifyAnimRef.current);
      faceVerifyAnimRef.current = null;
    }
    setFvCameraActive(false);
    setFvDetectedBox(null);
  };

  const toggleFvFacingMode = () => {
    const nextMode = fvFacingMode === 'user' ? 'environment' : 'user';
    setFvFacingMode(nextMode);
    stopFvCamera();
    setTimeout(() => startFvCamera(nextMode), 250);
  };

  // Otomatis aktifkan kamera saat masuk step face_verify
  useEffect(() => {
    if (authMode === 'manual' && manualLoginStep === 'face_verify') {
      startFvCamera();
    } else {
      stopFvCamera();
    }
    return () => stopFvCamera();
  }, [manualLoginStep, authMode]);

  // 5. Face Verify Step — Loop Pemindaian & Pencocokan Real-Time
  useEffect(() => {
    if (fvCameraActive && faceVerifyStreamRef.current && faceVerifyVideoRef.current) {
      faceVerifyVideoRef.current.srcObject = faceVerifyStreamRef.current;
      faceVerifyVideoRef.current.play().catch(e => console.warn('FV video play err:', e));

      let lastScanTime = 0;

      const scanLoop = (timestamp: number) => {
        if (!faceVerifyVideoRef.current || faceVerifyMatchRef.current) return;

        if (faceVerifyVideoRef.current.readyState >= 2) {
          const box = detectFaceInStream(faceVerifyVideoRef.current);
          setFvDetectedBox(box);

          if (box && timestamp - lastScanTime > 200) {
            lastScanTime = timestamp;
            setFvScanStatus('detecting');

            try {
              const probeDescriptor = extractFaceDescriptor(faceVerifyVideoRef.current, box);

              if (registeredFaces.length > 0) {
                const matchResult = matchFaceWithRegisteredDatabase(probeDescriptor, registeredFaces);

                if (matchResult.isMatch && matchResult.matchedPerson) {
                  faceVerifyConsecutiveRef.current += 1;

                  if (faceVerifyConsecutiveRef.current >= 4) {
                    faceVerifyMatchRef.current = true;
                    setFvScanStatus('matched');
                    setFvMatchedPerson(matchResult.matchedPerson);
                    setFvMatchConfidence(matchResult.confidence);

                    toast.success(`Wajah Dikenali: ${matchResult.matchedPerson.name}!`, {
                      description: 'Menyelesaikan proses login...'
                    });

                    // Eksekusi Login Sebenarnya setelah animasi
                    setTimeout(async () => {
                      setFvLoggingIn(true);
                      try {
                        const creds = pendingCredentialsRef.current;
                        if (creds) {
                          await login(creds.email, creds.password);
                          toast.success('Login berhasil!');
                          stopFvCamera();
                          pendingCredentialsRef.current = null;
                        }
                      } catch (loginErr: any) {
                        console.error('Face-verified login error:', loginErr);
                        toast.error(`Login gagal: ${loginErr.message}`);
                        faceVerifyMatchRef.current = false;
                        faceVerifyConsecutiveRef.current = 0;
                        setFvScanStatus('searching');
                        setFvLoggingIn(false);
                      }
                    }, 800);
                  }
                } else {
                  faceVerifyConsecutiveRef.current = 0;
                  setFvScanStatus('unrecognized');
                }
              } else {
                setFvScanStatus('unrecognized');
              }
            } catch (err) {
              console.warn('FV face match error:', err);
            }
          } else if (!box) {
            faceVerifyConsecutiveRef.current = 0;
            setFvScanStatus('searching');
          }
        }

        if (!faceVerifyMatchRef.current) {
          faceVerifyAnimRef.current = requestAnimationFrame(scanLoop);
        }
      };

      faceVerifyAnimRef.current = requestAnimationFrame(scanLoop);
    }

    return () => {
      if (faceVerifyAnimRef.current) {
        cancelAnimationFrame(faceVerifyAnimRef.current);
      }
    };
  }, [fvCameraActive, registeredFaces]);

  // 6. Cancel Face Verify — Kembali ke Step Credentials
  const handleCancelFaceVerify = () => {
    stopFvCamera();
    pendingCredentialsRef.current = null;
    faceVerifyMatchRef.current = false;
    faceVerifyConsecutiveRef.current = 0;
    setManualLoginStep('credentials');
    setFvScanStatus('searching');
    setFvMatchedPerson(null);
    setFvLoggingIn(false);
    setTurnstileToken(null);
  };

  return (
    <div className="min-h-screen w-full font-geist text-slate-800 flex items-center justify-center p-4 sm:p-6 md:p-8 select-none z-50">
      {/* Container Card Login dengan animasi fade-in & scale */}
      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-[94%] sm:w-full max-w-[390px] sm:max-w-[440px] relative z-10 mx-auto my-auto"
      >
        <div className="bg-white/85 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl shadow-sky-950/15 border border-white/90 overflow-hidden">
          {/* Top Decorative Accent */}
          <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-teal-500" />

          <div className="p-4 sm:p-6 md:p-7 space-y-4">
            {/* Header Logo & Judul */}
            <div className="text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className="inline-flex items-center justify-center mb-1"
              >
                <img
                  src={logoDwimitra}
                  alt="PT Dwimitra Ekatama Mandiri"
                  className="h-11 sm:h-14 md:h-16 w-auto object-contain drop-shadow-sm transition-all"
                />
              </motion.div>

              <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight leading-snug">
                PT Dwimitra Ekatama Mandiri
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-semibold">
                Data Center Maintenance System
              </p>
            </div>


            {/* KONTEN BERDASARKAN MODE AUTENTIKASI */}
            <AnimatePresence mode="wait">
              {authMode === 'face' ? (
                /* ========================================================
                   MODE 1: SCAN WAJAH (FACE ID BIOMETRIC)
                   ======================================================== */
                <motion.div
                  key="mode-face"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-3.5"
                >
                  {/* JENDELA SCANNER WEBCAM */}
                  <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                    {isCameraActive ? (
                      <>
                        <video
                          ref={videoRef}
                          playsInline
                          muted
                          className={`w-full h-full object-cover transform ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                        />

                        {/* Tombol Alih Kamera Depan / Belakang */}
                        <button
                          type="button"
                          onClick={toggleFacingMode}
                          className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition cursor-pointer z-10"
                          title={facingMode === 'user' ? 'Ganti ke Kamera Belakang' : 'Ganti ke Kamera Depan'}
                        >
                          <SwitchCamera className="w-4 h-4" />
                        </button>

                        {/* LASER SCANNING BAR EFFECT (BERGERAK ATAS-BAWAH) */}
                        <motion.div
                          animate={{
                            y: [0, 190, 0]
                          }}
                          transition={{
                            duration: 2.2,
                            repeat: Infinity,
                            ease: 'easeInOut'
                          }}
                          className={`absolute inset-x-0 h-1 bg-gradient-to-r ${
                            scanStatus === 'matched'
                              ? 'from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(52,211,153,1)]'
                              : 'from-transparent via-indigo-400 to-transparent shadow-[0_0_15px_rgba(99,102,241,1)]'
                          }`}
                        />

                        {/* BINGKAI PANDUAN WAJAH BIOMETRIK (RETICLE) */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          {/* Lingkaran Wajah */}
                          <div
                            className={`w-44 h-56 rounded-[46%] border-2 transition-all duration-300 ${
                              scanStatus === 'matched'
                                ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.8)]'
                                : detectedBox
                                ? 'border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                                : 'border-dashed border-white/50'
                            }`}
                          />

                          {/* Sudut Frame Futuristik */}
                          <div className="absolute w-52 h-64 border-t-2 border-l-2 border-indigo-400/80 rounded-tl-xl top-4 left-6 pointer-events-none" />
                          <div className="absolute w-52 h-64 border-t-2 border-r-2 border-indigo-400/80 rounded-tr-xl top-4 right-6 pointer-events-none" />
                        </div>

                        {/* OVERLAY SUKSES SAAT WAJAH COCOK */}
                        {scanStatus === 'matched' && matchedPerson && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center space-y-2 z-20"
                          >
                            <img
                              src={matchedPerson.photoBase64}
                              alt={matchedPerson.name}
                              className="w-16 h-16 rounded-full object-cover border-3 border-emerald-400 shadow-xl"
                            />
                            <div>
                              <div className="flex items-center justify-center gap-1 text-emerald-400 font-black text-xs">
                                <CheckCircle2 className="w-4 h-4" />
                                Wajah Terverifikasi!
                              </div>
                              <h4 className="text-sm font-black text-white">{matchedPerson.name}</h4>
                              {matchedPerson.accountEmail && (
                                <p className="text-[11px] text-indigo-300 font-semibold">{matchedPerson.accountEmail}</p>
                              )}
                              {matchedPerson.role && (
                                <span className="inline-block px-2 py-0.5 mt-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                                  {matchedPerson.role}
                                </span>
                              )}
                              <div className="text-[10px] text-slate-400 mt-1">Akurasi: {matchConfidence}%</div>
                            </div>
                            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mt-1" />
                          </motion.div>
                        )}
                      </>
                    ) : (
                      /* KAMERA MATI */
                      <div className="p-6 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 flex items-center justify-center mx-auto">
                          <Camera className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-slate-300 font-medium">
                          Kamera tidak aktif. Izinkan akses kamera atau klik tombol di bawah.
                        </p>
                        <button
                          type="button"
                          onClick={() => startCamera()}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                        >
                          Aktifkan Kamera
                        </button>
                      </div>
                    )}
                  </div>

                  {/* KOTAK STATUS INFORMASI PEMINDAIAN */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-center space-y-1">
                    {loadingFaces ? (
                      <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        <span>Memuat basis data biometrik QC...</span>
                      </div>
                    ) : scanStatus === 'searching' ? (
                      <div className="text-xs font-semibold text-slate-600">
                        👤 Arahkan wajah Anda ke tengah lingkaran kamera
                      </div>
                    ) : scanStatus === 'detecting' ? (
                      <div className="text-xs font-bold text-indigo-600 flex items-center justify-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" />
                        <span>Wajah terdeteksi! Memeriksa kecocokan data QC...</span>
                      </div>
                    ) : scanStatus === 'unrecognized' ? (
                      <div className="text-xs font-bold text-amber-700 space-y-0.5">
                        <div className="flex items-center justify-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Wajah belum dikenali</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal">
                          Pastikan wajah Anda sudah didaftarkan oleh akun <b>qc@gmail.com</b>.
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {cameraError && (
                    <div className="text-[11px] text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 font-medium text-center space-y-1.5">
                      <div>{cameraError}</div>
                      <button
                        type="button"
                        onClick={() => setAuthMode('manual')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                      >
                        Beralih ke Login Email & Password →
                      </button>
                    </div>
                  )}

                  {/* Info Jumlah Wajah Terdaftar */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
                    <span>Database Wajah Terdaftar:</span>
                    <span className="font-bold text-indigo-600">
                      {registeredFaces.length} Personel
                    </span>
                  </div>
                </motion.div>
              ) : (
                /* ========================================================
                   MODE 2: LOGIN MANUAL (EMAIL & PASSWORD + FACE VERIFY)
                   ======================================================== */
                <motion.div
                  key="mode-manual"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                >
                  <AnimatePresence mode="wait">
                    {manualLoginStep === 'credentials' ? (
                      /* --- STEP 1: FORM EMAIL + PASSWORD + TURNSTILE --- */
                      <motion.form
                        key="step-credentials"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.25 }}
                        onSubmit={handleManualSubmit}
                        className="space-y-3 sm:space-y-4"
                      >
                        {/* Input Email */}
                        <div>
                          <label htmlFor="email" className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">
                            Alamat Email
                          </label>
                          <div className="relative group">
                            <Mail className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-600 transition z-10 pointer-events-none" />
                            <input
                              id="email"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-3 focus:ring-blue-500/15 focus:border-blue-500 outline-none transition text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium shadow-sm"
                              placeholder="user@perusahaan.com"
                            />
                          </div>
                        </div>

                        {/* Input Kata Sandi */}
                        <div>
                          <label htmlFor="password" className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">
                            Kata Sandi
                          </label>
                          <div className="relative group">
                            <Lock className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-600 transition z-10 pointer-events-none" />
                            <input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full pl-9 sm:pl-10 pr-9 sm:pr-10 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-3 focus:ring-blue-500/15 focus:border-blue-500 outline-none transition text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium shadow-sm"
                              placeholder="Masukkan kata sandi Anda"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition cursor-pointer p-1 z-10"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Cloudflare Turnstile Anti-Bot Security */}
                        <div className="pt-0.5 pb-0.5 flex justify-center items-center cf-turnstile" data-action="turnstile-spin-v2">
                          <Turnstile
                            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAD_fWrDH129FQ_Rm'}
                            onSuccess={(token) => setTurnstileToken(token)}
                            onExpire={() => setTurnstileToken(null)}
                            onError={() => setTurnstileToken(null)}
                            options={{ action: 'turnstile-spin-v2', theme: 'light', size: 'normal' }}
                          />
                        </div>

                        {/* Tombol Submit — Step 1 Credential Verification */}
                        <motion.button
                          whileHover={{ scale: turnstileToken && !loading ? 1.01 : 1 }}
                          whileTap={{ scale: turnstileToken && !loading ? 0.98 : 1 }}
                          type="submit"
                          disabled={loading || !turnstileToken}
                          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-2.5 sm:py-3 rounded-xl font-bold shadow-md shadow-blue-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm cursor-pointer"
                        >
                          {loading ? (
                            <span className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Memverifikasi...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <LogIn className="w-4 h-4 md:w-5 md:h-5" />
                              Lanjutkan
                            </span>
                          )}
                        </motion.button>
                      </motion.form>
                    ) : (
                      /* --- STEP 2: FACE VERIFY (SCAN WAJAH SEBELUM LOGIN) --- */
                      <motion.div
                        key="step-face-verify"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-3.5"
                      >
                        {/* Header Step 2 */}
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80">
                          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                          <div>
                            <div className="text-xs font-black text-emerald-800">Verifikasi Wajah Diperlukan</div>
                            <div className="text-[10px] text-emerald-600 font-medium">
                              Arahkan wajah Anda ke kamera untuk menyelesaikan login sebagai <b>{email}</b>
                            </div>
                          </div>
                        </div>

                        {/* JENDELA SCANNER WEBCAM FACE VERIFY */}
                        <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                          {fvCameraActive ? (
                            <>
                              <video
                                ref={faceVerifyVideoRef}
                                playsInline
                                muted
                                className={`w-full h-full object-cover transform ${fvFacingMode === 'user' ? '-scale-x-100' : ''}`}
                              />

                              {/* Tombol Alih Kamera */}
                              <button
                                type="button"
                                onClick={toggleFvFacingMode}
                                className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition cursor-pointer z-10"
                                title={fvFacingMode === 'user' ? 'Ganti ke Kamera Belakang' : 'Ganti ke Kamera Depan'}
                              >
                                <SwitchCamera className="w-4 h-4" />
                              </button>

                              {/* LASER SCANNING BAR */}
                              <motion.div
                                animate={{ y: [0, 190, 0] }}
                                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                                className={`absolute inset-x-0 h-1 bg-gradient-to-r ${
                                  fvScanStatus === 'matched'
                                    ? 'from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(52,211,153,1)]'
                                    : 'from-transparent via-indigo-400 to-transparent shadow-[0_0_15px_rgba(99,102,241,1)]'
                                }`}
                              />

                              {/* BINGKAI PANDUAN WAJAH */}
                              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div
                                  className={`w-44 h-56 rounded-[46%] border-2 transition-all duration-300 ${
                                    fvScanStatus === 'matched'
                                      ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.8)]'
                                      : fvDetectedBox
                                      ? 'border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                                      : 'border-dashed border-white/50'
                                  }`}
                                />
                                <div className="absolute w-52 h-64 border-t-2 border-l-2 border-indigo-400/80 rounded-tl-xl top-4 left-6 pointer-events-none" />
                                <div className="absolute w-52 h-64 border-t-2 border-r-2 border-indigo-400/80 rounded-tr-xl top-4 right-6 pointer-events-none" />
                              </div>

                              {/* OVERLAY SUKSES */}
                              {fvScanStatus === 'matched' && fvMatchedPerson && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center space-y-2 z-20"
                                >
                                  <img
                                    src={fvMatchedPerson.photoBase64}
                                    alt={fvMatchedPerson.name}
                                    className="w-16 h-16 rounded-full object-cover border-3 border-emerald-400 shadow-xl"
                                  />
                                  <div>
                                    <div className="flex items-center justify-center gap-1 text-emerald-400 font-black text-xs">
                                      <CheckCircle2 className="w-4 h-4" />
                                      Wajah Terverifikasi!
                                    </div>
                                    <h4 className="text-sm font-black text-white">{fvMatchedPerson.name}</h4>
                                    <div className="text-[10px] text-slate-400 mt-1">Akurasi: {fvMatchConfidence}%</div>
                                  </div>
                                  <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mt-1" />
                                </motion.div>
                              )}
                            </>
                          ) : (
                            <div className="p-6 text-center space-y-3">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 flex items-center justify-center mx-auto">
                                <Camera className="w-6 h-6" />
                              </div>
                              <p className="text-xs text-slate-300 font-medium">
                                Kamera tidak aktif.
                              </p>
                              <button
                                type="button"
                                onClick={() => startFvCamera()}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                              >
                                Aktifkan Kamera
                              </button>
                            </div>
                          )}
                        </div>

                        {/* STATUS INFORMASI PEMINDAIAN */}
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-center space-y-1">
                          {fvScanStatus === 'searching' ? (
                            <div className="text-xs font-semibold text-slate-600">
                              👤 Arahkan wajah Anda ke tengah lingkaran kamera
                            </div>
                          ) : fvScanStatus === 'detecting' ? (
                            <div className="text-xs font-bold text-indigo-600 flex items-center justify-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 animate-spin" />
                              <span>Wajah terdeteksi! Memeriksa kecocokan...</span>
                            </div>
                          ) : fvScanStatus === 'unrecognized' ? (
                            <div className="text-xs font-bold text-amber-700 space-y-0.5">
                              <div className="flex items-center justify-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Wajah belum dikenali</span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-normal">
                                Pastikan wajah Anda sudah didaftarkan oleh QC.
                              </p>
                            </div>
                          ) : fvScanStatus === 'matched' ? (
                            <div className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{fvLoggingIn ? 'Menyelesaikan login...' : 'Wajah cocok! Memproses...'}</span>
                            </div>
                          ) : null}
                        </div>

                        {fvCameraError && (
                          <div className="text-[11px] text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 font-medium text-center">
                            {fvCameraError}
                          </div>
                        )}

                        {/* Tombol Kembali */}
                        <button
                          type="button"
                          onClick={handleCancelFaceVerify}
                          disabled={fvLoggingIn}
                          className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Kembali ke Login
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer Bantuan */}
            <div className="pt-2 text-center text-[11px] text-slate-400 border-t border-slate-100">
              Registrasi wajah dikelola oleh akun QC DME (<code>qc@gmail.com</code>).
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
