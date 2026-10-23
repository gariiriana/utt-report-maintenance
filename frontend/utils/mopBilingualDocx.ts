// ============================================================================
// FILE: frontend/utils/mopBilingualDocx.ts
// Deskripsi: Membuat versi Bilingual (EN + ID) dari file Word MOP langsung di
//            dalam DOCX aslinya. Setiap paragraf berbahasa Inggris (termasuk isi
//            sel tabel) mendapat baris terjemahan Indonesia di bawahnya, disisipkan
//            sebagai line break di paragraf yang sama sehingga penomoran, indentasi,
//            tabel, dan gambar tidak berubah. Baris ID mengikuti kolom tab baris
//            Inggris dan format run aslinya (miring, abu-abu bila teksnya hitam).
// ============================================================================

import JSZip from 'jszip';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ID_COLOR = '595959'; // sama dengan baris ID pada export SOP/EOP

export interface MOPSegment {
  text: string;        // teks Inggris (spasi dirapikan), juga kunci terjemahan
  occurrences: number; // berapa kali teks ini muncul
}

export interface ParsedMOP {
  segments: MOPSegment[];
  title: string;
  documentNumber: string;
}

const isW = (node: Node, name: string) =>
  node.nodeType === 1 && (node as Element).namespaceURI === W_NS && (node as Element).localName === name;

const childElements = (node: Node): Element[] =>
  Array.from(node.childNodes).filter((n): n is Element => n.nodeType === 1);

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Potongan teks paragraf di antara tab. Baris ID meniru tab yang sama agar tiap kolom sejajar. */
interface Piece {
  text: string;
  chars: Map<Element, number>; // run -> jumlah karakter terlihat di potongan ini
  tabRun: Element | null;      // run berisi tab yang menutup potongan ini
}

/**
 * Pecah paragraf per tab. Paragraf bersarang (text box) dan konten fallback (mc:Fallback,
 * duplikat dari mc:Choice) tidak ikut dihitung.
 */
function readPieces(p: Element): Piece[] {
  const newPiece = (): Piece => ({ text: '', chars: new Map(), tabRun: null });
  const pieces = [newPiece()];
  const walk = (node: Element) => {
    for (const child of childElements(node)) {
      // pPr berisi definisi tab stop (<w:tabs><w:tab/>) yang bukan karakter tab.
      if (isW(child, 'p') || isW(child, 'pPr') || isW(child, 'rPr') || child.localName === 'Fallback' || isW(child, 'del')) continue;
      const piece = pieces[pieces.length - 1];
      if (isW(child, 't')) {
        const value = child.textContent || '';
        const run = child.parentNode as Element;
        piece.text += value;
        piece.chars.set(run, (piece.chars.get(run) || 0) + value.trim().length);
      } else if (isW(child, 'tab')) {
        piece.tabRun = child.parentNode as Element;
        pieces.push(newPiece());
      } else if (isW(child, 'br') || isW(child, 'cr')) {
        piece.text += ' ';
      } else {
        walk(child);
      }
    }
  };
  walk(p);
  return pieces;
}

const piecesText = (pieces: Piece[]) => normalize(pieces.map(piece => piece.text).join(' '));
const paragraphText = (p: Element) => piecesText(readPieces(p));
const lastVisible = (pieces: Piece[]) => pieces.map(piece => piece.text.trim() !== '').lastIndexOf(true);

/** Run dengan teks terbanyak di potongan; formatnya disalin ke teks ID potongan itu. */
function bestRun(piece: Piece): Element | null {
  let best: Element | null = null;
  let most = -1;
  for (const [run, count] of piece.chars) {
    if (count > most) {
      best = run;
      most = count;
    }
  }
  return best;
}

// Pilihan frekuensi bercentang di MOP PM: "☐ Monthly [tab] ☑ Quarterly [tab] ☐ Annually"
// (kadang plus "Half of Year"). Minimal dua pilihan, supaya sel tunggal "Monthly" tetap diterjemahkan.
const FREQUENCY_OPTIONS_LINE =
  /^(?:[☐☑☒□■✓✔✗✘]?\s*(?:daily|weekly|bi-?weekly|monthly|bi-?monthly|quarterly|half of year|half[- ]yearly|semi[- ]?annual(?:ly)?|annually|annual|yearly)\s*){2,}$/i;

/**
 * Teks yang perlu diterjemahkan: memuat minimal satu kata biasa. Teks yang seluruhnya
 * kode/angka/singkatan pendek ("NOZ-PP-2NPT-360", "24", "HSE", ": 06/07/2026") dan baris
 * pilihan frekuensi dilewati. Judul seperti "Section 1 – Document Overview" atau
 * "METHOD OF PROCEDURE" tetap diterjemahkan; nama orang/merek dan singkatan panjang (LOTO)
 * diputuskan AI (dikembalikan kosong).
 */
