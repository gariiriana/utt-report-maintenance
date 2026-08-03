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
import { DigitizedPaperReportResult } from '@/utils/aiAgentPipeline';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { toast } from 'sonner';

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

// DME Brand Colors
const DME_BLUE = '0284C7';
const DME_DARK_BLUE = '0369A1';
const DME_LIGHT_BLUE = 'F0F9FF';
const BORDER_COLOR = 'CBD5E1';

const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
};

/** Helper to calculate smart column widths percentage for dynamic tables */
function getColumnWidths(headers: string[]): number[] {
  const count = headers.length;
  if (count <= 1) return [100];

  let hasNoCol = false;
  let noIndex = -1;
  headers.forEach((h, i) => {
    if (/^no\.?$/i.test(h.trim()) || (i === 0 && /^no$/i.test(h.trim()))) {
      hasNoCol = true;
      noIndex = i;
    }
  });

  if (hasNoCol && count > 1) {
    const noWidth = 8;
    const remainingWidth = 92;
    const otherWidth = remainingWidth / (count - 1);
    return headers.map((_, i) => (i === noIndex ? noWidth : otherWidth));
  }

  const evenWidth = 100 / count;
  return headers.map(() => evenWidth);
}

/**
 * Generate a professional DOCX Word document for Digitized Paper Service Report.
 * Dynamically preserves exact layout, field labels, and column structures from scanned paper.
 */
