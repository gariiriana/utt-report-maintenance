// ============================================================================
// FILE: frontend/utils/excelToPdfConverter.ts
// Deskripsi: Mengonversi lembar kerja Excel (.xlsx) Service Report yang di-upload
//            menjadi PDF A4 yang mengikuti tampilan cetak Excel aslinya.
//            Digambar langsung sebagai vektor dengan jsPDF (tanpa html2canvas),
//            sehingga teks tajam dan tidak bertumpuk. Yang dihormati:
//            - lebar kolom, tinggi baris, baris/kolom tersembunyi
//            - merged cells, border per sisi (gaya & warna), warna fill (termasuk
//              warna tema + tint)
//            - font (bold/italic/underline/strikethrough, ukuran, warna), rich text,
//              alignment, wrap text, indent, shrink to fit, overflow teks
//            - number format (tanggal, jam, desimal, persen, dll)
//            - gambar/logo yang tertanam
//            - page setup: print area, orientasi, margin, fit to page, scale,
//              center horizontal/vertikal
// ============================================================================

import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';

type RGB = [number, number, number];
type PdfTextFont = 'helvetica' | 'times' | 'courier';
type DingbatFont = 'wingdings' | 'wingdings2' | 'webdings' | 'symbol' | null;
type DrawnGlyph = 'box' | 'boxCheck' | 'boxCross' | 'circle';
type HAlign = 'left' | 'center' | 'right';
type VAlign = 'top' | 'middle' | 'bottom';
type ContentKind = 'text' | 'number' | 'boolean' | 'error';

interface FontSpec {
  family: PdfTextFont;
  bold: boolean;
  italic: boolean;
  size: number; // pt pada skala sheet (sebelum di-scale ke halaman)
  color: RGB;
  underline: boolean;
  strike: boolean;
  hScale: number; // kompensasi lebar font Excel terhadap font standar PDF
  calibriMetrics: boolean; // ukur dengan lebar karakter Calibri asli
  lineFactor: number; // tinggi baris teks relatif terhadap ukuran font
  dingbat: DingbatFont;
}

// Potongan teks yang digambar dengan satu font PDF
interface Piece {
  font: FontSpec;
  kind: 'text' | 'symbol' | 'zapf' | 'glyph';
  text: string;
  glyph?: DrawnGlyph;
  em: number; // lebar (dalam em) untuk simbol/glyph yang tidak diukur jsPDF
  width: number;
  drawScale: number; // horizontal scale saat digambar agar lebarnya sama dengan hasil ukur
}

interface Token {
  pieces: Piece[];
  width: number;
  isSpace: boolean;
}

interface TextLine {
  pieces: Piece[];
  width: number;
  height: number;
  maxSize: number;
}

interface CellRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

interface CellItem extends CellRange {
  fill: RGB | null;
  lines: TextLine[];
  hAlign: HAlign;
  vAlign: VAlign;
  indent: number;
  canOverflow: boolean;
  rotation: number;
}

interface BorderEdge {
  style: string;
  color: RGB;
}

interface ImageAnchor {
  col: number;
  colOff: number;
  row: number;
  rowOff: number;
}

interface SheetImage {
  id: number;
  data: Uint8Array;
  format: string;
  from: ImageAnchor;
  to?: ImageAnchor;
  ext?: { width: number; height: number };
}

interface RawRun {
  text: string;
  font?: Partial<ExcelJS.Font>;
}

// ---------------------------------------------------------------------------
// Konstanta geometri
// ---------------------------------------------------------------------------

const PX_TO_PT = 0.75;
const EMU_PER_PT = 12700;
const DEFAULT_COL_WIDTH_CHARS = 9.140625; // lebar kolom default Excel (8.43 karakter + padding)
const DEFAULT_ROW_HEIGHT_PT = 15;
const CELL_PAD_X = 2;
const CELL_PAD_Y = 1;
const INDENT_PT = 6.75;
const GLYPH_EM = 0.85;
const ZAPF_EM = 0.79;
const MAX_ROWS = 2000;
const MAX_COLS = 200;
const DEFAULT_FONT: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11 };

// Gaya garis border Excel -> ketebalan (pt halaman) & pola putus-putus
const BORDER_STYLES: Record<string, { rank: number; width: number; dash?: number[]; double?: boolean }> = {
  grid: { rank: 0, width: 0.25 },
  hair: { rank: 1, width: 0.25 },
  dotted: { rank: 2, width: 0.5, dash: [0.5, 1] },
  dashDotDot: { rank: 3, width: 0.5, dash: [3, 1, 1, 1, 1, 1] },
  dashDot: { rank: 4, width: 0.5, dash: [3, 1, 1, 1] },
  dashed: { rank: 5, width: 0.5, dash: [2.5, 1.5] },
  thin: { rank: 6, width: 0.5 },
  mediumDashDotDot: { rank: 7, width: 1, dash: [4, 1.5, 1.5, 1.5, 1.5, 1.5] },
  slantDashDot: { rank: 8, width: 1, dash: [4, 1.5, 1.5, 1.5] },
  mediumDashDot: { rank: 9, width: 1, dash: [4, 1.5, 1.5, 1.5] },
  mediumDashed: { rank: 10, width: 1, dash: [4, 2] },
  medium: { rank: 11, width: 1 },
  double: { rank: 12, width: 0.4, double: true },
  thick: { rank: 13, width: 1.5 },
};

// ---------------------------------------------------------------------------
// Warna
// ---------------------------------------------------------------------------

// Urutan indeks tema Excel: lt1, dk1, lt2, dk2, accent1..6, hlink, folHlink
const OFFICE_THEME = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '0563C1', '954F72'];

const INDEXED_COLORS = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080',
  '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF',
  '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
  '000000', 'FFFFFF',
];

const PATTERN_DENSITY: Record<string, number> = {
  gray0625: 0.0625, gray125: 0.125, lightGray: 0.25, mediumGray: 0.5, darkGray: 0.75,
};

function hexToRgb(hex: string): RGB {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function applyTint([r, g, b]: RGB, tint: number): RGB {
  // Tint Excel bekerja pada luminance HSL
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  let l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(hue(h + 1 / 3) * 255), Math.round(hue(h) * 255), Math.round(hue(h - 1 / 3) * 255)];
}

function parseThemePalette(workbook: ExcelJS.Workbook): string[] {
  const xml: unknown = (workbook as any)._themes?.theme1;
  if (typeof xml !== 'string') return OFFICE_THEME;
  const read = (name: string, fallback: string) => {
    const block = new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml)?.[1];
    const hex = block && (/lastClr="([0-9A-Fa-f]{6})"/.exec(block)?.[1] || /srgbClr val="([0-9A-Fa-f]{6})"/.exec(block)?.[1]);
    return hex ? hex.toUpperCase() : fallback;
  };
  const names = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  return names.map((name, i) => read(name, OFFICE_THEME[i]));
}

function resolveColor(color: any, palette: string[]): RGB | null {
  if (!color || typeof color !== 'object') return null;
  let hex: string | null = null;
  if (typeof color.argb === 'string' && /^[0-9a-f]{6,8}$/i.test(color.argb)) hex = color.argb.slice(-6);
  else if (typeof color.theme === 'number') hex = palette[color.theme] ?? null;
  else if (typeof color.indexed === 'number') hex = INDEXED_COLORS[color.indexed] ?? null;
  if (!hex) return null;
  const rgb = hexToRgb(hex);
  return typeof color.tint === 'number' && color.tint !== 0 ? applyTint(rgb, color.tint) : rgb;
}

function resolveFill(fill: ExcelJS.Fill | undefined, palette: string[]): RGB | null {
  if (!fill) return null;
  if (fill.type === 'pattern') {
    if (!fill.pattern || fill.pattern === 'none') return null;
    const fg = resolveColor(fill.fgColor, palette);
    if (fill.pattern === 'solid') return fg ?? resolveColor(fill.bgColor, palette);
    const bg = resolveColor(fill.bgColor, palette) ?? [255, 255, 255];
    const density = PATTERN_DENSITY[fill.pattern] ?? 0.5;
    const front = fg ?? [0, 0, 0];
    return [0, 1, 2].map(i => Math.round(front[i] * density + bg[i] * (1 - density))) as RGB;
  }
  if (fill.type === 'gradient' && Array.isArray(fill.stops) && fill.stops.length > 0) {
    const colors = fill.stops.map(stop => resolveColor(stop.color, palette)).filter((c): c is RGB => Boolean(c));
    if (colors.length === 0) return null;
    return [0, 1, 2].map(i => Math.round(colors.reduce((sum, c) => sum + c[i], 0) / colors.length)) as RGB;
  }
  return null;
}

const isNearWhite = (rgb: RGB) => rgb[0] > 250 && rgb[1] > 250 && rgb[2] > 250;

// ---------------------------------------------------------------------------
// Font & karakter
// ---------------------------------------------------------------------------

const FONT_WIDTH_FACTORS: Array<[RegExp, number]> = [
  [/arial narrow/, 0.82], [/arial black/, 1.2], [/aptos/, 0.93], [/tahoma/, 0.98], [/verdana/, 1.12], [/segoe ui/, 0.97], [/century gothic/, 1.1],
  [/franklin gothic/, 0.9], [/trebuchet/, 0.98], [/candara/, 0.92], [/corbel/, 0.9],
  [/bahnschrift/, 0.92], [/cambria/, 1.06], [/georgia/, 1.12], [/garamond/, 0.94],
  [/book antiqua|palatino/, 1.04], [/consolas/, 0.92],
];

