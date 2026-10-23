// Sync data BOQ khusus fitur Monthly Report dari spreadsheet BOQ terbaru (Google Sheets).
// Hanya menulis frontend/data/monthlyReportBoqData.ts; Master Asset BOQ & Berita Acara
// tetap memakai frontend/data/boqAssetData.ts.
//
// Usage: node scripts/sync_monthly_report_boq.cjs <link Google Sheets | path .xlsx>
//        (atau isi env MONTHLY_REPORT_BOQ_SHEET_URL)
// Link spreadsheet sengaja tidak disimpan di repo karena repo ini publik.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { extractBOQCategories } = require('./extract_new_boq.cjs');

const OUTPUT_FILE = 'frontend/data/monthlyReportBoqData.ts';

async function resolveWorkbookPath(source) {
  const sheetId = (source.match(/\/spreadsheets\/d\/([\w-]+)/) || [])[1];
  if (!sheetId) return source;

  const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`);
  if (!res.ok) throw new Error(`Gagal download spreadsheet (HTTP ${res.status}). Pastikan link di-share "Anyone with the link".`);
  const buf = Buffer.from(await res.arrayBuffer());
  // .xlsx is a zip; anything else here is a Google login/error page.
  if (buf.subarray(0, 2).toString('latin1') !== 'PK') {
    throw new Error('Hasil download bukan file .xlsx. Pastikan link di-share "Anyone with the link".');
  }
  const file = path.join(os.tmpdir(), `monthly_report_boq_${sheetId}.xlsx`);
  fs.writeFileSync(file, buf);
  console.log(`Downloaded spreadsheet (${buf.length} bytes) -> ${file}`);
  return file;
}

async function main() {
  const source = process.argv[2] || process.env.MONTHLY_REPORT_BOQ_SHEET_URL;
  if (!source) {
    throw new Error('Usage: node scripts/sync_monthly_report_boq.cjs <link Google Sheets | path .xlsx>');
  }

  const categories = await extractBOQCategories(await resolveWorkbookPath(source));
  const syncedOn = new Date().toLocaleDateString('sv-SE');

  const tsContent = `// ============================================================================
// FILE: monthlyReportBoqData.ts
// Deskripsi: Data BOQ khusus fitur Monthly Report, diambil dari spreadsheet BOQ
//            terbaru (${categories.length} tab equipment; tab progress, schedule, resume &
//            consumable tidak diambil). Jangan diedit manual, generate ulang dengan:
//            node scripts/sync_monthly_report_boq.cjs <link spreadsheet>
// Sinkron terakhir: ${syncedOn}
// ============================================================================

import type { BOQCategory } from './boqAssetData';

export const MONTHLY_REPORT_BOQ_CATEGORIES: BOQCategory[] = ${JSON.stringify(categories, null, 2)};
`;

  fs.writeFileSync(OUTPUT_FILE, tsContent, 'utf8');
  console.log(`Successfully wrote ${OUTPUT_FILE}!`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
