import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  Upload,
  Trash2,
  RefreshCw,
  MapPin,
  Calendar,
  UserCheck,
  ShieldAlert,
  Check,
  Clock,
  FileDown,
  Maximize2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { compressImage } from '@/utils/imageCompression';
import { safeStorage } from '@/utils/safeStorage';
import {
  HSEFindingItem,
  HSEFindingSeverity
} from '@/types/hseFinding';
import { exportSingleHSEFindingPDF } from '@/utils/HSEFindingPdfExport';
import { CameraModal } from '@/components/CameraModal';

interface HSEFindingsProps {
  onSuccess?: () => void;
}

const DRAFT_STORAGE_KEY = 'hse_finding_form_draft_v1';

export function HSEFindings({ onSuccess }: HSEFindingsProps) {
  const { user } = useAuth();

  // Helper untuk mendapatkan nama personil/orang default
  const getDefaultInspectorName = () => {
    if (user?.displayName && !user.displayName.toLowerCase().includes('hse') && !user.displayName.toLowerCase().includes('admin')) {
      return user.displayName;
    }
    return 'Gari Iriana';
  };

  // Form State: Input Temuan K3 Baru (dengan auto-restore draft jika halaman di-refresh)
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    location: string;
    inspectorName: string;
    category: string;
    severity: HSEFindingSeverity;
    targetPerson: string;
    findingDate: string;
    findingTime: string;
    beforePhoto: string;
    beforePhotos: string[];
    beforeNotes: string;
  }>(() => {
    try {
      const saved = safeStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.formData) {
          const rawPhotos: string[] = Array.isArray(parsed.formData.beforePhotos) && parsed.formData.beforePhotos.length > 0
            ? parsed.formData.beforePhotos
            : (parsed.formData.beforePhoto ? [parsed.formData.beforePhoto] : []);
          return {
            ...parsed.formData,
            beforePhotos: rawPhotos,
            beforePhoto: rawPhotos[0] || parsed.formData.beforePhoto || ''
          };
        }
      }
    } catch (e) {
      console.warn('Gagal memulihkan draft temuan HSE:', e);
    }
    return {
      title: '',
      description: '',
      location: '',
      inspectorName: 'Gari Iriana',
      category: '',
      severity: 'unsafe_condition',
      targetPerson: '',
      findingDate: new Date().toISOString().split('T')[0],
      findingTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
      beforePhoto: '',
      beforePhotos: [],
      beforeNotes: ''
    };
  });

  const [savedDocId, setSavedDocId] = useState<string | null>(() => {
    try {
      const saved = safeStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.savedDocId || null;
      }
    } catch (e) {}
    return null;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exportingVariant, setExportingVariant] = useState<'neutradc' | 'utt' | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const beforeFileInputRef = useRef<HTMLInputElement>(null);

  // Auto-set nama default jika belum diisi user
  useEffect(() => {
    const defaultName = getDefaultInspectorName();
    setFormData(prev => {
      if (!prev.inspectorName || prev.inspectorName === 'hse') {
        return { ...prev, inspectorName: defaultName };
      }
      return prev;
    });
  }, [user]);

  // Simpan draft otomatis ke localStorage setiap ada perubahan ketikan / upload foto
  useEffect(() => {
    try {
      const hasContent =
        formData.title.trim() ||
        formData.location.trim() ||
        formData.description.trim() ||
        formData.beforePhoto ||
        formData.targetPerson.trim() ||
        formData.beforeNotes.trim();

      if (hasContent || savedDocId) {
        safeStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ formData, savedDocId }));
      }
    } catch (e) {
      console.warn('Gagal menyimpan draft form temuan HSE:', e);
    }
  }, [formData, savedDocId]);

  // --------------------------------------------------------------------------
  // Unified Save / Update to Firestore (Arsip Temuan HSE - Anti Duplikasi)
  // --------------------------------------------------------------------------
  const saveFindingToFirestore = async (): Promise<string | null> => {
    if (!formData.title.trim()) {
      toast.error('Judul temuan wajib diisi');
      return null;
    }
    if (!formData.location.trim()) {
      toast.error('Lokasi temuan wajib diisi');
      return null;
    }
    if (!formData.inspectorName.trim()) {
      toast.error('Nama petugas inspeksi wajib diisi');
      return null;
    }
    
    const photos: string[] = Array.isArray(formData.beforePhotos) && formData.beforePhotos.length > 0
      ? formData.beforePhotos
      : (formData.beforePhoto ? [formData.beforePhoto] : []);

    if (photos.length === 0) {
      toast.error('Foto bukti temuan (Before) wajib diunggah (minimal 1 foto)');
      return null;
    }

    try {
      const payload: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        inspectorName: formData.inspectorName.trim() || getDefaultInspectorName(),
        category: formData.category?.trim() || '',
        severity: formData.severity,
        status: 'open',
        reportedBy: user?.email || 'hse@dwimitra.com',
        targetPerson: formData.targetPerson.trim() || '-',
        findingDate: formData.findingDate,
        findingTime: formData.findingTime,
        beforePhoto: photos[0],
        beforePhotos: photos,
        beforeNotes: formData.beforeNotes.trim(),
        updatedAt: serverTimestamp(),
      };

      if (savedDocId) {
        await setDoc(doc(db, 'hse_findings', savedDocId), payload, { merge: true });
        return savedDocId;
      } else {
        payload.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, 'hse_findings'), payload);
        setSavedDocId(docRef.id);
        return docRef.id;
      }
    } catch (error) {
      console.error('Error saving finding:', error);
      toast.error('Gagal menyimpan data temuan ke Firestore');
      return null;
    }
  };

  // --------------------------------------------------------------------------
  // Export Single PDF Handler (NeutraDC / UTT)
  // --------------------------------------------------------------------------
  const handleExportPDF = async (companyVariant: 'neutradc' | 'utt') => {
    setExportingVariant(companyVariant);
    const variantLabel = companyVariant === 'neutradc' ? 'NeutraDC' : 'UTT';
    const toastId = toast.loading(`Menyimpan ke arsip & menyiapkan PDF (${variantLabel})...`);

    try {
      const docId = await saveFindingToFirestore();
      if (!docId) {
        toast.dismiss(toastId);
        return;
      }

      const photos = formData.beforePhotos && formData.beforePhotos.length > 0
        ? formData.beforePhotos
        : (formData.beforePhoto ? [formData.beforePhoto] : []);

      const findingItem: HSEFindingItem = {
        id: docId,
        title: formData.title.trim() || 'Temuan K3 Tanpa Judul',
        description: formData.description.trim(),
        location: formData.location.trim() || '-',
        category: formData.category?.trim() || '',
        severity: formData.severity,
        status: 'open',
        reportedBy: user?.email || 'hse@dwimitra.com',
        inspectorName: formData.inspectorName.trim() || getDefaultInspectorName(),
        targetPerson: formData.targetPerson.trim() || '-',
        findingDate: formData.findingDate,
        findingTime: formData.findingTime,
        beforePhoto: photos[0] || '',
        beforePhotos: photos,
        beforeNotes: formData.beforeNotes.trim(),
      };

      await exportSingleHSEFindingPDF(findingItem, { companyVariant });
      toast.success(
        savedDocId
          ? `Data di arsip diperbarui & PDF (${variantLabel}) berhasil diunduh!`
          : `Data masuk ke arsip & PDF (${variantLabel}) berhasil diunduh!`,
        { id: toastId }
      );
    } catch (err) {
      console.error('Export PDF error:', err);
      toast.error('Gagal membuat PDF temuan', { id: toastId });
    } finally {
      setExportingVariant(null);
    }
  };

  // --------------------------------------------------------------------------
  // Image Upload Handlers (Live Camera with Watermark & Gallery Multi-Upload)
  // --------------------------------------------------------------------------
  const handleCameraCapture = (base64: string) => {
    setFormData((prev) => {
      const updated = [...(prev.beforePhotos || []), base64];
      return {
        ...prev,
        beforePhotos: updated,
        beforePhoto: updated[0] || base64
      };
    });
    setIsCameraOpen(false);
    toast.success('Foto temuan berhasil diambil dengan watermark GPS & Waktu!');
  };

  const handleBeforePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      toast.loading(`Mengompres ${files.length} foto temuan...`, { id: 'compress-photo' });
      const compressedList: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const base64 = await compressImage(files[i], { maxWidth: 1200, maxHeight: 1200, quality: 0.7 });
        compressedList.push(base64);
      }
      setFormData((prev) => {
        const updated = [...(prev.beforePhotos || []), ...compressedList];
        return {
          ...prev,
          beforePhotos: updated,
          beforePhoto: updated[0] || ''
        };
      });
      toast.success(`${compressedList.length} foto temuan berhasil diunggah dari galeri`, { id: 'compress-photo' });
    } catch (error) {
      console.error('Error compressing image:', error);
      toast.error('Gagal mengompres gambar', { id: 'compress-photo' });
    } finally {
      if (beforeFileInputRef.current) beforeFileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setFormData((prev) => {
      const updated = (prev.beforePhotos || []).filter((_, idx) => idx !== index);
      return {
        ...prev,
        beforePhotos: updated,
        beforePhoto: updated[0] || ''
      };
    });
    toast.info('Foto temuan dihapus');
  };

  // --------------------------------------------------------------------------
  // Reset Form (Mulai Temuan Baru)
  // --------------------------------------------------------------------------
  const handleResetForm = () => {
    safeStorage.removeItem(DRAFT_STORAGE_KEY);
    setSavedDocId(null);
    setFormData({
      title: '',
      description: '',
      location: '',
      inspectorName: getDefaultInspectorName(),
      category: '',
      severity: 'unsafe_condition',
      targetPerson: '',
      findingDate: new Date().toISOString().split('T')[0],
      findingTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
      beforePhoto: '',
      beforePhotos: [],
      beforeNotes: ''
    });
  };

  // --------------------------------------------------------------------------
  // Submit New / Update Finding (Status 'open')
  // --------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading(savedDocId ? 'Memperbarui data temuan di arsip...' : 'Menyimpan data temuan K3...');

    try {
      const docId = await saveFindingToFirestore();
      if (!docId) {
        toast.dismiss(toastId);
        return;
      }

      toast.success(
        savedDocId
          ? 'Data temuan berhasil diperbarui di arsip!'
          : 'Temuan K3 berhasil dicatat & masuk ke arsip!',
        { id: toastId }
      );

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving finding:', error);
toast.error('Gagal menyimpan data temuan', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentBeforePhotos = formData.beforePhotos && formData.beforePhotos.length > 0
    ? formData.beforePhotos
    : (formData.beforePhoto ? [formData.beforePhoto] : []);

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-red-900/15 relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-white/20 backdrop-blur-md text-white text-[11px] font-bold rounded-full uppercase tracking-wider">
                  Eksklusif HSE
                </span>
                {savedDocId && (
                  <span className="px-2.5 py-0.5 bg-amber-400 text-slate-900 text-[11px] font-extrabold rounded-full animate-pulse">
                    Mode Edit Draft (Tersimpan di Arsip)
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1">Form Pelaporan Temuan K3</h1>
              <p className="text-xs sm:text-sm text-red-100 mt-0.5">
                Dokumentasi temuan keselamatan kerja langsung ke database sistem arsip HSE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold backdrop-blur-sm border border-white/15 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Form</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Form Card */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6"
      >
        {/* Section 1: Informasi Temuan */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              1. Informasi & Lokasi Temuan
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Judul Temuan */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Judul Temuan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Contoh: Engineer bekerja tanpa menggunakan Full Body Harness di ketinggian"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition"
              />
            </div>

            {/* Lokasi Temuan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                <span>Lokasi Temuan</span>
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Contoh: Genset Room Lantai 1 / Cooling Tower Rooftop"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition"
              />
            </div>

            {/* Petugas Inspeksi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-red-500" />
                <span>Petugas Inspeksi / Pengawas K3</span>
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.inspectorName}
                onChange={(e) => setFormData({ ...formData, inspectorName: e.target.value })}
                placeholder="Nama Pengawas HSE"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition"
              />
            </div>

            {/* Kategori Temuan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Kategori K3
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Contoh: APD / Housekeeping / Elektrikal / Fire Safety"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition"
              />
            </div>

            {/* Tingkat Risiko */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tingkat Bahaya / Risiko <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition cursor-pointer"
              >
                <option value="unsafe_condition">Unsafe Condition (Kondisi Tidak Aman)</option>
                <option value="unsafe_action">Unsafe Action (Tindakan Tidak Aman)</option>
              </select>
            </div>

            {/* Pihak Terkait / Subkon */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Pihak Terkait / Vendor / Subkon
              </label>
              <input
                type="text"
                value={formData.targetPerson}
                onChange={(e) => setFormData({ ...formData, targetPerson: e.target.value })}
                placeholder="Contoh: Teknisi Elektrikal / Vendor HVAC"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition"
              />
            </div>

            {/* Tanggal & Jam Temuan */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1 cursor-pointer">
                  <Calendar className="w-3.5 h-3.5 text-red-500" />
                  <span>Tanggal</span>
                </label>
                <input
                  type="date"
                  value={formData.findingDate}
                  onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch (err) {} }}
                  onChange={(e) => setFormData({ ...formData, findingDate: e.target.value })}
                  className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1 cursor-pointer">
                  <Clock className="w-3.5 h-3.5 text-red-500" />
                  <span>Jam</span>
                </label>
                <input
                  type="time"
                  value={formData.findingTime}
                  onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch (err) {} }}
                  onChange={(e) => setFormData({ ...formData, findingTime: e.target.value })}
                  className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Kronologi & Uraian */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 pb-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              2. Kronologi & Uraian Temuan
            </h3>
          </div>
          <div>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Jelaskan detail kronologi, potensi bahaya, atau pelanggaran yang terjadi di lapangan..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition leading-relaxed"
            />
          </div>
        </div>

        {/* Section 3: Foto Bukti Before (Live Camera dengan Watermark & Upload Galeri) */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between pb-2 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span>3. Dokumentasi Foto Kondisi Awal (Before)</span>
                <span className="text-red-500">*</span>
                {currentBeforePhotos.length > 0 && (
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full normal-case">
                    {currentBeforePhotos.length} Foto Terlampir
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pilih live camera dengan watermark otomatis atau unggah dari galeri (bisa lebih dari 1 foto).
              </p>
            </div>
            {currentBeforePhotos.length > 0 && (
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, beforePhoto: '', beforePhotos: [] }))}
                className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Semua Foto</span>
              </button>
            )}
          </div>

          {/* 2 Kotak Pilihan: Kiri Live Camera (Watermark) | Kanan Upload Galeri */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Kotak Kiri: Live Camera dengan Watermark */}
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="group relative flex flex-col items-center justify-center p-5 sm:p-6 rounded-2xl border-2 border-dashed border-red-300 hover:border-red-500 bg-red-50/40 hover:bg-red-50/80 transition-all duration-200 cursor-pointer text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-md shadow-red-500/20 group-hover:scale-110 transition-transform mb-2.5">
                <Camera className="w-6 h-6" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-red-700 transition-colors">
                Ambil Foto (Live Camera)
              </span>
              <span className="text-[11px] text-red-600 font-semibold mt-0.5">
                Otomatis Watermark GPS & Waktu
              </span>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1 bg-red-600 text-white rounded-full group-hover:bg-red-700 transition-colors shadow-xs">
                <Camera className="w-3 h-3" /> Buka Kamera
              </span>
            </button>

            {/* Kotak Kanan: Upload Foto dari Galeri */}
            <button
              type="button"
              onClick={() => beforeFileInputRef.current?.click()}
              className="group relative flex flex-col items-center justify-center p-5 sm:p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-red-400 bg-white hover:bg-slate-50 transition-all duration-200 cursor-pointer text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-red-50 text-slate-700 group-hover:text-red-600 flex items-center justify-center border border-slate-200 group-hover:border-red-200 group-hover:scale-110 transition-all mb-2.5">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-red-700 transition-colors">
                Upload Foto dari Galeri
              </span>
              <span className="text-[11px] text-slate-500 font-medium mt-0.5">
                Pilih dari perangkat (Bisa banyak)
              </span>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1 bg-slate-800 text-white rounded-full group-hover:bg-red-600 transition-colors shadow-xs">
                <Upload className="w-3 h-3" /> Pilih File Galeri
              </span>
            </button>
          </div>

          <input
            ref={beforeFileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleBeforePhotoChange}
            className="hidden"
          />

          {/* Photo Grid Preview (Jika sudah ada foto) */}
          {currentBeforePhotos.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Daftar Foto Temuan ({currentBeforePhotos.length} foto):
                </span>
                <span className="text-[11px] text-slate-400">Klik foto untuk memperbesar</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {currentBeforePhotos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-200 hover:border-red-400 shadow-xs transition-all"
                  >
                    <img
                      src={photo}
                      alt={`Foto Before ${idx + 1}`}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setPreviewImage({ url: photo, title: `Foto Temuan (Before) #${idx + 1}` })}
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold rounded-lg pointer-events-none">
                      {idx === 0 ? 'Utama' : `Foto ${idx + 1}`}
                    </div>
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <span className="px-1.5 py-0.5 bg-black/60 text-white text-[9px] rounded flex items-center gap-1">
                        <Maximize2 className="w-2.5 h-2.5" /> Perbesar
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePhoto(idx);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition-colors cursor-pointer"
                      title="Hapus foto ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Catatan Tambahan Foto Before */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Catatan Kondisi Foto (Opsional)
            </label>
            <input
              type="text"
              value={formData.beforeNotes}
              onChange={(e) => setFormData({ ...formData, beforeNotes: e.target.value })}
              placeholder="Contoh: Kondisi diambil saat inspeksi shift pagi, area belum dipasang barikade"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition"
            />
          </div>
        </div>

        {/* Section 4: Action Buttons */}
        <div className="pt-6 border-t border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
            <button
              type="button"
              onClick={() => handleExportPDF('neutradc')}
              disabled={exportingVariant !== null || isSubmitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 rounded-2xl text-xs sm:text-sm font-bold border border-slate-200 hover:border-red-300 shadow-xs transition disabled:opacity-50 cursor-pointer"
              title="Export PDF Laporan Temuan K3 (Logo Dwimitra & NeutraDC)"
            >
              {exportingVariant === 'neutradc' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-red-600" />
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 text-red-600" />
                  <span>Export PDF NeutraDC</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleExportPDF('utt')}
              disabled={exportingVariant !== null || isSubmitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-2xl text-xs sm:text-sm font-bold border border-slate-200 hover:border-blue-300 shadow-xs transition disabled:opacity-50 cursor-pointer"
              title="Export PDF Laporan Temuan K3 (Logo UTT & NeutraDC)"
            >
              {exportingVariant === 'utt' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 text-blue-600" />
                  <span>Export PDF UTT</span>
                </>
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-red-600/25 transition disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan Temuan...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{savedDocId ? 'Perbarui Data di Arsip' : 'Simpan & Laporkan Temuan K3'}</span>
              </>
            )}
          </button>
        </div>
      </motion.form>

      {/* Camera Modal (Live Camera with GPS Watermark) */}
      {isCameraOpen && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setIsCameraOpen(false)}
          title="HSE Finding (Before)"
          maintenanceName="Temuan Keselamatan K3"
          specificDetail={formData.location || 'Area NeutraDC'}
        />
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {previewImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-3 right-3 z-10">
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="w-full h-auto max-h-[85vh] object-contain"
              />
              <div className="p-3 bg-slate-900/90 text-white text-xs font-bold text-center border-t border-slate-800">
                {previewImage.title}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
