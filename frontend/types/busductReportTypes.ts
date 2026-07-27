export interface BusductCustomerInfo {
  companyName: string;
  type: string;
  specification: string;
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
}

export interface BusductInspectionItem {
  no: string;
  activity: string;
  parameter: string;
  isGood: boolean;
  isNotGood: boolean;
  remarks: string;
}

export interface BusductCleaningItem {
  no: string;
  activity: string;
  parameter: string;
  isGood: boolean;
  isNotGood: boolean;
  remarks: string;
}

export interface BusductThermalItem {
  breaker: string;
  resultTemp: string;
  standard: string;
  remarks: string;
}

export interface BusductAnalysisData {
  isNormal: boolean;
  isAbnormal: boolean;
  remark: string;
  faultSymptom: string;
  faultAnalysis: string;
  workDone: string;
  faultPartSN: string;
  faultPartName: string;
}

export interface BusductTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export interface BusductReportData {
  customerInfo: BusductCustomerInfo;
  visualInspection: BusductInspectionItem[];
  cleaning: BusductCleaningItem[];
  thermal: BusductThermalItem;
  analysis: BusductAnalysisData;
  timeSpent: BusductTimeSpent;
}

export const DEFAULT_BUSDUCT_CUSTOMER_INFO: BusductCustomerInfo = {
  companyName: 'NeutraDC Cikarang',
  type: 'IEC 61439-6',
  specification: '4000A',
  mopNo: 'DME-TDE/MOP/BDT/02 2805/26',
  equipmentName: 'BUSDUCT',
  serialNo: 'AC-002',
  quarter: 'Q2',
  ciDescription: 'Line Busduct',
  productName: 'N/A',
  location: 'Data Center',
  date: new Date().toISOString().split('T')[0],
  ciName: '',
  prodYear: '2022',
  area: 'Building Data Center',
  engineer: '',
};

export const DEFAULT_BUSDUCT_VISUAL_ITEMS: BusductInspectionItem[] = [
  { no: '1.1', activity: 'Inspection & Checked of door movement', parameter: 'Door operates smoothly', isGood: true, isNotGood: false, remarks: 'Sesuai standar' },
  { no: '1.2', activity: 'Inspection & Checked of signs of waer, rust, dents, and damageon door tracks', parameter: 'Door tracks are free from excessive wear', isGood: true, isNotGood: false, remarks: 'Kondisi bersih & terawat' },
  { no: '1.3', activity: 'Inspection & Checked door tracks are aligned and not sagging', parameter: 'Door tracks are properly aligned, straight, and not sagging', isGood: true, isNotGood: false, remarks: 'Rapi & simetris' },
  { no: '1.4', activity: 'Inspection & Checked of door parts for any signs of damage (spring, motor, frame, cover)', parameter: 'All door components (spring, motor, frame, cover)', isGood: true, isNotGood: false, remarks: 'Utuh & berfungsi baik' },
  { no: '1.5', activity: 'Inspection & Checked of Bumper , Rubber Lip and Lip hinge', parameter: 'Bumper, rubber lip, and lip hinge are intact', isGood: true, isNotGood: false, remarks: 'Utuh & tidak retak' },
  { no: '1.6', activity: 'Inspection & Checked of Controller Swicth button', parameter: 'Controller switch buttons are fully functional', isGood: true, isNotGood: false, remarks: 'Berfungsi normal' },
  { no: '1.7', activity: 'Check Motor Condition, Check motor body for overheating, Listen for abnormal sound, Check cable connection', parameter: 'Motor runs normally without overheating', isGood: true, isNotGood: false, remarks: 'Suara halus & normal' },
  { no: '1.8', activity: 'Check Base Frame, Shaft & Door Alignment Base Frame', parameter: 'Base Frame & Door Alignment', isGood: true, isNotGood: false, remarks: 'Presisi & kokoh' },
  { no: '1.9', activity: 'Motor & Gearbox Inspection', parameter: 'Mounting bolts are tight. Cables are in good condition', isGood: true, isNotGood: false, remarks: 'Baut kencang & kabel rapi' },
  { no: '2.0', activity: 'Check Roller Shutter Kit', parameter: 'No wear, corrosion, or damage', isGood: true, isNotGood: false, remarks: 'Bebas aus & korosi' },
];

export const DEFAULT_BUSDUCT_CLEANING_ITEMS: BusductCleaningItem[] = [
  { no: '1.1', activity: 'Cleaning Of Electrical Panel & Electrrical Swicth button', parameter: 'The outer surface of the busduct is free of dust, dirt, and debris', isGood: true, isNotGood: false, remarks: 'Bersih dari debu' },
  { no: '1.2', activity: 'Clean the door tracks from dust, dirt, and debris using a brush or cloth', parameter: 'The insulation and protective barriers are in good condition', isGood: true, isNotGood: false, remarks: 'Bersih & bebas kotoran' },
];

export const DEFAULT_BUSDUCT_THERMAL: BusductThermalItem = {
  breaker: 'Joint Busduct',
  resultTemp: '32.5',
  standard: '<40°C',
  remarks: 'Suhu normal & aman',
};

export const DEFAULT_BUSDUCT_ANALYSIS: BusductAnalysisData = {
  isNormal: true,
  isAbnormal: false,
  remark: 'Panel Busduct beroperasi secara normal, koneksi joint kencang, suhu joint dalam batas aman (<40°C), dan area sekitar bersih dari debu.',
  faultSymptom: '',
  faultAnalysis: '',
  workDone: '',
  faultPartSN: '',
  faultPartName: '',
};

export const DEFAULT_BUSDUCT_TIME_SPENT: BusductTimeSpent = {
  date: new Date().toISOString().split('T')[0],
  departure: '08:00',
  start: '08:30',
  finish: '11:30',
};
