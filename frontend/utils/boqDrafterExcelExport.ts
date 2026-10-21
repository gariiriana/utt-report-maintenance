import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Bytes } from 'firebase/firestore';
import { customBOQItemOf, getBOQPhotoBlob, readAllBOQOverrides, readAllBOQPhotoRefs, readBOQItemPhotoRefs, type BOQPhotoRef } from '@/api/boq';
import type { BOQColumn, BOQEditableField, BOQItem, BOQOverride, BOQTable } from '@/types/boq';
import { BOQ_EDITABLE_FIELDS, BOQ_FIELD_LABELS, BOQ_STATUS, CUSTOM_CATEGORY, NO_ROOM, boqSheets, boqTables, cellValue, needsFieldCheck, roomLabel, statusOfSheet, tableOrder } from './boqCatalog';

const THUMB_EDGE = 480;
const THUMB_QUALITY = 0.75;
const PHOTO_COL_WIDTH = 24;
const PHOTO_COL_PX = PHOTO_COL_WIDTH * 7 + 5;
const PHOTO_ROW_PT = 96;
const PHOTO_ROW_PX = Math.round(PHOTO_ROW_PT * 4 / 3);
const PHOTO_BOX = { width: 160, height: 120 };
const EDITABLE = new Set<string>(BOQ_EDITABLE_FIELDS);
const FONT: Partial<ExcelJS.Font> = { name: 'Times New Roman', size: 10, color: { argb: 'FF000000' } };
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const HEADER_FILL = fill('FFD9D9D9');
const EDITED_FILL = fill('FFFFF2CC');
const CHECKED_FILL = fill('FFC6EFCE');
// Items added in the app under a category that is not a workbook sheet get the columns of the app form.
const CUSTOM_COLUMNS: BOQColumn[] = [{ label: 'Class Id', field: 'classId' }, ...BOQ_EDITABLE_FIELDS.map(field => ({ label: BOQ_FIELD_LABELS[field], field })), { label: 'Floor', field: 'floor' }, { label: 'Room', field: 'room' }];

interface Entry { item: BOQItem; override?: BOQOverride; photos: BOQPhotoRef[] }
interface Thumb { base64: string; width: number; height: number }
export interface BOQExportResult { fileName: string; itemCount: number; sheetCount: number; photoCount: number; failedPhotos: number; warnings: string[] }

function sheetNameFor(name: string, used: Set<string>) {
  const base = (name.replace(/[\\/?*[\]:]/g, '-').replace(/^'+|'+$/g, '').trim() || 'Sheet').slice(0, 31);
  let result = base;
  for (let n = 2; used.has(result.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    result = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(result.toLowerCase());
  return result;
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]);
  }));
}

async function toThumbnail(blob: Blob): Promise<Thumb> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, THUMB_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas tidak tersedia.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { base64: canvas.toDataURL('image/jpeg', THUMB_QUALITY).split(',')[1], width, height };
}

// The JPEG preview stored with the photo is what the page shows. It is already loaded with the
// photo list, so it needs no chunk reads: those cost quota and come from the local cache only
// (often incomplete) when the Firestore connection drops.
async function storedThumbnail(thumb: Bytes): Promise<Thumb> {
  const bitmap = await createImageBitmap(new Blob([thumb.toUint8Array() as BlobPart], { type: 'image/jpeg' }));
  const { width, height } = bitmap;
  bitmap.close();
  return { base64: thumb.toBase64(), width, height };
}

// A cell of the sheet's own column layout. Custom items have no workbook values, only their fields.
function valueOf(item: BOQItem, table: BOQTable | undefined, column: BOQColumn, index: number, override?: BOQOverride): string {
  if (table && !item.custom) return cellValue(item, index, override);
  if (!column.field || column.field === 'no') return '';
  return (EDITABLE.has(column.field) ? override?.[column.field as BOQEditableField] : undefined) ?? item[column.field] ?? '';
}
const edited = (item: BOQItem, column: BOQColumn, override?: BOQOverride) =>
  !item.custom && !!override && !!column.field && EDITABLE.has(column.field)
  && override[column.field as BOQEditableField] !== undefined && override[column.field as BOQEditableField] !== item[column.field as BOQEditableField];

