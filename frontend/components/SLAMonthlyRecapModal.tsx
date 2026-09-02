// ============================================================================
// FILE: SLAMonthlyRecapModal.tsx
// Deskripsi: Modal Dialog Interaktif untuk Rekapitulasi Laporan SLA / SLG Bulanan.
//            Memungkinkan Standby Engineer memfilter pencapaian SLA berdasarkan
//            Bulan (misal: Juli) dan Tahun (2024 - 2030), menampilkan preview skor
//            SLG secara real-time, serta mengekspor rekapitulasi resmi dalam format
//            Microsoft Word (.docx) dan Microsoft Excel (.xlsx).
// ============================================================================

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  X,
  FileText,
  Calendar,
  Loader2,
  Clock,
  Filter,
  Layers,
  Search,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { exportSLAMonthlyRecapToDocx } from '@/utils/docxReportExport';
import { exportSLAMonthlyRecapToExcel } from '@/utils/excelExport';

export interface CorrectiveReportItem {
  id?: string;
  reportType?: 'standard' | 'cm_pdf' | 'CM_PDF' | 'sla' | 'SLA' | 'PIR' | string;
  ticketName?: string;
  incidentName?: string;
  equipmentName?: string;
  location?: string;
  issue?: string;
  actionTaken?: string;
  priority?: 'Critical' | 'High' | 'Medium' | 'Low';
  picDME?: string;
  picTDE?: string;
  timeOrder?: string;
  actualTimeResponse?: string;
  actualResponseTimeMin?: number;
  targetResponseMin?: number;
  responseComply?: boolean;
  actualTimeOnsite?: string;
  actualOnsiteTimeMin?: number;
  targetOnsiteMin?: number;
  onsiteComply?: boolean;
  startOrder?: string;
  finishOrder?: string;
  actualRestoreTimeMin?: number;
  targetRestoreMin?: number;
  restoreComply?: boolean;
  actualResolutionTimeMin?: number;
  targetResolutionMin?: number;
  resolutionComply?: boolean;
  resolutionRemark?: string;
  remark?: string;
  incidentDate?: string;
  reportedAt?: any;
  createdAt?: any;
  deleteRequested?: boolean;
  [key: string]: any;
}

interface SLAMonthlyRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports?: CorrectiveReportItem[];
  initialMonth?: string; // '0' .. '11' or 'all'
  initialYear?: string;  // '2026' or 'all'
}

export const INDO_MONTHS = [
  { value: 'all', label: 'Semua Bulan' },
  { value: '0', label: 'Januari' },
  { value: '1', label: 'Februari' },
  { value: '2', label: 'Maret' },
  { value: '3', label: 'April' },
  { value: '4', label: 'Mei' },
  { value: '5', label: 'Juni' },
  { value: '6', label: 'Juli' },
  { value: '7', label: 'Agustus' },
  { value: '8', label: 'September' },
  { value: '9', label: 'Oktober' },
  { value: '10', label: 'November' },
  { value: '11', label: 'Desember' }
];

const INDO_MONTHS_MAP: Record<string, number> = {
  'januari': 0, 'jan': 0, 'january': 0,
  'februari': 1, 'feb': 1, 'february': 1,
  'maret': 2, 'mar': 2, 'march': 2,
  'april': 3, 'apr': 3,
  'mei': 4, 'may': 4,
  'juni': 5, 'jun': 5, 'june': 5,
  'juli': 6, 'jul': 6, 'july': 6,
  'agustus': 7, 'agu': 7, 'ags': 7, 'aug': 7, 'august': 7,
  'september': 8, 'sep': 8,
  'oktober': 9, 'okt': 9, 'oct': 9, 'october': 9,
  'november': 10, 'nov': 10,
  'desember': 11, 'des': 11, 'dec': 11, 'december': 11
};

