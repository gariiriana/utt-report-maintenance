// ============================================================================
// FILE: frontend/utils/PmPredictivePdfExport.ts
// Deskripsi: PDF resmi Predictive Report dari laporan Preventive Maintenance.
//            - Satu unit: identitas & nameplate, ringkasan eksekutif, satu bagian
//              per equipment (tabel parameter + narasi + foto dokumentasi), dasar
//              batas acuan, dan lembar pengesahan (format sama dengan Predictive CM).
//            - Gabungan satu quarter: ringkasan periode, satu bab per unit (halaman
//              baru), satu dasar batas acuan, dan satu lembar pengesahan.
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';
import { toast } from 'sonner';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import type { PmPredictiveReport, PmStatus } from '@/types/pmPredictiveTypes';
import { loadPmSourcePhotos, type PmSourcePhoto } from '@/utils/pmPredictiveService';
import { STATUS_LABEL, effectiveStatus, fmtDate } from '@/utils/pmPredictiveEngine';
import {
  METHOD_TEXT, nameplateText, paramRowText, exportParams, hasComparison, exportStatusText, sectionStatusLines,
  limitSourceRows, attentionText, collectPmExportPhotos, countExportPhotos, safeFileName, sortBundleReports,
  type PmExportPhoto, type PmExportPhotos, type PmBundleEntry, type PmBundlePeriod,
} from '@/utils/pmPredictiveExportShared';

type RGB = [number, number, number];

const STATUS_COLOR: Record<PmStatus, RGB> = {
  normal: [21, 128, 61],
  watch: [180, 83, 9],
  warning: [194, 65, 12],
  alarm: [185, 28, 28],
  unknown: [100, 116, 139],
};

const STATUS_FILL: Record<PmStatus, RGB> = {
  normal: [220, 252, 231],
  watch: [254, 243, 199],
  warning: [255, 237, 213],
  alarm: [254, 226, 226],
  unknown: [241, 245, 249],
};

const PRIMARY: RGB = [0, 89, 156];
const MARGIN = 12;
const HEADER_TOP = 10;
const HEADER_DIVIDER_Y = 30;
const CONTENT_START_Y = 36;

async function loadImageBase64(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        }
        resolve(ctx ? canvas.toDataURL('image/png') : '');
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

/** Font standar jsPDF (WinAnsi) tidak punya ≤, ≥, Δ, dan tanda kutip miring. */
function t(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/Δ/g, 'd')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/(?:&«|[⚫▪►▶⁃●◆])/g, '•');
}

const statusCell = (status: PmStatus, text: string) => ({
  content: t(text),
  styles: { textColor: STATUS_COLOR[status], fillColor: STATUS_FILL[status], fontStyle: 'bold' as const },
});

/** Kursor halaman + helper gambar bersama untuk dokumen satu unit dan gabungan. */
class PdfWriter {
  readonly doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  readonly pageW = this.doc.internal.pageSize.getWidth();
  readonly pageH = this.doc.internal.pageSize.getHeight();
  readonly contentW = this.pageW - 2 * MARGIN;
  readonly bottomLimit = this.pageH - 14;
  y = CONTENT_START_Y;

  constructor(private logos: { dme: string; ndc: string }) {}

  ensureSpace(needed: number) {
    if (this.y > this.pageH - needed) this.newPage();
  }

  newPage() {
    this.doc.addPage();
    this.y = CONTENT_START_Y;
  }

  table(options: UserOptions, gap = 3) {
    autoTable(this.doc, {
      startY: this.y,
      margin: { top: CONTENT_START_Y, left: MARGIN, right: MARGIN, bottom: 14 },
      theme: 'grid',
      rowPageBreak: 'avoid',
      ...options,
      styles: { fontSize: 8, cellPadding: 2, textColor: [15, 23, 42], font: 'helvetica', ...options.styles },
    });
    this.y = (this.doc as any).lastAutoTable.finalY + gap;
  }