function toFontSpec(font: Partial<ExcelJS.Font> | undefined, palette: string[]): FontSpec {
  const name = String(font?.name || DEFAULT_FONT.name).toLowerCase();
  let family: PdfTextFont = 'helvetica';
  if (/courier|consolas|mono|lucida console|menlo/.test(name)) family = 'courier';
  else if (/times|cambria|georgia|garamond|antiqua|palatino|bookman|schoolbook|serif|mincho|simsun|song|batang|minion/.test(name) && !/sans/.test(name)) family = 'times';

  let dingbat: DingbatFont = null;
  if (name.startsWith('wingdings 2')) dingbat = 'wingdings2';
  else if (name.startsWith('wingdings')) dingbat = 'wingdings';
  else if (name.startsWith('webdings')) dingbat = 'webdings';
  else if (name === 'symbol') dingbat = 'symbol';

  const hScale = FONT_WIDTH_FACTORS.find(([pattern]) => pattern.test(name))?.[1] ?? 1;
  const underline = font?.underline;
  return {
    family,
    bold: Boolean(font?.bold),
    italic: Boolean(font?.italic),
    size: typeof font?.size === 'number' && font.size > 0 ? font.size : 11,
    color: resolveColor(font?.color, palette) ?? [0, 0, 0],
    underline: Boolean(underline) && underline !== 'none',
    strike: Boolean(font?.strike),
    hScale,
    calibriMetrics: name.includes('calibri'),
    lineFactor: /calibri|aptos|cambria/.test(name) ? 1.22 : 1.15,
    dingbat,
  };
}

// Lebar digit "0" (em) font Normal workbook. Saat mencetak, Excel memakai lebar digit ini
// tanpa dibulatkan ke pixel untuk menghitung lebar kolom.
const DIGIT_WIDTH_EM: Array<[RegExp, number]> = [
  [/calibri/, 0.5068], [/arial narrow/, 0.4561], [/arial|helvetica/, 0.5562], [/times/, 0.5],
  [/cambria/, 0.5566], [/aptos/, 0.5537], [/tahoma/, 0.5459], [/verdana/, 0.6362],
  [/segoe ui/, 0.5527], [/century gothic/, 0.5517], [/courier|consolas/, 0.6], [/georgia/, 0.6],
  [/garamond/, 0.47],
];

function maxDigitWidthPx(font: { name: string; size: number }): number {
  const name = font.name.toLowerCase();
  const em = DIGIT_WIDTH_EM.find(([pattern]) => pattern.test(name))?.[1] ?? 0.5068;
  return em * font.size * (96 / 72);
}

function fontStyleName(font: FontSpec): string {
  if (font.bold && font.italic) return 'bolditalic';
  if (font.bold) return 'bold';
  if (font.italic) return 'italic';
  return 'normal';
}

// Karakter tambahan CP1252 yang didukung font standar PDF (WinAnsiEncoding)
const CP1252_EXTRA_CODES = [
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d,
  0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
];
const CP1252_EXTRA = new Set(CP1252_EXTRA_CODES);

const isWinAnsi = (cp: number) => (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || CP1252_EXTRA.has(cp);

// Lebar karakter Calibri (per 1000 em) dari calibri.ttf / calibrib.ttf, urutan: kode 32-126,
// 160-255, lalu CP1252_EXTRA_CODES. Calibri adalah font default Excel; tanpa tabel ini
// pemenggalan baris teks Calibri tidak bisa sama dengan Excel.
const CALIBRI_WIDTHS = {
  regular: [226, 326, 401, 498, 507, 715, 682, 221, 303, 303, 498, 498, 250, 306, 252, 386, 507, 507, 507, 507, 507, 507, 507, 507, 507, 507, 268, 268, 498, 498, 498, 463, 894, 579, 544, 533, 615, 488, 459, 631, 623, 252, 319, 520, 420, 855, 646, 662, 517, 673, 543, 459, 487, 642, 567, 890, 519, 487, 468, 307, 386, 307, 498, 498, 291, 479, 525, 423, 525, 498, 305, 471, 525, 229, 239, 455, 229, 799, 525, 527, 525, 525, 349, 391, 335, 525, 452, 715, 433, 453, 395, 314, 460, 314, 498, 226, 326, 498, 507, 498, 507, 498, 498, 393, 834, 402, 512, 498, 306, 507, 394, 339, 498, 336, 334, 292, 550, 586, 252, 307, 246, 422, 512, 636, 671, 675, 463, 579, 579, 579, 579, 579, 579, 763, 533, 488, 488, 488, 488, 252, 252, 252, 252, 625, 646, 662, 662, 662, 662, 662, 498, 664, 642, 642, 642, 642, 487, 517, 527, 479, 479, 479, 479, 479, 479, 773, 423, 498, 498, 498, 498, 229, 229, 229, 229, 525, 525, 527, 527, 527, 527, 527, 498, 529, 525, 525, 525, 525, 453, 525, 453, 507, 250, 305, 418, 690, 498, 498, 395, 1038, 459, 339, 867, 468, 250, 250, 418, 418, 498, 498, 905, 450, 705, 391, 339, 850, 395, 487],
  bold: [226, 326, 438, 498, 507, 729, 705, 233, 312, 312, 498, 498, 258, 306, 267, 430, 507, 507, 507, 507, 507, 507, 507, 507, 507, 507, 276, 276, 498, 498, 498, 463, 898, 606, 561, 529, 630, 488, 459, 637, 631, 267, 331, 547, 423, 874, 659, 676, 532, 686, 563, 473, 495, 653, 591, 906, 551, 520, 478, 325, 430, 325, 498, 498, 300, 494, 537, 418, 537, 503, 316, 474, 537, 246, 255, 480, 246, 813, 537, 538, 537, 537, 355, 399, 347, 537, 473, 745, 459, 474, 397, 344, 475, 344, 498, 226, 326, 498, 507, 498, 507, 498, 498, 415, 834, 416, 539, 498, 306, 507, 390, 342, 498, 338, 336, 301, 563, 598, 268, 303, 252, 435, 539, 658, 691, 702, 463, 606, 606, 606, 606, 606, 606, 775, 529, 488, 488, 488, 488, 267, 267, 267, 267, 639, 659, 676, 676, 676, 676, 676, 498, 681, 653, 653, 653, 653, 520, 532, 555, 494, 494, 494, 494, 494, 494, 775, 418, 503, 503, 503, 503, 246, 246, 246, 246, 537, 537, 538, 538, 538, 538, 538, 498, 544, 537, 537, 537, 537, 474, 537, 474, 507, 258, 316, 435, 711, 498, 498, 401, 1062, 473, 344, 874, 478, 258, 258, 435, 435, 498, 498, 905, 444, 720, 399, 344, 843, 397, 520],
};

function calibriTextWidthEm(text: string, bold: boolean): number {
  const table = bold ? CALIBRI_WIDTHS.bold : CALIBRI_WIDTHS.regular;
  let em = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    let index = -1;
    if (cp >= 32 && cp <= 126) index = cp - 32;
    else if (cp >= 160 && cp <= 255) index = cp - 160 + 95;
    else if (CP1252_EXTRA.has(cp)) index = 191 + CP1252_EXTRA_CODES.indexOf(cp);
    em += index >= 0 ? table[index] / 1000 : 0.5;
  }
  return em;
}

// Unicode -> [kode di font Symbol PDF, lebar per 1000 em]
const SYMBOL_FONT_MAP: Record<number, [number, number]> = {
  0x221a: [0xd6, 549], 0x2264: [0xa3, 549], 0x2266: [0xa3, 549], 0x2265: [0xb3, 549], 0x2267: [0xb3, 549],
  0x2260: [0xb9, 549], 0x2248: [0xbb, 549], 0x2252: [0xbb, 549], 0x221e: [0xa5, 713],
  0x2190: [0xac, 987], 0x2191: [0xad, 603], 0x2192: [0xae, 987], 0x2193: [0xaf, 603], 0x2194: [0xab, 1042],
  0x21d2: [0xde, 987], 0x21d4: [0xdb, 1042], 0x2206: [0x44, 612], 0x0394: [0x44, 612], 0x03a9: [0x57, 768],
  0x2126: [0x57, 768], 0x03b1: [0x61, 631], 0x03b2: [0x62, 549], 0x03b3: [0x67, 411], 0x03b4: [0x64, 494],
  0x03b5: [0x65, 439], 0x03b8: [0x71, 521], 0x03bb: [0x6c, 549], 0x03bc: [0x6d, 576], 0x03c0: [0x70, 549],
  0x03c1: [0x72, 549], 0x03c3: [0x73, 603], 0x03c4: [0x74, 439], 0x03c6: [0x66, 521], 0x03c9: [0x77, 686],
  0x2211: [0xe5, 713], 0x2219: [0xb7, 460], 0x22c5: [0xd7, 250], 0x2212: [0x2d, 549], 0x2032: [0xa2, 247],
  0x2033: [0xb2, 411], 0x2234: [0x5c, 863], 0x2205: [0xc6, 823], 0x2208: [0xce, 713], 0x2229: [0xc7, 768],
  0x222a: [0xc8, 768],
};
const SYMBOL_WIDTH_BY_CODE = new Map(Object.values(SYMBOL_FONT_MAP).map(([code, width]) => [code, width / 1000]));

const DRAWN_GLYPHS: Record<number, DrawnGlyph> = {
  0x25a1: 'box', 0x2610: 'box', 0x25a2: 'box', 0x25fb: 'box', 0x25fd: 'box', 0x2b1c: 'box',
  0x2611: 'boxCheck', 0x2705: 'boxCheck', 0x1f5f9: 'boxCheck',
  0x2612: 'boxCross', 0x22a0: 'boxCross', 0x2327: 'boxCross', 0x1f5f7: 'boxCross', 0x274e: 'boxCross',
  0x25cb: 'circle', 0x25ef: 'circle', 0x26aa: 'circle', 0x25e6: 'circle',
};

