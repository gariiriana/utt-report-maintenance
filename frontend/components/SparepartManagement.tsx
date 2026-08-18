// ============================================================================
// FILE: frontend/components/SparepartManagement.tsx
// Deskripsi: Modul Manajemen & Pencatatan Pergantian Sparepart / Material.
//            Menyediakan 2 Halaman Terpisah dengan UX Mobile & Desktop Optimal:
//            - Halaman 1: Form Input / Edit Penggantian Sparepart
//            - Halaman 2: Daftar, Statistik, Filter, Mobile Cards & Table Log Sparepart
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wrench,
  Plus,
  Search,
  Download,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Camera,
  X,
  Loader2,
  Package,
  Filter,
  FolderOpen,
  RotateCcw,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from './AuthContext';
import { SparepartLogItem, SparepartActionStatus } from '@/types/sparepartTypes';
import { BOQ_CATEGORIES_DATA } from '@/data/boqAssetData';
import { compressImage } from '@/utils/imageCompression';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const SYSTEM_CATEGORIES = [
  'Chiller',
  'Cooling Tower',
  'Transformer',
  'Generator & Fuel system',
  'LV Panel',
  'PDU Panel',
  'FSS',
  'Pre-Action System',
  'Lightning Protection System',
  'VRV',
  'AC Splits',
  'Cooling Tower Water Treatment',
  'Lift Units',
  'X-Ray',
  'Water Softener',
  'Other'
];

interface SparepartManagementProps {
  initialTab?: 'form' | 'list';
}