  /** "1. JUDUL" untuk bab, "2.1 JUDUL" untuk sub-bab. */
  sectionTitle(num: string, title: string, minSpace = 30) {
    this.ensureSpace(minSpace);
    const prefix = num.includes('.') ? `${num} ` : `${num}. `;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(153, 27, 27);
    this.doc.text(prefix, MARGIN, this.y);
    this.doc.setTextColor(...PRIMARY);
    this.doc.text(t(title.toUpperCase()), MARGIN + this.doc.getTextWidth(prefix) + 1, this.y);
    this.y += 4;
  }

  paragraph(text: string, size = 7.5, color: RGB = [71, 85, 105]) {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
    const lines = this.doc.splitTextToSize(t(text), this.contentW);
    this.ensureSpace(lines.length * 3.4 + 16);
    this.doc.text(lines, MARGIN, this.y + 2);
    this.y += lines.length * 3.4 + 4;
  }

  /** Pita judul bab unit pada laporan gabungan. */
  chapterBand(num: string, title: string, right: string) {
    this.doc.setFillColor(...PRIMARY);
    this.doc.roundedRect(MARGIN, this.y - 5, this.contentW, 9, 1.5, 1.5, 'F');
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10.5);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text(t(`${num}. ${title}`), MARGIN + 3, this.y + 0.9);
    this.doc.setFontSize(8);
    this.doc.text(t(right), this.pageW - MARGIN - 3, this.y + 0.9, { align: 'right' });
    this.y += 9;
  }

  /** Grid foto 3 kolom dengan keterangan; baris yang tidak muat pindah ke halaman baru. */
  photoGrid(title: string, items: PmExportPhoto[]) {
    if (!items.length) return;
    const doc = this.doc;
    const cols = 3;
    const gap = 4;
    const cellW = (this.contentW - gap * (cols - 1)) / cols;
    const imgH = cellW * 0.75;
    const capH = 7;
    const rowH = imgH + capH + 2;
    this.ensureSpace(rowH + 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(t(title), MARGIN, this.y);
    this.y += 2.5;
    let rowY = this.y;
    items.forEach((p, i) => {
      const col = i % cols;
      if (col === 0) {
        if (i > 0) rowY += rowH;
        if (rowY + rowH > this.bottomLimit) {
          doc.addPage();
          rowY = CONTENT_START_Y;
        }
      }
      const x = MARGIN + col * (cellW + gap);
      const ratio = Math.min(cellW / p.width, imgH / p.height);
      const w = p.width * ratio;
      const h = p.height * ratio;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.rect(x, rowY, cellW, imgH, 'FD');
      doc.addImage(p.dataUrl, 'JPEG', x + (cellW - w) / 2, rowY + (imgH - h) / 2, w, h, `pm-photo-${p.key}`, 'FAST');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
      doc.text(doc.splitTextToSize(t(p.caption), cellW).slice(0, 2), x, rowY + imgH + 3);
    });
    this.y = rowY + rowH + 3;
  }

  /** Kop surat & nomor halaman di setiap halaman, ditulis setelah isi selesai. */
  finish(headerLine: string, footerLabel: string) {
    const doc = this.doc;
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      if (this.logos.dme) doc.addImage(this.logos.dme, 'PNG', MARGIN, HEADER_TOP, 32, 13);
      if (this.logos.ndc) doc.addImage(this.logos.ndc, 'PNG', this.pageW - MARGIN - 32, HEADER_TOP, 32, 13);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('PT DWIMITRA EKATAMA MANDIRI', this.pageW / 2, HEADER_TOP + 3.5, { align: 'center' });
      doc.setFontSize(12);
      doc.setTextColor(153, 27, 27);
      doc.text('PREDICTIVE MAINTENANCE REPORT', this.pageW / 2, HEADER_TOP + 8.5, { align: 'center' });
      doc.setFontSize(9);
      doc.setTextColor(...PRIMARY);
      doc.text('DATA CENTER NEUTRA DC CIKARANG', this.pageW / 2, HEADER_TOP + 13, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(t(headerLine), this.pageW / 2, HEADER_TOP + 17, { align: 'center' });
      doc.setDrawColor(...PRIMARY);
      doc.setLineWidth(0.8);
      doc.line(MARGIN, HEADER_DIVIDER_Y, this.pageW - MARGIN, HEADER_DIVIDER_Y);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(t(`${footerLabel}  |  Hal ${i} dari ${total}`), this.pageW - MARGIN, this.pageH - 6, { align: 'right' });
    }
  }
}

