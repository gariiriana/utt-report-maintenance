// ============================================================================
// FILE: ptwPdfParser.ts
// Deskripsi: Utility Parser OCR & Ekstraksi Teks Otomatis dari Dokumen PDF Permit to Work (PTW).
//            Menggunakan `pdf.js` untuk ekstraksi teks digital dan `Tesseract.js` OCR engine
//            jika PDF berupa hasil scan/foto fisik.
//            Fungsi-fungsi di dalamnya mem-parse nomor urut PTW, kode perangkat, kuartal,
//            tanggal mulai/selesai, serta jenis maintenance (CM / PM).
// ============================================================================

import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Konfigurasi Web Worker untuk pdf.js agar dapat membaca PDF secara asynchronous di background thread browser
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Interface data hasil ekstraksi parser PTW
export interface PTWExtractedData {
  ptwNumber: string;       // Nomor lengkap PTW, contoh: "TDE/PTW/0393/WLD/01/2026/01/26"
  sequenceNumber: string;  // Nomor urut 4 digit, contoh: "0393"
  equipmentCode: string;   // Kode singkatan perangkat, contoh: "WLD", "UPS", "CRAC"
  quarter: string;         // Kuartal pelaksanaan, contoh: "1" (Q1)
  startDate: string;       // Tanggal mulai format ISO "YYYY-MM-DD", contoh: "2026-01-19"
  endDate: string;         // Tanggal selesai format ISO "YYYY-MM-DD", contoh: "2026-01-25"
  maintenanceName: string; // Deskripsi pemeliharaan, contoh: "PM Water Leak Detector"
  ptwType?: 'CM' | 'PM';   // Tipe izin kerja: 'CM' (Corrective) atau 'PM' (Preventive)
}

/**
 * Helper internal: Normalisasi nama bulan Bahasa Indonesia & Inggris ke format 2 digit (01-12)
 * Junior Dev Notes: Menggunakan string matching dengan `.startsWith()` untuk mengantisipasi
 * variasi ejaan typo hasil OCR (misal: "Jan", "Jam", "Agt", "Agu", "Des", "Dec").
 */
function cleanMonthName(raw: string): string {
  // Ubah ke huruf kecil dan bersihkan spasi di pinggir
  const clean = raw.toLowerCase().trim();
  
  // Evaluasi awalan kata bulan
  if (clean.startsWith('jan') || clean.startsWith('jam')) return '01'; // Januari / January
  if (clean.startsWith('feb')) return '02'; // Februari / February
  if (clean.startsWith('mar')) return '03'; // Maret / March
  if (clean.startsWith('apr')) return '04'; // April
  if (clean.startsWith('mei') || clean.startsWith('may')) return '05'; // Mei / May
  if (clean.startsWith('jun')) return '06'; // Juni / June
  if (clean.startsWith('jul')) return '07'; // Juli / July
  if (clean.startsWith('agu') || clean.startsWith('aug') || clean.startsWith('agt')) return '08'; // Agustus / August
  if (clean.startsWith('sep')) return '09'; // September
  if (clean.startsWith('okt') || clean.startsWith('oct')) return '10'; // Oktober / October
  if (clean.startsWith('nov')) return '11'; // November
  if (clean.startsWith('des') || clean.startsWith('dec')) return '12'; // Desember / December

  return ''; // Kembalikan string kosong jika bulan tidak teridentifikasi
}

/**
 * Helper internal: Mengubah string tanggal Bahasa Indonesia/Inggris (misal: "19 Januari 2026" atau "19/01/2026")
 * menjadi format tanggal baku ISO "YYYY-MM-DD" ("2026-01-19").
 */
