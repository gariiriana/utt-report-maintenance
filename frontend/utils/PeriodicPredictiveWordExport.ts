// ============================================================================
// FILE: frontend/utils/PeriodicPredictiveWordExport.ts
// Deskripsi: Generator Dokumen Microsoft Word (.DOCX) Resmi untuk Laporan
//            Predictive Maintenance (PdM) & Reliability Forecast Periodik
//            (Bulanan & Tahunan) Data Center NeutraDC Cikarang.
// ============================================================================

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  VerticalAlign,
} from 'docx';
import { saveAs } from 'file-saver';
import { PeriodicPredictiveReportData } from '@/types/periodicPredictiveTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';

const COLOR_PRIMARY = '00599C'; // Biru NeutraDC
const COLOR_SECONDARY = '6B21A8'; // Ungu Predictive AI
const COLOR_ACCENT_RED = '991B1B'; // Merah Resmi
const COLOR_DARK = '0F172A';
const COLOR_MUTED = '64748B';
const COLOR_LIGHT_BG = 'F8FAFC';
const COLOR_BORDER = 'CBD5E1';
const COLOR_WHITE = 'FFFFFF';

const borderThin = {
  top: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
  left: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
  right: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
} as const;

const borderNone = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
} as const;

function base64ToUint8Array(base64: string): Uint8Array {
  if (!base64 || typeof base64 !== 'string') return new Uint8Array();
  try {
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.error('Error converting base64 to Uint8Array:', err);
    return new Uint8Array();
  }
}

async function loadAssetImage(src: string): Promise<Uint8Array> {
  if (!src) return new Uint8Array();
  if (src.startsWith('data:image')) {
    return base64ToUint8Array(src);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 600;
      canvas.height = img.naturalHeight || 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        resolve(base64ToUint8Array(dataUrl));
      } else {
        resolve(new Uint8Array());
      }
    };
    img.onerror = () => resolve(new Uint8Array());
    img.src = src;
  });
}

function createSectionHeading(title: string, sectionNumber: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text: `${sectionNumber}. `,
        bold: true,
        size: 22,
        color: COLOR_SECONDARY,
        font: 'Calibri',
      }),
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: 20,
        color: COLOR_DARK,
        font: 'Calibri',
      }),
    ],
  });
}

function createLabelValueRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        borders: borderThin,
        shading: { fill: COLOR_LIGHT_BG, type: ShadingType.CLEAR },
        margins: { top: 70, bottom: 70, left: 100, right: 100 },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: label, bold: true, size: 17, color: COLOR_DARK, font: 'Calibri' }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        borders: borderThin,
        margins: { top: 70, bottom: 70, left: 100, right: 100 },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: value || '-', size: 17, color: COLOR_DARK, font: 'Calibri' }),
            ],
          }),
        ],
      }),
    ],
  });
}

