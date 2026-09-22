// ============================================================================
// FILE: HSETbmPdfExport.ts
// Deskripsi: Generator PDF Resmi Laporan Absen & Dokumentasi Toolbox Meeting (TBM)
//            Format A4 Portrait dengan Kop Dwimitra/UTT & NeutraDC
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HSETbmRecord } from '@/types/hseTbmInductionTypes';
import { loadLogoBase64 } from './ReportPdfExport';
import logoDME from '@/assets/logo_dwimitra_v2.png';
import logoUTT from '@/assets/logo_utt.png';
import logoNeutra from '@/assets/logo_neutradc.png';
import { compressBase64Image } from './imageCompression';
import { toast } from 'sonner';

export interface HSETbmExportOptions {
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
 * Membuat instance jsPDF dan merender seluruh halaman Laporan Absen TBM
 */
async function buildTbmPdfDocument(
  record: HSETbmRecord,
  options?: HSETbmExportOptions
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
  doc.text('LAPORAN ABSEN & DOKUMENTASI TOOLBOX MEETING (TBM)', pageWidth / 2, y + 19, { align: 'center' });

  y += 30;

  // Metadata Table
  const formattedDate = formatIndonesianDate(record.date);
  const timeStr = record.time ? `${record.time} WIB` : '-';

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
      [
        'Tanggal Pelaksanaan',
        formattedDate,
        'Waktu / Jam',
        timeStr,
      ],
      [
        'Total SDM Hadir',
        `${record.totalSDM || 0} Orang`,
        'Lokasi Pekerjaan',
        record.lokasi || 'Data Center NeutraDC Cikarang',
      ],
      [
        'Pengawas / HSE Inspector',
        record.inspectorK3 || record.authorEmail || 'HSE Officer',
        'Topik / Keterangan',
        record.keterangan || 'Arahan K3 & Pembagian Tugas Harian (Toolbox Meeting)',
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Section Header: Dokumentasi Foto TBM
  doc.setFillColor(0, 89, 156);
  doc.roundedRect(margin, y, contentW, 6.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `LAMPIRAN DOKUMENTASI FOTO TBM (${record.photos?.length || 0} FOTO)`,
    margin + 4,
    y + 4.5
  );

  y += 9;

  // Photos Rendering Grid (2 Kolom)
  const photos = record.photos || [];
  if (photos.length === 0) {
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentW, 25, 2, 2, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(GRAY);
    doc.text('Tidak ada lampiran foto TBM yang diunggah.', pageWidth / 2, y + 14, { align: 'center' });
    y += 30;
  } else {
    const colWidth = (contentW - 6) / 2;
    const photoHeight = 58;
    const boxHeight = photoHeight + 12;

    for (let i = 0; i < photos.length; i++) {
      const col = i % 2;
      const x = margin + col * (colWidth + 6);

      // Check if page overflow
      if (y + boxHeight > pageHeight - 32) {
        doc.addPage();
        y = margin;
      }

      const p = photos[i];
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, colWidth, boxHeight, 1.5, 1.5, 'FD');

      // Add image
      if (p.base64) {
        try {
          const compressed = await compressBase64Image(p.base64, {
            maxWidth: 800,
            maxHeight: 800,
            quality: 0.7,
          });
          doc.addImage(compressed, 'JPEG', x + 2, y + 2, colWidth - 4, photoHeight);
        } catch (imgErr) {
          console.warn('Gagal render foto TBM ke PDF:', imgErr);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(GRAY);
          doc.text('Gagal memuat foto', x + colWidth / 2, y + photoHeight / 2, { align: 'center' });
        }
      }

      // Photo caption / label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(DARK);
      const label = `Foto #${i + 1}${p.description ? `: ${p.description}` : ' - Dokumentasi Pelaksanaan TBM'}`;
      doc.text(label, x + 3, y + photoHeight + 6, { maxWidth: colWidth - 6 });

      if (col === 1 || i === photos.length - 1) {
        y += boxHeight + 4;
      }
    }
  }

  // Footer text on every page
  const totalPages = doc.getNumberOfPages();
  for (let pNo = 1; pNo <= totalPages; pNo++) {
    doc.setPage(pNo);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `DwimitraSystem — Laporan Absen TBM | Dokumen Resmi HSE NeutraDC Cikarang`,
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
 * Unduh langsung file PDF Laporan Absen TBM ke perangkat user
 */
export async function exportHSETbmPDF(
  record: HSETbmRecord,
  options?: HSETbmExportOptions
): Promise<void> {
  const toastId = toast.loading('Menyusun PDF Laporan Absen TBM...');
  try {
    const doc = await buildTbmPdfDocument(record, options);
    const dateTag = record.date ? record.date.replace(/-/g, '') : 'TBM';
    const fileName = `Laporan_Absen_TBM_${dateTag}.pdf`;
    doc.save(fileName);
    toast.success('PDF Laporan Absen TBM berhasil diunduh!', { id: toastId });
  } catch (error) {
    console.error('Error exportHSETbmPDF:', error);
    toast.error('Gagal membuat PDF Laporan Absen TBM', { id: toastId });
  }
}

/**
 * Mengembalikan Blob PDF Laporan Absen TBM (digunakan untuk DocumentList & Zip Export)
 */
export async function generateHSETbmPdfBlob(
  record: HSETbmRecord,
  options?: HSETbmExportOptions
): Promise<{ blob: Blob; fileName: string }> {
  const doc = await buildTbmPdfDocument(record, options);
  const dateTag = record.date ? record.date.replace(/-/g, '') : 'TBM';
  const fileName = `Laporan_Absen_TBM_${dateTag}.pdf`;
  const blob = doc.output('blob');
  return { blob, fileName };
}
