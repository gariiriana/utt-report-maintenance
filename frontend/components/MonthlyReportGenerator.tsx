// ============================================================================
// FILE: frontend/components/MonthlyReportGenerator.tsx
// Deskripsi: 1-Click Monthly Report Generator & Interactive Web Editor.
//            Format Dokumen Mengikuti 100% Persis Standar Asli NeutraDC Cikarang:
//            - Cover Page (PREVENTIVE MAINTENANCE REPORT Q1– FEBRUARY / Q3– JULY)
//            - 6-Person Approval Sheet (Arif Budiman + TTD, Dwi Tasmiyadi, OCS, TDE)
//            - Table of Contents & List of Tables
//            - Bab 1 - Bab 13 (Tabel 1 - Tabel 36) dengan Deep Blue Header (#0066B3)
//            - Seluruh sel tabel & narasi inline-editable secara interaktif di web
//            - Fitur Ekspor ke Word (.docx) 100% Presisi & Cetak PDF Resmi
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Printer,
  Calendar,
  Sparkles,
  AlertTriangle,
  Building2,
  Users,
  Award,
  BarChart3,
  BookOpen,
  Loader2,
  Package,
  Cpu,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  X,
  Upload,
  Globe,
  Search,
  Filter,
  Layers,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  XCircle,
  FolderArchive,
  Edit3,
  Save,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { draftStorage } from '@/utils/draftStorage';
import { useAuth } from '@/components/AuthContext';
import { db } from '@/api/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { BOQ_CATEGORIES_DATA } from '@/data/boqAssetData';

import {
  aggregateMonthlyReportData,
  FullMonthlyReportData,
  EquipmentDetailItem,
  convertReportToBilingual,
  getScopeOfWorkForScope,
  MASTER_PM_SCHEDULES,
  getDefaultBoqUnitForDevice,
  buildCustomScopeTablesFromBOQ,
  CustomBOQSelection,
  getTaskPMFromSR,
  getBOQItemIdentifier,
  buildAllDynamicEquipmentTables,
  buildDynamicListOfTables,
  findBOQCategoryForScope,
  extractBOQItemDetails,
  isValidBOQItem
} from '@/utils/monthlyReportData';
import { generateMonthlyReportDOCX } from '@/utils/generateMonthlyReportDOCX';
import {
  generateRecommendationsFromFindings,
  generateTestingAndValidation,
  generateChallengesAndMitigations,
  convertReportToBilingualWithAI
} from '@/utils/monthlyReportAI';
import { ARIF_BUDIMAN_SIGNATURE_BASE64 } from '@/utils/engineerSignatures';
import logoNeutraDC from '@/assets/logo_neutradc.png';

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

/**
 * Official Page Footer for PT Telkom Data Ekosistem with authentic circuit graphics & address
 */
export const TelkomPageFooter: React.FC<{ pageNumber?: number | string }> = ({ pageNumber }) => (
  <div className="border-t border-black/80 pt-3.5 flex items-center justify-between gap-4 font-serif text-[11px] text-slate-500 mt-10 print:mt-6">
    {/* Left: Official Circuit Graphic */}
    <div className="flex items-center gap-3">
      <svg className="w-28 h-9 overflow-visible" viewBox="0 0 110 35" fill="none">
        <path d="M0 32 L22 10 L45 10 L55 20 L75 20 L88 7 L110 7" stroke="#E11D48" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4 35 L24 15 L40 15 L50 25 L70 25 L80 15 L95 15" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 35 L28 19 L52 19 L64 31 L84 31 L94 21 L108 21" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="22" cy="10" r="2.5" fill="#E11D48" />
        <circle cx="55" cy="20" r="2.5" fill="#E11D48" />
        <circle cx="88" cy="7" r="2.5" fill="#E11D48" />
        <circle cx="40" cy="15" r="2.5" fill="#F59E0B" />
        <circle cx="70" cy="25" r="2.5" fill="#F59E0B" />
        <circle cx="28" cy="19" r="2.5" fill="#94A3B8" />
        <circle cx="64" cy="31" r="2.5" fill="#94A3B8" />
      </svg>
      {pageNumber !== undefined && (
        <span className="font-bold text-slate-700 text-xs px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
          {pageNumber}
        </span>
      )}
    </div>

    {/* Right: Official Address Block */}
    <div className="text-right leading-tight text-slate-600">
      <span className="font-bold text-slate-900 block text-xs tracking-tight">PT. Telkom Data Ekosistem</span>
      <span className="text-[10px] block">
        Kawasan The Telkom Hub, Gedung Telkom Landmark Tower II, lantai.39,
      </span>
      <span className="text-[10px] block">
        Jl. Jenderal Gatot Subroto Kav. 52, Kuningan Barat, Mampang Prapatan, Jakarta Selatan,
      </span>
      <span className="text-[10px] block">
        Jakarta, Indonesia 12710, Indonesia.
      </span>
    </div>
  </div>
);

/**
 * Helper component for bilingual fields.
 * Displays English line on top (normal font) and Indonesian translation below (italic font / garis miring).
 */
