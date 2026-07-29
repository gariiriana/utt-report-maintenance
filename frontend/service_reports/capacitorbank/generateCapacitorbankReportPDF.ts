import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CapacitorbankCustomerInfo,
  CapacitorbankReportData,
  CapacitorbankTimeSpent,
} from '@/types/capacitorbankReportTypes';
import logoDwimitraUrl from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDCUrl from '@/assets/logo_neutradc.png';
import { compressBase64Image } from '@/utils/imageCompression';
import { toast } from 'sonner';

interface ReportPhoto {
  photoBase64?: string;
  description?: string;
}

// Corporate Styling Colors
const HEADER_BLUE: [number, number, number] = [0, 89, 156];
const HEADER_SUB: [number, number, number] = [226, 232, 240];
const STANDARD_YELLOW: [number, number, number] = [255, 242, 204];
const DARK_TEXT: [number, number, number] = [30, 30, 30];

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

export async function generateCapacitorbankReportPDF(
  customerInfo: CapacitorbankCustomerInfo,
  reportData: CapacitorbankReportData,
  timeSpent: CapacitorbankTimeSpent,
  photos: ReportPhoto[] = []
): Promise<void> {
  // Compress photos if present
  let optimizedPhotos = photos;
  if (photos && photos.length > 0) {
    toast.loading('Compressing documentation photos...', { id: 'pdf-capacitorbank-compress' });
    optimizedPhotos = await Promise.all(
      photos.map(async (p) => {
        if (!p.photoBase64) return p;
        try {
          const compressed = await compressBase64Image(p.photoBase64, { maxWidth: 800, quality: 0.5 });
          return { ...p, photoBase64: compressed };
        } catch (err) {
          console.error('Failed to compress Capacitor Bank photo', err);
          return p;
        }
      })
    );
    toast.dismiss('pdf-capacitorbank-compress');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 8;
  const contentWidth = pageWidth - margin * 2; // 194
  let currentY = margin;

  // Top accent bar
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(0, 0, pageWidth, 2.5, 'F');

  // Header Logos
  let dwimitraLogo: string | null = null;
  let neutradcLogo: string | null = null;
  try { dwimitraLogo = await loadImageBase64(logoDwimitraUrl); } catch { /* fallback */ }
  try { neutradcLogo = await loadImageBase64(logoNeutraDCUrl); } catch { /* fallback */ }

  const headerH = 16;
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.rect(margin, currentY, contentWidth, headerH);

  if (dwimitraLogo) {
    doc.addImage(dwimitraLogo, 'PNG', margin + 2, currentY + 2.5, 28, 11);
  }

  const centerX = pageWidth / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK_TEXT);
  doc.text('SERVICE REPORT PANEL AUTOMATIC POWER FACTOR CORECTION RELAY', centerX, currentY + 5.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PT. DWI MITRA EKATAMA MANDIRI', centerX, currentY + 9.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('JL. Alaydrus, 45-45-B, Jakarta, 10130 (021) 6332316', centerX, currentY + 13, { align: 'center' });

  if (neutradcLogo) {
    doc.addImage(neutradcLogo, 'PNG', pageWidth - margin - 26, currentY + 3, 24, 10);
  }

  currentY += headerH + 1.5;

  // Section 1: Customer Info Header
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Customer', margin + 2, currentY + 2.8);
  currentY += 4;

  const custTableData = [
    [
      'Company name :', customerInfo.companyName || 'NeutraDC Cikarang',
      'Type :', customerInfo.type || '-',
      'Specification :', customerInfo.specification || '-',
      'MOP No. :', customerInfo.mopNo || '-',
    ],
    [
      'Equipment Name :', customerInfo.equipmentName || 'Panel APFCR',
      'Serial No. :', customerInfo.serialNo || '-',
      'Quarter :', customerInfo.quarter || 'Q3',
      '', '',
    ],
    [
      'CI Description :', customerInfo.ciDescription || 'Panel Utility',
      'Product Name :', customerInfo.productName || '-',
      'Location :', customerInfo.location || '-',
      'Date :', customerInfo.date || timeSpent.date || '-',
    ],
    [
      'CI Name :', customerInfo.ciName || '-',
      'Prod.Year :', customerInfo.productYears || '-',
      'Area :', customerInfo.area || '-',
      'Engineer :', customerInfo.engineer || '-',
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    body: custTableData,
    theme: 'grid',
    styles: { fontSize: 5.5, cellPadding: 0.6, textColor: DARK_TEXT, lineColor: [180, 180, 180], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold', fillColor: HEADER_SUB },
      1: { cellWidth: 26 },
      2: { cellWidth: 18, fontStyle: 'bold', fillColor: HEADER_SUB },
      3: { cellWidth: 22 },
      4: { cellWidth: 20, fontStyle: 'bold', fillColor: HEADER_SUB },
      5: { cellWidth: 26 },
      6: { cellWidth: 16, fontStyle: 'bold', fillColor: HEADER_SUB },
      7: { cellWidth: 42 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 1;

  // Section 2: Visual Inspection & Maintenance (11 Items)
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Visual inspection & Maintenance   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 2.8);
  currentY += 4;

  const visualHeaders = [
    [
      { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Activity', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Parameter', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Condition', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Remarks', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
    ],
    [
      { content: 'Good', styles: { halign: 'center' } },
      { content: 'Not Good', styles: { halign: 'center' } },
    ],
  ] as any;

  const visualBody = reportData.visualInspection.map((v) => [
    v.no,
    v.activity,
    v.parameter,
    'Good',
    'Not Good',
    v.remarks || '',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: visualHeaders,
    body: visualBody,
    theme: 'grid',
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    styles: { fontSize: 5.0, cellPadding: 0.5, textColor: DARK_TEXT, lineColor: [180, 180, 180], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: contentWidth - 98 },
      2: { cellWidth: 32 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
    didParseCell(data) {
      if (data.section === 'body') {
        const item = reportData.visualInspection[data.row.index];
        if (!item) return;
        if (data.column.index === 3 && item.isGood) {
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 4 && item.isNotGood) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawCell(data) {
      if (data.section === 'body') {
        const item = reportData.visualInspection[data.row.index];
        if (!item) return;

        // Strikethrough "Good" if Not Good or NA is selected
        if (data.column.index === 3 && (item.isNotGood || item.isNA)) {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.55 : cell.y + cell.height / 2;
          doc.setDrawColor(...DARK_TEXT).setLineWidth(0.35);
          doc.line(cell.x + 1.5, lineY, cell.x + cell.width - 1.5, lineY);
        }

        // Strikethrough "Not Good" if Good or NA is selected
        if (data.column.index === 4 && (item.isGood || item.isNA)) {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.55 : cell.y + cell.height / 2;
          doc.setDrawColor(...DARK_TEXT).setLineWidth(0.35);
          doc.line(cell.x + 1.2, lineY, cell.x + cell.width - 1.2, lineY);
        }
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 1;

  // Section 3: Cleaning (5 Items)
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Cleaning   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 2.8);
  currentY += 4;

  const cleaningHeaders = [
    [
      { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Activity', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Parameter', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Condition', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Remarks', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
    ],
    [
      { content: 'Good', styles: { halign: 'center' } },
      { content: 'Not Good', styles: { halign: 'center' } },
    ],
  ] as any;

  const cleaningBody = reportData.cleaning.map((c) => [
    c.no,
    c.activity,
    c.parameter,
    'Good',
    'Not Good',
    c.remarks || '',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: cleaningHeaders,
    body: cleaningBody,
    theme: 'grid',
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    styles: { fontSize: 5.0, cellPadding: 0.5, textColor: DARK_TEXT, lineColor: [180, 180, 180], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: contentWidth - 98 },
      2: { cellWidth: 32 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
    didParseCell(data) {
      if (data.section === 'body') {
        const item = reportData.cleaning[data.row.index];
        if (!item) return;
        if (data.column.index === 3 && item.isGood) {
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 4 && item.isNotGood) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawCell(data) {
      if (data.section === 'body') {
        const item = reportData.cleaning[data.row.index];
        if (!item) return;

        // Strikethrough "Good" if Not Good or NA is selected
        if (data.column.index === 3 && (item.isNotGood || item.isNA)) {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.55 : cell.y + cell.height / 2;
          doc.setDrawColor(...DARK_TEXT).setLineWidth(0.35);
          doc.line(cell.x + 1.5, lineY, cell.x + cell.width - 1.5, lineY);
        }

        // Strikethrough "Not Good" if Good or NA is selected
        if (data.column.index === 4 && (item.isGood || item.isNA)) {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.55 : cell.y + cell.height / 2;
          doc.setDrawColor(...DARK_TEXT).setLineWidth(0.35);
          doc.line(cell.x + 1.2, lineY, cell.x + cell.width - 1.2, lineY);
        }
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 1;

  // Section 4: Voltage & Ampere Measurement
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Voltage & Ampere Measurement   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 2.8);
  currentY += 4;

  const va = reportData.voltageAmpere;
  const vaData = [
    [
      `R-S: ${va.voltageRS || '-'} V`,
      `R-N: ${va.voltageRN || '-'} V`,
      `R: ${va.ampereR || '-'} A`,
      {
        content: va.standard || '+5% - 10% from 380V & 220V load deviation 10%',
        rowSpan: 4,
        styles: { fillColor: STANDARD_YELLOW, fontStyle: 'bold', valign: 'middle', halign: 'center', fontSize: 4.8 } as any,
      },
      {
        content: va.remarks || 'Normal & seimbang',
        rowSpan: 4,
        styles: { valign: 'middle', halign: 'left' } as any,
      },
    ],
    [
      `S-T: ${va.voltageST || '-'} V`,
      `S-N: ${va.voltageSN || '-'} V`,
      `S: ${va.ampereS || '-'} A`,
    ],
    [
      `T-R: ${va.voltageTR || '-'} V`,
      `T-N: ${va.voltageTN || '-'} V`,
      `T: ${va.ampereT || '-'} A`,
    ],
    [
      '',
      `N-G: ${va.voltageNG || '-'} V`,
      `N: ${va.ampereN || '-'} A`,
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Wire Result (Voltage)', 'Wire Result (Voltage)', 'Wire Result (Ampere)', 'Standard', 'Remarks']],
    body: vaData,
    theme: 'grid',
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    styles: { fontSize: 5.0, cellPadding: 0.5, textColor: DARK_TEXT, lineColor: [180, 180, 180], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 46 },
      4: { cellWidth: contentWidth - 151 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 1;

  // Section 5: Thermal Measurement
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Thermal Measurement   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 2.8);
  currentY += 4;

  autoTable(doc, {
    startY: currentY,
    head: [['Breaker', 'Result Temperature (°C)', 'Standard', 'Remarks']],
    body: [[
      'Breaker',
      reportData.thermal.breakerResult ? `${reportData.thermal.breakerResult} °C` : '-',
      { content: reportData.thermal.standard || '<40°C', styles: { fillColor: STANDARD_YELLOW, fontStyle: 'bold', halign: 'center' } as any },
      reportData.thermal.remarks || '-',
    ]],
    theme: 'grid',
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    styles: { fontSize: 5.0, cellPadding: 0.5, textColor: DARK_TEXT, lineColor: [180, 180, 180], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold' },
      1: { cellWidth: 45 },
      2: { cellWidth: 55 },
      3: { cellWidth: contentWidth - 135 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 1;

  // Section 6: Grounding Resistance Measurement
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Grounding Resistance Measurement   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 2.8);
  currentY += 4;

  autoTable(doc, {
    startY: currentY,
    head: [['Wire', 'Result (Ω)', 'Standard', 'Remarks']],
    body: [[
      'Grounding',
      reportData.grounding.groundingResult ? `${reportData.grounding.groundingResult} Ω` : '-',
      { content: reportData.grounding.standard || '<5 Ω', styles: { fillColor: STANDARD_YELLOW, fontStyle: 'bold', halign: 'center' } as any },
      reportData.grounding.remarks || '-',
    ]],
    theme: 'grid',
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    styles: { fontSize: 5.0, cellPadding: 0.5, textColor: DARK_TEXT, lineColor: [180, 180, 180], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold' },
      1: { cellWidth: 45 },
      2: { cellWidth: 55 },
      3: { cellWidth: contentWidth - 135 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 1;

  // Section 7: Capacitance Measurement
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Capacitance Measurement   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 2.8);
  currentY += 4;

  autoTable(doc, {
    startY: currentY,
    head: [['Wire', 'Result (uF)', 'Standard', 'Remarks']],
    body: [[
      'Capacitance',
      reportData.capacitance.capacitanceResult ? `${reportData.capacitance.capacitanceResult} uF` : '-',
      { content: reportData.capacitance.standard || 'Capacitance value, 10% of nameplate value.', styles: { fillColor: STANDARD_YELLOW, fontStyle: 'bold', halign: 'center' } as any },
      reportData.capacitance.remarks || '-',
    ]],
    theme: 'grid',
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    styles: { fontSize: 5.0, cellPadding: 0.5, textColor: DARK_TEXT, lineColor: [180, 180, 180], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold' },
      1: { cellWidth: 45 },
      2: { cellWidth: 55 },
      3: { cellWidth: contentWidth - 135 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 1;

  // Section 8: Analysis / Remark
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Analysis / Remark', margin + 2, currentY + 2.8);
  currentY += 4;

  const analysisBody = [
    ['Normal operation', `Remark : ${reportData.analysis.remark || 'Panel APFCR / Capacitor Bank dalam kondisi baik dan faktor daya beroperasi optimal.'}`],
    ['Abnormal operation', `Fault symptom: ${reportData.analysis.faultSymptom || '-'}\nFault analysis: ${reportData.analysis.faultAnalysis || '-'}\nWork done/action taken: ${reportData.analysis.workDone || '-'}\nFault Part SN: ${reportData.analysis.faultPartSN || '-'}`],
  ];

  autoTable(doc, {
    startY: currentY,
    body: analysisBody,
    theme: 'grid',
    styles: { fontSize: 5.0, cellPadding: 0.8, textColor: DARK_TEXT, lineColor: [180, 180, 180], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold' },
      1: { cellWidth: contentWidth - 35 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 1;

  // Section 9: Time Spent
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, currentY, contentWidth, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Time Spent', margin + 2, currentY + 2.8);
  currentY += 4;

  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Departure', 'Start', 'Finish']],
    body: [[timeSpent.date || '-', timeSpent.departure || '-', timeSpent.start || '-', timeSpent.finish || '-']],
    theme: 'grid',
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0, halign: 'center' },
    styles: { fontSize: 5.0, cellPadding: 0.8, halign: 'center', textColor: DARK_TEXT, lineColor: [180, 180, 180], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: contentWidth / 4 },
      1: { cellWidth: contentWidth / 4 },
      2: { cellWidth: contentWidth / 4 },
      3: { cellWidth: contentWidth / 4 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 2.5;

  // Section 10: Signatures / Customer Acknowledgement
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...DARK_TEXT);
  doc.text('CUSTOMER ACKNOWLEDGEMENT:', centerX, currentY, { align: 'center' });

  currentY += 2;
  const sigBoxW = contentWidth / 3;
  autoTable(doc, {
    startY: currentY,
    head: [['Prepared', 'Checked', 'Approved']],
    body: [
      ['\n\n________________________\nEngineer', '\n\n________________________\nSM / PM', '\n\n________________________\nClient / Owner'],
    ],
    theme: 'grid',
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.5, halign: 'center' },
    styles: { fontSize: 5.0, cellPadding: 1, halign: 'center', textColor: DARK_TEXT, lineColor: [180, 180, 180], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: sigBoxW },
      1: { cellWidth: sigBoxW },
      2: { cellWidth: sigBoxW },
    },
    margin: { left: margin, right: margin },
  });

  // Section 11: Documentation Photo Pages
  if (optimizedPhotos && optimizedPhotos.length > 0) {
    const validPhotos = optimizedPhotos.filter((p) => p.photoBase64);
    if (validPhotos.length > 0) {
      doc.addPage();
      doc.setFillColor(...HEADER_BLUE);
      doc.rect(0, 0, pageWidth, 2.5, 'F');

      let photoY = margin + 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...DARK_TEXT);
      doc.text('DOCUMENTATION PHOTOS — PANEL APFCR (CAPACITOR BANK)', margin, photoY + 4);
      photoY += 8;

      let col = 0;
      const colW = (contentWidth - 6) / 2;
      const imgH = 48;

      for (const p of validPhotos) {
        if (!p.photoBase64) continue;
        const xPos = margin + col * (colW + 6);
        try {
          const format = p.photoBase64.includes('data:image/png') ? 'PNG' : 'JPEG';
          doc.addImage(p.photoBase64, format, xPos, photoY, colW, imgH);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(30, 41, 59);
          doc.text(p.description || 'Dokumentasi Capacitor Bank', xPos, photoY + imgH + 3.5, { maxWidth: colW });
        } catch (err) {
          console.error('Error adding photo to Capacitor Bank PDF', err);
        }

        col++;
        if (col > 1) {
          col = 0;
          photoY += imgH + 12;
          if (photoY + imgH + 10 > pageHeight - margin) {
            doc.addPage();
            doc.setFillColor(...HEADER_BLUE);
            doc.rect(0, 0, pageWidth, 2.5, 'F');
            photoY = margin + 2;
          }
        }
      }
    }
  }

  // Footer on each page
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFillColor(...HEADER_BLUE);
    doc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');

    doc.setFontSize(7).setTextColor(100, 116, 139);
    doc.text('PT DWIMITRA EKATAMA MANDIRI — Panel APFCR (Capacitor Bank) Service Report', margin, pageHeight - 4);
    doc.text(`Page ${pg} of ${totalPages}`, pageWidth - margin, pageHeight - 4, { align: 'right' });
  }

  // Save PDF
  const filename = `Service_Report_Capacitor_Bank_${(customerInfo.companyName || 'NeutraDC').replace(/\s+/g, '_')}_${timeSpent.date || 'draft'}.pdf`;
  doc.save(filename);
}

