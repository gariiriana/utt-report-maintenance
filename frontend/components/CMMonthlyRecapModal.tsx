// ============================================================================
// FILE: frontend/components/CMMonthlyRecapModal.tsx
// Deskripsi: Modal Dialog Interaktif Rekapitulasi Laporan Corrective Maintenance (CM).
//            Mendukung filter Bulanan (Bulan & Tahun) serta Rentang Tanggal (Per Tgl & Bulan),
//            filter Status Trouble (Solved / Closed vs Pending / Open), filter Sparepart,
//            preview data & metrik statistik, serta ekspor 3 format resmi:
//            - Microsoft Word (.docx)
//            - Microsoft Excel (.xlsx)
//            - Dokumen PDF (.pdf) Landscape
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
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Wrench,
  Download,
  Camera,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
  parseReportTime,
  formatReportDate,
  formatReportTime,
  isCMSparepart,
  getTroubleStatusInfo,
  extractPhotosFromReport,
  exportCMMonthlyRecapToExcel,
  exportCMMonthlyRecapToDocx,
  exportCMMonthlyRecapToPDF
} from '@/utils/CMMonthlyRecapExport';

export interface CorrectiveReportItem {
  id?: string;
  reportType?: 'standard' | 'cm_pdf' | 'CM_PDF' | 'sla' | 'SLA' | 'PIR' | string;
  ticketName?: string;
  incidentName?: string;
  equipmentName?: string;
  location?: string;
  issue?: string;
  actionTaken?: string;
  correctiveAction?: string;
  problemAnalysis?: string;
  summaryProblemAnalysis?: string;
  priority?: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  picDME?: string;
  picTDE?: string;
  incidentDate?: string;
  incidentTime?: string;
  timeOrder?: string;
  startOrder?: string;
  finishOrder?: string;
  reportedAt?: any;
  createdAt?: any;
  deleteRequested?: boolean;
  troubleStatus?: 'open' | 'closed' | string;
  troublePendingReason?: string;
  troubleCompletionNotes?: string;
  troubleStatusUpdatedAt?: any;
  troubleshootType?: string;
  isSparepartReplacement?: boolean;
  sparepartType?: string;
  spareparts?: any[];
  sparepartsUsed?: any[];
  [key: string]: any;
}

interface CMMonthlyRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports?: CorrectiveReportItem[];
  initialMonth?: string; // '0' .. '11' or 'all'
  initialYear?: string;  // '2026' or 'all'
  initialFilterMode?: 'monthly' | 'range';
  initialStartDate?: string; // 'YYYY-MM-DD'
  initialEndDate?: string;   // 'YYYY-MM-DD'
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

