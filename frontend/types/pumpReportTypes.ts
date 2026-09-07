export interface PumpCustomerInfo {
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
  model?: string;
}

export interface PumpChecklistItem {
  no: string;
  activity: string;
  parameter: string;
  isGood: boolean;
  isNotGood: boolean;
  remarks: string;
}

export interface PumpVoltageCurrentData {
  rs: string;
  st: string;
  tr: string;
  rn: string;
  sn: string;
  tn: string;
  ng: string;
  r: string;
  s: string;
  t: string;
  n: string;
  standard: string;
  remarks: string;
}

export interface PumpThermalData {
  item: string;
  resultTemp: string;
  standard: string;
  remarks: string;
}

export interface PumpVibrationData {
  item: string;
  vibration: string;
  standard: string;
  remarks: string;
}

export interface PumpPressureData {
  item: string;
  resultTemp: string;
  standard: string;
  remarks: string;
}

export interface PumpGroundingData {
  wire: string;
  resultOhm: string;
  standard: string;
  remarks: string;
}

export interface PumpAnalysisData {
  isNormal: boolean;
  isAbnormal: boolean;
  remark: string;
  faultSymptom: string;
  faultAnalysis: string;
  workDone: string;
  faultPartSN: string;
  faultPartName: string;
}

export interface PumpTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export interface PumpReportData {
  customerInfo: PumpCustomerInfo;
  visualInspection: PumpChecklistItem[];
  cleaning: PumpChecklistItem[];
  voltageCurrent: PumpVoltageCurrentData;
  thermal: PumpThermalData;
  vibration: PumpVibrationData;
  pressure: PumpPressureData;
  grounding: PumpGroundingData;
  analysis: PumpAnalysisData;
  timeSpent: PumpTimeSpent;
}

export const DEFAULT_PUMP_CUSTOMER_INFO: PumpCustomerInfo = {
  companyName: 'Neutra DC Cikarang',
  type: '',
  specification: '',
  mopNo: 'DME-TDE/MOP/PUMP/02 0506/26',
  equipmentName: 'Pump',
  serialNo: '',
  quarter: 'Q2',
  ciDescription: '',
  productName: '',
  location: '',
  date: new Date().toISOString().split('T')[0],
  ciName: '',
  prodYear: '',
  area: '',
  engineer: 'pump@gmail.com',
};

export const DEFAULT_PUMP_VISUAL_ITEMS: PumpChecklistItem[] = [
  { no: 'a.', activity: 'Inspect pump body for leakage, corrosion and cracks', parameter: 'No leakage, corrosion, cracks', isGood: true, isNotGood: false, remarks: '' },
  { no: 'b.', activity: 'Check pump condition, mounting bolts, and base frame for looseness', parameter: 'good condition', isGood: true, isNotGood: false, remarks: '' },
  { no: 'c.', activity: 'Check seals, gaskets and bearings for any abnormal signs', parameter: 'no leakage or overheating', isGood: true, isNotGood: false, remarks: '' },
  { no: 'd.', activity: 'Inspect Valves Condition (Suction & Discharge)', parameter: 'no leakage, no corrosion, and positioned correctly', isGood: true, isNotGood: false, remarks: '' },
  { no: 'e.', activity: 'Check motor condition, Check mounting bolts and base frame for looseness', parameter: 'not overheating, Bolts and frame not loose.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'f.', activity: 'Check Level Sensor', parameter: 'Level normal.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'g.', activity: 'Inspect Pressure Gauge Condition', parameter: 'Gauge is not damage', isGood: true, isNotGood: false, remarks: '' },
  { no: 'h.', activity: 'Check Flexible Connection', parameter: 'Flexible is not cracked, leaking, or damaged.', isGood: true, isNotGood: false, remarks: '' },
];

export const DEFAULT_PUMP_CLEANING_ITEMS: PumpChecklistItem[] = [
  { no: 'i.', activity: 'Clean pump body and Remove debris around pump base and surrounding area', parameter: 'free of dust and dirt.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'j.', activity: 'Clean motor surface and clean ventilation holes to ensure proper cooling', parameter: 'free of dust and dirt.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'k.', activity: 'Ensure cooling fins and fan cover are free from blockage', parameter: 'fan cover are clean and unobstructed', isGood: true, isNotGood: false, remarks: '' },
  { no: 'l.', activity: 'Cleaning the Sump / Control Tank', parameter: 'Tank and is free of sludge and debris.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'm.', activity: 'cleaning the Water Trap', parameter: 'Water trap is free of sludge and debris', isGood: true, isNotGood: false, remarks: '' },
];
