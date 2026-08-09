// ============================================================================
// FILE: docxReportExport.ts
// Deskripsi: Utility Ekspor Laporan Resmi ke format Microsoft Word (.docx).
//            Menggunakan library `docx` untuk menyusun dokumen surat resmi:
//            - Laporan Pemeliharaan Corrective Maintenance (3-Halaman Standar UTT)
//            - Laporan PIR (Post Incident Report) Data Center NeutraDC
//            Dilengkapi header logo ganda (Dwimitra & NeutraDC), tabel informasi teknis,
//            tanda tangan elektronik insinyur terverifikasi, dan galeri foto.
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
} from 'docx';
import { saveAs } from 'file-saver';
import { CMReportData } from '@/types/correctiveReportTypes';
import { PREPARED_BY_SIGNATURES } from '@/utils/engineerSignatures';
import { PIRReportData } from '@/types/pirReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';

/** Helper to convert base64 or URL to Uint8Array for docx ImageRun */
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

async function getImageWithDimensions(
  src: string,
  maxWidth = 230,
  maxHeight = 260
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (!src) return { bytes: new Uint8Array(), width: 0, height: 0 };

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const origW = img.naturalWidth || img.width || 300;
      const origH = img.naturalHeight || img.height || 200;

      const scale = Math.min(maxWidth / origW, maxHeight / origH);
      const width = Math.max(1, Math.round(origW * scale));
      const height = Math.max(1, Math.round(origH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = origW;
      canvas.height = origH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, origW, origH);
        ctx.drawImage(img, 0, 0);
      }
      const dataUrl = canvas.toDataURL('image/png');
      const bytes = base64ToUint8Array(dataUrl);

      resolve({ bytes, width, height });
    };
    img.onerror = () => {
      resolve({ bytes: new Uint8Array(), width: 0, height: 0 });
    };
    img.src = src;
  });
}

// Color Tokens matching report branding
const HEADER_FILL = 'DCE6F1'; // Light blue cell header
const BORDER_COLOR = 'A6A6A6';

const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
};

function createSectionHeader(title: string, pageBreak = false): Paragraph {
  return new Paragraph({
    pageBreakBefore: pageBreak,
    alignment: AlignmentType.LEFT,
    spacing: { before: 180, after: 120 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 20, // 10pt
        color: '1E293B',
        font: 'Century Gothic',
      }),
    ],
  });
}

function createHeaderLogosTable(logoLeftBytes: Uint8Array, logoRightBytes: Uint8Array): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: logoLeftBytes.length > 0
                  ? [new ImageRun({ data: logoLeftBytes, transformation: { width: 85, height: 45 }, type: 'png' })]
                  : [],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: logoRightBytes.length > 0
                  ? [new ImageRun({ data: logoRightBytes, transformation: { width: 110, height: 35 }, type: 'png' })]
                  : [],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function cleanBulletLines(content: string): string[] {
  if (!content) return ['N/A'];
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return ['N/A'];
  return lines.map((l) => {
    const clean = l
      .replace(/^[\s\-–—−⁃•*\u26AB\u2022\u25AA\u25BA\u25B6\u2043\u25CF\u25C6\u2013\u2014\u2212]+\s*/, '')
      .replace(/^\d+[\.\)\-]\s*/, '')
      .trim();
    return clean || l;
  });
}

function createBulletParagraphs(content: string, fontSize = 18): Paragraph[] {
  const cleanItems = cleanBulletLines(content);
  return cleanItems.map(
    (text) =>
      new Paragraph({
        indent: { left: 320, hanging: 240 },
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: '•\t',
            bold: true,
            size: fontSize,
            color: '1E293B',
            font: 'Century Gothic',
          }),
          new TextRun({
            text: text,
            size: fontSize,
            color: '1E293B',
            font: 'Century Gothic',
          }),
        ],
      })
  );
}

function createBoxSection(title: string, content: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 150, right: 150 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: title,
                    bold: true,
                    size: 18,
                    color: '000000',
                    font: 'Century Gothic',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: createBulletParagraphs(content, 18),
          }),
        ],
      }),
    ],
  });
}