// Glyph ZapfDingbats yang posisinya tidak mengikuti blok Unicode Dingbats
const ZAPF_EXTRA: Record<number, number> = {
  0x260e: 0x25, 0x261b: 0x2a, 0x261e: 0x2b, 0x2605: 0x48, 0x25cf: 0x6c, 0x25a0: 0x6e,
  0x25b2: 0x73, 0x25bc: 0x74, 0x25c6: 0x75, 0x25d7: 0x77,
};
const ZAPF_HOLES = new Set([0x2705, 0x270a, 0x270b, 0x2728, 0x274c, 0x274e, 0x2753, 0x2754, 0x2755, 0x2757]);

function zapfCode(cp: number): number | null {
  if (ZAPF_EXTRA[cp]) return ZAPF_EXTRA[cp];
  if (cp >= 0x2701 && cp <= 0x275e && !ZAPF_HOLES.has(cp)) return cp - 0x2700 + 0x20;
  return null;
}

const CHAR_SUBSTITUTES: Record<number, string> = {
  0x2103: '°C', 0x2109: '°F', 0x2010: '-', 0x2011: '-', 0x2012: '-', 0x2015: '—', 0x2043: '-',
  0x2044: '/', 0x2215: '/', 0x2024: '.', 0x2027: '·', 0x2116: 'No.', 0x2153: '1/3', 0x2154: '2/3',
  0x226a: '<<', 0x226b: '>>', 0x3001: ',', 0x3002: '.', 0x300c: '[', 0x300d: ']', 0x3010: '[',
  0x3011: ']', 0x2500: '-', 0x2502: '|', 0x2795: '+', 0x2796: '-', 0x274c: '✘', 0x1f5f8: '✓',
  0x200b: '', 0x200c: '', 0x200d: '', 0x2060: '', 0xfeff: '', 0x3000: ' ',
};

function substituteChar(cp: number): string | null {
  if (cp in CHAR_SUBSTITUTES) return CHAR_SUBSTITUTES[cp];
  if (cp >= 0x2000 && cp <= 0x200a) return ' ';
  if (cp >= 0xff01 && cp <= 0xff5e) return String.fromCharCode(cp - 0xfee0); // karakter full-width
  if (cp === 0x2070) return '0';
  if (cp >= 0x2074 && cp <= 0x2079) return String(cp - 0x2070);
  if (cp >= 0x2080 && cp <= 0x2089) return String(cp - 0x2080);
  return null;
}

// Font simbol Excel (Wingdings dkk) -> Unicode atau glyph yang digambar manual
const WINGDINGS_MAP: Record<number, number | DrawnGlyph> = {
  0x6f: 'box', 0x70: 'box', 0x71: 'box', 0x72: 'box', 0xa8: 'box', 0x6e: 0x25a0, 0xa7: 0x25a0,
  0x6c: 0x25cf, 0x6d: 'circle', 0xa1: 'circle', 0x78: 'boxCross', 0xfd: 'boxCross', 0xfe: 'boxCheck',
  0xfc: 0x2713, 0xfb: 0x2717,
};
const WINGDINGS2_MAP: Record<number, number | DrawnGlyph> = {
  0x4f: 0x2717, 0x50: 0x2713, 0x51: 'boxCross', 0x52: 'boxCheck', 0x53: 'boxCross', 0x54: 'boxCross', 0xa3: 'box',
};
const WEBDINGS_MAP: Record<number, number | DrawnGlyph> = { 0x61: 0x2713, 0x72: 0x2717 };

interface Atom {
  kind: Piece['kind'];
  ch: string;
  glyph?: DrawnGlyph;
  em: number;
  isSpace?: boolean;
}

function charToAtoms(cp: number, dingbat: DingbatFont): Atom[] {
  if (cp === 0x20 || cp === 0x09) return [{ kind: 'text', ch: ' ', em: 0, isSpace: true }];
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return [];

  if (dingbat) {
    // Excel menyimpan karakter font simbol bisa di area Private Use (U+F0xx)
    const code = cp >= 0xf020 && cp <= 0xf0ff ? cp - 0xf000 : cp;
    if (code <= 0xff) {
      if (dingbat === 'symbol') {
        return [{ kind: 'symbol', ch: String.fromCharCode(code), em: SYMBOL_WIDTH_BY_CODE.get(code) ?? 0.6 }];
      }
      const table = dingbat === 'wingdings2' ? WINGDINGS2_MAP : dingbat === 'webdings' ? WEBDINGS_MAP : WINGDINGS_MAP;
      const mapped = table[code];
      if (typeof mapped === 'number') return charToAtoms(mapped, null);
      return [{ kind: 'glyph', ch: '', glyph: mapped ?? 'box', em: GLYPH_EM }];
    }
  }

  if (isWinAnsi(cp)) return [{ kind: 'text', ch: String.fromCodePoint(cp), em: 0 }];
  const symbol = SYMBOL_FONT_MAP[cp];
  if (symbol) return [{ kind: 'symbol', ch: String.fromCharCode(symbol[0]), em: symbol[1] / 1000 }];
  const glyph = DRAWN_GLYPHS[cp];
  if (glyph) return [{ kind: 'glyph', ch: '', glyph, em: GLYPH_EM }];
  const zapf = zapfCode(cp);
  if (zapf) return [{ kind: 'zapf', ch: String.fromCharCode(zapf), em: ZAPF_EM }];
  const substitute = substituteChar(cp);
  if (substitute !== null) {
    return Array.from(substitute).flatMap(ch => charToAtoms(ch.codePointAt(0) as number, null));
  }
  return [{ kind: 'text', ch: '?', em: 0 }];
}

// ---------------------------------------------------------------------------
// Number format Excel
// ---------------------------------------------------------------------------

const DATE_NAMES = {
  id: {
    monthsLong: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
    daysLong: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    daysShort: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  },
  en: {
    monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    daysLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
};

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const pad2 = (n: number) => String(n).padStart(2, '0');

function splitFormatSections(fmt: string): string[] {
  const sections: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < fmt.length; i++) {
    const ch = fmt[i];
    if (ch === '"') inQuote = !inQuote;
    if (ch === '\\' && !inQuote) {
      current += ch + (fmt[i + 1] ?? '');
      i++;
      continue;
    }
    if (ch === ';' && !inQuote) {
      sections.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  sections.push(current);
  return sections;
}

function isDateFormat(section: string): boolean {
  const stripped = section
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[(h+|m+|s+)\]/gi, 'h')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[_*]./g, '')
    .replace(/am\/pm|a\/p/gi, 'h');
  if (/general/i.test(stripped)) return false;
  return /[ymdhs]/i.test(stripped);
}

type DateToken =
  | { type: 'lit'; text: string }
  | { type: 'y' | 'm' | 'd' | 'h' | 's' | 'min' | 'ampm' | 'elapsedH' | 'elapsedM' | 'elapsedS' | 'frac'; len: number };

function tokenizeDateFormat(fmt: string): DateToken[] {
  const tokens: DateToken[] = [];
  let i = 0;
  while (i < fmt.length) {
    const ch = fmt[i];
    const lc = ch.toLowerCase();
    if (ch === '"') {
      const end = fmt.indexOf('"', i + 1);
      tokens.push({ type: 'lit', text: fmt.slice(i + 1, end === -1 ? undefined : end) });
      i = end === -1 ? fmt.length : end + 1;
    } else if (ch === '\\') {
      tokens.push({ type: 'lit', text: fmt[i + 1] ?? '' });
      i += 2;
    } else if (ch === '_') {
      tokens.push({ type: 'lit', text: ' ' });
      i += 2;
    } else if (ch === '*') {
      i += 2;
    } else if (ch === '[') {
      const end = fmt.indexOf(']', i);
      const inner = end === -1 ? '' : fmt.slice(i + 1, end);
      if (/^h+$/i.test(inner)) tokens.push({ type: 'elapsedH', len: inner.length });
      else if (/^m+$/i.test(inner)) tokens.push({ type: 'elapsedM', len: inner.length });
      else if (/^s+$/i.test(inner)) tokens.push({ type: 'elapsedS', len: inner.length });
      i = end === -1 ? fmt.length : end + 1;
    } else if (/^am\/pm/i.test(fmt.slice(i, i + 5))) {
      tokens.push({ type: 'ampm', len: 5 });
      i += 5;
    } else if (/^a\/p/i.test(fmt.slice(i, i + 3))) {
      tokens.push({ type: 'ampm', len: 3 });
      i += 3;
    } else if ('ymdhse'.includes(lc)) {
      let j = i;
      while (j < fmt.length && fmt[j].toLowerCase() === lc) j++;
      tokens.push({ type: lc === 'e' ? 'y' : (lc as 'y' | 'm' | 'd' | 'h' | 's'), len: lc === 'e' ? 4 : j - i });
      i = j;
    } else if (ch === '.' && fmt[i + 1] === '0' && tokens.length > 0 && tokens[tokens.length - 1].type === 's') {
      let j = i + 1;
      while (fmt[j] === '0') j++;
      tokens.push({ type: 'frac', len: j - i - 1 });
      i = j;
    } else {
      tokens.push({ type: 'lit', text: ch });
      i++;
    }
  }

  // "m"/"mm" setelah jam atau sebelum detik berarti menit, bukan bulan
  const timeNeighbor = (index: number, step: number, types: string[]) => {
    for (let k = index + step; k >= 0 && k < tokens.length; k += step) {
      if (tokens[k].type !== 'lit') return types.includes(tokens[k].type);
    }
    return false;
  };
  tokens.forEach((token, index) => {
    if (token.type === 'm' && token.len <= 2 &&
      (timeNeighbor(index, -1, ['h', 'elapsedH']) || timeNeighbor(index, 1, ['s', 'elapsedS']))) {
      tokens[index] = { type: 'min', len: token.len };
    }
  });
  return tokens;
}

