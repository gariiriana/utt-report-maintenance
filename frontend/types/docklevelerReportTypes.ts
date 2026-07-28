export interface DocklevelerCustomerInfo {
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

export interface DocklevelerChecklistItem {
  no: string;
  activity: string;
  parameter: string;
  isGood: boolean;
  isNotGood: boolean;
  isNA: boolean;
  remarks: string;
}

export interface DocklevelerNoiseMeasurement {
  motorResult: string;
  standard: string;
  remarks: string;
}

export interface DocklevelerGroundingMeasurement {
  breakerResult: string;
  standard: string;
  remarks: string;
}

export interface DocklevelerVoltageAmpereMeasurement {
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

export interface DocklevelerAnalysis {
  remark: string;
  faultSymptom: string;
  faultAnalysis: string;
  workDone: string;
  faultPartSN: string;
}

export interface DocklevelerTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export interface DocklevelerReportData {
  customerInfo: DocklevelerCustomerInfo;
  visualInspection: DocklevelerChecklistItem[];
  cleaning: DocklevelerChecklistItem[];
  noise: DocklevelerNoiseMeasurement;
  grounding: DocklevelerGroundingMeasurement;
  voltageAmpere: DocklevelerVoltageAmpereMeasurement;
  analysis: DocklevelerAnalysis;
  timeSpent: DocklevelerTimeSpent;
}

export const DEFAULT_DOCKLEVELER_CUSTOMER_INFO: DocklevelerCustomerInfo = {
  companyName: 'NeutraDC Cikarang',
  equipmentName: 'Dock Leveler',
  ciDescription: 'Dock Leveler',
  ciName: '',
  type: '',
  serialNo: '',
  productName: '',
  productYears: '',
  specification: '',
  location: '',
  area: '',
  mopNo: 'DME-TDE/MOP/DL/01 0101/26',
  quarter: 'Q1',
  date: '',
  engineer: '',
};

export const DEFAULT_DOCKLEVELER_VISUAL_ITEMS: DocklevelerChecklistItem[] = [
  { no: '1.1', activity: 'Inspection & Checked of electrical panel (Voltage, Current, Grounding)', parameter: 'good condition', isGood: true, isNotGood: false, isNA: false, remarks: 'Kondisi baik & normal' },
  { no: '1.2', activity: 'Inspection & Checked of Telescopic Ramp ( Leakage, alignment, Corrosion)', parameter: 'No oil leakage', isGood: true, isNotGood: false, isNA: false, remarks: 'Tidak ada kebocoran' },
  { no: '1.3', activity: 'Inspection & Checked Condition of Lip plate, Toe Guards, Deck and Saffety Leg)', parameter: 'No damage or deformation', isGood: true, isNotGood: false, isNA: false, remarks: 'Tidak ada deformasi' },
  { no: '1.4', activity: 'Inspection & Checked of Bumper , Rubber Lip and Lip hinge', parameter: 'Bumper and rubber lip are not damaged', isGood: true, isNotGood: false, isNA: false, remarks: 'Bumper utuh & bagus' },
  { no: '1.5', activity: 'Inspection & Checked of Controller Swicth button', parameter: 'All buttons work properly', isGood: true, isNotGood: false, isNA: false, remarks: 'Tombol berfungsi baik' },
  { no: '1.6', activity: 'Inspection & Checked Condition Of Fluid system', parameter: 'Oil pressure is normal or No leakage', isGood: true, isNotGood: false, isNA: false, remarks: 'Sistem fluida normal' },
  { no: '1.7', activity: 'Inspection & Checked of Motor Fluid Pump (Mech seal, Leakage, performance, and terminal box)', parameter: 'No oil leakage at seal', isGood: true, isNotGood: false, isNA: false, remarks: 'Seal tidak bocor' },
];

export const DEFAULT_DOCKLEVELER_CLEANING_ITEMS: DocklevelerChecklistItem[] = [
  { no: '1.1', activity: 'Cleaning Of Electrical Panel & Electrrical Swicth button', parameter: 'Electrical panels and control switch buttons are cleaned from dust', isGood: true, isNotGood: false, isNA: false, remarks: 'Bersih dari debu' },
  { no: '1.2', activity: 'Cleaning of Telescopic Ramp', parameter: 'The telescopic ramp is cleaned from dirt, oil, and corrosion', isGood: true, isNotGood: false, isNA: false, remarks: 'Bersih dari kotoran & oli' },
  { no: '1.3', activity: 'Cleaning of Motor Fulid Pump, Telescopic Hose, and Reservoir Tank', parameter: 'motor pump, telescopic hose, and reservoir tank are cleaned', isGood: true, isNotGood: false, isNA: false, remarks: 'Pompa & tangki bersih' },
  { no: '1.4', activity: 'Lubrication of Lip Hinge, Deck Hinge, and Support Dock leveller', parameter: 'Lubrication is applied with a grease gun and brushto open hinges.', isGood: true, isNotGood: false, isNA: false, remarks: 'Pelumasan cukup' },
  { no: '1.5', activity: 'Filling Fluid of Reservoir Tank Or Flushing', parameter: 'No indication of leakage or contamination', isGood: true, isNotGood: false, isNA: false, remarks: 'Fluida bersih & cukup' },
];

export const DEFAULT_DOCKLEVELER_NOISE: DocklevelerNoiseMeasurement = {
  motorResult: '65',
  standard: '<75 dB',
  remarks: 'Normal & di bawah batas',
};

export const DEFAULT_DOCKLEVELER_GROUNDING: DocklevelerGroundingMeasurement = {
  breakerResult: '0.4',
  standard: '<5Ω',
  remarks: 'Sesuai standar',
};

export const DEFAULT_DOCKLEVELER_VOLTAGE_AMPERE: DocklevelerVoltageAmpereMeasurement = {
  voltageRS: '395',
  voltageST: '396',
  voltageTR: '395',
  voltageRN: '228',
  voltageSN: '229',
  voltageTN: '228',
  voltageNG: '1.2',
  ampereR: '5.2',
  ampereS: '5.4',
  ampereT: '5.1',
  ampereN: '0.3',
  standard: '+5% - 10% from 380V & 220V load deviation 10%',
  remarks: 'Tegangan & arus stabil',
};

export const DEFAULT_DOCKLEVELER_ANALYSIS: DocklevelerAnalysis = {
  remark: 'Peralatan Dock Leveler dalam kondisi baik dan beroperasi normal.',
  faultSymptom: '',
  faultAnalysis: '',
  workDone: '',
  faultPartSN: '',
};

export const DEFAULT_DOCKLEVELER_TIME_SPENT: DocklevelerTimeSpent = {
  date: new Date().toISOString().split('T')[0],
  departure: '08:00',
  start: '08:30',
  finish: '10:30',
};