export function needsTranslation(text: string): boolean {
  if (FREQUENCY_OPTIONS_LINE.test(text)) return false;
  const isCode = (token: string) => /\d/.test(token) || /^[A-Z]{2,3}$/.test(token);
  return text
    .split(/[\s/,()\-–:;.&"'°]+/)
    .some(token => /[A-Za-z]{2,}/.test(token) && !isCode(token));
}

const SECTION_HEADING = /^Section\s+\d+\b/i;
// Section 3 – Schedule / Work Information dan Section 12 – Approval: tabelnya berisi nama orang
// dan jabatan resmi, tidak diterjemahkan. Label di luar tabel (MOP Execution Date, Job Title …) tetap.
const PEOPLE_SECTION = /^Section\s+\d+\s*[–—-]\s*(Schedule|Approval)\b/i;
const APPROVAL_SECTION = /^Section\s+\d+\s*[–—-]\s*Approval\b/i;
// Tabel data (daftar aset Section 2, alat ukur Section 13): hanya baris judul kolom yang
// diterjemahkan, satu terjemahan per sel; isi barisnya (nama/tipe/serial/merek) tidak.
const DATA_TABLE_HEADER = /^(CI Name\*?|Class Id|Measuring Instrument)$/i;

const nearestAncestor = (node: Node, name: string): Element | null => {
  for (let el = node.parentNode; el; el = el.parentNode) {
    if (isW(el, name)) return el as Element;
  }
  return null;
};

const tableRows = (tbl: Element) =>
  Array.from(tbl.getElementsByTagNameNS(W_NS, 'tr')).filter(tr => nearestAncestor(tr, 'tbl') === tbl);
const rowCells = (row: Element) =>
  Array.from(row.getElementsByTagNameNS(W_NS, 'tc')).filter(tc => nearestAncestor(tc, 'tr') === row);
const paragraphsIn = (el: Element) => Array.from(el.getElementsByTagNameNS(W_NS, 'p'));

const hasField = (p: Element) =>
  ['fldChar', 'fldSimple', 'instrText'].some(name => p.getElementsByTagNameNS(W_NS, name).length > 0);

/** Paragraf yang diberi baris ID, dengan kunci terjemahan per potongan tab (null = tidak diterjemahkan). */
interface Unit {
  p: Element;
  pieces: Piece[];
  keys: (string | null)[];
  heading: boolean;
}

const pieceKeys = (pieces: Piece[]) => pieces.map(piece => {
  const text = normalize(piece.text);
  return text && needsTranslation(text) ? text : null;
});

/** Paragraf yang diterjemahkan, urut kemunculan; dipakai bersama oleh parse dan build. */
function collectUnits(doc: Document): Unit[] {
  // Sel judul kolom tabel data diterjemahkan utuh di bawah paragraf terakhirnya.
  const cellTargets = new Map<Element, string>();
  const skipped = new Set<Element>();
  for (const tbl of Array.from(doc.getElementsByTagNameNS(W_NS, 'tbl'))) {
    const rows = tableRows(tbl);
    const cellText = (tc: Element) => normalize(paragraphsIn(tc).map(paragraphText).join(' '));
    if (rows.length < 2 || !rowCells(rows[0]).some(tc => DATA_TABLE_HEADER.test(cellText(tc)))) continue;
    for (const tc of rowCells(rows[0])) {
      const withText = paragraphsIn(tc).filter(p => paragraphText(p));
      paragraphsIn(tc).forEach(p => skipped.add(p));
      if (withText.length > 0) cellTargets.set(withText[withText.length - 1], cellText(tc));
    }
    for (const row of rows.slice(1)) paragraphsIn(row).forEach(p => skipped.add(p));
  }

  const units: Unit[] = [];
  let peopleSection = false;
  for (const p of Array.from(doc.getElementsByTagNameNS(W_NS, 'p'))) {
    const pieces = readPieces(p);
    const text = piecesText(pieces);
    if (!text) continue;
    const heading = SECTION_HEADING.test(text);
    if (heading) peopleSection = PEOPLE_SECTION.test(text);

    const cellText = cellTargets.get(p);
    if (cellText !== undefined) {
      if (!needsTranslation(cellText)) continue;
      const keys: (string | null)[] = pieces.map(() => null);
      keys[lastVisible(pieces)] = cellText;
      units.push({ p, pieces, keys, heading: false });
      continue;
    }
    // Paragraf ber-field (checkbox formulir, nomor halaman) dan isian frekuensi dibiarkan.
    if (!heading && (skipped.has(p) || hasField(p) || FREQUENCY_OPTIONS_LINE.test(text)
      || (peopleSection && nearestAncestor(p, 'tbl')))) continue;
    const keys = pieceKeys(pieces);
    if (keys.some(Boolean)) units.push({ p, pieces, keys, heading });
  }
  return units;
}

async function loadDocument(buffer: ArrayBuffer) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('File bukan dokumen Word (.docx) yang valid.');
  }
  const entryName = findEntry(zip, 'word/document.xml');
  const entry = entryName ? zip.file(entryName) : null;
  if (!entryName || !entry) throw new Error('File bukan dokumen Word (.docx) yang valid.');
  const xml = await entry.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Isi dokumen Word tidak dapat dibaca.');
  }
  return { zip, entryName, doc, xml };
}