export const BilingualTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholderEn?: string;
  placeholderId?: string;
  classNameEn?: string;
  classNameId?: string;
  containerClassName?: string;
  indentId?: boolean;
}> = ({
  value,
  onChange,
  placeholderEn = "English text...",
  placeholderId = "Bahasa Indonesia (garis miring)...",
  classNameEn = "w-full text-xs text-slate-900 leading-snug py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none font-serif",
  classNameId = "w-full text-[11px] italic text-slate-600 leading-snug py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none font-serif",
  containerClassName = "w-full flex flex-col space-y-0.5",
  indentId = true,
}) => {
  const parts = (value || '').split('\n');
  const enVal = parts[0] || '';
  const idVal = parts.slice(1).join('\n');

  return (
    <div className={containerClassName}>
      <textarea
        rows={Math.max(1, Math.ceil((enVal || '').length / 65))}
        value={enVal}
        placeholder={placeholderEn}
        onChange={(e) => {
          const newEn = e.target.value;
          if (newEn.includes('\n') && !idVal) {
            onChange(newEn);
          } else {
            onChange(idVal ? `${newEn}\n${idVal}` : newEn);
          }
        }}
        className={classNameEn}
      />
      {(idVal !== undefined) && (
        <div className={indentId ? "pl-2.5 border-l-2 border-blue-200/70" : ""}>
          <textarea
            rows={Math.max(1, Math.ceil((idVal || '').length / 65))}
            value={idVal}
            placeholder={placeholderId}
            onChange={(e) => {
              const newId = e.target.value;
              onChange(`${enVal}\n${newId}`);
            }}
            className={classNameId}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Helper component for multi-bullet bilingual task lists (like taskPM).
 * Pairs each bullet point with its English description and italicized Indonesian translation below.
 */
export const BilingualBulletsEditor: React.FC<{
  value: string;
  onChange: (val: string) => void;
}> = ({ value, onChange }) => {
  const lines = (value || '').split('\n');
  const hasBullets = lines.some(l => /^[•\-\*]/.test(l.trim()));

  if (!hasBullets) {
    return (
      <BilingualTextarea
        value={value}
        onChange={onChange}
        classNameEn="w-full text-[10px] leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-serif text-slate-800"
        classNameId="w-full text-[9.5px] italic text-slate-600 leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-serif"
      />
    );
  }

  const bullets: { en: string; id: string }[] = [];
  let cur: { en: string; id: string } | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[•\-\*]/.test(trimmed)) {
      if (cur) bullets.push(cur);
      cur = { en: trimmed.replace(/^[•\-\*]\s*/, ''), id: '' };
    } else if (cur) {
      cur.id = cur.id ? `${cur.id} ${trimmed}` : trimmed;
    } else {
      cur = { en: trimmed, id: '' };
    }
  }
  if (cur) bullets.push(cur);

  const updateBullet = (idx: number, field: 'en' | 'id', text: string) => {
    const updated = [...bullets];
    updated[idx][field] = text;
    const newStr = updated.map(b => b.id ? `• ${b.en}\n  ${b.id}` : `• ${b.en}`).join('\n');
    onChange(newStr);
  };

  return (
    <div className="w-full flex flex-col space-y-1.5">
      {bullets.map((b, bIdx) => (
        <div key={bIdx} className="space-y-0.5">
          <div className="flex items-start gap-1">
            <span className="text-slate-400 font-bold select-none text-[10px] leading-none mt-1">•</span>
            <textarea
              rows={Math.max(1, Math.ceil(b.en.length / 32))}
              value={b.en}
              onChange={(e) => updateBullet(bIdx, 'en', e.target.value)}
              className="w-full text-[10px] leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none font-serif text-slate-800"
            />
          </div>
          <div className="pl-3 border-l border-slate-200">
            <textarea
              rows={Math.max(1, Math.ceil((b.id || '').length / 32))}
              value={b.id}
              placeholder="Terjemahan bahasa Indonesia (garis miring)..."
              onChange={(e) => updateBullet(bIdx, 'id', e.target.value)}
              className="w-full text-[9.5px] italic text-slate-600 leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none font-serif"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export function MonthlyReportGenerator() {
  const { user } = useAuth();

  // ─── Main Navigation Tab: 'editor' | 'archives' ───────────────────
  const [activeMainTab, setActiveMainTab] = useState<'editor' | 'archives'>('editor');

  // ─── Firestore Archives State ─────────────────────────────────────
  const [archives, setArchives] = useState<any[]>([]);
  const [loadingArchives, setLoadingArchives] = useState<boolean>(true);
  const [archiveToDelete, setArchiveToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingArchive, setIsDeletingArchive] = useState<boolean>(false);

  // ─── BOQ Equipment & CI Name Selector Modal State ─────────────────
  const [isBoqSelectorOpen, setIsBoqSelectorOpen] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [selectedCINames, setSelectedCINames] = useState<Map<string, Set<string>>>(new Map());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // ─── Modal "Tambah Alat ke Tabel Scope" State ─────────────────────
  const [addToolTargetTable, setAddToolTargetTable] = useState<{
    tIdx: number;
    scope: string;
    title: string;
  } | null>(null);
  const [addToolSearchQuery, setAddToolSearchQuery] = useState('');
  const [selectedAddToolCIs, setSelectedAddToolCIs] = useState<Set<string>>(new Set());
  const [isAddToolCustomMode, setIsAddToolCustomMode] = useState(false);
  const [customToolForm, setCustomToolForm] = useState({
    className: '',
    capacity: 'Standard Rating',
    location: 'NeutraDC Campus',
    productName: 'OEM Certified'
  });

  // ─── Modal "Tambah Tabel Scope Baru dari BOQ" State ───────────────
  const [isAddScopeTableModalOpen, setIsAddScopeTableModalOpen] = useState(false);
  const [newScopeSearchQuery, setNewScopeSearchQuery] = useState('');

  // Maintenance Categories dari BOQ (tanpa Spareparts)
  const MAINTENANCE_BOQ_CATEGORIES = useMemo(() => {
    return BOQ_CATEGORIES_DATA.filter(cat => !cat.isSparepart);
  }, []);

  // Filtered categories berdasarkan pencarian di modal BOQ
  const filteredBOQCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return MAINTENANCE_BOQ_CATEGORIES;
    const q = categorySearchQuery.toLowerCase().trim();
    return MAINTENANCE_BOQ_CATEGORIES.filter(cat =>
      cat.name.toLowerCase().includes(q) ||
      cat.items.some(it => {
        const iden = getBOQItemIdentifier(it).toLowerCase();
        const cid = (it['Class Id'] || '').toLowerCase();
        const ci = (it['CI Name*'] || '').toLowerCase();
        const tag = (it['TAG'] || it['Tag'] || '').toLowerCase();
        return iden.includes(q) || cid.includes(q) || ci.includes(q) || tag.includes(q);
      })
    );
  }, [categorySearchQuery, MAINTENANCE_BOQ_CATEGORIES]);

  // Total CI terpilih pada modal BOQ
  const totalSelectedBOQCI = useMemo(() => {
    let count = 0;
    for (const ciSet of selectedCINames.values()) {
      count += ciSet.size;
    }
    return count;
  }, [selectedCINames]);

  // Load Archives from Firestore (monthly_reports)
  useEffect(() => {
    const q = query(collection(db, 'monthly_reports'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setArchives(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingArchives(false);
    }, (err) => {
      console.error('Error loading monthly_reports archives:', err);
      setLoadingArchives(false);
    });
    return () => unsub();
  }, []);

  // Filtered Archives pencarian
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const filteredArchives = useMemo(() => {
    if (!archiveSearchQuery.trim()) return archives;
    const q = archiveSearchQuery.toLowerCase().trim();
    return archives.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.monthName || '').toLowerCase().includes(q) ||
      (a.quarter || '').toLowerCase().includes(q) ||
      (a.createdByName || '').toLowerCase().includes(q) ||
      (a.createdBy || '').toLowerCase().includes(q) ||
      (a.selectedEquipments || []).some((eq: string) => eq.toLowerCase().includes(q))
    );
  }, [archives, archiveSearchQuery]);

  // State Pilihan Bulan & Tahun (Default: Juli 2026 sesuai file acuan)
  const [selectedMonth, setSelectedMonth] = useState<number>(7);
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // State Laporan & Status
  const [reportData, setReportData] = useState<FullMonthlyReportData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [activeChapter, setActiveChapter] = useState<number>(0); // 0 = Semua / Cover
  const [isSavedLocally, setIsSavedLocally] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Manual save handler untuk tombol floating save
  const handleManualSave = useCallback(async () => {
    if (!reportData) return;
    setIsSavingManual(true);
    try {
      const storageKey = `dwimitra_monthly_report_${selectedYear}_${selectedMonth}`;
      await draftStorage.set(storageKey, reportData);
      setIsSavedLocally(true);
      setJustSaved(true);
      toast.success(`Laporan Bulanan ${reportData.monthName} ${reportData.year} berhasil disimpan! Data aman saat halaman direfresh.`);
      setTimeout(() => {
        setJustSaved(false);
      }, 3000);
    } catch (error: any) {
      console.error('Gagal menyimpan laporan:', error);
      toast.error(`Gagal menyimpan laporan: ${error?.message || 'Error tidak diketahui'}`);
    } finally {
      setIsSavingManual(false);
    }
  }, [reportData, selectedYear, selectedMonth]);

  // Filter & Pencarian Tabel 20 Equipment & System Details (Bab 5)
  const [selectedEquipmentCategory, setSelectedEquipmentCategory] = useState<string>('ALL');
  const [equipmentSearchQuery, setEquipmentSearchQuery] = useState<string>('');

  // Grouping equipment per kategori untuk Bab 5 (Tabel 20)
  const groupedEquipments = useMemo(() => {
    const map = new Map<string, { item: EquipmentDetailItem; originalIndex: number }[]>();
    (reportData?.equipmentDetailsTable20 || []).forEach((eq, idx) => {
      const sys = eq.system || 'General Equipment';
      if (!map.has(sys)) map.set(sys, []);
      map.get(sys)!.push({ item: eq, originalIndex: idx });
    });
    return map;
  }, [reportData?.equipmentDetailsTable20]);

  // Handler Perubahan Periode Bulan & Tahun (Langsung bersihkan stale reportData agar tidak stuck)
  const handleMonthChange = (newMonth: number) => {
    if (newMonth === selectedMonth) return;
    setReportData(null);
    setSelectedMonth(newMonth);
  };

  const handleYearChange = (newYear: number) => {
    if (newYear === selectedYear) return;
    setReportData(null);
    setSelectedYear(newYear);
  };

  // Bersihkan legacy localStorage yang menghabiskan kuota 5MB browser
  useEffect(() => {
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('dwimitra_monthly_report_')) {
          localStorage.removeItem(k);
        }
      });
    } catch (_) {}
  }, []);

  // Load Laporan dari Database / Cache (IndexedDB via draftStorage)
  const handleGenerateReport = async (
    forceFresh = false,
    targetMonth = selectedMonth,
    targetYear = selectedYear
  ) => {
    setGenerating(true);
    const storageKey = `dwimitra_monthly_report_${targetYear}_${targetMonth}`;

    // Cek cache draft (IndexedDB) kecuali jika di-force fresh
    if (!forceFresh) {
      try {
        let parsed = await draftStorage.get(storageKey);
        if (!parsed) {
          const legacy = localStorage.getItem(storageKey);
          if (legacy) {
            try {
              parsed = JSON.parse(legacy);
            } catch (_) {}
          }
        }

        if (parsed) {
          // CRITICAL VALIDATION: Pastikan cache yang dibaca benar-benar milik targetMonth & targetYear!
          if (!parsed || parsed.monthNumber !== targetMonth || parsed.year !== targetYear) {
            console.warn(`[MonthlyReport] Cache mismatch / corrupted: target ${targetMonth}/${targetYear}, found ${parsed?.monthNumber}/${parsed?.year}. Membersihkan cache...`);
            await draftStorage.remove(storageKey);
            try { localStorage.removeItem(storageKey); } catch (_) {}
          } else {
            // 1. Normalisasi LPS -> Lightning Protection System pada scheduleTable1 & purge unmapped
            if (Array.isArray(parsed.scheduleTable1)) {
              parsed.scheduleTable1 = parsed.scheduleTable1.filter((s: any) => 
                !s.plan?.toLowerCase().includes('ad-hoc') && !s.plan?.toLowerCase().includes('corrective')
              );
              parsed.scheduleTable1.forEach((s: any) => {
                if (s.device?.toUpperCase() === 'LPS' || s.device?.toLowerCase() === 'lightning protection') {
                  s.device = 'Lightning Protection System';
                }
              });
              // Hapus duplikasi jika ada 2 item device yang sama di scheduleTable1
              const seenDevices = new Set<string>();
              parsed.scheduleTable1 = parsed.scheduleTable1.filter((s: any) => {
                if (seenDevices.has(s.device)) return false;
                seenDevices.add(s.device);
                return true;
              });
              parsed.scheduleTable1.forEach((s: any, idx: number) => { s.no = idx + 1; });
            }

            // 2. Normalisasi LPS -> Lightning Protection System pada taskPerformanceTables
            if (Array.isArray(parsed.taskPerformanceTables)) {
              parsed.taskPerformanceTables.forEach((t: any) => {
                if (t.scope?.toUpperCase() === 'LPS' || t.scope?.toLowerCase() === 'lightning protection') {
                  t.scope = 'Lightning Protection System';
                  t.title = `Table ${t.tableNo}. Total Task Performance Lightning Protection System`;
                }
              });
              // Hapus duplikasi tabel jika ada 2 tabel Lightning Protection System
              const seenScopes = new Set<string>();
              parsed.taskPerformanceTables = parsed.taskPerformanceTables.filter((t: any) => {
                if (seenScopes.has(t.scope)) return false;
                seenScopes.add(t.scope);
                return true;
              });
              // Filter hanya tabel yang equipment-nya memang ada di scheduleTable1
              const validSchedScopes = new Set((parsed.scheduleTable1 || []).map((s: any) => s.device));
              if (validSchedScopes.size > 0) {
                parsed.taskPerformanceTables = parsed.taskPerformanceTables.filter((t: any) => validSchedScopes.has(t.scope));
              }
              // Re-index nomor tabel (Tabel 2, 3, ...)
              let tableNum = 2;
              parsed.taskPerformanceTables.forEach((t: any) => {
                t.tableNo = tableNum;
                t.title = `Table ${tableNum}. Total Task Performance ${t.scope}`;
                tableNum++;
              });
            }

            // 3. Sinkronisasi Dinamis Bab 6 Scope of Work (Tabel 22) & Seluruh Tabel Downstream:
            // Jika data cache masih format lama/dummy atau belum sinkron dengan equipment PM Schedule, perbarui otomatis!
            const schedScopes: string[] = (parsed.scheduleTable1 || []).map((s: any) => s.device).filter(Boolean);
            if (schedScopes.length > 0) {
              const dyn = buildAllDynamicEquipmentTables(
                schedScopes,
                parsed.taskPerformanceTables || [],
                parsed.monthNameEn,
                parsed.year
              );

              if (
                !Array.isArray(parsed.scopeOfWorkTable22) ||
                parsed.scopeOfWorkTable22.length !== schedScopes.length ||
                parsed._sowDetailedVersion !== 3 ||
                parsed.scopeOfWorkTable22.some((c: any) => 
                  c.items?.some((it: any) => it.tasks?.some((t: string) => !t.includes('\n'))) ||
                  c.category?.includes('BARU') || 
                  c.category?.includes('DUMMY') || 
                  c.category === 'CHILLER & HVAC SYSTEM' ||
                  c.category === 'CHILLER & PRIMARY COOLING SYSTEM' && schedScopes.length > 1 && parsed.scopeOfWorkTable22.length === 1
                )
              ) {
                parsed.scopeOfWorkTable22 = dyn.scopeOfWorkTable22;
                parsed._sowDetailedVersion = 3;
              }

              if (!Array.isArray(parsed.systemOverviewTable21) || parsed.systemOverviewTable21.length !== schedScopes.length) {
                parsed.systemOverviewTable21 = dyn.systemOverviewTable21;
              }
              if (!Array.isArray(parsed.calibrationTable30) || parsed.calibrationTable30.length !== schedScopes.length) {
                parsed.calibrationTable30 = dyn.calibrationTable30;
              }
              if (!Array.isArray(parsed.validationMethodsTable31) || parsed.validationMethodsTable31.length !== schedScopes.length) {
                parsed.validationMethodsTable31 = dyn.validationMethodsTable31;
              }
              if (!Array.isArray(parsed.challengesTable32) || parsed.challengesTable32.length !== schedScopes.length) {
                parsed.challengesTable32 = dyn.challengesTable32;
              }
              if (!Array.isArray(parsed.mitigationTable33) || parsed.mitigationTable33.length !== schedScopes.length) {
                parsed.mitigationTable33 = dyn.mitigationTable33;
              }
              if (!Array.isArray(parsed.lessonsLearnedTable34) || parsed.lessonsLearnedTable34.length !== schedScopes.length) {
                parsed.lessonsLearnedTable34 = dyn.lessonsLearnedTable34;
              }
              if (!Array.isArray(parsed.recommendationsTable35) || parsed.recommendationsTable35.length !== schedScopes.length) {
                parsed.recommendationsTable35 = dyn.recommendationsTable35;
              }
              parsed.listOfTables = buildDynamicListOfTables(parsed.taskPerformanceTables, parsed.monthNameEn, parsed.year);
            }
            // 6. Pembersihan Anomali baris "Equipment" / summary kosong dari taskPerformanceTables & equipmentDetailsTable20
            if (Array.isArray(parsed.taskPerformanceTables)) {
              parsed.taskPerformanceTables.forEach((tbl: any) => {
                if (Array.isArray(tbl.items)) {
                  tbl.items = tbl.items.filter((it: any) => {
                    const cls = (it.className || '').trim().toLowerCase();
                    const prod = (it.productName || '').trim().toLowerCase();
                    return cls !== 'equipment' && cls !== 'total' && cls !== 'grand total' && cls !== '' && prod !== 'total';
                  }).map((it: any, i: number) => {
                    // Normalisasi Task PM ke format 1 paragraf ringkas bilingual jika masih berformat bullets lama / terlalu panjang
                    if (it.taskPM && (it.taskPM.includes('•') || it.taskPM.split('\n').length > 3)) {
                      it.taskPM = getTaskPMFromSR(tbl.scope || it.className);
                    }
                    return { ...it, no: i + 1 };
                  });
                }
              });
            }
            if (Array.isArray(parsed.equipmentDetailsTable20)) {
              parsed.equipmentDetailsTable20 = parsed.equipmentDetailsTable20.filter((eq: any) => {
                const cls = (eq.className || '').trim().toLowerCase();
                const name = (eq.name || '').trim().toLowerCase();
                return cls !== 'equipment' && cls !== 'total' && cls !== '' && name !== 'equipment' && name !== 'total';
              }).map((eq: any, i: number) => ({ ...eq, no: i + 1 }));
            }

            setReportData(parsed);
            setIsSavedLocally(true);
            setGenerating(false);
            // Simpan kembali cache yang sudah dibersihkan dan disinkronkan ke IndexedDB
            try {
              await draftStorage.set(storageKey, parsed);
              localStorage.removeItem(storageKey);
            } catch (errCache) {
              console.warn('Gagal memperbarui cache tersanitasi:', errCache);
            }
            toast.info(`Draft ${parsed.monthName} ${parsed.year} tersinkronisasi dan dimuat!`);
            return;
          }
        }
      } catch (e) {
        console.warn('Gagal membaca cache lokal:', e);
      }
    }

    try {
      const data = await aggregateMonthlyReportData({
        month: targetMonth,
        year: targetYear,
        preparedBy: 'Arif Budiman',
        contractNumber: 'K.TDE.0105/LEG.PRJ/VI/2026'
      });
      setReportData(data);
      setIsSavedLocally(true);
      // Simpan ke IndexedDB (kapasitas ratusan MB, aman dari QuotaExceededError)
      try {
        await draftStorage.set(storageKey, data);
        localStorage.removeItem(storageKey);
      } catch (errStorage) {
        console.warn('Storage save warning:', errStorage);
      }
      toast.success(`Laporan Bulanan ${data.monthName} ${data.year} Berhasil Digenerate!`);
    } catch (err: any) {
      console.error('Error generating monthly report:', err);
      toast.error(`Gagal membuat laporan: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Generate on initial mount or when month/year changes
  useEffect(() => {
    handleGenerateReport(false, selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  // Auto-save debounced to IndexedDB when reportData changes
  useEffect(() => {
    if (!reportData) return;
    // CRITICAL GUARD: Hanya simpan jika data laporan cocok dengan bulan & tahun yang aktif!
    if (reportData.monthNumber !== selectedMonth || reportData.year !== selectedYear) {
      return;
    }
    const storageKey = `dwimitra_monthly_report_${selectedYear}_${selectedMonth}`;
    const timeout = setTimeout(async () => {
      try {
        await draftStorage.set(storageKey, reportData);
        setIsSavedLocally(true);
        try { localStorage.removeItem(storageKey); } catch (_) {}
      } catch (e) {
        console.error('Auto-save error:', e);
      }
    }, 1200);
    return () => clearTimeout(timeout);
  }, [reportData, selectedMonth, selectedYear]);

  // ─── BOQ Equipment Selector Handlers (Mirip Berita Acara) ────────
  const openBoqSelector = useCallback(() => {
    // Mulai dari state bersih tanpa checklist (0 equipment terpilih) sesuai permintaan user
    setSelectedCategoryIds(new Set());
    setSelectedCINames(new Map());
    setExpandedCategories(new Set());
    setCategorySearchQuery('');
    setIsBoqSelectorOpen(true);
  }, []);

  const toggleCategory = useCallback((catId: string) => {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
        setSelectedCINames(old => {
          const m = new Map(old);
          m.delete(catId);
          return m;
        });
      } else {
        next.add(catId);
        setExpandedCategories(ex => {
          const s = new Set(ex);
          s.add(catId);
          return s;
        });
        // Auto select all CIs in this category
        const cat = BOQ_CATEGORIES_DATA.find(c => c.id === catId);
        if (cat) {
          const all = new Set(cat.items.map(it => getBOQItemIdentifier(it)).filter(Boolean));
          setSelectedCINames(old => {
            const m = new Map(old);
            m.set(catId, all);
            return m;
          });
        }
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
      const all = new Set(cat.items.map(item => getBOQItemIdentifier(item)).filter(Boolean));
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

  const handleApplyBOQSelection = useCallback(() => {
    if (selectedCategoryIds.size === 0) {
      toast.error('Pilih minimal 1 equipment dari BOQ.');
      return;
    }

    const selections: CustomBOQSelection[] = [];
    for (const catId of selectedCategoryIds) {
      const cat = BOQ_CATEGORIES_DATA.find(c => c.id === catId);
      if (!cat) continue;
      const cis = selectedCINames.get(catId);
      const ciList = cis ? Array.from(cis) : [];
      if (ciList.length === 0) {
        toast.error(`Pilih minimal 1 CI Name untuk equipment "${cat.name}".`);
        return;
      }
      selections.push({
        categoryId: cat.id,
        categoryName: cat.name,
        selectedCINames: ciList
      });
    }

    if (!reportData) return;

    const custom = buildCustomScopeTablesFromBOQ(selections, reportData.monthName, reportData.year);
    setReportData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        scheduleTable1: custom.scheduleTable1,
        taskPerformanceTables: custom.taskPerformanceTables,
        equipmentDetailsTable20: custom.equipmentDetailsTable20,
        systemOverviewTable21: custom.systemOverviewTable21,
        scopeOfWorkTable22: custom.scopeOfWorkTable22,
        calibrationTable30: custom.calibrationTable30,
        validationMethodsTable31: custom.validationMethodsTable31,
        challengesTable32: custom.challengesTable32,
        mitigationTable33: custom.mitigationTable33,
        lessonsLearnedTable34: custom.lessonsLearnedTable34,
        recommendationsTable35: custom.recommendationsTable35,
        listOfTables: custom.listOfTables,
        progressPmTable19: custom.progressPmTable19
      };
    });

    setIsBoqSelectorOpen(false);
    toast.success(`Berhasil menerapkan ${selections.length} equipment & ${selections.reduce((acc, s) => acc + s.selectedCINames.length, 0)} CI ke Monthly Report!`);
  }, [selectedCategoryIds, selectedCINames, reportData]);

  // ─── Modal "Tambah Alat ke Tabel Scope" Handlers ─────────────────
  const handleOpenAddToolModal = useCallback((tIdx: number, scope: string, title: string) => {
    setAddToolTargetTable({ tIdx, scope, title });
    setAddToolSearchQuery('');
    setSelectedAddToolCIs(new Set());
    setIsAddToolCustomMode(false);
    setCustomToolForm({
      className: '',
      capacity: 'Standard Rating',
      location: 'NeutraDC Campus',
      productName: 'OEM Certified'
    });
  }, []);

  const activeAddToolBOQCategory = useMemo(() => {
    if (!addToolTargetTable) return undefined;
    return findBOQCategoryForScope(addToolTargetTable.scope);
  }, [addToolTargetTable]);

  // Prepared BOQ items with guaranteed unique key per item
  const preparedAddToolBOQItems = useMemo(() => {
    if (!activeAddToolBOQCategory) return [];
    return activeAddToolBOQCategory.items
      .map((item, originalIndex) => {
        const uniqueKey = `${activeAddToolBOQCategory.id}_${originalIndex}_${item['Asset ID'] || item['TAG'] || item['Serial Number'] || item['No'] || originalIndex}`;
        const identifier = getBOQItemIdentifier(item);
        const details = extractBOQItemDetails(item);
        return {
          item,
          originalIndex,
          uniqueKey,
          identifier,
          details,
          isValid: isValidBOQItem(item)
        };
      })
      .filter(x => x.isValid);
  }, [activeAddToolBOQCategory]);

  const filteredAddToolBOQItems = useMemo(() => {
    if (!preparedAddToolBOQItems.length) return [];
    if (!addToolSearchQuery.trim()) return preparedAddToolBOQItems;
    const q = addToolSearchQuery.toLowerCase().trim();
    return preparedAddToolBOQItems.filter(({ item, identifier, details }) => {
      const iden = identifier.toLowerCase();
      const cls = (item['Class Id'] || '').toLowerCase();
      const loc = (details.location || '').toLowerCase();
      const cap = (details.capacity || '').toLowerCase();
      const prod = (details.productName || '').toLowerCase();
      return iden.includes(q) || cls.includes(q) || loc.includes(q) || cap.includes(q) || prod.includes(q);
    });
  }, [preparedAddToolBOQItems, addToolSearchQuery]);

  const handleToggleAddToolCI = useCallback((uniqueKey: string) => {
    setSelectedAddToolCIs(prev => {
      const next = new Set(prev);
      if (next.has(uniqueKey)) next.delete(uniqueKey);
      else next.add(uniqueKey);
      return next;
    });
  }, []);

  const handleSelectAllAddToolCIs = useCallback(() => {
    const all = new Set(filteredAddToolBOQItems.map(it => it.uniqueKey));
    setSelectedAddToolCIs(all);
  }, [filteredAddToolBOQItems]);

  const handleDeselectAllAddToolCIs = useCallback(() => {
    setSelectedAddToolCIs(new Set());
  }, []);

  const handleConfirmAddTools = useCallback(() => {
    if (!addToolTargetTable || !reportData) return;
    const { tIdx, scope } = addToolTargetTable;
    const targetTable = reportData.taskPerformanceTables[tIdx];
    if (!targetTable) return;

    let newRows: any[] = [];

    if (isAddToolCustomMode) {
      if (!customToolForm.className.trim()) {
        toast.error('Mohon masukkan Class Name alat.');
        return;
      }
      newRows.push({
        no: targetTable.items.length + 1,
        className: customToolForm.className.trim(),
        capacity: customToolForm.capacity.trim() || 'Standard Rating',
        location: customToolForm.location.trim() || 'NeutraDC Campus',
        productName: customToolForm.productName.trim() || 'OEM Certified',
        taskPM: getTaskPMFromSR(scope),
        criticalRepairs: 'No critical repair is required.\nSaat ini tidak diperlukan perbaikan mendesak.',
        operationalStatus: 'Good Condition / Normal Operation\nKondisi Baik / Beroperasi Normal',
        issues: 'No abnormality observed.\nTidak ditemukan kelainan.',
        recommendations: 'Continue routine maintenance and periodic inspection.\nLanjutkan pemeliharaan rutin dan inspeksi berkala.'
      });
    } else {
      if (selectedAddToolCIs.size === 0) {
        toast.error('Pilih minimal 1 alat dari daftar BOQ.');
        return;
      }
      if (!activeAddToolBOQCategory) {
        toast.error('Kategori BOQ tidak ditemukan untuk scope ini.');
        return;
      }

      const matchingPrepared = preparedAddToolBOQItems.filter(p => selectedAddToolCIs.has(p.uniqueKey));

      newRows = matchingPrepared.map((prep, idx) => {
        const details = prep.details;
        return {
          no: targetTable.items.length + idx + 1,
          className: details.className,
          capacity: details.capacity,
          location: details.location,
          productName: details.productName,
          taskPM: getTaskPMFromSR(scope),
          criticalRepairs: 'No critical repair is required.\nSaat ini tidak diperlukan perbaikan mendesak.',
          operationalStatus: 'Good Condition / Normal Operation\nKondisi Baik / Beroperasi Normal',
          issues: 'No abnormality observed.\nTidak ditemukan kelainan.',
          recommendations: 'Continue routine maintenance and periodic inspection.\nLanjutkan pemeliharaan rutin dan inspeksi berkala.'
        };
      });
    }

    if (newRows.length === 0) {
      toast.error('Tidak ada alat yang dapat ditambahkan.');
      return;
    }

    const updatedTables = reportData.taskPerformanceTables.map((tbl, i) => {
      if (i !== tIdx) return tbl;
      const combined = [...tbl.items, ...newRows].map((it, nIdx) => ({
        ...it,
        no: nIdx + 1
      }));
      return { ...tbl, items: combined };
    });

    setReportData({
      ...reportData,
      taskPerformanceTables: updatedTables
    });

    toast.success(`${newRows.length} alat berhasil ditambahkan ke ${scope}!`);
    setAddToolTargetTable(null);
  }, [addToolTargetTable, reportData, isAddToolCustomMode, customToolForm, selectedAddToolCIs, activeAddToolBOQCategory, preparedAddToolBOQItems]);

  // ─── Modal "Tambah Tabel Scope Baru dari BOQ" Handlers ───────────
  const handleAddNewScopeTable = useCallback((catId: string) => {
    if (!reportData) return;
    const cat = BOQ_CATEGORIES_DATA.find(c => c.id === catId);
    if (!cat) return;

    const validItems = cat.items.filter(isValidBOQItem);
    const initialItems = (validItems.length > 20 ? validItems.slice(0, 15) : validItems);

    const newTableNo = (reportData.taskPerformanceTables?.length || 0) + 2;
    const newTableTitle = `Table ${newTableNo}. Total Task Performance ${cat.name}`;

    const items = initialItems.length > 0 ? initialItems.map((it, idx) => {
      const details = extractBOQItemDetails(it);
      return {
        no: idx + 1,
        className: details.className,
        capacity: details.capacity,
        location: details.location,
        productName: details.productName,
        taskPM: getTaskPMFromSR(cat.name),
        criticalRepairs: 'No critical repair is required.\nSaat ini tidak diperlukan perbaikan mendesak.',
        operationalStatus: 'Good Condition / Normal Operation\nKondisi Baik / Beroperasi Normal',
        issues: 'No abnormality observed.\nTidak ditemukan kelainan.',
        recommendations: 'Continue routine maintenance and periodic inspection.\nLanjutkan pemeliharaan rutin dan inspeksi berkala.'
      };
    }) : [
      {
        no: 1,
        className: `${cat.name} Unit 01`,
        capacity: 'Standard Rating',
        location: 'NeutraDC Campus',
        productName: 'OEM Certified',
        taskPM: getTaskPMFromSR(cat.name),
        criticalRepairs: 'No critical repair is required.\nSaat ini tidak diperlukan perbaikan mendesak.',
        operationalStatus: 'Good Condition / Normal Operation\nKondisi Baik / Beroperasi Normal',
        issues: 'No abnormality observed.\nTidak ditemukan kelainan.',
        recommendations: 'Continue routine maintenance and periodic inspection.\nLanjutkan pemeliharaan rutin dan inspeksi berkala.'
      }
    ];

    const newTable = {
      tableNo: newTableNo,
      title: newTableTitle,
      scope: cat.name,
      items
    };

    const updatedTables = [...(reportData.taskPerformanceTables || []), newTable].map((tbl, i) => ({
      ...tbl,
      tableNo: i + 2,
      title: `Table ${i + 2}. Total Task Performance ${tbl.scope}`
    }));

    setReportData({
      ...reportData,
      taskPerformanceTables: updatedTables
    });

    toast.success(`Tabel Scope "${cat.name}" berhasil dibuat dengan ${items.length} alat!`);
    setIsAddScopeTableModalOpen(false);
  }, [reportData]);

  // ─── Archive Handlers ─────────────────────────────────────────────
  const handleLoadArchiveToEditor = useCallback((archive: any) => {
    if (!archive.reportData) {
      toast.error('Data laporan arsip tidak ditemukan.');
      return;
    }
    setReportData(archive.reportData);
    if (archive.monthNumber) setSelectedMonth(archive.monthNumber);
    if (archive.year) setSelectedYear(archive.year);
    setActiveMainTab('editor');
    toast.success(`Data "${archive.title}" berhasil dimuat kembali ke Editor! Silakan lakukan revisi.`);
  }, []);

  const handleDownloadArchive = useCallback(async (archive: any) => {
    if (!archive.reportData) {
      toast.error('Data laporan arsip tidak tersedia.');
      return;
    }
    try {
      toast.info(`Menyusun file DOCX untuk ${archive.title}...`);
      await generateMonthlyReportDOCX(archive.reportData);
      toast.success('File Microsoft Word (.docx) berhasil diunduh!');
    } catch (err: any) {
      console.error('Error downloading from archive:', err);
      toast.error('Gagal mengunduh file DOCX: ' + err.message);
    }
  }, []);

  const handleDeleteArchive = useCallback(async () => {
    if (!archiveToDelete) return;
    setIsDeletingArchive(true);
    try {
      await deleteDoc(doc(db, 'monthly_reports', archiveToDelete.id));
      toast.success('Arsip dokumen berhasil dihapus dari cloud.');
      setArchiveToDelete(null);
    } catch (err: any) {
      console.error('Gagal menghapus arsip:', err);
      toast.error('Gagal menghapus arsip: ' + (err?.message || 'Terjadi kesalahan'));
    } finally {
      setIsDeletingArchive(false);
    }
  }, [archiveToDelete]);

  // Quick Action AI Triggers
  const handleAIRecs = () => {
    if (!reportData) return;
    const newRecs = generateRecommendationsFromFindings(reportData.observationTable23);
    setReportData(prev => prev ? { ...prev, recommendationsTable35: newRecs } : prev);
    toast.success('Rekomendasi Teknis Bab 11 berhasil disusun oleh AI berdasarkan temuan!');
  };

  const handleAITesting = () => {
    if (!reportData) return;
    const scopes = (reportData.scheduleTable1 || []).map(s => s.device);
    const tv = generateTestingAndValidation(scopes, reportData.monthName, reportData.year);
    setReportData(prev => prev ? {
      ...prev,
      calibrationTable30: tv.calibration,
      validationMethodsTable31: tv.validation
    } : prev);
    toast.success('Metode Uji & Validasi Bab 9 berhasil digenerate oleh AI!');
  };

  const handleAIChallenges = () => {
    if (!reportData) return;
    const scopes = (reportData.scheduleTable1 || []).map(s => s.device);
    const cm = generateChallengesAndMitigations(reportData.monthName, scopes);
    setReportData(prev => prev ? {
      ...prev,
      challengesTable32: cm.challenges,
      mitigationTable33: cm.mitigations,
      lessonsLearnedTable34: cm.lessonsLearned
    } : prev);
    toast.success('Tantangan, Mitigasi, & Lesson Learned Bab 10 berhasil disusun oleh AI!');
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Export to DOCX Handler + Auto-Save to Cloud Archive (Firestore: monthly_reports)
  const handleExportDocx = async () => {
    if (!reportData) return;
    setExportingDocx(true);
    try {
      await generateMonthlyReportDOCX(reportData);
      toast.success('File Microsoft Word (.docx) berhasil dibuat dan diunduh!');

      // Auto-save arsip ke Firestore: monthly_reports
      try {
        const eqNames = (reportData.scheduleTable1 || []).map(s => s.device);
        const totalCI = (reportData.taskPerformanceTables || []).reduce((acc, t) => acc + (t.items?.length || 0), 0);
        await addDoc(collection(db, 'monthly_reports'), {
          title: `Laporan Bulanan Maintenance ${reportData.monthName} ${reportData.year}`,
          monthNumber: selectedMonth,
          monthName: reportData.monthName,
          year: selectedYear,
          quarter: reportData.quarter || 'Q3',
          contractNumber: reportData.contractNumber || reportData.generalInfo?.contractReference || 'K.TDE.0105/LEG.PRJ/VI/2026',
          selectedEquipments: eqNames,
          totalCINames: totalCI,
          createdAt: Timestamp.now(),
          createdBy: user?.email || '',
          createdByName: user?.displayName || user?.email?.split('@')[0] || 'User',
          reportData: reportData
        });
        toast.success('Dokumen otomatis tersimpan di Arsip Dokumen Monthly Report (Cloud Firestore)!');
      } catch (saveErr: any) {
        console.warn('Gagal menyimpan arsip ke Firestore:', saveErr);
        toast.warning('DOCX terunduh, namun arsip ke cloud gagal: ' + (saveErr?.message || 'Permission issue'));
      }
    } catch (err: any) {
      console.error('Error exporting docx:', err);
      toast.error(`Gagal mengekspor file DOCX: ${err.message}`);
    } finally {
      setExportingDocx(false);
    }
  };

  // Reset Draft to Fresh Database Aggregation
  const handleResetToDefault = async () => {
    const currentMonthLabel = MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label || `Bulan ${selectedMonth}`;
    if (confirm(`Yakin ingin mereset perubahan dan menarik ulang data default ${currentMonthLabel} ${selectedYear} dari database?`)) {
      const storageKey = `dwimitra_monthly_report_${selectedYear}_${selectedMonth}`;
      try {
        await draftStorage.remove(storageKey);
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn('Gagal menghapus cache saat reset:', e);
      }
      setReportData(null);
      handleGenerateReport(true, selectedMonth, selectedYear);
    }
  };

  // State Loading AI Bilingual Agent
  const [isTranslatingBilingual, setIsTranslatingBilingual] = useState(false);

  // Convert Report to Dual-line Bilingual (EN + ID) with AI Agent
  const handleConvertToBilingual = async () => {
    if (!reportData) return;
    setIsTranslatingBilingual(true);
    const toastId = toast.loading('🤖 AI Agent sedang menyelaraskan format bilingual (EN + ID) untuk seluruh bab & tabel...');
    try {
      const bilingual = await convertReportToBilingualWithAI(reportData, (statusMsg) => {
        toast.loading(`🤖 ${statusMsg}`, { id: toastId });
      });
      setReportData(bilingual);
      toast.success('🎉 100% Seluruh Bab & Tabel berhasil diformat ke Bilingual (Inggris di atas, Indonesia di bawah)!', { id: toastId });
    } catch (err: any) {
      console.warn('AI Agent translation error, using instant baseline:', err);
      const fallback = convertReportToBilingual(reportData);
      setReportData(fallback);
      toast.success('Format Bilingual (EN + ID) berhasil diterapkan!', { id: toastId });
    } finally {
      setIsTranslatingBilingual(false);
    }
  };

  // Handler Upload Foto File Picker (Base64) untuk Bab 12 Tabel 36
  const handlePhotoUpload = (
    file: File | undefined,
    rowIndex: number,
    field: 'prePhoto' | 'duringPhoto' | 'postPhoto'
  ) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran foto terlalu besar (maksimal 5MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        const updated = { ...reportData! };
        updated.photoLogsTable36[rowIndex][field] = base64;
        setReportData(updated);
        toast.success('Foto dokumentasi berhasil diunggah!');
      }
    };
    reader.onerror = () => {
      toast.error('Gagal membaca file foto');
    };
    reader.readAsDataURL(file);
  };

  // Handler Hapus Foto dari Sel Tertentu di Bab 12 Tabel 36
  const handleDeleteCellPhoto = (
    rowIndex: number,
    field: 'prePhoto' | 'duringPhoto' | 'postPhoto'
  ) => {
    if (!reportData) return;
    const updated = { ...reportData };
    updated.photoLogsTable36[rowIndex][field] = '';
    setReportData(updated);
    toast.info('Foto berhasil dihapus dari sel');
  };

  const CHAPTERS = [
    { id: 0, title: 'Semua / Cover & Approval Sheet', icon: Building2 },
    { id: 1, title: '1. Executive Summary', icon: Award },
    { id: 2, title: '2. Key Highlight & Schedule (Tabel 1-17)', icon: Calendar },
    { id: 3, title: '3. General Information & Tim (Tabel 18)', icon: Users },
    { id: 4, title: '4. Maintenance Objectives & KPI (Tabel 19)', icon: BarChart3 },
    { id: 5, title: '5. Equipment Details (Tabel 20-21)', icon: Cpu },
    { id: 6, title: '6. Scope of Work (Tabel 22)', icon: BookOpen },
    { id: 7, title: '7. Observation & Finding (Tabel 23-28)', icon: AlertTriangle },
    { id: 8, title: '8. Repairs & Services (Tabel 29)', icon: Package },
    { id: 9, title: '9. Calibration & Validation (Tabel 30-31)', icon: Sparkles },
    { id: 10, title: '10. Challenges & Mitigation (Tabel 32-34)', icon: FileText },
    { id: 11, title: '11. Recommendations (Tabel 35)', icon: FileText },
    { id: 12, title: '12. Photo Log (Tabel 36)', icon: FileText },
    { id: 13, title: '13. Appendices', icon: FileText }
  ];

  return (
    <div className="monthly-report-feature space-y-6 pb-24 relative font-serif" style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}>
      {/* ─── Main Navigation Tab Switcher (Sembunyi saat Print) ─────────────── */}
      <div className="print:hidden flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveMainTab('editor')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all cursor-pointer ${
              activeMainTab === 'editor'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>📝 Editor Laporan</span>
          </button>
          <button
            onClick={() => setActiveMainTab('archives')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all cursor-pointer ${
              activeMainTab === 'archives'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>📁 Arsip Dokumen Monthly Report</span>
            {archives.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                activeMainTab === 'archives' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {archives.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── Control Bar (Sembunyi saat Print & hanya tampil di Editor Tab) ───── */}
      {activeMainTab === 'editor' && (
        <>
          <div className="print:hidden bg-white text-slate-800 p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200">
        {/* Tier 1: Judul Laporan & Selektor Periode */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span>Interactive Monthly Report Engine (Format Standar NeutraDC Cikarang)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Laporan Bulanan Maintenance (Monthly Report)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Format halaman cetak resmi, tabel Deep Blue (#0066B3), lembar pengesahan 6 signer, dan seluruh tabel
              dapat langsung diedit di web.
            </p>
          </div>

          {/* Month & Year Selectors + Reset in Compact Card */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 self-start lg:self-center shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-1 text-slate-400 text-xs font-medium">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline text-slate-600 font-semibold">Periode:</span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="bg-white text-slate-800 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              {MONTH_OPTIONS.map(m => (
                <option key={m.value} value={m.value} className="bg-white text-slate-800">
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="bg-white text-slate-800 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              {[2025, 2026, 2027, 2028].map(y => (
                <option key={y} value={y} className="bg-white text-slate-800">
                  {y}
                </option>
              ))}
            </select>

            {/* Refresh / Reset Button */}
            <button
              onClick={handleResetToDefault}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Reset dan Tarik Ulang Data Database"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <RotateCcw className="w-3.5 h-3.5 text-slate-500" />}
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Dedicated Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 mt-5 border-t border-slate-100">
          {/* Smart Features / AI Tools / Equipment Selector */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Tombol Pilih Equipment dari BOQ */}
            <button
              onClick={openBoqSelector}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 transition-all cursor-pointer active:scale-95"
              title="Pilih lingkup equipment & CI Name langsung dari Master BOQ seperti pada Berita Acara"
            >
              <Layers className="w-4 h-4 text-blue-200" />
              <span>Pilih Equipment dari BOQ</span>
            </button>

            {/* Bilingual (EN + ID) Button with AI Agent */}
            <button
              onClick={handleConvertToBilingual}
              disabled={!reportData || isTranslatingBilingual}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-teal-500/20 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              title="Konversi seluruh tabel dan narasi ke Format Bilingual resmi NeutraDC dengan bantuan AI Agent"
            >
              {isTranslatingBilingual ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Globe className="w-4 h-4 text-emerald-200" />
              )}
              <span>{isTranslatingBilingual ? 'AI Menerjemahkan...' : 'Format Bilingual (EN + ID)'}</span>
            </button>
          </div>

          {/* Export & Output Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white shadow-sm shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>

            {/* Export to Word (.docx) Button */}
            <button
              onClick={handleExportDocx}
              disabled={exportingDocx || !reportData}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white shadow-sm shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {exportingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{exportingDocx ? 'Menyusun Word & Arsip...' : 'Ekspor Word (.docx)'}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Summary Badges */}
        {reportData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium block">Sistem Terjadwal Bab 2</span>
              <span className="text-xl font-black text-slate-800">
                {reportData.scheduleTable1.length} Lingkup Sistem
              </span>
            </div>
            <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200/60">
              <span className="text-xs text-emerald-700 font-medium block">Critical Uptime</span>
              <span className="text-xl font-black text-emerald-700">100.00%</span>
            </div>
            <div className="bg-indigo-50/80 p-3.5 rounded-2xl border border-indigo-200/60">
              <span className="text-xs text-indigo-700 font-medium block">Status Auto-Save Web</span>
              <span className="text-xs font-bold text-indigo-700 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isSavedLocally ? 'Tersimpan di Browser' : 'Menyimpan...'}</span>
              </span>
            </div>
            <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/60">
              <span className="text-xs text-amber-700 font-medium block">Suku Cadang CM Standby (Bab 8)</span>
              <span className="text-xl font-black text-amber-700">
                {reportData.repairsTable29.length} Item Tercatat
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Chapter Selector Tabs (Sembunyi saat Print) ────────────────────── */}
      <div className="print:hidden bg-white p-3 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {CHAPTERS.map(ch => {
            const Icon = ch.icon;
            const isActive = activeChapter === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChapter(ch.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{ch.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main Report Document Content ────────────────────────────────────── */}
      {generating && !reportData ? (
        <div className="bg-white p-20 rounded-3xl border border-slate-200 shadow-sm text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-800">Menyusun Data Laporan Bulanan Resmi...</h3>
          <p className="text-xs text-slate-500 mt-1">Mengagregasi 13 Bab, 36 Tabel, Master BOQ, dan Dokumen Teknisi.</p>
        </div>
      ) : reportData && (
        <div className="monthly-report-paper bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-12 space-y-16 print:border-none print:shadow-none print:p-0 font-serif" style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}>
          
          {/* ===================================================================
              PAGE 1: COVER PAGE (100% CENTERED & BILINGUAL SESUAI ACUAN ASLI)
              =================================================================== */}
          {(activeChapter === 0 || window.matchMedia('print').matches) && (
            <section className="min-h-[88vh] flex flex-col justify-between py-16 px-8 border-b border-slate-200 print:border-none print:page-break-after font-serif text-center">
              {/* Top Header Block (Centered) */}
              <div className="space-y-6 pt-16 text-center max-w-4xl mx-auto w-full">
                <div className="space-y-3">
                  <BilingualTextarea
                    value={reportData.coverTitle || 'PREVENTIVE MAINTENANCE REPORT\nLAPORAN PEMELIHARAAN PREVENTIF'}
                    onChange={(val) => {
                      const updated = { ...reportData };
                      updated.coverTitle = val;
                      setReportData(updated);
                    }}
                    placeholderEn="PREVENTIVE MAINTENANCE REPORT"
                    placeholderId="LAPORAN PEMELIHARAAN PREVENTIF (garis miring)..."
                    classNameEn="text-3xl sm:text-4xl lg:text-[40px] font-serif font-black text-slate-900 leading-tight w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none text-center uppercase tracking-wide"
                    classNameId="text-2xl sm:text-3xl lg:text-[32px] font-serif font-bold italic text-slate-600 leading-tight w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none text-center uppercase tracking-wide"
                    indentId={false}
                  />
                  <textarea
                    rows={reportData.coverSubtitle?.includes('\n') ? 2 : 1}
                    value={reportData.coverSubtitle || `${reportData.quarter}-${reportData.monthNameEn.toUpperCase()} ${reportData.year}`}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.coverSubtitle = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-2xl sm:text-3xl lg:text-[32px] font-serif font-black text-slate-900 w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none text-center uppercase tracking-wide mt-1 resize-none leading-tight"
                    placeholder="Quarter - Bulan Tahun..."
                  />
                </div>
                <div className="pt-2">
                  <input
                    type="text"
                    value={reportData.docCode.startsWith('Ref No:') ? reportData.docCode : `Ref No: ${reportData.docCode}`}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.docCode = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm sm:text-base font-serif text-slate-900 font-bold w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none text-center"
                    placeholder="Ref No: DME-TDE/MR/..."
                  />
                </div>
              </div>

              {/* Bottom Institutional Block (Centered) */}
              <div className="space-y-2 pb-28 text-center max-w-4xl mx-auto w-full">
                <input
                  type="text"
                  value={reportData.projectName}
                  onChange={(e) => {
                    const updated = { ...reportData };
                    updated.projectName = e.target.value;
                    setReportData(updated);
                  }}
                  className="text-2xl sm:text-3xl lg:text-[30px] font-serif font-black text-slate-900 w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none text-center"
                  placeholder="Lokasi Fasilitas..."
                />
                <input
                  type="text"
                  value={reportData.clientName}
                  onChange={(e) => {
                    const updated = { ...reportData };
                    updated.clientName = e.target.value;
                    setReportData(updated);
                  }}
                  className="text-xl sm:text-2xl lg:text-[26px] font-serif font-black text-slate-900 w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none text-center"
                  placeholder="Nama Klien..."
                />
              </div>
            </section>
          )}

          {/* ===================================================================
              PAGE 2: LEMBAR PENGESAHAN (APPROVAL SHEET)
              =================================================================== */}
          {(activeChapter === 0 || window.matchMedia('print').matches) && (
            <section className="space-y-8 border-b border-slate-200 pb-12 print:border-none print:page-break-after">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="text-center space-y-1 mb-8">
                <h2 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 tracking-tight">
                  APPROVAL SHEET
                </h2>
                <p className="text-base sm:text-lg font-serif italic text-slate-600">
                  LEMBAR PENGESAHAN
                </p>

                <div className="max-w-4xl mx-auto pt-4 px-2">
                  <BilingualTextarea
                    value={
                      reportData.approvalSheetStatement !== undefined
                        ? reportData.approvalSheetStatement
                        : `This Monthly Report for ${reportData.monthNameEn || 'July'} ${reportData.year || 2026} has been duly prepared, reviewed, and approved by the respective authorized parties as evidence of acknowledgment and acceptance of the activities and documentation presented herein.\nDemikian Monthly Report ${reportData.monthName || 'Juli'} ${reportData.year || 2026} ini telah disusun, diperiksa, dan disetujui oleh pihak-pihak yang berwenang sebagai bentuk pengesahan dan persetujuan atas seluruh kegiatan serta dokumentasi yang tercantum di dalam laporan ini.`
                    }
                    onChange={(val) => {
                      const updated = { ...reportData };
                      updated.approvalSheetStatement = val;
                      setReportData(updated);
                    }}
                    placeholderEn="Statement in English..."
                    placeholderId="Pernyataan dalam Bahasa Indonesia (garis miring)..."
                    classNameEn="text-center text-xs sm:text-[13px] font-serif text-slate-800 leading-relaxed bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none w-full"
                    classNameId="text-center text-[11px] sm:text-xs font-serif italic text-slate-600 leading-relaxed bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded p-1 outline-none w-full"
                    indentId={false}
                  />
                </div>
              </div>

              {/* 6-Signer Grid: 2 Columns x 3 Rows */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10 max-w-4xl mx-auto text-center font-serif">
                {/* Row 1: Prepared by Arif Budiman vs Reviewed by Dwi Tasmiyadi */}
                <div className="space-y-1">
                  <textarea
                    rows={reportData.approvalSheet.preparedBy.title?.includes('\n') ? 2 : 1}
                    value={reportData.approvalSheet.preparedBy.title || 'Prepared By'}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.preparedBy.title = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs font-bold text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white rounded outline-none p-0.5 resize-none leading-tight font-serif"
                  />
                  <div className="h-20 flex items-center justify-center">
                    <img src={ARIF_BUDIMAN_SIGNATURE_BASE64} alt="TTD Arif Budiman" className="h-16 object-contain" />
                  </div>
                  <input
                    type="text"
                    value={reportData.approvalSheet.preparedBy.name}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.preparedBy.name = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm font-bold text-slate-900 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                  <input
                    type="text"
                    value={reportData.approvalSheet.preparedBy.company}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.preparedBy.company = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                </div>

                <div className="space-y-1">
                  <textarea
                    rows={reportData.approvalSheet.reviewedBy1.title?.includes('\n') ? 2 : 1}
                    value={reportData.approvalSheet.reviewedBy1.title || 'Reviewed By'}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy1.title = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs font-bold text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white rounded outline-none p-0.5 resize-none leading-tight font-serif"
                  />
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-400">[ Signed ]</span>
                  </div>
                  <input
                    type="text"
                    value={reportData.approvalSheet.reviewedBy1.name}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy1.name = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm font-bold text-slate-900 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                  <input
                    type="text"
                    value={reportData.approvalSheet.reviewedBy1.company}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy1.company = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                </div>

                {/* Row 2: Reviewed by Habib Mulyana vs Supriyatno (OCS) */}
                <div className="space-y-1 pt-6">
                  <textarea
                    rows={reportData.approvalSheet.reviewedBy2.title?.includes('\n') ? 2 : 1}
                    value={reportData.approvalSheet.reviewedBy2.title || 'Reviewed By'}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy2.title = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs font-bold text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white rounded outline-none p-0.5 resize-none leading-tight font-serif"
                  />
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-400">[ Signed ]</span>
                  </div>
                  <input
                    type="text"
                    value={reportData.approvalSheet.reviewedBy2.name}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy2.name = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm font-bold text-slate-900 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                  <input
                    type="text"
                    value={reportData.approvalSheet.reviewedBy2.company}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy2.company = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                </div>

                <div className="space-y-1 pt-6">
                  <textarea
                    rows={reportData.approvalSheet.reviewedBy3.title?.includes('\n') ? 2 : 1}
                    value={reportData.approvalSheet.reviewedBy3.title || 'Reviewed By'}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy3.title = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs font-bold text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white rounded outline-none p-0.5 resize-none leading-tight font-serif"
                  />
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-400">[ Signed ]</span>
                  </div>
                  <input
                    type="text"
                    value={reportData.approvalSheet.reviewedBy3.name}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy3.name = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm font-bold text-slate-900 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                  <input
                    type="text"
                    value={reportData.approvalSheet.reviewedBy3.company}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.reviewedBy3.company = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                </div>

                {/* Row 3: Approved by Budi Susanto vs Rezki Rahman Daulay (TDE) */}
                <div className="space-y-1 pt-6">
                  <textarea
                    rows={reportData.approvalSheet.approvedBy1.title?.includes('\n') ? 2 : 1}
                    value={reportData.approvalSheet.approvedBy1.title || 'Approved By'}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.approvedBy1.title = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs font-bold text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white rounded outline-none p-0.5 resize-none leading-tight font-serif"
                  />
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-400">[ Approved ]</span>
                  </div>
                  <input
                    type="text"
                    value={reportData.approvalSheet.approvedBy1.name}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.approvedBy1.name = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm font-bold text-slate-900 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                  <input
                    type="text"
                    value={reportData.approvalSheet.approvedBy1.company}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.approvedBy1.company = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                </div>

                <div className="space-y-1 pt-6">
                  <textarea
                    rows={reportData.approvalSheet.approvedBy2.title?.includes('\n') ? 2 : 1}
                    value={reportData.approvalSheet.approvedBy2.title || 'Approved By'}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.approvedBy2.title = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs font-bold text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white rounded outline-none p-0.5 resize-none leading-tight font-serif"
                  />
                  <div className="h-20 flex items-center justify-center">
                    <span className="text-xs italic text-slate-400">[ Approved ]</span>
                  </div>
                  <input
                    type="text"
                    value={reportData.approvalSheet.approvedBy2.name}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.approvedBy2.name = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-sm font-bold text-slate-900 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                  <input
                    type="text"
                    value={reportData.approvalSheet.approvedBy2.company}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.approvalSheet.approvedBy2.company = e.target.value;
                      setReportData(updated);
                    }}
                    className="text-xs text-slate-600 text-center w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none p-0.5"
                  />
                </div>
              </div>

              <TelkomPageFooter pageNumber={2} />
            </section>
          )}

          {/* ===================================================================
              PAGE 3: TABLE OF CONTENTS (DAFTAR ISI) - FULLY EDITABLE
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 1 || window.matchMedia('print').matches) && (
            <section className="space-y-6 border-b border-slate-200 pb-12 print:border-none print:page-break-after font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between max-w-3xl mx-auto mb-4">
                <h2 className="text-2xl font-serif font-bold text-blue-900">
                  Table of Contents
                </h2>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    if (!updated.tableOfContents) {
                      updated.tableOfContents = [
                        { title: '1. Executive Summary', page: '5' },
                        { title: '2. Key Highlight', page: '5' },
                        { title: '3. General Information', page: '218' },
                        { title: '4. Maintenance Objectives', page: '218' },
                        { title: '5. Equipment and System Details', page: '220' },
                        { title: '6. Scope of Work', page: '238' },
                        { title: '7. Observation and Finding', page: '252' },
                        { title: '8. Repairs, Replacement & Services', page: '256' },
                        { title: '9. Testing & Validation', page: '258' },
                        { title: '10. Challenges, Mitigation and Lesson Learned', page: '259' },
                        { title: '11. Recommendations and Future Action', page: '264' },
                        { title: '12. Photo and Documentation Log', page: '265' },
                        { title: '13. Appendices', page: '268' }
                      ];
                    }
                    const nextNum = updated.tableOfContents.length + 1;
                    updated.tableOfContents.push({
                      title: `${nextNum}. Bab Baru`,
                      page: '270'
                    });
                    setReportData(updated);
                    toast.success('Bab baru ditambahkan ke Daftar Isi!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Bab</span>
                </button>
              </div>

              <div className="max-w-3xl mx-auto font-serif text-sm space-y-1.5 text-slate-800">
                {(reportData.tableOfContents || [
                  { title: '1. Executive Summary', page: '5' },
                  { title: '2. Key Highlight', page: '5' },
                  { title: '3. General Information', page: '218' },
                  { title: '4. Maintenance Objectives', page: '218' },
                  { title: '5. Equipment and System Details', page: '220' },
                  { title: '6. Scope of Work', page: '238' },
                  { title: '7. Observation and Finding', page: '252' },
                  { title: '8. Repairs, Replacement & Services', page: '256' },
                  { title: '9. Testing & Validation', page: '258' },
                  { title: '10. Challenges, Mitigation and Lesson Learned', page: '259' },
                  { title: '11. Recommendations and Future Action', page: '264' },
                  { title: '12. Photo and Documentation Log', page: '265' },
                  { title: '13. Appendices', page: '268' }
                ]).map((item, idx) => (
                  <div key={idx} className="group flex items-center justify-between border-b border-dotted border-black pb-1 gap-4">
                    <BilingualTextarea
                      value={item.title}
                      onChange={(val) => {
                        const updated = { ...reportData };
                        if (!updated.tableOfContents) {
                          updated.tableOfContents = [
                            { title: '1. Executive Summary\nRingkasan Eksekutif', page: '5' },
                            { title: '2. Key Highlight\nSorotan Utama & Jadwal Pemeliharaan', page: '5' },
                            { title: '3. General Information\nInformasi Umum & Tim Pemeliharaan', page: '218' },
                            { title: '4. Maintenance Objectives\nTujuan Pemeliharaan & Indikator Kinerja', page: '218' },
                            { title: '5. Equipment and System Details\nDetail Peralatan dan Daftar Aset', page: '220' },
                            { title: '6. Scope of Work\nRuang Lingkup Pekerjaan Pemeliharaan', page: '238' },
                            { title: '7. Observation and Finding\nObservasi Lapangan & Temuan Inspeksi', page: '252' },
                            { title: '8. Repairs, Replacement & Services\nPerbaikan, Penggantian Suku Cadang & Servis', page: '256' },
                            { title: '9. Testing & Validation\nPengujian & Validasi Metode Kerja', page: '258' },
                            { title: '10. Challenges, Mitigation and Lesson Learned\nTantangan, Langkah Mitigasi & Pembelajaran', page: '259' },
                            { title: '11. Recommendations and Future Action\nRekomendasi & Rencana Tindak Lanjut', page: '264' },
                            { title: '12. Photo and Documentation Log\nLog Foto dan Dokumentasi Visual', page: '265' },
                            { title: '13. Appendices\nLampiran Dokumen Servis Resmi', page: '268' }
                          ];
                        }
                        updated.tableOfContents[idx].title = val;
                        setReportData(updated);
                      }}
                      placeholderEn="Chapter Title..."
                      placeholderId="Judul Bab Bahasa Indonesia (garis miring)..."
                      classNameEn="font-bold text-slate-900 text-sm bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 outline-none font-serif leading-tight"
                      classNameId="italic text-slate-600 text-xs bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 outline-none font-serif leading-tight"
                      containerClassName="flex-1 flex flex-col space-y-0.5"
                      indentId={true}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.page}
                        onChange={(e) => {
                          const updated = { ...reportData };
                          if (!updated.tableOfContents) {
                            updated.tableOfContents = [
                              { title: '1. Executive Summary', page: '5' },
                              { title: '2. Key Highlight', page: '5' },
                              { title: '3. General Information', page: '218' },
                              { title: '4. Maintenance Objectives', page: '218' },
                              { title: '5. Equipment and System Details', page: '220' },
                              { title: '6. Scope of Work', page: '238' },
                              { title: '7. Observation and Finding', page: '252' },
                              { title: '8. Repairs, Replacement & Services', page: '256' },
                              { title: '9. Testing & Validation', page: '258' },
                              { title: '10. Challenges, Mitigation and Lesson Learned', page: '259' },
                              { title: '11. Recommendations and Future Action', page: '264' },
                              { title: '12. Photo and Documentation Log', page: '265' },
                              { title: '13. Appendices', page: '268' }
                            ];
                          }
                          updated.tableOfContents[idx].page = e.target.value;
                          setReportData(updated);
                        }}
                        className="font-bold text-slate-800 w-16 text-right bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 outline-none"
                      />
                      <button
                        onClick={() => {
                          const defaultTOC = [
                            { title: '1. Executive Summary', page: '5' },
                            { title: '2. Key Highlight', page: '5' },
                            { title: '3. General Information', page: '218' },
                            { title: '4. Maintenance Objectives', page: '218' },
                            { title: '5. Equipment and System Details', page: '220' },
                            { title: '6. Scope of Work', page: '238' },
                            { title: '7. Observation and Finding', page: '252' },
                            { title: '8. Repairs, Replacement & Services', page: '256' },
                            { title: '9. Testing & Validation', page: '258' },
                            { title: '10. Challenges, Mitigation and Lesson Learned', page: '259' },
                            { title: '11. Recommendations and Future Action', page: '264' },
                            { title: '12. Photo and Documentation Log', page: '265' },
                            { title: '13. Appendices', page: '268' }
                          ];
                          setReportData(prev => {
                            if (!prev) return prev;
                            const currentTOC = prev.tableOfContents && prev.tableOfContents.length > 0
                              ? prev.tableOfContents
                              : defaultTOC;
                            return { ...prev, tableOfContents: currentTOC.filter((_, i) => i !== idx) };
                          });
                          toast.info('Bab dihapus dari Daftar Isi.');
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 transition-opacity cursor-pointer print:hidden"
                        title="Hapus bab"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <TelkomPageFooter pageNumber={3} />
            </section>
          )}

          {/* ===================================================================
              LIST OF TABLES (DAFTAR TABEL) - FULLY EDITABLE
              =================================================================== */}
          {(activeChapter === 0 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif pt-8 border-t border-slate-200">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-center text-[#0066B3] flex-1">
                  List of Tables
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...reportData };
                    const currentTables = updated.listOfTables ? [...updated.listOfTables] : [
                      { title: `Table 1. Schedule Maintenance – ${reportData.monthNameEn} ${reportData.year}`, page: '5' },
                      { title: 'Table 2. Task Performance – Chiller System', page: '6' },
                      { title: 'Table 3. Task Performance – Cooling Tower & Piping', page: '8' },
                      { title: 'Table 4. Task Performance – Cooling Pump', page: '10' },
                      { title: 'Table 5. Task Performance – Transformer', page: '12' },
                      { title: 'Table 6. Task Performance – Generator & Fuel System', page: '14' },
                      { title: 'Table 7. Task Performance – MV & RMU Panel', page: '16' },
                      { title: 'Table 8. Task Performance – LV Panel', page: '18' },
                      { title: 'Table 9. Task Performance – UPS & Battery Bank', page: '20' },
                      { title: 'Table 10. Task Performance – Power Distribution Unit (PDU)', page: '22' },
                      { title: 'Table 11. Task Performance – PAC / CRAC Precision Cooling', page: '24' },
                      { title: 'Table 12. Task Performance – Fire Alarm & Suppression', page: '26' },
                      { title: 'Table 13. Task Performance – VESDA Early Warning', page: '28' },
                      { title: 'Table 14. Task Performance – Access Control & CCTV', page: '30' },
                      { title: 'Table 15. Task Performance – Lightning Protection & Grounding', page: '32' },
                      { title: 'Table 16. Task Performance – Building Automation System (BAS)', page: '34' },
                      { title: 'Table 17. Task Performance – Water Treatment Plant', page: '36' },
                      { title: 'Table 18. Team Composition', page: '218' },
                      { title: 'Table 19. KPI Metric', page: '218' },
                      { title: 'Table 20. Equipment and System Details', page: '220' },
                      { title: 'Table 21. System Overview', page: '236' },
                      { title: 'Table 22. Scope of Work', page: '238' },
                      { title: 'Table 23. Observation & Finding', page: '252' },
                      { title: 'Table 24. Root Cause Analysis – Electrical System', page: '253' },
                      { title: 'Table 25. Root Cause Analysis – Cooling System', page: '254' },
                      { title: 'Table 26. Root Cause Analysis – Fire & Safety System', page: '254' },
                      { title: 'Table 27. Root Cause Analysis – Civil & Architectural', page: '255' },
                      { title: 'Table 28. Finding Severity Matrix', page: '255' },
                      { title: 'Table 29. Repair, Replacement & Services', page: '256' },
                      { title: 'Table 30. Calibration and Adjustments Performed', page: '258' },
                      { title: 'Table 31. Validation Methods', page: '258' },
                      { title: 'Table 32. Challenges Faced', page: '259' },
                      { title: 'Table 33. Mitigation Steps', page: '261' },
                      { title: 'Table 34. Lessons Learned', page: '263' },
                      { title: 'Table 35. Recommendations and Future Action', page: '264' },
                      { title: 'Table 36. Photo and Documentation Log', page: '265' }
                    ];
                    const nextNo = currentTables.length + 1;
                    currentTables.push({
                      title: `Table ${nextNo}. Judul Tabel Tambahan`,
                      page: '1'
                    });
                    updated.listOfTables = currentTables;
                    setReportData(updated);
                    toast.success('Tabel baru berhasil ditambahkan ke List of Tables!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Tabel</span>
                </button>
              </div>

              <div className="space-y-1 text-sm max-w-3xl mx-auto divide-y divide-slate-100">
                {(reportData.listOfTables || [
                  { title: `Table 1. Schedule Maintenance – ${reportData.monthNameEn} ${reportData.year}`, page: '5' },
                  { title: 'Table 2. Task Performance – Chiller System', page: '6' },
                  { title: 'Table 3. Task Performance – Cooling Tower & Piping', page: '8' },
                  { title: 'Table 4. Task Performance – Cooling Pump', page: '10' },
                  { title: 'Table 5. Task Performance – Transformer', page: '12' },
                  { title: 'Table 6. Task Performance – Generator & Fuel System', page: '14' },
                  { title: 'Table 7. Task Performance – MV & RMU Panel', page: '16' },
                  { title: 'Table 8. Task Performance – LV Panel', page: '18' },
                  { title: 'Table 9. Task Performance – UPS & Battery Bank', page: '20' },
                  { title: 'Table 10. Task Performance – Power Distribution Unit (PDU)', page: '22' },
                  { title: 'Table 11. Task Performance – PAC / CRAC Precision Cooling', page: '24' },
                  { title: 'Table 12. Task Performance – Fire Alarm & Suppression', page: '26' },
                  { title: 'Table 13. Task Performance – VESDA Early Warning', page: '28' },
                  { title: 'Table 14. Task Performance – Access Control & CCTV', page: '30' },
                  { title: 'Table 15. Task Performance – Lightning Protection & Grounding', page: '32' },
                  { title: 'Table 16. Task Performance – Building Automation System (BAS)', page: '34' },
                  { title: 'Table 17. Task Performance – Water Treatment Plant', page: '36' },
                  { title: 'Table 18. Team Composition', page: '218' },
                  { title: 'Table 19. KPI Metric', page: '218' },
                  { title: 'Table 20. Equipment and System Details', page: '220' },
                  { title: 'Table 21. System Overview', page: '236' },
                  { title: 'Table 22. Scope of Work', page: '238' },
                  { title: 'Table 23. Observation & Finding', page: '252' },
                  { title: 'Table 24. Root Cause Analysis – Electrical System', page: '253' },
                  { title: 'Table 25. Root Cause Analysis – Cooling System', page: '254' },
                  { title: 'Table 26. Root Cause Analysis – Fire & Safety System', page: '254' },
                  { title: 'Table 27. Root Cause Analysis – Civil & Architectural', page: '255' },
                  { title: 'Table 28. Finding Severity Matrix', page: '255' },
                  { title: 'Table 29. Repair, Replacement & Services', page: '256' },
                  { title: 'Table 30. Calibration and Adjustments Performed', page: '258' },
                  { title: 'Table 31. Validation Methods', page: '258' },
                  { title: 'Table 32. Challenges Faced', page: '259' },
                  { title: 'Table 33. Mitigation Steps', page: '261' },
                  { title: 'Table 34. Lessons Learned', page: '263' },
                  { title: 'Table 35. Recommendations and Future Action', page: '264' },
                  { title: 'Table 36. Photo and Documentation Log', page: '265' }
                ]).map((item, idx) => (
                  <div key={idx} className="group flex items-center justify-between gap-4 py-1.5 hover:bg-blue-50/40 px-2 rounded-lg transition-colors">
                    <BilingualTextarea
                      value={item.title}
                      onChange={(val) => {
                        const updated = { ...reportData };
                        const list = updated.listOfTables ? [...updated.listOfTables] : [];
                        list[idx].title = val;
                        updated.listOfTables = list;
                        setReportData(updated);
                      }}
                      placeholderEn="Table Title..."
                      placeholderId="Judul Tabel Bahasa Indonesia (garis miring)..."
                      classNameEn="font-medium text-slate-900 text-sm bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 outline-none font-serif leading-tight"
                      classNameId="italic text-slate-600 text-xs bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 outline-none font-serif leading-tight"
                      containerClassName="flex-1 flex flex-col space-y-0.5"
                      indentId={true}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.page}
                        onChange={(e) => {
                          const updated = { ...reportData };
                          const list = updated.listOfTables ? [...updated.listOfTables] : [
                            { title: `Table 1. Schedule Maintenance – ${reportData.monthNameEn} ${reportData.year}`, page: '5' },
                            { title: 'Table 2. Task Performance – Chiller System', page: '6' },
                            { title: 'Table 3. Task Performance – Cooling Tower & Piping', page: '8' },
                            { title: 'Table 4. Task Performance – Cooling Pump', page: '10' },
                            { title: 'Table 5. Task Performance – Transformer', page: '12' },
                            { title: 'Table 6. Task Performance – Generator & Fuel System', page: '14' },
                            { title: 'Table 7. Task Performance – MV & RMU Panel', page: '16' },
                            { title: 'Table 8. Task Performance – LV Panel', page: '18' },
                            { title: 'Table 9. Task Performance – UPS & Battery Bank', page: '20' },
                            { title: 'Table 10. Task Performance – Power Distribution Unit (PDU)', page: '22' },
                            { title: 'Table 11. Task Performance – PAC / CRAC Precision Cooling', page: '24' },
                            { title: 'Table 12. Task Performance – Fire Alarm & Suppression', page: '26' },
                            { title: 'Table 13. Task Performance – VESDA Early Warning', page: '28' },
                            { title: 'Table 14. Task Performance – Access Control & CCTV', page: '30' },
                            { title: 'Table 15. Task Performance – Lightning Protection & Grounding', page: '32' },
                            { title: 'Table 16. Task Performance – Building Automation System (BAS)', page: '34' },
                            { title: 'Table 17. Task Performance – Water Treatment Plant', page: '36' },
                            { title: 'Table 18. Team Composition', page: '218' },
                            { title: 'Table 19. KPI Metric', page: '218' },
                            { title: 'Table 20. Equipment and System Details', page: '220' },
                            { title: 'Table 21. System Overview', page: '236' },
                            { title: 'Table 22. Scope of Work', page: '238' },
                            { title: 'Table 23. Observation & Finding', page: '252' },
                            { title: 'Table 24. Root Cause Analysis – Electrical System', page: '253' },
                            { title: 'Table 25. Root Cause Analysis – Cooling System', page: '254' },
                            { title: 'Table 26. Root Cause Analysis – Fire & Safety System', page: '254' },
                            { title: 'Table 27. Root Cause Analysis – Civil & Architectural', page: '255' },
                            { title: 'Table 28. Finding Severity Matrix', page: '255' },
                            { title: 'Table 29. Repair, Replacement & Services', page: '256' },
                            { title: 'Table 30. Calibration and Adjustments Performed', page: '258' },
                            { title: 'Table 31. Validation Methods', page: '258' },
                            { title: 'Table 32. Challenges Faced', page: '259' },
                            { title: 'Table 33. Mitigation Steps', page: '261' },
                            { title: 'Table 34. Lessons Learned', page: '263' },
                            { title: 'Table 35. Recommendations and Future Action', page: '264' },
                            { title: 'Table 36. Photo and Documentation Log', page: '265' }
                          ];
                          list[idx].page = e.target.value;
                          updated.listOfTables = list;
                          setReportData(updated);
                        }}
                        className="font-bold text-slate-800 w-16 text-right bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 outline-none"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const defaultLOT = [
                            { title: `Table 1. Schedule Maintenance – ${reportData.monthNameEn} ${reportData.year}`, page: '5' },
                            { title: 'Table 2. Task Performance – Chiller System', page: '6' },
                            { title: 'Table 3. Task Performance – Cooling Tower & Piping', page: '8' },
                            { title: 'Table 4. Task Performance – Cooling Pump', page: '10' },
                            { title: 'Table 5. Task Performance – Transformer', page: '12' },
                            { title: 'Table 6. Task Performance – Generator & Fuel System', page: '14' },
                            { title: 'Table 7. Task Performance – MV & RMU Panel', page: '16' },
                            { title: 'Table 8. Task Performance – LV Panel', page: '18' },
                            { title: 'Table 9. Task Performance – UPS & Battery Bank', page: '20' },
                            { title: 'Table 10. Task Performance – Power Distribution Unit (PDU)', page: '22' },
                            { title: 'Table 11. Task Performance – PAC / CRAC Precision Cooling', page: '24' },
                            { title: 'Table 12. Task Performance – Fire Alarm & Suppression', page: '26' },
                            { title: 'Table 13. Task Performance – VESDA Early Warning', page: '28' },
                            { title: 'Table 14. Task Performance – Access Control & CCTV', page: '30' },
                            { title: 'Table 15. Task Performance – Lightning Protection & Grounding', page: '32' },
                            { title: 'Table 16. Task Performance – Building Automation System (BAS)', page: '34' },
                            { title: 'Table 17. Task Performance – Water Treatment Plant', page: '36' },
                            { title: 'Table 18. Team Composition', page: '218' },
                            { title: 'Table 19. KPI Metric', page: '218' },
                            { title: 'Table 20. Equipment and System Details', page: '220' },
                            { title: 'Table 21. System Overview', page: '236' },
                            { title: 'Table 22. Scope of Work', page: '238' },
                            { title: 'Table 23. Observation & Finding', page: '252' },
                            { title: 'Table 24. Root Cause Analysis – Electrical System', page: '253' },
                            { title: 'Table 25. Root Cause Analysis – Cooling System', page: '254' },
                            { title: 'Table 26. Root Cause Analysis – Fire & Safety System', page: '254' },
                            { title: 'Table 27. Root Cause Analysis – Civil & Architectural', page: '255' },
                            { title: 'Table 28. Finding Severity Matrix', page: '255' },
                            { title: 'Table 29. Repair, Replacement & Services', page: '256' },
                            { title: 'Table 30. Calibration and Adjustments Performed', page: '258' },
                            { title: 'Table 31. Validation Methods', page: '258' },
                            { title: 'Table 32. Challenges Faced', page: '259' },
                            { title: 'Table 33. Mitigation Steps', page: '261' },
                            { title: 'Table 34. Lessons Learned', page: '263' },
                            { title: 'Table 35. Recommendations and Future Action', page: '264' },
                            { title: 'Table 36. Photo and Documentation Log', page: '265' }
                          ];
                          setReportData(prev => {
                            if (!prev) return prev;
                            const currentList = prev.listOfTables && prev.listOfTables.length > 0
                              ? prev.listOfTables
                              : defaultLOT;
                            return { ...prev, listOfTables: currentList.filter((_, i) => i !== idx) };
                          });
                          toast.info('Tabel dihapus dari List of Tables.');
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 transition-opacity cursor-pointer print:hidden"
                        title="Hapus baris tabel"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <TelkomPageFooter pageNumber={4} />
            </section>
          )}

          {/* ===================================================================
              BAB 1 & BAB 2: EXECUTIVE SUMMARY & KEY HIGHLIGHT (TABEL 1 - 17) - FULLY EDITABLE
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 1 || activeChapter === 2 || window.matchMedia('print').matches) && (
            <section className="space-y-6">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="font-serif space-y-4 text-slate-800 leading-relaxed text-sm">
                <h2 className="text-[11pt] font-bold text-slate-900">1. Executive Summary</h2>
                <BilingualTextarea
                  value={reportData.executiveSummaryText !== undefined ? reportData.executiveSummaryText : 'Maintenance is a series of activities to maintain facilities and equipment so that they are always ready to use to carry out production effectively and efficiently according to the schedule that has been set and based on standards (functional and quality). The term maintenance comes from the Greek word tera which means to care for, maintain, and maintain. Maintenance is a system consisting of several elements in the form of facilities (machines), replacement of components or spare parts (materials), maintenance costs (money), maintenance activity planning (method) and maintenance executors (man).'}
                  onChange={(val) => {
                    const updated = { ...reportData };
                    updated.executiveSummaryText = val;
                    setReportData(updated);
                  }}
                  placeholderEn="Executive summary narrative in English..."
                  placeholderId="Narasi ringkasan eksekutif Bahasa Indonesia (garis miring)..."
                  classNameEn="w-full text-sm font-serif leading-relaxed text-slate-800 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded-lg p-2 outline-none"
                  classNameId="w-full text-xs font-serif italic leading-relaxed text-slate-600 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded-lg p-2 outline-none"
                  indentId={true}
                />

                <div className="flex items-center justify-between pt-2">
                  <BilingualTextarea
                    value={reportData.purposeOfReportTitle || 'Purpose of Report'}
                    onChange={(val) => {
                      const updated = { ...reportData };
                      updated.purposeOfReportTitle = val;
                      setReportData(updated);
                    }}
                    placeholderEn="Purpose of Report"
                    placeholderId="Tujuan Laporan (garis miring)..."
                    classNameEn="text-base font-bold text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none leading-tight font-serif"
                    classNameId="text-xs italic font-semibold text-slate-600 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none leading-tight font-serif"
                    containerClassName="flex-1 flex flex-col space-y-0.5"
                    indentId={true}
                  />
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      if (!updated.purposePoints) {
                        updated.purposePoints = [
                          { title: 'Documentation of Preventive Maintenance Activities:\nDokumentasi Kegiatan Pemeliharaan Preventif:', desc: 'Records all PM activities that have been carried out for one month.\nMencatat seluruh aktivitas PM yang telah dilaksanakan selama satu bulan.' },
                          { title: 'Equipment and System Performance Evaluation:\nEvaluasi Kinerja Peralatan dan Sistem:', desc: 'Assess the condition of equipment based on inspection and maintenance results.\nMenilai kondisi fisik dan performa operasional peralatan berdasarkan hasil inspeksi.' },
                          { title: 'Reporting to Management:\nPelaporan kepada Manajemen Fasilitas:', desc: 'Provides management with a comprehensive overview of the condition of the facility.\nMemberikan gambaran menyeluruh kepada manajemen mengenai keandalan fasilitas.' },
                          { title: 'Ensure Compliance with Procedures and Standards:\nMemastikan Kepatuhan terhadap Prosedur dan Standar:', desc: 'Prove that PM activities are carried out in accordance with applicable Procedures.\nMemverifikasi bahwa kegiatan PM dilaksanakan sesuai prosedur resmi data center.' }
                        ];
                      }
                      updated.purposePoints.push({
                        title: 'Technical Compliance Assurance:\nJaminan Kepatuhan Teknis:',
                        desc: 'Maintain zero-interruption uptime and regulatory data center compliance.\nMenjaga ketersediaan tanpa jeda dan kepatuhan regulasi operasional fasilitas.'
                      });
                      setReportData(updated);
                      toast.success('Poin tujuan berhasil ditambahkan!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Poin Tujuan</span>
                  </button>
                </div>

                <BilingualTextarea
                  value={reportData.purposeOfReportIntro !== undefined ? reportData.purposeOfReportIntro : 'To document, evaluate, and ensure that maintenance activities run according to plans and operational standards such as:'}
                  onChange={(val) => {
                    const updated = { ...reportData };
                    updated.purposeOfReportIntro = val;
                    setReportData(updated);
                  }}
                  placeholderEn="To document, evaluate, and ensure that maintenance activities..."
                  placeholderId="Untuk mendokumentasikan, mengevaluasi... (garis miring)"
                  classNameEn="w-full text-sm font-serif text-slate-800 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 outline-none"
                  classNameId="w-full text-xs font-serif italic text-slate-600 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 outline-none"
                  indentId={true}
                />

                <ol className="list-decimal pl-6 space-y-3">
                  {(reportData.purposePoints || [
                    { title: 'Documentation of Preventive Maintenance Activities:\nDokumentasi Kegiatan Pemeliharaan Preventif:', desc: 'Records all PM activities that have been carried out for one month.\nMencatat seluruh aktivitas PM yang telah dilaksanakan selama satu bulan.' },
                    { title: 'Equipment and System Performance Evaluation:\nEvaluasi Kinerja Peralatan dan Sistem:', desc: 'Assess the condition of equipment based on inspection and maintenance results.\nMenilai kondisi fisik dan performa operasional peralatan berdasarkan hasil inspeksi.' },
                    { title: 'Reporting to Management:\nPelaporan kepada Manajemen Fasilitas:', desc: 'Provides management with a comprehensive overview of the condition of the facility.\nMemberikan gambaran menyeluruh kepada manajemen mengenai keandalan fasilitas.' },
                    { title: 'Ensure Compliance with Procedures and Standards:\nMemastikan Kepatuhan terhadap Prosedur dan Standar:', desc: 'Prove that PM activities are carried out in accordance with applicable Procedures.\nMemverifikasi bahwa kegiatan PM dilaksanakan sesuai prosedur resmi data center.' }
                  ]).map((pt, pIdx) => (
                    <li key={pIdx} className="group relative pr-8">
                      <div className="space-y-1">
                        <BilingualTextarea
                          value={pt.title}
                          onChange={(val) => {
                            const updated = { ...reportData };
                            if (!updated.purposePoints) updated.purposePoints = [];
                            updated.purposePoints[pIdx].title = val;
                            setReportData(updated);
                          }}
                          placeholderEn="Purpose Title in English..."
                          placeholderId="Judul Tujuan Bahasa Indonesia (garis miring)..."
                          classNameEn="font-bold text-slate-900 w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none text-sm leading-tight font-serif"
                          classNameId="italic font-semibold text-slate-600 w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none text-xs leading-tight font-serif"
                          indentId={true}
                        />
                        <BilingualTextarea
                          value={pt.desc}
                          onChange={(val) => {
                            const updated = { ...reportData };
                            if (!updated.purposePoints) updated.purposePoints = [];
                            updated.purposePoints[pIdx].desc = val;
                            setReportData(updated);
                          }}
                          placeholderEn="Purpose Description in English..."
                          placeholderId="Deskripsi Tujuan Bahasa Indonesia (garis miring)..."
                          classNameEn="w-full text-slate-800 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none text-xs leading-relaxed font-serif"
                          classNameId="w-full text-slate-600 italic bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none text-[11.5px] leading-relaxed font-serif"
                          indentId={true}
                        />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const defaultPoints = [
                            { title: 'Documentation of Preventive Maintenance Activities:', desc: 'Records all PM activities that have been carried out for one month. Include details such as schedule, equipment maintained, methods used, inspection results, and corrective actions if any.' },
                            { title: 'Equipment and System Performance Evaluation:', desc: 'Assess the condition of equipment based on inspection and maintenance results.' },
                            { title: 'Reporting to Management:', desc: 'Provides management with a comprehensive overview of the condition of the facility and the effectiveness of the PM program.' },
                            { title: 'Ensure Compliance with Procedures and Standards:', desc: 'Prove that PM activities are carried out in accordance with applicable Procedures and regulations (e.g. national/international standards).' }
                          ];
                          setReportData(prev => {
                            if (!prev) return prev;
                            const curPoints = prev.purposePoints && prev.purposePoints.length > 0
                              ? prev.purposePoints
                              : defaultPoints;
                            return { ...prev, purposePoints: curPoints.filter((_, i) => i !== pIdx) };
                          });
                          toast.info('Poin tujuan dihapus.');
                        }}
                        className="absolute right-0 top-1 opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 transition-opacity cursor-pointer print:hidden"
                        title="Hapus poin"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
                      </button>
                    </li>
                  ))}
                </ol>

                <div className="pt-6 flex items-center justify-between">
                  <h2 className="text-[11pt] font-bold text-slate-900">2. Key Highlight</h2>
                  <span className="text-[11px] text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 font-sans font-medium print:hidden">
                    💡 Klik kolom Actual / Status untuk mengedit
                  </span>
                </div>

                <p className="font-bold text-center text-slate-900 text-sm my-3">
                  Table 1. Schedule Maintenance – {reportData.monthNameEn} {reportData.year}
                </p>
              </div>

              {/* Tabel 1: Schedule Maintenance - Deep Blue Header & Fully Editable */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-sans">
                  💡 Semua kolom tabel (Device, Lokasi, Plan, Actual, Status) dapat diedit langsung.
                </span>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    const newNo = updated.scheduleTable1.length + 1;
                    updated.scheduleTable1.push({
                      no: newNo,
                      device: 'New Equipment',
                      location: 'Campus Area',
                      maintenancePartner: 'PT. Dwimitra Ekatama Mandiri',
                      plan: `01 - 05 ${reportData.monthNameEn}`,
                      actual: '',
                      status: '',
                      engineerAccount: 'PT. Dwimitra Ekatama Mandiri'
                    });
                    setReportData(updated);
                    toast.success('Baris jadwal baru berhasil ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris Jadwal</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-black shadow-sm">
                <table className="w-full text-center text-xs font-serif border-collapse">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-black align-middle w-[20%]">Device</th>
                      <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-black align-middle w-[18%]">Location</th>
                      <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-black align-middle w-[26%]">Maintenance Partner</th>
                      <th colSpan={2} className="py-1.5 px-3 text-center border-r border-black font-bold">{reportData.monthNameEn}</th>
                      <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-black align-middle w-[14%]">Status</th>
                      <th rowSpan={2} className="py-2.5 px-2 text-center w-10 border-black align-middle print:hidden">Aksi</th>
                    </tr>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-1.5 px-2 text-center border-r border-black w-[11%]">Plan</th>
                      <th className="py-1.5 px-2 text-center border-r border-black w-[11%]">Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-900">
                    {reportData.scheduleTable1.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30">
                        <td className="py-1.5 px-2 font-bold border-r border-black text-center">
                          <input
                            type="text"
                            value={item.device}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.scheduleTable1[idx].device = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none text-center"
                          />
                        </td>
                        <td className="py-1.5 px-2 border-r border-black text-center">
                          <input
                            type="text"
                            value={item.location}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.scheduleTable1[idx].location = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none text-center"
                          />
                        </td>
                        <td className="py-1.5 px-2 border-r border-black text-center">
                          <input
                            type="text"
                            value={item.maintenancePartner}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.scheduleTable1[idx].maintenancePartner = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none text-center"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black">
                          <input
                            type="text"
                            value={item.plan}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.scheduleTable1[idx].plan = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-center text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black">
                          <input
                            type="text"
                            value={item.actual}
                            placeholder="Input actual..."
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.scheduleTable1[idx].actual = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-center text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none placeholder:italic placeholder:text-slate-300 font-medium"
                          />
                        </td>
                        <td className="py-1 px-1 text-center border-r border-black">
                          <BilingualTextarea
                            value={item.status}
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.scheduleTable1[idx].status = val;
                              setReportData(updated);
                            }}
                            placeholderEn="Status (EN)..."
                            placeholderId="Status (ID - garis miring)..."
                            classNameEn="w-full text-center text-xs font-semibold py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            classNameId="w-full text-center text-[10px] italic text-slate-500 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            indentId={false}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setReportData(prev => {
                                if (!prev) return prev;
                                const newSched = (prev.scheduleTable1 || [])
                                  .filter((_, i) => i !== idx)
                                  .map((s, i) => ({ ...s, no: i + 1 }));
                                return { ...prev, scheduleTable1: newSched };
                              });
                              toast.info('Baris jadwal dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Task Performance Scope Tables (Tabel 2 - 17) */}
              <div className="space-y-8 pt-8">
                {/* Header with Tambah Tabel Scope Baru button */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-gradient-to-r from-blue-50/70 to-slate-50 border border-blue-200/80 rounded-2xl print:hidden shadow-xs">
                  <div>
                    <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span>Daftar Tabel Task Performance ({reportData.taskPerformanceTables?.length || 0} Scope)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tabel scope pemeliharaan preventif. Anda dapat menambah atau memulihkan tabel scope dari BOQ.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewScopeSearchQuery('');
                      setIsAddScopeTableModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold font-sans shadow-sm transition-all cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Tabel Scope Baru dari BOQ</span>
                  </button>
                </div>

                {reportData.taskPerformanceTables.map((tTable, tIdx) => (
                  <div key={tIdx} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900 text-sm font-serif">
                        {tTable.title}
                      </p>
                      <div className="flex items-center gap-2 print:hidden">
                        <button
                          type="button"
                          onClick={() => handleOpenAddToolModal(tIdx, tTable.scope, tTable.title)}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Tambah Alat {tTable.scope}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (window.confirm(`Hapus seluruh tabel "${tTable.title}"?`)) {
                              setReportData(prev => {
                                if (!prev) return prev;
                                const newTables = (prev.taskPerformanceTables || [])
                                  .filter((_, i) => i !== tIdx)
                                  .map((tbl, i) => ({
                                    ...tbl,
                                    tableNo: i + 2,
                                    title: `Table ${i + 2}. Total Task Performance ${tbl.scope}`
                                  }));
                                return { ...prev, taskPerformanceTables: newTables };
                              });
                              toast.info(`Tabel "${tTable.title}" berhasil dihapus.`);
                            }
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer"
                          title="Hapus tabel ini"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus Tabel</span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-black">
                      <table className="w-full text-left text-[11px] font-serif border-collapse">
                        <thead>
                          <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                            <th className="py-2.5 px-2 text-center w-8 border-r border-black">No</th>
                            <th className="py-2.5 px-2 border-r border-black w-28">Class Name</th>
                            <th className="py-2.5 px-2 border-r border-black w-24">Capacity</th>
                            <th className="py-2.5 px-2 border-r border-black w-28">Location</th>
                            <th className="py-2.5 px-2 border-r border-black w-24">Product Name</th>
                            <th className="py-2.5 px-2 border-r border-black">Task Preventive Maintenance</th>
                            <th className="py-2.5 px-2 border-r border-black min-w-[135px] w-36">Critical Repairs</th>
                            <th className="py-2.5 px-2 border-r border-black w-28">Operational Status</th>
                            <th className="py-2.5 px-2 border-r border-black w-28">Issues</th>
                            <th className="py-2.5 px-2 w-28 border-r border-black">Recommendations</th>
                            <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black text-slate-800">
                          {tTable.items.map((item, iIdx) => (
                            <tr key={iIdx} className="hover:bg-blue-50/20">
                              <td className="py-2 px-1 text-center font-bold border-r border-black">{item.no}</td>
                              <td className="py-1 px-1 border-r border-black font-bold">
                                <input
                                  type="text"
                                  value={item.className}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].className = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-[11px] font-bold py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black">
                                <input
                                  type="text"
                                  value={item.capacity}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].capacity = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-[11px] py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black">
                                <input
                                  type="text"
                                  value={item.location}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].location = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-[11px] py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black font-bold">
                                <input
                                  type="text"
                                  value={item.productName}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].productName = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-[11px] font-bold py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black text-[10px]">
                                <BilingualTextarea
                                  value={item.taskPM}
                                  placeholderEn="Task Preventive Maintenance (English)..."
                                  placeholderId="Pemeliharaan Preventif (Bahasa Indonesia - garis miring)..."
                                  onChange={(val) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].taskPM = val;
                                    setReportData(updated);
                                  }}
                                  classNameEn="w-full text-[10px] leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans text-slate-800"
                                  classNameId="w-full text-[9.5px] italic text-slate-600 leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans"
                                  indentId={true}
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black text-[10px]">
                                <BilingualTextarea
                                  value={item.criticalRepairs}
                                  placeholderEn="No critical repair..."
                                  placeholderId="Tidak ada perbaikan... (garis miring)"
                                  onChange={(val) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].criticalRepairs = val;
                                    setReportData(updated);
                                  }}
                                  classNameEn="w-full text-[10px] leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans text-slate-800"
                                  classNameId="w-full text-[9.5px] italic text-slate-600 leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans"
                                  indentId={true}
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black font-semibold text-[10px]">
                                {(() => {
                                  const status = (item.operationalStatus || '').replace(/\r\n/g, '\n').trim();
                                  const statusLower = status.toLowerCase();

                                  const isNotGoodPreset = (item as any).statusMode === 'not_good' ||
                                    statusLower.includes('not good') ||
                                    statusLower.includes('tidak baik') ||
                                    statusLower.includes('abnormal') ||
                                    statusLower.includes('rusak');

                                  const isGoodPreset = (item as any).statusMode === 'good' ||
                                    (!isNotGoodPreset && (
                                      statusLower.includes('good condition') ||
                                      statusLower.includes('kondisi baik') ||
                                      statusLower === 'good' ||
                                      statusLower === 'baik' ||
                                      statusLower === 'normal'
                                    ));

                                  // Determine mode: if explicit item.statusMode exists, use it; otherwise infer from text
                                  const selectValue: 'good' | 'not_good' | 'custom' =
                                    (item as any).statusMode || (isNotGoodPreset ? 'not_good' : isGoodPreset ? 'good' : (status ? 'custom' : 'good'));

                                  const isGood = selectValue === 'good';
                                  const isNotGood = selectValue === 'not_good';
                                  const isCustom = selectValue === 'custom';

                                  return (
                                    <div className="flex flex-col space-y-1">
                                      {/* Dropdown Selector */}
                                      <div className="print:hidden">
                                        <select
                                          value={selectValue}
                                          onChange={(e) => {
                                            const val = e.target.value as 'good' | 'not_good' | 'custom';
                                            const updated = {
                                              ...reportData,
                                              taskPerformanceTables: (reportData.taskPerformanceTables || []).map((tbl, ti) => {
                                                if (ti !== tIdx) return tbl;
                                                return {
                                                  ...tbl,
                                                  items: (tbl.items || []).map((it, ii) => {
                                                    if (ii !== iIdx) return it;
                                                    let newStatus = it.operationalStatus;
                                                    if (val === 'good') {
                                                      newStatus = 'Good Condition / Normal Operation\nKondisi Baik / Beroperasi Normal';
                                                    } else if (val === 'not_good') {
                                                      newStatus = 'Not Good Condition / Abnormal Operation\nKondisi Tidak Baik / Beroperasi Abnormal';
                                                    } else if (val === 'custom') {
                                                      const itLower = (it.operationalStatus || '').toLowerCase();
                                                      if (!it.operationalStatus || isGoodPreset || isNotGoodPreset || itLower.includes('good condition') || itLower.includes('not good condition')) {
                                                        newStatus = 'Operational / Running\nBeroperasi Normal';
                                                      }
                                                    }
                                                    return {
                                                      ...it,
                                                      statusMode: val,
                                                      operationalStatus: newStatus
                                                    };
                                                  })
                                                };
                                              })
                                            };
                                            setReportData(updated);
                                          }}
                                          className={`w-full text-[10px] font-sans font-medium px-1.5 py-0.5 rounded border transition-colors cursor-pointer outline-none ${
                                            isGood
                                              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-800 hover:bg-emerald-100/70'
                                              : isNotGood
                                              ? 'bg-rose-50/90 border-rose-300 text-rose-800 font-bold hover:bg-rose-100/70'
                                              : 'bg-blue-50/90 border-blue-300 text-blue-800 font-medium'
                                          }`}
                                        >
                                          <option value="good">Good Condition</option>
                                          <option value="not_good">Not Good Condition</option>
                                          <option value="custom">Custom / Manual (Ketik)</option>
                                        </select>
                                      </div>

                                      {/* Display / Editable Content */}
                                      {isCustom ? (
                                        <BilingualTextarea
                                          value={item.operationalStatus}
                                          placeholderEn="Type operational status (English)..."
                                          placeholderId="Ketik status operasional (Bahasa Indonesia)..."
                                          onChange={(val) => {
                                            const updated = {
                                              ...reportData,
                                              taskPerformanceTables: (reportData.taskPerformanceTables || []).map((tbl, ti) => {
                                                if (ti !== tIdx) return tbl;
                                                return {
                                                  ...tbl,
                                                  items: (tbl.items || []).map((it, ii) => {
                                                    if (ii !== iIdx) return it;
                                                    return {
                                                      ...it,
                                                      statusMode: 'custom',
                                                      operationalStatus: val
                                                    };
                                                  })
                                                };
                                              })
                                            };
                                            setReportData(updated);
                                          }}
                                          classNameEn="w-full text-[10px] font-semibold leading-tight py-0.5 px-1 bg-white border border-blue-300 focus:border-blue-500 rounded outline-none resize-none font-sans text-slate-800 shadow-2xs print:bg-transparent print:border-none print:shadow-none"
                                          classNameId="w-full text-[9.5px] font-semibold italic text-slate-600 leading-tight py-0.5 px-1 bg-white border border-blue-300 focus:border-blue-500 rounded outline-none resize-none font-sans shadow-2xs print:bg-transparent print:border-none print:shadow-none"
                                          indentId={true}
                                        />
                                      ) : (
                                        <div className="font-serif leading-tight py-0.5 px-0.5">
                                          {(() => {
                                            const displayVal = item.operationalStatus || (isGood
                                              ? 'Good Condition / Normal Operation\nKondisi Baik / Beroperasi Normal'
                                              : 'Not Good Condition / Abnormal Operation\nKondisi Tidak Baik / Beroperasi Abnormal');
                                            const parts = displayVal.split('\n');
                                            const en = parts[0] || '';
                                            const id = parts.slice(1).join('\n') || '';
                                            return (
                                              <>
                                                <div className={`font-semibold text-[10px] ${
                                                  isGood
                                                    ? 'text-emerald-950 print:text-black'
                                                    : 'text-rose-950 print:text-black font-bold'
                                                }`}>
                                                  {en}
                                                </div>
                                                {id && (
                                                  <div className={`pl-2 border-l-2 text-[9px] italic mt-0.5 ${
                                                    isGood
                                                      ? 'border-emerald-400 text-emerald-800 print:border-black print:text-black'
                                                      : 'border-rose-400 text-rose-800 print:border-black print:text-black'
                                                  }`}>
                                                    {id}
                                                  </div>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="py-1 px-1 border-r border-black text-[10px] text-amber-900">
                                <BilingualTextarea
                                  value={item.issues}
                                  placeholderEn="No abnormality..."
                                  placeholderId="Tidak ditemukan kelainan... (garis miring)"
                                  onChange={(val) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].issues = val;
                                    setReportData(updated);
                                  }}
                                  classNameEn="w-full text-[10px] leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans text-amber-900"
                                  classNameId="w-full text-[9.5px] italic text-amber-800/80 leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans"
                                  indentId={true}
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black text-[10px] text-blue-900">
                                <BilingualTextarea
                                  value={item.recommendations}
                                  placeholderEn="Continue routine..."
                                  placeholderId="Lanjutkan pemantauan... (garis miring)"
                                  onChange={(val) => {
                                    const updated = { ...reportData };
                                    updated.taskPerformanceTables[tIdx].items[iIdx].recommendations = val;
                                    setReportData(updated);
                                  }}
                                  classNameEn="w-full text-[10px] leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans text-blue-900"
                                  classNameId="w-full text-[9.5px] italic text-blue-800/80 leading-tight py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none resize-none font-sans"
                                  indentId={true}
                                />
                              </td>
                              <td className="py-1 px-1 text-center print:hidden">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setReportData(prev => {
                                      if (!prev) return prev;
                                      const updatedTables = (prev.taskPerformanceTables || []).map((tbl, ti) => {
                                        if (ti !== tIdx) return tbl;
                                        const newItems = (tbl.items || [])
                                          .filter((_, ii) => ii !== iIdx)
                                          .map((it, idx) => ({ ...it, no: idx + 1 }));
                                        return { ...tbl, items: newItems };
                                      });
                                      return { ...prev, taskPerformanceTables: updatedTables };
                                    });
                                    toast.info('Baris peralatan dihapus.');
                                  }}
                                  className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                                  title="Hapus baris"
                                >
                                  <Trash2 className="w-3 h-3 mx-auto text-slate-400 hover:text-red-600" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 3: GENERAL INFORMATION & TIM (TABEL 18)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 3 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <h2 className="text-[11pt] font-bold text-slate-900">3. General Information</h2>
              <div className="text-xs space-y-2 text-slate-800 font-sans">
                <div className="flex items-center gap-3">
                  <span className="w-36 font-bold text-slate-900">Maintenance Type :</span>
                  <input
                    type="text"
                    value={reportData.generalInfo.maintenanceType}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.generalInfo.maintenanceType = e.target.value;
                      setReportData(updated);
                    }}
                    className="flex-1 py-1 px-2 border border-black rounded bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-36 font-bold text-slate-900">Contract Reference :</span>
                  <input
                    type="text"
                    value={reportData.generalInfo.contractReference}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.generalInfo.contractReference = e.target.value;
                      setReportData(updated);
                    }}
                    className="flex-1 py-1 px-2 border border-black rounded bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-36 font-bold text-slate-900">Timeline :</span>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={reportData.generalInfo.timeline.startDate}
                      onChange={(e) => {
                        const updated = { ...reportData };
                        updated.generalInfo.timeline.startDate = e.target.value;
                        setReportData(updated);
                      }}
                      className="flex-1 py-1 px-2 border border-black rounded bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-xs text-center"
                    />
                    <span>s/d</span>
                    <input
                      type="text"
                      value={reportData.generalInfo.timeline.endDate}
                      onChange={(e) => {
                        const updated = { ...reportData };
                        updated.generalInfo.timeline.endDate = e.target.value;
                        setReportData(updated);
                      }}
                      className="flex-1 py-1 px-2 border border-black rounded bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-xs text-center"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-36 font-bold text-slate-900">Total Hours Worked :</span>
                  <input
                    type="text"
                    value={reportData.generalInfo.timeline.totalHoursWorked}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.generalInfo.timeline.totalHoursWorked = e.target.value;
                      setReportData(updated);
                    }}
                    className="flex-1 py-1 px-2 border border-black rounded bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-36 font-bold text-slate-900">Standard Followed :</span>
                  <input
                    type="text"
                    value={reportData.generalInfo.timeline.standardsFollowed.join(', ')}
                    onChange={(e) => {
                      const updated = { ...reportData };
                      updated.generalInfo.timeline.standardsFollowed = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setReportData(updated);
                    }}
                    className="flex-1 py-1 px-2 border border-black rounded bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-6">
                <p className="font-bold text-slate-900 text-sm font-serif">
                  Table 18. Team Composition
                </p>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    updated.generalInfo.teamMembers.push('Nama Anggota Baru');
                    setReportData(updated);
                    toast.success('Anggota tim baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Anggota Tim</span>
                </button>
              </div>

              <div className="max-w-2xl mx-auto border border-black overflow-hidden text-xs font-serif">
                <div className="bg-[#92B8DE] p-3 text-center border-b border-black space-y-1">
                  <span className="font-bold text-slate-900 block">Team Leader</span>
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="text"
                      value={reportData.generalInfo.teamLeader.name}
                      onChange={(e) => {
                        const updated = { ...reportData };
                        updated.generalInfo.teamLeader.name = e.target.value;
                        setReportData(updated);
                      }}
                      className="font-bold text-slate-900 text-center bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none"
                    />
                    <span>/</span>
                    <div className="inline-block min-w-[140px]">
                      <BilingualTextarea
                        value={reportData.generalInfo.teamLeader.role}
                        onChange={(val) => {
                          const updated = { ...reportData };
                          updated.generalInfo.teamLeader.role = val;
                          setReportData(updated);
                        }}
                        placeholderEn="Role (EN)..."
                        placeholderId="Peran (ID - garis miring)..."
                        classNameEn="w-full text-center text-xs font-semibold py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-serif"
                        classNameId="w-full text-center text-[10.5px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-serif"
                        indentId={false}
                      />
                    </div>
                    <span>/</span>
                    <input
                      type="text"
                      value={reportData.generalInfo.teamLeader.phone}
                      onChange={(e) => {
                        const updated = { ...reportData };
                        updated.generalInfo.teamLeader.phone = e.target.value;
                        setReportData(updated);
                      }}
                      className="text-slate-800 text-center bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none"
                    />
                  </div>
                </div>
                <div className="bg-[#0066B3] text-white p-2 text-center font-bold border-b border-black">
                  Team Member
                </div>
                <div className="grid grid-cols-3 divide-x divide-y divide-black text-center font-medium">
                  {reportData.generalInfo.teamMembers.map((tm, idx) => (
                    <div key={idx} className="p-2 hover:bg-slate-50 flex items-center justify-between gap-1 group">
                      <input
                        type="text"
                        value={tm}
                        onChange={(e) => {
                          const updated = { ...reportData };
                          updated.generalInfo.teamMembers[idx] = e.target.value;
                          setReportData(updated);
                        }}
                        className="w-full text-center text-xs py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-medium text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setReportData(prev => {
                            if (!prev) return prev;
                            const newMembers = (prev.generalInfo.teamMembers || []).filter((_, i) => i !== idx);
                            return {
                              ...prev,
                              generalInfo: { ...prev.generalInfo, teamMembers: newMembers }
                            };
                          });
                          toast.info('Anggota tim dihapus.');
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 transition-opacity cursor-pointer print:hidden"
                        title="Hapus"
                      >
                        <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 4: KPI METRICS (TABEL 19)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 4 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-[11pt] font-bold text-slate-900">4. Maintenance Objectives & KPI Metrics</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Ringkasan KPI Pemeliharaan Preventif, SLA Respon Insiden, dan Matriks Kredit Layanan</p>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...reportData };
                      const monthNameEn = updated.monthNameEn || 'July';
                      const mNum = updated.monthNumber || 7;
                      const monthIdx = mNum - 1;

                      // 1. Reset Progress PM Table (Foto 1 Atas)
                      const scheduledForMonth = MASTER_PM_SCHEDULES.filter(s => s.months[monthIdx] !== null);
                      let count = 1;
                      let totalPctSum = 0;
                      updated.progressPmTable19 = scheduledForMonth.map(item => {
                        const rawMonthPlan = item.months[monthIdx] || '10 - 20';
                        let planStart = `10 ${monthNameEn}`;
                        let planFinish = `20 ${monthNameEn}`;
                        if (rawMonthPlan.includes('-')) {
                          const parts = rawMonthPlan.split('-').map(p => p.trim());
                          planStart = `${parts[0]} ${monthNameEn}`;
                          planFinish = `${parts[1]} ${monthNameEn}`;
                        }
                        const unit = getDefaultBoqUnitForDevice(item.device);
                        let actualStart = planStart;
                        let actualFinish = planFinish;
                        let actualUnit: number | string = unit;
                        let pctFinish = '100%';
                        let remark = '';

                        if (mNum === 7) {
                          if (item.device === 'Water Leak') {
                            actualStart = `7 ${monthNameEn}`;
                            actualFinish = `9 ${monthNameEn}`;
                          } else if (item.device === 'Cooling Tower Water Treatment') {
                            actualStart = `8 ${monthNameEn}`;
                            actualFinish = `30 ${monthNameEn}`;
                          } else if (item.device === 'Lift Units') {
                            actualStart = `7 ${monthNameEn}`;
                            actualFinish = `14 ${monthNameEn}`;
                          } else if (item.device === 'Gate') {
                            actualStart = `27 ${monthNameEn}`;
                            actualFinish = `28 ${monthNameEn}`;
                          } else if (item.device === 'Dock Leveler') {
                            actualStart = `10 ${monthNameEn}`;
                            actualFinish = `11 ${monthNameEn}`;
                          } else if (item.device === 'STP & Plumbing') {
                            actualStart = `30 ${monthNameEn}`;
                            actualFinish = `30 ${monthNameEn}`;
                          } else if (item.device === 'Door') {
                            actualStart = `15 ${monthNameEn}`;
                            actualFinish = `17 ${monthNameEn}`;
                          } else if (item.device === 'Exhaust Fan') {
                            actualStart = `27 ${monthNameEn}`;
                            actualFinish = `31 ${monthNameEn}`;
                            actualUnit = 8;
                            pctFinish = '66,67%';
                            remark = '1F-RM-TES TANK-1 dan 1F-RM-TES TANK-2 Access susah (terlalu tinggi), dan 1F-RM CHILLER FAN-1 dan 1F-RM CHILLER FAN-2 ada pekerjaan project';
                          } else if (item.device === 'Capacitor Bank') {
                            actualStart = `29 ${monthNameEn}`;
                            actualFinish = `29 ${monthNameEn}`;
                          } else if (item.device === 'Load Bank') {
                            actualStart = `30 ${monthNameEn}`;
                            actualFinish = `30 ${monthNameEn}`;
                          }
                        }
                        const numPct = parseFloat(pctFinish.replace(',', '.').replace('%', '')) || 100;
                        totalPctSum += numPct;
                        return {
                          no: `${count++}.`,
                          activity: item.device,
                          unit,
                          planStart,
                          planFinish,
                          actualStart,
                          actualFinish,
                          actualUnit,
                          pctFinish,
                          remark
                        };
                      });
                      const avgNum = updated.progressPmTable19.length > 0 ? (totalPctSum / updated.progressPmTable19.length) : 100;
                      updated.progressPmAverage = mNum === 7 ? '97,44%' : `${avgNum.toFixed(2).replace('.', ',')}%`;

                      // 2. Reset SLA Orders Table (Foto 1 Bawah)
                      updated.slaOrdersTable19 = [
                        { no: '1.', activity: 'Response Time', unit: 'Order', actual: 18, finish: 15, pctFinish: '83,33%', comply: 'TM', pctComply: '83%' },
                        { no: '2.', activity: 'Onsite Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
                        { no: '3.', activity: 'Restore Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
                        { no: '4.', activity: 'Resolution Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' }
                      ];
                      updated.slaOrdersPeriodTotal = '%';

                      // 3. Reset Service Credit Matrix (Foto 2)
                      updated.serviceCreditMatrix = [
                        { range: '98% - 100%', credit: '0%', highlighted: false, isTermination: false },
                        { range: '95% - <98%', credit: '5%', highlighted: false, isTermination: false },
                        { range: '90% - <95%', credit: '10%', highlighted: false, isTermination: false },
                        { range: '85% - <90%', credit: '15%', highlighted: false, isTermination: false },
                        { range: '80% - <85%', credit: '20%', highlighted: false, isTermination: false },
                        { range: '<80%', credit: 'Contract can be terminated', highlighted: true, isTermination: true }
                      ];

                      setReportData(updated);
                      toast.success('Format Tabel 19 KPI Metric berhasil direset sesuai format Foto 1 & 2!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors shadow-sm cursor-pointer"
                    title="Reset tampilan Tabel 19 sesuai format asli NeutraDC pada foto"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Format Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...reportData };
                      const current = updated.progressPmTable19 ? [...updated.progressPmTable19] : [];
                      const nextNo = `${current.length + 1}.`;
                      current.push({
                        no: nextNo,
                        activity: 'Equipment Baru',
                        unit: 1,
                        planStart: `01 ${reportData.monthNameEn || 'July'}`,
                        planFinish: `05 ${reportData.monthNameEn || 'July'}`,
                        actualStart: `01 ${reportData.monthNameEn || 'July'}`,
                        actualFinish: `05 ${reportData.monthNameEn || 'July'}`,
                        actualUnit: 1,
                        pctFinish: '100%',
                        remark: ''
                      });
                      updated.progressPmTable19 = current;
                      setReportData(updated);
                      toast.success('Aktivitas PM berhasil ditambahkan');
                    }}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah PM</span>
                  </button>
                </div>
              </div>
              
              <p className="font-bold text-center text-slate-900 text-sm my-2">
                Table 19. KPI Metric
              </p>

              {/* 1. TABEL ATAS: Progress Preventive Maintenance [Month] [Year] */}
              <div className="overflow-x-auto border border-black shadow-sm">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    {/* Header Row 1: Title Banner */}
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th colSpan={10} className="py-2.5 px-3 text-center text-sm tracking-wide">
                        Progress Preventive Maintenance {reportData.monthNameEn || 'July'} {reportData.year || 2026}
                      </th>
                      <th className="w-8 print:hidden"></th>
                    </tr>
                    {/* Header Row 2 & 3: Columns with Sub-headers Plan & Actual */}
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black text-center">
                      <th rowSpan={2} className="py-2 px-2 border-r border-black w-10">No</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-black min-w-[160px]">Activity</th>
                      <th rowSpan={2} className="py-2 px-2 border-r border-black w-14">Unit</th>
                      <th colSpan={2} className="py-1 px-2 border-r border-black border-b border-black">Plan</th>
                      <th colSpan={3} className="py-1 px-2 border-r border-black border-b border-black">Actual</th>
                      <th rowSpan={2} className="py-2 px-2 border-r border-black w-20">%Finish</th>
                      <th rowSpan={2} className="py-2 px-3 border-r border-black min-w-[200px]">Remark</th>
                      <th rowSpan={2} className="w-8 print:hidden"></th>
                    </tr>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black text-center">
                      <th className="py-1 px-2 border-r border-black w-20 font-medium text-[11px]">Start</th>
                      <th className="py-1 px-2 border-r border-black w-20 font-medium text-[11px]">Finish</th>
                      <th className="py-1 px-2 border-r border-black w-20 font-medium text-[11px]">Start</th>
                      <th className="py-1 px-2 border-r border-black w-20 font-medium text-[11px]">Finish</th>
                      <th className="py-1 px-2 border-r border-black w-14 font-medium text-[11px]">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {(reportData.progressPmTable19 || []).map((row, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20 group">
                        <td className="py-1.5 px-2 text-center font-medium border-r border-black">
                          <input
                            type="text"
                            value={row.no}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].no = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2 border-r border-black font-medium">
                          <input
                            type="text"
                            value={row.activity}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].activity = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-semibold text-slate-900"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                const val = Number(e.target.value) || 0;
                                updated.progressPmTable19[idx].unit = val;
                                const act = Number(updated.progressPmTable19[idx].actualUnit) || 0;
                                if (val > 0) {
                                  updated.progressPmTable19[idx].pctFinish = `${((act / val) * 100).toFixed(2).replace('.', ',').replace(',00', '')}%`;
                                }
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.planStart}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].planStart = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center text-xs py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.planFinish}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].planFinish = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center text-xs py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.actualStart}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].actualStart = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center text-xs py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.actualFinish}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].actualFinish = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center text-xs py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black font-semibold">
                          <input
                            type="text"
                            value={row.actualUnit}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                const act = Number(e.target.value) || 0;
                                updated.progressPmTable19[idx].actualUnit = act;
                                const u = Number(updated.progressPmTable19[idx].unit) || 0;
                                if (u > 0) {
                                  updated.progressPmTable19[idx].pctFinish = `${((act / u) * 100).toFixed(2).replace('.', ',').replace(',00', '')}%`;
                                }
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-semibold text-slate-900"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 text-center border-r border-black font-bold text-blue-900">
                          <input
                            type="text"
                            value={row.pctFinish}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].pctFinish = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-bold text-blue-900"
                          />
                        </td>
                        <td className="py-1 px-1.5 border-r border-black">
                          <textarea
                            rows={row.remark?.includes('\n') || (row.remark?.length || 0) > 40 ? 2 : 1}
                            value={row.remark}
                            placeholder="Catatan / kendala..."
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.progressPmTable19) {
                                updated.progressPmTable19[idx].remark = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none leading-tight"
                          />
                        </td>
                        <td className="py-1 px-1 print:hidden text-center">
                          <button
                            type="button"
                            title="Hapus baris PM"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setReportData(prev => {
                                if (!prev) return prev;
                                const newPm = (prev.progressPmTable19 || []).filter((_, i) => i !== idx);
                                return { ...prev, progressPmTable19: newPm };
                              });
                              toast.info('Baris PM berhasil dihapus');
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Summary Row: Avarage */}
                    <tr className="bg-[#0066B3] text-white font-bold border-t border-black">
                      <td colSpan={8} className="py-2.5 px-4 text-center border-r border-black text-sm tracking-wider">
                        Avarage
                      </td>
                      <td className="py-1 px-2 text-center border-r border-black">
                        <input
                          type="text"
                          value={reportData.progressPmAverage || reportData.kpiSummary?.progressPmAverage || '97,44%'}
                          onChange={(e) => {
                            const updated = { ...reportData };
                            updated.progressPmAverage = e.target.value;
                            if (updated.kpiSummary) {
                              updated.kpiSummary.progressPmAverage = e.target.value;
                            }
                            setReportData(updated);
                          }}
                          className="w-20 text-center font-bold text-sm py-1 text-white bg-transparent hover:bg-blue-700 focus:bg-blue-700 rounded outline-none"
                        />
                      </td>
                      <td className="py-2 px-2 bg-[#0066B3]"></td>
                      <td className="print:hidden bg-[#0066B3]"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 2. TABEL BAWAH: SLA Tiket / Order Fulfillment */}
              <div className="overflow-x-auto border border-black shadow-sm mt-6">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black text-center">
                      <th className="py-2 px-2 border-r border-black w-10">No</th>
                      <th className="py-2 px-4 border-r border-black text-left min-w-[140px]">Activity</th>
                      <th className="py-2 px-3 border-r border-black w-20">Unit</th>
                      <th className="py-2 px-3 border-r border-black w-20">Actual</th>
                      <th className="py-2 px-3 border-r border-black w-20">Finish</th>
                      <th className="py-2 px-3 border-r border-black w-24">%Finish</th>
                      <th className="py-2 px-3 border-r border-black w-20">Comply</th>
                      <th className="py-2 px-3 text-center w-24">%Comply</th>
                      <th className="w-8 print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {(reportData.slaOrdersTable19 || [
                      { no: '1.', activity: 'Response Time', unit: 'Order', actual: 18, finish: 15, pctFinish: '83,33%', comply: 'TM', pctComply: '83%' },
                      { no: '2.', activity: 'Onsite Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
                      { no: '3.', activity: 'Restore Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
                      { no: '4.', activity: 'Resolution Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' }
                    ]).map((row, sIdx) => (
                      <tr key={sIdx} className="hover:bg-blue-50/20 group">
                        <td className="py-1.5 px-2 text-center font-medium border-r border-black">
                          <input
                            type="text"
                            value={row.no}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19[sIdx].no = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-4 border-r border-black font-semibold text-slate-900">
                          <input
                            type="text"
                            value={row.activity}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19[sIdx].activity = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-semibold text-slate-900"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19[sIdx].unit = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.actual}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                const act = Number(e.target.value) || 0;
                                updated.slaOrdersTable19[sIdx].actual = act;
                                const fin = Number(updated.slaOrdersTable19[sIdx].finish) || 0;
                                if (act > 0) {
                                  updated.slaOrdersTable19[sIdx].pctFinish = `${((fin / act) * 100).toFixed(2).replace('.', ',').replace(',00', '')}%`;
                                }
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-medium"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black">
                          <input
                            type="text"
                            value={row.finish}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                const fin = Number(e.target.value) || 0;
                                updated.slaOrdersTable19[sIdx].finish = fin;
                                const act = Number(updated.slaOrdersTable19[sIdx].actual) || 0;
                                if (act > 0) {
                                  updated.slaOrdersTable19[sIdx].pctFinish = `${((fin / act) * 100).toFixed(2).replace('.', ',').replace(',00', '')}%`;
                                }
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-medium"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black font-semibold">
                          <input
                            type="text"
                            value={row.pctFinish}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19[sIdx].pctFinish = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-semibold text-slate-800"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black font-bold">
                          <input
                            type="text"
                            value={row.comply}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19[sIdx].comply = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className={`w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-bold ${
                              row.comply === 'TM' ? 'text-amber-700' : 'text-emerald-700'
                            }`}
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold text-blue-900">
                          <input
                            type="text"
                            value={row.pctComply}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              if (updated.slaOrdersTable19) {
                                updated.slaOrdersTable19[sIdx].pctComply = e.target.value;
                                setReportData(updated);
                              }
                            }}
                            className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-bold text-blue-900"
                          />
                        </td>
                        <td className="py-1 px-1 print:hidden text-center">
                          <button
                            type="button"
                            title="Hapus baris SLA"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setReportData(prev => {
                                if (!prev) return prev;
                                const newSla = (prev.slaOrdersTable19 || []).filter((_, i) => i !== sIdx);
                                return { ...prev, slaOrdersTable19: newSla };
                              });
                              toast.info('Baris SLA berhasil dihapus');
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Summary Row: Total Fulfillment */}
                    <tr className="bg-[#0066B3] text-white font-bold border-t border-black">
                      <td colSpan={7} className="py-2.5 px-4 text-center border-r border-black text-sm tracking-wide">
                        Total Percentage Of Performance Fulfillment Period 1
                      </td>
                      <td className="py-1 px-2 text-center">
                        <input
                          type="text"
                          value={reportData.slaOrdersPeriodTotal || '%'}
                          onChange={(e) => {
                            const updated = { ...reportData };
                            updated.slaOrdersPeriodTotal = e.target.value;
                            setReportData(updated);
                          }}
                          className="w-16 text-center font-bold text-sm py-1 text-white bg-transparent hover:bg-blue-700 focus:bg-blue-700 rounded outline-none"
                        />
                      </td>
                      <td className="print:hidden bg-[#0066B3]"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 3. MATRIKS SERVICE CREDIT (FOTO 2) */}
              <div className="max-w-md mx-auto border border-black overflow-hidden text-xs mt-8 shadow-sm">
                <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 border-b border-black print:hidden">
                  <span className="text-[11px] font-semibold text-slate-600">Matriks Service Credit (Sesuai Foto 2)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...reportData };
                      const matrix = updated.serviceCreditMatrix ? [...updated.serviceCreditMatrix] : [
                        { range: '98% - 100%', credit: '0%', highlighted: false, isTermination: false },
                        { range: '95% - <98%', credit: '5%', highlighted: false, isTermination: false },
                        { range: '90% - <95%', credit: '10%', highlighted: false, isTermination: false },
                        { range: '85% - <90%', credit: '15%', highlighted: false, isTermination: false },
                        { range: '80% - <85%', credit: '20%', highlighted: false, isTermination: false },
                        { range: '<80%', credit: 'Contract can be terminated', highlighted: true, isTermination: true }
                      ];
                      matrix.push({ range: 'Baru', credit: '0%', highlighted: false, isTermination: false });
                      updated.serviceCreditMatrix = matrix;
                      setReportData(updated);
                      toast.success('Tier matriks berhasil ditambahkan!');
                    }}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Tier</span>
                  </button>
                </div>
                <table className="w-full text-center border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-4 border-r border-black w-1/2 text-sm">Nilai Total  Kinerja %</th>
                      <th className="py-2.5 px-4 w-1/2 text-sm">Percentage of Service Credit</th>
                      <th className="py-2 px-1 w-8 print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {(reportData.serviceCreditMatrix || [
                      { range: '98% - 100%', credit: '0%', highlighted: false, isTermination: false },
                      { range: '95% - <98%', credit: '5%', highlighted: false, isTermination: false },
                      { range: '90% - <95%', credit: '10%', highlighted: false, isTermination: false },
                      { range: '85% - <90%', credit: '15%', highlighted: false, isTermination: false },
                      { range: '80% - <85%', credit: '20%', highlighted: false, isTermination: false },
                      { range: '<80%', credit: 'Contract can be terminated', highlighted: true, isTermination: true }
                    ]).map((row, rIdx) => {
                      const isTerm = row.isTermination || row.range.includes('<80') || row.credit?.toLowerCase().includes('terminated');
                      const isHighlighted = row.highlighted && !isTerm;
                      return (
                        <tr
                          key={rIdx}
                          className={`group transition-colors ${
                            isTerm ? 'bg-[#FFFF00] font-bold text-black' : isHighlighted ? 'bg-yellow-200 font-bold' : 'hover:bg-blue-50/20'
                          }`}
                        >
                          <td className="py-1.5 px-3 border-r border-black">
                            <input
                              type="text"
                              value={row.range}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                const matrix = [...(updated.serviceCreditMatrix || [])];
                                matrix[rIdx].range = e.target.value;
                                updated.serviceCreditMatrix = matrix;
                                setReportData(updated);
                              }}
                              className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-inherit"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={row.credit}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                const matrix = [...(updated.serviceCreditMatrix || [])];
                                matrix[rIdx].credit = e.target.value;
                                updated.serviceCreditMatrix = matrix;
                                setReportData(updated);
                              }}
                              className="w-full text-center py-0.5 bg-transparent hover:bg-white focus:bg-white rounded outline-none font-inherit"
                            />
                          </td>
                          <td className="py-1 px-1 print:hidden text-center">
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                title="Toggle Sorotan"
                                onClick={() => {
                                  const updated = { ...reportData };
                                  const matrix = [...(updated.serviceCreditMatrix || [])];
                                  matrix[rIdx].highlighted = !matrix[rIdx].highlighted;
                                  updated.serviceCreditMatrix = matrix;
                                  setReportData(updated);
                                }}
                                className={`px-1 py-0.5 text-xs rounded cursor-pointer ${
                                  row.highlighted ? 'text-amber-700 font-bold' : 'text-slate-400 hover:text-amber-600'
                                }`}
                              >
                                ★
                              </button>
                              <button
                                type="button"
                                title="Hapus Tier"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setReportData(prev => {
                                    if (!prev) return prev;
                                    const matrix = (prev.serviceCreditMatrix || []).filter((_, i) => i !== rIdx);
                                    return { ...prev, serviceCreditMatrix: matrix };
                                  });
                                  toast.info('Tier berhasil dihapus');
                                }}
                                className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 5: EQUIPMENT AND SYSTEM DETAILS (TABEL 20 & TABEL 21)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 5 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-[11pt] font-bold text-slate-900">5. Equipment and System Details</h2>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      const targetSys = selectedEquipmentCategory !== 'ALL' ? selectedEquipmentCategory : 'Transformer';
                      const existingInSys = (reportData.equipmentDetailsTable20 || []).filter(e => (e.system || 'Other Equipment') === targetSys);
                      const newEquip = [
                        ...(reportData.equipmentDetailsTable20 || []),
                        {
                          no: existingInSys.length + 1,
                          system: targetSys,
                          className: 'New Facility Asset',
                          modelSN: '-',
                          manufacture: 'OEM Certified',
                          installDate: '2021',
                          location: 'Campus Area',
                          lastMaintenanceDate: '',
                          currentOperationalDate: '',
                          statusBeforeMaintenance: 'Good Operation / Normal\nBeroperasi Baik / Normal'
                        }
                      ];
                      setReportData({
                        ...reportData,
                        equipmentDetailsTable20: newEquip
                      });
                      toast.success(`Equipment baru berhasil ditambahkan ke kategori ${targetSys}!`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Equipment</span>
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">
                Rincian aset peralatan dan spesifikasi teknis fasilitas Data Center NeutraDC Cikarang yang tercatat pada Master Asset BOQ beserta riwayat pemeliharaan berkala terakhir dan jam operasionalnya:
              </p>

              {/* Toolbar Filter Kategori & Pencarian Equipment (Web Mode) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 print:hidden font-sans">
                <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                  <Filter className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 shrink-0">Kategori:</span>
                  <select
                    value={selectedEquipmentCategory}
                    onChange={(e) => setSelectedEquipmentCategory(e.target.value)}
                    className="text-xs py-1 px-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800 flex-1 max-w-xs cursor-pointer"
                  >
                    <option value="ALL">Semua Kategori ({reportData.equipmentDetailsTable20.length} unit)</option>
                    {Array.from(groupedEquipments.keys()).map((catName) => (
                      <option key={catName} value={catName}>
                        {catName} ({groupedEquipments.get(catName)?.length || 0} unit)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative flex-1 min-w-[240px] max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={equipmentSearchQuery}
                    onChange={(e) => setEquipmentSearchQuery(e.target.value)}
                    placeholder="Cari nama peralatan, serial number, atau area..."
                    className="w-full text-xs pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                  />
                  {equipmentSearchQuery && (
                    <button
                      onClick={() => setEquipmentSearchQuery('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 20. Equipment and System Details
              </p>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-2 text-center border-r border-black w-8">No</th>
                      <th className="py-2.5 px-2 border-r border-black w-36">Equipment / System Name</th>
                      <th className="py-2.5 px-2 border-r border-black w-28">Model / Serial Number</th>
                      <th className="py-2.5 px-2 border-r border-black w-28">Manufacture</th>
                      <th className="py-2.5 px-2 text-center border-r border-black w-20">Installation Date</th>
                      <th className="py-2.5 px-2 border-r border-black w-28">Location / Area</th>
                      <th className="py-2.5 px-2 text-center border-r border-black w-28">Last Maintenance Date</th>
                      <th className="py-2.5 px-2 text-center border-r border-black w-28">Current Operational Hours</th>
                      <th className="py-2.5 px-2 text-center border-r border-black w-28">Status Before Maintenance</th>
                      <th className="py-2.5 px-1 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {Array.from(groupedEquipments.entries()).map(([sysName, groupItems]) => {
                      // Filter kategori bila dipilih
                      if (selectedEquipmentCategory !== 'ALL' && selectedEquipmentCategory !== sysName) {
                        return null;
                      }

                      // Filter pencarian
                      const visibleItems = groupItems.filter(({ item }) => {
                        if (!equipmentSearchQuery.trim()) return true;
                        const q = equipmentSearchQuery.toLowerCase();
                        return (
                          (item.className || '').toLowerCase().includes(q) ||
                          (item.modelSN || '').toLowerCase().includes(q) ||
                          (item.manufacture || '').toLowerCase().includes(q) ||
                          (item.location || '').toLowerCase().includes(q) ||
                          (item.system || '').toLowerCase().includes(q)
                        );
                      });

                      if (visibleItems.length === 0 && equipmentSearchQuery.trim()) {
                        return null;
                      }

                      return (
                        <React.Fragment key={`group-${sysName}`}>
                          {/* Header Kategori Peralatan (Sesuai Screenshot 3) */}
                          <tr className="bg-[#D9E1F2] border-b border-black print:bg-[#D9E1F2]">
                            <td colSpan={10} className="py-2 px-3 font-bold text-[#1F4E79] text-xs sm:text-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-serif tracking-wide">{sysName}</span>
                                <div className="flex items-center gap-2 print:hidden">
                                  <span className="text-[11px] font-sans font-normal text-slate-600">
                                    {visibleItems.length} unit
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      if (window.confirm(`Hapus seluruh peralatan dalam kategori "${sysName}"?`)) {
                                        setReportData(prev => {
                                          if (!prev) return prev;
                                          const newEquip = (prev.equipmentDetailsTable20 || []).filter(
                                            (item) => (item.system || 'General Equipment') !== sysName
                                          );
                                          const sysCounter = new Map<string, number>();
                                          newEquip.forEach((item) => {
                                            const s = item.system || 'Other Equipment';
                                            const count = (sysCounter.get(s) || 0) + 1;
                                            sysCounter.set(s, count);
                                            item.no = count;
                                          });
                                          return { ...prev, equipmentDetailsTable20: newEquip };
                                        });
                                        toast.info(`Kategori "${sysName}" berhasil dihapus.`);
                                      }
                                    }}
                                    className="p-1 hover:text-red-600 text-slate-500 hover:bg-red-100/50 rounded transition-colors cursor-pointer"
                                    title={`Hapus seluruh kategori ${sysName}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Daftar Peralatan Dalam Kategori (No Urut Restart per Kategori) */}
                          {visibleItems.map(({ item: eq, originalIndex: idx }, itemIdx) => (
                            <tr key={idx} className="hover:bg-blue-50/20">
                              <td className="py-2 px-1 text-center font-bold border-r border-black">
                                {itemIdx + 1}
                              </td>
                              <td className="py-1 px-1 border-r border-black font-bold">
                                <input
                                  type="text"
                                  value={eq.className}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.equipmentDetailsTable20[idx].className = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-xs font-bold py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 font-mono text-[11px] border-r border-black">
                                <input
                                  type="text"
                                  value={eq.modelSN}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.equipmentDetailsTable20[idx].modelSN = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-[11px] font-mono py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black">
                                <input
                                  type="text"
                                  value={eq.manufacture}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.equipmentDetailsTable20[idx].manufacture = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 text-center border-r border-black">
                                <input
                                  type="text"
                                  value={eq.installDate}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.equipmentDetailsTable20[idx].installDate = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-center text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 border-r border-black">
                                <input
                                  type="text"
                                  value={eq.location}
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.equipmentDetailsTable20[idx].location = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                />
                              </td>
                              <td className="py-1 px-1 text-center border-r border-black">
                                <input
                                  type="text"
                                  value={eq.lastMaintenanceDate}
                                  placeholder="Tgl PM..."
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.equipmentDetailsTable20[idx].lastMaintenanceDate = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-center text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none placeholder:text-slate-300"
                                />
                              </td>
                              <td className="py-1 px-1 text-center border-r border-black">
                                <input
                                  type="text"
                                  value={eq.currentOperationalDate}
                                  placeholder="misal 2.040 Hours"
                                  onChange={(e) => {
                                    const updated = { ...reportData };
                                    updated.equipmentDetailsTable20[idx].currentOperationalDate = e.target.value;
                                    setReportData(updated);
                                  }}
                                  className="w-full text-center text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none placeholder:text-slate-300 font-medium"
                                />
                              </td>
                              <td className="py-1 px-1 text-center border-r border-black">
                                <BilingualTextarea
                                  value={eq.statusBeforeMaintenance}
                                  placeholderEn="Good Condition"
                                  placeholderId="Kondisi Baik (garis miring)..."
                                  onChange={(val) => {
                                    const updated = { ...reportData };
                                    updated.equipmentDetailsTable20[idx].statusBeforeMaintenance = val;
                                    setReportData(updated);
                                  }}
                                  classNameEn="w-full text-center text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                  classNameId="w-full text-center text-[10.5px] italic text-slate-500 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                                  indentId={false}
                                />
                              </td>
                              <td className="py-1 px-1 text-center print:hidden">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setReportData(prev => {
                                      if (!prev) return prev;
                                      const newEquip = (prev.equipmentDetailsTable20 || []).filter((_, i) => i !== idx);
                                      const sysCounter = new Map<string, number>();
                                      newEquip.forEach((item) => {
                                        const s = item.system || 'Other Equipment';
                                        const count = (sysCounter.get(s) || 0) + 1;
                                        sysCounter.set(s, count);
                                        item.no = count;
                                      });
                                      return { ...prev, equipmentDetailsTable20: newEquip };
                                    });
                                    toast.info('Equipment dihapus.');
                                  }}
                                  className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                                  title="Hapus baris"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table 21: System Overview */}
              <div className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 text-sm">
                    Table 21. System Overview
                  </p>
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      const newNo = updated.systemOverviewTable21.length + 1;
                      updated.systemOverviewTable21.push({
                        no: newNo,
                        component: 'Komponen Baru',
                        functionDesc: 'Deskripsi fungsi dan pentingnya pemeliharaan.'
                      });
                      setReportData(updated);
                      toast.success('Komponen baru ditambahkan ke Tabel 21!');
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Komponen</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-black">
                  <table className="w-full text-left text-xs border-collapse font-serif">
                    <thead>
                      <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                        <th className="py-2.5 px-3 text-center w-12 border-r border-black">No</th>
                        <th className="py-2.5 px-3 w-48 border-r border-black">Component / System</th>
                        <th className="py-2.5 px-3 border-r border-black">Function & Maintenance Importance</th>
                        <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black text-slate-800">
                      {reportData.systemOverviewTable21.map((item, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/20">
                          <td className="py-2.5 px-3 text-center font-bold border-r border-black">{item.no}</td>
                          <td className="py-1 px-2 font-bold border-r border-black text-blue-950">
                            <input
                              type="text"
                              value={item.component}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                updated.systemOverviewTable21[idx].component = e.target.value;
                                setReportData(updated);
                              }}
                              className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            />
                          </td>
                          <td className="py-1 px-2 leading-relaxed border-r border-black">
                            <BilingualTextarea
                              value={item.functionDesc}
                              placeholderEn="Function & Maintenance Importance..."
                              placeholderId="Fungsi dan pentingnya pemeliharaan (garis miring)..."
                              onChange={(val) => {
                                const updated = { ...reportData };
                                updated.systemOverviewTable21[idx].functionDesc = val;
                                setReportData(updated);
                              }}
                              classNameEn="w-full text-xs text-slate-800 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                              classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                              indentId={true}
                            />
                          </td>
                          <td className="py-1 px-1 text-center print:hidden">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setReportData(prev => {
                                  if (!prev) return prev;
                                  const newSys = (prev.systemOverviewTable21 || [])
                                    .filter((_, i) => i !== idx)
                                    .map((it, i) => ({ ...it, no: i + 1 }));
                                  return { ...prev, systemOverviewTable21: newSys };
                                });
                                toast.info('Komponen dihapus.');
                              }}
                              className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 6: SCOPE OF WORK (TABEL 22)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 6 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-[11pt] font-bold text-slate-900">6. Scope of Work</h2>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      const schedScopes: string[] = (updated.scheduleTable1 || []).map((s: any) => s.device);
                      updated.scopeOfWorkTable22 = schedScopes.map((scope: string) => getScopeOfWorkForScope(scope));
                      updated._sowDetailedVersion = 3;
                      setReportData(updated);
                      toast.success('Scope of Work berhasil di-reset ke SOP Teknis Standard SR Bilingual (EN / ID)!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer shadow-xs"
                    title="Muat ulang seluruh lingkup Bab 6 dengan SOP naratif teknis lengkap beserta parameter pengukuran Service Report"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset ke SOP Standard SR</span>
                  </button>
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      updated.scopeOfWorkTable22.push({
                        category: 'KATEGORI SOP BARU',
                        items: [
                          {
                            step: '1. Tahap Persiapan & Pemeriksaan Awal',
                            tasks: ['Pengecekan visual dan parameter awal.', 'Pembersihan unit dan filter.']
                          }
                        ]
                      });
                      setReportData(updated);
                      toast.success('Kategori Scope of Work baru ditambahkan!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Kategori SOP</span>
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">
                Rangkaian tahapan prosedur operasional standar (SOP) Preventive Maintenance yang dijalankan oleh tim teknisi DME pada setiap perangkat:
              </p>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 22. Scope of Work
              </p>

              <div className="space-y-6">
                {reportData.scopeOfWorkTable22.map((sow, sIdx) => (
                  <div key={sIdx} className="border border-black overflow-hidden text-xs rounded-lg">
                    <div className="bg-[#0066B3] text-white p-2.5 font-bold text-sm flex items-center justify-between">
                      <input
                        type="text"
                        value={sow.category}
                        onChange={(e) => {
                          const updated = { ...reportData };
                          updated.scopeOfWorkTable22[sIdx].category = e.target.value;
                          setReportData(updated);
                        }}
                        className="font-bold text-white bg-transparent hover:bg-white/20 focus:bg-white/20 rounded px-1 outline-none w-3/4"
                      />
                      <div className="flex items-center gap-2 print:hidden">
                        <button
                          onClick={() => {
                            const updated = { ...reportData };
                            const newStepNo = updated.scopeOfWorkTable22[sIdx].items.length + 1;
                            updated.scopeOfWorkTable22[sIdx].items.push({
                              step: `${newStepNo}. Tahap Pemeliharaan Tambahan`,
                              tasks: ['Pengecekan parameter operasional.']
                            });
                            setReportData(updated);
                            toast.success('Tahapan baru ditambahkan!');
                          }}
                          className="px-2 py-0.5 bg-white/20 hover:bg-white/30 text-white rounded text-[11px] font-sans cursor-pointer"
                        >
                          + Step
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (window.confirm(`Hapus seluruh SOP kategori "${sow.category}"?`)) {
                              setReportData(prev => {
                                if (!prev) return prev;
                                const newSow = (prev.scopeOfWorkTable22 || []).filter((_, i) => i !== sIdx);
                                return { ...prev, scopeOfWorkTable22: newSow };
                              });
                              toast.info('Kategori SOP dihapus.');
                            } 
                          }}
                          className="p-1 hover:text-red-200 transition-colors cursor-pointer"
                          title="Hapus Kategori"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-white/80 hover:text-white" />
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-black">
                      {sow.items.map((step, stIdx) => (
                        <div key={stIdx} className="p-3 bg-slate-50/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <BilingualTextarea
                              value={step.step}
                              onChange={(val) => {
                                const updated = { ...reportData };
                                updated.scopeOfWorkTable22[sIdx].items[stIdx].step = val;
                                setReportData(updated);
                              }}
                              placeholderEn="Step Title in English..."
                              placeholderId="Judul Tahapan Bahasa Indonesia (garis miring)..."
                              classNameEn="font-bold text-slate-900 text-xs bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none w-full leading-tight font-serif"
                              classNameId="font-semibold italic text-blue-800 text-[11.5px] bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1 outline-none w-full leading-tight font-serif"
                              containerClassName="w-3/4 flex flex-col space-y-0.5"
                              indentId={true}
                            />
                            <div className="flex items-center gap-2 print:hidden">
                              <button
                                onClick={() => {
                                  const updated = { ...reportData };
                                  updated.scopeOfWorkTable22[sIdx].items[stIdx].tasks.push('Perform technical inspection on system.\nLakukan inspeksi teknis pada sistem.');
                                  setReportData(updated);
                                }}
                                className="text-[10px] text-blue-600 hover:underline font-sans cursor-pointer"
                              >
                                + Task
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setReportData(prev => {
                                    if (!prev) return prev;
                                    const newSow = (prev.scopeOfWorkTable22 || []).map((cat, ci) => {
                                      if (ci !== sIdx) return cat;
                                      return {
                                        ...cat,
                                        items: (cat.items || []).filter((_, ii) => ii !== stIdx)
                                      };
                                    });
                                    return { ...prev, scopeOfWorkTable22: newSow };
                                  });
                                  toast.info('Tahapan SOP dihapus.');
                                }}
                                className="p-0.5 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-600" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1.5 pl-4">
                            {step.tasks.map((task, tIdx) => (
                              <div key={tIdx} className="flex items-start gap-2 group">
                                <span className="text-blue-500 mt-0.5 select-none font-bold text-sm leading-none">•</span>
                                <BilingualTextarea
                                  value={task}
                                  onChange={(val) => {
                                    const updated = { ...reportData };
                                    updated.scopeOfWorkTable22[sIdx].items[stIdx].tasks[tIdx] = val;
                                    setReportData(updated);
                                  }}
                                  placeholderEn="English Technical SOP..."
                                  placeholderId="Instruksi Teknis Bahasa Indonesia (garis miring)..."
                                  classNameEn="w-full text-xs text-slate-800 leading-snug py-0.5 px-1.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none font-sans"
                                  classNameId="w-full text-[11.5px] italic text-slate-600 leading-snug py-0.5 px-1.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-none font-sans"
                                  indentId={true}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setReportData(prev => {
                                      if (!prev) return prev;
                                      const newSow = (prev.scopeOfWorkTable22 || []).map((cat, ci) => {
                                        if (ci !== sIdx) return cat;
                                        const newItems = (cat.items || []).map((it, ii) => {
                                          if (ii !== stIdx) return it;
                                          return {
                                            ...it,
                                            tasks: (it.tasks || []).filter((_, ti) => ti !== tIdx)
                                          };
                                        });
                                        return { ...cat, items: newItems };
                                      });
                                      return { ...prev, scopeOfWorkTable22: newSow };
                                    });
                                    toast.info('Poin task dihapus.');
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 transition-opacity cursor-pointer print:hidden self-start mt-1"
                                >
                                  <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-600" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 7: OBSERVATION & FINDINGS (TABEL 23 & ROOT CAUSE)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 7 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-[11pt] font-bold text-slate-900">7. Observation and Finding</h2>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    updated.observationTable23.push({
                      scope: 'LINGKUP PERALATAN BARU',
                      items: [
                        {
                          no: 1,
                          component: 'Komponen Baru',
                          conditionBefore: 'Normal / Bersih',
                          inspectionNotes: 'Tidak ada anomali atau deviasi operasional.'
                        }
                      ]
                    });
                    setReportData(updated);
                    toast.success('Lingkup temuan baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Lingkup Temuan</span>
                </button>
              </div>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 23. Observation & Finding
              </p>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-10 border-r border-black">No</th>
                      <th className="py-2.5 px-3 border-r border-black w-48">Component</th>
                      <th className="py-2.5 px-3 border-r border-black">Condition Before</th>
                      <th className="py-2.5 px-3 border-r border-black">Inspection Notes</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.observationTable23.map((sec, sIdx) => (
                      <React.Fragment key={`sec-${sIdx}`}>
                        <tr className="bg-[#92B8DE] text-slate-900 font-bold">
                          <td colSpan={4} className="py-1.5 px-2">
                            <input
                              type="text"
                              value={sec.scope}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                updated.observationTable23[sIdx].scope = e.target.value;
                                setReportData(updated);
                              }}
                              className="w-full font-bold text-slate-900 bg-transparent hover:bg-white/40 focus:bg-white/60 rounded px-1 outline-none text-xs"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center print:hidden">
                            <button
                              onClick={() => {
                                const updated = { ...reportData };
                                const newNo = updated.observationTable23[sIdx].items.length + 1;
                                updated.observationTable23[sIdx].items.push({
                                  no: newNo,
                                  component: 'Komponen Baru',
                                  conditionBefore: 'Normal',
                                  inspectionNotes: 'Tidak ada anomali.'
                                });
                                setReportData(updated);
                                toast.success('Baris temuan ditambahkan!');
                              }}
                              className="px-2 py-0.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-[10px] font-sans cursor-pointer whitespace-nowrap"
                            >
                              + Baris
                            </button>
                          </td>
                        </tr>
                        {sec.items.map((item, iIdx) => (
                          <tr key={`item-${sIdx}-${iIdx}`} className="hover:bg-blue-50/20">
                            <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                            <td className="py-1 px-2 border-r border-black font-bold">
                              <input
                                type="text"
                                value={item.component}
                                onChange={(e) => {
                                  const updated = { ...reportData };
                                  updated.observationTable23[sIdx].items[iIdx].component = e.target.value;
                                  setReportData(updated);
                                }}
                                className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                              />
                            </td>
                            <td className="py-1 px-2 border-r border-black">
                              <BilingualTextarea
                                value={item.conditionBefore}
                                onChange={(val) => {
                                  const updated = { ...reportData };
                                  updated.observationTable23[sIdx].items[iIdx].conditionBefore = val;
                                  setReportData(updated);
                                }}
                                placeholderEn="Condition before (EN)..."
                                placeholderId="Kondisi awal (ID - garis miring)..."
                                classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                indentId={true}
                              />
                            </td>
                            <td className="py-1 px-2 border-r border-black">
                              <BilingualTextarea
                                value={item.inspectionNotes}
                                onChange={(val) => {
                                  const updated = { ...reportData };
                                  updated.observationTable23[sIdx].items[iIdx].inspectionNotes = val;
                                  setReportData(updated);
                                }}
                                placeholderEn="Inspection notes (EN)..."
                                placeholderId="Catatan inspeksi (ID - garis miring)..."
                                classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                indentId={true}
                              />
                            </td>
                            <td className="py-2 px-1 text-center border-black align-middle print:hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  setReportData(prev => {
                                    if (!prev) return prev;
                                    const newObs = prev.observationTable23.map((s, idx) => {
                                      if (idx !== sIdx) return s;
                                      const newItems = s.items.filter((_, itemIndex) => itemIndex !== iIdx).map((it, nIdx) => ({
                                        ...it,
                                        no: nIdx + 1
                                      }));
                                      return { ...s, items: newItems };
                                    });
                                    return { ...prev, observationTable23: newObs };
                                  });
                                  toast.info('Baris temuan dihapus.');
                                }}
                                className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                                title="Hapus baris"
                              >
                                <Trash2 className="w-3.5 h-3.5 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Root Cause Analyses Section (Sub-section Bab 7) */}
              <div className="space-y-6 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10pt] font-bold text-slate-900">Root Cause Analysis:</h3>
                  <button
                    type="button"
                    onClick={() => {
                      const newRca = [
                        ...(reportData.rootCauseAnalyses || []),
                        {
                          title: 'Analisis Root Cause Baru',
                          system: 'General Facility System',
                          description: 'The system operates within normal limits following the corrective action.\nSistem beroperasi dalam batas normal setelah tindakan korektif dilakukan.',
                          photos: []
                        }
                      ];
                      setReportData({ ...reportData, rootCauseAnalyses: newRca });
                      toast.success('RCA baru berhasil ditambahkan!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Root Cause</span>
                  </button>
                </div>

                {(reportData.rootCauseAnalyses || []).map((rca, rIdx) => {
                  const letter = String.fromCharCode(65 + rIdx);
                  const cleanTitle = (rca.title || '').replace(/^[A-Z]\.\s*/, '').trim();
                  const displayTitle = `${letter}. ${cleanTitle}`;

                  return (
                    <div key={rIdx} className="p-4 border border-black rounded-xl space-y-3 bg-slate-50/40">
                      <div className="flex items-center justify-between">
                        <textarea
                          rows={rca.title?.includes('\n') ? 2 : 1}
                          value={rca.title || displayTitle}
                          onChange={(e) => {
                            const updated = { ...reportData };
                            updated.rootCauseAnalyses[rIdx].title = e.target.value;
                            setReportData(updated);
                          }}
                          className="text-[10pt] font-bold text-slate-950 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 outline-none w-3/4 resize-none leading-tight font-serif whitespace-pre-line"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setReportData(prev => {
                              if (!prev) return prev;
                              const newRca = (prev.rootCauseAnalyses || []).filter((_, i) => i !== rIdx);
                              return { ...prev, rootCauseAnalyses: newRca };
                            });
                            toast.info('RCA dihapus.');
                          }}
                          className="p-1 hover:text-red-600 transition-colors cursor-pointer print:hidden"
                          title="Hapus RCA"
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" />
                        </button>
                      </div>
                      <textarea
                        value={rca.description}
                        rows={4}
                        placeholder="Baris 1: Deskripsi bahasa Inggris (regular)&#10;Baris 2: Terjemahan bahasa Indonesia (italic)"
                        onChange={(e) => {
                          const updated = { ...reportData };
                          updated.rootCauseAnalyses[rIdx].description = e.target.value;
                          setReportData(updated);
                        }}
                        className="w-full text-[10pt] text-slate-800 p-2 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none resize-y font-serif leading-relaxed"
                      />
                      {/* Tabel Documentasi Photo Sesuai Standar Template NeutraDC */}
                      <div className="border border-black overflow-hidden font-serif mt-3">
                        <table className="w-full border-collapse text-[9pt]">
                          <thead>
                            <tr className="bg-[#2E74B5] text-white">
                              <th colSpan={2} className="py-1 px-2 text-center font-bold">Documentasi Photo</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="h-32 divide-x divide-black border-t border-black">
                              <td className="w-1/2 p-2 text-center align-middle bg-slate-50/20">
                                {rca.photos?.[0]?.url ? (
                                  <img src={rca.photos[0].url} alt="Photo 1" className="max-h-28 mx-auto object-contain" />
                                ) : (
                                  <span className="text-slate-400 italic text-xs">[ Area Foto 1 ]</span>
                                )}
                              </td>
                              <td className="w-1/2 p-2 text-center align-middle bg-slate-50/20">
                                {rca.photos?.[1]?.url ? (
                                  <img src={rca.photos[1].url} alt="Photo 2" className="max-h-28 mx-auto object-contain" />
                                ) : (
                                  <span className="text-slate-400 italic text-xs">[ Area Foto 2 ]</span>
                                )}
                              </td>
                            </tr>
                            <tr className="divide-x divide-black border-t border-black bg-white">
                              <td className="w-1/2 py-1 px-2 text-center text-slate-800 font-sans text-xs">
                                {rca.photos?.[0]?.caption || `${cleanTitle} - Pre / Condition`}
                              </td>
                              <td className="w-1/2 py-1 px-2 text-center text-slate-800 font-sans text-xs">
                                {rca.photos?.[1]?.caption || `${cleanTitle} - Post / Rectified`}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 8: REPAIRS, REPLACEMENT & SERVICES (TABEL 29)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 8 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[11pt] font-bold text-slate-900">8. Repairs, Replacement & Services</h2>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    Data suku cadang ditarik 100% dari Laporan Corrective Maintenance (CM) Standby Engineer bulan ini.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    updated.repairsTable29.push({
                      equipment: 'Equipment Baru',
                      partName: 'Part Komponen',
                      partNumber: '-',
                      quantity: '1 Pcs',
                      replacedStatus: 'Replaced'
                    });
                    setReportData(updated);
                    toast.success('Baris baru berhasil ditambahkan ke Tabel 29!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris</span>
                </button>
              </div>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 29. Repair, Replacement & Services
              </p>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 border-r border-black">Equipment</th>
                      <th className="py-2.5 px-3 border-r border-black">Part Name</th>
                      <th className="py-2.5 px-3 border-r border-black">Part Number</th>
                      <th className="py-2.5 px-3 text-center border-r border-black">Quantity</th>
                      <th className="py-2.5 px-3 text-center border-r border-black">Status</th>
                      <th className="py-2.5 px-2 text-center w-10 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.repairsTable29.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500 italic font-sans text-xs bg-slate-50/50">
                          Tidak ada data pergantian suku cadang (spare part replacement) pada periode bulan ini.
                        </td>
                      </tr>
                    ) : (
                      reportData.repairsTable29.map((r, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/20">
                          <td className="py-1 px-2 font-bold border-r border-black">
                            <input
                              type="text"
                              value={r.equipment}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                updated.repairsTable29[idx].equipment = e.target.value;
                                setReportData(updated);
                              }}
                              className="w-full text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-bold"
                            />
                          </td>
                          <td className="py-1 px-2 border-r border-black">
                            <BilingualTextarea
                              value={r.partName}
                              onChange={(val) => {
                                const updated = { ...reportData };
                                updated.repairsTable29[idx].partName = val;
                                setReportData(updated);
                              }}
                              placeholderEn="Part name (EN)..."
                              placeholderId="Nama komponen (ID - garis miring)..."
                              classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-serif"
                              classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-serif"
                              indentId={true}
                            />
                          </td>
                          <td className="py-1 px-2 border-r border-black font-mono text-[11px]">
                            <input
                              type="text"
                              value={r.partNumber}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                updated.repairsTable29[idx].partNumber = e.target.value;
                                setReportData(updated);
                              }}
                              className="w-full text-[11px] font-mono py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            />
                          </td>
                          <td className="py-1 px-2 text-center border-r border-black">
                            <input
                              type="text"
                              value={r.quantity}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                updated.repairsTable29[idx].quantity = e.target.value;
                                setReportData(updated);
                              }}
                              className="w-full text-center text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            />
                          </td>
                          <td className="py-1 px-2 text-center border-r border-black font-semibold">
                            <BilingualTextarea
                              value={r.replacedStatus}
                              onChange={(val) => {
                                const updated = { ...reportData };
                                updated.repairsTable29[idx].replacedStatus = val;
                                setReportData(updated);
                              }}
                              placeholderEn="Status (EN)..."
                              placeholderId="Status (ID - garis miring)..."
                              classNameEn="w-full text-center text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-semibold font-serif"
                              classNameId="w-full text-center text-[10px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-serif"
                              indentId={false}
                            />
                          </td>
                          <td className="py-1 px-2 text-center print:hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setReportData(prev => {
                                  if (!prev) return prev;
                                  const newRepairs = (prev.repairsTable29 || []).filter((_, i) => i !== idx);
                                  return { ...prev, repairsTable29: newRepairs };
                                });
                                toast.info('Baris perbaikan dihapus.');
                              }}
                              className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-3.5 h-3.5 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 9: TESTING & VALIDATION (TABEL 30 & TABEL 31)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 9 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-[11pt] font-bold text-slate-900">9. Testing & Validation</h2>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      const newNo = updated.calibrationTable30.length + 1;
                      updated.calibrationTable30.push({
                        no: newNo,
                        component: 'Komponen Baru',
                        calibrationDetail: 'Zero offset & sensitivity calibration.'
                      });
                      setReportData(updated);
                      toast.success('Baris kalibrasi baru ditambahkan!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Kalibrasi</span>
                  </button>
                  <button
                    onClick={handleAITesting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold font-sans shadow-xs transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>AI Generate Metode Uji</span>
                  </button>
                </div>
              </div>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 30. Calibration and Adjustments Performed
              </p>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-12 border-r border-black">No</th>
                      <th className="py-2.5 px-3 w-60 border-r border-black">Component Maintenance</th>
                      <th className="py-2.5 px-3 border-r border-black">Calibration Performed</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.calibrationTable30.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                        <td className="py-1 px-2 font-bold border-r border-black text-blue-950">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.calibrationTable30[idx].component = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-2 border-r border-black">
                          <BilingualTextarea
                            value={item.calibrationDetail}
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.calibrationTable30[idx].calibrationDetail = val;
                              setReportData(updated);
                            }}
                            placeholderEn="Calibration detail (EN)..."
                            placeholderId="Detail kalibrasi (ID - garis miring)..."
                            classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            indentId={true}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setReportData(prev => {
                                if (!prev) return prev;
                                const newCal = (prev.calibrationTable30 || [])
                                  .filter((_, i) => i !== idx)
                                  .map((it, i) => ({ ...it, no: i + 1 }));
                                return { ...prev, calibrationTable30: newCal };
                              });
                              toast.info('Baris kalibrasi dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-8 mb-3">
                <p className="font-bold text-center text-slate-900 text-sm">
                  Table 31. Validation Methods
                </p>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    const newNo = updated.validationMethodsTable31.length + 1;
                    updated.validationMethodsTable31.push({
                      no: newNo,
                      component: 'Komponen Baru',
                      validationMethod: 'Functional step-by-step test & simulation.'
                    });
                    setReportData(updated);
                    toast.success('Baris validasi baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Validasi</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-12 border-r border-black">No</th>
                      <th className="py-2.5 px-3 w-60 border-r border-black">Component Maintenance</th>
                      <th className="py-2.5 px-3 border-r border-black">Validation Methods</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.validationMethodsTable31.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                        <td className="py-1 px-2 font-bold border-r border-black text-blue-950">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.validationMethodsTable31[idx].component = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-2 border-r border-black">
                          <BilingualTextarea
                            value={item.validationMethod}
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.validationMethodsTable31[idx].validationMethod = val;
                              setReportData(updated);
                            }}
                            placeholderEn="Validation method (EN)..."
                            placeholderId="Metode validasi (ID - garis miring)..."
                            classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            indentId={true}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setReportData(prev => {
                                if (!prev) return prev;
                                const newVal = (prev.validationMethodsTable31 || [])
                                  .filter((_, i) => i !== idx)
                                  .map((it, i) => ({ ...it, no: i + 1 }));
                                return { ...prev, validationMethodsTable31: newVal };
                              });
                              toast.info('Baris validasi dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 10: CHALLENGES, MITIGATION & LESSON LEARNED (TABEL 32 - 34)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 10 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-[11pt] font-bold text-slate-900">10. Challenges, Mitigation and Lesson Learned</h2>
                <button
                  onClick={handleAIChallenges}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold font-sans shadow-xs transition-all cursor-pointer print:hidden"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>AI Susun Tantangan & Mitigasi</span>
                </button>
              </div>

              {/* Table 32: Challenges */}
              <div className="flex items-center justify-between my-3">
                <p className="font-bold text-slate-900 text-sm">
                  Table 32. Challenges Faced
                </p>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    const newNo = updated.challengesTable32.length + 1;
                    updated.challengesTable32.push({
                      no: newNo,
                      component: 'Komponen Baru',
                      challenge: 'Deskripsi kendala teknis / operasional yang dihadapi.'
                    });
                    setReportData(updated);
                    toast.success('Tantangan baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Tantangan</span>
                </button>
              </div>
              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-12 border-r border-black">No</th>
                      <th className="py-2.5 px-3 w-60 border-r border-black">Component Maintenance</th>
                      <th className="py-2.5 px-3 border-r border-black">Challenges Faced</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.challengesTable32.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                        <td className="py-1 px-2 font-bold border-r border-black text-blue-950">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.challengesTable32[idx].component = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-2 border-r border-black">
                          <BilingualTextarea
                            value={item.challenge}
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.challengesTable32[idx].challenge = val;
                              setReportData(updated);
                            }}
                            placeholderEn="Challenges faced (EN)..."
                            placeholderId="Kendala yang dihadapi (ID - garis miring)..."
                            classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            indentId={true}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setReportData(prev => {
                                if (!prev) return prev;
                                const newCh = (prev.challengesTable32 || [])
                                  .filter((_, i) => i !== idx)
                                  .map((it, i) => ({ ...it, no: i + 1 }));
                                return { ...prev, challengesTable32: newCh };
                              });
                              toast.info('Tantangan dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table 33: Mitigation */}
              <div className="flex items-center justify-between mt-8 mb-3">
                <p className="font-bold text-slate-900 text-sm">
                  Table 33. Mitigation Steps
                </p>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    const newNo = updated.mitigationTable33.length + 1;
                    updated.mitigationTable33.push({
                      no: newNo,
                      component: 'Komponen Baru',
                      mitigation: 'Langkah mitigasi operasional dan koordinasi.'
                    });
                    setReportData(updated);
                    toast.success('Mitigasi baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Mitigasi</span>
                </button>
              </div>
              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-12 border-r border-black">No</th>
                      <th className="py-2.5 px-3 w-60 border-r border-black">Component Maintenance</th>
                      <th className="py-2.5 px-3 border-r border-black">Mitigation</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.mitigationTable33.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                        <td className="py-1 px-2 font-bold border-r border-black text-blue-950">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.mitigationTable33[idx].component = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-2 border-r border-black">
                          <BilingualTextarea
                            value={item.mitigation}
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.mitigationTable33[idx].mitigation = val;
                              setReportData(updated);
                            }}
                            placeholderEn="Mitigation steps (EN)..."
                            placeholderId="Langkah mitigasi (ID - garis miring)..."
                            classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            indentId={true}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setReportData(prev => {
                                if (!prev) return prev;
                                const newMit = (prev.mitigationTable33 || [])
                                  .filter((_, i) => i !== idx)
                                  .map((it, i) => ({ ...it, no: i + 1 }));
                                return { ...prev, mitigationTable33: newMit };
                              });
                              toast.info('Mitigasi dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table 34: Lessons Learned */}
              <div className="flex items-center justify-between mt-8 mb-3">
                <p className="font-bold text-slate-900 text-sm">
                  Table 34. Lessons Learned
                </p>
                <button
                  onClick={() => {
                    const updated = { ...reportData };
                    const newNo = updated.lessonsLearnedTable34.length + 1;
                    updated.lessonsLearnedTable34.push({
                      no: newNo,
                      component: 'Komponen Baru',
                      lessonLearned: 'Pelajaran penting untuk peningkatan SOP mendatang.'
                    });
                    setReportData(updated);
                    toast.success('Lesson learned baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Lesson Learned</span>
                </button>
              </div>
              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-12 border-r border-black">No</th>
                      <th className="py-2.5 px-3 w-60 border-r border-black">Component Maintenance</th>
                      <th className="py-2.5 px-3 border-r border-black">Lesson Learned</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.lessonsLearnedTable34.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                        <td className="py-1 px-2 font-bold border-r border-black text-blue-950">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.lessonsLearnedTable34[idx].component = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                          />
                        </td>
                        <td className="py-1 px-2 border-r border-black">
                          <BilingualTextarea
                            value={item.lessonLearned}
                            onChange={(val) => {
                              const updated = { ...reportData };
                              updated.lessonsLearnedTable34[idx].lessonLearned = val;
                              setReportData(updated);
                            }}
                            placeholderEn="Lesson learned (EN)..."
                            placeholderId="Pelajaran yang dipetik (ID - garis miring)..."
                            classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                            indentId={true}
                          />
                        </td>
                        <td className="py-1 px-1 text-center print:hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setReportData(prev => {
                                if (!prev) return prev;
                                const newLL = (prev.lessonsLearnedTable34 || [])
                                  .filter((_, i) => i !== idx)
                                  .map((it, i) => ({ ...it, no: i + 1 }));
                                return { ...prev, lessonsLearnedTable34: newLL };
                              });
                              toast.info('Lesson learned dihapus.');
                            }}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 11: RECOMMENDATIONS & FUTURE ACTION (TABEL 35)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 11 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[11pt] font-bold text-slate-900">11. Recommendations and Future Action</h2>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    Dihubungkan langsung dari temuan anomali Bab 7 ke rekomendasi Short-Term dan Long-Term.
                  </p>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={() => {
                      const updated = { ...reportData };
                      updated.recommendationsTable35.push({
                        scope: 'LINGKUP PERALATAN BARU',
                        items: [
                          {
                            no: 1,
                            component: 'Komponen Baru',
                            shortTerm: 'Rekomendasi jangka pendek.',
                            longTerm: 'Rekomendasi jangka panjang.'
                          }
                        ]
                      });
                      setReportData(updated);
                      toast.success('Lingkup rekomendasi baru ditambahkan!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Lingkup Rekomendasi</span>
                  </button>
                  <button
                    onClick={handleAIRecs}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold font-sans shadow-xs transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>AI Rekomendasi dari Bab 7</span>
                  </button>
                </div>
              </div>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 35. Recommendations and Future Action
              </p>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-10 border-r border-black">No</th>
                      <th className="py-2.5 px-3 border-r border-black w-48">Component</th>
                      <th className="py-2.5 px-3 border-r border-black">Short-Term Recommendations</th>
                      <th className="py-2.5 px-3 border-r border-black">Long-Term Recommendations</th>
                      <th className="py-2.5 px-2 text-center w-8 print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.recommendationsTable35.map((rSec, sIdx) => (
                      <React.Fragment key={`rsec-${sIdx}`}>
                        <tr className="bg-[#92B8DE] text-slate-900 font-bold">
                          <td colSpan={4} className="py-1.5 px-2">
                            <input
                              type="text"
                              value={rSec.scope}
                              onChange={(e) => {
                                const updated = { ...reportData };
                                updated.recommendationsTable35[sIdx].scope = e.target.value;
                                setReportData(updated);
                              }}
                              className="w-full font-bold text-slate-900 bg-transparent hover:bg-white/40 focus:bg-white/60 rounded px-1 outline-none text-xs"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center print:hidden">
                            <button
                              onClick={() => {
                                const updated = { ...reportData };
                                const newNo = updated.recommendationsTable35[sIdx].items.length + 1;
                                updated.recommendationsTable35[sIdx].items.push({
                                  no: newNo,
                                  component: 'Komponen Baru',
                                  shortTerm: 'Tindakan jangka pendek.',
                                  longTerm: 'Tindakan jangka panjang.'
                                });
                                setReportData(updated);
                                toast.success('Baris rekomendasi ditambahkan!');
                              }}
                              className="px-2 py-0.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-[10px] font-sans cursor-pointer whitespace-nowrap"
                            >
                              + Baris
                            </button>
                          </td>
                        </tr>
                        {rSec.items.map((item, iIdx) => (
                          <tr key={`ritem-${sIdx}-${iIdx}`} className="hover:bg-blue-50/20">
                            <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                            <td className="py-1 px-2 border-r border-black font-bold">
                              <input
                                type="text"
                                value={item.component}
                                onChange={(e) => {
                                  const updated = { ...reportData };
                                  updated.recommendationsTable35[sIdx].items[iIdx].component = e.target.value;
                                  setReportData(updated);
                                }}
                                className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                              />
                            </td>
                            <td className="py-1 px-2 border-r border-black">
                              <BilingualTextarea
                                value={item.shortTerm}
                                onChange={(val) => {
                                  const updated = { ...reportData };
                                  updated.recommendationsTable35[sIdx].items[iIdx].shortTerm = val;
                                  setReportData(updated);
                                }}
                                placeholderEn="Short-term recommendation (EN)..."
                                placeholderId="Rekomendasi jangka pendek (ID - garis miring)..."
                                classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                indentId={true}
                              />
                            </td>
                            <td className="py-1 px-2 border-r border-black">
                              <BilingualTextarea
                                value={item.longTerm}
                                onChange={(val) => {
                                  const updated = { ...reportData };
                                  updated.recommendationsTable35[sIdx].items[iIdx].longTerm = val;
                                  setReportData(updated);
                                }}
                                placeholderEn="Long-term recommendation (EN)..."
                                placeholderId="Rekomendasi jangka panjang (ID - garis miring)..."
                                classNameEn="w-full text-xs py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                classNameId="w-full text-[11px] italic text-slate-600 py-0.5 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none font-sans"
                                indentId={true}
                              />
                            </td>
                            <td className="py-1 px-1 text-center print:hidden">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setReportData(prev => {
                                    if (!prev) return prev;
                                    const newRecs = (prev.recommendationsTable35 || []).map((sec, si) => {
                                      if (si !== sIdx) return sec;
                                      const newItems = (sec.items || [])
                                        .filter((_, idx) => idx !== iIdx)
                                        .map((it, idx) => ({ ...it, no: idx + 1 }));
                                      return { ...sec, items: newItems };
                                    });
                                    return { ...prev, recommendationsTable35: newRecs };
                                  });
                                  toast.info('Baris rekomendasi dihapus.');
                                }}
                                className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                                title="Hapus baris"
                              >
                                <Trash2 className="w-3.5 h-3.5 mx-auto text-slate-400 hover:text-red-600" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 12: PHOTO AND DOCUMENTATION LOG (TABEL 36)
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 12 || window.matchMedia('print').matches) && (
            <section className="space-y-6 font-serif">
              <div className="flex justify-end mb-4">
                <img src={logoNeutraDC} alt="NeutraDC Logo" className="h-10 object-contain" />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-[11pt] font-bold text-slate-900">12. Photo and Documentation Log</h2>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...reportData };
                    const nextNo = updated.photoLogsTable36.length + 1;
                    updated.photoLogsTable36.push({
                      no: nextNo,
                      component: 'Equipment / Area Dokumentasi',
                      prePhoto: '',
                      duringPhoto: '',
                      postPhoto: '',
                      caption: ''
                    });
                    setReportData(updated);
                    toast.success('Baris dokumentasi foto baru ditambahkan!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer print:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris Foto</span>
                </button>
              </div>

              <p className="font-bold text-center text-slate-900 text-sm my-3">
                Table 36. Photo and Documentation Log
              </p>

              <div className="overflow-x-auto border border-black">
                <table className="w-full text-left text-xs border-collapse font-serif">
                  <thead>
                    <tr className="bg-[#0066B3] text-white font-bold border-b border-black">
                      <th className="py-2.5 px-3 text-center w-10 border-r border-black">No</th>
                      <th className="py-2.5 px-3 border-r border-black">Component Maintenance</th>
                      <th className="py-2.5 px-3 text-center border-r border-black">Pre-Maintenance</th>
                      <th className="py-2.5 px-3 text-center border-r border-black">Activities</th>
                      <th className="py-2.5 px-3 text-center">Post-Maintenance</th>
                      <th className="py-2.5 px-2 w-10 print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-slate-800">
                    {reportData.photoLogsTable36.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20 group">
                        <td className="py-2 px-3 text-center font-bold border-r border-black">{item.no}</td>
                        <td className="py-2 px-3 font-bold border-r border-black">
                          <input
                            type="text"
                            value={item.component}
                            onChange={(e) => {
                              const updated = { ...reportData };
                              updated.photoLogsTable36[idx].component = e.target.value;
                              setReportData(updated);
                            }}
                            className="w-full text-xs font-bold py-1 px-1 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded outline-none"
                            placeholder="Nama komponen / aktivitas"
                          />
                        </td>
                        {/* Pre-Maintenance Photo Cell */}
                        <td className="py-2 px-3 text-center border-r border-black align-middle">
                          {item.prePhoto ? (
                            <div className="flex flex-col items-center gap-1.5 py-1">
                              <div className="relative group/photo overflow-hidden rounded-lg border border-black bg-slate-100 shadow-xs">
                                <img
                                  src={item.prePhoto}
                                  alt="Pre-Maintenance"
                                  className="h-20 sm:h-24 w-auto max-w-[130px] object-cover rounded-lg transition-transform group-hover/photo:scale-105"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = 'https://placehold.co/300x200/e2e8f0/475569?text=Pre-Maintenance';
                                  }}
                                />
                                {/* Action Overlay On Hover */}
                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center gap-2 print:hidden">
                                  <label
                                    className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-110"
                                    title="Ganti Foto (Upload File)"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handlePhotoUpload(e.target.files?.[0], idx, 'prePhoto')}
                                      className="hidden"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCellPhoto(idx, 'prePhoto')}
                                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-110"
                                    title="Hapus Foto"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteCellPhoto(idx, 'prePhoto')}
                                className="text-[10px] text-red-600 hover:text-red-800 font-semibold flex items-center gap-0.5 print:hidden cursor-pointer"
                                title="Hapus foto dari kolom ini"
                              >
                                <X className="w-3 h-3" />
                                <span>Hapus Foto</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-2 px-1">
                              <span className="hidden print:inline text-slate-500 italic text-[11px]">
                                [ Foto Terlampir / Normal ]
                              </span>
                              <div className="print:hidden flex flex-col items-center gap-1.5 w-full">
                                <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold cursor-pointer transition-all hover:shadow-xs w-full max-w-[125px]">
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>+ Add Foto</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handlePhotoUpload(e.target.files?.[0], idx, 'prePhoto')}
                                    className="hidden"
                                  />
                                </label>
                                <input
                                  type="text"
                                  placeholder="atau paste URL..."
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      if (val) {
                                        const updated = { ...reportData };
                                        updated.photoLogsTable36[idx].prePhoto = val;
                                        setReportData(updated);
                                        toast.success('URL foto disimpan');
                                        (e.target as HTMLInputElement).value = '';
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val) {
                                      const updated = { ...reportData };
                                      updated.photoLogsTable36[idx].prePhoto = val;
                                      setReportData(updated);
                                      toast.success('URL foto disimpan');
                                      e.target.value = '';
                                    }
                                  }}
                                  className="text-[10px] text-center w-full max-w-[125px] px-1.5 py-0.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded text-slate-600 outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Activities Photo Cell */}
                        <td className="py-2 px-3 text-center border-r border-black align-middle">
                          {item.duringPhoto ? (
                            <div className="flex flex-col items-center gap-1.5 py-1">
                              <div className="relative group/photo overflow-hidden rounded-lg border border-black bg-slate-100 shadow-xs">
                                <img
                                  src={item.duringPhoto}
                                  alt="Activities"
                                  className="h-20 sm:h-24 w-auto max-w-[130px] object-cover rounded-lg transition-transform group-hover/photo:scale-105"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = 'https://placehold.co/300x200/e2e8f0/475569?text=Activities';
                                  }}
                                />
                                {/* Action Overlay On Hover */}
                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center gap-2 print:hidden">
                                  <label
                                    className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-110"
                                    title="Ganti Foto (Upload File)"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handlePhotoUpload(e.target.files?.[0], idx, 'duringPhoto')}
                                      className="hidden"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCellPhoto(idx, 'duringPhoto')}
                                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-110"
                                    title="Hapus Foto"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteCellPhoto(idx, 'duringPhoto')}
                                className="text-[10px] text-red-600 hover:text-red-800 font-semibold flex items-center gap-0.5 print:hidden cursor-pointer"
                                title="Hapus foto dari kolom ini"
                              >
                                <X className="w-3 h-3" />
                                <span>Hapus Foto</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-2 px-1">
                              <span className="hidden print:inline text-slate-500 italic text-[11px]">
                                [ Foto Aktivitas PM ]
                              </span>
                              <div className="print:hidden flex flex-col items-center gap-1.5 w-full">
                                <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold cursor-pointer transition-all hover:shadow-xs w-full max-w-[125px]">
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>+ Add Foto</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handlePhotoUpload(e.target.files?.[0], idx, 'duringPhoto')}
                                    className="hidden"
                                  />
                                </label>
                                <input
                                  type="text"
                                  placeholder="atau paste URL..."
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      if (val) {
                                        const updated = { ...reportData };
                                        updated.photoLogsTable36[idx].duringPhoto = val;
                                        setReportData(updated);
                                        toast.success('URL foto disimpan');
                                        (e.target as HTMLInputElement).value = '';
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val) {
                                      const updated = { ...reportData };
                                      updated.photoLogsTable36[idx].duringPhoto = val;
                                      setReportData(updated);
                                      toast.success('URL foto disimpan');
                                      e.target.value = '';
                                    }
                                  }}
                                  className="text-[10px] text-center w-full max-w-[125px] px-1.5 py-0.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded text-slate-600 outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Post-Maintenance Photo Cell */}
                        <td className="py-2 px-3 text-center align-middle">
                          {item.postPhoto ? (
                            <div className="flex flex-col items-center gap-1.5 py-1">
                              <div className="relative group/photo overflow-hidden rounded-lg border border-black bg-slate-100 shadow-xs">
                                <img
                                  src={item.postPhoto}
                                  alt="Post-Maintenance"
                                  className="h-20 sm:h-24 w-auto max-w-[130px] object-cover rounded-lg transition-transform group-hover/photo:scale-105"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = 'https://placehold.co/300x200/e2e8f0/475569?text=Post-Maintenance';
                                  }}
                                />
                                {/* Action Overlay On Hover */}
                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center gap-2 print:hidden">
                                  <label
                                    className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-110"
                                    title="Ganti Foto (Upload File)"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handlePhotoUpload(e.target.files?.[0], idx, 'postPhoto')}
                                      className="hidden"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCellPhoto(idx, 'postPhoto')}
                                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-110"
                                    title="Hapus Foto"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteCellPhoto(idx, 'postPhoto')}
                                className="text-[10px] text-red-600 hover:text-red-800 font-semibold flex items-center gap-0.5 print:hidden cursor-pointer"
                                title="Hapus foto dari kolom ini"
                              >
                                <X className="w-3 h-3" />
                                <span>Hapus Foto</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-2 px-1">
                              <span className="hidden print:inline text-slate-500 italic text-[11px]">
                                [ Verifikasi Selesai ]
                              </span>
                              <div className="print:hidden flex flex-col items-center gap-1.5 w-full">
                                <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold cursor-pointer transition-all hover:shadow-xs w-full max-w-[125px]">
                                  <Upload className="w-3.5 h-3.5" />
                                  <span>+ Add Foto</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handlePhotoUpload(e.target.files?.[0], idx, 'postPhoto')}
                                    className="hidden"
                                  />
                                </label>
                                <input
                                  type="text"
                                  placeholder="atau paste URL..."
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      if (val) {
                                        const updated = { ...reportData };
                                        updated.photoLogsTable36[idx].postPhoto = val;
                                        setReportData(updated);
                                        toast.success('URL foto disimpan');
                                        (e.target as HTMLInputElement).value = '';
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val) {
                                      const updated = { ...reportData };
                                      updated.photoLogsTable36[idx].postPhoto = val;
                                      setReportData(updated);
                                      toast.success('URL foto disimpan');
                                      e.target.value = '';
                                    }
                                  }}
                                  className="text-[10px] text-center w-full max-w-[125px] px-1.5 py-0.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded text-slate-600 outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-1 text-center print:hidden">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setReportData(prev => {
                                if (!prev) return prev;
                                const newPhotos = (prev.photoLogsTable36 || [])
                                  .filter((_, i) => i !== idx)
                                  .map((p, pIdx) => ({ ...p, no: pIdx + 1 }));
                                return { ...prev, photoLogsTable36: newPhotos };
                              });
                              toast.info('Baris dokumentasi foto dihapus');
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Hapus baris foto"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================================================================
              BAB 13: APPENDICES
              =================================================================== */}
          {(activeChapter === 0 || activeChapter === 13 || window.matchMedia('print').matches) && (
            <section className="space-y-4 font-serif border-t border-slate-200 pt-8">
              <h2 className="text-[11pt] font-bold text-slate-900">13. Appendices</h2>
              <textarea
                rows={3}
                value={reportData.appendicesNote !== undefined ? reportData.appendicesNote : 'Attach the original service report & supporting documents for certification, test results, etc.'}
                onChange={(e) => {
                  const updated = { ...reportData };
                  updated.appendicesNote = e.target.value;
                  setReportData(updated);
                }}
                className="w-full text-sm text-slate-600 italic leading-relaxed p-2.5 bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 rounded border border-transparent hover:border-black outline-none resize-y"
                placeholder="Catatan dokumen lampiran laporan..."
              />
              <TelkomPageFooter pageNumber="Appendices" />
            </section>
          )}

        </div>
      )}
        </>
      )}

      {/* ─── Tab 2: Arsip Dokumen Monthly Report ──────────────────────────────── */}
      {activeMainTab === 'archives' && (
        <div className="space-y-6 font-sans">
          {/* Header Arsip */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-2">
                  <FolderArchive className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Arsip Dokumen Cloud Firestore</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Arsip Dokumen Monthly Report
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Daftar laporan bulanan yang telah diekspor ke Word (.docx) dan tersimpan di database. Anda dapat mengunduh ulang file atau memuatnya kembali ke editor untuk direvisi.
                </p>
              </div>

              {/* Counter Badge */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 shrink-0">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <FolderArchive className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Total Arsip</span>
                  <span className="text-xl font-black text-slate-800">{archives.length} Dokumen</span>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={archiveSearchQuery}
                  onChange={(e) => setArchiveSearchQuery(e.target.value)}
                  placeholder="Cari arsip berdasarkan judul, periode, quarter, equipment, atau pembuat..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs text-slate-800 font-sans outline-none transition-all"
                />
                {archiveSearchQuery && (
                  <button
                    onClick={() => setArchiveSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* List Kartu Arsip */}
          {loadingArchives ? (
            <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">Memuat arsip laporan...</p>
            </div>
          ) : filteredArchives.length === 0 ? (
            <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center space-y-3">
              <FolderArchive className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">
                {archiveSearchQuery ? 'Tidak Ada Arsip yang Cocok' : 'Belum Ada Arsip Dokumen Monthly Report'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {archiveSearchQuery
                  ? 'Coba gunakan kata kunci pencarian yang lain.'
                  : 'Klik tombol "Ekspor Word (.docx)" di Editor Laporan untuk menyimpan dokumen secara otomatis ke arsip ini.'}
              </p>
              {!archiveSearchQuery && (
                <button
                  onClick={() => setActiveMainTab('editor')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Buka Editor Laporan
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredArchives.map((archive) => (
                <div
                  key={archive.id}
                  className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          {archive.quarter || 'Q3'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {archive.monthName} {archive.year}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {archive.createdAt?.toDate ? (
                            archive.createdAt.toDate().toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          ) : 'Tanggal tidak tersedia'}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">
                        {archive.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-sans">
                        Kontrak: <span className="font-semibold text-slate-700">{archive.contractNumber || 'K.TDE.0105/LEG.PRJ/VI/2026'}</span> · Dibuat oleh: <span className="font-semibold text-slate-700">{archive.createdByName || archive.createdBy || 'Teknisi'}</span>
                      </p>
                    </div>

                    {/* Tombol Aksi */}
                    <div className="flex items-center gap-2 self-start shrink-0 font-sans">
                      <button
                        onClick={() => handleLoadArchiveToEditor(archive)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        title="Buka kembali di Editor untuk diedit / direvisi"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Kembali</span>
                      </button>

                      <button
                        onClick={() => handleDownloadArchive(archive)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        title="Download ulang file .docx"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh .docx</span>
                      </button>

                      <button
                        onClick={() => setArchiveToDelete({ id: archive.id, title: archive.title || 'Laporan Bulanan' })}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-200 transition-all cursor-pointer"
                        title="Hapus arsip ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Ringkasan Scope Equipment & CI */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                        Lingkup Peralatan ({archive.selectedEquipments?.length || 0} Equipment):
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(archive.selectedEquipments || []).map((eq: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-md text-[10px] font-semibold"
                          >
                            {eq}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4 shrink-0">
                      <span className="text-[10px] text-slate-500 font-semibold block">Total CI Terdaftar</span>
                      <span className="text-sm font-black text-blue-700">
                        {archive.totalCINames || (archive.reportData?.taskPerformanceTables || []).reduce((acc: number, t: any) => acc + (t.items?.length || 0), 0)} CI
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Modal Pilih Equipment & CI Name dari BOQ ─────────────────────────── */}
      {isBoqSelectorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 font-sans">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                    Pilih Equipment & CI Name dari BOQ
                  </h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Tentukan lingkup peralatan yang masuk ke dalam Monthly Report (Bab 2, 5, dan 6)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block px-3 py-1 bg-white/15 rounded-full text-xs font-bold text-white border border-white/20">
                  {selectedCategoryIds.size} Equipment · {totalSelectedBOQCI} CI Terpilih
                </span>
                <button
                  onClick={() => setIsBoqSelectorOpen(false)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Search & Quick Selection Toolbar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  placeholder="Cari nama equipment (cth: Trafo, Chiller, Genset, LV, CRAC)..."
                  className="w-full pl-9 pr-9 py-2 bg-white text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                {categorySearchQuery && (
                  <button
                    onClick={() => setCategorySearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = new Set(MAINTENANCE_BOQ_CATEGORIES.map(c => c.id));
                    setSelectedCategoryIds(allIds);
                    const map = new Map<string, Set<string>>();
                    MAINTENANCE_BOQ_CATEGORIES.forEach(c => {
                      map.set(c.id, new Set(c.items.map(it => it['CI Name*'] || '').filter(Boolean)));
                    });
                    setSelectedCINames(map);
                  }}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Pilih Semua Equipment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryIds(new Set());
                    setSelectedCINames(new Map());
                  }}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Batal Semua
                </button>
              </div>
            </div>

            {/* Modal Body: Accordion Equipment & CI Checklist */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {filteredBOQCategories.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">Tidak ditemukan equipment dengan kata kunci "{categorySearchQuery}"</p>
                </div>
              ) : (
                filteredBOQCategories.map((cat) => {
                  const isSelected = selectedCategoryIds.has(cat.id);
                  const isExpanded = expandedCategories.has(cat.id);
                  const ciSet = selectedCINames.get(cat.id);
                  const selectedCount = ciSet?.size || 0;
                  const totalItems = cat.items.length;

                  return (
                    <div
                      key={cat.id}
                      className={`border rounded-2xl overflow-hidden transition-all ${
                        isSelected
                          ? 'border-blue-400 bg-blue-50/30 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Accordion Category Header */}
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-white">
                        <button
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className="flex-shrink-0 transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!isSelected) toggleCategory(cat.id);
                            else toggleExpand(cat.id);
                          }}
                          className="flex-1 text-left flex items-center gap-2.5 min-w-0 cursor-pointer"
                        >
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {cat.name}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold shrink-0">
                            {totalItems} CI
                          </span>
                          {isSelected && (
                            <span className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded-full font-bold shrink-0">
                              {selectedCount} Dipilih
                            </span>
                          )}
                        </button>

                        {isSelected && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(cat.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {/* Accordion Content: CI Checklist */}
                      {isSelected && isExpanded && (
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-700">
                              Daftar CI Name ({cat.name}):
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => selectAllCINames(cat.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-100/80 hover:bg-blue-200 rounded-lg transition-colors cursor-pointer"
                              >
                                <CheckCheck className="w-3 h-3" />
                                <span>Pilih Semua CI</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => deselectAllCINames(cat.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-100/80 hover:bg-red-200 rounded-lg transition-colors cursor-pointer"
                              >
                                <XCircle className="w-3 h-3" />
                                <span>Batal Semua</span>
                              </button>
                            </div>
                          </div>

                          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 border border-slate-200 rounded-xl p-2 bg-white">
                            {cat.items.map((item, itIdx) => {
                              const ciIdentifier = getBOQItemIdentifier(item);
                              if (!ciIdentifier) return null;
                              const isChecked = ciSet?.has(ciIdentifier) ||
                                                (item['CI Name*'] && ciSet?.has(item['CI Name*'])) ||
                                                (item['Class Id'] && ciSet?.has(item['Class Id'])) ||
                                                false;
                              return (
                                <button
                                  key={itIdx}
                                  type="button"
                                  onClick={() => toggleCIName(cat.id, ciIdentifier)}
                                  className={`w-full text-left flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                    isChecked
                                      ? 'bg-blue-50 text-blue-900 font-semibold'
                                      : 'text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {isChecked ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                                  )}
                                  <span className="truncate font-medium">{ciIdentifier}</span>
                                  {item['Class Id'] && item['Class Id'] !== ciIdentifier && (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-normal ml-auto shrink-0">
                                      {item['Class Id']}
                                    </span>
                                  )}
                                  {item['Capacity'] && (
                                    <span className="text-[10px] text-slate-400 font-normal shrink-0 ml-auto">
                                      {item['Capacity']}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] text-slate-500 leading-tight">
                💡 <span className="font-semibold text-slate-700">Auto-fill Task PM:</span> Otomatis ditarik dari checklist Service Report (SR) masing-masing peralatan.
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBoqSelectorOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleApplyBOQSelection}
                  disabled={selectedCategoryIds.size === 0 || totalSelectedBOQCI === 0}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Terapkan ke Laporan ({totalSelectedBOQCI} CI)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Konfirmasi Hapus Arsip Monthly Report (In-App Modal) ──────────────── */}
      <AnimatePresence>
        {archiveToDelete && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4"
            onClick={() => !isDeletingArchive && setArchiveToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 shadow-2xl relative overflow-hidden text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decorative background glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10">
                {/* Warning Icon */}
                <div className="w-16 h-16 bg-red-50 border border-red-200/80 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600 shadow-xs">
                  <Trash2 className="w-8 h-8" />
                </div>

                <h3 className="text-xl font-black text-slate-900 mb-2">
                  Hapus Arsip Laporan?
                </h3>
                <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                  Apakah Anda yakin ingin menghapus arsip dokumen laporan bulanan ini?
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 text-left">
                  <span className="text-xs font-bold text-slate-900 block truncate">
                    {archiveToDelete.title}
                  </span>
                  <span className="text-[11px] text-red-600 font-semibold block mt-0.5">
                    ⚠️ Tindakan ini permanen dan berkas akan dihapus dari Cloud Firestore.
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setArchiveToDelete(null)}
                    disabled={isDeletingArchive}
                    className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteArchive}
                    disabled={isDeletingArchive}
                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-red-500/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isDeletingArchive ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menghapus...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Ya, Hapus Arsip</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Modal Tambah Alat ke Tabel Scope Spesifik dari BOQ / Manual ─── */}
      {addToolTargetTable && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4"
          onClick={() => setAddToolTargetTable(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    Tambah Alat ke {addToolTargetTable.scope}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeAddToolBOQCategory
                      ? `Kategori BOQ: ${activeAddToolBOQCategory.name} (${filteredAddToolBOQItems.length} alat tersedia)`
                      : `Scope: ${addToolTargetTable.scope}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddToolTargetTable(null)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab switch: BOQ vs Manual */}
            <div className="px-5 pt-3 pb-2 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddToolCustomMode(false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  !isAddToolCustomMode
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Pilih dari BOQ Asset</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddToolCustomMode(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isAddToolCustomMode
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Input Manual (Custom)</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {!isAddToolCustomMode ? (
                <>
                  {/* Search & Action Bar */}
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={addToolSearchQuery}
                        onChange={(e) => setAddToolSearchQuery(e.target.value)}
                        placeholder={`Cari Class Name, lokasi, kapasitas ${addToolTargetTable.scope}...`}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      />
                      {addToolSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setAddToolSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={handleSelectAllAddToolCIs}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Pilih Semua ({filteredAddToolBOQItems.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectAllAddToolCIs}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Batal Semua</span>
                      </button>
                    </div>
                  </div>

                  {/* Items List */}
                  {filteredAddToolBOQItems.length === 0 ? (
                    <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">
                        Tidak ada peralatan BOQ yang cocok
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                        {addToolSearchQuery
                          ? 'Coba ganti kata kunci pencarian Anda, atau gunakan tab "Input Manual".'
                          : 'Kategori BOQ untuk scope ini belum memiliki asset terdaftar. Anda dapat menggunakan tab "Input Manual" untuk menambah alat baru.'}
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white">
                      {filteredAddToolBOQItems.map((prep) => {
                        const { details, item: it, uniqueKey } = prep;
                        const isChecked = selectedAddToolCIs.has(uniqueKey);

                        return (
                          <div
                            key={uniqueKey}
                            onClick={() => handleToggleAddToolCI(uniqueKey)}
                            className={`p-3 flex items-start gap-3 hover:bg-blue-50/40 cursor-pointer transition-colors ${
                              isChecked ? 'bg-blue-50/60' : ''
                            }`}
                          >
                            <div className="pt-0.5 shrink-0">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-slate-900 truncate">
                                  {details.className}
                                </span>
                                {it['Class Id'] && it['Class Id'] !== details.className && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                    {it['Class Id']}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                                <span>📍 {details.location}</span>
                                <span>⚡ {details.capacity}</span>
                                <span>🏷️ {details.productName}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* Custom Manual Form */
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Class Name / CI Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customToolForm.className}
                      onChange={(e) => setCustomToolForm({ ...customToolForm, className: e.target.value })}
                      placeholder={`Contoh: ${addToolTargetTable.scope} Unit 01`}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Kapasitas / Rating
                      </label>
                      <input
                        type="text"
                        value={customToolForm.capacity}
                        onChange={(e) => setCustomToolForm({ ...customToolForm, capacity: e.target.value })}
                        placeholder="Contoh: 2000 kVA / Standard Rating"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Lokasi / Room
                      </label>
                      <input
                        type="text"
                        value={customToolForm.location}
                        onChange={(e) => setCustomToolForm({ ...customToolForm, location: e.target.value })}
                        placeholder="Contoh: Lt. 1, Power Room"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Product Name / Manufacturer
                    </label>
                    <input
                      type="text"
                      value={customToolForm.productName}
                      onChange={(e) => setCustomToolForm({ ...customToolForm, productName: e.target.value })}
                      placeholder="Contoh: Schneider / Trafindo / OEM Certified"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500">
                {!isAddToolCustomMode ? (
                  <span>Terpilih: <strong className="text-blue-700">{selectedAddToolCIs.size}</strong> alat</span>
                ) : (
                  <span>Mode manual: 1 alat baru</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddToolTargetTable(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddTools}
                  disabled={!isAddToolCustomMode && selectedAddToolCIs.size === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {!isAddToolCustomMode
                      ? `Tambahkan (${selectedAddToolCIs.size} Alat)`
                      : 'Tambahkan Alat Manual'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Tambah Tabel Scope Baru dari BOQ (Kembalikan Tabel Terhapus) ─── */}
      {isAddScopeTableModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4"
          onClick={() => setIsAddScopeTableModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    Tambah / Pulihkan Tabel Scope dari BOQ
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pilih scope peralatan dari master BOQ untuk menambahkan atau mengembalikan tabel task performance.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddScopeTableModalOpen(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={newScopeSearchQuery}
                  onChange={(e) => setNewScopeSearchQuery(e.target.value)}
                  placeholder="Cari scope equipment (contoh: Water Leak, Trafo, UPS, Chiller, PAC)..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Categories List */}
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100">
              {MAINTENANCE_BOQ_CATEGORIES.filter(cat => {
                if (!newScopeSearchQuery.trim()) return true;
                const q = newScopeSearchQuery.toLowerCase().trim();
                return cat.name.toLowerCase().includes(q) || cat.id.toLowerCase().includes(q);
              }).map((cat) => {
                const alreadyExists = (reportData?.taskPerformanceTables || []).some(
                  tbl => tbl.scope.toLowerCase().trim() === cat.name.toLowerCase().trim()
                );
                const validCount = cat.items.filter(isValidBOQItem).length;

                return (
                  <div
                    key={cat.id}
                    className="py-3 px-2 flex items-center justify-between hover:bg-blue-50/40 rounded-xl transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{cat.name}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                          {validCount} asset
                        </span>
                        {alreadyExists && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                            Sudah ada di Laporan
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {cat.items[0]?.['Room Location'] || cat.items[0]?.Room || 'NeutraDC Campus'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddNewScopeTable(cat.id)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ml-3"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambahkan Tabel</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsAddScopeTableModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Floating Persistent Save Button (Bottom Right) ─── */}
      {reportData && (
        <div className="fixed bottom-6 right-6 z-50 print:hidden flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleManualSave}
            disabled={isSavingManual}
            className={`group flex items-center gap-2.5 px-5 py-3.5 rounded-2xl font-bold text-sm shadow-2xl transition-all duration-200 transform active:scale-95 cursor-pointer backdrop-blur-md ${
              justSaved
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/40 ring-2 ring-emerald-300'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/40 hover:shadow-blue-600/60 ring-2 ring-blue-400/40 hover:scale-105'
            }`}
            title="Simpan seluruh perubahan laporan ini agar tetap tersimpan saat halaman direfresh"
          >
            {isSavingManual ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                <span>Menyimpan...</span>
              </>
            ) : justSaved ? (
              <>
                <Check className="w-5 h-5 text-emerald-200 animate-in zoom-in-50 duration-200" />
                <span>Tersimpan!</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5 text-blue-200 group-hover:scale-110 transition-transform" />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
}
