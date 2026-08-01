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
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(base64ToUint8Array(dataUrl));
    };
    img.onerror = () => resolve(new Uint8Array());
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

function createSectionHeader(title: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 20, // 10pt
        color: '1E293B',
      }),
    ],
  });
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
            children: (content || 'N/A').split('\n').map(
              (line) =>
                new Paragraph({
                  spacing: { after: 60 },
                  children: [
                    new TextRun({
                      text: line,
                      size: 18,
                      color: '1E293B',
                    }),
                  ],
                })
            ),
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
  const [logoLeftBytes, logoRightBytes] = await Promise.all([
    loadImageAsUint8Array(logoDwimitra),
    loadImageAsUint8Array(logoNeutraDC),
  ]);

  // Clean bullet action items
  const actionLines = (data.correctiveAction || '-')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const clean = l.replace(/^(?:&«|[\u26AB\u2022\u25AA\u25BA\u25B6\u2043\u25CF\u25C6]|-|\*)\s*/, '');
      return `- ${clean}`;
    });

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
                  children: [new TextRun({ text: headText, bold: true, size: 17, color: '000000' })],
                }),
              ],
            })
        ),
      }),
      new TableRow({
        children: [
          data.incidentName || 'N/A',
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
                  children: [new TextRun({ text: val, size: 17, color: '1E293B' })],
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
                  children: [new TextRun({ text: headText, bold: true, size: 17, color: '000000' })],
                }),
              ],
            })
        ),
      }),
      new TableRow({
        children: [
          data.equipmentName || 'N/A',
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
                  children: [new TextRun({ text: val, size: 17, color: '1E293B' })],
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
                  children: [new TextRun({ text: headText, bold: true, size: 17, color: '000000' })],
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
            children: actionLines.map(
              (line) =>
                new Paragraph({
                  spacing: { after: 40 },
                  children: [new TextRun({ text: line, size: 17, color: '1E293B' })],
                })
            ),
          }),
          // Repair Time
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `Start : ${data.repairTimeStart || '-'}`, size: 17, color: '1E293B' }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `End   : ${data.repairTimeEnd || '-'}`, size: 17, color: '1E293B' }),
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
                children: [new TextRun({ text: data.result || '-', size: 17, color: '1E293B' })],
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
                        children: [new TextRun({ text: cellVal, size: 17, color: '1E293B' })],
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
                      children: [new TextRun({ text: cellVal, size: 17, color: '1E293B' })],
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
                  children: [new TextRun({ text: hText, bold: true, size: 17, color: '000000' })],
                }),
              ],
            })
        ),
      }),
      ...sparepartRows,
    ],
  });

  // Photo Documentation Grid
  const photoParagraphs: Paragraph[] = [];
  if (data.photos && data.photos.length > 0) {
    for (const p of data.photos) {
      if (!p.photoBase64) continue;
      const imgBytes = await loadImageAsUint8Array(p.photoBase64);
      if (imgBytes.length > 0) {
        photoParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 60 },
            children: [
              new ImageRun({
                data: imgBytes,
                transformation: { width: 360, height: 220 },
                type: 'png',
              }),
            ],
          })
        );
        if (p.description) {
          photoParagraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 180 },
              children: [
                new TextRun({
                  text: `Ket: ${p.description}`,
                  italics: true,
                  size: 16,
                  color: '64748B',
                }),
              ],
            })
          );
        }
      }
    }
  }

  // Signatures Table Grid
  const sigCellWidth = { size: 50, type: WidthType.PERCENTAGE };
  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: [
      // Row 1: PREPARED BY & REVIEWED BY
      new TableRow({
        children: [
          new TableCell({
            width: sigCellWidth,
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PREPARED BY,', bold: true, size: 17 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: data.preparedByName || 'Salman', bold: true, size: 17 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.preparedByTitle || '(Electrical Engineer)', size: 16 })] }),
            ],
          }),
          new TableCell({
            width: sigCellWidth,
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'REVIEWED BY,', bold: true, size: 17 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: data.reviewedByName || 'Arif Budiman', bold: true, size: 17 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.reviewedByTitle || '(Technical Manager)', size: 16 })] }),
            ],
          }),
        ],
      }),
      // Row 2: ACKNOWLEDGED BY
      new TableRow({
        children: [
          new TableCell({
            width: sigCellWidth,
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ACKNOWLEDGED BY,', bold: true, size: 17 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: data.acknowledgedBy1Name || 'Andrean Bima Pratama', bold: true, size: 17 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.acknowledgedBy1Title || '(Chief Engineer)', size: 16 })] }),
            ],
          }),
          new TableCell({
            width: sigCellWidth,
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ACKNOWLEDGED BY,', bold: true, size: 17 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: data.acknowledgedBy2Name || 'Supriyatno', bold: true, size: 17 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.acknowledgedBy2Title || '(Facility manager)', size: 16 })] }),
            ],
          }),
        ],
      }),
      // Row 3: APPROVED BY
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: 100, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'APPROVED BY,', bold: true, size: 17 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: data.approvedByName || 'Budi Susanto', bold: true, size: 17 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvedByTitle || '(Assistant manager HDC Facility Management)', size: 16 })] }),
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
            margin: { top: 720, bottom: 720, left: 720, right: 720 }, // 0.5 inch margins
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  ...(logoLeftBytes.length > 0
                    ? [new ImageRun({ data: logoLeftBytes, transformation: { width: 90, height: 40 }, type: 'png' })]
                    : []),
                  new TextRun({ text: '    ' }),
                  ...(logoRightBytes.length > 0
                    ? [new ImageRun({ data: logoRightBytes, transformation: { width: 110, height: 35 }, type: 'png' })]
                    : []),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Halaman ', size: 16, color: '64748B' }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '64748B',
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
                size: 28,
                color: '475569',
              }),
            ],
          }),

          incidentTable,
          new Paragraph({ spacing: { after: 120 } }),

          equipmentTable,
          new Paragraph({ spacing: { after: 120 } }),

          actionTable,
          new Paragraph({ spacing: { after: 180 } }),

          createBoxSection('VISUAL INSPECTION & CHECKING', data.visualInspectionChecking || 'N/A'),
          new Paragraph({ spacing: { after: 120 } }),

          createBoxSection('CLEANING & PREVENTIVE METHOD', data.cleaningPreventiveMethod || 'N/A'),
          new Paragraph({ spacing: { after: 120 } }),

          createBoxSection('SUMMARY CORRECTIVE REPORT (PROBLEM ANALYSIS)', data.summaryProblemAnalysis || 'N/A'),
          new Paragraph({ spacing: { after: 240 } }),

          createSectionHeader('LIST OF REQUIRED SPAREPARTS'),
          sparepartTable,
          new Paragraph({ spacing: { after: 240 } }),

          ...(photoParagraphs.length > 0
            ? [createSectionHeader('SUPPORTING DOCUMENTATION'), ...photoParagraphs]
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

  const targetResp = report.targetResponseMin || 10;
  const targetOnsite = report.targetOnsiteMin || 120;
  const targetRestore = report.targetRestoreMin || 180;
  const targetResolution = report.targetResolutionMin || 180;

  const actualResp = report.actualResponseTimeMin ?? (report.timeOrder ? 5 : 0);
  const actualOnsite = report.actualOnsiteTimeMin ?? (report.actualTimeOnsite ? 45 : 0);
  const actualRestore = report.actualRestoreTimeMin ?? (report.startOrder && report.finishOrder ? 60 : 0);
  const actualResolution = report.actualResolutionTimeMin ?? (report.actualRestoreTimeMin || 60);

  const respComply = actualResp <= targetResp;
  const onsiteComply = actualOnsite <= targetOnsite;
  const restoreComply = actualRestore <= targetRestore;
  const resolutionComply = actualResolution <= targetResolution;

  const slaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    rows: [
      new TableRow({
        children: ['INDIKATOR SLA / SLG', 'TARGET', 'AKTUAL', 'STATUS SLA'].map(
          (headText, idx) =>
            new TableCell({
              width: { size: [35, 20, 20, 25][idx], type: WidthType.PERCENTAGE },
              shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: headText, bold: true, size: 17, color: '000000' })],
                }),
              ],
            })
        ),
      }),
      [
        { name: '1. RESPONSE TIME', target: `${targetResp} Min`, actual: `${actualResp} Min`, comply: respComply },
        { name: '2. ONSITE SUPPORT', target: `${targetOnsite} Min`, actual: `${actualOnsite} Min`, comply: onsiteComply },
        { name: '3. SERVICE RESTORE (RST)', target: `${targetRestore} Min`, actual: `${actualRestore} Min`, comply: restoreComply },
        { name: '4. TOTAL RESOLUTION (RT)', target: `${targetResolution} Min`, actual: `${actualResolution} Min`, comply: resolutionComply },
      ].map(
        (row) =>
          new TableRow({
            children: [
              new TableCell({
                margins: { top: 80, bottom: 80, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: row.name, bold: true, size: 17, color: '1E293B' })] })],
              }),
              new TableCell({
                margins: { top: 80, bottom: 80, left: 100, right: 100 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.target, size: 17, color: '64748B' })] })],
              }),
              new TableCell({
                margins: { top: 80, bottom: 80, left: 100, right: 100 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.actual, bold: true, size: 17, color: '1E293B' })] })],
              }),
              new TableCell({
                margins: { top: 80, bottom: 80, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: row.comply ? '✓ MEMENUHI SLA' : '✗ TIDAK MEMENUHI SLA',
                        bold: true,
                        size: 17,
                        color: row.comply ? '166534' : '991B1B',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
      ),
    ].flat(),
  });

  // Photos
  const photos = [
    { title: '1. PHOTO RESPONSE TIME', base64: report.photoResponse },
    { title: '2. PHOTO ENGINEER ONSITE', base64: report.photoEngineerOnsite },
    { title: '3. PHOTO ONSITE PRINCIPLE', base64: report.photoOnsite },
    { title: '4. PHOTO SERVICE RESTORE', base64: report.photoRestore },
    { title: '5. PHOTO RESOLUTION', base64: report.photoResolution },
  ].filter((p) => Boolean(p.base64));

  const photoParagraphs: Paragraph[] = [];
  for (const p of photos) {
    const imgBytes = await loadImageAsUint8Array(p.base64);
    if (imgBytes.length > 0) {
      photoParagraphs.push(
        new Paragraph({
          spacing: { before: 180, after: 60 },
          children: [new TextRun({ text: p.title, bold: true, size: 18, color: '1E293B' })],
        })
      );
      photoParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 },
          children: [
            new ImageRun({
              data: imgBytes,
              transformation: { width: 360, height: 220 },
              type: 'png',
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  ...(logoLeftBytes.length > 0 ? [new ImageRun({ data: logoLeftBytes, transformation: { width: 90, height: 40 }, type: 'png' })] : []),
                  new TextRun({ text: '    ' }),
                  ...(logoRightBytes.length > 0 ? [new ImageRun({ data: logoRightBytes, transformation: { width: 110, height: 35 }, type: 'png' })] : []),
                ],
              }),
            ],
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

          createBoxSection('TIKET INCIDENT & LOKASI', `Nama Tiket : ${report.ticketName || 'N/A'}\nLokasi     : ${report.location || 'N/A'}\nPriority   : ${report.priority || 'Medium'}\nPIC DME    : ${report.picDME || '-'}\nPIC TDE    : ${report.picTDE || '-'}`),
          new Paragraph({ spacing: { after: 180 } }),

          createSectionHeader('MATRIKS PENCAPAIAN SLA / SLG'),
          slaTable,
          new Paragraph({ spacing: { after: 180 } }),

          createBoxSection('REMARK / CATATAN PENANGANAN', report.remark || 'N/A'),
          new Paragraph({ spacing: { after: 240 } }),

          ...(photoParagraphs.length > 0 ? [createSectionHeader('DOKUMENTASI FOTO BUKTI SLA / SLG'), ...photoParagraphs] : []),
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
        ['Incident Name', data.incidentName || '-'],
        ['Incident Date', data.incidentDate || '-'],
        ['Incident ID', data.incidentId || '-'],
        ['Postmortem Owner', data.postmortemOwner || '-'],
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
            children: (data.attendeesTDE && data.attendeesTDE.length > 0 ? data.attendeesTDE : ['-']).map(
              (name) => new Paragraph({ children: [new TextRun({ text: `• ${name}`, size: 16 })] })
            ),
          }),
          new TableCell({
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: (data.attendeesDME && data.attendeesDME.length > 0 ? data.attendeesDME : ['-']).map(
              (name) => new Paragraph({ children: [new TextRun({ text: `• ${name}`, size: 16 })] })
            ),
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
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  ...(logoLeftBytes.length > 0 ? [new ImageRun({ data: logoLeftBytes, transformation: { width: 90, height: 40 }, type: 'png' })] : []),
                  new TextRun({ text: '    ' }),
                  ...(logoRightBytes.length > 0 ? [new ImageRun({ data: logoRightBytes, transformation: { width: 110, height: 35 }, type: 'png' })] : []),
                ],
              }),
            ],
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
