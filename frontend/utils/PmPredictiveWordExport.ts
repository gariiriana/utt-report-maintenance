// ============================================================================
// FILE: frontend/utils/PmPredictiveWordExport.ts
// Deskripsi: Dokumen Word (.docx) Predictive Report dari laporan Preventive
//            Maintenance. Isi dan urutan sama dengan PDF: satu unit (identitas &
//            nameplate, ringkasan eksekutif, bagian per equipment, dasar batas
//            acuan, lembar pengesahan) atau gabungan satu quarter (ringkasan periode,
//            satu bab per unit, satu dasar batas acuan & pengesahan). Kop surat dua
//            logo diulang di setiap halaman.
// ============================================================================

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, AlignmentType, ImageRun, Header, Footer, PageNumber, VerticalAlign,
} from 'docx';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import type { PmPredictiveReport, PmStatus } from '@/types/pmPredictiveTypes';
import { loadPmSourcePhotos, type PmSourcePhoto } from '@/utils/pmPredictiveService';
import { STATUS_LABEL, effectiveStatus, fmtDate } from '@/utils/pmPredictiveEngine';
import { normalizeReport } from '@/utils/pmPredictiveWorkflow';
import {
  METHOD_TEXT, nameplateText, paramRowText, exportParams, hasComparison, exportStatusText, sectionStatusLines,
  limitSourceRows, attentionText, collectPmExportPhotos, countExportPhotos, safeFileName, sortBundleReports,
  type PmExportPhoto, type PmExportPhotos, type PmBundleEntry, type PmBundlePeriod,
} from '@/utils/pmPredictiveExportShared';

const FONT = 'Calibri';
const COLOR_PRIMARY = '00599C';
const COLOR_SECONDARY = '991B1B';
const COLOR_DARK = '0F172A';
const COLOR_MUTED = '64748B';
const COLOR_LABEL_BG = 'F8FAFC';
const COLOR_BORDER = 'CBD5E1';
const HEADER_FILL = 'DCE6F1';
/** Lebar isi A4 dengan margin kiri-kanan 720 twip. */
const CONTENT_W = 10466;

const STATUS_HEX: Record<PmStatus, string> = {
  normal: '15803D', watch: 'B45309', warning: 'C2410C', alarm: 'B91C1C', unknown: '64748B',
};
const STATUS_FILL_HEX: Record<PmStatus, string> = {
  normal: 'DCFCE7', watch: 'FEF3C7', warning: 'FFEDD5', alarm: 'FEE2E2', unknown: 'F1F5F9',
};

const borderThin = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
} as const;

const borderNone = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
} as const;

/** Tanpa garis sama sekali, termasuk garis dalam antar sel (untuk kop surat). */
const tableBorderNone = {
  ...borderNone,
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
} as const;

function base64ToBytes(dataUrl: string): Uint8Array {
  const raw = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function loadLogo(src: string): Promise<Uint8Array> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 600;
        canvas.height = img.naturalHeight || 240;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(new Uint8Array());
        ctx.drawImage(img, 0, 0);
        resolve(base64ToBytes(canvas.toDataURL('image/png')));
      } catch {
        resolve(new Uint8Array());
      }
    };
    img.onerror = () => resolve(new Uint8Array());
    img.src = src;
  });
}

interface TextOpts {
  bold?: boolean;
  italics?: boolean;
  size?: number;
  color?: string;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  keepNext?: boolean;
  before?: number;
  after?: number;
}

/** Teks multi-baris ('\n') menjadi beberapa TextRun dengan line break. */
function runs(text: string, o: TextOpts = {}): TextRun[] {
  return (text ?? '').split('\n').map((line, i) => new TextRun({
    text: line,
    break: i > 0 ? 1 : undefined,
    bold: o.bold,
    italics: o.italics,
    size: o.size ?? 16,
    color: o.color ?? COLOR_DARK,
    font: FONT,
  }));
}

function para(text: string, o: TextOpts = {}): Paragraph {
  return new Paragraph({
    alignment: o.align,
    keepNext: o.keepNext,
    spacing: { before: o.before ?? 0, after: o.after ?? 0 },
    children: runs(text, o),
  });
}

interface CellOpts extends TextOpts {
  width: number;
  fill?: string;
  colSpan?: number;
  children?: Paragraph[];
}

