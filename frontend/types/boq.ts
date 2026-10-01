export interface RoomBOQItem {
  id: string; sourceSheet: string; sourceRow: number; sourceRows?: number[];
  room: string; classId: string; ciName: string; ciDescription: string;
  capacity: string; model: string; floor: string;
  serialNumber?: string; productionYear?: string; manufacturer?: string;
  assetId?: string; tag?: string; version?: string;
}
export type BOQFields = Pick<RoomBOQItem, 'ciName' | 'ciDescription' | 'capacity' | 'serialNumber' | 'productionYear' | 'manufacturer'>;
export interface BOQOverride extends BOQFields { revision: number }
export interface BOQPhoto {
  id: string; path: string; name: string; size: number; contentType: string; uploadedBy: string;
  storageType?: 'firestore-bytes' | 'firebase-storage'; totalChunks?: number;
}
