// ============================================================================
// FILE: HSESafetyInductionForm.tsx
// Deskripsi: Formulir Input Data Laporan Safety Induction K3
//            Digunakan oleh HSE Officer untuk mendaftarkan peserta induction,
//            mencatat asal PT/vendor, dan mengunggah 3 berkas foto:
//            1. Foto orang yang sedang di-induction (Wajib)
//            2. Foto surat keterangan sehat (Wajib)
//            3. Foto sertifikat K3 dari TDE (Opsional)
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserCheck,
  Building2,
  Camera,
  Upload,
  Trash2,
  Save,
  Download,
  RotateCcw,
  AlertCircle,
  Eye,
  X,
  FileBadge,
  HeartPulse,
  Award,
  User,
  Plus,
  Copy,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { collection, addDoc, updateDoc, doc, getDoc, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { compressImage } from '@/utils/imageCompression';
import { CameraModal } from '@/components/CameraModal';
import { exportHSESafetyInductionPDF } from '@/utils/HSESafetyInductionPdfExport';
import { HSESafetyInductionRecord, HSESafetyInductionParticipant } from '@/types/hseTbmInductionTypes';

interface HSESafetyInductionFormProps {
  editingData?: any | null;
  onClearEdit?: () => void;
  onSuccess?: () => void;
}

type PhotoSlotType = 'fotoInduction' | 'fotoSuratSehat' | 'fotoSertifikatK3';

export function HSESafetyInductionForm({ editingData, onClearEdit, onSuccess }: HSESafetyInductionFormProps) {
  const { user } = useAuth();

  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // State Peserta Induction (Bisa multi peserta)
  const [pesertaList, setPesertaList] = useState<HSESafetyInductionParticipant[]>([
    { id: '1', nama: '', perusahaan: '', jabatan: '' }
  ]);

  // State Umum Form
  const [date, setDate] = useState(getTodayDate());
  const [time, setTime] = useState(getCurrentTime());
  const [jabatan, setJabatan] = useState('Pekerja / Vendor');
  const [catatan, setCatatan] = useState('');

  // 3 Slot Foto Khusus
  const [fotoInduction, setFotoInduction] = useState<string>('');
  const [fotoSuratSehat, setFotoSuratSehat] = useState<string>('');
  const [fotoSertifikatK3, setFotoSertifikatK3] = useState<string>('');

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [activeCameraSlot, setActiveCameraSlot] = useState<PhotoSlotType | null>(null);
  const [previewModalImg, setPreviewModalImg] = useState<{ url: string; title: string } | null>(null);

  const fileInputInductionRef = useRef<HTMLInputElement>(null);
  const fileInputSuratSehatRef = useRef<HTMLInputElement>(null);
  const fileInputSertifikatRef = useRef<HTMLInputElement>(null);

  // Helper Kelola Peserta
  const handleAddPeserta = () => {
    setPesertaList(prev => [
      ...prev,
      {
        id: String(Date.now()),
        nama: '',
        perusahaan: '',
        jabatan: ''
      }
    ]);
  };

  const handleRemovePeserta = (index: number) => {
    if (pesertaList.length <= 1) return;
    setPesertaList(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePeserta = (index: number, field: keyof HSESafetyInductionParticipant, value: string) => {
    setPesertaList(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCopyCompanyFromFirst = (index: number) => {
    const firstCompany = (pesertaList[0]?.perusahaan || '').trim();
    if (!firstCompany) {
      toast.info('Nama PT / Perusahaan di Peserta No. 1 belum diisi');
      return;
    }
    handleUpdatePeserta(index, 'perusahaan', firstCompany);
    toast.success(`Berhasil menyalin "${firstCompany}" ke Peserta No. ${index + 1}`);
  };

  // Load editingData jika ada
  useEffect(() => {
    if (editingData && (editingData.hseType === 'induction' || editingData.documentType === 'hse')) {
      const loadData = async () => {
        const toastId = toast.loading('Memuat data Safety Induction...');
        try {
          const docSnap = await getDoc(doc(db, 'hse', editingData.id));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.pesertaList && Array.isArray(data.pesertaList) && data.pesertaList.length > 0) {
              setPesertaList(data.pesertaList);
            } else {
              setPesertaList([
                {
                  id: '1',
                  nama: data.nama || '',
                  perusahaan: data.perusahaan || '',
                  jabatan: data.jabatan || ''
                }
              ]);
            }
            setDate(data.date || getTodayDate());
            setTime(data.time || getCurrentTime());
            setJabatan(data.jabatan || 'Pekerja / Vendor');
            setCatatan(data.catatan || '');
            setFotoInduction(data.fotoInduction || '');
            setFotoSuratSehat(data.fotoSuratSehat || '');
            setFotoSertifikatK3(data.fotoSertifikatK3 || '');

            // Cek subcollection photos jika di root kosong
            if (!data.fotoInduction || !data.fotoSuratSehat) {
              const photosSnap = await getDocs(collection(db, `hse/${editingData.id}/photos`));
              photosSnap.docs.forEach(pDoc => {
                const p = pDoc.data();
                if (p.label === 'fotoInduction' && !data.fotoInduction) setFotoInduction(p.dataUrl || p.base64);
                if (p.label === 'fotoSuratSehat' && !data.fotoSuratSehat) setFotoSuratSehat(p.dataUrl || p.base64);
                if (p.label === 'fotoSertifikatK3' && !data.fotoSertifikatK3) setFotoSertifikatK3(p.dataUrl || p.base64);
              });
            }
          }
          toast.dismiss(toastId);
        } catch (err) {
          console.error('Error load Safety Induction edit data:', err);
          toast.error('Gagal memuat data Safety Induction', { id: toastId });
        }
      };
      loadData();
    }
  }, [editingData]);

  // Handle Single Photo Upload dari Input File
  const handleSingleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: PhotoSlotType
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('Mengompresi dan memproses foto...');
    try {
      const base64 = await compressImage(file, { maxWidth: 800, quality: 0.7 });
      if (slot === 'fotoInduction') setFotoInduction(base64);
      else if (slot === 'fotoSuratSehat') setFotoSuratSehat(base64);
      else if (slot === 'fotoSertifikatK3') setFotoSertifikatK3(base64);
      toast.success('Foto berhasil diunggah!', { id: toastId });
    } catch (err) {
      console.warn('Kompresi gagal, membaca file langsung:', err);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (slot === 'fotoInduction') setFotoInduction(result);
        else if (slot === 'fotoSuratSehat') setFotoSuratSehat(result);
        else if (slot === 'fotoSertifikatK3') setFotoSertifikatK3(result);
        toast.success('Foto berhasil dimuat!', { id: toastId });
      };
      reader.onerror = () => toast.error('Gagal membaca file foto', { id: toastId });
      reader.readAsDataURL(file);
    } finally {
      e.target.value = '';
    }
  };

  // Handle Capture dari CameraModal
  const handleCameraCapture = (base64: string) => {
    if (activeCameraSlot === 'fotoInduction') setFotoInduction(base64);
    else if (activeCameraSlot === 'fotoSuratSehat') setFotoSuratSehat(base64);
    else if (activeCameraSlot === 'fotoSertifikatK3') setFotoSertifikatK3(base64);
    setActiveCameraSlot(null);
    toast.success('Foto dari kamera berhasil diambil!');
  };

  // Reset Form
  const handleReset = () => {
    setPesertaList([{ id: '1', nama: '', perusahaan: '', jabatan: '' }]);
    setDate(getTodayDate());
    setTime(getCurrentTime());
    setJabatan('Pekerja / Vendor');
    setCatatan('');
    setFotoInduction('');
    setFotoSuratSehat('');
    setFotoSertifikatK3('');
    if (onClearEdit) onClearEdit();
    toast.info('Formulir berhasil direset');
  };

  // Build Record Object
  const buildRecord = (): HSESafetyInductionRecord => {
    const cleanPeserta = pesertaList.map((p, idx) => ({
      id: p.id || String(idx + 1),
      nama: (p.nama || '').trim(),
      perusahaan: (p.perusahaan || '').trim(),
      jabatan: (p.jabatan || '').trim() || jabatan.trim() || 'Pekerja / Vendor',
    }));

    const allNames = cleanPeserta.map(p => p.nama).filter(Boolean).join(', ');
    const uniqueCompanies = Array.from(new Set(cleanPeserta.map(p => p.perusahaan).filter(Boolean))).join(', ');

    return {
      nama: allNames,
      perusahaan: uniqueCompanies,
      pesertaList: cleanPeserta,
      date,
      time,
      jabatan: jabatan.trim() || 'Pekerja / Vendor',
      fotoInduction,
      fotoSuratSehat,
      fotoSertifikatK3: fotoSertifikatK3 || undefined,
      catatan: catatan.trim() || 'Peserta telah mengikuti pengarahan Safety Induction K3 & memahami regulasi Data Center NeutraDC.',
      inspectorK3: user?.displayName || user?.email || 'HSE Officer',
      authorEmail: (user?.email || '').toLowerCase(),
      reportType: 'utt',
      hseType: 'induction',
    };
  };

  // Simpan ke Firestore
  const handleSave = async () => {
    // Validasi Setiap Peserta
    for (let i = 0; i < pesertaList.length; i++) {
      const p = pesertaList[i];
      if (!p.nama.trim()) {
        toast.error(`Nama orang untuk Peserta No. ${i + 1} wajib diisi!`);
        return;
      }
      if (!p.perusahaan.trim()) {
        toast.error(`Asal perusahaan / PT untuk Peserta No. ${i + 1} wajib diisi!`);
        return;
      }
    }

    if (!fotoInduction) {
      toast.error('Foto orang yang sedang di-induction wajib dilampirkan!');
      return;
    }
    if (!fotoSuratSehat) {
      toast.error('Foto surat keterangan sehat wajib dilampirkan!');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(editingData ? 'Memperbarui data Safety Induction...' : 'Menyimpan laporan Safety Induction...');

    try {
      const record = buildRecord();
      const docData: any = {
        nama: record.nama,
        perusahaan: record.perusahaan,
        pesertaList: record.pesertaList,
        date: record.date,
        time: record.time,
        jabatan: record.jabatan,
        catatan: record.catatan,
        fotoInduction: record.fotoInduction,
        fotoSuratSehat: record.fotoSuratSehat,
        fotoSertifikatK3: record.fotoSertifikatK3 || '',
        aktivitas: `Safety Induction - ${record.nama} (${record.perusahaan})`,
        inspectorK3: record.inspectorK3,
        authorEmail: record.authorEmail,
        reportType: 'utt',
        hseType: 'induction',
        maintenanceType: 'INDUCTION',
        updatedAt: serverTimestamp(),
      };

      let finalDocId = '';

      if (editingData && editingData.id) {
        finalDocId = editingData.id;
        await updateDoc(doc(db, 'hse', finalDocId), docData);

        // Hapus foto lama di subcollection
        try {
          const oldPhotos = await getDocs(collection(db, `hse/${finalDocId}/photos`));
          for (const p of oldPhotos.docs) {
            await deleteDoc(doc(db, `hse/${finalDocId}/photos`, p.id)).catch(() => null);
          }
        } catch (e) {
          console.warn('Error clearing old photos:', e);
        }
      } else {
        docData.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, 'hse'), docData);
        finalDocId = docRef.id;
      }

      // Simpan 3 foto ke subcollection agar DocumentList & viewer dapat membacanya
      const photosToSave = [
        { label: 'fotoInduction', desc: 'Foto Kegiatan Induction', base64: record.fotoInduction },
        { label: 'fotoSuratSehat', desc: 'Foto Surat Keterangan Sehat', base64: record.fotoSuratSehat },
      ];
      if (record.fotoSertifikatK3) {
        photosToSave.push({ label: 'fotoSertifikatK3', desc: 'Sertifikat K3 dari TDE', base64: record.fotoSertifikatK3 });
      }

      for (let i = 0; i < photosToSave.length; i++) {
        const item = photosToSave[i];
        await addDoc(collection(db, `hse/${finalDocId}/photos`), {
          dataUrl: item.base64,
          label: item.label,
          description: item.desc,
          index: i,
          createdAt: serverTimestamp(),
        });
      }

      toast.success('Laporan Safety Induction berhasil disimpan ke Arsip Dokumen HSE!', { id: toastId });

      if (onSuccess) {
        onSuccess();
      } else if (onClearEdit) {
        onClearEdit();
      }
    } catch (error) {
      console.error('Error saving Safety Induction:', error);
      toast.error('Terjadi kesalahan saat menyimpan data Safety Induction', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // Unduh PDF Langsung
  const handleDownloadPDF = async () => {
    const hasEmptyPeserta = pesertaList.some(p => !p.nama.trim() || !p.perusahaan.trim());
    if (hasEmptyPeserta) {
      toast.warning('Lengkapi nama dan perusahaan untuk semua peserta sebelum mencetak PDF');
      return;
    }
    const record = buildRecord();
    await exportHSESafetyInductionPDF(record, { companyVariant: 'neutradc' });
  };

  const primaryNama = pesertaList.map(p => p.nama.trim()).filter(Boolean).join(', ');
  const primaryPerusahaan = Array.from(new Set(pesertaList.map(p => p.perusahaan.trim()).filter(Boolean))).join(', ');

  return (
    <div className="space-y-6">
      {/* Modal Zoom Preview Foto */}
      <AnimatePresence>
        {previewModalImg && (
          <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setPreviewModalImg(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-3xl max-h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700">{previewModalImg.title}</span>
                <button
                  type="button"
                  onClick={() => setPreviewModalImg(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <img
                src={previewModalImg.url}
                alt={previewModalImg.title}
                className="max-h-[75vh] w-auto mx-auto object-contain rounded-xl mt-2"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Kamera Smart GPS */}
      {activeCameraSlot && (
        <CameraModal
          title={`Ambil ${
            activeCameraSlot === 'fotoInduction'
              ? 'Foto Sedang Di-Induction'
              : activeCameraSlot === 'fotoSuratSehat'
              ? 'Foto Surat Keterangan Sehat'
              : 'Foto Sertifikat K3 dari TDE'
          }`}
          description="Posisikan dokumen atau pekerja di dalam bingkai kamera dengan pencahayaan yang cukup"
          maintenanceName="Safety Induction K3"
          specificDetail={primaryNama ? `${primaryNama} (${primaryPerusahaan})` : 'Peserta Induction'}
          onCapture={handleCameraCapture}
          onClose={() => setActiveCameraSlot(null)}
        />
      )}

      {/* Mode Edit Banner Alert */}
      {editingData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Mode Edit Laporan Safety Induction</p>
              <p className="text-xs text-amber-700">Anda sedang mengubah data berkas safety induction yang sudah tersimpan di arsip.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            Batal Edit
          </button>
        </div>
      )}

      {/* Card 1: Data Identitas Peserta & Perusahaan */}
      <div className="bg-white/95 backdrop-blur-xl border border-sky-100 rounded-3xl p-5 sm:p-7 shadow-xl shadow-sky-900/5 text-slate-800 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">Identitas Peserta Safety Induction</h3>
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-black rounded-full border border-amber-200">
                  {pesertaList.length} Peserta
                </span>
              </div>
              <p className="text-xs text-slate-500">Masukkan nama pekerja dan perusahaan yang mengikuti briefing keselamatan kerja</p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold uppercase tracking-wider">
            Langkah 1
          </span>
        </div>

        {/* Daftar Peserta Interaktif */}
        <div className="space-y-4">
          {pesertaList.map((peserta, index) => (
            <div
              key={peserta.id || index}
              className="relative rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 transition hover:border-amber-300 hover:bg-amber-50/20 shadow-2xs space-y-3.5"
            >
              {/* Header Baris Peserta */}
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-black shadow-xs shadow-amber-500/30">
                    {index + 1}
                  </span>
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Peserta No. {index + 1}
                  </span>
                </div>

                {pesertaList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePeserta(index)}
                    className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition cursor-pointer"
                    title={`Hapus Peserta No. ${index + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                )}
              </div>

              {/* Input Grid: Nama & PT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Nama Peserta */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nama Orang yang Di-Induction <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={peserta.nama}
                      onChange={(e) => handleUpdatePeserta(index, 'nama', e.target.value)}
                      placeholder={`Contoh: Nama Peserta #${index + 1}`}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 text-sm font-semibold transition bg-white"
                    />
                  </div>
                </div>

                {/* Dari PT Mana */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Dari PT Mana / Perusahaan / Vendor <span className="text-rose-500">*</span>
                    </label>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => handleCopyCompanyFromFirst(index)}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-900 border border-sky-200 text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                        title="Salin nama perusahaan dari Peserta No. 1"
                      >
                        <Copy className="w-3 h-3 text-sky-600" />
                        <span>Samakan dengan No. 1</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={peserta.perusahaan}
                      onChange={(e) => handleUpdatePeserta(index, 'perusahaan', e.target.value)}
                      placeholder="Contoh: PT Swadaya Mitra Teknik"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 text-sm font-semibold transition bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Tombol Tambahkan Peserta Baru */}
          <button
            type="button"
            onClick={handleAddPeserta}
            className="w-full py-3 px-4 border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-100/60 text-amber-900 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs group"
          >
            <div className="p-1 bg-amber-200/80 rounded-lg group-hover:scale-110 transition-transform text-amber-800">
              <Plus className="w-4 h-4" />
            </div>
            <span>+ Tambahkan Peserta Baru (Peserta #{pesertaList.length + 1})</span>
          </button>
        </div>

        {/* Detail Pelaksanaan (Tanggal, Waktu, Posisi Lapangan, Catatan) */}
        <div className="pt-4 border-t border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tanggal Pelaksanaan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tanggal Pelaksanaan <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 text-sm font-semibold transition bg-slate-50/50"
              />
            </div>

            {/* Waktu Pelaksanaan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Waktu / Jam (WIB)
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 text-sm font-semibold transition bg-slate-50/50"
              />
            </div>

            {/* Jabatan */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Jabatan / Pekerjaan di Lapangan
              </label>
              <input
                type="text"
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                placeholder="Contoh: Teknisi Elektrikal / Supervisor Vendor"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 text-sm font-medium transition bg-slate-50/50"
              />
            </div>

            {/* Catatan / Remarks */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Catatan K3 / Remarks
              </label>
              <textarea
                rows={2}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Catatan tambahan mengenai kondisi kepatuhan K3 peserta induction..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 text-sm font-medium transition bg-slate-50/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: 3 Area Upload Foto (Kegiatan, Surat Sehat, Sertifikat K3 TDE) */}
      <div className="bg-white/95 backdrop-blur-xl border border-sky-100 rounded-3xl p-5 sm:p-7 shadow-xl shadow-sky-900/5 text-slate-800 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
              <FileBadge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Berkas Foto Verifikasi K3</h3>
              <p className="text-xs text-slate-500">Lampirkan foto saat induction, surat sehat, dan sertifikat K3 dari TDE</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold uppercase tracking-wider">
            Langkah 2
          </span>
        </div>

        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={fileInputInductionRef}
          onChange={(e) => handleSingleFileUpload(e, 'fotoInduction')}
          accept="image/*"
          className="hidden"
        />
        <input
          type="file"
          ref={fileInputSuratSehatRef}
          onChange={(e) => handleSingleFileUpload(e, 'fotoSuratSehat')}
          accept="image/*"
          className="hidden"
        />
        <input
          type="file"
          ref={fileInputSertifikatRef}
          onChange={(e) => handleSingleFileUpload(e, 'fotoSertifikatK3')}
          accept="image/*"
          className="hidden"
        />

        {/* 3 Upload Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* SLOT 1: Foto Orang yang Sedang Di-Induction */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 flex flex-col justify-between space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black text-slate-800">1. Foto Sedang Di-Induction</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                Wajib
              </span>
            </div>

            {fotoInduction ? (
              <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 group">
                <img src={fotoInduction} alt="Foto Induction" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewModalImg({ url: fotoInduction, title: 'Foto Sedang Di-Induction' })}
                    className="p-2 bg-white/90 hover:bg-white text-slate-800 rounded-xl transition shadow"
                    title="Perbesar"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFotoInduction('')}
                    className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition shadow"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputInductionRef.current?.click()}
                className="aspect-4/3 rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-white flex flex-col items-center justify-center p-4 text-center cursor-pointer transition group"
              >
                <Camera className="w-7 h-7 text-slate-400 group-hover:text-emerald-600 mb-2 transition-colors" />
                <p className="text-xs font-bold text-slate-700">Foto Kegiatan Induction</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Wajib dilampirkan</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputInductionRef.current?.click()}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Pilih File</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCameraSlot('fotoInduction')}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs shadow-emerald-600/20"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Kamera</span>
              </button>
            </div>
          </div>

          {/* SLOT 2: Foto Surat Sehat */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 flex flex-col justify-between space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black text-slate-800">2. Foto Surat Sehat</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                Wajib
              </span>
            </div>

            {fotoSuratSehat ? (
              <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 group">
                <img src={fotoSuratSehat} alt="Foto Surat Sehat" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewModalImg({ url: fotoSuratSehat, title: 'Foto Surat Keterangan Sehat' })}
                    className="p-2 bg-white/90 hover:bg-white text-slate-800 rounded-xl transition shadow"
                    title="Perbesar"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFotoSuratSehat('')}
                    className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition shadow"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputSuratSehatRef.current?.click()}
                className="aspect-4/3 rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-white flex flex-col items-center justify-center p-4 text-center cursor-pointer transition group"
              >
                <HeartPulse className="w-7 h-7 text-slate-400 group-hover:text-emerald-600 mb-2 transition-colors" />
                <p className="text-xs font-bold text-slate-700">Foto Surat Sehat</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Surat Keterangan Dokter</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputSuratSehatRef.current?.click()}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Pilih File</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCameraSlot('fotoSuratSehat')}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs shadow-emerald-600/20"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Kamera</span>
              </button>
            </div>
          </div>

          {/* SLOT 3: Sertifikat K3 dari TDE (Opsional) */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 flex flex-col justify-between space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black text-slate-800">3. Sertifikat K3 dari TDE</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                Opsional
              </span>
            </div>

            {fotoSertifikatK3 ? (
              <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 group">
                <img src={fotoSertifikatK3} alt="Sertifikat K3 TDE" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewModalImg({ url: fotoSertifikatK3, title: 'Sertifikat K3 dari TDE' })}
                    className="p-2 bg-white/90 hover:bg-white text-slate-800 rounded-xl transition shadow"
                    title="Perbesar"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFotoSertifikatK3('')}
                    className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition shadow"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputSertifikatRef.current?.click()}
                className="aspect-4/3 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 bg-white flex flex-col items-center justify-center p-4 text-center cursor-pointer transition group"
              >
                <Award className="w-7 h-7 text-slate-400 group-hover:text-blue-600 mb-2 transition-colors" />
                <p className="text-xs font-bold text-slate-700">Sertifikat K3 TDE</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Opsional jika ada</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputSertifikatRef.current?.click()}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Pilih File</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCameraSlot('fotoSertifikatK3')}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs shadow-blue-600/20"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Kamera</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer Bar */}
      <div className="bg-white/95 backdrop-blur-xl border border-sky-100 rounded-3xl p-4 sm:p-5 shadow-xl shadow-sky-900/5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold border border-slate-200 transition cursor-pointer shadow-2xs"
        >
          <RotateCcw className="w-4 h-4 text-slate-500" />
          <span>Reset Form</span>
        </button>

        <div className="w-full sm:w-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-2xl text-xs font-bold border border-amber-200 transition cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer shadow-lg shadow-orange-600/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : editingData ? 'Perbarui Safety Induction' : 'Simpan Safety Induction'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
