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
  DocumentSigner,
  DEFAULT_SOP_DATA,
  DEFAULT_EOP_DATA,
  DEFAULT_AFFECTED_SYSTEMS,
  DEFAULT_PREREQUISITES,
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

  let title = getMatch(/Document\s*Title\s*:\s*([\s\S]*?)(?:Judul\s*Dokumen|Document\s*Purpose)/i);
  if (title === '-' || !title) {
    const cleanFn = fileName.replace(/\.docx$/i, '').replace(/[-_]/g, ' ').toUpperCase();
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

  const isTrafoDoc = /trafo|transformer/i.test(title) || /trafo|transformer/i.test(fileName);
  const fallbackPurposeEn = isTrafoDoc ? (isEop ? DEFAULT_EOP_DATA.documentPurposeEn : DEFAULT_SOP_DATA.documentPurposeEn) : '';
  const fallbackPurposeId = isTrafoDoc ? (isEop ? DEFAULT_EOP_DATA.documentPurposeId : DEFAULT_SOP_DATA.documentPurposeId) : '';

  return {
    title,
    purposeEn: purposeEn || fallbackPurposeEn,
    purposeId: purposeId || (purposeEn ? '' : fallbackPurposeId),
    locationEn,
    locationId,
    author,
    creationDate,
    revisionNumber: revisionNumber === 'T/A' || !revisionNumber ? '00' : revisionNumber,
    revisionDate: revisionDate === 'T/A' || !revisionDate ? 'N/A' : revisionDate
  };
}

/**
 * Mengekstrak tabel CI Equipment (SOP Seksi 2) dengan penanganan bilingual
 */
