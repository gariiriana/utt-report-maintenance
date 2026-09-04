import ExcelJS from 'exceljs';
import path from 'path';

const dir = 'C:/Users/User/.gemini/antigravity-ide/brain/64843087-a9ab-4bbe-aefb-dcd8bb45c108/scratch/boq_downloads';
const oldFile = path.join(dir, 'BOQ_Lama.xlsx');
const newFile = path.join(dir, 'BOQ_Baru.xlsx');

async function run() {
  console.log('Loading Old BOQ with ExcelJS...');
  const wbOld = new ExcelJS.Workbook();
  await wbOld.xlsx.readFile(oldFile);
  console.log('Old BOQ Sheet Names (' + wbOld.worksheets.length + '):');
  console.log(wbOld.worksheets.map(ws => ws.name));

  console.log('\nLoading New BOQ with ExcelJS...');
  const wbNew = new ExcelJS.Workbook();
  await wbNew.xlsx.readFile(newFile);
  console.log('New BOQ Sheet Names (' + wbNew.worksheets.length + '):');
  console.log(wbNew.worksheets.map(ws => ws.name));
}

run().catch(console.error);
