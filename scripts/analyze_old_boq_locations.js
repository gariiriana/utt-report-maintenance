import ExcelJS from 'exceljs';
import path from 'path';

const dir = 'C:/Users/User/.gemini/antigravity-ide/brain/64843087-a9ab-4bbe-aefb-dcd8bb45c108/scratch/boq_downloads';
const oldFile = path.join(dir, 'BOQ_Lama.xlsx');

async function run() {
  const wbOld = new ExcelJS.Workbook();
  await wbOld.xlsx.readFile(oldFile);

  console.log('--- ANALYSIS OF OLD BOQ SHEETS & LOCATION COLUMNS ---');

  for (const ws of wbOld.worksheets) {
    let headerRowIdx = -1;
    let headers = [];

    for (let r = 1; r <= 10; r++) {
      const row = ws.getRow(r);
      const vals = row.values.slice(1).map(v => (v ? String(v).trim() : ''));
      if (vals.some(v => /CI Name|Equipment Name|Class Name|Description/i.test(v))) {
        headerRowIdx = r;
        headers = vals;
        break;
      }
    }

    if (headerRowIdx === -1) {
      for (let r = 1; r <= 5; r++) {
        const row = ws.getRow(r);
        const vals = row.values.slice(1).map(v => (v ? String(v).trim() : ''));
        if (vals.length > 2) {
          headerRowIdx = r;
          headers = vals;
          break;
        }
      }
    }

    const locHeaders = headers.filter(h => /room|location|floor|area|site/i.test(h));
    
    // Sample non-empty location values
    let filledCount = 0;
    let sampleVal = '';
    for (let r = headerRowIdx + 1; r <= Math.min(ws.rowCount, headerRowIdx + 20); r++) {
      const row = ws.getRow(r);
      const vals = row.values.slice(1).map(v => (v ? String(v).trim() : ''));
      const locVals = locHeaders.map(lh => {
        const idx = headers.indexOf(lh);
        return idx !== -1 ? vals[idx] : '';
      }).filter(Boolean);
      if (locVals.length > 0) {
        filledCount++;
        if (!sampleVal) sampleVal = locVals.join(' | ');
      }
    }

    console.log(`Sheet [${ws.name}]: Rows = ${ws.rowCount - headerRowIdx} | Loc Headers: [${locHeaders.join(', ')}] | Sample: "${sampleVal}"`);
  }
}

run().catch(console.error);
