// ============================================================================
// FILE: generateBeritaAcaraDOCX.ts
// Deskripsi: Generator DOCX Berita Acara Maintenance untuk NeutraDC Cikarang.
//            Menghasilkan dokumen Word resmi dengan layout persis seperti
//            template Berita Acara Maintenance asli: Header logo, info table,
//            body text, per-equipment data tables, closing, dan signature block.
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
  Header,
  VerticalAlign,
  NumberFormat,
} from 'docx';
import { saveAs } from 'file-saver';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { toast } from 'sonner';
import { BOQItem } from '@/data/boqAssetData';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BeritaAcaraEquipmentData {
  categoryName: string;
  executionDate: string;      // e.g. "02 - 06 Mar" or "26 - 31 Mar 2026"
  items: BOQItem[];           // Selected CI items from BOQ
}

export interface BeritaAcaraConfig {
  month: number;              // 0-indexed (0=Jan, 11=Dec)
  year: number;
  nomorKontrak: string;
  periodeStart: string;       // DD-MM-YYYY
  periodeEnd: string;         // DD-MM-YYYY
  tempat: string;             // e.g. "Cikarang"
  tanggalBA: string;          // e.g. "28 April 2026"
  signerLeftName: string;
  signerLeftTitle: string;
  signerRightName: string;
  signerRightTitle: string;
  equipments: BeritaAcaraEquipmentData[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/** Columns to extract from BOQ items for the Berita Acara table */
const BA_COLUMNS = [
  'No',
  'Class Id',
  'CI Name*',
  'Capacity',
  'Serial Number',
  'Asset Tagging',
  'Production Year',
  'Model/Version',
  'Manufacturer / Principle',
  'Room',
] as const;

/** Header labels for the DOCX table (matching reference document) */
const BA_HEADER_LABELS = [
  'No',
  'Class Id',
  'CI Name*',
  'Capacity',
  'Serial Number',
  'Asset Tagging',
  'Production Year',
  'Model / Version',
  'Manufacturer\n/ Principle',
  'Room',
];

/** Column widths in percentage (total = 100) */
const COL_WIDTHS_PCT = [5, 8, 16, 9, 10, 9, 9, 11, 13, 10];

const BORDER_COLOR = '000000';
const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
};

const noBorder = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function base64ToUint8Array(base64: string): Uint8Array {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function loadImageAsUint8Array(src: string): Promise<Uint8Array> {
  if (!src) return new Uint8Array();
  if (src.startsWith('data:image')) {
    return base64ToUint8Array(src);
  }
  return new Promise((resolve) => {
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
      const dataUrl = canvas.toDataURL('image/png');
      resolve(base64ToUint8Array(dataUrl));
    };
    img.onerror = () => resolve(new Uint8Array());
    img.src = src;
  });
}

function getQuarter(month: number): string {
  if (month <= 2) return 'Q1';
  if (month <= 5) return 'Q2';
  if (month <= 8) return 'Q3';
  return 'Q4';
}


/** Create a cell for the info table (no borders, key-value) */
function infoCell(text: string, opts?: { bold?: boolean; width?: number }): TableCell {
  return new TableCell({
    width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    borders: noBorder,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text,
            bold: opts?.bold ?? false,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      }),
    ],
  });
}

/** Create header row cell for the equipment data table */
function headerCell(text: string, widthPct: number): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: thinBorder,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: text.split('\n').flatMap((line, i, arr) => {
          const runs: TextRun[] = [
            new TextRun({
              text: line,
              bold: true,
              size: 18,
              font: 'Times New Roman',
            }),
          ];
          if (i < arr.length - 1) {
            runs.push(new TextRun({ break: 1, size: 18, font: 'Times New Roman' }));
          }
          return runs;
        }),
      }),
    ],
  });
}

/** Create data row cell for the equipment data table */
function dataCell(text: string, widthPct: number): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: thinBorder,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 30, after: 30 },
        children: [
          new TextRun({
            text: text || 'N/A',
            size: 18,
            font: 'Times New Roman',
          }),
        ],
      }),
    ],
  });
}

// ─── Build Equipment Table ────────────────────────────────────────────────────

