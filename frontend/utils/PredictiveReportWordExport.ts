// ============================================================================
// FILE: frontend/utils/PredictiveReportWordExport.ts
// Deskripsi: Generator Dokumen Microsoft Word (.DOCX) Resmi Laporan Predictive
//            Maintenance (PdM) PT Dwimitra Ekatama Mandiri / NeutraDC Cikarang.
//            Dilengkapi Kop Surat Resmi Dual Logo, 5 Section Standar Industri,
//            Embed Foto Bukti Fisik, Tabel Parameter Drift, & Lembar Pengesahan.
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
import { PredictiveReportData } from '@/types/predictiveReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import {
  ARIF_BUDIMAN_SIGNATURE_BASE64,
  ASEP_SIGNATURE_BASE64,
  PREPARED_BY_SIGNATURES,
  getEngineerSignature,
  normalizeEngineerName,
  cleanSignature,
} from '@/utils/engineerSignatures';

// ─── Color Palette & Table Border Styles ─────────────────────────────────────

const COLOR_PRIMARY = '00599C'; // Biru NeutraDC / Dwimitra
const COLOR_SECONDARY = '991B1B'; // Merah Resmi Aksen
const COLOR_DARK = '0F172A'; // Slate 900
const COLOR_MUTED = '64748B'; // Slate 500
const COLOR_LIGHT_BG = 'F8FAFC'; // Slate 50
const COLOR_BORDER = 'CBD5E1'; // Slate 300
const COLOR_WHITE = 'FFFFFF';
const HEADER_FILL = 'DCE6F1'; // Light blue cell header (NeutraDC Official Standard)

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

// Helper konversi base64 ke Uint8Array
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

// Helper load gambar aset lokal ke Uint8Array
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

function createSectionHeading(title: string, stepNumber: string): Paragraph {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text: `${stepNumber}. `,
        bold: true,
        size: 22,
        color: COLOR_SECONDARY,
        font: 'Calibri',
      }),
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: 22,
        color: COLOR_PRIMARY,
        font: 'Calibri',
      }),
    ],
  });
}

// ─── Export Main Function ───────────────────────────────────────────────────

