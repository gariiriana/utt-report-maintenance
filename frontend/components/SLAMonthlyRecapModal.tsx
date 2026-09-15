// ============================================================================
// FILE: SLAMonthlyRecapModal.tsx
// Deskripsi: Modal Dialog Interaktif untuk Rekapitulasi Laporan SLA / SLG Bulanan.
//            Memungkinkan Standby Engineer memfilter pencapaian SLA berdasarkan
//            Bulan (misal: Juli) dan Tahun (2024 - 2030), menampilkan preview skor
//            SLG secara real-time, serta mengekspor rekapitulasi resmi dalam format
//            Microsoft Word (.docx) dan Microsoft Excel (.xlsx).
// ============================================================================

import { useState, useMemo, useEffect, Fragment } from 'react';
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
  AlertTriangle
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
  initialYear,
  initialFilterMode,
  initialStartDate,
  initialEndDate
}: SLAMonthlyRecapModalProps) {
  const currentYearStr = new Date().getFullYear().toString();
  const currentMonthStr = new Date().getMonth().toString();

  const [filterMode, setFilterMode] = useState<'monthly' | 'range'>(initialFilterMode || 'monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth !== undefined ? initialMonth : currentMonthStr);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear !== undefined ? initialYear : currentYearStr);
  const [startDate, setStartDate] = useState<string>(initialStartDate || '');
  const [endDate, setEndDate] = useState<string>(initialEndDate || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [internalReports, setInternalReports] = useState<CorrectiveReportItem[]>(initialReports || []);
  const [loadingDb, setLoadingDb] = useState<boolean>(!initialReports || initialReports.length === 0);
  const [exportingDocx, setExportingDocx] = useState<boolean>(false);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);

  // Sync state when props change
  useEffect(() => {
    if (initialMonth !== undefined) setSelectedMonth(initialMonth);
    if (initialYear !== undefined) setSelectedYear(initialYear);
    if (initialFilterMode !== undefined) setFilterMode(initialFilterMode);
    if (initialStartDate !== undefined) setStartDate(initialStartDate);
    if (initialEndDate !== undefined) setEndDate(initialEndDate);
  }, [initialMonth, initialYear, initialFilterMode, initialStartDate, initialEndDate, isOpen]);

  // Quick range selector helper
  const applyQuickRange = (type: 'today' | 'this_month' | 'last_month' | 'cycle' | 'reset') => {
    const now = new Date();
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (type === 'today') {
      const today = formatYMD(now);
      setStartDate(today);
      setEndDate(today);
    } else if (type === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else if (type === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else if (type === 'cycle') {
      const startCycle = new Date(now.getFullYear(), now.getMonth() - 1, 25);
      const endCycle = new Date(now.getFullYear(), now.getMonth(), 24);
      setStartDate(formatYMD(startCycle));
      setEndDate(formatYMD(endCycle));
    } else if (type === 'reset') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Helper date text formatter (Indonesian format: e.g. "10 Agustus 2026")
  const formatIndoDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    const monthObj = INDO_MONTHS.find(item => item.value === (parseInt(m, 10) - 1).toString());
    const monthName = monthObj ? monthObj.label : m;
    return `${parseInt(d, 10)} ${monthName} ${y}`;
  };

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
    if (typeof dateVal === 'object' && typeof dateVal.seconds === 'number') return dateVal.seconds * 1000;
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

      // 2. DD-MM-YYYY or DD/MM/YYYY with optional time
      const dmyNumMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
      if (dmyNumMatch) {
        const day = parseInt(dmyNumMatch[1], 10);
        const month = parseInt(dmyNumMatch[2], 10) - 1;
        const year = parseInt(dmyNumMatch[3], 10);
        const hour = dmyNumMatch[4] ? parseInt(dmyNumMatch[4], 10) : 0;
        const minute = dmyNumMatch[5] ? parseInt(dmyNumMatch[5], 10) : 0;
        const d = new Date(year, month, day, hour, minute);
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

  // Filter only SLA reports matching active month & year OR specific date range
  const filteredSLAReports = useMemo(() => {
    return internalReports.filter((r) => {
      // Must be SLA report
      const isSLA = r.reportType === 'SLA' || r.reportType === 'sla' || (r.issue && r.issue.startsWith('[SLA / SLG]')) || r.targetResponseMin !== undefined;
      if (!isSLA) return false;

      // Exclude pending delete
      if (r.deleteRequested) return false;

      const ts = getReportIncidentTime(r);

      // Filter Mode Rentang Tanggal (Start Date s/d End Date)
      if (filterMode === 'range') {
        const checkTs = ts > 0 ? ts : parseDateToTimestamp(r.reportedAt || r.createdAt);
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
        // Filter Mode Bulanan (selectedMonth & selectedYear)
        if (ts > 0) {
          const d = new Date(ts);
          if (selectedMonth !== 'all' && d.getMonth().toString() !== selectedMonth) {
            return false;
          }
          if (selectedYear !== 'all' && d.getFullYear().toString() !== selectedYear) {
            return false;
          }
        } else if (r.reportedAt) {
          const repTs = parseDateToTimestamp(r.reportedAt);
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
  }, [internalReports, filterMode, startDate, endDate, selectedMonth, selectedYear, searchQuery]);

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
      const t = 180; // SLA Target Komitmen Restore Time selalu 3 Jam (180 Menit)
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

  // Kelompok per bulan jika ada beberapa bulan dalam rentang filter
  const monthGroups = useMemo(() => {
    if (filteredSLAReports.length === 0) return [];

    const getTargetByPriority = (prio?: string) => {
      if (prio === 'Critical') return 120;
      if (prio === 'High') return 240;
      if (prio === 'Low') return 2880;
      return 360;
    };

    const map = new Map<string, {
      monthKey: string;
      monthName: string;
      year: number;
      monthIndex: number;
      reports: CorrectiveReportItem[];
    }>();

    // Urutkan ascending kronologis untuk pemisahan bulan yang rapi
    const sorted = [...filteredSLAReports].sort((a, b) => getReportIncidentTime(a) - getReportIncidentTime(b));

    sorted.forEach((r) => {
      const ts = getReportIncidentTime(r);
      const d = ts > 0 ? new Date(ts) : new Date();
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const monthObj = INDO_MONTHS.find(m => m.value === monthIndex.toString());
      const monthName = monthObj ? monthObj.label : `Bulan ${monthIndex + 1}`;
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

      if (!map.has(monthKey)) {
        map.set(monthKey, {
          monthKey,
          monthName,
          year,
          monthIndex,
          reports: []
        });
      }
      map.get(monthKey)!.reports.push(r);
    });

    return Array.from(map.values()).map(group => {
      const total = group.reports.length;
      const respM = group.reports.filter(r => r.responseComply !== false && (r.actualResponseTimeMin !== undefined ? r.actualResponseTimeMin <= (r.targetResponseMin || 5) : true)).length;
      const onsiteM = group.reports.filter(r => r.onsiteComply !== false && (r.actualOnsiteTimeMin !== undefined ? r.actualOnsiteTimeMin <= (r.targetOnsiteMin || 120) : true)).length;
      const restoreM = group.reports.filter(r => {
        const t = 180;
        return r.restoreComply !== false && (r.actualRestoreTimeMin !== undefined ? r.actualRestoreTimeMin <= t : true);
      }).length;
      const resolutionM = group.reports.filter(r => {
        const t = r.targetResolutionMin || getTargetByPriority(r.priority);
        return r.resolutionComply !== false && (r.actualResolutionTimeMin !== undefined ? r.actualResolutionTimeMin <= t : true);
      }).length;

      const respPct = total > 0 ? (respM / total) * 100 : 0;
      const onsitePct = total > 0 ? (onsiteM / total) * 100 : 0;
      const restorePct = total > 0 ? (restoreM / total) * 100 : 0;
      const resolutionPct = total > 0 ? (resolutionM / total) * 100 : 0;

      const respScore = (respPct / 100) * 5;
      const onsiteScore = (onsitePct / 100) * 5;
      const restoreScore = (restorePct / 100) * 15;
      const resolutionScore = (resolutionPct / 100) * 15;
      const totalScore = respScore + onsiteScore + restoreScore + resolutionScore;

      return {
        ...group,
        total,
        respM, respPct, respScore,
        onsiteM, onsitePct, onsiteScore,
        restoreM, restorePct, restoreScore,
        resolutionM, resolutionPct, resolutionScore,
        totalScore
      };
    });
  }, [filteredSLAReports]);

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
      return 'Semua Rentang Waktu';
    } else {
      const monthObj = INDO_MONTHS.find(m => m.value === selectedMonth);
      const monthName = monthObj ? monthObj.label : 'Semua Bulan';
      const yearName = selectedYear !== 'all' ? selectedYear : 'Semua Tahun';
      return `${monthName} ${yearName}`;
    }
  }, [filterMode, startDate, endDate, selectedMonth, selectedYear]);

  // Export handlers
  const handleExportDocx = async () => {
    if (isDateRangeInvalid) {
      toast.error('Tanggal Mulai tidak boleh lebih besar dari Tanggal Selesai.');
      return;
    }
    if (filteredSLAReports.length === 0) {
      toast.error(`Tidak ada laporan SLA pada periode ${periodLabel} untuk diekspor.`);
      return;
    }
    // Urutkan kronologis ascending (awal bulan ke akhir bulan) agar baris pertama di dokumen adalah insiden pertama
    const sortedAscending = [...filteredSLAReports].sort((a, b) => getReportIncidentTime(a) - getReportIncidentTime(b));
    const toastId = toast.loading(`Menyiapkan Rekapitulasi SLA Word (.docx) (${sortedAscending.length} Dokumen)...`);
    try {
      setExportingDocx(true);
      await exportSLAMonthlyRecapToDocx(sortedAscending, periodLabel);
      toast.success(`Berhasil mengekspor Rekap SLA Word (${periodLabel})!`, { id: toastId });
    } catch (err: any) {
      console.error('Error exporting SLA Word recap:', err);
      toast.error(`Gagal mengekspor Rekap SLA Word: ${err?.message || 'Kendala sistem'}`, { id: toastId });
    } finally {
      setExportingDocx(false);
    }
  };

  const handleExportExcel = async () => {
    if (isDateRangeInvalid) {
      toast.error('Tanggal Mulai tidak boleh lebih besar dari Tanggal Selesai.');
      return;
    }
    if (filteredSLAReports.length === 0) {
      toast.error(`Tidak ada laporan SLA pada periode ${periodLabel} untuk diekspor.`);
      return;
    }
    // Urutkan kronologis ascending (awal bulan ke akhir bulan) agar baris pertama di Excel adalah insiden pertama
    const sortedAscending = [...filteredSLAReports].sort((a, b) => getReportIncidentTime(a) - getReportIncidentTime(b));
    const toastId = toast.loading(`Menyiapkan Rekapitulasi SLA Excel (.xlsx) (${sortedAscending.length} Dokumen)...`);
    try {
      setExportingExcel(true);
      await exportSLAMonthlyRecapToExcel(sortedAscending, periodLabel);
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
                Rekapitulasi Kinerja SLA &amp; SLG
              </h2>
              <p className="text-slate-300 text-xs mt-0.5">
                Filter pencapaian SLA berdasarkan Bulan/Tahun atau Rentang Tanggal Spesifik untuk diekspor ke Word (.docx) &amp; Excel (.xlsx).
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
          {/* Filter Mode Selector & Quick Presets */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 pb-3 border-b border-slate-200/80">
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
                  onClick={() => applyQuickRange('cycle')}
                  className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition cursor-pointer"
                  title="Siklus Laporan Cut-off Data Center: 25 Bulan Lalu s/d 24 Bulan Ini"
                >
                  Siklus 25–24
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickRange('reset')}
                  className="px-2 py-1 bg-white hover:bg-red-50 text-slate-500 hover:text-red-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                  title="Hapus Filter Tanggal (Tampilkan Semua)"
                >
                  Hapus Filter
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {filterMode === 'range' ? (
              <>
                {/* Tanggal Mulai */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Dari Tanggal &amp; Bulan</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-xs cursor-pointer"
                  />
                </div>

                {/* Tanggal Selesai */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Sampai Tanggal &amp; Bulan</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-xs cursor-pointer"
                  />
                </div>

                {/* Filter Tiket / Area */}
                <div className="sm:col-span-6">
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
                      className="w-full pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition shadow-xs"
                    />
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
              </>
            ) : (
              <>
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
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Warning Banner Rentang Tanggal Tidak Valid */}
          {isDateRangeInvalid && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-semibold">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Tanggal Mulai ({formatIndoDate(startDate)}) tidak boleh melebihi Tanggal Selesai ({formatIndoDate(endDate)}). Silakan sesuaikan tanggal.</span>
            </div>
          )}

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

            {filteredSLAReports.length > 0 && !isDateRangeInvalid && (
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

              {/* Card Ringkasan Multi-Bulan jika filter lintas bulan */}
              {monthGroups.length > 1 && (
                <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-lg border border-blue-700/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-500/30 border border-blue-400/40 text-blue-200 font-extrabold text-[10px] rounded uppercase tracking-wider">
                        Multi-Bulan ({monthGroups.length} Periode)
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-white">
                        Rincian Evaluasi Skor SLG Terpisah Per Bulan
                      </h4>
                    </div>
                    <span className="text-[11px] text-blue-200">
                      Export Word &amp; Excel otomatis memisahkan tabel &amp; subtotal per bulan + summary kumulatif.
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-300 border-b border-white/10 text-[11px]">
                          <th className="py-1.5 px-2.5 font-semibold">Bulan</th>
                          <th className="py-1.5 px-2.5 font-semibold text-center">Total Tiket</th>
                          <th className="py-1.5 px-2.5 font-semibold text-center">Response (5%)</th>
                          <th className="py-1.5 px-2.5 font-semibold text-center">Onsite (5%)</th>
                          <th className="py-1.5 px-2.5 font-semibold text-center">Restore (15%)</th>
                          <th className="py-1.5 px-2.5 font-semibold text-center">Resolution (15%)</th>
                          <th className="py-1.5 px-2.5 font-bold text-right text-amber-300">Total Skor SLG</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {monthGroups.map((mg) => (
                          <tr key={mg.monthKey} className="hover:bg-white/5 transition">
                            <td className="py-2 px-2.5 font-bold text-white flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-blue-400" />
                              <span>{mg.monthName} {mg.year}</span>
                            </td>
                            <td className="py-2 px-2.5 text-center font-semibold text-slate-200">{mg.total}</td>
                            <td className="py-2 px-2.5 text-center text-slate-300">{mg.respScore.toFixed(2)}%</td>
                            <td className="py-2 px-2.5 text-center text-slate-300">{mg.onsiteScore.toFixed(2)}%</td>
                            <td className="py-2 px-2.5 text-center text-slate-300">{mg.restoreScore.toFixed(2)}%</td>
                            <td className="py-2 px-2.5 text-center text-slate-300">{mg.resolutionScore.toFixed(2)}%</td>
                            <td className="py-2 px-2.5 text-right font-extrabold text-amber-300">
                              {mg.totalScore.toFixed(2)}% / 40.00%
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-white/10 font-bold border-t border-white/20">
                          <td className="py-2 px-2.5 text-white uppercase tracking-wide">Grand Total Kumulatif</td>
                          <td className="py-2 px-2.5 text-center text-white">{summaryKpi.total}</td>
                          <td className="py-2 px-2.5 text-center text-emerald-300">{summaryKpi.respScore.toFixed(2)}%</td>
                          <td className="py-2 px-2.5 text-center text-emerald-300">{summaryKpi.onsiteScore.toFixed(2)}%</td>
                          <td className="py-2 px-2.5 text-center text-emerald-300">{summaryKpi.restoreScore.toFixed(2)}%</td>
                          <td className="py-2 px-2.5 text-center text-emerald-300">{summaryKpi.resolutionScore.toFixed(2)}%</td>
                          <td className="py-2 px-2.5 text-right font-black text-amber-400">
                            {summaryKpi.totalScore.toFixed(2)}% / 40.00%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Preview Table of Reports in selected month */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-500" />
                    <span>Daftar Order / Tiket SLA Periode {periodLabel} ({filteredSLAReports.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {monthGroups.length > 1 ? 'Dikelompokkan per bulan' : 'Urutan insiden terbaru di atas'}
                  </span>
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
                        {monthGroups.length > 1 ? (
                          monthGroups.map((mg) => (
                            <Fragment key={mg.monthKey}>
                              <tr className="bg-blue-50/80 font-extrabold text-blue-900 border-y border-blue-200">
                                <td colSpan={7} className="px-3 py-2">
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                      <span>BULAN: {mg.monthName.toUpperCase()} {mg.year} ({mg.total} Tiket)</span>
                                    </span>
                                    <span className="text-[11px] font-bold text-blue-950">
                                      Skor SLG: <strong className="text-amber-800">{mg.totalScore.toFixed(2)}% / 40%</strong>
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {mg.reports.map((report, idx) => {
                                const dateDisplay = report.timeOrder
                                  ? new Date(report.timeOrder).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                  : report.incidentDate || '-';

                                return (
                                  <tr key={report.id || `${mg.monthKey}-${idx}`} className="hover:bg-slate-50 transition">
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
                            </Fragment>
                          ))
                        ) : (
                          filteredSLAReports.map((report, idx) => {
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
                          })
                        )}
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
              disabled={filteredSLAReports.length === 0 || exportingDocx || exportingExcel || isDateRangeInvalid}
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
              disabled={filteredSLAReports.length === 0 || exportingDocx || exportingExcel || isDateRangeInvalid}
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
