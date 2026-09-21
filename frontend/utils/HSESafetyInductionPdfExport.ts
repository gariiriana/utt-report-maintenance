// ============================================================================
// FILE: HSESafetyInductionPdfExport.ts
// Deskripsi: Generator PDF Resmi Laporan Safety Induction K3
//            Format A4 Portrait dengan Kop Dwimitra/UTT & NeutraDC
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HSESafetyInductionRecord } from '@/types/hseTbmInductionTypes';
import { loadLogoBase64 } from './ReportPdfExport';
import logoDME from '@/assets/logo_dwimitra_v2.png';
import logoUTT from '@/assets/logo_utt.png';
import logoNeutra from '@/assets/logo_neutradc.png';
import { compressBase64Image } from './imageCompression';
import { toast } from 'sonner';

export interface HSESafetyInductionExportOptions {
  companyVariant?: 'neutradc' | 'utt';
}

function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${parseInt(parts[2], 10)} ${monthNames[monthIdx]} ${parts[0]}`;
}

/**
 * Membuat instance jsPDF dan merender seluruh halaman Laporan Safety Induction
 */
async function buildSafetyInductionPdfDocument(
  record: HSESafetyInductionRecord,
  options?: HSESafetyInductionExportOptions
): Promise<jsPDF> {
  const isNeutra = options?.companyVariant !== 'utt';
  const companyTitle = isNeutra
    ? 'PT DWIMITRA EKATAMA MANDIRI'
    : 'PT UNITED TRANSWORLD TRADING';
  const subTitle = 'DATA CENTER OPERATION & MAINTENANCE — NEUTRA DC CIKARANG';

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageWidth - 2 * margin;

  const THEME_COLOR = '#00599c'; // Dwimitra Blue
  const DARK = '#1e293b';
  const GRAY = '#64748b';

  // Load Logos
  const leftLogoSource = isNeutra ? logoDME : logoUTT;
  const [leftLogo, rightLogo] = await Promise.all([
    loadLogoBase64(leftLogoSource),
    loadLogoBase64(logoNeutra),
  ]);

  // Header Box
  let y = margin;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentW, 26, 2, 2, 'FD');

  // Left Logo
  if (leftLogo) {
    try {
      doc.addImage(leftLogo, 'PNG', margin + 3, y + 3, 20, 20);
    } catch (e) {
      console.warn('Left logo draw error:', e);
    }
  }

  // Right Logo
  if (rightLogo) {
    try {
      doc.addImage(rightLogo, 'PNG', pageWidth - margin - 23, y + 4, 20, 18);
    } catch (e) {
      console.warn('Right logo draw error:', e);
    }
  }

  // Header Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  doc.text(companyTitle, pageWidth / 2, y + 7, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GRAY);
  doc.text(subTitle, pageWidth / 2, y + 12, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(THEME_COLOR);
  doc.text('FORMULIR LAPORAN SAFETY INDUCTION K3', pageWidth / 2, y + 19, { align: 'center' });

  y += 30;

  // Metadata Table (Informasi Peserta & Perusahaan)
  const formattedDate = formatIndonesianDate(record.date);
  const timeStr = record.time ? `${record.time} WIB` : '-';

  const hasMultiplePeserta = Boolean(record.pesertaList && record.pesertaList.length > 1);

  const pesertaBodyRow: any = hasMultiplePeserta
    ? [
        'Daftar Peserta Induction',
        {
          content: record.pesertaList!.map((p, idx) => `${idx + 1}. ${p.nama || '-'} — ${p.perusahaan || '-'}`).join('\n'),
          colSpan: 3,
        },
      ]
    : [
        'Nama Peserta',
        record.nama || '-',
        'Asal Perusahaan / PT',
        record.perusahaan || '-',
      ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.2,
      textColor: DARK,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [0, 89, 156],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38, fillColor: [248, 250, 252] },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', cellWidth: 38, fillColor: [248, 250, 252] },
      3: { cellWidth: 'auto' },
    },
    body: [
      pesertaBodyRow,
      [
        'Tanggal Pelaksanaan',
        formattedDate,
        'Waktu / Jam',
        timeStr,
      ],
      [
        'Jabatan / Pekerjaan',
        record.jabatan || 'Pekerja / Vendor',
        'Petugas HSE / Inspector',
        record.inspectorK3 || record.authorEmail || 'HSE Officer',
      ],
      [
        'Catatan K3 / Remarks',
        { content: record.catatan || 'Peserta telah diberikan induksi keselamatan kerja K3 & memahami regulasi Data Center NeutraDC.', colSpan: 3 },
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Section: Dokumentasi & Lampiran Berkas K3
  doc.setFillColor(0, 89, 156);
  doc.roundedRect(margin, y, contentW, 6.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('LAMPIRAN VERIFIKASI & DOKUMENTASI SAFETY INDUCTION', margin + 4, y + 4.5);

  y += 9;

  // 3 Boxes untuk Foto: 1. Foto Sedang Di-Induction, 2. Foto Surat Sehat, 3. Sertifikat K3 TDE (Opsional)
  const boxWidth = (contentW - 8) / 3;
  const photoHeight = 65;
  const totalBoxHeight = photoHeight + 14;

  const photoSlots = [
    {
      title: '1. Foto Sedang Di-Induction',
      badge: 'WAJIB',
      badgeColor: [16, 185, 129], // Emerald
      base64: record.fotoInduction,
      altText: 'Foto Kegiatan Induction',
    },
    {
      title: '2. Foto Surat Sehat',
      badge: 'WAJIB',
      badgeColor: [16, 185, 129],
      base64: record.fotoSuratSehat,
      altText: 'Foto Surat Keterangan Sehat',
    },
    {
      title: '3. Sertifikat K3 dari TDE',
      badge: record.fotoSertifikatK3 ? 'TERLAMPIR' : 'OPSIONAL',
      badgeColor: record.fotoSertifikatK3 ? [59, 130, 246] : [148, 163, 184],
      base64: record.fotoSertifikatK3,
      altText: 'Sertifikat K3 TDE (Opsional)',
    },
  ];

  for (let i = 0; i < photoSlots.length; i++) {
    const slot = photoSlots[i];
    const x = margin + i * (boxWidth + 4);

    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, boxWidth, totalBoxHeight, 1.5, 1.5, 'FD');

    // Title & Badge inside Box Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(DARK);
    doc.text(slot.title, x + 2.5, y + 4.5);

    // Draw image or placeholder
    const imgY = y + 7;
    const imgW = boxWidth - 4;
    const imgH = photoHeight;

    if (slot.base64) {
      try {
        const compressed = await compressBase64Image(slot.base64, {
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.7,
        });
        doc.addImage(compressed, 'JPEG', x + 2, imgY, imgW, imgH);
      } catch (e) {
        console.warn('Gagal render foto induction ke PDF:', e);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(GRAY);
        doc.text('Gagal memuat foto', x + boxWidth / 2, imgY + imgH / 2, { align: 'center' });
      }
    } else {
      doc.setFillColor(241, 245, 249);
      doc.rect(x + 2, imgY, imgW, imgH, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(GRAY);
      doc.text('(Tidak Dilampirkan)', x + boxWidth / 2, imgY + imgH / 2 - 2, { align: 'center' });
      doc.setFontSize(6.5);
      doc.text('Dokumen Opsional', x + boxWidth / 2, imgY + imgH / 2 + 3, { align: 'center' });
    }

    // Status Footer Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(slot.badgeColor[0], slot.badgeColor[1], slot.badgeColor[2]);
    doc.text(`Status: ${slot.badge}`, x + boxWidth / 2, y + totalBoxHeight - 2, { align: 'center' });
  }

  y += totalBoxHeight + 6;

  // Box Pernyataan K3
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(254, 252, 232); // Amber light tint
  doc.roundedRect(margin, y, contentW, 16, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14); // Dark Amber
  doc.text('KOMITMEN & KEPATUHAN KESELAMATAN KERJA (K3) DATA CENTER:', margin + 3, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  const komitmenText = 'Peserta telah mengikuti pengarahan Safety Induction, memahami bahaya di lingkungan Data Center NeutraDC Cikarang, sanggup mengenakan APD standar, mentaati izin kerja (PTW), serta bersedia mengutamakan keselamatan kerja.';
  doc.text(komitmenText, margin + 3, y + 8.5, { maxWidth: contentW - 6 });

  y += 20;

  // Signatures Table
  const officerName = record.inspectorK3 || record.authorEmail?.split('@')[0]?.toUpperCase() || 'HSE Officer';
  const pesertaName = hasMultiplePeserta
    ? `${record.pesertaList![0].nama || 'Peserta'}, dkk (${record.pesertaList!.length} Orang)`
    : (record.nama || 'Peserta Induction');

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 1,
      textColor: DARK,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: contentW / 2 },
      1: { cellWidth: contentW / 2 },
    },
    body: [
      ['Peserta Safety Induction,', 'Petugas HSE / Pengawas K3,'],
      [`${record.perusahaan || 'Vendor / Kontraktor'}`, 'PT Dwimitra Ekatama Mandiri'],
      ['\n\n\n', '\n\n\n'], // Space for signature
      [`( ${pesertaName} )`, `( ${officerName} )`],
      ['Tanda Tangan & Nama Jelas', 'HSE Officer NeutraDC Cikarang'],
    ],
  });

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let pNo = 1; pNo <= totalPages; pNo++) {
    doc.setPage(pNo);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `DwimitraSystem — Laporan Safety Induction K3 | Dokumen Resmi HSE NeutraDC Cikarang`,
      margin,
      pageHeight - 6
    );
    doc.text(
      `Halaman ${pNo} dari ${totalPages}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  return doc;
}

