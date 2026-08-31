// ============================================================================
// FILE: HSEFindingPdfExport.ts
// Deskripsi: Export PDF Laporan Temuan K3 / HSE (HSE Finding Report & Recap).
//            Mendukung export lembar temuan individu (Before vs After side-by-side)
//            dan laporan rekapitulasi temuan HSE resmi PT Dwimitra / NeutraDC.
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HSEFindingItem, HSE_CATEGORY_LABELS, HSE_SEVERITY_CONFIG, HSE_STATUS_CONFIG } from '../types/hseFinding';
import { loadLogoBase64 } from './ReportPdfExport';
import logoNeutra from '@/assets/logo_neutradc.png';
import logoDME from '@/assets/logo_dwimitra_v2.png';
import { compressBase64Image } from './imageCompression';
import { toast } from 'sonner';

/**
 * Helper async untuk mengambil dimensi gambar base64
 */
function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = base64;
  });
}

/**
 * Export Lembar Temuan K3 Tunggal (Individual Finding Sheet) dengan Before & After Foto Side-by-Side
 */
export async function exportSingleHSEFindingPDF(finding: HSEFindingItem): Promise<void> {
  const toastId = toast.loading('Membuat PDF Lembar Temuan K3...');

  try {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageWidth - 2 * margin;

    // Palette Warna
    const GREEN_PRIMARY = '#15803d'; // Green 700
    const GREEN_DARK = '#14532d';    // Green 900
    const DARK = '#1e293b';
    const GRAY = '#64748b';
    const SLATE_200 = '#e2e8f0';

    const [leftLogo, rightLogo] = await Promise.all([
      loadLogoBase64(logoNeutra),
      loadLogoBase64(logoDME),
    ]);

    // Compress images for PDF
    let beforeBase64 = finding.beforePhoto;
    if (beforeBase64) {
      try {
        beforeBase64 = await compressBase64Image(beforeBase64, { maxWidth: 800, maxHeight: 800, quality: 0.65 });
      } catch (e) {
        console.error('Error compressing before photo:', e);
      }
    }

    let afterBase64 = finding.afterPhoto;
    if (afterBase64) {
      try {
        afterBase64 = await compressBase64Image(afterBase64, { maxWidth: 800, maxHeight: 800, quality: 0.65 });
      } catch (e) {
        console.error('Error compressing after photo:', e);
      }
    }

    // Top Accent Bar
    doc.setFillColor(GREEN_PRIMARY);
    doc.rect(0, 0, pageWidth, 3, 'F');

    // Header Box
    const headerH = 22;
    const headerY = 6;
    doc.setDrawColor(SLATE_200);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');

    const col1W = 34;
    const col3W = 34;
    doc.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
    doc.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);

    if (leftLogo) {
      doc.addImage(leftLogo, 'PNG', margin + 2.5, headerY + 3.5, col1W - 5, 15, 'logo_neutra', 'FAST');
    }
    if (rightLogo) {
      doc.addImage(rightLogo, 'PNG', pageWidth - margin - col3W + 4, headerY + 4, col3W - 8, 14, 'logo_dme', 'FAST');
    }

    const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
    doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(GREEN_DARK);
    doc.text('LEMBAR LAPORAN TEMUAN K3 / HSE', centerX, headerY + 7.5, { align: 'center' });

    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text('HEALTH, SAFETY & ENVIRONMENT FINDING REPORT', centerX, headerY + 12.5, { align: 'center' });

    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(GRAY);
    doc.text('PT DWIMITRA EKATAMA MANDIRI — NEUTRA DC CIKARANG', centerX, headerY + 17, { align: 'center' });

    let curY = headerY + headerH + 5;

    // Status Banner
    const statusInfo = HSE_STATUS_CONFIG[finding.status] || HSE_STATUS_CONFIG.open;
    let statusBg = [254, 243, 199]; // amber for open
    let statusTextColor = [180, 83, 9];
    if (finding.status === 'close') {
      statusBg = [209, 250, 229]; // emerald for close
      statusTextColor = [4, 120, 87];
    }

    doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
    doc.roundedRect(margin, curY, contentW, 8, 1, 1, 'F');
    doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(statusTextColor[0], statusTextColor[1], statusTextColor[2]);
    doc.text(`STATUS TEMUAN: ${statusInfo.label.toUpperCase()}`, margin + 4, curY + 5.5);

    const dateStr = finding.findingDate || new Date().toISOString().split('T')[0];
    doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(DARK);
    doc.text(`Tgl Lapor: ${dateStr}`, pageWidth - margin - 4, curY + 5.5, { align: 'right' });

    curY += 12;

    // Info Table (2 Columns Grid)
    const categoryInfo = HSE_CATEGORY_LABELS[finding.category]?.label || 'Lainnya';
    const severityInfo = HSE_SEVERITY_CONFIG[finding.severity]?.label || 'Medium';

    autoTable(doc, {
      startY: curY,
      theme: 'grid',
      head: [['INFORMASI TEMUAN', 'DETAIL & LOKASI']],
      body: [
        ['Judul Temuan', finding.title || '-'],
        ['Lokasi Temuan', finding.location || '-'],
        ['Kategori K3', categoryInfo],
        ['Tingkat Risiko', severityInfo],
        ['Pihak Terkait / Subkon', finding.targetPerson || '-'],
        ['Pelapor HSE Officer', finding.inspectorName || finding.reportedBy || '-'],
        ['Target Penyelesaian', finding.targetDate || '-'],
        ['Tgl Diselesaikan', finding.resolvedAt ? (typeof finding.resolvedAt === 'string' ? finding.resolvedAt : new Date(finding.resolvedAt).toLocaleDateString('id-ID')) : '-'],
      ],
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
        textColor: [30, 41, 59],
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [21, 128, 61],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45, fillColor: [248, 250, 252] },
        1: { cellWidth: 'auto' },
      },
    });

    curY = (doc as any).lastAutoTable.finalY + 4;

    // Kronologi / Uraian Temuan Box
    doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text('I. Uraian & Kronologi Temuan:', margin, curY);
    curY += 2;

    autoTable(doc, {
      startY: curY,
      theme: 'grid',
      body: [[finding.description || 'Tidak ada deskripsi detail.']],
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
        textColor: [51, 65, 85],
        fillColor: [255, 255, 255],
      }
    });

    curY = (doc as any).lastAutoTable.finalY + 5;

    // Photo Box Section: Side by Side BEFORE vs AFTER
    doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text('II. Dokumentasi Foto (Before & After):', margin, curY);
    curY += 3;

    const photoBoxW = (contentW - 6) / 2;
    const photoBoxH = 58;

    // --- BEFORE BOX ---
    doc.setDrawColor(245, 158, 11); // Amber border
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, curY, photoBoxW, photoBoxH, 1, 1, 'D');

    doc.setFillColor(254, 243, 199);
    doc.rect(margin, curY, photoBoxW, 6, 'F');
    doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(180, 83, 9);
    doc.text('KONDISI TEMUAN (BEFORE)', margin + 3, curY + 4.2);

    if (beforeBase64) {
      try {
        const dims = await getImageDimensions(beforeBase64);
        const maxImgW = photoBoxW - 6;
        const maxImgH = photoBoxH - 18;
        let imgW = maxImgW;
        let imgH = maxImgH;
        if (dims.width > 0 && dims.height > 0) {
          const ratio = dims.width / dims.height;
          if (ratio > maxImgW / maxImgH) {
            imgW = maxImgW;
            imgH = imgW / ratio;
          } else {
            imgH = maxImgH;
            imgW = imgH * ratio;
          }
        }
        const imgX = margin + (photoBoxW - imgW) / 2;
        const imgY = curY + 7 + (maxImgH - imgH) / 2;
        doc.addImage(beforeBase64, 'JPEG', imgX, imgY, imgW, imgH, undefined, 'FAST');
      } catch (err) {
        console.error('Error drawing before photo:', err);
      }
    } else {
      doc.setFontSize(7.5).setFont('helvetica', 'italic').setTextColor(GRAY);
      doc.text('(Tidak ada foto temuan)', margin + photoBoxW / 2, curY + photoBoxH / 2, { align: 'center' });
    }

    doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(GRAY);
    doc.text(finding.beforeNotes || `Dicatat: ${finding.findingDate || '-'}`, margin + 3, curY + photoBoxH - 2.5);

    // --- AFTER BOX ---
    const afterBoxX = margin + photoBoxW + 6;
    doc.setDrawColor(finding.status === 'close' ? 16 : 226, finding.status === 'close' ? 185 : 232, finding.status === 'close' ? 129 : 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(afterBoxX, curY, photoBoxW, photoBoxH, 1, 1, 'D');

    doc.setFillColor(finding.status === 'close' ? 209 : 241, finding.status === 'close' ? 250 : 245, finding.status === 'close' ? 229 : 249);
    doc.rect(afterBoxX, curY, photoBoxW, 6, 'F');
    doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(finding.status === 'close' ? 4 : 100, finding.status === 'close' ? 120 : 116, finding.status === 'close' ? 87 : 139);
    doc.text(finding.status === 'close' ? 'BUKTI PENYELESAIAN (AFTER)' : 'TINDAK LANJUT / AFTER', afterBoxX + 3, curY + 4.2);

    if (afterBase64 && finding.status === 'close') {
      try {
        const dims = await getImageDimensions(afterBase64);
        const maxImgW = photoBoxW - 6;
        const maxImgH = photoBoxH - 18;
        let imgW = maxImgW;
        let imgH = maxImgH;
        if (dims.width > 0 && dims.height > 0) {
          const ratio = dims.width / dims.height;
          if (ratio > maxImgW / maxImgH) {
            imgW = maxImgW;
            imgH = imgW / ratio;
          } else {
            imgH = maxImgH;
            imgW = imgH * ratio;
          }
        }
        const imgX = afterBoxX + (photoBoxW - imgW) / 2;
        const imgY = curY + 7 + (maxImgH - imgH) / 2;
        doc.addImage(afterBase64, 'JPEG', imgX, imgY, imgW, imgH, undefined, 'FAST');
      } catch (err) {
        console.error('Error drawing after photo:', err);
      }
    } else {
      doc.setFontSize(7.5).setFont('helvetica', 'italic').setTextColor(GRAY);
      const afterText = '(Menunggu Bukti Foto Penyelesaian / Closing)';
      doc.text(afterText, afterBoxX + photoBoxW / 2, curY + photoBoxH / 2, { align: 'center' });
    }

    doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(GRAY);
    doc.text(finding.afterNotes ? `Catatan: ${finding.afterNotes}` : 'Status: ' + statusInfo.label, afterBoxX + 3, curY + photoBoxH - 2.5);

    curY += photoBoxH + 5;

    // Tindakan Korektif & Catatan Penutupan
    doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text('III. Tindakan Korektif / Catatan Penutupan:', margin, curY);
    curY += 2;

    const resolutionText = finding.status === 'close' 
      ? (finding.afterNotes || finding.closingNotes || 'Tindakan perbaikan telah diselesaikan dan diverifikasi sesuai standar K3.')
      : 'Temuan dalam status OPEN menunggu perbaikan dan pengunggahan bukti After.';

    autoTable(doc, {
      startY: curY,
      theme: 'grid',
      body: [[resolutionText]],
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
        textColor: [30, 41, 59],
        fillColor: [255, 255, 255],
      }
    });

    curY = (doc as any).lastAutoTable.finalY + 6;

    // Signatures Box
    const signBoxW = (contentW - 10) / 2;
    const signBoxH = 24;

    // Left Signature: HSE Inspector
    doc.setDrawColor(SLATE_200);
    doc.roundedRect(margin, curY, signBoxW, signBoxH, 1, 1, 'D');
    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text('Petugas HSE Pelapor:', margin + 3, curY + 4);
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(GRAY);
    doc.text(finding.inspectorName || finding.reportedBy || 'HSE Officer', margin + 3, curY + signBoxH - 3);

    // Right Signature: Verified / PIC
    doc.roundedRect(margin + signBoxW + 10, curY, signBoxW, signBoxH, 1, 1, 'D');
    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text('Verifikasi / Pihak Terkait:', margin + signBoxW + 13, curY + 4);
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(GRAY);
    doc.text(finding.targetPerson || 'Pengawas Lapangan / Subkon', margin + signBoxW + 13, curY + signBoxH - 3);

    // Footer
    doc.setFillColor(GREEN_PRIMARY);
    doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');
    doc.setFontSize(7).setTextColor(GRAY);
    doc.text('PT DWIMITRA EKATAMA MANDIRI — HSE Finding System', margin, pageHeight - 6);
    doc.text('Halaman 1 dari 1', pageWidth - margin, pageHeight - 6, { align: 'right' });

    // Save File
    const safeTitle = (finding.title || 'Temuan_HSE').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const fileName = `HSE_Temuan_${dateStr}_${safeTitle}.pdf`;
    doc.save(fileName);

    toast.success('Laporan Temuan K3 berhasil diunduh!', { id: toastId });
  } catch (error) {
    console.error('Error generating Single HSE Finding PDF:', error);
    toast.error('Gagal membuat PDF temuan', { id: toastId });
  }
}

