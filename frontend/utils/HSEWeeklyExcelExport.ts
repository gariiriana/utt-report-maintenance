// ============================================================================
// FILE: HSEWeeklyExcelExport.ts
// Deskripsi: Menyusun HSE Weekly Report dalam SATU worksheet Excel bergaya
//            laporan resmi (warna netral, satu warna aksen) lengkap dengan foto
//            dokumentasi setiap laporan. Urutan isi:
//              Kop + ringkasan angka
//              Aktivitas Harian            | Ringkasan Temuan K3
//              1. HSE Inspection Report    (lebar penuh, foto per baris)
//              2. Absen TBM                | 3. Safety Induction
//              4. Temuan K3                (foto temuan & foto tindak lanjut)
//              Catatan (opsional)
//            Foto disisipkan sebagai thumbnail di dalam sel; file aslinya tetap
//            ikut tersimpan sehingga bisa diperbesar di Excel.
//            Tanpa import aset / DOM agar bisa diuji di Node.
// ============================================================================

import ExcelJS from 'exceljs';
import {
  INSPECTION_CHECKS,
  formatDate,
  formatDayLabel,
  formatWeekLabel,
  todayYmd,
  type HSEWeekRange,
  type HSEWeeklyFinding,
  type HSEWeeklyReport,
} from './hseWeeklyReport.ts';

export interface WeeklyImage {
  base64: string; // data URL (JPEG / PNG)
  width: number;
  height: number;
}

/** Foto per laporan. Kunci: id dokumen inspeksi/TBM/induction, atau findingPhotoKey() untuk temuan. */
export type WeeklyPhotoMap = Record<string, WeeklyImage[]>;
export const findingPhotoKey = (id: string, stage: 'before' | 'after') => `${id}:${stage}`;

export interface HSEWeeklyExcelOptions {
  companyName: string;
  siteName?: string;
  preparedBy: string;
  notes?: string;
  generatedAt?: Date;
  logos?: { left?: WeeklyImage | null; right?: WeeklyImage | null };
  photos?: WeeklyPhotoMap;
}

// ---------------------------------------------------------------------------
// Grid, ukuran & warna
// ---------------------------------------------------------------------------
const UNITS = 48;
const UNIT_WIDTH = 3.9; // lebar kolom (satuan karakter Excel) ≈ 27 px
const UNIT_PX = 27;
const LEFT_START = 1;   // blok kiri: kolom 1–23
const LEFT_END = 23;
const RIGHT_START = 25; // blok kanan: kolom 25–48 (kolom 24 = jarak)
const BASE_ROW_HEIGHT = 16;
const PX_PER_PT = 4 / 3;
const EMU_PER_PX = 9525;

// Thumbnail foto di dalam sel (rasio 4:3)
const THUMB_W = 84;
const THUMB_H = 63;
const THUMB_GAP = 5;
const THUMB_PAD = 5;

const C = {
  ink: '1F2937',
  muted: '6B7280',
  faint: '9CA3AF',
  accent: '1F3864', // navy: judul & header tabel
  line: 'BFC5CD',
  soft: 'F3F4F6',
  white: 'FFFFFF',
  red: 'B91C1C',
  green: '166534',
};

const argb = (hex: string) => `FF${hex}`;
const side = (hex: string, style: ExcelJS.BorderStyle = 'thin'): Partial<ExcelJS.Border> => ({ style, color: { argb: argb(hex) } });
const GRID: Partial<ExcelJS.Borders> = { top: side(C.line), left: side(C.line), bottom: side(C.line), right: side(C.line) };

interface Style {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fill?: string;
  h?: 'left' | 'center' | 'right';
  v?: 'top' | 'middle' | 'bottom';
  wrap?: boolean;
  shrink?: boolean;
  indent?: number;
  border?: Partial<ExcelJS.Borders>;
  numFmt?: string;
}

interface Run { text: string; bold?: boolean; italic?: boolean; size?: number; color?: string }
const rich = (runs: Run[]): ExcelJS.CellRichTextValue => ({
  richText: runs.map(r => ({
    text: r.text,
    font: {
      name: 'Calibri',
      size: r.size ?? 9,
      bold: r.bold ?? false,
      italic: r.italic ?? false,
      color: { argb: argb(r.color ?? C.ink) },
    },
  })),
});

const plainText = (v: ExcelJS.CellValue): string => {
  if (v == null) return '';
  if (typeof v === 'object' && 'richText' in v) return v.richText.map(r => r.text).join('');
  return String(v);
};

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const fmtNumber = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });
const pad2 = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

