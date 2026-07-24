import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ACSplitCustomerInfo, ACSplitReportData, ACSplitTimeSpent } from '@/types/acSplitReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { compressBase64Image } from '@/utils/imageCompression';
import { toast } from 'sonner';

const HEADER_BLUE: [number, number, number] = [0, 89, 156];
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

/**
 * Generate PDF Service Report Split Wall AC (NeutraDC Cikarang)
 */
export async function generateACSplitReportPDF(
  customerInfo: ACSplitCustomerInfo,
  reportData: ACSplitReportData,
  timeSpent: ACSplitTimeSpent,
  originalReportCards?: Array<{ photoBase64?: string; description: string }>
) {
  let optimizedCards = originalReportCards || [];
  if (originalReportCards && originalReportCards.length > 0) {
    toast.loading('Compressing documentation photos...', { id: 'pdf-acsplit-compress' });
    optimizedCards = await Promise.all(
      originalReportCards.map(async (c) => {
        if (!c.photoBase64) return c;
        try {
          const compressed = await compressBase64Image(c.photoBase64, { maxWidth: 800, quality: 0.5 });
          return { ...c, photoBase64: compressed };
        } catch (err) {
          console.error('Failed to compress AC Split photo for PDF', err);
          return c;
        }
      })
    );
    toast.dismiss('pdf-acsplit-compress');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 8;
  const contentW = pageW - 2 * margin;
  let y = margin;

  // Top blue stripe
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(0, 0, pageW, 2.5, 'F');

  // Load logos
  let logoLeft: string | null = null;
  let logoRight: string | null = null;
  try { logoLeft = await loadImageBase64(logoDwimitra); } catch { /* fallback */ }
  try { logoRight = await loadImageBase64(logoNeutraDC); } catch { /* fallback */ }

  // ─── 1. HEADER BLOCK ───────────────────────────────────────────────
  const headerH = 16;
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentW, headerH);

  if (logoLeft) {
    doc.addImage(logoLeft, 'PNG', margin + 2, y + 2.5, 28, 11);
  }

  const centerX = pageW / 2;
  doc.setFontSize(11).setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_TEXT);
  doc.text('SERVICE REPORT SPLIT WALL AC', centerX, y + 6, { align: 'center' });
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text('NeutraDC Cikarang', centerX, y + 11, { align: 'center' });

  if (logoRight) {
    doc.addImage(logoRight, 'PNG', pageW - margin - 26, y + 3, 24, 10);
  }

  y += headerH + 2;

  // ─── 2. CUSTOMER & EQUIPMENT INFO TABLE ─────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 7, cellPadding: 1.2, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    head: [[
      { content: 'Customer', colSpan: 6, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 8 } }
    ]],
    body: [
      [
        { content: 'Company name', styles: { fontStyle: 'bold' } }, customerInfo.companyName || 'Neutra DC Cikarang',
        { content: 'Type', styles: { fontStyle: 'bold' } }, customerInfo.type || 'RC35NV14',
        { content: 'Specification', styles: { fontStyle: 'bold' } }, customerInfo.specification || '1,5 Kw',
      ],
      [
        { content: 'Equipment Name', styles: { fontStyle: 'bold' } }, customerInfo.equipmentName || 'AC SPLIT WALL',
        { content: 'Serial No.', styles: { fontStyle: 'bold' } }, customerInfo.serialNo || 'E132910',
        { content: 'Quarter', styles: { fontStyle: 'bold' } }, customerInfo.quarter || 'Q1',
      ],
      [
        { content: 'CI Description', styles: { fontStyle: 'bold' } }, customerInfo.ciDescription || 'Split wall AC Indoor',
        { content: 'Product Name', styles: { fontStyle: 'bold' } }, customerInfo.productName || 'Daikin',
        { content: 'Location', styles: { fontStyle: 'bold' } }, customerInfo.location || 'FCC Room',
      ],
      [
        { content: 'CI Name', styles: { fontStyle: 'bold' } }, customerInfo.ciName || '-',
        { content: 'Prod.Year', styles: { fontStyle: 'bold' } }, customerInfo.prodYear || '2021',
        { content: 'Area', styles: { fontStyle: 'bold' } }, customerInfo.area || 'Building Office',
      ],
      [
        { content: 'MOP No.', styles: { fontStyle: 'bold' } }, { content: customerInfo.mopNo || '-', colSpan: 3 },
        { content: 'Date', styles: { fontStyle: 'bold' } }, customerInfo.date || '-',
      ],
      [
        { content: 'Engineer', styles: { fontStyle: 'bold' } }, { content: customerInfo.engineer || '-', colSpan: 5 },
      ]
    ],
    theme: 'grid'
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // ─── 3. INDOOR UNIT INSPECTION & CLEANING ────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6.5, cellPadding: 1, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
    head: [
      [{ content: 'Inspection & Cleaning Indoor Unit', colSpan: 5 }] as any,
      ['No', 'Activity', 'Parameter', 'Condition', 'Remarks']
    ],
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 72 },
      2: { cellWidth: 62 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 26 }
    },
    body: reportData.indoorInspection.map(item => [
      item.no,
      item.activity,
      item.parameter,
      item.isGood ? 'Good' : item.isNotGood ? 'Not Good' : 'Good',
      item.remarks || ''
    ]),
    theme: 'grid'
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // ─── 4. OUTDOOR UNIT INSPECTION & CLEANING ───────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6.5, cellPadding: 1, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
    head: [
      [{ content: 'Inspection & Cleaning Outdoor Unit', colSpan: 5 }] as any,
      ['No', 'Activity', 'Parameter', 'Condition', 'Remarks']
    ],
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 72 },
      2: { cellWidth: 62 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 26 }
    },
    body: reportData.outdoorInspection.map(item => [
      item.no,
      item.activity,
      item.parameter,
      item.isGood ? 'Good' : item.isNotGood ? 'Not Good' : 'Good',
      item.remarks || ''
    ]),
    theme: 'grid'
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // Check for page break if needed
  if (y > 230) {
    doc.addPage();
    doc.setFillColor(...HEADER_BLUE);
    doc.rect(0, 0, pageW, 2.5, 'F');
    y = margin;
  }

  // ─── 5. TEST AND MEASURING ───────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6.5, cellPadding: 1, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
    head: [
      [{ content: 'Test and measuring', colSpan: 5 }] as any,
      ['No', 'Activity', 'Parameter', 'Result', 'Remarks']
    ],
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 72 },
      2: { cellWidth: 62 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 26 }
    },
    body: [
      [
        reportData.testMeasuring[0]?.no || 'a.',
        reportData.testMeasuring[0]?.activity || 'Turn on the AC unit using the remote control...',
        reportData.testMeasuring[0]?.parameter || 'Normal operation',
        `Before: ${reportData.testMeasuring[0]?.resultBefore || 'Good'} | After: ${reportData.testMeasuring[0]?.resultAfter || 'Good'}`,
        reportData.testMeasuring[0]?.remarks || ''
      ],
      [
        reportData.testMeasuring[1]?.no || 'b.',
        reportData.testMeasuring[1]?.activity || 'Measure input/output voltage and current...',
        reportData.testMeasuring[1]?.parameter || 'For current not Over 125% I nominal, for voltage 210-240 VAC',
        `Volt: ${reportData.testMeasuring[1]?.resultVoltage || '225V'} | Amp: ${reportData.testMeasuring[1]?.resultCurrent || '6.5A'}`,
        reportData.testMeasuring[1]?.remarks || ''
      ],
      [
        reportData.testMeasuring[2]?.no || 'c.',
        reportData.testMeasuring[2]?.activity || 'Pressure Measurement',
        reportData.testMeasuring[2]?.parameter || 'For Refrigrant R32 suction pressure (115-145 psi)',
        reportData.testMeasuring[2]?.resultVal || '130 psi',
        reportData.testMeasuring[2]?.remarks || ''
      ],
      [
        reportData.testMeasuring[3]?.no || 'd.',
        reportData.testMeasuring[3]?.activity || 'Ensure there are no error code indications...',
        reportData.testMeasuring[3]?.parameter || 'Normal operation',
        reportData.testMeasuring[3]?.resultVal || 'Normal operation',
        reportData.testMeasuring[3]?.remarks || ''
      ],
    ],
    theme: 'grid'
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // ─── 6. ANALYSIS / REMARK ───────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 7, cellPadding: 1.2, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: 'bold' },
    head: [[{ content: 'Analysis/Remark', colSpan: 2 }]],
    body: [
      [
        { content: `${reportData.analysis.isNormal ? '[X]' : '[  ]'} Normal operation\n${reportData.analysis.isAbnormal ? '[X]' : '[  ]'} Abnormal operation`, styles: { fontStyle: 'bold' as const, cellWidth: 50 } },
        { content: `Remark:\n${reportData.analysis.remark || 'Unit AC Split Wall beroperasi normal dan bersih.'}` }
      ],
      ...(reportData.analysis.isAbnormal ? ([
        [{ content: 'Fault symptom', styles: { fontStyle: 'bold' as const } }, reportData.analysis.faultSymptom || '-'],
        [{ content: 'Fault analysis', styles: { fontStyle: 'bold' as const } }, reportData.analysis.faultAnalysis || '-'],
        [{ content: 'Work done/action taken', styles: { fontStyle: 'bold' as const } }, reportData.analysis.workDone || '-'],
        [{ content: `Fault Part SN: ${reportData.analysis.faultPartSN || '-'}`, styles: { fontStyle: 'bold' as const } }, `Fault part Name: ${reportData.analysis.faultPartName || '-'}`],
      ] as any) : [])
    ],
    theme: 'grid'
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // ─── 7. TIME SPENT ─────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 7, cellPadding: 1, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2, halign: 'center' },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [[{ content: 'TIME SPENT', colSpan: 4 }]],
    body: [
      [
        { content: 'Date', styles: { fontStyle: 'bold' as const } },
        { content: 'Departure', styles: { fontStyle: 'bold' as const } },
        { content: 'Start', styles: { fontStyle: 'bold' as const } },
        { content: 'Finish', styles: { fontStyle: 'bold' as const } },
      ],
      [
        timeSpent.date || '-',
        timeSpent.departure || '08:00',
        timeSpent.start || '09:00',
        timeSpent.finish || '17:00',
      ]
    ],
    theme: 'grid'
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ─── 8. SIGNATURES / ACKNOWLEDGEMENT ───────────────────────────────
  if (y > 250) {
    doc.addPage();
    doc.setFillColor(...HEADER_BLUE);
    doc.rect(0, 0, pageW, 2.5, 'F');
    y = margin + 5;
  }

  doc.setFontSize(8).setFont('helvetica', 'bold');
  doc.text('CUSTOMER ACKNOWLEDGEMENT:', margin, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 7, cellPadding: 2, textColor: [30, 30, 30], lineColor: [255, 255, 255], halign: 'center' },
    body: [
      ['Prepared', 'Checked', 'Approved'],
      ['\n\n\n', '\n\n\n', '\n\n\n'],
      ['Engineer', 'SM/PM', 'Client/Owner']
    ],
    theme: 'plain'
  });

  // ─── 9. DOCUMENTATION PHOTOS PAGE (IF ANY) ─────────────────────────
  if (optimizedCards.length > 0) {
    doc.addPage();
    doc.setFillColor(...HEADER_BLUE);
    doc.rect(0, 0, pageW, 2.5, 'F');

    let py = 12;
    doc.setFontSize(10).setFont('helvetica', 'bold');
    doc.text('DOCUMENTATION PHOTOS — AC SPLIT WALL', margin, py);
    py += 8;

    const cardsPerPage = 4;
    const photoWidth = 88;
    const photoHeight = 65;

    for (let i = 0; i < optimizedCards.length; i++) {
      if (i > 0 && i % cardsPerPage === 0) {
        doc.addPage();
        doc.setFillColor(...HEADER_BLUE);
        doc.rect(0, 0, pageW, 2.5, 'F');
        py = 12;
      }

      const card = optimizedCards[i];
      const colIndex = i % 2;
      const rowIndex = Math.floor((i % cardsPerPage) / 2);

      const posX = margin + colIndex * (photoWidth + 10);
      const posY = py + rowIndex * (photoHeight + 22);

      doc.setDrawColor(200);
      doc.rect(posX, posY, photoWidth, photoHeight + 16);

      if (card.photoBase64) {
        try {
          doc.addImage(card.photoBase64, 'JPEG', posX + 2, posY + 2, photoWidth - 4, photoHeight);
        } catch {
          doc.setFontSize(7).setTextColor(150);
          doc.text('[Image Error]', posX + photoWidth / 2, posY + photoHeight / 2, { align: 'center' });
        }
      }

      doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(30);
      const descLines = doc.splitTextToSize(card.description || `Photo ${i + 1}`, photoWidth - 4);
      doc.text(descLines, posX + 2, posY + photoHeight + 5);
    }
  }

  // Save PDF
  const filename = `Service_Report_AC_Split_${customerInfo.mopNo ? customerInfo.mopNo.replace(/[/\\?%*:|"<>]/g, '_') : 'NeutraDC'}.pdf`;
  doc.save(filename);
}
