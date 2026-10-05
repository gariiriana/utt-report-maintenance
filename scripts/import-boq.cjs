// Builds frontend/data/boqItems.json from the per-equipment BOQ workbook (one sheet per equipment category).
// Only the asset table left of each sheet's "PM DATE" column is imported; the PM schedule and service-report
// tracking to its right are deliberately left out, as are the planning sheets listed in EXCLUDED_SHEETS.
const ExcelJS = require('exceljs');
const fs = require('node:fs');
const path = require('node:path');

const EXCLUDED_SHEETS = ['Progress MOS & Instal CM', 'consumable parts 2026', 'Plan ManPower Agu', 'Plan ManPower Sep', 'Progress', 'Resume Q3', '2026 Schedule', 'Sheet1'];
const MONTH = /^(jan(uary|uari)?|feb(ruary|ruari)?|mar(ch|et)?|apr(il)?|ma[iy]|jun[ei]?|jul[iy]?|aug(ust)?|agu(stus)?|sep(tember)?|o[ck]t(ober)?|nov(ember)?|de[cs](ember)?)$/i;
// The signature block ends the BOQ; a bare "Note :" introduces rows marked as outside the BOQ (FSS).
const FOOTER = /^(cikarang,|disiapkan oleh|diketahui oleh|disetujui oleh|note\s*:?$|\(\s*[a-z .]+\s*\)$)/i;
const PM_HEADER = /^(pm\s*date|week\s*1)$/i;
const FIELD_BY_LABEL = {
  'no': 'no', 'class id': 'classId', 'ci name': 'ciName', 'ci description': 'ciDescription', 'capacity': 'capacity',
  'serial number': 'serialNumber', 'production year': 'productionYear', 'manufacturer / principle': 'manufacturer',
  'asset id': 'assetId', 'tag': 'tag', 'model/version': 'model', 'room': 'room', 'floor': 'floor',
};

