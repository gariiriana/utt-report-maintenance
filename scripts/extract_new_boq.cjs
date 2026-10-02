const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const CATEGORY_DEFAULT_LOCATIONS = {
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
  'Load Bank': { floor: '3F', room: 'Power House 3F' },
  'Degassing Pressurization': { floor: '1F', room: 'PH Chiller' },
  'Pompa': { floor: 'Ground', room: 'Pump Room' },
  'MV & RMU Panel': { floor: '1F', room: 'MV Room' }
};

// ExcelJS cell values can be rich text, hyperlinks ({ text, hyperlink }), formulas ({ formula, result })
// or errors; flatten all of them to plain text so no cell ever becomes "[object Object]".
function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v !== 'object') return String(v).trim();
  if (v.richText) return v.richText.map(t => t.text).join('').trim();
  if (v.result !== undefined) return cellText(v.result);
  if (v.text !== undefined) return cellText(v.text);
  if (v.error) return '';
  return '';
}

// Read existing boqAssetData.ts for location lookup
console.log('Reading existing boqAssetData.ts for location lookup...');
const existingBoqContent = fs.readFileSync('frontend/data/boqAssetData.ts', 'utf8');
const existingLocationMap = new Map();

const itemRegex = /\{[^{}]*"No":\s*"[^"]+"[^{}]*\}/g;
let m;
while ((m = itemRegex.exec(existingBoqContent)) !== null) {
  try {
    const obj = JSON.parse(m[0]);
    const floor = obj.Floor || '';
    const room = obj.Room || '';
    if (floor || room) {
      if (obj['Asset ID']) existingLocationMap.set(`asset:${obj['Asset ID'].trim()}`, { floor, room });
      if (obj['TAG']) existingLocationMap.set(`tag:${obj['TAG'].trim()}`, { floor, room });
      if (obj['Tag']) existingLocationMap.set(`tag:${obj['Tag'].trim()}`, { floor, room });
      if (obj['Serial Number']) existingLocationMap.set(`sn:${obj['Serial Number'].trim()}`, { floor, room });
      if (obj['CI Name*']) existingLocationMap.set(`ci:${obj['CI Name*'].trim()}`, { floor, room });
    }
  } catch (e) {}
}
console.log(`Loaded ${existingLocationMap.size} location mappings.`);

