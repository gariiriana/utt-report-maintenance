// Read the inspected workbook without modifying it. Merged cells resolve to their masters.
const ExcelJS = require('exceljs');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const source = process.argv[2] || 'D:/Users/Downloads/BOQ PER RUANGAN (1).xlsx';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(source);
  const items = [];
  const text = cell => {
    const value = cell.value;
    if (value == null) return '';
    if (typeof value !== 'object') return String(value).trim();
    if (value.richText) return value.richText.map(part => part.text).join('').trim();
    return String(value.result ?? value.text ?? '').trim();
  };
  for (const [sheetName, headerRow] of [['ROOM', 2], ['NO ROOM', 1]]) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet || text(sheet.getCell(headerRow, 4)) !== 'CI Name*') {
      throw new Error(`Unexpected workbook schema: ${sheetName}`);
    }
    for (let row = headerRow + 1; row <= sheet.rowCount; row++) {
      const ciCell = sheet.getCell(row, 4);
      if (ciCell.isMerged && ciCell.master.row !== row) {
        const parent = items.find(item => item.sourceSheet === sheetName && item.sourceRow === ciCell.master.row);
        if (!parent) throw new Error('Merged CI Name has no preceding parent at row ' + row);
        parent.sourceRows ||= [parent.sourceRow];
        parent.sourceRows.push(row);
        // Preserve every module description under a merged CI Name rather than discarding continuation rows.
        for (const [field, column] of [['ciDescription', 5], ['capacity', 6], ['model', 7], ['floor', 8]]) {
          const detail = text(sheet.getCell(row, column));
          if (detail && !parent[field].split('\n').includes(detail)) parent[field] = [parent[field], detail].filter(Boolean).join('\n');
        }
        continue;
      }
      const ciName = text(ciCell);
      if (!ciName) continue;
      items.push({
        id: `room-v1-${sheetName === 'ROOM' ? 'room' : 'no-room'}-${row}`,
        sourceSheet: sheetName, sourceRow: row,
        room: text(sheet.getCell(row, 2)), classId: text(sheet.getCell(row, 3)),
        ciName, ciDescription: text(sheet.getCell(row, 5)),
        capacity: text(sheet.getCell(row, 6)), model: text(sheet.getCell(row, 7)),
        floor: text(sheet.getCell(row, 8)),
      });
    }
  }
  if (items.length !== 2359 || new Set(items.map(item => item.id)).size !== items.length) {
    throw new Error(`Unexpected item count or duplicate ID: ${items.length}`);
  }
  const output = path.resolve(__dirname, '../frontend/data/boqRoomItems.json');
  fs.writeFileSync(output, JSON.stringify(items, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ output, items: items.length, preservedSourceRows: items.reduce((total, item) => total + (item.sourceRows?.length || 1), 0), longestDescription: Math.max(...items.map(item => item.ciDescription.length)), sheets: items.reduce((a, i) => ({ ...a, [i.sourceSheet]: (a[i.sourceSheet] || 0) + 1 }), {}) }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
