// ============================================================================
// FILE: frontend/utils/CMMonthlyRecapExport.ts
// Deskripsi: Utilitas Ekspor Rekapitulasi Laporan Corrective Maintenance (CM)
//            Mendukung 3 format ekspor resmi:
//            1. Microsoft Excel (.xlsx) dengan auto-styling & rekap status
//            2. Microsoft Word (.docx) landscape dengan kop ganda & lembar pengesahan
//            3. Dokumen PDF (.pdf) Landscape resmi A4 dengan autotable
// ============================================================================

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
  HeadingLevel,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  PageOrientation,
  VerticalAlign,
} from 'docx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { loadLogoBase64 } from '@/utils/ReportPdfExport';
import { compressBase64Image } from '@/utils/imageCompression';
import { db } from '@/api/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { PredictiveReportData } from '@/types/predictiveReportTypes';

// --- HELPER DATES & PARSING ---

const INDO_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const INDO_MONTHS_MAP: Record<string, number> = {
  januari: 0, jan: 0, january: 0,
  februari: 1, feb: 1, february: 1,
  maret: 2, mar: 2, march: 2,
  april: 3, apr: 3,
  mei: 4, may: 4,
  juni: 5, jun: 5, june: 5,
  juli: 6, jul: 6, july: 6,
  agustus: 7, agu: 7, ags: 7, aug: 7, august: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9, oct: 9, october: 9,
  november: 10, nov: 10,
  desember: 11, des: 11, dec: 11, december: 11,
};

/** Parse various date formats to timestamp for chronological ordering */
export function parseReportTime(r: any): number {
  if (!r) return 0;
  const rawCandidates = [
    r.incidentDate,
    r.date,
    r.reportedAt,
    r.createdAt,
    r.timeOrder,
    r.startOrder,
  ];

  for (const raw of rawCandidates) {
    if (!raw) continue;
    if (typeof raw === 'number') return raw;
    if (typeof raw.toDate === 'function') {
      const t = raw.toDate().getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (typeof raw === 'object' && typeof raw.seconds === 'number') {
      return raw.seconds * 1000;
    }
    if (raw instanceof Date) {
      const t = raw.getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      // 1. ISO YYYY-MM-DD
      const isoMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      if (isoMatch) {
        const y = parseInt(isoMatch[1], 10);
        const m = parseInt(isoMatch[2], 10) - 1;
        const d = parseInt(isoMatch[3], 10);
        const dt = new Date(y, m, d);
        if (!isNaN(dt.getTime())) return dt.getTime();
      }

      // 2. DD-MM-YYYY
      const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (dmyMatch) {
        const d = parseInt(dmyMatch[1], 10);
        const m = parseInt(dmyMatch[2], 10) - 1;
        const y = parseInt(dmyMatch[3], 10);
        const dt = new Date(y, m, d);
        if (!isNaN(dt.getTime())) return dt.getTime();
      }

      // 3. Indo text format "15 Juli 2026"
      const indoMatch = trimmed.match(/^(\d{1,2})[\s\-_/]+([a-zA-Z]+)[\s\-_/]+(\d{4})/);
      if (indoMatch) {
        const d = parseInt(indoMatch[1], 10);
        const mKey = indoMatch[2].toLowerCase();
        const y = parseInt(indoMatch[3], 10);
        if (mKey in INDO_MONTHS_MAP) {
          const dt = new Date(y, INDO_MONTHS_MAP[mKey], d);
          if (!isNaN(dt.getTime())) return dt.getTime();
        }
      }

      const standardT = new Date(trimmed).getTime();
      if (!isNaN(standardT) && standardT > 0) return standardT;
    }
  }
  return 0;
}

/** Format timestamp or raw date to Indonesian readable format "15 Juli 2026" */
export function formatReportDate(r: any): string {
  const ts = parseReportTime(r);
  if (ts > 0) {
    const d = new Date(ts);
    const day = d.getDate();
    const month = INDO_MONTH_NAMES[d.getMonth()] || '';
    const year = d.getFullYear();
    return `${day < 10 ? '0' + day : day} ${month} ${year}`;
  }
  return r.incidentDate || r.date || '-';
}

/** Extract time string e.g. "14:30" */
export function formatReportTime(r: any): string {
  if (r.incidentTime) return r.incidentTime;
  if (r.timeOrder) return r.timeOrder;
  if (r.time) return r.time;
  const ts = parseReportTime(r);
  if (ts > 0) {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    if (h !== '00' || m !== '00') {
      return `${h}:${m} WIB`;
    }
  }
  return '-';
}

/** Check if report is sparepart */
export function isCMSparepart(r: any): boolean {
  if (r.troubleshootType === 'sparepart_replacement' || r.isSparepartReplacement === true) {
    return true;
  }
  if (Array.isArray(r.spareparts) && r.spareparts.length > 0) return true;
  if (Array.isArray(r.sparepartsUsed) && r.sparepartsUsed.length > 0) return true;
  if (r.sparepartType === 'sparepart_dme' || r.sparepartType === 'consumable') return true;
  return false;
}

/** Get sparepart category label */
export function getSparepartCategoryLabel(r: any): string {
  if (!isCMSparepart(r)) return 'Non-Sparepart (Troubleshoot)';
  if (r.sparepartType === 'sparepart_dme') return 'Sparepart DME (Baut / Pengadaan DME)';
  if (r.sparepartType === 'consumable') return 'Consumable Part (Wajib SLA)';
  return 'Pergantian Sparepart (Belum Diklasifikasi)';
}

/** Summarize spareparts used in string */
export function getSparepartsSummary(r: any): string {
  const list = (Array.isArray(r.spareparts) && r.spareparts.length > 0)
    ? r.spareparts
    : (Array.isArray(r.sparepartsUsed) ? r.sparepartsUsed : []);

  if (list.length === 0) {
    return isCMSparepart(r) ? '(Ada pergantian sparepart)' : '-';
  }

  return list
    .map((item: any, idx: number) => {
      const name = item.name || item.partName || 'Sparepart';
      const brand = item.brand || item.brandName ? ` (${item.brand || item.brandName})` : '';
      const qty = item.qty || item.quantity ? ` - ${item.qty || item.quantity}` : '';
      return `${idx + 1}. ${name}${brand}${qty}`;
    })
    .join('\n');
}

/** Get Trouble Status info */
export function getTroubleStatusInfo(r: any): { isClosed: boolean; label: string; note: string } {
  const isClosed = r.troubleStatus === 'closed' || (!r.troubleStatus && r.status === 'Resolved');
  const isOpen = r.troubleStatus === 'open' || (!r.troubleStatus && r.status === 'Open');

  if (isClosed) {
    return {
      isClosed: true,
      label: 'SOLVED (CLOSED)',
      note: r.troubleCompletionNotes || r.closingNotes || r.resolutionRemark || 'Masalah telah diselesaikan'
    };
  }

  if (isOpen) {
    return {
      isClosed: false,
      label: 'PENDING (OPEN)',
      note: r.troublePendingReason || r.pendingReason || r.remark || 'Menunggu penanganan lanjutan / suku cadang'
    };
  }

  return {
    isClosed: false,
    label: 'BELUM DITANDAI',
    note: r.remark || '-'
  };
}

export interface CMPhotoDetail {
  base64: string;
  description: string;
}

export interface MonthGroupedReports {
  key: string;        // e.g. '2026-01'
  year: number;       // 2026
  month: number;      // 0-11
  monthLabel: string; // e.g. 'Januari 2026'
  reports: any[];
}

/** Group reports chronologically by year and month */
export function groupReportsByMonth(reports: any[]): MonthGroupedReports[] {
  const map: Record<string, MonthGroupedReports> = {};

  for (const r of reports) {
    const ts = parseReportTime(r);
    const dt = ts > 0 ? new Date(ts) : new Date();
    const y = dt.getFullYear();
    const m = dt.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;

    if (!map[key]) {
      map[key] = {
        key,
        year: y,
        month: m,
        monthLabel: `${INDO_MONTH_NAMES[m] || 'Bulan'} ${y}`,
        reports: [],
      };
    }
    map[key].reports.push(r);
  }

  return Object.keys(map).sort().map(k => {
    map[k].reports.sort((a, b) => parseReportTime(a) - parseReportTime(b));
    return map[k];
  });
}

export interface CMReportWithPhotos {
  report: any;
  index: number;
  ticketStr: string;
  equipLocStr: string;
  dateStr: string;
  photos: CMPhotoDetail[];
}

/** Extract all photos from a single report */
export function extractPhotosFromReport(r: any): { base64: string; description: string }[] {
  if (!r) return [];
  const list: { base64: string; description: string }[] = [];

  if (Array.isArray(r.photos) && r.photos.length > 0) {
    r.photos.forEach((p: any) => {
      if (!p) return;
      if (typeof p === 'string' && p.trim()) {
        list.push({ base64: p.trim(), description: '' });
      } else if (typeof p === 'object') {
        const b64 = p.photoBase64 || p.photo || p.url || p.photoUrl || p.image || p.src || '';
        const desc = p.description || p.caption || p.keterangan || p.note || '';
        if (b64 && typeof b64 === 'string' && b64.trim()) {
          list.push({ base64: b64.trim(), description: desc.trim() });
        }
      }
    });
  }

  // Fallback single legacy photo fields
  if (list.length === 0 && r.photoBase64 && typeof r.photoBase64 === 'string' && r.photoBase64.trim()) {
    list.push({
      base64: r.photoBase64.trim(),
      description: r.photoDescription || ''
    });
  }

  return list;
}

/** Convert image src (URL, data URI, or raw base64) to valid data:image/jpeg;base64 string */
export async function ensureBase64Image(src: string): Promise<string> {
  if (!src) return '';
  if (src.startsWith('data:image/')) return src;
  if (!src.startsWith('http') && !src.startsWith('/') && !src.startsWith('blob:')) {
    return `data:image/jpeg;base64,${src}`;
  }
  return loadLogoBase64(src);
}

/** Helper to resolve all reports that have valid photos into base64 format */
export async function resolveReportsWithPhotos(reports: any[]): Promise<CMReportWithPhotos[]> {
  const result: CMReportWithPhotos[] = [];
  for (let i = 0; i < reports.length; i++) {
    const r = reports[i];
    const rawPhotos = extractPhotosFromReport(r);
    if (rawPhotos.length > 0) {
      const resolvedList: CMPhotoDetail[] = [];
      for (const p of rawPhotos) {
        const b64 = await ensureBase64Image(p.base64);
        if (b64) {
          let optimizedB64 = b64;
          try {
            optimizedB64 = await compressBase64Image(b64, {
              maxWidth: 600,
              maxHeight: 450,
              quality: 0.72,
            });
          } catch (compErr) {
            console.warn('Compress photo for recap fallback to original:', compErr);
          }
          resolvedList.push({ base64: optimizedB64, description: p.description });
        }
      }
      if (resolvedList.length > 0) {
        result.push({
          report: r,
          index: i + 1,
          ticketStr: r.incidentName || r.ticketName || r.ticketNumber || `CM-${i + 1}`,
          equipLocStr: `${r.equipmentName || r.equipment || '-'} (${r.location || r.area || 'NeutraDC'})`,
          dateStr: formatReportDate(r),
          photos: resolvedList,
        });
      }
    }
  }
  return result;
}

/** Convert base64 or URL to Uint8Array for docx ImageRun */
function base64ToUint8Array(base64: string): Uint8Array {
  try {
    if (!base64 || typeof base64 !== 'string') return new Uint8Array(0);
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const binary = atob(raw.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.warn('Error converting base64 to Uint8Array for docx:', e);
    return new Uint8Array(0);
  }
}

async function loadImageAsUint8Array(src: string): Promise<Uint8Array> {
  if (!src) return new Uint8Array();
  if (src.startsWith('data:image')) {
    return base64ToUint8Array(src);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      const dataUrl = canvas.toDataURL('image/png');
      resolve(base64ToUint8Array(dataUrl));
    };
    img.onerror = () => resolve(new Uint8Array());
    img.src = src;
  });
}

