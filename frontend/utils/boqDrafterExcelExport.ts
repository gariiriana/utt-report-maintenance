import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Bytes } from 'firebase/firestore';
import { customBOQItemOf, getBOQPhotoBlob, readAllBOQOverrides, readAllBOQPhotoRefs, readBOQItemPhotoRefs, type BOQPhotoRef } from '@/api/boq';
import type { BOQEditableField, BOQItem, BOQOverride } from '@/types/boq';
import { BOQ_EDITABLE_FIELDS, NO_ROOM, cellValue, roomKeyOf, roomLabelsOf, tableOf, tableOrder } from './boqCatalog';

const THUMB_EDGE = 480;
const THUMB_QUALITY = 0.75;
const PHOTO_COL_WIDTH = 24;
const PHOTO_COL_PX = PHOTO_COL_WIDTH * 7 + 5;
const PHOTO_ROW_PT = 96;
const PHOTO_ROW_PX = Math.round(PHOTO_ROW_PT * 4 / 3);
const PHOTO_BOX = { width: 160, height: 120 };
// Every sheet of the BOQ has its own columns; the export keeps the shared ones as columns and
// lists the remaining non-empty BOQ columns of each row in "Data BOQ lainnya".
const COLUMNS: { header: string; width: number; field?: BOQEditableField }[] = [
  { header: 'No', width: 5 }, { header: 'Room', width: 20 }, { header: 'Kategori', width: 20 }, { header: 'Class Id', width: 20 },
  { header: 'CI Name*', width: 34, field: 'ciName' }, { header: 'CI Description*', width: 34, field: 'ciDescription' },
  { header: 'Capacity', width: 16, field: 'capacity' }, { header: 'Serial Number', width: 22, field: 'serialNumber' },
  { header: 'Production Year', width: 12, field: 'productionYear' }, { header: 'Manufacturer / Principle', width: 22, field: 'manufacturer' },
  { header: 'Asset ID', width: 16, field: 'assetId' }, { header: 'TAG', width: 16, field: 'tag' }, { header: 'Model/Version', width: 20, field: 'model' },
  { header: 'Floor', width: 8 }, { header: 'Data BOQ lainnya', width: 44 },
];
const TEXT_COLUMNS = COLUMNS.length;
const SHARED_FIELDS = new Set<string>([...BOQ_EDITABLE_FIELDS, 'no', 'classId', 'room', 'floor']);
const FONT: Partial<ExcelJS.Font> = { name: 'Times New Roman', size: 10, color: { argb: 'FF000000' } };
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

interface Entry { item: BOQItem; override?: BOQOverride; photos: BOQPhotoRef[] }
interface Thumb { base64: string; width: number; height: number }
export interface BOQExportResult { fileName: string; itemCount: number; roomCount: number; photoCount: number; failedPhotos: number; warnings: string[] }

const otherColumns = (item: BOQItem, override?: BOQOverride) => tableOf(item).columns
  .map((column, index) => ({ column, value: cellValue(item, index, override) }))
  .filter(({ column, value }) => value && !SHARED_FIELDS.has(column.field || ''))
  .map(({ column, value }) => `${column.label}: ${value}`)
  .join('\n');