export async function generateDigitizedPaperDOCX(
  scanResult: DigitizedPaperReportResult
): Promise<void> {
  const toastId = toast.loading('Membuat dokumen Word (DOCX) Laporan Service Report Presisi...');

  try {
    let logoLeftBytes: Uint8Array = new Uint8Array();
    let logoRightBytes: Uint8Array = new Uint8Array();
    try { logoLeftBytes = await loadImageAsUint8Array(logoDwimitra); } catch { /* ignore */ }
    try { logoRightBytes = await loadImageAsUint8Array(logoNeutraDC); } catch { /* ignore */ }

    const docTitle = (scanResult.title && scanResult.title !== 'Laporan Service Report Terdigitalisasi')
      ? scanResult.title.toUpperCase()
      : 'SERVICE REPORT MAINTENANCE (DIGITAL)';

    // ─── 1. HEADER LOGOS & TITLE TABLE ────────────────────────────
    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: cellBorder,
      rows: [
        new TableRow({
          children: [
            // Left Logo Cell
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
              verticalAlign: AlignmentType.CENTER,
              borders: cellBorder,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: logoLeftBytes.length > 0 ? [
                    new ImageRun({
                      data: logoLeftBytes,
                      transformation: { width: 110, height: 42 },
                      type: 'png',
                    }),
                  ] : [],
                }),
              ],
            }),
            // Center Title Cell
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
              verticalAlign: AlignmentType.CENTER,
              borders: cellBorder,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 40, after: 20 },
                  children: [
                    new TextRun({
                      text: docTitle,
                      bold: true,
                      size: 19, // 9.5pt
                      color: '0F172A',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 20 },
                  children: [
                    new TextRun({
                      text: 'PT. DWIMITRA EKATAMA MANDIRI',
                      bold: true,
                      size: 16, // 8pt
                      color: DME_BLUE,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 40 },
                  children: [
                    new TextRun({
                      text: 'Data Center Maintenance & Field Operations System',
                      size: 14, // 7pt
                      color: '64748B',
                    }),
                  ],
                }),
              ],
            }),
            // Right Logo Cell
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
              verticalAlign: AlignmentType.CENTER,
              borders: cellBorder,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: logoRightBytes.length > 0 ? [
                    new ImageRun({
                      data: logoRightBytes,
                      transformation: { width: 110, height: 42 },
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

    // ─── 2. DYNAMIC INFORMASI UMUM & PERALATAN TABLE ───────────────
    const infoEntries = Object.entries(scanResult.equipment_info || {});
    const infoRowsData: Array<[string, string, string, string]> = [];

    for (let i = 0; i < infoEntries.length; i += 2) {
      const [k1, v1] = infoEntries[i] || ['', ''];
      const [k2, v2] = infoEntries[i + 1] || ['', ''];
      infoRowsData.push([k1, v1 || '-', k2 || '-', v2 || '-']);
    }

    if (infoRowsData.length === 0) {
      infoRowsData.push([
        'Judul Laporan', scanResult.title || 'Service Report',
        'Tanggal Scan', new Date().toLocaleDateString('id-ID')
      ]);
    }

    const infoTableRows: TableRow[] = infoRowsData.map(row => (
      new TableRow({
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: DME_LIGHT_BLUE, type: ShadingType.CLEAR },
            borders: cellBorder,
            children: [
              new Paragraph({
                spacing: { before: 30, after: 30 },
                children: [new TextRun({ text: row[0], bold: true, size: 14, color: DME_DARK_BLUE })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            children: [
              new Paragraph({
                spacing: { before: 30, after: 30 },
                children: [new TextRun({ text: row[1], size: 14, color: '1E293B' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: row[2] ? DME_LIGHT_BLUE : 'FFFFFF', type: ShadingType.CLEAR },
            borders: cellBorder,
            children: [
              new Paragraph({
                spacing: { before: 30, after: 30 },
                children: row[2] ? [new TextRun({ text: row[2], bold: true, size: 14, color: DME_DARK_BLUE })] : [],
              }),
            ],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            children: [
              new Paragraph({
                spacing: { before: 30, after: 30 },
                children: row[2] ? [new TextRun({ text: row[3], size: 14, color: '1E293B' })] : [],
              }),
            ],
          }),
        ],
      })
    ));

    const infoTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: cellBorder,
      rows: infoTableRows,
    });

    // ─── 3. DYNAMIC DIGITIZED TABLES (PRESERVING EXACT PAPER HEADERS) ─────
    const digitizedTablesElements: Array<Paragraph | Table> = [];

    if (scanResult.tables && scanResult.tables.length > 0) {
      scanResult.tables.forEach((tbl, idx) => {
        // Table Title
        digitizedTablesElements.push(
          new Paragraph({
            spacing: { before: 180, after: 60 },
            children: [
              new TextRun({
                text: `${tbl.table_name || `TABEL ${idx + 1}: HASIL SCAN CHECKLIST & PENGUKURAN`}`,
                bold: true,
                size: 15, // 7.5pt
                color: DME_DARK_BLUE,
              }),
            ],
          })
        );

        // Dynamic Header Row with exact column headers
        const headers = tbl.headers || ['No', 'Uraian Pekerjaan / Parameter', 'Kondisi / Nilai', 'Catatan'];
        const colWidths = getColumnWidths(headers);

        const headerRow = new TableRow({
          children: headers.map((hText, cIdx) => (
            new TableCell({
              width: { size: colWidths[cIdx], type: WidthType.PERCENTAGE },
              shading: { fill: DME_BLUE, type: ShadingType.CLEAR },
              borders: cellBorder,
              children: [
                new Paragraph({
                  alignment: cIdx === 0 && /^no\.?$/i.test(hText.trim()) ? AlignmentType.CENTER : AlignmentType.LEFT,
                  spacing: { before: 35, after: 35 },
                  children: [new TextRun({ text: hText, bold: true, size: 14, color: 'FFFFFF' })],
                }),
              ],
            })
          )),
        });

        // Body Rows
        const bodyRows = (tbl.rows || []).map((row, rIdx) => (
          new TableRow({
            children: headers.map((_, cIdx) => (
              new TableCell({
                width: { size: colWidths[cIdx], type: WidthType.PERCENTAGE },
                shading: { fill: rIdx % 2 === 1 ? 'F8FAFC' : 'FFFFFF', type: ShadingType.CLEAR },
                borders: cellBorder,
                children: [
                  new Paragraph({
                    alignment: cIdx === 0 && row[cIdx] && row[cIdx].length <= 3 ? AlignmentType.CENTER : AlignmentType.LEFT,
                    spacing: { before: 25, after: 25 },
                    children: [new TextRun({ text: row[cIdx] || '', size: 13.5, color: '1E293B' })],
                  }),
                ],
              })
            )),
          })
        ));

        const tableDocx = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          rows: [headerRow, ...bodyRows],
        });

        digitizedTablesElements.push(tableDocx);
      });
    }

    // ─── 4. SIGNATURE BLOCK TABLE ─────────────────────────────────
    const signatureTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: cellBorder,
      rows: [
        // Header Row
        new TableRow({
          children: [
            new TableCell({
              width: { size: 33.33, type: WidthType.PERCENTAGE },
              shading: { fill: DME_LIGHT_BLUE, type: ShadingType.CLEAR },
              borders: cellBorder,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 30, after: 30 },
                  children: [new TextRun({ text: 'PERFORMED BY (ENGINEER)', bold: true, size: 13.5, color: DME_DARK_BLUE })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 33.33, type: WidthType.PERCENTAGE },
              shading: { fill: DME_LIGHT_BLUE, type: ShadingType.CLEAR },
              borders: cellBorder,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 30, after: 30 },
                  children: [new TextRun({ text: 'CHECKED BY (SITE MANAGER)', bold: true, size: 13.5, color: DME_DARK_BLUE })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 33.34, type: WidthType.PERCENTAGE },
              shading: { fill: DME_LIGHT_BLUE, type: ShadingType.CLEAR },
              borders: cellBorder,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 30, after: 30 },
                  children: [new TextRun({ text: 'APPROVED BY (CUSTOMER)', bold: true, size: 13.5, color: DME_DARK_BLUE })],
                }),
              ],
            }),
          ],
        }),
        // Signature Space Row
        new TableRow({
          children: [
            new TableCell({
              width: { size: 33.33, type: WidthType.PERCENTAGE },
              borders: cellBorder,
              children: [
                new Paragraph({ spacing: { before: 450, after: 20 } }), // Space for signature
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'PT. Dwimitra Ekatama Mandiri', size: 12.5, color: '64748B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 33.33, type: WidthType.PERCENTAGE },
              borders: cellBorder,
              children: [
                new Paragraph({ spacing: { before: 450, after: 20 } }), // Space for signature
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'Neutra DC / PT UTT', size: 12.5, color: '64748B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 33.34, type: WidthType.PERCENTAGE },
              borders: cellBorder,
              children: [
                new Paragraph({ spacing: { before: 450, after: 20 } }), // Space for signature
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'Operational Representative', size: 12.5, color: '64748B' })],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    // Assemble Document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,    // 0.5 inch (12.7mm)
                bottom: 720,
                left: 720,
                right: 720,
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: 'PT. DWIMITRA EKATAMA MANDIRI — DIGITAL SERVICE REPORT',
                      size: 12.5,
                      color: '94A3B8',
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
                    new TextRun({ text: 'Halaman ', size: 13, color: '64748B' }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 13, color: '64748B' }),
                    new TextRun({ text: ' dari ', size: 13, color: '64748B' }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 13, color: '64748B' }),
                  ],
                }),
              ],
            }),
          },
          children: [
            headerTable,
            new Paragraph({ spacing: { before: 120, after: 60 }, children: [
              new TextRun({ text: 'INFORMASI UMUM & PERALATAN (HASIL DIGITALISASI)', bold: true, size: 15, color: DME_DARK_BLUE })
            ] }),
            infoTable,
            ...digitizedTablesElements,
            new Paragraph({ spacing: { before: 180, after: 60 }, children: [
              new TextRun({ text: 'LEMBAR PENGESAHAN & TANDA TANGAN', bold: true, size: 15, color: DME_DARK_BLUE })
            ] }),
            signatureTable,
          ],
        },
      ],
    });

    // Save File
    const blob = await Packer.toBlob(doc);
    const equipName = scanResult.equipment_info?.['Peralatan'] || scanResult.equipment_info?.['Nama Peralatan'] || scanResult.title || 'Service_Report';
    const dateStr = scanResult.equipment_info?.['Tanggal'] || scanResult.equipment_info?.['Tanggal Pelaksanaan'] || new Date().toISOString().split('T')[0];
    const fileName = `Service_Report_Digital_${equipName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/[^a-zA-Z0-9]/g, '-')}.docx`;

    saveAs(blob, fileName);
    toast.success('Dokumen Word (DOCX) Presisi berhasil diunduh!', { id: toastId });
  } catch (err: any) {
    console.error(err);
    toast.error(`Gagal membuat dokumen Word: ${err?.message}`, { id: toastId });
    throw err;
  }
}
