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
  HeadingLevel,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  VerticalAlign,
} from 'docx';
import { saveAs } from 'file-saver';
import { FindingRecord } from '../types/finding';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert a base64 data URL to a Uint8Array for docx ImageRun. */
function base64ToUint8Array(base64: string): Uint8Array {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Load an image from a URL and return its base64 data. */
async function loadImageAsBase64(src: string): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
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

// ── Constants ──────────────────────────────────────────────────────────────
const THEME_BLUE = '00599C';
const DARK = '1E293B';
const LIGHT_GRAY = 'F1F5F9';
const WHITE = 'FFFFFF';
const AMBER = 'F59E0B';

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
} as const;

// ── Main Export Function ───────────────────────────────────────────────────

export async function exportFindingsToWord(findings: FindingRecord[]): Promise<void> {
  // Load logos
  const [neutraLogo, dmeLogo] = await Promise.all([
    loadImageAsBase64((await import('@/assets/logo_neutradc.png')).default),
    loadImageAsBase64((await import('@/assets/logo_dwimitra_v2.png')).default),
  ]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // ── Build header table ─────────────────────────────────────────────────
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorder,
    rows: [
      new TableRow({
        children: [
          // Left logo cell
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: thinBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: neutraLogo.length > 0
                  ? [new ImageRun({ data: neutraLogo, transformation: { width: 100, height: 45 }, type: 'png' })]
                  : [new TextRun({ text: 'NEUTRA DC', bold: true, size: 18, color: THEME_BLUE })],
              }),
            ],
          }),
          // Center text cell
          new TableCell({
            width: { size: 64, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: thinBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: 'LAPORAN TEMUAN MAINTENANCE',
                    bold: true,
                    size: 28,
                    color: THEME_BLUE,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: 'MAINTENANCE FINDING REPORT',
                    bold: true,
                    size: 18,
                    color: DARK,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 20 },
                children: [
                  new TextRun({
                    text: `Tanggal: ${dateStr} | Total Temuan: ${findings.length} item`,
                    size: 16,
                    color: '64748B',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
          // Right logo cell
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: thinBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: dmeLogo.length > 0
                  ? [new ImageRun({ data: dmeLogo, transformation: { width: 90, height: 40 }, type: 'png' })]
                  : [new TextRun({ text: 'DME', bold: true, size: 18, color: THEME_BLUE })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // ── Build summary table ────────────────────────────────────────────────
  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: ['No.', 'Nama Part', 'No. Part', 'Brand', 'Qty', 'Remark', 'Tanggal'].map(
      (text, idx) =>
        new TableCell({
          width: {
            size: [6, 22, 15, 15, 7, 22, 13][idx],
            type: WidthType.PERCENTAGE,
          },
          shading: { type: ShadingType.SOLID, color: THEME_BLUE, fill: THEME_BLUE },
          verticalAlign: VerticalAlign.CENTER,
          borders: thinBorder,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text,
                  bold: true,
                  size: 18,
                  color: WHITE,
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        })
    ),
  });

  const tableDataRows = findings.map(
    (f, idx) =>
      new TableRow({
        children: [
          String(idx + 1),
          f.partName || '-',
          f.partNumber || '-',
          f.brandName || '-',
          String(f.quantity || 0),
          f.remark || '-',
          f.createdAt?.toDate?.()?.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }) || '-',
        ].map(
          (text, colIdx) =>
            new TableCell({
              verticalAlign: VerticalAlign.CENTER,
              borders: thinBorder,
              shading:
                idx % 2 === 1
                  ? { type: ShadingType.SOLID, color: LIGHT_GRAY, fill: LIGHT_GRAY }
                  : undefined,
              children: [
                new Paragraph({
                  alignment: colIdx === 0 || colIdx === 4 ? AlignmentType.CENTER : AlignmentType.LEFT,
                  spacing: { before: 30, after: 30 },
                  children: [
                    new TextRun({
                      text,
                      size: 17,
                      color: DARK,
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            })
        ),
      })
  );

  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...tableDataRows],
  });

  // ── Build photo documentation sections ─────────────────────────────────
  const photoSections: Paragraph[] = [];
  const findingsWithPhotos = findings.filter((f) => f.photos && f.photos.length > 0);

  if (findingsWithPhotos.length > 0) {
    photoSections.push(
      new Paragraph({ spacing: { before: 300 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({
            text: 'DOKUMENTASI FOTO TEMUAN',
            bold: true,
            size: 24,
            color: THEME_BLUE,
            font: 'Calibri',
          }),
        ],
      })
    );

    for (let fIdx = 0; fIdx < findingsWithPhotos.length; fIdx++) {
      const finding = findingsWithPhotos[fIdx];

      // Part info heading
      photoSections.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          shading: { type: ShadingType.SOLID, color: LIGHT_GRAY, fill: LIGHT_GRAY },
          border: {
            left: { style: BorderStyle.SINGLE, size: 6, color: THEME_BLUE },
          },
          indent: { left: 100 },
          children: [
            new TextRun({
              text: `${fIdx + 1}. ${finding.partName}`,
              bold: true,
              size: 20,
              color: DARK,
              font: 'Calibri',
            }),
            new TextRun({
              text: `   |   P/N: ${finding.partNumber}   |   Brand: ${finding.brandName || '-'}   |   Qty: ${finding.quantity}`,
              size: 16,
              color: '64748B',
              font: 'Calibri',
            }),
          ],
        })
      );

      // Photos
      for (const photo of finding.photos) {
        if (photo.base64) {
          const photoBytes = base64ToUint8Array(photo.base64);
          if (photoBytes.length > 0) {
            photoSections.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 40 },
                children: [
                  new ImageRun({
                    data: photoBytes,
                    transformation: { width: 400, height: 280 },
                    type: 'jpg',
                  }),
                ],
              })
            );
          }
        }

        if (photo.description) {
          photoSections.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: photo.description,
                  italics: true,
                  size: 16,
                  color: '64748B',
                  font: 'Calibri',
                }),
              ],
            })
          );
        }
      }
    }
  }

  // ── Create document ────────────────────────────────────────────────────
  const document = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 20,
            color: DARK,
          },
        },
        heading1: {
          run: {
            font: 'Calibri',
            size: 28,
            bold: true,
            color: THEME_BLUE,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,   // 0.5 inch
              bottom: 720,
              left: 1008,  // 0.7 inch
              right: 1008,
            },
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL,
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
                    text: 'CONFIDENTIAL — PT Dwimitra Ekatama Mandiri',
                    size: 14,
                    color: '94A3B8',
                    font: 'Calibri',
                    italics: true,
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
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'PT Dwimitra Ekatama Mandiri — Maintenance Finding Report — Halaman ',
                    size: 14,
                    color: '94A3B8',
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 14,
                    color: '94A3B8',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Header table
          headerTable,

          // Spacing
          new Paragraph({ spacing: { before: 200 } }),

          // Summary table heading
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: 'DAFTAR TEMUAN',
                bold: true,
                size: 22,
                color: THEME_BLUE,
                font: 'Calibri',
              }),
            ],
          }),

          // Summary table
          summaryTable,

          // Photo documentation
          ...photoSections,

          // Sign-off area
          new Paragraph({ spacing: { before: 400 } }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: 'Mengetahui,',
                size: 18,
                color: DARK,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({ spacing: { before: 600 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: '____________________________',
                size: 18,
                color: DARK,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Site Manager',
                size: 18,
                color: '64748B',
                font: 'Calibri',
              }),
            ],
          }),
        ],
      },
    ],
  });

  // ── Export ──────────────────────────────────────────────────────────────
  const blob = await Packer.toBlob(document);
  const dateFileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  saveAs(blob, `Laporan_Temuan_Maintenance_${dateFileName}.docx`);
}
