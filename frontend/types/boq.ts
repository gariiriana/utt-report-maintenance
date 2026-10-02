export interface RoomBOQItem {
  id: string; sourceSheet: string; sourceRow: number; sourceRows?: number[];
  room: string; classId: string; ciName: string; ciDescription: string;
  capacity: string; model: string; floor: string;
  serialNumber?: string; productionYear?: string; manufacturer?: string;
  assetId?: string; tag?: string; version?: string;
  // Items added by a drafter live only in Firestore (`custom: true`), not in the bundled workbook.
  custom?: boolean;
}
export type BOQFields = Pick<RoomBOQItem, 'ciName' | 'ciDescription' | 'capacity' | 'serialNumber' | 'productionYear' | 'manufacturer'>;
// `deleted` is a soft-delete tombstone; room/classId/floor are only stored on custom items.
export interface BOQOverride extends BOQFields { revision: number; deleted?: boolean; custom?: boolean; room?: string; classId?: string; floor?: string }
export interface NewBOQItemInput extends BOQFields { room: string; classId: string; floor: string }
export interface BOQPhoto {
  id: string; path: string; name: string; size: number; contentType: string; uploadedBy: string;
  storageType?: 'firestore-bytes' | 'firebase-storage'; totalChunks?: number;
}