export function SLAMonthlyRecapModal({
  isOpen,
  onClose,
  reports: initialReports,
  initialMonth,
  initialYear
}: SLAMonthlyRecapModalProps) {
  const currentYearStr = new Date().getFullYear().toString();
  const currentMonthStr = new Date().getMonth().toString();

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth !== undefined ? initialMonth : currentMonthStr);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear !== undefined ? initialYear : currentYearStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [internalReports, setInternalReports] = useState<CorrectiveReportItem[]>(initialReports || []);
  const [loadingDb, setLoadingDb] = useState<boolean>(!initialReports || initialReports.length === 0);
  const [exportingDocx, setExportingDocx] = useState<boolean>(false);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);

  // Sync state when props change
  useEffect(() => {
    if (initialMonth !== undefined) setSelectedMonth(initialMonth);
    if (initialYear !== undefined) setSelectedYear(initialYear);
  }, [initialMonth, initialYear, isOpen]);

  // Fetch Firestore reports if not passed via props
  useEffect(() => {
    if (initialReports && initialReports.length > 0) {
      setInternalReports(initialReports);
      setLoadingDb(false);
      return;
    }

    if (!isOpen) return;

    setLoadingDb(true);
    const q = query(collection(db, 'corrective_reports'), orderBy('reportedAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as CorrectiveReportItem[];
        setInternalReports(data);
        setLoadingDb(false);
      },
      (err) => {
        console.error('Failed to load SLA reports for recap:', err);
        setLoadingDb(false);
      }
    );

    return () => unsubscribe();
  }, [initialReports, isOpen]);

  // Helper date parsing
  const parseDateToTimestamp = (dateVal: any): number => {
    if (!dateVal) return 0;
    if (typeof dateVal === 'number') return dateVal;
    if (typeof dateVal.toDate === 'function') return dateVal.toDate().getTime();
    if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? 0 : dateVal.getTime();
    if (typeof dateVal === 'string') {
      const trimmed = dateVal.trim();
      if (!trimmed) return 0;

      // 1. ISO YYYY-MM-DD
      const isoMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10) - 1;
        const day = parseInt(isoMatch[3], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d.getTime();
      }

      // 2. DD-MM-YYYY
      const dmyNumMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (dmyNumMatch) {
        const day = parseInt(dmyNumMatch[1], 10);
        const month = parseInt(dmyNumMatch[2], 10) - 1;
        const year = parseInt(dmyNumMatch[3], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d.getTime();
      }

      // 3. Format teks Indo "15 Juli 2026"
      const indoMatch = trimmed.match(/^(\d{1,2})[\s\-_/]+([a-zA-Z]+)[\s\-_/]+(\d{4})/);
      if (indoMatch) {
        const day = parseInt(indoMatch[1], 10);
        const monthKey = indoMatch[2].toLowerCase();
        const year = parseInt(indoMatch[3], 10);
        if (monthKey in INDO_MONTHS_MAP) {
          const month = INDO_MONTHS_MAP[monthKey];
          const d = new Date(year, month, day);
          if (!isNaN(d.getTime())) return d.getTime();
        }
      }

      // 4. Fallback default Date parser
      const fallback = new Date(trimmed);
      if (!isNaN(fallback.getTime())) return fallback.getTime();
    }
    return 0;
  };

  const getReportIncidentTime = (r: CorrectiveReportItem): number => {
    if (r.timeOrder) {
      const t = parseDateToTimestamp(r.timeOrder);
      if (t > 0) return t;
    }
    if (r.startOrder) {
      const t = parseDateToTimestamp(r.startOrder);
      if (t > 0) return t;
    }
    if (r.actualTimeResponse) {
      const t = parseDateToTimestamp(r.actualTimeResponse);
      if (t > 0) return t;
    }
    if (r.incidentDate) {
      const t = parseDateToTimestamp(r.incidentDate);
      if (t > 0) return t;
    }
    if (r.reportedAt) {
      const t = parseDateToTimestamp(r.reportedAt);
      if (t > 0) return t;
    }
    if (r.createdAt) {
      const t = parseDateToTimestamp(r.createdAt);
      if (t > 0) return t;
    }
    return 0;
  };

  // Filter only SLA reports matching active month & year
  const filteredSLAReports = useMemo(() => {
    return internalReports.filter((r) => {
      // Must be SLA report
      const isSLA = r.reportType === 'SLA' || r.reportType === 'sla' || (r.issue && r.issue.startsWith('[SLA / SLG]')) || r.targetResponseMin !== undefined;
      if (!isSLA) return false;

      // Exclude pending delete
      if (r.deleteRequested) return false;

      // Month & Year Filter
      const ts = getReportIncidentTime(r);
      if (ts > 0) {
        const d = new Date(ts);
        if (selectedMonth !== 'all' && d.getMonth().toString() !== selectedMonth) {
          return false;
        }
        if (selectedYear !== 'all' && d.getFullYear().toString() !== selectedYear) {
          return false;
        }
      } else if (r.reportedAt) {
        const d = typeof r.reportedAt.toDate === 'function' ? r.reportedAt.toDate() : new Date(r.reportedAt);
        if (!isNaN(d.getTime())) {
          if (selectedMonth !== 'all' && d.getMonth().toString() !== selectedMonth) {
            return false;
          }
          if (selectedYear !== 'all' && d.getFullYear().toString() !== selectedYear) {
            return false;
          }
        }
      }

      // Search Query
      if (searchQuery.trim() !== '') {
        const qLower = searchQuery.toLowerCase();
        const ticketMatch = (r.ticketName || '').toLowerCase().includes(qLower);
        const locationMatch = (r.location || '').toLowerCase().includes(qLower);
        const issueMatch = (r.issue || '').toLowerCase().includes(qLower);
        const remarkMatch = (r.remark || '').toLowerCase().includes(qLower);
        const resolutionMatch = (r.resolutionRemark || '').toLowerCase().includes(qLower);
        return ticketMatch || locationMatch || issueMatch || remarkMatch || resolutionMatch;
      }

      return true;
    }).sort((a, b) => getReportIncidentTime(b) - getReportIncidentTime(a));
  }, [internalReports, selectedMonth, selectedYear, searchQuery]);

  // Calculate SLG Performance Summary
  const summaryKpi = useMemo(() => {
    const total = filteredSLAReports.length;
    if (total === 0) {
      return {
        total: 0,
        respM: 0, respPct: 0, respScore: 0,
        onsiteM: 0, onsitePct: 0, onsiteScore: 0,
        restoreM: 0, restorePct: 0, restoreScore: 0,
        resolutionM: 0, resolutionPct: 0, resolutionScore: 0,
        totalScore: 0
      };
    }

    const getTargetByPriority = (prio?: string) => {
      if (prio === 'Critical') return 120;
      if (prio === 'High') return 240;
      if (prio === 'Low') return 2880;
      return 360;
    };

    const respM = filteredSLAReports.filter(r => r.responseComply !== false && (r.actualResponseTimeMin !== undefined ? r.actualResponseTimeMin <= (r.targetResponseMin || 5) : true)).length;
    const onsiteM = filteredSLAReports.filter(r => r.onsiteComply !== false && (r.actualOnsiteTimeMin !== undefined ? r.actualOnsiteTimeMin <= (r.targetOnsiteMin || 120) : true)).length;
    const restoreM = filteredSLAReports.filter(r => {
      const t = r.targetRestoreMin || getTargetByPriority(r.priority);
      return r.restoreComply !== false && (r.actualRestoreTimeMin !== undefined ? r.actualRestoreTimeMin <= t : true);
    }).length;
    const resolutionM = filteredSLAReports.filter(r => {
      const t = r.targetResolutionMin || getTargetByPriority(r.priority);
      return r.resolutionComply !== false && (r.actualResolutionTimeMin !== undefined ? r.actualResolutionTimeMin <= t : true);
    }).length;

    const respPct = (respM / total) * 100;
    const onsitePct = (onsiteM / total) * 100;
    const restorePct = (restoreM / total) * 100;
    const resolutionPct = (resolutionM / total) * 100;

    const respScore = (respPct / 100) * 5;
    const onsiteScore = (onsitePct / 100) * 5;
    const restoreScore = (restorePct / 100) * 15;
    const resolutionScore = (resolutionPct / 100) * 15;
    const totalScore = respScore + onsiteScore + restoreScore + resolutionScore;

    return {
      total,
      respM, respPct, respScore,
      onsiteM, onsitePct, onsiteScore,
      restoreM, restorePct, restoreScore,
      resolutionM, resolutionPct, resolutionScore,
      totalScore
    };
  }, [filteredSLAReports]);

  // Label period title
  const periodLabel = useMemo(() => {
    const monthObj = INDO_MONTHS.find(m => m.value === selectedMonth);
    const monthName = monthObj ? monthObj.label : 'Semua Bulan';
    const yearName = selectedYear !== 'all' ? selectedYear : 'Semua Tahun';
    return `${monthName} ${yearName}`;
  }, [selectedMonth, selectedYear]);

  // Export handlers
  const handleExportDocx = async () => {
    if (filteredSLAReports.length === 0) {
      toast.error(`Tidak ada laporan SLA pada periode ${periodLabel} untuk diekspor.`);
      return;
    }
    const toastId = toast.loading(`Menyiapkan Rekapitulasi SLA Word (.docx) (${filteredSLAReports.length} Dokumen)...`);
    try {
      setExportingDocx(true);
      await exportSLAMonthlyRecapToDocx(filteredSLAReports, periodLabel);
      toast.success(`Berhasil mengekspor Rekap SLA Word (${periodLabel})!`, { id: toastId });
    } catch (err: any) {
      console.error('Error exporting SLA Word recap:', err);
      toast.error(`Gagal mengekspor Rekap SLA Word: ${err?.message || 'Kendala sistem'}`, { id: toastId });
    } finally {
      setExportingDocx(false);
    }
  };

  const handleExportExcel = async () => {
    if (filteredSLAReports.length === 0) {
      toast.error(`Tidak ada laporan SLA pada periode ${periodLabel} untuk diekspor.`);
      return;
    }
    const toastId = toast.loading(`Menyiapkan Rekapitulasi SLA Excel (.xlsx) (${filteredSLAReports.length} Dokumen)...`);
    try {
      setExportingExcel(true);
      await exportSLAMonthlyRecapToExcel(filteredSLAReports, periodLabel);
      toast.success(`Berhasil mengekspor Rekap SLA Excel (${periodLabel})!`, { id: toastId });
    } catch (err: any) {
      console.error('Error exporting SLA Excel recap:', err);
      toast.error(`Gagal mengekspor Rekap SLA Excel: ${err?.message || 'Kendala sistem'}`, { id: toastId });
    } finally {
      setExportingExcel(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative text-slate-800"
      >
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white p-4 sm:p-6 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600 rounded-xl shadow-md text-white shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-red-500/30 border border-red-400/40 text-red-200 font-extrabold text-[10px] rounded-md uppercase tracking-wider">
                  Standby Engineer SLA / SLG
                </span>
                <span className="text-xs text-blue-200 font-medium hidden sm:inline">• DC Cikarang</span>
              </div>
              <h2 className="text-base sm:text-xl font-bold text-white mt-0.5">
                Rekapitulasi Kinerja SLA &amp; SLG Bulanan
              </h2>
              <p className="text-slate-300 text-xs mt-0.5">
                Pilih bulan &amp; tahun untuk merekap seluruh laporan audit waktu respon &amp; pemulihan gangguan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer shrink-0"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Bulan Selector */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Pilih Bulan Rekap</span>
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                title="Pilih Bulan Rekap"
                aria-label="Pilih Bulan Rekap"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-xs cursor-pointer"
              >
                {INDO_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Tahun Selector */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>Pilih Tahun</span>
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                title="Pilih Tahun Rekap"
                aria-label="Pilih Tahun Rekap"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-xs cursor-pointer"
              >
                <option value="all">Semua Tahun</option>
                {['2024', '2025', '2026', '2027', '2028', '2029', '2030'].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Pencarian Opsional */}
            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>Filter Tiket / Lokasi</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari kata kunci tiket / area..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition shadow-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Indicator Banner */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Periode Terpilih:</span>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 font-extrabold rounded-md border border-blue-200">
                {periodLabel}
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-slate-700">
                Ditemukan <strong className="text-blue-700 font-extrabold">{filteredSLAReports.length}</strong> Laporan SLA
              </span>
            </div>

            {filteredSLAReports.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Estimasi Skor SLG:</span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-black rounded-md border border-amber-300">
                  {summaryKpi.totalScore.toFixed(2)}% / 40.00%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content Body: KPI Cards + Preview Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loadingDb ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
              <p className="text-sm font-medium">Memuat data laporan SLA dari database...</p>
            </div>
          ) : filteredSLAReports.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-8">
              <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Tidak Ada Laporan SLA pada Periode {periodLabel}</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Silakan ubah filter Bulan atau Tahun di atas, atau pastikan laporan SLA sudah dibuat dan disimpan pada menu Corrective Maintenance.
              </p>
            </div>
          ) : (
            <>
              {/* 4 KPI Grid Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Response Time */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-3.5 rounded-2xl border border-blue-200">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold text-blue-900">1. Response Time</span>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.2 rounded">Bobot 5%</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-lg sm:text-xl font-black text-blue-950">{summaryKpi.respPct.toFixed(0)}%</span>
                    <span className="text-xs font-bold text-emerald-700">{summaryKpi.respScore.toFixed(2)}%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {summaryKpi.respM} dari {summaryKpi.total} Order Comply (&lt;5m)
                  </div>
                </div>

                {/* 2. Onsite Support */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-3.5 rounded-2xl border border-emerald-200">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold text-emerald-900">2. Onsite Support</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.2 rounded">Bobot 5%</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-lg sm:text-xl font-black text-emerald-950">{summaryKpi.onsitePct.toFixed(0)}%</span>
                    <span className="text-xs font-bold text-emerald-700">{summaryKpi.onsiteScore.toFixed(2)}%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {summaryKpi.onsiteM} dari {summaryKpi.total} Order Comply (&lt;2h)
                  </div>
                </div>

                {/* 3. Restore Time */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-3.5 rounded-2xl border border-amber-200">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold text-amber-900">3. Restore Time</span>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.2 rounded">Bobot 15%</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-lg sm:text-xl font-black text-amber-950">{summaryKpi.restorePct.toFixed(0)}%</span>
                    <span className="text-xs font-bold text-amber-700">{summaryKpi.restoreScore.toFixed(2)}%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {summaryKpi.restoreM} dari {summaryKpi.total} Order Comply
                  </div>
                </div>

                {/* 4. Resolution Time */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50/50 p-3.5 rounded-2xl border border-purple-200">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold text-purple-900">4. Resolution Time</span>
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.2 rounded">Bobot 15%</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-lg sm:text-xl font-black text-purple-950">{summaryKpi.resolutionPct.toFixed(0)}%</span>
                    <span className="text-xs font-bold text-purple-700">{summaryKpi.resolutionScore.toFixed(2)}%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {summaryKpi.resolutionM} dari {summaryKpi.total} Order Comply
                  </div>
                </div>
              </div>

              {/* Preview Table of Reports in selected month */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-500" />
                    <span>Daftar Order / Tiket SLA Periode {periodLabel} ({filteredSLAReports.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Urutan insiden terbaru di atas</span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2.5 font-bold text-slate-700 w-12 text-center">No</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700">Order / Tiket</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700">Prioritas</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700">Lokasi</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700 text-center">Waktu Order</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700 text-center">Respon</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700 text-center">Resolusi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredSLAReports.map((report, idx) => {
                          const dateDisplay = report.timeOrder
                            ? new Date(report.timeOrder).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : report.incidentDate || '-';

                          return (
                            <tr key={report.id || idx} className="hover:bg-slate-50 transition">
                              <td className="px-3 py-2 text-center font-bold text-slate-500">{idx + 1}</td>
                              <td className="px-3 py-2 font-bold text-slate-900 max-w-[200px] truncate" title={report.ticketName}>
                                {report.ticketName || report.issue || 'Work Order'}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  report.priority === 'Critical' ? 'bg-red-100 text-red-700 border border-red-200' :
                                  report.priority === 'High' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                  report.priority === 'Medium' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {report.priority || 'Medium'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate">{report.location || '-'}</td>
                              <td className="px-3 py-2 text-center text-slate-500 font-mono text-[11px] whitespace-nowrap">{dateDisplay}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                  report.responseComply !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {report.actualResponseTimeMin !== undefined ? `${report.actualResponseTimeMin}m` : (report.responseComply !== false ? 'M' : 'TM')}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                  report.resolutionComply !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {report.actualResolutionTimeMin !== undefined ? `${report.actualResolutionTimeMin}m` : (report.resolutionComply !== false ? 'M' : 'TM')}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            Total Dokumen: <strong className="text-slate-800">{filteredSLAReports.length} Laporan SLA</strong> siap direkapitulasi.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-bold transition text-xs cursor-pointer shadow-xs"
            >
              Tutup
            </button>

            {/* Export Word Button */}
            <button
              type="button"
              disabled={filteredSLAReports.length === 0 || exportingDocx || exportingExcel}
              onClick={handleExportDocx}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 text-xs cursor-pointer shrink-0"
            >
              {exportingDocx ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>Export Word (.docx)</span>
            </button>

            {/* Export Excel Button */}
            <button
              type="button"
              disabled={filteredSLAReports.length === 0 || exportingDocx || exportingExcel}
              onClick={handleExportExcel}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 text-xs cursor-pointer shrink-0"
            >
              {exportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Export Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
