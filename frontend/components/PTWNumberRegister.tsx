// ============================================================================
// FILE: PTWNumberRegister.tsx
// Deskripsi: Register Nomor PTW (khusus admin). Pencatatan nomor PTW berbentuk
//            teks saja (tanpa dokumen PDF), terpisah dari data `ptw_records`.
//            Data disimpan di koleksi `ptw_numbers` dengan ID "{tahun}-{nomor}".
//            Input: form manual (Equipment, Quarter, Nomor PTW) atau import teks massal.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, writeBatch, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Search, Trash2, Loader2, ClipboardPaste, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { useAuth } from './AuthContext';
import { PTWTextImportModal } from './PTWTextImportModal';
import {
  PTWNumberEntry, buildPTWNumberEntry, splitFullPTWNumber
} from '@/utils/ptwTextImport';

const BATCH_LIMIT = 100;

interface PTWNumberDoc extends Omit<PTWNumberEntry, 'key'> {
  id: string;
  createdBy: string;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const quarterOfDate = (date: string) => String(Math.ceil(parseInt(date.split('-')[1], 10) / 3) || 1);

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
const formatDate = (date: string) => {
  const [y, m, d] = date.split('-');
  return y && m && d ? `${parseInt(d, 10)} ${MONTH_SHORT[parseInt(m, 10) - 1]} ${y}` : '-';
};

const quarterLabel = (r: { quarter: string; year: number }) => `Q${r.quarter} ${r.year}`;

const inputClass = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const filterClass = 'px-3 py-2 bg-white border border-sky-100 rounded-xl text-xs font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer';

export function PTWNumberRegister() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PTWNumberDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSlowLoad, setIsSlowLoad] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    sequenceNumber: '',
    equipment: '',
    quarter: quarterOfDate(todayStr()),
    date: todayStr(),
    ptwType: 'PM' as 'CM' | 'PM'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('ALL');
  const [quarterFilter, setQuarterFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PM' | 'CM'>('ALL');

  useEffect(() => {
    if (!user) return;
    // Saat kuota Firestore habis (HTTP 429) SDK terus retry tanpa memanggil callback error,
    // jadi beri petunjuk ke admin bila server tak kunjung merespons.
    const slowTimer = setTimeout(() => setIsSlowLoad(true), 10000);
    const unsubscribe = onSnapshot(collection(db, 'ptw_numbers'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PTWNumberDoc[];
      data.sort((a, b) => b.year - a.year || b.sequenceNumber - a.sequenceNumber);
      setEntries(data);
      setLoadError(null);
      setLoading(false);
      clearTimeout(slowTimer);
    }, (error) => {
      clearTimeout(slowTimer);
      setLoading(false);
      if (error.code === 'permission-denied') {
        setLoadError('Akses ditolak. Pastikan rules Firestore terbaru (koleksi ptw_numbers) sudah di-deploy dan akun ini admin.');
      } else if (error.code === 'resource-exhausted') {
        setLoadError('Kuota harian Firestore habis (HTTP 429). Data bisa dimuat lagi setelah kuota di-reset.');
      } else {
        console.error('Error loading PTW numbers:', error);
        setLoadError('Gagal memuat register nomor PTW.');
      }
    });
    return () => {
      clearTimeout(slowTimer);
      unsubscribe();
    };
  }, [user]);

  const existingKeys = useMemo(() => new Set(entries.map(e => e.id)), [entries]);
  const equipmentOptions = useMemo(() => [...new Set(entries.map(e => e.equipmentCode))].sort(), [entries]);
  const quarterOptions = useMemo(() => {
    const seen = new Map<string, { quarter: string; year: number }>();
    entries.forEach(e => seen.set(quarterLabel(e), { quarter: e.quarter, year: e.year }));
    return [...seen.entries()]
      .sort(([, a], [, b]) => b.year - a.year || parseInt(b.quarter) - parseInt(a.quarter))
      .map(([label]) => label);
  }, [entries]);
  const nextSequence = useMemo(() => {
    const year = parseInt(form.date.slice(0, 4), 10);
    const max = Math.max(0, ...entries.filter(e => e.year === year).map(e => e.sequenceNumber));
    return max + 1;
  }, [entries, form.date]);

  const filteredEntries = entries.filter(e => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term
      || e.ptwNumber.toLowerCase().includes(term)
      || e.equipmentCode.toLowerCase().includes(term)
      || String(e.sequenceNumber).padStart(4, '0').includes(term);
    return matchesSearch
      && (equipmentFilter === 'ALL' || e.equipmentCode === equipmentFilter)
      && (quarterFilter === 'ALL' || quarterLabel(e) === quarterFilter)
      && (typeFilter === 'ALL' || e.ptwType === typeFilter);
  });
  const hasActiveFilter = searchTerm || equipmentFilter !== 'ALL' || quarterFilter !== 'ALL' || typeFilter !== 'ALL';

  const saveEntries = async (toSave: PTWNumberEntry[]): Promise<boolean> => {
    if (!user) return false;
    try {
      for (let i = 0; i < toSave.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        toSave.slice(i, i + BATCH_LIMIT).forEach(({ key, ...data }) => {
          batch.set(doc(db, 'ptw_numbers', key), {
            ...data,
            createdBy: user.email,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      }
      toast.success(`Berhasil mencatat ${toSave.length} nomor PTW`);
      return true;
    } catch (error) {
      console.error('Error saving PTW numbers:', error);
      toast.error('Gagal menyimpan nomor PTW');
      return false;
    }
  };

  const handleNumberInput = (value: string) => {
    // Paste nomor lengkap "TDE/PTW/0824/Lift/04/2026/10" -> isi otomatis field lain
    const full = splitFullPTWNumber(value);
    if (full) {
      setForm(prev => ({
        ...prev,
        sequenceNumber: String(full.sequenceNumber).padStart(4, '0'),
        equipment: full.equipment,
        quarter: full.quarter,
        ptwType: full.ptwType
      }));
      return;
    }
    setForm(prev => ({ ...prev, sequenceNumber: value.replace(/\D/g, '').slice(0, 5) }));
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const seq = parseInt(form.sequenceNumber, 10);
    if (!seq || !form.equipment.trim() || !form.quarter || !form.date) {
      toast.error('Lengkapi Nomor PTW, Equipment, Quarter, dan Tanggal');
      return;
    }
    const entry = buildPTWNumberEntry({ ...form, sequenceNumber: seq });
    if (existingKeys.has(entry.key)) {
      toast.error(`Nomor PTW ${String(seq).padStart(4, '0')} tahun ${entry.year} sudah tercatat`);
      return;
    }
    setSaving(true);
    const ok = await saveEntries([entry]);
    setSaving(false);
    if (ok) {
      setForm(prev => ({ ...prev, sequenceNumber: '', equipment: '' }));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ptw_numbers', id));
      toast.success('Nomor PTW dihapus');
    } catch (error) {
      console.error('Error deleting PTW number:', error);
      toast.error('Gagal menghapus nomor PTW');
    } finally {
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form input manual */}
      <form
        onSubmit={handleManualSubmit}
        className="bg-white/90 backdrop-blur-xl rounded-2xl p-5 border border-sky-100/90 shadow-md text-slate-800"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Catat Nomor PTW</h2>
            <p className="text-xs text-slate-500 font-medium">
              Register nomor PTW berbentuk teks, terpisah dari dokumen di Daftar PTW.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-blue-700 rounded-xl font-bold text-sm shadow-sm border border-blue-200 cursor-pointer"
          >
            <ClipboardPaste className="w-4 h-4" />
            Import Teks (Massal)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <label className="lg:col-span-2 text-xs font-bold text-slate-600">
            Nomor PTW
            <input
              value={form.sequenceNumber}
              onChange={(e) => handleNumberInput(e.target.value)}
              placeholder={`${String(nextSequence).padStart(4, '0')} atau paste nomor lengkap`}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Equipment
            <input
              value={form.equipment}
              onChange={(e) => setForm(prev => ({ ...prev, equipment: e.target.value }))}
              list="ptw-equipment-options"
              placeholder="Lift, VRV, FSS..."
              className={`mt-1 ${inputClass}`}
            />
            <datalist id="ptw-equipment-options">
              {equipmentOptions.map(eq => <option key={eq} value={eq} />)}
            </datalist>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Quarter
            <select
              value={form.quarter}
              onChange={(e) => setForm(prev => ({ ...prev, quarter: e.target.value }))}
              className={`mt-1 ${inputClass} cursor-pointer`}
            >
              {['1', '2', '3', '4'].map(q => <option key={q} value={q}>Q{q}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Tanggal
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value, quarter: e.target.value ? quarterOfDate(e.target.value) : prev.quarter }))}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Jenis
            <select
              value={form.ptwType}
              onChange={(e) => setForm(prev => ({ ...prev, ptwType: e.target.value as 'CM' | 'PM' }))}
              className={`mt-1 ${inputClass} cursor-pointer`}
            >
              <option value="PM">PM</option>
              <option value="CM">CM</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <p className="text-xs text-slate-500 font-medium">
            {form.sequenceNumber && form.equipment.trim() && form.date
              ? <>Akan tercatat: <span className="font-extrabold text-indigo-900">{buildPTWNumberEntry({ ...form, sequenceNumber: parseInt(form.sequenceNumber, 10) }).ptwNumber}</span></>
              : <>Nomor berikutnya: <span className="font-extrabold text-slate-700">{String(nextSequence).padStart(4, '0')}</span></>}
          </p>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Simpan
          </button>
        </div>
      </form>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nomor PTW..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-sky-100 rounded-xl text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)} className={filterClass} title="Filter Equipment">
          <option value="ALL">Semua Equipment</option>
          {equipmentOptions.map(eq => <option key={eq} value={eq}>{eq}</option>)}
        </select>
        <select value={quarterFilter} onChange={(e) => setQuarterFilter(e.target.value)} className={filterClass} title="Filter Quarter">
          <option value="ALL">Semua Quarter</option>
          {quarterOptions.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'PM' | 'CM')} className={filterClass} title="Filter Jenis">
          <option value="ALL">PM & CM</option>
          <option value="PM">PM</option>
          <option value="CM">CM</option>
        </select>
        {hasActiveFilter && (
          <button
            onClick={() => { setSearchTerm(''); setEquipmentFilter('ALL'); setQuarterFilter('ALL'); setTypeFilter('ALL'); }}
            className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* Tabel */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-sky-100/90 shadow-md overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 text-xs font-bold text-slate-500">
          <Hash className="w-4 h-4 text-blue-600" />
          Menampilkan {filteredEntries.length} dari {entries.length} nomor PTW
        </div>
        {loadError ? (
          <div className="p-12 text-center text-sm font-semibold text-red-600">{loadError}</div>
        ) : loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-slate-500 text-sm font-medium">Memuat data...</p>
            {isSlowLoad && (
              <p className="text-amber-600 text-xs font-semibold mt-3 max-w-md mx-auto">
                Server Firestore belum merespons. Biasanya ini karena kuota harian Firestore habis
                (cek error 429 di console). Kuota di-reset otomatis setiap hari pukul 14.00–15.00 WIB (tengah malam waktu Pasifik).
              </p>
            )}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm font-medium">
            {entries.length === 0 ? 'Belum ada nomor PTW yang dicatat.' : 'Tidak ada nomor PTW yang cocok dengan filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-slate-100/90 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Nomor PTW</th>
                  <th className="px-5 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Equipment</th>
                  <th className="px-5 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Quarter</th>
                  <th className="px-5 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Tanggal</th>
                  <th className="px-5 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Jenis</th>
                  <th className="px-5 py-3 text-center text-xs font-black text-slate-600 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredEntries.map(e => (
                  <tr key={e.id} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-sm font-extrabold text-indigo-900">{e.ptwNumber}</span>
                      {e.notes && <span className="block text-[11px] text-slate-500 font-medium">{e.notes}</span>}
                    </td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-800">{e.equipmentCode}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                        {quarterLabel(e)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 font-medium whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                        e.ptwType === 'CM'
                          ? 'text-amber-800 bg-amber-100 border-amber-300'
                          : 'text-indigo-800 bg-indigo-100 border-indigo-300'
                      }`}>
                        {e.ptwType}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      {pendingDeleteId === e.id ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Hapus
                          </button>
                          <button
                            onClick={() => setPendingDeleteId(null)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPendingDeleteId(e.id)}
                          className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition border border-red-200/80 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PTWTextImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        existingKeys={existingKeys}
        onSubmit={saveEntries}
      />
    </div>
  );
}
