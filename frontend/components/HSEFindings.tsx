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
  ShieldCheck,
  AlertTriangle,
  Check,
  Clock,
  FileDown,
  Maximize2,
  X,
  RotateCcw,
  PlusCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { compressImage } from '@/utils/imageCompression';
import { safeStorage } from '@/utils/safeStorage';
import {
  HSEFindingItem,
  HSEFindingSeverity,
  HSEFindingType
} from '@/types/hseFinding';
import { exportSingleHSEFindingPDF } from '@/utils/HSEFindingPdfExport';
import { CameraModal } from '@/components/CameraModal';

interface HSEFindingsProps {
  onSuccess?: () => void;
  initialType?: HSEFindingType;
  onTypeChange?: (type: HSEFindingType) => void;
}

const DRAFT_STORAGE_KEY = 'hse_finding_form_draft_v1';

export function HSEFindings({ onSuccess, initialType = 'negative', onTypeChange }: HSEFindingsProps) {
  const { user } = useAuth();

  // State tipe temuan aktif ('negative' atau 'positive')
  const [findingType, setFindingType] = useState<HSEFindingType>(() => {
    if (initialType) return initialType;
    try {
      const saved = safeStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.formData?.findingType) return parsed.formData.findingType;
      }
    } catch (e) {}
    return 'negative';
  });

  // Helper untuk mendapatkan nama personil/orang default
  const getDefaultInspectorName = () => {
    if (user?.displayName && !user.displayName.toLowerCase().includes('hse') && !user.displayName.toLowerCase().includes('admin')) {
      return user.displayName;
    }
    return 'Gari Iriana';
  };

  // Form State: Input Temuan K3 Baru (dengan auto-restore draft jika halaman di-refresh)
  const [formData, setFormData] = useState<{
    findingType?: HSEFindingType;
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
            findingType: parsed.formData.findingType || 'negative',
            beforePhotos: rawPhotos,
            beforePhoto: rawPhotos[0] || parsed.formData.beforePhoto || ''
          };
        }
      }
    } catch (e) {
      console.warn('Gagal memulihkan draft temuan HSE:', e);
    }
    return {
      findingType: 'negative',
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

  // Handler beralih antara Temuan Negatif & Temuan Positif
  const handleSwitchFindingType = (newType: HSEFindingType, notifyParent = true) => {
    setFindingType(newType);
    setFormData(prev => {
      let newSeverity = prev.severity;
      if (newType === 'positive') {
        if (newSeverity === 'unsafe_condition' || newSeverity === 'unsafe_action') {
          newSeverity = 'safe_behavior';
        }
      } else {
        if (newSeverity === 'safe_behavior' || newSeverity === 'safe_condition' || newSeverity === 'compliance' || newSeverity === 'best_practice') {
          newSeverity = 'unsafe_condition';
        }
      }
      return {
        ...prev,
        findingType: newType,
        severity: newSeverity
      };
    });
    if (notifyParent && onTypeChange) {
      onTypeChange(newType);
    }
  };

  // Sinkronisasi dengan initialType dari props navbar
  useEffect(() => {
    if (initialType && initialType !== findingType) {
      handleSwitchFindingType(initialType, false);
    }
  }, [initialType]);

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
        safeStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          formData: { ...formData, findingType },
          savedDocId
        }));
      }
    } catch (e) {
      console.warn('Gagal menyimpan draft form temuan HSE:', e);
    }
  }, [formData, savedDocId, findingType]);

  // --------------------------------------------------------------------------
  // Unified Save / Update to Firestore (Arsip Temuan HSE - Anti Duplikasi)
  // --------------------------------------------------------------------------
  const saveFindingToFirestore = async (): Promise<string | null> => {
    if (!formData.title.trim()) {
      toast.error(findingType === 'positive' ? 'Judul temuan positif wajib diisi' : 'Judul temuan wajib diisi');
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
      toast.error(
        findingType === 'positive'
          ? 'Foto dokumentasi temuan positif wajib diunggah (minimal 1 foto)'
          : 'Foto bukti temuan (Before) wajib diunggah (minimal 1 foto)'
      );
      return null;
    }

    try {
      const isPositive = findingType === 'positive';
      const payload: any = {
        findingType: findingType,
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        inspectorName: formData.inspectorName.trim() || getDefaultInspectorName(),
        category: formData.category?.trim() || '',
        severity: formData.severity,
        status: isPositive ? 'close' : 'open',
        reportedBy: user?.email || 'hse@dwimitra.com',
        targetPerson: formData.targetPerson.trim() || '-',
        findingDate: formData.findingDate,
        findingTime: formData.findingTime,
        beforePhoto: photos[0],
        beforePhotos: photos,
        beforeNotes: formData.beforeNotes.trim(),
        updatedAt: serverTimestamp(),
      };

      // Untuk temuan positif, secara default langsung berstatus close (apresiasi tercatat)
      if (isPositive) {
        payload.resolvedAt = formData.findingDate;
        payload.resolvedBy = user?.email || 'HSE Officer';
        payload.afterNotes = formData.beforeNotes.trim() || 'Temuan positif K3 — apresiasi tindakan aman & kepatuhan K3 teladan.';
      }

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

      const isPositive = findingType === 'positive';
      const findingItem: HSEFindingItem = {
        id: docId,
        findingType: findingType,
        title: formData.title.trim() || (isPositive ? 'Temuan Positif K3' : 'Temuan K3 Tanpa Judul'),
        description: formData.description.trim(),
        location: formData.location.trim() || '-',
        category: formData.category?.trim() || '',
        severity: formData.severity,
        status: isPositive ? 'close' : 'open',
        reportedBy: user?.email || 'hse@dwimitra.com',
        inspectorName: formData.inspectorName.trim() || getDefaultInspectorName(),
        targetPerson: formData.targetPerson.trim() || '-',
        findingDate: formData.findingDate,
        findingTime: formData.findingTime,
        beforePhoto: photos[0] || '',
        beforePhotos: photos,
        beforeNotes: formData.beforeNotes.trim(),
        ...(isPositive ? {
          resolvedAt: formData.findingDate,
          resolvedBy: user?.email || 'HSE Officer',
          afterNotes: formData.beforeNotes.trim() || 'Temuan positif K3 — apresiasi tindakan aman & kepatuhan K3 teladan.'
        } : {})
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
  const handleResetForm = (showToast = true) => {
    const hasData =
      formData.title.trim() ||
      formData.description.trim() ||
      formData.location.trim() ||
      (formData.beforePhotos && formData.beforePhotos.length > 0) ||
      formData.beforePhoto;

    if (hasData) {
      const confirmReset = window.confirm('Apakah Anda yakin ingin mengosongkan form dan membuat temuan K3 baru? Data yang belum tersimpan akan dibersihkan.');
      if (!confirmReset) return;
    }

    safeStorage.removeItem(DRAFT_STORAGE_KEY);
    setSavedDocId(null);
    if (beforeFileInputRef.current) {
      beforeFileInputRef.current.value = '';
    }
    setFormData({
      findingType,
      title: '',
      description: '',
      location: '',
      inspectorName: getDefaultInspectorName(),
      category: '',
      severity: findingType === 'positive' ? 'safe_behavior' : 'unsafe_condition',
      targetPerson: '',
      findingDate: new Date().toISOString().split('T')[0],
      findingTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
      beforePhoto: '',
      beforePhotos: [],
      beforeNotes: ''
    });

    if (showToast) {
      toast.success(
        findingType === 'positive'
          ? 'Form temuan positif berhasil di-reset! Siap untuk input baru.'
          : 'Form temuan K3 berhasil di-reset! Siap untuk input baru.'
      );
    }
  };

  // --------------------------------------------------------------------------
  // Submit New / Update Finding
  // --------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading(
      savedDocId 
        ? 'Memperbarui data temuan di arsip...' 
        : (findingType === 'positive' ? 'Menyimpan data temuan positif...' : 'Menyimpan data temuan K3...')
    );

    try {
      const docId = await saveFindingToFirestore();
      if (!docId) {
        toast.dismiss(toastId);
        return;
      }

      toast.success(
        savedDocId
          ? 'Data temuan berhasil diperbarui di arsip!'
          : (findingType === 'positive' ? 'Temuan positif berhasil dicatat & masuk ke arsip!' : 'Temuan K3 berhasil dicatat & masuk ke arsip!'),
        { id: toastId }
      );

      // Bersihkan draft & reset form agar siap untuk form temuan baru berikutnya
      safeStorage.removeItem(DRAFT_STORAGE_KEY);
      setSavedDocId(null);
      if (beforeFileInputRef.current) {
        beforeFileInputRef.current.value = '';
      }
      setFormData({
        findingType,
        title: '',
        description: '',
        location: '',
        inspectorName: getDefaultInspectorName(),
        category: '',
        severity: findingType === 'positive' ? 'safe_behavior' : 'unsafe_condition',
        targetPerson: '',
        findingDate: new Date().toISOString().split('T')[0],
        findingTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
        beforePhoto: '',
        beforePhotos: [],
        beforeNotes: ''
      });

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
    <div className="space-y-6 pb-6">
      {/* Selector 2 Tombol Pemilihan Report (Temuan Negatif vs Temuan Positif) */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                findingType === 'positive'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {findingType === 'positive' ? '🟢 Mode Temuan Positif' : '🔴 Mode Temuan Negatif'}
              </span>
              {savedDocId && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full border border-amber-300 animate-pulse">
                  Draft Tersimpan di Arsip
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 mt-1">
              Pilih Jenis Laporan Temuan K3
            </h2>
            <p className="text-xs text-slate-500">
              Pilih apakah ingin mencatat kondisi/tindakan tidak aman atau mendokumentasikan tindakan aman & apresiasi K3.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={() => handleResetForm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold border border-slate-200 transition cursor-pointer active:scale-95 shadow-2xs"
              title="Reset seluruh isian dan mulai form baru"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset / Form Baru</span>
            </button>
          </div>
        </div>

        {/* 2 Buttons Pemilihan Report: Temuan Negatif & Temuan Positif */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {/* Button 1: Temuan Negatif */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSwitchFindingType('negative')}
            className={`relative p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
              findingType === 'negative'
                ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white border-transparent shadow-lg shadow-red-600/20 ring-2 ring-red-500 ring-offset-2'
                : 'bg-slate-50/70 hover:bg-red-50/40 text-slate-700 border-slate-200 hover:border-red-200'
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 ${
              findingType === 'negative' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className={`text-sm font-black tracking-tight ${findingType === 'negative' ? 'text-white' : 'text-slate-900'}`}>
                  Temuan Negatif
                </span>
                {findingType === 'negative' && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-white uppercase tracking-wider">
                    Aktif
                  </span>
                )}
              </div>
              <p className={`text-xs mt-1 leading-snug font-medium ${findingType === 'negative' ? 'text-red-100' : 'text-slate-500'}`}>
                Unsafe Action, Unsafe Condition & Pelanggaran K3
              </p>
            </div>
          </motion.button>

          {/* Button 2: Temuan Positif */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSwitchFindingType('positive')}
            className={`relative p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
              findingType === 'positive'
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-transparent shadow-lg shadow-emerald-600/20 ring-2 ring-emerald-500 ring-offset-2'
                : 'bg-slate-50/70 hover:bg-emerald-50/40 text-slate-700 border-slate-200 hover:border-emerald-200'
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 ${
              findingType === 'positive' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className={`text-sm font-black tracking-tight ${findingType === 'positive' ? 'text-white' : 'text-slate-900'}`}>
                  Temuan Positif
                </span>
                {findingType === 'positive' && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-white uppercase tracking-wider">
                    Aktif
                  </span>
                )}
              </div>
              <p className={`text-xs mt-1 leading-snug font-medium ${findingType === 'positive' ? 'text-emerald-100' : 'text-slate-500'}`}>
                Safe Behavior, Kepatuhan APD & Best Practice K3
              </p>
            </div>
          </motion.button>
        </div>
      </motion.div>

      {/* Banner Mode Edit Draft (Jika ada data tersimpan di arsip / draft) */}
      {savedDocId && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-50 border border-amber-200 rounded-3xl text-amber-900 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-2xl text-amber-800 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-amber-900">Mode Edit Temuan (Tersimpan di Arsip)</p>
              <p className="text-amber-700 text-xs mt-0.5">Perubahan yang disimpan akan memperbarui data temuan ini. Ingin membuat temuan baru?</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleResetForm(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-xs shrink-0 cursor-pointer text-xs active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Buat Form Baru</span>
          </button>
        </div>
      )}

      {/* Main Form Card */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-8 space-y-6"
      >
        {/* Section 1: Informasi Temuan */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 flex-wrap">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 leading-snug">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${findingType === 'positive' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span>1. Informasi & Lokasi Temuan</span>
            </h3>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
              findingType === 'positive'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {findingType === 'positive' ? 'Temuan Positif' : 'Temuan Negatif'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Judul Temuan */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {findingType === 'positive' ? 'Judul Temuan Positif / Apresiasi K3' : 'Judul Temuan K3'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={
                  findingType === 'positive'
                    ? 'Contoh: Teknisi selalu memasang LOTO & memakai full body harness saat bekerja di ketinggian'
                    : 'Contoh: Engineer bekerja tanpa menggunakan Full Body Harness di ketinggian'
                }
                className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition ${
                  findingType === 'positive'
                    ? 'focus:ring-emerald-500/20 focus:border-emerald-500'
                    : 'focus:ring-red-500/20 focus:border-red-500'
                }`}
              />
            </div>

            {/* Lokasi Temuan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin className={`w-3.5 h-3.5 ${findingType === 'positive' ? 'text-emerald-500' : 'text-red-500'}`} />
                <span>Lokasi Temuan</span>
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Contoh: Genset Room Lantai 1 / Cooling Tower Rooftop"
                className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition ${
                  findingType === 'positive'
                    ? 'focus:ring-emerald-500/20 focus:border-emerald-500'
                    : 'focus:ring-red-500/20 focus:border-red-500'
                }`}
              />
            </div>

            {/* Petugas Inspeksi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <UserCheck className={`w-3.5 h-3.5 ${findingType === 'positive' ? 'text-emerald-500' : 'text-red-500'}`} />
                <span>Petugas Inspeksi / Pengawas K3</span>
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.inspectorName}
                onChange={(e) => setFormData({ ...formData, inspectorName: e.target.value })}
                placeholder="Nama Pengawas HSE"
                className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition ${
                  findingType === 'positive'
                    ? 'focus:ring-emerald-500/20 focus:border-emerald-500'
                    : 'focus:ring-red-500/20 focus:border-red-500'
                }`}
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
                placeholder={
                  findingType === 'positive'
                    ? 'Contoh: Kepatuhan APD / Safe Behavior / Housekeeping Rapi / Fire Safety'
                    : 'Contoh: APD / Housekeeping / Elektrikal / Fire Safety'
                }
                className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition ${
                  findingType === 'positive'
                    ? 'focus:ring-emerald-500/20 focus:border-emerald-500'
                    : 'focus:ring-red-500/20 focus:border-red-500'
                }`}
              />
            </div>

            {/* Tingkat Risiko / Kategori Apresiasi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {findingType === 'positive' ? 'Kategori Apresiasi / Tindakan Aman' : 'Tingkat Bahaya / Risiko'} <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 transition cursor-pointer ${
                  findingType === 'positive'
                    ? 'focus:ring-emerald-500/20 focus:border-emerald-500'
                    : 'focus:ring-red-500/20 focus:border-red-500'
                }`}
              >
                {findingType === 'positive' ? (
                  <>
                    <option value="safe_behavior">Safe Behavior (Tindakan Aman)</option>
                    <option value="safe_condition">Safe Condition (Kondisi Aman)</option>
                    <option value="compliance">Kepatuhan K3 & APD Lengkap</option>
                    <option value="best_practice">Best Practice / Inovasi K3</option>
                  </>
                ) : (
                  <>
                    <option value="unsafe_condition">Unsafe Condition (Kondisi Tidak Aman)</option>
                    <option value="unsafe_action">Unsafe Action (Tindakan Tidak Aman)</option>
                  </>
                )}
              </select>
            </div>

            {/* Pihak Terkait / Subkon */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {findingType === 'positive' ? 'Penerima Apresiasi / Teknisi / Vendor' : 'Pihak Terkait / Vendor / Subkon'}
              </label>
              <input
                type="text"
                value={formData.targetPerson}
                onChange={(e) => setFormData({ ...formData, targetPerson: e.target.value })}
                placeholder={
                  findingType === 'positive'
                    ? 'Contoh: Tim Maintenance Elektrikal / Vendor HVAC'
                    : 'Contoh: Teknisi Elektrikal / Vendor HVAC'
                }
                className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition ${
                  findingType === 'positive'
                    ? 'focus:ring-emerald-500/20 focus:border-emerald-500'
                    : 'focus:ring-red-500/20 focus:border-red-500'
                }`}
              />
            </div>

            {/* Tanggal & Jam Temuan */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1 cursor-pointer">
                  <Calendar className={`w-3.5 h-3.5 ${findingType === 'positive' ? 'text-emerald-500' : 'text-red-500'}`} />
                  <span>Tanggal</span>
                </label>
                <input
                  type="date"
                  value={formData.findingDate}
                  onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch (err) {} }}
                  onChange={(e) => setFormData({ ...formData, findingDate: e.target.value })}
                  className={`w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition cursor-pointer ${
                    findingType === 'positive'
                      ? 'focus:ring-emerald-500/20 focus:border-emerald-500'
                      : 'focus:ring-red-500/20 focus:border-red-500'
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1 cursor-pointer">
                  <Clock className={`w-3.5 h-3.5 ${findingType === 'positive' ? 'text-emerald-500' : 'text-red-500'}`} />
                  <span>Jam</span>
                </label>
                <input
                  type="time"
                  value={formData.findingTime}
                  onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch (err) {} }}
                  onChange={(e) => setFormData({ ...formData, findingTime: e.target.value })}
                  className={`w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition cursor-pointer ${
                    findingType === 'positive'
                      ? 'focus:ring-emerald-500/20 focus:border-emerald-500'
                      : 'focus:ring-red-500/20 focus:border-red-500'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Kronologi & Uraian */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider leading-snug">
              {findingType === 'positive' ? '2. Uraian Tindakan Aman & Best Practice' : '2. Kronologi & Uraian Temuan'}
            </h3>
          </div>
          <div>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={
                findingType === 'positive'
                  ? 'Jelaskan tindakan aman, kepatuhan K3 teladan, atau praktik keselamatan kerja yang diterapkan dengan baik di lapangan...'
                  : 'Jelaskan detail kronologi, potensi bahaya, atau pelanggaran yang terjadi di lapangan...'
              }
              className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 transition leading-relaxed ${
                findingType === 'positive'
                  ? 'focus:ring-emerald-500/20 focus:border-emerald-500'
                  : 'focus:ring-red-500/20 focus:border-red-500'
              }`}
            />
          </div>
        </div>

        {/* Section 3: Foto Bukti (Live Camera dengan Watermark & Upload Galeri) */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-2 gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider leading-snug">
                  <span>
                    {findingType === 'positive'
                      ? '3. Dokumentasi Foto Tindakan / Kondisi Aman'
                      : '3. Dokumentasi Foto Kondisi Awal (Before)'}
                  </span>
                  <span className="text-red-500 ml-1 font-black">*</span>
                </h3>
                {currentBeforePhotos.length > 0 && (
                  <span className={`inline-flex items-center text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full normal-case shrink-0 ${
                    findingType === 'positive' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200/60' : 'bg-red-100 text-red-700 border border-red-200/60'
                  }`}>
                    {currentBeforePhotos.length} Foto Terlampir
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Ambil foto via live camera dengan watermark otomatis atau unggah dari galeri (bisa multi-foto).
              </p>
            </div>
            {currentBeforePhotos.length > 0 && (
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, beforePhoto: '', beforePhotos: [] }))}
                className="self-start sm:self-center shrink-0 text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Semua Foto</span>
              </button>
            )}
          </div>

          {/* Action Buttons: Camera & Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl font-bold text-sm transition shadow-xs cursor-pointer border ${
                findingType === 'positive'
                  ? 'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 hover:bg-red-100/80 text-red-800 border-red-200'
              }`}
            >
              <Camera className={`w-5 h-5 ${findingType === 'positive' ? 'text-emerald-600' : 'text-red-600'}`} />
              <span>Buka Live Camera (Watermark)</span>
            </button>

            <button
              type="button"
              onClick={() => beforeFileInputRef.current?.click()}
              className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm border border-slate-200 transition shadow-xs cursor-pointer"
            >
              <Upload className="w-5 h-5 text-slate-500" />
              <span>Unggah dari Galeri (Multi-Foto)</span>
            </button>
            <input
              ref={beforeFileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleBeforePhotoChange}
              className="hidden"
            />
          </div>

          {/* Preview Multi-Photos Grid */}
          {currentBeforePhotos.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {currentBeforePhotos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video shadow-xs cursor-pointer"
                    onClick={() => setPreviewImage({ url: photo, title: `Foto Temuan ${idx + 1}` })}
                  >
                    <img
                      src={photo}
                      alt={`Foto Temuan ${idx + 1}`}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <span className="text-[11px] font-bold text-white bg-black/50 px-2 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1">
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

          {/* Catatan Tambahan Foto */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Catatan Kondisi Foto (Opsional)
            </label>
            <input
              type="text"
              value={formData.beforeNotes}
              onChange={(e) => setFormData({ ...formData, beforeNotes: e.target.value })}
              placeholder={
                findingType === 'positive'
                  ? 'Contoh: Dokumentasi pekerja disiplin memakai APD lengkap dan tali pengaman terpasang kuat'
                  : 'Contoh: Kondisi diambil saat inspeksi shift pagi, area belum dipasang barikade'
              }
              className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 transition ${
                findingType === 'positive'
                  ? 'focus:ring-emerald-500/20 focus:border-emerald-500'
                  : 'focus:ring-red-500/20 focus:border-red-500'
              }`}
            />
          </div>
        </div>

        {/* Section 4: Action Buttons (Responsif Mobile & Desktop) */}
        <div className="pt-6 border-t border-slate-100 flex flex-col gap-3.5 pb-10">
          {/* Sub-tombol: Export PDF & Reset (Grid responsif: 2 kolom di HP, flex di tablet/desktop) */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full">
            <button
              type="button"
              onClick={() => handleResetForm(true)}
              disabled={isSubmitting}
              className="col-span-2 sm:col-auto sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs sm:text-sm font-bold border border-slate-200 shadow-2xs transition cursor-pointer disabled:opacity-50 active:scale-95"
              title="Kosongkan seluruh isian dan mulai form temuan baru"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>Reset / Form Baru</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportPDF('neutradc')}
              disabled={exportingVariant !== null || isSubmitting}
              className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 rounded-2xl text-xs sm:text-sm font-bold border border-slate-200 hover:border-red-300 shadow-2xs transition disabled:opacity-50 cursor-pointer active:scale-95"
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
              className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 rounded-2xl text-xs sm:text-sm font-bold border border-slate-200 hover:border-teal-300 shadow-2xs transition disabled:opacity-50 cursor-pointer active:scale-95"
              title="Export PDF Laporan Temuan K3 (Logo UTT & NeutraDC)"
            >
              {exportingVariant === 'utt' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 text-teal-600" />
                  <span>Export PDF UTT</span>
                </>
              )}
            </button>
          </div>

          {/* Tombol Simpan Utama (Lebar Penuh, Elegan, Nyaman Disentuh) */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full flex items-center justify-center gap-2.5 px-6 py-3.5 text-white rounded-2xl text-sm sm:text-base font-bold shadow-lg transition disabled:opacity-50 cursor-pointer active:scale-98 ${
              findingType === 'positive'
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/25'
                : 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-700 shadow-red-600/25'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan Data...</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>
                  {savedDocId
                    ? 'Perbarui Data di Arsip'
                    : (findingType === 'positive' ? 'Simpan & Laporkan Temuan Positif' : 'Simpan & Laporkan Temuan K3')}
                </span>
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
