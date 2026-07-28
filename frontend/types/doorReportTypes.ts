export interface DoorCustomerInfo {
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

export interface DoorChecklistItem {
  no: string;
  activity: string;
  parameter: string;
  isGood: boolean;
  isNotGood: boolean;
  isNA: boolean;
  remarks: string;
}

export interface DoorVoltageAmpereMeasurement {
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
}

export interface DoorNoiseMeasurement {
  unitResult: string;
  standard: string;
  remarks: string;
}

export interface DoorGroundingMeasurement {
  groundingResult: string;
  standard: string;
  remarks: string;
}

export interface DoorAnalysis {
  remark: string;
  faultSymptom: string;
  faultAnalysis: string;
  workDone: string;
  faultPartSN: string;
}

export interface DoorTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export interface DoorReportData {
  customerInfo: DoorCustomerInfo;
  visualInspection: DoorChecklistItem[];
  cleaning: DoorChecklistItem[];
  voltageAmpere: DoorVoltageAmpereMeasurement;
  noise: DoorNoiseMeasurement;
  grounding: DoorGroundingMeasurement;
  analysis: DoorAnalysis;
  timeSpent: DoorTimeSpent;
}

export const DEFAULT_DOOR_CUSTOMER_INFO: DoorCustomerInfo = {
  companyName: 'NeutraDC Cikarang',
  equipmentName: 'DOOR',
  ciDescription: 'ROLLING DOOR',
  ciName: 'Lobby Door Office',
  type: '',
  serialNo: '',
  productName: '',
  productYears: '',
  specification: '',
  location: '',
  area: '',
  mopNo: '',
  quarter: '',
  date: '',
  engineer: '',
};

export const DEFAULT_DOOR_VISUAL_ITEMS: DoorChecklistItem[] = [
  { no: '1.1', activity: 'Inspection & Checked of door movement', parameter: 'Door operates smoothly', isGood: true, isNotGood: false, isNA: false, remarks: 'Gerakan pintu lancar' },
  { no: '1.2', activity: 'Inspection & Checked of signs of waer, rust, dents, and damageon door tracks', parameter: 'Door tracks are free from excessive wear', isGood: true, isNotGood: false, isNA: false, remarks: 'Track bersih & mulus' },
  { no: '1.3', activity: 'Inspection & Checked door tracks are aligned and not sagging', parameter: 'Door tracks are properly aligned, straight, and not sagging', isGood: true, isNotGood: false, isNA: false, remarks: 'Track simetris & lurus' },
  { no: '1.4', activity: 'Inspection & Checked of door parts for any signs of damage (spring, motor, frame, cover)', parameter: 'All door components (spring, motor, frame, cover)', isGood: true, isNotGood: false, isNA: false, remarks: 'Komponen utuh' },
  { no: '1.5', activity: 'Inspection & Checked of Bumper , Rubber Lip and Lip hinge', parameter: 'Bumper, rubber lip, and lip hinge are intact', isGood: true, isNotGood: false, isNA: false, remarks: 'Bumper & karet intact' },
  { no: '1.6', activity: 'Inspection & Checked of Controller Swicth button', parameter: 'Controller switch buttons are fully functional', isGood: true, isNotGood: false, isNA: false, remarks: 'Tombol respon baik' },
  { no: '1.7', activity: 'Check Motor Condition, Check motor body for overheating, Listen for abnormal sound, Check cable connection,', parameter: 'Motor runs normally without overheating', isGood: true, isNotGood: false, isNA: false, remarks: 'Motor halus & normal' },
  { no: '1.8', activity: 'Check Base Frame, Shaft & Door Alignment Base Frame', parameter: 'Base Frame & Door Alignment', isGood: true, isNotGood: false, isNA: false, remarks: 'Alignment presisi' },
  { no: '1.9', activity: 'Motor & Gearbox Inspection', parameter: 'Mounting bolts are tight. Cables are in good condition', isGood: true, isNotGood: false, isNA: false, remarks: 'Baut kencang & kabel rapi' },
  { no: '2.0', activity: 'Check Roller Shutter Kit', parameter: 'No wear, corrosion, or damage', isGood: true, isNotGood: false, isNA: false, remarks: 'Roller aman & bagus' },
];

export const DEFAULT_DOOR_CLEANING_ITEMS: DoorChecklistItem[] = [
  { no: '1.1', activity: 'Cleaning Of Electrical Panel & Electrrical Swicth button', parameter: 'Electrical panel and switch buttons are clean', isGood: true, isNotGood: false, isNA: false, remarks: 'Bersih dari debu' },
  { no: '1.2', activity: 'Clean the door tracks from dust, dirt, and debris using a brush or cloth', parameter: 'Door tracks are clean and free from dust', isGood: true, isNotGood: false, isNA: false, remarks: 'Track pintu bersih' },
  { no: '1.3', activity: 'Apply approved lubricant to the door motor and moving parts as required', parameter: 'Door motor is properly lubricated as per manufacturer specification', isGood: true, isNotGood: false, isNA: false, remarks: 'Pelumasan cukup' },
  { no: '1.4', activity: 'Tightening bolts, Check all bolts and fasteners on the door system', parameter: 'All bolts are securely tightened', isGood: true, isNotGood: false, isNA: false, remarks: 'Baut kencang' },
  { no: '1.5', activity: 'Tightening and check cable control and electrical components termination', parameter: 'Control cables and electrical terminations', isGood: true, isNotGood: false, isNA: false, remarks: 'Terminasi rapi & kencang' },
];

export const DEFAULT_DOOR_VOLTAGE_AMPERE: DoorVoltageAmpereMeasurement = {
  voltageRS: '395',
  voltageST: '396',
  voltageTR: '395',
  voltageRN: '228',
  voltageSN: '229',
  voltageTN: '228',
  voltageNG: '1.2',
  ampereR: '4.8',
  ampereS: '4.9',
  ampereT: '4.7',
  ampereN: '0.2',
  standard: '+5% - 10% from 380V & 220V load deviation 10%',
};

export const DEFAULT_DOOR_NOISE: DoorNoiseMeasurement = {
  unitResult: '62',
  standard: '≤ 75 dB(A)',
  remarks: 'Normal & di bawah batas',
};

export const DEFAULT_DOOR_GROUNDING: DoorGroundingMeasurement = {
  groundingResult: '0.35',
  standard: '<5 Ω',
  remarks: 'Sesuai standar',
};

export const DEFAULT_DOOR_ANALYSIS: DoorAnalysis = {
  remark: 'Pintu Rolling Door beroperasi normal dan dalam kondisi baik.',
  faultSymptom: '',
  faultAnalysis: '',
  workDone: '',
  faultPartSN: '',
};

export const DEFAULT_DOOR_TIME_SPENT: DoorTimeSpent = {
  date: new Date().toISOString().split('T')[0],
  departure: '08:00',
  start: '08:30',
  finish: '10:30',
};