function cell(text: string, o: CellOpts): TableCell {
  return new TableCell({
    width: { size: o.width, type: WidthType.DXA },
    columnSpan: o.colSpan,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
    borders: borderThin,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: o.children || [para(text, o)],
  });
}

function labelCell(text: string, width: number): TableCell {
  return cell(text, { width, fill: COLOR_LABEL_BG, bold: true });
}

function statusCell(status: PmStatus, text: string, width: number, size = 15): TableCell {
  return cell(text, { width, size, bold: true, color: STATUS_HEX[status], fill: STATUS_FILL_HEX[status], align: AlignmentType.CENTER });
}

function table(widths: number[], rows: TableRow[], noOuterBorders = false): Table {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: noOuterBorders ? tableBorderNone : undefined,
    rows,
  });
}

/** "1. JUDUL" untuk bab, "2.1 JUDUL" untuk sub-bab. */
function sectionHeading(num: string, title: string): Paragraph {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({ text: num.includes('.') ? `${num} ` : `${num}. `, bold: true, size: 22, color: COLOR_SECONDARY, font: FONT }),
      new TextRun({ text: title.toUpperCase(), bold: true, size: 22, color: COLOR_PRIMARY, font: FONT }),
    ],
  });
}

/** Judul bab unit pada laporan gabungan: selalu mulai di halaman baru. */
function chapterHeading(num: string, title: string, right: string): Paragraph {
  return new Paragraph({
    pageBreakBefore: true,
    keepNext: true,
    shading: { type: ShadingType.CLEAR, fill: COLOR_PRIMARY, color: 'auto' },
    spacing: { before: 0, after: 160 },
    children: [
      new TextRun({ text: ` ${num}. ${title}`, bold: true, size: 24, color: 'FFFFFF', font: FONT }),
      new TextRun({ text: `     ${right}`, bold: true, size: 17, color: 'DCE6F1', font: FONT }),
    ],
  });
}

const PHOTO_COLS = 3;
const PHOTO_CELL_W = Math.floor(CONTENT_W / PHOTO_COLS);
const PHOTO_MAX_W = 215; // px, muat di sel 1/3 lebar halaman
const PHOTO_MAX_H = 161;

/** Tabel foto 3 kolom; setiap sel berisi foto dan keterangannya. */
function photoTable(items: PmExportPhoto[]): Table {
  const rows: TableRow[] = [];
  for (let i = 0; i < items.length; i += PHOTO_COLS) {
    const slice = items.slice(i, i + PHOTO_COLS);
    rows.push(new TableRow({
      cantSplit: true,
      children: Array.from({ length: PHOTO_COLS }, (_, k) => {
        const p = slice[k];
        if (!p) return new TableCell({ width: { size: PHOTO_CELL_W, type: WidthType.DXA }, borders: borderNone, children: [new Paragraph({ children: [] })] });
        const ratio = Math.min(PHOTO_MAX_W / p.width, PHOTO_MAX_H / p.height);
        return cell('', {
          width: PHOTO_CELL_W,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new ImageRun({ type: 'jpg', data: base64ToBytes(p.dataUrl), transformation: { width: Math.round(p.width * ratio), height: Math.round(p.height * ratio) } })],
            }),
            para(p.caption, { size: 14, align: AlignmentType.CENTER, before: 40 }),
          ],
        });
      }),
    }));
  }
  // Garis hanya pada sel berfoto, sel kosong di baris terakhir tanpa garis.
  return table(Array(PHOTO_COLS).fill(PHOTO_CELL_W), rows, true);
}

function photoBlock(title: string, items: PmExportPhoto[]): (Paragraph | Table)[] {
  if (!items.length) return [];
  return [para(title, { bold: true, size: 16, color: '475569', keepNext: true, before: 120, after: 60 }), photoTable(items)];
}

async function exportPhotosOf(report: PmPredictiveReport, loaded?: PmSourcePhoto[]): Promise<PmExportPhotos> {
  let source = loaded && loaded.length ? loaded : [];
  if (!source.length) {
    source = await loadPmSourcePhotos(report.sourceDocId, report.sourceCollection).catch(err => {
      console.warn('Foto laporan PM tidak bisa dimuat untuk ekspor:', err);
      return [] as PmSourcePhoto[];
    });
  }
  return collectPmExportPhotos(report, source);
}