export function SparepartManagement({ initialTab = 'list' }: SparepartManagementProps) {
  const { user } = useAuth();

  // State Sub-Page Navigasi ('form' atau 'list')
  const [activeTab, setActiveTab] = useState<'form' | 'list'>(initialTab);

  // State List Sparepart Logs dari Firestore
  const [logs, setLogs] = useState<SparepartLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // State Filter & Search di Halaman List
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // format: 'YYYY-MM' atau 'all'
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // State Form Input / Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Field State
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formEquipment, setFormEquipment] = useState('');
  const [formCategory, setFormCategory] = useState('Chiller');
  const [formLocation, setFormLocation] = useState('');
  const [formPartName, setFormPartName] = useState('');
  const [formPartNumber, setFormPartNumber] = useState('');
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formUnit, setFormUnit] = useState('Pcs');
  const [formStatus, setFormStatus] = useState<SparepartActionStatus>('Replaced');
  const [formTechnician, setFormTechnician] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPhotoBefore, setFormPhotoBefore] = useState<string>('');
  const [formPhotoAfter, setFormPhotoAfter] = useState<string>('');

  // State Preview Foto
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Mengambil daftar sparepart dari katalog BOQ untuk Autocomplete
  const sparepartCatalog = useMemo(() => {
    const list: { partName: string; partNumber: string; category: string }[] = [];
    BOQ_CATEGORIES_DATA.filter(c => c.isSparepart).forEach(cat => {
      cat.items.forEach(item => {
        const pName = item['Part Name'] || item['Description'] || item['Item Description'] || Object.values(item)[2] || '';
        const pNum = item['Part Number'] || item['Model / P/N'] || item['Specification'] || Object.values(item)[3] || '';
        if (pName) {
          list.push({
            partName: String(pName).trim(),
            partNumber: String(pNum).trim(),
            category: cat.name
          });
        }
      });
    });
    return list;
  }, []);

  // Mengambil daftar Equipment dari BOQ Assets untuk Autocomplete
  const equipmentCatalog = useMemo(() => {
    const setEq = new Set<string>();
    BOQ_CATEGORIES_DATA.filter(c => !c.isSparepart).forEach(cat => {
      cat.items.forEach(item => {
        const eqName = item['CI Name*'] || item['Class Name'] || item['Equipment Name'] || item['Tag Number'] || Object.values(item)[1] || '';
        if (eqName && String(eqName).length > 2) {
          setEq.add(String(eqName).trim());
        }
      });
    });
    return Array.from(setEq);
  }, []);

  // Fetch Firestore realtime
  useEffect(() => {
    const q = query(collection(db, 'sparepart_logs'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: SparepartLogItem[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as SparepartLogItem[];
      setLogs(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching sparepart logs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Reset form
  const resetForm = () => {
    setEditingId(null);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormEquipment('');
    setFormCategory('Chiller');
    setFormLocation('');
    setFormPartName('');
    setFormPartNumber('');
    setFormQuantity(1);
    setFormUnit('Pcs');
    setFormStatus('Replaced');
    setFormTechnician(user?.displayName || user?.email?.split('@')[0] || 'Standby Engineer');
    setFormNotes('');
    setFormPhotoBefore('');
    setFormPhotoAfter('');
  };

  // Open Edit Mode -> Switch to Form Tab
  const handleOpenEdit = (item: SparepartLogItem) => {
    setEditingId(item.id || null);
    setFormDate(item.date || new Date().toISOString().split('T')[0]);
    setFormEquipment(item.equipmentName || '');
    setFormCategory(item.systemCategory || 'Chiller');
    setFormLocation(item.location || '');
    setFormPartName(item.partName || '');
    setFormPartNumber(item.partNumber || '');
    setFormQuantity(item.quantity || 1);
    setFormUnit(item.unit || 'Pcs');
    setFormStatus(item.status || 'Replaced');
    setFormTechnician(item.technicianName || '');
    setFormNotes(item.notes || '');
    setFormPhotoBefore(item.photoBefore || '');
    setFormPhotoAfter(item.photoAfter || '');
    setActiveTab('form');
  };

  // Submit Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEquipment.trim() || !formPartName.trim()) {
      toast.error('Nama Perangkat dan Nama Sparepart wajib diisi!');
      return;
    }

    setSaving(true);
    try {
      const monthYear = formDate.substring(0, 7); // YYYY-MM

      const payload: Omit<SparepartLogItem, 'id'> = {
        date: formDate,
        monthYear,
        equipmentName: formEquipment.trim(),
        systemCategory: formCategory,
        location: formLocation.trim(),
        partName: formPartName.trim(),
        partNumber: formPartNumber.trim(),
        quantity: Number(formQuantity) || 1,
        unit: formUnit.trim() || 'Pcs',
        status: formStatus,
        technicianName: formTechnician.trim() || 'Standby Engineer',
        notes: formNotes.trim(),
        photoBefore: formPhotoBefore || '',
        photoAfter: formStatus === 'Pending Replacement' ? '' : (formPhotoAfter || ''),
        createdBy: user?.uid || 'anonymous',
        createdByEmail: (user?.email || '').toLowerCase(),
        createdAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'sparepart_logs', editingId), payload);
        toast.success('Log Sparepart berhasil diperbarui!');
      } else {
        await addDoc(collection(db, 'sparepart_logs'), payload);
        toast.success('Log Sparepart baru berhasil disimpan!');
      }

      resetForm();
      setActiveTab('list');
    } catch (err: any) {
      console.error('Error saving sparepart:', err);
      toast.error(`Gagal menyimpan data: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete Handler
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus log pergantian part: "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'sparepart_logs', id));
      toast.success('Log Sparepart berhasil dihapus');
    } catch (err: any) {
      toast.error(`Gagal menghapus: ${err.message}`);
    }
  };

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.7 });
      if (type === 'before') {
        setFormPhotoBefore(compressed);
      } else {
        setFormPhotoAfter(compressed);
      }
      toast.success(`Foto ${type === 'before' ? (formStatus === 'Pending Replacement' ? 'Kerusakan' : 'Before') : 'After'} berhasil dimuat`);
    } catch (err) {
      toast.error('Gagal memproses foto');
    }
  };

  // Filtered List
  const filteredLogs = useMemo(() => {
    return logs.filter(item => {
      const matchSearch =
        searchQuery.trim() === '' ||
        [item.equipmentName, item.partName, item.partNumber, item.technicianName, item.notes, item.systemCategory]
          .some(val => val && String(val).toLowerCase().includes(searchQuery.toLowerCase().trim()));

      const matchMonth = selectedMonth === 'all' || item.monthYear === selectedMonth;
      const matchCat = selectedCategory === 'all' || item.systemCategory === selectedCategory;
      const matchStatus = selectedStatus === 'all' || item.status === selectedStatus;

      return matchSearch && matchMonth && matchCat && matchStatus;
    });
  }, [logs, searchQuery, selectedMonth, selectedCategory, selectedStatus]);

  // Available Month options in data
  const availableMonths = useMemo(() => {
    const setM = new Set<string>();
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      setM.add(ym);
    }
    logs.forEach(l => {
      if (l.monthYear) setM.add(l.monthYear);
    });
    return Array.from(setM).sort().reverse();
  }, [logs]);

  // Statistik Ringkas
  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const replaced = filteredLogs.filter(l => l.status === 'Replaced').length;
    const serviced = filteredLogs.filter(l => l.status === 'Serviced').length;
    const pending = filteredLogs.filter(l => l.status === 'Pending Replacement').length;
    return { total, replaced, serviced, pending };
  }, [filteredLogs]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      toast.warning('Tidak ada data untuk diekspor');
      return;
    }

    const exportRows = filteredLogs.map((item, index) => ({
      'No': index + 1,
      'Tanggal': item.date,
      'Bulan/Tahun': item.monthYear,
      'Sistem / Kategori': item.systemCategory,
      'Equipment / Perangkat': item.equipmentName,
      'Lokasi': item.location || '-',
      'Nama Sparepart': item.partName,
      'Part Number / Spesifikasi': item.partNumber || '-',
      'Quantity': item.quantity,
      'Satuan': item.unit,
      'Status': item.status,
      'Teknisi PIC': item.technicianName,
      'Keterangan': item.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Log Sparepart');
    XLSX.writeFile(wb, `Log_Pergantian_Sparepart_DME_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('File Excel berhasil diunduh');
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* ─── Top Header & Sub-Tab Switcher (Mobile Touch-Optimized) ─────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 sm:pb-5 gap-3.5 sm:gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] sm:text-[11px] font-bold mb-1.5 sm:mb-2">
            <Package className="w-3.5 h-3.5 text-indigo-600" />
            <span>Standby Engineer Material & Sparepart</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            {activeTab === 'form' ? 'Form Input Pergantian Part' : 'Riwayat & Log Sparepart'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 max-w-2xl">
            {activeTab === 'form'
              ? 'Catat pergantian suku cadang atau perbaikan. Terhubung ke Bab 8 Monthly Report.'
              : 'Daftar rekapitulasi suku cadang yang diganti, diservis, atau butuh pengadaan.'}
          </p>
        </div>

        {/* Sub-Tab Switcher Pills (Full Width on Mobile) */}
        <div className="w-full sm:w-auto flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => {
              if (activeTab !== 'form') {
                resetForm();
              }
              setActiveTab('form');
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'form'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Form Input Part</span>
          </button>

          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Riwayat ({logs.length})</span>
          </button>
        </div>
      </div>

      {/* ─── PAGE 1: FORM INPUT SPARTPART ────────────────────────────────────── */}
      {activeTab === 'form' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 sm:pb-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {editingId ? 'Edit Data Log Sparepart' : 'Input Pergantian / Pemakaian Part Baru'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Lengkapi parameter berikut untuk mencatat pemakaian material teknis
                  </p>
                </div>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 p-1 rounded-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Batal Edit</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Tanggal Eksekusi *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Kategori Sistem */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Kategori Sistem *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    {SYSTEM_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                {/* Target Perangkat (Autocomplete list) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Perangkat / Unit *</label>
                  <input
                    type="text"
                    list="equipment-list"
                    required
                    placeholder="e.g. Chiller 1, 1F-DG-A, TRAFO 1"
                    value={formEquipment}
                    onChange={(e) => setFormEquipment(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <datalist id="equipment-list">
                    {equipmentCatalog.slice(0, 100).map((eq, i) => (
                      <option key={i} value={eq} />
                    ))}
                  </datalist>
                </div>

                {/* Lokasi Ruangan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Lokasi Ruangan / Lantai</label>
                  <input
                    type="text"
                    placeholder="e.g. PH Chiller Room, Crac Room 1"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Nama Sparepart & Part Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Sparepart / Material *</label>
                  <input
                    type="text"
                    list="sparepart-list"
                    required
                    placeholder="e.g. Fan belt, Check Valve, Baterai VESDA"
                    value={formPartName}
                    onChange={(e) => {
                      setFormPartName(e.target.value);
                      const match = sparepartCatalog.find(s => s.partName.toLowerCase() === e.target.value.toLowerCase());
                      if (match && match.partNumber) {
                        setFormPartNumber(match.partNumber);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <datalist id="sparepart-list">
                    {sparepartCatalog.map((sp, i) => (
                      <option key={i} value={sp.partName}>{sp.partNumber ? `(${sp.partNumber})` : ''}</option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Part Number / Spesifikasi</label>
                  <input
                    type="text"
                    placeholder="e.g. 17 x 4000 b 158, DN 350 PN16/25"
                    value={formPartNumber}
                    onChange={(e) => setFormPartNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quantity, Unit & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Quantity (Jumlah) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Satuan</label>
                  <input
                    type="text"
                    placeholder="e.g. Pcs, Unit, Set, Liter"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Status Tindakan *</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as SparepartActionStatus)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Replaced">Replaced (Diganti)</option>
                    <option value="Serviced">Serviced (Diservis)</option>
                    <option value="Pending Replacement">Pending (Butuh Pengadaan)</option>
                  </select>
                </div>
              </div>

              {/* Teknisi PIC & Catatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Teknisi PIC / Pelaksana</label>
                  <input
                    type="text"
                    placeholder="Nama Standby Engineer"
                    value={formTechnician}
                    onChange={(e) => setFormTechnician(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Keterangan / Detail Tindakan</label>
                  <input
                    type="text"
                    placeholder="e.g. Penggantian karena aus, re-tightness bolt"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Upload Foto (Kondisional: 1 Foto Kerusakan jika Pending, 2 Foto Before & After jika Replaced/Serviced) */}
              {formStatus === 'Pending Replacement' ? (
                <div className="pt-1 sm:pt-2">
                  <div className="border-2 border-dashed border-amber-300 rounded-2xl p-4 sm:p-5 bg-amber-50/50 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <label className="block text-xs font-bold text-amber-900">
                        Foto Barang / Komponen yang Rusak *
                      </label>
                    </div>
                    <p className="text-[11px] text-amber-700/80 mb-3 max-w-md mx-auto">
                      Unggah foto fisik bagian yang rusak/anomali sebagai lampiran permohonan pengadaan suku cadang
                    </p>

                    {formPhotoBefore ? (
                      <div className="relative inline-block">
                        <img
                          src={formPhotoBefore}
                          alt="Barang Rusak"
                          className="w-36 h-36 object-cover rounded-xl border border-amber-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setFormPhotoBefore('')}
                          className="absolute -top-2 -right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow cursor-pointer transition-colors"
                          title="Hapus foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 border border-amber-200 rounded-xl bg-white hover:bg-amber-100/40 cursor-pointer transition-all max-w-md mx-auto">
                        <Camera className="w-6 h-6 text-amber-600 mb-1.5" />
                        <span className="text-xs text-amber-900 font-bold">Unggah Foto Kerusakan Barang</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Format JPG / PNG (Maks 10MB)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, 'before')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 pt-1 sm:pt-2">
                  <div className="border border-dashed border-slate-300 rounded-2xl p-4 bg-slate-50 text-center">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Foto Part Lama (Before)</label>
                    {formPhotoBefore ? (
                      <div className="relative inline-block">
                        <img
                          src={formPhotoBefore}
                          alt="Before"
                          className="w-28 h-28 object-cover rounded-xl border border-slate-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setFormPhotoBefore('')}
                          className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-28 border border-slate-200 rounded-xl bg-white hover:bg-blue-50/50 cursor-pointer transition-all">
                        <Camera className="w-6 h-6 text-slate-400 mb-1.5" />
                        <span className="text-xs text-slate-600 font-semibold">Unggah Foto Before</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Format JPG / PNG</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, 'before')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  <div className="border border-dashed border-slate-300 rounded-2xl p-4 bg-slate-50 text-center">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Foto Part Baru / Terpasang (After)</label>
                    {formPhotoAfter ? (
                      <div className="relative inline-block">
                        <img
                          src={formPhotoAfter}
                          alt="After"
                          className="w-28 h-28 object-cover rounded-xl border border-slate-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setFormPhotoAfter('')}
                          className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-28 border border-slate-200 rounded-xl bg-white hover:bg-emerald-50/50 cursor-pointer transition-all">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-1.5" />
                        <span className="text-xs text-emerald-700 font-semibold">Unggah Foto After</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Format JPG / PNG</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, 'after')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Form Action Buttons (Mobile-Optimized Full-Width Stack) */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3 pt-4 sm:pt-5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveTab('list');
                  }}
                  className="w-full sm:w-auto px-5 py-3 sm:py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer text-center"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingId ? 'Simpan Perubahan' : 'Simpan Log Sparepart'}</span>
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {/* ─── PAGE 2: RIWAYAT & DAFTAR LOG SPARTPART ──────────────────────────── */}
      {activeTab === 'list' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-4 sm:space-y-6"
        >
          {/* Quick Stats Cards (Mobile 2x2, Desktop 4x1) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block uppercase">Total Log</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block">{stats.total}</span>
              </div>
              <div className="p-2 sm:p-2.5 bg-slate-100 rounded-xl text-slate-600">
                <Package className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 block uppercase">Replaced</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5 block">{stats.replaced}</span>
              </div>
              <div className="p-2 sm:p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold text-blue-600 block uppercase">Serviced</span>
                <span className="text-xl sm:text-2xl font-black text-blue-600 mt-0.5 block">{stats.serviced}</span>
              </div>
              <div className="p-2 sm:p-2.5 bg-blue-50 rounded-xl text-blue-600 border border-blue-100">
                <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-600 block uppercase">Pending Part</span>
                <span className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5 block">{stats.pending}</span>
              </div>
              <div className="p-2 sm:p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar (Responsive Stack) */}
          <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari perangkat, sparepart, part number, teknisi..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Dropdown Filters Grid on Mobile */}
              <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-2.5">
                {/* Filter Periode Bulan */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 sm:py-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full py-2 bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Semua Periode</option>
                    {availableMonths.map(ym => {
                      const [y, m] = ym.split('-');
                      const mName = MONTH_NAMES[parseInt(m, 10) - 1] || m;
                      return (
                        <option key={ym} value={ym}>
                          {mName} {y}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Filter Status */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 sm:py-0">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full py-2 bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Semua Status</option>
                    <option value="Replaced">Replaced (Diganti)</option>
                    <option value="Serviced">Serviced (Diservis)</option>
                    <option value="Pending Replacement">Pending (Butuh Part)</option>
                  </select>
                </div>
              </div>

              {/* Filter Kategori Sistem (Full width on mobile) */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 sm:py-0 min-w-[180px]">
                <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full py-2 bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">Semua Sistem (15 Scope)</option>
                  {SYSTEM_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Ekspor Excel */}
              <button
                onClick={handleExportExcel}
                className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          {/* ─── DATA VIEW: MOBILE CARDS (< 768px) & DESKTOP TABLE (>= 768px) ─── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-10 sm:p-12 text-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
                <p className="text-xs font-bold">Memuat Log Sparepart...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-slate-400 space-y-3">
                <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-slate-300 stroke-[1.5]" />
                <div>
                  <p className="text-sm font-bold text-slate-600">Belum ada data log sparepart untuk filter ini</p>
                  <p className="text-xs text-slate-400 mt-1">Klik tombol &ldquo;Form Input Part&rdquo; untuk mencatat pemakaian suku cadang baru.</p>
                </div>
                <button
                  onClick={() => {
                    resetForm();
                    setActiveTab('form');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Input Part Sekarang</span>
                </button>
              </div>
            ) : (
              <>
                {/* ═══ 1. MOBILE CARD VIEW (< md) ════════════════════════════ */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {filteredLogs.map((item, idx) => (
                    <div key={item.id || idx} className="p-4 space-y-3 hover:bg-slate-50/70 transition-colors">
                      {/* Card Header: Equipment Name + Category + Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold text-[10px] border border-slate-200 mb-1">
                            {item.systemCategory}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {item.equipmentName}
                          </h4>
                          {item.location && (
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{item.location}</span>
                            </p>
                          )}
                        </div>

                        {/* Status Badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                          item.status === 'Replaced'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.status === 'Serviced'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.status === 'Replaced' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {item.status === 'Serviced' && <Wrench className="w-3 h-3 text-blue-600" />}
                          {item.status === 'Pending Replacement' && <Clock className="w-3 h-3 text-amber-600" />}
                          <span>{item.status === 'Pending Replacement' ? 'Pending' : item.status}</span>
                        </span>
                      </div>

                      {/* Card Body: Sparepart Info */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-indigo-900">{item.partName}</span>
                          <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                            {item.quantity} {item.unit}
                          </span>
                        </div>
                        {item.partNumber && (
                          <div className="text-[11px] font-mono text-slate-500 truncate">
                            P/N: {item.partNumber}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-[11px] text-slate-600 italic pt-0.5 line-clamp-2">
                            &ldquo;{item.notes}&rdquo;
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Metadata & Actions */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-600">{item.date}</span>
                          <span>•</span>
                          <span className="truncate max-w-[120px]">{item.technicianName}</span>
                        </div>

                        {/* Action buttons + photo thumbnails */}
                        <div className="flex items-center gap-1.5">
                          {item.photoBefore && (
                            <button
                              onClick={() => setPreviewPhotoUrl(item.photoBefore!)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200"
                              title="Foto Before"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {item.photoAfter && (
                            <button
                              onClick={() => setPreviewPhotoUrl(item.photoAfter!)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg border border-emerald-200"
                              title="Foto After"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id!, item.partName)}
                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ═══ 2. DESKTOP TABLE VIEW (>= md) ═════════════════════════ */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-3 px-4 w-12 text-center">No</th>
                        <th className="py-3 px-4">Tanggal</th>
                        <th className="py-3 px-4">Sistem / Kategori</th>
                        <th className="py-3 px-4">Target Perangkat</th>
                        <th className="py-3 px-4">Nama Sparepart</th>
                        <th className="py-3 px-4">Part Number / Spesifikasi</th>
                        <th className="py-3 px-4 text-center">Qty</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">Teknisi PIC</th>
                        <th className="py-3 px-4 text-center">Foto</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredLogs.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-semibold">{item.date}</td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full font-bold text-[11px] whitespace-nowrap border border-slate-200">
                              {item.systemCategory}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {item.equipmentName}
                            {item.location && <span className="block text-[10px] font-normal text-slate-400">{item.location}</span>}
                          </td>
                          <td className="py-3 px-4 font-bold text-indigo-900">{item.partName}</td>
                          <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{item.partNumber || '-'}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'Replaced'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.status === 'Serviced'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {item.status === 'Replaced' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                              {item.status === 'Serviced' && <Wrench className="w-3 h-3 text-blue-600" />}
                              {item.status === 'Pending Replacement' && <Clock className="w-3 h-3 text-amber-600" />}
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{item.technicianName}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.photoBefore && (
                                <button
                                  onClick={() => setPreviewPhotoUrl(item.photoBefore!)}
                                  className="p-1 hover:bg-slate-100 rounded border border-slate-200 text-slate-500 hover:text-blue-600 cursor-pointer"
                                  title={item.status === 'Pending Replacement' ? 'Lihat Foto Kerusakan' : 'Lihat Foto Before'}
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {item.photoAfter && (
                                <button
                                  onClick={() => setPreviewPhotoUrl(item.photoAfter!)}
                                  className="p-1 hover:bg-emerald-50 rounded border border-emerald-200 text-emerald-600 cursor-pointer"
                                  title="Lihat Foto After"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {!item.photoBefore && !item.photoAfter && <span className="text-slate-300">-</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id!, item.partName)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── Preview Foto Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {previewPhotoUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <div className="relative max-w-xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-4">
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="absolute top-4 right-4 p-2 bg-slate-900/70 text-white rounded-full hover:bg-slate-900 transition-colors z-10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <img src={previewPhotoUrl} alt="Preview" className="w-full h-auto max-h-[70vh] object-contain rounded-xl" />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