// Sebagian DOCX yang di-zip ulang di Windows memakai "word\document.xml" (backslash).
const findEntry = (zip: JSZip, path: string) =>
  Object.keys(zip.files).find(name => name.replace(/\\/g, '/').toLowerCase() === path);

/**
 * Baca teks MOP: daftar teks unik yang perlu diterjemahkan (urut kemunculan),
 * plus judul & nomor dokumen dari Section 1 bila ada.
 */
export async function parseMOPDocx(buffer: ArrayBuffer): Promise<ParsedMOP> {
  const { doc } = await loadDocument(buffer);
  const segmentMap = new Map<string, MOPSegment>();
  let title = '';
  let documentNumber = '';

  for (const p of Array.from(doc.getElementsByTagNameNS(W_NS, 'p'))) {
    const text = paragraphText(p);
    const titleMatch = text.match(/^Document Title\s*:\s*(.+)$/i);
    if (titleMatch && !title) title = titleMatch[1].trim();
    const numberMatch = text.match(/^Document Number\s*:\s*(.+)$/i);
    if (numberMatch && !documentNumber) documentNumber = numberMatch[1].trim();
  }

  for (const unit of collectUnits(doc)) {
    for (const key of unit.keys) {
      if (!key) continue;
      const existing = segmentMap.get(key);
      if (existing) existing.occurrences++;
      else segmentMap.set(key, { text: key, occurrences: 1 });
    }
  }

  return { segments: [...segmentMap.values()], title, documentNumber };
}

// Atribut w:* yang tidak ada -> null (sebagian parser DOM mengembalikan string kosong).
const wAttr = (el: Element | undefined | null, name: string) =>
  (el && (el.getAttributeNS(W_NS, name) || el.getAttribute(`w:${name}`))) || null;

// Urutan anak w:pPr, w:rPr, w:trPr dan w:tcPr menurut skema; Word menolak elemen yang urutannya salah.
const PPR_ORDER = [
  'pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr',
  'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap',
  'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd',
  'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc',
  'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr',
  'sectPr', 'pPrChange',
];
const RPR_ORDER = [
  'rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline',
  'shadow', 'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing',
  'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText',
  'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath',
];
const TRPR_ORDER = [
  'cnfStyle', 'divId', 'gridBefore', 'gridAfter', 'wBefore', 'wAfter', 'cantSplit', 'trHeight',
  'tblHeader', 'tblCellSpacing', 'jc', 'hidden', 'ins', 'del', 'trPrChange',
];
const TCPR_ORDER = [
  'cnfStyle', 'tcW', 'gridSpan', 'hMerge', 'vMerge', 'tcBorders', 'shd', 'noWrap', 'tcMar',
  'textDirection', 'tcFitText', 'vAlign', 'hideMark', 'headers', 'cellIns', 'cellDel', 'cellMerge', 'tcPrChange',
];

/** Pasang `el` di `parent` pada posisi sesuai `order`, menggantikan elemen bernama sama. */
function setOrderedChild(parent: Element, el: Element, order: string[]): void {
  // Elemen ekstensi (w14:* dst.) selalu berada di belakang elemen w:*.
  const rank = (c: Element) => (c.namespaceURI === W_NS ? order.indexOf(c.localName) : order.length);
  const existing = childElements(parent).find(c => isW(c, el.localName));
  if (existing) parent.removeChild(existing);
  const next = childElements(parent).find(c => rank(c) > rank(el));
  parent.insertBefore(el, next || null);
}

const childW = (el: Element | undefined | null, name: string) =>
  el ? childElements(el).find(c => isW(c, name)) : undefined;

/** Elemen sifat (w:pPr / w:tcPr) milik `el`; dibuat sebagai anak pertama bila belum ada. */
function ensureProps(doc: Document, el: Element, name: string): Element {
  const existing = childW(el, name);
  if (existing) return existing;
  const props = doc.createElementNS(W_NS, `w:${name}`);
  el.insertBefore(props, el.firstChild);
  return props;
}

const setParagraphFlag = (doc: Document, p: Element, name: string) =>
  setOrderedChild(ensureProps(doc, p, 'pPr'), doc.createElementNS(W_NS, `w:${name}`), PPR_ORDER);

/**
 * rPr baris ID: salinan format run Inggris (font, ukuran, tebal, garis bawah, highlight)
 * ditambah miring; teks hitam/otomatis menjadi abu-abu, warna lain (mis. putih di header
 * berwarna) dipertahankan.
 */
