// ============================================================================
// FILE: frontend/utils/sopEopDocxImport.ts
// Deskripsi: Engine Parser Berkas Microsoft Word (.docx) untuk SOP & EOP.
//            Mengekstrak teks, tabel, metadata, langkah kerja bilingual,
//            CI equipment, approval, dan seluruh data seksi secara presisi 1:1.
// ============================================================================

import JSZip from 'jszip';
import {
  SOPDocumentData,
  EOPDocumentData,
  SOPCIEquipmentItem,
  SOPAffectedSystemItem,
  SOPWorkStepItem,
  EOPWorkStepItem,
  SOPPrerequisiteItem,
  SOPReferencedDocItem,
  DocumentSigner
} from '@/types/sopEopTypes';
import { ensureBilingualTranslation } from '@/utils/sopEopBilingualAI';

export interface ParsedSopEopResult {
  type: 'SOP' | 'EOP';
  sopData?: SOPDocumentData;
  eopData?: EOPDocumentData;
  summary: {
    title: string;
    type: 'SOP' | 'EOP';
    stepCount: number;
    equipmentCount?: number;
    author: string;
    sourceFile: string;
  };
  warnings: string[];
}

/**
 * Decode entitas XML / HTML menjadi karakter asli
 */
function decodeEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Membersihkan string XML dan whitespace berlebih
 */
