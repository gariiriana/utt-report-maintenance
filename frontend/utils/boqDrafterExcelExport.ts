import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { customBOQItemOf, getBOQPhotoBlob, readAllBOQOverrides, readAllBOQPhotoRefs, readBOQItemPhotoRefs, type BOQPhotoRef } from '@/api/boq';
import type { BOQFields, BOQOverride, RoomBOQItem } from '@/types/boq';

const NO_ROOM = 'Tanpa Ruangan';
const THUMB_EDGE = 480;
const THUMB_QUALITY = 0.75;
const PHOTO_COL_WIDTH = 24;
const PHOTO_COL_PX = PHOTO_COL_WIDTH * 7 + 5;
const PHOTO_ROW_PT = 96;
const PHOTO_ROW_PX = Math.round(PHOTO_ROW_PT * 4 / 3);
const PHOTO_BOX = { width: 160, height: 120 };
const TEXT_COLUMNS = 11;
const EDITABLE: (keyof BOQFields)[] = ['ciName', 'ciDescription', 'capacity', 'serialNumber', 'productionYear', 'manufacturer'];
const COLUMNS: { header: string; width: number }[] = [
  { header: 'No', width: 5 }, { header: 'Room', width: 18 }, { header: 'Class Id', width: 32 },
  { header: 'CI Name*', width: 34 }, { header: 'CI Description*', width: 38 }, { header: 'Capacity', width: 16 },
  { header: 'Model/Version', width: 20 }, { header: 'Floor', width: 8 }, { header: 'Serial Number', width: 22 },
  { header: 'Production Year', width: 12 }, { header: 'Manufacturer / Principle', width: 24 },
];
const FONT: Partial<ExcelJS.Font> = { name: 'Times New Roman', size: 10, color: { argb: 'FF000000' } };
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

interface Entry { item: RoomBOQItem; override?: BOQOverride; photos: BOQPhotoRef[] }
interface Thumb { base64: string; width: number; height: number }
export interface BOQExportResult { fileName: string; itemCount: number; roomCount: number; photoCount: number; failedPhotos: number; warnings: string[] }

const roomOf = (item: RoomBOQItem) => {
  const room = item.room?.trim();
  return !room || room.toUpperCase() === 'N/A' ? NO_ROOM : room;
};

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

export async function exportDrafterBOQExcel(items: RoomBOQItem[], onProgress: (message: string) => void): Promise<BOQExportResult> {
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

  const rooms = new Map<string, Entry[]>();
  for (const item of exportItems) {
    const override = overrides[item.id];
    const photos = photosByItem.get(item.id) || [];
    const room = roomOf(item);
    rooms.set(room, [...(rooms.get(room) || []), { item, override, photos }]);
  }

  const allPhotos = [...rooms.values()].flat().flatMap(entry => entry.photos);
  const thumbs = new Map<string, Thumb | null>();
  let done = 0;
  await runPool(allPhotos, 4, async ref => {
    const key = ref.itemId + '/' + ref.photo.id;
    try { thumbs.set(key, await toThumbnail(await getBOQPhotoBlob(ref.photo))); }
    catch { thumbs.set(key, null); }
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
      const value = { ...item, ...override };
      const rowNumber = index + 2;
      const row = sheet.getRow(rowNumber);
      [index + 1, roomOf(item), item.classId, value.ciName, value.ciDescription, value.capacity, item.model, item.floor, value.serialNumber || '', value.productionYear || '', value.manufacturer || '']
        .forEach((cellValue, column) => { row.getCell(column + 1).value = cellValue; });
      for (let column = 1; column <= TEXT_COLUMNS + photoColumns; column++) {
        const cell = row.getCell(column);
        cell.font = FONT;
        cell.border = BORDER;
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      }
      if (override) {
        for (const field of EDITABLE) {
          if ((override[field] ?? '') === (item[field] ?? '')) continue;
          const column = { ciName: 4, ciDescription: 5, capacity: 6, serialNumber: 9, productionYear: 10, manufacturer: 11 }[field];
          row.getCell(column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
        }
      }
      if (photos.length) row.height = PHOTO_ROW_PT;
      photos.forEach((ref, photoIndex) => {
        const cell = row.getCell(TEXT_COLUMNS + photoIndex + 1);
        const thumb = thumbs.get(ref.itemId + '/' + ref.photo.id);
        if (!thumb) { cell.value = 'Foto gagal dimuat'; return; }
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
