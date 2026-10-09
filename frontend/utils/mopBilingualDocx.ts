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
  let translatedParagraphs = 0;

  for (const p of paragraphs) {
    const { text, textRuns, leadingTabs, trailingTabs } = readParagraph(p);
    const idText = text ? (translations[text] || '').trim() : '';
    if (!idText) continue;

    const breakRun = doc.createElementNS(W_NS, 'w:r');
    breakRun.appendChild(doc.createElementNS(W_NS, 'w:br'));

    const idRun = doc.createElementNS(W_NS, 'w:r');
    idRun.appendChild(buildIdRunProps(doc, textRuns));
    for (let i = 0; i < leadingTabs; i++) idRun.appendChild(doc.createElementNS(W_NS, 'w:tab'));
    const t = doc.createElementNS(W_NS, 'w:t');
    t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    t.textContent = idText;
    idRun.appendChild(t);
    for (let i = 0; i < trailingTabs; i++) idRun.appendChild(doc.createElementNS(W_NS, 'w:tab'));

    p.appendChild(breakRun);
    p.appendChild(idRun);
    translatedParagraphs++;
  }

  const declaration = xml.match(/^<\?xml[^>]*\?>/)?.[0] ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const body = new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
  zip.file(entryName, `${declaration}\r\n${body}`);

  const blob = await zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' });
  return { blob, translatedParagraphs };
}

/** "MOP_CM_03_Cooling_Tower.docx" -> "MOP_CM_03_Cooling_Tower_Bilingual.docx" */
export const bilingualFileName = (originalName: string) =>
  originalName.replace(/(_bilingual)?\.docx$/i, '') + '_Bilingual.docx';