function formatDate(date: Date, section: string): string {
  const fmt = section.trim();
  const lower = fmt.toLowerCase();
  // Format tanggal bawaan Excel (numFmtId 14 / 22) ditampilkan sesuai short date regional Indonesia
  if (lower === 'mm-dd-yy') return formatDate(date, 'dd/mm/yyyy');
  if (lower === 'm/d/yy "h":mm' || lower === 'm/d/yy h:mm') return formatDate(date, 'dd/mm/yyyy h:mm');

  const names = /\[\$[^\]]*-(?:409|809|c09|1009|1409|4009)\]|\[\$-en/i.test(fmt) ? DATE_NAMES.en : DATE_NAMES.id;
  const d = new Date(Math.round(date.getTime() / 1000) * 1000);
  const elapsedMs = d.getTime() - EXCEL_EPOCH_MS;
  const tokens = tokenizeDateFormat(fmt);
  const twelveHour = tokens.some(token => token.type === 'ampm');
  const hours = d.getUTCHours();

  return tokens.map(token => {
    switch (token.type) {
      case 'lit': return token.text;
      case 'y': return token.len <= 2 ? pad2(d.getUTCFullYear() % 100) : String(d.getUTCFullYear());
      case 'm': {
        const month = d.getUTCMonth();
        if (token.len === 1) return String(month + 1);
        if (token.len === 2) return pad2(month + 1);
        if (token.len === 3) return names.monthsShort[month];
        if (token.len === 5) return names.monthsLong[month][0];
        return names.monthsLong[month];
      }
      case 'd': {
        if (token.len === 1) return String(d.getUTCDate());
        if (token.len === 2) return pad2(d.getUTCDate());
        if (token.len === 3) return names.daysShort[d.getUTCDay()];
        return names.daysLong[d.getUTCDay()];
      }
      case 'h': {
        const h = twelveHour ? (hours % 12 || 12) : hours;
        return token.len === 1 ? String(h) : pad2(h);
      }
      case 'min': return token.len === 1 ? String(d.getUTCMinutes()) : pad2(d.getUTCMinutes());
      case 's': return token.len === 1 ? String(d.getUTCSeconds()) : pad2(d.getUTCSeconds());
      case 'frac': return '.' + String(d.getUTCMilliseconds()).padStart(3, '0').slice(0, token.len);
      case 'ampm': return token.len === 5 ? (hours < 12 ? 'AM' : 'PM') : (hours < 12 ? 'A' : 'P');
      case 'elapsedH': return String(Math.floor(elapsedMs / 3600000)).padStart(token.len, '0');
      case 'elapsedM': return String(Math.floor(elapsedMs / 60000)).padStart(token.len, '0');
      case 'elapsedS': return String(Math.floor(elapsedMs / 1000)).padStart(token.len, '0');
      default: return '';
    }
  }).join('');
}

function formatGeneral(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value) && Math.abs(value) < 1e11) return String(value);
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e11 || abs < 1e-9)) {
    const [mantissa, exponent] = value.toExponential(5).split('e');
    const exp = Number(exponent);
    return `${mantissa.replace(/\.?0+$/, '')}E${exp < 0 ? '-' : '+'}${pad2(Math.abs(exp))}`;
  }
  return String(Number(value.toPrecision(10)));
}

function roundToFixed(value: number, decimals: number): string {
  if (Math.abs(value) >= 1e15) return value.toFixed(decimals);
  return Number(Math.round(Number(`${value}e${decimals}`)) + `e-${decimals}`).toFixed(decimals);
}

