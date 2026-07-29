export interface CMSparepartItem {
  no?: number;
  name: string;
  brand: string;
  qty: string;
}

export interface CMPhotoItem {
  photoBase64: string;
  description?: string;
}

export interface CMReportData {
  id?: string;
  reportType?: 'CM_STANDARD' | 'SLA' | 'CM_PDF';
  
  // Page 1: Incident & Equipment Info
  incidentName: string;
  location: string;
  incidentDate: string;
  incidentId: string;
  
  equipmentName: string;
  brand: string;
  serialNumber: string;
  installationDate: string;
  
  // Page 1: Action & Inspection
  correctiveAction: string;
  repairTimeStart: string;
  repairTimeEnd: string;
  result: string;
  
  visualInspectionChecking: string;
  cleaningPreventiveMethod: string;
  summaryProblemAnalysis: string;
  
  // Page 2: Spareparts & Documentation Photos
  spareparts: CMSparepartItem[];
  photos: CMPhotoItem[];
  
  // Page 3: Author & Signatures
  authorName: string;
  preparedByName: string;
  preparedByTitle: string;
  reviewedByName: string;
  reviewedByTitle: string;
  acknowledgedBy1Name: string;
  acknowledgedBy1Title: string;
  acknowledgedBy2Name: string;
  acknowledgedBy2Title: string;
  approvedByName: string;
  approvedByTitle: string;
  
  // System Metadata
  reportedBy?: string;
  reportedByEmail?: string;
  reportedAt?: any;
  createdAt?: any;
}
