// ============================================================================
// FILE: StandbyKPIInput.tsx
// Deskripsi: Form Input Realisasi KPI Monthly Report khusus Role Standby Engineer
//            (Standby Onsite Engineer, Training, Delivery Document, Delivery Sparepart).
// ============================================================================

import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Calendar, 
  Save, 
  FileText, 
  UserCheck, 
  GraduationCap, 
  Package, 
  CheckCircle2, 
  Loader2, 
  RefreshCw 
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';

export interface StandbyKPIItem {
  unit: string;
  order: string | number;
  finish: string | number;
  pctFinish: string;
  comply: string | number;
  pctComply: string;
  notes?: string;
}

export interface MonthlyStandbyKPIDoc {
  month: number;
  year: number;
  monthYear: string;
  standbyEngineer: StandbyKPIItem;
  training: StandbyKPIItem;
  deliveryDocument: StandbyKPIItem;
  deliverySparepart: StandbyKPIItem;
  updatedBy: string;
  updatedAt?: any;
}

const MONTH_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' }
];

export const StandbyKPIInput: React.FC = () => {
  const { user } = useAuth();
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State for the 4 KPI metrics
  const [standbyEngineer, setStandbyEngineer] = useState<StandbyKPIItem>({
    unit: 'Order',
    order: '',
    finish: '',
    pctFinish: '',
    comply: '',
    pctComply: ''
  });

  const [training, setTraining] = useState<StandbyKPIItem>({
    unit: 'Order',
    order: '',
    finish: '',
    pctFinish: '',
    comply: '',
    pctComply: ''
  });

  const [deliveryDocument, setDeliveryDocument] = useState<StandbyKPIItem>({
    unit: 'Order',
    order: '',
    finish: '',
    pctFinish: '',
    comply: '',
    pctComply: ''
  });

  const [deliverySparepart, setDeliverySparepart] = useState<StandbyKPIItem>({
    unit: 'Order',
    order: '',
    finish: '',
    pctFinish: '',
    comply: '',
    pctComply: ''
  });

  const monthStr = String(selectedMonth).padStart(2, '0');
  const docKey = `${selectedYear}-${monthStr}`;

  // Fetch KPI data for the selected month/year
  const fetchKPIData = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'standby_kpi_inputs', docKey);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data() as MonthlyStandbyKPIDoc;
        if (data.standbyEngineer) setStandbyEngineer(data.standbyEngineer);
        if (data.training) setTraining(data.training);
        if (data.deliveryDocument) setDeliveryDocument(data.deliveryDocument);
        if (data.deliverySparepart) setDeliverySparepart(data.deliverySparepart);
        toast.info(`Data KPI ${MONTH_OPTIONS[selectedMonth - 1].label} ${selectedYear} dimuat.`);
      } else {
        // Reset to empty / blank when no data is submitted yet
        setStandbyEngineer({ unit: 'Order', order: '', finish: '', pctFinish: '', comply: '', pctComply: '' });
        setTraining({ unit: 'Order', order: '', finish: '', pctFinish: '', comply: '', pctComply: '' });
        setDeliveryDocument({ unit: 'Order', order: '', finish: '', pctFinish: '', comply: '', pctComply: '' });
        setDeliverySparepart({ unit: 'Order', order: '', finish: '', pctFinish: '', comply: '', pctComply: '' });
      }
    } catch (err: any) {
      console.error('Error loading KPI inputs:', err);
      toast.error('Gagal memuat data KPI bulanan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIData();
  }, [selectedMonth, selectedYear]);

  // Helper to auto calculate % Finish
  const updateMetric = (
    setter: React.Dispatch<React.SetStateAction<StandbyKPIItem>>,
    field: keyof StandbyKPIItem,
    value: string
  ) => {
    setter(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'order' || field === 'finish') {
        const ord = parseFloat(field === 'order' ? value : String(prev.order));
        const fin = parseFloat(field === 'finish' ? value : String(prev.finish));
        if (!isNaN(ord) && ord > 0 && !isNaN(fin)) {
          updated.pctFinish = `${Math.round((fin / ord) * 100)}%`;
        }
      }
      return updated;
    });
  };

  // Quick fill benchmark helper
  const handleAutoFillDefaults = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const standbyOrders = daysInMonth * 3;

    setStandbyEngineer({
      unit: 'Order',
      order: standbyOrders,
      finish: standbyOrders,
      pctFinish: '100%',
      comply: standbyOrders,
      pctComply: '5,00%'
    });

    setTraining({
      unit: 'Order',
      order: 1,
      finish: 1,
      pctFinish: '100%',
      comply: 1,
      pctComply: '5,00%'
    });

    setDeliveryDocument({
      unit: 'Order',
      order: 44,
      finish: 44,
      pctFinish: '100%',
      comply: 44,
      pctComply: '5,00%'
    });

    setDeliverySparepart({
      unit: 'Order',
      order: 0,
      finish: 0,
      pctFinish: '100%',
      comply: 0,
      pctComply: '10,00%'
    });

    toast.success('Rekomendasi nilai standar berhasil diisikan. Silakan sesuaikan dan klik Simpan.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: MonthlyStandbyKPIDoc = {
        month: selectedMonth,
        year: selectedYear,
        monthYear: docKey,
        standbyEngineer,
        training,
        deliveryDocument,
        deliverySparepart,
        updatedBy: user?.email || 'standby_engineer@dwimitra.co.id',
        updatedAt: serverTimestamp()
      };

      const docRef = doc(db, 'standby_kpi_inputs', docKey);
      await setDoc(docRef, payload, { merge: true });

      toast.success(`Data KPI Monthly Report (${MONTH_OPTIONS[selectedMonth - 1].label} ${selectedYear}) berhasil disimpan!`);
    } catch (err: any) {
      console.error('Error saving KPI inputs:', err);
      toast.error(`Gagal menyimpan data KPI: ${err.message || 'Error database'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Award className="w-48 h-48" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/30 border border-blue-400/40 rounded-full text-xs font-semibold text-blue-200">
            <UserCheck className="w-3.5 h-3.5" /> Khusus Standby Engineer
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Input Realisasi KPI Monthly Report
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Lengkapi data pencapaian kuantitatif untuk 4 parameter operasional (Standby Onsite, Training, Delivery Document, Delivery Sparepart) agar otomatis tampil di Tabel 19 Monthly Report resmi.
          </p>
        </div>
      </div>

      {/* Month & Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-bold text-slate-700">Periode Laporan:</span>
          </div>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {MONTH_OPTIONS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>

          <button
            type="button"
            onClick={fetchKPIData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleAutoFillDefaults}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Isi Otomatis Rekomendasi Standar
        </button>
      </div>

      {/* Form Grid */}
      <form onSubmit={handleSave} className="space-y-6">
        {loading ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-500">Memuat data KPI periode terpilih...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CARD 1: Standby Onsite Engineer */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4 hover:border-blue-300 transition-all">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">1. Standby Onsite Engineer</h3>
                  <p className="text-xs text-slate-500">KPI No. 3 — Monitoring Absensi & Kehadiran Shift</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Unit</label>
                  <input
                    type="text"
                    value={standbyEngineer.unit}
                    onChange={(e) => updateMetric(setStandbyEngineer, 'unit', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Order"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Order (Target)</label>
                  <input
                    type="text"
                    value={standbyEngineer.order}
                    onChange={(e) => updateMetric(setStandbyEngineer, 'order', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="93"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Finish (Realisasi)</label>
                  <input
                    type="text"
                    value={standbyEngineer.finish}
                    onChange={(e) => updateMetric(setStandbyEngineer, 'finish', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="93"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">% Finish</label>
                  <input
                    type="text"
                    value={standbyEngineer.pctFinish}
                    onChange={(e) => updateMetric(setStandbyEngineer, 'pctFinish', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="100%"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Comply (Sesuai)</label>
                  <input
                    type="text"
                    value={standbyEngineer.comply}
                    onChange={(e) => updateMetric(setStandbyEngineer, 'comply', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="93"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">% Comply (Bobot)</label>
                  <input
                    type="text"
                    value={standbyEngineer.pctComply}
                    onChange={(e) => updateMetric(setStandbyEngineer, 'pctComply', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="5,00%"
                  />
                </div>
              </div>
            </div>

            {/* CARD 2: Training */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4 hover:border-indigo-300 transition-all">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">2. Training</h3>
                  <p className="text-xs text-slate-500">KPI No. 7 — Pelatihan & Sosialisasi Tim Bulanan</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Unit</label>
                  <input
                    type="text"
                    value={training.unit}
                    onChange={(e) => updateMetric(setTraining, 'unit', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Order"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Order (Target)</label>
                  <input
                    type="text"
                    value={training.order}
                    onChange={(e) => updateMetric(setTraining, 'order', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Finish (Realisasi)</label>
                  <input
                    type="text"
                    value={training.finish}
                    onChange={(e) => updateMetric(setTraining, 'finish', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">% Finish</label>
                  <input
                    type="text"
                    value={training.pctFinish}
                    onChange={(e) => updateMetric(setTraining, 'pctFinish', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="100%"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Comply (Sesuai)</label>
                  <input
                    type="text"
                    value={training.comply}
                    onChange={(e) => updateMetric(setTraining, 'comply', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">% Comply (Bobot)</label>
                  <input
                    type="text"
                    value={training.pctComply}
                    onChange={(e) => updateMetric(setTraining, 'pctComply', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="5,00%"
                  />
                </div>
              </div>
            </div>

            {/* CARD 3: Delivery Document */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4 hover:border-emerald-300 transition-all">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">3. Delivery Document</h3>
                  <p className="text-xs text-slate-500">KPI No. 8 — Penyerahan Dokumen Service Report & BA</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Unit</label>
                  <input
                    type="text"
                    value={deliveryDocument.unit}
                    onChange={(e) => updateMetric(setDeliveryDocument, 'unit', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Order"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Order (Target)</label>
                  <input
                    type="text"
                    value={deliveryDocument.order}
                    onChange={(e) => updateMetric(setDeliveryDocument, 'order', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="44"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Finish (Realisasi)</label>
                  <input
                    type="text"
                    value={deliveryDocument.finish}
                    onChange={(e) => updateMetric(setDeliveryDocument, 'finish', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="44"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">% Finish</label>
                  <input
                    type="text"
                    value={deliveryDocument.pctFinish}
                    onChange={(e) => updateMetric(setDeliveryDocument, 'pctFinish', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="100%"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Comply (Sesuai)</label>
                  <input
                    type="text"
                    value={deliveryDocument.comply}
                    onChange={(e) => updateMetric(setDeliveryDocument, 'comply', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="44"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">% Comply (Bobot)</label>
                  <input
                    type="text"
                    value={deliveryDocument.pctComply}
                    onChange={(e) => updateMetric(setDeliveryDocument, 'pctComply', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="5,00%"
                  />
                </div>
              </div>
            </div>

            {/* CARD 4: Delivery Sparepart */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4 hover:border-violet-300 transition-all">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">4. Delivery Sparepart</h3>
                  <p className="text-xs text-slate-500">KPI No. 9 — Pemenuhan & Penggantian Suku Cadang</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Unit</label>
                  <input
                    type="text"
                    value={deliverySparepart.unit}
                    onChange={(e) => updateMetric(setDeliverySparepart, 'unit', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="Order"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Order (Target)</label>
                  <input
                    type="text"
                    value={deliverySparepart.order}
                    onChange={(e) => updateMetric(setDeliverySparepart, 'order', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Finish (Realisasi)</label>
                  <input
                    type="text"
                    value={deliverySparepart.finish}
                    onChange={(e) => updateMetric(setDeliverySparepart, 'finish', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">% Finish</label>
                  <input
                    type="text"
                    value={deliverySparepart.pctFinish}
                    onChange={(e) => updateMetric(setDeliverySparepart, 'pctFinish', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="100%"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Comply (Sesuai)</label>
                  <input
                    type="text"
                    value={deliverySparepart.comply}
                    onChange={(e) => updateMetric(setDeliverySparepart, 'comply', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">% Comply (Bobot)</label>
                  <input
                    type="text"
                    value={deliverySparepart.pctComply}
                    onChange={(e) => updateMetric(setDeliverySparepart, 'pctComply', e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="10,00%"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="submit"
            disabled={saving || loading}
            className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Menyimpan ke Database...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Simpan Realisasi KPI ({MONTH_OPTIONS[selectedMonth - 1].label} {selectedYear})</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
