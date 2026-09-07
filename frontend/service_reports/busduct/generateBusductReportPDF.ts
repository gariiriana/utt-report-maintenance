import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BusductCustomerInfo, BusductReportData, BusductTimeSpent } from '@/types/busductReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { compressBase64Image } from '@/utils/imageCompression';
import { downloadJsPDFDoc } from '@/utils/pdfDownload';
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
 * Generate PDF Service Report Panel Busduct (NeutraDC Cikarang)
 * Format Proporsional 1 Halaman Penuh (Spacious & Legible) 1:1 Sesuai Modal Pratinjau
 */
export async function generateBusductReportPDF(
  customerInfo: BusductCustomerInfo,
  reportData: BusductReportData,
  timeSpent: BusductTimeSpent,
  originalReportCards?: Array<{ photoBase64?: string; description: string }>,
  saveToFile: boolean = true
) {
  let optimizedCards = originalReportCards || [];
  if (originalReportCards && originalReportCards.length > 0) {
    toast.loading('Compressing documentation photos...', { id: 'pdf-busduct-compress' });
    optimizedCards = await Promise.all(
      originalReportCards.map(async (c) => {
        if (!c.photoBase64) return c;
        try {
          const compressed = await compressBase64Image(c.photoBase64, { maxWidth: 800, quality: 0.5 });
          return { ...c, photoBase64: compressed };
        } catch (err) {
          console.error('Failed to compress Busduct photo for PDF', err);
          return c;
        }
      })
    );
    toast.dismiss('pdf-busduct-compress');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 7;
  const contentW = pageW - 2 * margin;

  let logoLeft: string | null = null;
  let logoRight: string | null = null;
  try { logoLeft = await loadImageBase64(logoDwimitra); } catch { /* ignore */ }
  try { logoRight = await loadImageBase64(logoNeutraDC); } catch { /* ignore */ }

  const addTopBlueAccent = () => {
    doc.setFillColor(...BLUE_ACCENT);
    doc.rect(0, 0, pageW, 2.2, 'F');
  };

  const drawInstructionHeaderBar = (cell: any, sectionTitle: string) => {
    const textX = cell.x + 2.0;
    const textY = cell.y + cell.height / 2 + 1.1;

    // Title di kiri
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...DARK_TEXT);
    doc.text(sectionTitle, textX, textY);

    // Teks instruksi di kanan (menggambar ✓ dan ✗ menggunakan vector lines agar tidak terpotong)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(50, 50, 50);

    const p1 = 'Please mark (';
    const p2 = ') in good condition and cross (';
    const p3 = ') in not good condition';

    const rightMargin = cell.x + cell.width - 2.0;
    const totalW = doc.getTextWidth(p1) + 3.0 + doc.getTextWidth(p2) + 3.0 + doc.getTextWidth(p3);
    let curX = rightMargin - totalW;

    doc.text(p1, curX, textY);
    curX += doc.getTextWidth(p1);

    // Simbol Checkmark ✓
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.3);
    doc.line(curX + 0.4, textY - 0.5, curX + 1.0, textY - 0.1);
    doc.line(curX + 1.0, textY - 0.1, curX + 2.2, textY - 1.4);
    curX += 3.0;

    doc.text(p2, curX, textY);
    curX += doc.getTextWidth(p2);

    // Simbol Cross ✗
    doc.line(curX + 0.5, textY - 1.2, curX + 1.9, textY - 0.2);
    doc.line(curX + 1.9, textY - 1.2, curX + 0.5, textY - 0.2);
    curX += 3.0;

    doc.text(p3, curX, textY);
  };

  addTopBlueAccent();
  let y = margin;

  // ─── 1. KOP SURAT / HEADER (LEGA & ELEGAN PERSIS MODAL) ─────────────────────
  const headerH = 15;
  if (logoLeft) {
    doc.addImage(logoLeft, 'PNG', margin + 2, y + 0.5, 28, 13);
  }

  const centerX = pageW / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...DARK_TEXT);
  doc.text('SERVICE REPORT PANEL BUSDUCT', centerX, y + 5.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 60);
  doc.text('Neutra DC Cikarang', centerX, y + 11.5, { align: 'center' });

  if (logoRight) {
    doc.addImage(logoRight, 'PNG', pageW - margin - 27, y + 1, 25, 12);
  }

  // Garis batas bawah kop surat
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.25);
  doc.line(margin, y + headerH + 1.5, pageW - margin, y + headerH + 1.5);

  y += headerH + 3.5;

  const c: any = customerInfo || ({} as any);

  // ─── 2. TABEL CUSTOMER INFORMATION (LEGA & PROPORSIONAL) ─────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [[{ content: 'Customer', colSpan: 8, styles: { fillColor: SECTION_BLUE_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 7.2, minCellHeight: 5.0, halign: 'left', valign: 'middle' } }]],
    body: [
      [
        { content: 'Company name', styles: { fontStyle: 'bold', cellWidth: 23, fillColor: [248, 250, 252] } },
        { content: c.companyName || 'Neutra DC Cikarang', styles: { cellWidth: 35 } },
        { content: 'Type', styles: { fontStyle: 'bold', cellWidth: 17, fillColor: [248, 250, 252] } },
        { content: c.type || c.specification || 'IEC 61439-6', styles: { cellWidth: 26 } },
        { content: 'Spesification', styles: { fontStyle: 'bold', cellWidth: 23, fillColor: [248, 250, 252] } },
        { content: c.specification || (c as any).model || '4000A', styles: { cellWidth: 32 } },
        { content: 'Mop No:', styles: { fontStyle: 'bold', cellWidth: 17, fillColor: [248, 250, 252] } },
        { content: c.mopNo || 'DME-TDE/MOP/BDT/02 2805/26', styles: { cellWidth: 'auto' } }
      ],
      [
        { content: 'Equpment name', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.equipmentName || 'BUSDUCT', styles: {} },
        { content: 'Serial No:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.serialNo || 'AC-002', styles: {} },
        { content: '', colSpan: 2, styles: { fillColor: [255, 255, 255] } },
        { content: 'Quarter', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.quarter || 'Q2', styles: {} }
      ],
      [
        { content: 'CI Description', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.ciDescription || 'Line Busduct', styles: {} },
        { content: 'Product Name', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.productName || 'N/A', styles: {} },
        { content: 'Location', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.location || '-', styles: {} },
        { content: 'Date', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.date || new Date().toISOString().split('T')[0], styles: {} }
      ],
      [
        { content: 'CI Name', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.ciName || '-', styles: {} },
        { content: 'Product Years', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.prodYear || '2022', styles: {} },
        { content: 'Area', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.area || '-', styles: {} },
        { content: 'Engginer', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: c.engineer || '-', styles: {} }
      ]
    ],
    styles: { fontSize: 6.2, cellPadding: 1.0, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18, valign: 'middle' }
  });

  y = (doc as any).lastAutoTable.finalY + 3.0;

  // ─── 3. VISUAL INSPECTION & MAINTENANCE (10 POIN - TINGGI PROPORSIONAL) ────
  const visualList = reportData.visualInspection || [];
  const visualRows = visualList.map((item, idx) => [
    String(idx + 1),
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
      [{ content: '', colSpan: 6, styles: { fillColor: SECTION_BLUE_BG, minCellHeight: 5.2 } }],
      [
        { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle', minCellHeight: 4.8 } },
        { content: 'Activity', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Parameter', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Condition', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Remarks', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
      ],
      [
        { content: 'Good', styles: { halign: 'center', minCellHeight: 4.2 } },
        { content: 'Not Good', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 6.2, cellPadding: 0.8 },
    body: visualRows,
    styles: { fontSize: 5.8, cellPadding: 0.9, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18, valign: 'middle' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 8, halign: 'center', valign: 'middle' },
      1: { cellWidth: 66, valign: 'middle' },
      2: { cellWidth: 52, halign: 'center', valign: 'middle' },
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
            data.cell.styles.textColor = [185, 28, 28]; // Merah tegas jika Not Good dipilih
          } else if (isGood) {
            data.cell.styles.fontStyle = 'normal';
            data.cell.styles.textColor = [150, 160, 175];
          }
        }
      }
    },
    didDrawCell(data) {
      if (data.section === 'head' && data.row.index === 0) {
        drawInstructionHeaderBar(data.cell, 'Visual inspection & Maintenance');
      }

      if (data.section === 'body') {
        const item = visualList[data.row.index];
        if (!item) return;

        const isGood = item.isGood === true || (item as any).condition === 'Good';
        const isNotGood = item.isNotGood === true || (item as any).condition === 'Not Good';

        // Jika kondisinya 'Not Good' -> coret kata 'Good' di kolom 3
        if (data.column.index === 3 && isNotGood) {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.7 : cell.y + cell.height / 2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.8);
          const textW = doc.getTextWidth('Good');
          const startX = cell.x + (cell.width - textW) / 2;
          doc.setDrawColor(70, 70, 70);
          doc.setLineWidth(0.25);
          doc.line(startX - 0.5, lineY, startX + textW + 0.5, lineY);
        }

        // Jika kondisinya 'Good' -> coret kata 'Not Good' di kolom 4
        if (data.column.index === 4 && isGood) {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.7 : cell.y + cell.height / 2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.8);
          const textW = doc.getTextWidth('Not Good');
          const startX = cell.x + (cell.width - textW) / 2;
          doc.setDrawColor(70, 70, 70);
          doc.setLineWidth(0.25);
          doc.line(startX - 0.5, lineY, startX + textW + 0.5, lineY);
        }
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 3.0;

  // ─── 4. CLEANING & MAINTENANCE (2 POIN - TINGGI PROPORSIONAL) ─────────────
  const cleaningList = reportData.cleaning || [];
  const cleaningRows = cleaningList.map((item, idx) => [
    String(idx + 1),
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
      [{ content: '', colSpan: 6, styles: { fillColor: SECTION_BLUE_BG, minCellHeight: 5.2 } }],
      [
        { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle', minCellHeight: 4.8 } },
        { content: 'Activity', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Parameter', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Condition', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Remarks', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
      ],
      [
        { content: 'Good', styles: { halign: 'center', minCellHeight: 4.2 } },
        { content: 'Not Good', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 6.2, cellPadding: 0.8 },
    body: cleaningRows,
    styles: { fontSize: 5.8, cellPadding: 0.9, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18, valign: 'middle' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 8, halign: 'center', valign: 'middle' },
      1: { cellWidth: 66, valign: 'middle' },
      2: { cellWidth: 52, halign: 'center', valign: 'middle' },
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
      if (data.section === 'head' && data.row.index === 0) {
        drawInstructionHeaderBar(data.cell, 'Cleaning & Maintenance');
      }

      if (data.section === 'body') {
        const item = cleaningList[data.row.index];
        if (!item) return;

        const isGood = item.isGood === true || (item as any).condition === 'Good';
        const isNotGood = item.isNotGood === true || (item as any).condition === 'Not Good';

        if (data.column.index === 3 && isNotGood) {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.7 : cell.y + cell.height / 2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.8);
          const textW = doc.getTextWidth('Good');
          const startX = cell.x + (cell.width - textW) / 2;
          doc.setDrawColor(70, 70, 70);
          doc.setLineWidth(0.25);
          doc.line(startX - 0.5, lineY, startX + textW + 0.5, lineY);
        }

        if (data.column.index === 4 && isGood) {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.7 : cell.y + cell.height / 2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.8);
          const textW = doc.getTextWidth('Not Good');
          const startX = cell.x + (cell.width - textW) / 2;
          doc.setDrawColor(70, 70, 70);
          doc.setLineWidth(0.25);
          doc.line(startX - 0.5, lineY, startX + textW + 0.5, lineY);
        }
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 3.0;

  // ─── 5. THERMAL MEASUREMENT TABLE (LEGA & PROPORSIONAL) ───────────────────
  const thermalData = reportData.thermal || {
    breaker: 'Joint Busduct',
    resultTemp: '32.5',
    standard: '<40°C',
    remarks: 'Suhu normal & aman'
  };

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: '', colSpan: 4, styles: { fillColor: SECTION_BLUE_BG, minCellHeight: 5.2 } }],
      [
        { content: 'Breaker', styles: { halign: 'left', fontStyle: 'bold', cellWidth: 34, minCellHeight: 4.8 } },
        { content: 'Result Temperature Joint (°C)', styles: { halign: 'center', cellWidth: 52 } },
        { content: 'Standard', styles: { halign: 'center', cellWidth: 35 } },
        { content: 'Remarks', styles: { halign: 'center', cellWidth: 'auto' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 6.2, cellPadding: 0.8 },
    body: [
      [
        { content: thermalData.breaker || 'Joint Busduct', styles: { halign: 'left', fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: thermalData.resultTemp ? `${thermalData.resultTemp}` : '32.5', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: thermalData.standard || '<40°C', styles: { fillColor: YELLOW_STANDARD_BG, halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28] } },
        { content: thermalData.remarks || 'Suhu normal & aman', styles: { halign: 'center' } }
      ]
    ],
    styles: { fontSize: 6.2, cellPadding: 1.2, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 34, fontStyle: 'bold', halign: 'left', valign: 'middle' },
      1: { cellWidth: 52, halign: 'center', valign: 'middle' },
      2: { cellWidth: 35, halign: 'center', valign: 'middle' },
      3: { cellWidth: 'auto', halign: 'center', valign: 'middle' }
    },
    didDrawCell(data) {
      if (data.section === 'head' && data.row.index === 0) {
        drawInstructionHeaderBar(data.cell, 'Thermal Meassurement');
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 3.0;

  // ─── 6. ANALYSIS / REMARK TABLE (LEGA & PROPORSIONAL) ─────────────────────
  const analysisData = reportData.analysis || {
    isNormal: true,
    isAbnormal: false,
    remark: 'Panel Busduct beroperasi secara normal, koneksi joint kencang, suhu joint dalam batas aman (<40°C), dan area sekitar bersih dari debu.',
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
    head: [[{ content: 'Analysis/Remark', colSpan: 3, styles: { fillColor: SECTION_BLUE_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 7.2, minCellHeight: 5.2, halign: 'left', valign: 'middle' } }]],
    body: [
      [
        { content: `${isNorm ? '[✓]' : '[  ]'} Normal operation`, styles: { fontStyle: 'bold', cellWidth: 44 } },
        { content: 'Remark :', styles: { fontStyle: 'bold', cellWidth: 26, fillColor: [248, 250, 252] } },
        { content: analysisData.remark || 'Panel Busduct beroperasi secara normal, koneksi joint kencang, suhu joint dalam batas aman (<40°C), dan area sekitar bersih dari debu.' }
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
        { content: 'Work done/action taken', styles: { fontStyle: 'bold', cellWidth: 26, fillColor: [248, 250, 252] } },
        { content: analysisData.workDone || '-' }
      ],
      [
        { content: 'Faul Part SN', styles: { fontStyle: 'bold', cellWidth: 26, fillColor: [248, 250, 252] } },
        { content: `${analysisData.faultPartSN || '-'}      Fault part Name: ${analysisData.faultPartName || '-'}` }
      ]
    ],
    styles: { fontSize: 6.2, cellPadding: 1.1, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18, valign: 'middle' }
  });

  y = (doc as any).lastAutoTable.finalY + 3.0;

  // ─── 7. TIME SPENT TABLE (LEGA & PROPORSIONAL) ────────────────────────────
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
      [{ content: 'TIME SPENT', colSpan: 4, styles: { fillColor: SECTION_BLUE_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 7.2, minCellHeight: 5.2, halign: 'left', valign: 'middle' } }],
      [
        { content: 'Date', styles: { halign: 'center', minCellHeight: 4.8 } },
        { content: 'Departure', styles: { halign: 'center' } },
        { content: 'Start', styles: { halign: 'center' } },
        { content: 'Finish', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 6.2, cellPadding: 0.8 },
    body: [[t.date || c.date || new Date().toISOString().split('T')[0], t.departure || '08:00', t.start || '09:00', t.finish || '17:00']],
    styles: { fontSize: 6.2, cellPadding: 1.1, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18, halign: 'center', valign: 'middle' }
  });

  y = (doc as any).lastAutoTable.finalY + 4.5;

  // ─── 8. SIGNATURES / CUSTOMER ACKNOWLEDGEMENT (LEGA, MEWAH & 1 HALAMAN PENUH) ─
  const engineerName = c.engineer || 'Engineer';
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'plain',
    head: [[{ content: 'CUSTOMER ACKNOWLEDGEMENT:', colSpan: 3, styles: { fontStyle: 'bold', halign: 'center', fontSize: 7.5, textColor: DARK_TEXT } }]],
    body: [
      [
        { content: 'Prepared', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.8 } },
        { content: 'Checked', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.8 } },
        { content: 'Approved', styles: { halign: 'center', fontStyle: 'bold', fontSize: 6.8 } }
      ],
      [
        { content: `\n\n\n\n___________________\nEngineer\n(${engineerName})`, styles: { halign: 'center', fontSize: 6.2 } },
        { content: '\n\n\n\n___________________\nSM/PM\n(Site Manager)', styles: { halign: 'center', fontSize: 6.2 } },
        { content: '\n\n\n\n___________________\nClient / Owner\n(NeutraDC)', styles: { halign: 'center', fontSize: 6.2 } }
      ]
    ],
    styles: { cellPadding: 0.8, textColor: DARK_TEXT }
  });

  // ─── HALAMAN 2+: MULTI-PAGE DOKUMENTASI FOTO DENGAN KOP SURAT FORMAL ───────
  if (optimizedCards && optimizedCards.length > 0) {
    doc.addPage();
    addTopBlueAccent();
    let photoY = margin + 1;

    // Kop Surat Formal Halaman Dokumentasi (3-Kolom persis preview modal)
    doc.setDrawColor(200, 205, 215);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, photoY, contentW, 17, 1.5, 1.5, 'S');

    // Divider vertikal kolom kiri & kanan
    doc.line(margin + 30, photoY, margin + 30, photoY + 17);
    doc.line(pageW - margin - 30, photoY, pageW - margin - 30, photoY + 17);

    // Logo Kiri
    if (logoLeft) {
      doc.addImage(logoLeft, 'PNG', margin + 3, photoY + 2.5, 24, 12);
    }

    // Teks Tengah
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 89, 156);
    doc.text('LAPORAN MAINTENANCE', centerX, photoY + 4.5, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setTextColor(...DARK_TEXT);
    doc.text(`DOKUMENTASI PM: ${customerInfo.equipmentName || 'BUSDUCT'}`, centerX, photoY + 8.5, { align: 'center' });

    doc.setFontSize(6.8);
    doc.setTextColor(0, 89, 156);
    const subTitleLine = c.ciName ? `${c.ciName} - ${c.specification || '4000A'}` : (c.specification || customerInfo.equipmentName || '4000A');
    doc.text(subTitleLine, centerX, photoY + 12.0, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.0);
    doc.setTextColor(100, 100, 100);
    doc.text(`Tanggal Maintenance: ${c.date || new Date().toISOString().split('T')[0]}`, centerX, photoY + 15.5, { align: 'center' });

    // Logo Kanan
    if (logoRight) {
      doc.addImage(logoRight, 'PNG', pageW - margin - 27, photoY + 3, 23, 11);
    }

    photoY += 21;

    const colW = (contentW - 6) / 2;
    const imgH = 56;
    let col = 0;
    let currentPhotoPage = 2;

    const addPhotoFooter = (pageNum: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(120, 120, 120);
      doc.setDrawColor(210, 215, 225);
      doc.setLineWidth(0.2);
      doc.line(margin, pageH - 7, pageW - margin, pageH - 7);
      doc.text('PT DWIMITRA EKATAMA MANDIRI • DOKUMENTASI PM', margin, pageH - 4.5);
      doc.text(`Halaman ${pageNum} (Lampiran Foto)`, pageW - margin, pageH - 4.5, { align: 'right' });
    };

    for (let i = 0; i < optimizedCards.length; i++) {
      const card = optimizedCards[i];
      if (!card.photoBase64) continue;

      if (photoY + imgH + 14 > pageH - 12) {
        addPhotoFooter(currentPhotoPage);
        currentPhotoPage++;
        doc.addPage();
        addTopBlueAccent();
        photoY = margin + 3;
      }

      const xPos = margin + col * (colW + 6);

      try {
        doc.setDrawColor(210, 215, 225);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(xPos, photoY, colW, imgH + 10, 1.5, 1.5, 'FD');

        doc.addImage(card.photoBase64, 'JPEG', xPos + 1.5, photoY + 1.5, colW - 3, imgH);

        // Blue accent bar in description card
        doc.setFillColor(0, 89, 156);
        doc.rect(xPos + 2, photoY + imgH + 3, 1.2, 5.5, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.2);
        doc.setTextColor(0, 89, 156);
        doc.text(`Foto #${i + 1}`, xPos + 4.2, photoY + imgH + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4.8);
        doc.setTextColor(...DARK_TEXT);
        doc.text(card.description || `Pemeriksaan kondisi fisik perangkat #${i + 1}`, xPos + 4.2, photoY + imgH + 8, { maxWidth: colW - 7 });
      } catch (err) {
        console.error('Error adding photo card to Busduct PDF', err);
      }

      col++;
      if (col > 1) {
        col = 0;
        photoY += imgH + 13;
      }
    }

    addPhotoFooter(currentPhotoPage);
  }

  const filename = `Service_Report_BUSDUCT_${c.serialNo || 'AC-002'}_${c.quarter || 'Q2'}.pdf`;
  if (saveToFile) {
    downloadJsPDFDoc(doc, filename);
  }
  const blob = doc.output('blob');
  return Object.assign(doc, { doc, filename, blob });
}
