import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PJUCustomerInfo, PJUReportData, PJUTimeSpent } from '@/types/pjuReportTypes';
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
 * Generate a professional PJU Service Report PDF matching the exact layout of the PJU PDF template.
 */
export async function generatePJUServiceReportPDF(
  customerInfo: PJUCustomerInfo,
  reportData: PJUReportData,
  timeSpent: PJUTimeSpent,
  originalReportCards?: Array<{ photoBase64?: string; description: string }>,
  saveToFile: boolean = true
) {
  let optimizedCards = originalReportCards || [];
  if (originalReportCards && originalReportCards.length > 0) {
    toast.loading('Compressing documentation photos...', { id: 'pdf-pju-compress' });
    optimizedCards = await Promise.all(
      originalReportCards.map(async (c) => {
        if (!c.photoBase64) return c;
        try {
          const compressed = await compressBase64Image(c.photoBase64, { maxWidth: 800, quality: 0.5 });
          return { ...c, photoBase64: compressed };
        } catch (err) {
          console.error('Failed to compress PJU documentation image for PDF', err);
          return c;
        }
      })
    );
    toast.dismiss('pdf-pju-compress');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 8;
  const contentW = pageW - 2 * margin;
  let y = margin;

  doc.setFillColor(...HEADER_BLUE);
  doc.rect(0, 0, pageW, 2.5, 'F');

  const addPage = () => {
    doc.addPage();
    doc.setFillColor(...HEADER_BLUE);
    doc.rect(0, 0, pageW, 2.5, 'F');
  };

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
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_TEXT);
  doc.text('SERVICE REPORT STREET LIGHTING AND GARDEN LIGHTING', centerX, y + 7, { align: 'center' });
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text('NeutraDC Cikarang', centerX, y + 12, { align: 'center' });

  if (logoRight) {
    doc.addImage(logoRight, 'PNG', pageW - margin - 28, y + 4, 24, 10);
  }

  y += headerH + 2;

  // ─── CUSTOMER INFO ─────────────────────────────────────────────────
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Customer Information', margin + 2, y + 3.5);
  y += 5;

  const formattedDate = customerInfo.date
    ? new Date(customerInfo.date).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const customerRows = [
    ['Company name', customerInfo.companyName, 'Type', customerInfo.type, 'Specification', customerInfo.specification, 'MOP No.', customerInfo.mopNo],
    ['Equipment Name', customerInfo.equipmentName, 'Serial No.', customerInfo.serialNo, 'Quarter', customerInfo.quarter],
    ['CI Description', customerInfo.ciDescription, 'Product Name', customerInfo.productName, 'Location', customerInfo.location, 'Date', formattedDate],
    ['CI Name', customerInfo.ciName, 'Prod.Year', customerInfo.productYears, 'Area', customerInfo.area, 'Engineer / Technician', customerInfo.engineer],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: customerRows,
    theme: 'grid',
    styles: { fontSize: 5.8, cellPadding: 0.8, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 23 },
      1: { cellWidth: 24 },
      2: { fontStyle: 'bold', cellWidth: 20 },
      3: { cellWidth: 18 },
      4: { fontStyle: 'bold', cellWidth: 22 },
      5: { cellWidth: 24 },
      6: { fontStyle: 'bold', cellWidth: 25 },
      7: { cellWidth: contentW - 156 },
    },
    didParseCell(data) {
      if (data.column.index % 2 === 0) {
        data.cell.styles.fillColor = HEADER_SUB;
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 1;

  // ─── VISUAL INSPECTION & MAINTENANCE ──────────────────────────────
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, y, contentW, 4.5, 'F');
  doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Visual inspection & Maintenance', margin + 2, y + 3.2);
  y += 4.5;

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
    'Good',
    'Not Good',
    item.remarks || '',
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
      1: { cellWidth: contentW - 95 },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 13, halign: 'center' },
      5: { cellWidth: 30 },
    },
    didParseCell(data) {
      if (data.section === 'body') {
        const item = reportData.visual_inspection[data.row.index];
        if (!item) return;

        if (data.column.index === 3 || data.column.index === 4) {
          if (
            (data.column.index === 3 && item.condition === 'Good') ||
            (data.column.index === 4 && item.condition === 'Not Good')
          ) {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    },
    didDrawCell(data) {
      if (data.section === 'body') {
        const item = reportData.visual_inspection[data.row.index];
        if (!item) return;

        if (data.column.index === 3 && item.condition === 'Not Good') {
          const cell = data.cell;
          const lineY = cell.y + cell.height / 2;
          doc.setDrawColor(...DARK_TEXT).setLineWidth(0.35);
          doc.line(cell.x + 1.5, lineY, cell.x + cell.width - 1.5, lineY);
        }

        if (data.column.index === 4 && item.condition === 'Good') {
          const cell = data.cell;
          const lineY = cell.y + cell.height / 2;
          doc.setDrawColor(...DARK_TEXT).setLineWidth(0.35);
          doc.line(cell.x + 1.5, lineY, cell.x + cell.width - 1.5, lineY);
        }
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 1;

  // ─── CLEANING ──────────────────────────────────────────────────────
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, y, contentW, 4.5, 'F');
  doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Cleaning', margin + 2, y + 3.2);
  y += 4.5;

  const clHeaders = [
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

  const clBody = reportData.cleaning.map(item => [
    item.no,
    item.activity,
    item.parameter,
    'Good',
    'Not Good',
    item.remarks || '',
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: clHeaders,
    body: clBody,
    theme: 'grid',
    styles: { fontSize: 5.0, cellPadding: 0.5, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT },
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: contentW - 95 },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 13, halign: 'center' },
      5: { cellWidth: 30 },
    },
    didDrawCell(data) {
      if (data.section === 'body') {
        const item = reportData.cleaning[data.row.index];
        if (!item) return;

        if (data.column.index === 3 && item.condition === 'Not Good') {
          const cell = data.cell;
          const lineY = cell.y + cell.height / 2;
          doc.setDrawColor(...DARK_TEXT).setLineWidth(0.35);
          doc.line(cell.x + 1.5, lineY, cell.x + cell.width - 1.5, lineY);
        }

        if (data.column.index === 4 && item.condition === 'Good') {
          const cell = data.cell;
          const lineY = cell.y + cell.height / 2;
          doc.setDrawColor(...DARK_TEXT).setLineWidth(0.35);
          doc.line(cell.x + 1.5, lineY, cell.x + cell.width - 1.5, lineY);
        }
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 1;

  // ─── MEASUREMENT ──────────────────────────────────────────────────
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, y, contentW, 4.5, 'F');
  doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Measurement', margin + 2, y + 3.2);
  y += 4.5;

  const msBody = reportData.measurement.map(item => [
    item.no,
    item.activity,
    item.parameter,
    'Good',
    'Not Good',
    item.remarks || '',
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: viHeaders,
    body: msBody,
    theme: 'grid',
    styles: { fontSize: 5.0, cellPadding: 0.5, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT },
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: contentW - 95 },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 13, halign: 'center' },
      5: { cellWidth: 30 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 1;

  // ─── TEST ──────────────────────────────────────────────────────────
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(margin, y, contentW, 4.5, 'F');
  doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Test', margin + 2, y + 3.2);
  y += 4.5;

  const tBody = reportData.test.map(item => [
    item.no,
    item.activity,
    item.parameter,
    'Good',
    'Not Good',
    item.remarks || '',
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: viHeaders,
    body: tBody,
    theme: 'grid',
    styles: { fontSize: 5.0, cellPadding: 0.5, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT },
    headStyles: { fillColor: HEADER_SUB, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: contentW - 95 },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 13, halign: 'center' },
      5: { cellWidth: 30 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 1;

  // ─── ANALYSIS / REMARK ──────────────────────────────────────────────
  const ops = reportData.operation_status;
  const opsBody = [
    [
      { content: ops.is_normal ? '[x] Normal operation' : '[ ] Normal operation', colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fontSize: 5.2 } },
      { content: 'Remark:', styles: { fontStyle: 'bold', fillColor: HEADER_SUB, fontSize: 5.2 } },
      { content: ops.remark || '', colSpan: 3, styles: { halign: 'left', fontSize: 5.2 } }
    ],
    [
      { content: !ops.is_normal ? '[x] Abnormal operation' : '[ ] Abnormal operation', colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fontSize: 5.2 } },
      { content: 'Fault symptom', styles: { fontStyle: 'bold', fillColor: HEADER_SUB, fontSize: 5.2 } },
      { content: ops.fault_symptom || '', colSpan: 3, styles: { halign: 'left', fontSize: 5.2 } }
    ],
    [
      { content: '(Please fill out this section if service involves repair)', colSpan: 2, styles: { halign: 'left', fontStyle: 'italic', fontSize: 4.2, textColor: [100, 100, 100] } },
      { content: 'Fault analysis', styles: { fontStyle: 'bold', fillColor: HEADER_SUB, fontSize: 5.2 } },
      { content: ops.fault_analysis || '', colSpan: 3, styles: { halign: 'left', fontSize: 5.2 } }
    ],
    [
      { content: '', colSpan: 2 },
      { content: 'Work done /\naction taken', styles: { fontStyle: 'bold', fillColor: HEADER_SUB, fontSize: 5.2 } },
      { content: ops.work_done || '', colSpan: 3, styles: { halign: 'left', fontSize: 5.2 } }
    ],
    [
      { content: '', colSpan: 2 },
      { content: 'Fault Part SN :', styles: { fontStyle: 'bold', fillColor: HEADER_SUB, fontSize: 5.2 } },
      { content: ops.fault_part_sn || '', styles: { halign: 'left', fontSize: 5.2 } },
      { content: 'Fault part Name :', styles: { fontStyle: 'bold', fillColor: HEADER_SUB, fontSize: 5.2 } },
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
      2: { cellWidth: 24 },
      3: { cellWidth: 34 },
      4: { cellWidth: 28 },
      5: { cellWidth: contentW - 156 }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 1;

  // ─── TIME SPENT ────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 153);
  doc.rect(margin, y, contentW, 4, 'F');
  doc.setFontSize(6.5).setFont('helvetica', 'bolditalic').setTextColor(...DARK_TEXT);
  doc.text('TIME SPENT', margin + 2, y + 2.8);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Date', 'Departure', 'Start', 'Finish']],
    body: [[timeSpent.date, timeSpent.departure, timeSpent.start, timeSpent.finish]],
    theme: 'grid',
    styles: { fontSize: 6.0, cellPadding: 0.8, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK_TEXT, halign: 'center' },
    headStyles: { fillColor: [255, 255, 204], textColor: DARK_TEXT, fontStyle: 'bold' },
  });

  y = (doc as any).lastAutoTable.finalY + 2.5;

  // ─── CUSTOMER ACKNOWLEDGEMENT ──────────────────────────────────────
  doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...DARK_TEXT);
  doc.text('CUSTOMER ACKNOWLEDGEMENT:', centerX, y, { align: 'center' });
  y += 3;

  const sigColW = contentW / 3;
  const sigLabels = ['Prepared', 'Checked', 'Approved'];
  const sigTitles = ['Engineer', 'SM/PM', 'Client /Owner'];

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
      doc.setFillColor(...HEADER_BLUE);
      doc.rect(0, 0, pageW, 2.5, 'F');

      const headerY = 6;
      const headerH = 22;

      doc.setDrawColor(226, 232, 240).setLineWidth(0.1).setFillColor(255, 255, 255);
      doc.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'FD');

      const col1W = 35;
      const col3W = 35;
      doc.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
      doc.line(pageW - margin - col3W, headerY, pageW - margin - col3W, headerY + headerH);

      if (logoLeft) {
        doc.addImage(logoLeft, 'PNG', margin + 3, headerY + 4, col1W - 6, 14, undefined, 'FAST');
      }

      if (logoRight) {
        doc.addImage(logoRight, 'PNG', pageW - margin - col3W + 5, headerY + 5.5, col3W - 10, 11, undefined, 'FAST');
      }

      const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
      
      doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...HEADER_BLUE);
      doc.text('MAINTENANCE REPORT', centerX, headerY + 6.5, { align: 'center' });
      
      doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(...DARK_TEXT);
      doc.text('PJU PM DOCUMENTATION', centerX, headerY + 11.5, { align: 'center' });
      
      doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...HEADER_BLUE);
      doc.text(customerInfo.specification ? customerInfo.specification.toUpperCase() : 'SOLAR CELL', centerX, headerY + 16, { align: 'center' });
      
      const displayDate = customerInfo.date
        ? new Date(customerInfo.date).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })
        : '';
      doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(100, 100, 100);
      doc.text(`Maintenance Date: ${displayDate}`, centerX, headerY + 20, { align: 'center' });

      return headerY + headerH + 4;
    };

    let pageStart = 0;

    while (pageStart < optimizedCards.length) {
      const pageCards = optimizedCards.slice(pageStart, pageStart + perPage);

      addPage();
      y = drawDocHeader(doc);

      for (let i = 0; i < pageCards.length; i += cols) {
        const row = pageCards.slice(i, i + cols);
        for (let j = 0; j < row.length; j++) {
          const x = margin + j * (contentW / cols);
          const cardX = x;
          const cardY = y;
          const cardW = (contentW / cols) - 2;

          doc.setFillColor(255, 255, 255).setDrawColor(220, 228, 240).setLineWidth(0.2);
          doc.roundedRect(cardX, cardY, cardW, photoH + capH, 1, 1, 'FD');

          const card = row[j];
          if (card.photoBase64) {
            doc.addImage(card.photoBase64, 'JPEG', cardX + 1, cardY + 1, cardW - 2, photoH - 2, undefined, 'FAST');
          } else {
            doc.setFillColor(241, 245, 249).rect(cardX + 0.5, cardY + 0.5, cardW - 1, photoH - 1, 'F');
            doc.setFontSize(7).setTextColor(100).text('No Photo Available', cardX + cardW / 2, cardY + photoH / 2, { align: 'center' });
          }

          doc.setDrawColor(220, 228, 240).setLineWidth(0.3);
          doc.line(cardX, cardY + photoH, cardX + cardW, cardY + photoH);

          doc.setFontSize(6).setFont('helvetica', 'normal').setTextColor(...DARK_TEXT);
          const splitCaption = doc.splitTextToSize(toEnglishText(card.description || ''), cardW - 4);
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
    
    doc.setFillColor(...HEADER_BLUE);
    doc.rect(0, pageH - 2.5, pageW, 2.5, 'F');

    doc.setFontSize(7.5).setTextColor(100, 116, 139);
    doc.text('PT DWIMITRA EKATAMA MANDIRI — PJU Service Report', margin, pageH - 5);
    doc.text(`Page ${pg} of ${totalPages}`, pageW - margin, pageH - 5, { align: 'right' });
  }

  // Save PDF file
  const filename = `Service_Report_PJU_${customerInfo.mopNo || 'Report'}_${customerInfo.date || 'undated'}.pdf`;
  if (saveToFile) {
    doc.save(filename);
  }
  return { doc, filename, blob: doc.output('blob') };
}