const headCell = (text: string, width: number, fill = COLOR_PRIMARY) => cell(text, { width, fill, bold: true, color: 'FFFFFF', size: 15 });

/** Identitas, ringkasan, dan analisis per equipment satu unit. */
function reportBlocks(report: PmPredictiveReport, photos: PmExportPhotos, nums: { identity: string; summary: string; analysis: string }): (Paragraph | Table)[] {
  const idW = [1900, 3333, 1900, 3333];
  const nameplate = nameplateText(report);
  const identity = table(idW, [
    new TableRow({ children: [labelCell('Nama Unit', idW[0]), cell(report.unitLabel, { width: idW[1], bold: true }), labelCell('Jenis Unit', idW[2]), cell(report.unitType, { width: idW[3] })] }),
    new TableRow({ children: [labelCell('Laporan PM', idW[0]), cell(report.maintenanceName, { width: idW[1] }), labelCell('Tanggal PM', idW[2]), cell(fmtDate(report.maintenanceDate), { width: idW[3] })] }),
    ...(nameplate ? [new TableRow({ children: [labelCell('Nameplate', idW[0]), cell(nameplate, { width: idW[1] + idW[2] + idW[3], colSpan: 3 })] })] : []),
  ]);

  const sumW = [2600, CONTENT_W - 2600];
  const overall = report.overallStatus;
  const summary = table(sumW, [
    new TableRow({ children: [labelCell('Status Keseluruhan', sumW[0]), statusCell(overall, exportStatusText(overall).toUpperCase(), sumW[1], 16)] }),
    new TableRow({ children: [labelCell('Status per Equipment', sumW[0]), cell(sectionStatusLines(report), { width: sumW[1] })] }),
    new TableRow({ children: [labelCell('Ringkasan', sumW[0]), cell(report.summary.ringkasan || '-', { width: sumW[1] })] }),
    new TableRow({ children: [labelCell('Prioritas Tindakan', sumW[0]), cell(report.summary.prioritas.filter(p => p.trim()).map((p, i) => `${i + 1}. ${p}`).join('\n') || '-', { width: sumW[1] })] }),
  ]);

  const compare = hasComparison(report);
  const paramW = compare ? [1900, 1000, 1400, 1400, CONTENT_W - 6900, 1200] : [2600, 1300, CONTENT_W - 5200, 1300];
  const paramHead = compare ? ['Parameter', 'Nilai', 'Sebelumnya', 'Perubahan / Tren', 'Batas Acuan', 'Status'] : ['Parameter', 'Nilai', 'Batas Acuan', 'Status'];
  const visW = [2600, 1600, CONTENT_W - 4200];
  const narW = [2200, CONTENT_W - 2200];
  const equipmentBlocks = report.sections.flatMap((section, i) => {
    const status = effectiveStatus(section);
    const blocks: (Paragraph | Table)[] = [
      new Paragraph({
        keepNext: true,
        spacing: { before: 200, after: 40 },
        children: [
          new TextRun({ text: `${nums.analysis}.${i + 1}  ${section.name}`, bold: true, size: 20, color: COLOR_DARK, font: FONT }),
          ...(status !== 'unknown' ? [new TextRun({ text: `   •   Status: ${STATUS_LABEL[status]}`, bold: true, size: 18, color: STATUS_HEX[status], font: FONT })] : []),
        ],
      }),
      para(section.role, { italics: true, size: 15, color: COLOR_MUTED, keepNext: true, after: 80 }),
    ];
    const params = exportParams(section);
    if (params.length) {
      blocks.push(table(paramW, [
        new TableRow({ tableHeader: true, children: paramHead.map((h, k) => headCell(h, paramW[k])) }),
        ...params.map(p => {
          const row = paramRowText(p);
          const label = cell(row.label, { width: paramW[0], size: 15 });
          const value = cell(row.value, { width: paramW[1], size: 15, bold: true, align: AlignmentType.CENTER });
          return new TableRow({
            cantSplit: true,
            children: compare
              ? [label, value,
                cell(row.previous, { width: paramW[2], size: 15, align: AlignmentType.CENTER }),
                cell(row.change, { width: paramW[3], size: 15, align: AlignmentType.CENTER }),
                cell(row.limit, { width: paramW[4], size: 14 }),
                statusCell(row.status, row.statusText, paramW[5])]
              : [label, value,
                cell(row.limit, { width: paramW[2], size: 14 }),
                statusCell(row.status, row.statusText, paramW[3])],
          });
        }),
      ]));
      blocks.push(para('', { after: 60 }));
    }
    if (section.visuals.length) {
      blocks.push(table(visW, [
        new TableRow({ tableHeader: true, children: ['Observasi Visual', 'Kondisi', 'Keterangan'].map((h, k) => headCell(h, visW[k], '475569')) }),
        ...section.visuals.map(v => new TableRow({
          cantSplit: true,
          children: [cell(v.cardLabel, { width: visW[0] }), cell(v.condition, { width: visW[1] }), cell(v.observation || '-', { width: visW[2] })],
        })),
      ]));
      blocks.push(para('', { after: 60 }));
    }
    blocks.push(table(narW, [
      new TableRow({ children: [labelCell('Kondisi Saat Ini', narW[0]), cell(section.narrative.kondisi || '-', { width: narW[1] })] }),
      new TableRow({ children: [labelCell('Analisis Tren', narW[0]), cell(section.narrative.analisisTren || '-', { width: narW[1] })] }),
      new TableRow({ children: [labelCell('Prediksi & Risiko', narW[0]), cell(section.narrative.prediksiRisiko || '-', { width: narW[1] })] }),
      new TableRow({ children: [labelCell('Rekomendasi', narW[0]), cell(section.narrative.rekomendasi.filter(r => r.trim()).map((r, k) => `${k + 1}. ${r}`).join('\n') || '-', { width: narW[1] })] }),
    ]));
    blocks.push(...photoBlock(`Dokumentasi foto – ${section.name}`, photos.bySection[section.id] || []));
    return blocks;
  });

  return [
    sectionHeading(nums.identity, 'Identitas Unit & Laporan PM'),
    identity,
    ...photoBlock('Foto nameplate', photos.nameplate),
    sectionHeading(nums.summary, 'Ringkasan Eksekutif'),
    summary,
    sectionHeading(nums.analysis, 'Analisis Prediktif per Equipment'),
    ...equipmentBlocks,
  ];
}