function cleanText(raw: string): string {
  if (!raw) return '';
  return decodeEntities(
    raw
      .replace(/<w:tab\b[^>]*\/?\s*>/gi, ' ')
      .replace(/<w:br\b[^>]*\/?\s*>/gi, '\n')
      .replace(/<\/w:(?:p|tc|tr)>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Word frequently splits labels across multiple runs; always match normalized text. */
function normalizedXmlText(raw: string): string {
  return cleanText(raw)
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsLabel(raw: string, label: string): boolean {
  const haystack = normalizedXmlText(raw).toLowerCase();
  const needle = label.toLowerCase();
  return haystack.includes(needle) ||
    haystack.replace(/[^a-z0-9]/g, '').includes(needle.replace(/[^a-z0-9]/g, ''));
}

/** Preserve paragraph/table boundaries while removing WordprocessingML markup. */
function structuredXmlText(raw: string): string {
  return decodeEntities(
    raw
      .replace(/<w:tab\b[^>]*\/?\s*>/gi, '\t')
      .replace(/<w:br\b[^>]*\/?\s*>/gi, '\n')
      .replace(/<\/w:tc>/gi, '\t')
      .replace(/<\/w:tr>/gi, '\n')
      .replace(/<\/w:p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[^\S\r\n\t]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractPlainSection(xml: string, sectionNumber: number, nextSectionNumber: number): string {
  const text = structuredXmlText(xml);
  const start = new RegExp(`(?:Section|Seksi)\\s*${sectionNumber}\\b`, 'i').exec(text);
  if (!start) return '';
  const remainder = text.slice(start.index);
  const end = new RegExp(`(?:Section|Seksi)\\s*${nextSectionNumber}\\b`, 'i').exec(remainder.slice(start[0].length));
  return end
    ? remainder.slice(0, start[0].length + end.index)
    : remainder;
}

/**
 * DOCX exports often split a logical section across several adjacent blocks:
 * a heading table, a paragraph containing column labels, then one or more
 * data tables (including continuation tables on the next page).  Keep that
 * original order so individual parsers never need to guess globally.
 */
type WordDocumentBlock = {
  kind: 'paragraph' | 'table';
  xml: string;
  text: string;
};

function getOrderedDocumentBlocks(xml: string): WordDocumentBlock[] {
  const bodyMatch = xml.match(/<w:body(?:\s|>)[\s\S]*?<\/w:body>/i);
  const body = bodyMatch?.[0] || xml;
  const tableMatches = [...body.matchAll(/<w:tbl(?:\s|>)[\s\S]*?<\/w:tbl>/gi)].map((match) => ({
    start: match.index || 0,
    end: (match.index || 0) + match[0].length,
    kind: 'table' as const,
    xml: match[0],
  }));
  const paragraphMatches = [...body.matchAll(/<w:p(?:\s|>)[\s\S]*?<\/w:p>/gi)]
    .filter((match) => !tableMatches.some((table) => (match.index || 0) >= table.start && (match.index || 0) < table.end))
    .map((match) => ({ start: match.index || 0, kind: 'paragraph' as const, xml: match[0] }));

  return [...tableMatches, ...paragraphMatches]
    .sort((a, b) => a.start - b.start)
    .map(({ kind, xml: blockXml }) => ({ kind, xml: blockXml, text: cleanText(blockXml) }));
}

function getSectionBlocks(xml: string, sectionNumber: number): WordDocumentBlock[] {
  const blocks = getOrderedDocumentBlocks(xml);
  let activeSection: number | null = null;
  const result: WordDocumentBlock[] = [];

  for (const block of blocks) {
    const heading = block.text.match(/(?:Section|Seksi)\s*(\d+)\b/i);
    if (heading) activeSection = Number(heading[1]);
    if (activeSection === sectionNumber) result.push(block);
  }

  return result;
}

function getTableRows(tableXml: string): Array<{ cells: string[]; cellXml: string[] }> {
  const rows = tableXml.match(/<w:tr(?:\s|>)[\s\S]*?<\/w:tr>/gi) || [];
  return rows.map((row) => {
    const cellXml = row.match(/<w:tc(?:\s|>)[\s\S]*?<\/w:tc>/gi) || [];
    return { cellXml, cells: cellXml.map((cell) => cleanText(cell)) };
  });
}

function isWorkStepHeader(text: string): boolean {
  return /(?:Action|Tindakan)/i.test(text) && /(?:Expected\s*Outcome|Hasil\s*yang\s*Diharapkan)/i.test(text);
}

/** Read Author/Penyusun only from Document Information, never from another section. */
function extractDocumentAuthor(xml: string, isEop: boolean): string {
  const documentInfoSection = getSectionBlocks(xml, isEop ? 5 : 12);
  const text = documentInfoSection
    .map((block) => structuredXmlText(block.xml))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';

  const match = text.match(
    /(?:Author|Penulis|Penyusun)\s*(?:\/\s*(?:Author|Penulis|Penyusun))?\s*:?\s*([\s\S]*?)(?=(?:Author|Penulis|Penyusun)\s*:|Date\s*of\s*Creation|Tanggal\s*(?:Pembuatan|Dibuat)|Next\s*Date\s*Revision|Date\s*Revision|Revision\s*Number|Nomor\s*Revisi|$)/i
  );
  return match?.[1]?.replace(/^[\s:\-]+|[\s:\-]+$/g, '').trim() || '';
}


/**
 * Deteksi apakah sebuah teks lebih cenderung Bahasa Indonesia atau Bahasa Inggris
 */
function detectLanguage(text: string): 'id' | 'en' {
  if (!text) return 'en';
  const lower = text.toLowerCase();

  const idWords = [
    'dan', 'yang', 'di', 'ke', 'dari', 'pada', 'untuk', 'dengan', 'atau', 'ini',
    'itu', 'periksa', 'lakukan', 'pastikan', 'bersihkan', 'ukur', 'pasang', 'jika',
    'tidak', 'telah', 'oleh', 'pemeliharaan', 'kondisi', 'peralatan', 'hasil',
    'gangguan', 'kabel', 'sumber', 'ruang', 'daya', 'tegangan', 'arus', 'sirkuit',
    'titik', 'penerangan', 'lampu', 'cegah', 'bahaya', 'keselamatan', 'aman'
  ];

  const enWords = [
    'the', 'and', 'of', 'to', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'check', 'inspect', 'verify', 'ensure', 'disconnect', 'isolate', 'measure',
    'clean', 'test', 'if', 'do', 'not', 'been', 'be', 'or', 'are', 'is', 'this',
    'that', 'breaker', 'power', 'source', 'condition', 'fault', 'prevented',
    'restored', 'confirmed', 'damage', 'wiring', 'failure', 'identified'
  ];

  let idScore = 0;
  let enScore = 0;

  for (const w of idWords) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(lower)) idScore++;
  }
  for (const w of enWords) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(lower)) enScore++;
  }

  return idScore > enScore ? 'id' : 'en';
}

/**
 * Mengekstrak teks dwibahasa (English + Indonesian) dari elemen XML (<w:tc> atau <w:p>).
 * Di berkas DOCX master, teks English dan Indonesian dipisahkan oleh <w:br/> atau </w:p>.
 */
function extractBilingualFromXml(elementXml: string): { en: string; id: string } {
  if (!elementXml) return { en: '', id: '' };

  const withDelim = elementXml
    .replace(/<w:br\s*\/?>/gi, '[[BR]]')
    .replace(/<\/w:p>/gi, '[[BR]]')
    .replace(/<[^>]+>/g, '');

  const lines = decodeEntities(withDelim)
    .split('[[BR]]')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (lines.length === 0) return { en: '', id: '' };

  // Jika hanya 1 baris, tentukan bahasanya agar tidak menaruh teks Inggris ke field Indonesia
  if (lines.length === 1) {
    const lang = detectLanguage(lines[0]);
    if (lang === 'id') {
      return { en: '', id: lines[0] };
    }
    return { en: lines[0], id: '' };
  }

  // Identical EN and ID lines (e.g. "N/A T/A" twice) are kept exactly as written in the document.
  // Baris pertama English, baris kedua Indonesian
  return {
    en: lines[0],
    id: lines[1]
  };
}

/** Extract the meaningful bilingual content inside one numbered document section. */
function extractSectionBilingual(
  xml: string,
  startPattern: RegExp,
  endPattern: RegExp,
  ignoredPatterns: RegExp[] = []
): { en: string; id: string } {
  const startIndex = xml.search(startPattern);
  if (startIndex < 0) return { en: '', id: '' };
  const afterStart = xml.slice(startIndex);
  const endOffset = afterStart.search(endPattern);
  const sectionXml = endOffset >= 0 ? afterStart.slice(0, endOffset) : afterStart;
  const paragraphs = sectionXml.match(/<w:p(?:\s|>)[\s\S]*?<\/w:p>/g) || [];
  const enLines: string[] = [];
  const idLines: string[] = [];

  for (const paragraph of paragraphs) {
    const pair = extractBilingualFromXml(paragraph);
    for (const [language, value] of [['en', pair.en], ['id', pair.id]] as const) {
      const normalized = value.replace(/^(?:Section|Seksi)\s*\d+[^:]*:?\s*/i, '').trim();
      if (!normalized || ignoredPatterns.some((pattern) => pattern.test(normalized))) continue;
      if (language === 'en') enLines.push(normalized);
      else idLines.push(normalized);
    }
  }

  return { en: enLines.join('\n').trim(), id: idLines.join('\n').trim() };
}

function getImportWarnings(data: SOPDocumentData | EOPDocumentData): string[] {
  const warnings: string[] = [];
  // Empty values are valid DOCX content. Never describe an intentionally
  // blank title or reference table as an import failure.
  if (data.workSteps.length === 0) warnings.push('Tidak ada langkah kerja yang terbaca; periksa struktur tabel Action / Expected Outcome pada Word.');
  if (data.type === 'SOP' && data.equipmentList.length === 0) warnings.push('Tidak ada data CI Equipment yang terbaca.');
  if (data.type === 'SOP' && data.prerequisites.length === 0) warnings.push('Tidak ada prasyarat yang terbaca.');
  if (data.type === 'EOP' && !data.expectedConditionsEn && !data.expectedConditionsId) warnings.push('Expected Conditions EOP tidak terbaca.');
  if (data.type === 'EOP' && !data.ehsRequirements.ppeEn && !data.ehsRequirements.ppeId && !data.ehsRequirements.commsEn && !data.ehsRequirements.commsId && !(data.ehsRequirements.items || []).length) {
    warnings.push('Persyaratan EHS EOP tidak terbaca.');
  }
  return warnings;
}

/**
 * Mengekstrak metadata teks dari dokumen XML secara cerdas dan tahan multiline
 */
function extractMetadata(xml: string, fileName: string, isEop: boolean) {
  const norm = structuredXmlText(xml);

  const getMatch = (regex: RegExp): string => {
    const m = norm.match(regex);
    return m && m[1] ? decodeEntities(m[1].trim()) : '';
  };

  // The title cell holds "Document Title : X" and "Judul Dokumen : X" on separate lines; keep only the value.
  const docTitleMatch = getMatch(/(?:Document\s*Title|Judul\s*Dokumen)\s*:\s*([\s\S]*?)(?:Document\s*Purpose|Tujuan\s*Dokumen|Work\s*Location)/i)
    .split(/\n|Judul\s*Dokumen\s*:/i)[0]
    .trim();
  const title = docTitleMatch && !/template/i.test(docTitleMatch)
    ? docTitleMatch
    : fileName
        .replace(/\.docx$/i, '')
        .replace(/\s*\(\d+\)\s*$/g, '')
        .trim();

  const purposeEn = getMatch(/Document\s*Purpose\s*:\s*([\s\S]*?)(?:Tujuan\s*Dokumen|Work\s*Location)/i);
  let purposeId = getMatch(/Tujuan\s*Dokumen\s*:\s*([\s\S]*?)(?:Work\s*Location|Section|Seksi)/i);
  if (!purposeId && purposeEn) {
    purposeId = ensureBilingualTranslation(purposeEn);
  }

  const locationEn =
    getMatch(/Work\s*Location\s*:\s*([\s\S]*?)(?:Lokasi\s*Kerja|Section|Seksi)/i);
  const locationId =
    getMatch(/Lokasi\s*Kerja\s*:\s*([\s\S]*?)(?:Section|Seksi|\n\n)/i) || locationEn;

  // Values come only from the Document Information table. Free-text regexes over the whole
  // document matched "author" inside "authorized personnel" and returned label text as dates,
  // and missing values were filled with made-up defaults.
  const info = parseDocumentInformation(xml, isEop);
  const author = info.author || extractDocumentAuthor(xml, isEop);
  const revisionNumber = info.revisionNumber;
  const revisionDate = info.revisionDate;

  return {
    title,
    purposeEn: purposeEn || '',
    purposeId: purposeId || '',
    locationEn: locationEn || '',
    locationId: locationId || '',
    author,
    creationDate: info.creationDate,
    revisionNumber: revisionNumber === 'T/A' ? '' : revisionNumber,
    revisionDate: revisionDate === 'T/A' ? '' : revisionDate
  };
}

/**
 * Reads the Document Information table (SOP Section 12 / EOP Section 5). Each row holds
 * label/value cell pairs such as "Author / Penulis" | ": Alif Darmawan / : Alif Darmawan".
 */
function parseDocumentInformation(xml: string, isEop: boolean): {
  author: string;
  creationDate: string;
  revisionDate: string;
  revisionNumber: string;
} {
  const result = { author: '', creationDate: '', revisionDate: '', revisionNumber: '' };
  const tables = getSectionBlocks(xml, isEop ? 5 : 12).filter((block) => block.kind === 'table');
  const firstLine = (cellXml: string) => {
    const lines = decodeEntities(
      cellXml.replace(/<w:br\b[^>]*\/?>/gi, '\n').replace(/<\/w:p>/gi, '\n').replace(/<[^>]+>/g, '')
    )
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return (lines[0] || '').replace(/^:\s*/, '').trim();
  };

  for (const table of tables) {
    for (const row of getTableRows(table.xml)) {
      for (let i = 0; i + 1 < row.cells.length; i++) {
        const label = row.cells[i].toLowerCase();
        const value = firstLine(row.cellXml[i + 1]);
        if (/^(?:author|penulis|penyusun)\b/.test(label)) result.author = value;
        else if (/^(?:date\s*of\s*creation|tanggal\s*pembuatan)/.test(label)) result.creationDate = value;
        else if (/^(?:next\s*)?date\s*revision|^tanggal\s*revisi/.test(label)) result.revisionDate = value;
        else if (/^(?:revision\s*number|nomor\s*revisi)/.test(label)) result.revisionNumber = value;
        else continue;
        i++;
      }
    }
  }

  // Some templates write the same fields as plain text: "Author : X Date of Creation : Y …".
  const sectionText = getSectionBlocks(xml, isEop ? 5 : 12)
    .map((block) => block.text)
    .join(' ')
    .replace(/\s+/g, ' ');
  const nextLabel = '(?=\\s*(?:Author|Penulis|Date\\s*of\\s*Creation|Tanggal\\s*Pembuatan|Next\\s*Date\\s*Revision|Date\\s*Revision|Tanggal\\s*Revisi|Revision\\s*Number|Nomor\\s*Revisi|(?:Section|Seksi)\\s*\\d)\\b|$)';
  const inline = (label: string) =>
    sectionText.match(new RegExp(`(?:^|\\s)${label}\\s*:\\s*(.*?)${nextLabel}`, 'i'))?.[1]?.trim() || '';
  if (!result.author) result.author = inline('Author');
  if (!result.creationDate) result.creationDate = inline('Date\\s*of\\s*Creation');
  if (!result.revisionDate) result.revisionDate = inline('(?:Next\\s*)?Date\\s*Revision');
  if (!result.revisionNumber) result.revisionNumber = inline('Revision\\s*Number');
  return result;
}

/**
 * Mengekstrak tabel CI Equipment (SOP Seksi 2) dengan mapping kolom dinamis.
 * Mampu membaca tabel 7 kolom (Lighting Point), 10 kolom (Trafo), maupun variasi jumlah/urutan kolom lainnya.
 */
function parseCIEquipment(xml: string): SOPCIEquipmentItem[] {
  // 1. Prioritaskan tabel dari Seksi 2 (Equipment Information)
  const sec2Blocks = getSectionBlocks(xml, 2);
  const sec2Tables = sec2Blocks
    .filter((b) => b.kind === 'table')
    .map((b) => b.xml);

  // Ambil tabel data di Seksi 2 (abaikan banner 1 baris dan abaikan tabel langkah kerja)
  let candidateTables = sec2Tables.filter((tblXml) => {
    const rows = tblXml.match(/<w:tr(?:\s|>)[\s\S]*?<\/w:tr>/g) || [];
    if (rows.length < 2) return false;
    const text = cleanText(tblXml);
    if (isWorkStepHeader(text)) return false;
    return true;
  });

  // 2. Fallback pencarian tabel global jika dokumen tidak menggunakan penomoran Seksi standar
  if (candidateTables.length === 0) {
    const allTables = xml.match(/<w:tbl(?:\s|>)[\s\S]*?<\/w:tbl>/g) || [];
    candidateTables = allTables.filter((tblXml) => {
      const rows = tblXml.match(/<w:tr(?:\s|>)[\s\S]*?<\/w:tr>/g) || [];
      if (rows.length < 2) return false;
      const text = cleanText(tblXml);
      // DILARANG KERAS mengambil tabel langkah kerja
      if (isWorkStepHeader(text)) return false;
      // Wajib memuat header identitas CI Equipment yang valid
      return /(?:ci\s*name|nama\s*ci|asset\s*name|equipment\s*name|nama\s*alat|serial\s*number|nomor\s*seri|class\s*id|id\s*kelas)/i.test(text);
    });
  }

  if (candidateTables.length === 0) return [];

  const getLines = (cellXml?: string): string[] => {
    if (!cellXml) return [];
    return cellXml
      .replace(/<w:br\/>/g, '[[BR]]')
      .replace(/<\/w:p>/g, '[[BR]]')
      .replace(/<[^>]+>/g, '')
      .split('[[BR]]')
      .map((l) => decodeEntities(l).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  };

  const items: SOPCIEquipmentItem[] = [];
  let currentNo = 1;
  // Word splits long equipment lists into a headed table plus header-less continuation tables.
  let previousColMap: Record<string, number> | null = null;
  let previousColCount = 0;

  for (const ciTbl of candidateTables) {
    const trs = ciTbl.match(/<w:tr(?:\s|>)[\s\S]*?<\/w:tr>/g) || [];
    if (trs.length < 2) continue;

    const headerIdx = trs.findIndex((tr) => {
      const text = cleanText(tr).toLowerCase();
      return (
        (text.includes('ci name') || text.includes('nama ci') || text.includes('equipment') || text.includes('peralatan') || text.includes('asset') || text.includes('class id') || text.includes('id kelas')) &&
        (text.includes('serial') || text.includes('seri') || text.includes('model') || text.includes('capacity') || text.includes('kapasitas') || text.includes('room') || text.includes('ruang') || text.includes('description') || text.includes('deskripsi') || text.includes('product') || text.includes('produk') || text.includes('manufacturer') || text.includes('principle') || text.includes('floor') || text.includes('lantai'))
      );
    });

    let colMap = {
      no: -1,
      classId: -1,
      ciName: -1,
      ciDescription: -1,
      capacity: -1,
      serialNumber: -1,
      mfd: -1,
      productName: -1,
      principle: -1,
      model: -1,
      floor: -1,
      room: -1
    };

    if (headerIdx >= 0) {
      const headerTcs = trs[headerIdx].match(/<w:tc(?:\s|>)[\s\S]*?<\/w:tc>/g) || [];
      headerTcs.forEach((tc, idx) => {
        const text = getLines(tc).join(' ').toLowerCase();
        if (/(?:serial\s*num|nomor\s*seri|no\s*seri|\bs[\.\/]?n\b)/i.test(text)) {
          colMap.serialNumber = idx;
        } else if (/(?:class\s*id|id\s*kelas|\bkelas\b)/i.test(text)) {
          colMap.classId = idx;
        } else if (/(?:ci\s*desc|deskripsi\s*ci|\bdeskripsi\b|\bdescription\b|asset\s*tag|tagging)/i.test(text)) {
          colMap.ciDescription = idx;
        } else if (/(?:ci\s*name|nama\s*ci|asset\s*name|equipment\s*name|nama\s*alat|nama\s*peralatan)/i.test(text)) {
          colMap.ciName = idx;
        } else if (/(?:production\s*year|tahun\s*(?:pembuatan|produksi)|mfd|manufacturing|year\s*of\s*prod)/i.test(text)) {
          colMap.mfd = idx;
        } else if (/(?:model\s*[\/\-]?\s*version|model|version|versi|\btipe\b|\btype\b)/i.test(text)) {
          colMap.model = idx;
        } else if (/(?:capacity|kapasitas|\brating\b)/i.test(text)) {
          colMap.capacity = idx;
        } else if (/(?:floor|lantai|\blt\b)/i.test(text)) {
          colMap.floor = idx;
        } else if (/(?:ruang(?:an)?|\broom\b|lokasi|location)/i.test(text)) {
          colMap.room = idx;
        } else if (/(?:principle|prinsip(?:al)?)/i.test(text)) {
          colMap.principle = idx;
        } else if (/(?:product\s*name|nama\s*produk|\bmerk\b|\bbrand\b|pabrikan|manufacturer)/i.test(text)) {
          colMap.productName = idx;
        } else if (/(?:^no\b|^nomor\b|^#)/i.test(text)) {
          colMap.no = idx;
        }
      });
    }

    const firstRowCells = ((trs[0] || '').match(/<w:tc(?:\s|>)[\s\S]*?<\/w:tc>/g) || []).length;
    const isContinuation = headerIdx < 0 && previousColMap !== null && firstRowCells === previousColCount;
    if (isContinuation) colMap = { ...(previousColMap as typeof colMap) };
    if (headerIdx >= 0) {
      previousColMap = { ...colMap };
      previousColCount = ((trs[headerIdx] || '').match(/<w:tc(?:\s|>)[\s\S]*?<\/w:tc>/g) || []).length;
    }

    // A continuation table has no header row, so its first row is data.
    const rawDataRows = trs.slice(headerIdx >= 0 ? headerIdx + 1 : isContinuation ? 0 : 1);
    for (const tr of rawDataRows) {
      const tcs = tr.match(/<w:tc(?:\s|>)[\s\S]*?<\/w:tc>/g) || [];
      if (tcs.length < 2) continue;

      const getColVal = (colIndex: number): string => {
        if (colIndex < 0 || colIndex >= tcs.length) return '';
        return cleanText(tcs[colIndex]);
      };

      const ciName = getColVal(colMap.ciName);
      const ciDescription = getColVal(colMap.ciDescription);
      const capacity = getColVal(colMap.capacity);
      const serialNumber = getColVal(colMap.serialNumber);
      const mfd = getColVal(colMap.mfd);
      let productName = getColVal(colMap.productName);
      const principle = getColVal(colMap.principle);
      if (!productName && principle) {
        productName = principle;
      } else if (productName && principle && productName !== principle) {
        productName = `${productName} / ${principle}`;
      }
      const model = getColVal(colMap.model);
      const floor = getColVal(colMap.floor);
      let room = getColVal(colMap.room);
      const classId = getColVal(colMap.classId);

      // Skip baris jika tidak ada identitas sama sekali atau hanya baris subheader duplikat
      if (!ciName && !classId && !serialNumber && !capacity && !model) continue;
      if (/^(?:ci\s*name|nama\s*ci|no|nomor)$/i.test(ciName)) continue;

      if (floor && room && !room.toLowerCase().includes(floor.toLowerCase())) {
        room = `${floor} - ${room}`;
      } else if (floor && !room) {
        room = floor;
      }

      let no = currentNo;
      if (colMap.no >= 0 && colMap.no < tcs.length) {
        const parsedNo = parseInt(cleanText(tcs[colMap.no]).replace(/\.$/, ''), 10);
        if (!isNaN(parsedNo) && parsedNo > 0) no = parsedNo;
      }

      items.push({
        no,
        classId: classId || '',
        ciName: ciName || '',
        ciDescription: ciDescription || '',
        capacity: capacity || '',
        serialNumber: serialNumber || '',
        mfd: mfd || '',
        productName: productName || '',
        model: model || '',
        room: room || ''
      });
      currentNo++;
    }
  }

  return items;
}

/**
 * Mengekstrak Prasyarat / Prerequisites (SOP Seksi 7) secara dwibahasa presisi.
 * Mendukung tabel dengan atau tanpa kolom nomor (No).
 */
function parsePrerequisites(xml: string): SOPPrerequisiteItem[] {
  const tbls = xml.match(/<w:tbl(?:\s|>)[\s\S]*?<\/w:tbl>/g) || [];
  const prereqTbl = tbls.find(
    (t) =>
      containsLabel(t, 'Check PTW') ||
      containsLabel(t, 'Periksa bahwa PTW') ||
      ((containsLabel(t, 'Requirement') || containsLabel(t, 'Persyaratan') || containsLabel(t, 'Prerequisite') || containsLabel(t, 'Prasyarat')) &&
        (containsLabel(t, 'Time') || containsLabel(t, 'Waktu') || containsLabel(t, 'Intial') || containsLabel(t, 'Initial') || containsLabel(t, 'Inisial')))
  );
  if (!prereqTbl) return [];

  const trs = prereqTbl.match(/<w:tr(?:\s|>)[\s\S]*?<\/w:tr>/g) || [];
  const headerIdx = trs.findIndex(
    (tr) =>
      (containsLabel(tr, 'Requirement') || containsLabel(tr, 'Persyaratan')) &&
      (containsLabel(tr, 'Time') || containsLabel(tr, 'Waktu') || containsLabel(tr, 'Intial') || containsLabel(tr, 'Initial') || containsLabel(tr, 'Inisial'))
  );
  const dataRows = trs.slice(headerIdx >= 0 ? headerIdx + 1 : 0);

  const items = dataRows
    .map((tr, idx) => {
      const tcs = tr.match(/<w:tc(?:\s|>)[\s\S]*?<\/w:tc>/g) || [];
      if (tcs.length === 0) return null;

      // Abaikan jika baris ini adalah baris header
      const rowText = tcs.map((c) => cleanText(c)).join(' ').toLowerCase();
      if (
        (rowText.includes('requirement') || rowText.includes('persyaratan')) &&
        (rowText.includes('time') || rowText.includes('waktu') || rowText.includes('initial') || rowText.includes('inisial'))
      ) {
        return null;
      }

      // Deteksi dinamis posisi kolom Requirement, Time, dan Initial
      let reqCell = tcs[0];
      let timeCell = tcs[1];
      let initialCell = tcs[2];

      const firstCellText = cleanText(tcs[0] || '').replace(/\.$/, '');
      if (tcs.length >= 4 || (/^\d+$/.test(firstCellText) && tcs.length >= 3)) {
        reqCell = tcs[1];
        timeCell = tcs[2];
        initialCell = tcs[3];
      }

      const bilingual = extractBilingualFromXml(reqCell || '');
      if (!bilingual.en && !bilingual.id) return null;

      const cleanEn = (bilingual.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      let cleanId = (bilingual.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      if (!cleanId && cleanEn) {
        cleanId = ensureBilingualTranslation(cleanEn);
      }

      return {
        no: idx + 1,
        requirementEn: cleanEn,
        requirementId: cleanId,
        time: timeCell ? cleanText(timeCell) : '',
        initial: initialCell ? cleanText(initialCell) : ''
      };
    })
    .filter(Boolean) as SOPPrerequisiteItem[];

  return items;
}

/** Read a work-instruction table plus any continuation tables in the same section. */
function parseSectionWorkSteps(
  xml: string,
  sectionNumber: number,
  lastColumn: 'initial' | 'name'
): Array<SOPWorkStepItem | EOPWorkStepItem> {
  const sectionTables = getSectionBlocks(xml, sectionNumber).filter((block) => block.kind === 'table');
  const headerTableIndex = sectionTables.findIndex((block) => isWorkStepHeader(block.text));
  if (headerTableIndex < 0) return [];

  const headerRows = getTableRows(sectionTables[headerTableIndex].xml);
  const headerRow = headerRows.find((row) => isWorkStepHeader(row.cells.join(' ')));
  const hasNoCol = !!headerRow && /^\s*(?:no\b|nomor\b|#)/i.test(headerRow.cells[0] || '');
  const steps: Array<SOPWorkStepItem | EOPWorkStepItem> = [];

  // Every following table remains in this section. A table may be a page-break
  // continuation and therefore deliberately has no repeated header row.
  for (let tableIndex = headerTableIndex; tableIndex < sectionTables.length; tableIndex++) {
    const rows = getTableRows(sectionTables[tableIndex].xml);
    for (const row of rows) {
      if (isWorkStepHeader(row.cells.join(' ')) || row.cells.length < 2) continue;

      const firstCell = (row.cells[0] || '').replace(/\.$/, '').trim();
      const rowHasNoCol = hasNoCol || (/^\d+$/.test(firstCell) && row.cells.length >= 4);
      const actionIndex = rowHasNoCol ? 1 : 0;
      const outcomeIndex = rowHasNoCol ? 2 : 1;
      const timeIndex = rowHasNoCol ? 3 : 2;
      const finalIndex = rowHasNoCol ? 4 : 3;
      const action = extractBilingualFromXml(row.cellXml[actionIndex] || '');
      const outcome = extractBilingualFromXml(row.cellXml[outcomeIndex] || '');
      if (!action.en && !action.id) continue;

      const no = rowHasNoCol ? parseInt(firstCell, 10) || steps.length + 1 : steps.length + 1;
      const cleanActionEn = (action.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      let cleanActionId = (action.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      if (!cleanActionId && cleanActionEn) {
        cleanActionId = ensureBilingualTranslation(cleanActionEn);
      }

      const cleanOutcomeEn = (outcome.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      let cleanOutcomeId = (outcome.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      if (!cleanOutcomeId && cleanOutcomeEn) {
        cleanOutcomeId = ensureBilingualTranslation(cleanOutcomeEn);
      }

      const base = {
        no,
        actionEn: cleanActionEn,
        actionId: cleanActionId,
        expectedOutcomeEn: cleanOutcomeEn,
        expectedOutcomeId: cleanOutcomeId,
        time: row.cells[timeIndex] || '',
      };
      steps.push(lastColumn === 'initial'
        ? { ...base, initial: row.cells[finalIndex] || '' }
        : { ...base, name: row.cells[finalIndex] || '' });
    }
  }

  return steps;
}

/**
 * Mengekstrak Langkah Kerja SOP (Seksi 10) secara dwibahasa presisi.
 * Mendukung tabel baik yang memiliki kolom No terpisah maupun tanpa kolom No.
 */
function parseSOPWorkSteps(xml: string): SOPWorkStepItem[] {
  return parseSectionWorkSteps(xml, 10, 'initial') as SOPWorkStepItem[];
}

/**
 * Mengekstrak Langkah Kedaruratan EOP (Seksi 4) secara dwibahasa presisi.
 * Mendukung format tabel dengan atau tanpa kolom nomor (No).
 */
function parseEOPWorkSteps(xml: string): EOPWorkStepItem[] {
  return parseSectionWorkSteps(xml, 4, 'name') as EOPWorkStepItem[];
}

/**
 * Mengekstrak tabel Dokumen Referensi (SOP Seksi 5 / EOP Seksi 2).
 * Mendukung tabel 2 kolom [Name, Number] maupun 3 kolom [No, Name, Number].
 */
function parseReferencedDocuments(xml: string, sectionNumber: number): SOPReferencedDocItem[] {
  const blocks = getSectionBlocks(xml, sectionNumber);
  const headerIndex = blocks.findIndex((block) =>
    /(?:Document\s*Name|Nama\s*Dokumen)/i.test(block.text) &&
    /(?:Document\s*Number|Nomor\s*Dokumen)/i.test(block.text)
  );
  if (headerIndex < 0) return [];

  const docs: SOPReferencedDocItem[] = [];
  // Header labels can be a paragraph, while their data table starts in the
  // next block. Read all tables after the labels until the next section.
  for (const block of blocks.slice(headerIndex)) {
    if (block.kind !== 'table') continue;
    for (const row of getTableRows(block.xml)) {
      if (row.cells.length < 2 || /(?:Document\s*Name|Nama\s*Dokumen)/i.test(row.cells.join(' '))) continue;
      let [name, number] = row.cells;
      if (row.cells.length >= 3 && /^\d+\.?$/.test(name.trim())) {
        name = row.cells[1];
        number = row.cells[2];
      }
      if ((name && name !== '-') || (number && number !== '-')) docs.push({ name: name || '', number: number || '' });
    }
  }
  return docs;
}

function parseEOPEHSRequirementsRobust(xml: string): {
  ppeEn: string;
  ppeId: string;
  commsEn: string;
  commsId: string;
  items: Array<{ textEn: string; textId: string }>;
  additionalItems: Array<{ textEn: string; textId: string }>;
} {
  const blocks = getSectionBlocks(xml, 3);
  const rawPairs: Array<{ textEn: string; textId: string }> = [];

  // Prioritas 1: Ekstraksi dari tabel Word resmi (NeutraDC/DME corporate standard)
  for (const block of blocks) {
    if (block.kind === 'table') {
      const rows = getTableRows(block.xml);
      for (const row of rows) {
        if (row.cells.join(' ').toLowerCase().includes('requirements') && row.cells.length === 1) continue;
        // The "Section 3 – Environmental, Health & Safety" banner is itself a table; it is not an EHS item.
        if (/^(?:Section|Seksi)\s*\d+\s*[–—-]/i.test(row.cells.join(' ').trim())) continue;
        const cellXml = row.cellXml[0] || '';
        const bilingual = extractBilingualFromXml(cellXml);
        const cleanEn = (bilingual.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
        const cleanId = (bilingual.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
        if (cleanEn || cleanId) {
          rawPairs.push({ textEn: cleanEn, textId: cleanId });
        }
      }
    } else if (block.kind === 'paragraph') {
      const bilingual = extractBilingualFromXml(block.xml);
      const cleanEn = (bilingual.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanId = (bilingual.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      if ((cleanEn || cleanId) && !/(?:section|seksi)\s*3/i.test(cleanEn) && !/^requirements$/i.test(cleanEn)) {
        rawPairs.push({ textEn: cleanEn, textId: cleanId });
      }
    }
  }

  // Jika ekstraksi terstruktur berhasil mendapatkan data:
  if (rawPairs.length > 0) {
    const ppeIndex = rawPairs.findIndex((item) =>
      /personal protective|\bppe\b|alat pelindung|\bapd\b|safety shoes|protective helmet/i.test(`${item.textEn} ${item.textId}`)
    );
    const commsIndex = rawPairs.findIndex((item) =>
      /communication|handy[\s-]*talk|komunikasi|\bht\b/i.test(`${item.textEn} ${item.textId}`)
    );

    const ppe = ppeIndex >= 0 ? rawPairs[ppeIndex] : (rawPairs[0] || { textEn: '', textId: '' });
    const comms = commsIndex >= 0 ? rawPairs[commsIndex] : (rawPairs[1] || { textEn: '', textId: '' });

    const usedIndices = new Set([ppeIndex >= 0 ? ppeIndex : 0, commsIndex >= 0 ? commsIndex : 1]);
    const additionalItems = rawPairs.filter((_, idx) => !usedIndices.has(idx));

    return {
      ppeEn: ppe.textEn,
      ppeId: ppe.textId,
      commsEn: comms.textEn,
      commsId: comms.textId,
      items: rawPairs,
      additionalItems
    };
  }

  // Prioritas 2: Fallback plain text jika dokumen Word tidak menggunakan tabel
  const section = extractPlainSection(xml, 3, 4);
  const firstNumberedItem = section.search(/(?:^|\n|\t)\s*1[\.\)]\s+/m);
  const raw = (firstNumberedItem >= 0 ? section.slice(firstNumberedItem) : section)
    .replace(/^(?:Section|Seksi)\s*3[^\n]*/i, '')
    .replace(/^\s*(?:Requirements|Persyaratan)\s*:?/im, '')
    .trim();

  if (!raw || raw.length < 5) {
    return { ppeEn: '', ppeId: '', commsEn: '', commsId: '', items: [], additionalItems: [] };
  }

  const items = raw
    .split(/(?:^|[\n\t]+|\s{2,})(?=\s*\d+[\.\)]\s+)/m)
    .flatMap((item) => item.split(/\s+(?=\d+[\.\)]\s+[A-Z])/))
    .map((item) => item.replace(/^\s*\d+[\.\)]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const parsed = items.map((item) =>
    detectLanguage(item) === 'id' ? { textEn: '', textId: item } : { textEn: item, textId: '' }
  );
  const commsIndex = parsed.findIndex((item) => /communication|handy[\s-]*talk|komunikasi|\bht\b/i.test(`${item.textEn} ${item.textId}`));
  const ppeIndex = parsed.findIndex((item) => /personal protective|\bppe\b|alat pelindung|\bapd\b|safety shoes|protective helmet/i.test(`${item.textEn} ${item.textId}`));
  const comms = commsIndex >= 0 ? parsed[commsIndex] : { textEn: '', textId: '' };
  const ppe = ppeIndex >= 0 ? parsed[ppeIndex] : { textEn: '', textId: '' };

  return {
    ppeEn: ppe.textEn,
    ppeId: ppe.textId,
    commsEn: comms.textEn,
    commsId: comms.textId,
    items: parsed,
    additionalItems: parsed.filter((_, index) => index !== commsIndex && index !== ppeIndex)
  };
}

/**
 * Ordered EHS items read row-by-row from the SOP Section 6 tables. The 4 legacy slots
 * (PPE/jewelry/comms/LOTO) cannot hold documents with a different item count, which
 * dropped and duplicated items on export.
 */
function parseSOPEHSItems(xml: string): Array<{ textEn: string; textId: string }> {
  const items: Array<{ textEn: string; textId: string }> = [];
  for (const block of getSectionBlocks(xml, 6)) {
    if (block.kind !== 'table' || /^(?:Section|Seksi)\s*\d+/i.test(block.text.trim())) continue;
    for (const row of getTableRows(block.xml)) {
      const text = row.cells.join(' ').trim();
      if (!text || /^(?:requirements|persyaratan)\b/i.test(text)) continue;
      const pair = extractBilingualFromXml(row.cellXml[0] || '');
      const textEn = pair.en.replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const textId = pair.id.replace(/^\s*\d+[\.\)]\s*/, '').trim();
      if (textEn || textId) items.push({ textEn, textId });
    }
  }
  return items;
}

function parseSOPEHSRequirementsRobust(xml: string): {
  ppeEn: string;
  ppeId: string;
  jewelryEn: string;
  jewelryId: string;
  commsEn: string;
  commsId: string;
  lotoEn: string;
  lotoId: string;
} {
  const section = extractPlainSection(xml, 6, 7);
  const firstNumberedItem = section.search(/(?:^|\n|\t)\s*1[\.\)]\s+/m);
  const raw = firstNumberedItem >= 0 ? section.slice(firstNumberedItem) : section;
  const items = raw
    .split(/(?:^|[\n\t]+|\s{2,})(?=\s*\d+[\.\)]\s+)/m)
    .flatMap((item) => item.split(/\s+(?=\d+[\.\)]\s+[A-Z])/))
    .map((item) => item.replace(/^\s*\d+[\.\)]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((item) => detectLanguage(item) === 'id' ? { en: '', id: item } : { en: item, id: '' });
  const pick = (pattern: RegExp, fallbackIndex: number) =>
    items.find((item) => pattern.test(`${item.en} ${item.id}`)) || items[fallbackIndex] || { en: '', id: '' };
  const ppe = pick(/personal protective|\bppe\b|alat pelindung|\bapd\b|safety shoes|protective helmet/i, 0);
  const jewelry = pick(/jewel|ring|watch|metal object|perhiasan|cincin|jam tangan/i, 1);
  const comms = pick(/communication|handy[\s-]*talk|komunikasi|\bht\b/i, 2);
  const loto = pick(/lock[\s-]*out|tag[\s-]*out|\bloto\b|selector switch|saklar pemilih/i, 3);
  return {
    ppeEn: ppe.en,
    ppeId: ppe.id || (ppe.en ? ensureBilingualTranslation(ppe.en) : ''),
    jewelryEn: jewelry.en,
    jewelryId: jewelry.id || (jewelry.en ? ensureBilingualTranslation(jewelry.en) : ''),
    commsEn: comms.en,
    commsId: comms.id || (comms.en ? ensureBilingualTranslation(comms.en) : ''),
    lotoEn: loto.en,
    lotoId: loto.id || (loto.en ? ensureBilingualTranslation(loto.en) : ''),
  };
}

/**
 * Mengekstrak Kondisi yang Diharapkan EOP (Seksi 4)
 */
function parseEOPExpectedConditions(xml: string): { en: string; id: string } {
  const match = xml.match(
    /(?:Expected\s*Conditions\s*(?:\/\s*Equipment\s*Status)?|Kondisi\s*yang\s*Diharapkan)[\s\S]*?(?=<w:tbl)/i
  );
  if (!match) return { en: '', id: '' };

  const raw = cleanText(match[0])
    .replace(/Expected\s*Conditions\s*(?:\/\s*Equipment\s*Status)?\s*:?/i, '')
    .replace(/Kondisi\s*yang\s*Diharapkan\s*:?/i, '')
    .trim();

  const cleaned = raw.replace(/\b\d+[\.\)]/g, '').replace(/[-_]/g, '').trim();
  if (!cleaned) {
    return { en: '', id: '' };
  }

  return { en: raw, id: '' };
}

function parseEOPExpectedConditionsRobust(xml: string): { en: string; id: string } {
  const section = extractPlainSection(xml, 4, 5);
  const match = section.match(
    /(?:Expected\s*Conditions(?:\s*\/\s*Equipment\s*Status)?|Kondisi\s*yang\s*Diharapkan(?:\s*\/\s*Status\s*Peralatan)?)\s*:?\s*([\s\S]*?)(?=\n\s*(?:No\s*)?(?:Action|Tindakan)\b|\n\s*(?:Action|Tindakan)\s+(?:Expected|Hasil)\b|$)/i
  );
  const value = match?.[1]?.replace(/\s+/g, ' ').trim() || '';
  if (!value) return { en: '', id: '' };
  return detectLanguage(value) === 'id' ? { en: '', id: value } : { en: value, id: '' };
}

/**
 * Mengekstrak data Dry Run / Simulasi Pelaksanaan (SOP Seksi 8 / EOP Seksi 6).
 * Membaca Job Title, Name, dan Date jika tersedia pada tabel berkas Word.
 */
function parseDryRun(xml: string, isEop: boolean): {
  jobTitle: string;
  name: string;
  date: string;
  signatureBase64?: string;
} {
  // A blank Dry Run table in the source stays blank; never invent a job title.
  const defaultDryRun = {
    jobTitle: '',
    name: '',
    date: '',
    signatureBase64: ''
  };

  const sectionNumber = isEop ? 6 : 8;
  const blocks = getSectionBlocks(xml, sectionNumber);
  // Skip the "Section 8 – Dry Run" banner table; the form table follows it.
  const tableBlock = blocks.find((b) => b.kind === 'table' && !/^(?:Section|Seksi)\s*\d+/i.test(b.text.trim()));
  if (!tableBlock) return defaultDryRun;

  const rows = getTableRows(tableBlock.xml);
  // Cari baris data (bukan baris label header "Job Title / Jabatan")
  const dataRow = rows.find((r) => {
    const text = r.cells.join(' ').toLowerCase();
    return !text.includes('job title') && !text.includes('jabatan') && r.cells.length >= 2;
  });

  if (dataRow && dataRow.cells.length >= 2) {
    const jobTitle = cleanText(dataRow.cells[0] || '').trim();
    const name = cleanText(dataRow.cells[1] || '').trim();
    const date = dataRow.cells.length >= 4 ? cleanText(dataRow.cells[3] || '').trim() : '';
    return {
      jobTitle: jobTitle && jobTitle !== '-' ? jobTitle : defaultDryRun.jobTitle,
      name: name && name !== '-' ? name : '',
      date: date && date !== '-' ? date : '',
      signatureBase64: ''
    };
  }

  return defaultDryRun;
}

/**
 * Reads the Approval table (SOP Section 13 / EOP Section 7) row by row, exactly as written.
 * Supported layouts:
 *  - one cell per column: [Job Title (EN<br>ID), Name, Signature, Date]
 *  - a single cell per row: "<tab>Job Title<tab>Name<br>Job Title (ID)"
 * Rows, roles and names are never invented: a blank name stays blank.
 */
function parseApprovals(xml: string, isEop: boolean): DocumentSigner[] {
  const cellLines = (cellXml: string) =>
    decodeEntities(cellXml.replace(/<w:br\b[^>]*\/?>/gi, '\n').replace(/<\/w:p>/gi, '\n').replace(/<w:tab\b[^>]*\/?>/gi, '\t').replace(/<[^>]+>/g, ''))
      .split('\n')
      .map((line) => line.replace(/[^\S\t]+/g, ' ').trim())
      .filter((line) => line.replace(/\t/g, '').trim());
  const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
  const isHeader = (text: string) => /signature|tanda\s*tangan|^job\s*title|^jabatan/i.test(text.trim());

  const sectionTables = getSectionBlocks(xml, isEop ? 7 : 13)
    .filter((block) => block.kind === 'table' && !/^(?:Section|Seksi)\s*\d+/i.test(block.text.trim()));
  const tableXml = sectionTables[0]?.xml
    || (xml.match(/<w:tbl(?:\s|>)[\s\S]*?<\/w:tbl>/g) || []).find((t) => /signature|tanda\s*tangan/i.test(cleanText(t)) && /name|nama/i.test(cleanText(t)));
  if (!tableXml) return [];

  const signers: DocumentSigner[] = [];
  for (const row of getTableRows(tableXml)) {
    const rowText = row.cells.join(' ').trim();
    if (!rowText || isHeader(rowText)) continue;

    let roleEn = '';
    let roleId = '';
    let name = '';
    let date = '';
    if (row.cellXml.length >= 2) {
      const roleLines = cellLines(row.cellXml[0] || '').map(clean);
      roleEn = roleLines[0] || '';
      roleId = roleLines[1] || '';
      name = clean(cellLines(row.cellXml[1] || '')[0] || '');
      date = clean(row.cells[3] || '');
    } else {
      const lines = cellLines(row.cellXml[0] || '');
      const parts = (lines[0] || '').split('\t').map(clean).filter(Boolean);
      roleEn = parts[0] || '';
      name = parts.slice(1).join(' ');
      roleId = clean((lines[1] || '').replace(/\t/g, ' '));
    }
    if (!roleEn && !name) continue;
    signers.push({ roleEn, roleId, name: name === '-' ? '' : name, date: date === '-' ? '' : date });
  }
  return signers;
}

/**
 * Mengekstrak Persyaratan K3 / EHS SOP (Seksi 6)
 */
function parseSOPEHSRequirements(xml: string): {
  ppeEn: string;
  ppeId: string;
  jewelryEn: string;
  jewelryId: string;
  commsEn: string;
  commsId: string;
  lotoEn: string;
  lotoId: string;
} {
  const match = xml.match(
    /(?:Section\s*6|Seksi\s*6)[\s\S]*?(?:Enviro?nmental|K3|Lingkungan)[\s\S]*?(?=(?:Section\s*7|Seksi\s*7))/i
  );
  if (!match) {
    return {
      ppeEn: '',
      ppeId: '',
      jewelryEn: '',
      jewelryId: '',
      commsEn: '',
      commsId: '',
      lotoEn: '',
      lotoId: ''
    };
  }

  const trs = match[0].match(/<w:tr(?:\s|>)[\s\S]*?<\/w:tr>/g) || [];
  const items = trs
    .map((tr) => {
      const bilingual = extractBilingualFromXml(tr);
      return {
        en: (bilingual.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim(),
        id: (bilingual.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim()
      };
    })
    .filter((item) => item.en || item.id);

  return {
    ppeEn: items[0]?.en || '',
    ppeId: items[0]?.id || '',
    jewelryEn: items[1]?.en || '',
    jewelryId: items[1]?.id || '',
    commsEn: items[2]?.en || '',
    commsId: items[2]?.id || '',
    lotoEn: items[3]?.en || '',
    lotoId: items[3]?.id || ''
  };
}

const SOP_SYSTEM_DEFINITIONS: Array<{
  key: string;
  labelEn: string;
  labelId: string;
  pattern: RegExp;
}> = [
  { key: 'electrical_distribution', labelEn: 'Electrical Distribution', labelId: 'Distribusi Kelistrikan', pattern: /electrical\s*distributi/i },
  { key: 'critical_power', labelEn: 'Critical Power Distribution', labelId: 'Distribusi Daya Kritis', pattern: /critical\s*power/i },
  { key: 'ups_system', labelEn: 'UPS System', labelId: 'Sistem UPS', pattern: /\bups\s*system\b/i },
  { key: 'standby_generator', labelEn: 'Standby Generator', labelId: 'Generator Cadangan', pattern: /standby\s*generator/i },
  { key: 'drups', labelEn: 'DRUPS', labelId: 'DRUPS / UPS Dinamis', pattern: /\bdrups\b/i },
  { key: 'air_ventilation', labelEn: 'Air Ventilation', labelId: 'Ventilasi Udara', pattern: /air\s*ventilation/i },
  { key: 'main_cooling', labelEn: 'Main Cooling System', labelId: 'Sistem Pendingin Utama', pattern: /main\s*cooling/i },
  { key: 'critical_area_cooling', labelEn: 'Critical Area Cooling', labelId: 'Pendingin Area Kritis', pattern: /critical\s*area\s*cooling/i },
  { key: 'common_area_cooling', labelEn: 'Common Area Cooling', labelId: 'Pendingin Area Bersama', pattern: /common\s*area\s*cooling/i },
  { key: 'fire_detection', labelEn: 'Fire Detection', labelId: 'Deteksi Kebakaran', pattern: /fire\s*detection/i },
  { key: 'fire_protection', labelEn: 'Fire Protection', labelId: 'Proteksi Kebakaran', pattern: /fire\s*protection/i },
  { key: 'disable_fire', labelEn: 'Disable Fire System', labelId: 'Nonaktifkan Sistem Kebakaran', pattern: /disable\s*fire/i },
  { key: 'security_system', labelEn: 'Security System', labelId: 'Sistem Keamanan', pattern: /security\s*system/i },
  { key: 'controls_monitoring', labelEn: 'Controls / Monitoring', labelId: 'Kontrol / Pemantauan', pattern: /controls?\s*(?:\/|\s*)\s*monitoring/i },
  { key: 'lockout_tagout', labelEn: 'Lockout / Tag Required', labelId: 'Wajib Lockout / Tagout', pattern: /lockout\s*(?:\/|\s*)\s*tag/i },
];

function parseSOPAffectedSystems(xml: string): {
  systems: SOPAffectedSystemItem[];
  detailsEn: string;
  detailsId: string;
} {
  const m = xml.match(/(?:Section|Seksi)\s*4[\s\S]*?(?:Section|Seksi)\s*5/i);
  if (!m) {
    return {
      systems: SOP_SYSTEM_DEFINITIONS.map((d) => ({ key: d.key, labelEn: d.labelEn, labelId: d.labelId, checked: false })),
      detailsEn: '',
      detailsId: ''
    };
  }
  const sec4Xml = m[0];

  // Extract detail section
  const detailMatch = sec4Xml.match(/if any of the item above is checked[\s\S]*?:\s*([\s\S]*?)$/i);
  let detailsEn = '';
  let detailsId = '';

  if (detailMatch && detailMatch[1]) {
    // The match starts inside the bilingual instruction ("jika ada item di atas yang dicentang…");
    // drop those instruction lines so only the user's detail text remains, verbatim.
    const lines = decodeEntities(
      detailMatch[1].replace(/<w:br\b[^>]*\/?>/gi, '\n').replace(/<\/w:p>/gi, '\n').replace(/<[^>]+>/g, '')
    )
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line && !/if any of the item|jika ada item di atas|^(?:Section|Seksi)\s*\d+/i.test(line));
    const numbered = (line: string) => /^\d+[\.\)]\s/.test(line);
    if (lines.length >= 2 && lines.every(numbered)) {
      // English-only numbered list ("1. …", "2. …", "3. …"): every line is a detail item.
      detailsEn = lines.join('\n');
    } else if (lines.length >= 2) {
      // Bilingual layout: each English line is followed by its Indonesian line.
      detailsEn = lines.filter((_, index) => index % 2 === 0).join('\n');
      detailsId = lines.filter((_, index) => index % 2 === 1).join('\n');
    } else if (lines.length === 1 && !/^n\/?a$/i.test(lines[0])) {
      if (detectLanguage(lines[0]) === 'id') detailsId = lines[0];
      else {
        detailsEn = lines[0];
        detailsId = ensureBilingualTranslation(lines[0]);
      }
    }
  }

  const systems: SOPAffectedSystemItem[] = SOP_SYSTEM_DEFINITIONS.map((sys) => ({
    key: sys.key,
    labelEn: sys.labelEn,
    labelId: sys.labelId,
    // Only the checkbox symbol in the Word file decides; mentioning a system in the
    // detail text (e.g. "critical area cooling") must not tick an unticked box.
    checked: new RegExp('(?:☒|☑|\\[x\\])[^<]*?' + sys.pattern.source, 'i').test(sec4Xml)
  }));

  return { systems, detailsEn, detailsId };
}

/**
 * Parsing berkas Word SOP (14 Seksi) secara komprehensif
 */
function parseSOPData(xml: string, fileName: string): SOPDocumentData {
  const meta = extractMetadata(xml, fileName, false);
  const equipmentList = parseCIEquipment(xml);
  const prerequisites = parsePrerequisites(xml);
  const workSteps = parseSOPWorkSteps(xml);
  const approvals = parseApprovals(xml, false);
  const robustEhsRequirements = parseSOPEHSRequirementsRobust(xml);
  const legacyEhsRequirements = parseSOPEHSRequirements(xml);
  const ehsSlots = Object.values(robustEhsRequirements).some(Boolean)
    ? robustEhsRequirements
    : legacyEhsRequirements;
  const ehsItems = parseSOPEHSItems(xml);
  const ehsRequirements = ehsItems.length > 0 ? { ...ehsSlots, items: ehsItems } : ehsSlots;
  const conditionsPair = extractSectionBilingual(
    xml,
    /(?:Conditions\s*(?:\/\s*Equipment\s*status)?\s*prior\s*to\s*(?:SOP|EOP)\s*Execution|Kondisi\s*(?:\/\s*Status\s*peralatan)?\s*sebelum\s*Pelaksanaan\s*(?:SOP|EOP))/i,
    /<w:tbl/i,
    [/^conditions\s*\/\s*equipment/i, /^kondisi\s*\/\s*status/i]
  );
  let conditionsEn = conditionsPair.en;
  let conditionsId = conditionsPair.id;
  if (!conditionsId && conditionsEn) {
    conditionsId = ensureBilingualTranslation(conditionsEn);
  }

  // Seksi 3: Schedule / Work Information
  const norm = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const scheduleDateMatch = norm.match(
    /SOP\s*Execution\s*Date\s*:\s*(.*?)(?:Reference\s*Ticket|Tanggal\s*Pelaksanaan)/i
  );
  const ticketMatch = norm.match(
    /Reference\s*Ticket\s*Number\s*:\s*(.*?)(?:Tanggal\s*Pelaksanaan|Executed\s*by)/i
  );
  const executedMatch = norm.match(
    /Executed\s*by\s*\(Name\)\s*:\s*(.*?)(?:Job\s*title|Dilaksanakan)/i
  );

  // "Executed by (Name) | Job title" header row, values in the row below it.
  const executedBy = { name: '', jobTitle: '' };
  for (const block of getSectionBlocks(xml, 3)) {
    if (block.kind !== 'table') continue;
    const rows = getTableRows(block.xml);
    const headerIndex = rows.findIndex((row) => /executed\s*by|dilaksanakan\s*oleh/i.test(row.cells[0] || ''));
    const values = headerIndex >= 0 ? rows[headerIndex + 1] : undefined;
    if (values) {
      executedBy.name = values.cells[0] && values.cells[0] !== '-' ? values.cells[0] : '';
      executedBy.jobTitle = values.cells[1] && values.cells[1] !== '-' ? values.cells[1] : '';
      break;
    }
  }

  // Seksi 4: Affected Systems
  const parsedAffected = parseSOPAffectedSystems(xml);
  const affectedSystems = parsedAffected.systems;
  const affectedSystemsDetails = parsedAffected.detailsEn || parsedAffected.detailsId || '';
  const affectedSystemsDetailsEn = parsedAffected.detailsEn;
  const affectedSystemsDetailsId = parsedAffected.detailsId;

  // Seksi 9: Maintenance Period
  const is6Months = /■\s*6\s*Months|☑\s*6\s*Months|\[x\]\s*6\s*Months/i.test(xml);
  const maintenancePeriod = is6Months ? '6_months' : 'annual';

  // Seksi 11: Back Out Procedure
  let backOutProcedure = 'N/A T/A';
  const backoutMatch = xml.match(
    /(?:Section\s*11|Seksi\s*11)[\s\S]*?(?:Action|Tindakan)[\s\S]*?<w:t[^>]*>([\s\S]*?)<\/w:t>/i
  );
  if (backoutMatch && backoutMatch[1]) {
    const bo = cleanText(backoutMatch[1]);
    if (bo) backOutProcedure = bo;
  }
  const backOutPair = extractSectionBilingual(
    xml,
    /(?:Section\s*11|Seksi\s*11)/i,
    /(?:Section\s*12|Seksi\s*12)/i,
    [/^action$/i, /^tindakan$/i, /^back\s*out/i, /^prosedur\s*pemulihan/i]
  );
  let backOutEn = backOutPair.en || backOutProcedure;
  let backOutId = backOutPair.id;
  if (!backOutId && backOutEn && backOutEn !== 'N/A T/A') {
    backOutId = ensureBilingualTranslation(backOutEn);
  }

  const additionalPair = extractSectionBilingual(
    xml,
    /(?:Section\s*14|Seksi\s*14)/i,
    /<\/w:body>/i,
    [/^additional\s*information$/i, /^informasi\s*tambahan$/i]
  );
  let additionalEn = additionalPair.en;
  let additionalId = additionalPair.id;
  if (!additionalId && additionalEn && additionalEn !== 'N/A T/A') {
    additionalId = ensureBilingualTranslation(additionalEn);
  }

  return {
    type: 'SOP',
    documentTitle: meta.title,
    documentPurposeEn: meta.purposeEn,
    documentPurposeId: meta.purposeId,
    workLocationEn: meta.locationEn,
    workLocationId: meta.locationId,
    equipmentList,
    executionDate:
      scheduleDateMatch && scheduleDateMatch[1] && scheduleDateMatch[1].trim() !== '-'
        ? scheduleDateMatch[1].trim()
        : '',
    referenceTicketNumber:
      ticketMatch && ticketMatch[1] && ticketMatch[1].trim() !== '-' ? ticketMatch[1].trim() : '',
    executedByName: executedBy.name || (executedMatch && executedMatch[1] ? executedMatch[1].trim() : ''),
    executedByJobTitle: executedBy.jobTitle,
    affectedSystems,
    affectedSystemsDetails,
    affectedSystemsDetailsEn,
    affectedSystemsDetailsId,
    referencedDocuments: parseReferencedDocuments(xml, 5),
    ehsRequirements,
    prerequisites,
    dryRun: parseDryRun(xml, false),
    maintenancePeriod,
    conditionsPriorToExecutionEn: conditionsEn,
    conditionsPriorToExecutionId: conditionsId,
    workSteps,
    backOutProcedure,
    backOutProcedureEn: backOutEn,
    backOutProcedureId: backOutId,
    author: meta.author,
    dateOfCreation: meta.creationDate,
    dateRevision: meta.revisionDate,
    revisionNumber: meta.revisionNumber,
    approvals,
    additionalInformation: additionalEn || additionalId || '',
    additionalInformationEn: additionalEn,
    additionalInformationId: additionalId
  };
}

/**
 * Parsing berkas Word EOP (8 Seksi) secara komprehensif
 */
function parseEOPData(xml: string, fileName: string): EOPDocumentData {
  const meta = extractMetadata(xml, fileName, true);
  const referencedDocuments = parseReferencedDocuments(xml, 2);
  const ehsRequirements = parseEOPEHSRequirementsRobust(xml);
  const expectedCondPair = extractSectionBilingual(
    xml,
    /(?:Expected\s*Conditions\s*(?:\/\s*Equipment\s*Status)?|Kondisi\s*yang\s*Diharapkan)/i,
    /<w:tbl/i,
    [/^expected\s*conditions/i, /^kondisi\s*yang\s*diharapkan/i]
  );
  const robustExpectedCond = parseEOPExpectedConditionsRobust(xml);
  const parsedExpectedCond = robustExpectedCond.en || robustExpectedCond.id
    ? robustExpectedCond
    : parseEOPExpectedConditions(xml);
  let expectedCondEn = expectedCondPair.en || parsedExpectedCond.en;
  let expectedCondId = expectedCondPair.id || parsedExpectedCond.id;
  if (!expectedCondId && expectedCondEn) {
    expectedCondId = ensureBilingualTranslation(expectedCondEn);
  }

  const workSteps = parseEOPWorkSteps(xml);
  const approvals = parseApprovals(xml, true);
  const additionalPair = extractSectionBilingual(
    xml,
    /(?:Section\s*8|Seksi\s*8)/i,
    /<\/w:body>/i,
    [/^additional\s*information$/i, /^informasi\s*tambahan$/i]
  );
  let additionalEn = additionalPair.en;
  let additionalId = additionalPair.id;
  if (!additionalId && additionalEn && additionalEn !== 'N/A T/A') {
    additionalId = ensureBilingualTranslation(additionalEn);
  }

  return {
    type: 'EOP',
    documentTitle: meta.title,
    documentPurposeEn: meta.purposeEn,
    documentPurposeId: meta.purposeId,
    workLocationEn: meta.locationEn,
    workLocationId: meta.locationId,
    referencedDocuments,
    ehsRequirements,
    expectedConditionsEn: expectedCondEn,
    expectedConditionsId: expectedCondId,
    workSteps,
    author: meta.author,
    dateOfCreation: meta.creationDate,
    nextDateRevision: meta.revisionDate,
    revisionNumber: meta.revisionNumber,
    dryRun: parseDryRun(xml, true),
    approvals,
    additionalInformation: additionalEn || additionalId || '',
    additionalInformationEn: additionalEn,
    additionalInformationId: additionalId
  };
}

/**
 * Fungsi utama untuk membaca berkas .docx dan mendeteksi tipe SOP / EOP
 */
export async function importSopEopFromDocx(file: File): Promise<ParsedSopEopResult> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const docXmlFile = zip.files['word/document.xml'];
  if (!docXmlFile) {
    throw new Error('Berkas yang dipilih bukan berkas Word (.docx) valid atau berkas rusak.');
  }

  const xml = await docXmlFile.async('text');
  const documentText = normalizedXmlText(xml);

  // Deteksi Tipe Dokumen:
  // SOP memiliki 14 seksi dan Informasi Peralatan (Equipment Information).
  // EOP memiliki 8 seksi (Section 8 – Additional Information) dan warna banner FF00FF.
  const hasEquipmentTable =
    containsLabel(documentText, 'Equipment Information') ||
    containsLabel(documentText, 'Informasi Peralatan') ||
    containsLabel(documentText, 'CI Name') ||
    containsLabel(documentText, 'Nama CI') ||
    containsLabel(documentText, 'Manufacturer / Principle') ||
    parseCIEquipment(xml).length > 0;

  const hasSection8 =
    /(?:section|seksi)\s*8\s*[-–—]\s*(?:additional|informasi\s*tambahan)/i.test(documentText) ||
    /(?:section|seksi)\s*8\b/i.test(documentText);
  const hasSection9Or10Or14 = /(?:section|seksi)\s*(?:9|10|14)\b/i.test(documentText);
  const isEopFileName = /(?:^|[^a-zA-Z0-9])eop(?:[^a-zA-Z0-9]|$)/i.test(file.name);

  const isEop =
    !hasEquipmentTable &&
    ((!hasSection9Or10Or14 &&
      (hasSection8 || xml.includes('FF00FF') || isEopFileName)) ||
    (/emergency\s*operating\s*procedure/i.test(documentText) && !hasEquipmentTable));

  if (isEop) {
    const eopData = parseEOPData(xml, file.name);
    const warnings = getImportWarnings(eopData);
    return {
      type: 'EOP',
      eopData,
      summary: {
        title: eopData.documentTitle,
        type: 'EOP',
        stepCount: eopData.workSteps.length,
        author: eopData.author,
        sourceFile: file.name
      },
      warnings
    };
  } else {
    const sopData = parseSOPData(xml, file.name);
    const warnings = getImportWarnings(sopData);
    return {
      type: 'SOP',
      sopData,
      summary: {
        title: sopData.documentTitle,
        type: 'SOP',
        stepCount: sopData.workSteps.length,
        equipmentCount: sopData.equipmentList.length,
        author: sopData.author,
        sourceFile: file.name
      },
      warnings
    };
  }
}
