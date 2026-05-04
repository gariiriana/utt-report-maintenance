export interface FindingPhoto {
  base64: string;
  description: string;
}

export interface FindingRecord {
  id: string;
  partName: string;
  partNumber: string;
  brandName: string;
  quantity: number | string;
  photos: FindingPhoto[];
  remark: string;
  createdBy: string;
  createdByEmail: string;
  createdAt: any;
  findingDate?: string;
}
