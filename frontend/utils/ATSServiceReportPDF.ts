import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ATSCustomerInfo, ATSReportData, ATSTimeSpent } from '@/types/atsReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { compressBase64Image } from '@/utils/imageCompression';
import { toast } from 'sonner';

// ─── Color Constants ─────────────────────────────────────────────────
const HEADER_SUB = [195, 210, 230];  // Light blue/grey sub header
const DARK_TEXT: [number, number, number] = [30, 30, 30];

/** Load an image URL as base64 data URL */
async function loadImageBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Generate a professional ATS Service Report PDF matching the exact layout.
 */
export async function generateATSServiceReportPDF(
  customerInfo: ATSCustomerInfo,
  reportData: ATSReportData,
  timeSpent: ATSTimeSpent,
  originalReportCards?: Array<{ photoBase64?: string; description: string }>
) {
  // Load and compress originalReportCards if present
  let optimizedCards = originalReportCards || [];
  if (originalReportCards && originalReportCards.length > 0) {
    toast.loading('Mengompresi foto dokumentasi...', { id: 'pdf-compress' });
    optimizedCards = await Promise.all(
      originalReportCards.map(async (c) => {
        if (!c.photoBase64) return c;
        try {
          const compressed = await compressBase64Image(c.photoBase64, { maxWidth: 800, quality: 0.5 });
          return { ...c, photoBase64: compressed };
        } catch (err) {
          console.error('Failed to compress documentation image for PDF', err);
          return c;
        }
      })
    );
    toast.dismiss('pdf-compress');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 8;
  const contentW = pageW - 2 * margin;
  let y = margin;

  // Draw blue stripe at the very top edge of page 1
  doc.setFillColor(0, 89, 156);
  doc.rect(0, 0, pageW, 2.5, 'F');

  // Helper to add page and automatically draw the blue top stripe
  const addPage = () => {
    doc.addPage();
    doc.setFillColor(0, 89, 156);
    doc.rect(0, 0, pageW, 2.5, 'F');
  };

  // Load logos
  let logoLeft: string | null = null;
  let logoRight: string | null = null;
  try { logoLeft = await loadImageBase64(logoDwimitra); } catch { /* fallback */ }
  try { logoRight = await loadImageBase64(logoNeutraDC); } catch { /* fallback */ }

  // ─── HEADER ────────────────────────────────────────────────────────
  const headerH = 18;
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentW, headerH);

  // Left logo
  if (logoLeft) {
    doc.addImage(logoLeft, 'PNG', margin + 2, y + 3, 28, 12);
  }

  // Center text
  const centerX = pageW / 2;
  doc.setFontSize(11).setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('LAPORAN LAYANAN AUTOMATIC TRANSFER SWITCH', centerX, y + 7, { align: 'center' });
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text('Neutra DC Cikarang', centerX, y + 12, { align: 'center' });

  // Right logo
  if (logoRight) {
    doc.addImage(logoRight, 'PNG', pageW - margin - 28, y + 4, 24, 10);
  }

  y += headerH + 2;

  // ─── CUSTOMER INFO ─────────────────────────────────────────────────
  // Blue header bar
  doc.setFillColor(0, 89, 156);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Pelanggan', margin + 2, y + 3.5);
  y += 5;

  const formattedDate = customerInfo.date
    ? new Date(customerInfo.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const customerRows = [
    ['Nama Perusahaan', customerInfo.companyName, 'Tipe', customerInfo.type, 'Spesifikasi', customerInfo.specification, 'No. Mop:', customerInfo.mapNo],
    ['Nama Alat', customerInfo.equipmentName, 'No. Seri', customerInfo.serialNo, '', '', 'Kuartal', customerInfo.quarter],
    ['Deskripsi CI', customerInfo.ciDescription, 'Nama Produk', customerInfo.productName, 'Lokasi', customerInfo.location, 'Tanggal', formattedDate],
    ['Nama CI', customerInfo.ciName, 'Tahun Produk', customerInfo.productYears, 'Area', customerInfo.area, 'Teknisi', customerInfo.engineer],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: customerRows,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 18 },
      1: { cellWidth: 25 },
      2: { fontStyle: 'bold', cellWidth: 18 },
      3: { cellWidth: 22 },
      4: { fontStyle: 'bold', cellWidth: 18 },
      5: { cellWidth: 28 },
      6: { fontStyle: 'bold', cellWidth: 16 },
      7: { cellWidth: contentW - 145 },
    },
    didParseCell(data) {
      if (data.column.index % 2 === 0) {
        data.cell.styles.fillColor = HEADER_SUB as any;
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 1;

  // ─── VISUAL INSPECTION & CHECK ─────────────────────────────────────
  // Blue header
  doc.setFillColor(0, 89, 156);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Pemeriksaan & Cek Visual', margin + 2, y + 3.5);
  y += 5;

  const viHeaders = [
    [
      { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Kegiatan', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Parameter', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Kondisi', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Keterangan', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
    ],
    [
      { content: 'Baik', styles: { halign: 'center' } },
      { content: 'Tidak Baik', styles: { halign: 'center' } }
    ]
  ] as any;
  const viBody = reportData.visual_inspection.map(item => [
    `${item.no}.`,
    item.activity,
    item.parameter,
    item.condition === 'Good' ? 'Baik' : '',
    item.condition === 'Not Good' ? 'Tidak Baik' : '',
    item.remarks,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: viHeaders,
    body: viBody,
    theme: 'grid',
    styles: { fontSize: 5.0, cellPadding: 0.5, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT },
    headStyles: { fillColor: HEADER_SUB as any, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: contentW - 100 },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 32 },
    },
    didParseCell(data) {
      if (data.section === 'body') {
        if (data.column.index === 3 && data.cell.raw === 'Baik') {
          data.cell.styles.textColor = [0, 128, 0];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 4 && data.cell.raw === 'Tidak Baik') {
          data.cell.styles.textColor = [200, 0, 0];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 0.6;

  // ─── DIGITAL POWER METER RECORDING ─────────────────────────────────
  doc.setFillColor(0, 89, 156);
  doc.rect(margin, y, contentW, 4, 'F');
  doc.setFontSize(5.5).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Pencatatan Digital Power Meter  Harap tandai OK (V), tidak OK (X), tidak berlaku (N/A) di dalam kotak', margin + 2, y + 2.8);
  y += 4;

  const pmHeaders = [['Kabel', 'Hasil (Tegangan)', 'Kabel', 'Hasil (Tegangan)', 'Kabel', 'Hasil', 'Kabel', 'Hasil\n(Ampere)', 'Keterangan']];
  const pm = reportData.power_meter_recording;
  const pmBody = [
    ['R-S', pm.rs.voltage, 'R-N', pm.rn.voltage, 'KW', pm.kw, 'R', pm.r_ampere, ''],
    ['S-T', pm.st.voltage, 'S-N', pm.sn.voltage, 'KVA', pm.kva, 'S', pm.s_ampere, ''],
    ['T-R', pm.tr.voltage, 'T-N', pm.tn.voltage, 'KVAR', pm.kvar, 'T', pm.t_ampere, ''],
    ['', '', 'N', pm.n.voltage, 'Cos p', pm.cos_p, 'N', pm.n_ampere, ''],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: pmHeaders,
    body: pmBody,
    theme: 'grid',
    styles: { fontSize: 5.2, cellPadding: 0.5, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT, halign: 'center' },
    headStyles: { fillColor: HEADER_SUB as any, textColor: DARK_TEXT, fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 12 },
      2: { fontStyle: 'bold', cellWidth: 12 },
      4: { fontStyle: 'bold', cellWidth: 12 },
      6: { fontStyle: 'bold', cellWidth: 12 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 0.6;

  // ─── VOLTAGE & CURRENT MEASUREMENT ─────────────────────────────────
  doc.setFillColor(0, 89, 156);
  doc.rect(margin, y, contentW, 4, 'F');
  doc.setFontSize(5.5).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Pengukuran Tegangan & Arus', margin + 2, y + 2.8);
  y += 4;

  const vc = reportData.voltage_current;
  const vcHeaders = [['Kabel', 'Hasil (Tegangan)', 'Kabel', 'Hasil (Tegangan)', 'Kabel', 'Hasil (Ampere)', 'Standar', 'Keterangan']];
  const vcBody = [
    ['R-S', vc.voltage_rs, 'R-N', vc.voltage_rn, 'R', vc.ampere_r, '', ''],
    ['S-T', vc.voltage_st, 'S-N', vc.voltage_sn, 'S', vc.ampere_s, '+5% - 10% dari 380V &\n220V deviasi beban 10%', ''],
    ['T-R', vc.voltage_tr, 'T-N', vc.voltage_tn, 'T', vc.ampere_t, '', ''],
    ['', '', 'N-G', vc.voltage_ng, 'N', '', '', ''],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: vcHeaders,
    body: vcBody,
    theme: 'grid',
    styles: { fontSize: 5.2, cellPadding: 0.5, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT, halign: 'center' },
    headStyles: { fillColor: HEADER_SUB as any, textColor: DARK_TEXT, fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 12 },
      1: { cellWidth: 22 },
      2: { fontStyle: 'bold', cellWidth: 12 },
      3: { cellWidth: 22 },
      4: { fontStyle: 'bold', cellWidth: 12 },
      5: { cellWidth: 22 },
      6: { cellWidth: 34, fontSize: 4.8, textColor: [200, 0, 0] as any },
      7: { cellWidth: contentW - 136 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 0.6;

  // ─── THERMAL MEASUREMENT ───────────────────────────────────────────
  doc.setFillColor(0, 89, 156);
  doc.rect(margin, y, contentW, 4, 'F');
  doc.setFontSize(5.5).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Pengukuran Termal  Harap tandai OK (V), tidak OK (X), tidak berlaku (N/A) di dalam kotak', margin + 2, y + 2.8);
  y += 4;

  const therm = reportData.thermal_measurement;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['', 'Hasil Suhu (°C)', 'Standar', 'Keterangan']],
    body: [
      ['Breaker', '', '', ''],
      ['', therm.result_temperature ? `${therm.result_temperature}°C` : '', '40°C', therm.remarks],
    ],
    theme: 'grid',
    styles: { fontSize: 5.2, cellPadding: 0.6, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT, halign: 'center' },
    headStyles: { fillColor: HEADER_SUB as any, textColor: DARK_TEXT, fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', halign: 'left' } },
  });

  y = (doc as any).lastAutoTable.finalY + 0.6;

  // ─── GROUNDING RESISTANCE ──────────────────────────────────────────
  doc.setFillColor(0, 89, 156);
  doc.rect(margin, y, contentW, 4, 'F');
  doc.setFontSize(5.5).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Pengukuran Tahanan Grounding  Harap tandai OK (V), tidak OK (X), tidak berlaku (N/A) di dalam kotak', margin + 2, y + 2.8);
  y += 4;

  const gnd = reportData.grounding_resistance;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Kabel', 'Hasil (Ohm)', 'Standar', 'Keterangan']],
    body: [['Grounding', gnd.result_ohm || '—', '<5 Ohm', gnd.remarks]],
    theme: 'grid',
    styles: { fontSize: 5.2, cellPadding: 0.6, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT, halign: 'center' },
    headStyles: { fillColor: HEADER_SUB as any, textColor: DARK_TEXT, fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', halign: 'left' } },
  });

  y = (doc as any).lastAutoTable.finalY + 0.6;

  // ─── OPERATION STATUS ──────────────────────────────────────────────
  const ops = reportData.operation_status;
  const opsBody = [
    [
      { content: ops.is_normal ? '[x] Operasi normal' : '[ ] Operasi normal', colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fontSize: 5.2 } },
      { content: 'Keterangan:', styles: { fontStyle: 'bold', fillColor: HEADER_SUB, fontSize: 5.2 } },
      { content: ops.remark || '', colSpan: 3, styles: { halign: 'left', fontSize: 5.2 } }
    ],
    [
      { content: !ops.is_normal ? '[x] Operasi tidak normal' : '[ ] Operasi tidak normal', colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fontSize: 5.2 } },
      { content: 'Gejala kerusakan', styles: { fontStyle: 'bold', fillColor: HEADER_SUB, fontSize: 5.2 } },
      { content: ops.fault_symptom || '', colSpan: 3, styles: { halign: 'left', fontSize: 5.2 } }
    ],
    [
      { content: '(Harap isi bagian ini jika layanan berupa perbaikan)', colSpan: 2, styles: { halign: 'left', fontStyle: 'italic', fontSize: 4.2, textColor: [100, 100, 100] } },
      { content: 'Analisis kerusakan', styles: { fontStyle: 'bold', fillColor: HEADER_SUB, fontSize: 5.2 } },
      { content: ops.fault_analysis || '', colSpan: 3, styles: { halign: 'left', fontSize: 5.2 } }
    ],
    [
      { content: '', colSpan: 2 },
      { content: 'Pekerjaan selesai/\ntindakan diambil', styles: { fontStyle: 'bold', fillColor: HEADER_SUB, fontSize: 5.2 } },
      { content: ops.work_done || '', colSpan: 3, styles: { halign: 'left', fontSize: 5.2 } }
    ],
    [
      { content: '', colSpan: 2 },
      { content: 'SN Bagian Rusak', styles: { fontStyle: 'bold', fillColor: HEADER_SUB, fontSize: 5.2 } },
      { content: ops.fault_part_sn || '', styles: { halign: 'left', fontSize: 5.2 } },
      { content: 'Nama Bagian Rusak', styles: { fontStyle: 'bold', fillColor: HEADER_SUB, fontSize: 5.2 } },
      { content: ops.fault_part_name || '', styles: { halign: 'left', fontSize: 5.2 } }
    ]
  ] as any;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: opsBody,
    theme: 'grid',
    styles: { fontSize: 5.2, cellPadding: 0.6, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 35 },
      2: { cellWidth: 22 },
      3: { cellWidth: 34 },
      4: { cellWidth: 28 },
      5: { cellWidth: contentW - 154 }
    }
  });

  y = (doc as any).lastAutoTable.finalY;

  y += 0.6;

  // ─── TIME SPENT ────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 153);
  doc.rect(margin, y, contentW, 4, 'F');
  doc.setFontSize(6.5).setFont('helvetica', 'bolditalic').setTextColor(30, 30, 30);
  doc.text('WAKTU PENGERJAAN', margin + 2, y + 2.8);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Tanggal', 'Keberangkatan', 'Mulai', 'Selesai']],
    body: [[timeSpent.date, timeSpent.departure, timeSpent.start, timeSpent.finish]],
    theme: 'grid',
    styles: { fontSize: 6.0, cellPadding: 0.8, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT, halign: 'center' },
    headStyles: { fillColor: [255, 255, 204] as any, textColor: DARK_TEXT, fontStyle: 'bold' },
  });

  y = (doc as any).lastAutoTable.finalY + 2.5;

  // ─── CUSTOMER ACKNOWLEDGEMENT ──────────────────────────────────────
  doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(30, 30, 30);
  doc.text('PERSETUJUAN PELANGGAN:', centerX, y, { align: 'center' });
  y += 3;

  const sigColW = contentW / 3;
  const sigLabels = ['Disiapkan', 'Diperiksa', 'Disetujui'];
  const sigTitles = ['Teknisi', 'SM/PM', 'Klien / Pemilik'];

  sigLabels.forEach((label, i) => {
    const sx = margin + i * sigColW + sigColW / 2;
    doc.setFontSize(6.5).setFont('helvetica', 'bold');
    doc.text(label, sx, y + 1.5, { align: 'center' });
    doc.setLineWidth(0.2);
    doc.line(margin + i * sigColW + 8, y + 12, margin + (i + 1) * sigColW - 8, y + 12);
    doc.setFontSize(6.5).setFont('helvetica', 'bold');
    doc.text(sigTitles[i], sx, y + 15, { align: 'center' });
  });

  // ─── DOCUMENTATION PAGES ──────────────────────────────────────────
  if (optimizedCards && optimizedCards.length > 0) {
    const cols = 3;
    const photoH = 50;
    const capH = 10;
    const gap = 4;
    const perPage = 9;

    const drawDocHeader = (doc: any) => {
      // 1. Draw solid blue stripe at the very top edge of the page
      doc.setFillColor(0, 89, 156);
      doc.rect(0, 0, pageW, 2.5, 'F');

      const headerY = 6;
      const headerH = 22;

      // Draw border box with thin border
      doc.setDrawColor(226, 232, 240).setLineWidth(0.1).setFillColor(255, 255, 255);
      doc.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'FD');

      // Draw vertical separator lines inside the header box
      const col1W = 35;
      const col3W = 35;
      doc.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
      doc.line(pageW - margin - col3W, headerY, pageW - margin - col3W, headerY + headerH);

      // Left logo
      if (logoLeft) {
        doc.addImage(logoLeft, 'PNG', margin + 3, headerY + 4, col1W - 6, 14, undefined, 'FAST');
      }

      // Right logo
      if (logoRight) {
        doc.addImage(logoRight, 'PNG', pageW - margin - col3W + 5, headerY + 5.5, col3W - 10, 11, undefined, 'FAST');
      }

      // Center text
      const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
      
      // "LAPORAN MAINTENANCE"
      doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(0, 89, 156);
      doc.text('LAPORAN MAINTENANCE', centerX, headerY + 6.5, { align: 'center' });
      
      // "DOKUMENTASI PM: ATS"
      doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(30, 30, 30);
      doc.text('DOKUMENTASI PM: ATS', centerX, headerY + 11.5, { align: 'center' });
      
      // Unit detail specification
      doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(0, 89, 156);
      doc.text(customerInfo.specification ? customerInfo.specification.toUpperCase() : 'ATS UNIT', centerX, headerY + 16, { align: 'center' });
      
      // Date info
      const displayDate = customerInfo.date
        ? new Date(customerInfo.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
        : '';
      doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(100, 100, 100);
      doc.text(`Tanggal Maintenance: ${displayDate}`, centerX, headerY + 20, { align: 'center' });

      // Return next Y coordinate where grid starts
      return headerY + headerH + 4;
    };

    let pageStart = 0;

    while (pageStart < optimizedCards.length) {
      const pageCards = optimizedCards.slice(pageStart, pageStart + perPage);

      addPage();
      y = drawDocHeader(doc);

      // Draw grid
      for (let i = 0; i < pageCards.length; i += cols) {
        const row = pageCards.slice(i, i + cols);
        for (let j = 0; j < row.length; j++) {
          const x = margin + j * (contentW / cols);
          const cardX = x;
          const cardY = y;
          const cardW = (contentW / cols) - 2;

          // Draw card outline
          doc.setFillColor(255, 255, 255).setDrawColor(220, 228, 240).setLineWidth(0.2);
          doc.roundedRect(cardX, cardY, cardW, photoH + capH, 1, 1, 'FD');

          const card = row[j];
          if (card.photoBase64) {
            // Draw image
            doc.addImage(card.photoBase64, 'JPEG', cardX + 1, cardY + 1, cardW - 2, photoH - 2, undefined, 'FAST');
          } else {
            doc.setFillColor(241, 245, 249).rect(cardX + 0.5, cardY + 0.5, cardW - 1, photoH - 1, 'F');
            doc.setFontSize(7).setTextColor(100).text('Tidak Ada Foto', cardX + cardW / 2, cardY + photoH / 2, { align: 'center' });
          }

          // Draw horizontal division line
          doc.setDrawColor(220, 228, 240).setLineWidth(0.3);
          doc.line(cardX, cardY + photoH, cardX + cardW, cardY + photoH);

          // Draw caption
          doc.setFontSize(6).setFont('helvetica', 'normal').setTextColor(30, 30, 30);
          const splitCaption = doc.splitTextToSize(card.description || '', cardW - 4);
          doc.text(splitCaption.slice(0, 2), cardX + 2, cardY + photoH + 4);
        }
        y += photoH + capH + gap;
      }

      pageStart += perPage;
    }
  }

  // ─── FOOTER ────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    
    // Draw bottom blue stripe
    doc.setFillColor(0, 89, 156);
    doc.rect(0, pageH - 2.5, pageW, 2.5, 'F');

    // Page number and company text
    doc.setFontSize(7.5).setTextColor(100, 116, 139);
    doc.text('PT DWIMITRA EKATAMA MANDIRI — Laporan Layanan ATS', margin, pageH - 5);
    doc.text(`Halaman ${pg} dari ${totalPages}`, pageW - margin, pageH - 5, { align: 'right' });
  }

  // ─── SAVE ──────────────────────────────────────────────────────────
  const filename = `Service_Report_ATS_${customerInfo.mapNo || 'Report'}_${customerInfo.date || 'undated'}.pdf`;
  doc.save(filename);
}
