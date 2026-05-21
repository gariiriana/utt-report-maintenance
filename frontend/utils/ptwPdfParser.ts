import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface PTWExtractedData {
  ptwNumber: string;       // Full PTW number e.g. "TDE/PTW/0393/WLD/01/2026/01/26"
  sequenceNumber: string;  // e.g. "0393"
  equipmentCode: string;   // e.g. "WLD"
  quarter: string;         // e.g. "1"
  startDate: string;       // ISO format "2026-01-19"
  endDate: string;         // ISO format "2026-01-25"
  maintenanceName: string; // e.g. "PM Water Leak Detector"
}

/**
 * Fuzzy Indonesian & English month name helper
 */
function cleanMonthName(raw: string): string {
  const clean = raw.toLowerCase().trim();
  if (clean.startsWith('jan') || clean.startsWith('jam')) return '01';
  if (clean.startsWith('feb')) return '02';
  if (clean.startsWith('mar')) return '03';
  if (clean.startsWith('apr')) return '04';
  if (clean.startsWith('mei') || clean.startsWith('may')) return '05';
  if (clean.startsWith('jun')) return '06';
  if (clean.startsWith('jul')) return '07';
  if (clean.startsWith('agu') || clean.startsWith('aug') || clean.startsWith('agt')) return '08';
  if (clean.startsWith('sep')) return '09';
  if (clean.startsWith('okt') || clean.startsWith('oct')) return '10';
  if (clean.startsWith('nov')) return '11';
  if (clean.startsWith('des') || clean.startsWith('dec')) return '12';
  return '';
}

/**
 * Parse an Indonesian/English date string like "19 Januari 2026" or "19/01/2026" → "2026-01-19"
 */
function parseIndonesianDate(raw: string): string {
  try {
    const cleaned = raw.trim().replace(/\s+/g, ' ');
    // Supports space, slash, or dash separators
    const match = cleaned.match(/(\d{1,2})[\s\/\-]([A-Za-z\d]+)[\s\/\-](\d{4})/);
    if (!match) return '';

    const day = match[1].padStart(2, '0');
    const monthRaw = match[2];
    const year = match[3];

    let month = '';
    if (/^\d+$/.test(monthRaw)) {
      month = monthRaw.padStart(2, '0');
    } else {
      month = cleanMonthName(monthRaw);
    }

    if (!month) return '';
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error('[Date Parser] Error parsing date:', raw, e);
    return '';
  }
}

/**
 * Determine quarter from a date string (ISO format)
 */
function getQuarterFromDate(isoDate: string): string {
  try {
    const month = parseInt(isoDate.split('-')[1]);
    if (month <= 3) return '1';
    if (month <= 6) return '2';
    if (month <= 9) return '3';
    return '4';
  } catch (e) {
    return '1';
  }
}

/**
 * Render a PDF page to canvas for OCR
 */
async function renderPdfPageToCanvas(page: any): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: 2.0 }); 
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get 2d context for canvas');
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  // CRITICAL: Fill canvas with white background before rendering PDF page!
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };
  await page.render(renderContext).promise;
  return canvas;
}

/**
 * Extract all text content from a PDF file using standard text layer extraction
 */
async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Extract text from the first page of PDF using OCR (Tesseract.js)
 */
async function extractTextViaOcr(file: File, onProgress?: (msg: string) => void): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const page = await pdf.getPage(1);
    if (onProgress) onProgress('Rendering halaman PDF...');
    const canvas = await renderPdfPageToCanvas(page);
    
    if (onProgress) onProgress('Menyiapkan engine scanner...');
    const worker = await createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          const pct = Math.round(m.progress * 100);
          onProgress(`Memindai berkas: ${pct}%`);
        }
      }
    });
    
    if (onProgress) onProgress('Memindai teks dokumen...');
    const { data: { text } } = await worker.recognize(canvas);
    
    await worker.terminate();
    return text;
  } catch (ocrError) {
    console.error('[OCR Error] Failed in extractTextViaOcr:', ocrError);
    throw ocrError;
  }
}

/**
 * Parse PTW data from extracted text using robust line-based & regex heuristics
 */