export function CMMonthlyRecapModal({
  isOpen,
  onClose,
  reports: initialReports,
  initialMonth,
  initialYear,
  initialFilterMode,
  initialStartDate,
  initialEndDate
}: CMMonthlyRecapModalProps) {
  const { user } = useAuth();
  const now = new Date();
  const currentYearStr = now.getFullYear().toString();
  const currentMonthStr = now.getMonth().toString();

  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const defaultStartDate = initialStartDate || formatYMD(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultEndDate = initialEndDate || formatYMD(now);

  const [filterMode, setFilterMode] = useState<'monthly' | 'range'>(initialFilterMode || 'range');
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth !== undefined ? initialMonth : currentMonthStr);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear !== undefined ? initialYear : currentYearStr);
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [troubleFilter, setTroubleFilter] = useState<'all' | 'closed' | 'open'>('all');
  const [sparepartFilter, setSparepartFilter] = useState<'all' | 'sparepart_all' | 'sparepart_dme' | 'consumable' | 'non_sparepart'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [internalReports, setInternalReports] = useState<CorrectiveReportItem[]>(initialReports || []);
  const [loadingDb, setLoadingDb] = useState<boolean>(!initialReports || initialReports.length === 0);

  const [exportingDocx, setExportingDocx] = useState<boolean>(false);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  // Sync state when props change
  useEffect(() => {
    if (initialMonth !== undefined) setSelectedMonth(initialMonth);
    if (initialYear !== undefined) setSelectedYear(initialYear);
    if (initialFilterMode !== undefined) setFilterMode(initialFilterMode);
    if (initialStartDate !== undefined) {
      setStartDate(initialStartDate);
    }
    if (initialEndDate !== undefined) {
      setEndDate(initialEndDate);
    }
  }, [initialMonth, initialYear, initialFilterMode, initialStartDate, initialEndDate, isOpen]);

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
        console.error('Failed to load CM reports for recap:', err);
        setLoadingDb(false);
      }
    );

    return () => unsubscribe();
  }, [initialReports, isOpen]);

  // Helper date text formatter (e.g. "15 Juli 2026")
  const formatIndoDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    const monthObj = INDO_MONTHS.find(item => item.value === (parseInt(m, 10) - 1).toString());
    const monthName = monthObj ? monthObj.label : m;
    return `${parseInt(d, 10)} ${monthName} ${y}`;
  };

  // Quick range selector helper
  const applyQuickRange = (type: 'today' | '7_days' | '30_days' | 'this_month' | 'last_month' | 'cycle_21' | 'reset') => {
    const n = new Date();
    if (type === 'today') {
      const today = formatYMD(n);
      setStartDate(today);
      setEndDate(today);
    } else if (type === '7_days') {
      const start = new Date(n.getTime() - 6 * 24 * 60 * 60 * 1000);
      setStartDate(formatYMD(start));
      setEndDate(formatYMD(n));
    } else if (type === '30_days') {
      const start = new Date(n.getTime() - 29 * 24 * 60 * 60 * 1000);
      setStartDate(formatYMD(start));
      setEndDate(formatYMD(n));
    } else if (type === 'this_month') {
      const firstDay = new Date(n.getFullYear(), n.getMonth(), 1);
      const lastDay = new Date(n.getFullYear(), n.getMonth() + 1, 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else if (type === 'last_month') {
      const firstDay = new Date(n.getFullYear(), n.getMonth() - 1, 1);
      const lastDay = new Date(n.getFullYear(), n.getMonth(), 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else if (type === 'cycle_21') {
      // Siklus 21 Bulan Lalu s/d 20 Bulan Ini
      const startCycle = new Date(n.getFullYear(), n.getMonth() - 1, 21);
      const endCycle = new Date(n.getFullYear(), n.getMonth(), 20);
      setStartDate(formatYMD(startCycle));
      setEndDate(formatYMD(endCycle));
    } else if (type === 'reset') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Filter only CM reports (excluding SLA & PIR) matching selected criteria
  const filteredCMReports = useMemo(() => {
    return internalReports.filter((r) => {
      // Must be CM report
      if (r.deleteRequested) return false;
      const isSLA = r.reportType === 'SLA' || r.reportType === 'sla' || (r.issue && r.issue.startsWith('[SLA / SLG]')) || r.targetResponseMin !== undefined;
      const isPIR = r.reportType === 'PIR' || r.reportType === 'pir';
      if (isSLA || isPIR) return false;

      const ts = parseReportTime(r);

      // 1. Time / Date Filter
      if (filterMode === 'range') {
        const checkTs = ts > 0 ? ts : parseReportTime(r.reportedAt || r.createdAt);
        if (startDate) {
          const startTs = new Date(`${startDate}T00:00:00`).getTime();
          if (checkTs > 0 && checkTs < startTs) return false;
          if (checkTs === 0) return false;
        }
        if (endDate) {
          const endTs = new Date(`${endDate}T23:59:59.999`).getTime();
          if (checkTs > 0 && checkTs > endTs) return false;
          if (checkTs === 0) return false;
        }
      } else {
        // Mode Bulanan
        if (ts > 0) {
          const d = new Date(ts);
          if (selectedMonth !== 'all' && d.getMonth().toString() !== selectedMonth) {
            return false;
          }
          if (selectedYear !== 'all' && d.getFullYear().toString() !== selectedYear) {
            return false;
          }
        } else if (r.reportedAt) {
          const repTs = parseReportTime(r.reportedAt);
          if (repTs > 0) {
            const d = new Date(repTs);
            if (selectedMonth !== 'all' && d.getMonth().toString() !== selectedMonth) {
              return false;
            }
            if (selectedYear !== 'all' && d.getFullYear().toString() !== selectedYear) {
              return false;
            }
          }
        }
      }

      // 2. Filter Status Trouble (Closed vs Open)
      const statusInfo = getTroubleStatusInfo(r);
      if (troubleFilter === 'closed' && !statusInfo.isClosed) return false;
      if (troubleFilter === 'open' && statusInfo.isClosed) return false;

      // 3. Filter Sparepart
      const isSp = isCMSparepart(r);
      if (sparepartFilter === 'non_sparepart' && isSp) return false;
      if (sparepartFilter === 'sparepart_all' && !isSp) return false;
      if (sparepartFilter === 'sparepart_dme') {
        if (!isSp || r.sparepartType !== 'sparepart_dme') return false;
      }
      if (sparepartFilter === 'consumable') {
        if (!isSp || r.sparepartType !== 'consumable') return false;
      }

      // 4. Search Query
      if (searchQuery.trim() !== '') {
        const qLower = searchQuery.toLowerCase();
        const ticketMatch = (r.incidentName || r.ticketName || r.ticketNumber || '').toLowerCase().includes(qLower);
        const equipMatch = (r.equipmentName || r.equipment || r.device || '').toLowerCase().includes(qLower);
        const locMatch = (r.location || r.area || '').toLowerCase().includes(qLower);
        const issueMatch = (r.issue || r.problem || r.problemAnalysis || '').toLowerCase().includes(qLower);
        const actionMatch = (r.correctiveAction || r.actionTaken || '').toLowerCase().includes(qLower);
        const picMatch = (r.picDME || r.picTDE || r.technician || '').toLowerCase().includes(qLower);
        const noteMatch = (r.troubleCompletionNotes || r.troublePendingReason || r.remark || '').toLowerCase().includes(qLower);

        return ticketMatch || equipMatch || locMatch || issueMatch || actionMatch || picMatch || noteMatch;
      }

      return true;
    }).sort((a, b) => parseReportTime(a) - parseReportTime(b)); // Ascending chronologically
  }, [internalReports, filterMode, startDate, endDate, selectedMonth, selectedYear, troubleFilter, sparepartFilter, searchQuery]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const total = filteredCMReports.length;
    if (total === 0) {
      return {
        total: 0,
        closed: 0,
        closedPct: 0,
        open: 0,
        openPct: 0,
        sparepart: 0,
        sparepartPct: 0,
        nonSparepart: 0,
        nonSparepartPct: 0,
        dmeSparepart: 0,
        consumable: 0,
        totalPhotos: 0,
        reportsWithPhotosCount: 0
      };
    }

    const closed = filteredCMReports.filter(r => getTroubleStatusInfo(r).isClosed).length;
    const open = total - closed;
    const closedPct = (closed / total) * 100;
    const openPct = (open / total) * 100;

    const sparepart = filteredCMReports.filter(r => isCMSparepart(r)).length;
    const nonSparepart = total - sparepart;
    const sparepartPct = (sparepart / total) * 100;
    const nonSparepartPct = (nonSparepart / total) * 100;

    const dmeSparepart = filteredCMReports.filter(r => isCMSparepart(r) && r.sparepartType === 'sparepart_dme').length;
    const consumable = filteredCMReports.filter(r => isCMSparepart(r) && r.sparepartType === 'consumable').length;

    const totalPhotos = filteredCMReports.reduce((acc, r) => acc + extractPhotosFromReport(r).length, 0);
    const reportsWithPhotosCount = filteredCMReports.filter(r => extractPhotosFromReport(r).length > 0).length;

    return {
      total,
      closed,
      closedPct,
      open,
      openPct,
      sparepart,
      sparepartPct,
      nonSparepart,
      nonSparepartPct,
      dmeSparepart,
      consumable,
      totalPhotos,
      reportsWithPhotosCount
    };
  }, [filteredCMReports]);

  // Validasi rentang tanggal (jika tanggal mulai lebih besar dari selesai)
  const isDateRangeInvalid = filterMode === 'range' && Boolean(startDate && endDate && startDate > endDate);

  // Label period title dinamis
  const periodLabel = useMemo(() => {
    if (filterMode === 'range') {
      if (startDate && endDate) {
        if (startDate === endDate) {
          return formatIndoDate(startDate);
        }
        return `${formatIndoDate(startDate)} s/d ${formatIndoDate(endDate)}`;
      }
      if (startDate) {
        return `Mulai ${formatIndoDate(startDate)}`;
      }
      if (endDate) {
        return `Hingga ${formatIndoDate(endDate)}`;
      }
      return 'Semua Rentang Tanggal';
    } else {
      const monthObj = INDO_MONTHS.find(m => m.value === selectedMonth);
      const monthName = monthObj ? monthObj.label : 'Semua Bulan';
      const yearName = selectedYear !== 'all' ? selectedYear : 'Semua Tahun';
      return `${monthName} ${yearName}`;
    }
  }, [filterMode, startDate, endDate, selectedMonth, selectedYear]);

  // Export handlers
  const handleExportWord = async () => {
    if (isDateRangeInvalid) {
      toast.error('Tanggal Mulai tidak boleh lebih besar dari Tanggal Selesai.');
      return;
    }
    if (filteredCMReports.length === 0) {
      toast.error(`Tidak ada laporan CM pada periode ${periodLabel} untuk diekspor.`);
      return;
    }

    setExportingDocx(true);
    try {
      const printedBy = user?.email
        ? `${user.email} (PT Dwimitra Ekatama Mandiri)`
        : 'PT Dwimitra Ekatama Mandiri';
      await exportCMMonthlyRecapToDocx(filteredCMReports, {
        periodLabel,
        printedBy,
      });
    } catch (err: any) {
      console.error('Word export error:', err);
    } finally {
      setExportingDocx(false);
    }
  };

  const handleExportExcel = async () => {
    if (isDateRangeInvalid) {
      toast.error('Tanggal Mulai tidak boleh lebih besar dari Tanggal Selesai.');
      return;
    }
    if (filteredCMReports.length === 0) {
      toast.error(`Tidak ada laporan CM pada periode ${periodLabel} untuk diekspor.`);
      return;
    }

    setExportingExcel(true);
    try {
      await exportCMMonthlyRecapToExcel(filteredCMReports, periodLabel);
    } catch (err: any) {
      console.error('Excel export error:', err);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    if (isDateRangeInvalid) {
      toast.error('Tanggal Mulai tidak boleh lebih besar dari Tanggal Selesai.');
      return;
    }
    if (filteredCMReports.length === 0) {
      toast.error(`Tidak ada laporan CM pada periode ${periodLabel} untuk diekspor.`);
      return;
    }

    setExportingPdf(true);
    try {
      await exportCMMonthlyRecapToPDF(filteredCMReports, periodLabel);
    } catch (err: any) {
      console.error('PDF export error:', err);
    } finally {
      setExportingPdf(false);
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
        className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden relative text-slate-800"
      >
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 sm:p-6 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-md text-white shrink-0">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-500/30 border border-blue-400/40 text-blue-200 font-extrabold text-[10px] rounded-md uppercase tracking-wider">
                  Report CM Standby
                </span>
                <span className="text-xs text-blue-300 font-medium hidden sm:inline">• DC Cikarang</span>
              </div>
              <h2 className="text-base sm:text-xl font-bold text-white mt-0.5">
                Rekapitulasi Laporan Corrective Maintenance (CM)
              </h2>
              <p className="text-slate-300 text-xs mt-0.5">
                Filter data CM berdasarkan Periode Bulan atau Rentang Tanggal Spesifik untuk diekspor ke Word (.docx), Excel (.xlsx), &amp; PDF (.pdf).
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
          {/* Mode Selector & Quick Presets */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-200/80">
            <div className="inline-flex p-1 bg-slate-200/80 rounded-xl gap-1 shrink-0 w-fit">
              <button
                type="button"
                onClick={() => setFilterMode('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  filterMode === 'monthly'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Pilih Bulan &amp; Tahun</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('range');
                  if (!startDate && !endDate) {
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    const d = String(now.getDate()).padStart(2, '0');
                    setStartDate(`${y}-${m}-01`);
                    setEndDate(`${y}-${m}-${d}`);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  filterMode === 'range'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Rentang Tanggal (Per Tgl &amp; Bulan)</span>
              </button>
            </div>

            {filterMode === 'range' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-500">Preset:</span>
                <button
                  type="button"
                  onClick={() => applyQuickRange('today')}
                  className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition cursor-pointer"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickRange('7_days')}
                  className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition cursor-pointer"
                >
                  7 Hari Terakhir
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickRange('30_days')}
                  className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition cursor-pointer"
                >
                  30 Hari Terakhir
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickRange('this_month')}
                  className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition cursor-pointer"
                >
                  Bulan Ini
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickRange('last_month')}
                  className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition cursor-pointer"
                >
                  Bulan Lalu
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickRange('cycle_21')}
                  className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition cursor-pointer"
                  title="Siklus Cut-off Periode Data Center: 21 Bulan Lalu s/d 20 Bulan Ini"
                >
                  Siklus 21–20
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickRange('reset')}
                  className="px-2 py-1 bg-white hover:bg-red-50 text-slate-500 hover:text-red-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                  title="Hapus Filter Tanggal"
                >
                  Hapus Filter
                </button>
              </div>
            )}
          </div>

          {/* Primary Date Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {filterMode === 'range' ? (
              <>
                {/* Tanggal Mulai */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Dari Tanggal</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition shadow-xs cursor-pointer"
                  />
                </div>

                {/* Tanggal Selesai */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Sampai Tanggal</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition shadow-xs cursor-pointer"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Bulan Selector */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Pilih Bulan</span>
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition shadow-xs cursor-pointer"
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
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition shadow-xs cursor-pointer"
                  >
                    <option value="all">Semua Tahun</option>
                    {['2024', '2025', '2026', '2027', '2028', '2029', '2030'].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Filter Status Trouble */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Status Trouble</span>
              </label>
              <select
                value={troubleFilter}
                onChange={(e) => setTroubleFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition shadow-xs cursor-pointer"
              >
                <option value="all">Semua Status Trouble</option>
                <option value="closed">✓ Solved / Selesai (Closed)</option>
                <option value="open">⏳ Pending / Belum Selesai (Open)</option>
              </select>
            </div>

            {/* Filter Sparepart */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-600" />
                <span>Jenis Penanganan</span>
              </label>
              <select
                value={sparepartFilter}
                onChange={(e) => setSparepartFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition shadow-xs cursor-pointer"
              >
                <option value="all">Semua Jenis Penanganan</option>
                <option value="non_sparepart">Non-Sparepart (Troubleshoot)</option>
                <option value="sparepart_all">Semua Sparepart (Ada Pergantian)</option>
                <option value="sparepart_dme">Sparepart DME (Baut / Pengadaan)</option>
                <option value="consumable">Consumable Part (Wajib SLA)</option>
              </select>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari kata kunci tiket, perangkat, lokasi, analisa masalah, tindakan, atau teknisi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition shadow-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Warning Banner Rentang Tanggal Tidak Valid */}
          {isDateRangeInvalid && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-semibold">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Tanggal Mulai ({formatIndoDate(startDate)}) tidak boleh melebihi Tanggal Selesai ({formatIndoDate(endDate)}). Silakan sesuaikan tanggal.</span>
            </div>
          )}

          {/* Quick Summary Indicator */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-200/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Periode:</span>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 font-extrabold rounded-md border border-blue-200">
                {periodLabel}
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-slate-700">
                Ditemukan <strong className="text-blue-700 font-extrabold">{filteredCMReports.length}</strong> Laporan CM
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Solved: {metrics.closed} ({metrics.closedPct.toFixed(0)}%)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                <Clock3 className="w-3 h-3 text-amber-600" />
                Pending: {metrics.open} ({metrics.openPct.toFixed(0)}%)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-bold">
                <Camera className="w-3 h-3 text-blue-600" />
                {metrics.totalPhotos} Foto ({metrics.reportsWithPhotosCount} Laporan)
              </span>
            </div>
          </div>
        </div>

        {/* Content Body: KPI Cards + Preview Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {loadingDb ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
              <p className="text-sm font-medium">Memuat data Laporan CM dari database...</p>
            </div>
          ) : filteredCMReports.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-8">
              <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Tidak Ada Laporan CM pada Periode Ini</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Silakan ubah filter Bulan, Rentang Tanggal, Status Trouble, atau kata kunci pencarian di atas.
              </p>
            </div>
          ) : (
            <>
              {/* Info Banner: Format Compact & Pemisahan Per Bulan */}
              <div className="flex items-center gap-2.5 p-3 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-emerald-50/60 border border-blue-200/70 rounded-2xl text-xs text-slate-700 shadow-2xs">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="flex-1 text-[11px] leading-relaxed">
                  <span className="font-bold text-slate-900">Format Ringkas &amp; Otomatis Dipisah Per Bulan:</span> Hasil ekspor didesain ringkas dengan kompresi foto otomatis. Jika periode melintasi beberapa bulan, dokumen langsung <strong>dipisahkan per bulan dalam satu file</strong> (halaman/tabel terpisah di PDF &amp; Word, tab sheet bulanan di Excel).
                </div>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Total CM */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-3.5 rounded-2xl border border-blue-200 shadow-2xs">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold text-blue-900">Total Laporan CM</span>
                    <Wrench className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-blue-950 mt-1">{metrics.total}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Laporan terfilter</div>
                </div>

                {/* 2. Solved (Closed) */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold text-emerald-900">Solved / Selesai</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black text-emerald-950">{metrics.closed}</span>
                    <span className="text-xs font-bold text-emerald-700">{metrics.closedPct.toFixed(0)}%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Masalah teratasi</div>
                </div>

                {/* 3. Pending (Open) */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold text-amber-900">Pending / Open</span>
                    <Clock3 className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black text-amber-950">{metrics.open}</span>
                    <span className="text-xs font-bold text-amber-700">{metrics.openPct.toFixed(0)}%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Perlu tindak lanjut</div>
                </div>

                {/* 4. Sparepart Replacement */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50/50 p-3.5 rounded-2xl border border-purple-200 shadow-2xs">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold text-purple-900">Ganti Sparepart</span>
                    <Layers className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black text-purple-950">{metrics.sparepart}</span>
                    <span className="text-xs font-bold text-purple-700">{metrics.sparepartPct.toFixed(0)}%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Non-part: {metrics.nonSparepart} lap
                  </div>
                </div>
              </div>

              {/* Table Preview */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-500" />
                    <span>Daftar Laporan CM ({filteredCMReports.length} Dokumen)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Urutan kronologis tanggal
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2.5 font-bold text-slate-700 w-10 text-center">No</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap">Tanggal &amp; Waktu</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700">No. Tiket / Gangguan</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700">Perangkat &amp; Lokasi</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700">Status Trouble</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700">Jenis &amp; Sparepart</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700 text-center">Foto</th>
                          <th className="px-3 py-2.5 font-bold text-slate-700">Teknisi (PIC DME)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredCMReports.map((report, idx) => {
                          const statusInfo = getTroubleStatusInfo(report);
                          const isSp = isCMSparepart(report);
                          const dateStr = formatReportDate(report);
                          const timeStr = formatReportTime(report);
                          const ticketStr = report.incidentName || report.ticketName || report.ticketNumber || `CM-${idx + 1}`;
                          const issueStr = report.issue || report.problem || report.problemAnalysis || 'Corrective Maintenance';

                          return (
                            <tr key={report.id || idx} className="hover:bg-slate-50 transition">
                              <td className="px-3 py-2 text-center font-bold text-slate-500">{idx + 1}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="font-bold text-slate-900">{dateStr}</div>
                                <div className="text-[10px] text-slate-500">{timeStr}</div>
                              </td>
                              <td className="px-3 py-2 max-w-[220px]">
                                <div className="font-bold text-slate-900 truncate" title={ticketStr}>{ticketStr}</div>
                                <div className="text-[11px] text-slate-500 truncate" title={issueStr}>{issueStr}</div>
                              </td>
                              <td className="px-3 py-2 max-w-[180px]">
                                <div className="font-semibold text-slate-800 truncate">{report.equipmentName || report.equipment || '-'}</div>
                                <div className="text-[10px] text-slate-500 truncate">{report.location || report.area || 'NeutraDC'}</div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  statusInfo.isClosed
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                  {statusInfo.isClosed ? (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Clock3 className="w-3 h-3 text-amber-600" />
                                  )}
                                  {statusInfo.label}
                                </span>
                              </td>
                              <td className="px-3 py-2 max-w-[160px]">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  isSp ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {isSp ? 'Ganti Sparepart' : 'Non-Sparepart'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                {(() => {
                                  const rPhotos = extractPhotosFromReport(report);
                                  return rPhotos.length > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-bold" title={`${rPhotos.length} foto terlampir pada laporan ini`}>
                                      <Camera className="w-3 h-3 text-blue-600" />
                                      {rPhotos.length} Foto
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">-</span>
                                  );
                                })()}
                              </td>
                              <td className="px-3 py-2 text-slate-700 font-medium whitespace-nowrap">
                                {report.picDME || report.preparedByName || report.technician || '-'}
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
            Total Rekap: <strong className="text-slate-800">{filteredCMReports.length} Laporan CM</strong> siap diekspor.
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-bold transition text-xs cursor-pointer shadow-xs"
            >
              Tutup
            </button>

            {/* Export Word Button */}
            <button
              type="button"
              disabled={filteredCMReports.length === 0 || exportingDocx || exportingExcel || exportingPdf || isDateRangeInvalid}
              onClick={handleExportWord}
              className="px-3.5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 text-xs cursor-pointer shrink-0"
              title="Ekspor Rekap CM ke format Microsoft Word (.docx) Landscape"
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
              disabled={filteredCMReports.length === 0 || exportingDocx || exportingExcel || exportingPdf || isDateRangeInvalid}
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 text-xs cursor-pointer shrink-0"
              title="Ekspor Rekap CM ke format Microsoft Excel (.xlsx)"
            >
              {exportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Export Excel (.xlsx)</span>
            </button>

            {/* Export PDF Button */}
            <button
              type="button"
              disabled={filteredCMReports.length === 0 || exportingDocx || exportingExcel || exportingPdf || isDateRangeInvalid}
              onClick={handleExportPdf}
              className="px-3.5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-red-500/20 text-xs cursor-pointer shrink-0"
              title="Ekspor Rekap CM ke format Dokumen PDF (.pdf) Landscape Ringkas dengan Foto Terpadu"
            >
              {exportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Export PDF Ringkas (+ Foto)</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
