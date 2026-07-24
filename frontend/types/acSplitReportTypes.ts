export interface ACSplitCustomerInfo {
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

export interface ACSplitInspectionItem {
  no: string;
  activity: string;
  parameter: string;
  isGood: boolean;
  isNotGood: boolean;
  remarks: string;
}

export interface ACSplitTestItem {
  no: string;
  activity: string;
  parameter: string;
  resultBefore?: string;
  resultAfter?: string;
  resultVoltage?: string;
  resultCurrent?: string;
  resultVal?: string;
  remarks: string;
}

export interface ACSplitAnalysis {
  isNormal: boolean;
  isAbnormal: boolean;
  remark: string;
  faultSymptom: string;
  faultAnalysis: string;
  workDone: string;
  faultPartSN: string;
  faultPartName: string;
}

export interface ACSplitTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export interface ACSplitReportData {
  indoorInspection: ACSplitInspectionItem[];
  outdoorInspection: ACSplitInspectionItem[];
  testMeasuring: ACSplitTestItem[];
  analysis: ACSplitAnalysis;
}

export const DEFAULT_ACSPLIT_CUSTOMER_INFO: ACSplitCustomerInfo = {
  companyName: 'Neutra DC Cikarang',
  type: 'RC35NV14',
  specification: '1.5 Kw',
  mopNo: 'DME-TDE/MOP/AC/01 1102/26',
  equipmentName: 'AC SPLIT WALL',
  serialNo: 'E132910',
  quarter: 'Q1',
  ciDescription: 'Split wall AC Indoor',
  productName: 'Daikin',
  location: 'FCC Room',
  date: new Date().toISOString().split('T')[0],
  ciName: '',
  prodYear: '2021',
  area: 'Building Office',
  engineer: '',
};

export const DEFAULT_ACSPLIT_INDOOR_ITEMS: ACSplitInspectionItem[] = [
  { no: 'a.', activity: 'Inspect for unsafe actions and conditions in the work area', parameter: 'Work area is clean and clear of obstacles', isGood: true, isNotGood: false, remarks: '' },
  { no: 'b.', activity: 'Turn off the AC unit using the remote control or manually from the main power source.', parameter: 'Power Off', isGood: true, isNotGood: false, remarks: '' },
  { no: 'c.', activity: 'Open the AC unit body and clean the air filters using a steam water pump.', parameter: 'Clean and filter Undamage', isGood: true, isNotGood: false, remarks: '' },
  { no: 'd.', activity: 'Visually inspect the AC control unit components.', parameter: 'Components are complete and clean', isGood: true, isNotGood: false, remarks: '' },
  { no: 'e.', activity: 'Install plastic protective cover before cleaning the evaporator and ensure no leakage gaps.', parameter: 'No torn or loose plastic cover, All electrical parts are covered', isGood: true, isNotGood: false, remarks: '' },
  { no: 'f.', activity: 'Check evaporator and refrigerant pipes for leaks.', parameter: 'No oil stains or abnormal condensation', isGood: true, isNotGood: false, remarks: '' },
  { no: 'g.', activity: 'Cover the AC controller unit with plastic.', parameter: 'Controller fully protected from water', isGood: true, isNotGood: false, remarks: '' },
  { no: 'h.', activity: 'Clean the evaporator coil using a steam water pump.', parameter: 'Clean and Clear', isGood: true, isNotGood: false, remarks: '' },
  { no: 'i.', activity: 'Clean the indoor fan using steam water while gently holding the fan blades.', parameter: 'Clean and No damage', isGood: true, isNotGood: false, remarks: '' },
  { no: 'j.', activity: 'Flush the drainpipe using steam water to ensure proper flow.', parameter: 'Drain is clear and unobstructed', isGood: true, isNotGood: false, remarks: '' },
  { no: 'k.', activity: 'Wipe remaining water with a synthetic cloth and ensure no standing water is left.', parameter: 'Floor and surroundings are dry', isGood: true, isNotGood: false, remarks: '' },
  { no: 'l.', activity: 'Clean the indoor unit casing using a synthetic cloth and vacuum cleaner.', parameter: 'Air vents are clear', isGood: true, isNotGood: false, remarks: '' },
  { no: 'm.', activity: 'Reinstall the AC body cover and filters, and ensure the area is safe and dry.', parameter: 'All parts are securely reinstalled', isGood: true, isNotGood: false, remarks: '' },
];

export const DEFAULT_ACSPLIT_OUTDOOR_ITEMS: ACSplitInspectionItem[] = [
  { no: 'a.', activity: 'Open the outdoor unit body cover.', parameter: 'Cover removed carefully without damage', isGood: true, isNotGood: false, remarks: '' },
  { no: 'b.', activity: 'Inspect compressor and control components visually.', parameter: 'No burnt marks, loose wiring, or corrosion', isGood: true, isNotGood: false, remarks: '' },
  { no: 'c.', activity: 'Inspect condenser and refrigerant piping to ensure no leakage.', parameter: 'Pipe joints are secure and dry', isGood: true, isNotGood: false, remarks: '' },
  { no: 'd.', activity: 'Inspect condenser fan motor to ensure proper operation and condition.', parameter: 'Fan rotates smoothly without unusual noise', isGood: true, isNotGood: false, remarks: '' },
  { no: 'e.', activity: 'Cover sensitive electrical parts with plastic before cleaning the condenser.', parameter: 'All electronics fully covered', isGood: true, isNotGood: false, remarks: '' },
  { no: 'f.', activity: 'Clean the condenser coil using a steam water pump.', parameter: 'Fins are free from dust, dirt, and debris', isGood: true, isNotGood: false, remarks: '' },
  { no: 'g.', activity: 'Wipe remaining water with a synthetic cloth and vacuum; ensure no standing water in the area.', parameter: 'Area is dry and safe from slipping or corrosion', isGood: true, isNotGood: false, remarks: '' },
  { no: 'h.', activity: 'Reinstall the body cover and check all bolts.', parameter: 'All screws/bolts are tightened securely', isGood: true, isNotGood: false, remarks: '' },
  { no: 'i.', activity: 'Inspect and check the condition of the outdoor unit support frame and pipe tray.', parameter: 'Support bracket is not rusted or cracked', isGood: true, isNotGood: false, remarks: '' },
];

export const DEFAULT_ACSPLIT_TEST_ITEMS: ACSplitTestItem[] = [
  { no: 'a.', activity: 'Turn on the AC unit using the remote control; test includes adjusting temperature and fan speed settings.', parameter: 'Normal operation', resultBefore: 'Good', resultAfter: 'Good', remarks: '' },
  { no: 'b.', activity: 'Measure input/output voltage and current using clamp ampere', parameter: 'For current not Over 125% I nominal, for voltage 210-240 VAC', resultVoltage: '225 V', resultCurrent: '6.5 A', remarks: '' },
  { no: 'c.', activity: 'Pressure Measurement', parameter: 'For Refrigrant R32 suction pressure (115-145 psi)', resultVal: '130 psi', remarks: '' },
  { no: 'd.', activity: 'Ensure there are no error code indications on the AC split unit.', parameter: 'Normal operation', resultVal: 'Normal operation', remarks: '' },
];

export const DEFAULT_ACSPLIT_REPORT_DATA: ACSplitReportData = {
  indoorInspection: DEFAULT_ACSPLIT_INDOOR_ITEMS,
  outdoorInspection: DEFAULT_ACSPLIT_OUTDOOR_ITEMS,
  testMeasuring: DEFAULT_ACSPLIT_TEST_ITEMS,
  analysis: {
    isNormal: true,
    isAbnormal: false,
    remark: '',
    faultSymptom: '',
    faultAnalysis: '',
    workDone: '',
    faultPartSN: '',
    faultPartName: '',
  },
};

export const DEFAULT_ACSPLIT_TIME_SPENT: ACSplitTimeSpent = {
  date: new Date().toISOString().split('T')[0],
  departure: '08:00',
  start: '09:00',
  finish: '17:00',
};