async function createWriter(): Promise<PdfWriter> {
  const [dme, ndc] = await Promise.all([loadImageBase64(logoDwimitra), loadImageBase64(logoNeutraDC)]);
  return new PdfWriter({ dme, ndc });
}

async function exportPhotosOf(report: PmPredictiveReport, loaded?: PmSourcePhoto[]): Promise<PmExportPhotos> {
  let source = loaded && loaded.length ? loaded : [];
  if (!source.length) {
    source = await loadPmSourcePhotos(report.sourceDocId, report.sourceCollection).catch(err => {
      console.warn('Foto laporan PM tidak bisa dimuat untuk ekspor:', err);
      return [] as PmSourcePhoto[];
    });
  }
  return collectPmExportPhotos(report, source);
}

const label = (content: string) => ({ content: t(content), styles: { fontStyle: 'bold' as const, fillColor: [248, 250, 252] as RGB } });

/** Identitas, ringkasan, dan analisis per equipment satu unit. */
function renderReportBody(w: PdfWriter, report: PmPredictiveReport, photos: PmExportPhotos, nums: { identity: string; summary: string; analysis: string }) {
  const doc = w.doc;

  w.sectionTitle(nums.identity, 'Identitas Unit & Laporan PM', 35);
  w.table({
    columnStyles: { 0: { cellWidth: 34 }, 2: { cellWidth: 34 } },
    body: [
      [label('Nama Unit'), { content: t(report.unitLabel), styles: { fontStyle: 'bold' } }, label('Jenis Unit'), t(report.unitType)],
      [label('Laporan PM'), t(report.maintenanceName), label('Tanggal PM'), t(fmtDate(report.maintenanceDate))],
      [label('Nameplate'), { content: t(nameplateText(report)), colSpan: 3 }],
    ],
  });
  w.photoGrid('Foto nameplate', photos.nameplate);
  w.y += 2;

  w.sectionTitle(nums.summary, 'Ringkasan Eksekutif', 40);
  const overall = report.overallStatus;
  w.table({
    styles: { cellPadding: 2.2 },
    columnStyles: { 0: { cellWidth: 45 } },
    body: [
      [label('Status Keseluruhan'), statusCell(overall, exportStatusText(overall).toUpperCase())],
      [label('Status per Equipment'), t(sectionStatusLines(report))],
      [label('Ringkasan'), t(report.summary.ringkasan || '-')],
      [label('Prioritas Tindakan'), t(report.summary.prioritas.filter(p => p.trim()).map((p, i) => `${i + 1}. ${p}`).join('\n') || '-')],
    ],
  }, 7);

  w.sectionTitle(nums.analysis, 'Analisis Prediktif per Equipment', 50);
  const compare = hasComparison(report);
  report.sections.forEach((section, i) => {
    const status = effectiveStatus(section);
    w.ensureSpace(45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(t(`${nums.analysis}.${i + 1}  ${section.name}`), MARGIN, w.y);
    if (status !== 'unknown') {
      doc.setTextColor(...STATUS_COLOR[status]);
      doc.text(t(`Status: ${STATUS_LABEL[status]}`), w.pageW - MARGIN, w.y, { align: 'right' });
    }
    w.y += 1.5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const roleLines = doc.splitTextToSize(t(section.role), w.contentW);
    doc.text(roleLines, MARGIN, w.y + 3);
    w.y += roleLines.length * 3 + 3;

    const params = exportParams(section);
    if (params.length) {
      const rows = params.map(paramRowText);
      w.table({
        styles: { fontSize: 6.8, cellPadding: 1.4, valign: 'middle' },
        headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8 },
        columnStyles: compare
          ? { 0: { cellWidth: 34 }, 1: { cellWidth: 18, halign: 'center' }, 2: { cellWidth: 24, halign: 'center' }, 3: { cellWidth: 24, halign: 'center' }, 5: { cellWidth: 22, halign: 'center' } }
          : { 0: { cellWidth: 46 }, 1: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 24, halign: 'center' } },
        head: [compare ? ['Parameter', 'Nilai', 'Sebelumnya', 'Perubahan / Tren', 'Batas Acuan', 'Status'] : ['Parameter', 'Nilai', 'Batas Acuan', 'Status']],
        body: rows.map(row => compare
          ? [t(row.label), { content: t(row.value), styles: { fontStyle: 'bold' as const } }, t(row.previous), t(row.change), t(row.limit), statusCell(row.status, row.statusText)]
          : [t(row.label), { content: t(row.value), styles: { fontStyle: 'bold' as const } }, t(row.limit), statusCell(row.status, row.statusText)]),
      });
    }

    if (section.visuals.length) {
      w.table({
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 28 } },
        head: [['Observasi Visual', 'Kondisi', 'Keterangan']],
        body: section.visuals.map(v => [t(v.cardLabel), t(v.condition), t(v.observation || '-')]),
      });
    }

    w.table({
      styles: { fontSize: 7.5 },
      columnStyles: { 0: { cellWidth: 38 } },
      body: [
        [label('Kondisi Saat Ini'), t(section.narrative.kondisi || '-')],
        [label('Analisis Tren'), t(section.narrative.analisisTren || '-')],
        [label('Prediksi & Risiko'), t(section.narrative.prediksiRisiko || '-')],
        [label('Rekomendasi'), t(section.narrative.rekomendasi.filter(r => r.trim()).map((r, k) => `${k + 1}. ${r}`).join('\n') || '-')],
      ],
    }, 4);
    w.photoGrid(`Dokumentasi foto - ${section.name}`, photos.bySection[section.id] || []);
    w.y += 3;
  });
}

