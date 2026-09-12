// ============================================================================
// FILE: frontend/utils/AbnormalRecapWordExport.ts
// Deskripsi: Generator Dokumen Microsoft Word (.DOCX) Resmi untuk Rekapitulasi
//            Temuan Kondisi Abnormal & Rekomendasi Pemeliharaan Data Center.
//            Dilengkapi:
//            - Kop Surat Resmi: Logo Dwimitra (Kiri) & Logo NeutraDC (Kanan)
//            - Ringkasan Eksekutif KPI & Informasi Periode Rekapitulasi
//            - Matriks Tabel Temuan Abnormal
//            - Lembar Detail Lengkap per Laporan Temuan (Unit, Pelapor, Tanggal,
//              Deskripsi Kerusakan, Rekomendasi Tindakan, & Embed Foto Bukti Fisik)
//            - Lembar Pengesahan Resmi (QC DME & Site Manager)
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
  HeadingLevel,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  VerticalAlign,
} from 'docx';
import { saveAs } from 'file-saver';
import { AbnormalItem } from '../components/AbnormalFindingsCenter';

// Helper konversi base64 string ke Uint8Array untuk ImageRun docx
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

// Helper untuk menghitung dimensi asli gambar agar aspect ratio terjaga sempurna
function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width || 600,
        height: img.naturalHeight || img.height || 450,
      });
    };
    img.onerror = () => resolve({ width: 600, height: 450 });
    img.src = base64;
  });
}

// Helper memuat file gambar aset lokal ke Uint8Array
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

// Skema Warna Standar Dokumen
const COLOR_PRIMARY_RED = '991B1B'; // Merah Resmi Temuan Abnormal / QC DME
const COLOR_SECONDARY_BLUE = '00599C'; // Biru NeutraDC
const COLOR_DARK = '0F172A'; // Slate 900
const COLOR_MUTED = '64748B'; // Slate 500
const COLOR_LIGHT_BG = 'F8FAFC'; // Slate 50
const COLOR_ROSE_BG = 'FFF1F2'; // Rose 50
const COLOR_GREEN_BG = 'F0FDF4'; // Emerald 50
const COLOR_BORDER = 'CBD5E1'; // Slate 300
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

export interface ExportAbnormalWordOptions {
  periodLabel?: string; // e.g. "Agustus 2026" atau "Semua Periode"
  printedBy?: string; // e.g. "Quality Control DME (qcdme@dme.com)"
}

/**
 * Ekspor data temuan abnormal ke dokumen Word (.DOCX) lengkap
 * dengan Kop Surat Resmi (Logo Dwimitra & NeutraDC), Detail per Laporan,
 * Deskripsi Temuan, Rekomendasi, dan Lampiran Foto Bukti Fisik.
 */
