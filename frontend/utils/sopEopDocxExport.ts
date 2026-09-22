// ============================================================================
// FILE: frontend/utils/sopEopDocxExport.ts
// Deskripsi: Engine Ekspor Dokumen SOP & EOP ke Microsoft Word (.docx)
//            Standar Presisi 100% Identik Master Dokumen NeutraDC & PT DME
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
  UnderlineType,
  PageBreak,
} from 'docx';
import { saveAs } from 'file-saver';
import { SOPDocumentData, EOPDocumentData, SOPCIEquipmentItem } from '@/types/sopEopTypes';
import { ensureBilingualTranslation } from '@/utils/sopEopBilingualAI';
import logoDMEOriginal from '@/assets/sop_eop_logo2.jpeg';
import logoNDCOriginal from '@/assets/sop_eop_logo1.jpeg';

// ----------------------------------------------------------------------------
// CONSTANTS & SIZES
// ----------------------------------------------------------------------------
const FONT_HEADING = 'Aptos Display';
const FONT_BODY = 'Aptos';
const CONTENT_WIDTH_DXA = 9016; // 15.9 cm exact printable area on A4 portrait

// Colors
const COLOR_BLACK = '000000';
const COLOR_GREY_ID = '595959'; // Corporate translation grey
const COLOR_BANNER_SOP = 'EE0000'; // Pure Red for SOP
const COLOR_BANNER_EOP = 'FF00FF'; // Pure Magenta for EOP
const COLOR_SUBTITLE_BANNER = 'E0E0E0';
const COLOR_WHITE = 'FFFFFF';

// Borders
const BORDER_NONE = { style: BorderStyle.NONE, size: 0, color: 'auto' };

const CELL_NO_BORDER = {
  top: BORDER_NONE,
  bottom: BORDER_NONE,
  left: BORDER_NONE,
  right: BORDER_NONE,
};

const TABLE_NO_BORDER = {
  top: BORDER_NONE,
  bottom: BORDER_NONE,
  left: BORDER_NONE,
  right: BORDER_NONE,
  insideHorizontal: BORDER_NONE,
  insideVertical: BORDER_NONE,
};

const CELL_BORDER_DIVIDER_TOP = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'auto' },
  bottom: BORDER_NONE,
  left: BORDER_NONE,
  right: BORDER_NONE,
};

const CELL_BORDER_DIVIDER_BOTTOM = {
  top: BORDER_NONE,
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'auto' },
  left: BORDER_NONE,
  right: BORDER_NONE,
};

const CELL_BORDERS_BOX = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'auto' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'auto' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'auto' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'auto' },
};

// ----------------------------------------------------------------------------
// IMAGE HELPERS
// ----------------------------------------------------------------------------
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
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/jpeg', 0.95);
          resolve(base64ToUint8Array(dataURL));
          return;
        }
      } catch (e) {
        console.warn('Canvas export failed:', e);
      }
      resolve(new Uint8Array());
    };
    img.onerror = () => resolve(new Uint8Array());
    img.src = src;
  });
}

// ----------------------------------------------------------------------------
// BILINGUAL RUN & PARAGRAPH BUILDERS
// ----------------------------------------------------------------------------

/**
 * Creates standard bilingual runs:
 * Line 1: English (10pt, #000000, regular)
 * Line 2: Indonesian (9pt, #595959, italics)
 */
function createBilingualRuns(
  textEn: string,
  textId: string,
  opts?: {
    sizeEn?: number; // half-points (20 = 10pt)
    sizeId?: number; // half-points (18 = 9pt)
    boldEn?: boolean;
    boldId?: boolean;
    underlineEn?: boolean;
    isHeader?: boolean;
  }
): TextRun[] {
  const fontToUse = opts?.isHeader ? FONT_HEADING : FONT_BODY;
  const effectiveId = opts?.isHeader ? textId : ensureBilingualTranslation(textEn, textId);

  const runs: TextRun[] = [
    new TextRun({
      text: textEn,
      bold: opts?.boldEn ?? false,
      underline: opts?.underlineEn ? { type: UnderlineType.SINGLE } : undefined,
      color: COLOR_BLACK,
      size: opts?.sizeEn ?? 20, // 10pt
      font: fontToUse,
    }),
    new TextRun({
      text: '',
      break: 1, // Move to next line in the exact same paragraph
    }),
    new TextRun({
      text: effectiveId,
      bold: opts?.boldId ?? false,
      italics: true,
      color: COLOR_GREY_ID,
      size: opts?.sizeId ?? 18, // 9pt
      font: fontToUse,
    }),
  ];
  return runs;
}

/**
 * Form field paragraph:
 * LabelEn: ValEn
 * LabelId: ValId (italic, grey)
 * Menggunakan spacing after 0 dan line 240 persis dokumen master
 */
function createBilingualFieldParagraph(
  labelEn: string,
  valEn: string,
  labelId: string,
  valId: string,
  spacingAfter = 0
): Paragraph {
  // Gunakan tab formatting agar tanda titik dua (:) sejajar vertikal sempurna seperti master
  const isShortLabel = labelEn.length <= 14;
  const tabSeparatorsEn = isShortLabel ? '\t\t' : '\t';
  const isShortLabelId = labelId.length <= 14;
  const tabSeparatorsId = isShortLabelId ? '\t\t' : '\t';

  const resolvedValId =
    valEn && valEn !== '-' ? ensureBilingualTranslation(valEn, valId) : valId;

  return new Paragraph({
    spacing: { after: spacingAfter, line: 240 },
    children: [
      new TextRun({
        text: labelEn,
        bold: false,
        color: COLOR_BLACK,
        size: 20,
        font: FONT_BODY,
      }),
      new TextRun({
        text: `${tabSeparatorsEn}: ${valEn || '-'}`,
        bold: false,
        color: COLOR_BLACK,
        size: 20,
        font: FONT_BODY,
      }),
      new TextRun({
        text: '',
        break: 1,
      }),
      new TextRun({
        text: labelId,
        italics: true,
        color: COLOR_GREY_ID,
        size: 18,
        font: FONT_BODY,
      }),
      new TextRun({
        text: `${tabSeparatorsId}: ${resolvedValId || '-'}`,
        italics: true,
        color: COLOR_GREY_ID,
        size: 18,
        font: FONT_BODY,
      }),
    ],
  });
}

function createBilingualContentParagraph(textEn: string, textId?: string): Paragraph {
  return new Paragraph({
    spacing: { after: 0, line: 240 },
    children: createBilingualRuns(textEn || '-', textId || ensureBilingualTranslation(textEn || '-')),
  });
}

function createSpacer(_height?: number): Paragraph {
  return new Paragraph({
    spacing: { after: 0, line: 240 },
    children: [],
  });
}

/**
 * Creates a colored Section Banner table cell spanning exact 9016 dxa
 */
function createSectionBanner(titleEn: string, titleId?: string, isEOP = false): Table {
  const bgColor = isEOP ? COLOR_BANNER_EOP : COLOR_BANNER_SOP;
  const textChildren: TextRun[] = [
    new TextRun({
      text: titleEn,
      bold: true,
      color: COLOR_WHITE,
      size: 22, // 11pt
      font: FONT_HEADING,
    }),
  ];

  if (titleId) {
    textChildren.push(
      new TextRun({
        text: '',
        break: 1,
      }),
      new TextRun({
        text: titleId,
        bold: true,
        italics: true,
        color: COLOR_SUBTITLE_BANNER,
        size: 20, // 10pt
        font: FONT_HEADING,
      })
    );
  }

  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    borders: TABLE_NO_BORDER,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: bgColor, color: 'auto' },
            borders: CELL_NO_BORDER,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 20, line: 240 },
                children: textChildren,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}