function idRunProps(doc: Document, source: Element | null): Element {
  const original = childW(source, 'rPr');
  const rPr = original ? (original.cloneNode(true) as Element) : doc.createElementNS(W_NS, 'w:rPr');
  for (const name of ['i', 'iCs', 'rPrChange']) {
    const el = childW(rPr, name);
    if (el) rPr.removeChild(el);
  }
  setOrderedChild(rPr, doc.createElementNS(W_NS, 'w:i'), RPR_ORDER);
  setOrderedChild(rPr, doc.createElementNS(W_NS, 'w:iCs'), RPR_ORDER);
  const color = childW(rPr, 'color');
  const val = wAttr(color, 'val');
  const theme = wAttr(color, 'themeColor');
  if (!color || ((!val || /^(auto|000000)$/i.test(val)) && (!theme || /^(text1|dark1)$/i.test(theme)))) {
    const gray = doc.createElementNS(W_NS, 'w:color');
    gray.setAttributeNS(W_NS, 'w:val', ID_COLOR);
    setOrderedChild(rPr, gray, RPR_ORDER);
  }
  return rPr;
}

/**
 * Tambahkan baris ID di akhir paragraf: line break, lalu terjemahan tiap potongan di kolom
 * tab yang sama dengan baris Inggris (tab disalin beserta formatnya, mis. garis bawah isian).
 * Mengembalikan rPr teks ID pertama.
 */
function appendIdLine(doc: Document, p: Element, pieces: Piece[], texts: string[]): Element {
  const run = (rPr: Element | null | undefined, content: Element) => {
    const r = doc.createElementNS(W_NS, 'w:r');
    if (rPr) r.appendChild(rPr);
    r.appendChild(content);
    return r;
  };
  const copyRPr = (source: Element | null) => childW(source, 'rPr')?.cloneNode(true) as Element | undefined;
  const tab = (source: Element | null) => run(copyRPr(source), doc.createElementNS(W_NS, 'w:tab'));

  const first = texts.findIndex(Boolean);
  const last = lastVisible(pieces);
  const firstRPr = idRunProps(doc, bestRun(pieces[first]));
  const line = [run(copyRPr(bestRun(pieces[first])), doc.createElementNS(W_NS, 'w:br'))];
  for (let i = 0; i <= last; i++) {
    if (i > 0) line.push(tab(pieces[i - 1].tabRun));
    if (!texts[i]) continue;
    const t = doc.createElementNS(W_NS, 'w:t');
    t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    t.textContent = texts[i];
    line.push(run(i === first ? firstRPr : idRunProps(doc, bestRun(pieces[i])), t));
  }
  // Tab sesudah teks terakhir (mis. ujung bar highlight judul section) ikut ditiru.
  for (let i = last; i < pieces.length - 1; i++) line.push(tab(pieces[i].tabRun));
  line.forEach(r => p.appendChild(r));
  return firstRPr;
}

/** Baris tabel bertinggi pas (hRule="exact") memotong baris ID; jadikan tinggi minimum. */
function relaxExactRowHeights(p: Element): void {
  for (let el = p.parentNode; el; el = el.parentNode) {
    if (!isW(el, 'tr')) continue;
    const height = childW(childW(el as Element, 'trPr'), 'trHeight');
    if (height && wAttr(height, 'hRule') === 'exact') height.setAttributeNS(W_NS, 'w:hRule', 'atLeast');
  }
}

/** Judul Section Approval, label kolomnya, dan tabel tanda tangan dijaga tetap satu halaman. */
function keepApprovalTogether(doc: Document): void {
  const paragraphs = Array.from(doc.getElementsByTagNameNS(W_NS, 'p'));
  const start = paragraphs.findIndex(p => APPROVAL_SECTION.test(paragraphText(p)));
  if (start < 0) return;
  const headingTable = nearestAncestor(paragraphs[start], 'tbl');
  const lead: Element[] = [];
  let table: Element | null = null;
  for (const p of paragraphs.slice(start)) {
    const tbl = nearestAncestor(p, 'tbl');
    if (tbl && tbl !== headingTable) {
      table = tbl;
      break;
    }
    if (lead.length > 0 && SECTION_HEADING.test(paragraphText(p))) return;
    lead.push(p);
  }
  if (!table) return;
  lead.forEach(p => setParagraphFlag(doc, p, 'keepNext'));
  const rows = tableRows(table);
  rows.forEach((row, i) => {
    let trPr = childW(row, 'trPr');
    if (!trPr) {
      trPr = doc.createElementNS(W_NS, 'w:trPr');
      const prEx = childW(row, 'tblPrEx');
      row.insertBefore(trPr, prEx ? prEx.nextSibling : row.firstChild);
    }
    setOrderedChild(trPr, doc.createElementNS(W_NS, 'w:cantSplit'), TRPR_ORDER);
    if (i < rows.length - 1) paragraphsIn(row).forEach(p => setParagraphFlag(doc, p, 'keepNext'));
  });
}

// Elemen w:compat yang menurut skema berada sebelum w:doNotExpandShiftReturn.
const COMPAT_BEFORE_SHIFT_RETURN = [
  'useSingleBorderforContiguousCells', 'wpJustification', 'noTabHangInd', 'noLeading', 'spaceForUL',
  'noColumnBalance', 'balanceSingleByteDoubleByteWidth', 'noExtraLineSpacing', 'doNotLeaveBackslashAlone',
  'ulTrailSpace',
];