/** Dasar batas acuan & metode (kosong bila tidak ada parameter yang dicetak). */
function limitBlocks(reports: PmPredictiveReport[], num: string): (Paragraph | Table)[] {
  const rows = limitSourceRows(reports);
  if (!rows.length) return [];
  const srcW = [2600, CONTENT_W - 2600];
  return [
    sectionHeading(num, 'Dasar Batas Acuan & Metode'),
    table(srcW, [
      new TableRow({ tableHeader: true, children: [cell('Parameter', { width: srcW[0], bold: true, fill: 'F1F5F9' }), cell('Sumber / Dasar Batas Acuan', { width: srcW[1], bold: true, fill: 'F1F5F9' })] }),
      ...rows.map(([labels, source]) => new TableRow({ cantSplit: true, children: [cell(labels, { width: srcW[0], size: 15 }), cell(source, { width: srcW[1], size: 15 })] })),
    ]),
    para(METHOD_TEXT, { size: 15, color: '475569', before: 100 }),
  ];
}

function signatureBlocks(sig: PmPredictiveReport['signatures'], num: string): (Paragraph | Table)[] {
  const half = Math.floor(CONTENT_W / 2);
  const sigW = [half, CONTENT_W - half];
  const sigHead = (text: string, width: number, colSpan?: number) => cell(text, { width, colSpan, fill: HEADER_FILL, bold: true, align: AlignmentType.CENTER, keepNext: true });
  const sigBox = (s: { name: string; title: string }, width: number, colSpan?: number) => cell('', {
    width,
    colSpan,
    children: [
      para('\n\n', { keepNext: true }),
      para(s.name, { bold: true, align: AlignmentType.CENTER, keepNext: true }),
      para(s.title, { align: AlignmentType.CENTER, keepNext: true }),
    ],
  });
  return [
    sectionHeading(num, 'Lembar Pengesahan Resmi'),
    para(`AUTHOR BY, ${sig.authorName}`, { bold: true, size: 18, keepNext: true, after: 80 }),
    table(sigW, [
      new TableRow({ cantSplit: true, children: [sigHead('PREPARED BY,', sigW[0]), sigHead('REVIEWED BY,', sigW[1])] }),
      new TableRow({ cantSplit: true, children: [sigBox(sig.preparedBy, sigW[0]), sigBox(sig.reviewedBy, sigW[1])] }),
      new TableRow({ cantSplit: true, children: [sigHead('ACKNOWLEDGED BY,', CONTENT_W, 2)] }),
      new TableRow({ cantSplit: true, children: [sigBox(sig.acknowledgedBy1, sigW[0]), sigBox(sig.acknowledgedBy2, sigW[1])] }),
      new TableRow({ cantSplit: true, children: [sigHead('APPROVED BY,', CONTENT_W, 2)] }),
      new TableRow({ cantSplit: true, children: [sigBox(sig.approvedBy, CONTENT_W, 2)] }),
    ]),
  ];
}