// ==========================================
// 1. EXPORT CORRECTIVE MAINTENANCE (CM) REPORT TO DOCX
// ==========================================
export async function exportCMReportToDocx(data: CMReportData): Promise<void> {
  const [logoLeftBytes, logoRightBytes, prepSignBytes, revSignBytes, ack1SignBytes, ack2SignBytes, appSignBytes] = await Promise.all([
    loadImageAsUint8Array(logoDwimitra),
    loadImageAsUint8Array(logoNeutraDC),
    loadImageAsUint8Array((data as any).preparedBySign || PREPARED_BY_SIGNATURES[data.preparedByName] || ''),
    loadImageAsUint8Array((data as any).reviewedBySign || ''),
    loadImageAsUint8Array((data as any).acknowledgedBy1Sign || ''),
    loadImageAsUint8Array((data as any).acknowledgedBy2Sign || ''),
    loadImageAsUint8Array((data as any).approvedBySign || ''),
  ]);

  // Resolve Aliases & Fallbacks
  const resolvedIncidentName = data.incidentName || (data as any).ticketName || (data as any).issue || 'Corrective Maintenance Report';
  const resolvedEquipmentName = data.equipmentName || (data as any).ticketName || (data as any).issue || (data as any).location || 'Equipment';
  const resolvedAction = data.correctiveAction || (data as any).actionTaken || '-';
  const resolvedResult = data.result || (data as any).remark || 'Status perbaikan telah selesai dilaksanakan dengan baik.';
  const resolvedVisualInsp = data.visualInspectionChecking || (data as any).issue || 'Pengecekan kondisi fisik dan fungsi operasional peralatan.';
  const resolvedCleaningMethod = data.cleaningPreventiveMethod || 'Pembersihan area kerja dan komponen pendukung.';
  const resolvedProblemAnalysis = data.summaryProblemAnalysis || (data as any).issue || (data as any).summary || (data as any).actionTaken || 'Analisis masalah dan perbaikan unit.';

  // Table 1: Incident Info
  const incidentTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: [
      new TableRow({
        children: ['INCIDENT NAME', 'LOCATION', 'INCIDENT DATE', 'INCIDENT ID'].map(
          (headText, idx) =>
            new TableCell({
              width: { size: [35, 25, 20, 20][idx], type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: headText, bold: true, size: 17, color: '000000', font: 'Century Gothic' })],
                }),
              ],
            })
        ),
      }),
      new TableRow({
        children: [
          resolvedIncidentName || 'N/A',
          data.location || 'N/A',
          data.incidentDate || 'N/A',
          data.incidentId || 'N/A',
        ].map(
          (val, idx) =>
            new TableCell({
              width: { size: [35, 25, 20, 20][idx], type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: val, size: 17, color: '1E293B', font: 'Century Gothic' })],
                }),
              ],
            })
        ),
      }),
    ],
  });

  // Table 2: Equipment Info
  const equipmentTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: [
      new TableRow({
        children: ['EQUIPMENT NAME', 'BRAND', 'SERIAL NUMBER', 'INSTALATION DATE'].map(
          (headText, idx) =>
            new TableCell({
              width: { size: [35, 25, 20, 20][idx], type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: headText, bold: true, size: 17, color: '000000', font: 'Century Gothic' })],
                }),
              ],
            })
        ),
      }),
      new TableRow({
        children: [
          resolvedEquipmentName || 'N/A',
          data.brand || 'N/A',
          data.serialNumber || 'N/A',
          data.installationDate || 'N/A',
        ].map(
          (val, idx) =>
            new TableCell({
              width: { size: [35, 25, 20, 20][idx], type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: val, size: 17, color: '1E293B', font: 'Century Gothic' })],
                }),
              ],
            })
        ),
      }),
    ],
  });

  // Table 3: Corrective Action, Repair Time & Result
  const actionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: [
      new TableRow({
        children: ['CORRECTIVE ACTION', 'REPAIR TIME', 'RESULT'].map(
          (headText, idx) =>
            new TableCell({
              width: { size: [50, 20, 30][idx], type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: headText, bold: true, size: 17, color: '000000', font: 'Century Gothic' })],
                }),
              ],
            })
        ),
      }),
      new TableRow({
        children: [
          // Corrective Action Paragraphs
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: createBulletParagraphs(resolvedAction, 17),
          }),
          // Repair Time
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `Start : ${data.repairTimeStart || '-'}`, size: 17, color: '1E293B', font: 'Century Gothic' }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `End   : ${data.repairTimeEnd || '-'}`, size: 17, color: '1E293B', font: 'Century Gothic' }),
                ],
              }),
            ],
          }),
          // Result
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: resolvedResult || '-', size: 17, color: '1E293B', font: 'Century Gothic' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Spareparts Table
  const sparepartRows =
    data.spareparts && data.spareparts.length > 0
      ? data.spareparts.map(
          (sp, idx) =>
            new TableRow({
              children: [(idx + 1).toString(), sp.name || '-', sp.brand || '-', sp.qty || '-'].map(
                (cellVal, cIdx) =>
                  new TableCell({
                    width: { size: [10, 50, 25, 15][cIdx], type: WidthType.PERCENTAGE },
                    margins: { top: 80, bottom: 80, left: 100, right: 100 },
                    children: [
                      new Paragraph({
                        alignment: cIdx === 1 ? AlignmentType.LEFT : AlignmentType.CENTER,
                        children: [new TextRun({ text: cellVal, size: 17, color: '1E293B', font: 'Century Gothic' })],
                      }),
                    ],
                  })
              ),
            })
        )
      : [
          new TableRow({
            children: ['-', '-', '-', '-'].map(
              (cellVal, cIdx) =>
                new TableCell({
                  width: { size: [10, 50, 25, 15][cIdx], type: WidthType.PERCENTAGE },
                  margins: { top: 80, bottom: 80, left: 100, right: 100 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: cellVal, size: 17, color: '1E293B', font: 'Century Gothic' })],
                    }),
                  ],
                })
            ),
          }),
        ];

  const sparepartTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: [
      new TableRow({
        children: ['No', 'LIST OF REQUIRED SPAREPART', 'BRAND', 'QTY'].map(
          (hText, idx) =>
            new TableCell({
              width: { size: [10, 50, 25, 15][idx], type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: hText, bold: true, size: 17, color: '000000', font: 'Century Gothic' })],
                }),
              ],
            })
        ),
      }),
      ...sparepartRows,
    ],
  });

  // Photo Documentation 2-Column Table Grid
  const photoTableRows: TableRow[] = [];
  if (data.photos && data.photos.length > 0) {
    const validPhotos = data.photos.filter((p) => p.photoBase64);
    for (let i = 0; i < validPhotos.length; i += 2) {
      const p1 = validPhotos[i];
      const p2 = validPhotos[i + 1];

      const img1Bytes = await loadImageAsUint8Array(p1.photoBase64);
      const img2Bytes = p2 ? await loadImageAsUint8Array(p2.photoBase64) : new Uint8Array();

      const cell1Children: Paragraph[] = [];
      if (img1Bytes.length > 0) {
        cell1Children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: img1Bytes,
                transformation: { width: 240, height: 145 },
                type: 'png',
              }),
            ],
          })
        );
        cell1Children.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: p1.description ? `Ket: ${p1.description}` : `Ket: Dokumentasi Foto #${i + 1}`,
                size: 15,
                color: '334155',
                font: 'Century Gothic',
              }),
            ],
          })
        );
      }

      const cell2Children: Paragraph[] = [];
      if (p2 && img2Bytes.length > 0) {
        cell2Children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: img2Bytes,
                transformation: { width: 240, height: 145 },
                type: 'png',
              }),
            ],
          })
        );
        cell2Children.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: p2.description ? `Ket: ${p2.description}` : `Ket: Dokumentasi Foto #${i + 2}`,
                size: 15,
                color: '334155',
                font: 'Century Gothic',
              }),
            ],
          })
        );
      }

      // Add Header Row for Photo Documentation Pair
      photoTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [new TextRun({ text: `FOTO DOKUMENTASI #${i + 1}`, bold: true, size: 16, color: '1E293B', font: 'Century Gothic' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [p2 ? new TextRun({ text: `FOTO DOKUMENTASI #${i + 2}`, bold: true, size: 16, color: '1E293B', font: 'Century Gothic' }) : new TextRun({ text: '' })],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: cell1Children.length > 0 ? cell1Children : [new Paragraph({ children: [] })],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: cell2Children.length > 0 ? cell2Children : [new Paragraph({ children: [] })],
            }),
          ],
        })
      );
    }
  }

  const photoGridTable = photoTableRows.length > 0
    ? new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: cellBorder,
        rows: photoTableRows,
      })
    : null;

  // Signatures Table Grid (Matching PDF Screenshot Layout)
  const sigCellWidth = { size: 50, type: WidthType.PERCENTAGE };

  // Helper to build signature cell contents with header shading & image
  const buildSigCell = (headerTitle: string, signBytes: Uint8Array, nameText: string, titleText: string) => {
    const children: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: headerTitle, bold: true, size: 16, color: '000000', font: 'Century Gothic' })],
      }),
    ];

    if (signBytes && signBytes.length > 0) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 80 },
          children: [new ImageRun({ data: signBytes, transformation: { width: 110, height: 45 }, type: 'png' })],
        })
      );
    } else {
      children.push(new Paragraph({ spacing: { before: 300 } }));
    }

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40 },
        children: [new TextRun({ text: nameText, bold: true, size: 17, color: '000000', font: 'Century Gothic' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: titleText, size: 15, color: '475569', font: 'Century Gothic' })],
      })
    );

    return children;
  };

  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: [
      // Row 1: PREPARED BY & REVIEWED BY
      new TableRow({
        children: [
          new TableCell({
            width: sigCellWidth,
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'PREPARED BY,', bold: true, size: 16, color: '000000', font: 'Century Gothic' })],
              }),
            ],
          }),
          new TableCell({
            width: sigCellWidth,
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'REVIEWED BY,', bold: true, size: 16, color: '000000', font: 'Century Gothic' })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: sigCellWidth,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: buildSigCell('', prepSignBytes, data.preparedByName || 'Salman', data.preparedByTitle || '(Electrical Engineer)'),
          }),
          new TableCell({
            width: sigCellWidth,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: buildSigCell('', revSignBytes, data.reviewedByName || 'Arif Budiman', data.reviewedByTitle || '(Technical Manager)'),
          }),
        ],
      }),

      // Row 2: ACKNOWLEDGED BY (Full Header + 2 Columns)
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'ACKNOWLEDGED BY,', bold: true, size: 16, color: '000000', font: 'Century Gothic' })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: sigCellWidth,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: buildSigCell('', ack1SignBytes, data.acknowledgedBy1Name || 'Andrean Bima Pratama', data.acknowledgedBy1Title || '(Chief Engineer)'),
          }),
          new TableCell({
            width: sigCellWidth,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: buildSigCell('', ack2SignBytes, data.acknowledgedBy2Name || 'Supriyatno', data.acknowledgedBy2Title || '(Facility manager)'),
          }),
        ],
      }),

      // Row 3: APPROVED BY
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'APPROVED BY,', bold: true, size: 16, color: '000000', font: 'Century Gothic' })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: 100, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: buildSigCell('', appSignBytes, data.approvedByName || 'Budi Susanto', data.approvedByTitle || '(Assistant manager HDC Facility Management)'),
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Century Gothic',
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 }, // 0.5 inch margins
          },
        },
        headers: {
          default: new Header({
            children: [createHeaderLogosTable(logoLeftBytes, logoRightBytes)],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Halaman ', size: 16, color: '64748B', font: 'Century Gothic' }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '64748B',
                    font: 'Century Gothic',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 240 },
            children: [
              new TextRun({
                text: 'REPORT CORRECTIVE MAINTENANCE',
                bold: true,
                size: 36, // 18pt in Word
                color: '475569',
                font: 'Century Gothic',
              }),
            ],
          }),

          incidentTable,
          new Paragraph({ spacing: { after: 120 } }),

          equipmentTable,
          new Paragraph({ spacing: { after: 120 } }),

          actionTable,
          new Paragraph({ spacing: { after: 180 } }),

          createBoxSection('VISUAL INSPECTION & CHECKING', resolvedVisualInsp),
          new Paragraph({ spacing: { after: 120 } }),

          createBoxSection('CLEANING & PREVENTIVE METHOD', resolvedCleaningMethod),
          new Paragraph({ spacing: { after: 120 } }),

          createBoxSection('SUMMARY CORRECTIVE REPORT (PROBLEM ANALYSIS)', resolvedProblemAnalysis),
          new Paragraph({ spacing: { after: 240 } }),

          createSectionHeader('LIST OF REQUIRED SPAREPARTS'),
          sparepartTable,
          new Paragraph({ spacing: { after: 240 } }),

          ...(photoGridTable
            ? [createSectionHeader('SUPPORTING DOCUMENTATION', true), photoGridTable]
            : []),

          new Paragraph({ spacing: { after: 240 } }),

          new Paragraph({
            spacing: { before: 180, after: 120 },
            children: [
              new TextRun({
                text: `AUTHOR BY, ${data.authorName || 'Rizki Novri Yanda - Data Center Operation'}`,
                bold: true,
                size: 18,
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
  const cleanFileName = `CM_Report_${(data.incidentName || 'Corrective').replace(/[^a-zA-Z0-9_\-]/g, '_')}_${data.incidentDate || '2026'}.docx`;
  saveAs(blob, cleanFileName);
}

// ==========================================
// 2. EXPORT SLA / SLG REPORT TO DOCX
// ==========================================
export async function exportSLAReportToDocx(report: any): Promise<void> {
  const [logoLeftBytes, logoRightBytes] = await Promise.all([
    loadImageAsUint8Array(logoDwimitra),
    loadImageAsUint8Array(logoNeutraDC),
  ]);

  const targetResp = report.targetResponseMin || 5;
  const targetOnsite = report.targetOnsiteMin || 120;
  const targetRestore = report.targetRestoreMin || 120;
  const targetResolution = report.targetResolutionMin || 360;

  const actualResp = report.actualResponseTimeMin ?? (report.timeOrder ? 5 : 0);
  const actualOnsite = report.actualOnsiteTimeMin ?? (report.actualTimeOnsite ? 45 : 0);
  const actualRestore = report.actualRestoreTimeMin ?? (report.startOrder && report.finishOrder ? 60 : 0);
  const actualResolution = report.actualResolutionTimeMin ?? (report.actualRestoreTimeMin || 60);

  const respComply = actualResp <= targetResp;
  const onsiteComply = actualOnsite <= targetOnsite;
  const restoreComply = actualRestore <= targetRestore;
  const resolutionComply = actualResolution <= targetResolution;

  // Calculate SLG Scores if not present in report object
  const scoreRT = report.slgScoreRT ?? (actualResp > 0 ? Number((Math.min(100, (targetResp / actualResp) * 100) * 0.05).toFixed(2)) : 5.0);
  const scoreOTP = report.slgScoreOTP ?? (actualOnsite > 0 ? Number((Math.min(100, (targetOnsite / actualOnsite) * 100) * 0.05).toFixed(2)) : 5.0);
  const scoreRST = report.slgScoreRST ?? (actualRestore > 0 ? Number((Math.min(100, (targetRestore / actualRestore) * 100) * 0.15).toFixed(2)) : 15.0);
  const scoreRSP = report.slgScoreRSP ?? (actualResolution > 0 ? Number((Math.min(100, (targetResolution / actualResolution) * 100) * 0.10).toFixed(2)) : 10.0);
  const totalIncidentSlg = Number((scoreRT + scoreOTP + scoreRST + scoreRSP).toFixed(2));

  const slaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: [
      new TableRow({
        children: ['INDIKATOR SLA / SLG', 'TARGET', 'AKTUAL', 'BOBOT', 'SKOR SLG', 'STATUS'].map(
          (headText, idx) =>
            new TableCell({
              width: { size: [30, 15, 15, 12, 13, 15][idx], type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: headText, bold: true, size: 15, color: '000000' })],
                }),
              ],
            })
        ),
      }),
      [
        { name: '1. RESPONSE TIME (RT)', target: `< ${targetResp} Min`, actual: `${actualResp} Min`, bobot: '5%', score: `${scoreRT}%`, comply: respComply },
        { name: '2. ONSITE PRINCIPLE (OTP)', target: `${targetOnsite} Min`, actual: `${actualOnsite} Min`, bobot: '5%', score: `${scoreOTP}%`, comply: onsiteComply },
        { name: '3. SERVICE RESTORE (RST)', target: `${targetRestore} Min`, actual: `${actualRestore} Min`, bobot: '15%', score: `${scoreRST}%`, comply: restoreComply },
        { name: '4. RESOLUTION PROBLEM (RSP)', target: `${targetResolution} Min`, actual: `${actualResolution} Min`, bobot: '10%', score: `${scoreRSP}%`, comply: resolutionComply },
      ].map(
        (row) =>
          new TableRow({
            children: [
              new TableCell({
                margins: { top: 80, bottom: 80, left: 80, right: 80 },
                children: [new Paragraph({ children: [new TextRun({ text: row.name, bold: true, size: 15, color: '1E293B' })] })],
              }),
              new TableCell({
                margins: { top: 80, bottom: 80, left: 60, right: 60 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.target, size: 15, color: '64748B' })] })],
              }),
              new TableCell({
                margins: { top: 80, bottom: 80, left: 60, right: 60 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.actual, bold: true, size: 15, color: '1E293B' })] })],
              }),
              new TableCell({
                margins: { top: 80, bottom: 80, left: 60, right: 60 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.bobot, size: 15, color: '475569' })] })],
              }),
              new TableCell({
                margins: { top: 80, bottom: 80, left: 60, right: 60 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.score, bold: true, size: 15, color: '2563EB' })] })],
              }),
              new TableCell({
                margins: { top: 80, bottom: 80, left: 60, right: 60 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: row.comply ? '✓ COMPLY' : '✗ NOT COMPLY',
                        bold: true,
                        size: 15,
                        color: row.comply ? '166534' : '991B1B',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
      ),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 4,
            shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'TOTAL SKOR SLG KATEGORI INSIDEN (MAX 35%):', bold: true, size: 16, color: '1E293B' })] })],
          }),
          new TableCell({
            columnSpan: 2,
            shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${totalIncidentSlg}% / 35.00%`, bold: true, size: 16, color: '1E3A8A' })] })],
          }),
        ],
      }),
    ].flat(),
  });

  // Safe fallback values for PIC DME and PIC TDE
  const picDMEVal = (!report.picDME || report.picDME === '-') ? 'On Duty DME' : report.picDME;
  const picTDEVal = (!report.picTDE || report.picTDE === 'FMA - CBRE' || report.picTDE === '-') ? 'FMA - OCS' : report.picTDE;

  // Photos — support multi-photo arrays (PhotoItem[]) formatted in a clean 2-column side-by-side grid with preserved aspect ratio
  interface PhotoItem { photo: string; description: string; }
  const photoSections: { title: string; items: PhotoItem[] }[] = [
    { title: '1. PHOTO RESPONSE TIME', items: (report.photosResponse as PhotoItem[] | undefined) || (report.photoResponse ? [{ photo: report.photoResponse, description: '' }] : []) },
    { title: '2. PHOTO ONSITE PRINCIPLE', items: (report.photosOnsite as PhotoItem[] | undefined) || (report.photoOnsite ? [{ photo: report.photoOnsite, description: '' }] : []) },
    { title: '3. PHOTO SERVICE RESTORE', items: (report.photosRestore as PhotoItem[] | undefined) || (report.photoRestore ? [{ photo: report.photoRestore, description: '' }] : []) },
    { title: '4. PHOTO RESOLUTION', items: (report.photosResolution as PhotoItem[] | undefined) || (report.photoResolution ? [{ photo: report.photoResolution, description: '' }] : []) },
  ].filter((s) => s.items.length > 0);

  interface PhotoGridItem {
    description: string;
    bytes: Uint8Array;
    width: number;
    height: number;
  }

  const allPhotoItems: PhotoGridItem[] = [];
  for (const section of photoSections) {
    for (let i = 0; i < section.items.length; i++) {
      const item = section.items[i];
      if (item.photo) {
        const imgData = await getImageWithDimensions(item.photo, 230, 260);
        if (imgData.bytes.length > 0) {
          const descStr = section.items.length > 1
            ? `${section.title} (Foto ${i + 1}${item.description ? `: ${item.description}` : ''})`
            : `${section.title}${item.description ? ` - ${item.description}` : ''}`;
          allPhotoItems.push({
            description: descStr,
            bytes: imgData.bytes,
            width: imgData.width,
            height: imgData.height,
          });
        }
      }
    }
  }

  const photoRows: TableRow[] = [];
  for (let i = 0; i < allPhotoItems.length; i += 2) {
    const item1 = allPhotoItems[i];
    const item2 = allPhotoItems[i + 1];

    const cell1Children: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({ text: item1.description, bold: true, size: 15, color: '1E293B' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new ImageRun({
            data: item1.bytes,
            transformation: { width: item1.width, height: item1.height },
            type: 'png',
          }),
        ],
      }),
    ];

    const cell2Children: Paragraph[] = item2
      ? [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({ text: item2.description, bold: true, size: 15, color: '1E293B' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new ImageRun({
                data: item2.bytes,
                transformation: { width: item2.width, height: item2.height },
                type: 'png',
              }),
            ],
          }),
        ]
      : [];

    photoRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: cell1Children,
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: cell2Children,
          }),
        ],
      })
    );
  }

  const photoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: photoRows,
  });

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        headers: {
          default: new Header({
            children: [createHeaderLogosTable(logoLeftBytes, logoRightBytes)],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Halaman ', size: 16, color: '64748B' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '64748B' }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 240 },
            children: [
              new TextRun({ text: 'LAPORAN PENCAPAIAN SLA & SLG', bold: true, size: 28, color: '1E3A8A' }),
            ],
          }),

          createBoxSection('TIKET INCIDENT & LOKASI', `Nama Tiket : ${report.ticketName || 'N/A'}\nLokasi     : ${report.location || 'N/A'}\nPriority   : ${report.priority || 'Medium'}\nPIC DME    : ${picDMEVal}\nPIC TDE    : ${picTDEVal}`),
          new Paragraph({ spacing: { after: 180 } }),

          createSectionHeader('MATRIKS PENCAPAIAN SLA / SLG'),
          slaTable,
          new Paragraph({ spacing: { after: 180 } }),

          createBoxSection('TINDAKAN PERBAIKAN (ACTION)', report.actionTaken || report.resolutionRemark || 'N/A'),
          new Paragraph({ spacing: { after: 180 } }),

          createBoxSection('REMARK / CATATAN PENANGANAN', report.remark || 'N/A'),
          new Paragraph({ spacing: { after: 240 } }),

          ...(allPhotoItems.length > 0 ? [createSectionHeader('DOKUMENTASI FOTO BUKTI SLA / SLG', true), photoTable] : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanFileName = `SLA_Report_${(report.ticketName || 'SLA').replace(/[^a-zA-Z0-9_\-]/g, '_')}.docx`;
  saveAs(blob, cleanFileName);
}

// ==========================================
// 3. EXPORT POST INCIDENT REPORT (PIR) TO DOCX
// ==========================================
export async function exportPIRReportToDocx(data: PIRReportData): Promise<void> {
  const [logoLeftBytes, logoRightBytes] = await Promise.all([
    loadImageAsUint8Array(logoDwimitra),
    loadImageAsUint8Array(logoNeutraDC),
  ]);

  const resolvedIncidentName = data.incidentName || (data as any).issue || (data as any).ticketName || '-';
  const resolvedOwner = data.postmortemOwner || (data as any).reportedByEmail || (data as any).reportedBy || '-';

  const pirHeaderTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: 'FIELD', bold: true, size: 17 })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            children: [new Paragraph({ children: [new TextRun({ text: 'DETAILS', bold: true, size: 17 })] })],
          }),
        ],
      }),
      [
        ['Incident Name', resolvedIncidentName],
        ['Incident Date', data.incidentDate || '-'],
        ['Incident ID', data.incidentId || (data.id ? data.id.slice(0, 8) : '-')],
        ['Postmortem Owner', resolvedOwner],
        ['Date Completed', data.dateCompleted || '-'],
        ['Report Authors', data.reportAuthors || '-'],
        ['Report ID', data.reportId || '-'],
        ['Postmortem Meeting Date', data.postmortemMeetingDate || '-'],
        ['Severity Level', `${data.severityLevel || 'LOW'} ${data.severityComments ? `(${data.severityComments})` : ''}`],
      ].map(
        ([label, val]) =>
          new TableRow({
            children: [
              new TableCell({
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 16, color: '334155' })] })],
              }),
              new TableCell({
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: val, size: 16, color: '0F172A' })] })],
              }),
            ],
          })
      ),
    ].flat(),
  });

  // Attendees Table
  const attendeesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ATTENDEES (TDE)', bold: true, size: 17 })] })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ATTENDEES (DME)', bold: true, size: 17 })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: createBulletParagraphs(data.attendeesTDE && data.attendeesTDE.length > 0 ? data.attendeesTDE.join('\n') : '-', 16),
          }),
          new TableCell({
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: createBulletParagraphs(data.attendeesDME && data.attendeesDME.length > 0 ? data.attendeesDME.join('\n') : '-', 16),
          }),
        ],
      }),
    ],
  });

  // Corrective Actions Table
  const correctiveActionRows =
    data.correctiveActions && data.correctiveActions.length > 0
      ? data.correctiveActions.map(
          (ca) =>
            new TableRow({
              children: [
                ca.actionItem || '-',
                ca.typeOfAction || '-',
                ca.assignedTo || '-',
                ca.bug || '-',
                ca.startDate || '-',
                ca.endDate || '-',
              ].map(
                (cellText, idx) =>
                  new TableCell({
                    width: { size: [30, 15, 15, 15, 12, 13][idx], type: WidthType.PERCENTAGE },
                    margins: { top: 60, bottom: 60, left: 80, right: 80 },
                    children: [new Paragraph({ children: [new TextRun({ text: cellText, size: 15 })] })],
                  })
              ),
            })
        )
      : [
          new TableRow({
            children: ['-', '-', '-', '-', '-', '-'].map(
              (cellText, idx) =>
                new TableCell({
                  width: { size: [30, 15, 15, 15, 12, 13][idx], type: WidthType.PERCENTAGE },
                  margins: { top: 60, bottom: 60, left: 80, right: 80 },
                  children: [new Paragraph({ children: [new TextRun({ text: cellText, size: 15 })] })],
                })
            ),
          }),
        ];

  const pirActionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: [
      new TableRow({
        children: ['ACTION ITEM', 'TYPE', 'ASSIGNED TO', 'BUG / TICKET', 'START DATE', 'END DATE'].map(
          (hText, idx) =>
            new TableCell({
              width: { size: [30, 15, 15, 15, 12, 13][idx], type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: hText, bold: true, size: 15, color: '000000' })],
                }),
              ],
            })
        ),
      }),
      ...correctiveActionRows,
    ],
  });

  // Photos
  const photoParagraphs: Paragraph[] = [];
  if (data.photos && data.photos.length > 0) {
    for (const p of data.photos) {
      if (!p.photoBase64) continue;
      const imgBytes = await loadImageAsUint8Array(p.photoBase64);
      if (imgBytes.length > 0) {
        photoParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 140, after: 60 },
            children: [
              new ImageRun({
                data: imgBytes,
                transformation: { width: 360, height: 220 },
                type: 'png',
              }),
            ],
          })
        );
        if (p.caption) {
          photoParagraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 180 },
              children: [new TextRun({ text: `Ket: ${p.caption}`, italics: true, size: 16, color: '64748B' })],
            })
          );
        }
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        headers: {
          default: new Header({
            children: [createHeaderLogosTable(logoLeftBytes, logoRightBytes)],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Halaman ', size: 16, color: '64748B' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '64748B' }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 240 },
            children: [
              new TextRun({ text: 'POST INCIDENT REPORT (PIR)', bold: true, size: 28, color: '1E293B' }),
            ],
          }),

          pirHeaderTable,
          new Paragraph({ spacing: { after: 180 } }),

          createSectionHeader('ATTENDEES'),
          attendeesTable,
          new Paragraph({ spacing: { after: 180 } }),

          createBoxSection('EXECUTIVE SUMMARY', data.summary || 'N/A'),
          new Paragraph({ spacing: { after: 180 } }),

          createSectionHeader('INCIDENT OVERVIEW'),
          createBoxSection('IMPACT', data.impact || 'N/A'),
          new Paragraph({ spacing: { after: 100 } }),
          createBoxSection('TRIGGER', data.trigger || 'N/A'),
          new Paragraph({ spacing: { after: 100 } }),
          createBoxSection('ROOT CAUSE', data.rootCause || 'N/A'),
          new Paragraph({ spacing: { after: 100 } }),
          createBoxSection('DETECTION', data.detection || 'N/A'),
          new Paragraph({ spacing: { after: 100 } }),
          createBoxSection('RESPONSE', data.response || 'N/A'),
          new Paragraph({ spacing: { after: 100 } }),
          createBoxSection('RESOLUTION', data.resolution || 'N/A'),
          new Paragraph({ spacing: { after: 180 } }),

          createSectionHeader('CONTRIBUTING FACTORS & LESSONS LEARNED'),
          createBoxSection('CONTRIBUTING FACTORS', data.contributingFactors || 'N/A'),
          new Paragraph({ spacing: { after: 100 } }),
          createBoxSection('WHAT WENT WELL', data.whatWentWell || 'N/A'),
          new Paragraph({ spacing: { after: 100 } }),
          createBoxSection('WHAT WENT POORLY', data.whatWentPoorly || 'N/A'),
          new Paragraph({ spacing: { after: 100 } }),
          createBoxSection('WHERE WERE WE LUCKY', data.whereWereWeLucky || 'N/A'),
          new Paragraph({ spacing: { after: 180 } }),

          createSectionHeader('CORRECTIVE ACTIONS'),
          pirActionTable,
          new Paragraph({ spacing: { after: 240 } }),

          ...(photoParagraphs.length > 0 ? [createSectionHeader('SUPPORTING DOCUMENTATION'), ...photoParagraphs] : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanFileName = `PIR_Report_${(data.incidentName || 'PIR').replace(/[^a-zA-Z0-9_\-]/g, '_')}_${data.incidentDate || '2026'}.docx`;
  saveAs(blob, cleanFileName);
}

// ==========================================
// 4. EXPORT SLA / SLG MONTHLY RECAP TO DOCX
// ==========================================
export async function exportSLAMonthlyRecapToDocx(reports: any[], periodTitle: string = 'Bulanan'): Promise<void> {
  const [logoLeftBytes, logoRightBytes] = await Promise.all([
    loadImageAsUint8Array(logoDwimitra),
    loadImageAsUint8Array(logoNeutraDC),
  ]);

  const formatMinToHHMM = (min: number | undefined): string => {
    if (min === undefined || min === null || isNaN(min)) return '0:00';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  const formatDateHour = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const MM = d.getMonth() + 1;
    const DD = d.getDate();
    const YY = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${MM}/${DD}/${YY} ${hh}:${mm}`;
  };

  const cellBorderThin = {
    top: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
  };

  const createHeading = (title: string) => {
    return new Paragraph({
      spacing: { before: 280, after: 120 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 22,
          color: '0F172A',
        }),
      ],
    });
  };

  const createSubHeading = (text: string) => {
    return new Paragraph({
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: text,
          bold: true,
          size: 18,
          color: '475569',
        }),
      ],
    });
  };

  const createNotesSection = (note1: string, note2: string, note3: string) => {
    return [
      new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [new TextRun({ text: note1, size: 16, color: '334155' })],
      }),
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: note2, bold: true, size: 16, color: '1E293B' })],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: note3, bold: true, size: 16, color: '166534' })],
      }),
    ];
  };

  // Helper to get array of photos from report
  const getPhotos = (report: any, arrayKey: string, legacyKey: string): string[] => {
    if (Array.isArray(report[arrayKey]) && report[arrayKey].length > 0) {
      return report[arrayKey].map((p: any) => typeof p === 'string' ? p : p.photo).filter(Boolean);
    }
    if (report[legacyKey]) return [report[legacyKey]];
    return [];
  };

  // Pre-load all photo bytes for Evidence Table
  interface ReportPhotoBytes {
    response: Uint8Array[];
    onsite: Uint8Array[];
    restore: Uint8Array[];
    resolution: Uint8Array[];
  }
  const reportPhotosMap: ReportPhotoBytes[] = await Promise.all(
    reports.map(async (r) => {
      const respPhotos = getPhotos(r, 'photosResponse', 'photoResponse');
      const onsitePhotos = getPhotos(r, 'photosOnsite', 'photoOnsite');
      const restorePhotos = getPhotos(r, 'photosRestore', 'photoRestore');
      const resolPhotos = getPhotos(r, 'photosResolution', 'photoResolution');

      const [respBytes, onsiteBytes, restoreBytes, resolBytes] = await Promise.all([
        Promise.all(respPhotos.map((p) => loadImageAsUint8Array(p))),
        Promise.all(onsitePhotos.map((p) => loadImageAsUint8Array(p))),
        Promise.all(restorePhotos.map((p) => loadImageAsUint8Array(p))),
        Promise.all(resolPhotos.map((p) => loadImageAsUint8Array(p))),
      ]);

      return {
        response: respBytes.filter((b) => b.length > 0),
        onsite: onsiteBytes.filter((b) => b.length > 0),
        restore: restoreBytes.filter((b) => b.length > 0),
        resolution: resolBytes.filter((b) => b.length > 0),
      };
    })
  );

  // -------------------------------------------------------------
  // 1. EV RESPONSE TIME TABLE
  // -------------------------------------------------------------
  const respHeaders = ['NO', 'ORDER/TICKET', 'LOCATION', 'PIC DME', 'PIC TDE', 'TIME ORDER', 'ACTUAL TIME', 'ACTUAL', 'TARGET', 'COMPLY', 'REMARK'];
  const respWidths = [4, 18, 11, 8, 8, 12, 12, 7, 6, 6, 8];

  const respRows = reports.map((r, idx) => {
    const comply = r.responseComply !== undefined ? r.responseComply : (r.actualResponseTimeMin ? r.actualResponseTimeMin <= (r.targetResponseMin || 5) : true);
    return new TableRow({
      children: [
        String(idx + 1),
        r.ticketName || r.issue || 'WO',
        r.location || '-',
        r.picDME || 'On Duty DME',
        (!r.picTDE || r.picTDE === 'FMA - CBRE' || r.picTDE === '-') ? 'FMA - OCS' : r.picTDE,
        formatDateHour(r.timeOrder),
        formatDateHour(r.actualTimeResponse),
        formatMinToHHMM(r.actualResponseTimeMin),
        formatMinToHHMM(r.targetResponseMin || 5),
        comply ? 'M' : 'TM',
        r.remark || 'Via WhatsApp',
      ].map((val, cIdx) => new TableCell({
        width: { size: respWidths[cIdx], type: WidthType.PERCENTAGE },
        shading: cIdx === 9 ? { fill: comply ? 'F0FDF4' : 'FEF2F2', type: ShadingType.CLEAR } : undefined,
        margins: { top: 60, bottom: 60, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].includes(cIdx) ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [
              new TextRun({
                text: String(val),
                size: 14,
                bold: cIdx === 9,
                color: cIdx === 9 ? (comply ? '166534' : '991B1B') : '1E293B',
              }),
            ],
          }),
        ],
      })),
    });
  });

  const tableResponse = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorderThin,
    rows: [
      new TableRow({
        children: respHeaders.map((hText, cIdx) => new TableCell({
          width: { size: respWidths[cIdx], type: WidthType.PERCENTAGE },
          shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 40, right: 40 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: hText, bold: true, size: 14, color: '0F172A' })],
            }),
          ],
        })),
      }),
      ...respRows,
    ],
  });

  // Calculate Response Compliance
  const respMCount = reports.filter(r => r.responseComply !== false).length;
  const respScore = reports.length > 0 ? Number(((respMCount / reports.length) * 5).toFixed(2)) : 5.00;

  // -------------------------------------------------------------
  // 2. EV ONSITE PRINCIPLE TABLE
  // -------------------------------------------------------------
  const onsiteHeaders = ['NO', 'ORDER/TICKET', 'LOCATION', 'PIC DME', 'PIC TDE', 'TIME ORDER', 'ACTUAL ONSITE', 'ACTUAL', 'TARGET', 'COMPLY', 'REMARK'];
  const onsiteWidths = [4, 18, 11, 8, 8, 12, 12, 7, 6, 6, 8];

  const onsiteRows = reports.map((r, idx) => {
    const comply = r.onsiteComply !== undefined ? r.onsiteComply : (r.actualOnsiteTimeMin ? r.actualOnsiteTimeMin <= (r.targetOnsiteMin || 120) : true);
    return new TableRow({
      children: [
        String(idx + 1),
        r.ticketName || r.issue || 'WO',
        r.location || '-',
        r.picDME || 'On Duty DME',
        (!r.picTDE || r.picTDE === 'FMA - CBRE' || r.picTDE === '-') ? 'FMA - OCS' : r.picTDE,
        formatDateHour(r.timeOrder),
        formatDateHour(r.actualTimeOnsite),
        formatMinToHHMM(r.actualOnsiteTimeMin),
        formatMinToHHMM(r.targetOnsiteMin || 120),
        comply ? 'M' : 'TM',
        r.remark || '-',
      ].map((val, cIdx) => new TableCell({
        width: { size: onsiteWidths[cIdx], type: WidthType.PERCENTAGE },
        shading: cIdx === 9 ? { fill: comply ? 'F0FDF4' : 'FEF2F2', type: ShadingType.CLEAR } : undefined,
        margins: { top: 60, bottom: 60, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].includes(cIdx) ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [
              new TextRun({
                text: String(val),
                size: 14,
                bold: cIdx === 9,
                color: cIdx === 9 ? (comply ? '166534' : '991B1B') : '1E293B',
              }),
            ],
          }),
        ],
      })),
    });
  });

  const tableOnsite = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorderThin,
    rows: [
      new TableRow({
        children: onsiteHeaders.map((hText, cIdx) => new TableCell({
          width: { size: onsiteWidths[cIdx], type: WidthType.PERCENTAGE },
          shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 40, right: 40 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: hText, bold: true, size: 14, color: '0F172A' })],
            }),
          ],
        })),
      }),
      ...onsiteRows,
    ],
  });

  const onsiteMCount = reports.filter(r => r.onsiteComply !== false).length;
  const onsiteScore = reports.length > 0 ? Number(((onsiteMCount / reports.length) * 5).toFixed(2)) : 5.00;

  // -------------------------------------------------------------
  // 3. EV RESTORE TIME TABLE
  // -------------------------------------------------------------
  const restoreHeaders = ['NO', 'ORDER/TICKET', 'LOCATION', 'START ORDER', 'FINISH ORDER', 'ACTUAL RESTORE', 'TARGET', 'COMPLY', 'REMARK'];
  const restoreWidths = [4, 20, 12, 13, 13, 9, 7, 7, 15];

  const restoreRows = reports.map((r, idx) => {
    const comply = r.restoreComply !== undefined ? r.restoreComply : (r.actualRestoreTimeMin ? r.actualRestoreTimeMin <= (r.targetRestoreMin || 120) : true);
    return new TableRow({
      children: [
        String(idx + 1),
        r.ticketName || r.issue || 'WO',
        r.location || '-',
        formatDateHour(r.startOrder || r.actualTimeOnsite),
        formatDateHour(r.finishOrder),
        formatMinToHHMM(r.actualRestoreTimeMin),
        formatMinToHHMM(r.targetRestoreMin || 120),
        comply ? 'M' : 'TM',
        r.actionTaken || r.remark || '-',
      ].map((val, cIdx) => new TableCell({
        width: { size: restoreWidths[cIdx], type: WidthType.PERCENTAGE },
        shading: cIdx === 7 ? { fill: comply ? 'F0FDF4' : 'FEF2F2', type: ShadingType.CLEAR } : undefined,
        margins: { top: 60, bottom: 60, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: [0, 3, 4, 5, 6, 7].includes(cIdx) ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [
              new TextRun({
                text: String(val),
                size: 14,
                bold: cIdx === 7,
                color: cIdx === 7 ? (comply ? '166534' : '991B1B') : '1E293B',
              }),
            ],
          }),
        ],
      })),
    });
  });

  const tableRestore = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorderThin,
    rows: [
      new TableRow({
        children: restoreHeaders.map((hText, cIdx) => new TableCell({
          width: { size: restoreWidths[cIdx], type: WidthType.PERCENTAGE },
          shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 40, right: 40 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: hText, bold: true, size: 14, color: '0F172A' })],
            }),
          ],
        })),
      }),
      ...restoreRows,
    ],
  });

  const restoreMCount = reports.filter(r => r.restoreComply !== false).length;
  const restoreScore = reports.length > 0 ? Number(((restoreMCount / reports.length) * 15).toFixed(2)) : 15.00;

  // -------------------------------------------------------------
  // 4. EV RESOLUTION TIME TABLE
  // -------------------------------------------------------------
  const resolutionHeaders = ['NO', 'ORDER/TICKET', 'LOCATION', 'START ORDER', 'FINISH ORDER', 'ACTUAL RESOLUTION', 'TARGET', 'COMPLY', 'REMARK'];
  const resolutionWidths = [4, 20, 12, 13, 13, 9, 7, 7, 15];

  const resolutionRows = reports.map((r, idx) => {
    const comply = r.resolutionComply !== undefined ? r.resolutionComply : (r.actualResolutionTimeMin ? r.actualResolutionTimeMin <= (r.targetResolutionMin || 360) : true);
    return new TableRow({
      children: [
        String(idx + 1),
        r.ticketName || r.issue || 'WO',
        r.location || '-',
        formatDateHour(r.startOrder || r.actualTimeOnsite),
        formatDateHour(r.finishOrder),
        formatMinToHHMM(r.actualResolutionTimeMin),
        formatMinToHHMM(r.targetResolutionMin || 360),
        comply ? 'M' : 'TM',
        r.resolutionRemark || r.actionTaken || r.remark || '-',
      ].map((val, cIdx) => new TableCell({
        width: { size: resolutionWidths[cIdx], type: WidthType.PERCENTAGE },
        shading: cIdx === 7 ? { fill: comply ? 'F0FDF4' : 'FEF2F2', type: ShadingType.CLEAR } : undefined,
        margins: { top: 60, bottom: 60, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: [0, 3, 4, 5, 6, 7].includes(cIdx) ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [
              new TextRun({
                text: String(val),
                size: 14,
                bold: cIdx === 7,
                color: cIdx === 7 ? (comply ? '166534' : '991B1B') : '1E293B',
              }),
            ],
          }),
        ],
      })),
    });
  });

  const tableResolution = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorderThin,
    rows: [
      new TableRow({
        children: resolutionHeaders.map((hText, cIdx) => new TableCell({
          width: { size: resolutionWidths[cIdx], type: WidthType.PERCENTAGE },
          shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 40, right: 40 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: hText, bold: true, size: 14, color: '0F172A' })],
            }),
          ],
        })),
      }),
      ...resolutionRows,
    ],
  });

  const resolutionMCount = reports.filter(r => r.resolutionComply !== false).length;
  const resolutionScore = reports.length > 0 ? Number(((resolutionMCount / reports.length) * 15).toFixed(2)) : 15.00;

  // -------------------------------------------------------------
  // 5. EVIDENCE (PHOTO GRID) TABLE
  // -------------------------------------------------------------
  const evHeaders = ['NO', 'ORDER / TICKET', 'RESPONSE TIME', 'ONSITE TIME', 'RESTORE TIME', 'RESOLUTION TIME'];
  const evWidths = [4, 20, 19, 19, 19, 19];

  const evRows: TableRow[] = [];
  for (let idx = 0; idx < reports.length; idx++) {
    const r = reports[idx];
    const pBytes = reportPhotosMap[idx];

    const createCellPhotos = (bytesArray: Uint8Array[]) => {
      if (bytesArray.length === 0) {
        return [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '-', size: 14, color: '94A3B8' })] })];
      }
      return bytesArray.map((bytes) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 40 },
          children: [
            new ImageRun({
              data: bytes,
              transformation: { width: 100, height: 65 },
              type: 'png',
            }),
          ],
        })
      );
    };

    evRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: evWidths[0], type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 40, right: 40 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(idx + 1), size: 14, color: '1E293B' })] })],
          }),
          new TableCell({
            width: { size: evWidths[1], type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 40, right: 40 },
            children: [new Paragraph({ children: [new TextRun({ text: r.ticketName || r.issue || 'WO', bold: true, size: 14, color: '1E293B' })] })],
          }),
          new TableCell({
            width: { size: evWidths[2], type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 40, right: 40 },
            children: createCellPhotos(pBytes.response),
          }),
          new TableCell({
            width: { size: evWidths[3], type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 40, right: 40 },
            children: createCellPhotos(pBytes.onsite),
          }),
          new TableCell({
            width: { size: evWidths[4], type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 40, right: 40 },
            children: createCellPhotos(pBytes.restore),
          }),
          new TableCell({
            width: { size: evWidths[5], type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 40, right: 40 },
            children: createCellPhotos(pBytes.resolution),
          }),
        ],
      })
    );
  }

  const tableEvidence = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorderThin,
    rows: [
      new TableRow({
        children: evHeaders.map((hText, cIdx) => new TableCell({
          width: { size: evWidths[cIdx], type: WidthType.PERCENTAGE },
          shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 40, right: 40 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: hText, bold: true, size: 14, color: '0F172A' })],
            }),
          ],
        })),
      }),
      ...evRows,
    ],
  });

  // -------------------------------------------------------------
  // REKAPITULASI PENCAPAIAN SLA & SLG (SUMMARY TABLE)
  // -------------------------------------------------------------
  const summaryHeaders = ['NO', 'INDIKATOR KINERJA SLA / SLG', 'SATUAN', 'JUMLAH ORDER', 'PENCAPAIAN (M)', '% COMPLY', 'BOBOT', 'HASIL AKHIR SLG'];
  const summaryWidths = [5, 30, 9, 12, 12, 10, 8, 14];

  const totalReportsCount = reports.length || 1;
  const respPct = (respMCount / totalReportsCount) * 100;
  const onsitePct = (onsiteMCount / totalReportsCount) * 100;
  const restorePct = (restoreMCount / totalReportsCount) * 100;
  const resolutionPct = (resolutionMCount / totalReportsCount) * 100;

  const totalSlgScore = respScore + onsiteScore + restoreScore + resolutionScore;

  const summaryData = [
    { no: 1, indicator: 'Response Time', unit: 'Order', count: reports.length, comply: respMCount, pct: `${respPct.toFixed(0)}%`, bobot: '5%', score: `${respScore.toFixed(2)}%` },
    { no: 2, indicator: 'Onsite Time (Principle Onsite)', unit: 'Order', count: reports.length, comply: onsiteMCount, pct: `${onsitePct.toFixed(0)}%`, bobot: '5%', score: `${onsiteScore.toFixed(2)}%` },
    { no: 3, indicator: 'Restore Time (Service Restore)', unit: 'Order', count: reports.length, comply: restoreMCount, pct: `${restorePct.toFixed(0)}%`, bobot: '15%', score: `${restoreScore.toFixed(2)}%` },
    { no: 4, indicator: 'Resolution Time (Problem Resolution)', unit: 'Order', count: reports.length, comply: resolutionMCount, pct: `${resolutionPct.toFixed(0)}%`, bobot: '15%', score: `${resolutionScore.toFixed(2)}%` },
  ];

  const summaryRows = summaryData.map((row) => new TableRow({
    children: [
      String(row.no),
      row.indicator,
      row.unit,
      String(row.count),
      String(row.comply),
      row.pct,
      row.bobot,
      row.score,
    ].map((val, cIdx) => new TableCell({
      width: { size: summaryWidths[cIdx], type: WidthType.PERCENTAGE },
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
      children: [
        new Paragraph({
          alignment: [0, 2, 3, 4, 5, 6, 7].includes(cIdx) ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [
            new TextRun({
              text: String(val),
              bold: cIdx === 1 || cIdx === 7,
              size: 15,
              color: cIdx === 7 ? '166534' : '1E293B',
            }),
          ],
        }),
      ],
    })),
  }));

  const tableSummary = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorderThin,
    rows: [
      new TableRow({
        children: summaryHeaders.map((hText, cIdx) => new TableCell({
          width: { size: summaryWidths[cIdx], type: WidthType.PERCENTAGE },
          shading: { fill: '002060', type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 60, right: 60 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: hText, bold: true, size: 15, color: 'FFFFFF' })],
            }),
          ],
        })),
      }),
      ...summaryRows,
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 6,
            shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'TOTAL HASIL AKHIR PENCAPAIAN SLG (MAX 40%):', bold: true, size: 16, color: '0F172A' })] })],
          }),
          new TableCell({
            columnSpan: 2,
            shading: { fill: 'FEF08A', type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${totalSlgScore.toFixed(2)}% / 40.00%`, bold: true, size: 18, color: '854D0E' })] })],
          }),
        ],
      }),
    ],
  });

  // Build complete Word Document
  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        headers: {
          default: new Header({
            children: [createHeaderLogosTable(logoLeftBytes, logoRightBytes)],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Halaman ', size: 16, color: '64748B' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '64748B' }),
                  new TextRun({ text: ' dari ', size: 16, color: '64748B' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '64748B' }),
                  new TextRun({ text: ' • Rekap SLA/SLG DC Cikarang', size: 16, color: '64748B' }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Section 0: Summary Rekapitulasi Table
          createHeading('REKAPITULASI PENCAPAIAN KINERJA SLA & SLG'),
          createSubHeading(`MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG\nPeriode: ${periodTitle}`),
          tableSummary,
          new Paragraph({ spacing: { after: 240 } }),

          // Section 1
          createHeading('1. PENCAPAIAN RESPONSE TIME COMPLIANCE'),
          createSubHeading(`MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG\nPeriode: ${periodTitle}`),
          tableResponse,
          ...createNotesSection(
            '• M = Memenuhi, TM = Tidak Memenuhi, Diambil dari Laporan Kegiatan yang mencatat data Response Time dan telah di-approve User',
            '• Formula perhitungan Kinerja Response Time (RT) x 5%',
            `• Hasil perhitungan Kinerja Response Time (RT): ${respScore.toFixed(2)}%`
          ),

          // Section 2
          createHeading('2. PENCAPAIAN ONSITE TIME COMPLIANCE'),
          createSubHeading(`MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG\nPeriode: ${periodTitle}`),
          tableOnsite,
          ...createNotesSection(
            '• M = Memenuhi, TM = Tidak Memenuhi, Diambil dari Laporan Kegiatan yang mencatat data Onsite Time dan telah di-approve User',
            '• Formula perhitungan Onsite Time (OT) x 5%',
            `• Hasil perhitungan Kinerja Onsite Time (OT): ${onsiteScore.toFixed(2)}%`
          ),

          // Section 3
          createHeading('3. PENCAPAIAN RESTORE SERVICE TIME COMPLIANCE'),
          createSubHeading(`MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG\nPeriode: ${periodTitle}`),
          tableRestore,
          ...createNotesSection(
            '• M = Memenuhi, TM = Tidak Memenuhi, Diambil dari Laporan Kegiatan yang mencatat data Restore Time dan telah di-approve User',
            '• Formula perhitungan Kinerja Restore Time (RST) x 15%',
            `• Hasil perhitungan Kinerja Response Time (RST): ${restoreScore.toFixed(2)}%`
          ),

          // Section 4
          createHeading('4. PENCAPAIAN RESOLUTION SERVICE TIME COMPLIANCE'),
          createSubHeading(`MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG\nPeriode: ${periodTitle}`),
          tableResolution,
          ...createNotesSection(
            '• M = Memenuhi, TM = Tidak Memenuhi, Diambil dari Laporan Kegiatan yang mencatat data Resolution Time dan telah di-approve User',
            '• Formula perhitungan Kinerja Resolution Time (RSP) X 15%',
            `• Hasil perhitungan Kinerja Resolution Time (RSP): ${resolutionScore.toFixed(2)}%`
          ),

          // Section 5: Evidence
          createHeading('5. PENCAPAIAN ENGINEER ONSITE (EVIDENCE BUKTI FOTO)'),
          createSubHeading(`MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG\nPeriode: ${periodTitle}`),
          tableEvidence,
          new Paragraph({ spacing: { after: 200 } }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanPeriod = periodTitle.replace(/[^a-zA-Z0-9_\-]/g, '_');
  saveAs(blob, `Rekap_SLA_SLG_DC_Cikarang_${cleanPeriod}.docx`);
}
