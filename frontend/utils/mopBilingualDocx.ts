// ============================================================================
// FILE: frontend/utils/mopBilingualDocx.ts
// Deskripsi: Membuat versi Bilingual (EN + ID) dari file Word MOP langsung di
//            dalam DOCX aslinya. Setiap paragraf berbahasa Inggris (termasuk isi
//            sel tabel) mendapat baris terjemahan Indonesia (miring, abu-abu)
//            di bawahnya, disisipkan sebagai line break di paragraf yang sama
//            sehingga penomoran, indentasi, tabel, dan gambar tidak berubah.
// ============================================================================

import JSZip from 'jszip';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ID_COLOR = '595959'; // sama dengan baris ID pada export SOP/EOP

export interface MOPSegment {
  text: string;        // teks Inggris (spasi dirapikan), juga kunci terjemahan
  occurrences: number; // berapa paragraf yang berisi teks ini
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

/**
 * Kumpulkan teks dan run teks milik satu paragraf. Paragraf bersarang (text box)
 * dan konten fallback (mc:Fallback, duplikat dari mc:Choice) tidak ikut dihitung.
 */
function readParagraph(p: Element): { text: string; textRuns: Element[]; leadingTabs: number; trailingTabs: number } {
  let text = '';
  const textRuns: Element[] = [];
  // Tab sebelum/sesudah teks dipakai untuk tata letak (mis. judul section "[tab] teks [tab]"
  // yang di-highlight menjadi bar kuning); baris ID menirunya agar sejajar.
  let leadingTabs = 0;
  let trailingTabs = 0;
  let seenText = false;
  const walk = (node: Element) => {
    for (const child of childElements(node)) {
      // pPr berisi definisi tab stop (<w:tabs><w:tab/>) yang bukan karakter tab.
      if (isW(child, 'p') || isW(child, 'pPr') || isW(child, 'rPr') || child.localName === 'Fallback' || isW(child, 'del')) continue;
      if (isW(child, 't')) {
        const value = child.textContent || '';
        text += value;
        if (value.trim()) {
          seenText = true;
          trailingTabs = 0;
        }
      } else if (isW(child, 'tab')) {
        text += ' ';
        if (seenText) trailingTabs++;
        else leadingTabs++;
      } else {
        if (isW(child, 'r') && childElements(child).some(c => isW(c, 't'))) textRuns.push(child);
        walk(child);
      }
    }
  };
  walk(p);
  return { text: normalize(text), textRuns, leadingTabs, trailingTabs };
}

// Baris isian formulir yang dibiarkan tanpa baris ID: label "Label : isi" (Section 3 & 11),
// baik satu baris bertab ("Author : X [tab] Date of Creation : Y") maupun per sel tabel.
const FORM_FIELD_LINE = /^(author|date of creation|date revision|revision date|revision number|mop execution date|reference ticket number)\s*:/i;
// Judul kolom tabel isian: "Job Title [tab] Name [tab] Signature [tab] Date" (Section 12)
// dan "Executed by (Name) [tab] Job title" (Section 3), sebaris atau per sel.
const FORM_HEADER_LINE = /^(?:(?:job title|name|signature|date|executed by \(name\))\s*)+$/i;
// Pilihan frekuensi bercentang di MOP PM: "☐ Monthly [tab] ☑ Quarterly [tab] ☐ Annually"
// (kadang plus "Half of Year"). Minimal dua pilihan, supaya sel tunggal "Monthly" tetap diterjemahkan.
const FREQUENCY_OPTIONS_LINE =
  /^(?:[☐☑☒□■✓✔✗✘]?\s*(?:daily|weekly|bi-?weekly|monthly|bi-?monthly|quarterly|half of year|half[- ]yearly|semi[- ]?annual(?:ly)?|annually|annual|yearly)\s*){2,}$/i;

/**
 * Paragraf yang perlu diterjemahkan: memuat minimal satu kata biasa. Teks yang seluruhnya
 * kode/angka/singkatan pendek ("NOZ-PP-2NPT-360", "24", "HSE") dan baris isian formulir
 * (Author, Date of Creation, Job Title/Name/Signature/Date, pilihan frekuensi, dst.) dilewati. Judul seperti
 * "Section 1 – Document Overview" atau "METHOD OF PROCEDURE" tetap diterjemahkan; nama
 * orang/merek dan singkatan panjang (LOTO) diputuskan AI (dikembalikan kosong).
 */
export function needsTranslation(text: string): boolean {
  if (FORM_FIELD_LINE.test(text) || FORM_HEADER_LINE.test(text) || FREQUENCY_OPTIONS_LINE.test(text)) return false;
  const isCode = (token: string) => /\d/.test(token) || /^[A-Z]{2,3}$/.test(token);
  return text
    .split(/[\s/,()\-–:;.&"'°]+/)
    .some(token => /[A-Za-z]{2,}/.test(token) && !isCode(token));
}

// Tabel daftar aset MOP PM (Section 2 – Equipment Information, ada kolom "CI Name*"): isinya
// nama/deskripsi/tipe/serial aset yang tidak diterjemahkan. Baris judul kolom tetap diterjemahkan.
const ASSET_TABLE_HEADER = /^CI Name\*?$/i;

const nearestAncestor = (node: Node, name: string): Element | null => {
  for (let el = node.parentNode; el; el = el.parentNode) {
    if (isW(el, name)) return el as Element;
  }
  return null;
};

/** Paragraf di baris isi tabel aset; tidak dikirim ke AI dan tidak diberi baris ID. */
function assetTableParagraphs(doc: Document): Set<Element> {
  const skip = new Set<Element>();
  for (const tbl of Array.from(doc.getElementsByTagNameNS(W_NS, 'tbl'))) {
    const rows = Array.from(tbl.getElementsByTagNameNS(W_NS, 'tr')).filter(tr => nearestAncestor(tr, 'tbl') === tbl);
    if (rows.length < 2) continue;
    const headerCells = Array.from(rows[0].getElementsByTagNameNS(W_NS, 'tc')).filter(tc => nearestAncestor(tc, 'tr') === rows[0]);
    const cellText = (tc: Element) =>
      normalize(Array.from(tc.getElementsByTagNameNS(W_NS, 'p')).map(p => readParagraph(p).text).join(' '));
    if (!headerCells.some(tc => ASSET_TABLE_HEADER.test(cellText(tc)))) continue;
    for (const row of rows.slice(1)) {
      for (const p of Array.from(row.getElementsByTagNameNS(W_NS, 'p'))) skip.add(p);
    }
  }
  return skip;
}

async function loadDocument(buffer: ArrayBuffer) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('File bukan dokumen Word (.docx) yang valid.');
  }
  // Sebagian DOCX yang di-zip ulang di Windows memakai "word\document.xml" (backslash).
  const entryName = Object.keys(zip.files).find(name => name.replace(/\\/g, '/').toLowerCase() === 'word/document.xml');
  const entry = entryName ? zip.file(entryName) : null;
  if (!entryName || !entry) throw new Error('File bukan dokumen Word (.docx) yang valid.');
  const xml = await entry.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Isi dokumen Word tidak dapat dibaca.');
  }
  const skipped = assetTableParagraphs(doc);
  const paragraphs = Array.from(doc.getElementsByTagNameNS(W_NS, 'p')).filter(p => !skipped.has(p));
  return { zip, entryName, doc, xml, paragraphs };
}

