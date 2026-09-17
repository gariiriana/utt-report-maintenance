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
  DocumentSigner,
  DEFAULT_AFFECTED_SYSTEMS,
  DEFAULT_DEFAULT_APPROVERS
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
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
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

/**
 * Mengekstrak metadata teks dari dokumen XML secara cerdas dan tahan multiline
 */
function extractMetadata(xml: string, fileName: string, isEop: boolean) {
  const norm = xml
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ');

  const getMatch = (regex: RegExp): string => {
    const m = norm.match(regex);
    return m && m[1] ? decodeEntities(m[1].trim()) : '';
  };

  let rawTitle = getMatch(/Document\s*Title\s*:\s*([\s\S]*?)(?:Judul\s*Dokumen|Document\s*Purpose)/i)
    .replace(/^[\s\-:]+/, '')
    .trim();

  let title = rawTitle;
  if (title === '-' || !title) {
    const cleanFn = fileName
      .replace(/\.docx$/i, '')
      .replace(/\s*\(\d+\)\s*$/g, '') // Bersihkan suffix copy seperti (1), (2)
      .replace(/[-_]/g, ' ')
      .trim()
      .toUpperCase();

    if (/trafo|transformer/i.test(fileName) || /transformer/i.test(xml)) {
      title = isEop
        ? 'EOP GANGGUAN / PADAM TRANSFORMATOR (TRAFO)'
        : 'SOP PEMELIHARAAN TRANSFORMATOR (TRAFO)';
    } else {
      title = isEop
        ? cleanFn.includes('EOP')
          ? cleanFn
          : `EOP ${cleanFn}`
        : cleanFn.includes('SOP')
        ? cleanFn
        : `SOP ${cleanFn}`;
    }
  }

  const purposeEn = getMatch(/Document\s*Purpose\s*:\s*([\s\S]*?)(?:Tujuan\s*Dokumen|Work\s*Location)/i);
  const purposeId = getMatch(/Tujuan\s*Dokumen\s*:\s*([\s\S]*?)(?:Work\s*Location|Section|Seksi)/i);
  const locationEn =
    getMatch(/Work\s*Location\s*:\s*([\s\S]*?)(?:Lokasi\s*Kerja|Section|Seksi)/i) || 'Neutra DC Cikarang';
  const locationId =
    getMatch(/Lokasi\s*Kerja\s*:\s*([\s\S]*?)(?:Section|Seksi|\n\n)/i) || 'Neutra DC Cikarang';

  const author =
    getMatch(/Author\s*:?\s*([a-zA-Z0-9\s\.\,\'\-]+?)(?:Date\s*of\s*Creation|Penulis|\n|$)/i) || 'Alif Darmawan';
  const creationDate =
    getMatch(
      /Date\s*of\s*Creation\s*:?\s*([a-zA-Z0-9\s\/\-\.]+?)(?:Penulis|Tanggal\s*Pembuatan|Date\s*Revision|Next\s*Date\s*Revision|Revision\s*Number|\n|$)/i
    ) || '07 Sep 2026';
  const revisionNumber =
    getMatch(
      /Revision\s*Number\s*:?\s*([a-zA-Z0-9\s\/\-\.]+?)(?:Tanggal\s*Revisi|Nomor\s*Revisi|Section|Seksi|\n|$)/i
    ) || '00';
  const revisionDate =
    getMatch(
      /(?:Date\s*Revision|Next\s*Date\s*Revision)\s*:?\s*([a-zA-Z0-9\s\/\-\.]+?)(?:Revision\s*Number|Nomor\s*Revisi|Tanggal\s*Revisi|\n|$)/i
    ) || 'N/A';

  return {
    title,
    purposeEn: purposeEn || '',
    purposeId: purposeId || '',
    locationEn: locationEn || 'Neutra DC Cikarang',
    locationId: locationId || 'Neutra DC Cikarang',
    author: author || 'DME Maintenance Team',
    creationDate: creationDate || '07 Sep 2026',
    revisionNumber: revisionNumber === 'T/A' || !revisionNumber ? '00' : revisionNumber,
    revisionDate: revisionDate === 'T/A' || !revisionDate ? 'N/A' : revisionDate
  };
}

/**
 * Mengekstrak tabel CI Equipment (SOP Seksi 2) dengan mapping kolom dinamis.
 * Mampu membaca tabel 7 kolom (Lighting Point), 10 kolom (Trafo), maupun variasi jumlah/urutan kolom lainnya.
 */
function parseCIEquipment(xml: string): SOPCIEquipmentItem[] {
  const tbls = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  const ciTbl = tbls.find(
    (t) =>
      t.includes('CI Name') ||
      t.includes('Nama CI') ||
      t.includes('Class Id') ||
      t.includes('ID Kelas') ||
      t.includes('Equipment Information') ||
      t.includes('Informasi Peralatan')
  );
  if (!ciTbl) return [];

  const trs = ciTbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  const headerIdx = trs.findIndex(
    (tr) =>
      tr.includes('CI Name') ||
      tr.includes('Nama CI') ||
      tr.includes('Class Id') ||
      tr.includes('ID Kelas') ||
      tr.includes('Capacity') ||
      tr.includes('Kapasitas')
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
    const headerTcs = trs[headerIdx].match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
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

  const sampleTcs = rawDataRows[0].match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
  const colCount = sampleTcs.length;

  // Fallback pemetaan kolom jika baris header tidak memiliki kata kunci standar
  if (colMap.ciName === -1 && colMap.classId === -1 && colMap.capacity === -1) {
    if (colCount === 7) {
      // Format 7 Kolom (seperti SOP Lighting Point): No | Class Id | CI Name | Capacity | Production Year | Product Name | Model/Version
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
      // Format 10 Kolom (Master Trafo NeutraDC)
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
    const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
    return !isSubheaderRow(tcs);
  });

  const isTrafoDoc = /trafo|transformer/i.test(xml);

  const items = dataRows
    .map((tr, idx) => {
      const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
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

      let classId = getColVal(colMap.classId);
      if (!classId && isTrafoDoc) {
        classId = 'TR';
      }

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
  const tbls = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  const prereqTbl = tbls.find(
    (t) =>
      t.includes('Check PTW') ||
      t.includes('Periksa bahwa PTW') ||
      ((t.includes('Requirement') || t.includes('Persyaratan') || t.includes('Prerequisite') || t.includes('Prasyarat')) &&
        (t.includes('Time') || t.includes('Waktu') || t.includes('Intial') || t.includes('Initial') || t.includes('Inisial')))
  );
  if (!prereqTbl) return [];

  const trs = prereqTbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  const headerIdx = trs.findIndex(
    (tr) =>
      (tr.includes('Requirement') || tr.includes('Persyaratan')) &&
      (tr.includes('Time') || tr.includes('Waktu') || tr.includes('Intial') || tr.includes('Initial') || tr.includes('Inisial'))
  );
  const dataRows = trs.slice(headerIdx >= 0 ? headerIdx + 1 : 0);

  const items = dataRows
    .map((tr, idx) => {
      const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
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

/**
 * Mengekstrak Langkah Kerja SOP (Seksi 10) secara dwibahasa presisi.
 * Mendukung tabel baik yang memiliki kolom No terpisah maupun tanpa kolom No.
 */
function parseSOPWorkSteps(xml: string): SOPWorkStepItem[] {
  const tbls = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  const stepTbl = tbls.find(
    (t) =>
      (t.includes('Action') || t.includes('Tindakan')) &&
      (t.includes('Expected Outcome') || t.includes('Hasil yang Diharapkan'))
  );
  if (!stepTbl) return [];

  const trs = stepTbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  const headerIdx = trs.findIndex(
    (tr) => tr.includes('Expected Outcome') || tr.includes('Hasil yang Diharapkan')
  );
  const dataRows = trs.slice(headerIdx >= 0 ? headerIdx + 1 : 1);

  // Deteksi apakah header memiliki kolom No di kolom pertama
  let hasNoCol = false;
  if (headerIdx >= 0) {
    const headerTcs = trs[headerIdx].match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
    if (headerTcs.length >= 4) {
      const firstColText = cleanText(headerTcs[0] || '').toLowerCase();
      if (/^no\b|^nomor\b|^#/.test(firstColText)) {
        hasNoCol = true;
      }
    }
  }

  const steps = dataRows
    .map((tr, idx) => {
      const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      if (tcs.length < 2) return null;

      const firstColText = cleanText(tcs[0] || '').replace(/\.$/, '');
      const isFirstColNumber = /^\d+$/.test(firstColText);
      const isRowWithNoCol = hasNoCol || (isFirstColNumber && tcs.length >= 4);

      let stepNo = idx + 1;
      let actionCell = tcs[0];
      let outcomeCell = tcs[1];
      let timeCell = tcs[2];
      let initialCell = tcs[3];

      if (isRowWithNoCol) {
        stepNo = parseInt(firstColText, 10) || idx + 1;
        actionCell = tcs[1];
        outcomeCell = tcs[2];
        timeCell = tcs[3];
        initialCell = tcs[4];
      }

      const action = extractBilingualFromXml(actionCell || '');
      const outcome = extractBilingualFromXml(outcomeCell || '');
      if (!action.en && !action.id) return null;

      const cleanActionEn = (action.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanActionId = (action.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanOutcomeEn = (outcome.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanOutcomeId = (outcome.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();

      return {
        no: stepNo,
        actionEn: cleanActionEn,
        actionId: cleanActionId,
        expectedOutcomeEn: cleanOutcomeEn,
        expectedOutcomeId: cleanOutcomeId,
        time: timeCell ? cleanText(timeCell) : '',
        initial: initialCell ? cleanText(initialCell) : ''
      };
    })
    .filter(Boolean) as SOPWorkStepItem[];

  return steps;
}

/**
 * Mengekstrak Langkah Kedaruratan EOP (Seksi 4) secara dwibahasa presisi.
 * Mendukung format tabel dengan atau tanpa kolom nomor (No).
 */
function parseEOPWorkSteps(xml: string): EOPWorkStepItem[] {
  const tbls = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  const stepTbl = tbls.find(
    (t) =>
      (t.includes('Action') || t.includes('Tindakan')) &&
      (t.includes('Expected Outcome') || t.includes('Hasil yang Diharapkan'))
  );
  if (!stepTbl) return [];

  const trs = stepTbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  const headerIdx = trs.findIndex(
    (tr) => tr.includes('Expected Outcome') || tr.includes('Hasil yang Diharapkan')
  );
  const dataRows = trs.slice(headerIdx >= 0 ? headerIdx + 1 : 1);

  let hasNoCol = false;
  if (headerIdx >= 0) {
    const headerTcs = trs[headerIdx].match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
    if (headerTcs.length >= 4) {
      const firstColText = cleanText(headerTcs[0] || '').toLowerCase();
      if (/^no\b|^nomor\b|^#/.test(firstColText)) {
        hasNoCol = true;
      }
    }
  }

  const steps = dataRows
    .map((tr, idx) => {
      const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      if (tcs.length < 2) return null;

      const firstColText = cleanText(tcs[0] || '').replace(/\.$/, '');
      const isFirstColNumber = /^\d+$/.test(firstColText);
      const isRowWithNoCol = hasNoCol || (isFirstColNumber && tcs.length >= 4);

      let stepNo = idx + 1;
      let actionCell = tcs[0];
      let outcomeCell = tcs[1];
      let timeCell = tcs[2];
      let nameCell = tcs[3];

      if (isRowWithNoCol) {
        stepNo = parseInt(firstColText, 10) || idx + 1;
        actionCell = tcs[1];
        outcomeCell = tcs[2];
        timeCell = tcs[3];
        nameCell = tcs[4];
      }

      const action = extractBilingualFromXml(actionCell || '');
      const outcome = extractBilingualFromXml(outcomeCell || '');
      if (!action.en && !action.id) return null;

      const cleanActionEn = (action.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanActionId = (action.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanOutcomeEn = (outcome.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanOutcomeId = (outcome.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();

      return {
        no: stepNo,
        actionEn: cleanActionEn,
        actionId: cleanActionId,
        expectedOutcomeEn: cleanOutcomeEn,
        expectedOutcomeId: cleanOutcomeId,
        time: timeCell ? cleanText(timeCell) : '',
        name: nameCell ? cleanText(nameCell) : ''
      };
    })
    .filter(Boolean) as EOPWorkStepItem[];

  return steps;
}

/**
 * Mengekstrak tabel Dokumen Referensi (SOP Seksi 5 / EOP Seksi 2).
 * Mendukung tabel 2 kolom [Name, Number] maupun 3 kolom [No, Name, Number].
 */
function parseReferencedDocuments(xml: string): SOPReferencedDocItem[] {
  const tbls = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  const refTbl = tbls.find(
    (t) =>
      (t.includes('Document Name') || t.includes('Nama Dokumen')) &&
      (t.includes('Document Number') || t.includes('Nomor Dokumen'))
  );
  if (!refTbl) return [];

  const trs = refTbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  const headerIdx = trs.findIndex(
    (tr) =>
      (tr.includes('Document Name') || tr.includes('Nama Dokumen')) &&
      (tr.includes('Document Number') || tr.includes('Nomor Dokumen'))
  );
  const dataRows = trs.slice(headerIdx >= 0 ? headerIdx + 1 : 1);

  const docs: SOPReferencedDocItem[] = [];
  for (const tr of dataRows) {
    const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
    if (tcs.length < 2) continue;

    let name = cleanText(tcs[0] || '');
    let number = cleanText(tcs[1] || '');

    // Jika kolom pertama adalah nomor urut (angka) dan tabel memiliki 3 kolom
    if (tcs.length >= 3 && /^\d+$/.test(name.replace(/\.$/, ''))) {
      name = cleanText(tcs[1] || '');
      number = cleanText(tcs[2] || '');
    }

    if ((name && name !== '-') || (number && number !== '-')) {
      docs.push({ name, number });
    }
  }

  return docs;
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

/**
 * Mengekstrak tabel Approval / Pengesahan (4 Pejabat Penandatangan)
 */
function parseApprovals(xml: string): DocumentSigner[] {
  const tbls = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  const appTbl = tbls.find(
    (t) =>
      t.includes('Project Manager') ||
      t.includes('Chief Engineering') ||
      t.includes('Facility Manager') ||
      t.includes('Manajer Proyek')
  );
  if (!appTbl) return [...DEFAULT_DEFAULT_APPROVERS];

  const trs = appTbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  const defaultRoles = [
    { roleEn: 'Project Manager', roleId: 'Manajer Proyek', fallbackName: 'Dwi Tasmiyadi' },
    { roleEn: 'Chief Engineering', roleId: 'Kepala Engineering', fallbackName: 'Habib Mulyana' },
    { roleEn: 'Facility Manager', roleId: 'Manajer Fasilitas', fallbackName: 'Supriyatno' },
    { roleEn: 'Assistant Manager HDC', roleId: 'Asisten Manajer HDC', fallbackName: 'Budi Susanto' }
  ];

  const approvers: DocumentSigner[] = defaultRoles.map((role, idx) => {
    const tr = trs[idx];
    if (!tr) {
      return {
        roleEn: role.roleEn,
        roleId: role.roleId,
        name: role.fallbackName,
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
      name: extractedName || role.fallbackName,
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

  const trs = match[0].match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
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
function parseSOPData(xml: string, fileName: string): SOPDocumentData {
  const meta = extractMetadata(xml, fileName, false);
  const equipmentList = parseCIEquipment(xml);
  const prerequisites = parsePrerequisites(xml);
  const workSteps = parseSOPWorkSteps(xml);
  const approvals = parseApprovals(xml);
  const ehsRequirements = parseSOPEHSRequirements(xml);

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
  const affectedSystems = [...DEFAULT_AFFECTED_SYSTEMS];
  let affectedSystemsDetails =
    '1. Standby Generator will be running if the source in the MV panel shut down .\n1. Generator Cadangan akan beroperasi jika sumber pada panel MV padam/dimatikan.';
  const impactMatch = xml.match(
    /if any of the item above is checked[\s\S]*?:\s*([\s\S]*?)(?:Section\s*5|Seksi\s*5)/i
  );
  if (impactMatch && impactMatch[1]) {
    const rawDetails = cleanText(impactMatch[1]);
    if (rawDetails.length > 5) {
      affectedSystemsDetails = rawDetails;
    }
  }

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
    executedByName: executedMatch && executedMatch[1] ? executedMatch[1].trim() : 'DME Maintenance Team',
    executedByJobTitle: 'Teknisi Data Center',
    affectedSystems,
    affectedSystemsDetails,
    referencedDocuments: parseReferencedDocuments(xml),
    ehsRequirements,
    prerequisites,
    dryRun: {
      jobTitle: 'Teknisi Data Center',
      name: '',
      date: '',
      signatureBase64: ''
    },
    maintenancePeriod,
    conditionsPriorToExecutionEn: '',
    conditionsPriorToExecutionId: '',
    workSteps,
    backOutProcedure,
    author: meta.author,
    dateOfCreation: meta.creationDate,
    dateRevision: meta.revisionDate,
    revisionNumber: meta.revisionNumber,
    approvals,
    additionalInformation: 'N/A T/A'
  };
}

/**
 * Parsing berkas Word EOP (8 Seksi) secara komprehensif
 */
function parseEOPData(xml: string, fileName: string): EOPDocumentData {
  const meta = extractMetadata(xml, fileName, true);
  const referencedDocuments = parseReferencedDocuments(xml);
  const ehsRequirements = parseEOPEHSRequirements(xml);
  const expectedCond = parseEOPExpectedConditions(xml);
  const workSteps = parseEOPWorkSteps(xml);
  const approvals = parseApprovals(xml);

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
    nextDateRevision: meta.revisionDate || 'N/A',
    revisionNumber: meta.revisionNumber || '00',
    dryRun: {
      jobTitle: 'Teknisi Data Center',
      name: '',
      date: '',
      signatureBase64: ''
    },
    approvals,
    additionalInformation: 'N/A T/A'
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

  // Deteksi Tipe Dokumen:
  // SOP memiliki 14 seksi dan Informasi Peralatan (Equipment Information).
  // EOP memiliki 8 seksi (Section 8 – Additional Information) dan warna banner FF00FF.
  const isEop =
    (!xml.includes('Section 14') &&
      (xml.includes('FF00FF') || xml.includes('Section 8 – Additional') || /eop/i.test(file.name))) ||
    /emergency\s*operating\s*procedure/i.test(xml);

  if (isEop) {
    const eopData = parseEOPData(xml, file.name);
    return {
      type: 'EOP',
      eopData,
      summary: {
        title: eopData.documentTitle,
        type: 'EOP',
        stepCount: eopData.workSteps.length,
        author: eopData.author,
        sourceFile: file.name
      }
    };
  } else {
    const sopData = parseSOPData(xml, file.name);
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
      }
    };
  }
}