/** Baris rata kiri-kanan yang diakhiri line break (baris Inggris di atas baris ID) tidak direnggangkan. */
function keepShiftReturnLinesUnjustified(doc: Document): boolean {
  const compat = doc.getElementsByTagNameNS(W_NS, 'compat')[0];
  if (!compat || childW(compat, 'doNotExpandShiftReturn')) return false;
  const next = childElements(compat).find(c => !(c.namespaceURI === W_NS && COMPAT_BEFORE_SHIFT_RETURN.includes(c.localName)));
  compat.insertBefore(doc.createElementNS(W_NS, 'w:doNotExpandShiftReturn'), next || null);
  return true;
}

const PAGE_FIELD = /^\s*PAGE\b/i;

/**
 * Footer "Page {PAGE} of 14" dengan total halaman diketik manual: total diganti field NUMPAGES
 * karena versi bilingual lebih banyak halamannya.
 */
function linkPageTotal(doc: Document): boolean {
  let changed = false;
  for (const p of paragraphsIn(doc.documentElement)) {
    const hasPageField = Array.from(p.getElementsByTagNameNS(W_NS, 'instrText')).some(el => PAGE_FIELD.test(el.textContent || ''))
      || Array.from(p.getElementsByTagNameNS(W_NS, 'fldSimple')).some(el => PAGE_FIELD.test(wAttr(el, 'instr') || ''));
    if (!hasPageField) continue;
    const runs = childElements(p).filter(c => isW(c, 'r'));
    const runText = (r: Element) => childElements(r).filter(c => isW(c, 't')).map(t => t.textContent || '').join('');
    let ofIndex = -1;
    runs.forEach((r, i) => {
      if (/\bof\s*$/i.test(runText(r))) ofIndex = i;
    });
    const tail = runs.slice(ofIndex + 1);
    const total = tail.map(runText).join('').trim();
    if (ofIndex < 0 || !/^\d+$/.test(total) || !tail.every(r => childElements(r).every(c => isW(c, 'rPr') || isW(c, 't')))) continue;

    const rPr = childW(tail[0], 'rPr');
    const fieldRun = (content: Element) => {
      const r = doc.createElementNS(W_NS, 'w:r');
      if (rPr) r.appendChild(rPr.cloneNode(true));
      r.appendChild(content);
      return r;
    };
    const fldChar = (type: string) => {
      const el = doc.createElementNS(W_NS, 'w:fldChar');
      el.setAttributeNS(W_NS, 'w:fldCharType', type);
      return el;
    };
    const text = (name: string, value: string) => {
      const el = doc.createElementNS(W_NS, `w:${name}`);
      el.setAttributeNS(XML_NS, 'xml:space', 'preserve');
      el.textContent = value;
      return el;
    };
    for (const el of [fldChar('begin'), text('instrText', ' NUMPAGES '), fldChar('separate'), text('t', total), fldChar('end')]) {
      p.insertBefore(fieldRun(el), tail[0]);
    }
    tail.forEach(r => p.removeChild(r));
    changed = true;
  }
  return changed;
}

// Warna w:highlight -> hex untuk shading paragraf.
const HIGHLIGHT_HEX: Record<string, string> = {
  yellow: 'FFFF00', green: '00FF00', cyan: '00FFFF', magenta: 'FF00FF', blue: '0000FF', red: 'FF0000',
  darkBlue: '000080', darkCyan: '008080', darkGreen: '008000', darkMagenta: '800080', darkRed: '800000',
  darkYellow: '808000', darkGray: '808080', lightGray: 'C0C0C0', black: '000000', white: 'FFFFFF',
};

/**
 * Pengisi sebelum/sesudah teks judul (tab, run berisi spasi saja) pada run langsung di paragraf,
 * plus teks pertama & terakhir yang terlihat.
 */
function headingPadding(p: Element) {
  const items = childElements(p).filter(c => isW(c, 'r')).flatMap(run => childElements(run))
    .filter(c => isW(c, 't') || isW(c, 'tab'));
  const visible = (c: Element) => isW(c, 't') && (c.textContent || '').trim() !== '';
  const firstIndex = items.findIndex(visible);
  if (firstIndex < 0) return null;
  let lastIndex = items.length - 1;
  while (!visible(items[lastIndex])) lastIndex--;
  return {
    leading: items.slice(0, firstIndex),
    trailing: items.slice(lastIndex + 1),
    first: items[firstIndex],
    last: items[lastIndex],
  };
}

/**
 * Sel lain di baris judul yang kosong dan berwarna sama dengan sel judul: pengganjal agar teks
 * tampak di tengah bar. [] bila judul satu-satunya sel; null bila baris itu baris tabel biasa.
 */
function spacerCells(cell: Element): Element[] | null {
  const row = cell.parentNode;
  if (!row || !isW(row, 'tr')) return null;
  const prop = (tc: Element, name: string) => childW(childW(tc, 'tcPr'), name);
  const fill = (tc: Element) => wAttr(prop(tc, 'shd'), 'fill');
  const others = childElements(row).filter(c => isW(c, 'tc') && c !== cell);
  const isSpacer = (tc: Element) => (tc.textContent || '').trim() === ''
    && tc.getElementsByTagNameNS(W_NS, 'drawing').length === 0
    && !prop(tc, 'vMerge') && fill(tc) === fill(cell);
  return !prop(cell, 'vMerge') && others.every(isSpacer) ? others : null;
}

