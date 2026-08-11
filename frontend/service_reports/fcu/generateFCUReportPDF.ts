import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FCUCustomerInfo, FCUReportData, FCUTimeSpent } from '@/types/fcuReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { compressBase64Image } from '@/utils/imageCompression';
import { toEnglishText } from '@/utils/translator';
import { toast } from 'sonner';

// Color Constants
const HEADER_BLUE: [number, number, number] = [0, 89, 156];
const HEADER_SUB: [number, number, number] = [195, 210, 230];
const DARK_TEXT: [number, number, number] = [30, 30, 30];

async function loadImageBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
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
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Generate PDF Service Report FCU (Fan Coil Unit) Neutra DC Cikarang
 */
export async function generateFCUServiceReportPDF(
  customerInfo: FCUCustomerInfo,
  reportData: FCUReportData,
  timeSpent: FCUTimeSpent,
  originalReportCards?: Array<{ photoBase64?: string; description: string }>,
  saveToFile: boolean = true
) {
  let optimizedCards = originalReportCards || [];
  if (originalReportCards && originalReportCards.length > 0) {
    toast.loading('Compressing documentation photos...', { id: 'pdf-fcu-compress' });
    optimizedCards = await Promise.all(
      originalReportCards.map(async (c) => {
        if (!c.photoBase64) return c;
        try {
          const compressed = await compressBase64Image(c.photoBase64, { maxWidth: 800, quality: 0.5 });
          return { ...c, photoBase64: compressed };
        } catch (err) {
          console.error('Failed to compress FCU photo for PDF', err);
          return c;
        }
      })
    );
    toast.dismiss('pdf-fcu-compress');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 8;
  const contentW = pageW - 2 * margin;
  let y = margin;

  // Blue top stripe
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(0, 0, pageW, 2.5, 'F');

  const addPage = () => {
    doc.addPage();
    doc.setFillColor(...HEADER_BLUE);
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

  if (logoLeft) {
    doc.addImage(logoLeft, 'PNG', margin + 2, y + 3, 28, 12);
  }

  const centerX = pageW / 2;
  doc.setFontSize(11).setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_TEXT);
  doc.text('SERVICE REPORT FCU (Fan Coil Unit)', centerX, y + 7, { align: 'center' });
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text('Neutra DC Cikarang', centerX, y + 12, { align: 'center' });

  if (logoRight) {
    doc.addImage(logoRight, 'PNG', pageW - margin - 28, y + 4, 24, 10);
  }

  y += headerH + 2;

  // ─── 1. CUSTOMER INFORMATION ───────────────────────────────────────
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Customer Information', margin + 2, y + 3.5);
  y += 5;

  const formattedDate = customerInfo.date
    ? new Date(customerInfo.date).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const customerRows = [
    ['Company Name', customerInfo.companyName, 'Type', customerInfo.type, 'Specification', customerInfo.specification, 'Mop No:', customerInfo.mopNo],
    ['Equipment Name', customerInfo.equipmentName, 'Serial No:', customerInfo.serialNo, '', '', 'Quarter', customerInfo.quarter],
    ['CI Description', customerInfo.ciDescription, 'Product Name', customerInfo.productName, 'Location', customerInfo.location, 'Date', formattedDate],
    ['CI Name', customerInfo.ciName, 'Product Years', customerInfo.productYears, 'Area', customerInfo.area, 'Engineer', customerInfo.engineer],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: customerRows,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 22 },
      1: { cellWidth: 23 },
      2: { fontStyle: 'bold', cellWidth: 22 },
      3: { cellWidth: 20 },
      4: { fontStyle: 'bold', cellWidth: 22 },
      5: { cellWidth: 24 },
      6: { fontStyle: 'bold', cellWidth: 16 },
      7: { cellWidth: contentW - 149 },
    },
    didParseCell(data) {
      if (data.column.index % 2 === 0) {
        data.cell.styles.fillColor = HEADER_SUB;
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 1;

  // ─── 2. VISUAL INSPECTION & MAINTENANCE ──────────────────────────────
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Visual Inspection & Maintenance', margin + 2, y + 3.5);
  y += 5;

  const viHeaders = [
    [
      { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Activity', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Parameter', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Condition', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Remarks', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
    ],
    [
      { content: 'Good', styles: { halign: 'center' } },
      { content: 'Not Good', styles: { halign: 'center' } }
    ]
  ] as any;

  const viBody = reportData.visual_inspection.map(item => [
    item.no,
    item.activity,
    item.parameter,
    item.condition === 'Good' ? '✓' : '',
    item.condition === 'Not good' ? '✓' : '',
    item.remarks,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: viHeaders,
    body: viBody,
    theme: 'grid',
    styles: { fontSize: 5.0, cellPadding: 0.5, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT },
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: contentW - 100 },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 32 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 1;

  // ─── 3. CLEANING ───────────────────────────────────────────────────
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Cleaning  Please mark OK (✓), not OK (×), not applicable (N/A) in the box', margin + 2, y + 3.5);
  y += 5;

  const cleaningBody = reportData.cleaning.map(item => [
    item.no,
    item.activity,
    item.parameter,
    item.condition === 'Good' ? '✓' : '',
    item.condition === 'Not good' ? '✓' : '',
    item.remarks,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: viHeaders,
    body: cleaningBody,
    theme: 'grid',
    styles: { fontSize: 5.0, cellPadding: 0.5, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT },
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: contentW - 100 },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 32 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 1;

  // Check new page space for Measurement
  if (y > 230) {
    addPage();
    y = margin + 5;
  }

  // ─── 4. MEASUREMENT ────────────────────────────────────────────────
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Measurement  Please mark OK (✓), not OK (×), not applicable (N/A) in the box', margin + 2, y + 3.5);
  y += 5;

  const measHeaders = [
    [
      { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Activity', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Parameter', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Condition', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Remarks', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
    ],
    [
      { content: 'Sub Item / Standard', styles: { halign: 'center' } },
      { content: 'Measured Value', styles: { halign: 'center' } },
      { content: 'Good', styles: { halign: 'center' } },
      { content: 'Not Good', styles: { halign: 'center' } }
    ]
  ] as any;

  const vc = reportData.voltage_current;
  const vn = reportData.vibration_noise;
  const th = reportData.temp_humidity;
  const pp = reportData.pipe_pressure;
  const af = reportData.air_flow;

  const measBody = [
    ['a.', 'Measurement input/output Voltage Current', 'R-N / R-S / Current R', `V: ${vc.voltage_rn}/${vc.voltage_rs} | I: ${vc.current_r}`, '✓', '', ''],
    ['', '', 'S-N / S-T / Current S', `V: ${vc.voltage_sn}/${vc.voltage_st} | I: ${vc.current_s}`, '✓', '', ''],
    ['', '', 'T-N / T-R / Current T', `V: ${vc.voltage_tn}/${vc.voltage_tr} | I: ${vc.current_t}`, '✓', '', ''],
    ['b.', 'Measurement Vibration & noise', 'Vibration <= 2.5 | Noise <= 65 dB', `Vib: ${vn.vibration} | Noise: ${vn.noise}`, '✓', '', ''],
    ['c.', 'Measurements temperature & humidity', 'Temp <= +-25°C | RH <= +-60%', `Temp: ${th.temp} | RH: ${th.rh}`, '✓', '', ''],
    ['d.', 'Measurement of supply & return pipes', '2.5 - 4 Bar', `Supply: ${pp.supply} | Return: ${pp.return_val}`, '✓', '', ''],
    ['e.', 'Measurement of output air flow', '2.0 - 8.0 m/s', `Air Flow: ${af.air_flow}`, '✓', '', ''],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: measHeaders,
    body: measBody,
    theme: 'grid',
    styles: { fontSize: 5.0, cellPadding: 0.5, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT },
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 45 },
      3: { cellWidth: 35, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: contentW - 166 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 1;

  // ─── 5. ANALYSIS / REMARK & TIME SPENT ────────────────────────────
  if (y > 240) {
    addPage();
    y = margin + 5;
  }

  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Analysis / Remark', margin + 2, y + 3.5);
  y += 5;

  const op = reportData.operation_status;
  const analysisRows = [
    ['Operation Status', op.is_normal ? '[✓] Normal Operation    [ ] Abnormal Operation' : '[ ] Normal Operation    [✓] Abnormal Operation'],
    ['Remark', op.remark || '-'],
    ['Fault Symptom', op.fault_symptom || '-'],
    ['Fault Analysis', op.fault_analysis || '-'],
    ['Work Done / Action Taken', op.work_done || '-'],
    ['Fault Part SN / Name', `${op.fault_part_sn || '-'} / ${op.fault_part_name || '-'}`],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: analysisRows,
    theme: 'grid',
    styles: { fontSize: 5.5, cellPadding: 1, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40, fillColor: HEADER_SUB },
      1: { cellWidth: contentW - 40 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 1;

  // ─── TIME SPENT ───────────────────────────────────────────────────
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('TIME SPENT', margin + 2, y + 3.5);
  y += 5;

  const timeRows = [
    ['Date', 'Departure', 'Start', 'Finish'],
    [timeSpent.date || '-', timeSpent.departure || '-', timeSpent.start || '-', timeSpent.finish || '-']
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: timeRows,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT, halign: 'center' },
    didParseCell(data) {
      if (data.row.index === 0) {
        data.cell.styles.fillColor = HEADER_SUB;
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 2;

  // ─── 6. CUSTOMER ACKNOWLEDGEMENT SIGNATURES ───────────────────────
  if (y > 250) {
    addPage();
    y = margin + 5;
  }

  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('CUSTOMER ACKNOWLEDGEMENT', margin + 2, y + 3.5);
  y += 5;

  const colW = contentW / 3;
  const sigBoxH = 20;

  // Border box for signatures
  doc.setDrawColor(180);
  doc.rect(margin, y, contentW, sigBoxH);

  doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(...DARK_TEXT);
  doc.text('Prepared', margin + colW * 0.5, y + 4, { align: 'center' });
  doc.text('Checked', margin + colW * 1.5, y + 4, { align: 'center' });
  doc.text('Approved', margin + colW * 2.5, y + 4, { align: 'center' });

  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text(customerInfo.engineer || 'Engineer', margin + colW * 0.5, y + 17, { align: 'center' });
  doc.text('SM / PM', margin + colW * 1.5, y + 17, { align: 'center' });
  doc.text('Client / Owner', margin + colW * 2.5, y + 17, { align: 'center' });

  y += sigBoxH + 4;

  // ─── PHOTO DOCUMENTATION ATTACHMENT ────────────────────────────────
  if (optimizedCards.length > 0) {
    addPage();
    y = margin;

    doc.setFillColor(...HEADER_BLUE);
    doc.rect(margin, y, contentW, 6, 'F');
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
    doc.text('FCU SERVICE REPORT - PHOTO DOCUMENTATION', margin + 3, y + 4);
    y += 9;

    const cardsPerPage = 4;
    const cardW = (contentW - 6) / 2;
    const cardH = 95;

    optimizedCards.forEach((card, idx) => {
      if (idx > 0 && idx % cardsPerPage === 0) {
        addPage();
        y = margin;
        doc.setFillColor(...HEADER_BLUE);
        doc.rect(margin, y, contentW, 6, 'F');
        doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
        doc.text('FCU SERVICE REPORT - PHOTO DOCUMENTATION (Cont.)', margin + 3, y + 4);
        y += 9;
      }

      const col = idx % 2;
      const row = Math.floor((idx % cardsPerPage) / 2);
      const cardX = margin + col * (cardW + 6);
      const cardY = y + row * (cardH + 6);

      doc.setDrawColor(200);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'FD');

      if (card.photoBase64) {
        try {
          doc.addImage(card.photoBase64, 'JPEG', cardX + 2, cardY + 2, cardW - 4, cardH - 18);
        } catch (e) {
          console.error('Failed to render photo in PDF card:', e);
        }
      }

      doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(30, 30, 30);
      const titleLines = doc.splitTextToSize(toEnglishText(card.description || `Photo #${idx + 1}`), cardW - 4);
      doc.text(titleLines, cardX + 2, cardY + cardH - 10);
    });
  }

  // Save PDF file
  const fileName = `${customerInfo.companyName || 'FCU'}_Service_Report_${customerInfo.date || 'draft'}.pdf`.replace(/\s+/g, '_');
  if (saveToFile) {
    doc.save(fileName);
  }
  return { doc, fileName, blob: doc.output('blob') };
}