/** Dokumen A4 dengan kop surat dua logo dan nomor halaman di setiap halaman. */
async function buildDocument(title: string, headerLine: string, footerLabel: string, children: (Paragraph | Table)[]): Promise<Blob> {
  const [logoDme, logoNdc] = await Promise.all([loadLogo(logoDwimitra), loadLogo(logoNeutraDC)]);
  const logoCell = (bytes: Uint8Array, fallback: string, align: (typeof AlignmentType)[keyof typeof AlignmentType]) => new TableCell({
    width: { size: 2300, type: WidthType.DXA },
    borders: borderNone,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: align,
      children: bytes.length
        ? [new ImageRun({ type: 'png', data: bytes, transformation: { width: 110, height: 42 } })]
        : runs(fallback, { bold: true, size: 18, color: COLOR_PRIMARY }),
    })],
  });
  const headerTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2300, CONTENT_W - 4600, 2300],
    borders: tableBorderNone,
    rows: [new TableRow({
      children: [
        logoCell(logoDme, 'PT DME', AlignmentType.LEFT),
        new TableCell({
          width: { size: CONTENT_W - 4600, type: WidthType.DXA },
          borders: borderNone,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            para('PT DWIMITRA EKATAMA MANDIRI', { bold: true, size: 20, align: AlignmentType.CENTER }),
            para('PREDICTIVE MAINTENANCE REPORT', { bold: true, size: 24, color: COLOR_SECONDARY, align: AlignmentType.CENTER }),
            para('DATA CENTER NEUTRA DC CIKARANG', { bold: true, size: 18, color: COLOR_PRIMARY, align: AlignmentType.CENTER }),
            para(headerLine, { size: 14, color: COLOR_MUTED, align: AlignmentType.CENTER }),
          ],
        }),
        logoCell(logoNdc, 'NeutraDC', AlignmentType.RIGHT),
      ],
    })],
  });
  const divider = new Paragraph({
    spacing: { before: 60, after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: COLOR_PRIMARY } },
    children: [],
  });
  const doc = new Document({
    creator: 'DwimitraSystem',
    title,
    sections: [{
      properties: {
        page: { margin: { top: 2100, bottom: 900, left: 720, right: 720, header: 360, footer: 360 } },
      },
      headers: { default: new Header({ children: [headerTable, divider] }) },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: `${footerLabel}  |  Halaman `, size: 14, color: COLOR_MUTED, font: FONT }),
              new TextRun({ children: [PageNumber.CURRENT], size: 14, color: COLOR_MUTED, font: FONT }),
              new TextRun({ text: ' dari ', size: 14, color: COLOR_MUTED, font: FONT }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: COLOR_MUTED, font: FONT }),
            ],
          })],
        }),
      },
      children,
    }],
  });
  return Packer.toBlob(doc);
}

export async function exportPmPredictiveToDocx(stored: PmPredictiveReport, loadedPhotos?: PmSourcePhoto[]): Promise<void> {
  const toastId = toast.loading('Membuat DOCX Predictive Report...');
  try {
    const report = normalizeReport(stored);
    const photos = await exportPhotosOf(report, loadedPhotos);
    const limits = limitBlocks([report], '4');
    const blob = await buildDocument(
      `Predictive Report ${report.unitLabel}`,
      `Berbasis PM ${fmtDate(report.maintenanceDate)}`,
      `Predictive Report PM — ${report.unitLabel}`,
      [
        ...reportBlocks(report, photos, { identity: '1', summary: '2', analysis: '3' }),
        ...limits,
        ...signatureBlocks(report.signatures, limits.length ? '5' : '4'),
      ],
    );
    saveAs(blob, `Predictive_Report_${safeFileName(report.unitLabel) || 'Unit'}_${report.maintenanceDate}.docx`);
    toast.success(countExportPhotos(photos) ? 'DOCX Predictive Report berhasil diunduh' : 'DOCX diunduh tanpa foto (foto laporan PM tidak bisa dimuat)', { id: toastId });
  } catch (error: any) {
    console.error('exportPmPredictiveToDocx error:', error);
    toast.error(`Gagal membuat DOCX: ${error?.message || 'error tidak diketahui'}`, { id: toastId });
  }
}