function buildEquipmentTable(items: BOQItem[]): Table {
  // Header row
  const headerRow = new TableRow({
    tableHeader: true,
    children: BA_HEADER_LABELS.map((label, i) => headerCell(label, COL_WIDTHS_PCT[i])),
  });

  // Data rows
  const dataRows = items.map((item, idx) => {
    return new TableRow({
      children: BA_COLUMNS.map((col, i) => {
        let value = '';
        if (col === 'No') {
          value = String(idx + 1);
        } else if (col === 'Asset Tagging') {
          // Try common key variations
          value = item['Asset Tagging'] || item['TAG'] || item['Asset ID'] || '';
        } else {
          value = item[col] || '';
        }
        return dataCell(value, COL_WIDTHS_PCT[i]);
      }),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

// ─── Main Generator ──────────────────────────────────────────────────────────

export async function generateBeritaAcaraDOCX(config: BeritaAcaraConfig): Promise<void> {
  const toastId = toast.loading('Membuat Berita Acara Maintenance (DOCX)...');

  try {
    // Load logos
    let logoLeftBytes: Uint8Array = new Uint8Array();
    let logoRightBytes: Uint8Array = new Uint8Array();
    try { logoLeftBytes = await loadImageAsUint8Array(logoNeutraDC); } catch { /* ignore */ }
    try { logoRightBytes = await loadImageAsUint8Array(logoDwimitra); } catch { /* ignore */ }

    const monthName = INDO_MONTHS[config.month];
    const quarter = getQuarter(config.month);

    // ─── PAGE HEADER (Logo + Title) ────────────────────────────────
    const pageHeader = new Header({
      children: [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorder,
          rows: [
            new TableRow({
              children: [
                // Left logo (NeutraDC)
                new TableCell({
                  width: { size: 20, type: WidthType.PERCENTAGE },
                  borders: noBorder,
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.LEFT,
                      children: logoLeftBytes.length > 0 ? [
                        new ImageRun({
                          data: logoLeftBytes,
                          transformation: { width: 80, height: 80 },
                          type: 'png',
                        }),
                      ] : [],
                    }),
                  ],
                }),
                // Center title
                new TableCell({
                  width: { size: 60, type: WidthType.PERCENTAGE },
                  borders: noBorder,
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 0, after: 0 },
                      children: [
                        new TextRun({
                          text: 'BERITA ACARA MAINTENANCE',
                          bold: true,
                          size: 24,
                          font: 'Times New Roman',
                        }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 0, after: 0 },
                      children: [
                        new TextRun({
                          text: 'PERANGKAT HDC CIKARANG',
                          bold: true,
                          size: 24,
                          font: 'Times New Roman',
                        }),
                      ],
                    }),
                  ],
                }),
                // Right logo (DME)
                new TableCell({
                  width: { size: 20, type: WidthType.PERCENTAGE },
                  borders: noBorder,
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: logoRightBytes.length > 0 ? [
                        new ImageRun({
                          data: logoRightBytes,
                          transformation: { width: 80, height: 40 },
                          type: 'png',
                        }),
                      ] : [],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    // ─── INFO TABLE (Pekerjaan, Kontrak, Lokasi, Pelaksana) ────────
    const infoTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorder,
      rows: [
        new TableRow({
          children: [
            infoCell('Pekerjaan', { bold: false, width: 1800 }),
            infoCell(':', { width: 300 }),
            infoCell('PREFENTIVE MAINTENANCE PERANGKAT HDC CIKARANG', { bold: false }),
          ],
        }),
        new TableRow({
          children: [
            infoCell('Nomor Kontrak', { bold: false, width: 1800 }),
            infoCell(':', { width: 300 }),
            infoCell(config.nomorKontrak, { bold: false }),
          ],
        }),
        new TableRow({
          children: [
            infoCell('Lokasi', { bold: false, width: 1800 }),
            infoCell(':', { width: 300 }),
            infoCell('HDC CIKARANG', { bold: false }),
          ],
        }),
        new TableRow({
          children: [
            infoCell('Pelaksana', { bold: false, width: 1800 }),
            infoCell(':', { width: 300 }),
            infoCell('PT. DWIMITRA EKATAMA MANDIRI', { bold: false }),
          ],
        }),
      ],
    });

    // ─── BODY PARAGRAPHS ───────────────────────────────────────────
    const bodyParagraphs: Paragraph[] = [
      new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

      // Point 1
      new Paragraph({
        numbering: { reference: 'ba-numbering', level: 0 },
        spacing: { before: 40, after: 100 },
        indent: { left: 600, right: 400 },
        children: [
          new TextRun({
            text: `Berdasarkan hasil pelaksanaan maintenance dan pengecekan yang dilaksanakan pada tanggal ${config.periodeStart} sampai dengan ${config.periodeEnd} di HDC CIKARANG oleh PT. Dwimitra Ekatama Mandiri.`,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      }),

      // Point 2
      new Paragraph({
        numbering: { reference: 'ba-numbering', level: 0 },
        spacing: { before: 80, after: 200 },
        indent: { left: 600, right: 400 },
        children: [
          new TextRun({
            text: 'Adapun sub pekerjaan yang dilakukan maintenance telah dilakukan adalah sebagai berikut :',
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      }),
    ];

    // ─── EQUIPMENT TABLES ──────────────────────────────────────────
    const equipmentSections: Paragraph[] = [];

    config.equipments.forEach((eq, eqIdx) => {
      const tableNumber = eqIdx + 1;

      // Table title
      equipmentSections.push(
        new Paragraph({
          spacing: { before: 200, after: 0 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `Table ${tableNumber}. Maintenance ${eq.categoryName} – ${quarter} ${config.year}`,
              bold: true,
              size: 22,
              font: 'Times New Roman',
            }),
          ],
        })
      );

      // Execution date subtitle
      equipmentSections.push(
        new Paragraph({
          spacing: { before: 0, after: 80 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `(Execution date ${eq.executionDate})`,
              italics: true,
              size: 20,
              font: 'Times New Roman',
            }),
          ],
        })
      );

      // Equipment data table
      const table = buildEquipmentTable(eq.items);
      equipmentSections.push(
        new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [],
        })
      );
      // We push the table as a separate element via children in section
      equipmentSections.push(table as unknown as Paragraph);

      // Spacer after table
      equipmentSections.push(
        new Paragraph({
          spacing: { before: 100, after: 100 },
          children: [],
        })
      );
    });

    // ─── CLOSING SECTION ───────────────────────────────────────────
    const closingParagraphs: (Paragraph | Table)[] = [
      // Page break before closing if needed
      new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

      // Closing text (numbered continuation from point 2)
      new Paragraph({
        spacing: { before: 100, after: 80 },
        indent: { left: 600, right: 400 },
        children: [
          new TextRun({
            text: `Pelaksanaan maintenance yang berlokasi di HDC Cikarang tersebut secara teknis, dinyatakan.`,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      }),

      // DITERIMA / DITOLAK
      new Paragraph({
        spacing: { before: 100, after: 100 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'DITERIMA / DITOLAK.',
            bold: true,
            size: 24,
            font: 'Times New Roman',
          }),
        ],
      }),

      // Demikian...
      new Paragraph({
        spacing: { before: 100, after: 80 },
        indent: { left: 600 },
        children: [
          new TextRun({
            text: `Demikian Berita Acara Maintenance ${monthName} ${config.year} dibuat dan ditandatangani oleh kedua belah pihak.`,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      }),

      // Tempat, tanggal
      new Paragraph({
        spacing: { before: 100, after: 200 },
        alignment: AlignmentType.LEFT,
        indent: { left: 600 },
        children: [
          new TextRun({
            text: `${config.tempat}, ${config.tanggalBA}`,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      }),

      // ─── SIGNATURE TABLE ──────────────────────────────────────────
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
          // Company names row
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorder,
                children: [
                  new Paragraph({
                    spacing: { before: 40, after: 0 },
                    indent: { left: 200 },
                    children: [
                      new TextRun({
                        text: 'PT. TELKOM DATA EKOSISTEM',
                        bold: true,
                        size: 22,
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorder,
                children: [
                  new Paragraph({
                    spacing: { before: 40, after: 0 },
                    children: [
                      new TextRun({
                        text: 'PT. DWIMITRA EKATAMA MANDIRI',
                        bold: true,
                        size: 22,
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          // Spacer row for signature space
          new TableRow({
            height: { value: 1200, rule: 'atLeast' as any },
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorder,
                children: [new Paragraph({ children: [] })],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorder,
                children: [new Paragraph({ children: [] })],
              }),
            ],
          }),
          // Signer names row
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorder,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 0 },
                    children: [
                      new TextRun({
                        text: config.signerLeftName,
                        underline: {},
                        size: 22,
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 20, after: 0 },
                    children: [
                      new TextRun({
                        text: config.signerLeftTitle,
                        size: 22,
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorder,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 0 },
                    children: [
                      new TextRun({
                        text: config.signerRightName,
                        underline: {},
                        size: 22,
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 20, after: 0 },
                    children: [
                      new TextRun({
                        text: config.signerRightTitle,
                        size: 22,
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];

    // ─── ASSEMBLE DOCUMENT ──────────────────────────────────────────
    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'ba-numbering',
            levels: [
              {
                level: 0,
                format: NumberFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.LEFT,
                style: {
                  run: { size: 22, font: 'Times New Roman' },
                  paragraph: { indent: { left: 600, hanging: 360 } },
                },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: 12240,  // Letter width (8.5")
                height: 15840, // Letter height (11")
              },
              margin: {
                top: 1701,
                right: 1440,
                bottom: 1530,
                left: 1440,
                header: 720,
                footer: 720,
              },
            },
          },
          headers: {
            default: pageHeader,
          },
          children: [
            // Info table
            infoTable,
            // Body paragraphs
            ...bodyParagraphs,
            // Equipment tables
            ...equipmentSections,
            // Closing & Signatures
            ...(closingParagraphs as any[]),
          ],
        },
      ],
    });

    // ─── GENERATE & DOWNLOAD ───────────────────────────────────────
    const blob = await Packer.toBlob(doc);
    const fileName = `BERITA ACARA MAINTENANCE ${monthName.toUpperCase()} ${config.year}.docx`;
    saveAs(blob, fileName);

    toast.success(`Berita Acara berhasil dibuat: ${fileName}`, { id: toastId, duration: 5000 });
    return;
  } catch (error) {
    console.error('Error generating Berita Acara DOCX:', error);
    toast.error(`Gagal membuat Berita Acara: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: toastId });
    throw error;
  }
}
