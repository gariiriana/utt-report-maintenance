// ============================================================================
// FILE: HSETbmForm.tsx
// Deskripsi: Formulir Input Data Presensi & Dokumentasi Toolbox Meeting (TBM)
//            Digunakan oleh HSE Officer untuk mencatat waktu TBM, jumlah personel,
//            dan mengunggah foto kegiatan TBM (multiple photos).
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  Camera,
  Upload,
  Trash2,
  Save,
  Download,
  RotateCcw,
  Plus,
  Minus,
  AlertCircle,
  Eye,
  X,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { collection, addDoc, updateDoc, doc, getDoc, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { compressImage } from '@/utils/imageCompression';
import { CameraModal } from '@/components/CameraModal';
import { exportHSETbmPDF } from '@/utils/HSETbmPdfExport';
import { HSETbmRecord, HSETbmPhoto } from '@/types/hseTbmInductionTypes';

interface HSETbmFormProps {
  editingData?: any | null;
  onClearEdit?: () => void;
  onSuccess?: () => void;
}

export function HSETbmForm({ editingData, onClearEdit, onSuccess }: HSETbmFormProps) {
  const { user } = useAuth();

  // Helper waktu hari ini & jam sekarang
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // State Form Input
  const [date, setDate] = useState(getTodayDate());
  const [time, setTime] = useState(getCurrentTime());
  const [totalSDM, setTotalSDM] = useState<number>(1);
  const [lokasi, setLokasi] = useState('Data Center NeutraDC Cikarang');
  const [keterangan, setKeterangan] = useState('');
  const [photos, setPhotos] = useState<HSETbmPhoto[]>([]);

  // State UI
  const [isSaving, setIsSaving] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load editingData jika ada
  useEffect(() => {
    if (editingData && (editingData.hseType === 'tbm' || editingData.documentType === 'hse')) {
      const loadData = async () => {
        const toastId = toast.loading('Memuat data Laporan TBM...');
        try {
          const docSnap = await getDoc(doc(db, 'hse', editingData.id));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setDate(data.date || getTodayDate());
            setTime(data.time || getCurrentTime());
            setTotalSDM(data.totalSDM || 1);
            setLokasi(data.lokasi || 'Data Center NeutraDC Cikarang');
            setKeterangan(data.keterangan || '');

            // Ambil foto dari subcollection
            const photosSnap = await getDocs(collection(db, `hse/${editingData.id}/photos`));
            if (!photosSnap.empty) {
              const loadedPhotos: HSETbmPhoto[] = photosSnap.docs.map(d => ({
                id: d.id,
                base64: d.data().dataUrl || d.data().base64,
                description: d.data().description || '',
              }));
              setPhotos(loadedPhotos);
            } else if (Array.isArray(data.photos) && data.photos.length > 0) {
              setPhotos(data.photos);
            }
          }
          toast.dismiss(toastId);
        } catch (err) {
          console.error('Error load TBM edit data:', err);
          toast.error('Gagal memuat data TBM', { id: toastId });
        }
      };
      loadData();
    }
  }, [editingData]);

  // Handle Upload File Multiple Foto
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const toastId = toast.loading(`Memproses 0/${files.length} foto TBM...`);
    const newPhotos: HSETbmPhoto[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        toast.loading(`Memproses ${i + 1}/${files.length} foto...`, { id: toastId });

        try {
          const base64 = await compressImage(file, { maxWidth: 800, quality: 0.7 });
          newPhotos.push({
            id: `${Date.now()}-${Math.random()}`,
            base64,
            description: '',
            timestamp: new Date().toLocaleTimeString('id-ID'),
          });
        } catch (compErr) {
          console.warn('Kompresi gagal, fallback membaca file mentah:', compErr);
          const readerResult = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(file);
          });
          newPhotos.push({
            id: `${Date.now()}-${Math.random()}`,
            base64: readerResult,
            description: '',
            timestamp: new Date().toLocaleTimeString('id-ID'),
          });
        }
      }

      if (newPhotos.length > 0) {
        setPhotos(prev => [...prev, ...newPhotos]);
        toast.success(`${newPhotos.length} foto TBM berhasil ditambahkan!`, { id: toastId });
      } else {
        toast.error('Tidak ada foto valid yang dipilih', { id: toastId });
      }
    } catch (err) {
      console.error('Upload foto error:', err);
      toast.error('Gagal memproses foto TBM', { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Capture Foto dari CameraModal (GPS & Watermark)
  const handleCameraCapture = (base64: string) => {
    setPhotos(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        base64,
        description: '',
        timestamp: new Date().toLocaleTimeString('id-ID'),
      },
    ]);
    setCameraModalOpen(false);
    toast.success('Foto dari kamera berhasil ditambahkan!');
  };

  // Hapus Foto
  const handleRemovePhoto = (idToRemove?: string) => {
    setPhotos(prev => prev.filter(p => p.id !== idToRemove));
    toast.info('Foto berhasil dihapus');
  };

  // Reset Form
  const handleReset = () => {
    setDate(getTodayDate());
    setTime(getCurrentTime());
    setTotalSDM(1);
    setLokasi('Data Center NeutraDC Cikarang');
    setKeterangan('');
    setPhotos([]);
    if (onClearEdit) onClearEdit();
    toast.info('Formulir berhasil direset');
  };

  // Build Object Record
  const buildRecord = (): HSETbmRecord => ({
    date,
    time,
    totalSDM: Number(totalSDM) || 1,
    lokasi,
    keterangan: keterangan.trim() || 'Toolbox Meeting (TBM) & Safety Briefing Harian',
    inspectorK3: user?.displayName || user?.email || 'HSE Officer',
    authorEmail: (user?.email || '').toLowerCase(),
    reportType: 'utt',
    hseType: 'tbm',
    photos,
  });

  // Simpan ke Firestore
  const handleSave = async () => {
    if (!date) {
      toast.error('Tanggal TBM wajib diisi');
      return;
    }
    if (!time) {
      toast.error('Waktu TBM wajib diisi');
      return;
    }
    if (totalSDM < 1) {
      toast.error('Total SDM minimal 1 orang');
      return;
    }
    if (photos.length === 0) {
      toast.warning('Disarankan melampirkan minimal 1 foto dokumentasi TBM');
    }

    setIsSaving(true);
    const toastId = toast.loading(editingData ? 'Memperbarui data TBM...' : 'Menyimpan laporan TBM...');

    try {
      const record = buildRecord();
      const docData: any = {
        date: record.date,
        time: record.time,
        totalSDM: record.totalSDM,
        lokasi: record.lokasi,
        keterangan: record.keterangan,
        aktivitas: `Toolbox Meeting (${record.totalSDM} Personel)`,
        inspectorK3: record.inspectorK3,
        authorEmail: record.authorEmail,
        reportType: 'utt',
        hseType: 'tbm',
        maintenanceType: 'TBM',
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

      // Simpan foto ke subcollection
      if (photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          const p = photos[i];
          await addDoc(collection(db, `hse/${finalDocId}/photos`), {
            dataUrl: p.base64,
            description: p.description || '',
            index: i,
            createdAt: serverTimestamp(),
          });
        }
      }

      toast.success('Data Absen TBM berhasil disimpan ke Arsip Dokumen HSE!', { id: toastId });

      if (onSuccess) {
        onSuccess();
      } else if (onClearEdit) {
        onClearEdit();
      }
    } catch (error) {
      console.error('Error saving TBM data:', error);
      toast.error('Terjadi kesalahan saat menyimpan data TBM', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // Unduh PDF Langsung
  const handleDownloadPDF = async () => {
    const record = buildRecord();
    await exportHSETbmPDF(record, { companyVariant: 'neutradc' });
  };

  return (
    <div className="space-y-6">
      {/* Modal Preview Zoom Foto */}
      <AnimatePresence>
        {previewPhoto && (
          <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setPreviewPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="absolute top-4 right-4 p-2 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full transition shadow-lg z-10"
                title="Tutup Preview"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={previewPhoto}
                alt="Preview Dokumentasi TBM"
                className="max-h-[80vh] w-auto mx-auto object-contain rounded-xl"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Kamera Smart GPS */}
      {cameraModalOpen && (
        <CameraModal
          title="Ambil Foto Dokumentasi TBM"
          description="Arahkan kamera ke barisan tim / teknisi yang mengikuti Toolbox Meeting"
          maintenanceName="Toolbox Meeting (TBM)"
          specificDetail={`SDM: ${totalSDM} Orang`}
          onCapture={handleCameraCapture}
          onClose={() => setCameraModalOpen(false)}
        />
      )}

      {/* Header Form & Mode Edit Alert */}
      {editingData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Mode Perubahan / Edit Laporan TBM</p>
              <p className="text-xs text-amber-700">Anda sedang mengedit berkas laporan TBM yang sudah tersimpan di arsip.</p>
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

      {/* Card 1: Informasi Waktu & Jumlah SDM */}
      <div className="bg-white/95 backdrop-blur-xl border border-sky-100 rounded-3xl p-5 sm:p-7 shadow-xl shadow-sky-900/5 text-slate-800 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Waktu & Kehadiran Personel TBM</h3>
              <p className="text-xs text-slate-500">Isi waktu pelaksanaan dan total personel yang hadir dalam Toolbox Meeting</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold uppercase tracking-wider">
            Langkah 1
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tanggal */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tanggal Pelaksanaan <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-semibold transition bg-slate-50/50"
            />
          </div>

          {/* Waktu / Jam */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Waktu / Jam (WIB) <span className="text-rose-500">*</span>
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-semibold transition bg-slate-50/50"
            />
          </div>

          {/* Total SDM */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Total SDM Ikut TBM <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTotalSDM(prev => Math.max(1, prev - 1))}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition font-bold"
                title="Kurangi SDM"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="1"
                  value={totalSDM}
                  onChange={(e) => setTotalSDM(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-bold text-center transition bg-slate-50/50"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                  Orang
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTotalSDM(prev => prev + 1)}
                className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl border border-blue-200 transition font-bold"
                title="Tambah SDM"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Info Lokasi & Topik Pembahasan */}
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Lokasi TBM
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={lokasi}
                onChange={(e) => setLokasi(e.target.value)}
                placeholder="Contoh: Data Center NeutraDC Cikarang"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium transition bg-slate-50/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Topik / Catatan Arahan TBM (Opsional)
            </label>
            <textarea
              rows={2}
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Contoh: Arahan pemakaian APD wajib saat bekerja di ruang ME, kepatuhan LOTO, dan kewaspadaan bahaya listrik tegangan tinggi."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium transition bg-slate-50/50"
            />
          </div>
        </div>
      </div>

      {/* Card 2: Upload Multiple Foto Dokumentasi TBM */}
      <div className="bg-white/95 backdrop-blur-xl border border-sky-100 rounded-3xl p-5 sm:p-7 shadow-xl shadow-sky-900/5 text-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Dokumentasi Foto TBM ({photos.length} Foto)
              </h3>
              <p className="text-xs text-slate-500">Unggah satu atau beberapa foto dokumentasi kegiatan Toolbox Meeting</p>
            </div>
          </div>

          {/* Action Buttons: Kamera & Upload File */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              multiple
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition cursor-pointer shadow-2xs"
            >
              <Upload className="w-4 h-4 text-slate-600" />
              <span>Pilih File</span>
            </button>
            <button
              type="button"
              onClick={() => setCameraModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <Camera className="w-4 h-4" />
              <span>Buka Kamera</span>
            </button>
          </div>
        </div>

        {/* Grid Preview Foto */}
        {photos.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-emerald-50/30 transition cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3 shadow-2xs group-hover:scale-110 transition-transform">
              <Camera className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </div>
            <p className="text-sm font-bold text-slate-700">Belum ada foto TBM yang diunggah</p>
            <p className="text-xs text-slate-400 mt-1">Klik di sini untuk memilih foto dari galeri, atau gunakan tombol Buka Kamera</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {photos.map((p, idx) => (
              <motion.div
                key={p.id || idx}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-2xs hover:shadow-md transition flex flex-col"
              >
                <div className="relative aspect-4/3 w-full bg-slate-900/5 overflow-hidden">
                  <img
                    src={p.base64}
                    alt={`Foto TBM ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Badge Nomor */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-slate-900/70 text-white rounded-md text-[10px] font-bold backdrop-blur-xs">
                    #{idx + 1}
                  </span>
                  {/* Action overlay */}
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewPhoto(p.base64)}
                      className="p-2 bg-white/90 hover:bg-white text-slate-800 rounded-xl transition shadow-md"
                      title="Perbesar Foto"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(p.id)}
                      className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition shadow-md"
                      title="Hapus Foto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Input Keterangan Foto */}
                <div className="p-2 bg-white flex-1 border-t border-slate-100">
                  <input
                    type="text"
                    value={p.description || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPhotos(prev => prev.map((item, i) => i === idx ? { ...item, description: val } : item));
                    }}
                    placeholder={`Ket. foto #${idx + 1}...`}
                    className="w-full text-xs px-2 py-1 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:border-blue-400 font-medium transition"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl text-xs font-bold border border-blue-200 transition cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : editingData ? 'Perbarui Laporan TBM' : 'Simpan Laporan TBM'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
