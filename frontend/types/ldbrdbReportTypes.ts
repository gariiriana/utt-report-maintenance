export interface LdbrdbCustomerInfo {
  companyName: string;
  equipmentName: string;
  ciDescription: string;
  ciName: string;
  type: string;
  serialNo: string;
  productName: string;
  productYears: string;
  specification: string;
  location: string;
  area: string;
  mopNo: string;
  quarter: string;
  date: string;
  engineer: string;
}

export interface LdbrdbChecklistItem {
  no: string;
  activity: string;
  parameter: string;
  isGood: boolean;
  isNotGood: boolean;
  isNA: boolean;
  remarks: string;
}

export interface LdbrdbDigitalPowerMeter {
  voltageRS: string;
  voltageST: string;
  voltageTR: string;
  voltageRN: string;
  voltageSN: string;
  voltageTN: string;
  kw: string;
  kvar: string;
  kva: string;
  cosp: string;
  ampereR: string;
  ampereS: string;
  ampereT: string;
  remarks: string;
}

export interface LdbrdbVoltageAmpereMeasurement {
  voltageRS: string;
  voltageST: string;
  voltageTR: string;
  voltageRN: string;
  voltageSN: string;
  voltageTN: string;
  voltageNG: string;
  ampereR: string;
  ampereS: string;
  ampereT: string;
  ampereN: string;
  standard: string;
  remarks: string;
}

export interface LdbrdbThermalMeasurement {
  breakerResult: string;
  standard: string;
  remarks: string;
}

export interface LdbrdbGroundingMeasurement {
  groundingResult: string;
  standard: string;
  remarks: string;
}

export interface LdbrdbAnalysis {
  remark: string;
  faultSymptom: string;
  faultAnalysis: string;
  workDone: string;
  faultPartSN: string;
}

export interface LdbrdbTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export interface LdbrdbReportData {
  customerInfo: LdbrdbCustomerInfo;
  visualInspection: LdbrdbChecklistItem[];
  dpmRecording: LdbrdbDigitalPowerMeter;
  voltageAmpere: LdbrdbVoltageAmpereMeasurement;
  thermal: LdbrdbThermalMeasurement;
  grounding: LdbrdbGroundingMeasurement;
  analysis: LdbrdbAnalysis;
  timeSpent: LdbrdbTimeSpent;
}

export const DEFAULT_LDBRDB_CUSTOMER_INFO: LdbrdbCustomerInfo = {
  companyName: 'NeutraDC Cikarang',
  equipmentName: 'Panel LDB & RDB',
  ciDescription: 'Panel Utility',
  ciName: '',
  type: '',
  serialNo: '',
  productName: '',
  productYears: '',
  specification: '',
  location: '',
  area: '',
  mopNo: 'DME-TDE/MOP/BDT/02 0806/26',
  quarter: 'Q2',
  date: '',
  engineer: '',
};

export const DEFAULT_LDBRDB_VISUAL_ITEMS: LdbrdbChecklistItem[] = [
  { no: '1.1', activity: 'Inspection of support levelness used water pass to analysis positioning support panel', parameter: 'Panel good positioning', isGood: true, isNotGood: false, isNA: false, remarks: 'Posisi panel baik' },
  { no: '1.2', activity: 'Inspection & check visual all support panel like a condition paint panel, pilot lamp, chasiss panel padlock system ect.', parameter: 'No damage in the part panel', isGood: true, isNotGood: false, isNA: false, remarks: 'Komponen lengkap' },
  { no: '1.3', activity: 'Check inspection visual push bottom panel, selector switch, and display DPM', parameter: 'Good function no damage', isGood: true, isNotGood: false, isNA: false, remarks: 'Fungsi normal' },
  { no: '1.4', activity: 'Inspection visual breaker panel (MCCB, MCB), cable and wiring panel, and fuse', parameter: 'There is no indication of scorching due to excessive heat', isGood: true, isNotGood: false, isNA: false, remarks: 'Tidak ada hangus' },
  { no: '1.5', activity: 'Inspection relay, power supply unit, aux contact', parameter: 'Tightness, good connection', isGood: true, isNotGood: false, isNA: false, remarks: 'Koneksi kencang' },
  { no: '1.6', activity: 'Check condition line busbar in the termination busbar RTS using thermal imager', parameter: 'There is no indication excessive heat', isGood: true, isNotGood: false, isNA: false, remarks: 'Suhu busbar normal' },
  { no: '1.7', activity: 'Inspection visual cable connection in the terminal cable MCB / MCCB using thermal imager', parameter: 'Marking no movement', isGood: true, isNotGood: false, isNA: false, remarks: 'Marking rapi' },
  { no: '1.8', activity: 'cleaning panel used vacuum cleaner and apply sanpoly to finish cleaning body panel', parameter: 'Clean and clear', isGood: true, isNotGood: false, isNA: false, remarks: 'Body panel bersih' },
  { no: '1.9', activity: 'Cleaning, remove object from top of controller using vacuum cleaner', parameter: 'Clean and clear', isGood: true, isNotGood: false, isNA: false, remarks: 'Atas panel bersih' },
  { no: '1.10', activity: 'Inspection DPM, and make sure measurement on reading in DPM', parameter: 'Measurement match with actual measuring', isGood: true, isNotGood: false, isNA: false, remarks: 'Pembacaan DPM pas' },
  { no: '1.11', activity: 'Inspect for access gaps in the panel that could allow dust and water to enter, make sure there are no holes by using sealant', parameter: 'Good condition, no gaps', isGood: true, isNotGood: false, isNA: false, remarks: 'Sealant rapi' },
];

export const DEFAULT_LDBRDB_DPM_RECORDING: LdbrdbDigitalPowerMeter = {
  voltageRS: '395',
  voltageST: '396',
  voltageTR: '395',
  voltageRN: '228',
  voltageSN: '229',
  voltageTN: '228',
  kw: '18.5',
  kvar: '3.2',
  kva: '18.8',
  cosp: '0.98',
  ampereR: '28.5',
  ampereS: '29.1',
  ampereT: '28.0',
  remarks: 'Pembacaan DPM normal',
};

export const DEFAULT_LDBRDB_VOLTAGE_AMPERE: LdbrdbVoltageAmpereMeasurement = {
  voltageRS: '395',
  voltageST: '396',
  voltageTR: '395',
  voltageRN: '228',
  voltageSN: '229',
  voltageTN: '228',
  voltageNG: '1.2',
  ampereR: '28.5',
  ampereS: '29.1',
  ampereT: '28.0',
  ampereN: '0.3',
  standard: '+5% - 10% from 380V & 220V load deviation 10%',
  remarks: 'Tegangan & Arus normal',
};

export const DEFAULT_LDBRDB_THERMAL: LdbrdbThermalMeasurement = {
  breakerResult: '33.8',
  standard: '<40°C',
  remarks: 'Suhu pemutus normal',
};

export const DEFAULT_LDBRDB_GROUNDING: LdbrdbGroundingMeasurement = {
  groundingResult: '0.35',
  standard: '<5 Ω',
  remarks: 'Grounding bagus',
};

export const DEFAULT_LDBRDB_ANALYSIS: LdbrdbAnalysis = {
  remark: 'Panel LDB & RDB dalam kondisi bersih, aman, dan beroperasi normal.',
  faultSymptom: '',
  faultAnalysis: '',
  workDone: '',
  faultPartSN: '',
};

export const DEFAULT_LDBRDB_TIME_SPENT: LdbrdbTimeSpent = {
  date: new Date().toISOString().split('T')[0],
  departure: '08:00',
  start: '08:30',
  finish: '10:30',
};
