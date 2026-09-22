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
  SOPWorkStepItem,
  EOPWorkStepItem,
  SOPPrerequisiteItem,
  SOPReferencedDocItem,
  DocumentSigner
} from '@/types/sopEopTypes';

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
    .replace(/<w:br\/>/g, '[[BR]]')
    .replace(/<\/w:p>/g, '[[BR]]')
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

  // Jika baris pertama dan kedua sama persis (data duplikat/kembar), pisahkan bahasanya
  if (lines[0].trim().toLowerCase() === lines[1].trim().toLowerCase()) {
    const lang = detectLanguage(lines[0]);
    if (lang === 'id') {
      return { en: '', id: lines[0] };
    }
    return { en: lines[0], id: '' };
  }

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
  if (!data.documentTitle) warnings.push('Judul dokumen tidak terbaca.');
  if (data.referencedDocuments.length === 0) warnings.push('Tabel dokumen referensi tidak terbaca atau memang kosong.');
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
function extractMetadata(xml: string, isEop: boolean) {
  const norm = structuredXmlText(xml);

  const getMatch = (regex: RegExp): string => {
    const m = norm.match(regex);
    return m && m[1] ? decodeEntities(m[1].trim()) : '';
  };

  let rawTitle = getMatch(/Document\s*Title\s*:\s*([\s\S]*?)(?:Judul\s*Dokumen|Document\s*Purpose)/i)
    .replace(/^[\s\-:]+/, '')
    .trim();

  const title = rawTitle === '-' ? '' : rawTitle;

  const purposeEn = getMatch(/Document\s*Purpose\s*:\s*([\s\S]*?)(?:Tujuan\s*Dokumen|Work\s*Location)/i);
  const purposeId = getMatch(/Tujuan\s*Dokumen\s*:\s*([\s\S]*?)(?:Work\s*Location|Section|Seksi)/i);
  const locationEn = getMatch(/Work\s*Location\s*:\s*([\s\S]*?)(?:Lokasi\s*Kerja|Section|Seksi)/i);
  const locationId = getMatch(/Lokasi\s*Kerja\s*:\s*([\s\S]*?)(?:Section|Seksi|\n\n)/i);

  const author =
    extractDocumentAuthor(xml, isEop) ||
    getMatch(/(?:Author|Penulis|Penyusun)\s*:?\s*([a-zA-Z0-9\s\.\,\'\-]+?)(?:Date\s*of\s*Creation|Tanggal\s*Pembuatan|\n|$)/i);
  const creationDate =
    getMatch(
      /Date\s*of\s*Creation\s*:?\s*([a-zA-Z0-9\s\/\-\.]+?)(?:Penulis|Tanggal\s*Pembuatan|Date\s*Revision|Next\s*Date\s*Revision|Revision\s*Number|\n|$)/i
    );
  const revisionNumber =
    getMatch(
      /Revision\s*Number\s*:?\s*([a-zA-Z0-9\s\/\-\.]+?)(?:Tanggal\s*Revisi|Nomor\s*Revisi|Section|Seksi|\n|$)/i
    );
  const revisionDate =
    getMatch(
      /(?:Date\s*Revision|Next\s*Date\s*Revision)\s*:?\s*([a-zA-Z0-9\s\/\-\.]+?)(?:Revision\s*Number|Nomor\s*Revisi|Tanggal\s*Revisi|\n|$)/i
    );

  return {
    title,
    purposeEn: purposeEn || '',
    purposeId: purposeId || '',
    locationEn,
    locationId,
    author,
    creationDate,
    revisionNumber: revisionNumber === 'T/A' ? '' : revisionNumber,
    revisionDate: revisionDate === 'T/A' ? '' : revisionDate
  };
}

/**
 * Mengekstrak tabel CI Equipment (SOP Seksi 2) dengan mapping kolom dinamis.
 * Mampu membaca tabel 7 kolom (Lighting Point), 10 kolom (Trafo), maupun variasi jumlah/urutan kolom lainnya.
 */
function parseCIEquipment(xml: string): SOPCIEquipmentItem[] {
  const tbls = xml.match(/<w:tbl(?:\s|>)[\s\S]*?<\/w:tbl>/g) || [];

  // Cari SEMUA tabel yang mengandung kata kunci CI Equipment
  const ciCandidates = tbls.filter(
    (t) =>
      containsLabel(t, 'CI Name') ||
      containsLabel(t, 'Nama CI') ||
      containsLabel(t, 'Class Id') ||
      containsLabel(t, 'ID Kelas') ||
      containsLabel(t, 'Equipment Information') ||
      containsLabel(t, 'Informasi Peralatan')
  );

  // Dari semua kandidat, pilih tabel yang punya baris terbanyak (skip banner 1-2 baris)
  let ciTbl: string | undefined;
  let maxRows = 0;
  for (const candidate of ciCandidates) {
    const rowCount = (candidate.match(/<w:tr(?:\s|>)[\s\S]*?<\/w:tr>/g) || []).length;
    if (rowCount > maxRows) {
      maxRows = rowCount;
      ciTbl = candidate;
    }
  }

  // Tabel data asli minimal harus punya 2 baris (1 header + 1 data)
  if (!ciTbl || maxRows < 2) return [];

  const trs = ciTbl.match(/<w:tr(?:\s|>)[\s\S]*?<\/w:tr>/g) || [];

  const headerIdx = trs.findIndex(
    (tr) =>
      containsLabel(tr, 'CI Name') ||
      containsLabel(tr, 'Nama CI') ||
      containsLabel(tr, 'Class Id') ||
      containsLabel(tr, 'ID Kelas') ||
      containsLabel(tr, 'Capacity') ||
      containsLabel(tr, 'Kapasitas')
  );

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

  // 1. Petakan indeks kolom secara dinamis berdasarkan isi teks pada baris header
  const colMap = {
    no: -1,
    classId: -1,
    ciName: -1,
    ciDescription: -1,
    capacity: -1,
    serialNumber: -1,
    mfd: -1,
    productName: -1,
    model: -1,
    room: -1
  };

  if (headerIdx >= 0) {
    const headerTcs = trs[headerIdx].match(/<w:tc(?:\s|>)[\s\S]*?<\/w:tc>/g) || [];
    headerTcs.forEach((tc, idx) => {
      const text = getLines(tc).join(' ').toLowerCase();

      // Prioritaskan pengecekan spesifik agar tidak salah mapping
      if (/(?:serial\s*num|nomor\s*seri|no\s*seri|\bs[\.\/]?n\b)/i.test(text)) {
        colMap.serialNumber = idx;
      } else if (/(?:class\s*id|id\s*kelas|\bkelas\b)/i.test(text)) {
        colMap.classId = idx;
      } else if (/(?:ci\s*desc|deskripsi\s*ci|\bdeskripsi\b|\bdescription\b)/i.test(text)) {
        colMap.ciDescription = idx;
      } else if (/(?:ci\s*name|nama\s*ci|asset\s*name|equipment\s*name|nama\s*alat|nama\s*peralatan)/i.test(text)) {
        colMap.ciName = idx;
      } else if (/(?:production\s*year|tahun\s*(?:pembuatan|produksi)|mfd|manufacturing|year\s*of\s*prod)/i.test(text)) {
        colMap.mfd = idx;
      } else if (/(?:product\s*name|nama\s*produk|\bmerk\b|\bbrand\b|pabrikan|manufacturer)/i.test(text)) {
        colMap.productName = idx;
      } else if (/(?:model\s*[\/\-]?\s*version|model|version|versi|\btipe\b|\btype\b)/i.test(text)) {
        colMap.model = idx;
      } else if (/(?:capacity|kapasitas|\brating\b)/i.test(text)) {
        colMap.capacity = idx;
      } else if (/(?:ruang(?:an)?|\broom\b|lokasi|location)/i.test(text)) {
        colMap.room = idx;
      } else if (/(?:^no\b|^nomor\b|^#)/i.test(text)) {
        colMap.no = idx;
      }
    });
  }

  const rawDataRows = trs.slice(headerIdx >= 0 ? headerIdx + 1 : 1);
  if (rawDataRows.length === 0) return [];

  const sampleTcs = rawDataRows[0].match(/<w:tc(?:\s|>)[\s\S]*?<\/w:tc>/g) || [];
  const colCount = sampleTcs.length;

  // Fallback pemetaan kolom jika baris header tidak memiliki kata kunci standar
  if (colMap.ciName === -1 && colMap.classId === -1 && colMap.capacity === -1) {
    if (colCount === 7) {
      colMap.no = 0;
      colMap.classId = 1;
      colMap.ciName = 2;
      colMap.capacity = 3;
      colMap.mfd = 4;
      colMap.productName = 5;
      colMap.model = 6;
    } else if (colCount === 8) {
      colMap.no = 0;
      colMap.classId = 1;
      colMap.ciName = 2;
      colMap.ciDescription = 3;
      colMap.capacity = 4;
      colMap.mfd = 5;
      colMap.productName = 6;
      colMap.model = 7;
    } else if (colCount === 9) {
      colMap.no = 0;
      colMap.classId = 1;
      colMap.ciName = 2;
      colMap.ciDescription = 3;
      colMap.capacity = 4;
      colMap.serialNumber = 5;
      colMap.mfd = 6;
      colMap.productName = 7;
      colMap.model = 8;
    } else if (colCount >= 10) {
      colMap.no = 0;
      colMap.classId = 1;
      colMap.ciName = 2;
      colMap.ciDescription = 3;
      colMap.capacity = 4;
      colMap.serialNumber = 5;
      colMap.mfd = 6;
      colMap.productName = 7;
      colMap.model = 8;
      colMap.room = 9;
    }
  }

  if (colMap.no === -1 && colMap.classId === 1) {
    colMap.no = 0;
  }

  // Fungsi deteksi untuk membuang baris subheader bilingual (misal baris kedua yang berisi teks bahasa Indonesia)
  const isSubheaderRow = (tcs: string[]): boolean => {
    if (tcs.length === 0) return false;
    const firstCol = cleanText(tcs[0] || '').replace(/\.$/, '');
    if (/^\d+$/.test(firstCol)) return false;

    const rowText = tcs.map((c) => cleanText(c)).join(' ').toLowerCase();
    const headerKeywords = [
      'id kelas', 'class id', 'nama ci', 'ci name', 'deskripsi', 'description',
      'kapasitas', 'capacity', 'nomor seri', 'serial number', 'tahun pembuatan',
      'production year', 'nama produk', 'product name', 'model', 'ruangan', 'room'
    ];
    let matches = 0;
    for (const kw of headerKeywords) {
      if (rowText.includes(kw)) matches++;
    }
    return matches >= 2;
  };

  const dataRows = rawDataRows.filter((tr) => {
    const tcs = tr.match(/<w:tc(?:\s|>)[\s\S]*?<\/w:tc>/g) || [];
    return !isSubheaderRow(tcs);
  });

  const items = dataRows
    .map((tr, idx) => {
      const tcs = tr.match(/<w:tc(?:\s|>)[\s\S]*?<\/w:tc>/g) || [];
      if (tcs.length < 3) return null;

      const getColVal = (colIndex: number): string => {
        if (colIndex < 0 || colIndex >= tcs.length) return '';
        return cleanText(tcs[colIndex]);
      };

      let no = idx + 1;
      if (colMap.no >= 0 && colMap.no < tcs.length) {
        const parsedNo = parseInt(cleanText(tcs[colMap.no]).replace(/\.$/, ''), 10);
        if (!isNaN(parsedNo) && parsedNo > 0) {
          no = parsedNo;
        }
      }

      const classId = getColVal(colMap.classId);

      const ciName = getColVal(colMap.ciName);
      const ciDescription = getColVal(colMap.ciDescription);
      const capacity = getColVal(colMap.capacity);
      const serialNumber = getColVal(colMap.serialNumber);
      const mfd = getColVal(colMap.mfd);
      const productName = getColVal(colMap.productName);
      const model = getColVal(colMap.model);
      const room = getColVal(colMap.room);

      // Baris kosong diabaikan
      if (!ciName && !classId && !capacity && !serialNumber && !productName && !model) {
        return null;
      }

      return {
        no,
        classId,
        ciName,
        ciDescription,
        capacity,
        serialNumber,
        mfd,
        productName,
        model,
        room
      };
    })
    .filter(Boolean) as SOPCIEquipmentItem[];

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

      return {
        no: idx + 1,
        requirementEn: bilingual.en,
        requirementId: bilingual.id,
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
      const base = {
        no,
        actionEn: (action.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim(),
        actionId: (action.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim(),
        expectedOutcomeEn: (outcome.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim(),
        expectedOutcomeId: (outcome.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim(),
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
    ppeEn: ppe.en, ppeId: ppe.id,
    jewelryEn: jewelry.en, jewelryId: jewelry.id,
    commsEn: comms.en, commsId: comms.id,
    lotoEn: loto.en, lotoId: loto.id,
  };
}

/**
 * Mengekstrak Persyaratan K3 / EHS EOP (Seksi 3)
 */
function parseEOPEHSRequirements(xml: string): {
  ppeEn: string;
  ppeId: string;
  commsEn: string;
  commsId: string;
} {
  const sec3Match = xml.match(
    /(?:Section\s*3|Seksi\s*3)[\s\S]*?(?:Enviro?nmental|K3)[\s\S]*?(?=(?:Section\s*4|Seksi\s*4))/i
  );
  if (!sec3Match) {
    return { ppeEn: '', ppeId: '', commsEn: '', commsId: '' };
  }

  const raw = cleanText(sec3Match[0])
    .replace(/(?:Section\s*3|Seksi\s*3)[^–—\-]*[–—\-]\s*(?:Enviro?nmental[^\n]*|K3[^\n]*)/i, '')
    .replace(/Requirements\s*:?/i, '')
    .trim();

  if (!raw || raw.length < 5) {
    return { ppeEn: '', ppeId: '', commsEn: '', commsId: '' };
  }

  const items = raw.split(/(?=\b\d+[\.\)])/).map((s) => s.trim()).filter(Boolean);
  if (items.length > 0) {
    return {
      ppeEn: items.slice(0, 2).join('\n') || items[0] || '',
      ppeId: '',
      commsEn: items.slice(2).join('\n') || '',
      commsId: ''
    };
  }

  return {
    ppeEn: raw,
    ppeId: '',
    commsEn: '',
    commsId: ''
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
 * Mengekstrak tabel Approval / Pengesahan (4 Pejabat Penandatangan)
 */
function parseApprovals(xml: string): DocumentSigner[] {
  const tbls = xml.match(/<w:tbl(?:\s|>)[\s\S]*?<\/w:tbl>/g) || [];
  const appTbl = tbls.find(
    (t) =>
      containsLabel(t, 'Project Manager') ||
      containsLabel(t, 'Chief Engineering') ||
      containsLabel(t, 'Facility Manager') ||
      containsLabel(t, 'Manajer Proyek')
  );
  if (!appTbl) return [];

  const trs = appTbl.match(/<w:tr(?:\s|>)[\s\S]*?<\/w:tr>/g) || [];
  const defaultRoles = [
    { roleEn: 'Project Manager', roleId: 'Manajer Proyek' },
    { roleEn: 'Chief Engineering', roleId: 'Kepala Engineering' },
    { roleEn: 'Facility Manager', roleId: 'Manajer Fasilitas' },
    { roleEn: 'Assistant Manager HDC', roleId: 'Asisten Manajer HDC' }
  ];

  const approvers: DocumentSigner[] = defaultRoles.map((role, idx) => {
    const tr = trs[idx];
    if (!tr) {
      return {
        roleEn: role.roleEn,
        roleId: role.roleId,
        name: '',
        date: '',
        signature: ''
      };
    }

    const raw = tr
      .replace(/<w:br\/>/g, '[[BR]]')
      .replace(/<\/w:p>/g, '[[BR]]')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let extractedName = '';
    const m = raw.match(
      /(?:Project\s*Manager|Chief\s*Engineering|Facility\s*Manager|Assistant\s*Manager\s*HDC)\s*(.*?)(?:\[\[BR\]\]|Manajer|Kepala|Asisten|$)/i
    );
    if (m && m[1]) {
      extractedName = m[1].replace(/\[\[BR\]\]/g, '').trim();
    }

    return {
      roleEn: role.roleEn,
      roleId: role.roleId,
      name: extractedName,
      date: '',
      signature: ''
    };
  });

  return approvers;
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

/**
 * Parsing berkas Word SOP (14 Seksi) secara komprehensif
 */
function parseSOPData(xml: string): SOPDocumentData {
  const meta = extractMetadata(xml, false);
  const equipmentList = parseCIEquipment(xml);
  const prerequisites = parsePrerequisites(xml);
  const workSteps = parseSOPWorkSteps(xml);
  const approvals = parseApprovals(xml);
  const robustEhsRequirements = parseSOPEHSRequirementsRobust(xml);
  const legacyEhsRequirements = parseSOPEHSRequirements(xml);
  const ehsRequirements = Object.values(robustEhsRequirements).some(Boolean)
    ? robustEhsRequirements
    : legacyEhsRequirements;
  const conditionsPair = extractSectionBilingual(
    xml,
    /(?:Conditions\s*\/\s*Equipment\s*status\s*prior\s*to\s*SOP\s*Execution|Kondisi\s*\/\s*Status\s*peralatan\s*sebelum\s*Pelaksanaan\s*SOP)/i,
    /<w:tbl/i,
    [/^conditions\s*\/\s*equipment/i, /^kondisi\s*\/\s*status/i]
  );

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

  // Seksi 4: Affected Systems
  // Keep the standard labels for the form, but never invent a checked system.
  const affectedSystems = [];
  let affectedSystemsDetails = '';
  const impactMatch = xml.match(
    /if any of the item above is checked[\s\S]*?:\s*([\s\S]*?)(?:Section\s*5|Seksi\s*5)/i
  );
  if (impactMatch && impactMatch[1]) {
    const rawDetails = cleanText(impactMatch[1]);
    if (rawDetails.length > 5) {
      affectedSystemsDetails = rawDetails;
    }
  }
  const affectedSystemsPair = impactMatch?.[1]
    ? extractBilingualFromXml(impactMatch[1])
    : { en: '', id: '' };

  // Seksi 9: Maintenance Period
  const is6Months = /■\s*6\s*Months|☑\s*6\s*Months|\[x\]\s*6\s*Months/i.test(xml);
  const maintenancePeriod = is6Months ? '6_months' : 'custom';

  // Seksi 11: Back Out Procedure
  let backOutProcedure = '';
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
  const additionalPair = extractSectionBilingual(
    xml,
    /(?:Section\s*14|Seksi\s*14)/i,
    /<\/w:body>/i,
    [/^additional\s*information$/i, /^informasi\s*tambahan$/i]
  );

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
    executedByName: executedMatch && executedMatch[1] ? executedMatch[1].trim() : '',
    executedByJobTitle: '',
    affectedSystems,
    affectedSystemsDetails,
    affectedSystemsDetailsEn: affectedSystemsPair.en || affectedSystemsDetails,
    affectedSystemsDetailsId: affectedSystemsPair.id,
    referencedDocuments: parseReferencedDocuments(xml, 5),
    ehsRequirements,
    prerequisites,
    dryRun: {
      jobTitle: '',
      name: '',
      date: '',
      signatureBase64: ''
    },
    maintenancePeriod,
    conditionsPriorToExecutionEn: conditionsPair.en,
    conditionsPriorToExecutionId: conditionsPair.id,
    workSteps,
    backOutProcedure,
    backOutProcedureEn: backOutPair.en || backOutProcedure,
    backOutProcedureId: backOutPair.id,
    author: meta.author,
    dateOfCreation: meta.creationDate,
    dateRevision: meta.revisionDate,
    revisionNumber: meta.revisionNumber,
    approvals,
    additionalInformation: additionalPair.en || additionalPair.id,
    additionalInformationEn: additionalPair.en,
    additionalInformationId: additionalPair.id
  };
}

/**
 * Parsing berkas Word EOP (8 Seksi) secara komprehensif
 */
function parseEOPData(xml: string): EOPDocumentData {
  const meta = extractMetadata(xml, true);
  const referencedDocuments = parseReferencedDocuments(xml, 2);
  const ehsRequirements = parseEOPEHSRequirementsRobust(xml);
  const robustExpectedCond = parseEOPExpectedConditionsRobust(xml);
  const parsedExpectedCond = robustExpectedCond.en || robustExpectedCond.id
    ? robustExpectedCond
    : parseEOPExpectedConditions(xml);
  const expectedCondPair = extractSectionBilingual(
    xml,
    /(?:Expected\s*Conditions\s*(?:\/\s*Equipment\s*Status)?|Kondisi\s*yang\s*Diharapkan)/i,
    /<w:tbl/i,
    [/^expected\s*conditions/i, /^kondisi\s*yang\s*diharapkan/i]
  );
  const expectedCond = {
    en: parsedExpectedCond.en || expectedCondPair.en,
    id: parsedExpectedCond.id || expectedCondPair.id,
  };
  const workSteps = parseEOPWorkSteps(xml);
  const approvals = parseApprovals(xml);
  const additionalPair = extractSectionBilingual(
    xml,
    /(?:Section\s*8|Seksi\s*8)/i,
    /<\/w:body>/i,
    [/^additional\s*information$/i, /^informasi\s*tambahan$/i]
  );

  return {
    type: 'EOP',
    documentTitle: meta.title,
    documentPurposeEn: meta.purposeEn,
    documentPurposeId: meta.purposeId,
    workLocationEn: meta.locationEn,
    workLocationId: meta.locationId,
    referencedDocuments,
    ehsRequirements,
    expectedConditionsEn: expectedCond.en,
    expectedConditionsId: expectedCond.id,
    workSteps,
    author: meta.author,
    dateOfCreation: meta.creationDate,
    nextDateRevision: meta.revisionDate,
    revisionNumber: meta.revisionNumber,
    dryRun: {
      jobTitle: '',
      name: '',
      date: '',
      signatureBase64: ''
    },
    approvals,
    additionalInformation: additionalPair.en || additionalPair.id,
    additionalInformationEn: additionalPair.en,
    additionalInformationId: additionalPair.id
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
  const isEop =
    (!containsLabel(documentText, 'Section 14') &&
      (xml.includes('FF00FF') || xml.includes('Section 8 – Additional') || /eop/i.test(file.name))) ||
    /emergency\s*operating\s*procedure/i.test(documentText);

  if (isEop) {
    const eopData = parseEOPData(xml);
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
    const sopData = parseSOPData(xml);
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
