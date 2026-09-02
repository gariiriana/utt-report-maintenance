// ============================================================================
// FILE: frontend/types/serviceReportTypes.ts
// Deskripsi: Unified Type Definitions & Data Structures untuk 23 Jenis Service Report
//            DwimitraSystem Data Center Maintenance.
// ============================================================================

export interface UniversalCustomerInfo {
  companyName: string;
  mopNo: string;
  equipmentName: string;
  serialNo: string;
  quarter: string;
  ciDescription: string;
  productName: string;
  location: string;
  date: string;
  ciName: string;
  prodYear: string;
  area: string;
  engineer: string;
  serviceType?: string;      // Installation, T&C, Preventive maintenance, Repair, Others
  contractType?: string;     // Warranty, Contract, Invoice
  specification?: string;
  model?: string;
}

export interface UniversalTimeSpent {
  date: string;
  departure: string;
  arrival: string;
  start: string;
  finish: string;
}

export interface UniversalOperationStatus {
  isNormal: boolean;
  remark: string;
  faultSymptom: string;
  faultAnalysis: string;
  workDone: string;
  faultPartSN: string;
  faultPartName: string;
}

export interface VisualCheckItem {
  no: string;
  activity: string;
  parameter: string;
  condition: 'Good' | 'Not Good' | 'N/A';
  remarks: string;
}

export interface ServiceReportPayload {
  equipmentKey: string;
  equipmentName: string;
  accountEmail: string;
  customerInfo: UniversalCustomerInfo;
  timeSpent: UniversalTimeSpent;
  operationStatus: UniversalOperationStatus;
  visualChecklist: VisualCheckItem[];
  measurements: Record<string, any>;
  customSections?: Array<{
    title: string;
    items: Array<{ key: string; label: string; value: string; standard?: string; unit?: string; remarks?: string }>;
  }>;
  updatedAt?: any;
}