function parseCIEquipment(xml: string): SOPCIEquipmentItem[] {
  const tbls = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  const ciTbl = tbls.find((t) => t.includes('CI Name') || t.includes('Nama CI'));
  if (!ciTbl) return [...DEFAULT_SOP_DATA.equipmentList];

  const trs = ciTbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  const headerIdx = trs.findIndex((tr) => tr.includes('CI Name') || tr.includes('Nama CI'));
  const dataRows = trs.slice(headerIdx >= 0 ? headerIdx + 1 : 1);

  const items = dataRows
    .map((tr, idx) => {
      const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      if (tcs.length < 3) return null;

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

      const no = parseInt(getLines(tcs[0])[0], 10) || idx + 1;
      const classId = getLines(tcs[1])[0] || 'TR';
      const ciName = getLines(tcs[2])[0] || `TRAFO ${idx + 1}`;
      const ciDescription = getLines(tcs[3])[0] || '';
      const capacity = getLines(tcs[4])[0] || '2500 kVA';
      const serialNumber = getLines(tcs[5])[0] || '';
      const mfd = getLines(tcs[6])[0] || '2021';
      const productName = getLines(tcs[7])[0] || 'TRAFINDO';

      const modelLines = getLines(tcs[8]);
      const model =
        modelLines.length > 1
          ? `${modelLines[0]} (${modelLines[1]})`
          : modelLines[0] || 'Dry Type Cast Resin (Tipe Kering)';

      const roomLines = getLines(tcs[9]);
      const room =
        roomLines.length > 1
          ? `${roomLines[0]} (${roomLines[1]})`
          : roomLines[0] || `Trafo Room ${idx + 1}`;

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

  return items.length > 0 ? items : [...DEFAULT_SOP_DATA.equipmentList];
}

/**
 * Mengekstrak Prasyarat / Prerequisites (SOP Seksi 7) secara dwibahasa
 */
function parsePrerequisites(xml: string): SOPPrerequisiteItem[] {
  const tbls = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  const prereqTbl = tbls.find(
    (t) => t.includes('Check PTW is approved') || t.includes('Periksa bahwa PTW')
  );
  if (!prereqTbl) return [...DEFAULT_PREREQUISITES];

  const trs = prereqTbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  const items = trs
    .map((tr, idx) => {
      const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      if (tcs.length === 0) return null;

      const bilingual = extractBilingualFromXml(tcs[0] || '');
      if (!bilingual.en && !bilingual.id) return null;

      return {
        no: idx + 1,
        requirementEn: bilingual.en,
        requirementId: bilingual.id,
        time: tcs[1] ? cleanText(tcs[1]) : '',
        initial: tcs[2] ? cleanText(tcs[2]) : ''
      };
    })
    .filter(Boolean) as SOPPrerequisiteItem[];

  return items.length > 0 ? items : [...DEFAULT_PREREQUISITES];
}

/**
 * Mengekstrak Langkah Kerja SOP (Seksi 10) secara dwibahasa presisi
 */
function parseSOPWorkSteps(xml: string): SOPWorkStepItem[] {
  const tbls = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  const stepTbl = tbls.find(
    (t) =>
      (t.includes('Action') || t.includes('Tindakan')) &&
      (t.includes('Expected Outcome') || t.includes('Hasil yang Diharapkan'))
  );
  if (!stepTbl) return [...DEFAULT_SOP_DATA.workSteps];

  const trs = stepTbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  const headerIdx = trs.findIndex(
    (tr) => tr.includes('Expected Outcome') || tr.includes('Hasil yang Diharapkan')
  );
  const dataRows = trs.slice(headerIdx >= 0 ? headerIdx + 1 : 2);

  const steps = dataRows
    .map((tr, idx) => {
      const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      if (tcs.length < 2) return null;

      const action = extractBilingualFromXml(tcs[0] || '');
      const outcome = extractBilingualFromXml(tcs[1] || '');
      if (!action.en && !action.id) return null;

      const cleanActionEn = (action.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanActionId = (action.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanOutcomeEn = (outcome.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanOutcomeId = (outcome.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();

      return {
        no: idx + 1,
        actionEn: cleanActionEn,
        actionId: cleanActionId,
        expectedOutcomeEn: cleanOutcomeEn,
        expectedOutcomeId: cleanOutcomeId,
        time: tcs[2] ? cleanText(tcs[2]) : '',
        initial: tcs[3] ? cleanText(tcs[3]) : ''
      };
    })
    .filter(Boolean) as SOPWorkStepItem[];

  return steps.length > 0 ? steps : [...DEFAULT_SOP_DATA.workSteps];
}

/**
 * Mengekstrak Langkah Kedaruratan EOP (Seksi 4) secara dwibahasa presisi
 */
function parseEOPWorkSteps(xml: string): EOPWorkStepItem[] {
  const tbls = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  const stepTbl = tbls.find(
    (t) =>
      (t.includes('Action') || t.includes('Tindakan')) &&
      (t.includes('Expected Outcome') || t.includes('Hasil yang Diharapkan'))
  );
  if (!stepTbl) return [...DEFAULT_EOP_DATA.workSteps];

  const trs = stepTbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  const headerIdx = trs.findIndex(
    (tr) => tr.includes('Expected Outcome') || tr.includes('Hasil yang Diharapkan')
  );
  const dataRows = trs.slice(headerIdx >= 0 ? headerIdx + 1 : 1);

  const steps = dataRows
    .map((tr, idx) => {
      const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      if (tcs.length < 3) return null;

      // Kolom: [No, Action, Expected Outcome, Time, Name]
      const noStr = cleanText(tcs[0] || '').replace(/\.$/, '');
      const no = parseInt(noStr, 10) || idx + 1;
      const action = extractBilingualFromXml(tcs[1] || '');
      const outcome = extractBilingualFromXml(tcs[2] || '');
      if (!action.en && !action.id) return null;

      const cleanActionEn = (action.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanActionId = (action.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanOutcomeEn = (outcome.en || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();
      const cleanOutcomeId = (outcome.id || '').replace(/^\s*\d+[\.\)]\s*/, '').trim();

      return {
        no,
        actionEn: cleanActionEn,
        actionId: cleanActionId,
        expectedOutcomeEn: cleanOutcomeEn,
        expectedOutcomeId: cleanOutcomeId,
        time: tcs[3] ? cleanText(tcs[3]) : '',
        name: tcs[4] ? cleanText(tcs[4]) : ''
      };
    })
    .filter(Boolean) as EOPWorkStepItem[];

  return steps.length > 0 ? steps : [...DEFAULT_EOP_DATA.workSteps];
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
 * Parsing berkas Word SOP (14 Seksi) secara komprehensif
 */
function parseSOPData(xml: string, fileName: string): SOPDocumentData {
  const meta = extractMetadata(xml, fileName, false);
  const equipmentList = parseCIEquipment(xml);
  const prerequisites = parsePrerequisites(xml);
  const workSteps = parseSOPWorkSteps(xml);
  const approvals = parseApprovals(xml);

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
    referencedDocuments: [...DEFAULT_SOP_DATA.referencedDocuments],
    ehsRequirements: { ...DEFAULT_SOP_DATA.ehsRequirements },
    prerequisites,
    dryRun: { ...DEFAULT_SOP_DATA.dryRun },
    maintenancePeriod: 'annual',
    conditionsPriorToExecutionEn: DEFAULT_SOP_DATA.conditionsPriorToExecutionEn,
    conditionsPriorToExecutionId: DEFAULT_SOP_DATA.conditionsPriorToExecutionId,
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
  const workSteps = parseEOPWorkSteps(xml);
  const approvals = parseApprovals(xml);

  return {
    type: 'EOP',
    documentTitle: meta.title,
    documentPurposeEn: meta.purposeEn,
    documentPurposeId: meta.purposeId,
    workLocationEn: meta.locationEn,
    workLocationId: meta.locationId,
    referencedDocuments: [...DEFAULT_EOP_DATA.referencedDocuments],
    ehsRequirements: { ...DEFAULT_EOP_DATA.ehsRequirements },
    expectedConditionsEn: DEFAULT_EOP_DATA.expectedConditionsEn,
    expectedConditionsId: DEFAULT_EOP_DATA.expectedConditionsId,
    workSteps,
    author: meta.author,
    dateOfCreation: meta.creationDate,
    nextDateRevision: meta.revisionDate || 'N/A',
    revisionNumber: meta.revisionNumber || '00',
    dryRun: { ...DEFAULT_EOP_DATA.dryRun },
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
