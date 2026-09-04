import ExcelJS from 'exceljs';
import path from 'path';
import { BOQ_CATEGORIES_DATA } from '../frontend/data/boqAssetData';

const oldFile = path.join('C:/Users/User/.gemini/antigravity-ide/brain/64843087-a9ab-4bbe-aefb-dcd8bb45c108/scratch/boq_downloads/BOQ_Lama.xlsx');

function getRowValues(row: ExcelJS.Row): string[] {
  const raw: any = row.values;
  if (!Array.isArray(raw)) return [];
  return raw.slice(1).map((v: any) => (v != null ? String(v).trim() : ''));
}

async function run() {
  const wbOld = new ExcelJS.Workbook();
  await wbOld.xlsx.readFile(oldFile);

  console.log('--- EXTRACTING ALL ROOM/LOCATION MAPPINGS FROM OLD BOQ ---');

  // Build a multi-tier lookup map from Old BOQ:
  // 1. By exact CI Name
  // 2. By Asset ID
  // 3. By Serial Number
  // 4. By TAG
  // 5. By Sheet + Index / Row
  const mapByCIName = new Map<string, { floor: string; room: string; sheet: string }>();
  const mapByAssetId = new Map<string, { floor: string; room: string; sheet: string }>();
  const mapBySerial = new Map<string, { floor: string; room: string; sheet: string }>();
  const mapByTag = new Map<string, { floor: string; room: string; sheet: string }>();

  let totalOldExtracted = 0;

  for (const ws of wbOld.worksheets) {
    if (ws.name.toLowerCase().includes('sparepart')) continue;

    let headerRowIdx = -1;
    let headers: string[] = [];

    for (let r = 1; r <= 10; r++) {
      const row = ws.getRow(r);
      const vals = getRowValues(row);
      if (vals.some(v => /CI Name|Equipment Name|Class Name|Description/i.test(v))) {
        headerRowIdx = r;
        headers = vals;
        break;
      }
    }

    if (headerRowIdx === -1) continue;

    const ciNameIdx = headers.findIndex(h => /CI Name/i.test(h));
    const assetIdIdx = headers.findIndex(h => /Asset ID/i.test(h));
    const serialIdx = headers.findIndex(h => /Serial Number|Model \/ P\/N/i.test(h));
    const tagIdx = headers.findIndex(h => /^TAG$/i.test(h));
    const roomIdx = headers.findIndex(h => /^Room$/i.test(h) || /Room Location/i.test(h));
    const floorIdx = headers.findIndex(h => /^Floor$/i.test(h));

    for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const vals = getRowValues(row);
      if (vals.every(v => !v)) continue;

      const floor = floorIdx !== -1 ? vals[floorIdx] : '';
      const room = roomIdx !== -1 ? vals[roomIdx] : '';

      if (!room && !floor) continue;

      totalOldExtracted++;
      const ciName = ciNameIdx !== -1 ? vals[ciNameIdx] : '';
      const assetId = assetIdIdx !== -1 ? vals[assetIdIdx] : '';
      const serial = serialIdx !== -1 ? vals[serialIdx] : '';
      const tag = tagIdx !== -1 ? vals[tagIdx] : '';

      const locInfo = { floor, room, sheet: ws.name };

      if (ciName && ciName !== '-' && ciName.length > 2) {
        mapByCIName.set(ciName.toLowerCase(), locInfo);
      }
      if (assetId && assetId !== '-' && assetId.length > 2) {
        mapByAssetId.set(assetId.toLowerCase(), locInfo);
      }
      if (serial && serial !== '-' && serial.length > 3) {
        mapBySerial.set(serial.toLowerCase(), locInfo);
      }
      if (tag && tag !== '-' && tag.length > 2) {
        mapByTag.set(tag.toLowerCase(), locInfo);
      }
    }
  }

  console.log(`Total Old Items with Location: ${totalOldExtracted}`);
  console.log(`Unique CI Names: ${mapByCIName.size}`);
  console.log(`Unique Asset IDs: ${mapByAssetId.size}`);
  console.log(`Unique Serials: ${mapBySerial.size}`);
  console.log(`Unique TAGs: ${mapByTag.size}`);

  // Test matching against current BOQ_CATEGORIES_DATA
  let totalMissing = 0;
  let totalMatched = 0;

  for (const cat of BOQ_CATEGORIES_DATA) {
    let catMissing = 0;
    let catMatched = 0;

    for (const it of cat.items) {
      const existingRoom = it['Room'] || it['Room Location'] || '';
      const existingLoc = it['Location'] || '';
      if (existingRoom || existingLoc) continue;

      totalMissing++;
      catMissing++;

      const ciName = (it['CI Name*'] || it['Class Name'] || '').toLowerCase().trim();
      const assetId = (it['Asset ID'] || '').toLowerCase().trim();
      const serial = (it['Serial Number'] || '').toLowerCase().trim();
      const tag = (it['TAG'] || it['Tag'] || '').toLowerCase().trim();

      const matched = 
        (ciName && mapByCIName.get(ciName)) ||
        (assetId && mapByAssetId.get(assetId)) ||
        (serial && mapBySerial.get(serial)) ||
        (tag && mapByTag.get(tag));

      if (matched) {
        totalMatched++;
        catMatched++;
      }
    }

    if (catMissing > 0) {
      console.log(`Cat [${cat.name}]: Missing ${catMissing} -> Matched from Old: ${catMatched}`);
    }
  }

  console.log(`\nOVERALL MATCH RATE: ${totalMatched} / ${totalMissing} (${Math.round((totalMatched / totalMissing) * 100)}%)`);
}

run().catch(console.error);
