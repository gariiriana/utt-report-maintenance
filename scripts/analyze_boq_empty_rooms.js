import ExcelJS from 'exceljs';
import path from 'path';

const dir = 'C:/Users/User/.gemini/antigravity-ide/brain/64843087-a9ab-4bbe-aefb-dcd8bb45c108/scratch/boq_downloads';
const oldFile = path.join(dir, 'BOQ_Lama.xlsx');
const newFile = path.join(dir, 'BOQ_Baru.xlsx');

async function run() {
  const wbOld = new ExcelJS.Workbook();
  await wbOld.xlsx.readFile(oldFile);

  const wbNew = new ExcelJS.Workbook();
  await wbNew.xlsx.readFile(newFile);

  console.log('--- ANALYSIS OF EMPTY ROOM/LOCATION IN NEW BOQ ---');
  
  const skipSheets = ['Progress MOS & Instal CM', 'Plan ManPower Agustus', 'Resume Q3', 'Progress', '2026 Schedule ', 'Sheet1'];

  for (const wsNew of wbNew.worksheets) {
    if (skipSheets.includes(wsNew.name)) continue;

    // Find header row (usually row 1, 2, or 3)
    let headerRowIdx = -1;
    let headers = [];
    for (let r = 1; r <= 10; r++) {
      const row = wsNew.getRow(r);
      const vals = row.values.slice(1).map(v => (v ? String(v).trim() : ''));
      if (vals.some(v => /CI Name|Equipment Name|Class Name|Description/i.test(v))) {
        headerRowIdx = r;
        headers = vals;
        break;
      }
    }

    if (headerRowIdx === -1) {
      // try looking for any non-empty row
      for (let r = 1; r <= 5; r++) {
        const row = wsNew.getRow(r);
        const vals = row.values.slice(1).map(v => (v ? String(v).trim() : ''));
        if (vals.length > 2) {
          headerRowIdx = r;
          headers = vals;
          break;
        }
      }
    }

    // Identify Room / Location columns
    const roomColIdx = headers.findIndex(h => /^Room$/i.test(h) || /Room Location/i.test(h));
    const locColIdx = headers.findIndex(h => /^Location$/i.test(h));
    const floorColIdx = headers.findIndex(h => /^Floor$/i.test(h));

    let totalRows = 0;
    let emptyRoomCount = 0;
    let emptyLocCount = 0;
    let sampleEmpty = [];

    for (let r = headerRowIdx + 1; r <= wsNew.rowCount; r++) {
      const row = wsNew.getRow(r);
      const vals = row.values.slice(1).map(v => (v ? String(v).trim() : ''));
      if (vals.every(v => !v)) continue;
      totalRows++;

      const roomVal = roomColIdx !== -1 ? vals[roomColIdx] : '';
      const locVal = locColIdx !== -1 ? vals[locColIdx] : '';

      if (roomColIdx !== -1 && (!roomVal || roomVal === '-' || roomVal.toLowerCase() === 'n/a')) {
        emptyRoomCount++;
      }
      if (locColIdx !== -1 && (!locVal || locVal === '-' || locVal.toLowerCase() === 'n/a')) {
        emptyLocCount++;
      }

      if ((roomColIdx !== -1 && !roomVal) || (locColIdx !== -1 && !locVal)) {
        if (sampleEmpty.length < 2) {
          sampleEmpty.push({ row: r, name: vals[1] || vals[0], room: roomVal, loc: locVal });
        }
      }
    }

    console.log(`Sheet [${wsNew.name}]: Total Rows = ${totalRows} | Headers = [${headers.filter(Boolean).join(', ')}]`);
    console.log(`   -> Room Col: ${roomColIdx !== -1 ? headers[roomColIdx] : 'NONE'} (Empty: ${emptyRoomCount}) | Loc Col: ${locColIdx !== -1 ? headers[locColIdx] : 'NONE'} (Empty: ${emptyLocCount}) | Floor Col: ${floorColIdx !== -1 ? headers[floorColIdx] : 'NONE'}`);
    if (sampleEmpty.length > 0) {
      console.log(`   -> Sample empty:`, JSON.stringify(sampleEmpty));
    }
  }
}

run().catch(console.error);
