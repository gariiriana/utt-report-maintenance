import type { Bytes } from 'firebase/firestore';
// Text fields a drafter can correct; each maps onto the matching BOQ column when the table has one.
export type BOQEditableField = 'ciName' | 'ciDescription' | 'capacity' | 'serialNumber' | 'productionYear' | 'manufacturer' | 'assetId' | 'tag' | 'model';
export type BOQColumnField = BOQEditableField | 'no' | 'classId' | 'room' | 'floor';
export interface BOQColumn { label: string; field?: BOQColumnField }
// One asset table of the BOQ workbook (a sheet, or a second table further down a sheet).
export interface BOQTable { id: string; sheet: string; sheetKey: string; headerRow: number; title: string; columns: BOQColumn[] }
export type BOQFields = Record<BOQEditableField, string>;
export interface BOQItem extends BOQFields {
  id: string;
  tableId: string;
  sheet: string;
  // Sheet key for workbook items, 'CUSTOM' for items added in the app.
  sourceSheet: string;
  sourceRow: number;
  sourceRows?: number[];
  section?: string;
  // Original cell values, aligned with the table's columns (empty for custom items).
  values: string[];
  room: string;
  // True when the room comes from the earlier "BOQ PER RUANGAN" workbook because this sheet has no room.
  roomFromLookup: boolean;
  floor: string;
  classId: string;
  // Items added by a drafter live only in Firestore (`custom: true`), not in the bundled workbook.
  custom?: boolean;
}
// `deleted` is a soft-delete tombstone; room/classId/floor/category are only stored on custom items.
export interface BOQOverride extends Partial<BOQFields> {
  ciName: string; ciDescription: string; capacity: string;
  revision: number; deleted?: boolean; custom?: boolean; room?: string; classId?: string; floor?: string; category?: string;
  updatedByName?: string;
}
export interface NewBOQItemInput extends BOQFields { room: string; classId: string; floor: string; category: string }
export interface BOQPhoto {
  id: string; path: string; name: string; size: number; contentType: string; uploadedBy: string;
  storageType?: 'firestore-bytes' | 'firebase-storage'; totalChunks?: number;
  // Small JPEG preview (photos uploaded before thumbnails existed have none).
  thumb?: Bytes;
}