/** Dasar batas acuan & metode; false bila tidak ada parameter yang dicetak. */
function renderLimits(w: PdfWriter, reports: PmPredictiveReport[], num: string): boolean {
  const rows = limitSourceRows(reports);
  if (!rows.length) return false;
  w.sectionTitle(num, 'Dasar Batas Acuan & Metode', 40);
  w.table({
    styles: { fontSize: 6.8, cellPadding: 1.5 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 40 } },
    head: [['Parameter', 'Sumber / Dasar Batas Acuan']],
    body: rows.map(([labels, source]) => [t(labels), t(source)]),
  });
  w.paragraph(METHOD_TEXT, 7);
  w.y += 2;
  return true;
}

function renderSignatures(w: PdfWriter, sig: PmPredictiveReport['signatures'], num: string) {
  const APPROVAL_BLOCK_HEIGHT = 120;
  w.ensureSpace(APPROVAL_BLOCK_HEIGHT);
  w.sectionTitle(num, 'Lembar Pengesahan Resmi', APPROVAL_BLOCK_HEIGHT);
  const doc = w.doc;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(t(`AUTHOR BY, ${sig.authorName}`), MARGIN, w.y + 1);
  w.y += 5;
  const head = (content: string, colSpan = 1) => ({ content, colSpan, styles: { fontStyle: 'bold' as const, fillColor: [220, 230, 241] as RGB, textColor: [0, 0, 0] as RGB } });
  const signBox = (s: { name: string; title: string }, colSpan = 1) => ({ content: t(`\n\n\n${s.name}\n${s.title}`), colSpan });
  w.table({
    pageBreak: 'avoid',
    styles: { fontSize: 7.5, halign: 'center' },
    body: [
      [head('PREPARED BY,'), head('REVIEWED BY,')],
      [signBox(sig.preparedBy), signBox(sig.reviewedBy)],
      [head('ACKNOWLEDGED BY,', 2)],
      [signBox(sig.acknowledgedBy1), signBox(sig.acknowledgedBy2)],
      [head('APPROVED BY,', 2)],
      [signBox(sig.approvedBy, 2)],
    ],
  });
}