async function extractBOQ() {
  const wb = new ExcelJS.Workbook();
  // Usage: node scripts/extract_new_boq.cjs [path-to-xlsx]  (defaults to temp_sheet.xlsx)
  await wb.xlsx.readFile(process.argv[2] || 'temp_sheet.xlsx');

  const categoriesConfig = [
    { id: 'cat_1', name: 'Trafo', group: 'Power & Distribution', sheet: 'Trafo' },
    { id: 'cat_2', name: 'ATS', group: 'Power & Distribution', sheet: 'ATS' },
    { id: 'cat_3', name: 'MV & RMU Panel', group: 'Power & Distribution', sheet: 'MV & RMU Panel' },
    { id: 'cat_4', name: 'LV Panel', group: 'Power & Distribution', sheet: 'LV Panel' },
    { id: 'cat_5', name: 'Grounding', group: 'Grounding, Protection & Leak', sheet: 'Grounding' },
    { id: 'cat_6', name: 'PDU', group: 'Power & Distribution', sheet: 'PDU' },
    { id: 'cat_7', name: 'LDB-RDB Panel', group: 'Power & Distribution', sheet: 'LDB-RDB Panel' },
    { id: 'cat_8', name: 'UPS', group: 'Power & Distribution', sheet: 'UPS' },
    { id: 'cat_9', name: 'Lightning Protection', group: 'Grounding, Protection & Leak', sheet: 'Lightning Protection' },
    { id: 'cat_10', name: 'Genset', group: 'Power Generation & Fuel', sheet: 'Genset & Fuel System', splitPart: 'genset' },
    { id: 'cat_11', name: 'Fuel System', group: 'Power Generation & Fuel', sheet: 'Genset & Fuel System', splitPart: 'fuel' },
    { id: 'cat_12', name: 'Load Bank', group: 'Power Generation & Fuel', sheet: 'Load & Cap Bank', splitPart: 'loadbank' },
    { id: 'cat_13', name: 'Cap Bank (APFCR)', group: 'Power & Distribution', sheet: 'Load & Cap Bank', splitPart: 'capbank' },
    { id: 'cat_14', name: 'Exhaust Fan', group: 'HVAC & Cooling Systems', sheet: 'Exhaust Fan' },
    { id: 'cat_15', name: 'BUSDUCT', group: 'Power & Distribution', sheet: 'BUSDUCT' },
    { id: 'cat_16', name: 'CT', group: 'HVAC & Cooling Systems', sheet: 'CT' },
    { id: 'cat_17', name: 'Physical Cooling Automation & T', group: 'HVAC & Cooling Systems', sheet: 'Physical Cooling Automation & T' },
    { id: 'cat_18', name: 'Cooling Pump', group: 'HVAC & Cooling Systems', sheet: 'Cooling Pump' },
    { id: 'cat_19', name: 'CRAC', group: 'HVAC & Cooling Systems', sheet: 'CRAC' },
    { id: 'cat_20', name: 'FCU', group: 'HVAC & Cooling Systems', sheet: 'FCU' },
    { id: 'cat_21', name: 'Chiller', group: 'HVAC & Cooling Systems', sheet: 'Chiller' },
    { id: 'cat_22', name: 'VRV', group: 'HVAC & Cooling Systems', sheet: 'VRV' },
    { id: 'cat_23', name: 'PAHU', group: 'HVAC & Cooling Systems', sheet: 'PAHU' },
    { id: 'cat_24', name: 'Degassing Pressurization', group: 'HVAC & Cooling Systems', sheet: 'Degassing Pressurization' },
    { id: 'cat_25', name: 'Splitwall', group: 'HVAC & Cooling Systems', sheet: 'Splitwall' },
    { id: 'cat_26', name: 'FSS', group: 'Fire Safety & Mechanical', sheet: 'FSS' },
    { id: 'cat_27', name: 'HYDRANT & PREACTION', group: 'Fire Safety & Mechanical', sheet: 'HYDRANT & PREACTION' },
    { id: 'cat_28', name: 'PREACTION', group: 'Fire Safety & Mechanical', sheet: 'PREACTION' },
    { id: 'cat_29', name: 'Hydrant Actual', group: 'Fire Safety & Mechanical', sheet: 'Hydrant Actual' },
    { id: 'cat_30', name: 'Lift', group: 'Fire Safety & Mechanical', sheet: 'Lift & Dock Level', splitPart: 'lift' },
    { id: 'cat_31', name: 'Dock Leveler', group: 'Fire Safety & Mechanical', sheet: 'Lift & Dock Level', splitPart: 'dock' },
    { id: 'cat_32', name: 'Water & Fuel Leak', group: 'Grounding, Protection & Leak', sheet: 'Water & Fuel Leak' },
    { id: 'cat_33', name: 'Water Softener', group: 'HVAC & Cooling Systems', sheet: 'Water Softener' },
    { id: 'cat_34', name: 'CT Water Treatment', group: 'HVAC & Cooling Systems', sheet: 'CT Water Treatment' },
    { id: 'cat_35', name: 'Pompa', group: 'Fire Safety & Mechanical', sheet: 'Pompa' },
    { id: 'cat_36', name: 'Gate', group: 'Security & Building Facility', sheet: 'Gate' },
    { id: 'cat_37', name: 'STP & Plumbing', group: 'Fire Safety & Mechanical', sheet: 'STP & Plumbing' },
    { id: 'cat_38', name: 'Road Blocker', group: 'Security & Building Facility', sheet: 'Road Blocker' },
    { id: 'cat_39', name: 'Door', group: 'Security & Building Facility', sheet: 'Door' },
    { id: 'cat_40', name: 'X-RAY', group: 'Security & Building Facility', sheet: 'X-RAY' },
    { id: 'cat_41', name: 'Lighting', group: 'Grounding, Protection & Leak', sheet: 'Lighting' },
  ];

  const categories = [];

  // Tabs are matched by NAME, never by position: the spreadsheet owners reorder and insert tabs.
  // These tabs hold planning/progress data, not BOQ assets, and are never imported.
  const EXCLUDED_TABS = ['Progress MOS & Instal CM', 'consumable parts 2026', 'Plan ManPower Agu', 'Plan ManPower Agustus', 'Plan ManPower Sep', 'Progress', 'Resume Q3', '2026 Schedule', 'Sheet1'];
  const norm = name => name.trim().toLowerCase();
  const usedTabs = new Set(categoriesConfig.map(cfg => norm(cfg.sheet)));
  const excluded = new Set(EXCLUDED_TABS.map(norm));
  const unmapped = wb.worksheets.filter(w => !usedTabs.has(norm(w.name)) && !excluded.has(norm(w.name)));
  if (unmapped.length) {
    console.warn(`WARNING: ${unmapped.length} tab(s) are neither imported nor excluded: ${unmapped.map(w => JSON.stringify(w.name)).join(', ')}. Add them to categoriesConfig or EXCLUDED_TABS.`);
  }

  for (const cfg of categoriesConfig) {
    const ws = wb.worksheets.find(w => norm(w.name) === norm(cfg.sheet));
    if (!ws) throw new Error(`Worksheet "${cfg.sheet}" for category "${cfg.name}" was not found in the spreadsheet.`);

    // Find header row
    let headerRowIdx = -1;
    let rawHeaders = [];

    for (let r = 1; r <= Math.min(25, ws.rowCount); r++) {
      const row = ws.getRow(r);
      const cells = [];
      row.eachCell({ includeEmpty: true }, (c, col) => {
        cells[col] = cellText(c.value);
      });
      const nonEmpties = cells.filter(Boolean);
      const lower = nonEmpties.map(v => v.toLowerCase());
      if ((lower.includes('no') || lower.includes('no.')) &&
          (lower.some(x => x.includes('class') || x.includes('ci name') || x.includes('asset') || x.includes('tag') || x.includes('description') || x.includes('product') || x.includes('week 1')))) {
        headerRowIdx = r;
        rawHeaders = cells;
        break;
      }
    }

    const titles = ['Critical Facility NeutraDC - Cikarang', `List Asset ${cfg.name}`];

    // Header column map
    const colMap = {};
    const seen = {};
    rawHeaders.forEach((h, col) => {
      if (!h) return;
      let cleanH = h.replace(/\r?\n/g, ' ').trim();
      // Normalize 'NO' to 'No'
      if (cleanH === 'NO' || cleanH === 'No.') cleanH = 'No';
      if (seen[cleanH]) {
        seen[cleanH]++;
        cleanH = `${cleanH}_${seen[cleanH]}`;
      } else {
        seen[cleanH] = 1;
      }
      colMap[col] = cleanH;
    });

    const items = [];
    let signatures = [];

    // Rows scanning
    for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const col1 = (row.getCell(1).value || '').toString().trim();
      const col2 = (row.getCell(2).value || '').toString().trim();
      const col3 = (row.getCell(3).value || '').toString().trim();

      // Detect signature block
      if (col1.toLowerCase().includes('cikarang,') || col2.toLowerCase().includes('cikarang,') || col3.toLowerCase().includes('cikarang,') ||
          col1.toLowerCase().includes('disiapkan') || col2.toLowerCase().includes('disiapkan') || col3.toLowerCase().includes('disiapkan')) {
        for (let sr = r; sr <= Math.min(r + 8, ws.rowCount); sr++) {
          const sRow = ws.getRow(sr);
          const sVals = [];
          sRow.eachCell({ includeEmpty: false }, c => {
            const v = cellText(c.value);
            if (v) sVals.push(v);
          });
          if (sVals.length > 0) signatures.push(sVals.join(' | '));
        }
        break;
      }

      // Check subheader rows
      if (col1.toLowerCase() === 'no' || col2.toLowerCase() === 'class id' || col3.toLowerCase().includes('ci name')) {
        continue;
      }

      // Read row values
      const rowObj = {};
      let hasMeaningfulData = false;
      for (const [col, h] of Object.entries(colMap)) {
        const strVal = cellText(row.getCell(parseInt(col, 10)).value);
        rowObj[h] = strVal;
        if (strVal && h !== 'No') {
          hasMeaningfulData = true;
        }
      }

      const noVal = (rowObj['No'] || '').toLowerCase();
      const classIdVal = (rowObj['Class Id'] || '').toLowerCase();
      if (noVal === 'total' || noVal.includes('sub total') || noVal.includes('grand total') ||
          classIdVal === 'total' || classIdVal.includes('sub total') || classIdVal === 'note') {
        continue;
      }

      // Skip row if it has no unit name or identifier
      const checkCI = (rowObj['CI Name*'] || rowObj['CI Name'] || '').trim();
      const checkClassId = (rowObj['Class Id'] || '').trim();
      const checkDesc = (rowObj['CI Description*'] || rowObj['CI Description'] || '').trim();
      if (!checkCI && !checkClassId && !checkDesc) {
        continue;
      }

      // Split sheet filtering
      if (cfg.splitPart === 'genset') {
        const noNum = parseInt(rowObj['No'] || '0', 10);
        if (noNum < 1 || noNum > 6) continue;
      } else if (cfg.splitPart === 'fuel') {
        const noNum = parseInt(rowObj['No'] || '0', 10);
        if (noNum < 7) continue;
      } else if (cfg.splitPart === 'loadbank') {
        const ci = (rowObj['CI Name*'] || rowObj['Class Id'] || '').toLowerCase();
        if (!ci.includes('load bank')) continue;
      } else if (cfg.splitPart === 'capbank') {
        const ci = (rowObj['CI Name*'] || rowObj['Class Id'] || '').toLowerCase();
        if (!ci.includes('apfcr') && !ci.includes('cap')) continue;
      } else if (cfg.splitPart === 'lift') {
        const classId = rowObj['Class Id'] || '';
        const ciName = rowObj['CI Name*'] || '';
        if (classId === 'July' || classId === 'August' || classId === 'September') continue;
        if (!ciName.toLowerCase().includes('lift') && !classId.toLowerCase().includes('l')) continue;
        if (items.some(it => it['CI Name*'] === ciName || (it['Serial Number'] && it['Serial Number'] === rowObj['Serial Number']))) {
          continue;
        }
      } else if (cfg.splitPart === 'dock') {
        const ciName = rowObj['CI Name*'] || '';
        const classId = rowObj['Class Id'] || '';
        if (!ciName.toLowerCase().includes('dock') && !classId.toLowerCase().includes('dock')) continue;
      }

      if (!hasMeaningfulData) continue;

      // Class Id and CI Name* resolution
      const rawCI = (rowObj['CI Name*'] || rowObj['CI Name'] || '').trim();
      const rawClassId = (rowObj['Class Id'] || '').trim();

      if (!rawCI && rawClassId) {
        rowObj['CI Name*'] = rawClassId;
      }
      if (!rowObj['Class Id'] && rawCI) {
        rowObj['Class Id'] = rawCI;
      }

      // If No is missing, assign index
      if (!rowObj['No']) {
        rowObj['No'] = String(items.length + 1);
      }

      // Location resolution (Floor, Room, Location)
      let floor = rowObj['Floor'] || '';
      let room = rowObj['Room'] || '';

      if (!floor || !room || floor === 'N/A' || room === 'N/A') {
        const assetId = (rowObj['Asset ID'] || '').trim();
        const tag = (rowObj['TAG'] || rowObj['Tag'] || '').trim();
        const sn = (rowObj['Serial Number'] || '').trim();
        const ci = (rowObj['CI Name*'] || '').trim();

        const loc = existingLocationMap.get(`asset:${assetId}`) ||
                    existingLocationMap.get(`tag:${tag}`) ||
                    existingLocationMap.get(`sn:${sn}`) ||
                    existingLocationMap.get(`ci:${ci}`);

        if (loc) {
          if (!floor || floor === 'N/A') floor = loc.floor;
          if (!room || room === 'N/A') room = loc.room;
        }

        const defaultLoc = CATEGORY_DEFAULT_LOCATIONS[cfg.name];
        if (defaultLoc) {
          if (!floor || floor === 'N/A') floor = defaultLoc.floor;
          if (!room || room === 'N/A') room = defaultLoc.room;
        }
      }

      rowObj['Floor'] = floor || '1F';
      rowObj['Room'] = room || 'NeutraDC Campus';
      rowObj['Location'] = `${rowObj['Floor']}, ${rowObj['Room']}`;

      items.push(rowObj);
    }

    const allHeaders = Object.values(colMap);
    if (!allHeaders.includes('No')) allHeaders.unshift('No');
    if (!allHeaders.includes('Class Id')) allHeaders.splice(1, 0, 'Class Id');
    if (!allHeaders.includes('CI Name*')) allHeaders.splice(2, 0, 'CI Name*');
    if (!allHeaders.includes('Floor')) allHeaders.push('Floor');
    if (!allHeaders.includes('Room')) allHeaders.push('Room');
    if (!allHeaders.includes('Location')) allHeaders.push('Location');

    categories.push({
      id: cfg.id,
      name: cfg.name,
      isSparepart: false,
      group: cfg.group,
      titles,
      headers: allHeaders,
      items,
      itemCount: items.length,
      signatures: signatures.length > 0 ? signatures : [
        "Cikarang, 19 November 2025",
        "Disiapkan oleh, | Diketahui oleh, | Disetujui oleh,",
        "(Indra Setiady) | ( Budi Susanto ) | (Rezki Rahman Daulay)"
      ],
      sideTable: null
    });
  }

  console.log(`\nSuccessfully generated ${categories.length} categories.`);
  categories.forEach(c => {
    console.log(`- ${c.id}: "${c.name}" -> ${c.itemCount} items`);
  });

  const tsContent = `// ============================================================================
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

export const BOQ_CATEGORIES_DATA: BOQCategory[] = ${JSON.stringify(categories, null, 2)};
`;

  fs.writeFileSync('frontend/data/boqAssetData.ts', tsContent, 'utf8');
  console.log('Successfully wrote frontend/data/boqAssetData.ts!');
}

extractBOQ().catch(err => console.error(err));