/**
 * Unduh langsung file PDF Laporan Safety Induction ke perangkat user
 */
export async function exportHSESafetyInductionPDF(
  record: HSESafetyInductionRecord,
  options?: HSESafetyInductionExportOptions
): Promise<void> {
  const toastId = toast.loading('Menyusun PDF Laporan Safety Induction...');
  try {
    const doc = await buildSafetyInductionPdfDocument(record, options);
    const cleanName = (record.nama || 'Peserta').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanPT = (record.perusahaan || 'PT').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Safety_Induction_${cleanName}_${cleanPT}.pdf`;
    doc.save(fileName);
    toast.success('PDF Laporan Safety Induction berhasil diunduh!', { id: toastId });
  } catch (error) {
    console.error('Error exportHSESafetyInductionPDF:', error);
    toast.error('Gagal membuat PDF Laporan Safety Induction', { id: toastId });
  }
}

/**
 * Mengembalikan Blob PDF Laporan Safety Induction (digunakan untuk DocumentList & Zip Export)
 */
export async function generateHSESafetyInductionPdfBlob(
  record: HSESafetyInductionRecord,
  options?: HSESafetyInductionExportOptions
): Promise<{ blob: Blob; fileName: string }> {
  const doc = await buildSafetyInductionPdfDocument(record, options);
  const cleanName = (record.nama || 'Peserta').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanPT = (record.perusahaan || 'PT').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Safety_Induction_${cleanName}_${cleanPT}.pdf`;
  const blob = doc.output('blob');
  return { blob, fileName };
}