// ----------------------------------------------------------------------------
// DOCUMENT HEADER & FOOTER BUILDERS
// ----------------------------------------------------------------------------
function createDocumentHeader(
  title: string,
  subtitle: string,
  dmeBytes: Uint8Array,
  ndcBytes: Uint8Array,
  isEOP: boolean
): Header {
  const highlightColor = isEOP ? 'magenta' : 'red';

  return new Header({
    children: [
      new Table({
        width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
        borders: TABLE_NO_BORDER,
        rows: [
          new TableRow({
            children: [
              // Left Cell: Titles with Red / Magenta highlight
              new TableCell({
                width: { size: 6200, type: WidthType.DXA },
                borders: CELL_NO_BORDER,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: title,
                        bold: true,
                        size: 28, // 14pt
                        color: COLOR_WHITE,
                        highlight: highlightColor,
                        font: FONT_HEADING,
                      }),
                      new TextRun({
                        text: '',
                        break: 1,
                      }),
                      new TextRun({
                        text: subtitle,
                        bold: true,
                        size: 28, // 14pt
                        color: COLOR_WHITE,
                        highlight: highlightColor,
                        font: FONT_HEADING,
                      }),
                    ],
                  }),
                ],
              }),
              // Right Cell: Company Logos (NeutraDC + Dwimitra)
              new TableCell({
                width: { size: 2816, type: WidthType.DXA },
                borders: CELL_NO_BORDER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      ...(dmeBytes.length > 0
                        ? [
                            new ImageRun({
                              data: dmeBytes,
                              transformation: { width: 100, height: 42 },
                              type: 'jpg',
                            }),
                            new TextRun({ text: '  ' }),
                          ]
                        : []),
                      ...(ndcBytes.length > 0
                        ? [
                            new ImageRun({
                              data: ndcBytes,
                              transformation: { width: 78, height: 40 },
                              type: 'jpg',
                            }),
                          ]
                        : []),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [],
      }),
    ],
  });
}

function createDocumentFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Page ', size: 18, font: FONT_BODY }),
          new TextRun({ children: [PageNumber.CURRENT], size: 18, bold: true, font: FONT_BODY }),
          new TextRun({ text: ' of ', size: 18, font: FONT_BODY }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, bold: true, font: FONT_BODY }),
        ],
      }),
    ],
  });
}