export async function exportPeriodicPredictiveReportToDocx(data: PeriodicPredictiveReportData): Promise<void> {
  const [dwimitraBytes, neutraDCBytes] = await Promise.all([
    loadAssetImage(logoDwimitra),
    loadAssetImage(logoNeutraDC),
  ]);

  // Kop Surat Resmi
  const headerCells: TableCell[] = [];
  if (dwimitraBytes.length > 0) {
    headerCells.push(
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: borderNone,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new ImageRun({
                data: dwimitraBytes,
                transformation: { width: 130, height: 42 },
                type: 'png',
              }),
            ],
          }),
        ],
      })
    );
  } else {
    headerCells.push(
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: borderNone,
        children: [new Paragraph({ children: [new TextRun({ text: 'PT DWIMITRA EKATAMA MANDIRI', bold: true, size: 16 })] })],
      })
    );
  }

  headerCells.push(
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: borderNone,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'PT DWIMITRA EKATAMA MANDIRI',
              bold: true,
              size: 20,
              color: COLOR_PRIMARY,
              font: 'Calibri',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'DATA CENTER OPERATION & FACILITY RELIABILITY ENGINEERING',
              size: 15,
              color: COLOR_MUTED,
              font: 'Calibri',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'NeutraDC Data Center Complex — Cikarang, Jawa Barat',
              size: 14,
              color: COLOR_MUTED,
              font: 'Calibri',
            }),
          ],
        }),
      ],
    })
  );

  if (neutraDCBytes.length > 0) {
    headerCells.push(
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: borderNone,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new ImageRun({
                data: neutraDCBytes,
                transformation: { width: 125, height: 42 },
                type: 'png',
              }),
            ],
          }),
        ],
      })
    );
  } else {
    headerCells.push(
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: borderNone,
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'NeutraDC', bold: true, size: 18 })] })],
      })
    );
  }

  const kopTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [new TableRow({ children: headerCells })],
  });

  const dividerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 12, color: COLOR_PRIMARY },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_ACCENT_RED },
      left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
    rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: '' })] })] })],
  });

  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 60 },
    children: [
      new TextRun({
        text: data.periodType === 'monthly'
          ? 'EXECUTIVE PREDICTIVE MAINTENANCE & RELIABILITY FORECAST (BULANAN)'
          : 'ANNUAL ASSET RELIABILITY & CAPEX/OPEX FORECAST (TAHUNAN)',
        bold: true,
        size: 22,
        color: COLOR_PRIMARY,
        font: 'Calibri',
      }),
    ],
  });

  const subTitleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({
        text: `No. Dokumen: ${data.reportNumber}   |   Periode: ${data.periodType === 'monthly' ? `${data.monthName} ${data.year}` : `Tahun ${data.year}`}`,
        size: 16,
        color: COLOR_MUTED,
        font: 'Calibri',
      }),
    ],
  });

  // Section 1: Ringkasan Eksekutif
  const metaRows: TableRow[] = [
    createLabelValueRow('Jenis Periode Analisis', data.periodType === 'monthly' ? `Bulanan (${data.monthName} ${data.year})` : `Tahunan (Tahun ${data.year})`),
    createLabelValueRow('Indeks Keandalan Fasilitas (Health Score)', `${data.facilityHealthScore} / 100 (${data.overallStatus})`),
    createLabelValueRow('Total Corrective Maintenance (CM)', `${data.totalCMEvents} Kejadian`),
    createLabelValueRow('Total Temuan Abnormalitas', `${data.totalAbnormalFindings} Temuan`),
    createLabelValueRow('Total Penggantian Suku Cadang', `${data.totalSparepartsReplaced} Komponen`),
    createLabelValueRow('Ringkasan Narasi Eksekutif AI', data.executiveSummary),
  ];

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: metaRows,
  });

  // Section 2: Evaluasi per Sub-Sistem
  const systemTableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: 'Sub-Sistem Fasilitas', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Tingkat Risiko', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Health Score', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
        new TableCell({
          width: { size: 45, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: 'Analisis Prediktif AI & Catatan', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
      ],
    }),
  ];

  (data.systemAssessments || []).forEach(sys => {
    systemTableRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: sys.systemName, bold: true, size: 16 })] })],
          }),
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sys.riskLevel, bold: true, size: 16, color: sys.riskLevel === 'Critical' ? 'B91C1C' : sys.riskLevel === 'Warning' ? 'B45309' : '15803D' })] })],
          }),
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${sys.healthScore}/100`, bold: true, size: 16 })] })],
          }),
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: sys.aiInsight || (sys.criticalIssues && sys.criticalIssues.join('; ')) || '-', size: 15 })] })],
          }),
        ],
      })
    );
  });

  const systemTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: systemTableRows,
  });

  // Section 3: Bad Actor Equipment
  const badActorRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_SECONDARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: 'Nama Peralatan', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_SECONDARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Freq CM', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_SECONDARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: 'Modus Kerusakan Terdeteksi', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_SECONDARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Estimasi RUL', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_SECONDARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: 'Rekomendasi AI', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
      ],
    }),
  ];

  (data.badActorAssets || []).forEach(asset => {
    badActorRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({ children: [new TextRun({ text: asset.equipmentName, bold: true, size: 16 })] }),
              new Paragraph({ children: [new TextRun({ text: `${asset.systemCategory} • ${asset.locationRoom}`, size: 13, color: COLOR_MUTED })] }),
            ],
          }),
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${asset.incidentCount}x`, bold: true, size: 16, color: COLOR_ACCENT_RED })] })],
          }),
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: (asset.failureModes || []).join(', ') || '-', size: 15 })] })],
          }),
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: asset.estimatedRUL || '-', bold: true, size: 15, color: COLOR_PRIMARY })] })],
          }),
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: asset.recommendation || '-', size: 14 })] })],
          }),
        ],
      })
    );
  });

  const badActorTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: badActorRows,
  });

  // Section 4: Sparepart Forecast
  const sparepartRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: 'Komponen / Suku Cadang Kritis', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Prediksi Kebutuhan', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Status Pengadaan', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: borderThin,
          shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: 'Justifikasi Degradasi', bold: true, size: 17, color: COLOR_WHITE })] })],
        }),
      ],
    }),
  ];

  (data.sparepartForecast || []).forEach(sp => {
    sparepartRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: sp.partName, bold: true, size: 16 })] })],
          }),
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(sp.estimatedNeeded), bold: true, size: 16 })] })],
          }),
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sp.currentStockStatus, bold: true, size: 15, color: sp.currentStockStatus.includes('Critical') || sp.currentStockStatus.includes('Order') ? 'B91C1C' : '15803D' })] })],
          }),
          new TableCell({
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: sp.justification || '-', size: 14 })] })],
          }),
        ],
      })
    );
  });

  const sparepartTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: sparepartRows,
  });

  // Section 5: Action Plan & CAPEX
  const actionPlanParagraphs: Paragraph[] = [
    new Paragraph({
      spacing: { before: 80, after: 60 },
      children: [new TextRun({ text: '• Tindakan Preventif Terjadwal (Bulan Berikutnya):', bold: true, size: 17, color: COLOR_PRIMARY })],
    }),
    ...(data.actionPlan?.immediatePreventive || []).map(act => new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: `  - ${act}`, size: 16 })],
    })),
    new Paragraph({
      spacing: { before: 100, after: 60 },
      children: [new TextRun({ text: '• Jadwal Overhaul Terencana (Next Quarter):', bold: true, size: 17, color: COLOR_SECONDARY })],
    }),
    ...(data.actionPlan?.scheduledOverhauls || []).map(act => new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: `  - ${act}`, size: 16 })],
    })),
    new Paragraph({
      spacing: { before: 100, after: 60 },
      children: [new TextRun({ text: '• Rekomendasi Alokasi Peremajaan Unit / CAPEX (Next Fiscal Year):', bold: true, size: 17, color: COLOR_ACCENT_RED })],
    }),
    ...(data.actionPlan?.capexReplacementRecommendations || []).map(act => new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: `  - ${act}`, size: 16 })],
    })),
  ];

  // Section 6: Lembar Pengesahan
  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33.3, type: WidthType.PERCENTAGE },
            borders: borderThin,
            shading: { fill: COLOR_LIGHT_BG, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'DISUSUN OLEH', bold: true, size: 16 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Standby Engineer', size: 14, color: COLOR_MUTED })] }),
              new Paragraph({ spacing: { before: 400, after: 400 }, children: [new TextRun({ text: '' })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.signatures?.preparedBy?.name || 'Standby Engineer', bold: true, size: 16, underline: {} })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tgl: ${data.signatures?.preparedBy?.date || '-'}`, size: 13, color: COLOR_MUTED })] }),
            ],
          }),
          new TableCell({
            width: { size: 33.3, type: WidthType.PERCENTAGE },
            borders: borderThin,
            shading: { fill: COLOR_LIGHT_BG, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'DIPERIKSA OLEH', bold: true, size: 16 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'QC & Commissioning DME', size: 14, color: COLOR_MUTED })] }),
              new Paragraph({ spacing: { before: 400, after: 400 }, children: [new TextRun({ text: '' })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.signatures?.verifiedBy?.name || 'QC DME Engineer', bold: true, size: 16, underline: {} })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tgl: ${data.signatures?.verifiedBy?.date || '-'}`, size: 13, color: COLOR_MUTED })] }),
            ],
          }),
          new TableCell({
            width: { size: 33.4, type: WidthType.PERCENTAGE },
            borders: borderThin,
            shading: { fill: COLOR_LIGHT_BG, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'DISETUJUI OLEH', bold: true, size: 16 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Facility Manager / NeutraDC', size: 14, color: COLOR_MUTED })] }),
              new Paragraph({ spacing: { before: 400, after: 400 }, children: [new TextRun({ text: '' })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.signatures?.approvedBy?.name || 'Operations Manager', bold: true, size: 16, underline: {} })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tgl: ${data.signatures?.approvedBy?.date || '-'}`, size: 13, color: COLOR_MUTED })] }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Predictive Maintenance & Reliability Forecast (${data.periodType === 'monthly' ? `${data.monthName} ${data.year}` : `Tahun ${data.year}`})`,
                    size: 14,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Halaman ', size: 14, color: COLOR_MUTED }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: COLOR_MUTED }),
                  new TextRun({ text: ' dari ', size: 14, color: COLOR_MUTED }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: COLOR_MUTED }),
                ],
              }),
            ],
          }),
        },
        children: [
          kopTable,
          dividerTable,
          titleParagraph,
          subTitleParagraph,
          createSectionHeading('Ringkasan Eksekutif & Indeks Keandalan Fasilitas', 'I'),
          metaTable,
          createSectionHeading('Evaluasi Keandalan per Sub-Sistem Fasilitas', 'II'),
          systemTable,
          createSectionHeading('Analisis Peralatan Kritis & Bad Actor Assets', 'III'),
          badActorTable,
          createSectionHeading('Proyeksi Kebutuhan Suku Cadang Kritis', 'IV'),
          sparepartTable,
          createSectionHeading('Rencana Tindakan & Rekomendasi Alokasi CAPEX/OPEX', 'V'),
          ...actionPlanParagraphs,
          createSectionHeading('Lembar Pengesahan Dokumen', 'VI'),
          signatureTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanFilename = data.periodType === 'monthly'
    ? `Laporan_Predictive_Bulanan_${data.monthName}_${data.year}.docx`
    : `Laporan_Predictive_Tahunan_${data.year}.docx`;
  saveAs(blob, cleanFilename);
}
