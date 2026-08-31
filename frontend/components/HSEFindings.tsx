// ============================================================================
// FILE: HSEFindings.tsx
// Deskripsi: Halaman Form Input Temuan K3 / HSE (HSE Finding Input Form).
//            Fitur eksklusif untuk HSE Officer untuk mencatat temuan keselamatan
//            kerja secara langsung pada halaman (non-popup) dengan foto Before,
//            kategori, tingkat risiko, dan target tindak lanjut.
// ============================================================================

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Camera,
  Upload,
  Trash2,
  RefreshCw,
  MapPin,
  Calendar,
  User,
  ShieldAlert,
  Check,
  RotateCcw,
  Clock,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { compressImage } from '@/utils/imageCompression';
import {
  HSEFindingItem,
  HSEFindingCategory,
  HSEFindingSeverity,
  HSE_CATEGORY_LABELS,
  HSE_SEVERITY_CONFIG
} from '@/types/hseFinding';

interface HSEFindingsProps {
  onSuccess?: () => void;
}

export function HSEFindings({ onSuccess }: HSEFindingsProps) {
  const { user } = useAuth();

  // Form State: Input Temuan K3 Baru
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    location: string;
    category: HSEFindingCategory;
    severity: HSEFindingSeverity;
    targetPerson: string;
    findingDate: string;
    findingTime: string;
    targetDate: string;
    beforePhoto: string;
    beforeNotes: string;
  }>({
    title: '',
    description: '',
    location: '',
    category: 'unsafe_act',
    severity: 'medium',
    targetPerson: '',
    findingDate: new Date().toISOString().split('T')[0],
    findingTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
    targetDate: '',
    beforePhoto: '',
    beforeNotes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const beforeFileInputRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------------------------
  // Image Upload Handlers (with Compression)
  // --------------------------------------------------------------------------
  const handleBeforePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading('Mengompres foto temuan...', { id: 'compress-photo' });
      const base64 = await compressImage(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.65 });
      setFormData((prev) => ({ ...prev, beforePhoto: base64 }));
      toast.success('Foto temuan berhasil diunggah', { id: 'compress-photo' });
    } catch (error) {
      console.error('Error compressing image:', error);
      toast.error('Gagal mengompres gambar', { id: 'compress-photo' });
    } finally {
      if (beforeFileInputRef.current) beforeFileInputRef.current.value = '';
    }
  };

  // --------------------------------------------------------------------------
  // Reset Form
  // --------------------------------------------------------------------------
  const handleResetForm = () => {
    setFormData({
      title: '',
      description: '',
      location: '',
      category: 'unsafe_act',
      severity: 'medium',
      targetPerson: '',
      findingDate: new Date().toISOString().split('T')[0],
      findingTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
      targetDate: '',
      beforePhoto: '',
      beforeNotes: ''
    });
  };

  // --------------------------------------------------------------------------
  // Submit New Finding (Directly with Status 'open')
  // --------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Judul temuan wajib diisi');
      return;
    }
    if (!formData.location.trim()) {
      toast.error('Lokasi temuan wajib diisi');
      return;
    }
    if (!formData.beforePhoto) {
      toast.error('Foto kondisi temuan (Before) wajib dilampirkan');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Menyimpan data temuan K3...');

    try {
      const newFinding: Partial<HSEFindingItem> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        category: formData.category,
        severity: formData.severity,
        status: 'open',
        reportedBy: user?.email || 'hse@dwimitra.com',
        inspectorName: user?.email?.split('@')[0] || 'HSE Officer',
        targetPerson: formData.targetPerson.trim() || '-',
        findingDate: formData.findingDate,
        findingTime: formData.findingTime,
        targetDate: formData.targetDate || '',
        beforePhoto: formData.beforePhoto,
        beforeNotes: formData.beforeNotes.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'hse_findings'), newFinding);

      toast.success('Temuan K3 berhasil dicatat & masuk ke arsip!', { id: toastId });
      handleResetForm();

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
        className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-amber-900/10 relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 bg-amber-400/30 backdrop-blur-sm text-amber-100 text-[11px] font-bold uppercase tracking-wider rounded-full border border-amber-300/30">
                  Formulir K3
                </span>
                <span className="text-xs text-amber-200 font-medium flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Status Awal: OPEN
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">Input Temuan K3 / HSE Baru</h1>
              <p className="text-xs sm:text-sm text-amber-100/90 mt-1 max-w-xl">
                Catat tindakan atau kondisi berbahaya di lapangan, lampirkan bukti foto kondisi awal (Before), dan tentukan target penanganan.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Form Container */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6"
      >
        {/* Section 1: Informasi Utama */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              1. Informasi Temuan & Lokasi
            </h3>
          </div>

          {/* Judul Temuan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Judul Temuan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Contoh: Engineer tidak memakai safety helmet di area genset"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
          </div>

          {/* Lokasi & Pihak Terkait */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Lokasi Temuan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Contoh: Genset Room Lantai 1 / Chiller Area"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Pihak Terkait / Subkon
              </label>
              <input
                type="text"
                value={formData.targetPerson}
                onChange={(e) => setFormData({ ...formData, targetPerson: e.target.value })}
                placeholder="Contoh: Teknisi Standby / Subkon ME / Vendor"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>
          </div>

          {/* Kategori & Tingkat Risiko */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Kategori Temuan K3
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              >
                {Object.entries(HSE_CATEGORY_LABELS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tingkat Bahaya / Risiko
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              >
                {Object.entries(HSE_SEVERITY_CONFIG).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tanggal & Waktu Temuan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Tanggal Temuan
              </label>
              <input
                type="date"
                value={formData.findingDate}
                onChange={(e) => setFormData({ ...formData, findingDate: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Jam Temuan
              </label>
              <input
                type="time"
                value={formData.findingTime}
                onChange={(e) => setFormData({ ...formData, findingTime: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Target Selesai (Opsional)
              </label>
              <input
                type="date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
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
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition leading-relaxed"
            />
          </div>
        </div>

        {/* Section 3: Foto Bukti Before */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              3. Dokumentasi Foto Kondisi Awal (Before) <span className="text-red-500">*</span>
            </h3>
            {formData.beforePhoto && (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, beforePhoto: '' })}
                className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Foto</span>
              </button>
            )}
          </div>

          {formData.beforePhoto ? (
            <div className="relative aspect-video max-h-80 bg-slate-900 rounded-2xl overflow-hidden border border-amber-300 group">
              <img
                src={formData.beforePhoto}
                alt="Preview Foto Before"
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-3 left-3 px-3 py-1 bg-amber-600/90 backdrop-blur-sm text-white text-xs font-bold rounded-xl">
                Foto Bukti Temuan (Before)
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed border-amber-300 rounded-2xl bg-amber-50/30 hover:bg-amber-50/60 transition text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <Camera className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-800 mb-1">Ambil Foto atau Unggah Bukti Temuan (Before)</p>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Foto akan otomatis dikompresi untuk menghemat ruang penyimpanan dan mempercepat proses simpan.
              </p>
              <button
                type="button"
                onClick={() => beforeFileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-amber-600/20 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Pilih / Ambil Foto</span>
              </button>
            </div>
          )}

          <input
            ref={beforeFileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleBeforePhotoChange}
            className="hidden"
          />

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
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
          </div>
        </div>

        {/* Section 4: Action Buttons */}
        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetForm}
            disabled={isSubmitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-sm font-bold transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Form</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-amber-600/25 transition disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan Temuan...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Simpan & Laporkan Temuan K3</span>
              </>
            )}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
