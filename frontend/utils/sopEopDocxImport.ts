// ============================================================================
// FILE: frontend/utils/sopEopDocxImport.ts
// Deskripsi: Engine Parser Berkas Microsoft Word (.docx) untuk SOP & EOP.
//            Mengekstrak teks, tabel, metadata, langkah kerja bilingual,
//            dan mengonversinya menjadi objek SOPDocumentData atau EOPDocumentData.
// ============================================================================

import JSZip from 'jszip';
import {
  SOPDocumentData,
  EOPDocumentData,
  SOPCIEquipmentItem,
  SOPWorkStepItem,
  EOPWorkStepItem,
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
 * Membersihkan string XML dan whitespace berlebih
 */
function cleanText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Memisahkan teks langkah kerja dwibahasa (English + Bahasa Indonesia)
 */
function splitBilingualStep(text: string): { en: string; id: string } {
  if (!text) return { en: '', id: '' };
  let clean = cleanText(text);
  // Hapus nomor urut di awal jika ada (misal: "1. ")
  clean = clean.replace(/^\d+\.\s*/, '');

  // Coba pisahkan berdasarkan kalimat pertama bertanda titik yang diikuti kalimat kedua
  const m = clean.match(/^([\s\S]*?\.)\s*(?:\d+\.\s*)?([\s\S]*)$/);
  if (m && m[1] && m[2] && m[2].trim().length > 0) {
    return {
      en: m[1].trim(),
      id: m[2].trim()
    };
  }

  return { en: clean, id: clean };
}

/**
 * Mengekstrak seluruh tabel dari dokumen XML Word
 */
function extractTablesFromXml(xml: string): string[][][] {
  const tblXmls = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  return tblXmls.map((tbl) => {
    const rows = tbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
    return rows.map((r) => {
      const cells = r.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      return cells.map(cleanText);
    });
  });
}

/**
 * Mengekstrak metadata teks dari dokumen XML
 */
function extractMetadata(text: string) {
  const norm = text.replace(/[ \t\r\f\v]+/g, ' ');

  const getMatch = (pattern: RegExp): string => {
    const m = norm.match(pattern);
    return m && m[1] ? m[1].trim() : '';
  };

  const titleMatch = getMatch(/Document\s*Title\s*:\s*(.*?)(?:Judul\s*Dokumen|Document\s*Purpose)/i);
  const purposeEn = getMatch(/Document\s*Purpose\s*:\s*(.*?)(?:Tujuan\s*Dokumen|Work\s*Location)/i);
  const purposeId = getMatch(/Tujuan\s*Dokumen\s*:\s*(.*?)(?:Work\s*Location|Section|Seksi)/i);
  const locationEn = getMatch(/Work\s*Location\s*:\s*(.*?)(?:Lokasi\s*Kerja|Section|Seksi)/i);
  const locationId = getMatch(/Lokasi\s*Kerja\s*:\s*(.*?)(?:Section|Seksi|\n\n)/i);

  const author = getMatch(/Author\s*:\s*(.*?)(?:Date\s*of\s*Creation|Penulis)/i);
  const creationDate = getMatch(/Date\s*of\s*Creation\s*:\s*(.*?)(?:Penulis|Tanggal\s*Pembuatan)/i);
  const revisionNumber = getMatch(/Revision\s*Number\s*:\s*(.*?)(?:Tanggal\s*Revisi|Nomor\s*Revisi|\n)/i);
  const revisionDate = getMatch(/Date\s*Revision\s*:\s*(.*?)(?:Revision\s*Number|Nomor\s*Revisi|\n)/i);

  return {
    title: titleMatch && titleMatch !== '-' ? titleMatch : '',
    purposeEn,
    purposeId,
    locationEn: locationEn || 'Neutra DC Cikarang',
    locationId: locationId || 'Neutra DC Cikarang',
    author: author || 'Alif Darmawan',
    creationDate: creationDate || '07 Sep 2026',
    revisionNumber: revisionNumber && revisionNumber !== 'T/A' ? revisionNumber : '',
    revisionDate: revisionDate && revisionDate !== 'N/A' && revisionDate !== 'T/A' ? revisionDate : ''
  };
}

/**
 * Parsing berkas Word SOP (14 Seksi)
 */
function parseSOPData(xml: string, fileName: string): SOPDocumentData {
  const textWithBreaks = xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tr>/g, '\n').replace(/<[^>]+>/g, ' ');
  const meta = extractMetadata(textWithBreaks);
  const tables = extractTablesFromXml(xml);

  // 1. CI Equipment List (Seksi 2)
  let equipmentList: SOPCIEquipmentItem[] = [];
  const ciTable = tables.find((t) =>
    t.some((row) => row.some((c) => c.includes('CI Name') || c.includes('Nama CI')))
  );

  if (ciTable && ciTable.length > 1) {
    const dataRows = ciTable.slice(1);
    equipmentList = dataRows
      .filter((r) => r.length >= 4 && r.some((c) => c.trim().length > 0))
      .map((r, idx) => ({
        no: parseInt(r[0], 10) || idx + 1,
        classId: r[1] || 'TR',
        ciName: r[2] || `TRAFO ${idx + 1}`,
        ciDescription: r[3] || '',
        capacity: r[4] || '2500 kVA',
        serialNumber: r[5] || '',
        mfd: r[6] || '2021',
        productName: r[7] || 'TRAFINDO',
        model: r[8] || 'Dry Type Cast Resin (Tipe Kering)',
        room: r[9] || `Trafo Room ${idx + 1}`
      }));
  }
  if (equipmentList.length === 0) {
    equipmentList = [...DEFAULT_SOP_DATA.equipmentList];
  }

  // 2. Schedule Info (Seksi 3)
  const scheduleDateMatch = textWithBreaks.match(/SOP\s*Execution\s*Date\s*:\s*(.*?)(?:Reference\s*Ticket|Tanggal\s*Pelaksanaan)/i);
  const ticketMatch = textWithBreaks.match(/Reference\s*Ticket\s*Number\s*:\s*(.*?)(?:Tanggal\s*Pelaksanaan|Executed\s*by)/i);
  const executedMatch = textWithBreaks.match(/Executed\s*by\s*\(Name\)\s*:\s*(.*?)(?:Job\s*title|Dilaksanakan)/i);

  // 3. Affected Systems (Seksi 4)
  const affectedSystems = [...DEFAULT_AFFECTED_SYSTEMS];
  let affectedSystemsDetails = '1. Standby Generator will be running if the source in the MV panel shut down .\n1. Generator Cadangan akan beroperasi jika sumber pada panel MV padam/dimatikan.';

  const impactMatch = textWithBreaks.match(/if any of the item above is checked[\s\S]*?:\s*([\s\S]*?)(?:Section\s*5|Seksi\s*5)/i);
  if (impactMatch && impactMatch[1]) {
    const rawDetails = impactMatch[1].trim();
    if (rawDetails.length > 5) {
      affectedSystemsDetails = rawDetails;
    }
  }

  // 4. Prerequisites (Seksi 7)
  let prerequisites = [...DEFAULT_PREREQUISITES];
  const prereqTable = tables.find((t) =>
    t.some((row) => row.some((c) => c.includes('Check PTW is approved') || c.includes('Periksa bahwa PTW')))
  );

  if (prereqTable && prereqTable.length > 0) {
    prerequisites = prereqTable
      .filter((r) => r.length > 0 && r[0].trim().length > 0)
      .map((r, idx) => {
        const itemText = r[0].trim();
        const split = splitBilingualStep(itemText);
        return {
          no: idx + 1,
          requirementEn: split.en || itemText,
          requirementId: split.id || itemText,
          time: r[1] || '',
          initial: r[2] || ''
        };
      });
  }

  // 5. Work Instructions (Seksi 10)
  let workSteps: SOPWorkStepItem[] = [];
  const stepTable = tables.find((t) =>
    t.some((row) => row.some((c) => c.includes('Action') || c.includes('Tindakan')) &&
                   row.some((c) => c.includes('Expected Outcome') || c.includes('Hasil yang Diharapkan')))
  );

  if (stepTable && stepTable.length > 2) {
    const headerIdx = stepTable.findIndex((r) =>
      r.some((c) => c.includes('Action') || c.includes('Tindakan'))
    );
    const dataRows = stepTable.slice(headerIdx >= 0 ? headerIdx + 1 : 2);

    workSteps = dataRows
      .filter((r) => r.length >= 2 && r.some((c) => c.trim().length > 0))
      .map((r, idx) => {
        const rawAction = r[0] || '';
        const rawOutcome = r[1] || '';
        const splitAction = splitBilingualStep(rawAction);
        const splitOutcome = splitBilingualStep(rawOutcome);

        return {
          no: idx + 1,
          actionEn: splitAction.en || rawAction,
          actionId: splitAction.id || rawAction,
          expectedOutcomeEn: splitOutcome.en || rawOutcome,
          expectedOutcomeId: splitOutcome.id || rawOutcome,
          time: r[2] || '',
          initial: r[3] || ''
        };
      });
  }
  if (workSteps.length === 0) {
    workSteps = [...DEFAULT_SOP_DATA.workSteps];
  }

  // 6. Back Out Procedures (Seksi 11)
  let backOutProcedure = 'N/A T/A';
  const backoutMatch = textWithBreaks.match(/(?:Section\s*11|Seksi\s*11)[\s\S]*?(?:Action|Tindakan)[\s\S]*?\n([^\n]+)/i);
  if (backoutMatch && backoutMatch[1]) {
    const bo = backoutMatch[1].trim();
    if (bo) backOutProcedure = bo;
  }

  // 7. Approvals (Seksi 13)
  const approvals = [...DEFAULT_DEFAULT_APPROVERS];

  // 8. Document Title Fallback
  let docTitle = meta.title;
  if (!docTitle || docTitle === '-') {
    const cleanFileName = fileName.replace(/\.docx$/i, '').replace(/[-_]/g, ' ').toUpperCase();
    docTitle = cleanFileName.includes('SOP') ? cleanFileName : `SOP ${cleanFileName}`;
  }

  return {
    type: 'SOP',
    documentTitle: docTitle,
    documentPurposeEn: meta.purposeEn || DEFAULT_SOP_DATA.documentPurposeEn,
    documentPurposeId: meta.purposeId || DEFAULT_SOP_DATA.documentPurposeId,
    workLocationEn: meta.locationEn,
    workLocationId: meta.locationId,
    equipmentList,
    executionDate: scheduleDateMatch && scheduleDateMatch[1] && scheduleDateMatch[1].trim() !== '-' ? scheduleDateMatch[1].trim() : '',
    referenceTicketNumber: ticketMatch && ticketMatch[1] && ticketMatch[1].trim() !== '-' ? ticketMatch[1].trim() : '',
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
 * Parsing berkas Word EOP (8 Seksi)
 */
function parseEOPData(xml: string, fileName: string): EOPDocumentData {
  const textWithBreaks = xml.replace(/<\/w:p>/g, '\n').replace(/<\/w:tr>/g, '\n').replace(/<[^>]+>/g, ' ');
  const meta = extractMetadata(textWithBreaks);
  const tables = extractTablesFromXml(xml);

  // 1. Work Instruction / Emergency Steps (Seksi 4)
  let workSteps: EOPWorkStepItem[] = [];
  const stepTable = tables.find((t) =>
    t.some((row) => row.some((c) => c.includes('Action') || c.includes('Tindakan')) &&
                   row.some((c) => c.includes('Expected Outcome') || c.includes('Hasil yang Diharapkan')))
  );

  if (stepTable && stepTable.length > 1) {
    const headerIdx = stepTable.findIndex((r) =>
      r.some((c) => c.includes('Action') || c.includes('Tindakan'))
    );
    const dataRows = stepTable.slice(headerIdx >= 0 ? headerIdx + 1 : 1);

    workSteps = dataRows
      .filter((r) => r.length >= 3 && r.some((c) => c.trim().length > 0))
      .map((r, idx) => {
        // Kolom: [No, Action, Expected Outcome, Time, Name]
        const rawAction = r[1] || r[0] || '';
        const rawOutcome = r[2] || r[1] || '';
        const splitAction = splitBilingualStep(rawAction);
        const splitOutcome = splitBilingualStep(rawOutcome);

        return {
          no: idx + 1,
          actionEn: splitAction.en || rawAction,
          actionId: splitAction.id || rawAction,
          expectedOutcomeEn: splitOutcome.en || rawOutcome,
          expectedOutcomeId: splitOutcome.id || rawOutcome,
          time: r[3] || '',
          name: r[4] || ''
        };
      });
  }
  if (workSteps.length === 0) {
    workSteps = [...DEFAULT_EOP_DATA.workSteps];
  }

  // 2. Document Title Fallback
  let docTitle = meta.title;
  if (!docTitle || docTitle === '-') {
    const cleanFileName = fileName.replace(/\.docx$/i, '').replace(/[-_]/g, ' ').toUpperCase();
    docTitle = cleanFileName.includes('EOP') ? cleanFileName : `EOP ${cleanFileName}`;
  }

  return {
    type: 'EOP',
    documentTitle: docTitle,
    documentPurposeEn: meta.purposeEn || DEFAULT_EOP_DATA.documentPurposeEn,
    documentPurposeId: meta.purposeId || DEFAULT_EOP_DATA.documentPurposeId,
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
    revisionNumber: meta.revisionNumber || '01',
    dryRun: { ...DEFAULT_EOP_DATA.dryRun },
    approvals: [...DEFAULT_DEFAULT_APPROVERS],
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
    (!xml.includes('Section 14') && (xml.includes('FF00FF') || xml.includes('Section 8 – Additional') || /eop/i.test(file.name))) ||
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