function formatNumericSection(abs: number, section: string, negative: boolean): string {
  let prefix = '';
  let suffix = '';
  let pattern = '';
  let percent = 0;
  let scientific = false;
  let exponentDigits = 0;
  const addLiteral = (text: string) => {
    if (pattern) suffix += text;
    else prefix += text;
  };

  for (let i = 0; i < section.length; i++) {
    const ch = section[i];
    if (ch === '"') {
      const end = section.indexOf('"', i + 1);
      addLiteral(section.slice(i + 1, end === -1 ? undefined : end));
      i = end === -1 ? section.length : end;
    } else if (ch === '\\') {
      addLiteral(section[i + 1] ?? '');
      i++;
    } else if (ch === '_') {
      addLiteral(' ');
      i++;
    } else if (ch === '*') {
      i++;
    } else if (ch === '[') {
      const end = section.indexOf(']', i);
      const inner = section.slice(i + 1, end === -1 ? undefined : end);
      if (inner.startsWith('$')) addLiteral(inner.slice(1).split('-')[0]); // simbol mata uang, mis. [$Rp-421]
      i = end === -1 ? section.length : end;
    } else if (ch === '%') {
      percent++;
      addLiteral('%');
    } else if ((ch === 'E' || ch === 'e') && pattern && (section[i + 1] === '+' || section[i + 1] === '-')) {
      scientific = true;
      let j = i + 2;
      while (section[j] === '0' || section[j] === '#') {
        exponentDigits++;
        j++;
      }
      i = j - 1;
    } else if ('0#?.,'.includes(ch)) {
      if (ch === ',' && !pattern) addLiteral(ch);
      else if (!suffix) pattern += ch;
    } else if (ch === '/') {
      return formatGeneral(negative ? -abs : abs); // format pecahan tidak didukung
    } else if (ch !== '@') {
      addLiteral(ch);
    }
  }

  const sign = negative ? '-' : '';
  if (!pattern) return sign + prefix + suffix;

  const dot = pattern.indexOf('.');
  let intPattern = dot === -1 ? pattern : pattern.slice(0, dot);
  const decPattern = dot === -1 ? '' : pattern.slice(dot + 1).replace(/,/g, '');
  let thousandScale = 0;
  while (intPattern.endsWith(',')) {
    thousandScale++;
    intPattern = intPattern.slice(0, -1);
  }
  const grouping = intPattern.includes(',');
  const minInt = (intPattern.match(/0/g) || []).length;
  const maxDec = decPattern.length;
  const minDec = (decPattern.match(/0/g) || []).length;
  const value = (abs * Math.pow(100, percent)) / Math.pow(1000, thousandScale);

  if (scientific) {
    const [mantissa, exponent] = value.toExponential(maxDec).split('e');
    const exp = Number(exponent);
    return `${sign}${prefix}${mantissa}E${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(exponentDigits, '0')}${suffix}`;
  }

  let [intPart, decPart = ''] = roundToFixed(value, maxDec).split('.');
  while (decPart.length > minDec && decPart.endsWith('0')) decPart = decPart.slice(0, -1);
  if (intPart === '0' && minInt === 0) intPart = '';
  intPart = intPart.padStart(minInt, '0');
  if (grouping) intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${prefix}${intPart}${dot !== -1 ? '.' + decPart : ''}${suffix}`;
}

function formatNumber(value: number, numFmt: string | undefined): string {
  const fmt = (numFmt || '').trim();
  if (!fmt || /^general$/i.test(fmt)) return formatGeneral(value);
  if (fmt === '@') return formatGeneral(value);
  const sections = splitFormatSections(fmt);
  let section = sections[0];
  let negative = value < 0;
  if (value < 0 && sections.length > 1) {
    section = sections[1];
    negative = false;
  } else if (value === 0 && sections.length > 2) {
    section = sections[2];
  }
  if (section.trim() === '') return '';
  if (/^general$/i.test(section.replace(/\[[^\]]*\]/g, '').trim())) return formatGeneral(value);
  if (isDateFormat(section)) return formatDate(new Date(EXCEL_EPOCH_MS + Math.round(value * 86400000)), section);
  return formatNumericSection(Math.abs(value), section, negative);
}

function formatText(text: string, numFmt: string | undefined): string {
  const sections = numFmt ? splitFormatSections(numFmt) : [];
  if (sections.length < 4) return text;
  const textSection = sections[3];
  if (!textSection.includes('@')) return textSection.replace(/"/g, '');
  return textSection.replace(/"([^"]*)"/g, '$1').replace('@', text);
}

function readCellContent(value: ExcelJS.CellValue | undefined, numFmt: string | undefined): { runs: RawRun[]; kind: ContentKind } | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value === '' ? null : { runs: [{ text: formatText(value, numFmt) }], kind: 'text' };
  if (typeof value === 'number') return { runs: [{ text: formatNumber(value, numFmt) }], kind: 'number' };
  if (typeof value === 'boolean') return { runs: [{ text: value ? 'TRUE' : 'FALSE' }], kind: 'boolean' };
  if (value instanceof Date) {
    const section = numFmt ? splitFormatSections(numFmt)[0] : '';
    return { runs: [{ text: formatDate(value, section && isDateFormat(section) ? section : 'dd/mm/yyyy') }], kind: 'number' };
  }
  if (typeof value === 'object') {
    const obj = value as any;
    if (Array.isArray(obj.richText)) {
      return { runs: obj.richText.map((run: any) => ({ text: String(run.text ?? ''), font: run.font })), kind: 'text' };
    }
    if ('error' in obj) return { runs: [{ text: String(obj.error) }], kind: 'error' };
    if ('formula' in obj || 'sharedFormula' in obj || 'result' in obj) return readCellContent(obj.result, numFmt);
    if ('text' in obj) return readCellContent(obj.text, numFmt);
  }
  return null;
}

function isBlankValue(value: ExcelJS.CellValue | undefined): boolean {
  const content = readCellContent(value, undefined);
  return !content || content.runs.every(run => run.text.trim() === '');
}

// ---------------------------------------------------------------------------
// Layout teks
// ---------------------------------------------------------------------------

function measurePiece(pdf: jsPDF, piece: Piece): number {
  piece.drawScale = 1;
  if (piece.kind !== 'text') return piece.em * piece.font.size;
  pdf.setFont(piece.font.family, fontStyleName(piece.font));
  // Tanpa kerning: pdf.text() juga menggambar tanpa kerning, jadi posisi potongan berikutnya pas
  const pdfWidth = pdf.getStringUnitWidth(piece.text, { doKerning: false }) * piece.font.size;
  const width = piece.font.calibriMetrics
    ? calibriTextWidthEm(piece.text, piece.font.bold) * piece.font.size
    : pdfWidth * piece.font.hScale;
  if (pdfWidth > 0) piece.drawScale = width / pdfWidth;
  return width;
}

function buildParagraphs(pdf: jsPDF, runs: Array<{ text: string; font: FontSpec }>): Token[][] {
  const paragraphs: Token[][] = [[]];
  let current: Token | null = null;

  for (const run of runs) {
    for (const ch of Array.from(run.text.replace(/\r\n?/g, '\n'))) {
      if (ch === '\n') {
        paragraphs.push([]);
        current = null;
        continue;
      }
      for (const atom of charToAtoms(ch.codePointAt(0) as number, run.font.dingbat)) {
        const isSpace = Boolean(atom.isSpace);
        if (!current || current.isSpace !== isSpace) {
          current = { pieces: [], width: 0, isSpace };
          paragraphs[paragraphs.length - 1].push(current);
        }
        const last: Piece | undefined = current.pieces[current.pieces.length - 1];
        if (last && atom.kind !== 'glyph' && last.kind === atom.kind && last.font === run.font) {
          last.text += atom.ch;
          last.em += atom.em;
        } else {
          current.pieces.push({ font: run.font, kind: atom.kind, text: atom.ch, glyph: atom.glyph, em: atom.em, width: 0, drawScale: 1 });
        }
        // Seperti Excel, baris boleh dipenggal setelah tanda hubung
        if (atom.ch === '-') current = null;
      }
    }
  }

  for (const paragraph of paragraphs) {
    for (const token of paragraph) {
      token.width = 0;
      for (const piece of token.pieces) {
        piece.width = measurePiece(pdf, piece);
        token.width += piece.width;
      }
    }
  }
  return paragraphs;
}

function splitTokenChars(pdf: jsPDF, token: Token): Token[] {
  const result: Token[] = [];
  for (const piece of token.pieces) {
    if (piece.kind === 'glyph') {
      result.push({ pieces: [piece], width: piece.width, isSpace: false });
      continue;
    }
    const chars = Array.from(piece.text);
    for (const ch of chars) {
      const single: Piece = { ...piece, text: ch, em: piece.em / chars.length, width: 0 };
      single.width = measurePiece(pdf, single);
      result.push({ pieces: [single], width: single.width, isSpace: false });
    }
  }
  return result;
}

function wrapTokens(pdf: jsPDF, tokens: Token[], maxWidth: number | null): Token[][] {
  if (maxWidth === null) return [tokens];
  const lines: Token[][] = [];
  let line: Token[] = [];
  let lineWidth = 0;
  const breakLine = () => {
    while (line.length > 0 && line[line.length - 1].isSpace) line.pop();
    lines.push(line);
    line = [];
    lineWidth = 0;
  };

  for (const token of tokens) {
    if (token.isSpace) {
      if (line.length === 0 && lines.length > 0) continue; // spasi di awal baris hasil wrap
      line.push(token);
      lineWidth += token.width;
      continue;
    }
    if (lineWidth + token.width > maxWidth + 0.01 && line.some(t => !t.isSpace)) breakLine();
    if (token.width > maxWidth + 0.01) {
      for (const part of splitTokenChars(pdf, token)) {
        if (lineWidth + part.width > maxWidth + 0.01 && line.length > 0) breakLine();
        line.push(part);
        lineWidth += part.width;
      }
      continue;
    }
    line.push(token);
    lineWidth += token.width;
  }
  lines.push(line);
  return lines;
}

function layoutText(pdf: jsPDF, runs: Array<{ text: string; font: FontSpec }>, maxWidth: number | null, baseFont: FontSpec): TextLine[] {
  const lines: TextLine[] = [];
  for (const paragraph of buildParagraphs(pdf, runs)) {
    for (const tokens of wrapTokens(pdf, paragraph, maxWidth)) {
      const pieces = tokens.flatMap(token => token.pieces);
      const maxSize = pieces.reduce((max, piece) => Math.max(max, piece.font.size), 0) || baseFont.size;
      const lineFactor = pieces.reduce((max, piece) => Math.max(max, piece.font.lineFactor), 0) || baseFont.lineFactor;
      lines.push({
        pieces,
        width: pieces.reduce((sum, piece) => sum + piece.width, 0),
        height: maxSize * lineFactor,
        maxSize,
      });
    }
  }
  return lines;
}

const blockHeight = (lines: TextLine[]) => lines.reduce((sum, line) => sum + line.height, 0);

// ---------------------------------------------------------------------------
// Sheet: worksheet, merge, gambar, area cetak
// ---------------------------------------------------------------------------

function base64ToArrayBuffer(base64OrDataUrl: string): ArrayBuffer {
  const cleanBase64 = (base64OrDataUrl.includes(',') ? base64OrDataUrl.split(',')[1] : base64OrDataUrl).replace(/\s/g, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Membaca satu file teks dari arsip .xlsx (zip). ExcelJS tidak menyimpan style "Normal"
// workbook setelah load, padahal font-nya menentukan lebar kolom.
async function readZipText(buffer: ArrayBuffer, entryName: string): Promise<string | null> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < entryCount && offset + 46 <= bytes.length; n++) {
    if (view.getUint32(offset, true) !== 0x02014b50) return null;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (name === entryName) {
      const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      const data = bytes.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return decoder.decode(data);
      if (method === 8 && typeof DecompressionStream !== 'undefined') {
        const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return decoder.decode(await new Response(stream).arrayBuffer());
      }
      return null;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

async function readNormalFont(buffer: ArrayBuffer): Promise<{ name: string; size: number } | null> {
  try {
    const xml = await readZipText(buffer, 'xl/styles.xml');
    const fontXml = xml && /<(?:\w+:)?fonts\b[^>]*>\s*<(?:\w+:)?font\b[^>]*>([\s\S]*?)<\/(?:\w+:)?font>/.exec(xml)?.[1];
    if (!fontXml) return null;
    const size = Number(/<(?:\w+:)?sz\b[^>]*\bval="([\d.]+)"/.exec(fontXml)?.[1]);
    const name = /<(?:\w+:)?name\b[^>]*\bval="([^"]+)"/.exec(fontXml)?.[1];
    return { name: name || 'Calibri', size: size > 0 ? size : 11 };
  } catch (fontErr) {
    console.warn('Could not read Normal font from Excel styles:', fontErr);
    return null;
  }
}

function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(ref.trim());
  if (!match) return null;
  let col = 0;
  for (const ch of match[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(match[2]), col };
}

function parseRangeRef(ref: string): CellRange | null {
  const clean = ref.includes('!') ? ref.slice(ref.lastIndexOf('!') + 1) : ref;
  const [startRef, endRef] = clean.split(':');
  const start = parseCellRef(startRef);
  const end = parseCellRef(endRef ?? startRef);
  if (!start || !end) return null;
  return {
    top: Math.min(start.row, end.row),
    left: Math.min(start.col, end.col),
    bottom: Math.max(start.row, end.row),
    right: Math.max(start.col, end.col),
  };
}

function pickPrintableWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  const visible = workbook.worksheets.filter(ws => !ws.state || ws.state === 'visible');
  const activeTab = (workbook.views?.[0] as any)?.activeTab;
  const active = typeof activeTab === 'number' ? workbook.worksheets[activeTab] : undefined;
  if (active && visible.includes(active)) return active;
  return visible[0] ?? workbook.worksheets[0];
}

function readImages(workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet): SheetImage[] {
  const formats: Record<string, string> = { png: 'PNG', jpg: 'JPEG', jpeg: 'JPEG', gif: 'GIF', bmp: 'BMP', webp: 'WEBP' };
  const anchorOf = (anchor: any): ImageAnchor => ({
    col: Number(anchor.nativeCol) || 0,
    colOff: Number(anchor.nativeColOff) || 0,
    row: Number(anchor.nativeRow) || 0,
    rowOff: Number(anchor.nativeRowOff) || 0,
  });
  const images: SheetImage[] = [];
  try {
    for (const image of worksheet.getImages()) {
      const media: any = workbook.getImage(Number(image.imageId));
      const format = formats[String(media?.extension || '').toLowerCase()];
      const range: any = image.range;
      if (!format || !range?.tl) continue;
      let data: Uint8Array | null = null;
      if (media.buffer) data = new Uint8Array(media.buffer);
      else if (typeof media.base64 === 'string') data = new Uint8Array(base64ToArrayBuffer(media.base64));
      if (!data || data.length === 0) continue;
      images.push({
        id: Number(image.imageId),
        data,
        format,
        from: anchorOf(range.tl),
        to: range.br ? anchorOf(range.br) : undefined,
        ext: range.ext && range.ext.width > 0 && range.ext.height > 0 ? { width: range.ext.width, height: range.ext.height } : undefined,
      });
    }
  } catch (imgErr) {
    console.warn('Could not extract images from Excel sheet:', imgErr);
  }
  return images;
}

function hasVisibleBorder(border: Partial<ExcelJS.Borders> | undefined): boolean {
  if (!border) return false;
  return (['top', 'left', 'bottom', 'right'] as const).some(side => Boolean(border[side]?.style));
}

// ---------------------------------------------------------------------------
// Render utama
// ---------------------------------------------------------------------------

/**
 * Render lembar kerja Excel (sheet aktif / pertama yang terlihat) menjadi PDF A4
 * yang mengikuti tampilan cetak Excel. Menghasilkan ArrayBuffer jsPDF untuk
 * digabungkan dengan pdf-lib.
 */
export async function renderExcelToPdfPage(
  excelData: ArrayBuffer | string
): Promise<ArrayBuffer> {
  const arrayBuffer = typeof excelData === 'string'
    ? base64ToArrayBuffer(excelData)
    : excelData;

  const normalFont = await readNormalFont(arrayBuffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = pickPrintableWorksheet(workbook);
  if (!worksheet) {
    throw new Error('Berkas Excel tidak memiliki sheet yang valid');
  }

  const palette = parseThemePalette(workbook);
  const pageSetup: Partial<ExcelJS.PageSetup> = worksheet.pageSetup || {};
  const landscape = pageSetup.orientation === 'landscape';
  const pdf = new jsPDF({ orientation: landscape ? 'l' : 'p', unit: 'pt', format: 'a4', compress: true });
  const baseFont: Partial<ExcelJS.Font> = normalFont ? { name: normalFont.name, size: normalFont.size } : DEFAULT_FONT;
  const defaultFont = toFontSpec(baseFont, palette);
  const digitWidthPx = maxDigitWidthPx(normalFont ?? { name: 'Calibri', size: 11 });

  // 1. Merged cells
  const merges: CellRange[] = ((worksheet as any).model?.merges || [])
    .map((ref: string) => parseRangeRef(ref))
    .filter((range: CellRange | null): range is CellRange => Boolean(range));
  const mergeAt = new Map<string, CellRange>();
  for (const merge of merges) {
    for (let r = merge.top; r <= merge.bottom; r++) {
      for (let c = merge.left; c <= merge.right; c++) mergeAt.set(`${r}:${c}`, merge);
    }
  }

  // 2. Lebar kolom & tinggi baris eksplisit
  const sheetProps: any = worksheet.properties || {};
  const defaultRowHeight = typeof sheetProps.defaultRowHeight === 'number' && sheetProps.defaultRowHeight > 0
    ? sheetProps.defaultRowHeight
    : DEFAULT_ROW_HEIGHT_PT;
  const columnWidth = (c: number): number => {
    const column = worksheet.getColumn(c);
    if (column.hidden || column.width === 0) return 0;
    const width = typeof column.width === 'number' && column.width > 0
      ? column.width
      : typeof sheetProps.defaultColWidth === 'number' && sheetProps.defaultColWidth > 0
        ? sheetProps.defaultColWidth
        : DEFAULT_COL_WIDTH_CHARS;
    return width * digitWidthPx * PX_TO_PT;
  };
  const isRowHidden = (r: number) => Boolean(worksheet.findRow(r)?.hidden);
  const explicitRowHeight = (r: number): number | null => {
    const row = worksheet.findRow(r);
    if (row?.hidden) return 0;
    return row && typeof row.height === 'number' && row.height >= 0 ? row.height : null;
  };

  // 3. Area cetak: print area Excel, atau seluruh sel yang berisi / berformat terlihat
  const images = readImages(workbook, worksheet);
  let range = pageSetup.printArea ? parseRangeRef(String(pageSetup.printArea).split('&&')[0]) : null;
  if (!range) {
    let top = Infinity, left = Infinity, bottom = 0, right = 0;
    const include = (r: number, c: number) => {
      top = Math.min(top, r);
      left = Math.min(left, c);
      bottom = Math.max(bottom, r);
      right = Math.max(right, c);
    };
    const rowLimit = Math.min(worksheet.rowCount, MAX_ROWS);
    for (let r = 1; r <= rowLimit; r++) {
      const row = worksheet.findRow(r);
      if (!row) continue;
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        if (c > MAX_COLS) return;
        const fill = resolveFill(cell.fill, palette);
        if (!isBlankValue(cell.value) || hasVisibleBorder(cell.border) || (fill && !isNearWhite(fill))) {
          include(r, c);
          const merge = mergeAt.get(`${r}:${c}`);
          if (merge) {
            include(merge.top, merge.left);
            include(merge.bottom, merge.right);
          }
        }
      });
    }
    for (const image of images) {
      include(image.from.row + 1, image.from.col + 1);
      if (image.to) include(image.to.row + 1, image.to.col + 1);
    }
    if (!Number.isFinite(top)) {
      throw new Error('Lembar Excel kosong, tidak ada konten yang bisa dicetak');
    }
    range = { top, left, bottom, right };
  }
  const printRange: CellRange = {
    ...range,
    bottom: Math.min(range.bottom, MAX_ROWS),
    right: Math.min(range.right, MAX_COLS),
  };

  // 4. Bangun item sel (fill + teks yang sudah di-layout)
  const colWidths = new Map<number, number>();
  for (let c = printRange.left; c <= printRange.right; c++) colWidths.set(c, columnWidth(c));
  const spanWidth = (from: number, to: number) => {
    let sum = 0;
    for (let c = from; c <= to; c++) sum += colWidths.get(c) ?? columnWidth(c);
    return sum;
  };
  const items: CellItem[] = [];
  const occupied = new Set<string>(); // sel berisi nilai / bagian merge -> menahan teks yang meluber

  for (let r = printRange.top; r <= printRange.bottom; r++) {
    const row = worksheet.findRow(r);
    if (!row || row.hidden) continue;
    for (let c = printRange.left; c <= printRange.right; c++) {
      const merge = mergeAt.get(`${r}:${c}`);
      if (merge) occupied.add(`${r}:${c}`);
      if (merge && (merge.top !== r || merge.left !== c)) continue;
      if ((colWidths.get(c) ?? 0) === 0 && !merge) continue;

      const cell = row.getCell(c);
      const content = readCellContent(cell.value, cell.numFmt);
      const fill = resolveFill(cell.fill, palette);
      if (!content && !fill) continue;
      if (content) occupied.add(`${r}:${c}`);

      const area: CellRange = merge
        ? {
          top: Math.max(merge.top, printRange.top),
          left: Math.max(merge.left, printRange.left),
          bottom: Math.min(merge.bottom, printRange.bottom),
          right: Math.min(merge.right, printRange.right),
        }
        : { top: r, left: c, bottom: r, right: c };

      const alignment: Partial<ExcelJS.Alignment> = cell.alignment || {};
      const horizontal = alignment.horizontal;
      const wrap = Boolean(alignment.wrapText) || horizontal === 'justify' || horizontal === 'distributed';
      let hAlign: HAlign;
      if (horizontal === 'center' || horizontal === 'centerContinuous') hAlign = 'center';
      else if (horizontal === 'right') hAlign = 'right';
      else if (horizontal) hAlign = 'left';
      else hAlign = content?.kind === 'number' ? 'right' : content?.kind === 'boolean' || content?.kind === 'error' ? 'center' : 'left';
      const vertical = alignment.vertical;
      const vAlign: VAlign = vertical === 'top' ? 'top' : vertical === 'middle' || vertical === 'distributed' || vertical === 'justify' ? 'middle' : 'bottom';
      const indent = hAlign === 'center' ? 0 : (Number(alignment.indent) || 0) * INDENT_PT;
      const rawRotation: unknown = alignment.textRotation;
      const vertical255 = rawRotation === 'vertical' || rawRotation === 255;
      const rotation = typeof rawRotation === 'number' && !vertical255 ? rawRotation : 0;

      let lines: TextLine[] = [];
      if (content) {
        const cellFont = cell.font || baseFont;
        let runs = content.runs.map(run => ({
          text: vertical255 ? Array.from(run.text).join('\n') : run.text,
          font: toFontSpec(run.font
            ? { ...cellFont, ...run.font, bold: Boolean(run.font.bold), italic: Boolean(run.font.italic), strike: Boolean(run.font.strike), underline: run.font.underline }
            : cellFont, palette),
        }));
        const boxWidth = spanWidth(area.left, area.right);
        const innerWidth = Math.max(1, boxWidth - 2 * CELL_PAD_X - indent);
        lines = layoutText(pdf, runs, wrap && rotation === 0 ? innerWidth : null, defaultFont);

        // Shrink to fit: kecilkan font sampai muat di lebar sel
        const widest = lines.reduce((max, line) => Math.max(max, line.width), 0);
        if (alignment.shrinkToFit && !wrap && widest > innerWidth) {
          const factor = innerWidth / widest;
          runs = runs.map(run => ({ ...run, font: { ...run.font, size: run.font.size * factor } }));
          lines = layoutText(pdf, runs, null, defaultFont);
        }
      }

      items.push({
        ...area,
        fill,
        lines,
        hAlign,
        vAlign,
        indent,
        canOverflow: !merge && !wrap && rotation === 0 && !vertical255 && content?.kind === 'text',
        rotation,
      });
    }
  }

  // 5. Tinggi baris (baris tanpa tinggi eksplisit di-autofit seperti Excel)
  const rowHeights = new Map<number, number>();
  for (let r = printRange.top; r <= printRange.bottom; r++) {
    const explicit = explicitRowHeight(r);
    rowHeights.set(r, explicit ?? defaultRowHeight);
  }
  for (const item of items) {
    if (item.top !== item.bottom || item.lines.length === 0 || item.rotation !== 0) continue;
    if (explicitRowHeight(item.top) !== null) continue;
    const needed = blockHeight(item.lines) + 2 * CELL_PAD_Y + 1;
    if (needed > (rowHeights.get(item.top) ?? 0)) rowHeights.set(item.top, needed);
  }

  // 6. Posisi tepi kolom & baris (absolut dari A1, termasuk area di luar print range untuk anchor gambar)
  let maxCol = printRange.right;
  let maxRow = printRange.bottom;
  for (const image of images) {
    maxCol = Math.max(maxCol, image.from.col + 1, (image.to?.col ?? 0) + 1);
    maxRow = Math.max(maxRow, image.from.row + 1, (image.to?.row ?? 0) + 1);
  }
  maxCol = Math.min(maxCol, MAX_COLS);
  maxRow = Math.min(maxRow, MAX_ROWS);
  const colEdge: number[] = [0, 0];
  for (let c = 1; c <= maxCol; c++) colEdge[c + 1] = colEdge[c] + (colWidths.get(c) ?? columnWidth(c));
  const rowEdge: number[] = [0, 0];
  for (let r = 1; r <= maxRow; r++) {
    const height = rowHeights.get(r) ?? explicitRowHeight(r) ?? (isRowHidden(r) ? 0 : defaultRowHeight);
    rowEdge[r + 1] = rowEdge[r] + height;
  }

  // 7. Border per sisi sel (sisi di dalam merge diabaikan, konflik ambil garis paling tebal)
  const hEdges = new Map<number, Map<number, BorderEdge>>(); // tepi atas baris r, per kolom
  const vEdges = new Map<number, Map<number, BorderEdge>>(); // tepi kiri kolom c, per baris
  const putEdge = (map: Map<number, Map<number, BorderEdge>>, a: number, b: number, edge: BorderEdge) => {
    let inner = map.get(a);
    if (!inner) {
      inner = new Map();
      map.set(a, inner);
    }
    const existing = inner.get(b);
    if (!existing || (BORDER_STYLES[edge.style]?.rank ?? 0) > (BORDER_STYLES[existing.style]?.rank ?? 0)) {
      inner.set(b, edge);
    }
  };
  const gridColor: RGB = [192, 192, 192];
  for (let r = printRange.top; r <= printRange.bottom; r++) {
    const row = worksheet.findRow(r);
    if (row?.hidden) continue;
    for (let c = printRange.left; c <= printRange.right; c++) {
      if ((colWidths.get(c) ?? 0) === 0) continue;
      const merge = mergeAt.get(`${r}:${c}`);
      const sides = {
        top: !merge || merge.top === r,
        bottom: !merge || merge.bottom === r,
        left: !merge || merge.left === c,
        right: !merge || merge.right === c,
      };
      if (pageSetup.showGridLines) {
        const grid: BorderEdge = { style: 'grid', color: gridColor };
        if (sides.top) putEdge(hEdges, r, c, grid);
        if (sides.bottom) putEdge(hEdges, r + 1, c, grid);
        if (sides.left) putEdge(vEdges, c, r, grid);
        if (sides.right) putEdge(vEdges, c + 1, r, grid);
      }
      const border = row?.getCell(c).border;
      if (!border) continue;
      const edgeOf = (side: keyof ExcelJS.Borders): BorderEdge | null => {
        const b: any = (border as any)[side];
        if (!b?.style || !BORDER_STYLES[b.style]) return null;
        return { style: b.style, color: resolveColor(b.color, palette) ?? [0, 0, 0] };
      };
      const top = sides.top && edgeOf('top');
      const bottom = sides.bottom && edgeOf('bottom');
      const left = sides.left && edgeOf('left');
      const right = sides.right && edgeOf('right');
      if (top) putEdge(hEdges, r, c, top);
      if (bottom) putEdge(hEdges, r + 1, c, bottom);
      if (left) putEdge(vEdges, c, r, left);
      if (right) putEdge(vEdges, c + 1, r, right);
    }
  }

  // 8. Skala & pembagian halaman
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margins = pageSetup.margins || { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };
  const marginLeft = Math.max(0, Number(margins.left) || 0) * 72;
  const marginRight = Math.max(0, Number(margins.right) || 0) * 72;
  const marginTop = Math.max(0, Number(margins.top) || 0) * 72;
  const marginBottom = Math.max(0, Number(margins.bottom) || 0) * 72;
  const availWidth = Math.max(pageWidth * 0.5, pageWidth - marginLeft - marginRight);
  const availHeight = Math.max(pageHeight * 0.5, pageHeight - marginTop - marginBottom);

  const contentWidth = colEdge[printRange.right + 1] - colEdge[printRange.left];
  const contentHeight = rowEdge[printRange.bottom + 1] - rowEdge[printRange.top];
  if (contentWidth <= 0 || contentHeight <= 0) {
    throw new Error('Area cetak Excel tidak memiliki ukuran yang valid');
  }
  // Kolom selalu dimuatkan ke lebar 1 halaman; tinggi mengikuti fit to page / scale Excel
  let scale = Math.min(1, availWidth / contentWidth);
  if (pageSetup.fitToPage) {
    const pagesTall = typeof pageSetup.fitToHeight === 'number' ? pageSetup.fitToHeight : 1;
    if (pagesTall > 0) scale = Math.min(scale, (availHeight * pagesTall) / contentHeight);
  } else if (typeof pageSetup.scale === 'number' && pageSetup.scale > 0) {
    scale = Math.min(pageSetup.scale / 100, availWidth / contentWidth);
  }
  scale = Math.max(scale, 0.05);

  const manualBreaks = new Set<number>(
    pageSetup.fitToPage ? [] : (((worksheet as any).rowBreaks || []) as any[]).map(b => Number(b?.id)).filter(Boolean)
  );
  const bands: Array<{ from: number; to: number }> = [];
  let bandStart = printRange.top;
  let bandHeight = 0;
  for (let r = printRange.top; r <= printRange.bottom; r++) {
    const height = (rowEdge[r + 1] - rowEdge[r]) * scale;
    if (bandHeight + height > availHeight + 0.5 && r > bandStart) {
      bands.push({ from: bandStart, to: r - 1 });
      bandStart = r;
      bandHeight = 0;
    }
    bandHeight += height;
    if (manualBreaks.has(r) && r < printRange.bottom) {
      bands.push({ from: bandStart, to: r });
      bandStart = r + 1;
      bandHeight = 0;
    }
  }
  if (bandStart <= printRange.bottom) bands.push({ from: bandStart, to: printRange.bottom });

  // 9. Gambar tiap halaman
  bands.forEach((band, bandIndex) => {
    if (bandIndex > 0) pdf.addPage('a4', landscape ? 'l' : 'p');
    const bandTop = rowEdge[band.from];
    const bandPageHeight = (rowEdge[band.to + 1] - bandTop) * scale;
    const offsetX = marginLeft + (pageSetup.horizontalCentered ? (availWidth - contentWidth * scale) / 2 : 0);
    const offsetY = marginTop + (pageSetup.verticalCentered ? (availHeight - bandPageHeight) / 2 : 0);
    const X = (x: number) => offsetX + (x - colEdge[printRange.left]) * scale;
    const Y = (y: number) => offsetY + (y - bandTop) * scale;
    const inBand = (item: CellRange) => item.bottom >= band.from && item.top <= band.to;
    const clipRect = (x: number, y: number, w: number, h: number) => {
      pdf.rect(x, y, w, h, null);
      pdf.clip();
      pdf.discardPath();
    };

    pdf.saveGraphicsState();
    clipRect(offsetX - 2, offsetY - 2, contentWidth * scale + 4, bandPageHeight + 4);

    // 9a. Warna fill sel
    for (const item of items) {
      if (!item.fill || !inBand(item)) continue;
      const x = colEdge[item.left];
      const y = rowEdge[item.top];
      const w = colEdge[item.right + 1] - x;
      const h = rowEdge[item.bottom + 1] - y;
      if (w <= 0 || h <= 0) continue;
      pdf.setFillColor(item.fill[0], item.fill[1], item.fill[2]);
      pdf.rect(X(x), Y(y), w * scale + 0.3, h * scale + 0.3, 'F');
    }

    // 9b. Teks
    for (const item of items) {
      if (item.lines.length === 0 || !inBand(item)) continue;
      drawCellText(item);
    }

    // 9c. Border
    drawBorders();

    // 9d. Gambar / logo
    for (const image of images) {
      const x1 = colEdge[image.from.col + 1] + image.from.colOff / EMU_PER_PT;
      const y1 = rowEdge[image.from.row + 1] + image.from.rowOff / EMU_PER_PT;
      let x2: number, y2: number;
      if (image.to) {
        x2 = colEdge[image.to.col + 1] + image.to.colOff / EMU_PER_PT;
        y2 = rowEdge[image.to.row + 1] + image.to.rowOff / EMU_PER_PT;
      } else if (image.ext) {
        x2 = x1 + image.ext.width * PX_TO_PT;
        y2 = y1 + image.ext.height * PX_TO_PT;
      } else {
        continue;
      }
      if (![x1, y1, x2, y2].every(Number.isFinite) || x2 <= x1 || y2 <= y1) continue;
      if (y2 < bandTop || y1 > rowEdge[band.to + 1]) continue;
      try {
        pdf.addImage(image.data, image.format, X(x1), Y(y1), (x2 - x1) * scale, (y2 - y1) * scale, `excel-img-${image.id}`, 'FAST');
      } catch (imgErr) {
        console.warn('Gagal menggambar gambar dari Excel:', imgErr);
      }
    }

    pdf.restoreGraphicsState();

    function drawCellText(item: CellItem) {
      const boxX = colEdge[item.left];
      const boxY = rowEdge[item.top];
      const boxW = colEdge[item.right + 1] - boxX;
      const boxH = rowEdge[item.bottom + 1] - boxY;
      if (boxH <= 0 || boxW <= 0) return;

      if (item.rotation !== 0) {
        drawRotatedText(item, boxX, boxY, boxW, boxH);
        return;
      }

      // Area clip: sel itu sendiri, diperluas ke sel kosong di sebelahnya untuk teks yang meluber
      let clipX1 = boxX;
      let clipX2 = boxX + boxW;
      const widest = item.lines.reduce((max, line) => Math.max(max, line.width), 0);
      const needed = widest + 2 * CELL_PAD_X + item.indent;
      if (item.canOverflow && needed > boxW) {
        const free = (c: number) => c >= printRange.left && c <= printRange.right && !occupied.has(`${item.top}:${c}`);
        if (item.hAlign === 'left' || item.hAlign === 'center') {
          const target = item.hAlign === 'left' ? boxX + needed : boxX + boxW / 2 + needed / 2;
          for (let c = item.right + 1; clipX2 < target && free(c); c++) clipX2 = colEdge[c + 1];
        }
        if (item.hAlign === 'right' || item.hAlign === 'center') {
          const target = item.hAlign === 'right' ? boxX + boxW - needed : boxX + boxW / 2 - needed / 2;
          for (let c = item.left - 1; clipX1 > target && free(c); c--) clipX1 = colEdge[c];
        }
      }

      pdf.saveGraphicsState();
      clipRect(X(clipX1), Y(boxY), (clipX2 - clipX1) * scale, boxH * scale);

      // Teks yang lebih tinggi dari selnya ditampilkan Excel mulai dari baris pertama (rata atas)
      const total = blockHeight(item.lines);
      const overflowsVertically = total > boxH - 2 * CELL_PAD_Y + 0.5;
      let lineTop = item.vAlign === 'top' || overflowsVertically
        ? boxY + CELL_PAD_Y
        : item.vAlign === 'middle'
          ? boxY + (boxH - total) / 2
          : boxY + boxH - CELL_PAD_Y - total;

      for (const line of item.lines) {
        const baseline = lineTop + line.height / 2 + 0.35 * line.maxSize;
        let x = item.hAlign === 'left'
          ? boxX + CELL_PAD_X + item.indent
          : item.hAlign === 'right'
            ? boxX + boxW - CELL_PAD_X - item.indent - line.width
            : boxX + (boxW - line.width) / 2;
        for (const piece of line.pieces) {
          drawPiece(piece, X(x), Y(baseline), 0);
          if (piece.font.strike || piece.font.underline) {
            const size = piece.font.size * scale;
            pdf.setDrawColor(piece.font.color[0], piece.font.color[1], piece.font.color[2]);
            pdf.setLineWidth(Math.max(0.3, size * 0.055));
            pdf.setLineDashPattern([], 0);
            if (piece.font.strike) pdf.line(X(x), Y(baseline) - size * 0.27, X(x + piece.width), Y(baseline) - size * 0.27);
            if (piece.font.underline) pdf.line(X(x), Y(baseline) + size * 0.12, X(x + piece.width), Y(baseline) + size * 0.12);
          }
          x += piece.width;
        }
        lineTop += line.height;
      }
      pdf.restoreGraphicsState();
    }

    function drawRotatedText(item: CellItem, boxX: number, boxY: number, boxW: number, boxH: number) {
      const pieces = item.lines.flatMap(line => line.pieces);
      const width = pieces.reduce((sum, piece) => sum + piece.width, 0);
      const size = item.lines.reduce((max, line) => Math.max(max, line.maxSize), 0);
      const angle = (item.rotation * Math.PI) / 180;
      const dir = { x: Math.cos(angle), y: -Math.sin(angle) };
      const up = { x: -Math.sin(angle), y: -Math.cos(angle) };
      const centerX = X(boxX + boxW / 2);
      const centerY = Y(boxY + boxH / 2);
      let px = centerX - (dir.x * width * scale) / 2 - up.x * 0.35 * size * scale;
      let py = centerY - (dir.y * width * scale) / 2 - up.y * 0.35 * size * scale;

      pdf.saveGraphicsState();
      clipRect(X(boxX), Y(boxY), boxW * scale, boxH * scale);
      for (const piece of pieces) {
        drawPiece(piece, px, py, item.rotation);
        px += dir.x * piece.width * scale;
        py += dir.y * piece.width * scale;
      }
      pdf.restoreGraphicsState();
    }

    function drawPiece(piece: Piece, x: number, y: number, angle: number) {
      const size = piece.font.size * scale;
      const [r, g, b] = piece.font.color;
      if (piece.kind === 'glyph') {
        drawGlyph(piece.glyph ?? 'box', x, y, size, piece.font.color);
        return;
      }
      if (piece.text.trim() === '') return;
      if (piece.kind === 'symbol') pdf.setFont('symbol', 'normal');
      else if (piece.kind === 'zapf') pdf.setFont('zapfdingbats', 'normal');
      else pdf.setFont(piece.font.family, fontStyleName(piece.font));
      pdf.setFontSize(size);
      pdf.setTextColor(r, g, b);
      const options: { horizontalScale?: number; angle?: number } = {};
      if (piece.kind === 'text' && Math.abs(piece.drawScale - 1) > 0.001) options.horizontalScale = piece.drawScale;
      if (angle !== 0) options.angle = angle;
      pdf.text(piece.text, x, y, options);
    }

    function drawGlyph(glyph: DrawnGlyph, x: number, baseline: number, size: number, color: RGB) {
      const side = size * 0.68;
      const left = x + size * 0.08;
      const top = baseline - size * 0.72;
      pdf.setDrawColor(color[0], color[1], color[2]);
      pdf.setLineDashPattern([], 0);
      pdf.setLineWidth(Math.max(0.3, size * 0.06));
      if (glyph === 'circle') {
        pdf.circle(left + side / 2, top + side / 2, side / 2, 'S');
        return;
      }
      pdf.rect(left, top, side, side, 'S');
      pdf.setLineWidth(Math.max(0.4, size * 0.085));
      if (glyph === 'boxCheck') {
        pdf.line(left + side * 0.18, top + side * 0.52, left + side * 0.42, top + side * 0.78);
        pdf.line(left + side * 0.42, top + side * 0.78, left + side * 0.84, top + side * 0.2);
      } else if (glyph === 'boxCross') {
        pdf.line(left + side * 0.2, top + side * 0.2, left + side * 0.8, top + side * 0.8);
        pdf.line(left + side * 0.8, top + side * 0.2, left + side * 0.2, top + side * 0.8);
      }
    }

    function strokeEdge(edge: BorderEdge, x1: number, y1: number, x2: number, y2: number) {
      const style = BORDER_STYLES[edge.style] ?? BORDER_STYLES.thin;
      pdf.setDrawColor(edge.color[0], edge.color[1], edge.color[2]);
      pdf.setLineWidth(style.width);
      pdf.setLineDashPattern(style.dash ?? [], 0);
      if (style.double) {
        const horizontal = y1 === y2;
        const off = 0.7;
        pdf.line(x1 - (horizontal ? 0 : off), y1 - (horizontal ? off : 0), x2 - (horizontal ? 0 : off), y2 - (horizontal ? off : 0));
        pdf.line(x1 + (horizontal ? 0 : off), y1 + (horizontal ? off : 0), x2 + (horizontal ? 0 : off), y2 + (horizontal ? off : 0));
        return;
      }
      pdf.line(x1, y1, x2, y2);
    }

    function drawBorders() {
      const sameEdge = (a?: BorderEdge, b?: BorderEdge) =>
        Boolean(a && b && a.style === b.style && a.color.join() === b.color.join());

      // Garis horizontal: digabung per baris agar pola putus-putus tersambung
      for (let r = band.from; r <= band.to + 1; r++) {
        const edges = hEdges.get(r);
        if (!edges) continue;
        let c = printRange.left;
        while (c <= printRange.right) {
          const edge = edges.get(c);
          if (!edge) {
            c++;
            continue;
          }
          let end = c;
          while (end + 1 <= printRange.right && sameEdge(edges.get(end + 1), edge)) end++;
          if (colEdge[end + 1] > colEdge[c]) {
            strokeEdge(edge, X(colEdge[c]), Y(rowEdge[r]), X(colEdge[end + 1]), Y(rowEdge[r]));
          }
          c = end + 1;
        }
      }
      // Garis vertikal
      for (let c = printRange.left; c <= printRange.right + 1; c++) {
        const edges = vEdges.get(c);
        if (!edges) continue;
        let r = band.from;
        while (r <= band.to) {
          const edge = edges.get(r);
          if (!edge) {
            r++;
            continue;
          }
          let end = r;
          while (end + 1 <= band.to && sameEdge(edges.get(end + 1), edge)) end++;
          if (rowEdge[end + 1] > rowEdge[r]) {
            strokeEdge(edge, X(colEdge[c]), Y(rowEdge[r]), X(colEdge[c]), Y(rowEdge[end + 1]));
          }
          r = end + 1;
        }
      }
      pdf.setLineDashPattern([], 0);
    }
  });

  return pdf.output('arraybuffer');
}
