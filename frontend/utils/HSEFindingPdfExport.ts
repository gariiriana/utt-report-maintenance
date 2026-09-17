// ============================================================================
// FILE: HSEFindingPdfExport.ts
// Deskripsi: Export PDF Laporan Temuan K3 / HSE (HSE Finding Report & Recap).
//            Mendukung 2 varian logo & kop perusahaan:
//            1. NeutraDC (Logo PT Dwimitra Ekatama Mandiri + Logo NeutraDC)
//            2. UTT (Logo PT United Transworld Trading + Logo NeutraDC)
//            Mendukung export lembar temuan individu (Before vs After side-by-side)
//            dan laporan rekapitulasi temuan HSE resmi Landscape A4.
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HSEFindingItem, HSE_CATEGORY_LABELS, HSE_SEVERITY_CONFIG, HSE_STATUS_CONFIG } from '../types/hseFinding';
import { loadLogoBase64 } from './ReportPdfExport';
import logoNeutra from '@/assets/logo_neutradc.png';
import logoDME from '@/assets/logo_dwimitra_v2.png';
import logoUTT from '@/assets/logo_utt.png';
import { compressBase64Image } from './imageCompression';
import { toast } from 'sonner';

export interface HSEFindingExportOptions {
  companyVariant?: 'neutradc' | 'utt';
  periodLabel?: string;
}

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
export async function exportSingleHSEFindingPDF(
  finding: HSEFindingItem,
  options?: HSEFindingExportOptions
): Promise<void> {
  const isNeutra = options?.companyVariant !== 'utt';
  const variantLabel = isNeutra ? 'NeutraDC' : 'UTT';
  const companyTitle = isNeutra
    ? 'PT DWIMITRA EKATAMA MANDIRI — NEUTRA DC CIKARANG'
    : 'PT UNITED TRANSWORLD TRADING — NEUTRA DC CIKARANG';
  const footerCompany = isNeutra
    ? 'PT DWIMITRA EKATAMA MANDIRI — HSE Finding System'
    : 'PT UNITED TRANSWORLD TRADING — HSE Finding System';

  const toastId = toast.loading(`Membuat PDF Temuan K3 (${variantLabel})...`);

  try {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageWidth - 2 * margin;

    // Palette Warna (Corporate Blue Theme)
    const THEME_BLUE = '#00599c'; // Dwimitra Blue
    const DARK = '#1e293b';
    const GRAY = '#64748b';
    const SLATE_200 = '#e2e8f0';

    const leftLogoSource = isNeutra ? logoDME : logoUTT;
    const [leftLogo, rightLogo] = await Promise.all([
      loadLogoBase64(leftLogoSource),
      loadLogoBase64(logoNeutra),
    ]);

    const isPositive = finding.findingType === 'positive';

    const allBeforePhotos = Array.isArray(finding.beforePhotos) && finding.beforePhotos.length > 0
      ? finding.beforePhotos
      : (finding.beforePhoto ? [finding.beforePhoto] : []);
    const allAfterPhotos = Array.isArray(finding.afterPhotos) && finding.afterPhotos.length > 0
      ? finding.afterPhotos
      : (finding.afterPhoto ? [finding.afterPhoto] : []);

    // Compress primary images for PDF Page 1
    let beforeBase64 = allBeforePhotos[0] || finding.beforePhoto;
    if (beforeBase64) {
      try {
        beforeBase64 = await compressBase64Image(beforeBase64, { maxWidth: 800, maxHeight: 800, quality: 0.65 });
      } catch (e) {
        console.error('Error compressing before photo:', e);
      }
    }

    let photo2Base64: string | null = null;
    if (isPositive && allBeforePhotos.length >= 2) {
      photo2Base64 = allBeforePhotos[1];
      if (photo2Base64) {
        try {
          photo2Base64 = await compressBase64Image(photo2Base64, { maxWidth: 800, maxHeight: 800, quality: 0.65 });
        } catch (e) {
          console.error('Error compressing second positive photo:', e);
        }
      }
    }

    let afterBase64 = allAfterPhotos[0] || finding.afterPhoto;
    if (!isPositive && afterBase64) {
      try {
        afterBase64 = await compressBase64Image(afterBase64, { maxWidth: 800, maxHeight: 800, quality: 0.65 });
      } catch (e) {
        console.error('Error compressing after photo:', e);
      }
    }

    // Top Accent Bar
    doc.setFillColor(THEME_BLUE);
    doc.rect(0, 0, pageWidth, 3, 'F');

    // Header Box (Logo Kiri DME/UTT & Logo Kanan NeutraDC)
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
      doc.addImage(leftLogo, 'PNG', margin + 2.5, headerY + 3.5, col1W - 5, 15, isNeutra ? 'logo_dme' : 'logo_utt', 'FAST');
    }
    if (rightLogo) {
      doc.addImage(rightLogo, 'PNG', pageWidth - margin - col3W + 2.5, headerY + 4, col3W - 5, 14, 'logo_neutra', 'FAST');
    }

    const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
    doc.setFontSize(10.5).setFont('helvetica', 'bold').setTextColor(THEME_BLUE);
    doc.text(
      isPositive ? `LEMBAR TEMUAN POSITIF K3 (${variantLabel})` : `LEMBAR LAPORAN TEMUAN K3 / HSE (${variantLabel})`,
      centerX,
      headerY + 7.5,
      { align: 'center' }
    );

    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text(
      isPositive ? 'HEALTH & SAFETY SAFE PRACTICE / RECOGNITION REPORT' : 'HEALTH, SAFETY & ENVIRONMENT FINDING REPORT',
      centerX,
      headerY + 12.5,
      { align: 'center' }
    );

    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(GRAY);
    doc.text(companyTitle, centerX, headerY + 17, { align: 'center' });

    let curY = headerY + headerH + 5;

    const dateStr = finding.findingDate || new Date().toISOString().split('T')[0];
    const timeStr = finding.findingTime ? ` | ${finding.findingTime} WIB` : '';

    // Status Banner (Hanya untuk Temuan Negatif)
    if (!isPositive) {
      const statusInfo = HSE_STATUS_CONFIG[finding.status] || HSE_STATUS_CONFIG.open;
      let statusBg = [254, 226, 226]; // red for open
      let statusTextColor = [185, 28, 28];
      if (finding.status === 'close') {
        statusBg = [209, 250, 229]; // emerald for close
        statusTextColor = [4, 120, 87];
      }

      doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
      doc.roundedRect(margin, curY, contentW, 8, 1, 1, 'F');
      doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(statusTextColor[0], statusTextColor[1], statusTextColor[2]);
      doc.text(
        `STATUS TEMUAN: ${statusInfo.label.toUpperCase()}`,
        margin + 4,
        curY + 5.5
      );

      doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(DARK);
      doc.text(`Tgl Lapor: ${dateStr}${timeStr}`, pageWidth - margin - 4, curY + 5.5, { align: 'right' });

      curY += 12;
    }

    // Info Table (2 Columns Grid)
    const severityInfo = HSE_SEVERITY_CONFIG[finding.severity]?.label || finding.severity || (isPositive ? 'Safe Condition' : 'Unsafe Condition');

    const infoBody: (string[])[] = [
      ['Jenis Temuan', isPositive ? 'Temuan Positif (Safe Behavior / Condition)' : 'Temuan Negatif (Unsafe Condition / Action)'],
      ['Judul Temuan', finding.title || '-'],
      ['Lokasi Temuan', finding.location || '-'],
    ];

    if (finding.category && finding.category.trim()) {
      const categoryInfo = HSE_CATEGORY_LABELS[finding.category as keyof typeof HSE_CATEGORY_LABELS]?.label || finding.category;
      infoBody.push(['Kategori K3', categoryInfo]);
    }

    if (isPositive) {
      infoBody.push(
        ['Kategori Tindakan / Kondisi', severityInfo],
        ['Penerima Apresiasi / Pihak Terkait', finding.targetPerson || '-'],
        ['Petugas Pengawas / Inspeksi', finding.inspectorName || finding.reportedBy || '-'],
        ['Waktu Pelaporan', `${dateStr}${timeStr}`]
      );
    } else {
      const resolvedDateText = finding.status === 'close'
        ? (finding.resolvedAt
            ? (typeof finding.resolvedAt === 'string' ? finding.resolvedAt : new Date(finding.resolvedAt).toLocaleDateString('id-ID'))
            : 'Selesai (Close)')
        : 'Belum Selesai (Status: OPEN — Menunggu Tindak Lanjut)';

      infoBody.push(
        ['Tingkat Bahaya / Risiko', severityInfo],
        ['Pihak Terkait / Subkon', finding.targetPerson || '-'],
        ['Petugas Inspeksi', finding.inspectorName || finding.reportedBy || '-'],
        ['Tgl Diselesaikan', resolvedDateText]
      );
    }

    autoTable(doc, {
      startY: curY,
      theme: 'grid',
      head: [['INFORMASI TEMUAN', 'DETAIL & LOKASI']],
      body: infoBody,
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
        fillColor: [0, 89, 156],
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
    doc.text(
      isPositive ? 'I. Uraian Tindakan Aman & Best Practice:' : 'I. Uraian & Kronologi Temuan:',
      margin,
      curY
    );
    curY += 2;

    autoTable(doc, {
      startY: curY,
      theme: 'grid',
      body: [[finding.description || (isPositive ? 'Tindakan aman dan kepatuhan K3 teladan tercatat dengan baik di lapangan.' : 'Tidak ada deskripsi detail.')]],
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

    // Photo Box Section
    if (isPositive) {
      // Temuan Positif: Foto dokumentasi tindakan aman (tanpa kotak dummy status apresiasi)
      doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(DARK);
      const photoCountLabel = allBeforePhotos.length > 0 ? ` (${allBeforePhotos.length} foto terlampir)` : '';
      doc.text(`II. Dokumentasi Foto Temuan Positif (Safe Practice)${photoCountLabel}:`, margin, curY);
      curY += 3;

      if (allBeforePhotos.length >= 2) {
        // Tampilkan 2 foto pertama berdampingan
        const photoBoxW = (contentW - 6) / 2;
        const photoBoxH = 80;

        for (let idx = 0; idx < 2; idx++) {
          const boxX = margin + idx * (photoBoxW + 6);
          const photoBase64 = idx === 0 ? beforeBase64 : photo2Base64;

          doc.setDrawColor(16, 185, 129);
          doc.setLineWidth(0.3);
          doc.roundedRect(boxX, curY, photoBoxW, photoBoxH, 1, 1, 'D');

          doc.setFillColor(209, 250, 229);
          doc.rect(boxX, curY, photoBoxW, 6, 'F');
          doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(4, 120, 87);
          doc.text(`FOTO DOKUMENTASI #${idx + 1}`, boxX + 3, curY + 4.2);

          if (photoBase64) {
            try {
              const dims = await getImageDimensions(photoBase64);
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
              const imgX = boxX + (photoBoxW - imgW) / 2;
              const imgY = curY + 7 + (maxImgH - imgH) / 2;
              doc.addImage(photoBase64, 'JPEG', imgX, imgY, imgW, imgH, undefined, 'FAST');
            } catch (err) {
              console.error(`Error drawing positive photo ${idx + 1}:`, err);
            }
          }

          doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(GRAY);
          const noteText = idx === 0 ? (finding.beforeNotes || `Dicatat: ${finding.findingDate || '-'}`) : `Dicatat: ${finding.findingDate || '-'}`;
          doc.text(noteText, boxX + 3, curY + photoBoxH - 2.5);
        }

        curY += photoBoxH + 5;
      } else {
        // Tampilkan 1 foto (single photo card lebar penuh)
        const photoBoxW = contentW;
        const photoBoxH = 85;

        doc.setDrawColor(16, 185, 129);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, curY, photoBoxW, photoBoxH, 1, 1, 'D');

        doc.setFillColor(209, 250, 229);
        doc.rect(margin, curY, photoBoxW, 6, 'F');
        doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(4, 120, 87);
        doc.text('FOTO DOKUMENTASI TINDAKAN / KONDISI AMAN', margin + 4, curY + 4.2);

        if (beforeBase64) {
          try {
            const dims = await getImageDimensions(beforeBase64);
            const maxImgW = photoBoxW - 10;
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
            console.error('Error drawing single positive photo:', err);
          }
        } else {
          doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(GRAY);
          doc.text('(Tidak ada foto dokumentasi terlampir)', margin + photoBoxW / 2, curY + photoBoxH / 2, { align: 'center' });
        }

        doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(GRAY);
        doc.text(finding.beforeNotes || `Dicatat: ${finding.findingDate || '-'}`, margin + 4, curY + photoBoxH - 2.5);

        curY += photoBoxH + 5;
      }
    } else {
      // Temuan Negatif: Format Side-by-Side BEFORE vs AFTER
      const statusInfo = HSE_STATUS_CONFIG[finding.status] || HSE_STATUS_CONFIG.open;
      doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(DARK);
      const beforePhotoCountLabel = allBeforePhotos.length > 1 ? ` (${allBeforePhotos.length} foto)` : '';
      const afterPhotoCountLabel = allAfterPhotos.length > 1 ? ` (${allAfterPhotos.length} foto)` : '';
      doc.text('II. Dokumentasi Foto Utama (Before vs After):', margin, curY);
      curY += 3;

      const photoBoxW = (contentW - 6) / 2;
      const photoBoxH = 65;

      // --- BEFORE BOX ---
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, curY, photoBoxW, photoBoxH, 1, 1, 'D');

      doc.setFillColor(254, 243, 199);
      doc.rect(margin, curY, photoBoxW, 6, 'F');
      doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(180, 83, 9);
      doc.text(`KONDISI TEMUAN (BEFORE)${beforePhotoCountLabel}`, margin + 3, curY + 4.2);

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
      doc.setDrawColor(
        finding.status === 'close' ? 16 : 226,
        finding.status === 'close' ? 185 : 232,
        finding.status === 'close' ? 129 : 240
      );
      doc.setLineWidth(0.3);
      doc.roundedRect(afterBoxX, curY, photoBoxW, photoBoxH, 1, 1, 'D');

      doc.setFillColor(
        finding.status === 'close' ? 209 : 241,
        finding.status === 'close' ? 250 : 245,
        finding.status === 'close' ? 229 : 249
      );
      doc.rect(afterBoxX, curY, photoBoxW, 6, 'F');
      doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(
        finding.status === 'close' ? 4 : 100,
        finding.status === 'close' ? 120 : 116,
        finding.status === 'close' ? 87 : 139
      );
      doc.text(
        finding.status === 'close' ? `BUKTI PENYELESAIAN (AFTER)${afterPhotoCountLabel}` : 'TINDAK LANJUT / AFTER',
        afterBoxX + 3,
        curY + 4.2
      );

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
        doc.text('(Menunggu Bukti Foto Penyelesaian / Closing)', afterBoxX + photoBoxW / 2, curY + photoBoxH / 2, { align: 'center' });
      }

      doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(GRAY);
      doc.text(finding.afterNotes ? `Catatan: ${finding.afterNotes}` : 'Status: ' + statusInfo.label, afterBoxX + 3, curY + photoBoxH - 2.5);

      curY += photoBoxH + 5;

      // Section III: Tindakan Korektif & Catatan Penutupan (Hanya untuk Temuan Negatif)
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
    }

    // --- APPENDIX PAGE FOR EXTRA PHOTOS (If any) ---
    const extraPhotos: { type: 'before' | 'after'; index: number; url: string }[] = [];

    if (isPositive) {
      const displayedCount = allBeforePhotos.length >= 2 ? 2 : (allBeforePhotos.length === 1 ? 1 : 0);
      const extraPositivePhotos = allBeforePhotos.slice(displayedCount);
      extraPositivePhotos.forEach((url, i) => {
        extraPhotos.push({ type: 'before', index: displayedCount + i + 1, url });
      });
    } else {
      const extraBeforePhotos = allBeforePhotos.slice(1);
      const extraAfterPhotos = allAfterPhotos.slice(1);
      extraBeforePhotos.forEach((url, i) => {
        extraPhotos.push({ type: 'before', index: i + 2, url });
      });
      extraAfterPhotos.forEach((url, i) => {
        extraPhotos.push({ type: 'after', index: i + 2, url });
      });
    }

    if (extraPhotos.length > 0) {
      // Create appendix pages
      const photosPerPage = 4;
      for (let pIdx = 0; pIdx < extraPhotos.length; pIdx += photosPerPage) {
        doc.addPage();

        // Top accent
        doc.setFillColor(THEME_BLUE);
        doc.rect(0, 0, pageWidth, 3, 'F');

        // Header
        const appHeaderY = 6;
        doc.setDrawColor(SLATE_200);
        doc.setLineWidth(0.2);
        doc.roundedRect(margin, appHeaderY, contentW, 16, 1, 1, 'D');

        if (leftLogo) {
          doc.addImage(leftLogo, 'PNG', margin + 2.5, appHeaderY + 2, 26, 12, isNeutra ? 'logo_dme' : 'logo_utt', 'FAST');
        }
        if (rightLogo) {
          doc.addImage(rightLogo, 'PNG', pageWidth - margin - 26 - 2.5, appHeaderY + 2.5, 26, 11, 'logo_neutra', 'FAST');
        }

        doc.setFontSize(9.5).setFont('helvetica', 'bold').setTextColor(THEME_BLUE);
        doc.text(
          isPositive ? 'LAMPIRAN DOKUMENTASI FOTO TAMBAHAN TEMUAN POSITIF' : 'LAMPIRAN DOKUMENTASI FOTO TAMBAHAN TEMUAN K3',
          pageWidth / 2,
          appHeaderY + 6.5,
          { align: 'center' }
        );

        doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(GRAY);
        doc.text(`Temuan: ${finding.title || '-'} | Lokasi: ${finding.location || '-'}`, pageWidth / 2, appHeaderY + 11.5, { align: 'center' });

        const currentBatch = extraPhotos.slice(pIdx, pIdx + photosPerPage);
        const cardW = (contentW - 6) / 2;
        const cardH = 95;
        const startCardY = appHeaderY + 21;

        for (let bIdx = 0; bIdx < currentBatch.length; bIdx++) {
          const item = currentBatch[bIdx];
          const col = bIdx % 2;
          const row = Math.floor(bIdx / 2);
          const cardX = margin + col * (cardW + 6);
          const cardY = startCardY + row * (cardH + 6);

          const isBefore = item.type === 'before';
          const borderColor = (isPositive || !isBefore) ? [16, 185, 129] : [245, 158, 11];
          const headerBg = (isPositive || !isBefore) ? [209, 250, 229] : [254, 243, 199];
          const headerTextColor = (isPositive || !isBefore) ? [4, 120, 87] : [180, 83, 9];
          const label = isPositive
            ? `FOTO DOKUMENTASI TAMBAHAN #${item.index}`
            : (isBefore
                ? `FOTO TEMUAN (BEFORE) #${item.index}`
                : `FOTO BUKTI PERBAIKAN (AFTER) #${item.index}`);

          doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
          doc.setLineWidth(0.25);
          doc.roundedRect(cardX, cardY, cardW, cardH, 1, 1, 'D');

          doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
          doc.rect(cardX, cardY, cardW, 6, 'F');

          doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
          doc.text(label, cardX + 3, cardY + 4.2);

          try {
            const compressed = await compressBase64Image(item.url, { maxWidth: 800, maxHeight: 800, quality: 0.65 });
            const dims = await getImageDimensions(compressed);
            const maxImgW = cardW - 4;
            const maxImgH = cardH - 10;
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
            const imgX = cardX + (cardW - imgW) / 2;
            const imgY = cardY + 7 + (maxImgH - imgH) / 2;
            doc.addImage(compressed, 'JPEG', imgX, imgY, imgW, imgH, undefined, 'FAST');
          } catch (e) {
            console.error('Error drawing extra photo:', e);
          }
        }
      }
    }

    // Footers for all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(THEME_BLUE);
      doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');
      doc.setFontSize(7).setTextColor(GRAY);
      doc.text(footerCompany, margin, pageHeight - 6);
      doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }

    // Save File
    const safeTitle = (finding.title || 'Temuan_HSE').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const fileName = `HSE_Temuan_${variantLabel}_${dateStr}_${safeTitle}.pdf`;
    doc.save(fileName);

    toast.success(`Laporan Temuan K3 (${variantLabel}) berhasil diunduh!`, { id: toastId });
  } catch (error) {
    console.error('Error generating Single HSE Finding PDF:', error);
    toast.error('Gagal membuat PDF temuan', { id: toastId });
  }
}