function parseIndonesianDate(raw: string): string {
  try {
    // 1. Bersihkan spasi ganda
    const cleaned = raw.trim().replace(/\s+/g, ' ');

    // 2. Gunakan Regular Expression (Regex) untuk mengekstrak Tanggal (1-2 digit), Bulan (Teks/Angka), dan Tahun (4 digit)
    const match = cleaned.match(/(\d{1,2})[\s\/\-]([A-Za-z\d]+)[\s\/\-](\d{4})/);
    if (!match) return '';

    // 3. Ambil substring tanggal, bulan, dan tahun dari hasil regex
    const day = match[1].padStart(2, '0'); // Pastikan 2 digit (misal: "5" -> "05")
    const monthRaw = match[2];
    const year = match[3];

    // 4. Konversi nama/angka bulan ke format 2 digit
    let month = '';
    if (/^\d+$/.test(monthRaw)) {
      month = monthRaw.padStart(2, '0'); // Jika bulan berupa angka murni
    } else {
      month = cleanMonthName(monthRaw);  // Jika bulan berupa nama kata
    }

    // 5. Gabungkan menjadi format ISO "YYYY-MM-DD"
    if (month && day && year) {
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    console.error('Error parsing Indonesian date:', e);
  }
  return '';
}

/**
 * Helper internal: Mengekstrak metadata dari string Nomor PTW Baku
 * Contoh input: "TDE/PTW/0393/WLD/01/2026/01/26"
 * Output: { sequenceNumber: "0393", equipmentCode: "WLD", quarter: "1", startDate: "2026-01-19", endDate: "2026-01-25" }
 */
export function parsePTWFromNumber(ptwNum: string): Partial<PTWExtractedData> | null {
  if (!ptwNum) return null;

  // Pattern regex standar penomoran PTW UTT/NeutraDC: TDE/PTW/{SEQ}/{EQ_CODE}/{Q}/{YEAR}/...
  const pattern = /TDE\/PTW\/(\d{3,4})\/([A-Z0-9_\-]+)\/(\d{1,2})\/(\d{4})/i;
  const match = ptwNum.match(pattern);

  if (match) {
    const seq = match[1].padStart(4, '0'); // Pad 4 digit nomor urut
    const eqCode = match[2].toUpperCase();
    const quarter = String(parseInt(match[3], 10)); // Convert "01" -> "1"
    const year = match[4];

    return {
      ptwNumber: ptwNum,
      sequenceNumber: seq,
      equipmentCode: eqCode,
      quarter: quarter,
      startDate: `${year}-01-01`, // Fallback tanggal awal tahun jika tanggal presisi tidak ada
      endDate: `${year}-12-31`,
    };
  }

  return null;
}

/**
 * Helper internal: Parse metadata PTW langsung dari Nama File (Filename Parsing)
 * Mendukung berbagai format penamaan berkas PTW seperti:
 * - "PTW CM UPS(MovementBattery) 10 Agustus 2026 0652.pdf"
 * - "PTW PM Trafo 15 Januari 2026 0393.pdf"
 * - "TDE_PTW_0393_WLD_Q1_2026.pdf"
 * - "PTW 0393 WLD.pdf"
 * - "PTW CM FCU 05 Mei 2026 0412.pdf"
 * - "PTW PM CRAC Q3 2026 0520.pdf"
 * - "PTW CM ATS 2026-08-10 0652.pdf"
 */
export function parsePTWFromFilename(filename: string): Partial<PTWExtractedData> | null {
  if (!filename) return null;

  // Bersihkan ekstensi file .pdf dan spasi berlebih
  const cleanName = filename.replace(/\.pdf$/i, '').trim();
  const result: Partial<PTWExtractedData> = {};

  // ─── 1. Deteksi Jenis PTW: CM (Corrective) vs PM (Preventive) ───────────────
  if (/\b(?:CM|CORRECTIVE|KOREKTIF)\b/i.test(cleanName)) {
    result.ptwType = 'CM';
  } else if (/\b(?:PM|PREVENTIVE|PREVENTIF)\b/i.test(cleanName)) {
    result.ptwType = 'PM';
  }

  // ─── 2. Deteksi Tanggal & Bulan (Bahasa Indonesia & Inggris / ISO / Numeric) ──
  let detectedMonth = 0;
  let detectedYear = '';
  let detectedDateStr = '';

  // Pola A: Tanggal dengan nama bulan (misal: "10 Agustus 2026", "10 Agt 2026", "10 August 2026")
  const dateNamedMatch = cleanName.match(/(\d{1,2})[\s\-_/]+([A-Za-z]+)[\s\-_/]+(20\d{2})/i);
  if (dateNamedMatch) {
    const day = dateNamedMatch[1].padStart(2, '0');
    const monthRaw = dateNamedMatch[2];
    const year = dateNamedMatch[3];
    const monthDigit = cleanMonthName(monthRaw);
    if (monthDigit) {
      detectedMonth = parseInt(monthDigit, 10);
      detectedYear = year;
      detectedDateStr = `${year}-${monthDigit}-${day}`;
    }
  }

  // Pola B: Format ISO "2026-08-10" atau "2026_08_10"
  if (!detectedDateStr) {
    const isoMatch = cleanName.match(/(20\d{2})[\-_/](\d{1,2})[\-_/](\d{1,2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      detectedMonth = parseInt(month, 10);
      detectedYear = year;
      detectedDateStr = `${year}-${month}-${day}`;
    }
  }

  // Pola C: Format DD-MM-YYYY "10-08-2026" atau "10/08/2026"
  if (!detectedDateStr) {
    const numDateMatch = cleanName.match(/(\d{1,2})[\-_/](\d{1,2})[\-_/](20\d{2})/);
    if (numDateMatch) {
      const day = numDateMatch[1].padStart(2, '0');
      const month = numDateMatch[2].padStart(2, '0');
      const year = numDateMatch[3];
      detectedMonth = parseInt(month, 10);
      detectedYear = year;
      detectedDateStr = `${year}-${month}-${day}`;
    }
  }

  // Pola D: Hanya Bulan dan Tahun tanpa tanggal (misal: "Agustus 2026" atau "August 2026")
  if (!detectedDateStr && !detectedMonth) {
    const monthYearMatch = cleanName.match(/([A-Za-z]+)[\s\-_/]+(20\d{2})/i);
    if (monthYearMatch) {
      const monthDigit = cleanMonthName(monthYearMatch[1]);
      if (monthDigit) {
        detectedMonth = parseInt(monthDigit, 10);
        detectedYear = monthYearMatch[2];
        detectedDateStr = `${detectedYear}-${monthDigit}-01`;
      }
    }
  }

  if (detectedDateStr) {
    result.startDate = detectedDateStr;
    result.endDate = detectedDateStr;
  }

  // ─── 3. Deteksi Quarter (Kuartal) ───────────────────────────────────────────
  // Cara A: Deteksi eksplisit Q1, Q2, Q3, Q4, Quarter 1-4, Kuartal 1-4
  const explicitQMatch = cleanName.match(/\b(?:Q|QUARTER|KUARTAL|TRIWULAN)[\s\-_]*([1-4])\b/i);
  if (explicitQMatch) {
    result.quarter = explicitQMatch[1];
  } else if (detectedMonth >= 1 && detectedMonth <= 12) {
    // Cara B: Otomatis hitung Quarter dari Bulan (Agustus -> Bulan 8 -> Q3!)
    // Bulan 1,2,3 -> Q1 ("1") | Bulan 4,5,6 -> Q2 ("2") | Bulan 7,8,9 -> Q3 ("3") | Bulan 10,11,12 -> Q4 ("4")
    result.quarter = String(Math.ceil(detectedMonth / 3));
  }

  // ─── 4. Deteksi Nomor Urut (Sequence Number - 3 atau 4 digit) ─────────────────
  // PENTING: Tahun 4-digit (misal: 2024, 2025, 2026) BUKAN nomor urut!
  let seqNum = '';

  // Pola A: Nomor 3-4 digit di ujung akhir nama file (misal: "... 2026 0652" -> "0652")
  const endSeqMatch = cleanName.match(/[\s\-_](\d{3,4})$/);
  if (endSeqMatch && endSeqMatch[1] !== detectedYear) {
    seqNum = endSeqMatch[1].padStart(4, '0');
  }

  // Pola B: Format TDE/PTW/{SEQ} atau PTW_{SEQ} atau PTW {SEQ} di awal nama file
  if (!seqNum) {
    const startSeqMatch = cleanName.match(/(?:TDE[_\s\-]*)?PTW[_\s\-]+(?:[CP]M[_\s\-]+)?(\d{3,4})\b/i);
    if (startSeqMatch && startSeqMatch[1] !== detectedYear) {
      seqNum = startSeqMatch[1].padStart(4, '0');
    }
  }

  // Pola C: Cari seluruh angka 3-4 digit di nama file, seleksi yang bukan tahun
  if (!seqNum) {
    const allDigits = cleanName.match(/\b\d{3,4}\b/g);
    if (allDigits) {
      const candidates = allDigits.filter(d => {
        const val = parseInt(d, 10);
        // Abaikan tahun yang terdeteksi atau angka tahun umum (2020-2035) jika ada angka lain
        if (d === detectedYear || (val >= 2020 && val <= 2035 && allDigits.length > 1)) {
          return false;
        }
        return true;
      });
      if (candidates.length > 0) {
        // Prioritaskan yang memiliki leading zero (misal: "0652", "0393") atau kandidat terakhir
        const withZero = candidates.find(c => c.startsWith('0'));
        seqNum = (withZero || candidates[candidates.length - 1]).padStart(4, '0');
      }
    }
  }

  if (seqNum) {
    result.sequenceNumber = seqNum;
  }

  // ─── 5. Deteksi Kode Equipment (Perangkat) ──────────────────────────────────
  const KNOWN_EQUIPMENTS = [
    'UPS', 'ATS', 'FCU', 'CT', 'PDU', 'PJU', 'GENERATOR', 'GENSET',
    'AC SPLIT', 'AC', 'TRAFO', 'TRANSFORMATOR', 'PUMP', 'POMPA',
    'MV', 'LPS', 'GROUNDING', 'LDB/RDB', 'LDB', 'RDB', 'BUSDUCT',
    'LIGHTING', 'CRAC', 'PAC', 'WLD', 'FLD', 'ROLLING DOOR',
    'EXHAUST FAN', 'LV PANEL', 'VRV', 'AHU', 'AHHU', 'CHILLER',
    'BATTERY', 'FIRE ALARM', 'VESDA', 'CCTV', 'ACCESS CONTROL'
  ];

  let detectedEq = '';
  const upperClean = cleanName.toUpperCase();

  for (const eq of KNOWN_EQUIPMENTS) {
    const escaped = eq.replace('/', '\\/');
    const eqRegex = new RegExp(`(?:^|[\\s\\-_/(])${escaped}(?:[\\s\\-_/)]|$)`, 'i');
    if (eqRegex.test(upperClean)) {
      detectedEq = eq === 'GENSET' ? 'GENERATOR' : eq === 'TRANSFORMATOR' ? 'TRAFO' : eq === 'POMPA' ? 'PUMP' : eq;
      break;
    }
  }

  // Fallback: Ambil kata pertama setelah PTW [CM/PM]? jika belum cocok
  if (!detectedEq) {
    const fallbackEqMatch = cleanName.match(/(?:PTW[_\s\-]+)(?:(?:CM|PM)[_\s\-]+)?([A-Za-z0-9]+)/i);
    if (fallbackEqMatch && !/^\d+$/.test(fallbackEqMatch[1])) {
      detectedEq = fallbackEqMatch[1].toUpperCase();
    }
  }

  if (detectedEq) {
    result.equipmentCode = detectedEq;
  }

  // ─── 6. Ekstrak Deskripsi Tambahan / Nama Maintenance ───────────────────────
  const descMatch = cleanName.match(/\(([^)]+)\)/);
  const extraDesc = descMatch ? descMatch[1].trim() : '';

  if (result.equipmentCode || extraDesc) {
    const typePrefix = result.ptwType ? `${result.ptwType} ` : '';
    const eqPart = result.equipmentCode || '';
    const descPart = extraDesc ? ` (${extraDesc})` : '';
    result.maintenanceName = `${typePrefix}${eqPart}${descPart}`.trim();
  }

  // Kembalikan objek jika berhasil mengekstrak minimal satu field utama
  if (result.sequenceNumber || result.equipmentCode || result.quarter || result.startDate || result.ptwType) {
    return result;
  }

  return null;
}

/**
 * Fungsi Utama 1: Parse Berkas PDF PTW Menggunakan `pdf.js` Text Layer Extraction
 * @param arrayBuffer Buffer binary file PDF
 * @returns Promise<PTWExtractedData | null> Data hasil ekstraksi otomatis
 */
export async function parsePTWPdf(
  input: ArrayBuffer | File,
  onStatus?: (msg: string) => void
): Promise<PTWExtractedData | null> {
  try {
    if (onStatus) onStatus('Membaca berkas PDF...');
    const buffer = input instanceof ArrayBuffer 
      ? input 
      : await (input as File).arrayBuffer();

    // 1. Load dokumen PDF dari memory buffer menggunakan pdf.js engine
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdfDoc = await loadingTask.promise;

    let fullText = '';
    if (onStatus) onStatus('Ekstraksi lapisan teks PDF...');

    // 2. Looping membaca seluruh teks dari setiap halaman PDF (Text Content Items)
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Gabungkan potongan teks per baris dengan spasi
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      fullText += pageText + '\n';
    }

    // 3. Jika teks berhasil diekstrak (bukan PDF foto/scan murni), lakukan ekstraksi Regex
    if (fullText.trim().length > 20) {
      const result = extractPTWDataFromText(fullText);
      if (result) return result;
    }

    // 4. Jika PDF berbentuk foto scan (teks digital kosong), panggil OCR Fallback Tesseract.js
    console.log('Text extraction produced empty/short text. Falling back to OCR...');
    if (onStatus) onStatus('Menjalankan pemindaian OCR...');
    return await parsePTWPdfWithOCR(pdfDoc);

  } catch (err) {
    console.error('Error parsing PTW PDF with pdf.js:', err);
    return null;
  }
}

/**
 * Fungsi Utama 2: OCR Fallback Menggunakan Tesseract.js Engine untuk Scan Fisik PDF
 * @param pdfDoc Instance pdf.js PDFDocumentProxy
 */
async function parsePTWPdfWithOCR(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<PTWExtractedData | null> {
  try {
    // 1. Inisialisasi Tesseract Worker untuk bahasa Inggris & Indonesia
    const worker = await createWorker('ind+eng');

    let fullText = '';

    // 2. Render halaman 1 PDF ke HTML5 Canvas untuk diambil gambarnya
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // Scale 2x agar resolusi OCR tinggi & akurat

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (context) {
      await page.render({ canvasContext: context, viewport, canvas: canvas } as any).promise;
      const imageUrl = canvas.toDataURL('image/png');

      // 3. Jalankan OCR Tesseract pada gambar canvas
      const { data: { text } } = await worker.recognize(imageUrl);
      fullText = text;
    }

    // 4. Hentikan worker Tesseract untuk menghemat RAM
    await worker.terminate();

    // 5. Ekstrak data dari hasil pembacaan OCR
    return extractPTWDataFromText(fullText);

  } catch (err) {
    console.error('Error running OCR on PTW PDF:', err);
    return null;
  }
}

/**
 * Helper internal: Mengekstrak metadata dari string teks gabungan hasil PDF/OCR
 */
function extractPTWDataFromText(text: string): PTWExtractedData | null {
  // 1. Cari Nomor PTW dengan Regex baku
  const ptwMatch = text.match(/TDE\/PTW\/(\d{3,4})\/([A-Z0-9_\-]+)\/(\d{1,2})\/(\d{4})(?:\/\d{2}\/\d{2})?/i);
  const ptwNumber = ptwMatch ? ptwMatch[0].toUpperCase() : '';

  // 2. Parse komponen dari Nomor PTW jika ditemukan
  let seqNum = '';
  let eqCode = '';
  let quarter = '';

  if (ptwMatch) {
    seqNum = ptwMatch[1].padStart(4, '0');
    eqCode = ptwMatch[2].toUpperCase();
    if (ptwMatch[3]) quarter = String(parseInt(ptwMatch[3], 10) || 1);
  }

  // 3. Cari Tanggal Pelaksanaan dari Teks PDF
  let startDate = '';
  let endDate = '';

  const dateRangeMatch = text.match(/(\d{1,2}[\s\/\-][A-Za-z\d]+[\s\/\-]\d{4})\s*(?:s\/d|to|\-)\s*(\d{1,2}[\s\/\-][A-Za-z\d]+[\s\/\-]\d{4})/i);
  if (dateRangeMatch) {
    startDate = parseIndonesianDate(dateRangeMatch[1]);
    endDate = parseIndonesianDate(dateRangeMatch[2]);
  } else {
    // Single date search
    const singleDateMatch = text.match(/(\d{1,2}[\s\/\-][A-Za-z\d]+[\s\/\-]\d{4})/i);
    if (singleDateMatch) {
      startDate = parseIndonesianDate(singleDateMatch[1]);
      endDate = startDate;
    }
  }

  // Jika Quarter belum ditemukan dari nomor PTW, hitung dari tanggal pelaksanaan
  if (!quarter && startDate) {
    const month = parseInt(startDate.split('-')[1], 10);
    if (month >= 1 && month <= 12) {
      quarter = String(Math.ceil(month / 3));
    }
  }

  // Jika Quarter masih kosong, cari pola Q1-Q4 di teks
  if (!quarter) {
    const qTextMatch = text.match(/\b(?:Q|QUARTER|KUARTAL)[\s\-_]*([1-4])\b/i);
    if (qTextMatch) {
      quarter = qTextMatch[1];
    } else {
      quarter = '1'; // Fallback default
    }
  }

  // 4. Tentukan Jenis Izin Kerja (CM / PM)
  let ptwType: 'CM' | 'PM' = 'PM';
  if (text.toLowerCase().includes('corrective') || /\bcm\b/i.test(text)) {
    ptwType = 'CM';
  }

  // Kembalikan objek data hasil ekstraksi jika nomor PTW atau nomor urut berhasil didapatkan
  if (ptwNumber || seqNum) {
    return {
      ptwNumber: ptwNumber || `TDE/PTW/${seqNum}/${eqCode || 'GEN'}/${quarter.padStart(2, '0')}/2026`,
      sequenceNumber: seqNum || '0000',
      equipmentCode: eqCode || 'GENERIC',
      quarter: quarter || '1',
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || new Date().toISOString().split('T')[0],
      maintenanceName: ptwType === 'CM' ? 'Corrective Maintenance' : 'Preventive Maintenance',
      ptwType: ptwType,
    };
  }

  return null;
}

