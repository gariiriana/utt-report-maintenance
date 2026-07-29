export interface CapacitorbankCustomerInfo {
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

export interface CapacitorbankChecklistItem {
  no: string;
  activity: string;
  parameter: string;
  isGood: boolean;
  isNotGood: boolean;
  isNA: boolean;
  remarks: string;
}

export interface CapacitorbankVoltageAmpereMeasurement {
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

export interface CapacitorbankThermalMeasurement {
  breakerResult: string;
  standard: string;
  remarks: string;
}

export interface CapacitorbankGroundingMeasurement {
  groundingResult: string;
  standard: string;
  remarks: string;
}

export interface CapacitorbankCapacitanceMeasurement {
  capacitanceResult: string;
  standard: string;
  remarks: string;
}

export interface CapacitorbankAnalysis {
  remark: string;
  faultSymptom: string;
  faultAnalysis: string;
  workDone: string;
  faultPartSN: string;
}

export interface CapacitorbankTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export interface CapacitorbankReportData {
  customerInfo: CapacitorbankCustomerInfo;
  visualInspection: CapacitorbankChecklistItem[];
  cleaning: CapacitorbankChecklistItem[];
  voltageAmpere: CapacitorbankVoltageAmpereMeasurement;
  thermal: CapacitorbankThermalMeasurement;
  grounding: CapacitorbankGroundingMeasurement;
  capacitance: CapacitorbankCapacitanceMeasurement;
  analysis: CapacitorbankAnalysis;
  timeSpent: CapacitorbankTimeSpent;
}

export const DEFAULT_CAPACITORBANK_CUSTOMER_INFO: CapacitorbankCustomerInfo = {
  companyName: 'NeutraDC Cikarang',
  equipmentName: 'Panel APFCR',
  ciDescription: 'Panel Utility',
  ciName: '',
  type: '',
  serialNo: '',
  productName: '',
  productYears: '',
  specification: '',
  location: '',
  area: '',
  mopNo: 'DME-TDE/MOP/APCR/03 1206/26',
  quarter: 'Q3',
  date: '',
  engineer: '',
};

export const DEFAULT_CAPACITORBANK_VISUAL_ITEMS: CapacitorbankChecklistItem[] = [
  { no: '1.1', activity: 'Perform a visual inspection and check the PFC/varimetric regulator settings', parameter: 'Panel good positioning', isGood: true, isNotGood: false, isNA: false, remarks: 'Posisi panel baik' },
  { no: '1.2', activity: 'Inspection and check current (A) at general incomer to the capasitor bank using Clamp Meter', parameter: 'No damage in the part panel', isGood: true, isNotGood: false, isNA: false, remarks: 'Arus incomer normal' },
  { no: '1.3', activity: 'Inspection and check current at incomer to each step with forcing of step', parameter: 'Good function no damage', isGood: true, isNotGood: false, isNA: false, remarks: 'Setiap step berfungsi' },
  { no: '1.4', activity: 'Inspection and check THDv/i using Power Quality Analyzer while the capacitor bank operating', parameter: 'There is no indication of scorching due to excessive heat', isGood: true, isNotGood: false, isNA: false, remarks: 'Harmonisa THD normal' },
  { no: '1.5', activity: 'Inspection and check capasitors are discharged', parameter: 'Tightness, good connection', isGood: true, isNotGood: false, isNA: false, remarks: 'Kapasitor discharged' },
  { no: '1.6', activity: 'Inspection and check condition of components (capasitors, switches and fuses)', parameter: 'There is no indication excessive heat', isGood: true, isNotGood: false, isNA: false, remarks: 'Komponen mulus' },
  { no: '1.7', activity: 'Inspection capacitance values with capacitance meter', parameter: 'Marking no movement', isGood: true, isNotGood: false, isNA: false, remarks: 'Nilator bagus' },
  { no: '1.8', activity: 'Inspection for any physical abnormalities, such as swelling or leaks, that would indicate failure', parameter: 'Clean and clear', isGood: true, isNotGood: false, isNA: false, remarks: 'Tidak ada kembung/bocor' },
  { no: '1.9', activity: 'Cleaning, remove object from top of controller using vacuum cleaner', parameter: 'Clean and clear', isGood: true, isNotGood: false, isNA: false, remarks: 'Controller bersih' },
  { no: '1.10', activity: 'Inspection DPM, and make sure measurement on reading in DPM', parameter: 'Measurement match with actual measuring', isGood: true, isNotGood: false, isNA: false, remarks: 'Pembacaan DPM akurat' },
  { no: '1.11', activity: 'Inspect for access gaps in the panel that could allow dust and water to enter, make sure there are no holes by using sealant', parameter: 'Good condition, no gaps', isGood: true, isNotGood: false, isNA: false, remarks: 'Panel tertutup rapat' },
];

export const DEFAULT_CAPACITORBANK_CLEANING_ITEMS: CapacitorbankChecklistItem[] = [
  { no: '1.', activity: 'Cleaning/dust removal from ventilation system and the whole of the bank', parameter: 'Clean and clear', isGood: true, isNotGood: false, isNA: false, remarks: 'Sistem ventilasi bersih' },
  { no: '2.', activity: 'Clean the chassis of dust and dirt using a vacuum or dry cloth.', parameter: 'Clean and clear', isGood: true, isNotGood: false, isNA: false, remarks: 'Chassis bersih' },
  { no: '3.', activity: 'Clean the operating mechanism of dust and dirt', parameter: 'Clean and clear', isGood: true, isNotGood: false, isNA: false, remarks: 'Mekanisme bersih' },
  { no: '4.', activity: 'Clean the surface of the busbar from dust using dry cloth or vacuum', parameter: 'Clean and clear', isGood: true, isNotGood: false, isNA: false, remarks: 'Busbar mengkilap' },
  { no: '5.', activity: 'Clean the fan and ventilation grill using vacuum cleaner', parameter: 'Clean and clear', isGood: true, isNotGood: false, isNA: false, remarks: 'Kipas & grill bersih' },
];

export const DEFAULT_CAPACITORBANK_VOLTAGE_AMPERE: CapacitorbankVoltageAmpereMeasurement = {
  voltageRS: '395',
  voltageST: '396',
  voltageTR: '395',
  voltageRN: '228',
  voltageSN: '229',
  voltageTN: '228',
  voltageNG: '1.2',
  ampereR: '42.5',
  ampereS: '43.1',
  ampereT: '42.0',
  ampereN: '0.4',
  standard: '+5% - 10% from 380V & 220V load deviation 10%',
  remarks: 'Normal & seimbang',
};

export const DEFAULT_CAPACITORBANK_THERMAL: CapacitorbankThermalMeasurement = {
  breakerResult: '34.2',
  standard: '<40°C',
  remarks: 'Suhu aman & teratur',
};

export const DEFAULT_CAPACITORBANK_GROUNDING: CapacitorbankGroundingMeasurement = {
  groundingResult: '0.38',
  standard: '<5 Ω',
  remarks: 'Sesuai standar',
};

export const DEFAULT_CAPACITORBANK_CAPACITANCE: CapacitorbankCapacitanceMeasurement = {
  capacitanceResult: '48.5',
  standard: 'Capacitance value, 10% of nameplate value.',
  remarks: 'Kapasitansi normal',
};

export const DEFAULT_CAPACITORBANK_ANALYSIS: CapacitorbankAnalysis = {
  remark: 'Panel APFCR / Capacitor Bank dalam kondisi baik dan faktor daya beroperasi optimal.',
  faultSymptom: '',
  faultAnalysis: '',
  workDone: '',
  faultPartSN: '',
};

export const DEFAULT_CAPACITORBANK_TIME_SPENT: CapacitorbankTimeSpent = {
  date: new Date().toISOString().split('T')[0],
  departure: '08:00',
  start: '08:30',
  finish: '10:30',
};