// Kolom tabel diletakkan berurutan mulai dari kolom grid tertentu
interface ColDef { label: string; span: number; align?: 'left' | 'center' | 'right' }
interface PlacedCol extends ColDef { u1: number; u2: number }
const place = (start: number, defs: ColDef[]): PlacedCol[] => {
  let u = start;
  return defs.map(d => {
    const col = { ...d, u1: u, u2: u + d.span - 1 };
    u += d.span;
    return col;
  });
};

const perLine = (u1: number, u2: number) =>
  Math.max(1, Math.floor(((u2 - u1 + 1) * UNIT_PX - 2 * THUMB_PAD + THUMB_GAP) / (THUMB_W + THUMB_GAP)));
const photoBlockPx = (count: number, per: number) => {
  const lines = Math.max(1, Math.ceil(count / per));
  return lines * THUMB_H + (lines - 1) * THUMB_GAP + 2 * THUMB_PAD;
};

// ---------------------------------------------------------------------------
// Penulis sel: merge + perkiraan tinggi baris
// (Excel tidak auto-fit tinggi baris untuk sel merge, jadi dihitung manual)
// ---------------------------------------------------------------------------
class SheetWriter {
  private minHeights = new Map<number, number>();
  private needHeights = new Map<number, number>();
  readonly ws: ExcelJS.Worksheet;

  constructor(ws: ExcelJS.Worksheet) {
    this.ws = ws;
  }

  put(r1: number, u1: number, u2: number, value: ExcelJS.CellValue, st: Style = {}, r2 = r1) {
    const c1 = u1 + 1; // kolom A = margin
    const c2 = u2 + 1;
    if (c2 > c1 || r2 > r1) this.ws.mergeCells(r1, c1, r2, c2);

    const size = st.size ?? 9;
    const wrap = st.shrink ? false : st.wrap ?? true;
    const font: Partial<ExcelJS.Font> = {
      name: 'Calibri', size, bold: !!st.bold, italic: !!st.italic, color: { argb: argb(st.color ?? C.ink) },
    };
    const alignment: Partial<ExcelJS.Alignment> = {
      horizontal: st.h ?? 'left', vertical: st.v ?? 'middle', wrapText: wrap,
    };
    if (st.shrink) alignment.shrinkToFit = true;
    if (st.indent) alignment.indent = st.indent;

    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cell = this.ws.getCell(r, c);
        cell.font = font;
        cell.alignment = alignment;
        if (st.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(st.fill) } };
        if (st.border) cell.border = st.border;
        if (st.numFmt) cell.numFmt = st.numFmt;
      }
    }
    this.ws.getCell(r1, c1).value = value;

    if (r1 === r2 && wrap) this.fit(r1, u2 - u1 + 1, plainText(value), size);
  }

  /** Catat kebutuhan tinggi baris dari panjang teks yang di-wrap */
  fit(row: number, units: number, text: string, size: number) {
    const capacity = Math.max(1, Math.floor((units * UNIT_PX - 8) / (size * 0.62)));
    const lines = text.split('\n').reduce((sum, seg) => sum + Math.max(1, Math.ceil(seg.length / capacity)), 0);
    const need = lines * size * 1.32 + 5;
    this.needHeights.set(row, Math.max(this.needHeights.get(row) ?? 0, need));
  }

  height(row: number, pt: number) {
    this.minHeights.set(row, Math.max(this.minHeights.get(row) ?? 0, pt));
  }

  finalize(lastRow: number) {
    for (let r = 1; r <= lastRow; r++) {
      const min = this.minHeights.get(r);
      const need = this.needHeights.get(r) ?? 0;
      this.ws.getRow(r).height = Math.ceil(Math.max(min ?? BASE_ROW_HEIGHT, need) * 4) / 4;
    }
  }

  rowPx(row: number) {
    return (this.ws.getRow(row).height ?? BASE_ROW_HEIGHT) * PX_PER_PT;
  }
}

// ---------------------------------------------------------------------------
// Builder utama
// ---------------------------------------------------------------------------
export function hseWeeklyFileName(week: HSEWeekRange): string {
  return `HSE_Weekly_Report_${week.isoYear}-W${pad2(week.isoWeek)} (${formatWeekLabel(week)}).xlsx`;
}

