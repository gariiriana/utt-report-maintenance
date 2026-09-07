import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PumpCustomerInfo,
  PumpReportData,
  PumpTimeSpent,
  DEFAULT_PUMP_CUSTOMER_INFO,
  DEFAULT_PUMP_VISUAL_ITEMS,
  DEFAULT_PUMP_CLEANING_ITEMS
} from '@/types/pumpReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { compressBase64Image } from '@/utils/imageCompression';
import { downloadPDFBlob } from '@/utils/pdfDownload';
import { toast } from 'sonner';

// Color Palette 1:1 Spreadsheet & Official NeutraDC Service Report Style
const BLUE_ACCENT: [number, number, number] = [0, 89, 156];
const SECTION_BLUE_BG: [number, number, number] = [142, 180, 227]; // #8EB4E2 Header Bar
const SUB_HEADER_BG: [number, number, number] = [217, 226, 243]; // #D9E2F3 Sub Header
const YELLOW_STANDARD_BG: [number, number, number] = [255, 242, 204]; // #FFF2CC Yellow Highlight for Standard
const BORDER_COLOR: [number, number, number] = [150, 150, 150];
const DARK_TEXT: [number, number, number] = [20, 20, 20];

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
 * Generate PDF Service Report Pump (NeutraDC Cikarang)
 * Format Proporsional 1 Halaman Penuh 1:1 Sesuai Dokumen Resmi & Modal Pratinjau
 */
