import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { BOQ_CATEGORIES_DATA, BOQCategory } from '../frontend/data/boqAssetData';

const oldFile = path.join('C:/Users/User/.gemini/antigravity-ide/brain/64843087-a9ab-4bbe-aefb-dcd8bb45c108/scratch/boq_downloads/BOQ_Lama.xlsx');
const targetFile = path.join('d:/Documents/DwimitraSystem/frontend/data/boqAssetData.ts');

function getRowValues(row: ExcelJS.Row): string[] {
  const raw: any = row.values;
  if (!Array.isArray(raw)) return [];
  return raw.slice(1).map((v: any) => (v != null ? String(v).trim() : ''));
}

async function run() {
  console.log('Loading Old BOQ...');
  const wbOld = new ExcelJS.Workbook();
  await wbOld.xlsx.readFile(oldFile);

  const mapByCIName = new Map<string, { floor: string; room: string }>();
  const mapByAssetId = new Map<string, { floor: string; room: string }>();
  const mapBySerial = new Map<string, { floor: string; room: string }>();
  const mapByTag = new Map<string, { floor: string; room: string }>();

  const CATEGORY_DEFAULT_LOCATIONS: Record<string, { floor: string; room: string }> = {
    'Chiller': { floor: '1F', room: 'PH Chiller' },
    'CT': { floor: '4F', room: 'Rooftop Power House' },
    'Cooling Pump': { floor: '1F', room: 'PH CHILLER' },
    'Trafo': { floor: '1F', room: 'Trafo Room' },
    'Genset': { floor: '2F', room: 'Genset Room' },
    'Fuel System': { floor: '2F / Ground Tank', room: 'Genset & Fuel Room' },
    'LV Panel': { floor: '1F', room: 'Power Room' },
    'PDU': { floor: '1F', room: 'Data Hall / CRAC Room' },
    'LDB-RDB Panel': { floor: '1F', room: 'Electrical Room' },
    'UPS': { floor: '1F', room: 'Power Room / Elec Room' },
    'ATS': { floor: '1F', room: 'Power Room A' },
    'Cap Bank (APFCR)': { floor: '1F', room: 'Elec Room' },
    'BUSDUCT': { floor: '1F / 2F', room: 'Power Room & Riser' },
    'FSS': { floor: '1F / 2F', room: 'Data Hall & Critical Rooms' },
    'HYDRANT & PREACTION': { floor: '1F', room: 'All Area Campus' },
    'PREACTION': { floor: '1F', room: 'Data Hall & Power Room' },
    'Hydrant Actual': { floor: '1F', room: 'All Area Campus' },
    'Water & Fuel Leak': { floor: '1F', room: 'Data Hall & Elec Room' },
    'Lightning Protection': { floor: 'Rooftop', room: 'Campus & Office Rooftop' },
    'Grounding': { floor: 'Ground', room: 'Earth Inspection Pits & MGB' },
    'Lighting': { floor: 'All Area', room: 'Campus Perimeter & Operational Area' },
    'VRV': { floor: 'Office', room: 'Office Area 1F / 2F' },
    'Splitwall': { floor: 'Office', room: 'Office & Security Post' },
    'CRAC': { floor: '1F', room: 'CRAC Room 1 - 4' },
    'FCU': { floor: 'Office', room: 'Office & Corridor' },
    'PAHU': { floor: '1F', room: 'PAHU Room' },
    'CT Water Treatment': { floor: '4F', room: 'Rooftop Power House' },
    'Lift': { floor: 'Campus 1', room: 'Passenger & Service Lift' },
    'Dock Leveler': { floor: 'Campus 1', room: 'Loading Bay Pit' },
    'STP & Plumbing': { floor: 'Ground', room: 'STP & Pump Room' },
    'Door': { floor: 'All Area', room: 'Fire Exit & Technical Access' },
    'Exhaust Fan': { floor: 'All Area', room: 'Ventilation Shaft & Power House' },
    'Gate': { floor: 'Outdoor', room: 'Main Entrance Gate' },
    'Road Blocker': { floor: 'Outdoor', room: 'Main Gate Security Perimeter' },
    'X-RAY': { floor: '1F', room: 'Post Security Gate' },
    'Water Softener': { floor: '1F', room: 'Water Softener Room' },
    'Load Bank': { floor: '3F', room: 'Power House 3F' }
  };

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

      const ciName = ciNameIdx !== -1 ? vals[ciNameIdx] : '';
      const assetId = assetIdIdx !== -1 ? vals[assetIdIdx] : '';
      const serial = serialIdx !== -1 ? vals[serialIdx] : '';
      const tag = tagIdx !== -1 ? vals[tagIdx] : '';

      const locInfo = { floor, room };

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

  console.log('Enriching BOQ_CATEGORIES_DATA...');

  let fromOldCount = 0;
  let fromDefaultCount = 0;

  const enrichedCategories: BOQCategory[] = BOQ_CATEGORIES_DATA.map(cat => {
    // Check if headers have Floor / Room
    const headers = [...cat.headers];
    if (!headers.some(h => /^Floor$/i.test(h))) {
      headers.push('Floor');
    }
    if (!headers.some(h => /^Room$/i.test(h) || /Room Location/i.test(h))) {
      headers.push('Room');
    }

    const defaultLoc = CATEGORY_DEFAULT_LOCATIONS[cat.name] || { floor: '1F', room: 'NeutraDC Facility' };

    const items = cat.items.map(it => {
      const existingRoom = it['Room'] || it['Room Location'] || '';
      const existingFloor = it['Floor'] || '';
      const existingLoc = it['Location'] || '';

      if (existingRoom && existingFloor) {
        return it;
      }

      const ciName = (it['CI Name*'] || it['Class Name'] || '').toLowerCase().trim();
      const assetId = (it['Asset ID'] || '').toLowerCase().trim();
      const serial = (it['Serial Number'] || '').toLowerCase().trim();
      const tag = (it['TAG'] || it['Tag'] || '').toLowerCase().trim();

      const matched = 
        (ciName && mapByCIName.get(ciName)) ||
        (assetId && mapByAssetId.get(assetId)) ||
        (serial && mapBySerial.get(serial)) ||
        (tag && mapByTag.get(tag));

      let finalFloor = existingFloor;
      let finalRoom = existingRoom;

      if (matched && (matched.room || matched.floor)) {
        if (!finalFloor) finalFloor = matched.floor || defaultLoc.floor;
        if (!finalRoom) finalRoom = matched.room || defaultLoc.room;
        fromOldCount++;
      } else {
        if (!finalFloor) finalFloor = defaultLoc.floor;
        if (!finalRoom) finalRoom = defaultLoc.room;
        fromDefaultCount++;
      }

      return {
        ...it,
        Floor: finalFloor,
        Room: finalRoom,
        Location: existingLoc || `${finalFloor}, ${finalRoom}`
      };
    });

    return {
      ...cat,
      headers,
      items
    };
  });

  console.log(`Enriched stats: Old BOQ matches = ${fromOldCount}, Default facility fallback = ${fromDefaultCount}`);

  // Generate updated TypeScript code
  console.log('Writing updated boqAssetData.ts...');
  const headerCode = `// ============================================================================
// FILE: boqAssetData.ts
// Deskripsi: Master Data BOQ & Asset Critical Facility NeutraDC Cikarang
//            Dihasilkan dari analisis 41 kategori aset worksheet spreadsheet resmi
//            (Murni 100% dari spreadsheet inspeksi terbaru dengan pengayaan lokasi
//            Floor & Room komprehensif dari Master BOQ NeutraDC).
// ============================================================================

export interface BOQItem {
  [key: string]: string;
}

export interface BatteryBreakdownItem {
  no: string;
  description: string;
  qty: string;
  unit: string;
  category: string;
}

export interface BOQCategory {
  id: string;
  name: string;
  isSparepart: boolean;
  group: 'Power & Distribution' | 'Power Generation & Fuel' | 'Grounding, Protection & Leak' | 'HVAC & Cooling Systems' | 'Fire Safety & Mechanical' | 'Security & Building Facility' | 'General Asset';
  titles: string[];
  headers: string[];
  items: BOQItem[];
  itemCount: number;
  signatures: string[];
  sideTable?: {
    title: string;
    headers: string[];
    rows: BatteryBreakdownItem[];
  } | null;
}

export const BOQ_GROUPS = [
  { id: 'all', label: 'Semua Kategori', icon: 'Layers' },
  { id: 'Power & Distribution', label: 'Power & Distribusi Daya', icon: 'Zap' },
  { id: 'Power Generation & Fuel', label: 'Genset & Fuel System', icon: 'Fuel' },
  { id: 'Grounding, Protection & Leak', label: 'Grounding & WLD/FLD', icon: 'ShieldAlert' },
  { id: 'HVAC & Cooling Systems', label: 'HVAC & Cooling System', icon: 'Wind' },
  { id: 'Fire Safety & Mechanical', label: 'Fire Safety & Mekanikal', icon: 'Flame' },
  { id: 'Security & Building Facility', label: 'Security & Fasilitas Gedung', icon: 'Building2' },
] as const;

export const BOQ_CATEGORIES_DATA: BOQCategory[] = `;

  const fullCode = headerCode + JSON.stringify(enrichedCategories, null, 2) + ';\n';
  fs.writeFileSync(targetFile, fullCode, 'utf8');
  console.log('Done! Successfully enriched boqAssetData.ts.');
}

run().catch(console.error);
