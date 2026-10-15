// ============================================================================
// FILE: frontend/utils/PmPredictivePdfExport.ts
// Deskripsi: PDF resmi Predictive Report dari laporan Preventive Maintenance.
//            Satu dokumen untuk satu unit: identitas & nameplate, ringkasan
//            eksekutif, satu bagian per equipment (tabel parameter + tren +
//            proyeksi + narasi + foto dokumentasi), lampiran dasar batas acuan,
//            dan lembar pengesahan (format sama dengan Predictive Report CM).
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import type { PmPredictiveReport, PmStatus } from '@/types/pmPredictiveTypes';
import type { PmSourcePhoto } from '@/utils/pmPredictiveService';
import { STATUS_LABEL, effectiveStatus, fmtDate } from '@/utils/pmPredictiveEngine';
import {
  METHOD_TEXT, nameplateText, paramRowText, limitSourceRows, excludedEquipmentNames,
  collectPmExportPhotos, safeFileName, type PmExportPhoto,
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

export async function exportPmPredictiveToPdf(report: PmPredictiveReport, loadedPhotos?: PmSourcePhoto[]): Promise<void> {
  const toastId = toast.loading('Membuat PDF Predictive Report...');
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentW = pageW - 2 * margin;
    const HEADER_TOP = 10;
    const HEADER_DIVIDER_Y = 30;
    const CONTENT_START_Y = 36;
    const BOTTOM_LIMIT = pageH - 14;
    const tableMargin = { top: CONTENT_START_Y, left: margin, right: margin, bottom: 14 };

    const [logoDme, logoNdc, photos] = await Promise.all([
      loadImageBase64(logoDwimitra),
      loadImageBase64(logoNeutraDC),
      collectPmExportPhotos(report, loadedPhotos),
    ]);

    const drawHeader = () => {
      if (logoDme) doc.addImage(logoDme, 'PNG', margin, HEADER_TOP, 32, 13);
      if (logoNdc) doc.addImage(logoNdc, 'PNG', pageW - margin - 32, HEADER_TOP, 32, 13);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('PT DWIMITRA EKATAMA MANDIRI', pageW / 2, HEADER_TOP + 3.5, { align: 'center' });
      doc.setFontSize(12);
      doc.setTextColor(153, 27, 27);
      doc.text('PREDICTIVE MAINTENANCE REPORT', pageW / 2, HEADER_TOP + 8.5, { align: 'center' });
      doc.setFontSize(9);
      doc.setTextColor(0, 89, 156);
      doc.text('DATA CENTER NEUTRA DC CIKARANG', pageW / 2, HEADER_TOP + 13, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(t(`No: ${report.reportNumber}  |  Berbasis PM ${fmtDate(report.maintenanceDate)}`), pageW / 2, HEADER_TOP + 17, { align: 'center' });
      doc.setDrawColor(0, 89, 156);
      doc.setLineWidth(0.8);
      doc.line(margin, HEADER_DIVIDER_Y, pageW - margin, HEADER_DIVIDER_Y);
    };

    let y = CONTENT_START_Y;
    const ensureSpace = (needed: number) => {
      if (y > pageH - needed) {
        doc.addPage();
        y = CONTENT_START_Y;
      }
    };
    const sectionTitle = (num: string, title: string, minSpace = 30) => {
      ensureSpace(minSpace);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(153, 27, 27);
      doc.text(`${num}. `, margin, y);
      doc.setTextColor(0, 89, 156);
      doc.text(t(title.toUpperCase()), margin + 6, y);
      y += 4;
    };
    const afterTable = (gap = 5) => {
      y = (doc as any).lastAutoTable.finalY + gap;
    };
    const label = (content: string) => ({ content: t(content), styles: { fontStyle: 'bold' as const, fillColor: [248, 250, 252] as RGB } });

    /** Grid foto 3 kolom dengan keterangan; baris yang tidak muat pindah ke halaman baru. */
    const drawPhotoGrid = (title: string, items: PmExportPhoto[]) => {
      if (!items.length) return;
      const cols = 3;
      const gap = 4;
      const cellW = (contentW - gap * (cols - 1)) / cols;
      const imgH = cellW * 0.75;
      const capH = 7;
      const rowH = imgH + capH + 2;
      ensureSpace(rowH + 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(t(title), margin, y);
      y += 2.5;
      let rowY = y;
      items.forEach((p, i) => {
        const col = i % cols;
        if (col === 0) {
          if (i > 0) rowY += rowH;
          if (rowY + rowH > BOTTOM_LIMIT) {
            doc.addPage();
            rowY = CONTENT_START_Y;
          }
        }
        const x = margin + col * (cellW + gap);
        const ratio = Math.min(cellW / p.width, imgH / p.height);
        const w = p.width * ratio;
        const h = p.height * ratio;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.rect(x, rowY, cellW, imgH, 'FD');
        doc.addImage(p.dataUrl, 'JPEG', x + (cellW - w) / 2, rowY + (imgH - h) / 2, w, h, `pm-photo-${p.index}`, 'FAST');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(15, 23, 42);
        const lines = doc.splitTextToSize(t(`#${p.index}  ${p.caption}`), cellW).slice(0, 2);
        doc.text(lines, x, rowY + imgH + 3);
      });
      y = rowY + rowH + 3;
    };

    // ─── 1. Identitas ───────────────────────────────────────────────────────
    sectionTitle('1', 'Identitas Unit & Dokumen Asal', 35);
    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { fontSize: 8, cellPadding: 2, textColor: [15, 23, 42], font: 'helvetica' },
      columnStyles: { 0: { cellWidth: 34 }, 2: { cellWidth: 34 } },
      body: [
        [label('Nama Unit'), { content: t(report.unitLabel), styles: { fontStyle: 'bold' } }, label('Jenis Unit'), t(report.unitType)],
        [label('Laporan PM Asal'), t(report.maintenanceName), label('Tanggal PM'), t(fmtDate(report.maintenanceDate))],
        [label('Akun Unit'), t(report.account), label('Predictive Sebelumnya'), t(report.previousMaintenanceDate ? `PM ${fmtDate(report.previousMaintenanceDate)}` : 'Belum ada (baseline)')],
        [label('Nameplate'), { content: t(nameplateText(report)), colSpan: 3 }],
      ],
    });
    afterTable(3);
    drawPhotoGrid('Foto nameplate', photos.nameplate);
    y += 2;

    // ─── 2. Ringkasan eksekutif ─────────────────────────────────────────────
    sectionTitle('2', 'Ringkasan Eksekutif', 40);
    const overall = report.overallStatus;
    const excluded = excludedEquipmentNames(report);
    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { fontSize: 8, cellPadding: 2.2, textColor: [15, 23, 42], font: 'helvetica' },
      columnStyles: { 0: { cellWidth: 45 } },
      body: [
        [label('Status Keseluruhan'), { content: t(STATUS_LABEL[overall]).toUpperCase(), styles: { fontStyle: 'bold', textColor: STATUS_COLOR[overall], fillColor: STATUS_FILL[overall] } }],
        [label('Status per Equipment'), t(report.sections.map(s => `${s.name}: ${STATUS_LABEL[effectiveStatus(s)]}`).join('\n'))],
        ...(excluded.length ? [[label('Tidak Dianalisis'), t(`${excluded.join(', ')} (dikecualikan oleh engineer)`)]] : []),
        [label('Ringkasan'), t(report.summary.ringkasan)],
        [label('Prioritas Tindakan'), t(report.summary.prioritas.map((p, i) => `${i + 1}. ${p}`).join('\n') || '-')],
      ],
    });
    afterTable(7);

    // ─── 3. Analisis per equipment ──────────────────────────────────────────
    sectionTitle('3', 'Analisis Prediktif per Equipment', 50);
    report.sections.forEach((section, i) => {
      const status = effectiveStatus(section);
      ensureSpace(45);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(t(`3.${i + 1}  ${section.name}`), margin, y);
      doc.setTextColor(...STATUS_COLOR[status]);
      doc.text(t(`Status: ${STATUS_LABEL[status]}`), pageW - margin, y, { align: 'right' });
      y += 1.5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      const roleLines = doc.splitTextToSize(t(section.role), contentW);
      doc.text(roleLines, margin, y + 3);
      y += roleLines.length * 3 + 3;

      if (section.params.length) {
        autoTable(doc, {
          startY: y,
          margin: tableMargin,
          theme: 'grid',
          rowPageBreak: 'avoid',
          styles: { fontSize: 6.8, cellPadding: 1.4, textColor: [15, 23, 42], font: 'helvetica', valign: 'middle' },
          headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8 },
          columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 17, halign: 'center' }, 2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 22, halign: 'center' }, 4: { cellWidth: 40 }, 5: { cellWidth: 18, halign: 'center' } },
          head: [['Parameter', 'Nilai', 'Sebelumnya', 'Perubahan / Tren', 'Batas Acuan', 'Status', 'Proyeksi']],
          body: section.params.map(p => {
            const row = paramRowText(p);
            return [
              t(row.label),
              { content: t(row.value), styles: { fontStyle: 'bold' as const } },
              t(row.previous),
              t(row.change),
              t(row.limit),
              { content: t(row.statusText), styles: { textColor: STATUS_COLOR[row.status], fillColor: STATUS_FILL[row.status], fontStyle: 'bold' as const } },
              t(row.projection),
            ];
          }),
        });
        afterTable(3);
      }

      if (section.visuals.length) {
        autoTable(doc, {
          startY: y,
          margin: tableMargin,
          theme: 'grid',
          rowPageBreak: 'avoid',
          styles: { fontSize: 7, cellPadding: 1.5, textColor: [15, 23, 42], font: 'helvetica' },
          headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
          columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 28 } },
          head: [['Observasi Visual', 'Kondisi', 'Keterangan']],
          body: section.visuals.map(v => [t(v.cardLabel), t(v.condition), t(v.observation || '-')]),
        });
        afterTable(3);
      }

      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        theme: 'grid',
        rowPageBreak: 'avoid',
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42], font: 'helvetica' },
        columnStyles: { 0: { cellWidth: 38 } },
        body: [
          [label('Kondisi Saat Ini'), t(section.narrative.kondisi || '-')],
          [label('Analisis Tren'), t(section.narrative.analisisTren || '-')],
          [label('Prediksi & Risiko'), t(section.narrative.prediksiRisiko || '-')],
          [label('Rekomendasi'), t(section.narrative.rekomendasi.filter(r => r.trim()).map((r, k) => `${k + 1}. ${r}`).join('\n') || '-')],
        ],
      });
      afterTable(4);
      drawPhotoGrid(`Dokumentasi foto - ${section.name}`, photos.bySection[section.id] || []);
      y += 3;
    });

    // ─── 4. Dasar batas acuan & metode ──────────────────────────────────────
    const sourceRows = limitSourceRows(report);
    if (sourceRows.length) {
      sectionTitle('4', 'Dasar Batas Acuan & Metode', 40);
      autoTable(doc, {
        startY: y,
        margin: tableMargin,
        theme: 'grid',
        rowPageBreak: 'avoid',
        styles: { fontSize: 6.8, cellPadding: 1.5, textColor: [15, 23, 42], font: 'helvetica' },
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 40 } },
        head: [['Parameter', 'Sumber / Dasar Batas Acuan']],
        body: sourceRows.map(([labels, source]) => [t(labels), t(source)]),
      });
      afterTable(3);
      ensureSpace(25);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(t(METHOD_TEXT), contentW);
      doc.text(lines, margin, y + 2);
      y += lines.length * 3 + 6;
    }

    // ─── 5. Lembar pengesahan ───────────────────────────────────────────────
    const APPROVAL_BLOCK_HEIGHT = 120;
    ensureSpace(APPROVAL_BLOCK_HEIGHT);
    sectionTitle(sourceRows.length ? '5' : '4', 'Lembar Pengesahan Resmi', APPROVAL_BLOCK_HEIGHT);
    const sig = report.signatures;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(t(`AUTHOR BY, ${sig.authorName}`), margin, y + 1);
    y += 5;
    const head = (content: string, colSpan = 1) => ({ content, colSpan, styles: { fontStyle: 'bold' as const, fillColor: [220, 230, 241] as RGB, textColor: [0, 0, 0] as RGB } });
    const signBox = (s: { name: string; title: string }, colSpan = 1) => ({ content: t(`\n\n\n${s.name}\n${s.title}`), colSpan });
    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      pageBreak: 'avoid',
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42], font: 'helvetica', halign: 'center' },
      body: [
        [head('PREPARED BY,'), head('REVIEWED BY,')],
        [signBox(sig.preparedBy), signBox(sig.reviewedBy)],
        [head('ACKNOWLEDGED BY,', 2)],
        [signBox(sig.acknowledgedBy1), signBox(sig.acknowledgedBy2)],
        [head('APPROVED BY,', 2)],
        [signBox(sig.approvedBy, 2)],
      ],
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawHeader();
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(t(`Predictive Report PM — ${report.unitLabel}  |  Hal ${i} dari ${totalPages}`), pageW - margin, pageH - 6, { align: 'right' });
    }

    doc.save(`Predictive_Report_${safeFileName(report.unitLabel) || 'Unit'}_${report.maintenanceDate}.pdf`);
    const photoCount = photos.nameplate.length + Object.values(photos.bySection).reduce((n, list) => n + list.length, 0);
    toast.success(photoCount ? 'PDF Predictive Report berhasil diunduh' : 'PDF diunduh tanpa foto (foto laporan PM tidak bisa dimuat)', { id: toastId });
  } catch (error: any) {
    console.error('exportPmPredictiveToPdf error:', error);
    toast.error(`Gagal membuat PDF: ${error?.message || 'error tidak diketahui'}`, { id: toastId });
  }
}
