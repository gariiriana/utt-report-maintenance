import ExcelJS from 'exceljs';
import path from 'path';
import { BOQ_CATEGORIES_DATA } from '../frontend/data/boqAssetData';

const oldFile = path.join('C:/Users/User/.gemini/antigravity-ide/brain/64843087-a9ab-4bbe-aefb-dcd8bb45c108/scratch/boq_downloads/BOQ_Lama.xlsx');

function getRowValues(row?: ExcelJS.Row): string[] {
  if (!row) return [];
  const raw: any = row.values;
  if (!Array.isArray(raw)) return [];
  return raw.slice(1).map((v: any) => (v != null ? String(v).trim() : ''));
}

async function run() {
  const wbOld = new ExcelJS.Workbook();
  await wbOld.xlsx.readFile(oldFile);

  console.log('--- DETAILED INSPECTION FOR REMAINING CATEGORIES ---');

  // Check Chiller
  const chillerCat = BOQ_CATEGORIES_DATA.find(c => c.name === 'Chiller');
  console.log('\nNew BOQ Chiller Items:');
  chillerCat?.items.forEach((it, i) => console.log(i + 1, it['CI Name*'] || it['Class Name'], '| S/N:', it['Serial Number'], '| TAG:', it['TAG']));

  const oldChillerWs = wbOld.getWorksheet('Chiller');
  console.log('\nOld BOQ Chiller Rows:');
  for (let r = 1; r <= (oldChillerWs?.rowCount || 0); r++) {
    const vals = getRowValues(oldChillerWs?.getRow(r));
    if (vals.length > 2 && (vals[1] || vals[2])) {
      console.log(`Row ${r}:`, vals.slice(0, 8).join(' | '));
    }
  }

  // Check X-RAY
  console.log('\nNew BOQ X-RAY Items:');
  const xrayCat = BOQ_CATEGORIES_DATA.find(c => c.name.toLowerCase().includes('x-ray'));
  xrayCat?.items.forEach((it, i) => console.log(i + 1, it['CI Name*'] || it['Class Name'], '| Floor:', it['Floor'], '| Room:', it['Room']));

  // Check Water Softener
  console.log('\nNew BOQ Water Softener Items:');
  const wsCat = BOQ_CATEGORIES_DATA.find(c => c.name.toLowerCase().includes('water softener'));
  wsCat?.items.forEach((it, i) => console.log(i + 1, it['CI Name*'] || it['CI Description*'] || it['Class Name']));

  const oldWsWs = wbOld.getWorksheet('Water Softener');
  console.log('\nOld BOQ Water Softener Rows:');
  for (let r = 1; r <= Math.min(oldWsWs?.rowCount || 0, 10); r++) {
    const vals = getRowValues(oldWsWs?.getRow(r));
    if (vals.length > 0) {
      console.log(`Row ${r}:`, vals.slice(0, 8).join(' | '));
    }
  }
}

run().catch(console.error);