/** Satu DOCX untuk seluruh predictive satu quarter: ringkasan periode lalu satu bab per unit. */
export async function exportPmPredictiveBundleToDocx(entries: PmBundleEntry[], period: PmBundlePeriod): Promise<void> {
  if (!entries.length) return;
  const toastId = toast.loading(`Membuat DOCX gabungan ${period.label}...`);
  try {
    const sorted = sortBundleReports(entries.map(e => ({ ...e, report: normalizeReport(e.report) })));
    const reports = sorted.map(e => e.report);
    const sumW = [800, 2900, 1500, 1500, CONTENT_W - 6700];
    const children: (Paragraph | Table)[] = [
      sectionHeading('1', `Ringkasan Periode ${period.label}`),
      para(`Predictive maintenance report untuk ${reports.length} unit ${reports[0].unitType} berdasarkan hasil Preventive Maintenance periode ${period.label} (${period.months}). Rincian setiap unit disajikan pada bab berikutnya.`, { size: 17, after: 120 }),
      table(sumW, [
        new TableRow({ tableHeader: true, children: ['Bab', 'Unit', 'Tanggal PM', 'Status', 'Equipment Perlu Perhatian'].map((h, k) => headCell(h, sumW[k])) }),
        ...reports.map((r, k) => new TableRow({
          cantSplit: true,
          children: [
            cell(String(k + 2), { width: sumW[0], align: AlignmentType.CENTER }),
            cell(r.unitLabel, { width: sumW[1], bold: true }),
            cell(fmtDate(r.maintenanceDate), { width: sumW[2], align: AlignmentType.CENTER }),
            statusCell(r.overallStatus, exportStatusText(r.overallStatus), sumW[3], 16),
            cell(attentionText(r), { width: sumW[4] }),
          ],
        })),
      ]),
    ];

    let photoTotal = 0;
    for (let k = 0; k < sorted.length; k++) {
      const { report, photos } = sorted[k];
      toast.loading(`Membuat DOCX gabungan ${period.label} (${k + 1}/${sorted.length})...`, { id: toastId });
      const exportPhotos = await exportPhotosOf(report, photos);
      photoTotal += countExportPhotos(exportPhotos);
      const chapter = String(k + 2);
      children.push(
        chapterHeading(chapter, report.unitLabel, `PM ${fmtDate(report.maintenanceDate)}`),
        ...reportBlocks(report, exportPhotos, { identity: `${chapter}.1`, summary: `${chapter}.2`, analysis: `${chapter}.3` }),
      );
    }

    const next = sorted.length + 2;
    const limits = limitBlocks(reports, String(next));
    children.push(
      new Paragraph({ pageBreakBefore: true, children: [] }),
      ...limits,
      ...signatureBlocks(reports[0].signatures, String(limits.length ? next + 1 : next)),
    );

    const blob = await buildDocument(
      `Predictive Report ${period.label}`,
      `Periode ${period.label} (${period.months})`,
      `Predictive Report PM ${period.label}`,
      children,
    );
    saveAs(blob, `Predictive_Report_${safeFileName(reports[0].profileId.toUpperCase())}_${safeFileName(period.label)}.docx`);
    toast.success(photoTotal ? `DOCX gabungan ${period.label} (${reports.length} unit) berhasil diunduh` : 'DOCX gabungan diunduh tanpa foto (foto laporan PM tidak bisa dimuat)', { id: toastId });
  } catch (error: any) {
    console.error('exportPmPredictiveBundleToDocx error:', error);
    toast.error(`Gagal membuat DOCX gabungan: ${error?.message || 'error tidak diketahui'}`, { id: toastId });
  }
}
