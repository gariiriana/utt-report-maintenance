// ============================================================================
// FILE: BeritaAcaraReport.tsx
// Deskripsi: Modul Berita Acara Maintenance Report untuk akun dwimitra@co.id.
//            Memungkinkan user memilih equipment dari BOQ, memilih CI Names,
//            mengisi form detail, dan generate DOCX Berita Acara Maintenance.
//            Menyimpan arsip berita acara di Firestore collection `berita_acara`.
// ============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileSignature,
  Download,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Calendar, 
  Hash,
  MapPin,
  User,
  Briefcase,
  FileText,
  Trash2,
  Clock,
  Layers,
  Search,
  X,
  CheckCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthContext';
import { BOQ_CATEGORIES_DATA } from '@/data/boqAssetData';
import { generateBeritaAcaraDOCX, BeritaAcaraConfig, BeritaAcaraEquipmentData } from '@/utils/generateBeritaAcaraDOCX';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/api/firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/** Only non-sparepart categories for Berita Acara */
const MAINTENANCE_CATEGORIES = BOQ_CATEGORIES_DATA.filter(cat => !cat.isSparepart);

// ─── Component ────────────────────────────────────────────────────────────────

export function BeritaAcaraReport() {
  const { user, userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  // ─── Form State ──────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [nomorKontrak, setNomorKontrak] = useState('K.TDE.0105/LEG.PRJ/VI/2026');
  const [periodeStart, setPeriodeStart] = useState('');
  const [periodeEnd, setPeriodeEnd] = useState('');
  const [tempat, setTempat] = useState('Cikarang');
  const [tanggalBA, setTanggalBA] = useState('');
  const [signerLeftName, setSignerLeftName] = useState('Rezki Rahman Daulay');
  const [signerLeftTitle, setSignerLeftTitle] = useState('Manager HDC Operation');
  const [signerRightName, setSignerRightName] = useState('Dwi Tasmiyadi');
  const [signerRightTitle, setSignerRightTitle] = useState('Project Manager');

  // ─── Equipment Selection State ───────────────────────────────────
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [selectedCINames, setSelectedCINames] = useState<Map<string, Set<string>>>(new Map());
  const [executionDates, setExecutionDates] = useState<Map<string, string>>(new Map());
  const [equipmentQuarters, setEquipmentQuarters] = useState<Map<string, string>>(new Map());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // ─── Helper for default quarter based on month ───────────────────
  const getDefaultQuarter = useCallback((month: number): string => {
    if (month <= 2) return 'Q1';
    if (month <= 5) return 'Q2';
    if (month <= 8) return 'Q3';
    return 'Q4';
  }, []);

  // ─── Archive State ───────────────────────────────────────────────
  const [archives, setArchives] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // ─── Auto-fill periode dates ─────────────────────────────────────
  useEffect(() => {
    const firstDay = `01-${String(selectedMonth + 1).padStart(2, '0')}-${selectedYear}`;
    const lastDayDate = new Date(selectedYear, selectedMonth + 1, 0);
    const lastDay = `${String(lastDayDate.getDate()).padStart(2, '0')}-${String(selectedMonth + 1).padStart(2, '0')}-${selectedYear}`;
    setPeriodeStart(firstDay);
    setPeriodeEnd(lastDay);

    // Auto-fill tanggal BA to next month 28th
    const nextMonth = selectedMonth + 1 > 11 ? 0 : selectedMonth + 1;
    const nextYear = selectedMonth + 1 > 11 ? selectedYear + 1 : selectedYear;
    setTanggalBA(`28 ${INDO_MONTHS[nextMonth]} ${nextYear}`);
  }, [selectedMonth, selectedYear]);

  // ─── Load Archives from Firestore ────────────────────────────────
  useEffect(() => {
    if (!user?.email) return;
    const q = isAdmin
      ? query(collection(db, 'berita_acara'), orderBy('createdAt', 'desc'))
      : query(
          collection(db, 'berita_acara'),
          where('createdBy', '==', user.email),
          orderBy('createdAt', 'desc')
        );
    const unsub = onSnapshot(q, (snap) => {
      setArchives(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error('Error loading berita_acara archives:', err);
    });
    return () => unsub();
  }, [user?.email, isAdmin]);

  // ─── Filtered Categories (search) ───────────────────────────────
  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return MAINTENANCE_CATEGORIES;
    const q = categorySearchQuery.toLowerCase().trim();
    return MAINTENANCE_CATEGORIES.filter(cat =>
      cat.name.toLowerCase().includes(q)
    );
  }, [categorySearchQuery]);

  // ─── Handlers ────────────────────────────────────────────────────

  const toggleCategory = useCallback((catId: string) => {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
        // Also remove CI Names, execution dates, and quarters for this category
        setSelectedCINames(old => {
          const m = new Map(old);
          m.delete(catId);
          return m;
        });
        setExecutionDates(old => {
          const m = new Map(old);
          m.delete(catId);
          return m;
        });
        setEquipmentQuarters(old => {
          const m = new Map(old);
          m.delete(catId);
          return m;
        });
      } else {
        next.add(catId);
        // Auto-expand
        setExpandedCategories(ex => {
          const s = new Set(ex);
          s.add(catId);
          return s;
        });
      }
      return next;
    });
  }, []);

  const toggleExpand = useCallback((catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  const toggleCIName = useCallback((catId: string, ciName: string) => {
    setSelectedCINames(prev => {
      const m = new Map(prev);
      const current = m.get(catId) || new Set<string>();
      const next = new Set(current);
      if (next.has(ciName)) next.delete(ciName);
      else next.add(ciName);
      m.set(catId, next);
      return m;
    });
  }, []);

  const selectAllCINames = useCallback((catId: string) => {
    const cat = BOQ_CATEGORIES_DATA.find(c => c.id === catId);
    if (!cat) return;
    setSelectedCINames(prev => {
      const m = new Map(prev);
      const all = new Set(cat.items.map(item => item['CI Name*'] || '').filter(Boolean));
      m.set(catId, all);
      return m;
    });
  }, []);

  const deselectAllCINames = useCallback((catId: string) => {
    setSelectedCINames(prev => {
      const m = new Map(prev);
      m.set(catId, new Set());
      return m;
    });
  }, []);

  const setExecutionDate = useCallback((catId: string, date: string) => {
    setExecutionDates(prev => {
      const m = new Map(prev);
      m.set(catId, date);
      return m;
    });
  }, []);

  const setEquipmentQuarter = useCallback((catId: string, quarter: string) => {
    setEquipmentQuarters(prev => {
      const m = new Map(prev);
      m.set(catId, quarter);
      return m;
    });
  }, []);

  // ─── Export Handler ──────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    // Validation
    if (selectedCategoryIds.size === 0) {
      toast.error('Pilih minimal 1 equipment untuk Berita Acara.');
      return;
    }

    let hasItems = false;
    const equipments: BeritaAcaraEquipmentData[] = [];

    for (const catId of selectedCategoryIds) {
      const cat = BOQ_CATEGORIES_DATA.find(c => c.id === catId);
      if (!cat) continue;

      const ciNames = selectedCINames.get(catId);
      if (!ciNames || ciNames.size === 0) {
        toast.error(`Pilih minimal 1 CI Name untuk ${cat.name}.`);
        return;
      }

      const items = cat.items.filter(item => ciNames.has(item['CI Name*'] || ''));
      if (items.length === 0) continue;

      hasItems = true;
      equipments.push({
        categoryName: cat.name,
        executionDate: executionDates.get(catId) || `01 - ${new Date(selectedYear, selectedMonth + 1, 0).getDate()} ${INDO_MONTHS[selectedMonth]}`,
        quarter: equipmentQuarters.get(cat.id) || getDefaultQuarter(selectedMonth),
        items,
      });
    }

    if (!hasItems) {
      toast.error('Tidak ada CI Name yang dipilih.');
      return;
    }

    if (!periodeStart || !periodeEnd) {
      toast.error('Periode tanggal harus diisi.');
      return;
    }

    setIsExporting(true);

    try {
      const config: BeritaAcaraConfig = {
        month: selectedMonth,
        year: selectedYear,
        nomorKontrak,
        periodeStart,
        periodeEnd,
        tempat,
        tanggalBA,
        signerLeftName,
        signerLeftTitle,
        signerRightName,
        signerRightTitle,
        equipments,
      };

      await generateBeritaAcaraDOCX(config);

      // Save to Firestore archive
      const totalCI = equipments.reduce((sum, eq) => sum + eq.items.length, 0);
      const monthName = INDO_MONTHS[selectedMonth];
      const title = `BERITA ACARA MAINTENANCE ${monthName.toUpperCase()} ${selectedYear}`;

      await addDoc(collection(db, 'berita_acara'), {
        title,
        month: selectedMonth,
        year: selectedYear,
        quarter: getDefaultQuarter(selectedMonth),
        nomorKontrak,
        selectedEquipments: equipments.map(e => `${e.categoryName} (${e.quarter || getDefaultQuarter(selectedMonth)})`),
        totalCINames: totalCI,
        createdAt: Timestamp.now(),
        createdBy: user?.email || '',
        fileName: `BERITA ACARA MAINTENANCE ${monthName.toUpperCase()} ${selectedYear}.docx`,
      });

      toast.success('Berita Acara tersimpan di arsip.');
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  }, [selectedCategoryIds, selectedCINames, executionDates, equipmentQuarters, getDefaultQuarter, selectedMonth, selectedYear, nomorKontrak, periodeStart, periodeEnd, tempat, tanggalBA, signerLeftName, signerLeftTitle, signerRightName, signerRightTitle, user?.email]);

  // ─── Delete Archive Handler ──────────────────────────────────────
  const handleDeleteArchive = useCallback(async (archiveId: string) => {
    if (!confirm('Hapus arsip berita acara ini?')) return;
    try {
      await deleteDoc(doc(db, 'berita_acara', archiveId));
      toast.success('Arsip berhasil dihapus.');
    } catch (err) {
      toast.error('Gagal menghapus arsip.');
      console.error(err);
    }
  }, []);

  // ─── Count total selected ────────────────────────────────────────
  const totalSelectedCI = useMemo(() => {
    let count = 0;
    for (const ciSet of selectedCINames.values()) {
      count += ciSet.size;
    }
    return count;
  }, [selectedCINames]);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ═══ PAGE HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg shadow-violet-500/25">
          <FileSignature className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Berita Acara Maintenance</h1>
          <p className="text-xs sm:text-sm text-slate-500">Generate laporan Berita Acara dari data BOQ NeutraDC Cikarang</p>
        </div>
      </motion.div>

      {/* ═══ FORM SECTION ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-lg overflow-hidden"
      >
        {/* Section Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-5 py-3.5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Detail Berita Acara
          </h2>
        </div>

        <div className="p-5 space-y-5">
          {/* Row 1: Month & Year */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Bulan
              </label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white"
              >
                {INDO_MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Tahun
              </label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white"
              >
                {[2024, 2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                <Hash className="w-3.5 h-3.5 inline mr-1" />
                Periode Mulai
              </label>
              <input
                type="text"
                value={periodeStart}
                onChange={e => setPeriodeStart(e.target.value)}
                placeholder="01-03-2026"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                <Hash className="w-3.5 h-3.5 inline mr-1" />
                Periode Selesai
              </label>
              <input
                type="text"
                value={periodeEnd}
                onChange={e => setPeriodeEnd(e.target.value)}
                placeholder="31-03-2026"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
          </div>

          {/* Row 2: Kontrak, Tempat, Tanggal BA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                <Hash className="w-3.5 h-3.5 inline mr-1" />
                Nomor Kontrak
              </label>
              <input
                type="text"
                value={nomorKontrak}
                onChange={e => setNomorKontrak(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                <MapPin className="w-3.5 h-3.5 inline mr-1" />
                Tempat
              </label>
              <input
                type="text"
                value={tempat}
                onChange={e => setTempat(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Tanggal Berita Acara
              </label>
              <input
                type="text"
                value={tanggalBA}
                onChange={e => setTanggalBA(e.target.value)}
                placeholder="28 April 2026"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
          </div>

          {/* Row 3: Signers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pihak Pertama (TDE)</p>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    <User className="w-3 h-3 inline mr-0.5" /> Nama
                  </label>
                  <input
                    type="text"
                    value={signerLeftName}
                    onChange={e => setSignerLeftName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    <Briefcase className="w-3 h-3 inline mr-0.5" /> Jabatan
                  </label>
                  <input
                    type="text"
                    value={signerLeftTitle}
                    onChange={e => setSignerLeftTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  />
                </div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pihak Kedua (DEM)</p>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    <User className="w-3 h-3 inline mr-0.5" /> Nama
                  </label>
                  <input
                    type="text"
                    value={signerRightName}
                    onChange={e => setSignerRightName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    <Briefcase className="w-3 h-3 inline mr-0.5" /> Jabatan
                  </label>
                  <input
                    type="text"
                    value={signerRightTitle}
                    onChange={e => setSignerRightTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ EQUIPMENT SELECTOR ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-lg overflow-hidden"
      >
        <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Pilih Equipment & CI Name dari BOQ
          </h2>
          <span className="text-xs text-cyan-100 font-semibold">
            {selectedCategoryIds.size} equipment · {totalSelectedCI} CI
          </span>
        </div>

        <div className="p-4">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={categorySearchQuery}
              onChange={e => setCategorySearchQuery(e.target.value)}
              placeholder="Cari equipment..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
            {categorySearchQuery && (
              <button
                onClick={() => setCategorySearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Equipment Grid */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredCategories.map(cat => {
              const isSelected = selectedCategoryIds.has(cat.id);
              const isExpanded = expandedCategories.has(cat.id);
              const ciSet = selectedCINames.get(cat.id);
              const selectedCount = ciSet?.size || 0;
              const totalItems = cat.items.length;

              return (
                <div
                  key={cat.id}
                  className={`border rounded-xl overflow-hidden transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-50/50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Category Header */}
                  <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer">
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="flex-shrink-0 transition-colors"
                      title={isSelected ? 'Hapus equipment' : 'Pilih equipment'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-cyan-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (!isSelected) toggleCategory(cat.id);
                        else toggleExpand(cat.id);
                      }}
                      className="flex-1 text-left flex items-center gap-2 min-w-0"
                    >
                      <span className="text-sm font-semibold text-slate-800 truncate">{cat.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">
                        {totalItems} item{totalItems > 1 ? 's' : ''}
                      </span>
                      {isSelected && selectedCount > 0 && (
                        <span className="text-[10px] bg-cyan-600 text-white px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                          {selectedCount} dipilih
                        </span>
                      )}
                    </button>
                    {isSelected && (
                      <button
                        onClick={() => toggleExpand(cat.id)}
                        className="p-1 text-slate-500 hover:text-slate-700 flex-shrink-0"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  {/* CI Name Checklist (expanded) */}
                  <AnimatePresence>
                    {isSelected && isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 pt-1 border-t border-slate-200/80">
                          {/* Execution Date + Quarter Selector + Select All / Deselect All */}
                          <div className="flex flex-wrap items-center gap-2 mb-2.5 p-2 bg-slate-50/90 rounded-xl border border-slate-200">
                            {/* Execution Date Input */}
                            <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                              <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Execution Date:</span>
                              <input
                                type="text"
                                value={executionDates.get(cat.id) || ''}
                                onChange={e => setExecutionDate(cat.id, e.target.value)}
                                placeholder={`cth: 02 - 06 ${INDO_MONTHS[selectedMonth].substring(0, 3)}`}
                                className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white"
                              />
                            </div>

                            {/* Quarter Selector */}
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-xs flex-shrink-0">
                              <span className="text-[11px] font-bold text-slate-600 mr-0.5">Quarter:</span>
                              {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
                                const activeQ = equipmentQuarters.get(cat.id) || getDefaultQuarter(selectedMonth);
                                const isSelectedQ = activeQ === q;
                                return (
                                  <button
                                    key={q}
                                    type="button"
                                    onClick={() => setEquipmentQuarter(cat.id, q)}
                                    className={`px-2 py-0.5 text-xs font-bold rounded transition-all cursor-pointer ${
                                      isSelectedQ
                                        ? 'bg-cyan-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    {q}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Select All / Deselect All */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => selectAllCINames(cat.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-cyan-700 bg-cyan-100 hover:bg-cyan-200 rounded-lg transition-colors cursor-pointer"
                              >
                                <CheckCheck className="w-3 h-3" />
                                Pilih Semua
                              </button>
                              <button
                                type="button"
                                onClick={() => deselectAllCINames(cat.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <XCircle className="w-3 h-3" />
                                Batal Semua
                              </button>
                            </div>
                          </div>

                          {/* CI Name List */}
                          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1 border border-slate-100 rounded-lg p-1.5 bg-white">
                            {cat.items.map((item, idx) => {
                              const ciName = item['CI Name*'] || '';
                              if (!ciName) return null;
                              const isChecked = ciSet?.has(ciName) || false;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => toggleCIName(cat.id, ciName)}
                                  className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                                    isChecked
                                      ? 'bg-cyan-50 text-cyan-800'
                                      : 'hover:bg-slate-50 text-slate-600'
                                  }`}
                                >
                                  {isChecked ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  )}
                                  <span className="truncate">{ciName}</span>
                                  {item['Capacity'] && (
                                    <span className="text-[10px] text-slate-400 flex-shrink-0 ml-auto">
                                      {item['Capacity']}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ═══ EXPORT BUTTON ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-center"
      >
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExport}
          disabled={isExporting || selectedCategoryIds.size === 0 || totalSelectedCI === 0}
          className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl font-bold text-base shadow-xl transition-all cursor-pointer ${
            isExporting || selectedCategoryIds.size === 0 || totalSelectedCI === 0
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-violet-500/30 hover:shadow-violet-500/50'
          }`}
        >
          <Download className="w-5 h-5" />
          {isExporting ? 'Membuat Berita Acara...' : `Export to DOCX (${totalSelectedCI} CI)`}
        </motion.button>
      </motion.div>

      {/* ═══ ARCHIVE SECTION ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-lg overflow-hidden"
      >
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FileSignature className="w-4 h-4" />
            Arsip Dokumen Berita Acara
          </h2>
          <span className="text-xs text-emerald-100 font-semibold">{archives.length} dokumen</span>
        </div>

        <div className="p-4">
          {archives.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <FileSignature className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Belum ada arsip Berita Acara</p>
              <p className="text-xs mt-1">Buat Berita Acara pertama Anda di atas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {archives.map(archive => (
                <div
                  key={archive.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{archive.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-medium flex-wrap">
                      <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{archive.quarter}</span>
                      <span>{archive.selectedEquipments?.join(', ')}</span>
                      <span>·</span>
                      <span>{archive.totalCINames} CI</span>
                      <span>·</span>
                      <span>
                        {archive.createdAt?.toDate
                          ? archive.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteArchive(archive.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                    title="Hapus arsip"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