export async function exportDrafterBOQExcel(items: BOQItem[], onProgress: (message: string) => void): Promise<BOQExportResult> {
  const warnings: string[] = [];
  onProgress('Membaca perubahan BOQ…');
  const overrides = await readAllBOQOverrides();

  onProgress('Mencari foto item…');
  let refs: BOQPhotoRef[];
  try {
    refs = await readAllBOQPhotoRefs();
  } catch {
    warnings.push('Foto pada item yang belum pernah diedit teksnya mungkin belum ikut. Deploy firestore rules & indexes terbaru lalu export ulang.');
    const found: BOQPhotoRef[][] = [];
    await runPool(Object.keys(overrides), 6, async id => { found.push(await readBOQItemPhotoRefs(id).catch(() => [])); });
    refs = found.flat();
  }

  const photosByItem = new Map<string, BOQPhotoRef[]>();
  for (const ref of refs) photosByItem.set(ref.itemId, [...(photosByItem.get(ref.itemId) || []), ref]);
  for (const list of photosByItem.values()) list.sort((a, b) => a.createdAt - b.createdAt || a.photo.name.localeCompare(b.photo.name));

  // Added items live only in Firestore; deleted ones keep a tombstone and go to "Item Dihapus".
  const customItems = Object.entries(overrides).filter(([, value]) => value.custom).map(([id, value]) => customBOQItemOf(id, value));
  const everything = [...items, ...customItems];
  const exportItems = everything.filter(item => !overrides[item.id]?.deleted);
  const deletedItems = everything.filter(item => overrides[item.id]?.deleted);

  // One worksheet per equipment, in workbook order; categories added in the app come last.
  const sheetNames = [...boqSheets.map(entry => entry.sheet), ...new Set(exportItems.map(item => item.sheet).filter(name => !statusOfSheet(name)))];
  const bySheet = new Map<string, Entry[]>(sheetNames.map(name => [name, []]));
  const sorted = [...exportItems].sort((a, b) => tableOrder(a.tableId) - tableOrder(b.tableId) || a.sourceRow - b.sourceRow || a.ciName.localeCompare(b.ciName));
  for (const item of sorted) bySheet.get(item.sheet)!.push({ item, override: overrides[item.id], photos: photosByItem.get(item.id) || [] });

  const allPhotos = [...bySheet.values()].flat().flatMap(entry => entry.photos);
  const thumbs = new Map<string, Thumb | null>();
  const failures = new Map<string, string>();
  let done = 0;
  await runPool(allPhotos, 4, async ref => {
    const key = ref.itemId + '/' + ref.photo.id;
    try {
      thumbs.set(key, ref.photo.thumb ? await storedThumbnail(ref.photo.thumb) : await toThumbnail(await getBOQPhotoBlob(ref.photo)));
    } catch (error) {
      thumbs.set(key, null);
      failures.set(key, error instanceof Error ? error.message : String(error));
    }
    onProgress(`Menyiapkan foto ${++done}/${allPhotos.length}…`);
  });

  onProgress('Menyusun file Excel…');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DwimitraSystem';
  workbook.created = new Date();
  const usedNames = new Set<string>();
  const styleCell = (cell: ExcelJS.Cell) => {
    cell.font = FONT;
    cell.border = BORDER;
    cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  };

  // Progress per equipment, first sheet of the file.
  const summary = workbook.addWorksheet(sheetNameFor('Ringkasan', usedNames));
  summary.columns = [
    { header: 'No', width: 5 }, { header: 'Equipment', width: 34 }, { header: 'Status', width: 22 }, { header: 'Warna tab', width: 11 },
    { header: 'Jumlah item', width: 12 }, { header: 'Ada', width: 8 }, { header: 'Belum dicek', width: 12 }, { header: 'Dihapus', width: 9 }, { header: 'Item berfoto', width: 12 },
  ];
  summary.getRow(1).eachCell(cell => { styleCell(cell); cell.fill = HEADER_FILL; cell.font = { ...FONT, bold: true }; });
  summary.views = [{ state: 'frozen', ySplit: 1 }];

  let sheetCount = 0;
  for (const name of sheetNames) {
    const entries = bySheet.get(name)!;
    const status = statusOfSheet(name);
    const deletedHere = deletedItems.filter(item => item.sheet === name).length;
    if (!entries.length && !status) continue;
    const fieldCheck = needsFieldCheck(status);
    const checkedCount = entries.filter(entry => entry.item.custom || entry.override?.checked).length;
    const summaryRow = summary.addRow([
      summary.rowCount, name, status ? BOQ_STATUS[status].label : CUSTOM_CATEGORY, status ? BOQ_STATUS[status].colour : '-',
      entries.length, fieldCheck ? checkedCount : '-', fieldCheck ? entries.length - checkedCount : '-', deletedHere, entries.filter(entry => entry.photos.length).length,
    ]);
    summaryRow.eachCell({ includeEmpty: true }, styleCell);
    const tabColor = boqSheets.find(entry => entry.sheet === name)?.tabColor;
    if (tabColor) summaryRow.getCell(4).fill = fill(tabColor);
    if (!entries.length) continue;

    sheetCount++;
    const sheet = workbook.addWorksheet(sheetNameFor(name, usedNames), tabColor ? { properties: { tabColor: { argb: tabColor } } } : undefined);
    // Each table of the sheet keeps its own columns; extra columns and photos start at the same column for all of them.
    const tables = [...new Set(entries.map(entry => entry.item.tableId))].map(tableId => ({
      tableId, table: boqTables.find(table => table.id === tableId), entries: entries.filter(entry => entry.item.tableId === tableId),
    }));
    const columnsOf = (table: BOQTable | undefined) => table?.columns || boqTables.find(entry => entry.sheet === name)?.columns || CUSTOM_COLUMNS;
    const width = Math.max(...tables.map(({ table }) => columnsOf(table).length));
    const extras = ['Ruangan (aplikasi)', ...(fieldCheck ? ['Status cek'] : []), 'Catatan Excel'];
    const photoStart = width + extras.length;
    const photoColumns = Math.max(0, ...entries.map(entry => entry.photos.length));
    const widths = new Map<number, number>();
    const fit = (column: number, value: string) => widths.set(column, Math.min(40, Math.max(widths.get(column) || 6, ...value.split('\n').map(line => line.length + 2))));
    let rowNumber = 0;
    let frozen = false;

    for (const [blockIndex, block] of tables.entries()) {
      const columns = columnsOf(block.table);
      if (blockIndex) {
        rowNumber += 2;
        const title = sheet.getRow(rowNumber);
        title.getCell(1).value = block.table?.title || 'Item tambahan';
        title.getCell(1).font = { ...FONT, bold: true, size: 11 };
      }
      const headerRow = sheet.getRow(++rowNumber);
      const headers = [...columns.map(column => column.label)];
      headers.forEach((label, index) => { headerRow.getCell(index + 1).value = label; fit(index + 1, label); });
      extras.forEach((label, index) => { headerRow.getCell(width + index + 1).value = label; fit(width + index + 1, label); });
      for (let index = 0; index < photoColumns; index++) headerRow.getCell(photoStart + index + 1).value = `Foto ${index + 1}`;
      headerRow.eachCell(cell => { styleCell(cell); cell.fill = HEADER_FILL; cell.font = { ...FONT, bold: true }; });
      if (!frozen) { sheet.views = [{ state: 'frozen', ySplit: rowNumber }]; frozen = true; }

      for (const entry of block.entries) {
        const { item, override, photos } = entry;
        const row = sheet.getRow(++rowNumber);
        columns.forEach((column, index) => {
          const value = valueOf(item, block.table, column, index, override);
          const cell = row.getCell(index + 1);
          cell.value = value;
          fit(index + 1, value);
          if (edited(item, column, override)) cell.fill = EDITED_FILL;
        });
        const roomText = item.room ? roomLabel(item.room) + (item.roomFromLookup ? ' (BOQ per ruangan)' : '') : NO_ROOM;
        const checked = !!item.custom || !!override?.checked;
        const extraValues = [roomText, ...(fieldCheck ? [item.custom ? 'Tambahan' : checked ? 'Ada' : 'Belum dicek'] : []), item.note || ''];
        extraValues.forEach((value, index) => { row.getCell(width + index + 1).value = value; fit(width + index + 1, value); });
        if (fieldCheck && checked) row.getCell(width + 2).fill = CHECKED_FILL;
        for (let column = 1; column <= photoStart + photoColumns; column++) styleCell(row.getCell(column));
        if (photos.length) row.height = PHOTO_ROW_PT;
        photos.forEach((ref, photoIndex) => {
          const cell = row.getCell(photoStart + photoIndex + 1);
          const key = ref.itemId + '/' + ref.photo.id;
          const thumb = thumbs.get(key);
          if (!thumb) { cell.value = 'Foto gagal dimuat' + (failures.has(key) ? ': ' + failures.get(key) : ''); return; }
          const scale = Math.min(PHOTO_BOX.width / thumb.width, PHOTO_BOX.height / thumb.height);
          const imageWidth = Math.round(thumb.width * scale);
          const imageHeight = Math.round(thumb.height * scale);
          const imageId = workbook.addImage({ base64: thumb.base64, extension: 'jpeg' });
          sheet.addImage(imageId, {
            tl: { col: photoStart + photoIndex + (PHOTO_COL_PX - imageWidth) / 2 / PHOTO_COL_PX, row: rowNumber - 1 + (PHOTO_ROW_PX - imageHeight) / 2 / PHOTO_ROW_PX },
            ext: { width: imageWidth, height: imageHeight },
            editAs: 'oneCell',
          });
        });
      }
    }
    for (let column = 1; column <= photoStart; column++) sheet.getColumn(column).width = widths.get(column) || 8;
    for (let index = 0; index < photoColumns; index++) sheet.getColumn(photoStart + index + 1).width = PHOTO_COL_WIDTH;
  }

  // Deleted items with who deleted them, so the field check can be reviewed.
  if (deletedItems.length) {
    const sheet = workbook.addWorksheet(sheetNameFor('Item Dihapus', usedNames));
    sheet.columns = [
      { header: 'No', width: 5 }, { header: 'Equipment', width: 26 }, { header: 'CI Name', width: 36 }, { header: 'Ruangan', width: 22 },
      { header: 'Catatan Excel', width: 30 }, { header: 'Dihapus oleh', width: 24 }, { header: 'Waktu', width: 18 },
    ];
    sheet.getRow(1).eachCell(cell => { styleCell(cell); cell.fill = HEADER_FILL; cell.font = { ...FONT, bold: true }; });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const ordered = [...deletedItems].sort((a, b) => sheetNames.indexOf(a.sheet) - sheetNames.indexOf(b.sheet) || a.sourceRow - b.sourceRow);
    ordered.forEach((item, index) => {
      const override = overrides[item.id];
      const when = override.updatedAt?.toMillis?.();
      sheet.addRow([
        index + 1, item.sheet, override.ciName || item.ciName, item.room ? roomLabel(item.room) : NO_ROOM, item.note || '',
        override.updatedByName || '', when ? new Date(when).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '',
      ]).eachCell({ includeEmpty: true }, styleCell);
    });
  }

  const fileName = `BOQ_Drafter_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
  return {
    fileName,
    itemCount: exportItems.length,
    sheetCount,
    photoCount: allPhotos.length,
    failedPhotos: [...thumbs.values()].filter(thumb => !thumb).length,
    warnings,
  };
}
