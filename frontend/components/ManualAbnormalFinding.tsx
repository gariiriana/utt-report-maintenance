// ============================================================================
// FILE: ManualAbnormalFinding.tsx
// Deskripsi: Input ringkas temuan abnormal manual oleh engineer. Periode dicatat
//            sebagai bulan/tahun, tanpa meminta tanggal kejadian dari pengguna.
// ============================================================================

import { useState } from 'react';
import { AlertTriangle, Building2, CalendarDays, ClipboardPenLine, Loader2, Wrench } from 'lucide-react';
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
  const [form, setForm] = useState({
    maintenanceName: '',
    unitName: '',
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    description: '',
  });

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
      await addDoc(collection(db, 'findings'), {
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
        createdBy: user.uid,
        createdByEmail: (user.email || '').toLowerCase(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success('Temuan abnormal manual tersimpan dan masuk ke Pusat Temuan Abnormal.');
      setForm((current) => ({
        ...current,
        maintenanceName: '',
        unitName: '',
        description: '',
      }));
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