export async function exportPredictiveReportToDocx(data: PredictiveReportData): Promise<void> {
  const authorName =
    data.signatures?.authorName ||
    (data as any).authorName ||
    'Rizki Novri Yanda – Data Center Operation';

  const normalizedPrepName =
    normalizeEngineerName(data.signatures?.preparedBy?.name) || 'Asep Mohammad Fauzi';
  const prepTitle = data.signatures?.preparedBy?.title || '(Electrical Engineer)';

  const revName = 'Arif Budiman';
  const revTitle = '(Technical Manager)';

  const ack1Name = data.signatures?.acknowledgedBy1?.name || 'Habib Mulyana';
  const ack1Title = data.signatures?.acknowledgedBy1?.title || '(Chief Engineer)';

  const ack2Name = data.signatures?.acknowledgedBy2?.name || 'Supriyatno';
  const ack2Title = data.signatures?.acknowledgedBy2?.title || '(Facility manager)';

  const appName = data.signatures?.approvedBy?.name || 'Budi Susanto';
  const appTitle =
    data.signatures?.approvedBy?.title ||
    '(Assistant manager HDC Facility Management)';

  // Resolve base64 signatures
  const resolvedPrepSign =
    cleanSignature(data.signatures?.preparedBy?.signatureBase64) ||
    getEngineerSignature(normalizedPrepName) ||
    cleanSignature(PREPARED_BY_SIGNATURES[normalizedPrepName]) ||
    ASEP_SIGNATURE_BASE64;

  const resolvedRevSign =
    cleanSignature(data.signatures?.reviewedBy?.signatureBase64) ||
    cleanSignature(data.signatures?.verifiedBy?.signatureBase64) ||
    ARIF_BUDIMAN_SIGNATURE_BASE64;

  const resolvedAck1Sign = cleanSignature(data.signatures?.acknowledgedBy1?.signatureBase64) || '';
  const resolvedAck2Sign = cleanSignature(data.signatures?.acknowledgedBy2?.signatureBase64) || '';
  const resolvedAppSign = cleanSignature(data.signatures?.approvedBy?.signatureBase64) || '';

  const [
    logoDmeBytes,
    logoNdcBytes,
    prepSignBytes,
    revSignBytes,
    ack1SignBytes,
    ack2SignBytes,
    appSignBytes,
  ] = await Promise.all([
    loadAssetImage(logoDwimitra),
    loadAssetImage(logoNeutraDC),
    loadAssetImage(resolvedPrepSign),
    loadAssetImage(resolvedRevSign),
    loadAssetImage(resolvedAck1Sign),
    loadAssetImage(resolvedAck2Sign),
    loadAssetImage(resolvedAppSign),
  ]);

  // Helper membuat Kop Surat Resmi Dual Logo (Tabel 1 baris 3 kolom)
  const createHeaderTable = () => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      new TableRow({
        children: [
          // Logo Kiri: PT Dwimitra Ekatama Mandiri
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: logoDmeBytes.length > 0 ? [
                  new ImageRun({
                    data: logoDmeBytes,
                    transformation: { width: 110, height: 42 },
                    type: 'png',
                  }),
                ] : [
                  new TextRun({ text: 'PT DME', bold: true, size: 18, color: COLOR_PRIMARY }),
                ],
              }),
            ],
          }),
          // Teks Tengah: Judul Laporan & Identitas Fasilitas
          new TableCell({
            width: { size: 56, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'PT DWIMITRA EKATAMA MANDIRI',
                    bold: true,
                    size: 22,
                    color: COLOR_DARK,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'PREDICTIVE MAINTENANCE REPORT',
                    bold: true,
                    size: 24,
                    color: COLOR_SECONDARY,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'DATA CENTER NEUTRA DC CIKARANG',
                    bold: true,
                    size: 18,
                    color: COLOR_PRIMARY,
                    font: 'Calibri',
                  }),
                ],
              }),
              ...(data.sourceTicketNumber
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: `Ref Tiket: ${data.sourceTicketNumber}`,
                          size: 16,
                          color: COLOR_MUTED,
                          font: 'Calibri',
                        }),
                      ],
                    }),
                  ]
                : []),
            ],
          }),
          // Logo Kanan: NeutraDC
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: logoNdcBytes.length > 0 ? [
                  new ImageRun({
                    data: logoNdcBytes,
                    transformation: { width: 110, height: 42 },
                    type: 'png',
                  }),
                ] : [
                  new TextRun({ text: 'NeutraDC', bold: true, size: 18, color: COLOR_PRIMARY }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Garis Pembatas Header Tebal
  const createDividerLine = () => new Paragraph({
    spacing: { before: 80, after: 180 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 18, color: COLOR_PRIMARY },
    },
    children: [],
  });

  // ─── Bagian 1: Identitas Peralatan (Asset Identification) ─────────────────
  const equipmentTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Nama Peralatan', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: data.equipmentName, bold: true, size: 18, color: COLOR_DARK, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Tag Peralatan', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: data.equipmentTag || '-', size: 18, font: 'Calibri' })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Kategori Sistem', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: data.systemCategory, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Lokasi / Ruangan', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: data.locationRoom, size: 18, font: 'Calibri' })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Ref. Laporan Asal', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: `${data.sourceMaintenanceName} (${data.sourceCollection})`, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Tanggal Observasi', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: data.sourceMaintenanceDate, size: 18, font: 'Calibri' })] })],
          }),
        ],
      }),
    ],
  });

  // ─── Bagian 2: Kondisi Aktual & Gejala Awal ──────────────────────────────
  const conditionParagraphs: Paragraph[] = [
    new Paragraph({
      spacing: { before: 80, after: 120 },
      children: [
        new TextRun({ text: 'Gejala Terdeteksi: ', bold: true, size: 18, font: 'Calibri' }),
        new TextRun({ text: data.currentSymptoms, size: 18, font: 'Calibri', color: COLOR_DARK }),
      ],
    }),
  ];

  // Tabel Parameter Drift
  const driftRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 40, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_PRIMARY },
          borders: borderThin,
          children: [new Paragraph({ children: [new TextRun({ text: 'Parameter Operasional', bold: true, size: 18, color: COLOR_WHITE, font: 'Calibri' })] })],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_PRIMARY },
          borders: borderThin,
          children: [new Paragraph({ children: [new TextRun({ text: 'Nilai Terukur Aktual', bold: true, size: 18, color: COLOR_WHITE, font: 'Calibri' })] })],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_PRIMARY },
          borders: borderThin,
          children: [new Paragraph({ children: [new TextRun({ text: 'Baseline Nominal', bold: true, size: 18, color: COLOR_WHITE, font: 'Calibri' })] })],
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_PRIMARY },
          borders: borderThin,
          children: [new Paragraph({ children: [new TextRun({ text: 'Satuan', bold: true, size: 18, color: COLOR_WHITE, font: 'Calibri' })] })],
        }),
      ],
    }),
  ];

  if (data.measuredParameterDrift && data.measuredParameterDrift.length > 0) {
    data.measuredParameterDrift.forEach(item => {
      driftRows.push(
        new TableRow({
          children: [
            new TableCell({
              borders: borderThin,
              children: [new Paragraph({ children: [new TextRun({ text: item.parameterName, size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              borders: borderThin,
              children: [new Paragraph({ children: [new TextRun({ text: item.measuredValue, bold: true, color: 'B91C1C', size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              borders: borderThin,
              children: [new Paragraph({ children: [new TextRun({ text: item.nominalBaseline, size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              borders: borderThin,
              children: [new Paragraph({ children: [new TextRun({ text: item.unit || '-', size: 18, font: 'Calibri' })] })],
            }),
          ],
        })
      );
    });
  } else {
    driftRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Data pengukuran', size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Belum tersedia', size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Belum tersedia', size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Verifikasi lapangan diperlukan', size: 18, font: 'Calibri' })] })],
          }),
        ],
      })
    );
  }

  const driftTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: driftRows,
  });

  // Foto Bukti Fisik Anomali
  const photoParagraphs: Paragraph[] = [];
  if (data.photoEvidenceBase64) {
    const photoBytes = base64ToUint8Array(data.photoEvidenceBase64);
    if (photoBytes.length > 0) {
      photoParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 140, after: 60 },
          children: [
            new ImageRun({
              data: photoBytes,
              transformation: { width: 320, height: 210 },
              type: 'jpg',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 120 },
          children: [
            new TextRun({
              text: data.photoCaption || 'Foto Bukti Anomali Fisik Peralatan',
              italics: true,
              size: 16,
              color: COLOR_MUTED,
              font: 'Calibri',
            }),
          ],
        })
      );
    }
  }

  // ─── Bagian 3: Analisis Prediktif AI (AI Engineering Insight) ────────────
  const aiInsightTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Akar Masalah (Root Cause)', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: data.aiAnalysis.rootCauseAnalysis, size: 18, font: 'Calibri' })] })],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Potensi Modus Kegagalan', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: data.aiAnalysis.potentialFailureMode, size: 18, font: 'Calibri' })] })],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Estimasi Sisa Umur (RUL)', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: data.aiAnalysis.remainingUsefulLife, bold: true, color: 'B91C1C', size: 18, font: 'Calibri' })] })],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Tingkat Urgensi & SLA Risk', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [new Paragraph({ children: [
              new TextRun({ text: `Urgensi: ${data.aiAnalysis.urgencyLevel}  |  `, bold: true, size: 18, font: 'Calibri' }),
              new TextRun({ text: data.aiAnalysis.slaRiskAssessment, size: 18, font: 'Calibri' }),
            ] })],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG }, borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: 'Bukti, Keyakinan & Verifikasi', bold: true, size: 18, font: 'Calibri' })] })] }),
          new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: `${data.analysisMetadata?.evidenceReferences?.map(item => `${item.reference}: ${item.observation}`).join(' | ') || `Sumber: ${data.sourceMaintenanceName} / ${data.sourceTicketNumber || data.sourceDocId}`}. Kualitas bukti: ${data.analysisMetadata?.evidenceQuality || 'Belum dinilai'}; keyakinan: ${data.analysisMetadata?.confidenceLevel || 'Belum dinilai'}. ${data.analysisMetadata?.requiresFieldVerification !== false ? 'Wajib verifikasi engineer lapangan.' : ''}`, size: 18, font: 'Calibri' })] })] }),
        ],
      }),
    ],
  });

  // ─── Bagian 4: Rencana Tindakan Prediktif (Action Plan) ──────────────────
  const actionPlanTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Tindakan Segera (1 - 7 Hari)', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: data.actionPlan.immediateAction, size: 18, font: 'Calibri' })] })],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Overhaul Definitif (2 - 4 Minggu)', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: data.actionPlan.plannedOverhaulAction, size: 18, font: 'Calibri' })] })],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR_LIGHT_BG },
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Metode Pengujian Lanjutan', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: borderThin,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: data.actionPlan.followUpTestingMethods?.join('  •  ') || 'Thermography Infrared, Visual Inspection',
                    size: 18,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Tabel Sparepart Kritis
  const sparepartRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 45, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_PRIMARY },
          borders: borderThin,
          children: [new Paragraph({ children: [new TextRun({ text: 'Nama Suku Cadang / Komponen', bold: true, size: 18, color: COLOR_WHITE, font: 'Calibri' })] })],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_PRIMARY },
          borders: borderThin,
          children: [new Paragraph({ children: [new TextRun({ text: 'Part Number', bold: true, size: 18, color: COLOR_WHITE, font: 'Calibri' })] })],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_PRIMARY },
          borders: borderThin,
          children: [new Paragraph({ children: [new TextRun({ text: 'Jumlah', bold: true, size: 18, color: COLOR_WHITE, font: 'Calibri' })] })],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_PRIMARY },
          borders: borderThin,
          children: [new Paragraph({ children: [new TextRun({ text: 'Status Pengadaan', bold: true, size: 18, color: COLOR_WHITE, font: 'Calibri' })] })],
        }),
      ],
    }),
  ];

  if (data.actionPlan.recommendedSpareparts && data.actionPlan.recommendedSpareparts.length > 0) {
    data.actionPlan.recommendedSpareparts.forEach(sp => {
      sparepartRows.push(
        new TableRow({
          children: [
            new TableCell({
              borders: borderThin,
              children: [new Paragraph({ children: [new TextRun({ text: sp.partName, size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              borders: borderThin,
              children: [new Paragraph({ children: [new TextRun({ text: sp.partNumber || '-', size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              borders: borderThin,
              children: [new Paragraph({ children: [new TextRun({ text: String(sp.quantity), size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              borders: borderThin,
              children: [new Paragraph({ children: [new TextRun({ text: sp.urgency, bold: true, size: 18, font: 'Calibri' })] })],
            }),
          ],
        })
      );
    });
  } else {
    sparepartRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: borderThin,
            children: [new Paragraph({ children: [new TextRun({ text: 'Tidak ada penggantian sparepart kritikal khusus', size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: '-', size: 18 })] })] }),
          new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: '-', size: 18 })] })] }),
          new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: 'Ready Stock', size: 18 })] })] }),
        ],
      })
    );
  }

  const sparepartTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: sparepartRows,
  });

  // ─── Bagian 5: Lembar Pengesahan Resmi (Approval Sheet) ──────────────────
  const sigCellWidth = { size: 50, type: WidthType.PERCENTAGE };

  const buildSigCell = (signBytes: Uint8Array, nameText: string, titleText: string) => {
    const children: Paragraph[] = [];

    if (signBytes && signBytes.length > 0) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
          children: [new ImageRun({ data: signBytes, transformation: { width: 125, height: 52 }, type: 'png' })],
        })
      );
    } else {
      children.push(new Paragraph({ spacing: { before: 300 } }));
    }

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40 },
        children: [new TextRun({ text: nameText, bold: true, size: 20, color: '000000', font: 'Century Gothic' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: titleText, size: 20, color: '475569', font: 'Century Gothic' })],
      })
    );

    return children;
  };

  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: [
      // Row 1: PREPARED BY & REVIEWED BY
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: sigCellWidth,
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'PREPARED BY,', bold: true, size: 20, color: '000000', font: 'Century Gothic' })],
              }),
            ],
          }),
          new TableCell({
            width: sigCellWidth,
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'REVIEWED BY,', bold: true, size: 20, color: '000000', font: 'Century Gothic' })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: sigCellWidth,
            borders: borderThin,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: buildSigCell(prepSignBytes, normalizedPrepName, prepTitle),
          }),
          new TableCell({
            width: sigCellWidth,
            borders: borderThin,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: buildSigCell(revSignBytes, revName, revTitle),
          }),
        ],
      }),

      // Row 2: ACKNOWLEDGED BY
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'ACKNOWLEDGED BY,', bold: true, size: 20, color: '000000', font: 'Century Gothic' })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: sigCellWidth,
            borders: borderThin,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: buildSigCell(ack1SignBytes, ack1Name, ack1Title),
          }),
          new TableCell({
            width: sigCellWidth,
            borders: borderThin,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: buildSigCell(ack2SignBytes, ack2Name, ack2Title),
          }),
        ],
      }),

      // Row 3: APPROVED BY
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            borders: borderThin,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'APPROVED BY,', bold: true, size: 20, color: '000000', font: 'Century Gothic' })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borderThin,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: buildSigCell(appSignBytes, appName, appTitle),
          }),
        ],
      }),
    ],
  });

  // Susun Dokumen Word Lengkap
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        headers: {
          default: new Header({
            children: [],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Halaman ', size: 14, color: COLOR_MUTED, font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: COLOR_MUTED }),
                  new TextRun({ text: ' dari ', size: 14, color: COLOR_MUTED, font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: COLOR_MUTED }),
                ],
              }),
            ],
          }),
        },
        children: [
          createHeaderTable(),
          createDividerLine(),

          createSectionHeading('Identitas Peralatan & Dokumen Asal', '1'),
          equipmentTable,

          createSectionHeading('Kondisi Aktual & Gejala Awal', '2'),
          ...conditionParagraphs,
          driftTable,
          ...photoParagraphs,

          createSectionHeading('Analisis Prediktif (Reliability & Risk Insight)', '3'),
          aiInsightTable,

          // Pindah ke Halaman 2 untuk Bagian 4 (Action Plan) & Bagian 5 (Approval Sheet)
          new Paragraph({
            pageBreakBefore: true,
            children: [],
          }),

          // Kop Surat Lengkap di Halaman 2
          createHeaderTable(),
          createDividerLine(),

          createSectionHeading('Rencana Tindakan Prediktif (Action Plan)', '4'),
          actionPlanTable,
          new Paragraph({ spacing: { before: 120, after: 60 }, children: [new TextRun({ text: 'Kebutuhan Suku Cadang Terkait:', bold: true, size: 18, font: 'Calibri' })] }),
          sparepartTable,

          createSectionHeading('Lembar Pengesahan Resmi', '5'),
          new Paragraph({
            keepNext: true,
            spacing: { before: 80, after: 60 },
            children: [
              new TextRun({
                text: `AUTHOR BY, ${authorName}`,
                bold: true,
                size: 20,
                color: '000000',
                font: 'Century Gothic',
              }),
            ],
          }),
          signatureTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanFilename = `Predictive_Report_${data.equipmentName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${data.reportNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;
  saveAs(blob, cleanFilename);
}
