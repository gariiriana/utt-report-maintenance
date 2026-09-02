// ============================================================================
// FILE: generateBeritaAcaraDOCX.ts
// Deskripsi: Generator DOCX Berita Acara Maintenance untuk NeutraDC Cikarang.
//            Menghasilkan dokumen Word resmi dengan layout persis seperti
//            template Berita Acara Maintenance asli:
//            - Margin kiri lebar (space kliping/jilid) & seluruh konten proporsional
//            - Header logo ganda rapi (Dwimitra kiri natural, NeutraDC kanan)
//            - Judul 1 baris bergaris bawah di tengah
//            - Info table mepet kanan dengan garis pemisah tunggal di Pelaksana
//            - Body text bernomor rapi
//            - Tabel equipment ber-header hijau full width
//            - Closing dan signature block
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
  VerticalAlign,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { toast } from 'sonner';
import { BOQItem } from '@/data/boqAssetData';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BeritaAcaraEquipmentData {
  categoryName: string;
  executionDate: string;      // e.g. "02 - 06 Mar" or "16 - 27 Maret"
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
  'Model/\nVersion',
  'Manufacturer\n/ Principle',
  'Room',
];

/** Total printable page width = 9040 DXA (Letter width 12240 - left margin 2000 - right margin 1200) */
const TOTAL_CONTENT_WIDTH_DXA = 9040;

/** Column widths in DXA for Equipment Table (sum = 9040 DXA) */
const BA_COL_WIDTHS_DXA = [
  400,   // No
  800,   // Class Id
  1540,  // CI Name*
  750,   // Capacity
  1000,  // Serial Number
  880,   // Asset Tagging
  820,   // Production Year
  1000,  // Model/Version
  1100,  // Manufacturer / Principle
  750,   // Room
];

/** Table Header Green Color (#1E6B37 - matches the official report template) */
const COLOR_TABLE_HEADER_GREEN = '1E6B37';
const COLOR_BORDER = '000000';

/** Thin black borders for data table */
const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
};

/** Completely remove borders on tables (including inner gridlines) */
const noTableBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};

/** Completely remove borders on cells */
const noCellBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};

/** Single bottom border only for the Pelaksana line */
const bottomOnlyCellBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
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

/** Create a spacer cell for empty left space */
function spacerCell(widthDxa: number): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: noCellBorders,
    children: [new Paragraph({ children: [] })],
  });
}

/** Create a cell for the info table (key-value metadata, pushed to right for clipping) */
function infoCell(text: string, opts: { bold?: boolean; widthDxa: number; hasBottomBorder?: boolean }): TableCell {
  return new TableCell({
    width: { size: opts.widthDxa, type: WidthType.DXA },
    borders: opts.hasBottomBorder ? bottomOnlyCellBorders : noCellBorders,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { before: 20, after: 20 },
        children: [
          new TextRun({
            text,
            bold: opts.bold ?? false,
            size: 21,
            font: 'Times New Roman',
            color: '000000',
          }),
        ],
      }),
    ],
  });
}

/** Create header row cell for the equipment data table (Green background, white italic bold text) */
function headerCell(text: string, widthDxa: number): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: thinBorder,
    shading: {
      fill: COLOR_TABLE_HEADER_GREEN,
      type: ShadingType.CLEAR,
    },
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
              italics: true,
              color: 'FFFFFF',
              size: 17,
              font: 'Times New Roman',
            }),
          ];
          if (i < arr.length - 1) {
            runs.push(new TextRun({ break: 1, size: 17, font: 'Times New Roman' }));
          }
          return runs;
        }),
      }),
    ],
  });
}

/** Create data row cell for the equipment data table */
function dataCell(text: string, widthDxa: number): TableCell {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
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
            color: '000000',
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
    children: BA_HEADER_LABELS.map((label, i) => headerCell(label, BA_COL_WIDTHS_DXA[i])),
  });

  // Data rows
  const dataRows = items.map((item, idx) => {
    return new TableRow({
      children: BA_COLUMNS.map((col, i) => {
        let value = '';
        if (col === 'No') {
          value = String(idx + 1);
        } else if (col === 'Asset Tagging') {
          value = item['Asset Tagging'] || item['TAG'] || item['Asset ID'] || 'N/A';
        } else {
          value = item[col] || 'N/A';
        }
        return dataCell(value, BA_COL_WIDTHS_DXA[i]);
      }),
    });
  });

  return new Table({
    width: { size: TOTAL_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    rows: [headerRow, ...dataRows],
  });
}