function parsePTWFromText(text: string): Partial<PTWExtractedData> {
  const result: Partial<PTWExtractedData> = {};
  console.log('[PTW Parser] Raw extracted text:\n', text);

  // 1. Extract Document Number (No PTW)
  const lines = text.split('\n');
  let docLine = '';
  for (const line of lines) {
    const cleanLine = line.trim();
    if (
      /document/i.test(cleanLine) || 
      /doc\s*num/i.test(cleanLine) || 
      /doc\s*no/i.test(cleanLine) || 
      /tde\s*[\/\s]*ptw/i.test(cleanLine) ||
      /ide\s*[\/\s]*ptw/i.test(cleanLine)
    ) {
      docLine = cleanLine;
      break;
    }
  }

  console.log('[PTW Parser] Identified document line:', docLine);

  if (docLine) {
    let valuePart = docLine;
    const colonIndex = docLine.indexOf(':');
    const underScoreColonIndex = docLine.indexOf('_:');
    
    if (underScoreColonIndex !== -1) {
      valuePart = docLine.substring(underScoreColonIndex + 2).trim();
    } else if (colonIndex !== -1) {
      valuePart = docLine.substring(colonIndex + 1).trim();
    } else {
      valuePart = docLine.replace(/document\s*number/i, '')
                          .replace(/doc\s*num/i, '')
                          .replace(/doc\s*no/i, '')
                          .trim();
    }

    valuePart = valuePart.split('[')[0].trim();
    valuePart = valuePart.split('(')[0].trim();

    const segments = valuePart.split(/[\s\/\-\\\|]+/).map(s => s.trim()).filter(s => s.length > 0);
    console.log('[PTW Parser] Split segments:', segments);

    if (segments.length > 0) {
      let seqIndex = -1;
      for (let i = 0; i < segments.length; i++) {
        const normalizedSeg = segments[i].replace(/[Oo]/g, '0');
        const seg = normalizedSeg.replace(/\D/g, ''); 
        if (seg.length >= 3 && seg.length <= 4 && !seg.startsWith('202')) {
          result.sequenceNumber = seg;
          seqIndex = i;
          break;
        }
      }

      if (seqIndex !== -1 && seqIndex + 1 < segments.length) {
        const nextSeg = segments[seqIndex + 1].toUpperCase().replace(/[^A-Z]/g, '');
        if (nextSeg.length >= 2 && nextSeg.length <= 5) {
          result.equipmentCode = nextSeg;
        }
      }

      if (result.sequenceNumber) {
        const cleanSegments = segments.map(s => s.replace(/[^A-Za-z0-9]/g, ''));
        const cleanSeqIdx = cleanSegments.findIndex(s => s.replace(/\D/g, '') === result.sequenceNumber);
        if (cleanSeqIdx !== -1) {
          const trailing = cleanSegments.slice(cleanSeqIdx).filter(s => s.length > 0);
          result.ptwNumber = ['TDE', 'PTW', ...trailing].join('/');
        }
      }
    }
  }

  if (!result.sequenceNumber) {
    const fallbackSeqMatch = text.match(/\b(?!202\d)(\d{3,4})\b/);
    if (fallbackSeqMatch) {
      result.sequenceNumber = fallbackSeqMatch[1];
    }
  }

  // 2. Extract Nature / Details of Work (Nama Maintenance)
  const natureRegex = /(?:Nature\s*\/?\s*Details?\s*of\s*Work|Details?\s*of\s*Work|Nature\s+of\s+Work)\s*[:.-]?\s*(.+?)(?:\d+\s*[\.\s-]\s*Location|Location|Details\s+Location|Company|$)/i;
  const natureMatch = text.match(natureRegex);

  if (natureMatch) {
    let name = natureMatch[1].trim();
    name = name.replace(/\s*\d+\.\s*$/, '').replace(/\s*Location.*$/i, '').trim();
    if (name) result.maintenanceName = name;
  }

  // 3. Extract Work Start Date
  const startRegex = /(?:Work\s*Start\s*Date|Start\s*Date)\s*[:.-]?\s*(\d{1,2}[\s\/\-][A-Za-z\d]+[\s\/\-]\d{4})/i;
  const startMatch = text.match(startRegex);
  if (startMatch) {
    result.startDate = parseIndonesianDate(startMatch[1]);
  }

  // 4. Extract Work Completion Date
  const endRegex = /(?:Work\s*Completion\s*Date|Completion\s*Date|End\s*Date)\s*[:.-]?\s*(\d{1,2}[\s\/\-][A-Za-z\d]+[\s\/\-]\d{4})/i;
  const endMatch = text.match(endRegex);
  if (endMatch) {
    result.endDate = parseIndonesianDate(endMatch[1]);
  }

  if (!result.startDate || !result.endDate) {
    const allDates = text.match(/\b\d{1,2}\s+[A-Za-z\d]+\s+\d{4}\b/gi) || [];
    const parsedDates = allDates
      .map(d => parseIndonesianDate(d))
      .filter(d => d !== '');
    
    if (parsedDates.length >= 2) {
      if (!result.startDate) result.startDate = parsedDates[0];
      if (!result.endDate) result.endDate = parsedDates[1];
    } else if (parsedDates.length === 1 && !result.startDate) {
      result.startDate = parsedDates[0];
    }
  }

  if (result.startDate) {
    result.quarter = getQuarterFromDate(result.startDate);
  }

  return result;
}