/** Gabungkan sel pengganjal ke sel judul (gridSpan & lebar dijumlah) supaya teks bisa di tengah bar. */
function absorbSpacerCells(doc: Document, cell: Element, spacers: Element[]): void {
  const cells = [cell, ...spacers];
  const prop = (tc: Element, name: string) => childW(childW(tc, 'tcPr'), name);
  const span = cells.reduce((sum, tc) => sum + (Number(wAttr(prop(tc, 'gridSpan'), 'val')) || 1), 0);
  const width = cells.reduce((sum, tc) => {
    const tcW = prop(tc, 'tcW');
    return (wAttr(tcW, 'type') || 'dxa') === 'dxa' ? sum + Number(wAttr(tcW, 'w')) : NaN;
  }, 0);
  const tcPr = ensureProps(doc, cell, 'tcPr');
  if (Number.isFinite(width)) {
    const tcW = doc.createElementNS(W_NS, 'w:tcW');
    tcW.setAttributeNS(W_NS, 'w:w', String(width));
    tcW.setAttributeNS(W_NS, 'w:type', 'dxa');
    setOrderedChild(tcPr, tcW, TCPR_ORDER);
  }
  const gridSpan = doc.createElementNS(W_NS, 'w:gridSpan');
  gridSpan.setAttributeNS(W_NS, 'w:val', String(span));
  setOrderedChild(tcPr, gridSpan, TCPR_ORDER);
  for (const tc of spacers) tc.parentNode!.removeChild(tc);
}

type HeadingPadding = NonNullable<ReturnType<typeof headingPadding>>;

/** Buang tab/spasi pengisi; run yang jadi kosong ikut dibuang. */
function removePadding(items: Element[]): void {
  for (const el of items) {
    const run = el.parentNode as Element;
    run.removeChild(el);
    if (childElements(run).every(c => isW(c, 'rPr'))) run.parentNode!.removeChild(run);
  }
}

/**
 * Bar highlight yang lebarnya dibentuk tab stop ("[tab] Section 4 – … [tab]"): tab stop pengisi
 * diganti satu tab rata-tengah di titik tengah bar dan awalan teks dirapikan menjadi satu tab.
 * Tab stop terakhir (ujung bar) dipertahankan, jadi bar tetap persis selebar aslinya.
 */
function centerOnTabStop(doc: Document, pPr: Element, tabs: Element, padding: HeadingPadding): void {
  const stops = childElements(tabs).filter(c => isW(c, 'tab'));
  const positions = stops.map(stop => Number(wAttr(stop, 'pos')));
  const end = Math.max(...positions);
  const ind = childW(pPr, 'ind');
  const left = Number(wAttr(ind, 'left') || wAttr(ind, 'start')) || 0;
  const endStop = stops[positions.indexOf(end)];
  const centerStop = doc.createElementNS(W_NS, 'w:tab');
  centerStop.setAttributeNS(W_NS, 'w:val', 'center');
  centerStop.setAttributeNS(W_NS, 'w:pos', String(Math.round((left + end) / 2)));
  for (const stop of stops) if (stop !== endStop) tabs.removeChild(stop);
  tabs.insertBefore(centerStop, endStop);

  padding.first.textContent = (padding.first.textContent || '').replace(/^\s+/, '');
  const leadTab = doc.createElementNS(W_NS, 'w:tab');
  const [carrier, ...rest] = padding.leading;
  if (carrier) {
    // Run awalan pertama (ber-highlight) menjadi pembawa satu-satunya tab.
    carrier.parentNode!.replaceChild(leadTab, carrier);
    removePadding(rest);
  } else {
    const textRun = padding.first.parentNode as Element;
    const run = doc.createElementNS(W_NS, 'w:r');
    const rPr = childW(textRun, 'rPr');
    if (rPr) run.appendChild(rPr.cloneNode(true));
    run.appendChild(leadTab);
    textRun.parentNode!.insertBefore(run, textRun);
  }
}

/**
 * Judul section ("Section 6 – …") di template MOP ditengahkan dengan berbagai akal-akalan:
 * tab stop yang disetel manual per judul, deretan spasi, rata kanan + indent, indent kiri
 * di text box, atau sel kosong pengganjal di kiri sel judul. Baris ID yang panjangnya berbeda
 * jadi tidak sejajar dengan baris Inggris. Bar highlight bertab ditengahkan dengan tab
 * rata-tengah (lebar bar tetap); selain itu pengisi dibuang dan paragrafnya dibuat rata tengah,
 * dengan bar highlight tanpa tab stop diganti shading paragraf. Judul polos (tanpa bar/pengisi)
 * dan judul di baris tabel berisi tidak diubah.
 */
