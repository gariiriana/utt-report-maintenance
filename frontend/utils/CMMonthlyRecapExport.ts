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
  ShadingType,
  Header,
  Footer,
  PageNumber,
  PageOrientation,
} from 'docx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { loadLogoBase64 } from '@/utils/ReportPdfExport';

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
          resolvedList.push({ base64: b64, description: p.description });
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

    const sheet = workbook.addWorksheet('Rekap CM', {
      pageSetup: { orientation: 'landscape', paperSize: 9 } // A4 Landscape
    });

    // Theme Colors
    const headerNavy = '002060';
    const textDark = '0F172A';
    const borderGray = 'CBD5E1';

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: borderGray } },
      left: { style: 'thin', color: { argb: borderGray } },
      bottom: { style: 'thin', color: { argb: borderGray } },
      right: { style: 'thin', color: { argb: borderGray } },
    };

    // Row 1-4: Document Title & Metadata
    sheet.mergeCells('A1:P1');
    const r1 = sheet.getCell('A1');
    r1.value = 'PT DWIMITRA EKATAMA MANDIRI — NEUTRA DC CIKARANG';
    r1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: headerNavy } };
    r1.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getRow(1).height = 24;

    sheet.mergeCells('A2:P2');
    const r2 = sheet.getCell('A2');
    r2.value = `REKAPITULASI LAPORAN CORRECTIVE MAINTENANCE (CM) — PERIODE: ${periodTitle.toUpperCase()}`;
    r2.font = { name: 'Calibri', size: 12, bold: true, color: { argb: textDark } };
    r2.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    // Statistics Row
    const totalCM = reports.length;
    const closedCount = reports.filter(r => getTroubleStatusInfo(r).isClosed).length;
    const openCount = totalCM - closedCount;
    const sparepartCount = reports.filter(r => isCMSparepart(r)).length;
    const nonSparepartCount = totalCM - sparepartCount;

    sheet.mergeCells('A3:P3');
    const r3 = sheet.getCell('A3');
    r3.value = `Total Laporan CM: ${totalCM} | Solved (Closed): ${closedCount} | Pending (Open): ${openCount} | Pergantian Sparepart: ${sparepartCount} | Non-Sparepart: ${nonSparepartCount} | Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`;
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
    reports.forEach((report, index) => {
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

export async function exportCMMonthlyRecapToDocx(
  rawReports: any[],
  periodTitle: string = 'Bulanan'
): Promise<void> {
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

    const cellBorderThin = {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
    };

    const NAVY_BLUE = '002060';

    // Header dual logo table
    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY_BLUE },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: logoLeftBytes.length > 0 ? [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: logoLeftBytes,
                      transformation: { width: 130, height: 42 },
                      type: 'png',
                    }),
                  ],
                }),
              ] : [new Paragraph('')],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'PT DWIMITRA EKATAMA MANDIRI',
                      bold: true,
                      size: 22,
                      color: NAVY_BLUE,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'DATA CENTER OPERATION & MAINTENANCE SERVICES',
                      bold: true,
                      size: 16,
                      color: '334155',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'NeutraDC (PT Telkom Data Ekosistem) — Cikarang',
                      size: 14,
                      color: '64748B',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: logoRightBytes.length > 0 ? [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new ImageRun({
                      data: logoRightBytes,
                      transformation: { width: 120, height: 40 },
                      type: 'png',
                    }),
                  ],
                }),
              ] : [new Paragraph('')],
            }),
          ],
        }),
      ],
    });

    // Summary KPI
    const totalCM = reports.length;
    const closedCount = reports.filter(r => getTroubleStatusInfo(r).isClosed).length;
    const openCount = totalCM - closedCount;
    const sparepartCount = reports.filter(r => isCMSparepart(r)).length;
    const nonSparepartCount = totalCM - sparepartCount;

    // Table Header Row
    const tableHeaderCells = [
      { text: 'No', width: 4 },
      { text: 'Tanggal & Jam', width: 12 },
      { text: 'No Tiket / Insiden', width: 16 },
      { text: 'Perangkat & Lokasi', width: 18 },
      { text: 'Uraian Masalah & Tindakan Perbaikan', width: 26 },
      { text: 'Status Trouble', width: 12 },
      { text: 'Sparepart Terpakai', width: 12 },
    ].map(h => new TableCell({
      width: { size: h.width, type: WidthType.PERCENTAGE },
      shading: { fill: NAVY_BLUE, type: ShadingType.CLEAR },
      borders: cellBorderThin,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: h.text, bold: true, size: 16, color: 'FFFFFF' }),
          ],
        }),
      ],
    }));

    // Data Rows
    const dataRows = reports.map((report, idx) => {
      const statusInfo = getTroubleStatusInfo(report);
      const isClosed = statusInfo.isClosed;

      const dateStr = formatReportDate(report);
      const timeStr = formatReportTime(report);
      const ticketStr = report.incidentName || report.ticketName || report.ticketNumber || `CM-${idx + 1}`;
      const equipLocStr = `${report.equipmentName || report.equipment || '-'}\nLokasi: ${report.location || report.area || 'NeutraDC'}`;
      
      const issueActionStr = `Masalah:\n${report.issue || report.problemAnalysis || report.problem || '-'}\n\nTindakan:\n${report.correctiveAction || report.actionTaken || '-'}`;
      
      const sparepartsStr = getSparepartsSummary(report);

      return new TableRow({
        children: [
          // 1. No
          new TableCell({
            width: { size: 4, type: WidthType.PERCENTAGE },
            borders: cellBorderThin,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(idx + 1), size: 16, bold: true })],
              }),
            ],
          }),
          // 2. Tanggal & Jam
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            borders: cellBorderThin,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: dateStr, size: 16, bold: true }),
                  new TextRun({ text: `\n${timeStr}`, size: 14, color: '64748B' }),
                ],
              }),
            ],
          }),
          // 3. No Tiket / Insiden
          new TableCell({
            width: { size: 16, type: WidthType.PERCENTAGE },
            borders: cellBorderThin,
            children: [
              new Paragraph({
                children: [new TextRun({ text: ticketStr, size: 16, bold: true, color: '0F172A' })],
              }),
            ],
          }),
          // 4. Perangkat & Lokasi
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            borders: cellBorderThin,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: equipLocStr, size: 16, color: '1E293B' }),
                ],
              }),
            ],
          }),
          // 5. Uraian Masalah & Perbaikan
          new TableCell({
            width: { size: 26, type: WidthType.PERCENTAGE },
            borders: cellBorderThin,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: issueActionStr, size: 15, color: '334155' }),
                ],
              }),
            ],
          }),
          // 6. Status Trouble
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            borders: cellBorderThin,
            shading: { fill: isClosed ? 'F0FDF4' : 'FEFCE8', type: ShadingType.CLEAR },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: statusInfo.label,
                    size: 15,
                    bold: true,
                    color: isClosed ? '166534' : 'B45309',
                  }),
                  new TextRun({
                    text: `\n\n${statusInfo.note}`,
                    size: 13,
                    color: '475569',
                  }),
                ],
              }),
            ],
          }),
          // 7. Sparepart
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            borders: cellBorderThin,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: sparepartsStr, size: 14, color: '1E293B' }),
                ],
              }),
            ],
          }),
        ],
      });
    });

    const mainTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: tableHeaderCells }), ...dataRows],
    });

    // 3-Column Signatures
    const sigCellBorder = {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
    };

    const signatureTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: sigCellBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              borders: sigCellBorder,
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'PREPARED BY,', bold: true, size: 16 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              borders: sigCellBorder,
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'ACKNOWLEDGED BY,', bold: true, size: 16 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              borders: sigCellBorder,
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'APPROVED BY,', bold: true, size: 16 })],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              borders: sigCellBorder,
              children: [
                new Paragraph({ spacing: { before: 900, after: 100 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Arif Budiman', bold: true, size: 16 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PT Dwimitra Ekatama Mandiri', size: 14, color: '64748B' })] }),
              ],
            }),
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              borders: sigCellBorder,
              children: [
                new Paragraph({ spacing: { before: 900, after: 100 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Dwi Tasmiyadi', bold: true, size: 16 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Facility Manager (NeutraDC)', size: 14, color: '64748B' })] }),
              ],
            }),
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              borders: sigCellBorder,
              children: [
                new Paragraph({ spacing: { before: 900, after: 100 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Budi Susanto', bold: true, size: 16 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Assistant Manager HDC (NeutraDC)', size: 14, color: '64748B' })] }),
              ],
            }),
          ],
        }),
      ],
    });

    // ========================================================================
    // LAMPIRAN FOTO CM DI WORD (Section / Halaman Terpisah dengan PageBreak)
    // ========================================================================
    const wordReportsWithPhotos = await resolveReportsWithPhotos(reports);
    const photoSectionChildren: (Paragraph | Table)[] = [
      new Paragraph({
        pageBreakBefore: true,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: 'LAMPIRAN DOKUMENTASI FOTO PEKERJAAN',
            bold: true,
            size: 24,
            color: NAVY_BLUE,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new TextRun({
            text: `CORRECTIVE MAINTENANCE (CM) — PERIODE: ${periodTitle.toUpperCase()}`,
            bold: true,
            size: 18,
            color: '334155',
          }),
        ],
      }),
    ];

    if (wordReportsWithPhotos.length === 0) {
      photoSectionChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [
            new TextRun({
              text: '(Tidak terdapat lampiran foto dokumentasi pada data laporan CM periode ini)',
              italics: true,
              size: 18,
              color: '64748B',
            }),
          ],
        })
      );
    } else {
      for (const item of wordReportsWithPhotos) {
        photoSectionChildren.push(
          new Paragraph({
            spacing: { before: 300, after: 100 },
            children: [
              new TextRun({
                text: `Laporan CM #${item.index} — No. Tiket: ${item.ticketStr}  |  Perangkat: ${item.equipLocStr}  |  Tanggal: ${item.dateStr}`,
                bold: true,
                size: 17,
                color: NAVY_BLUE,
              }),
            ],
          })
        );

        const photoTableRows: TableRow[] = [];
        for (let pIdx = 0; pIdx < item.photos.length; pIdx += 2) {
          const p1 = item.photos[pIdx];
          const p2 = item.photos[pIdx + 1];

          const p1Bytes = base64ToUint8Array(p1.base64);
          const p2Bytes = p2 ? base64ToUint8Array(p2.base64) : null;

          const imgRowCells: TableCell[] = [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: cellBorderThin,
              children: p1Bytes.length > 0 ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 80, after: 80 },
                  children: [
                    new ImageRun({
                      data: p1Bytes,
                      transformation: { width: 320, height: 210 },
                      type: 'jpg',
                    }),
                  ],
                }),
              ] : [new Paragraph('')],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: cellBorderThin,
              children: (p2Bytes && p2Bytes.length > 0) ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 80, after: 80 },
                  children: [
                    new ImageRun({
                      data: p2Bytes,
                      transformation: { width: 320, height: 210 },
                      type: 'jpg',
                    }),
                  ],
                }),
              ] : [new Paragraph('')],
            }),
          ];

          const capRowCells: TableCell[] = [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: cellBorderThin,
              shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 50, after: 50 },
                  children: [
                    new TextRun({
                      text: `Foto ${pIdx + 1}: ${p1.description || 'Dokumentasi perbaikan CM'}`,
                      italics: true,
                      size: 15,
                      color: '334155',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: cellBorderThin,
              shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
              children: p2 ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 50, after: 50 },
                  children: [
                    new TextRun({
                      text: `Foto ${pIdx + 2}: ${p2.description || 'Dokumentasi perbaikan CM'}`,
                      italics: true,
                      size: 15,
                      color: '334155',
                    }),
                  ],
                }),
              ] : [new Paragraph('')],
            }),
          ];

          photoTableRows.push(new TableRow({ children: imgRowCells }));
          photoTableRows.push(new TableRow({ children: capRowCells }));
        }

        photoSectionChildren.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: photoTableRows,
          })
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                orientation: PageOrientation.LANDSCAPE,
                width: 16838, // A4 Landscape DXA
                height: 11906,
              },
              margin: {
                top: 720,
                bottom: 720,
                left: 720,
                right: 720,
              },
            },
          },
          headers: {
            default: new Header({
              children: [new Paragraph('')],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: 'PT Dwimitra Ekatama Mandiri — Rekapitulasi Laporan CM  |  Halaman ', size: 14, color: '64748B' }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '64748B' }),
                  ],
                }),
              ],
            }),
          },
          children: [
            headerTable,
            new Paragraph({ spacing: { before: 200 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'BERITA ACARA & REKAPITULASI LAPORAN CORRECTIVE MAINTENANCE (CM)',
                  bold: true,
                  size: 24,
                  color: NAVY_BLUE,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 150 },
              children: [
                new TextRun({
                  text: `Periode Rekapitulasi: ${periodTitle}`,
                  bold: true,
                  size: 18,
                  color: '475569',
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 180 },
              children: [
                new TextRun({
                  text: `Ringkasan Statistik:  Total CM: ${totalCM} Dokumen  |  Solved (Closed): ${closedCount}  |  Pending (Open): ${openCount}  |  Pergantian Sparepart: ${sparepartCount}  |  Non-Sparepart: ${nonSparepartCount}`,
                  size: 16,
                  color: '1E293B',
                  bold: true,
                }),
              ],
            }),
            mainTable,
            new Paragraph({ spacing: { before: 300 } }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'LEMBAR PENGESAHAN REKAPITULASI CORRECTIVE MAINTENANCE',
                  bold: true,
                  size: 18,
                  color: NAVY_BLUE,
                }),
              ],
            }),
            new Paragraph({ spacing: { before: 100 } }),
            signatureTable,
            ...photoSectionChildren,
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const cleanPeriod = periodTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Rekap_CM_${cleanPeriod}_${new Date().toISOString().split('T')[0]}.docx`;

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

  const toastId = toast.loading('Membuat Dokumen PDF Rekap CM...');

  try {
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageWidth - 2 * margin;

    const BLUE_RGB: [number, number, number] = [0, 89, 156];
    const DARK = '#1e293b';
    const GRAY = '#64748b';

    const [leftLogo, rightLogo] = await Promise.all([
      loadLogoBase64(logoDwimitra),
      loadLogoBase64(logoNeutraDC),
    ]);

    const headerTopY = 4.5;
    const headerH = 22;
    const tableStartY = headerTopY + headerH + 3.5;

    const totalCM = reports.length;
    const closedCount = reports.filter(r => getTroubleStatusInfo(r).isClosed).length;
    const openCount = totalCM - closedCount;
    const sparepartCount = reports.filter(r => isCMSparepart(r)).length;
    const nonSparepartCount = totalCM - sparepartCount;
    const todayPrint = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const drawHeader = (currentDoc: jsPDF) => {
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
        currentDoc.addImage(leftLogo, 'PNG', margin + 2.5, headerTopY + 3.5, col1W - 5, 15, 'logo_dme', 'FAST');
      }
      if (rightLogo) {
        currentDoc.addImage(rightLogo, 'PNG', pageWidth - margin - col3W + 2.5, headerTopY + 4, col3W - 5, 14, 'logo_neutra', 'FAST');
      }

      const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
      currentDoc.setFontSize(10.5).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      currentDoc.text('REKAPITULASI LAPORAN CORRECTIVE MAINTENANCE (CM)', centerX, headerTopY + 6.5, { align: 'center' });

      currentDoc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(DARK);
      currentDoc.text(`PT DWIMITRA EKATAMA MANDIRI — NEUTRA DC CIKARANG (Periode: ${periodTitle})`, centerX, headerTopY + 11.5, { align: 'center' });

      currentDoc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY);
      currentDoc.text(
        `Total CM: ${totalCM}  |  Solved (Closed): ${closedCount}  |  Pending (Open): ${openCount}  |  Sparepart: ${sparepartCount}  |  Non-Sparepart: ${nonSparepartCount}  |  Cetak: ${todayPrint}`,
        centerX,
        headerTopY + 16.8,
        { align: 'center' }
      );
    };

    const drawFooter = (currentDoc: jsPDF, pg: number, totalPages: number) => {
      currentDoc.setFillColor(...BLUE_RGB);
      currentDoc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');
      currentDoc.setFontSize(6.5).setTextColor(GRAY);
      currentDoc.text('PT DWIMITRA EKATAMA MANDIRI — Corrective Maintenance Recap Report', margin, pageHeight - 4.5);
      currentDoc.text(`Halaman ${pg} dari ${totalPages}`, pageWidth - margin, pageHeight - 4.5, { align: 'right' });
    };

    drawHeader(doc);

    // Build Table Rows
    const tableRows = reports.map((r, idx) => {
      const statusInfo = getTroubleStatusInfo(r);
      const isSp = isCMSparepart(r);

      const dateText = formatReportDate(r);
      const timeText = formatReportTime(r);
      const ticketText = `${r.incidentName || r.ticketName || r.ticketNumber || `CM-${idx + 1}`}\nPerangkat: ${r.equipmentName || r.equipment || '-'}\nLokasi: ${r.location || r.area || '-'}`;
      
      const issueActionText = `Masalah:\n${r.issue || r.problemAnalysis || r.problem || '-'}\n\nSolusi:\n${r.correctiveAction || r.actionTaken || '-'}`;
      
      const statusText = `${statusInfo.label}\n\nCatatan:\n${statusInfo.note}`;
      const spText = `${isSp ? '[SPAREPART]\n' : '[NON-SP]\n'}${getSparepartsSummary(r)}`;
      const picText = `DME: ${r.picDME || r.preparedByName || '-'}\nNeutra: ${r.picTDE || r.acknowledgedBy1Name || '-'}`;

      return [
        String(idx + 1),
        timeText !== '-' ? `${dateText}\n${timeText}` : dateText,
        ticketText,
        issueActionText,
        statusText,
        spText,
        picText,
      ];
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [[
        'No',
        'Tanggal & Jam',
        'No Tiket & Perangkat',
        'Uraian Masalah & Tindakan Perbaikan',
        'Status Trouble',
        'Sparepart Terpakai',
        'Pelaksana (PIC)'
      ]],
      body: tableRows,
      margin: { top: tableStartY, left: margin, right: margin, bottom: 10 },
      styles: {
        fontSize: 6.8,
        cellPadding: 1.8,
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
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'center', cellWidth: 24 },
        2: { cellWidth: 50 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 42 },
        5: { cellWidth: 40 },
        6: { cellWidth: 32 },
      },
      didDrawPage: (data: any) => {
        if (data.pageNumber > 1) {
          drawHeader(doc);
        }
      },
    });

    // ========================================================================
    // LAMPIRAN FOTO CM DI PDF (Halaman-halaman Terpisah)
    // ========================================================================
    const pdfReportsWithPhotos = await resolveReportsWithPhotos(reports);

    interface FlatPdfPhoto {
      reportIndex: number;
      ticketStr: string;
      equipLocStr: string;
      dateStr: string;
      base64: string;
      description: string;
      photoIndex: number;
      totalPhotosForReport: number;
    }

    const flatPhotos: FlatPdfPhoto[] = [];
    pdfReportsWithPhotos.forEach((item) => {
      item.photos.forEach((p, idx) => {
        flatPhotos.push({
          reportIndex: item.index,
          ticketStr: item.ticketStr,
          equipLocStr: item.equipLocStr,
          dateStr: item.dateStr,
          base64: p.base64,
          description: p.description,
          photoIndex: idx + 1,
          totalPhotosForReport: item.photos.length,
        });
      });
    });

    // Add Photo Documentation Page(s)
    doc.addPage('a4', 'landscape');
    const photoPageCenterX = pageWidth / 2;

    const drawPhotoPageHeader = (currentDoc: jsPDF) => {
      currentDoc.setFillColor(...BLUE_RGB);
      currentDoc.rect(0, 0, pageWidth, 3.5, 'F');

      if (leftLogo) {
        currentDoc.addImage(leftLogo, 'PNG', margin, 5, 24, 8);
      }
      if (rightLogo) {
        currentDoc.addImage(rightLogo, 'PNG', pageWidth - margin - 22, 5, 22, 8);
      }

      currentDoc.setFontSize(10.5).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      currentDoc.text('LAMPIRAN DOKUMENTASI FOTO CORRECTIVE MAINTENANCE (CM)', photoPageCenterX, 9, { align: 'center' });

      currentDoc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(DARK);
      currentDoc.text(`PT DWIMITRA EKATAMA MANDIRI — NEUTRA DC CIKARANG (Periode: ${periodTitle})`, photoPageCenterX, 13.5, { align: 'center' });

      currentDoc.setDrawColor(203, 213, 225);
      currentDoc.setLineWidth(0.2);
      currentDoc.line(margin, 16.5, pageWidth - margin, 16.5);
    };

    drawPhotoPageHeader(doc);

    if (flatPhotos.length === 0) {
      doc.setFontSize(10).setFont('helvetica', 'italic').setTextColor(GRAY);
      doc.text('(Tidak terdapat lampiran foto dokumentasi pada data laporan CM periode ini)', photoPageCenterX, 80, { align: 'center' });
    } else {
      const photosPerPage = 4;
      const cardW = 132;
      const cardH = 82;
      const gapX = 7;
      const gapY = 6;
      const startX = margin;
      const startY = 20;

      flatPhotos.forEach((photo, idx) => {
        const slotIdx = idx % photosPerPage;

        if (idx > 0 && slotIdx === 0) {
          doc.addPage('a4', 'landscape');
          drawPhotoPageHeader(doc);
        }

        const col = slotIdx % 2;
        const row = Math.floor(slotIdx / 2);

        const cardX = startX + col * (cardW + gapX);
        const cardY = startY + row * (cardH + gapY);

        // Card container border & fill
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.roundedRect(cardX, cardY, cardW, cardH, 1.5, 1.5, 'FD');

        // Card Header Bar (Ticket & Equipment)
        doc.setFillColor(...BLUE_RGB);
        doc.roundedRect(cardX, cardY, cardW, 6.5, 1.5, 1.5, 'F');
        doc.rect(cardX, cardY + 3, cardW, 3.5, 'F'); // square bottom corners
        doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
        const headerText = `[CM #${photo.reportIndex}] ${photo.ticketStr} | ${photo.equipLocStr}`;
        doc.text(headerText.length > 58 ? headerText.substring(0, 56) + '...' : headerText, cardX + 3, cardY + 4.5);

        // Photo Image Box
        const imgX = cardX + 2.5;
        const imgY = cardY + 8;
        const imgW = cardW - 5;
        const imgH = 58;

        doc.setFillColor(255, 255, 255);
        doc.rect(imgX, imgY, imgW, imgH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(imgX, imgY, imgW, imgH, 'S');

        try {
          doc.addImage(photo.base64, 'JPEG', imgX, imgY, imgW, imgH, undefined, 'FAST');
        } catch (imgErr) {
          console.warn('Gagal render foto di PDF:', imgErr);
        }

        // Caption Bar
        doc.setFontSize(6.5).setFont('helvetica', 'italic').setTextColor(DARK);
        const capText = `Foto ${photo.photoIndex}/${photo.totalPhotosForReport}: ${photo.description || 'Dokumentasi perbaikan CM'}`;
        const splitCap = doc.splitTextToSize(capText, cardW - 6);
        doc.text(splitCap, cardX + 3, cardY + 70);
      });
    }

    // Add Footers to all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter(doc, p, totalPages);
    }

    const cleanPeriod = periodTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Rekap_CM_${cleanPeriod}_${new Date().toISOString().split('T')[0]}.pdf`;

    doc.save(fileName);
    toast.success('PDF Rekap CM berhasil diunduh!', { id: toastId });
  } catch (err: any) {
    console.error('Error exporting CM recap to PDF:', err);
    toast.error(`Gagal membuat PDF Rekap CM: ${err?.message || err}`, { id: toastId });
  }
}