// Helper mengambil data laporan prediktif yang terikat dengan laporan CM
async function resolveCMPredictiveReport(report: any): Promise<PredictiveReportData | null> {
  if (!report) return null;
  if (report.predictiveReportData) return report.predictiveReportData;
  if (report.predictiveReportId) {
    try {
      const snap = await getDoc(doc(db, 'predictive_reports', report.predictiveReportId));
      if (snap.exists()) {
        return snap.data() as PredictiveReportData;
      }
    } catch (e) {
      console.warn('Gagal memuat predictive report terkait CM:', e);
    }
  }
  return null;
}

// Helper untuk menghitung dimensi asli gambar agar aspect ratio terjaga sempurna
function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width || 600,
        height: img.naturalHeight || img.height || 450,
      });
    };
    img.onerror = () => resolve({ width: 600, height: 450 });
    img.src = base64;
  });
}

// ============================================================================
// 1. EKSPOR EXCEL (.XLSX)
// ============================================================================

export async function exportCMMonthlyRecapToExcel(
  rawReports: any[],
  periodTitle: string = 'Bulanan'
): Promise<void> {
  const reports = (rawReports || [])
    .filter(r => !r.deleteRequested && r.reportType !== 'SLA' && r.reportType !== 'PIR')
    .sort((a, b) => parseReportTime(a) - parseReportTime(b));

  if (reports.length === 0) {
    throw new Error('Tidak ada data Laporan CM yang valid untuk diekspor ke Excel.');
  }

  const toastId = toast.loading('Membuat Spreadsheet Excel Rekap CM...');

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT Dwimitra Ekatama Mandiri';
    workbook.lastModifiedBy = 'Data Center Maintenance System - DC Cikarang';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Theme Colors & Styles (Shared across all worksheets)
    const headerNavy = '002060';
    const textDark = '0F172A';
    const borderGray = 'CBD5E1';

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: borderGray } },
      left: { style: 'thin', color: { argb: borderGray } },
      bottom: { style: 'thin', color: { argb: borderGray } },
      right: { style: 'thin', color: { argb: borderGray } },
    };

    // Helper to generate a standardized CM recap sheet
    const populateCMExcelSheet = (
      sheetName: string,
      sheetTitle: string,
      sheetReports: any[],
      statsText: string
    ) => {
      const sheet = workbook.addWorksheet(sheetName.substring(0, 31), {
        pageSetup: { orientation: 'landscape', paperSize: 9 } // A4 Landscape
      });

      // Row 1-3: Document Title & Metadata
      sheet.mergeCells('A1:P1');
      const r1 = sheet.getCell('A1');
      r1.value = 'PT DWIMITRA EKATAMA MANDIRI — NEUTRA DC CIKARANG';
      r1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: headerNavy } };
      r1.alignment = { horizontal: 'left', vertical: 'middle' };
      sheet.getRow(1).height = 24;

      sheet.mergeCells('A2:P2');
      const r2 = sheet.getCell('A2');
      r2.value = sheetTitle;
      r2.font = { name: 'Calibri', size: 12, bold: true, color: { argb: textDark } };
      r2.alignment = { horizontal: 'left', vertical: 'middle' };
      sheet.getRow(2).height = 20;

      sheet.mergeCells('A3:P3');
      const r3 = sheet.getCell('A3');
      r3.value = statsText;
      r3.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '475569' } };
      r3.alignment = { horizontal: 'left', vertical: 'middle' };
      sheet.getRow(3).height = 18;

      sheet.getRow(4).height = 10; // Empty spacer

      // Row 5: Column Headers
      const headers = [
        'No',
        'Tanggal',
        'Waktu',
        'No. Tiket / Insiden',
        'Uraian Pekerjaan / Gangguan',
        'Perangkat',
        'Lokasi / Ruangan',
        'Status Trouble',
        'Catatan Penyelesaian / Pending',
        'Jenis Penanganan',
        'Kategori Sparepart',
        'Uraian Gejala & Analisis Masalah',
        'Tindakan Perbaikan (Action Taken)',
        'Sparepart Terpakai',
        'Teknisi Pelaksana (PIC DME)',
        'PIC NeutraDC'
      ];

      const headerRow = sheet.getRow(5);
      headerRow.values = headers;
      headerRow.height = 28;

      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: headerNavy }
        };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBorder;
      });

      // Data Rows
      sheetReports.forEach((report, index) => {
        const statusInfo = getTroubleStatusInfo(report);
        const isSp = isCMSparepart(report);

        const rowValues = [
          index + 1,
          formatReportDate(report),
          formatReportTime(report),
          report.incidentName || report.ticketName || report.ticketNumber || `CM-${index + 1}`,
          report.issue || report.problem || report.incidentName || 'Corrective Maintenance',
          report.equipmentName || report.equipment || report.device || '-',
          report.location || report.area || 'NeutraDC Cikarang',
          statusInfo.label,
          statusInfo.note,
          isSp ? 'Pergantian Sparepart' : 'Non-Sparepart (Troubleshoot)',
          getSparepartCategoryLabel(report),
          report.problemAnalysis || report.summaryProblemAnalysis || report.problem || '-',
          report.correctiveAction || report.actionTaken || '-',
          getSparepartsSummary(report),
          report.picDME || report.preparedByName || report.technician || '-',
          report.picTDE || report.acknowledgedBy1Name || report.customerPIC || '-'
        ];

        const row = sheet.addRow(rowValues);
        row.height = 32;

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Calibri', size: 9, color: { argb: textDark } };
          cell.border = thinBorder;
          cell.alignment = {
            vertical: 'middle',
            wrapText: true,
            horizontal: (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 8 || colNumber === 10)
              ? 'center'
              : 'left'
          };

          // Alternating zebra
          if (index % 2 === 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'F8FAFC' }
            };
          }

          // Status Trouble highlight
          if (colNumber === 8) {
            if (statusInfo.isClosed) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'DCFCE7' } // light emerald
              };
              cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '166534' } };
            } else {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FEF3C7' } // light amber
              };
              cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'B45309' } };
            }
          }
        });
      });

      // Column widths
      const colWidths = [6, 14, 11, 20, 28, 22, 18, 16, 26, 18, 22, 30, 30, 24, 18, 18];
      colWidths.forEach((w, i) => {
        sheet.getColumn(i + 1).width = w;
      });

      // Freeze header pane
      sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];
      return sheet;
    };

    const monthGroups = groupReportsByMonth(reports);

    // Summary statistics keseluruhan
    const totalCM = reports.length;
    const closedCount = reports.filter(r => getTroubleStatusInfo(r).isClosed).length;
    const openCount = totalCM - closedCount;
    const sparepartCount = reports.filter(r => isCMSparepart(r)).length;
    const nonSparepartCount = totalCM - sparepartCount;
    const dmeSparepartCount = reports.filter(r => r.sparepartType === 'sparepart_dme').length;
    const consumableCount = reports.filter(r => r.sparepartType === 'consumable').length;

    if (monthGroups.length > 1) {
      // 1. Sheet Semua Periode
      const statsAll = `Total CM: ${totalCM} | Solved: ${closedCount} | Pending: ${openCount} | Sparepart DME/Baut: ${dmeSparepartCount} | Consumable Part: ${consumableCount} | Non-Sparepart: ${nonSparepartCount} | Periode: ${periodTitle} | Ekspor: ${new Date().toLocaleString('id-ID')}`;
      populateCMExcelSheet(
        'Semua Periode',
        `REKAPITULASI LAPORAN CM — SEMUA PERIODE: ${periodTitle.toUpperCase()}`,
        reports,
        statsAll
      );

      // 2. Sheet Terpisah Per Bulan
      monthGroups.forEach((group) => {
        const gTotal = group.reports.length;
        const gClosed = group.reports.filter(r => getTroubleStatusInfo(r).isClosed).length;
        const gOpen = gTotal - gClosed;
        const gSp = group.reports.filter(r => isCMSparepart(r)).length;
        const gNonSp = gTotal - gSp;
        const statsGroup = `Total CM Bulan Ini: ${gTotal} | Solved: ${gClosed} | Pending: ${gOpen} | Pergantian Sparepart: ${gSp} | Non-Sparepart: ${gNonSp} | Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`;

        const safeMonthSheetName = `Rekap ${group.monthLabel}`.replace(/[\\/?*:[\]]/g, '_').substring(0, 31);
        populateCMExcelSheet(
          safeMonthSheetName,
          `REKAPITULASI LAPORAN CM — BULAN ${group.monthLabel.toUpperCase()}`,
          group.reports,
          statsGroup
        );
      });
    } else {
      // 1 Bulan Saja
      const statsSingle = `Total CM: ${totalCM} | Solved: ${closedCount} | Pending: ${openCount} | Sparepart DME/Baut: ${dmeSparepartCount} | Consumable Part: ${consumableCount} | Non-Sparepart: ${nonSparepartCount} | Ekspor: ${new Date().toLocaleString('id-ID')}`;
      populateCMExcelSheet(
        'Rekap CM',
        `REKAPITULASI LAPORAN CORRECTIVE MAINTENANCE (CM) — PERIODE: ${periodTitle.toUpperCase()}`,
        reports,
        statsSingle
      );
    }

    // ========================================================================
    // WORKSHEET 2: DOKUMENTASI FOTO CM (Halaman / Tab Terpisah)
    // ========================================================================
    const photoSheet = workbook.addWorksheet('Dokumentasi Foto CM', {
      pageSetup: { orientation: 'landscape', paperSize: 9 } // A4 Landscape
    });

    // Column widths for photo sheet: 2-column card layout with captions
    photoSheet.getColumn(1).width = 4;   // Col A (Margin)
    photoSheet.getColumn(2).width = 17;  // Col B (Photo 1)
    photoSheet.getColumn(3).width = 17;  // Col C (Photo 1)
    photoSheet.getColumn(4).width = 17;  // Col D (Photo 1)
    photoSheet.getColumn(5).width = 4;   // Col E (Gap)
    photoSheet.getColumn(6).width = 17;  // Col F (Photo 2)
    photoSheet.getColumn(7).width = 17;  // Col G (Photo 2)
    photoSheet.getColumn(8).width = 17;  // Col H (Photo 2)
    photoSheet.getColumn(9).width = 4;   // Col I (Margin)

    // Header Title Worksheet 2
    photoSheet.mergeCells('A1:I1');
    const pr1 = photoSheet.getCell('A1');
    pr1.value = 'PT DWIMITRA EKATAMA MANDIRI — NEUTRA DC CIKARANG';
    pr1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: headerNavy } };
    pr1.alignment = { horizontal: 'left', vertical: 'middle' };
    photoSheet.getRow(1).height = 24;

    photoSheet.mergeCells('A2:I2');
    const pr2 = photoSheet.getCell('A2');
    pr2.value = `LAMPIRAN DOKUMENTASI FOTO CORRECTIVE MAINTENANCE (CM) — PERIODE: ${periodTitle.toUpperCase()}`;
    pr2.font = { name: 'Calibri', size: 12, bold: true, color: { argb: textDark } };
    pr2.alignment = { horizontal: 'left', vertical: 'middle' };
    photoSheet.getRow(2).height = 20;

    // Resolve all photos for Excel
    const reportsWithPhotos = await resolveReportsWithPhotos(reports);
    const totalPhotosCount = reportsWithPhotos.reduce((acc, curr) => acc + curr.photos.length, 0);

    photoSheet.mergeCells('A3:I3');
    const pr3 = photoSheet.getCell('A3');
    pr3.value = `Total Laporan CM: ${totalCM} | Laporan Berfoto: ${reportsWithPhotos.length} | Total Lampiran Foto: ${totalPhotosCount} Foto | Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`;
    pr3.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '475569' } };
    pr3.alignment = { horizontal: 'left', vertical: 'middle' };
    photoSheet.getRow(3).height = 18;

    photoSheet.getRow(4).height = 10;

    if (reportsWithPhotos.length === 0) {
      photoSheet.mergeCells('B5:H6');
      const emptyCell = photoSheet.getCell('B5');
      emptyCell.value = 'Tidak terdapat lampiran foto dokumentasi pada laporan CM di periode ini.';
      emptyCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: '64748B' } };
      emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
      emptyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
      emptyCell.border = thinBorder;
    } else {
      let curRow = 5;

      for (const item of reportsWithPhotos) {
        // Section Header Banner for Report
        photoSheet.mergeCells(`B${curRow}:H${curRow}`);
        const bannerCell = photoSheet.getCell(`B${curRow}`);
        bannerCell.value = `[NO. ${item.index}] TIKET: ${item.ticketStr}  |  PERANGKAT: ${item.equipLocStr}  |  TGL: ${item.dateStr}`;
        bannerCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '1E3A8A' } };
        bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };
        bannerCell.alignment = { horizontal: 'left', vertical: 'middle' };
        bannerCell.border = thinBorder;
        photoSheet.getRow(curRow).height = 24;
        curRow++;

        for (let pIdx = 0; pIdx < item.photos.length; pIdx += 2) {
          const p1 = item.photos[pIdx];
          const p2 = item.photos[pIdx + 1];

          const imgRow = curRow;
          photoSheet.getRow(imgRow).height = 175;

          // Embed Photo 1
          try {
            const rawB64_1 = p1.base64.includes(',') ? p1.base64.split(',')[1] : p1.base64;
            const ext1 = p1.base64.includes('image/png') ? 'png' : 'jpeg';
            const imgId1 = workbook.addImage({ base64: rawB64_1, extension: ext1 });
            photoSheet.addImage(imgId1, {
              tl: { col: 1.1, row: imgRow - 0.9 },
              ext: { width: 330, height: 220 },
              editAs: 'oneCell'
            });
          } catch (imgErr) {
            console.warn('Gagal menyematkan foto 1 ke Excel:', imgErr);
          }

          // Caption row Photo 1
          const capRow = imgRow + 1;
          photoSheet.getRow(capRow).height = 24;
          photoSheet.mergeCells(`B${capRow}:D${capRow}`);
          const capCell1 = photoSheet.getCell(`B${capRow}`);
          capCell1.value = `Foto ${pIdx + 1}: ${p1.description || 'Dokumentasi perbaikan CM'}`;
          capCell1.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '334155' } };
          capCell1.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          capCell1.border = thinBorder;
          capCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };

          // Embed Photo 2 if available
          if (p2) {
            try {
              const rawB64_2 = p2.base64.includes(',') ? p2.base64.split(',')[1] : p2.base64;
              const ext2 = p2.base64.includes('image/png') ? 'png' : 'jpeg';
              const imgId2 = workbook.addImage({ base64: rawB64_2, extension: ext2 });
              photoSheet.addImage(imgId2, {
                tl: { col: 5.1, row: imgRow - 0.9 },
                ext: { width: 330, height: 220 },
                editAs: 'oneCell'
              });
            } catch (imgErr) {
              console.warn('Gagal menyematkan foto 2 ke Excel:', imgErr);
            }

            photoSheet.mergeCells(`F${capRow}:H${capRow}`);
            const capCell2 = photoSheet.getCell(`F${capRow}`);
            capCell2.value = `Foto ${pIdx + 2}: ${p2.description || 'Dokumentasi perbaikan CM'}`;
            capCell2.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '334155' } };
            capCell2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            capCell2.border = thinBorder;
            capCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
          }

          curRow = capRow + 2; // +1 gap row
        }

        curRow++; // gap row between reports
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const cleanPeriod = periodTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Rekap_CM_${cleanPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`;

    saveAs(new Blob([buffer]), fileName);
    toast.success('Spreadsheet Excel Rekap CM berhasil diunduh!', { id: toastId });
  } catch (err: any) {
    console.error('Error exporting CM recap to Excel:', err);
    toast.error(`Gagal membuat Excel Rekap CM: ${err?.message || err}`, { id: toastId });
  }
}

// ============================================================================
// 2. EKSPOR WORD (.DOCX)
// ============================================================================

export interface ExportCMWordOptions {
  periodLabel?: string; // e.g. "Agustus 2026" atau "Semua Periode"
  printedBy?: string;   // e.g. "PT Dwimitra Ekatama Mandiri"
}

export async function exportCMMonthlyRecapToDocx(
  rawReports: any[],
  periodTitleOrOptions: string | ExportCMWordOptions = 'Bulanan'
): Promise<void> {
  const periodTitle = typeof periodTitleOrOptions === 'object'
    ? (periodTitleOrOptions.periodLabel || 'Bulanan')
    : periodTitleOrOptions;

  const reports = (rawReports || [])
    .filter(r => !r.deleteRequested && r.reportType !== 'SLA' && r.reportType !== 'PIR')
    .sort((a, b) => parseReportTime(a) - parseReportTime(b));

  if (reports.length === 0) {
    throw new Error('Tidak ada data Laporan CM yang valid untuk diekspor ke Word.');
  }

  const toastId = toast.loading('Membuat Dokumen Word Rekap CM...');

  try {
    const [logoLeftBytes, logoRightBytes] = await Promise.all([
      loadImageAsUint8Array(logoDwimitra),
      loadImageAsUint8Array(logoNeutraDC),
    ]);

    const now = new Date();
    // Theme Colors (Monokrom formal & profesional)
    const COLOR_PRIMARY = '000000';
    const COLOR_SECONDARY = '000000';
    const COLOR_DME_BLUE = '00599C';
    const COLOR_DARK = '000000';
    const COLOR_MUTED = '000000';
    const COLOR_LIGHT_BG = 'F8FAFC'; // Slate 50
    const COLOR_ROSE_BG = 'FFFFFF';
    const COLOR_GREEN_BG = 'FFFFFF';
    const COLOR_BORDER = 'CBD5E1'; // Slate 300
    const COLOR_WHITE = 'FFFFFF';

    const borderThin = {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
    } as const;

    // Hitung Statistik KPI
    const totalCM = reports.length;
    const closedCount = reports.filter(r => getTroubleStatusInfo(r).isClosed).length;
    const openCount = totalCM - closedCount;
    const sparepartCount = reports.filter(r => isCMSparepart(r)).length;

    // 1. KOP SURAT RESMI (Tabel 3 Kolom: Logo Dwimitra - Judul - Logo NeutraDC)
    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: borderThin,
      rows: [
        new TableRow({
          children: [
            // Logo Kiri: PT Dwimitra Ekatama Mandiri
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              borders: borderThin,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: logoLeftBytes.length > 0
                    ? [new ImageRun({ data: logoLeftBytes, transformation: { width: 110, height: 48 }, type: 'png' })]
                    : [new TextRun({ text: 'PT DWIMITRA', bold: true, size: 18, color: COLOR_PRIMARY, font: 'Calibri' })],
                }),
              ],
            }),
            // Judul Tengah Dokumen
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              borders: borderThin,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 30 },
                  children: [
                    new TextRun({
                      text: 'REKAPITULASI LAPORAN CORRECTIVE MAINTENANCE (CM)',
                      bold: true,
                      size: 24,
                      color: COLOR_PRIMARY,
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 30 },
                  children: [
                    new TextRun({
                      text: 'DATA CENTER NEUTRADc CIKARANG',
                      bold: true,
                      size: 18,
                      color: COLOR_SECONDARY,
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 20 },
                  children: [
                    new TextRun({
                      text: `Periode: ${periodTitle} | Total Pekerjaan CM: ${totalCM} Item`,
                      bold: true,
                      size: 16,
                      color: COLOR_DARK,
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'Dokumen Resmi Rekapitulasi Corrective Maintenance (CM)',
                      size: 14,
                      color: COLOR_MUTED,
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
            // Logo Kanan: NeutraDC
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              borders: borderThin,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: logoRightBytes.length > 0
                    ? [new ImageRun({ data: logoRightBytes, transformation: { width: 110, height: 48 }, type: 'png' })]
                    : [new TextRun({ text: 'NEUTRA DC', bold: true, size: 18, color: COLOR_SECONDARY, font: 'Calibri' })],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    // 2. TABEL RINGKASAN EKSEKUTIF (KPI CARDS DI WORD)
    const kpiTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: borderThin,
      rows: [
        new TableRow({
          children: [
            { label: 'TOTAL PEKERJAAN CM', val: `${totalCM} Item`, color: COLOR_PRIMARY },
            { label: 'STATUS SELESAI (SOLVED)', val: `${closedCount} Item`, color: '166534' },
            { label: 'STATUS PENDING / PROSES', val: `${openCount} Item`, color: 'B45309' },
            { label: 'PENGGANTIAN SPAREPART', val: `${sparepartCount} Item`, color: COLOR_DARK },
          ].map((kpi) =>
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              borders: borderThin,
              shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 40, after: 20 },
                  children: [
                    new TextRun({
                      text: kpi.label,
                      bold: true,
                      size: 14,
                      color: COLOR_MUTED,
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 10, after: 40 },
                  children: [
                    new TextRun({
                      text: kpi.val,
                      bold: true,
                      size: 24,
                      color: kpi.color,
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            })
          ),
        }),
      ],
    });

    // Helper untuk memformat teks sel tabel menjadi paragraf rapi (mendukung enter atau bullet point)
    // Helper untuk memformat sel 'Uraian Masalah & Tindakan Solusi' (Dipisah garis pemisah horizontal)
    const buildIssueAndActionCell = (issueStr: string, actionStr: string, isZebra: boolean) => {
      const issueTrimmed = (issueStr || '-').trim();
      const actionTrimmed = (actionStr || '-').trim();

      // 1. Parsing baris / bullet uraian masalah
      let issueLines: string[] = [];
      if (issueTrimmed && issueTrimmed !== '-') {
        if (issueTrimmed.includes('\n')) {
          issueLines = issueTrimmed.split('\n').map(l => l.trim()).filter(Boolean);
        } else if (issueTrimmed.includes('•')) {
          issueLines = issueTrimmed.split('•').map(l => l.trim()).filter(Boolean).map(l => `• ${l}`);
        } else {
          issueLines = [issueTrimmed];
        }
      } else {
        issueLines = ['-'];
      }

      // 2. Normalisasi tindakan solusi menjadi daftar bernomor yang konsisten.
      // Input lama dapat berisi bullet, strip, ataupun nomor dari teknisi.
      const actionLines = (actionTrimmed && actionTrimmed !== '-' ? actionTrimmed : '-')
        .replace(/\r\n?/g, '\n')
        .replace(/•\s*/g, '\n')
        .split(/\n+/)
        .map((line) => line
          .trim()
          .replace(/^\s*(?:[-–—]\s*|\d+\s*[).:-]\s*)/, '')
          .trim())
        .filter(Boolean);
      if (actionLines.length === 0) actionLines.push('-');

      const cellParagraphs: Paragraph[] = [];

      // A. Bagian Atas: Uraian Masalah (Kendala)
      issueLines.forEach((line, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === issueLines.length - 1;
        const children: TextRun[] = [];

        if (isFirst) {
          children.push(
            new TextRun({
              text: 'Kendala: ',
              bold: true,
              size: 13,
              color: '334155',
              font: 'Calibri',
            })
          );
        }
        children.push(
          new TextRun({
            text: line,
            size: 14,
            color: COLOR_DARK,
            font: 'Calibri',
          })
        );

        cellParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: {
              before: isFirst ? 15 : 4,
              after: isLast ? 8 : 4,
            },
            // Garis horizontal pemisah di bawah uraian masalah
            border: isLast
              ? {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 6, // 0.75 pt garis solid tegas
                    color: COLOR_BORDER, // Slate 300
                    space: 8,
                  },
                }
              : undefined,
            children,
          })
        );
      });

      // B. Bagian Bawah: Tindakan Solusi (nomor 1)., 2)., 3)., dst.)
      cellParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 14, after: 2 },
          children: [
            new TextRun({
              text: 'Tindakan Solusi:',
              bold: true,
              size: 13,
              color: '166534',
              font: 'Calibri',
            }),
          ],
        })
      );

      actionLines.forEach((line, idx) => {
        const isLast = idx === actionLines.length - 1;

        cellParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            indent: { left: 180, hanging: 120 },
            spacing: {
              before: 0,
              after: isLast ? 15 : 2,
            },
            children: [
              new TextRun({
                text: `${idx + 1}). ${line}`,
                size: 14,
                color: COLOR_DARK,
                font: 'Calibri',
              }),
            ],
          })
        );
      });

      return new TableCell({
        width: { size: 42, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        borders: borderThin,
        shading: isZebra ? { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG } : undefined,
        children: cellParagraphs,
      });
    };

    // 3. TABEL MATRIKS REKAPITULASI CEPAT (SUMMARY MATRIX TABLE)
    const tableHeaderRow = new TableRow({
      tableHeader: true,
      children: [
        'No',
        'No. Tiket / Identitas',
        'Perangkat & Lokasi',
        'Tanggal & Status',
        'Uraian Masalah & Tindakan Solusi',
      ].map((text, idx) =>
        new TableCell({
          width: {
            size: [4, 18, 22, 14, 42][idx],
            type: WidthType.PERCENTAGE,
          },
          shading: { type: ShadingType.SOLID, color: COLOR_DME_BLUE, fill: COLOR_DME_BLUE },
          verticalAlign: VerticalAlign.CENTER,
          borders: borderThin,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 50, after: 50 },
              children: [
                new TextRun({
                  text,
                  bold: true,
                  size: 15,
                  color: COLOR_WHITE,
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        })
      ),
    });

    const tableDataRows = reports.map((report, idx) => {
      const statusInfo = getTroubleStatusInfo(report);
      const isClosed = statusInfo.isClosed;
      const ticketStr = report.incidentName || report.ticketName || report.ticketNumber || `CM-${idx + 1}`;
      const equipLocStr = `${report.equipmentName || report.equipment || '-'}\n${report.location || report.area || 'NeutraDC'}`;
      const dateStr = formatReportDate(report);
      const issueStr = report.issue || report.problem || report.problemAnalysis || '-';
      const actionStr = report.correctiveAction || report.actionTaken || '-';

      return new TableRow({
        children: [
          // 1. No
          new TableCell({
            width: { size: 4, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderThin,
            shading: idx % 2 === 1 ? { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG } : undefined,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 30 },
                children: [new TextRun({ text: String(idx + 1), size: 15, font: 'Calibri', bold: true })],
              }),
            ],
          }),
          // 2. Tiket
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderThin,
            shading: idx % 2 === 1 ? { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG } : undefined,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 30, after: 30 },
                children: [new TextRun({ text: ticketStr, size: 15, font: 'Calibri', bold: true })],
              }),
            ],
          }),
          // 3. Perangkat & Lokasi
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderThin,
            shading: idx % 2 === 1 ? { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG } : undefined,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 30, after: 30 },
                children: [new TextRun({ text: equipLocStr, size: 15, font: 'Calibri' })],
              }),
            ],
          }),
          // 4. Tanggal & Status
          new TableCell({
            width: { size: 14, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderThin,
            shading: idx % 2 === 1 ? { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG } : undefined,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 10 },
                children: [new TextRun({ text: dateStr, size: 14, font: 'Calibri' })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 20 },
                children: [
                  new TextRun({
                    text: statusInfo.label,
                    bold: true,
                    size: 13,
                    font: 'Calibri',
                    color: isClosed ? '166534' : 'B45309',
                  }),
                ],
              }),
            ],
          }),
          // 5. Uraian Masalah & Tindakan Solusi (Satu Sel Kolom dengan Garis Pemisah Horizontal)
          buildIssueAndActionCell(issueStr, actionStr, idx % 2 === 1),
        ],
      });
    });

    const summaryMatrixTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [tableHeaderRow, ...tableDataRows],
    });

    // 4. BAGIAN DETAIL PER PEKERJAAN CM (LENGKAP DESKRIPSI, TINDAKAN, STATUS, & FOTO)
    const detailReportParagraphs: (Paragraph | Table)[] = [];

    detailReportParagraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { before: 400, after: 150 },
        children: [
          new TextRun({
            text: 'RINCIAN DETAIL PEKERJAAN CM & TINDAK LANJUT',
            bold: true,
            size: 22,
            color: COLOR_PRIMARY,
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: 'Rincian gangguan teknis, tindakan korektif, status penanganan, dan lampiran dokumentasi fisik per pekerjaan corrective maintenance.',
            size: 16,
            color: COLOR_MUTED,
            font: 'Calibri',
            italics: true,
          }),
        ],
      })
    );

    // Data tindakan dari form kadang membawa CRLF/baris kosong berulang.
    // Normalisasi menjadi satu line break agar Word tidak membuat jarak vertikal
    // yang terlalu lebar di dalam kotak Issue dan Action Taken.
    const buildCompactDetailRuns = (value: unknown, size: number, color: string, bold = false): TextRun[] => {
      const lines = String(value || '-')
        .replace(/\r\n?/g, '\n')
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      const safeLines = lines.length > 0 ? lines : ['-'];

      return safeLines.flatMap((line, lineIdx) => [
        ...(lineIdx > 0 ? [new TextRun({ break: 1 })] : []),
        new TextRun({ text: line, size, color, bold, font: 'Calibri' }),
      ]);
    };

    // Hanya jadikan Action Taken sebagai daftar bernomor bila input memang
    // memakai penanda poin (bullet, strip, atau nomor). Paragraf biasa tetap
    // dipertahankan sebagai teks biasa agar formatnya tidak dipaksakan.
    const buildNumberedActionRuns = (value: unknown, size: number, color: string): TextRun[] | null => {
      const lines = String(value || '')
        .replace(/\r\n?/g, '\n')
        .replace(/\u2022\s*/g, '\n\u2022 ')
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      const pointMarker = /^\s*(?:\u2022|[-–—*]|\d+\s*[).:-])\s*/;

      if (!lines.some((line) => pointMarker.test(line))) return null;

      const points: string[] = [];
      lines.forEach((line) => {
        const isPoint = pointMarker.test(line);
        const cleanLine = line.replace(pointMarker, '').trim();
        if (!cleanLine) return;

        if (isPoint || points.length === 0) {
          points.push(cleanLine);
        } else {
          points[points.length - 1] += ` ${cleanLine}`;
        }
      });

      return points.flatMap((point, pointIdx) => [
        ...(pointIdx > 0 ? [new TextRun({ break: 1 })] : []),
        new TextRun({ text: `${pointIdx + 1}). ${point}`, size, color, font: 'Calibri' }),
      ]);
    };

    for (let idx = 0; idx < reports.length; idx++) {
      const report = reports[idx];
      const statusInfo = getTroubleStatusInfo(report);
      const isClosed = statusInfo.isClosed;
      const ticketStr = report.incidentName || report.ticketName || report.ticketNumber || `CM-${idx + 1}`;
      const equipLocStr = `${report.equipmentName || report.equipment || '-'} (${report.location || report.area || 'NeutraDC'})`;
      const dateStr = formatReportDate(report);
      const timeStr = formatReportTime(report);
      const isSp = isCMSparepart(report);
      const issueStr = report.issue || report.problem || report.problemAnalysis || '-';
      const actionStr = report.correctiveAction || report.actionTaken || '-';
      const photos = extractPhotosFromReport(report);

      // Header Card Pekerjaan CM
      detailReportParagraphs.push(
        new Paragraph({
          // Setiap laporan CM harus dimulai dari halaman baru agar header,
          // metadata, tindakan, dan dokumentasinya tetap menjadi satu blok.
          pageBreakBefore: idx > 0,
          keepNext: true,
          spacing: { before: 250, after: 80 },
          shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
          border: {
            left: { style: BorderStyle.SINGLE, size: 8, color: isClosed ? '166534' : 'B45309' },
            top: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
            right: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
          },
          indent: { left: 120 },
          children: [
            new TextRun({
              text: `[${idx + 1}] PEKERJAAN CM: ${ticketStr.toUpperCase()}`,
              bold: true,
              size: 19,
              color: COLOR_PRIMARY,
              font: 'Calibri',
            }),
            new TextRun({
              text: `   |   STATUS: ${statusInfo.label.toUpperCase()}`,
              bold: true,
              size: 15,
              color: isClosed ? '166534' : 'B45309',
              font: 'Calibri',
            }),
          ],
        })
      );

      // Tabel Metadata Pekerjaan
      const metaTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: borderThin,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
                borders: borderThin,
                children: [
                  new Paragraph({
                    spacing: { before: 20, after: 20 },
                    children: [new TextRun({ text: 'Perangkat & Lokasi', bold: true, size: 15, color: COLOR_DARK, font: 'Calibri' })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 75, type: WidthType.PERCENTAGE },
                borders: borderThin,
                children: [
                  new Paragraph({
                    spacing: { before: 20, after: 20 },
                    children: [new TextRun({ text: equipLocStr, size: 15, color: COLOR_DARK, font: 'Calibri' })],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
                borders: borderThin,
                children: [
                  new Paragraph({
                    spacing: { before: 20, after: 20 },
                    children: [new TextRun({ text: 'Tanggal & Pelapor/PIC', bold: true, size: 15, color: COLOR_DARK, font: 'Calibri' })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 75, type: WidthType.PERCENTAGE },
                borders: borderThin,
                children: [
                  new Paragraph({
                    spacing: { before: 20, after: 20 },
                    children: [
                      new TextRun({
                        text: `Tanggal: ${dateStr}${timeStr !== '-' ? ` (${timeStr})` : ''} | PIC DME: ${report.picDME || report.preparedByName || report.technician || '-'} | PIC NeutraDC: ${report.picTDE || report.acknowledgedBy1Name || report.customerPIC || '-'}`,
                        size: 15,
                        color: COLOR_DARK,
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
                borders: borderThin,
                children: [
                  new Paragraph({
                    spacing: { before: 20, after: 20 },
                    children: [new TextRun({ text: 'Jenis CM', bold: true, size: 15, color: COLOR_DARK, font: 'Calibri' })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 75, type: WidthType.PERCENTAGE },
                borders: borderThin,
                children: [
                  new Paragraph({
                    spacing: { before: 20, after: 20 },
                    children: [
                      new TextRun({
                        text: `${isSp ? 'Pergantian Sparepart' : 'Non-Sparepart'} (${getSparepartCategoryLabel(report).replace(/\s*\(Wajib SLA\)/i, '')})`,
                        size: 15,
                        color: COLOR_DARK,
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });
      detailReportParagraphs.push(metaTable);

      // Callout Box Masalah
      detailReportParagraphs.push(
        new Paragraph({
          spacing: { before: 80, after: 20 },
          children: [
            new TextRun({
              text: 'Deskripsi Gangguan / Indikasi Masalah (Issue):',
              bold: true,
              size: 16,
              color: COLOR_DARK,
              font: 'Calibri',
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 30, after: 80, line: 240 },
          shading: { type: ShadingType.SOLID, color: COLOR_ROSE_BG, fill: COLOR_ROSE_BG },
          border: {
            left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_DARK },
            top: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
            right: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
          },
          indent: { left: 100 },
          children: buildCompactDetailRuns(issueStr, 15, COLOR_DARK, true),
        })
      );

      // Callout Box Tindakan Perbaikan
      const numberedActionRuns = buildNumberedActionRuns(actionStr, 15, COLOR_DARK);
      detailReportParagraphs.push(
        new Paragraph({
          spacing: { before: 40, after: 20 },
          children: [
            new TextRun({
              text: 'Tindakan Perbaikan yang Dilakukan (Action Taken):',
              bold: true,
              size: 16,
              color: COLOR_DARK,
              font: 'Calibri',
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 30, after: 60, line: 240 },
          shading: { type: ShadingType.SOLID, color: COLOR_GREEN_BG, fill: COLOR_GREEN_BG },
          border: {
            left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_DARK },
            top: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
            right: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
          },
          indent: { left: 100 },
          children: numberedActionRuns || buildCompactDetailRuns(actionStr, 15, COLOR_DARK),
        })
      );

      // Catatan Status Trouble (Penyelesaian / Pending)
      if (statusInfo.note && statusInfo.note !== '-') {
        detailReportParagraphs.push(
          new Paragraph({
            spacing: { before: 20, after: 80 },
            children: [
              new TextRun({ text: 'Catatan Penanganan: ', bold: true, size: 14, font: 'Calibri', color: isClosed ? '166534' : 'B45309' }),
              new TextRun({ text: statusInfo.note, size: 14, font: 'Calibri', italics: true, color: '334155' }),
            ],
          })
        );
      }

      // Lampiran Foto Dokumentasi Fisik (Grid 2-Kolom Kompak & Tajam)
      if (photos.length > 0) {
        // Resolve images first
        const resolvedPhotos: { bytes: Uint8Array; width: number; height: number; desc: string }[] = [];
        for (let pIdx = 0; pIdx < photos.length; pIdx++) {
          const photo = photos[pIdx];
          const b64 = await ensureBase64Image(photo.base64);
          if (b64) {
            const photoBytes = base64ToUint8Array(b64);
            if (photoBytes.length > 0) {
              const dims = await getImageDimensions(b64);
              resolvedPhotos.push({
                bytes: photoBytes,
                width: dims.width,
                height: dims.height,
                desc: photo.description || '',
              });
            }
          }
        }

        if (resolvedPhotos.length === 1) {
          // Hanya 1 foto: tampilkan terpusat proporsional (hemat ruang tapi tetap jernih & tajam)
          const p = resolvedPhotos[0];
          const maxWidth = 340;
          const maxHeight = 220;
          let drawW = maxWidth;
          let drawH = (p.height / p.width) * maxWidth;
          if (drawH > maxHeight) {
            drawH = maxHeight;
            drawW = (p.width / p.height) * maxHeight;
          }

          detailReportParagraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 20 },
              children: [
                new ImageRun({
                  data: p.bytes,
                  transformation: { width: Math.round(drawW), height: Math.round(drawH) },
                  type: 'jpg',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              children: [
                new TextRun({
                  text: `Gambar ${idx + 1}.1: Foto Dokumentasi Pekerjaan — ${ticketStr} ${p.desc ? `(${p.desc})` : ''}`,
                  italics: true,
                  size: 13,
                  color: COLOR_MUTED,
                  font: 'Calibri',
                }),
              ],
            })
          );
        } else if (resolvedPhotos.length > 1) {
          // 2 atau lebih foto: Grid Tabel 2-Kolom (Side-by-Side). Hemat ruang 60%+ namun tetap besar, jernih & tajam!
          const photoTableRows: TableRow[] = [];
          const maxWidth = 295;
          const maxHeight = 190;

          for (let pIdx = 0; pIdx < resolvedPhotos.length; pIdx += 2) {
            const p1 = resolvedPhotos[pIdx];
            const p2 = resolvedPhotos[pIdx + 1];

            // Render cell 1
            let drawW1 = maxWidth;
            let drawH1 = (p1.height / p1.width) * maxWidth;
            if (drawH1 > maxHeight) {
              drawH1 = maxHeight;
              drawW1 = (p1.width / p1.height) * maxHeight;
            }

            const cell1 = new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: borderThin,
              shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 30, after: 15 },
                  children: [
                    new ImageRun({
                      data: p1.bytes,
                      transformation: { width: Math.round(drawW1), height: Math.round(drawH1) },
                      type: 'jpg',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 30 },
                  children: [
                    new TextRun({
                      text: `Gambar ${idx + 1}.${pIdx + 1}: ${p1.desc || 'Dokumentasi perbaikan CM'}`,
                      italics: true,
                      size: 12,
                      color: '334155',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            });

            // Render cell 2
            let cell2: TableCell;
            if (p2) {
              let drawW2 = maxWidth;
              let drawH2 = (p2.height / p2.width) * maxWidth;
              if (drawH2 > maxHeight) {
                drawH2 = maxHeight;
                drawW2 = (p2.width / p2.height) * maxHeight;
              }

              cell2 = new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: borderThin,
                shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 30, after: 15 },
                    children: [
                      new ImageRun({
                        data: p2.bytes,
                        transformation: { width: Math.round(drawW2), height: Math.round(drawH2) },
                        type: 'jpg',
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 30 },
                    children: [
                      new TextRun({
                        text: `Gambar ${idx + 1}.${pIdx + 2}: ${p2.desc || 'Dokumentasi perbaikan CM'}`,
                        italics: true,
                        size: 12,
                        color: '334155',
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              });
            } else {
              // Jika ganjil, sel kanan kosong rapi
              cell2 = new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: borderThin,
                children: [new Paragraph('')],
              });
            }

            photoTableRows.push(new TableRow({ cantSplit: true, children: [cell1, cell2] }));
          }

          detailReportParagraphs.push(
            new Paragraph({ spacing: { before: 40, after: 10 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: photoTableRows,
            }),
            new Paragraph({ spacing: { before: 0, after: 60 } })
          );
        }
      }

      // Bundling Laporan Predictive Maintenance (PdM) 1-to-1 jika ada
      const pdmData = await resolveCMPredictiveReport(report);
      if (pdmData) {
        detailReportParagraphs.push(
          new Paragraph({
            spacing: { before: 120, after: 50 },
            shading: { type: ShadingType.SOLID, color: 'F5F3FF', fill: 'F5F3FF' },
            border: {
              left: { style: BorderStyle.SINGLE, size: 8, color: '6D28D9' },
              top: { style: BorderStyle.SINGLE, size: 1, color: 'DDD6FE' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'DDD6FE' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDD6FE' },
            },
            indent: { left: 80 },
            children: [
              new TextRun({
                text: `[🤖 LAMPIRAN ANALISIS PREDIKTIF AI] ${pdmData.reportNumber} — STATUS: ${pdmData.healthStatus.toUpperCase()}`,
                bold: true,
                size: 16,
                color: COLOR_DARK,
                font: 'Calibri',
              }),
              new TextRun({
                text: `   |   Estimasi Sisa Umur (RUL): ${pdmData.aiAnalysis?.remainingUsefulLife || '-'}`,
                bold: true,
                size: 15,
                color: COLOR_DARK,
                font: 'Calibri',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borderThin,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 28, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
                    borders: borderThin,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Akar Masalah (Root Cause)', bold: true, size: 15, font: 'Calibri' })] })],
                  }),
                  new TableCell({
                    width: { size: 72, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    children: [new Paragraph({ children: [new TextRun({ text: pdmData.aiAnalysis?.rootCauseAnalysis || '-', size: 15, font: 'Calibri' })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 28, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
                    borders: borderThin,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Potensi Modus Kegagalan', bold: true, size: 15, font: 'Calibri' })] })],
                  }),
                  new TableCell({
                    width: { size: 72, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    children: [new Paragraph({ children: [new TextRun({ text: pdmData.aiAnalysis?.potentialFailureMode || '-', size: 15, font: 'Calibri' })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 28, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
                    borders: borderThin,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Rencana Tindakan Definitif', bold: true, size: 15, font: 'Calibri' })] })],
                  }),
                  new TableCell({
                    width: { size: 72, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    children: [new Paragraph({ children: [new TextRun({ text: pdmData.actionPlan?.plannedOverhaulAction || pdmData.actionPlan?.immediateAction || '-', size: 15, font: 'Calibri' })] })],
                  }),
                ],
              }),
            ],
          })
        );
      }

      // Garis pembatas tipis antar laporan (kecuali yang terakhir)
      if (idx < reports.length - 1) {
        detailReportParagraphs.push(
          new Paragraph({
            spacing: { before: 100, after: 150 },
            border: { bottom: { style: BorderStyle.DASHED, size: 2, color: COLOR_BORDER } },
            children: [],
          })
        );
      }
    }

    // 5. SUSUN DOKUMEN DOCX UTAMA (Format A4 Landscape Resmi)
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: 'Calibri',
              size: 20,
              color: COLOR_DARK,
            },
          },
          heading1: {
            run: {
              font: 'Calibri',
              size: 24,
              bold: true,
              color: COLOR_PRIMARY,
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                orientation: PageOrientation.LANDSCAPE,
                width: 16838,
                height: 11906,
              },
              margin: {
                top: 720,
                bottom: 720,
                left: 900,
                right: 900,
              },
              pageNumbers: {
                start: 1,
                formatType: NumberFormat.DECIMAL,
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: 'DOKUMEN RESMI — PT DWIMITRA EKATAMA MANDIRI & NEUTRADc CIKARANG',
                      size: 14,
                      color: '94A3B8',
                      font: 'Calibri',
                      italics: true,
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `Rekapitulasi Laporan Corrective Maintenance (CM) — Periode: ${periodTitle} — Halaman `,
                      size: 14,
                      color: '94A3B8',
                      font: 'Calibri',
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 14,
                      color: '94A3B8',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
          },
          children: [
            // Kop Surat
            headerTable,

            new Paragraph({ spacing: { before: 180, after: 100 } }),

            // KPI Box Table
            kpiTable,

            new Paragraph({ spacing: { before: 200, after: 100 } }),

            // Heading Matriks Rekap
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 150, after: 100 },
              children: [
                new TextRun({
                  text: 'DAFTAR REKAPITULASI PEKERJAAN CORRECTIVE MAINTENANCE (CM)',
                  bold: true,
                  size: 20,
                  color: COLOR_PRIMARY,
                  font: 'Calibri',
                }),
              ],
            }),

            // Tabel Matriks
            summaryMatrixTable,

            // Rincian Detail per Laporan CM
            ...detailReportParagraphs,
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const cleanPeriod = periodTitle.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
    const fileName = `Rekap_CM_${cleanPeriod}_${now.toISOString().split('T')[0]}.docx`;

    saveAs(blob, fileName);
    toast.success('Dokumen Word Rekap CM berhasil diunduh!', { id: toastId });
  } catch (err: any) {
    console.error('Error exporting CM recap to Word:', err);
    toast.error(`Gagal membuat Word Rekap CM: ${err?.message || err}`, { id: toastId });
  }
}

// ============================================================================
// 3. EKSPOR PDF (.PDF)
// ============================================================================

export async function exportCMMonthlyRecapToPDF(
  rawReports: any[],
  periodTitle: string = 'Bulanan'
): Promise<void> {
  const reports = (rawReports || [])
    .filter(r => !r.deleteRequested && r.reportType !== 'SLA' && r.reportType !== 'PIR')
    .sort((a, b) => parseReportTime(a) - parseReportTime(b));

  if (reports.length === 0) {
    throw new Error('Tidak ada data Laporan CM yang valid untuk diekspor ke PDF.');
  }

  const toastId = toast.loading('Menyiapkan & mengompresi PDF Rekap CM Ringkas...');

  try {
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageWidth - 2 * margin;

    const BLUE_RGB: [number, number, number] = [0, 89, 156];
    const DARK = '#1e293b';
    const GRAY = '#64748b';

    // Resolving logos & optimized report photos simultaneously
    const [leftLogo, rightLogo, pdfReportsWithPhotos] = await Promise.all([
      loadLogoBase64(logoDwimitra),
      loadLogoBase64(logoNeutraDC),
      resolveReportsWithPhotos(reports),
    ]);

    const photosMapByReportId: Record<string, CMPhotoDetail[]> = {};
    pdfReportsWithPhotos.forEach((item) => {
      const rId = item.report.id || String(item.index);
      photosMapByReportId[rId] = item.photos;
    });

    const headerTopY = 4.5;
    const headerH = 21;
    const tableStartY = headerTopY + headerH + 3;

    const totalCM = reports.length;
    const closedCount = reports.filter(r => getTroubleStatusInfo(r).isClosed).length;
    const openCount = totalCM - closedCount;
    const sparepartCount = reports.filter(r => isCMSparepart(r)).length;
    const nonSparepartCount = totalCM - sparepartCount;
    const todayPrint = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const monthGroups = groupReportsByMonth(reports);

    const drawHeader = (currentDoc: jsPDF, group?: MonthGroupedReports) => {
      // Top accent strip
      currentDoc.setFillColor(...BLUE_RGB);
      currentDoc.rect(0, 0, pageWidth, 2.5, 'F');

      // Box
      currentDoc.setDrawColor(226, 232, 240);
      currentDoc.setLineWidth(0.2);
      currentDoc.roundedRect(margin, headerTopY, contentW, headerH, 1, 1, 'D');

      const col1W = 38;
      const col3W = 38;
      currentDoc.line(margin + col1W, headerTopY, margin + col1W, headerTopY + headerH);
      currentDoc.line(pageWidth - margin - col3W, headerTopY, pageWidth - margin - col3W, headerTopY + headerH);

      if (leftLogo) {
        currentDoc.addImage(leftLogo, 'PNG', margin + 2.5, headerTopY + 3.2, col1W - 5, 14, 'logo_dme', 'FAST');
      }
      if (rightLogo) {
        currentDoc.addImage(rightLogo, 'PNG', pageWidth - margin - col3W + 2.5, headerTopY + 3.5, col3W - 5, 13.5, 'logo_neutra', 'FAST');
      }

      const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
      currentDoc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      currentDoc.text('REKAPITULASI LAPORAN CORRECTIVE MAINTENANCE (CM)', centerX, headerTopY + 6.2, { align: 'center' });

      currentDoc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(DARK);
      const subTitle = group && monthGroups.length > 1
        ? `PT DWIMITRA EKATAMA MANDIRI — NEUTRA DC CIKARANG (Periode: ${periodTitle} • Bagian: ${group.monthLabel})`
        : `PT DWIMITRA EKATAMA MANDIRI — NEUTRA DC CIKARANG (Periode: ${periodTitle})`;
      currentDoc.text(subTitle, centerX, headerTopY + 11, { align: 'center' });

      const targetReports = group ? group.reports : reports;
      const gTotal = targetReports.length;
      const gClosed = targetReports.filter(r => getTroubleStatusInfo(r).isClosed).length;
      const gOpen = gTotal - gClosed;
      const gSp = targetReports.filter(r => isCMSparepart(r)).length;
      const gNonSp = gTotal - gSp;

      currentDoc.setFontSize(6.8).setFont('helvetica', 'bold').setTextColor(GRAY);
      const metricsText = group && monthGroups.length > 1
        ? `[Bulan ${group.monthLabel}] Total: ${gTotal} CM  |  Solved: ${gClosed}  |  Pending: ${gOpen}  |  Sparepart: ${gSp}  |  Non-SP: ${gNonSp}  |  Cetak: ${todayPrint}`
        : `Total CM: ${totalCM}  |  Solved (Closed): ${closedCount}  |  Pending (Open): ${openCount}  |  Sparepart: ${sparepartCount}  |  Non-SP: ${nonSparepartCount}  |  Cetak: ${todayPrint}`;

      currentDoc.text(metricsText, centerX, headerTopY + 16, { align: 'center' });
    };

    const drawFooter = (currentDoc: jsPDF, pg: number, totalPages: number) => {
      currentDoc.setFillColor(...BLUE_RGB);
      currentDoc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');
      currentDoc.setFontSize(6.5).setTextColor(GRAY);
      currentDoc.text('PT DWIMITRA EKATAMA MANDIRI — Corrective Maintenance Recap Report (Compact Format)', margin, pageHeight - 4.5);
      currentDoc.text(`Halaman ${pg} dari ${totalPages}`, pageWidth - margin, pageHeight - 4.5, { align: 'right' });
    };

    // Render Table per Month Group
    for (let gIdx = 0; gIdx < monthGroups.length; gIdx++) {
      const currentGroup = monthGroups[gIdx];
      const groupReports = currentGroup.reports;

      if (gIdx > 0) {
        doc.addPage('a4', 'landscape');
      }

      drawHeader(doc, currentGroup);

      const tableRows = groupReports.map((r, idx) => {
        const rId = r.id || String(idx + 1);
        const rPhotos = photosMapByReportId[rId] || [];
        const hasPhotos = rPhotos.length > 0;

        const statusInfo = getTroubleStatusInfo(r);
        const isSp = isCMSparepart(r);

        const dateText = formatReportDate(r);
        const timeText = formatReportTime(r);
        const ticketText = `${r.incidentName || r.ticketName || r.ticketNumber || `CM-${idx + 1}`}\nPerangkat: ${r.equipmentName || r.equipment || '-'}\nLokasi: ${r.location || r.area || 'NeutraDC'}`;
        
        const issueActionText = `Masalah:\n${r.issue || r.problemAnalysis || r.problem || '-'}\n\nTindakan:\n${r.correctiveAction || r.actionTaken || '-'}`;
        
        const statusText = `Status: ${statusInfo.label}\n\nJenis CM:\n${getSparepartCategoryLabel(r)}\n\nSparepart:\n${isSp ? '[GANTI SP]' : '[NON-SP]'}\n${getSparepartsSummary(r)}\n\nPIC: ${r.picDME || r.preparedByName || '-'}`;

        return [
          String(idx + 1),
          timeText !== '-' ? `${dateText}\n${timeText}` : dateText,
          ticketText,
          issueActionText,
          statusText,
          {
            content: '',
            styles: { minCellHeight: hasPhotos ? 29 : 12 }
          },
        ];
      });

      const photoColHeader = monthGroups.length > 1
        ? `Dokumentasi Foto (${currentGroup.monthLabel})`
        : 'Dokumentasi Foto Pekerjaan (Terpadu)';

      autoTable(doc, {
        startY: tableStartY,
        head: [[
          'No',
          'Tanggal & Jam',
          'No Tiket & Perangkat',
          'Uraian Masalah & Tindakan Perbaikan',
          'Status, Jenis CM & PIC',
          photoColHeader
        ]],
        body: tableRows,
        margin: { top: tableStartY, left: margin, right: margin, bottom: 8 },
        styles: {
          fontSize: 6.8,
          cellPadding: 1.6,
          lineColor: [203, 213, 225],
          lineWidth: 0.15,
          textColor: [30, 41, 59],
          font: 'helvetica',
          valign: 'middle',
        },
        headStyles: {
          fillColor: BLUE_RGB,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.2,
          halign: 'center',
          valign: 'middle',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 7 },
          1: { halign: 'center', cellWidth: 23 },
          2: { cellWidth: 44 },
          3: { cellWidth: 67 },
          4: { cellWidth: 38 },
          5: { cellWidth: 98, halign: 'center' },
        },
        didDrawPage: () => {
          drawHeader(doc, currentGroup);
        },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 5) {
            const currentReport = groupReports[data.row.index];
            const rId = currentReport?.id || String(data.row.index + 1);
            const rPhotos = photosMapByReportId[rId] || [];

            if (rPhotos.length > 0) {
              const photosToDraw = rPhotos.slice(0, 3);
              const count = photosToDraw.length;
              const padX = 1.2;
              const padY = 1.2;
              const availW = data.cell.width - padX * 2;
              const availH = data.cell.height - padY * 2;
              const gap = 1.8;
              const photoW = (availW - (count - 1) * gap) / count;
              const maxPhotoH = availH - 4;
              const photoH = Math.max(16, Math.min(maxPhotoH, 23.5));

              photosToDraw.forEach((photo, pIdx) => {
                const imgX = data.cell.x + padX + pIdx * (photoW + gap);
                const imgY = data.cell.y + padY;

                doc.setFillColor(241, 245, 249);
                doc.setDrawColor(203, 213, 225);
                doc.setLineWidth(0.15);
                doc.roundedRect(imgX, imgY, photoW, photoH, 0.8, 0.8, 'FD');

                try {
                  doc.addImage(photo.base64, 'JPEG', imgX, imgY, photoW, photoH, undefined, 'FAST');
                } catch (err) {
                  console.warn('Gagal render foto di sel PDF:', err);
                }

                doc.setDrawColor(148, 163, 184);
                doc.setLineWidth(0.1);
                doc.roundedRect(imgX, imgY, photoW, photoH, 0.8, 0.8, 'S');

                doc.setFontSize(4.8).setFont('helvetica', 'normal').setTextColor(71, 85, 105);
                const rawDesc = photo.description || `Foto ${pIdx + 1}`;
                const shortDesc = rawDesc.length > 20 ? rawDesc.substring(0, 18) + '..' : rawDesc;
                doc.text(shortDesc, imgX + photoW / 2, imgY + photoH + 3, { align: 'center' });
              });
            } else {
              doc.setFontSize(6.2).setFont('helvetica', 'italic').setTextColor(148, 163, 184);
              doc.text('(Tanpa Lampiran Foto)', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, { align: 'center' });
            }
          }
        },
      });
    }

    // Rekap PDF tidak menggunakan lembar pengesahan / tanda tangan.
    if (false) {
    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    const sigBoxH = 32;
    let sigStartY = finalY + 5;

    if (sigStartY + sigBoxH > pageHeight - 8) {
      doc.addPage('a4', 'landscape');
      drawHeader(doc);
      sigStartY = tableStartY + 5;
    }

    const colSigW = (contentW - 8) / 3;
    const sigBoxes = [
      { title: 'PREPARED BY,', name: 'Arif Budiman', org: 'PT Dwimitra Ekatama Mandiri', role: 'Standby Engineer' },
      { title: 'ACKNOWLEDGED BY,', name: 'Dwi Tasmiyadi', org: 'Facility Management NeutraDC', role: 'Facility Manager' },
      { title: 'APPROVED BY,', name: 'Budi Susanto', org: 'NeutraDC (PT Telkom Data Ekosistem)', role: 'Assistant Manager HDC' },
    ];

    sigBoxes.forEach((box, bIdx) => {
      const bx = margin + bIdx * (colSigW + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.roundedRect(bx, sigStartY, colSigW, sigBoxH, 1, 1, 'FD');

      doc.setFillColor(241, 245, 249);
      doc.rect(bx, sigStartY, colSigW, 5.5, 'F');
      doc.setFontSize(6.8).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      doc.text(box.title, bx + colSigW / 2, sigStartY + 4, { align: 'center' });

      doc.setFontSize(7.2).setFont('helvetica', 'bold').setTextColor(DARK);
      doc.text(box.name, bx + colSigW / 2, sigStartY + sigBoxH - 7, { align: 'center' });
      doc.setFontSize(5.8).setFont('helvetica', 'normal').setTextColor(GRAY);
      doc.text(`${box.role} — ${box.org}`, bx + colSigW / 2, sigStartY + sigBoxH - 3, { align: 'center' });
    });

    }

    // Add Footers to all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter(doc, p, totalPages);
    }

    const cleanPeriod = periodTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Rekap_CM_Ringkas_${cleanPeriod}_${new Date().toISOString().split('T')[0]}.pdf`;

    doc.save(fileName);
    toast.success('PDF Rekap CM Ringkas & Foto berhasil diunduh!', { id: toastId });
  } catch (err: any) {
    console.error('Error exporting CM recap to PDF:', err);
    toast.error(`Gagal membuat PDF Rekap CM: ${err?.message || err}`, { id: toastId });
  }
}