function alignSectionHeading(doc: Document, p: Element): void {
  const padding = headingPadding(p);
  if (!padding) return;
  const inTextBox = nearestAncestor(p, 'txbxContent') !== null;
  const cell = inTextBox ? null : nearestAncestor(p, 'tc');
  const oldPPr = childW(p, 'pPr');
  const shd = childW(oldPPr, 'shd');
  const oldInd = childW(oldPPr, 'ind');
  const highlight = childElements(p).filter(c => isW(c, 'r'))
    .map(run => wAttr(childW(childW(run, 'rPr'), 'highlight'), 'val'))
    .find(val => val && val !== 'none');
  const padded = padding.leading.length > 0 || padding.trailing.length > 0
    || /^\s{2,}/.test(padding.first.textContent || '') || /\s{2,}$/.test(padding.last.textContent || '');

  let spacers: Element[] = [];
  if (cell) {
    const found = spacerCells(cell);
    const cellFill = wAttr(childW(childW(cell, 'tcPr'), 'shd'), 'fill');
    const isBar = (found && found.length > 0) || (cellFill !== null && !/^(auto|FFFFFF)$/i.test(cellFill));
    const indented = Number(wAttr(oldInd, 'left') || wAttr(oldInd, 'start')) > 0;
    if (!found || !isBar || (found.length === 0 && !indented && !padded)) return;
    spacers = found;
  } else if (!inTextBox && !padded && !highlight && !shd) {
    return;
  }

  const pPr = ensureProps(doc, p, 'pPr');
  const make = (name: string, attrs: Record<string, string>) => {
    const el = doc.createElementNS(W_NS, `w:${name}`);
    for (const [key, value] of Object.entries(attrs)) el.setAttributeNS(W_NS, `w:${key}`, value);
    return el;
  };
  const tabs = childW(pPr, 'tabs');
  const stops = tabs ? childElements(tabs).filter(c => isW(c, 'tab')) : [];
  if (!inTextBox && !cell && highlight && !shd && stops.length > 0
    && stops.every(stop => Number.isFinite(Number(wAttr(stop, 'pos'))))) {
    centerOnTabStop(doc, pPr, tabs!, padding);
    return;
  }

  const ind = make('ind', {});
  if (inTextBox || cell) {
    // Indent di text box / sel hanya dipakai untuk menggeser judul ke tengah.
    ind.setAttributeNS(W_NS, 'w:left', '0');
    ind.setAttributeNS(W_NS, 'w:right', '0');
    if (cell && spacers.length > 0) absorbSpacerCells(doc, cell, spacers);
  } else {
    for (const name of ['left', 'start', 'right', 'end']) {
      const value = wAttr(oldInd, name);
      if (value !== null) ind.setAttributeNS(W_NS, `w:${name}`, value);
    }
    // Bar highlight tanpa tab stop (diperlebar dengan spasi) hilang begitu spasinya dibuang.
    const hex = highlight ? HIGHLIGHT_HEX[highlight] : undefined;
    if (!shd && hex) setOrderedChild(pPr, make('shd', { val: 'clear', color: 'auto', fill: hex }), PPR_ORDER);
  }
  // Indent baris pertama akan menggeser baris Inggris saja; baris ID ada di baris berikutnya.
  ind.setAttributeNS(W_NS, 'w:firstLine', '0');
  setOrderedChild(pPr, ind, PPR_ORDER);
  if (tabs) pPr.removeChild(tabs);
  setOrderedChild(pPr, make('jc', { val: 'center' }), PPR_ORDER);

  removePadding([...padding.leading, ...padding.trailing]);
  padding.first.textContent = (padding.first.textContent || '').replace(/^\s+/, '');
  padding.last.textContent = (padding.last.textContent || '').replace(/\s+$/, '');
}

const WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const WPS_NS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape';
const EMU_PER_PT = 12700;
const DEFAULT_TEXTBOX_INSET = 91440; // 0,1 inci

/** Elemen wp:anchor / wp:inline text box (wps) tempat paragraf berada; null bila bukan text box. */
function textBoxDrawing(p: Element): Element | null {
  if (!nearestAncestor(p, 'txbxContent')) return null;
  for (let el = p.parentNode; el; el = el.parentNode) {
    if (el.nodeType !== 1) continue;
    const node = el as Element;
    if (node.localName === 'Fallback') return null; // salinan VML, tidak dipakai Word modern
    if (node.namespaceURI === WP_NS && (node.localName === 'anchor' || node.localName === 'inline')) return node;
  }
  return null;
}

/**
 * Perkiraan tinggi (EMU) yang dibutuhkan baris ID di text box: jumlah baris dari panjang teks
 * dan lebar kotak, dibulatkan ke atas agar baris ID tidak terpotong.
 */