// ─── Main Generator ──────────────────────────────────────────────────────────

export async function generateBeritaAcaraDOCX(config: BeritaAcaraConfig): Promise<void> {
  const toastId = toast.loading('Membuat Berita Acara Maintenance (DOCX)...');

  try {
    // Load logos: Left is Dwimitra, Right is NeutraDC
    let logoDwimitraBytes: Uint8Array = new Uint8Array();
    let logoNeutraDCBytes: Uint8Array = new Uint8Array();
    try { logoDwimitraBytes = await loadImageAsUint8Array(logoDwimitra); } catch { /* ignore */ }
    try { logoNeutraDCBytes = await loadImageAsUint8Array(logoNeutraDC); } catch { /* ignore */ }

    const monthName = INDO_MONTHS[config.month];
    const quarter = getQuarter(config.month);

    // ─── DOCUMENT HEADER TABLE (Logo Dwimitra kiri, Judul tengah, Logo NeutraDC kanan) ───
    // Total width = 9040 DXA (100% printable width)
    const headerTable = new Table({
      width: { size: TOTAL_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      borders: noTableBorders,
      rows: [
        new TableRow({
          children: [
            // Left: Logo Dwimitra (1300 DXA) - Natural aspect ratio diamond
            new TableCell({
              width: { size: 1300, type: WidthType.DXA },
              borders: noCellBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: logoDwimitraBytes.length > 0 ? [
                    new ImageRun({
                      data: logoDwimitraBytes,
                      transformation: { width: 78, height: 42 },
                      type: 'png',
                    }),
                  ] : [],
                }),
              ],
            }),
            // Center: Title 1 baris bergaris bawah (6440 DXA)
            new TableCell({
              width: { size: 6440, type: WidthType.DXA },
              borders: noCellBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: 'BERITA ACARA MAINTENANCE PERANGKAT HDC CIKARANG',
                      bold: true,
                      underline: {},
                      size: 20,
                      font: 'Times New Roman',
                      color: '000000',
                    }),
                  ],
                }),
              ],
            }),
            // Right: Logo NeutraDC (1300 DXA) - Natural aspect ratio
            new TableCell({
              width: { size: 1300, type: WidthType.DXA },
              borders: noCellBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: logoNeutraDCBytes.length > 0 ? [
                    new ImageRun({
                      data: logoNeutraDCBytes,
                      transformation: { width: 90, height: 32 },
                      type: 'png',
                    }),
                  ] : [],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    // ─── INFO TABLE (Mepet ke kanan dengan space kliping di kiri + Garis Bawah di Pelaksana) ────
    // Total width = 9040 DXA: Spacer (1200) + Label (1400) + Colon (200) + Value (6240)
    const infoTable = new Table({
      width: { size: TOTAL_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      borders: noTableBorders,
      rows: [
        new TableRow({
          children: [
            spacerCell(1200),
            infoCell('Pekerjaan', { widthDxa: 1400 }),
            infoCell(':', { widthDxa: 200 }),
            infoCell('PREFENTIVE MAINTENANCE PERANGKAT HDC CIKARANG', { widthDxa: 6240 }),
          ],
        }),
        new TableRow({
          children: [
            spacerCell(1200),
            infoCell('Nomor Kontrak', { widthDxa: 1400 }),
            infoCell(':', { widthDxa: 200 }),
            infoCell(config.nomorKontrak, { widthDxa: 6240 }),
          ],
        }),
        new TableRow({
          children: [
            spacerCell(1200),
            infoCell('Lokasi', { widthDxa: 1400 }),
            infoCell(':', { widthDxa: 200 }),
            infoCell('HDC CIKARANG', { widthDxa: 6240 }),
          ],
        }),
        new TableRow({
          children: [
            spacerCell(1200),
            infoCell('Pelaksana', { widthDxa: 1400, hasBottomBorder: true }),
            infoCell(':', { widthDxa: 200, hasBottomBorder: true }),
            infoCell('PT. DWIMITRA EKATAMA MANDIRI', { widthDxa: 6240, hasBottomBorder: true }),
          ],
        }),
      ],
    });

    // ─── BODY PARAGRAPHS ───────────────────────────────────────────
    const bodyParagraphs: Paragraph[] = [
      new Paragraph({ spacing: { before: 180, after: 0 }, children: [] }),

      // Point 1
      new Paragraph({
        spacing: { before: 40, after: 80 },
        indent: { left: 360, hanging: 360 },
        children: [
          new TextRun({
            text: `1.  Berdasarkan hasil pelaksanaan maintenance dan pengecekan yang dilaksanakan pada tanggal ${config.periodeStart.replace(/-/g, '\u2011')} sampai dengan ${config.periodeEnd.replace(/-/g, '\u2011')} di HDC CIKARANG oleh PT. Dwimitra Ekatama Mandiri.`,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      }),

      // Point 2
      new Paragraph({
        spacing: { before: 80, after: 120 },
        indent: { left: 360, hanging: 360 },
        children: [
          new TextRun({
            text: '2.  Adapun sub pekerjaan yang dilakukan maintenance telah dilakukan adalah sebagai berikut :',
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
          spacing: { before: 180, after: 30 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `Table ${tableNumber}. Maintenance ${eq.categoryName} – ${quarter} ${config.year}`,
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
      equipmentSections.push(table as unknown as Paragraph);

      // Spacer after table
      equipmentSections.push(
        new Paragraph({
          spacing: { before: 80, after: 80 },
          children: [],
        })
      );
    });

    // ─── CLOSING SECTION ───────────────────────────────────────────
    const closingParagraphs: (Paragraph | Table)[] = [
      new Paragraph({ spacing: { before: 160, after: 0 }, children: [] }),

      // Closing text
      new Paragraph({
        spacing: { before: 80, after: 80 },
        indent: { left: 360, right: 200 },
        children: [
          new TextRun({
            text: 'Pelaksanaan maintenance yang berlokasi di HDC Cikarang tersebut secara teknis, dinyatakan.',
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      }),

      // DITERIMA / DITOLAK
      new Paragraph({
        spacing: { before: 80, after: 120 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'DITERIMA / DITOLAK.',
            bold: true,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      }),

      // Demikian...
      new Paragraph({
        spacing: { before: 80, after: 80 },
        indent: { left: 360 },
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
        spacing: { before: 80, after: 180 },
        alignment: AlignmentType.LEFT,
        indent: { left: 360 },
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
        width: { size: TOTAL_CONTENT_WIDTH_DXA, type: WidthType.DXA },
        borders: noTableBorders,
        rows: [
          // Company names row
          new TableRow({
            children: [
              new TableCell({
                width: { size: 4520, type: WidthType.DXA },
                borders: noCellBorders,
                children: [
                  new Paragraph({
                    spacing: { before: 40, after: 0 },
                    indent: { left: 360 },
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
                width: { size: 4520, type: WidthType.DXA },
                borders: noCellBorders,
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
                width: { size: 4520, type: WidthType.DXA },
                borders: noCellBorders,
                children: [new Paragraph({ children: [] })],
              }),
              new TableCell({
                width: { size: 4520, type: WidthType.DXA },
                borders: noCellBorders,
                children: [new Paragraph({ children: [] })],
              }),
            ],
          }),
          // Signer names row
          new TableRow({
            children: [
              new TableCell({
                width: { size: 4520, type: WidthType.DXA },
                borders: noCellBorders,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    indent: { left: 360 },
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
                    alignment: AlignmentType.LEFT,
                    indent: { left: 360 },
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
                width: { size: 4520, type: WidthType.DXA },
                borders: noCellBorders,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
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
                    alignment: AlignmentType.LEFT,
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
      sections: [
        {
          properties: {
            page: {
              size: {
                width: 12240,  // Letter width (8.5")
                height: 15840, // Letter height (11")
              },
              margin: {
                top: 1440,     // 1 inch
                right: 1200,   // ~0.83 inch
                bottom: 1440,  // 1 inch
                left: 2000,    // ~1.39 inch (Gutter / space for clipping & binding)
              },
            },
          },
          children: [
            // Header table (Dwimitra Logo - Underlined Title - NeutraDC Logo)
            headerTable,
            new Paragraph({ spacing: { before: 80, after: 80 }, children: [] }),
            // Info table with bottom separator line
            infoTable,
            // Body paragraphs (Point 1 & 2)
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
