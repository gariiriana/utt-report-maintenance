// ============================================================================
// FILE: frontend/components/FaceRegistrationManagement.tsx
// Deskripsi: Modul Manajemen & Registrasi Wajah Biometrik untuk Akun QC DME (qc@gmail.com).
//            Mengelola pengambilan foto wajah via webcam, ekstraksi fitur biometrik 128-D,
//            penyimpanan identitas personel ke Firestore ('registered_faces'),
//            serta monitoring daftar wajah yang memiliki hak akses login Face ID.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/api/firebase';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { RegisteredFace, DetectedFaceBox } from '@/types/faceAuthTypes';
import {
  detectFaceInStream,
  extractFaceDescriptor,
  captureFaceCroppedBase64
} from '@/utils/faceRecognitionService';
import { toast } from 'sonner';
import {
  Camera,
  CameraOff,
  UserCheck,
  UserX,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  CheckCircle2,
  User,
  Mail,
  Lock,
  Search,
  ScanFace
} from 'lucide-react';

// Daftar Akun Resmi Sistem untuk Pilihan Cepat (Autocomplete)
const PRESET_ACCOUNTS = [
  { email: 'pump@gmail.com', role: 'engineer', label: 'Cooling / Chilled Pump (pump@gmail.com)' },
  { email: 'ats@gmail.com', role: 'engineer', label: 'ATS Panel (ats@gmail.com)' },
  { email: 'busduct@gmail.com', role: 'engineer', label: 'Busduct System (busduct@gmail.com)' },
  { email: 'trafo@gmail.com', role: 'engineer', label: 'Transformator (trafo@gmail.com)' },
  { email: 'genset@gmail.com', role: 'engineer', label: 'Genset System (genset@gmail.com)' },
  { email: 'ups@gmail.com', role: 'engineer', label: 'UPS System (ups@gmail.com)' },
  { email: 'pdu@gmail.com', role: 'engineer', label: 'PDU (pdu@gmail.com)' },
  { email: 'coolingtower@gmail.com', role: 'engineer', label: 'Cooling Tower (coolingtower@gmail.com)' },
  { email: 'chiller@gmail.com', role: 'engineer', label: 'Chiller (chiller@gmail.com)' },
  { email: 'fcu@gmail.com', role: 'engineer', label: 'FCU (fcu@gmail.com)' },
  { email: 'ahu@gmail.com', role: 'engineer', label: 'AHU (ahu@gmail.com)' },
  { email: 'crac@gmail.com', role: 'engineer', label: 'CRAC Unit (crac@gmail.com)' },
  { email: 'vrv@gmail.com', role: 'engineer', label: 'VRV System (vrv@gmail.com)' },
  { email: 'pju@gmail.com', role: 'engineer', label: 'PJU & Taman (pju@gmail.com)' },
  { email: 'lv@gmail.com', role: 'engineer', label: 'Panel LV (lv@gmail.com)' },
  { email: 'mv@gmail.com', role: 'engineer', label: 'Panel MV & RMU (mv@gmail.com)' },
  { email: 'grounding@gmail.com', role: 'engineer', label: 'Grounding System (grounding@gmail.com)' },
  { email: 'ldbrdb@gmail.com', role: 'engineer', label: 'Panel LDB & RDB (ldbrdb@gmail.com)' },
  { email: 'acsplit@gmail.com', role: 'engineer', label: 'AC Split Wall (acsplit@gmail.com)' },
  { email: 'lift@gmail.com', role: 'engineer', label: 'Elevator / Lift (lift@gmail.com)' },
  { email: 'gate@gmail.com', role: 'engineer', label: 'Autogate System (gate@gmail.com)' },
  { email: 'door@gmail.com', role: 'engineer', label: 'Fire / Auto Door (door@gmail.com)' },
  { email: 'dockleveler@gmail.com', role: 'engineer', label: 'Dock Leveler (dockleveler@gmail.com)' },
  { email: 'exhaustfan@gmail.com', role: 'engineer', label: 'Exhaust Fan (exhaustfan@gmail.com)' },
  { email: 'qc@gmail.com', role: 'qc_dme', label: 'QC DME Officer (qc@gmail.com)' },
  { email: 'admin@gmail.com', role: 'admin', label: 'Administrator (admin@gmail.com)' },
  { email: 'standby@dwimitra.com', role: 'standby_engineer', label: 'Standby Engineer (standby@dwimitra.com)' },
];