function idLineHeight(drawing: Element, idRPr: Element, idText: string): number {
  const extent = Array.from(drawing.getElementsByTagNameNS(WP_NS, 'extent'))[0];
  const bodyPr = Array.from(drawing.getElementsByTagNameNS(WPS_NS, 'bodyPr'))[0];
  const inset = (name: string) => {
    const value = bodyPr?.getAttribute(name);
    return value !== null && value !== undefined && value !== '' ? Number(value) : DEFAULT_TEXTBOX_INSET;
  };
  const sz = Number(wAttr(childElements(idRPr).find(c => isW(c, 'sz')), 'val')) || 22;
  const fontPt = sz / 2;
  const widthPt = (Number(extent?.getAttribute('cx')) - inset('lIns') - inset('rIns')) / EMU_PER_PT;
  const charsPerLine = Number.isFinite(widthPt) && widthPt > 0 ? Math.max(1, Math.floor(widthPt / (fontPt * 0.5))) : 60;
  const lines = Math.ceil(idText.length / charsPerLine);
  return Math.ceil(lines * fontPt * 1.2 * EMU_PER_PT);
}

/** Tambah tinggi text box (wp:extent & a:ext) agar baris ID yang disisipkan tidak terpotong. */
function growTextBox(drawing: Element, extraEmu: number): void {
  const grow = (el: Element | undefined) => {
    const cy = Number(el?.getAttribute('cy'));
    if (el && Number.isFinite(cy)) el.setAttribute('cy', String(cy + extraEmu));
  };
  grow(Array.from(drawing.getElementsByTagNameNS(WP_NS, 'extent'))[0]);
  const xfrm = Array.from(drawing.getElementsByTagNameNS(A_NS, 'xfrm'))[0];
  grow(xfrm && childElements(xfrm).find(c => c.namespaceURI === A_NS && c.localName === 'ext'));
}

function writeXml(zip: JSZip, name: string, doc: Document, xml: string): void {
  const declaration = xml.match(/^<\?xml[^>]*\?>/)?.[0] ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const body = new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
  zip.file(name, `${declaration}\r\n${body}`);
}

/** Ubah satu part XML lain (settings, header, footer); `update` mengembalikan true bila ada perubahan. */
async function updatePart(zip: JSZip, name: string | undefined, update: (doc: Document) => boolean): Promise<void> {
  const entry = name ? zip.file(name) : null;
  if (!name || !entry) return;
  const xml = await entry.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length === 0 && update(doc)) writeXml(zip, name, doc, xml);
}

/**
 * Susun DOCX bilingual dari file asli. `translations` dikunci dengan teks Inggris
 * (MOPSegment.text); teks tanpa terjemahan tidak diberi baris ID.
 * Mengembalikan file baru dan jumlah paragraf yang diberi baris ID.
 */
export async function buildBilingualMOPDocx(
  buffer: ArrayBuffer,
  translations: Record<string, string>
): Promise<{ blob: Blob; translatedParagraphs: number }> {
  const { zip, entryName, doc, xml } = await loadDocument(buffer);
  const textBoxGrowth = new Map<Element, number>();
  let translatedParagraphs = 0;
  // Terjemahan yang sama dengan teks Inggrisnya (nama, merek) tidak perlu baris ID.
  const idText = (key: string | null) => {
    const id = key ? normalize(translations[key] || '') : '';
    return id.toLowerCase() === (key || '').toLowerCase() ? '' : id;
  };

  keepApprovalTogether(doc);
  for (const unit of collectUnits(doc)) {
    if (!unit.keys.some(idText)) continue;
    if (unit.heading) alignSectionHeading(doc, unit.p);
    const pieces = unit.heading ? readPieces(unit.p) : unit.pieces;
    const texts = (unit.heading ? pieceKeys(pieces) : unit.keys).map(idText);
    if (!texts.some(Boolean)) continue;

    const idRPr = appendIdLine(doc, unit.p, pieces, texts);
    // Baris Inggris dan ID tidak dipisah halaman; judul section ikut ke paragraf sesudahnya.
    setParagraphFlag(doc, unit.p, 'keepLines');
    if (unit.heading) setParagraphFlag(doc, unit.p, 'keepNext');
    relaxExactRowHeights(unit.p);
    translatedParagraphs++;

    // Text box bertinggi tetap: baris ID di luar tinggi kotak tidak tampil.
    const drawing = textBoxDrawing(unit.p);
    if (drawing) textBoxGrowth.set(drawing, (textBoxGrowth.get(drawing) || 0) + idLineHeight(drawing, idRPr, texts.join(' ')));
  }
  textBoxGrowth.forEach((extra, drawing) => growTextBox(drawing, extra));
  writeXml(zip, entryName, doc, xml);

  await updatePart(zip, findEntry(zip, 'word/settings.xml'), keepShiftReturnLinesUnjustified);
  for (const name of Object.keys(zip.files).filter(n => /^word[\\/](header|footer)\d*\.xml$/i.test(n))) {
    await updatePart(zip, name, linkPageTotal);
  }

  const blob = await zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' });
  return { blob, translatedParagraphs };
}

/** "MOP_CM_03_Cooling_Tower.docx" -> "MOP_CM_03_Cooling_Tower_Bilingual.docx" */
export const bilingualFileName = (originalName: string) =>
  originalName.replace(/(_bilingual)?\.docx$/i, '') + '_Bilingual.docx';