/**
 * Parse PTW data from PDF filename (instant fallback)
 */
export function parsePTWFromFilename(filename: string): Partial<PTWExtractedData> {
  const result: Partial<PTWExtractedData> = {};
  let cleanName = filename.replace(/\.[^/.]+$/, ""); // Remove extension

  // Normalize en-dashes, em-dashes, and alternative dashes to standard hyphens
  cleanName = cleanName.replace(/[\u2013\u2014\u2212]/g, "-");

  // 1. Try to find equipment code (common codes like WLD, AC, etc.)
  const cleanForEq = cleanName.replace(/\b(PTW|PM|HSE|TDE|PDF)\b/gi, '').trim();
  const eqMatch = cleanForEq.match(/\b(WLD|AC|GATE|GEN|UPS|LVMDP|HVAC|PAC|FIP|WSD|AHU)\b/i)
    || cleanForEq.match(/\b([A-Z]{3,4})\b/);
  if (eqMatch) {
    result.equipmentCode = eqMatch[1].toUpperCase();
  }

  // 2. Try to find date ranges
  const multiMonthMatch = cleanName.match(/(\d{1,2})\s+([A-Za-z]+)\s*[\-\s]+\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  const singleMonthMatch = cleanName.match(/(\d{1,2})\s*[\-\s]+\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);

  let rangeIndex = -1;
  if (multiMonthMatch) {
    const startDay = multiMonthMatch[1];
    const startMonth = multiMonthMatch[2];
    const endDay = multiMonthMatch[3];
    const endMonth = multiMonthMatch[4];
    const year = multiMonthMatch[5];

    result.startDate = parseIndonesianDate(`${startDay} ${startMonth} ${year}`);
    result.endDate = parseIndonesianDate(`${endDay} ${endMonth} ${year}`);
    rangeIndex = multiMonthMatch.index !== undefined ? multiMonthMatch.index : -1;
  } else if (singleMonthMatch) {
    const startDay = singleMonthMatch[1];
    const endDay = singleMonthMatch[2];
    const monthName = singleMonthMatch[3];
    const year = singleMonthMatch[4];

    result.startDate = parseIndonesianDate(`${startDay} ${monthName} ${year}`);
    result.endDate = parseIndonesianDate(`${endDay} ${monthName} ${year}`);
    rangeIndex = singleMonthMatch.index !== undefined ? singleMonthMatch.index : -1;
  }

  // 3. Try to guess sequence number if present in filename
  // Must be 3 or 4 digits and NOT a year starting with 20 (like 2026, 2025)
  const seqMatch = cleanName.match(/\b(?!20\d{2})(\d{3,5})\b/);
  if (seqMatch) {
    result.sequenceNumber = seqMatch[1];
  }

  // 4. Try to guess maintenance name (part before the date range, cleaned from "PTW" prefix)
  let maintenanceName = '';
  if (rangeIndex !== -1) {
    const beforeDate = cleanName.substring(0, rangeIndex).trim();
    maintenanceName = beforeDate.replace(/^\bPTW\b/gi, '').trim();
  } else {
    const pmMatch = cleanName.match(/(PM\s+[A-Z0-9\s\-]+|Maintenance\s+[A-Z0-9\s\-]+)/i);
    if (pmMatch) {
      maintenanceName = pmMatch[1].trim();
    }
  }
  if (maintenanceName) {
    result.maintenanceName = maintenanceName;
  }

  if (result.startDate) {
    result.quarter = getQuarterFromDate(result.startDate);
  }

  return result;
}

/**
 * Main entry: parse a PTW PDF file and return extracted data.
 * Automatically falls back to OCR if standard text extraction yields no results.
 */
export async function parsePTWPdf(
  file: File, 
  onProgress?: (msg: string) => void
): Promise<Partial<PTWExtractedData>> {
  try {
    if (onProgress) onProgress('Membaca berkas PDF...');
    let text = '';
    
    try {
      text = await extractTextFromPdf(file);
    } catch (readError) {
      console.warn('[PTW Parser] Failed standard text read:', readError);
    }
    
    const cleanedText = text.trim();
    console.log('[PTW Parser] Standard text length:', cleanedText.length);

    if (cleanedText.length < 50) {
      console.log('[PTW Parser] Text length too short. Falling back to OCR...');
      if (onProgress) onProgress('PDF hasil scan dideteksi. Memulai OCR...');
      text = await extractTextViaOcr(file, onProgress);
      console.log('[PTW Parser] OCR text length:', text.length);
    }

    const data = parsePTWFromText(text);
    console.log('[PTW Parser] Parsed data from PDF content:', data);
    return data;
  } catch (err) {
    console.error('[PTW Parser] Critical error in parsePTWPdf:', err);
    return {};
  }
}