/**
 * Baca teks MOP: daftar teks unik yang perlu diterjemahkan (urut kemunculan),
 * plus judul & nomor dokumen dari Section 1 bila ada.
 */
export async function parseMOPDocx(buffer: ArrayBuffer): Promise<ParsedMOP> {
  const { paragraphs } = await loadDocument(buffer);
  const segmentMap = new Map<string, MOPSegment>();
  let title = '';
  let documentNumber = '';

  for (const p of paragraphs) {
    const { text } = readParagraph(p);
    if (!text) continue;

    const titleMatch = text.match(/^Document Title\s*:\s*(.+)$/i);
    if (titleMatch && !title) title = titleMatch[1].trim();
    const numberMatch = text.match(/^Document Number\s*:\s*(.+)$/i);
    if (numberMatch && !documentNumber) documentNumber = numberMatch[1].trim();

    if (!needsTranslation(text)) continue;
    const existing = segmentMap.get(text);
    if (existing) existing.occurrences++;
    else segmentMap.set(text, { text, occurrences: 1 });
  }

  return { segments: [...segmentMap.values()], title, documentNumber };
}

/** Warna terang (mis. teks putih di header tabel berwarna) dipertahankan agar tetap terbaca. */
const isLightColor = (hex: string | null | undefined) => {
  if (!hex || !/^[0-9A-Fa-f]{6}$/.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 186;
};

/**
 * rPr baris ID: font & ukuran mengikuti teks Inggris, tebal bila seluruh teks Inggris tebal,
 * miring abu-abu kecuali teks aslinya berwarna terang.
 */
function buildIdRunProps(doc: Document, allTextRuns: Element[]): Element {
  const make = (name: string, val?: string) => {
    const el = doc.createElementNS(W_NS, `w:${name}`);
    if (val !== undefined) el.setAttributeNS(W_NS, 'w:val', val);
    return el;
  };
  const runProps = (run: Element) => childElements(run).find(c => isW(c, 'rPr'));
  const prop = (rPr: Element | undefined, name: string) => (rPr ? childElements(rPr).find(c => isW(c, name)) : undefined);
  const isOn = (el: Element | undefined) => {
    if (!el) return false;
    const val = el.getAttributeNS(W_NS, 'val') ?? el.getAttribute('w:val');
    return val === null || val === '' || !['0', 'false', 'off'].includes(val);
  };

  // Run berisi spasi saja (perataan manual) sering punya font berbeda; abaikan.
  const visibleRuns = allTextRuns.filter(run =>
    childElements(run).some(c => isW(c, 't') && (c.textContent || '').trim() !== ''));
  const textRuns = visibleRuns.length > 0 ? visibleRuns : allTextRuns;
  const firstRPr = textRuns[0] ? runProps(textRuns[0]) : undefined;
  const allBold = textRuns.length > 0 && textRuns.every(r => isOn(prop(runProps(r), 'b')));
  const originalColor = prop(firstRPr, 'color');
  const originalColorVal = originalColor ? (originalColor.getAttributeNS(W_NS, 'val') ?? originalColor.getAttribute('w:val')) : null;

  // Urutan elemen mengikuti skema CT_RPr: rFonts, b, bCs, i, iCs, color, sz, szCs
  const rPr = make('rPr');
  const rFonts = prop(firstRPr, 'rFonts');
  if (rFonts) rPr.appendChild(rFonts.cloneNode(true));
  if (allBold) {
    rPr.appendChild(make('b'));
    rPr.appendChild(make('bCs'));
  }
  rPr.appendChild(make('i'));
  rPr.appendChild(make('iCs'));
  rPr.appendChild(make('color', isLightColor(originalColorVal) ? originalColorVal! : ID_COLOR));
  const sz = prop(firstRPr, 'sz');
  if (sz) rPr.appendChild(sz.cloneNode(true));
  const szCs = prop(firstRPr, 'szCs');
  if (szCs) rPr.appendChild(szCs.cloneNode(true));
  // Highlight/shading (mis. bar kuning judul section) ikut, setelah szCs sesuai urutan skema.
  const highlight = prop(firstRPr, 'highlight');
  if (highlight) rPr.appendChild(highlight.cloneNode(true));
  const shd = prop(firstRPr, 'shd');
  if (shd) rPr.appendChild(shd.cloneNode(true));
  return rPr;
}

const SECTION_HEADING = /^Section\s+\d+\b/i;

// Atribut w:* yang tidak ada -> null (sebagian parser DOM mengembalikan string kosong).
const wAttr = (el: Element | undefined | null, name: string) =>
  (el && (el.getAttributeNS(W_NS, name) || el.getAttribute(`w:${name}`))) || null;

// Urutan anak w:pPr dan w:tcPr menurut skema; Word menolak elemen yang urutannya salah.
const PPR_ORDER = [
  'pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr',
  'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap',
  'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd',
  'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc',
  'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr',
  'sectPr', 'pPrChange',
];
const TCPR_ORDER = [
  'cnfStyle', 'tcW', 'gridSpan', 'hMerge', 'vMerge', 'tcBorders', 'shd', 'noWrap', 'tcMar',
  'textDirection', 'tcFitText', 'vAlign', 'hideMark', 'headers', 'cellIns', 'cellDel', 'cellMerge', 'tcPrChange',
];

/** Pasang `el` di `parent` pada posisi sesuai `order`, menggantikan elemen bernama sama. */
function setOrderedChild(parent: Element, el: Element, order: string[]): void {
  const rank = order.indexOf(el.localName);
  const existing = childElements(parent).find(c => isW(c, el.localName));
  if (existing) parent.removeChild(existing);
  const next = childElements(parent).find(c => order.indexOf(c.localName) > rank);
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

/**
 * Susun DOCX bilingual dari file asli. `translations` dikunci dengan teks Inggris
 * (MOPSegment.text); teks tanpa terjemahan tidak diberi baris ID.
 * Mengembalikan file baru dan jumlah paragraf yang diberi baris ID.
 */
export async function buildBilingualMOPDocx(
  buffer: ArrayBuffer,
  translations: Record<string, string>
): Promise<{ blob: Blob; translatedParagraphs: number }> {
  const { zip, entryName, doc, xml, paragraphs } = await loadDocument(buffer);
  const textBoxGrowth = new Map<Element, number>();
  let translatedParagraphs = 0;

  for (const p of paragraphs) {
    const { text } = readParagraph(p);
    const idText = text ? (translations[text] || '').trim() : '';
    if (!idText) continue;
    if (SECTION_HEADING.test(text)) alignSectionHeading(doc, p);
    const { textRuns, leadingTabs, trailingTabs } = readParagraph(p);

    const breakRun = doc.createElementNS(W_NS, 'w:r');
    breakRun.appendChild(doc.createElementNS(W_NS, 'w:br'));

    const idRun = doc.createElementNS(W_NS, 'w:r');
    const idRPr = buildIdRunProps(doc, textRuns);
    idRun.appendChild(idRPr);
    for (let i = 0; i < leadingTabs; i++) idRun.appendChild(doc.createElementNS(W_NS, 'w:tab'));
    const t = doc.createElementNS(W_NS, 'w:t');
    t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    t.textContent = idText;
    idRun.appendChild(t);
    for (let i = 0; i < trailingTabs; i++) idRun.appendChild(doc.createElementNS(W_NS, 'w:tab'));

    p.appendChild(breakRun);
    p.appendChild(idRun);
    translatedParagraphs++;

    // Text box bertinggi tetap: baris ID di luar tinggi kotak tidak tampil.
    const drawing = textBoxDrawing(p);
    if (drawing) textBoxGrowth.set(drawing, (textBoxGrowth.get(drawing) || 0) + idLineHeight(drawing, idRPr, idText));
  }
  textBoxGrowth.forEach((extra, drawing) => growTextBox(drawing, extra));

  const declaration = xml.match(/^<\?xml[^>]*\?>/)?.[0] ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const body = new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
  zip.file(entryName, `${declaration}\r\n${body}`);

  const blob = await zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' });
  return { blob, translatedParagraphs };
}

/** "MOP_CM_03_Cooling_Tower.docx" -> "MOP_CM_03_Cooling_Tower_Bilingual.docx" */
export const bilingualFileName = (originalName: string) =>
  originalName.replace(/(_bilingual)?\.docx$/i, '') + '_Bilingual.docx';
