import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TrafoCustomerInfo, TrafoReportData, TrafoTimeSpent } from '@/types/trafoReportTypes';
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
 * Generate 2 SEPARATE PDF Service Reports for Transformator (trafo@gmail.com):
 * 1. Service Report Format 1 (Inspection, Cleaning, Measurement & Testing)
 * 2. Service Report Format 2 (Current & Load Recording, Voltage, Noise SNI, Thermal Imager & Module Setting)
 */
export async function generateTrafoReportPDF(
  customerInfo: TrafoCustomerInfo,
  reportData: TrafoReportData,
  timeSpent: TrafoTimeSpent,
  originalReportCards?: Array<{ photoBase64?: string; description: string }>
) {
  let optimizedCards = originalReportCards || [];
  if (originalReportCards && originalReportCards.length > 0) {
    toast.loading('Compressing documentation photos...', { id: 'pdf-trafo-compress' });
    optimizedCards = await Promise.all(
      originalReportCards.map(async (c) => {
        if (!c.photoBase64) return c;
        try {
          const compressed = await compressBase64Image(c.photoBase64, { maxWidth: 800, quality: 0.5 });
          return { ...c, photoBase64: compressed };
        } catch (err) {
          console.error('Failed to compress Trafo photo for PDF', err);
          return c;
        }
      })
    );
    toast.dismiss('pdf-trafo-compress');
  }

  // Load logos
  let logoLeft: string | null = null;
  let logoRight: string | null = null;
  try { logoLeft = await loadImageBase64(logoDwimitra); } catch { /* fallback */ }
  try { logoRight = await loadImageBase64(logoNeutraDC); } catch { /* fallback */ }

  const cleanMop = customerInfo.mopNo ? customerInfo.mopNo.replace(/[/\\?%*:|"<>]/g, '_') : 'NeutraDC';

  // Helper to add documentation photo pages
  const addDocumentationPages = (doc: jsPDF, pageW: number, margin: number) => {
    if (optimizedCards.length === 0) return;

    doc.addPage();
    doc.setFillColor(...HEADER_BLUE);
    doc.rect(0, 0, pageW, 2.5, 'F');

    let py = 12;
    doc.setFontSize(10).setFont('helvetica', 'bold');
    doc.text('DOCUMENTATION PHOTOS — TRANSFORMATOR', margin, py);
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
  };

  // ═════════════════════════════════════════════════════════════════════
  // 📄 PDF #1: FORMAT 1 (SERVICE REPORT TRANSFORMATOR - FORMAT 1)
  // ═════════════════════════════════════════════════════════════════════
  const doc1 = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = doc1.internal.pageSize.getWidth();
  const margin = 8;
  const contentW = pageW - 2 * margin;

  const drawHeader = (doc: jsPDF, title: string, subtitle: string = 'Neutra DC Cikarang', startY: number = margin) => {
    doc.setFillColor(...HEADER_BLUE);
    doc.rect(0, 0, pageW, 2.5, 'F');

    const headerH = 16;
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.rect(margin, startY, contentW, headerH);

    if (logoLeft) {
      doc.addImage(logoLeft, 'PNG', margin + 2, startY + 2.5, 28, 11);
    }

    const centerX = pageW / 2;
    doc.setFontSize(11).setFont('helvetica', 'bold');
    doc.setTextColor(...DARK_TEXT);
    doc.text(title, centerX, startY + 6, { align: 'center' });
    doc.setFontSize(8).setFont('helvetica', 'normal');
    doc.text(subtitle, centerX, startY + 11, { align: 'center' });

    if (logoRight) {
      doc.addImage(logoRight, 'PNG', pageW - margin - 26, startY + 3, 24, 10);
    }

    return startY + headerH + 2;
  };

  let y1 = drawHeader(doc1, 'SERVICE REPORT TRANSFORMATOR', 'Neutra DC Cikarang');

  // Customer Table PDF 1
  autoTable(doc1, {
    startY: y1,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 7, cellPadding: 1.2, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    head: [[{ content: 'Customer', colSpan: 6, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' as const, fontSize: 8 } }]],
    body: [
      [
        { content: 'Company name', styles: { fontStyle: 'bold' as const } }, customerInfo.companyName || 'Neutra DC Cikarang',
        { content: 'Type', styles: { fontStyle: 'bold' as const } }, customerInfo.type || '-',
        { content: 'Spesification', styles: { fontStyle: 'bold' as const } }, customerInfo.specification || '-',
      ],
      [
        { content: 'Equpment name', styles: { fontStyle: 'bold' as const } }, customerInfo.equipmentName || 'Transformator',
        { content: 'Serial No:', styles: { fontStyle: 'bold' as const } }, customerInfo.serialNo || '-',
        { content: 'Quarter', styles: { fontStyle: 'bold' as const } }, customerInfo.quarter || 'Q1',
      ],
      [
        { content: 'CI Description', styles: { fontStyle: 'bold' as const } }, customerInfo.ciDescription || 'Transformator Unit',
        { content: 'Product Name', styles: { fontStyle: 'bold' as const } }, customerInfo.productName || '-',
        { content: 'Location', styles: { fontStyle: 'bold' as const } }, customerInfo.location || '-',
      ],
      [
        { content: 'CI Name', styles: { fontStyle: 'bold' as const } }, customerInfo.ciName || '-',
        { content: 'Product Years', styles: { fontStyle: 'bold' as const } }, customerInfo.prodYear || '2021',
        { content: 'Area', styles: { fontStyle: 'bold' as const } }, customerInfo.area || 'Building Office',
      ],
      [
        { content: 'Mop No:', styles: { fontStyle: 'bold' as const } }, { content: customerInfo.mopNo || '-', colSpan: 3 },
        { content: 'Date', styles: { fontStyle: 'bold' as const } }, customerInfo.date || '-',
      ],
      [
        { content: 'Engginer', styles: { fontStyle: 'bold' as const } }, { content: customerInfo.engineer || '-', colSpan: 5 },
      ]
    ],
    theme: 'grid'
  });

  y1 = (doc1 as any).lastAutoTable.finalY + 2.5;

  // Visual Inspection Table PDF 1
  autoTable(doc1, {
    startY: y1,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.9, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' as const, halign: 'left' },
    head: [
      [{ content: 'Visual inspection & Maintenance   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', colSpan: 5 }] as any,
      ['No', 'Activity', 'Parameter', 'Inspection', 'Status']
    ],
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 78 },
      2: { cellWidth: 54 },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 30 }
    },
    body: reportData.visualInspection.map(item => [
      item.no,
      item.activity,
      item.parameter,
      item.statusOK ? '√ (OK)' : item.statusNOK ? '× (NOK)' : 'N/A',
      item.remarks || 'Normal'
    ]),
    theme: 'grid'
  });

  y1 = (doc1 as any).lastAutoTable.finalY + 2.5;

  // Cleaning Table PDF 1
  autoTable(doc1, {
    startY: y1,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.9, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' as const, halign: 'left' },
    head: [
      [{ content: 'Cleaning   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', colSpan: 5 }] as any,
      ['No', 'Activity', 'Parameter', 'Cleaning', 'Status']
    ],
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 78 },
      2: { cellWidth: 54 },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 30 }
    },
    body: reportData.cleaning.map(item => [
      item.no,
      item.activity,
      item.parameter,
      item.statusOK ? '√ (OK)' : item.statusNOK ? '× (NOK)' : 'N/A',
      item.remarks || 'Clean'
    ]),
    theme: 'grid'
  });

  y1 = (doc1 as any).lastAutoTable.finalY + 2.5;

  if (y1 > 230) {
    doc1.addPage();
    y1 = drawHeader(doc1, 'SERVICE REPORT TRANSFORMATOR', 'Neutra DC Cikarang (Lanjutan)');
  }

  // Meassurement Table PDF 1
  autoTable(doc1, {
    startY: y1,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.9, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' as const, halign: 'left' },
    head: [
      [{ content: 'Meassurement   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', colSpan: 5 }] as any,
      ['No', 'Activity', 'Parameter', 'Result', 'Status']
    ],
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 78 },
      2: { cellWidth: 54 },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 30 }
    },
    body: reportData.measurement.map(item => [
      item.no,
      item.activity,
      item.parameter,
      item.result || 'OK',
      item.statusOK ? 'OK' : item.statusNOK ? 'NOK' : 'N/A'
    ]),
    theme: 'grid'
  });

  y1 = (doc1 as any).lastAutoTable.finalY + 2.5;

  // Testing Table PDF 1
  autoTable(doc1, {
    startY: y1,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.9, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' as const, halign: 'left' },
    head: [
      [{ content: 'Testing   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', colSpan: 5 }] as any,
      ['No', 'Activity', 'Parameter', 'Result', 'Status']
    ],
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 78 },
      2: { cellWidth: 54 },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 30 }
    },
    body: reportData.testing.map(item => [
      item.no,
      item.activity,
      item.parameter,
      item.result || 'Pass',
      item.statusOK ? 'OK' : item.statusNOK ? 'NOK' : 'N/A'
    ]),
    theme: 'grid'
  });

  y1 = (doc1 as any).lastAutoTable.finalY + 2.5;

  // Analysis / Remark PDF 1
  autoTable(doc1, {
    startY: y1,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6.5, cellPadding: 1, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: 'bold' as const },
    head: [[{ content: 'Analysis/Remark', colSpan: 2 }]],
    body: [
      [
        { content: `${reportData.analysis.isNormal ? '[X]' : '[  ]'} Normal operation\n${reportData.analysis.isAbnormal ? '[X]' : '[  ]'} Abnormal operation`, styles: { fontStyle: 'bold' as const, cellWidth: 50 } },
        { content: `Remark:\n${reportData.analysis.remark || 'Transformator beroperasi normal & kondisi baik.'}` }
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

  y1 = (doc1 as any).lastAutoTable.finalY + 2.5;

  // TIME SPENT PDF 1
  autoTable(doc1, {
    startY: y1,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6.5, cellPadding: 1, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2, halign: 'center' },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' as const },
    head: [[{ content: 'TIME SPENT', colSpan: 4 }]],
    body: [
      [{ content: 'Date', styles: { fontStyle: 'bold' as const } }, { content: 'Departure', styles: { fontStyle: 'bold' as const } }, { content: 'Start', styles: { fontStyle: 'bold' as const } }, { content: 'Finish', styles: { fontStyle: 'bold' as const } }],
      [timeSpent.date || '-', timeSpent.departure || '08:00', timeSpent.start || '09:00', timeSpent.finish || '17:00']
    ],
    theme: 'grid'
  });

  y1 = (doc1 as any).lastAutoTable.finalY + 3;

  doc1.setFontSize(7).setFont('helvetica', 'bold');
  doc1.text('CUSTOMER ACKNOWLEDGEMENT:', margin, y1);
  doc1.text('SERVICE ATTENDED BY:', pageW / 2 + 10, y1);
  y1 += 6;

  autoTable(doc1, {
    startY: y1,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6.5, cellPadding: 1, textColor: [30, 30, 30], lineColor: [255, 255, 255], halign: 'center' },
    body: [
      ['Prepared', 'Checked', 'Approved'],
      ['\n\nSIGNED________', '\n\nSIGNED________', '\n\nSIGNED________'],
      ['Engineer', 'SM/PM', 'Client/Owner']
    ],
    theme: 'plain'
  });

  addDocumentationPages(doc1, pageW, margin);

  // Save PDF 1
  doc1.save(`Service_Report_Transformator_Format1_${cleanMop}.pdf`);


  // ═════════════════════════════════════════════════════════════════════
  // 📄 PDF #2: FORMAT 2 (SERVICE REPORT TRANSFORMATOR - FORMAT 2)
  // ═════════════════════════════════════════════════════════════════════
  const doc2 = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  let y2 = drawHeader(doc2, 'SERVICE REPORT TRANSFORMATOR', 'Neutra DC Cikarang');

  // Customer Table PDF 2
  autoTable(doc2, {
    startY: y2,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6.5, cellPadding: 1, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    head: [[{ content: 'Customer', colSpan: 6, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' as const, fontSize: 7.5 } }]],
    body: [
      [
        { content: 'Company name', styles: { fontStyle: 'bold' as const } }, customerInfo.companyName || 'Neutra DC Cikarang',
        { content: 'Type', styles: { fontStyle: 'bold' as const } }, customerInfo.type || '-',
        { content: 'Spesification', styles: { fontStyle: 'bold' as const } }, customerInfo.specification || '-',
        { content: 'Mop No:', styles: { fontStyle: 'bold' as const } }, customerInfo.mopNo || 'DME-TDE/MOP/TR/01 0202/26',
      ],
      [
        { content: 'Equpment name', styles: { fontStyle: 'bold' as const } }, customerInfo.equipmentName || 'Transformator',
        { content: 'Serial No:', styles: { fontStyle: 'bold' as const } }, customerInfo.serialNo || '-',
        { content: 'Quarter', styles: { fontStyle: 'bold' as const } }, customerInfo.quarter || 'Q1',
        { content: 'Date', styles: { fontStyle: 'bold' as const } }, customerInfo.date || '-',
      ],
    ],
    theme: 'grid'
  });

  y2 = (doc2 as any).lastAutoTable.finalY + 2;

  // Visual Inspection Table PDF 2
  autoTable(doc2, {
    startY: y2,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.8, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' as const, halign: 'left' },
    head: [
      [{ content: 'Visual Inspection', colSpan: 4 }] as any,
      ['No', 'Activity', 'Condition', 'Remarks']
    ],
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 120 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 36 }
    },
    body: reportData.format2VisualCheck.map(item => [
      item.no,
      item.activity,
      item.condition,
      item.remarks || ''
    ]),
    theme: 'grid'
  });

  y2 = (doc2 as any).lastAutoTable.finalY + 2;

  // Current & Load Recording Table PDF 2
  autoTable(doc2, {
    startY: y2,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.8, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2, halign: 'center' },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' as const },
    head: [
      [{ content: 'Current & Load Recording', colSpan: 8 }] as any,
      ['Wire', 'Result (Voltage)', 'Wire', 'Result (Voltage)', 'Wire', 'Result (Ampere)', 'Wire', 'Result']
    ],
    body: [
      ['R-S', reportData.currentLoad.rsVolt, 'R-N', reportData.currentLoad.rnVolt, 'R', reportData.currentLoad.rAmp, 'KW', reportData.currentLoad.rKw],
      ['S-T', reportData.currentLoad.stVolt, 'S-N', reportData.currentLoad.snVolt, 'S', reportData.currentLoad.sAmp, 'KVA', reportData.currentLoad.sKva],
      ['T-R', reportData.currentLoad.trVolt, 'T-N', reportData.currentLoad.tnVolt, 'T', reportData.currentLoad.tAmp, 'KVAR', reportData.currentLoad.tKvar],
      ['N-G', reportData.currentLoad.ngVolt, '-', '-', 'N', reportData.currentLoad.nAmp, '-', '-'],
    ],
    theme: 'grid'
  });

  y2 = (doc2 as any).lastAutoTable.finalY + 2;

  // Voltage & Current Measurement Table PDF 2
  autoTable(doc2, {
    startY: y2,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.8, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2, halign: 'center' },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' as const },
    head: [
      [{ content: 'Voltage & Current Measurement', colSpan: 7 }] as any,
      ['Wire', 'Result (Voltage)', 'Wire', 'Result (Voltage)', 'Wire', 'Result (Ampere)', 'Remarks']
    ],
    body: [
      ['R-S', reportData.voltageCurrent.rsVolt, 'R-N', reportData.voltageCurrent.rnVolt, 'R', reportData.voltageCurrent.rAmp, reportData.voltageCurrent.remarks || 'Balanced'],
      ['S-T', reportData.voltageCurrent.stVolt, 'S-N', reportData.voltageCurrent.snVolt, 'S', reportData.voltageCurrent.sAmp, ''],
      ['T-R', reportData.voltageCurrent.trVolt, 'T-N', reportData.voltageCurrent.tnVolt, 'T', reportData.voltageCurrent.tAmp, ''],
      ['N-G', reportData.voltageCurrent.ngVolt, '-', '-', 'N', reportData.voltageCurrent.nAmp, ''],
    ],
    theme: 'grid'
  });

  y2 = (doc2 as any).lastAutoTable.finalY + 2;

  // Grounding Resistance PDF 2
  autoTable(doc2, {
    startY: y2,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.8, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' as const },
    head: [[{ content: 'Grounding Resistance', colSpan: 3 }]],
    body: [
      [
        { content: 'Wire', styles: { fontStyle: 'bold' as const, halign: 'center' } },
        { content: 'Result (Ohm)', styles: { fontStyle: 'bold' as const, halign: 'center' } },
        { content: 'Remarks', styles: { fontStyle: 'bold' as const } }
      ],
      ['Grounding', `${reportData.groundingOhm || '0.4'} Ohm`, reportData.groundingRemarks || 'Complies < 1 Ohm']
    ],
    theme: 'grid'
  });

  y2 = (doc2 as any).lastAutoTable.finalY + 2;

  // Noise & Thermal Grid PDF 2
  autoTable(doc2, {
    startY: y2,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 5.5, cellPadding: 0.8, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' as const },
    head: [[{ content: 'Transformer Noise Measurement (SNI 04-0204-1989) & Thermal Imager Fabrication Standard', colSpan: 4 }]],
    body: [
      [
        { content: `Noise Result: ${reportData.noiseMeasurement.resultDb || '58'} dB`, styles: { fontStyle: 'bold' as const } },
        'Reference SNI Noise:\n630KVA:57dB | 1000KVA:58dB | 1250KVA:59dB | 2000KVA:61dB | 2500KVA:62dB | 5000KVA:65dB',
        { content: `Thermal Result: ${reportData.thermalImager.resultTemp || '42'} °C`, styles: { fontStyle: 'bold' as const } },
        'Fabrication Load % vs Temp:\n0%:35°C | 20%:45°C | 40%:55°C | 60%:65°C | 80%:80°C | 100%:90°C'
      ]
    ],
    theme: 'grid'
  });

  y2 = (doc2 as any).lastAutoTable.finalY + 2;

  // Temperature Sensor & Module Setting PDF 2
  autoTable(doc2, {
    startY: y2,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.8, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' as const },
    head: [[{ content: 'Temperature Sensor & Temp. Module Setting', colSpan: 5 }]],
    body: [
      ['Temp Sensor', 'Result (°C)', 'Temp Modul Setting', 'Value (°C)', 'Remarks'],
      ['R', `${reportData.tempSensorSetting.tempR || '45'} °C`, 'Fan On', `${reportData.tempSensorSetting.fanOn || '100'} °C`, reportData.tempSensorSetting.remarks || 'OK'],
      ['S', `${reportData.tempSensorSetting.tempS || '46'} °C`, 'Fan Off', `${reportData.tempSensorSetting.fanOff || '90'} °C`, ''],
      ['T', `${reportData.tempSensorSetting.tempT || '45'} °C`, 'Alarm', `${reportData.tempSensorSetting.alarm || '110'} °C`, ''],
      ['-', '-', 'Trip', `${reportData.tempSensorSetting.trip || '130'} °C`, ''],
    ],
    theme: 'grid'
  });

  y2 = (doc2 as any).lastAutoTable.finalY + 2;

  // Analysis / Remark PDF 2
  autoTable(doc2, {
    startY: y2,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6.5, cellPadding: 1, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: 'bold' as const },
    head: [[{ content: 'Analysis/Remark', colSpan: 2 }]],
    body: [
      [
        { content: `${reportData.analysis.isNormal ? '[X]' : '[  ]'} Normal operation\n${reportData.analysis.isAbnormal ? '[X]' : '[  ]'} Abnormal operation`, styles: { fontStyle: 'bold' as const, cellWidth: 50 } },
        { content: `Remark:\n${reportData.analysis.remark || 'Transformator beroperasi normal & kondisi baik.'}` }
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

  y2 = (doc2 as any).lastAutoTable.finalY + 2;

  // TIME SPENT PDF 2
  autoTable(doc2, {
    startY: y2,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.8, textColor: [30, 30, 30], lineColor: [180, 180, 180], lineWidth: 0.2, halign: 'center' },
    headStyles: { fillColor: [0, 89, 156], textColor: [255, 255, 255], fontStyle: 'bold' as const },
    head: [[{ content: 'TIME SPENT', colSpan: 4 }]],
    body: [
      [{ content: 'Date', styles: { fontStyle: 'bold' as const } }, { content: 'Departure', styles: { fontStyle: 'bold' as const } }, { content: 'Start', styles: { fontStyle: 'bold' as const } }, { content: 'Finish', styles: { fontStyle: 'bold' as const } }],
      [timeSpent.date || '-', timeSpent.departure || '08:00', timeSpent.start || '09:00', timeSpent.finish || '17:00']
    ],
    theme: 'grid'
  });

  y2 = (doc2 as any).lastAutoTable.finalY + 2.5;

  doc2.setFontSize(7).setFont('helvetica', 'bold');
  doc2.text('CUSTOMER ACKNOWLEDGEMENT:', margin, y2);
  y2 += 4;

  autoTable(doc2, {
    startY: y2,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6.5, cellPadding: 1, textColor: [30, 30, 30], lineColor: [255, 255, 255], halign: 'center' },
    body: [
      ['Prepared', 'Checked', 'Approved'],
      ['\n\nEngineer', '\n\nSM/PM', '\n\nClient / Owner']
    ],
    theme: 'plain'
  });

  addDocumentationPages(doc2, pageW, margin);

  // Save PDF 2
  doc2.save(`Service_Report_Transformator_Format2_${cleanMop}.pdf`);
  toast.success('2 File PDF Service Report Transformator berhasil diunduh secara bersamaan!');
}
