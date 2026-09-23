// ============================================================================
// FILE: frontend/utils/PredictiveReportPdfExport.ts
// Deskripsi: Generator Dokumen PDF Resmi untuk Laporan Predictive Maintenance (PdM)
//            PT Dwimitra Ekatama Mandiri / NeutraDC Cikarang.
//            Dilengkapi Kop Surat Dual Logo Resmi, Format 5 Section Standar Industri,
//            Tabel Parameter Drift, Analisis RUL, & Kolom Pengesahan 3 Pihak.
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PredictiveReportData } from '@/types/predictiveReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { toast } from 'sonner';

/** Helper konversi gambar URL ke base64 */
async function loadImageBase64(src: string): Promise<string> {
  if (!src) return '';
  if (src.startsWith('data:image')) return src;
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
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/(?:&«|[\u26AB\u25AA\u25BA\u25B6\u2043\u25CF\u25C6])/g, '•')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-');
}

export async function exportPredictiveReportToPdf(data: PredictiveReportData): Promise<void> {
  const toastId = toast.loading('Membuat Dokumen PDF Predictive Maintenance...');

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentW = pageW - 2 * margin;

    // Load Logos
    const [logoDmeBase64, logoNdcBase64] = await Promise.all([
      loadImageBase64(logoDwimitra),
      loadImageBase64(logoNeutraDC),
    ]);

    // Dimensi Kop Surat & Margin Konten
    const HEADER_TOP = 10;
    const HEADER_DIVIDER_Y = 30; // Posisi Y garis pemisah kop surat
    const CONTENT_START_Y = 36; // Konten dimulai aman di bawah garis pemisah kop surat

    // Helper: Gambar Kop Surat Resmi Dual Logo & Teks Header di halaman aktif
    const drawHeader = () => {
      if (logoDmeBase64) {
        doc.addImage(logoDmeBase64, 'PNG', margin, HEADER_TOP, 32, 13);
      }
      if (logoNdcBase64) {
        doc.addImage(logoNdcBase64, 'PNG', pageW - margin - 32, HEADER_TOP, 32, 13);
      }

      // Teks Header Tengah
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text('PT DWIMITRA EKATAMA MANDIRI', pageW / 2, HEADER_TOP + 3.5, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(153, 27, 27); // Crimson Red
      doc.text('PREDICTIVE MAINTENANCE REPORT (PdM)', pageW / 2, HEADER_TOP + 8.5, { align: 'center' });

      doc.setFontSize(9);
      doc.setTextColor(0, 89, 156); // NeutraDC Blue
      doc.text('DATA CENTER NEUTRA DC CIKARANG', pageW / 2, HEADER_TOP + 13, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139); // Muted
      doc.text(
        `No: ${data.reportNumber}  |  Ref: ${data.sourceTicketNumber || '-'}  |  Tgl: ${data.sourceMaintenanceDate}`,
        pageW / 2,
        HEADER_TOP + 17,
        { align: 'center' }
      );

      // Garis Pemisah Kop Surat
      doc.setDrawColor(0, 89, 156);
      doc.setLineWidth(0.8);
      doc.line(margin, HEADER_DIVIDER_Y, pageW - margin, HEADER_DIVIDER_Y);
    };

    let currentY = CONTENT_START_Y;

    // Helper: Tambah halaman baru & set Y awal di bawah kop surat
    const addNewPage = () => {
      doc.addPage();
      currentY = CONTENT_START_Y;
    };

    // Helper Section Header dengan proteksi overflow halaman
    const printSectionTitle = (title: string, num: string, minSpaceNeeded = 25) => {
      if (currentY > pageH - minSpaceNeeded) {
        addNewPage();
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(153, 27, 27);
      doc.text(`${num}. `, margin, currentY);
      doc.setTextColor(0, 89, 156);
      doc.text(title.toUpperCase(), margin + 4.5, currentY);
      currentY += 4;
    };

    // ─── 1. IDENTITAS PERALATAN ─────────────────────────────────────────────
    printSectionTitle('Identitas Peralatan & Dokumen Asal', '1', 35);

    autoTable(doc, {
      startY: currentY,
      margin: { top: CONTENT_START_Y, left: margin, right: margin, bottom: 14 },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: [15, 23, 42], font: 'helvetica' },
      columnStyles: { 0: { cellWidth: 38 }, 2: { cellWidth: 30 } },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      body: [
        [
          { content: 'Nama Peralatan', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(data.equipmentName), styles: { fontStyle: 'bold' } },
          { content: 'Tag Unit', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(data.equipmentTag || '-') },
        ],
        [
          { content: 'Kategori Sistem', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(data.systemCategory) },
          { content: 'Lokasi / Ruang', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(data.locationRoom) },
        ],
        [
          { content: 'Ref. Laporan Asal', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: `${sanitizeText(data.sourceMaintenanceName)} (${data.sourceCollection})` },
          { content: 'Tgl Observasi', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(data.sourceMaintenanceDate) },
        ],
      ],
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // ─── 2. KONDISI AKTUAL & GEJALA AWAL ────────────────────────────────────
    printSectionTitle('Kondisi Aktual & Gejala Awal', '2', 40);

    // Health Status Box & Symptoms
    const statusColor = data.healthStatus === 'Critical' ? [185, 28, 28] : data.healthStatus === 'Warning' ? [217, 119, 6] : [37, 99, 235];
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(margin, currentY, 32, 5.5, 1.2, 1.2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`STATUS: ${data.healthStatus.toUpperCase()}`, margin + 16, currentY + 3.8, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const symptomsLines = doc.splitTextToSize(`Gejala Terdeteksi: ${sanitizeText(data.currentSymptoms)}`, contentW - 36);
    doc.text(symptomsLines, margin + 35, currentY + 3.8);

    currentY += Math.max(8, symptomsLines.length * 4 + 2);

    // Tabel Drift Parameter
    const alertRed: [number, number, number] = [185, 28, 28];
    const driftBody = (data.measuredParameterDrift && data.measuredParameterDrift.length > 0)
      ? data.measuredParameterDrift.map(d => [
          sanitizeText(d.parameterName),
          { content: sanitizeText(d.measuredValue), styles: { textColor: alertRed, fontStyle: 'bold' as const } },
          sanitizeText(d.nominalBaseline),
          sanitizeText(d.unit || '-'),
        ])
      : [['Observasi Fisik & Operasional', { content: 'Abnormal', styles: { textColor: alertRed, fontStyle: 'bold' as const } }, 'Normal Baseline', 'Status']];

    autoTable(doc, {
      startY: currentY,
      margin: { top: CONTENT_START_Y, left: margin, right: margin, bottom: 14 },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [15, 23, 42], font: 'helvetica' },
      headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Parameter Operasional', 'Nilai Terukur Aktual', 'Baseline Nominal', 'Satuan']],
      body: driftBody,
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;

    // Foto Bukti Fisik Anomali (Jika Ada)
    if (data.photoEvidenceBase64) {
      if (currentY > pageH - 65) {
        addNewPage();
      }
      try {
        const photoData = data.photoEvidenceBase64.startsWith('data:image')
          ? data.photoEvidenceBase64
          : `data:image/jpeg;base64,${data.photoEvidenceBase64}`;
        doc.addImage(photoData, 'JPEG', margin + (contentW - 65) / 2, currentY, 65, 42);
        currentY += 44;
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'italic');
        doc.text(data.photoCaption || 'Foto Bukti Anomali Fisik Peralatan', pageW / 2, currentY, { align: 'center' });
        currentY += 5;
      } catch (err) {
        console.warn('Gagal memuat foto bukti ke PDF:', err);
      }
    }

    // ─── 3. ANALISIS PREDIKTIF ──────────────────────────────────────────────
    printSectionTitle('Analisis Prediktif (Reliability & Risk Insight)', '3', 50);

    autoTable(doc, {
      startY: currentY,
      margin: { top: CONTENT_START_Y, left: margin, right: margin, bottom: 14 },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42], font: 'helvetica' },
      columnStyles: { 0: { cellWidth: 45 } },
      body: [
        [
          { content: 'Akar Masalah (Root Cause)', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(data.aiAnalysis.rootCauseAnalysis) },
        ],
        [
          { content: 'Potensi Modus Kegagalan', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(data.aiAnalysis.potentialFailureMode) },
        ],
        [
          { content: 'Pola Laju Degradasi', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(data.aiAnalysis.degradationPattern) },
        ],
        [
          { content: 'Estimasi Sisa Umur (RUL)', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(data.aiAnalysis.remainingUsefulLife), styles: { textColor: alertRed, fontStyle: 'bold' } },
        ],
        [
          { content: 'Urgensi & Dampak SLA', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: `[${data.aiAnalysis.urgencyLevel.toUpperCase()}] ${sanitizeText(data.aiAnalysis.slaRiskAssessment)}` },
        ],
        [
          { content: 'Bukti, Keyakinan & Verifikasi', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(
            `${data.analysisMetadata?.evidenceReferences?.map(item => `${item.reference}: ${item.observation}`).join(' | ') || `Sumber: ${data.sourceMaintenanceName} / ${data.sourceTicketNumber || data.sourceDocId}`}. ` +
            `Kualitas bukti: ${data.analysisMetadata?.evidenceQuality || 'Belum dinilai'}; keyakinan: ${data.analysisMetadata?.confidenceLevel || 'Belum dinilai'}. ` +
            `${data.analysisMetadata?.requiresFieldVerification !== false ? 'Wajib verifikasi engineer lapangan.' : ''}`
          ) },
        ],
      ],
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // ─── 4. RENCANA TINDAKAN PREDIKTIF ──────────────────────────────────────
    if (currentY > pageH - 65) {
      addNewPage();
    }

    printSectionTitle('Rencana Tindakan Prediktif (Action Plan)', '4', 40);

    autoTable(doc, {
      startY: currentY,
      margin: { top: CONTENT_START_Y, left: margin, right: margin, bottom: 14 },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42], font: 'helvetica' },
      columnStyles: { 0: { cellWidth: 45 } },
      body: [
        [
          { content: 'Tindakan Segera (1 - 7 Hari)', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(data.actionPlan.immediateAction) },
        ],
        [
          { content: 'Overhaul Terencana (2 - 4 Mgg)', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(data.actionPlan.plannedOverhaulAction) },
        ],
        [
          { content: 'Metode Pengujian Lanjutan', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: sanitizeText(data.actionPlan.followUpTestingMethods?.join('  •  ') || 'Thermography Infrared') },
        ],
      ],
    });

    currentY = (doc as any).lastAutoTable.finalY + 3;

    // Tabel Sparepart Kritis
    if (data.actionPlan.recommendedSpareparts && data.actionPlan.recommendedSpareparts.length > 0) {
      if (currentY > pageH - 35) {
        addNewPage();
      }
      autoTable(doc, {
        startY: currentY,
        margin: { top: CONTENT_START_Y, left: margin, right: margin, bottom: 14 },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, textColor: [15, 23, 42], font: 'helvetica' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        head: [['Suku Cadang Rekomendasi', 'Part Number', 'Jumlah', 'Status Pengadaan']],
        body: data.actionPlan.recommendedSpareparts.map(sp => [
          sanitizeText(sp.partName),
          sanitizeText(sp.partNumber || '-'),
          sanitizeText(String(sp.quantity)),
          sanitizeText(sp.urgency),
        ]),
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;
    } else {
      currentY += 2;
    }

    // ─── 5. LEMBAR PENGESAHAN (APPROVAL SHEET) ──────────────────────────────
    // Total tinggi blok pengesahan: Judul (8mm) + AUTHOR BY (8mm) + Tabel Tanda Tangan 6 baris (~95mm) + margin = ~120mm.
    // Jika sisa halaman tidak mencukupi, pindah ke halaman baru SEBELUM mencetak judul dan AUTHOR BY
    // sehingga seluruh blok pengesahan (termasuk AUTHOR BY) selalu utuh bersama tabel tanda tangan.
    const APPROVAL_BLOCK_HEIGHT = 120;
    if (currentY > pageH - APPROVAL_BLOCK_HEIGHT) {
      addNewPage();
    }

    printSectionTitle('Lembar Pengesahan Resmi', '5', APPROVAL_BLOCK_HEIGHT);

    const authorName =
      data.signatures?.authorName ||
      (data as any).authorName ||
      'Rizki Novri Yanda – Data Center Operation';

    const prepName = data.signatures?.preparedBy?.name || 'Asep Mohammad Fauzi';
    const prepTitle = data.signatures?.preparedBy?.title || '(Electrical Engineer)';

    const revName = 'Arif Budiman';
    const revTitle = '(Technical Manager)';

    const ack1Name = data.signatures?.acknowledgedBy1?.name || 'Habib Mulyana';
    const ack1Title = data.signatures?.acknowledgedBy1?.title || '(Chief Engineer)';

    const ack2Name = data.signatures?.acknowledgedBy2?.name || 'Supriyatno';
    const ack2Title = data.signatures?.acknowledgedBy2?.title || '(Facility manager)';

    const appName = data.signatures?.approvedBy?.name || 'Budi Susanto';
    const appTitle =
      data.signatures?.approvedBy?.title ||
      '(Assistant manager HDC Facility Management)';

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`AUTHOR BY, ${sanitizeText(authorName)}`, margin, currentY + 1);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      margin: { top: CONTENT_START_Y, left: margin, right: margin, bottom: 14 },
      pageBreak: 'avoid',
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42], font: 'helvetica', halign: 'center' },
      body: [
        [
          { content: 'PREPARED BY,', styles: { fontStyle: 'bold', fillColor: [220, 230, 241], textColor: [0, 0, 0] } },
          { content: 'REVIEWED BY,', styles: { fontStyle: 'bold', fillColor: [220, 230, 241], textColor: [0, 0, 0] } },
        ],
        [
          { content: `\n\n\n${prepName}\n${prepTitle}` },
          { content: `\n\n\n${revName}\n${revTitle}` },
        ],
        [
          { content: 'ACKNOWLEDGED BY,', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [220, 230, 241], textColor: [0, 0, 0] } },
        ],
        [
          { content: `\n\n\n${ack1Name}\n${ack1Title}` },
          { content: `\n\n\n${ack2Name}\n${ack2Title}` },
        ],
        [
          { content: 'APPROVED BY,', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [220, 230, 241], textColor: [0, 0, 0] } },
        ],
        [
          { content: `\n\n\n${appName}\n${appTitle}`, colSpan: 2 },
        ],
      ],
    });

    // ─── KOP SURAT HEADER & NOMOR HALAMAN DI SETIAP HALAMAN ────────────────
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawHeader();
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Predictive Report — ${sanitizeText(data.equipmentName)}  |  Hal ${i} dari ${totalPages}`,
        pageW - margin,
        pageH - 6,
        { align: 'right' }
      );
    }

    const cleanFilename = `Predictive_Report_${data.equipmentName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${data.reportNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    doc.save(cleanFilename);
    toast.success('Laporan PDF Predictive Maintenance berhasil diunduh!', { id: toastId });
  } catch (error: any) {
    console.error('Error generating Predictive Report PDF:', error);
    toast.error(`Gagal membuat PDF: ${error?.message || 'Error tidak diketahui'}`, { id: toastId });
  }
}
