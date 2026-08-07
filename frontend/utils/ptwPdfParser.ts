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
 * Helper internal: Parse metadata PTW langsung dari Nama File (Filename Parsing Fallback)
 * Contoh input nama file: "TDE_PTW_0393_WLD_Q1_2026.pdf" atau "PTW 0393 WLD.pdf"
 */
export function parsePTWFromFilename(filename: string): Partial<PTWExtractedData> | null {
  if (!filename) return null;

  // Bersihkan ekstensi file .pdf
  const cleanName = filename.replace(/\.pdf$/i, '').trim();

  // 1. Coba pencocokan Regex dengan nomor urut 4 digit dan kode perangkat
  const matchSeq = cleanName.match(/(?:ptw[_\s\-]*)?(\d{3,4})[_\s\-]+([a-z0-9_\-]+)/i);
  if (matchSeq) {
    const seq = matchSeq[1].padStart(4, '0');
    const eqCode = matchSeq[2].toUpperCase().split(/[_\-\s]/)[0]; // Ambil kode kata pertama
    return {
      sequenceNumber: seq,
      equipmentCode: eqCode,
    };
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
  const ptwMatch = text.match(/TDE\/PTW\/\d{3,4}\/[A-Z0-9_\-]+\/\d{1,2}\/\d{4}(?:\/\d{2}\/\d{2})?/i);
  const ptwNumber = ptwMatch ? ptwMatch[0].toUpperCase() : '';

  // 2. Parse komponen dari Nomor PTW jika ditemukan
  let seqNum = '';
  let eqCode = '';
  let quarter = '1';

  if (ptwNumber) {
    const parts = ptwNumber.split('/');
    if (parts.length >= 4) {
      seqNum = parts[2].padStart(4, '0');
      eqCode = parts[3].toUpperCase();
      if (parts[4]) quarter = String(parseInt(parts[4], 10) || 1);
    }
  }

  // 3. Cari Tanggal Pelaksanaan dari Teks PDF
  let startDate = '';
  let endDate = '';

  const dateRangeMatch = text.match(/(\d{1,2}[\s\/\-][A-Za-z\d]+[\s\/\-]\d{4})\s*(?:s\/d|to|\-)\s*(\d{1,2}[\s\/\-][A-Za-z\d]+[\s\/\-]\d{4})/i);
  if (dateRangeMatch) {
    startDate = parseIndonesianDate(dateRangeMatch[1]);
    endDate = parseIndonesianDate(dateRangeMatch[2]);
  }

  // 4. Tentukan Jenis Izin Kerja (CM / PM)
  let ptwType: 'CM' | 'PM' = 'PM';
  if (text.toLowerCase().includes('corrective') || text.toLowerCase().includes('cm')) {
    ptwType = 'CM';
  }

  // Kembalikan objek data hasil ekstraksi jika nomor PTW atau nomor urut berhasil didapatkan
  if (ptwNumber || seqNum) {
    return {
      ptwNumber: ptwNumber || `TDE/PTW/${seqNum}/${eqCode || 'GEN'}/01/2026`,
      sequenceNumber: seqNum || '0000',
      equipmentCode: eqCode || 'GENERIC',
      quarter: quarter,
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || new Date().toISOString().split('T')[0],
      maintenanceName: ptwType === 'CM' ? 'Corrective Maintenance' : 'Preventive Maintenance',
      ptwType: ptwType,
    };
  }

  return null;
}