export async function exportAbnormalRecapToWord(
  items: AbnormalItem[],
  options: ExportAbnormalWordOptions = {}
): Promise<void> {
  const periodLabel = options.periodLabel || 'Semua Periode';
  const printedBy = options.printedBy || 'Quality Control DME (qcdme@dme.com)';

  // 1. Muat Logo Dwimitra (Kiri) dan Logo NeutraDC (Kanan)
  const [dmeLogo, neutraLogo] = await Promise.all([
    loadAssetImage((await import('@/assets/logo_dwimitra_v2.png')).default),
    loadAssetImage((await import('@/assets/logo_neutradc.png')).default),
  ]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Hitung Statistik
  const totalFindings = items.length;
  const withPhotoCount = items.filter((i) => Boolean(i.abnormalFinding?.photoBase64)).length;
  const withRecoCount = items.filter((i) => Boolean(i.abnormalFinding?.actionRecommendation?.trim())).length;
  const uniqueAccountsCount = new Set(items.map((i) => i.createdBy)).size;

  // 2. KOP SURAT RESMI (Tabel 3 Kolom: Logo Dwimitra - Judul - Logo NeutraDC)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: [
      new TableRow({
        children: [
          // Logo Kiri: PT Dwimitra Ekatama Mandiri
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderThin,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: dmeLogo.length > 0
                  ? [new ImageRun({ data: dmeLogo, transformation: { width: 110, height: 48 }, type: 'png' })]
                  : [new TextRun({ text: 'PT DWIMITRA', bold: true, size: 18, color: COLOR_PRIMARY_RED, font: 'Calibri' })],
              }),
            ],
          }),
          // Judul Tengah Dokumen
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderThin,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 30 },
                children: [
                  new TextRun({
                    text: 'REKAPITULASI TEMUAN KONDISI ABNORMAL',
                    bold: true,
                    size: 24,
                    color: COLOR_PRIMARY_RED,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 30 },
                children: [
                  new TextRun({
                    text: 'DATA CENTER NEUTRADc CIKARANG',
                    bold: true,
                    size: 18,
                    color: COLOR_SECONDARY_BLUE,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 20 },
                children: [
                  new TextRun({
                    text: `Periode: ${periodLabel} | Total Temuan: ${totalFindings} Unit/Item`,
                    bold: true,
                    size: 16,
                    color: COLOR_DARK,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `Dicetak: ${dateStr}, ${timeStr} WIB oleh ${printedBy}`,
                    size: 14,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
          // Logo Kanan: NeutraDC
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderThin,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: neutraLogo.length > 0
                  ? [new ImageRun({ data: neutraLogo, transformation: { width: 110, height: 48 }, type: 'png' })]
                  : [new TextRun({ text: 'NEUTRA DC', bold: true, size: 18, color: COLOR_SECONDARY_BLUE, font: 'Calibri' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 3. TABEL RINGKASAN EKSEKUTIF (KPI CARDS DI WORD)
  const kpiTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderThin,
    rows: [
      new TableRow({
        children: [
          { label: 'TOTAL TEMUAN ABNORMAL', val: `${totalFindings} Unit`, color: COLOR_PRIMARY_RED },
          { label: 'AKUN ENGINEER TERLIBAT', val: `${uniqueAccountsCount} Akun`, color: COLOR_SECONDARY_BLUE },
          { label: 'DENGAN FOTO BUKTI', val: `${withPhotoCount} Unit`, color: '166534' }, // Green 800
          { label: 'MEMILIKI REKOMENDASI', val: `${withRecoCount} Item`, color: '0369A1' }, // Sky 700
        ].map((kpi) =>
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: borderThin,
            shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 20 },
                children: [
                  new TextRun({
                    text: kpi.label,
                    bold: true,
                    size: 14,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 10, after: 40 },
                children: [
                  new TextRun({
                    text: kpi.val,
                    bold: true,
                    size: 24,
                    color: kpi.color,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          })
        ),
      }),
    ],
  });

  // 4. TABEL MATRIKS DAFTAR TEMUAN (TABEL REKAPITULASI CEPAT)
  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      'No',
      'Nama Unit / Peralatan',
      'Laporan Pemeliharaan',
      'Tanggal',
      'Akun Maintenance',
      'Foto',
    ].map((text, idx) =>
      new TableCell({
        width: {
          size: [5, 26, 28, 14, 20, 7][idx],
          type: WidthType.PERCENTAGE,
        },
        shading: { type: ShadingType.SOLID, color: COLOR_PRIMARY_RED, fill: COLOR_PRIMARY_RED },
        verticalAlign: VerticalAlign.CENTER,
        borders: borderThin,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 50, after: 50 },
            children: [
              new TextRun({
                text,
                bold: true,
                size: 16,
                color: COLOR_WHITE,
                font: 'Calibri',
              }),
            ],
          }),
        ],
      })
    ),
  });

  const tableDataRows = items.map((item, idx) => {
    const unitName = item.abnormalFinding?.unitName || item.specificDetail || item.maintenanceName;
    const hasPhoto = Boolean(item.abnormalFinding?.photoBase64);

    return new TableRow({
      children: [
        String(idx + 1),
        unitName,
        item.maintenanceName,
        item.maintenanceTime || '-',
        item.createdBy,
        hasPhoto ? 'Ada' : 'Tidak',
      ].map((text, colIdx) =>
        new TableCell({
          verticalAlign: VerticalAlign.CENTER,
          borders: borderThin,
          shading:
            idx % 2 === 1
              ? { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG }
              : undefined,
          children: [
            new Paragraph({
              alignment: colIdx === 0 || colIdx === 3 || colIdx === 5 ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: { before: 30, after: 30 },
              children: [
                new TextRun({
                  text,
                  size: 15,
                  color: COLOR_DARK,
                  font: 'Calibri',
                  bold: colIdx === 1,
                }),
              ],
            }),
          ],
        })
      ),
    });
  });

  const summaryMatrixTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...tableDataRows],
  });

  // 5. BAGIAN DETAIL PER LAPORAN TEMUAN ABNORMAL (LENGKAP DESKRIPSI, REKOMENDASI, & FOTO)
  const detailReportParagraphs: (Paragraph | Table)[] = [];

  detailReportParagraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 150 },
      children: [
        new TextRun({
          text: 'RINCIAN DETAIL TEMUAN ABNORMAL & TINDAK LANJUT',
          bold: true,
          size: 22,
          color: COLOR_PRIMARY_RED,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: 'Rincian kondisi kerusakan, anomali pengukuran, dan rekomendasi teknis per unit peralatan beserta bukti dokumentasi fisik.',
          size: 16,
          color: COLOR_MUTED,
          font: 'Calibri',
          italics: true,
        }),
      ],
    })
  );

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const unitName = item.abnormalFinding?.unitName || item.specificDetail || item.maintenanceName;
    const descText = item.abnormalFinding?.description || '-';
    const recoText = item.abnormalFinding?.actionRecommendation || 'Belum ada rekomendasi tindakan khusus.';
    const photoB64 = item.abnormalFinding?.photoBase64;

    // Header Card Unit Temuan
    detailReportParagraphs.push(
      new Paragraph({
        spacing: { before: 250, after: 80 },
        shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
        border: {
          left: { style: BorderStyle.SINGLE, size: 8, color: COLOR_PRIMARY_RED },
          top: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
          right: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
        },
        indent: { left: 120 },
        children: [
          new TextRun({
            text: `[#${idx + 1}] TEMUAN: ${unitName.toUpperCase()}`,
            bold: true,
            size: 19,
            color: COLOR_PRIMARY_RED,
            font: 'Calibri',
          }),
          new TextRun({
            text: `   |   STATUS: KONDISI ABNORMAL`,
            bold: true,
            size: 15,
            color: 'B91C1C',
            font: 'Calibri',
          }),
        ],
      })
    );

    // Tabel Metadata Temuan
    const metaTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: borderThin,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
              borders: borderThin,
              children: [
                new Paragraph({
                  spacing: { before: 20, after: 20 },
                  children: [new TextRun({ text: 'Laporan Pemeliharaan', bold: true, size: 15, color: COLOR_DARK, font: 'Calibri' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 75, type: WidthType.PERCENTAGE },
              borders: borderThin,
              children: [
                new Paragraph({
                  spacing: { before: 20, after: 20 },
                  children: [new TextRun({ text: `${item.maintenanceName} (${item.fileName})`, size: 15, color: COLOR_DARK, font: 'Calibri' })],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color: COLOR_LIGHT_BG, fill: COLOR_LIGHT_BG },
              borders: borderThin,
              children: [
                new Paragraph({
                  spacing: { before: 20, after: 20 },
                  children: [new TextRun({ text: 'Tanggal & Pelapor', bold: true, size: 15, color: COLOR_DARK, font: 'Calibri' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 75, type: WidthType.PERCENTAGE },
              borders: borderThin,
              children: [
                new Paragraph({
                  spacing: { before: 20, after: 20 },
                  children: [
                    new TextRun({
                      text: `Tanggal: ${item.maintenanceTime || '-'}   |   Akun Engineer: ${item.createdBy} (${item.abnormalFinding?.reportedBy || 'Teknisi Lapangan'})`,
                      size: 15,
                      color: COLOR_DARK,
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
    detailReportParagraphs.push(metaTable);

    // Callout Box: Deskripsi Temuan / Kerusakan Abnormal
    detailReportParagraphs.push(
      new Paragraph({
        spacing: { before: 80, after: 20 },
        children: [
          new TextRun({
            text: 'Deskripsi Temuan / Kerusakan Abnormal:',
            bold: true,
            size: 16,
            color: COLOR_PRIMARY_RED,
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 30, after: 80 },
        shading: { type: ShadingType.SOLID, color: COLOR_ROSE_BG, fill: COLOR_ROSE_BG },
        border: {
          left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PRIMARY_RED },
          top: { style: BorderStyle.SINGLE, size: 1, color: 'FECDD3' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'FECDD3' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'FECDD3' },
        },
        indent: { left: 100 },
        children: [
          new TextRun({
            text: descText,
            size: 15,
            color: '881337', // Rose 900
            font: 'Calibri',
          }),
        ],
      })
    );

    // Callout Box: Rekomendasi / Tindakan Lanjutan
    detailReportParagraphs.push(
      new Paragraph({
        spacing: { before: 40, after: 20 },
        children: [
          new TextRun({
            text: 'Rekomendasi / Tindakan Lanjutan:',
            bold: true,
            size: 16,
            color: '047857', // Emerald 700
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 30, after: 100 },
        shading: { type: ShadingType.SOLID, color: COLOR_GREEN_BG, fill: COLOR_GREEN_BG },
        border: {
          left: { style: BorderStyle.SINGLE, size: 6, color: '059669' },
          top: { style: BorderStyle.SINGLE, size: 1, color: 'A7F3D0' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'A7F3D0' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'A7F3D0' },
        },
        indent: { left: 100 },
        children: [
          new TextRun({
            text: recoText,
            size: 15,
            color: '064E3B', // Emerald 900
            font: 'Calibri',
          }),
        ],
      })
    );

    // Lampiran Foto Bukti Temuan (Embed ImageRun jika tersedia)
    if (photoB64) {
      const photoBytes = base64ToUint8Array(photoB64);
      if (photoBytes.length > 0) {
        const dims = await getImageDimensions(photoB64);
        const maxWidth = 460;
        const maxHeight = 340;
        let drawW = maxWidth;
        let drawH = (dims.height / dims.width) * maxWidth;

        if (drawH > maxHeight) {
          drawH = maxHeight;
          drawW = (dims.width / dims.height) * maxHeight;
        }

        detailReportParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 30 },
            children: [
              new ImageRun({
                data: photoBytes,
                transformation: { width: Math.round(drawW), height: Math.round(drawH) },
                type: 'jpg',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 150 },
            children: [
              new TextRun({
                text: `Gambar ${idx + 1}: Foto Dokumentasi Bukti Fisik Temuan Abnormal — ${unitName}`,
                italics: true,
                size: 14,
                color: COLOR_MUTED,
                font: 'Calibri',
              }),
            ],
          })
        );
      }
    } else {
      detailReportParagraphs.push(
        new Paragraph({
          spacing: { before: 40, after: 150 },
          children: [
            new TextRun({
              text: 'Catatan: Tidak ada lampiran foto dokumentasi fisik untuk unit ini.',
              italics: true,
              size: 14,
              color: COLOR_MUTED,
              font: 'Calibri',
            }),
          ],
        })
      );
    }

    // Garis pembatas tipis antar laporan (kecuali yang terakhir)
    if (idx < items.length - 1) {
      detailReportParagraphs.push(
        new Paragraph({
          spacing: { before: 100, after: 150 },
          border: { bottom: { style: BorderStyle.DASHED, size: 2, color: COLOR_BORDER } },
          children: [],
        })
      );
    }
  }

  // 6. LEMBAR PENGESAHAN / TANDA TANGAN RESMI
  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Disiapkan dan Diverifikasi Oleh,',
                    size: 16,
                    color: COLOR_DARK,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 600 },
                children: [
                  new TextRun({
                    text: 'Quality Control DME (PT Dwimitra Ekatama Mandiri)',
                    bold: true,
                    size: 16,
                    color: COLOR_PRIMARY_RED,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '( _____________________________________ )',
                    bold: true,
                    size: 16,
                    color: COLOR_DARK,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Tim Quality Control Data Center',
                    size: 14,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: borderNone,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Mengetahui dan Menyetujui,',
                    size: 16,
                    color: COLOR_DARK,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 600 },
                children: [
                  new TextRun({
                    text: 'Site Manager / Facility Management NeutraDC',
                    bold: true,
                    size: 16,
                    color: COLOR_SECONDARY_BLUE,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '( _____________________________________ )',
                    bold: true,
                    size: 16,
                    color: COLOR_DARK,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'NeutraDC HDC Cikarang',
                    size: 14,
                    color: COLOR_MUTED,
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

  // 7. SUSUN DOKUMEN DOCX UTAMA
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 20,
            color: COLOR_DARK,
          },
        },
        heading1: {
          run: {
            font: 'Calibri',
            size: 24,
            bold: true,
            color: COLOR_PRIMARY_RED,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch
              bottom: 720,
              left: 900, // ~0.625 inch
              right: 900,
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
                    text: 'DOKUMEN RESMI — PT DWIMITRA EKATAMA MANDIRI & NEUTRADc CIKARANG',
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
                    text: `Rekapitulasi Temuan Abnormal Pemeliharaan — Periode: ${periodLabel} — Halaman `,
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
          // Kop Surat
          headerTable,

          new Paragraph({ spacing: { before: 180, after: 100 } }),

          // KPI Box Table
          kpiTable,

          new Paragraph({ spacing: { before: 200, after: 100 } }),

          // Heading Matriks Rekap
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 150, after: 100 },
            children: [
              new TextRun({
                text: 'DAFTAR REKAPITULASI TEMUAN ABNORMAL',
                bold: true,
                size: 20,
                color: COLOR_PRIMARY_RED,
                font: 'Calibri',
              }),
            ],
          }),

          // Tabel Matriks
          summaryMatrixTable,

          // Rincian Detail per Laporan
          ...detailReportParagraphs,

          new Paragraph({ spacing: { before: 300, after: 150 } }),

          // Lembar Tanda Tangan
          signatureTable,
        ],
      },
    ],
  });

  // 8. PACK & SIMPAN FILE DOCX
  const blob = await Packer.toBlob(doc);
  const cleanPeriod = periodLabel.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
  const fileName = `Rekap_Temuan_Abnormal_${cleanPeriod}_${now.toISOString().split('T')[0]}.docx`;

  saveAs(blob, fileName);
}
