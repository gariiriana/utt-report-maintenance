import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Camera,
  X,
  Loader2,
  CheckCircle2,
  Package,
  Hash,
  Tag,
  Layers,
  MessageSquare,
  CalendarDays,
  ImagePlus,
  Scissors,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { ImageEditor } from '@/components/ImageEditor';
import { sendFileNotification } from '@/utils/notificationService';
import { FindingPhoto } from '../types/finding';

export function FindingManagement() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    partName: '',
    partNumber: '',
    brandName: '',
    quantity: '' as string | number,
    findingDate: new Date().toISOString().split('T')[0],
    remark: '',
  });
  const [photos, setPhotos] = useState<FindingPhoto[]>([]);

  const [editingPhotoIdx, setEditingPhotoIdx] = useState<number | null>(null);

  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ukuran maksimal foto 20MB');
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX = 800;
        let w = img.width;
        let h = img.height;
        if (w > h) { if (w > MAX) { h = (h * MAX) / w; w = MAX; } }
        else { if (h > MAX) { w = (w * MAX) / h; h = MAX; } }
        canvas.width = w;
        canvas.height = h;
        ctx?.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        setPhotos((prev) => [...prev, { base64: compressed, description: '' }]);
      };
    };
    e.target.value = '';
  };

  const updatePhotoDescription = (idx: number, desc: string) => {
    setPhotos((prev) => prev.map((p, i) => (i === idx ? { ...p, description: desc } : p)));
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveCrop = (editedBase64: string) => {
    if (editingPhotoIdx !== null) {
      setPhotos((prev) =>
        prev.map((p, i) => (i === editingPhotoIdx ? { ...p, base64: editedBase64 } : p))
      );
      setEditingPhotoIdx(null);
      toast.success('Foto berhasil diperbarui');
    }
  };

  const handleCancelCrop = () => {
    setEditingPhotoIdx(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.partName || !formData.partNumber) {
      toast.error('Nama Part dan Nomor Part wajib diisi');
      return;
    }
    if (photos.length === 0) {
      toast.error('Minimal upload 1 foto');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'findings'), {
        partName: formData.partName,
        partNumber: formData.partNumber,
        brandName: formData.brandName,
        quantity: formData.quantity,
        findingDate: formData.findingDate,
        photos,
        remark: formData.remark,
        createdBy: user.uid,
        createdByEmail: (user.email || '').toLowerCase(),
        createdAt: serverTimestamp(),
      });

      toast.success('Temuan berhasil disimpan!');

      await sendFileNotification({
        title: `Temuan Baru: ${formData.partName}`,
        fileName: formData.partName,
        category: 'Arsip Temuan',
        uploadedBy: user?.email || 'User DME',
        targetTab: 'finding_archive',
        searchQuery: formData.partName
      });
      setFormData({ 
        partName: '', 
        partNumber: '', 
        brandName: '', 
        quantity: '', 
        findingDate: new Date().toISOString().split('T')[0],
        remark: '',
      });
      setPhotos([]);
    } catch (error) {
      console.error('Error creating finding:', error);
      toast.error('Gagal menyimpan temuan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <div className="p-1.5 sm:p-2 bg-amber-50 rounded-lg border border-amber-100">
            <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Input Temuan Maintenance
          </h1>
        </div>
        <p className="text-slate-600 font-medium text-sm sm:text-base ml-0 sm:ml-12 lg:ml-14">
          Dokumentasikan temuan trouble maintenance dengan detail untuk arsip dan pelaporan.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white/90 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-sky-100/90 shadow-2xl overflow-hidden text-slate-800"
      >
        <form onSubmit={handleSubmit} className="p-5 sm:p-10">
          <div className="flex flex-col lg:flex-row gap-12">
            <div className="flex-1 space-y-8">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
                <Package className="w-5 h-5 text-amber-600" />
                <h2 className="text-xl font-black text-slate-900">Informasi Part & Detail</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2 ml-1">
                    <Package className="w-4 h-4 text-slate-400" /> Nama Part <span className="text-amber-600">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.partName}
                    onChange={(e) => setFormData({ ...formData, partName: e.target.value })}
                    placeholder="Contoh: Compressor, Motor Fan, etc."
                    className="w-full px-5 py-4 bg-slate-50/90 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2 ml-1">
                    <Hash className="w-4 h-4 text-slate-400" /> Nomor Part <span className="text-amber-600">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.partNumber}
                    onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                    placeholder="P/N: 12345-ABC-XYZ"
                    className="w-full px-5 py-4 bg-slate-50/90 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2 ml-1">
                    <Tag className="w-4 h-4 text-slate-400" /> Brand / Merk
                  </label>
                  <input
                    type="text"
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                    placeholder="Daikin, Schneider, etc."
                    className="w-full px-5 py-4 bg-slate-50/90 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2 ml-1">
                      <Layers className="w-4 h-4 text-slate-400" /> Quantity
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value === '' ? '' : parseInt(e.target.value) })}
                      className="w-full px-5 py-4 bg-slate-50/90 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium outline-none transition-all"
                      title="Quantity"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2 ml-1">
                      <CalendarDays className="w-4 h-4 text-slate-400" /> Tanggal
                    </label>
                    <input
                      type="date"
                      value={formData.findingDate}
                      onChange={(e) => setFormData({ ...formData, findingDate: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50/90 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium outline-none transition-all"
                      title="Tanggal temuan"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 ml-1">
                  <MessageSquare className="w-4 h-4 text-slate-400" /> Remark / Catatan Temuan
                </label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50/90 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium outline-none h-40 resize-none transition-all"
                  placeholder="Jelaskan detail temuan di sini..."
                />
              </div>
            </div>

            <div className="w-full lg:w-[400px] space-y-8">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
                <Camera className="w-5 h-5 text-amber-600" />
                <h2 className="text-xl font-black text-slate-900">Dokumentasi Foto</h2>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  {photos.map((photo, idx) => (
                    <motion.div 
                      key={idx} 
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group relative rounded-2xl overflow-hidden border border-slate-200 aspect-square bg-slate-100 shadow-sm"
                    >
                      <img
                        src={photo.base64}
                        alt={`Finding photo ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingPhotoIdx(idx)}
                          className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition shadow-lg"
                          title="Crop foto"
                        >
                          <Scissors className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="p-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition shadow-lg"
                          title="Hapus foto"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <input
                          type="text"
                          value={photo.description}
                          onChange={(e) => updatePhotoDescription(idx, e.target.value)}
                          placeholder="Deskripsi..."
                          className="w-full bg-transparent text-white text-xs outline-none placeholder-slate-400"
                        />
                      </div>
                    </motion.div>
                  ))}

                  <div className="relative border-2 border-dashed border-slate-300 rounded-2xl aspect-square flex flex-col items-center justify-center hover:border-amber-500 hover:bg-amber-50 transition-all cursor-pointer group bg-slate-50/80">
                    <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <ImagePlus className="w-6 h-6 text-amber-600" />
                    </div>
                    <span className="text-sm font-bold text-slate-600 group-hover:text-amber-600">Tambah Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAddPhoto}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      title="Tambah foto"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-slate-700 disabled:to-slate-800 text-white rounded-2xl font-bold text-lg shadow-xl shadow-amber-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Sedang Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      Simpan Temuan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </motion.div>

      <AnimatePresence>
        {editingPhotoIdx !== null && (
          <ImageEditor
            image={photos[editingPhotoIdx].base64}
            onSave={handleSaveCrop}
            onCancel={handleCancelCrop}
            description={photos[editingPhotoIdx].description}
            maintenanceName={formData.partName}
            specificDetail={formData.partNumber}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