/**
 * Export Rekapitulasi Daftar Temuan K3 ke Dokumen PDF Resmi
 */
export async function exportHSEFindingsRecapPDF(findings: HSEFindingItem[]): Promise<void> {
  const toastId = toast.loading('Membuat Rekapitulasi Temuan K3...');

  try {
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentW = pageWidth - 2 * margin;

    const GREEN_PRIMARY = '#15803d';
    const DARK = '#1e293b';
    const GRAY = '#64748b';
    const SLATE_200 = '#e2e8f0';

    const [leftLogo, rightLogo] = await Promise.all([
      loadLogoBase64(logoNeutra),
      loadLogoBase64(logoDME),
    ]);

    const drawHeader = (currentDoc: jsPDF): number => {
      currentDoc.setFillColor(GREEN_PRIMARY);
      currentDoc.rect(0, 0, pageWidth, 2.5, 'F');

      const headerH = 20;
      const headerY = 5;

      currentDoc.setDrawColor(SLATE_200);
      currentDoc.setLineWidth(0.15);
      currentDoc.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');

      const col1W = 32;
      const col3W = 32;
      currentDoc.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
      currentDoc.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);

      if (leftLogo) {
        currentDoc.addImage(leftLogo, 'PNG', margin + 2, headerY + 3, col1W - 4, 14, 'logo_neutra', 'FAST');
      }
      if (rightLogo) {
        currentDoc.addImage(rightLogo, 'PNG', pageWidth - margin - col3W + 3, headerY + 3.5, col3W - 6, 13, 'logo_dme', 'FAST');
      }

      const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
      currentDoc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(GREEN_PRIMARY);
      currentDoc.text('REKAPITULASI TEMUAN K3 / HSE (HEALTH & SAFETY FINDING LIST)', centerX, headerY + 7.5, { align: 'center' });

      currentDoc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(DARK);
      currentDoc.text('PT DWIMITRA EKATAMA MANDIRI — NEUTRA DC CIKARANG', centerX, headerY + 12, { align: 'center' });

      const openCount = findings.filter(f => f.status === 'open').length;
      const closeCount = findings.filter(f => f.status === 'close').length;

      currentDoc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY);
      currentDoc.text(`Total: ${findings.length} | Open: ${openCount} | Close: ${closeCount}`, centerX, headerY + 16.5, { align: 'center' });

      return headerY + headerH + 5;
    };

    const drawFooter = (currentDoc: jsPDF, pg: number, totalPages: number) => {
      currentDoc.setFillColor(GREEN_PRIMARY);
      currentDoc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');
      currentDoc.setFontSize(7).setTextColor(GRAY);
      currentDoc.text('PT DWIMITRA EKATAMA MANDIRI — HSE Finding Recap', margin, pageHeight - 5);
      currentDoc.text(`Halaman ${pg} dari ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
    };

    const curY = drawHeader(doc);

    const tableRows = findings.map((f, idx) => {
      const cat = HSE_CATEGORY_LABELS[f.category]?.label || 'Lainnya';
      const sev = HSE_SEVERITY_CONFIG[f.severity]?.label || 'Medium';
      const stat = HSE_STATUS_CONFIG[f.status]?.label || f.status;
      return [
        String(idx + 1),
        f.findingDate || '-',
        f.title || '-',
        f.location || '-',
        cat,
        sev,
        f.targetPerson || '-',
        stat,
        f.afterNotes || f.closingNotes || f.description || '-',
      ];
    });

    autoTable(doc, {
      startY: curY,
      head: [['No', 'Tanggal', 'Judul Temuan', 'Lokasi', 'Kategori K3', 'Risiko', 'Pihak Terkait', 'Status', 'Catatan / Tindak Lanjut']],
      body: tableRows,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
        textColor: [30, 41, 59],
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [21, 128, 61],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'center', cellWidth: 18 },
        2: { cellWidth: 45 },
        3: { cellWidth: 32 },
        4: { cellWidth: 32 },
        5: { halign: 'center', cellWidth: 20 },
        6: { cellWidth: 28 },
        7: { halign: 'center', cellWidth: 28 },
        8: { cellWidth: 'auto' },
      },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawFooter(doc, i, pageCount);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    doc.save(`Rekap_Temuan_HSE_${todayStr}.pdf`);
    toast.success('Rekapitulasi Temuan K3 berhasil diunduh!', { id: toastId });
  } catch (error) {
    console.error('Error generating HSE Findings Recap PDF:', error);
    toast.error('Gagal membuat Rekap PDF', { id: toastId });
  }
}