// ============================================================================
// EXPORT SOP TO DOCX (100% Master Precision)
// ============================================================================
export async function exportSOPToDocx(data: SOPDocumentData): Promise<void> {
  const [dmeBytes, ndcBytes] = await Promise.all([
    loadImageAsUint8Array(logoDMEOriginal),
    loadImageAsUint8Array(logoNDCOriginal),
  ]);

  const children: (Paragraph | Table)[] = [];

  // --------------------------------------------------------------------------
  // SECTION 1: Document Overview
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 1 – Document Overview', 'Seksi 1 – Gambaran Umum Dokumen', false));
  children.push(createSpacer(40));

  children.push(
    createBilingualFieldParagraph(
      'Document Title',
      data.documentTitle,
      'Judul Dokumen',
      data.documentTitle
    )
  );

  children.push(
    createBilingualFieldParagraph(
      'Document Purpose',
      data.documentPurposeEn,
      'Tujuan Dokumen',
      data.documentPurposeId
    )
  );

  children.push(
    createBilingualFieldParagraph(
      'Work Location',
      data.workLocationEn || 'Neutra DC Cikarang',
      'Lokasi Kerja',
      data.workLocationId || 'Neutra DC Cikarang',
      80
    )
  );

  // --------------------------------------------------------------------------
  // SECTION 2: Equipment Information
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 2 – Equipment Information', 'Seksi 2 – Informasi Peralatan', false));
  children.push(createSpacer(40));

  // 10 master column definitions: [width, headerEn, headerId, dataKey]
  const allEquipCols: { width: number; en: string; id: string; key: keyof SOPCIEquipmentItem }[] = [
    { width: 480, en: 'No', id: 'No', key: 'no' },
    { width: 771, en: 'Class id', id: 'ID Kelas', key: 'classId' },
    { width: 907, en: 'CI Name*', id: 'Nama CI*', key: 'ciName' },
    { width: 1326, en: 'CI Description*', id: 'Deskripsi CI*', key: 'ciDescription' },
    { width: 1041, en: 'Capacity', id: 'Kapasitas', key: 'capacity' },
    { width: 1198, en: 'Serial Number', id: 'Nomor Seri', key: 'serialNumber' },
    { width: 642, en: 'MFD', id: 'Tahun Pembuatan (MFD)', key: 'mfd' },
    { width: 1143, en: 'Product Name', id: 'Nama Produk', key: 'productName' },
    { width: 1152, en: 'Model', id: 'Model', key: 'model' },
    { width: 356, en: 'Room', id: 'Ruangan', key: 'room' },
  ];

  // Tentukan kolom mana yang punya data (skip kolom opsional jika semua itemnya kosong/"-")
  const eqList = data.equipmentList || [];
  const optionalKeys: (keyof SOPCIEquipmentItem)[] = [
    'ciDescription',
    'serialNumber',
    'room',
    'capacity',
    'mfd',
    'productName',
    'model',
  ];

  const hasEquipmentData = eqList.length > 0;
  const activeEquipCols = allEquipCols.filter((col) => {
    // Jika tidak ada data equipment sama sekali, pertahankan semua kolom template standar
    if (!hasEquipmentData) return true;
    // Kolom inti (no, classId, ciName) selalu ditampilkan
    if (!optionalKeys.includes(col.key)) return true;
    // Kolom opsional hanya ditampilkan jika minimal ada 1 baris yang terisi data bermakna
    return eqList.some((eq) => {
      const rawVal = eq[col.key as keyof SOPCIEquipmentItem];
      const val = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
      return val !== '' && val !== '-' && val !== 'N/A' && val !== 'n/a';
    });
  });

  // Redistribusi lebar kolom agar total tetap pas = CONTENT_WIDTH_DXA (15.9 cm)
  const totalActiveWidth = activeEquipCols.reduce((sum, c) => sum + c.width, 0);
  const scaleFactor = CONTENT_WIDTH_DXA / totalActiveWidth;
  const equipColWidths = activeEquipCols.map((c) => Math.round(c.width * scaleFactor));
  const widthDiff = CONTENT_WIDTH_DXA - equipColWidths.reduce((sum, w) => sum + w, 0);
  if (widthDiff !== 0 && equipColWidths.length > 0) {
    equipColWidths[equipColWidths.length - 1] += widthDiff;
  }

  const equipHeaderRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: activeEquipCols.map(
      (col, idx) =>
        new TableCell({
          width: { size: equipColWidths[idx], type: WidthType.DXA },
          borders: CELL_BORDERS_BOX,
          shading: { type: ShadingType.CLEAR, fill: 'FFFFFF', color: 'auto' },
          margins: { top: 40, bottom: 40, left: 40, right: 40 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: createBilingualRuns(col.en, col.id, { sizeEn: 18, sizeId: 16, boldEn: true, isHeader: true }),
            }),
          ],
        })
    ),
  });

  const equipDataRows = eqList.map((eq, i) => {
    return new TableRow({
      cantSplit: true,
      children: activeEquipCols.map((col, colIdx) => {
        let cellText = '-';
        if (col.key === 'no') {
          cellText = String(eq.no || i + 1);
        } else {
          const rawVal = eq[col.key as keyof SOPCIEquipmentItem];
          cellText = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '' ? String(rawVal).trim() : '-';
        }

        return new TableCell({
          width: { size: equipColWidths[colIdx], type: WidthType.DXA },
          borders: CELL_BORDERS_BOX,
          margins: { top: 40, bottom: 40, left: 40, right: 40 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: cellText,
                  size: 18, // 9pt
                  color: COLOR_BLACK,
                  font: FONT_BODY,
                }),
              ],
            }),
          ],
        });
      }),
    });
  });

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: [equipHeaderRow, ...equipDataRows],
    })
  );
  children.push(createSpacer(80));

  // --------------------------------------------------------------------------
  // SECTION 3: Schedule / Work Information
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 3 – Schedule / Work Information', 'Seksi 3 – Informasi Jadwal / Pekerjaan', false));
  children.push(createSpacer(40));

  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: 'SOP Execution Date: ', size: 20, font: FONT_BODY }),
        new TextRun({ text: data.executionDate || '-', size: 20, font: FONT_BODY }),
        new TextRun({ text: '    Reference Ticket Number: ', size: 20, font: FONT_BODY }),
        new TextRun({ text: data.referenceTicketNumber || '-', size: 20, font: FONT_BODY }),
        new TextRun({ text: '', break: 1 }),
        new TextRun({ text: 'Tanggal Pelaksanaan SOP: ', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
        new TextRun({ text: data.executionDate || '-', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
        new TextRun({ text: '    Nomor Tiket Referensi: ', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
        new TextRun({ text: data.referenceTicketNumber || '-', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
      ],
    })
  );
  const executedByHeaderRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: 4395, type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [
          new Paragraph({
            spacing: { after: 0, line: 240 },
            children: [
              new TextRun({ text: 'Executed by (Name)', size: 20, font: FONT_BODY }),
              new TextRun({ text: '', break: 1 }),
              new TextRun({ text: 'Dilaksanakan oleh (Nama)', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 4626, type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [
          new Paragraph({
            spacing: { after: 0, line: 240 },
            children: [
              new TextRun({ text: 'Job title', size: 20, font: FONT_BODY }),
              new TextRun({ text: '', break: 1 }),
              new TextRun({ text: 'Jabatan', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
            ],
          }),
        ],
      }),
    ],
  });

  // Table executor [4395, 4626]
  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      borders: TABLE_NO_BORDER,
      rows: [
        executedByHeaderRow,
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 4395, type: WidthType.DXA },
              borders: CELL_BORDER_DIVIDER_BOTTOM,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: data.executedByName || '-', size: 18, font: FONT_BODY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4626, type: WidthType.DXA },
              borders: CELL_BORDER_DIVIDER_BOTTOM,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: data.executedByJobTitle || '-', size: 18, font: FONT_BODY })],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(80));

  // --------------------------------------------------------------------------
  // SECTION 4: Affected Equipment / Systems
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 4 – Affected Equipment / Systems', 'Seksi 4 – Peralatan / Sistem yang Terdampak', false));
  children.push(createSpacer(40));

  const affSystems = data.affectedSystems || [];
  const affRows: TableRow[] = [];
  const affColsWidth = [3005, 3227, 2784];

  for (let i = 0; i < affSystems.length; i += 3) {
    const rowItems = [affSystems[i], affSystems[i + 1], affSystems[i + 2]];
    affRows.push(
      new TableRow({
        children: rowItems.map((item, cIdx) => {
          if (!item) {
            return new TableCell({
              width: { size: affColsWidth[cIdx], type: WidthType.DXA },
              borders: CELL_NO_BORDER,
              children: [new Paragraph({})],
            });
          }
          const checkMark = item.checked ? '☒ ' : '☐ ';
          return new TableCell({
            width: { size: affColsWidth[cIdx], type: WidthType.DXA },
            borders: CELL_NO_BORDER,
            margins: { top: 30, bottom: 30, left: 40, right: 40 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${checkMark}${item.labelEn}`, size: 18, color: COLOR_BLACK, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: `    ${item.labelId}`, italics: true, size: 18, color: COLOR_GREY_ID, font: FONT_BODY }),
                ],
              }),
            ],
          });
        }),
      })
    );
  }

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: affRows,
    })
  );

  children.push(
    new Paragraph({
      spacing: { before: 40, after: 20 },
      children: [
        new TextRun({
          text: 'if any of the item above is checked, do provide details for each item respectively:',
          size: 16,
          color: COLOR_BLACK,
          font: FONT_BODY,
        }),
        new TextRun({ text: '', break: 1 }),
        new TextRun({
          text: 'jika ada item di atas yang dicentang, berikan rincian untuk masing-masing item tersebut:',
          italics: true,
          size: 18,
          color: COLOR_GREY_ID,
          font: FONT_BODY,
        }),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
              borders: CELL_BORDERS_BOX,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: createBilingualRuns(
                    data.affectedSystemsDetailsEn || data.affectedSystemsDetails || '-',
                    data.affectedSystemsDetailsId,
                    { sizeEn: 18, sizeId: 18 }
                  ),
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(80));

  // --------------------------------------------------------------------------
  // SECTION 5: Referenced Documents / Attachments
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 5 – Referenced Documents / Attachments', 'Seksi 5 – Dokumen Referensi / Lampiran', false));
  children.push(createSpacer(40));

  const sopRefHeaderRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: 6374, type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [
          new Paragraph({
            spacing: { after: 0, line: 240 },
            children: [
              new TextRun({ text: 'Document Name', size: 20, font: FONT_BODY }),
              new TextRun({ text: '', break: 1 }),
              new TextRun({ text: 'Nama Dokumen', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 2642, type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [
          new Paragraph({
            spacing: { after: 0, line: 240 },
            children: [
              new TextRun({ text: 'Document Number', size: 20, font: FONT_BODY }),
              new TextRun({ text: '', break: 1 }),
              new TextRun({ text: 'Nomor Dokumen', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
            ],
          }),
        ],
      }),
    ],
  });

  const refDocs = (data.referencedDocuments && data.referencedDocuments.length > 0)
    ? data.referencedDocuments
    : [{ name: '-', number: '-' }];

  const refRows = refDocs.map((rd) =>
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 6374, type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_BOTTOM,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [new Paragraph({ children: [new TextRun({ text: rd.name || '-', size: 18, font: FONT_BODY })] })],
        }),
        new TableCell({
          width: { size: 2642, type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_BOTTOM,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [new Paragraph({ children: [new TextRun({ text: rd.number || '-', size: 18, font: FONT_BODY })] })],
        }),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      borders: TABLE_NO_BORDER,
      rows: [sopRefHeaderRow, ...refRows],
    })
  );
  children.push(createSpacer(80));

  // --------------------------------------------------------------------------
  // SECTION 6: Environmental, Health & Safety (EHS)
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 6 – Environmental, Health & Safety', 'Seksi 6 – Lingkungan, Kesehatan & Keselamatan Kerja', false));
  children.push(createSpacer(40));

  children.push(
    new Paragraph({
      spacing: { after: 20 },
      children: [
        new TextRun({ text: 'Requirements', size: 20, font: FONT_BODY }),
        new TextRun({ text: '', break: 1 }),
        new TextRun({ text: 'Persyaratan', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
      ],
    })
  );

  const ehs = data.ehsRequirements || {
    ppeEn: 'Wear Personal Protective Equipment (PPE) such as rubber gloves and footwear, protective eye wear, and protective helmet.',
    ppeId: 'Gunakan Alat Pelindung Diri (APD) seperti sarung tangan karet dan sepatu keselamatan, kacamata pelindung, serta helm pelindung.',
    jewelryEn: 'Remove rings and metal wrist watches, jewelry, or any metal objects kept in the clothes pocket.',
    jewelryId: 'Lepaskan cincin dan jam tangan logam, perhiasan, atau benda logam apa pun yang disimpan di dalam saku pakaian.',
    commsEn: 'Communication device such as handy-talkie (HT) is on hand.',
    commsId: 'Perangkat komunikasi seperti handy-talkie (HT) siap digunakan.',
    lotoEn: 'Lock-Out / Tag-Out devices and tools.',
    lotoId: 'Peralatan dan perlengkapan Lock-Out / Tag-Out.',
  };

  const ehsItems: [string, string][] = [
    [`1. ${ehs.ppeEn}`, `1. ${ensureBilingualTranslation(ehs.ppeEn, ehs.ppeId)}`],
    [`2. ${ehs.jewelryEn}`, `2. ${ensureBilingualTranslation(ehs.jewelryEn, ehs.jewelryId)}`],
    [`3. ${ehs.commsEn}`, `3. ${ensureBilingualTranslation(ehs.commsEn, ehs.commsId)}`],
    [`4. ${ehs.lotoEn}`, `4. ${ensureBilingualTranslation(ehs.lotoEn, ehs.lotoId)}`],
  ];

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: ehsItems.map(
        ([en, id]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
                borders: CELL_BORDER_DIVIDER_BOTTOM,
                margins: { top: 40, bottom: 40, left: 60, right: 60 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: en, size: 18, color: COLOR_BLACK, font: FONT_BODY }),
                      new TextRun({ text: '', break: 1 }),
                      new TextRun({ text: id, italics: true, size: 18, color: COLOR_GREY_ID, font: FONT_BODY }),
                    ],
                  }),
                ],
              }),
            ],
          })
      ),
    })
  );
  children.push(createSpacer(60));

  // --------------------------------------------------------------------------
  // SECTION 7: Prerequisites
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 7 – Prerequisites', 'Seksi 7 – Prasyarat', false));
  children.push(createSpacer(40));

  const prereqHeaderRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: 6091, type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [
          new Paragraph({
            spacing: { after: 0, line: 240 },
            children: [
              new TextRun({ text: 'Requirements', bold: true, underline: {}, size: 20, font: FONT_BODY }),
              new TextRun({ text: '', break: 1 }),
              new TextRun({ text: 'Persyaratan', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 1842, type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [
          new Paragraph({
            spacing: { after: 0, line: 240 },
            children: [
              new TextRun({ text: 'Time', bold: true, underline: {}, size: 20, font: FONT_BODY }),
              new TextRun({ text: '', break: 1 }),
              new TextRun({ text: 'Waktu', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 1083, type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [
          new Paragraph({
            spacing: { after: 0, line: 240 },
            children: [
              new TextRun({ text: 'Intial', bold: true, underline: {}, size: 20, font: FONT_BODY }),
              new TextRun({ text: '', break: 1 }),
              new TextRun({ text: 'Inisial', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
            ],
          }),
        ],
      }),
    ],
  });

  const prereqs = (data.prerequisites && data.prerequisites.length > 0)
    ? data.prerequisites
    : [
        { requirementEn: '1. Check PTW is approved.', requirementId: '1. Periksa bahwa PTW telah disetujui.', time: '', initial: '' },
        { requirementEn: '2. Note down vendor arrival Date / Time :', requirementId: '2. Catat Tanggal / Waktu kedatangan vendor :', time: '', initial: '' },
        { requirementEn: '3. Check all tools and materials are available and in good condition.', requirementId: '3. Periksa semua peralatan dan material telah tersedia dan dalam kondisi baik.', time: '', initial: '' },
        { requirementEn: '4. Ensure necessary reference documents is attached to this SOP.', requirementId: '4. Pastikan dokumen referensi yang diperlukan telah dilampirkan pada SOP ini.', time: '', initial: '' },
        { requirementEn: '5. Ensure personnel involving in this work are trained and competent to perform this procedure.', requirementId: '5. Pastikan personel yang terlibat dalam pekerjaan ini telah terlatih dan kompeten untuk melaksanakan prosedur ini.', time: '', initial: '' },
      ];

  const prereqRows = prereqs.map((pr) => {
    const requirementEn = pr.requirementEn || '-';
    const requirementId = ensureBilingualTranslation(requirementEn, pr.requirementId);

    return new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 6091, type: WidthType.DXA },
          borders: CELL_BORDERS_BOX,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: requirementEn, size: 18, color: COLOR_BLACK, font: FONT_BODY }),
                new TextRun({ text: '', break: 1 }),
                new TextRun({ text: requirementId, italics: true, size: 18, color: COLOR_GREY_ID, font: FONT_BODY }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1842, type: WidthType.DXA },
          borders: CELL_BORDERS_BOX,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [new Paragraph({ children: [new TextRun({ text: pr.time || '', size: 18, font: FONT_BODY })] })],
        }),
        new TableCell({
          width: { size: 1083, type: WidthType.DXA },
          borders: CELL_BORDERS_BOX,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [new Paragraph({ children: [new TextRun({ text: pr.initial || '', size: 18, font: FONT_BODY })] })],
        }),
      ],
    });
  });

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      borders: TABLE_NO_BORDER,
      rows: [prereqHeaderRow, ...prereqRows],
    })
  );
  children.push(createSpacer(60));

  // --------------------------------------------------------------------------
  // SECTION 8: Dry Run
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 8 – Dry Run', 'Seksi 8 – Uji Coba (Dry Run)', false));
  children.push(createSpacer(40));

  children.push(
    new Paragraph({
      spacing: { after: 30 },
      children: [
        new TextRun({ text: 'Completed by:', size: 20, font: FONT_BODY, bold: true, underline: {} }),
        new TextRun({ text: '', break: 1 }),
        new TextRun({ text: 'Diselesaikan oleh:', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
      ],
    })
  );

  const dryRun = data.dryRun;
  const hasDryRunValues = !!(dryRun && ((dryRun.name && dryRun.name !== '-' && dryRun.name.trim() !== '') || (dryRun.date && dryRun.date !== '-' && dryRun.date.trim() !== '')));

  const dryRunRows: TableRow[] = [
    new TableRow({
      cantSplit: true,
      children: [
        ['Job Title:', 'Jabatan:'],
        ['Name:', 'Nama:'],
        ['Signature:', 'Tanda Tangan:'],
        ['Date:', 'Tanggal:'],
      ].map(([en, id]) =>
        new TableCell({
          width: { size: 2254, type: WidthType.DXA },
          borders: CELL_NO_BORDER,
          margins: { top: 30, bottom: 30, left: 60, right: 60 },
          children: [
            new Paragraph({
              spacing: { after: 0, line: 240 },
              children: [
                new TextRun({ text: en, size: 20, font: FONT_BODY }),
                new TextRun({ text: '', break: 1 }),
                new TextRun({ text: id, italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
              ],
            }),
          ],
        })
      ),
    }),
  ];

  if (hasDryRunValues && dryRun) {
    dryRunRows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 2254, type: WidthType.DXA },
            borders: CELL_NO_BORDER,
            margins: { top: 30, bottom: 30, left: 60, right: 60 },
            children: [new Paragraph({ children: [new TextRun({ text: (dryRun.jobTitle && dryRun.jobTitle !== '-') ? dryRun.jobTitle : '', size: 18, font: FONT_BODY })] })],
          }),
          new TableCell({
            width: { size: 2254, type: WidthType.DXA },
            borders: CELL_NO_BORDER,
            margins: { top: 30, bottom: 30, left: 60, right: 60 },
            children: [new Paragraph({ children: [new TextRun({ text: (dryRun.name && dryRun.name !== '-') ? dryRun.name : '', size: 18, font: FONT_BODY })] })],
          }),
          new TableCell({
            width: { size: 2254, type: WidthType.DXA },
            borders: CELL_NO_BORDER,
            margins: { top: 30, bottom: 30, left: 60, right: 60 },
            children: [new Paragraph({ children: [new TextRun({ text: '             ', size: 18, font: FONT_BODY })] })],
          }),
          new TableCell({
            width: { size: 2254, type: WidthType.DXA },
            borders: CELL_NO_BORDER,
            margins: { top: 30, bottom: 30, left: 60, right: 60 },
            children: [new Paragraph({ children: [new TextRun({ text: (dryRun.date && dryRun.date !== '-') ? dryRun.date : '', size: 18, font: FONT_BODY })] })],
          }),
        ],
      })
    );
  }

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      borders: TABLE_NO_BORDER,
      rows: dryRunRows,
    })
  );
  children.push(createSpacer(60));

  // --------------------------------------------------------------------------
  // SECTION 9: Maintenance Periode
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 9 – Maintenance Periode', 'Seksi 9 – Periode Pemeliharaan', false));
  children.push(createSpacer(40));

  const is6Months = data.maintenancePeriod === '6_months';
  const isAnnual = data.maintenancePeriod === 'annual';

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      borders: TABLE_NO_BORDER,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 4508, type: WidthType.DXA },
              borders: CELL_NO_BORDER,
              margins: { top: 40, bottom: 40, left: 100, right: 80 },
              children: [
                new Paragraph({
                  spacing: { after: 0, line: 240 },
                  children: [
                    new TextRun({ text: `${isAnnual ? '☐ ' : '■ '} 6 Months`, size: 20, color: COLOR_BLACK, font: FONT_BODY }),
                    new TextRun({ text: '', break: 1 }),
                    new TextRun({ text: '    6 Bulan', italics: true, size: 18, color: COLOR_GREY_ID, font: FONT_BODY }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4508, type: WidthType.DXA },
              borders: CELL_NO_BORDER,
              margins: { top: 40, bottom: 40, left: 100, right: 80 },
              children: [
                new Paragraph({
                  spacing: { after: 0, line: 240 },
                  children: [
                    new TextRun({ text: `${is6Months ? '☐ ' : '■ '} Annual`, size: 20, color: COLOR_BLACK, font: FONT_BODY }),
                    new TextRun({ text: '', break: 1 }),
                    new TextRun({ text: '    Tahunan', italics: true, size: 18, color: COLOR_GREY_ID, font: FONT_BODY }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(60));

  // --------------------------------------------------------------------------
  // SECTION 10: Work Instruction / Procedures (Starts on a new page matching Master SOP)
  // --------------------------------------------------------------------------
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(createSectionBanner('Section 10 – Work Instruction / Procedures', 'Seksi 10 – Instruksi / Prosedur Kerja', false));
  children.push(createSpacer(40));

  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'Conditions / Equipment status prior to SOP Execution:',
          size: 18,
          color: COLOR_BLACK,
          font: FONT_BODY,
        }),
        new TextRun({ text: '', break: 1 }),
        new TextRun({
          text: 'Kondisi / Status peralatan sebelum Pelaksanaan SOP:',
          italics: true,
          size: 18,
          color: COLOR_GREY_ID,
          font: FONT_BODY,
        }),
      ],
    })
  );

  if (data.conditionsPriorToExecutionEn || data.conditionsPriorToExecutionId) {
    children.push(createBilingualContentParagraph(
      data.conditionsPriorToExecutionEn || '-',
      data.conditionsPriorToExecutionId
    ));
  }

  // Exact 4-column widths from master: [4248, 1843, 1842, 1083] = 9016
  const sopStepColWidths = [4248, 1843, 1842, 1083];

  const sopStepHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: sopStepColWidths[0], type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [new Paragraph({ children: createBilingualRuns('Action', 'Tindakan', { underlineEn: true, isHeader: true }) })],
      }),
      new TableCell({
        width: { size: sopStepColWidths[1], type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [new Paragraph({ children: createBilingualRuns('Expected Outcome', 'Hasil yang Diharapkan', { underlineEn: true, isHeader: true }) })],
      }),
      new TableCell({
        width: { size: sopStepColWidths[2], type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [new Paragraph({ children: createBilingualRuns('Time', 'Waktu', { underlineEn: true, isHeader: true }) })],
      }),
      new TableCell({
        width: { size: sopStepColWidths[3], type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [new Paragraph({ children: createBilingualRuns('Initial', 'Inisial', { underlineEn: true, isHeader: true }) })],
      }),
    ],
  });

  const sopStepRows = (data.workSteps || []).map((st, i) => {
    const stepNo = st.no || i + 1;
    const cleanActionEn = (st.actionEn || '-').replace(/^\s*\d+[\.\)]\s*/, '').trim() || '-';
    const rawActionId = ensureBilingualTranslation(cleanActionEn, st.actionId);
    const cleanActionId = rawActionId.replace(/^\s*\d+[\.\)]\s*/, '').trim() || ensureBilingualTranslation(cleanActionEn);
    const cleanOutcomeEn = (st.expectedOutcomeEn || '-').replace(/^\s*\d+[\.\)]\s*/, '').trim() || '-';
    const rawOutcomeId = ensureBilingualTranslation(cleanOutcomeEn, st.expectedOutcomeId);
    const cleanOutcomeId = rawOutcomeId.replace(/^\s*\d+[\.\)]\s*/, '').trim() || ensureBilingualTranslation(cleanOutcomeEn);

    return new TableRow({
      children: [
        new TableCell({
          width: { size: sopStepColWidths[0], type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_TOP,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${stepNo}. `, size: 18, color: COLOR_BLACK, font: FONT_BODY }),
                new TextRun({ text: cleanActionEn, size: 18, color: COLOR_BLACK, font: FONT_BODY }),
                new TextRun({ text: '', break: 1 }),
                new TextRun({ text: `${stepNo}. `, italics: true, size: 18, color: COLOR_GREY_ID, font: FONT_BODY }),
                new TextRun({ text: cleanActionId, italics: true, size: 18, color: COLOR_GREY_ID, font: FONT_BODY }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: sopStepColWidths[1], type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_TOP,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: cleanOutcomeEn, size: 18, color: COLOR_BLACK, font: FONT_BODY }),
                new TextRun({ text: '', break: 1 }),
                new TextRun({ text: cleanOutcomeId, italics: true, size: 18, color: COLOR_GREY_ID, font: FONT_BODY }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: sopStepColWidths[2], type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_TOP,
          margins: { top: 40, bottom: 40, left: 40, right: 40 },
          children: [new Paragraph({ children: [new TextRun({ text: st.time || '', size: 18, font: FONT_BODY })] })],
        }),
        new TableCell({
          width: { size: sopStepColWidths[3], type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_TOP,
          margins: { top: 40, bottom: 40, left: 40, right: 40 },
          children: [new Paragraph({ children: [new TextRun({ text: st.initial || '', size: 18, font: FONT_BODY })] })],
        }),
      ],
    });
  });

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: [sopStepHeaderRow, ...sopStepRows],
    })
  );
  children.push(createSpacer(80));

  // --------------------------------------------------------------------------
  // SECTION 11: Back Out Procedures
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 11 – Back Out Procedures', 'Seksi 11 – Prosedur Pemulihan (Back Out)', false));
  children.push(createSpacer(40));

  children.push(
    new Paragraph({
      spacing: { after: 20 },
      children: [
        new TextRun({ text: 'Action', size: 20, font: FONT_BODY }),
        new TextRun({ text: '', break: 1 }),
        new TextRun({ text: 'Tindakan', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
              borders: CELL_BORDER_DIVIDER_BOTTOM,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [createBilingualContentParagraph(
                data.backOutProcedureEn || data.backOutProcedure || 'N/A',
                data.backOutProcedureId
              )],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(80));

  // --------------------------------------------------------------------------
  // SECTION 12: Document Information
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 12 – Document Information', 'Seksi 12 – Informasi Dokumen', false));
  children.push(createSpacer(40));

  // Section 12 uses a clean borderless 4-column table layout matching master document
  const docInfoColWidths = [1800, 2708, 2200, 2308]; // 4 columns: label, value, label, value = 9016
  const docInfoBorders = {
    top: BORDER_NONE,
    bottom: BORDER_NONE,
    left: BORDER_NONE,
    right: BORDER_NONE,
  };

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: [
        // Row 1: Author | : value | Date of Creation | : value
        new TableRow({
          children: [
            new TableCell({
              width: { size: docInfoColWidths[0], type: WidthType.DXA },
              borders: docInfoBorders,
              margins: { top: 40, bottom: 40, left: 60, right: 0 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: 'Author', size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: 'Penulis', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
            new TableCell({
              width: { size: docInfoColWidths[1], type: WidthType.DXA },
              borders: docInfoBorders,
              margins: { top: 40, bottom: 40, left: 0, right: 60 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: `: ${data.author || 'Alif Darmawan'}`, size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: `: ${data.author || 'Alif Darmawan'}`, italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
            new TableCell({
              width: { size: docInfoColWidths[2], type: WidthType.DXA },
              borders: docInfoBorders,
              margins: { top: 40, bottom: 40, left: 60, right: 0 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: 'Date of Creation', size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: 'Tanggal Pembuatan', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
            new TableCell({
              width: { size: docInfoColWidths[3], type: WidthType.DXA },
              borders: docInfoBorders,
              margins: { top: 40, bottom: 40, left: 0, right: 60 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: `: ${data.dateOfCreation || '07 Sep 2026'}`, size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: `: ${data.dateOfCreation || '07 Sep 2026'}`, italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
          ],
        }),
        // Row 2: Date Revision | : value | Revision Number | : value
        new TableRow({
          children: [
            new TableCell({
              width: { size: docInfoColWidths[0], type: WidthType.DXA },
              borders: docInfoBorders,
              margins: { top: 40, bottom: 40, left: 60, right: 0 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: 'Date Revision', size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: 'Tanggal Revisi', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
            new TableCell({
              width: { size: docInfoColWidths[1], type: WidthType.DXA },
              borders: docInfoBorders,
              margins: { top: 40, bottom: 40, left: 0, right: 60 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: `: ${data.dateRevision || 'N/A'}`, size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: `: ${data.dateRevision || 'T/A'}`, italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
            new TableCell({
              width: { size: docInfoColWidths[2], type: WidthType.DXA },
              borders: docInfoBorders,
              margins: { top: 40, bottom: 40, left: 60, right: 0 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: 'Revision Number', size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: 'Nomor Revisi', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
            new TableCell({
              width: { size: docInfoColWidths[3], type: WidthType.DXA },
              borders: docInfoBorders,
              margins: { top: 40, bottom: 40, left: 0, right: 60 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: `: ${data.revisionNumber || '-'}`, size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: `: ${data.revisionNumber || '-'}`, italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(60));

  // --------------------------------------------------------------------------
  // SECTION 13: Approval (Starts on a new page matching Master SOP)
  // --------------------------------------------------------------------------
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(createSectionBanner('Section 13 – Approval', 'Seksi 13 – Persetujuan', false));
  children.push(createSpacer(40));

  const defaultApprovals = [
    { roleEn: 'Project Manager', roleId: 'Manajer Proyek', name: 'Dwi Tasmiyadi' },
    { roleEn: 'Chief Engineering', roleId: 'Kepala Engineering', name: 'Habib Mulyana' },
    { roleEn: 'Facility Manager', roleId: 'Manajer Fasilitas', name: 'Supriyatno' },
    { roleEn: 'Assistant Manager HDC', roleId: 'Asisten Manajer HDC', name: 'Budi Susanto' },
  ];

  const approvalList = (data.approvals && data.approvals.length > 0) ? data.approvals : defaultApprovals;

  const sopColWidths = [2700, 2700, 2000, 1616];

  const sopApprovalHeaderRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      { en: 'Job Title', id: 'Jabatan' },
      { en: 'Name', id: 'Nama' },
      { en: 'Signature', id: 'Tanda Tangan' },
      { en: 'Date', id: 'Tanggal' },
    ].map((col, idx) =>
      new TableCell({
        width: { size: sopColWidths[idx], type: WidthType.DXA },
        borders: {
          top: BORDER_NONE,
          bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
          left: BORDER_NONE,
          right: BORDER_NONE,
        },
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: col.en, bold: true, underline: {}, size: 20, font: FONT_BODY }),
              new TextRun({ text: '', break: 1 }),
              new TextRun({ text: col.id, italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
            ],
          }),
        ],
      })
    ),
  });

  const sopApprovalDataRows = approvalList.map((app) =>
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: sopColWidths[0], type: WidthType.DXA },
          borders: {
            top: BORDER_NONE,
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            right: BORDER_NONE,
          },
          margins: { top: 50, bottom: 50, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: app.roleEn || '', size: 19, font: FONT_BODY }),
                new TextRun({ text: '', break: 1 }),
                new TextRun({ text: app.roleId || '', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: sopColWidths[1], type: WidthType.DXA },
          borders: {
            top: BORDER_NONE,
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            left: BORDER_NONE,
            right: BORDER_NONE,
          },
          margins: { top: 50, bottom: 50, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: app.name || '', size: 19, font: FONT_BODY }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: sopColWidths[2], type: WidthType.DXA },
          borders: {
            top: BORDER_NONE,
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            left: BORDER_NONE,
            right: BORDER_NONE,
          },
          margins: { top: 50, bottom: 50, left: 60, right: 60 },
          children: [new Paragraph({ children: [] })],
        }),
        new TableCell({
          width: { size: sopColWidths[3], type: WidthType.DXA },
          borders: {
            top: BORDER_NONE,
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            left: BORDER_NONE,
            right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
          },
          margins: { top: 50, bottom: 50, left: 60, right: 60 },
          children: [new Paragraph({ children: [] })],
        }),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: [sopApprovalHeaderRow, ...sopApprovalDataRows],
    })
  );
  children.push(createSpacer(80));

  // --------------------------------------------------------------------------
  // SECTION 14: Additional Information
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 14 – Additional Information', 'Seksi 14 – Informasi Tambahan', false));
  children.push(createSpacer(40));

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
              borders: CELL_BORDERS_BOX,
              margins: { top: 100, bottom: 100, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: createBilingualRuns(
                    data.additionalInformationEn || data.additionalInformation || '-',
                    data.additionalInformationId,
                    { sizeEn: 18, sizeId: 18 }
                  ),
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // --------------------------------------------------------------------------
  // BUILD DOCUMENT (A4 Portrait, exact margins)
  // --------------------------------------------------------------------------
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_BODY,
          },
        },
        heading1: {
          run: {
            font: FONT_HEADING,
          },
        },
        heading2: {
          run: {
            font: FONT_HEADING,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
              header: 708,
              footer: 708,
            },
          },
        },
        headers: {
          default: createDocumentHeader(
            'STANDARD OPERATING PROCEDURE  ',
            'NeutraDC – Cikarang',
            dmeBytes,
            ndcBytes,
            false
          ),
        },
        footers: {
          default: createDocumentFooter(),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanTitle = (data.documentTitle || 'DME_SOP').replace(/[^a-zA-Z0-9_-]/g, '_');
  saveAs(blob, `${cleanTitle}.docx`);
}

// ============================================================================
// EXPORT EOP TO DOCX (100% Master Precision)
// ============================================================================
export async function exportEOPToDocx(data: EOPDocumentData): Promise<void> {
  const [dmeBytes, ndcBytes] = await Promise.all([
    loadImageAsUint8Array(logoDMEOriginal),
    loadImageAsUint8Array(logoNDCOriginal),
  ]);

  const children: (Paragraph | Table)[] = [];

  // --------------------------------------------------------------------------
  // SECTION 1: Document Overview
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 1 – Document Overview', 'Seksi 1 – Gambaran Umum Dokumen', true));
  children.push(createSpacer(40));

  children.push(
    createBilingualFieldParagraph(
      'Document Title',
      data.documentTitle,
      'Judul Dokumen',
      data.documentTitle
    )
  );

  children.push(
    createBilingualFieldParagraph(
      'Document Purpose',
      data.documentPurposeEn || '-',
      'Tujuan Dokumen',
      data.documentPurposeId || (data.documentPurposeEn ? ensureBilingualTranslation(data.documentPurposeEn) : '-')
    )
  );

  children.push(
    createBilingualFieldParagraph(
      'Work Location',
      data.workLocationEn || 'Neutra DC Cikarang',
      'Lokasi Kerja',
      data.workLocationId || 'Neutra DC Cikarang',
      80
    )
  );

  // --------------------------------------------------------------------------
  // SECTION 2: Referenced Document / Attachments
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 2 – Referenced Document / Attachments', 'Seksi 2 – Dokumen Referensi / Lampiran', true));
  children.push(createSpacer(40));

  // EOP master column widths: [6516, 2500] = 9016
  const eopRefDocHeaderRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: 6516, type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [
          new Paragraph({
            spacing: { after: 0, line: 240 },
            children: [
              new TextRun({ text: 'Document Name', size: 20, font: FONT_BODY }),
              new TextRun({ text: '', break: 1 }),
              new TextRun({ text: 'Nama Dokumen', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 2500, type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [
          new Paragraph({
            spacing: { after: 0, line: 240 },
            children: [
              new TextRun({ text: 'Document Number', size: 20, font: FONT_BODY }),
              new TextRun({ text: '', break: 1 }),
              new TextRun({ text: 'Nomor Dokumen', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
            ],
          }),
        ],
      }),
    ],
  });

  const refDocs = (data.referencedDocuments && data.referencedDocuments.length > 0)
    ? data.referencedDocuments
    : [{ name: '-', number: '-' }];

  const refDocRows = refDocs.map((docItem) =>
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 6516, type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_BOTTOM,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [new Paragraph({ children: [new TextRun({ text: docItem.name || '-', size: 18, font: FONT_BODY })] })],
        }),
        new TableCell({
          width: { size: 2500, type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_BOTTOM,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [new Paragraph({ children: [new TextRun({ text: docItem.number || '-', size: 18, font: FONT_BODY })] })],
        }),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      borders: TABLE_NO_BORDER,
      rows: [eopRefDocHeaderRow, ...refDocRows],
    })
  );
  children.push(createSpacer(80));

  // --------------------------------------------------------------------------
  // SECTION 3: Environmental, Health & Safety
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 3 – Environmental, Health & Safety', 'Seksi 3 – Lingkungan, Kesehatan & Keselamatan Kerja', true));
  children.push(createSpacer(40));

  children.push(
    new Paragraph({
      spacing: { after: 20 },
      children: [
        new TextRun({ text: 'Requirements', size: 20, font: FONT_BODY }),
        new TextRun({ text: '', break: 1 }),
        new TextRun({ text: 'Persyaratan', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
      ],
    })
  );

  const eopEhs = data.ehsRequirements || {
    ppeEn: 'Wear Personal Protective Equipment (PPE) such as rubber gloves and footwear, protective eye wear, and protective helmet.',
    ppeId: 'Gunakan Alat Pelindung Diri (APD) seperti sarung tangan karet dan sepatu bot, kacamata pelindung, dan helm pelindung.',
    commsEn: 'Communication device such as handy-talkie (HT) is on hand.',
    commsId: 'Perangkat komunikasi seperti handy-talkie (HT) tersedia / siap digunakan.',
  };

  const orderedEhsItems = eopEhs.items && eopEhs.items.length > 0
    ? eopEhs.items
    : [
        { textEn: eopEhs.ppeEn, textId: eopEhs.ppeId },
        { textEn: eopEhs.commsEn, textId: eopEhs.commsId },
        ...(eopEhs.additionalItems || []),
      ];
  const eopEhsItems: [string, string][] = orderedEhsItems.map((item, idx): [string, string] => [
    `${idx + 1}. ${item.textEn || item.textId}`,
    `${idx + 1}. ${ensureBilingualTranslation(item.textEn, item.textId)}`,
  ]);

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: eopEhsItems.map(
        ([en, id]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
                borders: CELL_BORDER_DIVIDER_BOTTOM,
                margins: { top: 40, bottom: 40, left: 60, right: 60 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: en, size: 18, color: COLOR_BLACK, font: FONT_BODY }),
                      new TextRun({ text: '', break: 1 }),
                      new TextRun({ text: id, italics: true, size: 18, color: COLOR_GREY_ID, font: FONT_BODY }),
                    ],
                  }),
                ],
              }),
            ],
          })
      ),
    })
  );
  children.push(createSpacer(80));

  // --------------------------------------------------------------------------
  // SECTION 4: Work Instruction / Procedure
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 4 – Work Instruction / Procedure', 'Seksi 4 – Instruksi / Prosedur Kerja', true));
  children.push(createSpacer(40));

  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'Expected Conditions / Equipment Status:',
          size: 18,
          color: COLOR_BLACK,
          font: FONT_BODY,
        }),
        new TextRun({ text: '', break: 1 }),
        new TextRun({
          text: 'Kondisi yang Diharapkan / Status Peralatan:',
          italics: true,
          size: 18,
          color: COLOR_GREY_ID,
          font: FONT_BODY,
        }),
      ],
    })
  );

  if (data.expectedConditionsEn || data.expectedConditionsId) {
    children.push(createBilingualContentParagraph(
      data.expectedConditionsEn || '-',
      data.expectedConditionsId
    ));
  }

  // Exact 5-column widths from master: [455, 4785, 2064, 855, 857] = 9016
  const eopStepColWidths = [455, 4785, 2064, 855, 857];

  const eopStepHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: eopStepColWidths[0], type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 20, right: 20 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'No', size: 20, font: FONT_BODY })] })],
      }),
      new TableCell({
        width: { size: eopStepColWidths[1], type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        children: [new Paragraph({ children: createBilingualRuns('Action', 'Tindakan', { isHeader: true }) })],
      }),
      new TableCell({
        width: { size: eopStepColWidths[2], type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        children: [new Paragraph({ children: createBilingualRuns('Expected Outcome', 'Hasil yang Diharapkan', { isHeader: true }) })],
      }),
      new TableCell({
        width: { size: eopStepColWidths[3], type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 20, right: 20 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: createBilingualRuns('Time', 'Waktu', { isHeader: true }) })],
      }),
      new TableCell({
        width: { size: eopStepColWidths[4], type: WidthType.DXA },
        borders: CELL_BORDER_DIVIDER_BOTTOM,
        margins: { top: 40, bottom: 40, left: 20, right: 20 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: createBilingualRuns('Name', 'Nama', { isHeader: true }) })],
      }),
    ],
  });

  const eopStepRows = (data.workSteps || []).map((st, i) => {
    const stepNo = st.no || i + 1;
    const cleanActionEn = (st.actionEn || '-').replace(/^\s*\d+[\.\)]\s*/, '').trim() || '-';
    const rawActionId = ensureBilingualTranslation(cleanActionEn, st.actionId);
    const cleanActionId = rawActionId.replace(/^\s*\d+[\.\)]\s*/, '').trim() || ensureBilingualTranslation(cleanActionEn);
    const cleanOutcomeEn = (st.expectedOutcomeEn || '-').replace(/^\s*\d+[\.\)]\s*/, '').trim() || '-';
    const rawOutcomeId = ensureBilingualTranslation(cleanOutcomeEn, st.expectedOutcomeId);
    const cleanOutcomeId = rawOutcomeId.replace(/^\s*\d+[\.\)]\s*/, '').trim() || ensureBilingualTranslation(cleanOutcomeEn);

    return new TableRow({
      children: [
        new TableCell({
          width: { size: eopStepColWidths[0], type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_TOP,
          margins: { top: 40, bottom: 40, left: 20, right: 20 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${stepNo}.`, size: 18, font: FONT_BODY })] })],
        }),
        new TableCell({
          width: { size: eopStepColWidths[1], type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_TOP,
          margins: { top: 40, bottom: 40, left: 40, right: 40 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: cleanActionEn, size: 18, color: COLOR_BLACK, font: FONT_BODY }),
                new TextRun({ text: '', break: 1 }),
                new TextRun({ text: cleanActionId, italics: true, size: 18, color: COLOR_GREY_ID, font: FONT_BODY }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: eopStepColWidths[2], type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_TOP,
          margins: { top: 40, bottom: 40, left: 40, right: 40 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: cleanOutcomeEn, size: 18, color: COLOR_BLACK, font: FONT_BODY }),
                new TextRun({ text: '', break: 1 }),
                new TextRun({ text: cleanOutcomeId, italics: true, size: 18, color: COLOR_GREY_ID, font: FONT_BODY }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: eopStepColWidths[3], type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_TOP,
          margins: { top: 40, bottom: 40, left: 20, right: 20 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: st.time || '', size: 18, font: FONT_BODY })] })],
        }),
        new TableCell({
          width: { size: eopStepColWidths[4], type: WidthType.DXA },
          borders: CELL_BORDER_DIVIDER_TOP,
          margins: { top: 40, bottom: 40, left: 20, right: 20 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: st.name || '', size: 18, font: FONT_BODY })] })],
        }),
      ],
    });
  });

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: [eopStepHeaderRow, ...eopStepRows],
    })
  );
  children.push(createSpacer(80));

  // --------------------------------------------------------------------------
  // SECTION 5: Document Information
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 5 – Document Information', 'Seksi 5 – Informasi Dokumen', true));
  children.push(createSpacer(40));

  // EOP Section 5 uses a clean borderless 4-column table layout matching master document
  const eopDocInfoColWidths = [2200, 2308, 2200, 2308]; // 4 columns = 9016
  const eopDocInfoBorders = {
    top: BORDER_NONE,
    bottom: BORDER_NONE,
    left: BORDER_NONE,
    right: BORDER_NONE,
  };

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: [
        // Row 1: Author | : value | Date of Creation | : value
        new TableRow({
          children: [
            new TableCell({
              width: { size: eopDocInfoColWidths[0], type: WidthType.DXA },
              borders: eopDocInfoBorders,
              margins: { top: 40, bottom: 40, left: 60, right: 0 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: 'Author', size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: 'Penulis', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
            new TableCell({
              width: { size: eopDocInfoColWidths[1], type: WidthType.DXA },
              borders: eopDocInfoBorders,
              margins: { top: 40, bottom: 40, left: 0, right: 60 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: `: ${data.author || 'Alif Darmawan'}`, size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: `: ${data.author || 'Alif Darmawan'}`, italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
            new TableCell({
              width: { size: eopDocInfoColWidths[2], type: WidthType.DXA },
              borders: eopDocInfoBorders,
              margins: { top: 40, bottom: 40, left: 60, right: 0 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: 'Date of Creation', size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: 'Tanggal Pembuatan', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
            new TableCell({
              width: { size: eopDocInfoColWidths[3], type: WidthType.DXA },
              borders: eopDocInfoBorders,
              margins: { top: 40, bottom: 40, left: 0, right: 60 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: `: ${data.dateOfCreation || '07 Sep 2026'}`, size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: `: ${data.dateOfCreation || '07 Sep 2026'}`, italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
          ],
        }),
        // Row 2: Next Date Revision | : value | Revision Number | : value
        new TableRow({
          children: [
            new TableCell({
              width: { size: eopDocInfoColWidths[0], type: WidthType.DXA },
              borders: eopDocInfoBorders,
              margins: { top: 40, bottom: 40, left: 60, right: 0 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: 'Next Date Revision', size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: 'Tanggal Revisi Berikutnya', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
            new TableCell({
              width: { size: eopDocInfoColWidths[1], type: WidthType.DXA },
              borders: eopDocInfoBorders,
              margins: { top: 40, bottom: 40, left: 0, right: 60 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: `: ${data.nextDateRevision || 'N/A'}`, size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: `: ${data.nextDateRevision === 'N/A' || !data.nextDateRevision ? 'T/A' : data.nextDateRevision}`, italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
            new TableCell({
              width: { size: eopDocInfoColWidths[2], type: WidthType.DXA },
              borders: eopDocInfoBorders,
              margins: { top: 40, bottom: 40, left: 60, right: 0 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: 'Revision Number', size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: 'Nomor Revisi', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
            new TableCell({
              width: { size: eopDocInfoColWidths[3], type: WidthType.DXA },
              borders: eopDocInfoBorders,
              margins: { top: 40, bottom: 40, left: 0, right: 60 },
              children: [new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [
                  new TextRun({ text: `: ${data.revisionNumber || '00'}`, size: 20, font: FONT_BODY }),
                  new TextRun({ text: '', break: 1 }),
                  new TextRun({ text: `: ${data.revisionNumber || '00'}`, italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
                ],
              })],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(60));

  // --------------------------------------------------------------------------
  // SECTION 6: Dry Run
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 6 – Dry Run', 'Seksi 6 – Uji Coba (Dry Run)', true));
  children.push(createSpacer(40));

  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: 'Completed by:', size: 20, font: FONT_BODY, bold: true, underline: {} }),
        new TextRun({ text: '', break: 1 }),
        new TextRun({ text: 'Diselesaikan oleh:', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
      ],
    })
  );

  const eopDryRun = data.dryRun;
  const hasDryRunValues = !!(eopDryRun && ((eopDryRun.name && eopDryRun.name !== '-' && eopDryRun.name.trim() !== '') || (eopDryRun.date && eopDryRun.date !== '-' && eopDryRun.date.trim() !== '')));

  const eopDryRunRows: TableRow[] = [
    new TableRow({
      children: [
        ['Job Title:', 'Jabatan:'],
        ['Name:', 'Nama:'],
        ['Signature:', 'Tanda Tangan:'],
        ['Date:', 'Tanggal:'],
      ].map(([en, id]) =>
        new TableCell({
          width: { size: 2254, type: WidthType.DXA },
          borders: CELL_NO_BORDER,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: en, size: 20, font: FONT_BODY }),
                new TextRun({ text: '', break: 1 }),
                new TextRun({ text: id, italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
              ],
            }),
          ],
        })
      ),
    }),
  ];

  if (hasDryRunValues && eopDryRun) {
    eopDryRunRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2254, type: WidthType.DXA },
            borders: CELL_NO_BORDER,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [new Paragraph({ children: [new TextRun({ text: (eopDryRun.jobTitle && eopDryRun.jobTitle !== '-') ? eopDryRun.jobTitle : '', size: 18, font: FONT_BODY })] })],
          }),
          new TableCell({
            width: { size: 2254, type: WidthType.DXA },
            borders: CELL_NO_BORDER,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [new Paragraph({ children: [new TextRun({ text: (eopDryRun.name && eopDryRun.name !== '-') ? eopDryRun.name : '', size: 18, font: FONT_BODY })] })],
          }),
          new TableCell({
            width: { size: 2254, type: WidthType.DXA },
            borders: CELL_NO_BORDER,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [new Paragraph({ children: [new TextRun({ text: '             ', size: 18, font: FONT_BODY })] })],
          }),
          new TableCell({
            width: { size: 2254, type: WidthType.DXA },
            borders: CELL_NO_BORDER,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [new Paragraph({ children: [new TextRun({ text: (eopDryRun.date && eopDryRun.date !== '-') ? eopDryRun.date : '', size: 18, font: FONT_BODY })] })],
          }),
        ],
      })
    );
  }

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      borders: TABLE_NO_BORDER,
      rows: eopDryRunRows,
    })
  );
  children.push(createSpacer(80));

  // --------------------------------------------------------------------------
  // SECTION 7: Approval
  // --------------------------------------------------------------------------
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(createSectionBanner('Section 7 – Approval', 'Seksi 7 – Persetujuan', true));
  children.push(createSpacer(40));

  const eopDefaultApprovals = [
    { roleEn: 'Project Manager', roleId: 'Manajer Proyek', name: 'Dwi Tasmiyadi' },
    { roleEn: 'Chief Engineering', roleId: 'Kepala Engineering', name: 'Habib Mulyana' },
    { roleEn: 'Facility Manager', roleId: 'Manajer Fasilitas', name: 'Supriyatno' },
    { roleEn: 'Assistant Manager HDC', roleId: 'Asisten Manajer HDC', name: 'Budi Susanto' },
  ];

  const eopApprovalList = (data.approvals && data.approvals.length > 0) ? data.approvals : eopDefaultApprovals;

  const eopColWidths = [2700, 2700, 2000, 1616];

  const eopApprovalHeaderRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      { en: 'Job Title', id: 'Jabatan' },
      { en: 'Name', id: 'Nama' },
      { en: 'Signature', id: 'Tanda Tangan' },
      { en: 'Date', id: 'Tanggal' },
    ].map((col, idx) =>
      new TableCell({
        width: { size: eopColWidths[idx], type: WidthType.DXA },
        borders: {
          top: BORDER_NONE,
          bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
          left: BORDER_NONE,
          right: BORDER_NONE,
        },
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: col.en, bold: true, underline: {}, size: 20, font: FONT_BODY }),
              new TextRun({ text: '', break: 1 }),
              new TextRun({ text: col.id, italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
            ],
          }),
        ],
      })
    ),
  });

  const eopApprovalDataRows = eopApprovalList.map((app) =>
    new TableRow({
      cantSplit: true,
      children: [
        // Col 1: Job Title
        new TableCell({
          width: { size: eopColWidths[0], type: WidthType.DXA },
          borders: {
            top: BORDER_NONE,
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            right: BORDER_NONE,
          },
          margins: { top: 50, bottom: 50, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: app.roleEn || '', size: 19, font: FONT_BODY }),
                new TextRun({ text: '', break: 1 }),
                new TextRun({ text: app.roleId || '', italics: true, color: COLOR_GREY_ID, size: 18, font: FONT_BODY }),
              ],
            }),
          ],
        }),
        // Col 2: Name (NOT repeated!)
        new TableCell({
          width: { size: eopColWidths[1], type: WidthType.DXA },
          borders: {
            top: BORDER_NONE,
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            left: BORDER_NONE,
            right: BORDER_NONE,
          },
          margins: { top: 50, bottom: 50, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: app.name || '', size: 19, font: FONT_BODY }),
              ],
            }),
          ],
        }),
        // Col 3: Signature
        new TableCell({
          width: { size: eopColWidths[2], type: WidthType.DXA },
          borders: {
            top: BORDER_NONE,
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            left: BORDER_NONE,
            right: BORDER_NONE,
          },
          margins: { top: 50, bottom: 50, left: 60, right: 60 },
          children: [new Paragraph({ children: [] })],
        }),
        // Col 4: Date
        new TableCell({
          width: { size: eopColWidths[3], type: WidthType.DXA },
          borders: {
            top: BORDER_NONE,
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            left: BORDER_NONE,
            right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
          },
          margins: { top: 50, bottom: 50, left: 60, right: 60 },
          children: [new Paragraph({ children: [] })],
        }),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: [eopApprovalHeaderRow, ...eopApprovalDataRows],
    })
  );
  children.push(createSpacer(80));

  // --------------------------------------------------------------------------
  // SECTION 8: Additional Information
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 8 – Additional Information', 'Seksi 8 – Informasi Tambahan', true));
  children.push(createSpacer(40));

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
              borders: CELL_BORDERS_BOX,
              margins: { top: 100, bottom: 100, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: createBilingualRuns(
                    data.additionalInformationEn || data.additionalInformation || '-',
                    data.additionalInformationId,
                    { sizeEn: 18, sizeId: 18 }
                  ),
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // --------------------------------------------------------------------------
  // BUILD DOCUMENT (A4 Portrait, EOP exact margins)
  // --------------------------------------------------------------------------
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_BODY,
          },
        },
        heading1: {
          run: {
            font: FONT_HEADING,
          },
        },
        heading2: {
          run: {
            font: FONT_HEADING,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: {
              top: 1701, // Master EOP top margin
              right: 1440,
              bottom: 1440,
              left: 1440,
              header: 709,
              footer: 709,
            },
          },
        },
        headers: {
          default: createDocumentHeader(
            'EMERGENCY OPERATING PROCEDURE',
            'NeutraDC – Cikarang',
            dmeBytes,
            ndcBytes,
            true
          ),
        },
        footers: {
          default: createDocumentFooter(),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanTitle = (data.documentTitle || 'DME_EOP').replace(/[^a-zA-Z0-9_-]/g, '_');
  saveAs(blob, `${cleanTitle}.docx`);
}
