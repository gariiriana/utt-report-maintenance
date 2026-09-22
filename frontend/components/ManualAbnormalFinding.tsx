// ============================================================================
// FILE: ManualAbnormalFinding.tsx
// Deskripsi: Input ringkas temuan abnormal manual oleh engineer. Periode dicatat
//            sebagai bulan/tahun, tanpa meminta tanggal kejadian dari pengguna.
// ============================================================================

import { useState } from 'react';
import { AlertTriangle, Building2, CalendarDays, Camera, ClipboardPenLine, ImagePlus, Loader2, Trash2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from './AuthContext';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function ManualAbnormalFinding() {
  const { user } = useAuth();
  const now = new Date();
  const [isSaving, setIsSaving] = useState(false);
  const [photoBase64, setPhotoBase64] = useState('');
  const [form, setForm] = useState({
    maintenanceName: '',
    unitName: '',
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    description: '',
  });

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Lampiran harus berupa foto.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Ukuran maksimal foto 20MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 1200;
        let { width, height } = image;
        if (width > maxSize || height > maxSize) {
          const scale = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
        setPhotoBase64(canvas.toDataURL('image/jpeg', 0.78));
      };
      image.onerror = () => toast.error('Foto tidak dapat dibaca.');
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const maintenanceName = form.maintenanceName.trim();
    const unitName = form.unitName.trim();
    const description = form.description.trim();
    const month = Number(form.month);
    const year = Number(form.year);

    if (!maintenanceName || !unitName || !description || !Number.isInteger(month) || !Number.isInteger(year)) {
      toast.error('Nama maintenance, nama unit, bulan, tahun, dan temuan abnormal wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      // findingDate dibuat sistem pada hari pertama periode hanya untuk kompatibilitas
      // filter/rekap lama; pengguna tidak pernah diminta memasukkan tanggal.
      const periodDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const payload: Record<string, any> = {
        manualAbnormal: true,
        source: 'manual_abnormal',
        maintenanceName,
        partName: unitName,
        unitName,
        findingMonth: month,
        findingYear: year,
        findingDate: periodDate,
        remark: description,
        description,
        photos: photoBase64 ? [{ base64: photoBase64, description: `Bukti temuan ${unitName}` }] : [],
        createdBy: user.uid,
        createdByEmail: (user.email || '').toLowerCase(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (photoBase64) payload.photoBase64 = photoBase64;
      await addDoc(collection(db, 'findings'), payload);

      toast.success('Temuan abnormal manual tersimpan dan masuk ke Pusat Temuan Abnormal.');
      setForm((current) => ({
        ...current,
        maintenanceName: '',
        unitName: '',
        description: '',
      }));
      setPhotoBase64('');
    } catch (error: any) {
      console.error('Error saving manual abnormal finding:', error);
      toast.error(`Gagal menyimpan temuan abnormal: ${error?.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Input Temuan Abnormal Manual</h1>
            <p className="text-sm text-slate-500">Catat kondisi abnormal per periode maintenance. Tidak ada input tanggal.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <label className="block">
              <span className="mb-2 text-sm font-bold text-slate-700 flex items-center gap-2"><Wrench className="w-4 h-4 text-rose-600" />Nama Maintenance <span className="text-rose-600">*</span></span>
              <input required value={form.maintenanceName} onChange={(e) => setForm({ ...form, maintenanceName: e.target.value })} placeholder="Contoh: PM Bulanan UPS" className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm" />
            </label>
            <label className="block">
              <span className="mb-2 text-sm font-bold text-slate-700 flex items-center gap-2"><Building2 className="w-4 h-4 text-rose-600" />Nama Unit <span className="text-rose-600">*</span></span>
              <input required value={form.unitName} onChange={(e) => setForm({ ...form, unitName: e.target.value })} placeholder="Contoh: UPS-01 / CRAC-02" className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <label className="block">
              <span className="mb-2 text-sm font-bold text-slate-700 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-rose-600" />Bulan <span className="text-rose-600">*</span></span>
              <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm">
                {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 text-sm font-bold text-slate-700 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-rose-600" />Tahun <span className="text-rose-600">*</span></span>
              <select value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm">
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2].map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 text-sm font-bold text-slate-700 flex items-center gap-2"><ClipboardPenLine className="w-4 h-4 text-rose-600" />Temuan Abnormal <span className="text-rose-600">*</span></span>
            <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Jelaskan kondisi abnormal, dampak, dan kebutuhan tindak lanjut..." className="w-full min-h-36 px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-sm resize-y" />
          </label>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Camera className="w-4 h-4 text-rose-600" />Foto Bukti <span className="text-xs font-medium text-slate-400">(opsional)</span></span>
                <p className="text-xs text-slate-500 mt-1">Tambahkan satu foto kondisi abnormal bila tersedia.</p>
              </div>
              {photoBase64 && (
                <button type="button" onClick={() => setPhotoBase64('')} className="p-2 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100" title="Hapus foto">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {photoBase64 ? (
              <img src={photoBase64} alt="Preview bukti temuan" className="w-full max-h-72 object-contain bg-white rounded-xl border border-slate-200" />
            ) : (
              <label className="min-h-28 rounded-xl border border-dashed border-slate-300 bg-white hover:border-rose-400 hover:bg-rose-50/40 transition flex flex-col items-center justify-center gap-2 cursor-pointer text-slate-500">
                <ImagePlus className="w-6 h-6 text-rose-500" />
                <span className="text-xs font-semibold">Pilih foto bukti</span>
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </label>
            )}
          </div>
        </div>
        <div className="px-5 sm:px-7 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button disabled={isSaving} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white text-sm font-bold shadow-sm transition disabled:opacity-60 flex items-center gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            {isSaving ? 'Menyimpan...' : 'Simpan Temuan Abnormal'}
          </button>
        </div>
      </form>
    </div>
  );
}