const text = value => {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'object') return String(value).replace(/\r\n?/g, '\n').trim();
  if (value.richText) return value.richText.map(part => part.text).join('').trim();
  if (value.error) return '';
  if ('result' in value || value.formula || value.sharedFormula) return text(value.result);
  return String(value.text ?? '').trim();
};
const columnLetter = column => { let s = ''; for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const decode = ref => { const m = /^([A-Z]+)(\d+)$/.exec(ref); return { row: +m[2], col: [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) }; };
const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const normLabel = label => label.toLowerCase().replace(/[*+]/g, '').replace(/\s+/g, ' ').trim();

function readSheet(sheet) {
  const cells = new Map();
  sheet.eachRow({ includeEmpty: false }, (row, r) => row.eachCell({ includeEmpty: false }, (cell, c) => {
    const value = text(cell.value);
    if (value) cells.set(r + ':' + c, value);
  }));
  // Map every merge slave to its master; ExcelJS repeats the master value in slaves, so own values come from masters only.
  const masterOf = new Map();
  for (const range of sheet.model.merges || []) {
    const [a, b] = range.split(':').map(decode);
    for (let r = a.row; r <= b.row; r++) for (let c = a.col; c <= b.col; c++) if (r !== a.row || c !== a.col) masterOf.set(r + ':' + c, a);
  }
  for (const key of masterOf.keys()) cells.delete(key);
  const own = (r, c) => cells.get(r + ':' + c) || '';
  const merged = (r, c) => { const m = masterOf.get(r + ':' + c); return m ? own(m.row, m.col) : own(r, c); };
  return { own, merged, masterOf, lastRow: sheet.rowCount, lastCol: sheet.columnCount };
}

function isHeaderRow(grid, r) {
  const values = Array.from({ length: Math.min(grid.lastCol, 40) }, (_, i) => normLabel(grid.merged(r, i + 1)));
  return values.slice(0, 3).some(v => v === 'no') && values.some(v => ['class id', 'ci name', 'ci description'].includes(v));
}

function buildTable(grid, headerRow, inheritedPm) {
  let pm = 0;
  for (let c = 1; c <= grid.lastCol && !pm; c++) if (PM_HEADER.test(grid.merged(headerRow, c))) pm = c;
  pm ||= inheritedPm || grid.lastCol + 1;
  const labels = [];
  let lastLabeled = 0;
  for (let c = 1; c < pm; c++) {
    const label = grid.merged(headerRow, c).replace(/\s+/g, ' ');
    // Numeric "headers" are running totals of the progress block, not column names.
    labels[c] = label && !/^[\d.,]+$/.test(label) ? label : '';
    if (labels[c]) lastLabeled = c;
  }
  const columns = [];
  const assigned = new Set();
  for (let c = 1; c <= lastLabeled; c++) {
    let field = FIELD_BY_LABEL[normLabel(labels[c])];
    if (field === 'assetId' && assigned.has('assetId')) field = 'tag'; // second "Asset ID" column holds the TDE tag
    if (field && assigned.has(field)) field = undefined;
    if (field) assigned.add(field);
    columns.push({ col: c, label: labels[c] || 'Kolom ' + columnLetter(c), field, unlabeled: !labels[c] });
  }
  // Sheets without "CI Name" name their asset in Class Id (or CI Description).
  if (!assigned.has('ciName')) {
    const nameColumn = columns.find(column => column.field === 'classId') || columns.find(column => column.field === 'ciDescription');
    if (nameColumn) nameColumn.field = 'ciName';
  }
  return { headerRow, pm, columns };
}

function importSheet(sheet, grid, key) {
  const tables = [];
  const items = [];
  let table = null;
  let section = '';
  let monthBlocks = 0;
  let skipping = false;
  for (let r = 1; r <= grid.lastRow; r++) {
    if (isHeaderRow(grid, r)) {
      table = buildTable(grid, r, table?.pm);
      table.rows = [];
      table.section = section;
      tables.push(table);
      skipping = false; monthBlocks = 0;
      continue;
    }
    if (!table) continue;
    const ownValues = table.columns.map(column => grid.own(r, column.col));
    const filled = table.columns.filter((_, i) => ownValues[i]);
    if (!filled.length) continue;
    if (Array.from({ length: grid.lastCol }, (_, i) => grid.own(r, i + 1)).some(value => FOOTER.test(value))) break;
    const contentCells = filled.filter(column => column.field !== 'no');
    // Some sheets repeat the same assets once per month (July/August/...): keep only the first month block.
    if (contentCells.length === 1 && MONTH.test(grid.own(r, contentCells[0].col))) {
      skipping = ++monthBlocks > 1;
      continue;
    }
    if (skipping) continue;
    // A row carrying its own "PM DATE" heading starts a titled block within the same table (e.g. "Fuel Leak").
    if (Array.from({ length: grid.lastCol }, (_, i) => grid.own(r, i + 1)).some(value => PM_HEADER.test(value))) {
      section = contentCells.length ? grid.own(r, contentCells[0].col) : section;
      continue;
    }
    const nameColumn = table.columns.find(column => column.field === 'ciName');
    const nameMaster = nameColumn && grid.masterOf.get(r + ':' + nameColumn.col);
    if (nameMaster && nameMaster.row !== r) {
      // A vertically merged CI Name: this row lists another module of the item above (e.g. UPS power modules).
      const parent = items.find(item => item.sheetKey === key && item.sourceRow === nameMaster.row);
      if (!parent) throw new Error(`${sheet.name} row ${r}: merged CI Name without parent row`);
      parent.sourceRows ||= [parent.sourceRow];
      parent.sourceRows.push(r);
      table.columns.forEach((column, i) => {
        const detail = ownValues[i];
        const lines = parent.values[i] ? parent.values[i].split('\n') : [];
        if (detail && !lines.includes(detail)) parent.values[i] = [...lines, detail].join('\n');
      });
      continue;
    }
    const values = table.columns.map(column => grid.merged(r, column.col));
    // Rows with an empty CI Name still identify the asset by Class Id or description (e.g. X-RAY).
    const name = ['ciName', 'classId', 'ciDescription'].map(field => values[table.columns.findIndex(column => column.field === field)]).find(Boolean);
    if (!name) continue;
    const item = { id: `boq-v2-${key}-${r}`, sheetKey: key, sourceRow: r, table: null, section: section || undefined, values };
    table.rows.push(item);
    items.push(item);
  }
  return { tables: tables.filter(t => t.rows.length), items };
}

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: node scripts/import-boq.cjs <BOQ workbook .xlsx>');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(source);
  const excluded = new Set(EXCLUDED_SHEETS.map(name => name.trim().toLowerCase()));
  const output = { source: path.basename(source), importedAt: new Date().toISOString().slice(0, 10), tables: [], items: [] };
  const usedKeys = new Set();
  for (const sheet of workbook.worksheets) {
    if (excluded.has(sheet.name.trim().toLowerCase())) continue;
    const key = slug(sheet.name);
    if (!key || usedKeys.has(key)) throw new Error('Duplicate or empty sheet key: ' + sheet.name);
    usedKeys.add(key);
    const { tables } = importSheet(sheet, readSheet(sheet), key);
    if (!tables.length) throw new Error('No asset table found in sheet ' + sheet.name);
    tables.forEach((table, index) => {
      const tableIndex = output.tables.length;
      // Drop unlabeled columns that stay empty in this table.
      const keep = table.columns.map((column, i) => !column.unlabeled || table.rows.some(item => item.values[i]));
      output.tables.push({
        id: key + (index ? '-' + (index + 1) : ''),
        sheet: sheet.name.trim(), sheetKey: key, headerRow: table.headerRow,
        title: index ? `${sheet.name.trim()} — ${table.section || 'Tabel ' + (index + 1)}` : sheet.name.trim(),
        columns: table.columns.filter((_, i) => keep[i]).map(({ label, field }) => (field ? { label, field } : { label })),
      });
      for (const item of table.rows) {
        output.items.push({
          id: item.id, table: tableIndex, sourceRow: item.sourceRow,
          ...(item.sourceRows ? { sourceRows: item.sourceRows } : {}),
          ...(item.section ? { section: item.section } : {}),
          values: item.values.filter((_, i) => keep[i]),
        });
      }
    });
  }
  if (new Set(output.items.map(item => item.id)).size !== output.items.length) throw new Error('Duplicate item ID');
  // Many sheets have no (or an empty) Room column. When the CI Name maps to exactly one room in the earlier
  // "BOQ PER RUANGAN" workbook, record that room separately; the imported Room cell itself is left untouched.
  const roomsByName = new Map();
  const nameKey = value => (value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const emptyRoom = value => !value || /^(n\/?a|-+)$/i.test(value.trim());
  for (const old of JSON.parse(fs.readFileSync(path.resolve(__dirname, 'data/boqRoomItems.v1.json'), 'utf8'))) {
    if (!nameKey(old.ciName) || emptyRoom(old.room)) continue;
    const rooms = roomsByName.get(nameKey(old.ciName)) || new Map();
    rooms.set(old.room.trim().toUpperCase(), old.room.trim());
    roomsByName.set(nameKey(old.ciName), rooms);
  }
  let roomLookups = 0;
  for (const item of output.items) {
    const columns = output.tables[item.table].columns;
    const roomIndex = columns.findIndex(column => column.field === 'room');
    if (roomIndex >= 0 && !emptyRoom(item.values[roomIndex])) continue;
    const rooms = roomsByName.get(nameKey(item.values[columns.findIndex(column => column.field === 'ciName')]));
    if (rooms?.size === 1) { item.roomLookup = [...rooms.values()][0]; roomLookups++; }
  }
  const target = path.resolve(__dirname, '../frontend/data/boqItems.json');
  fs.writeFileSync(target, JSON.stringify(output) + '\n', 'utf8');
  const perSheet = {};
  for (const item of output.items) { const sheet = output.tables[item.table].sheet; perSheet[sheet] = (perSheet[sheet] || 0) + 1; }
  console.log(JSON.stringify({ target, tables: output.tables.length, items: output.items.length, roomLookups, perSheet }, null, 1));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
