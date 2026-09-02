// ============================================================================
// FILE: frontend/service_reports/universalServiceReportPDF.ts
// Deskripsi: Master Generator Cetak PDF 1:1 Presisi Spreadsheet Service Report
//            (Halaman 1: Full Sheet Resmi ATS / Equipment Presisi 1:1 Spreadsheet)
//            + Halaman 2+: Lampiran Multi-Page Dokumentasi Foto Ber-Header Formal
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ServiceReportPayload } from '@/types/serviceReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { compressBase64Image } from '@/utils/imageCompression';
import { toast } from 'sonner';

// Color Palette 1:1 Spreadsheet Style
const BLUE_ACCENT: [number, number, number] = [0, 89, 156];
const SECTION_BLUE_BG: [number, number, number] = [142, 180, 227]; // #8EB4E2 Header Bar
const SUB_HEADER_BG: [number, number, number] = [217, 226, 243]; // #D9E2F3 Sub Header
const YELLOW_STANDARD_BG: [number, number, number] = [255, 242, 204]; // #FFF2CC Yellow Highlight for Standard
const BORDER_COLOR: [number, number, number] = [160, 160, 160];
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

export async function generateUniversalServiceReportPDF(
  payload: ServiceReportPayload,
  photoCards: Array<{ photoBase64?: string; description: string }> = [],
  saveToFile: boolean = true
): Promise<jsPDF> {
  const toastId = 'gen-sr-pdf';
  toast.loading('Membuat Dokumen Service Report PDF...', { id: toastId });

  // 1. Inisialisasi dokumen jsPDF (Format A4 Portrait)
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
    doc.rect(0, 0, pageW, 2.0, 'F');
  };

  const drawInstructionHeaderBar = (cell: any, sectionTitle: string) => {
    const textX = cell.x + 1.2;
    const textY = cell.y + cell.height / 2 + 0.8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...DARK_TEXT);

    // 1. Title + "   Please mark OK ("
    const part1 = `${sectionTitle}   Please mark OK (`;
    doc.text(part1, textX, textY);
    let curX = textX + doc.getTextWidth(part1);

    // Symmetrical space before checkmark inside ( )
    curX += 0.9;

    // 2. Draw ✓ (checkmark)
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.35);
    doc.line(curX, textY - 0.45, curX + 0.35, textY - 0.05);
    doc.line(curX + 0.35, textY - 0.05, curX + 1.05, textY - 1.15);

    // Symmetrical space after checkmark inside ( )
    curX += 1.95;

    // 3. "), not OK ("
    const part2 = '), not OK (';
    doc.text(part2, curX, textY);
    curX += doc.getTextWidth(part2);

    // Symmetrical space before cross inside ( )
    curX += 0.9;

    // 4. Draw ✕ (cross)
    doc.line(curX, textY - 0.95, curX + 0.85, textY - 0.05);
    doc.line(curX + 0.85, textY - 0.95, curX, textY - 0.05);

    // Symmetrical space after cross inside ( )
    curX += 1.75;

    // 5. "), not applicable (N/A) in the box"
    const part3 = '), not applicable (N/A) in the box';
    doc.text(part3, curX, textY);
  };

  addTopBlueAccent();
  let y = margin - 1;

  // ─── 1. KOP SURAT / HEADER ────────────────────────────────────────────────
  const headerH = 13;
  if (logoLeft) {
    doc.addImage(logoLeft, 'PNG', margin + 2, y + 0.5, 26, 12);
  }

  const centerX = pageW / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK_TEXT);
  const titleText = payload.equipmentKey === 'ats' || payload.equipmentName.toLowerCase().includes('ats')
    ? 'SERVICE REPORT AUTOMATIC TRANSFER SWITCH'
    : `SERVICE REPORT ${payload.equipmentName.toUpperCase()}`;
  doc.text(titleText, centerX, y + 5.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Neutra DC Cikarang', centerX, y + 10.5, { align: 'center' });

  if (logoRight) {
    doc.addImage(logoRight, 'PNG', pageW - margin - 25, y + 1, 23, 11);
  }

  y += headerH + 1.5;

  const c: any = payload.customerInfo || {};
  const t = payload.timeSpent || ({} as any);
  const op = payload.operationStatus || ({} as any);
  const checklist = payload.visualChecklist || [];
  const m = payload.measurements || ({} as any);

  // ─── 2. TABEL CUSTOMER INFORMATION (4 Baris x 8 Kolom 1:1 Spreadsheet) ───
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [[{ content: 'Customer', colSpan: 8, styles: { fillColor: SECTION_BLUE_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 6.5, halign: 'left' } }]],
    body: [
      [
        { content: 'Company name', styles: { fontStyle: 'bold', cellWidth: 23 } },
        { content: c.companyName || 'Neutra DC Cikarang', styles: { cellWidth: 35 } },
        { content: 'Type', styles: { fontStyle: 'bold', cellWidth: 17 } },
        { content: c.type || c.specification || '-', styles: { cellWidth: 26 } },
        { content: 'Spesification', styles: { fontStyle: 'bold', cellWidth: 23 } },
        { content: c.specification || c.model || '-', styles: { cellWidth: 32 } },
        { content: 'Mop No:', styles: { fontStyle: 'bold', cellWidth: 17 } },
        { content: c.mopNo || c.mapNo || '-', styles: { cellWidth: 'auto' } }
      ],
      [
        { content: 'Equpment name', styles: { fontStyle: 'bold' } },
        { content: c.equipmentName || payload.equipmentName, styles: {} },
        { content: 'Serial No:', styles: { fontStyle: 'bold' } },
        { content: c.serialNo || '-', styles: {} },
        { content: '', colSpan: 2, styles: { fillColor: [255, 255, 255] } },
        { content: 'Quarter', styles: { fontStyle: 'bold' } },
        { content: c.quarter || 'Q3', styles: {} }
      ],
      [
        { content: 'CI Description', styles: { fontStyle: 'bold' } },
        { content: c.ciDescription || '-', styles: {} },
        { content: 'Product Name', styles: { fontStyle: 'bold' } },
        { content: c.productName || '-', styles: {} },
        { content: 'Location', styles: { fontStyle: 'bold' } },
        { content: c.location || '-', styles: {} },
        { content: 'Date', styles: { fontStyle: 'bold' } },
        { content: c.date || new Date().toISOString().split('T')[0], styles: {} }
      ],
      [
        { content: 'CI Name', styles: { fontStyle: 'bold' } },
        { content: c.ciName || '-', styles: {} },
        { content: 'Product Years', styles: { fontStyle: 'bold' } },
        { content: c.prodYear || c.productYears || '-', styles: {} },
        { content: 'Area', styles: { fontStyle: 'bold' } },
        { content: c.area || '-', styles: {} },
        { content: 'Engginer', styles: { fontStyle: 'bold' } },
        { content: c.engineer || payload.accountEmail || '-', styles: {} }
      ]
    ],
    styles: { fontSize: 5.2, cellPadding: 0.5, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18 }
  });

  y = (doc as any).lastAutoTable.finalY + 0.5;

  // ─── 3. TABEL VISUAL INSPECTION & CHECK (16 Poin a - p) ───────────────────
  const viRows = checklist.map((item, idx) => {
    const noLabel = item.no ? (item.no.endsWith('.') ? item.no : `${item.no}.`) : `${String.fromCharCode(97 + idx)}.`;

    return [
      noLabel,
      item.activity || '-',
      item.parameter || 'Good Condition',
      'Good',
      'Not Good',
      item.remarks || ''
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: 'Visual inspection & Check', colSpan: 6, styles: { fillColor: SECTION_BLUE_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 6.5, halign: 'left' } }],
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
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.2, cellPadding: 0.4 },
    body: viRows,
    styles: { fontSize: 4.8, cellPadding: 0.35, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18 },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center', valign: 'middle' },
      1: { cellWidth: 88, valign: 'middle' },
      2: { cellWidth: 40, valign: 'middle' },
      3: { cellWidth: 14, halign: 'center', valign: 'middle' },
      4: { cellWidth: 17, halign: 'center', valign: 'middle' },
      5: { cellWidth: 30, halign: 'center', valign: 'middle' }
    },
    didParseCell(data) {
      if (data.section === 'body') {
        const item = checklist[data.row.index];
        if (!item) return;

        if (data.column.index === 3 || data.column.index === 4) {
          data.cell.styles.textColor = DARK_TEXT;
          if (
            (data.column.index === 3 && item.condition === 'Good') ||
            (data.column.index === 4 && item.condition === 'Not Good')
          ) {
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.fontStyle = 'normal';
          }
        }
      }
    },
    didDrawCell(data) {
      if (data.section === 'body') {
        const item = checklist[data.row.index];
        if (!item) return;

        // Jika kondisinya 'Not Good' -> coret tepat di tengah huruf kata 'Good' di kolom 3
        if (data.column.index === 3 && item.condition === 'Not Good') {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.58 : cell.y + cell.height / 2 - 0.1;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(4.8);
          const textW = doc.getTextWidth('Good');
          const startX = cell.x + (cell.width - textW) / 2;
          doc.setDrawColor(30, 30, 30);
          doc.setLineWidth(0.35);
          doc.line(startX - 0.4, lineY, startX + textW + 0.4, lineY);
        }

        // Jika kondisinya 'Good' -> coret tepat di tengah huruf kata 'Not Good' di kolom 4
        if (data.column.index === 4 && item.condition === 'Good') {
          const cell = data.cell;
          const textY = (cell as any).textPos?.y;
          const lineY = typeof textY === 'number' ? textY - 0.58 : cell.y + cell.height / 2 - 0.1;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(4.8);
          const textW = doc.getTextWidth('Not Good');
          const startX = cell.x + (cell.width - textW) / 2;
          doc.setDrawColor(30, 30, 30);
          doc.setLineWidth(0.35);
          doc.line(startX - 0.4, lineY, startX + textW + 0.4, lineY);
        }
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 0.5;

  // ─── 4. DIGITAL POWER METER RECORDING ────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: '', colSpan: 9, styles: { fillColor: SECTION_BLUE_BG, minCellHeight: 3.8 } }],
      [
        { content: 'Wire', styles: { halign: 'center' } },
        { content: 'Result (Voltage)', styles: { halign: 'center' } },
        { content: 'Wire', styles: { halign: 'center' } },
        { content: 'Result (Voltage)', styles: { halign: 'center' } },
        { content: 'Wire', styles: { halign: 'center' } },
        { content: 'Result', styles: { halign: 'center' } },
        { content: 'Wire', styles: { halign: 'center' } },
        { content: 'Result (Ampere)', styles: { halign: 'center' } },
        { content: 'Remarks', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0, cellPadding: 0.35 },
    body: [
      ['R-S', m.dpm_voltage_rs || '-', 'R-N', m.dpm_voltage_rn || '-', 'KW', m.dpm_kw || '-', 'R', m.dpm_ampere_r || '-', { content: m.dpm_remarks || '', rowSpan: 4, styles: { valign: 'middle', halign: 'center' } as any }],
      ['S-T', m.dpm_voltage_st || '-', 'S-N', m.dpm_voltage_sn || '-', 'KVA', m.dpm_kva || '-', 'S', m.dpm_ampere_s || '-'],
      ['T-R', m.dpm_voltage_tr || '-', 'T-N', m.dpm_voltage_tn || '-', 'KVAR', m.dpm_kvar || '-', 'T', m.dpm_ampere_t || '-'],
      ['', '', 'N', m.dpm_voltage_n || '-', 'Cos p', m.dpm_cos_p || '-', 'N', m.dpm_ampere_n || '-']
    ],
    styles: { fontSize: 4.8, cellPadding: 0.35, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18, halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 13, halign: 'center', valign: 'middle' },
      1: { cellWidth: 23, halign: 'center', valign: 'middle' },
      2: { fontStyle: 'bold', cellWidth: 13, halign: 'center', valign: 'middle' },
      3: { cellWidth: 23, halign: 'center', valign: 'middle' },
      4: { fontStyle: 'bold', cellWidth: 15, halign: 'center', valign: 'middle' },
      5: { cellWidth: 23, halign: 'center', valign: 'middle' },
      6: { fontStyle: 'bold', cellWidth: 13, halign: 'center', valign: 'middle' },
      7: { cellWidth: 24, halign: 'center', valign: 'middle' },
      8: { cellWidth: 'auto', halign: 'center', valign: 'middle' }
    },
    didDrawCell(data) {
      if (data.section === 'head' && data.row.index === 0) {
        drawInstructionHeaderBar(data.cell, 'Digital Power Meter Recording');
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 0.5;

  // ─── 5. VOLTAGE & CURRENT MEASUREMENT ───────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: 'Voltage & Current Measurement', colSpan: 8, styles: { fillColor: SECTION_BLUE_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.5, halign: 'left' } }],
      [
        { content: 'Wire', styles: { halign: 'center' } },
        { content: 'Result (Voltage)', styles: { halign: 'center' } },
        { content: 'Wire', styles: { halign: 'center' } },
        { content: 'Result (Voltage)', styles: { halign: 'center' } },
        { content: 'Wire', styles: { halign: 'center' } },
        { content: 'Result (Ampere)', styles: { halign: 'center' } },
        { content: 'Standard', styles: { halign: 'center' } },
        { content: 'Remarks', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0, cellPadding: 0.35 },
    body: [
      [
        'R-S', m.vc_voltage_rs || '-',
        'R-N', m.vc_voltage_rn || '-',
        'R', m.vc_ampere_r || '-',
        { content: '+5% - 10% from 380V &\n220V load deviation 10%', rowSpan: 4, styles: { fillColor: YELLOW_STANDARD_BG, textColor: [180, 0, 0], valign: 'middle', halign: 'center', fontSize: 4.6 } as any },
        { content: m.vc_remarks || '', rowSpan: 4, styles: { valign: 'middle', halign: 'center' } as any }
      ],
      ['S-T', m.vc_voltage_st || '-', 'S-N', m.vc_voltage_sn || '-', 'S', m.vc_ampere_s || '-'],
      ['T-R', m.vc_voltage_tr || '-', 'T-N', m.vc_voltage_tn || '-', 'T', m.vc_ampere_t || '-'],
      ['', '', 'N-G', m.vc_voltage_ng || '-', 'N', '']
    ],
    styles: { fontSize: 4.8, cellPadding: 0.35, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18, halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 13, halign: 'center', valign: 'middle' },
      1: { cellWidth: 23, halign: 'center', valign: 'middle' },
      2: { fontStyle: 'bold', cellWidth: 13, halign: 'center', valign: 'middle' },
      3: { cellWidth: 23, halign: 'center', valign: 'middle' },
      4: { fontStyle: 'bold', cellWidth: 13, halign: 'center', valign: 'middle' },
      5: { cellWidth: 23, halign: 'center', valign: 'middle' },
      6: { cellWidth: 38, halign: 'center', valign: 'middle' },
      7: { cellWidth: 'auto', halign: 'center', valign: 'middle' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 0.5;

  // ─── 6. THERMAL MEASUREMENT ──────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: '', colSpan: 4, styles: { fillColor: SECTION_BLUE_BG, minCellHeight: 3.8 } }],
      [
        { content: 'Breaker', colSpan: 1, styles: { halign: 'left', fontStyle: 'bold', cellWidth: 32 } },
        { content: 'Result Temperature (°C)', styles: { halign: 'center', cellWidth: 42 } },
        { content: 'Standard', styles: { halign: 'center', cellWidth: 42 } },
        { content: 'Remarks', styles: { halign: 'center', cellWidth: 'auto' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0, cellPadding: 0.35 },
    body: [
      ['Breaker', m.thermal_breaker_temp ? `${m.thermal_breaker_temp}°C` : '-', { content: '40°C', styles: { fillColor: YELLOW_STANDARD_BG, halign: 'center' } }, m.thermal_remarks || '']
    ],
    styles: { fontSize: 4.8, cellPadding: 0.35, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18, halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold', halign: 'left', valign: 'middle' },
      1: { cellWidth: 42, halign: 'center', valign: 'middle' },
      2: { cellWidth: 42, halign: 'center', valign: 'middle' },
      3: { cellWidth: 'auto', halign: 'center', valign: 'middle' }
    },
    didDrawCell(data) {
      if (data.section === 'head' && data.row.index === 0) {
        drawInstructionHeaderBar(data.cell, 'Thermal Meassurement');
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 0.5;

  // ─── 7. GROUNDING RESISTANCE MEASUREMENT ──────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: '', colSpan: 4, styles: { fillColor: SECTION_BLUE_BG, minCellHeight: 3.8 } }],
      [
        { content: 'Wire', styles: { halign: 'left', fontStyle: 'bold', cellWidth: 32 } },
        { content: 'Result (Ohm)', styles: { halign: 'center', cellWidth: 42 } },
        { content: 'Standard', styles: { halign: 'center', cellWidth: 42 } },
        { content: 'Remarks', styles: { halign: 'center', cellWidth: 'auto' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0, cellPadding: 0.35 },
    body: [
      ['Grounding', m.grounding_ohm ? `${m.grounding_ohm} Ohm` : '-', { content: '<5 Ohm', styles: { fillColor: YELLOW_STANDARD_BG, halign: 'center' } }, m.grounding_remarks || '']
    ],
    styles: { fontSize: 4.8, cellPadding: 0.35, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18, halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold', halign: 'left', valign: 'middle' },
      1: { cellWidth: 42, halign: 'center', valign: 'middle' },
      2: { cellWidth: 42, halign: 'center', valign: 'middle' },
      3: { cellWidth: 'auto', halign: 'center', valign: 'middle' }
    },
    didDrawCell(data) {
      if (data.section === 'head' && data.row.index === 0) {
        drawInstructionHeaderBar(data.cell, 'Grounding Resistance Meassurement');
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 0.5;

  // ─── 8. OPERATION STATUS (NORMAL / ABNORMAL) ─────────────────────────────
  const isNorm = op.isNormal === true || op.isNormal === ('true' as any) || (op as any).is_normal === true;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    body: [
      [
        { content: `[     ]  Normal operation`, styles: { fontStyle: 'bold', cellWidth: 70 } },
        { content: 'Remark:', styles: { fontStyle: 'bold', cellWidth: 20 } },
        { content: op.remark || 'Unit beroperasi normal.', colSpan: 2, styles: { cellWidth: 'auto' } }
      ],
      [
        { content: `[     ]  Abnormal operation`, styles: { fontStyle: 'bold' } },
        { content: 'Fault symptom', styles: { fontStyle: 'bold' } },
        { content: op.faultSymptom || '', colSpan: 2, styles: {} }
      ],
      [
        { content: '(Please fill the items if the service is repair)', styles: { fontStyle: 'italic', fontSize: 4.2, textColor: [100, 100, 100] } },
        { content: 'Fault analysis', styles: { fontStyle: 'bold' } },
        { content: op.faultAnalysis || '', colSpan: 2, styles: {} }
      ],
      [
        { content: '', styles: {} },
        { content: 'Work done/\naction taken', styles: { fontStyle: 'bold' } },
        { content: op.workDone || '', colSpan: 2, styles: {} }
      ],
      [
        { content: '', styles: {} },
        { content: 'Faul Part SN', styles: { fontStyle: 'bold', cellWidth: 24 } },
        { content: op.faultPartSN || '', styles: { cellWidth: 40 } },
        { content: 'Fault part Name: ' + (op.faultPartName || ''), styles: { fontStyle: 'bold', cellWidth: 'auto' } }
      ]
    ],
    styles: { fontSize: 4.8, cellPadding: 0.35, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18 },
    didDrawCell(data) {
      if (data.section === 'body' && data.column.index === 0) {
        const drawCheck = (data.row.index === 0 && isNorm) || (data.row.index === 1 && !isNorm);
        if (drawCheck) {
          const cell = data.cell;
          const textX = (cell as any).textPos?.x ?? (cell.x + 1.2);
          const textY = (cell as any).textPos?.y ?? (cell.y + cell.height / 2);
          doc.setDrawColor(20, 20, 20);
          doc.setLineWidth(0.32);
          doc.line(textX + 0.72, textY - 0.25, textX + 1.12, textY + 0.22);
          doc.line(textX + 1.12, textY + 0.22, textX + 1.82, textY - 0.85);
        }
      }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 0.5;

  // ─── 9. TIME SPENT ───────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: 'TIME SPENT', colSpan: 4, styles: { fillColor: SECTION_BLUE_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.5, halign: 'left' } }],
      [
        { content: 'Date', styles: { halign: 'center' } },
        { content: 'Departure', styles: { halign: 'center' } },
        { content: 'Start', styles: { halign: 'center' } },
        { content: 'Finish', styles: { halign: 'center' } }
      ]
    ],
    headStyles: { fillColor: SUB_HEADER_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 5.0, cellPadding: 0.35 },
    body: [
      [t.date || c.date || new Date().toISOString().split('T')[0], t.departure || '08:00', t.start || '09:00', t.finish || '17:00']
    ],
    styles: { fontSize: 4.8, cellPadding: 0.35, textColor: DARK_TEXT, lineColor: BORDER_COLOR, lineWidth: 0.18, halign: 'center' }
  });

  y = (doc as any).lastAutoTable.finalY + 5.0;

  // ─── 10. CUSTOMER ACKNOWLEDGEMENT & APPROVALS ────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...DARK_TEXT);
  doc.text('CUSTOMER ACKNOWLEDGEMENT:', centerX, y, { align: 'center' });
  y += 2.5;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'plain',
    body: [
      [
        { content: 'Prepared', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: 'Checked', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: 'Approved', styles: { fontStyle: 'bold', halign: 'center' } }
      ],
      [
        { content: '\n\n', styles: { halign: 'center' } },
        { content: '\n\n', styles: { halign: 'center' } },
        { content: '\n\n', styles: { halign: 'center' } }
      ],
      [
        { content: `Engineer\n(${c.engineer || payload.accountEmail || 'Engineer'})`, styles: { fontStyle: 'bold', halign: 'center', fontSize: 5.2 } },
        { content: 'SM/PM\n(Site Manager)', styles: { fontStyle: 'bold', halign: 'center', fontSize: 5.2 } },
        { content: 'Client / Owner\n(NeutraDC)', styles: { fontStyle: 'bold', halign: 'center', fontSize: 5.2 } }
      ]
    ],
    styles: { fontSize: 5.5, cellPadding: 0.4, textColor: DARK_TEXT }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HALAMAN 2+: LAMPIRAN FOTO DOKUMENTASI (LAYOUT STANDAR BER-HEADER FORMAL)
  // ═══════════════════════════════════════════════════════════════════════════
  const filledPhotos = photoCards.filter(p => p.photoBase64 || p.description);

  if (filledPhotos.length > 0) {
    const cols = 3;
    const perPage = 9;
    const cardGap = 3.5;
    const cardW = (contentW - (cols - 1) * cardGap) / cols;
    const photoH = 50;
    const capH = 12;
    const cardH = photoH + capH;

    // Helper untuk Kop Header Formal Laporan Dokumentasi di Setiap Halaman Foto
    const drawDocumentationHeader = () => {
      doc.addPage();
      addTopBlueAccent();

      const headerY = 6;
      const headerBoxH = 21;

      // Rounded Box Kop Surat Formal 3-Kolom
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.2);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, headerY, contentW, headerBoxH, 1.2, 1.2, 'FD');

      const col1W = 34;
      const col3W = 34;
      doc.line(margin + col1W, headerY, margin + col1W, headerY + headerBoxH);
      doc.line(pageW - margin - col3W, headerY, pageW - margin - col3W, headerY + headerBoxH);

      // Logo Kiri
      if (logoLeft) {
        doc.addImage(logoLeft, 'PNG', margin + 3, headerY + 3.5, col1W - 6, 14);
      }

      // Logo Kanan
      if (logoRight) {
        doc.addImage(logoRight, 'PNG', pageW - margin - col3W + 4, headerY + 4.5, col3W - 8, 12);
      }

      // Teks Tengah Kop
      const centerHdrX = margin + col1W + (contentW - col1W - col3W) / 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...BLUE_ACCENT);
      doc.text('LAPORAN MAINTENANCE', centerHdrX, headerY + 5.5, { align: 'center' });

      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(`DOKUMENTASI PM: ${payload.equipmentName.toUpperCase()}`, centerHdrX, headerY + 10.2, { align: 'center' });

      doc.setFontSize(7.5);
      doc.setTextColor(...BLUE_ACCENT);
      const unitLabel = c.ciName ? `${c.ciName}${c.specification ? ` - ${c.specification}` : ''}` : c.specification || payload.equipmentName;
      doc.text(unitLabel.toUpperCase(), centerHdrX, headerY + 14.5, { align: 'center' });

      const dateStr = c.date || new Date().toISOString().split('T')[0];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Tanggal Maintenance: ${dateStr}`, centerHdrX, headerY + 18.5, { align: 'center' });

      return headerY + headerBoxH + 4;
    };

    let pageStart = 0;

    while (pageStart < filledPhotos.length) {
      const pagePhotos = filledPhotos.slice(pageStart, pageStart + perPage);
      let curPhotoY = drawDocumentationHeader();

      for (let i = 0; i < pagePhotos.length; i += cols) {
        const row = pagePhotos.slice(i, i + cols);
        for (let j = 0; j < row.length; j++) {
          const item = row[j];
          const cardX = margin + j * (cardW + cardGap);
          const cardY = curPhotoY;

          // Bingkai Kartu Foto
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.2);
          doc.roundedRect(cardX, cardY, cardW, cardH, 1, 1, 'FD');

          // Gambar Foto
          if (item.photoBase64) {
            try {
              const compressed = await compressBase64Image(item.photoBase64, { maxWidth: 600, quality: 0.6 });
              doc.addImage(compressed, 'JPEG', cardX + 0.8, cardY + 0.8, cardW - 1.6, photoH - 1.6);
            } catch {
              doc.setFillColor(241, 245, 249);
              doc.rect(cardX + 0.8, cardY + 0.8, cardW - 1.6, photoH - 1.6, 'F');
              doc.setFontSize(6);
              doc.setTextColor(150);
              doc.text('[Gagal Memuat Foto]', cardX + cardW / 2, cardY + photoH / 2, { align: 'center' });
            }
          } else {
            doc.setFillColor(241, 245, 249);
            doc.rect(cardX + 0.8, cardY + 0.8, cardW - 1.6, photoH - 1.6, 'F');
            doc.setFontSize(6);
            doc.setTextColor(150);
            doc.text('[Tidak Ada Foto]', cardX + cardW / 2, cardY + photoH / 2, { align: 'center' });
          }

          // Garis Pembatas Foto & Caption
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(cardX, cardY + photoH, cardX + cardW, cardY + photoH);

          // Kotak Keterangan / Deskripsi Foto dengan Aksen Garis Biru di Kiri
          const captionY = cardY + photoH;
          const captionText = item.description || 'Pemeriksaan kondisi fisik perangkat.';
          const fontSize = 6.2;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(fontSize);
          doc.setTextColor(...DARK_TEXT);

          const leftPad = 2.4;
          const maxTextW = cardW - (leftPad + 3);
          const splitLines = doc.splitTextToSize(captionText, maxTextW);
          const displayLines = splitLines.slice(0, 3); // Maksimal 3 baris
          const textH = displayLines.length * 2.6;

          // Garis aksen biru di sebelah kiri teks
          doc.setFillColor(...BLUE_ACCENT);
          doc.rect(cardX + 1.2, captionY + (capH - Math.max(textH, 3)) / 2, 0.45, Math.max(textH, 3), 'F');

          // Render teks deskripsi
          doc.text(displayLines, cardX + leftPad + 1.2, captionY + (capH - textH) / 2 + 2.2);
        }

        curPhotoY += cardH + cardGap;
      }

      pageStart += perPage;
    }
  }

  // ─── FOOTER NOMOR HALAMAN DI SETIAP HALAMAN ──────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `DwimitraSystem | Service Report & Documentation | Halaman ${p} dari ${totalPages}`,
      pageW / 2,
      pageH - 2.5,
      { align: 'center' }
    );
  }

  toast.dismiss(toastId);

  if (saveToFile) {
    const safeTitle = (c.ciName || payload.equipmentName).replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Service_Report_${safeTitle}_${c.quarter || 'Q3'}.pdf`;
    doc.save(fileName);
    toast.success(`PDF ${fileName} berhasil diunduh!`);
  }

  return doc;
}
