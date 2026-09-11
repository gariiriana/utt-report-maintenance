// ============================================================================
// FILE: frontend/components/AbnormalReportModal.tsx
// Deskripsi: Modal Pencatatan & Unggah Temuan Abnormal per Laporan/Unit di Arsip Dokumen.
//            Khusus akun role Engineer/Admin untuk mencatat kondisi abnormal/kerusakan,
//            melampirkan foto bukti temuan (opsional), serta mengembalikan status
//            dokumen kembali Normal jika kendala telah teratasi.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  X,
  Camera,
  Trash2,
  CheckCircle2,
  Save,
  RefreshCw,
  FileText,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { doc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { toast } from 'sonner';
import { ExcelDocument, AbnormalFinding } from './DocumentList';
import { useAuth } from './AuthContext';
import { offlineReportStorage } from '@/utils/offlineReportStorage';

interface AbnormalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: ExcelDocument | null;
  onSuccess: (updatedFields: Partial<ExcelDocument>) => void;
}

export function AbnormalReportModal({
  isOpen,
  onClose,
  document: docItem,
  onSuccess
}: AbnormalReportModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [unitName, setUnitName] = useState('');
  const [description, setDescription] = useState('');
  const [actionRecommendation, setActionRecommendation] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [photoFileName, setPhotoFileName] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Inisialisasi state dari data dokumen saat modal terbuka
  useEffect(() => {
    if (docItem) {
      const existing = docItem.abnormalFinding;
      setUnitName(existing?.unitName || docItem.specificDetail || docItem.maintenanceName || '');
      setDescription(existing?.description || '');
      setActionRecommendation(existing?.actionRecommendation || '');
      setPhotoBase64(existing?.photoBase64 || '');
      setPhotoFileName(existing?.photoBase64 ? 'Foto Bukti Terlampir' : '');
      setShowConfirmClear(false);
    }
  }, [docItem, isOpen]);

  if (!isOpen || !docItem) return null;

  // Helper kompresi gambar via HTML5 Canvas agar ringan di Firestore (~100-250KB)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          const canvas = window.document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', 0.75);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error('Gagal memuat berkas gambar.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Format berkas tidak valid. Harap pilih berkas gambar (JPG, PNG, WebP).');
      return;
    }

    setIsCompressing(true);
    try {
      const compressedB64 = await compressImage(file);
      setPhotoBase64(compressedB64);
      setPhotoFileName(file.name);
      toast.success('Foto bukti temuan abnormal berhasil dimuat.');
    } catch (err: any) {
      console.error('Error compressing abnormal photo:', err);
      toast.error('Gagal memproses gambar foto bukti.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoBase64('');
    setPhotoFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.info('Foto bukti temuan dihapus.');
  };

  // Simpan temuan abnormal ke Firestore & Offline Storage
  const handleSaveAbnormal = async () => {
    if (!description.trim()) {
      toast.error('Mohon isi deskripsi kelainan/temuan abnormal terlebih dahulu.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Menyimpan temuan abnormal ke arsip...');

    try {
      const targetUnitName = unitName.trim() || docItem.specificDetail || docItem.maintenanceName;
      const abnormalPayload: AbnormalFinding = {
        unitName: targetUnitName,
        description: description.trim(),
        actionRecommendation: actionRecommendation.trim() || undefined,
        photoBase64: photoBase64 || undefined,
        reportedBy: user?.displayName || user?.email || 'Engineer',
        reportedAt: new Date().toISOString(),
      };

      // Sanitize data agar tidak ada undefined values yang ditolak Firestore
      const cleanAbnormal = JSON.parse(JSON.stringify(abnormalPayload));
      const colName = docItem.documentType === 'excel'
        ? 'excel_documents'
        : (docItem.documentType === 'hse' ? 'hse' : 'pdf_documents');

      await updateDoc(doc(db, colName, docItem.id), {
        hasAbnormal: true,
        abnormalFinding: cleanAbnormal,
        updatedAt: serverTimestamp(),
      });

      // Update offline IndexedDB agar sinkron
      await offlineReportStorage.updateReportAbnormal(docItem.id, true, cleanAbnormal);

      toast.success(`Temuan abnormal berhasil disimpan pada unit "${targetUnitName}"!`, { id: toastId });
      onSuccess({
        hasAbnormal: true,
        abnormalFinding: cleanAbnormal,
      });
      onClose();
    } catch (err: any) {
      console.error('Error saving abnormal finding:', err);
      toast.error(`Gagal menyimpan temuan abnormal: ${err.message || 'Kesalahan jaringan'}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // Hapus status abnormal dan kembalikan unit ke status Normal
  const handleClearAbnormal = async () => {
    setIsClearing(true);
    const toastId = toast.loading('Mengembalikan status unit ke Normal...');

    try {
      const colName = docItem.documentType === 'excel'
        ? 'excel_documents'
        : (docItem.documentType === 'hse' ? 'hse' : 'pdf_documents');

      await updateDoc(doc(db, colName, docItem.id), {
        hasAbnormal: false,
        abnormalFinding: deleteField(),
        updatedAt: serverTimestamp(),
      });

      // Update offline IndexedDB
      await offlineReportStorage.updateReportAbnormal(docItem.id, false, null);

      toast.success('Status abnormal berhasil dihapus. Dokumen telah kembali Normal.', { id: toastId });
      onSuccess({
        hasAbnormal: false,
        abnormalFinding: null,
      });
      onClose();
    } catch (err: any) {
      console.error('Error clearing abnormal finding:', err);
      toast.error(`Gagal menghapus status abnormal: ${err.message || 'Kesalahan jaringan'}`, { id: toastId });
    } finally {
      setIsClearing(false);
      setShowConfirmClear(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
        >
          {/* Header Modal */}
          <div className="bg-gradient-to-r from-rose-700 via-red-700 to-amber-700 px-5 py-4 sm:px-6 sm:py-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-xs shrink-0 border border-white/20">
                  <AlertTriangle className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                      Catat Temuan Kondisi Abnormal
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/20 text-white border border-white/30 uppercase">
                      Role Engineer
                    </span>
                  </div>
                  <p className="text-xs text-rose-100/90 mt-0.5 font-medium line-clamp-1">
                    {docItem.maintenanceName} {docItem.specificDetail ? `— ${docItem.specificDetail}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition cursor-pointer shrink-0"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Box Status Terkini */}
            {docItem.hasAbnormal ? (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 leading-relaxed flex-1">
                  <span className="font-black text-rose-800 uppercase block tracking-wider text-[11px]">
                    Laporan Sudah Berstatus Abnormal
                  </span>
                  Laporan ini telah memiliki catatan temuan kelainan. Anda dapat memperbarui detailnya di bawah ini atau menandai unit telah normal kembali setelah penanganan.
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
                <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Dokumentasikan kondisi kendala, kerusakan, atau kejanggalan unit pada laporan ini agar tercatat resmi di arsip dan hasil ekspor.
                </span>
              </div>
            )}

            {/* Field: Nama Unit / Equipment */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama Unit / Peralatan <span className="text-slate-400 font-normal lowercase">(otomatis / dapat disesuaikan)</span>
              </label>
              <input
                type="text"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="Contoh: PAC LT.2 COMPRESSOR 1, CHILLER 02, TRAFO 1"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium text-slate-800 transition"
              />
            </div>

            {/* Field: Deskripsi Kelainan / Kondisi Abnormal (Wajib) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Deskripsi Temuan / Kerusakan Abnormal <span className="text-rose-600 font-black">*</span></span>
                <span className="text-[10px] text-slate-400 font-normal lowercase">Wajib diisi</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan secara detail kejanggalan parameter, bunyi bising, kebocoran oli/freon, getaran abnormal, indikator alarm, atau kendala fisik peralatan..."
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium text-slate-800 transition placeholder:text-slate-400"
              />
            </div>

            {/* Field: Rekomendasi / Tindakan Lanjutan (Opsional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Rekomendasi / Tindakan Lanjutan <span className="text-slate-400 font-normal lowercase">(opsional)</span>
              </label>
              <textarea
                rows={2}
                value={actionRecommendation}
                onChange={(e) => setActionRecommendation(e.target.value)}
                placeholder="Contoh: Perlu penggantian contactor & overcurrent relay, flushing strainer, atau monitoring berkala selama 24 jam..."
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium text-slate-800 transition placeholder:text-slate-400"
              />
            </div>

            {/* Field: Upload Foto Bukti Temuan (Opsional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Foto Bukti Temuan Abnormal <span className="text-emerald-600 font-bold lowercase">(opsional)</span>
                </label>
                {photoBase64 && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus Foto
                  </button>
                )}
              </div>

              {photoBase64 ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-rose-300 bg-slate-900/5 group">
                  <img
                    src={photoBase64}
                    alt="Bukti Temuan Abnormal"
                    className="w-full max-h-56 object-contain mx-auto bg-slate-950/80"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-bold shadow-md hover:bg-slate-100 cursor-pointer flex items-center gap-1"
                    >
                      <Camera className="w-3.5 h-3.5" /> Ganti Foto
                    </button>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-rose-700 cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </div>
                  <div className="p-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold truncate max-w-xs">{photoFileName || 'Foto Bukti Terlampir'}</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Siap Disimpan
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                    dragActive
                      ? 'border-rose-500 bg-rose-50/50 scale-[0.99]'
                      : 'border-slate-300 hover:border-rose-400 bg-slate-50/70 hover:bg-rose-50/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="p-3 rounded-2xl bg-rose-100 text-rose-600 shadow-2xs">
                      {isCompressing ? (
                        <Loader2 className="w-6 h-6 animate-spin text-rose-600" />
                      ) : (
                        <Camera className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800">
                        {isCompressing ? 'Sedang memproses gambar...' : 'Klik untuk Ambil / Upload Foto Bukti'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        Kamera HP langsung atau pilih galeri berkas (JPG, PNG, WebP) — <i>Opsional</i>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Box Konfirmasi Hapus Abnormal (Jika diminta) */}
            {showConfirmClear && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-3"
              >
                <div className="flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Konfirmasi Pengembalian ke Normal</span>
                    Apakah Anda yakin ingin menghapus catatan abnormal ini? Status dokumen akan kembali menjadi Normal.
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowConfirmClear(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-amber-100/60 rounded-xl transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isClearing}
                    onClick={handleClearAbnormal}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isClearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Ya, Tandai Normal</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="px-5 py-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div>
              {docItem.hasAbnormal && !showConfirmClear && (
                <button
                  type="button"
                  onClick={() => setShowConfirmClear(true)}
                  className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition border border-slate-200 hover:border-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tandai Kembali Normal</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isClearing}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSaving || isClearing || isCompressing}
                onClick={handleSaveAbnormal}
                className="w-full sm:w-auto px-5 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Temuan Abnormal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
