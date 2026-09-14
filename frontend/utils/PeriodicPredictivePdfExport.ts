// ============================================================================
// FILE: frontend/utils/PeriodicPredictivePdfExport.ts
// Deskripsi: Generator Dokumen PDF Resmi untuk Laporan Predictive Maintenance (PdM)
//            & Reliability Forecast Periodik (Bulanan & Tahunan)
//            Data Center NeutraDC Cikarang — PT Dwimitra Ekatama Mandiri.
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PeriodicPredictiveReportData } from '@/types/periodicPredictiveTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { toast } from 'sonner';

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

export async function exportPeriodicPredictiveReportToPdf(data: PeriodicPredictiveReportData): Promise<void> {
  const toastId = toast.loading('Membuat Dokumen PDF Predictive Periodik...');

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

    const [logoDmeBase64, logoNdcBase64] = await Promise.all([
      loadImageBase64(logoDwimitra),
      loadImageBase64(logoNeutraDC),
    ]);

    let currentY = 12;

    // ─── KOP SURAT DUAL LOGO ─────────────────────────────────────────────────
    if (logoDmeBase64) {
      doc.addImage(logoDmeBase64, 'PNG', margin, currentY, 32, 13);
    }
    if (logoNdcBase64) {
      doc.addImage(logoNdcBase64, 'PNG', pageW - margin - 32, currentY, 32, 13);
    }

    // Teks Header Tengah
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('PT DWIMITRA EKATAMA MANDIRI', pageW / 2, currentY + 3.5, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(107, 33, 168); // Purple Secondary
    doc.text(
      data.periodType === 'monthly'
        ? 'EXECUTIVE PREDICTIVE MAINTENANCE REPORT (BULANAN)'
        : 'ANNUAL ASSET RELIABILITY & CAPEX/OPEX FORECAST (TAHUNAN)',
      pageW / 2,
      currentY + 8.5,
      { align: 'center' }
    );

    doc.setFontSize(9);
    doc.setTextColor(0, 89, 156);
    doc.text('DATA CENTER NEUTRA DC CIKARANG', pageW / 2, currentY + 13, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `No: ${data.reportNumber}  |  Periode: ${data.periodType === 'monthly' ? `${data.monthName} ${data.year}` : `Tahun ${data.year}`}`,
      pageW / 2,
      currentY + 17,
      { align: 'center' }
    );

    // Garis Pemisah
    currentY += 21;
    doc.setDrawColor(0, 89, 156);
    doc.setLineWidth(0.8);
    doc.line(margin, currentY, pageW - margin, currentY);

    doc.setDrawColor(153, 27, 27);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY + 1, pageW - margin, currentY + 1);

    currentY += 5;

    // ─── SECTION 1: RINGKASAN EKSEKUTIF ─────────────────────────────────────
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2, textColor: [15, 23, 42] },
      head: [
        [
          {
            content: 'I. RINGKASAN EKSEKUTIF & INDEKS KEANDALAN FASILITAS',
            colSpan: 2,
            styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [107, 33, 168] },
          },
        ],
      ],
      body: [
        [
          { content: 'Periode Analisis:', styles: { fontStyle: 'bold', cellWidth: 45 } },
          { content: data.periodType === 'monthly' ? `Bulanan (${data.monthName} ${data.year})` : `Tahunan (Tahun ${data.year})` },
        ],
        [
          { content: 'Facility Health Score:', styles: { fontStyle: 'bold' } },
          { content: `${data.facilityHealthScore} / 100 (${data.overallStatus})` },
        ],
        [
          { content: 'Total Kejadian CM & Temuan:', styles: { fontStyle: 'bold' } },
          { content: `${data.totalCMEvents} Kejadian CM  |  ${data.totalAbnormalFindings} Temuan Abnormal  |  ${data.totalSparepartsReplaced} Komponen Diganti` },
        ],
        [
          { content: 'Ringkasan Eksekutif AI:', styles: { fontStyle: 'bold' } },
          { content: sanitizeText(data.executiveSummary) },
        ],
      ],
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;

    // ─── SECTION 2: EVALUASI PER SUB-SISTEM ─────────────────────────────────
    const systemRows = (data.systemAssessments || []).map(sys => [
      sys.systemName,
      sys.riskLevel,
      `${sys.healthScore}/100`,
      sanitizeText(sys.aiInsight || (sys.criticalIssues && sys.criticalIssues.join('; ')) || '-')
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [
        [
          { content: 'Sub-Sistem', styles: { cellWidth: 42 } },
          { content: 'Risiko', styles: { cellWidth: 22, halign: 'center' } },
          { content: 'Health', styles: { cellWidth: 20, halign: 'center' } },
          { content: 'Analisis Prediktif AI & Catatan Keandalan' },
        ],
      ],
      body: systemRows,
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;

    // Cek kebutuhan new page
    if (currentY > pageH - 70) {
      doc.addPage();
      currentY = 15;
    }

    // ─── SECTION 3: BAD ACTOR ASSETS ────────────────────────────────────────
    const badActorRows = (data.badActorAssets || []).map(asset => [
      `${asset.equipmentName}\n(${asset.systemCategory})`,
      `${asset.incidentCount}x`,
      sanitizeText((asset.failureModes || []).join(', ') || '-'),
      asset.estimatedRUL || '-',
      sanitizeText(asset.recommendation || '-')
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [107, 33, 168], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [
        [
          { content: 'Peralatan Bad Actor', styles: { cellWidth: 45 } },
          { content: 'Freq', styles: { cellWidth: 15, halign: 'center' } },
          { content: 'Modus Kegagalan', styles: { cellWidth: 40 } },
          { content: 'Estimasi RUL', styles: { cellWidth: 25, halign: 'center' } },
          { content: 'Rekomendasi AI' },
        ],
      ],
      body: badActorRows,
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;

    if (currentY > pageH - 65) {
      doc.addPage();
      currentY = 15;
    }

    // ─── SECTION 4: SPAREPART FORECAST ──────────────────────────────────────
    const sparepartRows = (data.sparepartForecast || []).map(sp => [
      sp.partName,
      String(sp.estimatedNeeded),
      sp.currentStockStatus,
      sanitizeText(sp.justification || '-')
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [
        [
          { content: 'Komponen Suku Cadang Kritis', styles: { cellWidth: 55 } },
          { content: 'Prediksi Kebutuhan', styles: { cellWidth: 30, halign: 'center' } },
          { content: 'Status Pengadaan', styles: { cellWidth: 35, halign: 'center' } },
          { content: 'Justifikasi Degradasi' },
        ],
      ],
      body: sparepartRows,
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;

    if (currentY > pageH - 60) {
      doc.addPage();
      currentY = 15;
    }

    // ─── SECTION 5: ACTION PLAN & CAPEX ─────────────────────────────────────
    const actionPlanBody = [
      [
        { content: 'Tindakan Preventif Terjadwal (Bulan Berikutnya):', styles: { fontStyle: 'bold', textColor: [0, 89, 156] } },
      ],
      [
        { content: sanitizeText((data.actionPlan?.immediatePreventive || []).map(a => `• ${a}`).join('\n')) },
      ],
      [
        { content: 'Jadwal Overhaul Terencana (Next Quarter):', styles: { fontStyle: 'bold', textColor: [107, 33, 168] } },
      ],
      [
        { content: sanitizeText((data.actionPlan?.scheduledOverhauls || []).map(a => `• ${a}`).join('\n')) },
      ],
      [
        { content: 'Rekomendasi Alokasi Peremajaan Unit / CAPEX (Next Fiscal Year):', styles: { fontStyle: 'bold', textColor: [153, 27, 27] } },
      ],
      [
        { content: sanitizeText((data.actionPlan?.capexReplacementRecommendations || []).map(a => `• ${a}`).join('\n')) },
      ],
    ];

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'plain',
      styles: { fontSize: 7.5, cellPadding: 2 },
      head: [
        [
          {
            content: 'V. RENCANA TINDAKAN & REKOMENDASI ALOKASI ANGGARAN (CAPEX/OPEX)',
            styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [107, 33, 168] },
          },
        ],
      ],
      body: actionPlanBody as any,
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;

    if (currentY > pageH - 45) {
      doc.addPage();
      currentY = 15;
    }

    // ─── SECTION 6: PENGESAHAN ───────────────────────────────────────────────
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.5, halign: 'center' },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      head: [
        [
          { content: 'DISUSUN OLEH\nStandby Engineer' },
          { content: 'DIPERIKSA OLEH\nQC & Commissioning DME' },
          { content: 'DISETUJUI OLEH\nFacility Manager / NeutraDC' },
        ],
      ],
      body: [
        [
          { content: `\n\n\n\n${data.signatures?.preparedBy?.name || 'Standby Engineer'}\n(Tgl: ${data.signatures?.preparedBy?.date || '-'})` },
          { content: `\n\n\n\n${data.signatures?.verifiedBy?.name || 'QC DME Engineer'}\n(Tgl: ${data.signatures?.verifiedBy?.date || '-'})` },
          { content: `\n\n\n\n${data.signatures?.approvedBy?.name || 'Operations Manager'}\n(Tgl: ${data.signatures?.approvedBy?.date || '-'})` },
        ],
      ],
    });

    // ─── FOOTER NUMBERING ───────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Laporan Predictive Maintenance Periodik — NeutraDC Data Center | Hal ${p} dari ${totalPages}`,
        pageW / 2,
        pageH - 6,
        { align: 'center' }
      );
    }

    const cleanFilename = data.periodType === 'monthly'
      ? `Laporan_Predictive_Bulanan_${data.monthName}_${data.year}.pdf`
      : `Laporan_Predictive_Tahunan_${data.year}.pdf`;

    doc.save(cleanFilename);
    toast.success('Berkas PDF Predictive Periodik berhasil diunduh!', { id: toastId });
  } catch (err: any) {
    console.error('Error generating periodic predictive PDF:', err);
    toast.error(`Gagal membuat PDF: ${err?.message || 'Terjadi kesalahan sistem'}`, { id: toastId });
  }
}