export function FaceRegistrationManagement() {
  const { user } = useAuth();

  // State Form Pendaftaran Wajah
  const [personName, setPersonName] = useState('');
  const [targetEmail, setTargetEmail] = useState('pump@gmail.com');
  const [accountPassword, setAccountPassword] = useState('');
  const [department, setDepartment] = useState('Teknisi Data Center');
  const [notes, setNotes] = useState('');
  const [capturedAvatar, setCapturedAvatar] = useState<string | null>(null);
  const [extractedDescriptor, setExtractedDescriptor] = useState<number[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // State Kamera
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [detectedBox, setDetectedBox] = useState<DetectedFaceBox | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // State List Wajah Terdaftar
  const [registeredList, setRegisteredList] = useState<RegisteredFace[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Real-time Daftar Wajah dari Firestore
  useEffect(() => {
    setLoadingList(true);
    const q = query(collection(db, 'registered_faces'), orderBy('registeredAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const faces: RegisteredFace[] = snapshot.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<RegisteredFace, 'id'>)
        }));
        setRegisteredList(faces);
        setLoadingList(false);
      },
      (err) => {
        console.error('Error fetching registered faces:', err);
        setLoadingList(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. Kontrol Siklus Kamera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser Anda tidak mendukung akses kamera.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Failed to start camera:', err);
      setCameraError(err.message || 'Kamera gagal diakses. Pastikan izin kamera aktif.');
      toast.error('Gagal mengakses kamera: ' + (err.message || 'Izin ditolak'));
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

  // Kaitkan stream ke elemen <video>
  useEffect(() => {
    if (isCameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.warn('Video play error:', e));

      // Loop deteksi wajah real-time
      const checkFace = () => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          const box = detectFaceInStream(videoRef.current);
          setDetectedBox(box);
        }
        animFrameRef.current = requestAnimationFrame(checkFace);
      };

      animFrameRef.current = requestAnimationFrame(checkFace);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isCameraActive, stream]);

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // 3. Tangkap Foto Wajah dari Kamera
  const handleCaptureFromCamera = () => {
    if (!videoRef.current) {
      toast.error('Kamera belum siap.');
      return;
    }

    try {
      const avatarBase64 = captureFaceCroppedBase64(videoRef.current, detectedBox || undefined);
      const descriptor = extractFaceDescriptor(videoRef.current, detectedBox || undefined);

      if (!avatarBase64 || descriptor.length === 0) {
        toast.error('Gagal mengekstrak fitur wajah. Pastikan wajah terlihat jelas.');
        return;
      }

      setCapturedAvatar(avatarBase64);
      setExtractedDescriptor(descriptor);
      toast.success('Foto wajah berhasil ditangkap dan fitur biometrik berhasil diekstrak!');
      stopCamera();
    } catch (err: any) {
      console.error('Error capturing face:', err);
      toast.error('Gagal memproses foto wajah: ' + err.message);
    }
  };

  // 4. Unggah Foto dari File (Alternatif jika tanpa webcam)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const descriptor = extractFaceDescriptor(canvas);
            const avatarBase64 = canvas.toDataURL('image/jpeg', 0.85);

            setCapturedAvatar(avatarBase64);
            setExtractedDescriptor(descriptor);
            toast.success('Foto wajah berhasil diunggah & diekstrak biometriknya!');
          }
        } catch (err: any) {
          toast.error('Gagal mengekstrak foto: ' + err.message);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 5. Simpan Data Registrasi ke Firestore
  const handleSaveRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!personName.trim()) {
      toast.error('Mohon isi nama identitas personel');
      return;
    }

    if (!targetEmail.trim()) {
      toast.error('Mohon tentukan akun email login tujuan');
      return;
    }

    if (!capturedAvatar || !extractedDescriptor || extractedDescriptor.length === 0) {
      toast.error('Ambil atau unggah foto wajah terlebih dahulu');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Menyimpan data biometrik wajah ke database...');

    try {
      // Buat ID unik berdasarkan email dan timestamp
      const safeEmail = targetEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const docId = `face_${safeEmail}_${Date.now().toString().slice(-6)}`;

      const newFaceData: RegisteredFace = {
        id: docId,
        name: personName.trim(),
        accountEmail: targetEmail.trim().toLowerCase(),
        accountPassword: accountPassword.trim() || undefined,
        role: targetEmail.includes('admin') ? 'admin' : (targetEmail.includes('qc') ? 'qc_dme' : 'engineer'),
        photoBase64: capturedAvatar,
        faceDescriptor: extractedDescriptor,
        registeredBy: user?.email || 'qc@gmail.com',
        registeredAt: new Date().toISOString(),
        status: 'active',
        department: department.trim() || 'Teknisi Data Center',
        notes: notes.trim() || undefined
      };

      await setDoc(doc(db, 'registered_faces', docId), {
        ...newFaceData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success(`Wajah ${personName} berhasil didaftarkan untuk login akun ${targetEmail}!`, { id: toastId });

      // Reset Form
      setPersonName('');
      setAccountPassword('');
      setNotes('');
      setCapturedAvatar(null);
      setExtractedDescriptor(null);
    } catch (err: any) {
      console.error('Gagal menyimpan pendaftaran wajah:', err);
      toast.error(`Gagal menyimpan: ${err.message || 'Kesalahan sistem'}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // 6. Toggle Status Aktif / Nonaktif
  const handleToggleStatus = async (item: RegisteredFace) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'registered_faces', item.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Status ${item.name} diubah menjadi: ${newStatus === 'active' ? 'Aktif' : 'Nonaktif'}`);
    } catch (err: any) {
      toast.error('Gagal mengubah status: ' + err.message);
    }
  };

  // 7. Hapus Wajah Terdaftar
  const handleDeleteFace = async (item: RegisteredFace) => {
    if (!window.confirm(`Yakin ingin menghapus data wajah terdaftar atas nama "${item.name}"? Orang ini tidak akan bisa login via Face ID lagi.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'registered_faces', item.id));
      toast.success(`Data wajah ${item.name} berhasil dihapus.`);
    } catch (err: any) {
      toast.error('Gagal menghapus data wajah: ' + err.message);
    }
  };

  const filteredList = registeredList.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.accountEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.department && f.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-indigo-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Khusus QC DME (qc@gmail.com) & Admin
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Face ID System
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <ScanFace className="w-7 h-7 text-indigo-400" />
              <span>Registrasi & Manajemen Akses Wajah</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium leading-relaxed">
              Daftarkan wajah personel teknisi beserta nama identitas dan akun tujuannya. Hanya wajah yang didaftarkan oleh akun QC yang diizinkan masuk ke sistem melalui pemindaian wajah di halaman login.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
              <div className="text-xs text-slate-300 font-medium">Total Wajah Aktif</div>
              <div className="text-2xl font-black text-emerald-400">
                {registeredList.filter(f => f.status === 'active').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GRID KONTEN: FORM DAFTAR & TABEL LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* KOLOM KIRI: FORM REGISTRASI WAJAH BARU (5 COLS) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Daftarkan Wajah Baru</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-400">Step 1: Ambil Wajah</span>
          </div>

          {/* AREA KAMERA / PREVIEW AVATAR */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Pratinjau Foto Wajah & Pemindai
            </label>

            <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
              {/* JIKA KAMERA AKTIF */}
              {isCameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  {/* Lingkaran Panduan Wajah (Face Reticle) */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className={`w-48 h-60 rounded-[45%] border-2 border-dashed transition-all duration-300 ${
                      detectedBox ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]' : 'border-indigo-400/70'
                    }`} />
                    <div className="absolute bottom-3 text-center px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[11px] font-bold text-white">
                      {detectedBox ? 'Wajah Terdeteksi — Klik "Ambil Foto"' : 'Arahkan wajah ke dalam lingkaran'}
                    </div>
                  </div>
                </>
              ) : capturedAvatar ? (
                /* JIKA SUDAH DIAMBIL / DIUNGGAH */
                <div className="relative w-full h-full flex items-center justify-center bg-slate-900">
                  <img
                    src={capturedAvatar}
                    alt="Captured Face"
                    className="w-40 h-40 rounded-3xl object-cover border-4 border-emerald-500 shadow-xl"
                  />
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-500 text-white font-black text-[10px] flex items-center gap-1 shadow-md">
                    <CheckCircle2 className="w-3 h-3" /> Wajah Siap
                  </div>
                </div>
              ) : (
                /* JIKA KAMERA MATI & BELUM ADA FOTO */
                <div className="text-center p-6 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 flex items-center justify-center mx-auto">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div className="text-xs text-slate-300 font-medium">
                    Kamera belum aktif. Klik tombol di bawah untuk membuka webcam laptop atau unggah foto wajah.
                  </div>
                </div>
              )}
            </div>

            {/* KONTROL TOMBOL KAMERA */}
            <div className="flex items-center gap-2 pt-1">
              {!isCameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Camera className="w-4 h-4" />
                  Buka Kamera Webcam
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCaptureFromCamera}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm animate-pulse"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Ambil Foto Wajah
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="p-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition cursor-pointer"
                    title="Tutup Kamera"
                  >
                    <CameraOff className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Upload Alternatif dari File */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
                title="Unggah foto wajah dari file komputer"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                <span>Upload</span>
              </button>
            </div>
            {cameraError && (
              <div className="text-[11px] text-rose-600 font-medium bg-rose-50 p-2 rounded-xl border border-rose-200">
                {cameraError}
              </div>
            )}
          </div>

          {/* FORM IDENTITAS PERSONEL */}
          <form onSubmit={handleSaveRegistration} className="space-y-3.5 pt-2 border-t border-slate-100">
            {/* Input Nama Identitas */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Lengkap Personel <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={personName}
                  onChange={e => setPersonName(e.target.value)}
                  placeholder="Contoh: Gari Iriana"
                  className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Pilihan Akun Login Tujuan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Akun Email Login Sistem <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={targetEmail}
                  onChange={e => setTargetEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                >
                  {PRESET_ACCOUNTS.map(acc => (
                    <option key={acc.email} value={acc.email}>
                      {acc.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Saat wajah orang ini cocok, sistem akan langsung login ke akun email di atas.
              </p>
            </div>

            {/* Password Akun (Opsional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kata Sandi Akun (Opsional untuk Full Firebase Auth)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={accountPassword}
                  onChange={e => setAccountPassword(e.target.value)}
                  placeholder="Masukkan kata sandi akun jika ingin login penuh"
                  className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Unit / Divisi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Unit / Divisi Kerja
              </label>
              <input
                type="text"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="Contoh: Mechanical & Electrical / UTT"
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Tombol Simpan */}
            <button
              type="submit"
              disabled={isSaving || !capturedAvatar || !personName.trim()}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-indigo-600/20 mt-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke Database QC...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Daftarkan Wajah ke Database</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* KOLOM KANAN: TABEL DAFTAR WAJAH TERDAFTAR (7 COLS) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Daftar Wajah Terdaftar ({registeredList.length})</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Orang-orang berikut memiliki izin login biometrik Face ID ke sistem
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau email..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* LIST ITEMS */}
          {loadingList ? (
            <div className="text-center py-12 space-y-2 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
              <p className="text-xs">Memuat data wajah terdaftar...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
                <ScanFace className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-700">Belum Ada Wajah Terdaftar</h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Gunakan form di samping kiri untuk mendaftarkan wajah orang/teknisi pertama kali.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
              {filteredList.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 sm:p-4 rounded-2xl border transition flex items-center justify-between gap-3 ${
                    item.status === 'active'
                      ? 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar Foto Wajah */}
                    <div className="relative shrink-0">
                      <img
                        src={item.photoBase64}
                        alt={item.name}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-indigo-200 shadow-sm"
                      />
                      <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                        item.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}>
                        {item.status === 'active' ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                        )}
                      </span>
                    </div>

                    {/* Informasi Personel */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                          {item.name}
                        </h4>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase ${
                          item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {item.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                          {item.accountEmail}
                        </span>
                        {item.department && (
                          <span className="truncate max-w-[150px]">{item.department}</span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 pt-0.5">
                        Didaftarkan: {new Date(item.registeredAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} oleh {item.registeredBy}
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(item)}
                      className={`p-2 rounded-xl border transition cursor-pointer text-xs font-bold ${
                        item.status === 'active'
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}
                      title={item.status === 'active' ? 'Nonaktifkan Akses Wajah' : 'Aktifkan Akses Wajah'}
                    >
                      {item.status === 'active' ? (
                        <UserX className="w-4 h-4" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteFace(item)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                      title="Hapus Wajah Terdaftar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