export function buildHSEWeeklyWorkbook(report: HSEWeeklyReport, opts: HSEWeeklyExcelOptions): ExcelJS.Workbook {
  const { week, summary: s } = report;
  const generatedAt = opts.generatedAt ?? new Date();
  const photos = opts.photos ?? {};

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PT Dwimitra Ekatama Mandiri';
  wb.lastModifiedBy = 'Sistem HSE - DC Cikarang';
  wb.created = generatedAt;
  wb.modified = generatedAt;

  const ws = wb.addWorksheet(`HSE Weekly W${pad2(week.isoWeek)}`, {
    views: [{ showGridLines: false, zoomScale: 100 }],
    properties: { defaultRowHeight: BASE_ROW_HEIGHT },
  });
  ws.getColumn(1).width = 1.6;
  for (let u = 1; u <= UNITS; u++) ws.getColumn(u + 1).width = UNIT_WIDTH;
  ws.getColumn(UNITS + 2).width = 1.6;

  const w = new SheetWriter(ws);
  const spacer = (row: number, pt: number) => w.height(row, pt);

  // Gambar baru diletakkan setelah tinggi baris final diketahui
  const pendingImages: { image: WeeklyImage; row: number; x: number; y: number; width: number; height: number }[] = [];
  const photoSlots: { row: number; u1: number; u2: number; images: WeeklyImage[] }[] = [];

  // ---------- Helper tampilan ----------
  const sectionTitle = (row: number, u1: number, u2: number, title: string, note?: string) => {
    const runs: Run[] = [{ text: title, bold: true, size: 10.5, color: C.accent }];
    if (note) runs.push({ text: `     ${note}`, size: 9, color: C.muted });
    w.put(row, u1, u2, rich(runs), { v: 'bottom', wrap: false, border: { bottom: side(C.accent, 'medium') } });
    w.height(row, 21);
  };

  const headerRow = (row: number, cols: PlacedCol[], labels?: ExcelJS.CellValue[]) => {
    cols.forEach((c, i) => w.put(row, c.u1, c.u2, labels?.[i] ?? c.label, {
      size: 8.5, bold: true, color: C.white, fill: C.accent, h: c.align ?? 'left', border: GRID, shrink: c.span === 1,
    }));
    w.height(row, 18);
  };

  const emptyRow = (row: number, u1: number, u2: number, message: string) => {
    w.put(row, u1, u2, message, { color: C.muted, h: 'center', border: GRID });
    w.height(row, 22);
  };

  const body = (extra: Style = {}): Style => ({ border: GRID, ...extra });
  const total = (extra: Style = {}): Style => ({ border: GRID, fill: C.soft, bold: true, ...extra });

  /** Sel foto: thumbnail berjajar (wrap ke baris berikutnya) di dalam satu sel merge */
  const photoCell = (row: number, u1: number, u2: number, images: WeeklyImage[] | undefined, emptyText = 'Tidak ada foto') => {
    const list = (images ?? []).filter(p => p.base64 && p.width > 0 && p.height > 0);
    w.put(row, u1, u2, list.length ? null : emptyText, body({ size: 8, color: C.faint, h: 'center' }));
    if (list.length === 0) return;
    w.height(row, photoBlockPx(list.length, perLine(u1, u2)) / PX_PER_PT);
    photoSlots.push({ row, u1, u2, images: list });
  };

  const dayAndTime = (ymd: string, time: string, carryOver = false) => rich([
    { text: carryOver ? formatDate(ymd) : formatDayLabel(ymd), bold: true },
    ...(time ? [{ text: `\n${time}`, color: C.muted, size: 8.5 }] : []),
  ]);

  // ================= KOP =================
  w.height(1, 24);
  w.height(2, 15);
  w.height(3, 15);
  w.put(1, 7, 32, 'HSE WEEKLY REPORT', { size: 16, bold: true, color: C.accent, wrap: false, v: 'bottom' });
  w.put(2, 7, 32, 'Laporan Mingguan K3L (Keselamatan, Kesehatan Kerja & Lingkungan)', { size: 9, color: C.muted, wrap: false });
  w.put(3, 7, 32, [opts.companyName, opts.siteName].filter(Boolean).join('  |  '), { size: 9.5, bold: true, wrap: false });

  const meta: [string, string][] = [
    ['Periode', `${formatWeekLabel(week)}  (Minggu ke-${week.isoWeek})`],
    ['Disusun oleh', opts.preparedBy || '-'],
    ['Tanggal cetak', `${formatDate(todayYmd(generatedAt))}, ${hhmm(generatedAt)}`],
  ];
  meta.forEach(([label, value], i) => {
    w.put(1 + i, 33, 36, label, { size: 8.5, color: C.muted, fill: C.soft, border: GRID, indent: 1, wrap: false });
    w.put(1 + i, 37, 42, value, { size: 9, bold: true, border: GRID, indent: 1, shrink: true });
  });

  // Garis pemisah kop
  w.height(4, 6);
  w.put(4, 1, UNITS, null, { border: { bottom: side(C.accent, 'medium') } });
  spacer(5, 8);

  const placeLogo = (logo: WeeklyImage | null | undefined, u1: number, u2: number, alignRight: boolean) => {
    if (!logo?.base64 || !logo.width || !logo.height) return;
    const boxW = (u2 - u1 + 1) * UNIT_PX - 8;
    const boxH = (24 + 15 + 15) * PX_PER_PT - 8;
    const scale = Math.min(boxW / logo.width, boxH / logo.height);
    const width = Math.round(logo.width * scale);
    const height = Math.round(logo.height * scale);
    const x0 = (u1 - 1) * UNIT_PX;
    const x = alignRight ? x0 + (u2 - u1 + 1) * UNIT_PX - width - 4 : x0 + 4;
    pendingImages.push({ image: logo, row: 1, x, y: 4 + (boxH - height) / 2, width, height });
  };
  placeLogo(opts.logos?.left, 1, 6, false);
  placeLogo(opts.logos?.right, 43, 48, true);

  // ================= RINGKASAN ANGKA =================
  const KPI_ROW = 6;
  const kpis: { label: string; value: number | string; caption: string; numFmt?: string; alert?: boolean }[] = [
    { label: 'Inspeksi HSE', value: s.inspections, caption: `${s.inspectedLocations} lokasi` },
    { label: 'Sesi TBM', value: s.tbmSessions, caption: `${s.tbmDays} dari 7 hari` },
    { label: 'Kehadiran TBM', value: s.tbmAttendance, caption: `rata-rata ${fmtNumber(s.tbmAverage)} org/sesi` },
    { label: 'Peserta Induction', value: s.inductionParticipants, caption: `${s.inductionCompanies} perusahaan` },
    { label: 'Temuan Negatif', value: s.negative, caption: `Unsafe Action ${s.unsafeAction} · Condition ${s.unsafeCondition}` },
    { label: 'Temuan Positif', value: s.positive, caption: 'safe behavior' },
    {
      label: 'Temuan Open', value: s.totalOpen, alert: s.totalOpen > 0,
      caption: s.carryOverOpen > 0 ? `${s.carryOverOpen} dari minggu lalu` : 'outstanding',
    },
    {
      label: 'Close Rate', value: s.closeRate === null ? '–' : s.closeRate / 100, numFmt: '0%',
      caption: s.negative ? `${s.negativeClosed} dari ${s.negative} negatif` : 'tidak ada temuan negatif',
    },
  ];
  kpis.forEach((k, i) => {
    const u1 = i * 6 + 1;
    const u2 = u1 + 5;
    w.put(KPI_ROW, u1, u2, k.label.toUpperCase(), { size: 8, bold: true, color: C.muted, fill: C.soft, h: 'center', border: GRID, wrap: false });
    w.put(KPI_ROW + 1, u1, u2, k.value, {
      size: 18, bold: true, color: k.alert ? C.red : C.ink, h: 'center', numFmt: k.numFmt, wrap: false,
      border: { left: side(C.line), right: side(C.line) },
    });
    w.put(KPI_ROW + 2, u1, u2, k.caption, {
      size: 8, color: C.muted, h: 'center', v: 'top', wrap: false,
      border: { left: side(C.line), right: side(C.line), bottom: side(C.line) },
    });
  });
  w.height(KPI_ROW, 17);
  w.height(KPI_ROW + 1, 28);
  w.height(KPI_ROW + 2, 14);
  spacer(KPI_ROW + 3, 12);

  let r = KPI_ROW + 4;

  // ================= AKTIVITAS HARIAN | RINGKASAN TEMUAN =================
  {
    sectionTitle(r, LEFT_START, LEFT_END, 'AKTIVITAS HARIAN', 'jumlah per hari');
    sectionTitle(r, RIGHT_START, UNITS, 'RINGKASAN TEMUAN K3');

    const dailyCols = place(LEFT_START, [
      { label: 'Kegiatan', span: 7 },
      ...week.days.map(() => ({ label: '', span: 2, align: 'center' as const })),
      { label: 'Total', span: 2, align: 'center' },
    ]);
    headerRow(r + 1, dailyCols, [
      'Kegiatan',
      ...week.days.map(d => {
        const [dayName, rest] = formatDayLabel(d).split(', ');
        return rich([{ text: `${dayName}\n`, bold: true, size: 8.5, color: C.white }, { text: rest, size: 7.5, color: 'D6DCE5' }]);
      }),
      'Total',
    ]);
    w.height(r + 1, 27);

    const sumCols = place(RIGHT_START, [
      { label: 'Klasifikasi', span: 12 },
      { label: 'Jumlah', span: 4, align: 'center' },
      { label: 'Open', span: 4, align: 'center' },
      { label: 'Close', span: 4, align: 'center' },
    ]);
    headerRow(r + 1, sumCols);

    const DASH_ZERO = '0;-0;"–"';
    report.daily.forEach((row, i) => {
      const y = r + 2 + i;
      w.put(y, dailyCols[0].u1, dailyCols[0].u2, row.label, body({ indent: 1 }));
      row.perDay.forEach((n, d) => {
        const col = dailyCols[d + 1];
        w.put(y, col.u1, col.u2, n, body({ h: 'center', numFmt: DASH_ZERO, color: n > 0 ? C.ink : C.faint }));
      });
      const tot = dailyCols[dailyCols.length - 1];
      w.put(y, tot.u1, tot.u2, row.total, total({ h: 'center', numFmt: DASH_ZERO }));
    });

    const negatives = report.findings.filter(f => f.type === 'negative');
    const positives = report.findings.filter(f => f.type === 'positive');
    const ua = negatives.filter(f => f.classification === 'Unsafe Action');
    const ucAndOthers = negatives.filter(f => f.classification !== 'Unsafe Action');
    const hasOtherNegatives = ucAndOthers.some(f => f.classification !== 'Unsafe Condition');
    const openOf = (list: HSEWeeklyFinding[]) => list.filter(f => f.status === 'open').length;

    const summaryRows: { label: string; count: number; open: number | null; close: number | null; strong?: boolean }[] = [
      { label: 'Unsafe Action', count: ua.length, open: openOf(ua), close: ua.length - openOf(ua) },
      {
        label: hasOtherNegatives ? 'Unsafe Condition & lainnya' : 'Unsafe Condition',
        count: ucAndOthers.length, open: openOf(ucAndOthers), close: ucAndOthers.length - openOf(ucAndOthers),
      },
      { label: 'Temuan Positif', count: positives.length, open: openOf(positives), close: positives.length - openOf(positives) },
      {
        label: 'Total temuan minggu ini', count: report.findings.length, strong: true,
        open: openOf(report.findings), close: report.findings.length - openOf(report.findings),
      },
      { label: 'Open dari minggu sebelumnya', count: s.carryOverOpen, open: s.carryOverOpen, close: null },
      { label: 'Total outstanding (open)', count: s.totalOpen, open: s.totalOpen, close: null, strong: true },
    ];
    summaryRows.forEach((row, i) => {
      const y = r + 2 + i;
      const st = row.strong ? total : body;
      w.put(y, sumCols[0].u1, sumCols[0].u2, row.label, st({ indent: 1 }));
      [row.count, row.open, row.close].forEach((n, j) => {
        const col = sumCols[j + 1];
        const isOpenCol = j === 1;
        w.put(y, col.u1, col.u2, n ?? '–', st({
          h: 'center',
          numFmt: n === null ? undefined : DASH_ZERO,
          color: n === null || n === 0 ? C.faint : isOpenCol ? C.red : C.ink,
          bold: !!row.strong || (isOpenCol && (n ?? 0) > 0),
        }));
      });
    });

    r += 2 + Math.max(report.daily.length, summaryRows.length);
    spacer(r, 14);
    r += 1;
  }

  // ================= 1. HSE INSPECTION REPORT (lebar penuh) =================
  {
    const cols = place(1, [
      { label: 'No', span: 1, align: 'center' },
      { label: 'Tanggal', span: 3 },
      { label: 'Aktivitas / Pekerjaan', span: 6 },
      { label: 'Lokasi', span: 4 },
      { label: 'PIC', span: 3 },
      ...INSPECTION_CHECKS.map(c => ({ label: c.label, span: 1, align: 'center' as const })),
      { label: 'Dokumentasi Foto', span: 26 },
    ]);
    const photoCol = cols[cols.length - 1];
    sectionTitle(r, 1, UNITS, '1.  HSE INSPECTION REPORT', `${s.inspections} laporan   ·   ✓ = diterapkan saat inspeksi`);
    headerRow(r + 1, cols);
    r += 2;
    if (report.inspections.length === 0) {
      emptyRow(r, 1, UNITS, 'Tidak ada laporan inspeksi pada minggu ini');
      r += 1;
    } else {
      let photoTotal = 0;
      report.inspections.forEach((it, i) => {
        const values: ExcelJS.CellValue[] = [i + 1, dayAndTime(it.date, ''), it.aktivitas, it.lokasi, it.pic];
        values.forEach((v, j) => w.put(r, cols[j].u1, cols[j].u2, v, body({
          h: cols[j].align ?? 'left', color: j === 0 ? C.muted : C.ink, bold: j === 2,
        })));
        INSPECTION_CHECKS.forEach((chk, j) => {
          const col = cols[5 + j];
          const ok = it.checks[chk.key];
          w.put(r, col.u1, col.u2, ok ? '✓' : '–', body({ h: 'center', bold: ok, color: ok ? C.ink : C.faint }));
        });
        const imgs = photos[it.id];
        photoTotal += imgs?.length ?? 0;
        photoCell(r, photoCol.u1, photoCol.u2, imgs);
        r += 1;
      });
      w.put(r, 1, cols[4].u2, `Jumlah diterapkan (dari ${s.inspections} inspeksi)`, total({ h: 'right' }));
      INSPECTION_CHECKS.forEach((chk, j) => {
        const col = cols[5 + j];
        w.put(r, col.u1, col.u2, s.checkCounts[chk.key], total({ h: 'center' }));
      });
      w.put(r, photoCol.u1, photoCol.u2, `${photoTotal} foto`, total({ bold: false, color: C.muted, indent: 1 }));
      r += 1;
    }
    spacer(r, 14);
    r += 1;
  }

  // ================= 2. ABSEN TBM | 3. SAFETY INDUCTION =================
  {
    const top = r;

    // --- Kiri: Absen TBM ---
    const tbmCols = place(LEFT_START, [
      { label: 'No', span: 1, align: 'center' },
      { label: 'Tanggal', span: 3 },
      { label: 'SDM', span: 2, align: 'center' },
      { label: 'Topik / Keterangan', span: 6 },
      { label: 'Foto', span: 11 },
    ]);
    sectionTitle(top, LEFT_START, LEFT_END, '2.  ABSEN TBM (TOOLBOX MEETING)', `${s.tbmSessions} sesi · ${fmtNumber(s.tbmAttendance)} kehadiran`);
    headerRow(top + 1, tbmCols);
    let left = top + 2;
    if (report.tbm.length === 0) {
      emptyRow(left, LEFT_START, LEFT_END, 'Tidak ada sesi TBM pada minggu ini');
      left += 1;
    } else {
      report.tbm.forEach((t, i) => {
        w.put(left, tbmCols[0].u1, tbmCols[0].u2, i + 1, body({ h: 'center', color: C.muted }));
        w.put(left, tbmCols[1].u1, tbmCols[1].u2, dayAndTime(t.date, t.time), body());
        w.put(left, tbmCols[2].u1, tbmCols[2].u2, t.totalSDM, body({ h: 'center', bold: true }));
        w.put(left, tbmCols[3].u1, tbmCols[3].u2, rich([
          { text: t.keterangan },
          ...(t.lokasi && t.lokasi !== '-' ? [{ text: `\n${t.lokasi}`, color: C.muted, size: 8.5 }] : []),
        ]), body());
        photoCell(left, tbmCols[4].u1, tbmCols[4].u2, photos[t.id]);
        left += 1;
      });
      w.put(left, LEFT_START, tbmCols[1].u2, 'Total kehadiran', total({ h: 'right' }));
      w.put(left, tbmCols[2].u1, tbmCols[2].u2, s.tbmAttendance, total({ h: 'center' }));
      w.put(left, tbmCols[3].u1, LEFT_END, `rata-rata ${fmtNumber(s.tbmAverage)} org/sesi · TBM di ${s.tbmDays} hari`,
        total({ bold: false, color: C.muted }));
      left += 1;
    }

    // --- Kanan: Safety Induction ---
    const indCols = place(RIGHT_START, [
      { label: 'No', span: 1, align: 'center' },
      { label: 'Tanggal', span: 3 },
      { label: 'Peserta (Nama — Perusahaan, Jabatan)', span: 9 },
      { label: 'Foto', span: 11 },
    ]);
    sectionTitle(top, RIGHT_START, UNITS, '3.  SAFETY INDUCTION', `${s.inductionParticipants} peserta · ${s.inductionSessions} sesi`);
    headerRow(top + 1, indCols);
    let right = top + 2;
    if (report.inductions.length === 0) {
      emptyRow(right, RIGHT_START, UNITS, 'Tidak ada safety induction pada minggu ini');
      right += 1;
    } else {
      report.inductions.forEach((ind, i) => {
        const runs: Run[] = [];
        ind.participants.forEach((p, pi) => {
          runs.push({ text: `${pi ? '\n' : ''}${pi + 1}. ` , color: C.muted });
          runs.push({ text: p.nama, bold: true });
          runs.push({ text: ` — ${p.perusahaan}${p.jabatan && p.jabatan !== '-' ? `, ${p.jabatan}` : ''}` });
        });
        w.put(right, indCols[0].u1, indCols[0].u2, i + 1, body({ h: 'center', color: C.muted }));
        w.put(right, indCols[1].u1, indCols[1].u2, dayAndTime(ind.date, ind.time), body());
        w.put(right, indCols[2].u1, indCols[2].u2, rich(runs), body());
        photoCell(right, indCols[3].u1, indCols[3].u2, photos[ind.id]);
        right += 1;
      });
      w.put(right, RIGHT_START, UNITS,
        `Total ${s.inductionParticipants} peserta dari ${s.inductionCompanies} perusahaan dalam ${s.inductionSessions} sesi`,
        total({ h: 'right' }));
      right += 1;
    }

    r = Math.max(left, right);
    spacer(r, 14);
    r += 1;
  }

  // ================= 4. TEMUAN K3 (lebar penuh) =================
  {
    const cols = place(1, [
      { label: 'No', span: 1, align: 'center' },
      { label: 'Tanggal', span: 3 },
      { label: 'Klasifikasi', span: 4 },
      { label: 'Uraian Temuan', span: 8 },
      { label: 'Lokasi', span: 3 },
      { label: 'Pihak Terkait', span: 3 },
      { label: 'Status', span: 2, align: 'center' },
      { label: 'Foto Temuan', span: 12 },
      { label: 'Foto Tindak Lanjut', span: 12 },
    ]);
    sectionTitle(r, 1, UNITS, '4.  TEMUAN K3 (HSE FINDINGS)',
      `${s.negative} negatif · ${s.positive} positif · ${s.totalOpen} masih open`);
    headerRow(r + 1, cols);
    r += 2;

    let no = 0;
    const findingRow = (f: HSEWeeklyFinding, carryOver: boolean) => {
      no += 1;
      const desc = f.description && f.description !== f.title ? truncate(f.description, 160) : '';
      const uraian: Run[] = [{ text: f.title, bold: true }];
      if (desc) uraian.push({ text: `\n${desc}` });
      if (f.followUp && f.type === 'negative') {
        uraian.push({ text: `\nTindak lanjut: ${truncate(f.followUp, 120)}`, color: C.muted, size: 8.5 });
      }
      const klas: Run[] = [{ text: f.classification }];
      if (f.category) klas.push({ text: `\n${truncate(f.category, 40)}`, size: 8.5, color: C.muted });
      const isOpen = f.status === 'open';

      w.put(r, cols[0].u1, cols[0].u2, no, body({ h: 'center', color: C.muted }));
      w.put(r, cols[1].u1, cols[1].u2, dayAndTime(f.date, f.time, carryOver), body());
      w.put(r, cols[2].u1, cols[2].u2, rich(klas), body());
      w.put(r, cols[3].u1, cols[3].u2, rich(uraian), body());
      w.put(r, cols[4].u1, cols[4].u2, f.location, body());
      w.put(r, cols[5].u1, cols[5].u2, f.targetPerson || '-', body({ color: f.targetPerson ? C.ink : C.faint }));
      w.put(r, cols[6].u1, cols[6].u2, isOpen ? 'OPEN' : 'CLOSE', body({ h: 'center', bold: true, color: isOpen ? C.red : C.green }));
      photoCell(r, cols[7].u1, cols[7].u2, photos[findingPhotoKey(f.id, 'before')]);
      photoCell(r, cols[8].u1, cols[8].u2, photos[findingPhotoKey(f.id, 'after')],
        f.type === 'positive' ? '–' : isOpen ? 'Belum ada tindak lanjut' : 'Tidak ada foto');
      r += 1;
    };

    if (report.findings.length === 0 && report.carryOverFindings.length === 0) {
      emptyRow(r, 1, UNITS, 'Tidak ada temuan K3 pada minggu ini');
      r += 1;
    } else {
      if (report.findings.length === 0) {
        emptyRow(r, 1, UNITS, 'Tidak ada temuan baru pada minggu ini');
        r += 1;
      }
      report.findings.forEach(f => findingRow(f, false));
      if (report.carryOverFindings.length > 0) {
        w.put(r, 1, UNITS, `Temuan masih OPEN dari minggu sebelumnya (${report.carryOverFindings.length})`,
          total({ indent: 1 }));
        w.height(r, 18);
        r += 1;
        report.carryOverFindings.forEach(f => findingRow(f, true));
      }
    }
  }

  // ================= CATATAN (opsional) =================
  const notes = (opts.notes || '').trim();
  if (notes) {
    spacer(r, 14);
    r += 1;
    sectionTitle(r, 1, UNITS, 'CATATAN');
    r += 1;
    w.put(r, 1, UNITS, notes, { border: GRID, v: 'top', indent: 1, size: 9.5 });
    r += 1;
  }

  // ================= FOOTER =================
  spacer(r, 10);
  r += 1;
  w.put(r, 1, 32, 'Sumber: Sistem HSE — data Inspeksi, Absen TBM, Safety Induction & Temuan K3.', {
    size: 7.5, color: C.muted, wrap: false,
  });
  w.put(r, 33, UNITS, `${opts.companyName} · Minggu ke-${week.isoWeek} (${formatWeekLabel(week)})`, {
    size: 7.5, color: C.muted, h: 'right', wrap: false,
  });
  const lastRow = r;

  w.finalize(lastRow);

  // ---------- Foto: susun thumbnail per sel, vertikal di tengah baris ----------
  for (const slot of photoSlots) {
    const per = perLine(slot.u1, slot.u2);
    const blockH = photoBlockPx(slot.images.length, per);
    const y0 = Math.max(0, (w.rowPx(slot.row) - blockH) / 2) + THUMB_PAD;
    const x0 = (slot.u1 - 1) * UNIT_PX + THUMB_PAD;
    slot.images.forEach((image, i) => {
      const scale = Math.min(THUMB_W / image.width, THUMB_H / image.height);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      pendingImages.push({
        image,
        row: slot.row,
        x: x0 + (i % per) * (THUMB_W + THUMB_GAP) + (THUMB_W - width) / 2,
        y: y0 + Math.floor(i / per) * (THUMB_H + THUMB_GAP) + (THUMB_H - height) / 2,
        width,
        height,
      });
    });
  }

  for (const p of pendingImages) {
    // Anchor dihitung per kolom/baris supaya posisi tetap pas walau lebar kolom aktual sedikit berbeda
    let row = p.row;
    let y = p.y;
    while (row < lastRow && y >= w.rowPx(row)) {
      y -= w.rowPx(row);
      row += 1;
    }
    const colIndex = Math.floor(p.x / UNIT_PX);
    const imageId = wb.addImage({
      base64: p.image.base64,
      extension: p.image.base64.startsWith('data:image/png') ? 'png' : 'jpeg',
    });
    const tl = {
      nativeCol: 1 + colIndex, // kolom A = margin
      nativeColOff: Math.round((p.x - colIndex * UNIT_PX) * EMU_PER_PX),
      nativeRow: row - 1,
      nativeRowOff: Math.round(y * EMU_PER_PX),
    } as unknown as { col: number; row: number };
    ws.addImage(imageId, { tl, ext: { width: p.width, height: p.height }, editAs: 'oneCell' });
  }

  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.45, header: 0.15, footer: 0.2 },
    printArea: `A1:${columnLetter(UNITS + 2)}${lastRow}`,
  };
  ws.headerFooter.oddFooter = `&L&8HSE Weekly Report · Minggu ke-${week.isoWeek} (${formatWeekLabel(week)})&R&8Halaman &P dari &N`;

  return wb;
}

function columnLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