export async function exportPmPredictiveToPdf(report: PmPredictiveReport, loadedPhotos?: PmSourcePhoto[]): Promise<void> {
  const toastId = toast.loading('Membuat PDF Predictive Report...');
  try {
    const [w, photos] = await Promise.all([createWriter(), exportPhotosOf(report, loadedPhotos)]);
    renderReportBody(w, report, photos, { identity: '1', summary: '2', analysis: '3' });
    const hasLimits = renderLimits(w, [report], '4');
    renderSignatures(w, report.signatures, hasLimits ? '5' : '4');
    w.finish(`Berbasis PM ${fmtDate(report.maintenanceDate)}`, `Predictive Report PM — ${report.unitLabel}`);
    w.doc.save(`Predictive_Report_${safeFileName(report.unitLabel) || 'Unit'}_${report.maintenanceDate}.pdf`);
    toast.success(countExportPhotos(photos) ? 'PDF Predictive Report berhasil diunduh' : 'PDF diunduh tanpa foto (foto laporan PM tidak bisa dimuat)', { id: toastId });
  } catch (error: any) {
    console.error('exportPmPredictiveToPdf error:', error);
    toast.error(`Gagal membuat PDF: ${error?.message || 'error tidak diketahui'}`, { id: toastId });
  }
}

/** Satu PDF untuk seluruh predictive satu quarter: ringkasan periode lalu satu bab per unit. */
export async function exportPmPredictiveBundleToPdf(entries: PmBundleEntry[], period: PmBundlePeriod): Promise<void> {
  if (!entries.length) return;
  const toastId = toast.loading(`Membuat PDF gabungan ${period.label}...`);
  try {
    const sorted = sortBundleReports(entries);
    const reports = sorted.map(e => e.report);
    const w = await createWriter();

    w.sectionTitle('1', `Ringkasan Periode ${period.label}`, 40);
    w.paragraph(`Predictive maintenance report untuk ${reports.length} unit ${reports[0].unitType} berdasarkan hasil Preventive Maintenance periode ${period.label} (${period.months}). Rincian setiap unit disajikan pada bab berikutnya.`, 8, [15, 23, 42]);
    w.table({
      styles: { fontSize: 7.5, cellPadding: 1.8, valign: 'middle' },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 46 }, 2: { cellWidth: 26, halign: 'center' }, 3: { cellWidth: 28, halign: 'center' } },
      head: [['Bab', 'Unit', 'Tanggal PM', 'Status', 'Equipment Perlu Perhatian']],
      body: reports.map((r, k) => [
        String(k + 2),
        { content: t(r.unitLabel), styles: { fontStyle: 'bold' as const } },
        t(fmtDate(r.maintenanceDate)),
        statusCell(r.overallStatus, exportStatusText(r.overallStatus)),
        t(attentionText(r)),
      ]),
    });

    let photoTotal = 0;
    for (let k = 0; k < sorted.length; k++) {
      const { report, photos } = sorted[k];
      toast.loading(`Membuat PDF gabungan ${period.label} (${k + 1}/${sorted.length})...`, { id: toastId });
      const exportPhotos = await exportPhotosOf(report, photos);
      photoTotal += countExportPhotos(exportPhotos);
      const chapter = String(k + 2);
      w.newPage();
      w.chapterBand(chapter, report.unitLabel, `PM ${fmtDate(report.maintenanceDate)}`);
      renderReportBody(w, report, exportPhotos, { identity: `${chapter}.1`, summary: `${chapter}.2`, analysis: `${chapter}.3` });
    }

    w.newPage();
    const next = sorted.length + 2;
    const hasLimits = renderLimits(w, reports, String(next));
    renderSignatures(w, reports[0].signatures, String(hasLimits ? next + 1 : next));
    w.finish(`Periode ${period.label} (${period.months})`, `Predictive Report PM ${period.label}`);
    w.doc.save(`Predictive_Report_${safeFileName(reports[0].profileId.toUpperCase())}_${safeFileName(period.label)}.pdf`);
    toast.success(photoTotal ? `PDF gabungan ${period.label} (${reports.length} unit) berhasil diunduh` : 'PDF gabungan diunduh tanpa foto (foto laporan PM tidak bisa dimuat)', { id: toastId });
  } catch (error: any) {
    console.error('exportPmPredictiveBundleToPdf error:', error);
    toast.error(`Gagal membuat PDF gabungan: ${error?.message || 'error tidak diketahui'}`, { id: toastId });
  }
}