export async function generatePumpReportPDF(
  customerInfo: PumpCustomerInfo,
  reportData: PumpReportData,
  timeSpent: PumpTimeSpent,
  originalReportCards?: Array<{ photoBase64?: string; description: string }>,
  saveToFile: boolean = true
) {
  let optimizedCards = originalReportCards || [];
  if (originalReportCards && originalReportCards.length > 0) {
    toast.loading('Compressing documentation photos...', { id: 'pdf-pump-compress' });
    optimizedCards = await Promise.all(
      originalReportCards.map(async (c) => {
        if (!c.photoBase64) return c;
        try {
          const compressed = await compressBase64Image(c.photoBase64, { maxWidth: 800, quality: 0.5 });
          return { ...c, photoBase64: compressed };
        } catch (err) {
          console.error('Failed to compress Pump photo for PDF', err);
          return c;
        }
      })
    );
    toast.dismiss('pdf-pump-compress');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 6;
  const contentW = pageW - 2 * margin;

  let logoLeft: string | null = null;
  let logoRight: string | null = null;
  try { logoLeft = await loadImageBase64(logoDwimitra); } catch { /* ignore */ }
  try { logoRight = await loadImageBase64(logoNeutraDC); } catch { /* ignore */ }

  const addTopBlueAccent = () => {
    doc.setFillColor(...BLUE_ACCENT);
    doc.rect(0, 0, pageW, 2.0, 'F');
  };

  const drawMeasurementHeaderBar = (cell: any, title: string) => {
    const textX = cell.x + 2.0;
    const textY = cell.y + cell.height / 2 + 1.0;

    // Title di kiri
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...DARK_TEXT);
    doc.text(title, textX, textY);

    // Teks instruksi di kanan: "Please mark OK (✓),not OK(×), not applicable (N/A) in the box"
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.8);
    doc.setTextColor(45, 45, 45);

    const p1 = 'Please mark OK (';
    const p2 = '),not OK(';
    const p3 = '), not applicable (N/A) in the box';

    const rightMargin = cell.x + cell.width - 2.0;
    const totalW = doc.getTextWidth(p1) + 2.6 + doc.getTextWidth(p2) + 2.6 + doc.getTextWidth(p3);
    let curX = rightMargin - totalW;

    doc.text(p1, curX, textY);
    curX += doc.getTextWidth(p1);

    // Vector Checkmark ✓
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.25);
    doc.line(curX + 0.3, textY - 0.4, curX + 0.9, textY);
    doc.line(curX + 0.9, textY, curX + 2.0, textY - 1.2);
    curX += 2.6;

    doc.text(p2, curX, textY);
    curX += doc.getTextWidth(p2);

    // Vector Cross ✗
    doc.line(curX + 0.4, textY - 1.0, curX + 1.7, textY);
    doc.line(curX + 1.7, textY - 1.0, curX + 0.4, textY);
    curX += 2.6;

    doc.text(p3, curX, textY);
  };

  addTopBlueAccent();
  let y = margin;

  // ─── 1. KOP SURAT / HEADER RESMI ─────────────────────────────────────────
  const headerH = 13;
  if (logoLeft) {
    doc.addImage(logoLeft, 'PNG', margin + 2, y + 0.5, 26, 12);
  }

  const centerX = pageW / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK_TEXT);
  doc.text('SERVICE REPORT PUMP', centerX, y + 4.8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('Neutra DC Cikarang', centerX, y + 10.2, { align: 'center' });

  if (logoRight) {
    doc.addImage(logoRight, 'PNG', pageW - margin - 25, y + 0.8, 23, 11);
  }

  // Garis batas bawah kop surat
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.25);
  doc.line(margin, y + headerH + 1.0, pageW - margin, y + headerH + 1.0);

  y += headerH + 2.5;

  const c: any = customerInfo || DEFAULT_PUMP_CUSTOMER_INFO;

  // ─── 2. TABEL CUSTOMER INFORMATION (4 Baris x 8 Kolom) ───────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [[{ content: 'Customer', colSpan: 8, styles: { fillColor: SECTION_BLUE_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 6.8, minCellHeight: 4.4, halign: 'left', valign: 'middle' } }]],
    body: [
      [
        { content: 'Company name', styles: { fontStyle: 'bold', cellWidth: 23, fillColor: [248, 250, 252] } },
        { content: c.companyName || 'Neutra DC Cikarang', styles: { cellWidth: 35 } },
        { content: 'Type', styles: { fontStyle: 'bold', cellWidth: 16, fillColor: [248, 250, 252] } },
        { content: c.type || '-', styles: { cellWidth: 26 } },
        { content: 'Spesification', styles: { fontStyle: 'bold', cellWidth: 22, fillColor: [248, 250, 252] } },
        { content: c.specification || (c as any).model || '-', styles: { cellWidth: 32 } },
        { content: 'Mop No:', styles: { fontStyle: 'bold', cellWidth: 17, fillColor: [248, 250, 252] } },
        { content: c.mopNo || 'DME-TDE/MOP/PUMP/02 0506/26', styles: { cellWidth: 'auto' } }
      ],
      [
        { content: 'Equpment name', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.equipmentName || 'Pump', styles: {} },
        { content: 'Serial No:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.serialNo || '-', styles: {} },
        { content: '', colSpan: 2, styles: { fillColor: [255, 255, 255] } },
        { content: 'Quarter', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.quarter || 'Q2', styles: {} }
      ],
      [
        { content: 'CI Description', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.ciDescription || '-', styles: {} },
        { content: 'Product Name', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.productName || '-', styles: {} },
        { content: 'Location', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.location || '-', styles: {} },
        { content: 'Date', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.date || new Date().toISOString().split('T')[0], styles: {} }
      ],
      [
        { content: 'CI Name', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.ciName || '-', styles: {} },
        { content: 'Product Years', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.prodYear || '-', styles: {} },
        { content: 'Area', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.area || '-', styles: {} },
        { content: 'Engginer', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.engineer || 'pump@gmail.com', styles: {} }
      ]
    ],
    styles: { fontSize: 5.6, cellPadding: 0.8, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.16, valign: 'middle' }
  });

  y = (doc as any).lastAutoTable.finalY + 1.8;

  // ─── 3. VISUAL INSPECTION & CHECK (8 Poin a - h) ───────────────────────────
  const visualList = reportData.visualInspection && reportData.visualInspection.length > 0
    ? reportData.visualInspection
    : DEFAULT_PUMP_VISUAL_ITEMS;

  const visualRows = visualList.map((item) => [
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
    theme: 'grid',
    head: [
      [{ content: 'Visual inspection & Check', colSpan: 6, styles: { fillColor: SECTION_BLUE_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 6.8, minCellHeight: 4.4, halign: 'left', valign: 'middle' } }],
      [
        { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle', minCellHeight: 4.2 } },
        { content: 'Activity', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Parameter', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Condition', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Remarks', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
      ],
      [
        { content: 'Good', styles: { halign: 'center', minCellHeight: 3.8 } },
        { content: 'Not Good', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.8, cellPadding: 0.6 },
    body: visualRows,
    styles: { fontSize: 5.3, cellPadding: 0.7, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.16, valign: 'middle' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 8, halign: 'center', valign: 'middle' },
      1: { cellWidth: 68, valign: 'middle' },
      2: { cellWidth: 50, halign: 'center', valign: 'middle' },
      3: { cellWidth: 15, halign: 'center', valign: 'middle' },
      4: { cellWidth: 17, halign: 'center', valign: 'middle' },
      5: { cellWidth: 'auto', valign: 'middle', halign: 'center' }
    },
    didParseCell(data) {
      if (data.section === 'body') {
        const item = visualList[data.row.index];
        if (!item) return;

        const isGood = item.isGood === true || (item as any).condition === 'Good';
        const isNotGood = item.isNotGood === true || (item as any).condition === 'Not Good';

        if (data.column.index === 3) {
          if (isGood) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = DARK_TEXT;
          } else if (isNotGood) {
            data.cell.styles.fontStyle = 'normal';
            data.cell.styles.textColor = [150, 160, 175];
          }
        }

        if (data.column.index === 4) {
          if (isNotGood) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [185, 28, 28]; // Merah Not Good
          } else if (isGood) {
            data.cell.styles.fontStyle = 'normal';
            data.cell.styles.textColor = [150, 160, 175];
          }
        }
      }
    },
    didDrawCell(data) {
      if (data.section === 'body') {
        const item = visualList[data.row.index];
        if (!item) return;

        const isGood = item.isGood === true || (item as any).condition === 'Good';
        const isNotGood = item.isNotGood === true || (item as any).condition === 'Not Good';

        // Jika Not Good dipilih -> coret kata 'Good'
        if (data.column.index === 3 && isNotGood) {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.6 : cell.y + cell.height / 2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.3);
          const textW = doc.getTextWidth('Good');
          const startX = cell.x + (cell.width - textW) / 2;
          doc.setDrawColor(70, 70, 70);
          doc.setLineWidth(0.22);
          doc.line(startX - 0.4, lineY, startX + textW + 0.4, lineY);
        }

        // Jika Good dipilih -> coret kata 'Not Good'
        if (data.column.index === 4 && isGood) {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.6 : cell.y + cell.height / 2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.3);
          const textW = doc.getTextWidth('Not Good');
          const startX = cell.x + (cell.width - textW) / 2;
          doc.setDrawColor(70, 70, 70);
          doc.setLineWidth(0.22);
          doc.line(startX - 0.4, lineY, startX + textW + 0.4, lineY);
        }
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 1.8;

  // ─── 4. INSPECTION & CLEANING (5 Poin i - m) ───────────────────────────────
  const cleaningList = reportData.cleaning && reportData.cleaning.length > 0
    ? reportData.cleaning
    : DEFAULT_PUMP_CLEANING_ITEMS;

  const cleaningRows = cleaningList.map((item) => [
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
    theme: 'grid',
    head: [
      [{ content: 'Inspection & Cleaning', colSpan: 6, styles: { fillColor: SECTION_BLUE_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 6.8, minCellHeight: 4.4, halign: 'left', valign: 'middle' } }],
      [
        { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle', minCellHeight: 4.2 } },
        { content: 'Activity', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Parameter', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Condition', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Remarks', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
      ],
      [
        { content: 'Good', styles: { halign: 'center', minCellHeight: 3.8 } },
        { content: 'Not Good', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.8, cellPadding: 0.6 },
    body: cleaningRows,
    styles: { fontSize: 5.3, cellPadding: 0.7, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.16, valign: 'middle' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 8, halign: 'center', valign: 'middle' },
      1: { cellWidth: 68, valign: 'middle' },
      2: { cellWidth: 50, halign: 'center', valign: 'middle' },
      3: { cellWidth: 15, halign: 'center', valign: 'middle' },
      4: { cellWidth: 17, halign: 'center', valign: 'middle' },
      5: { cellWidth: 'auto', valign: 'middle', halign: 'center' }
    },
    didParseCell(data) {
      if (data.section === 'body') {
        const item = cleaningList[data.row.index];
        if (!item) return;

        const isGood = item.isGood === true || (item as any).condition === 'Good';
        const isNotGood = item.isNotGood === true || (item as any).condition === 'Not Good';

        if (data.column.index === 3) {
          if (isGood) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = DARK_TEXT;
          } else if (isNotGood) {
            data.cell.styles.fontStyle = 'normal';
            data.cell.styles.textColor = [150, 160, 175];
          }
        }

        if (data.column.index === 4) {
          if (isNotGood) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [185, 28, 28];
          } else if (isGood) {
            data.cell.styles.fontStyle = 'normal';
            data.cell.styles.textColor = [150, 160, 175];
          }
        }
      }
    },
    didDrawCell(data) {
      if (data.section === 'body') {
        const item = cleaningList[data.row.index];
        if (!item) return;

        const isGood = item.isGood === true || (item as any).condition === 'Good';
        const isNotGood = item.isNotGood === true || (item as any).condition === 'Not Good';

        if (data.column.index === 3 && isNotGood) {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.6 : cell.y + cell.height / 2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.3);
          const textW = doc.getTextWidth('Good');
          const startX = cell.x + (cell.width - textW) / 2;
          doc.setDrawColor(70, 70, 70);
          doc.setLineWidth(0.22);
          doc.line(startX - 0.4, lineY, startX + textW + 0.4, lineY);
        }

        if (data.column.index === 4 && isGood) {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.6 : cell.y + cell.height / 2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.3);
          const textW = doc.getTextWidth('Not Good');
          const startX = cell.x + (cell.width - textW) / 2;
          doc.setDrawColor(70, 70, 70);
          doc.setLineWidth(0.22);
          doc.line(startX - 0.4, lineY, startX + textW + 0.4, lineY);
        }
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 1.8;

  // ─── 5. VOLTAGE & CURRENT MEASUREMENT ─────────────────────────────────────
  const vc = reportData.voltageCurrent || {
    rs: '385', st: '382', tr: '384',
    rn: '220', sn: '221', tn: '220', ng: '1.2',
    r: '18.5', s: '18.2', t: '18.4', n: '0.8',
    standard: '+5% - 10% from 380V &\n220V load deviation 10%',
    remarks: 'Normal & Balanced'
  };

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: 'Voltage & Current Measurement', colSpan: 8, styles: { fillColor: SECTION_BLUE_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 6.8, minCellHeight: 4.4, halign: 'left', valign: 'middle' } }],
      [
        { content: 'Wire', styles: { halign: 'center', minCellHeight: 3.8 } },
        { content: 'Result (Voltage)', styles: { halign: 'center' } },
        { content: 'Wire', styles: { halign: 'center' } },
        { content: 'Result (Voltage)', styles: { halign: 'center' } },
        { content: 'Wire', styles: { halign: 'center' } },
        { content: 'Result (Ampere)', styles: { halign: 'center' } },
        { content: 'Standard', styles: { halign: 'center' } },
        { content: 'Remarks', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.6, cellPadding: 0.6 },
    body: [
      [
        { content: 'R-S', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'center' } },
        { content: vc.rs || '-', styles: { halign: 'center' } },
        { content: 'R-N', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'center' } },
        { content: vc.rn || '-', styles: { halign: 'center' } },
        { content: 'R', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'center' } },
        { content: vc.r || '-', styles: { halign: 'center' } },
        { content: vc.standard || '+5% - 10% from 380V &\n220V load deviation 10%', rowSpan: 4, styles: { fillColor: YELLOW_STANDARD_BG, halign: 'center', valign: 'middle', fontStyle: 'bold', textColor: [185, 28, 28] } },
        { content: vc.remarks || 'Normal & Balanced', rowSpan: 4, styles: { halign: 'center', valign: 'middle' } }
      ],
      [
        { content: 'S-T', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'center' } },
        { content: vc.st || '-', styles: { halign: 'center' } },
        { content: 'S-N', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'center' } },
        { content: vc.sn || '-', styles: { halign: 'center' } },
        { content: 'S', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'center' } },
        { content: vc.s || '-', styles: { halign: 'center' } }
      ],
      [
        { content: 'T-R', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'center' } },
        { content: vc.tr || '-', styles: { halign: 'center' } },
        { content: 'T-N', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'center' } },
        { content: vc.tn || '-', styles: { halign: 'center' } },
        { content: 'T', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'center' } },
        { content: vc.t || '-', styles: { halign: 'center' } }
      ],
      [
        { content: '', styles: { fillColor: [255, 255, 255] } },
        { content: '', styles: { fillColor: [255, 255, 255] } },
        { content: 'N-G', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'center' } },
        { content: vc.ng || '-', styles: { halign: 'center' } },
        { content: 'N', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'center' } },
        { content: vc.n || '-', styles: { halign: 'center' } }
      ]
    ],
    styles: { fontSize: 5.3, cellPadding: 0.6, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.16, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 20 },
      2: { cellWidth: 14 },
      3: { cellWidth: 20 },
      4: { cellWidth: 14 },
      5: { cellWidth: 20 },
      6: { cellWidth: 44 },
      7: { cellWidth: 'auto' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 1.8;

  // ─── 6. EMPAT TABEL PENGUKURAN (THERMAL, VIBRATION, PRESSURE, GROUNDING) ───

  // A. Thermal Meassurement (Casing Pump)
  const thermal = reportData.thermal || { item: 'Casing Pump', resultTemp: '42.5', standard: '≤ 80°C.', remarks: 'Normal & aman' };
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: '', colSpan: 4, styles: { fillColor: SECTION_BLUE_BG, minCellHeight: 4.4 } }],
      [
        { content: thermal.item || 'Casing Pump', rowSpan: 2, styles: { halign: 'left', fontStyle: 'bold', cellWidth: 44, fillColor: [248, 250, 252], valign: 'middle' } },
        { content: 'Result Temperature (°C)', styles: { halign: 'center', cellWidth: 44, minCellHeight: 3.8 } },
        { content: 'Standard', styles: { halign: 'center', cellWidth: 38 } },
        { content: 'Remarks', styles: { halign: 'center', cellWidth: 'auto' } }
      ],
      [
        { content: thermal.resultTemp || '42.5', styles: { halign: 'center', fontStyle: 'bold', minCellHeight: 4.0 } },
        { content: thermal.standard || '≤ 80°C.', styles: { fillColor: YELLOW_STANDARD_BG, halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28] } },
        { content: thermal.remarks || 'Suhu normal & aman', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.6, cellPadding: 0.6 },
    body: [],
    styles: { fontSize: 5.5, cellPadding: 0.7, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.16, valign: 'middle' },
    didDrawCell(data) {
      if (data.section === 'head' && data.row.index === 0) {
        drawMeasurementHeaderBar(data.cell, 'Thermal Meassurement');
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 1.8;

  // B. Vibration Meassurement (Casing Pump)
  const vibration = reportData.vibration || { item: 'Casing Pump', vibration: '1.8', standard: '≤ 4.5 mm/s.', remarks: 'Getaran stabil' };
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: '', colSpan: 4, styles: { fillColor: SECTION_BLUE_BG, minCellHeight: 4.4 } }],
      [
        { content: vibration.item || 'Casing Pump', rowSpan: 2, styles: { halign: 'left', fontStyle: 'bold', cellWidth: 44, fillColor: [248, 250, 252], valign: 'middle' } },
        { content: 'Vibration (mm/s)', styles: { halign: 'center', cellWidth: 44, minCellHeight: 3.8 } },
        { content: 'Standard', styles: { halign: 'center', cellWidth: 38 } },
        { content: 'Remarks', styles: { halign: 'center', cellWidth: 'auto' } }
      ],
      [
        { content: vibration.vibration || '1.8', styles: { halign: 'center', fontStyle: 'bold', minCellHeight: 4.0 } },
        { content: vibration.standard || '≤ 4.5 mm/s.', styles: { fillColor: YELLOW_STANDARD_BG, halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28] } },
        { content: vibration.remarks || 'Vibrasi normal & halus', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.6, cellPadding: 0.6 },
    body: [],
    styles: { fontSize: 5.5, cellPadding: 0.7, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.16, valign: 'middle' },
    didDrawCell(data) {
      if (data.section === 'head' && data.row.index === 0) {
        drawMeasurementHeaderBar(data.cell, 'Vibration Meassurement');
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 1.8;

  // C. Pressure Meassurement (Pressure Pump)
  const pressure = reportData.pressure || { item: 'Pressure Pump', resultTemp: '45.0', standard: '≤ 80°C.', remarks: 'Normal' };
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: '', colSpan: 4, styles: { fillColor: SECTION_BLUE_BG, minCellHeight: 4.4 } }],
      [
        { content: pressure.item || 'Pressure Pump', rowSpan: 2, styles: { halign: 'left', fontStyle: 'bold', cellWidth: 44, fillColor: [248, 250, 252], valign: 'middle' } },
        { content: 'Result Temperature (°C)', styles: { halign: 'center', cellWidth: 44, minCellHeight: 3.8 } },
        { content: 'Standard', styles: { halign: 'center', cellWidth: 38 } },
        { content: 'Remarks', styles: { halign: 'center', cellWidth: 'auto' } }
      ],
      [
        { content: pressure.resultTemp || '45.0', styles: { halign: 'center', fontStyle: 'bold', minCellHeight: 4.0 } },
        { content: pressure.standard || '≤ 80°C.', styles: { fillColor: YELLOW_STANDARD_BG, halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28] } },
        { content: pressure.remarks || 'Normal & stabil', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.6, cellPadding: 0.6 },
    body: [],
    styles: { fontSize: 5.5, cellPadding: 0.7, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.16, valign: 'middle' },
    didDrawCell(data) {
      if (data.section === 'head' && data.row.index === 0) {
        drawMeasurementHeaderBar(data.cell, 'Pressure Meassurement');
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 1.8;

  // D. Grounding Resistance Meassurement (Wire Grounding)
  const grounding = reportData.grounding || { wire: 'Grounding', resultOhm: '1.2', standard: '<5 Ω', remarks: 'Good grounding' };
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: '', colSpan: 4, styles: { fillColor: SECTION_BLUE_BG, minCellHeight: 4.4 } }],
      [
        { content: 'Wire', styles: { halign: 'center', fontStyle: 'bold', cellWidth: 44, minCellHeight: 3.8 } },
        { content: 'Result (Ω)', styles: { halign: 'center', cellWidth: 44 } },
        { content: 'Standard', styles: { halign: 'center', cellWidth: 38 } },
        { content: 'Remarks', styles: { halign: 'center', cellWidth: 'auto' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.6, cellPadding: 0.6 },
    body: [
      [
        { content: grounding.wire || 'Grounding', styles: { halign: 'left', fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: grounding.resultOhm || '1.2', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: grounding.standard || '<5 Ω', styles: { fillColor: YELLOW_STANDARD_BG, halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28] } },
        { content: grounding.remarks || 'Nilai tahanan pentanahan baik', styles: { halign: 'center' } }
      ]
    ],
    styles: { fontSize: 5.5, cellPadding: 0.7, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.16, valign: 'middle' },
    didDrawCell(data) {
      if (data.section === 'head' && data.row.index === 0) {
        drawMeasurementHeaderBar(data.cell, 'Grounding Resistance Meassurement');
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 1.8;

  // ─── 7. ANALYSIS / REMARK TABLE ──────────────────────────────────────────
  const analysisData = reportData.analysis || {
    isNormal: true,
    isAbnormal: false,
    remark: 'Pump beroperasi secara normal, tidak ada kebocoran, vibrasi dan temperatur kerja berada di dalam batas toleransi standar aman.',
    faultSymptom: '',
    faultAnalysis: '',
    workDone: '',
    faultPartSN: '',
    faultPartName: ''
  };
  const isNorm = analysisData.isNormal === true || (analysisData as any).is_normal === true;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    body: [
      [
        { content: `${isNorm ? '[✓]' : '[  ]'} Normal operation`, styles: { fontStyle: 'bold', cellWidth: 44 } },
        { content: 'Remark :', styles: { fontStyle: 'bold', cellWidth: 26, fillColor: [248, 250, 252] } },
        { content: analysisData.remark || 'Pump beroperasi secara normal, tidak ada kebocoran, vibrasi dan temperatur kerja berada di dalam batas toleransi standar aman.' }
      ],
      [
        { content: `${!isNorm ? '[✓]' : '[  ]'} Abnormal operation\n(Please fill the items if the service is repair)`, rowSpan: 4, styles: { fontStyle: 'bold', cellWidth: 44, valign: 'middle' } },
        { content: 'Fault symptom', styles: { fontStyle: 'bold', cellWidth: 26, fillColor: [248, 250, 252] } },
        { content: analysisData.faultSymptom || '-' }
      ],
      [
        { content: 'Fault analysis', styles: { fontStyle: 'bold', cellWidth: 26, fillColor: [248, 250, 252] } },
        { content: analysisData.faultAnalysis || '-' }
      ],
      [
        { content: 'Work done/\naction taken', styles: { fontStyle: 'bold', cellWidth: 26, fillColor: [248, 250, 252] } },
        { content: analysisData.workDone || '-' }
      ],
      [
        { content: 'Faul Part SN', styles: { fontStyle: 'bold', cellWidth: 26, fillColor: [248, 250, 252] } },
        { content: `${analysisData.faultPartSN || '-'}      Fault part Name: ${analysisData.faultPartName || '-'}` }
      ]
    ],
    styles: { fontSize: 5.4, cellPadding: 0.8, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.16, valign: 'middle' }
  });

  y = (doc as any).lastAutoTable.finalY + 1.8;

  // ─── 8. TIME SPENT TABLE ──────────────────────────────────────────────────
  const t = timeSpent || {
    date: new Date().toISOString().split('T')[0],
    departure: '08:00',
    start: '08:30',
    finish: '11:30'
  };

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: 'TIME SPENT', colSpan: 4, styles: { fillColor: SECTION_BLUE_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 6.8, minCellHeight: 4.4, halign: 'left', valign: 'middle' } }],
      [
        { content: 'Date', styles: { halign: 'center', minCellHeight: 3.8 } },
        { content: 'Departure', styles: { halign: 'center' } },
        { content: 'Start', styles: { halign: 'center' } },
        { content: 'Finish', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.6, cellPadding: 0.6 },
    body: [[t.date || c.date || new Date().toISOString().split('T')[0], t.departure || '08:00', t.start || '08:30', t.finish || '11:30']],
    styles: { fontSize: 5.6, cellPadding: 0.8, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.16, halign: 'center', valign: 'middle' }
  });

  y = (doc as any).lastAutoTable.finalY + 2.5;

  // ─── 9. CUSTOMER ACKNOWLEDGEMENT (3 Kolom) ────────────────────────────────
  const engineerName = c.engineer || 'pump@gmail.com';
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'plain',
    head: [[{ content: 'CUSTOMER ACKNOWLEDGEMENT:', colSpan: 3, styles: { fontStyle: 'bold', halign: 'center', fontSize: 6.8, textColor: DARK_TEXT } }]],
    body: [
      [
        { content: 'Prepared', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.2 } },
        { content: 'Checked', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.2 } },
        { content: 'Approved', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.2 } }
      ],
      [
        { content: `\n\n\n___________________\nEngineer\n(${engineerName})`, styles: { halign: 'center', fontSize: 5.6 } },
        { content: '\n\n\n___________________\nSM/PM\n(Site Manager)', styles: { halign: 'center', fontSize: 5.6 } },
        { content: '\n\n\n___________________\nClient / Owner\n(NeutraDC)', styles: { halign: 'center', fontSize: 5.6 } }
      ]
    ],
    styles: { cellPadding: 0.6, textColor: DARK_TEXT }
  });

  // ─── HALAMAN 2+: MULTI-PAGE DOKUMENTASI FOTO ──────────────────────────────
  if (optimizedCards && optimizedCards.length > 0) {
    doc.addPage();
    addTopBlueAccent();
    let photoY = margin + 1;

    // Kop Surat Formal Halaman Dokumentasi (3-Kolom)
    doc.setDrawColor(200, 205, 215);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, photoY, contentW, 17, 1.5, 1.5, 'S');

    // Divider vertikal
    doc.line(margin + 30, photoY, margin + 30, photoY + 17);
    doc.line(pageW - margin - 30, photoY, pageW - margin - 30, photoY + 17);

    // Logo Kiri
    if (logoLeft) {
      doc.addImage(logoLeft, 'PNG', margin + 3, photoY + 2.5, 24, 12);
    }

    // Teks Tengah
    const midX = pageW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK_TEXT);
    doc.text('DOKUMENTASI PREVENTIVE MAINTENANCE', midX, photoY + 5.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`PUMP SYSTEM — ${c.companyName || 'Neutra DC Cikarang'}`, midX, photoY + 10, { align: 'center' });
    doc.text(`MOP No: ${c.mopNo || 'DME-TDE/MOP/PUMP/02 0506/26'} | Quarter: ${c.quarter || 'Q2'} | Tanggal: ${c.date || new Date().toISOString().split('T')[0]}`, midX, photoY + 14, { align: 'center' });

    // Logo Kanan
    if (logoRight) {
      doc.addImage(logoRight, 'PNG', pageW - margin - 27, photoY + 2.5, 24, 12);
    }

    photoY += 21;

    // Title Section Dokumentasi Foto
    doc.setFillColor(...SECTION_BLUE_BG);
    doc.rect(margin, photoY, contentW, 5.5, 'F');
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.rect(margin, photoY, contentW, 5.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK_TEXT);
    doc.text('FOTO DOKUMENTASI KEGIATAN MAINTENANCE POMPA', margin + 3, photoY + 3.8);

    photoY += 8.5;

    // Layout 2 Foto per Halaman
    const cardH = 108;
    const imgH = 88;
    const descH = 15;
    const cardsPerPage = 2;

    for (let i = 0; i < optimizedCards.length; i++) {
      const cardIndexOnPage = i % cardsPerPage;

      if (i > 0 && cardIndexOnPage === 0) {
        doc.addPage();
        addTopBlueAccent();
        photoY = margin + 4;

        // Mini Header di halaman dokumentasi berikutnya
        doc.setFillColor(...SECTION_BLUE_BG);
        doc.rect(margin, photoY, contentW, 5.5, 'F');
        doc.setDrawColor(...BORDER_COLOR);
        doc.setLineWidth(0.2);
        doc.rect(margin, photoY, contentW, 5.5, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...DARK_TEXT);
        doc.text(`FOTO DOKUMENTASI KEGIATAN MAINTENANCE POMPA (Lanjutan - Halaman ${doc.getNumberOfPages()})`, margin + 3, photoY + 3.8);

        photoY += 8.5;
      }

      const curCardY = photoY + cardIndexOnPage * (cardH + 4.5);
      const card = optimizedCards[i];

      // Border Card
      doc.setDrawColor(...BORDER_COLOR);
      doc.setLineWidth(0.25);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, curCardY, contentW, cardH, 1.5, 1.5, 'FD');

      // Gambar Dokumentasi
      if (card.photoBase64) {
        try {
          doc.addImage(card.photoBase64, 'JPEG', margin + 1.5, curCardY + 1.5, contentW - 3, imgH);
        } catch {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(150, 150, 150);
          doc.text('(Gagal memuat gambar foto)', margin + contentW / 2, curCardY + imgH / 2, { align: 'center' });
        }
      } else {
        doc.setFillColor(245, 247, 250);
        doc.rect(margin + 1.5, curCardY + 1.5, contentW - 3, imgH, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(150, 150, 150);
        doc.text('Tidak ada lampiran foto untuk butir ini', margin + contentW / 2, curCardY + imgH / 2, { align: 'center' });
      }

      // Kotak Deskripsi Foto di Bawah Gambar
      const descBoxY = curCardY + imgH + 2.5;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(220, 225, 230);
      doc.setLineWidth(0.2);
      doc.roundedRect(margin + 1.5, descBoxY, contentW - 3, descH, 1, 1, 'FD');

      // Aksen bar vertikal biru di samping teks deskripsi
      doc.setFillColor(...BLUE_ACCENT);
      doc.rect(margin + 2.5, descBoxY + 1.5, 1.8, descH - 3, 'F');

      // Nomor Urut Foto Badge
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...BLUE_ACCENT);
      doc.text(`DOKUMENTASI #${i + 1}:`, margin + 6, descBoxY + 4.5);

      // Teks Deskripsi
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(40, 40, 40);
      const splitDesc = doc.splitTextToSize(card.description || 'Pemeriksaan rutin dan pembersihan unit pompa.', contentW - 35);
      doc.text(splitDesc.slice(0, 2), margin + 6, descBoxY + 8.5);
    }
  }

  // ─── FOOTER NUMBERING ─────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(140, 140, 140);
    const footerText = p === 1
      ? `PT DWIMITRA EKATAMA MANDIRI  •  SERVICE REPORT PUMP (${c.mopNo || 'DME-TDE/MOP/PUMP/02 0506/26'})`
      : `PT DWIMITRA EKATAMA MANDIRI  •  LAMPIRAN FOTO DOKUMENTASI PUMP`;
    doc.text(footerText, margin, pageH - 2.5);
    doc.text(`Halaman ${p} dari ${totalPages}`, pageW - margin, pageH - 2.5, { align: 'right' });
  }

  const rawMop = (c.mopNo || 'PUMP').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `SERVICE_REPORT_PUMP_${rawMop}_${c.date || new Date().toISOString().split('T')[0]}.pdf`;
  const blob = doc.output('blob');

  if (saveToFile) {
    downloadPDFBlob(blob, filename);
  }

  return Object.assign(doc, { doc, filename, blob });
}