/**
 * Export Rekapitulasi Daftar Temuan K3 ke Dokumen PDF Resmi
 * - Mendukung Varian NeutraDC (Dwimitra + NeutraDC) & UTT (UTT + NeutraDC)
 * - Menggunakan Tema Warna Biru Dwimitra (#00599c)
 * - Menyertakan Foto Temuan (Before) & Foto Bukti Penyelesaian (After) secara efisien & ringkas
 * - Layout compact Landscape A4 sehingga hemat halaman namun tetap jelas dan tajam
 */
export async function exportHSEFindingsRecapPDF(
  findings: HSEFindingItem[],
  options?: HSEFindingExportOptions
): Promise<void> {
  const isNeutra = options?.companyVariant !== 'utt';
  const variantLabel = isNeutra ? 'NeutraDC' : 'UTT';
  const companyTitle = isNeutra
    ? 'PT DWIMITRA EKATAMA MANDIRI — NEUTRA DC CIKARANG'
    : 'PT UNITED TRANSWORLD TRADING — NEUTRA DC CIKARANG';
  const reportHeaderTitle = isNeutra
    ? 'REKAPITULASI TEMUAN K3 / HSE (NEUTRA DC)'
    : 'REKAPITULASI TEMUAN K3 / HSE (UTT MAINTENANCE)';
  const footerTitle = isNeutra
    ? 'PT DWIMITRA EKATAMA MANDIRI — HSE Finding Recap Report'
    : 'PT UNITED TRANSWORLD TRADING — HSE Finding Recap Report';

  const toastId = toast.loading(`Membuat Rekapitulasi Temuan K3 (${variantLabel})...`);

  try {
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageWidth - 2 * margin;

    const BLUE_RGB: [number, number, number] = [0, 89, 156];
    const DARK = '#1e293b';
    const GRAY = '#64748b';
    const SLATE_200 = '#e2e8f0';

    const leftLogoSource = isNeutra ? logoDME : logoUTT;
    const [leftLogo, rightLogo] = await Promise.all([
      loadLogoBase64(leftLogoSource),
      loadLogoBase64(logoNeutra),
    ]);

    const headerTopY = 4.5;
    const headerH = 22;
    const tableStartY = headerTopY + headerH + 3.5;

    const drawHeader = (currentDoc: jsPDF) => {
      // Top accent strip
      currentDoc.setFillColor(...BLUE_RGB);
      currentDoc.rect(0, 0, pageWidth, 2.5, 'F');

      // Header box
      currentDoc.setFillColor(255, 255, 255);
      currentDoc.setDrawColor(SLATE_200);
      currentDoc.setLineWidth(0.2);
      currentDoc.roundedRect(margin, headerTopY, contentW, headerH, 1.5, 1.5, 'FD');

      const col1W = 34;
      const col3W = 34;

      currentDoc.setDrawColor(SLATE_200);
      currentDoc.setLineWidth(0.2);
      currentDoc.line(margin + col1W, headerTopY, margin + col1W, headerTopY + headerH);
      currentDoc.line(pageWidth - margin - col3W, headerTopY, pageWidth - margin - col3W, headerTopY + headerH);

      if (leftLogo) {
        currentDoc.addImage(leftLogo, 'PNG', margin + 2.5, headerTopY + 3.5, col1W - 5, 15, isNeutra ? 'logo_dme' : 'logo_utt', 'FAST');
      }
      if (rightLogo) {
        currentDoc.addImage(rightLogo, 'PNG', pageWidth - margin - col3W + 2.5, headerTopY + 4, col3W - 5, 14, 'logo_neutra', 'FAST');
      }

      const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
      currentDoc.setFontSize(10.5).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      currentDoc.text(reportHeaderTitle, centerX, headerTopY + 6.5, { align: 'center' });

      currentDoc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(DARK);
      currentDoc.text(companyTitle, centerX, headerTopY + 11.5, { align: 'center' });

      const openCount = findings.filter(f => f.status === 'open').length;
      const closeCount = findings.filter(f => f.status === 'close').length;
      const positiveCount = findings.filter(f => f.findingType === 'positive').length;
      const negativeCount = findings.filter(f => f.findingType !== 'positive').length;
      const todayPrint = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

      const periodPrefix = options?.periodLabel ? `Periode: ${options.periodLabel}  |  ` : '';
      currentDoc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY);
      currentDoc.text(
        `${periodPrefix}Total: ${findings.length}  |  Negatif: ${negativeCount}  |  Positif: ${positiveCount}  |  OPEN: ${openCount}  |  CLOSE: ${closeCount}  |  Cetak: ${todayPrint}`,
        centerX,
        headerTopY + 16.8,
        { align: 'center' }
      );
    };

    const drawFooter = (currentDoc: jsPDF, pg: number, totalPages: number) => {
      currentDoc.setFillColor(...BLUE_RGB);
      currentDoc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');
      currentDoc.setFontSize(6.5).setTextColor(GRAY);
      currentDoc.text(footerTitle, margin, pageHeight - 4.5);
      currentDoc.text(`Halaman ${pg} dari ${totalPages}`, pageWidth - margin, pageHeight - 4.5, { align: 'right' });
    };

    // Draw header on the first page
    drawHeader(doc);

    // Build Table Rows
    const tableRows = findings.map((f, idx) => {
      const isPos = f.findingType === 'positive';
      const sevCfg = HSE_SEVERITY_CONFIG[f.severity] || { label: f.severity || (isPos ? 'Safe Condition' : 'Unsafe Condition') };
      const statCfg = HSE_STATUS_CONFIG[f.status] || HSE_STATUS_CONFIG.open;
      const dateText = f.findingDate || '-';
      const timeText = f.findingTime ? `${f.findingTime} WIB` : '';
      const inspectorText = f.inspectorName || f.reportedBy || 'HSE Officer';
      const titleLocationText = `${isPos ? '[POSITIF] ' : '[NEGATIF] '}${f.title || '-'}\nLokasi: ${f.location || '-'}\nPihak: ${f.targetPerson || '-'}`;
      const statusText = `${statCfg.label.split(' (')[0]}\n(${sevCfg.label.split(' (')[0]})`;

      const notesText = isPos
        ? (f.description || f.afterNotes || 'Apresiasi budaya K3.')
        : (f.status === 'close'
            ? (f.afterNotes || f.closingNotes || f.description || 'Temuan telah diselesaikan dan diverifikasi.')
            : (f.description || f.beforeNotes || 'Dalam proses tindak lanjut perbaikan.'));

      const beforePlaceholder = f.beforePhoto ? '' : '(Tidak Ada Foto)';
      const afterPlaceholder = isPos
        ? (f.afterPhoto ? '' : '(Kondisi Aman / Selesai)')
        : (f.status === 'close'
            ? (f.afterPhoto ? '' : '(Foto Belum Ada)')
            : '(Status OPEN\nMenunggu Bukti)');

      return [
        String(idx + 1),
        timeText ? `${dateText}\n${timeText}` : dateText,
        inspectorText,
        titleLocationText,
        beforePlaceholder,
        afterPlaceholder,
        statusText,
        notesText,
      ];
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [[
        'No',
        'Tanggal & Jam',
        'Petugas Inspeksi',
        'Judul & Lokasi Temuan',
        'Foto Temuan (Before)',
        'Foto Bukti (After)',
        'Status & Bahaya',
        'Uraian / Tindak Lanjut Perbaikan'
      ]],
      body: tableRows,
      margin: { top: tableStartY, left: margin, right: margin, bottom: 10 },
      styles: {
        fontSize: 6.8,
        cellPadding: 1.5,
        lineColor: [203, 213, 225],
        lineWidth: 0.15,
        textColor: [30, 41, 59],
        font: 'helvetica',
        valign: 'middle',
        minCellHeight: 22,
      },
      headStyles: {
        fillColor: BLUE_RGB,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: BLUE_RGB,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'center', cellWidth: 22 },
        2: { cellWidth: 24 },
        3: { cellWidth: 46 },
        4: { halign: 'center', cellWidth: 34 },
        5: { halign: 'center', cellWidth: 34 },
        6: { halign: 'center', cellWidth: 24 },
        7: { cellWidth: 'auto' },
      },
      didDrawPage: (data: any) => {
        if (data.pageNumber > 1) {
          drawHeader(doc);
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body') {
          const finding = findings[data.row.index];
          if (!finding) return;

          const pad = 1.2;
          const cell = data.cell;
          const cardW = cell.width - pad * 2;
          const cardH = cell.height - pad * 2;
          const cardX = cell.x + pad;
          const cardY = cell.y + pad;

          // Col 4: Foto Before
          if (data.column.index === 4 && finding.beforePhoto) {
            try {
              doc.setFillColor(241, 245, 249);
              doc.setDrawColor(203, 213, 225);
              doc.setLineWidth(0.1);
              doc.roundedRect(cardX, cardY, cardW, cardH, 0.6, 0.6, 'FD');

              doc.addImage(
                finding.beforePhoto,
                'JPEG',
                cardX + 0.4,
                cardY + 0.4,
                cardW - 0.8,
                cardH - 0.8,
                `hse_find_bf_${finding.id || data.row.index}`,
                'FAST'
              );
            } catch (err) {
              console.error('Error rendering Before photo in recap cell:', err);
            }
          }

          // Col 5: Foto After
          if (data.column.index === 5 && finding.status === 'close' && finding.afterPhoto) {
            try {
              doc.setFillColor(241, 245, 249);
              doc.setDrawColor(203, 213, 225);
              doc.setLineWidth(0.1);
              doc.roundedRect(cardX, cardY, cardW, cardH, 0.6, 0.6, 'FD');

              doc.addImage(
                finding.afterPhoto,
                'JPEG',
                cardX + 0.4,
                cardY + 0.4,
                cardW - 0.8,
                cardH - 0.8,
                `hse_find_af_${finding.id || data.row.index}`,
                'FAST'
              );
            } catch (err) {
              console.error('Error rendering After photo in recap cell:', err);
            }
          }
        }
      },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawFooter(doc, i, pageCount);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const safePeriodStr = options?.periodLabel
      ? `_${options.periodLabel.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').substring(0, 35)}`
      : '';
    doc.save(`Rekap_Temuan_HSE_${variantLabel}${safePeriodStr}_${todayStr}.pdf`);
    toast.success(`Rekapitulasi Temuan K3 (${variantLabel}) berhasil diunduh!`, { id: toastId });
  } catch (error) {
    console.error('Error generating HSE Findings Recap PDF:', error);
    toast.error('Gagal membuat Rekap PDF', { id: toastId });
  }
}