function sheetNameFor(room: string, used: Set<string>) {
  const base = (room.replace(/[\\/?*[\]:]/g, '-').replace(/^'+|'+$/g, '').trim() || NO_ROOM).slice(0, 31);
  let name = base;
  for (let n = 2; used.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
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

  // Added items live only in Firestore; deleted ones keep a tombstone and are left out.
  const customItems = Object.entries(overrides).filter(([, value]) => value.custom).map(([id, value]) => customBOQItemOf(id, value));
  const exportItems = [...items, ...customItems].filter(item => !overrides[item.id]?.deleted);

  // Grouped like the page: case-insensitive room key, labelled with the same spelling.
  const rooms = new Map<string, Entry[]>();
  const roomLabels = roomLabelsOf(exportItems);
  const sorted = [...exportItems].sort((a, b) => tableOrder(a.tableId) - tableOrder(b.tableId) || a.sourceRow - b.sourceRow);
  for (const item of sorted) {
    const key = roomKeyOf(item.room);
    const room = key ? roomLabels.get(key)! : NO_ROOM;
    rooms.set(room, [...(rooms.get(room) || []), { item, override: overrides[item.id], photos: photosByItem.get(item.id) || [] }]);
  }

  const allPhotos = [...rooms.values()].flat().flatMap(entry => entry.photos);
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
  const roomNames = [...rooms.keys()].sort((a, b) => (a === NO_ROOM ? 1 : b === NO_ROOM ? -1 : a.localeCompare(b, 'id', { numeric: true })));

  for (const room of roomNames) {
    const entries = rooms.get(room)!;
    const sheet = workbook.addWorksheet(sheetNameFor(room, usedNames));
    const photoColumns = Math.max(0, ...entries.map(entry => entry.photos.length));
    const headers = [...COLUMNS.map(column => column.header), ...Array.from({ length: photoColumns }, (_, index) => `Foto ${index + 1}`)];
    sheet.columns = headers.map((header, index) => ({ header, width: index < TEXT_COLUMNS ? COLUMNS[index].width : PHOTO_COL_WIDTH }));

    const header = sheet.getRow(1);
    header.eachCell(cell => {
      cell.font = FONT;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B0F0' } };
      cell.border = BORDER;
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: TEXT_COLUMNS } };

    entries.forEach((entry, index) => {
      const { item, override, photos } = entry;
      const rowNumber = index + 2;
      const row = sheet.getRow(rowNumber);
      const fixed: Record<string, string | number> = {
        'No': index + 1,
        'Room': item.room ? item.room + (item.roomFromLookup ? ' (BOQ per ruangan)' : '') : NO_ROOM,
        'Kategori': item.sheet + (item.section ? ' — ' + item.section : ''),
        'Class Id': item.classId, 'Floor': item.floor, 'Data BOQ lainnya': otherColumns(item, override),
      };
      COLUMNS.forEach((column, columnIndex) => {
        row.getCell(columnIndex + 1).value = column.field ? override?.[column.field] ?? item[column.field] : fixed[column.header];
      });
      for (let column = 1; column <= TEXT_COLUMNS + photoColumns; column++) {
        const cell = row.getCell(column);
        cell.font = FONT;
        cell.border = BORDER;
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      }
      if (override && !item.custom) {
        COLUMNS.forEach((column, columnIndex) => {
          if (!column.field || (override[column.field] ?? item[column.field]) === item[column.field]) return;
          row.getCell(columnIndex + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
        });
      }
      if (photos.length) row.height = PHOTO_ROW_PT;
      photos.forEach((ref, photoIndex) => {
        const cell = row.getCell(TEXT_COLUMNS + photoIndex + 1);
        const key = ref.itemId + '/' + ref.photo.id;
        const thumb = thumbs.get(key);
        if (!thumb) { cell.value = 'Foto gagal dimuat' + (failures.has(key) ? ': ' + failures.get(key) : ''); return; }
        const fit = Math.min(PHOTO_BOX.width / thumb.width, PHOTO_BOX.height / thumb.height);
        const width = Math.round(thumb.width * fit);
        const height = Math.round(thumb.height * fit);
        const imageId = workbook.addImage({ base64: thumb.base64, extension: 'jpeg' });
        sheet.addImage(imageId, {
          tl: { col: TEXT_COLUMNS + photoIndex + (PHOTO_COL_PX - width) / 2 / PHOTO_COL_PX, row: rowNumber - 1 + (PHOTO_ROW_PX - height) / 2 / PHOTO_ROW_PX },
          ext: { width, height },
          editAs: 'oneCell',
        });
      });
    });
  }

  const fileName = `BOQ_Drafter_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
  return {
    fileName,
    itemCount: [...rooms.values()].reduce((total, entries) => total + entries.length, 0),
    roomCount: rooms.size,
    photoCount: allPhotos.length,
    failedPhotos: [...thumbs.values()].filter(thumb => !thumb).length,
    warnings,
  };
}
