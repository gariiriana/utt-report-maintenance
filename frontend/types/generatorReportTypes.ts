export interface GensetCustomerInfo {
  companyName: string;
  equipmentName: string;
  ciDescription: string;
  ciName: string;
  type: string;
  serialNo: string;
  productName: string;
  prodYear: string;
  specification: string;
  location: string;
  area: string;
  mopNo: string;
  quarter: string;
  date: string;
  engineer: string;
}

export interface GensetInspectionItem {
  no: string;
  activity: string;
  parameter: string;
  isGood: boolean;
  isNotGood: boolean;
  remarks: string;
}

export interface GensetCleaningItem {
  no: string;
  activity: string;
  parameter: string;
  isGood: boolean;
  isNotGood: boolean;
  remarks: string;
}

export interface GensetOutputVC {
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
  kw: string;
  kva: string;
  kvar: string;
  isGood: boolean;
  isNotGood: boolean;
  remarks: string;
}

export interface GensetCellMeasurement {
  backup: string[];
  existing: string[];
  isGood: boolean;
  isNotGood: boolean;
  remarks: string;
}

export interface GensetStandardItem {
  isGood: boolean;
  isNotGood: boolean;
  remarks: string;
}

export interface GensetMeasurementData {
  outputVC: GensetOutputVC;
  dcBattery: GensetCellMeasurement;
  torqueNut: GensetStandardItem;
  dcAlternator: GensetStandardItem;
  grounding: GensetStandardItem;
  batteryImpedance: GensetCellMeasurement;
  noise: GensetStandardItem;
  vibration: GensetStandardItem;
  coolant: GensetStandardItem;
  thermalScan: GensetStandardItem;
  heatingCurrent: GensetStandardItem;
}

export interface GensetApmAmfData {
  vRn: string;
  vSn: string;
  vTn: string;
  vRs: string;
  vSt: string;
  vTr: string;
  curR: string;
  curS: string;
  curT: string;
  kwR: string;
  kwS: string;
  kwT: string;
  pfR: string;
  pfS: string;
  pfT: string;
  kvaR: string;
  kvaS: string;
  kvaT: string;
  batteryVolts: string;
  load: string;
  engineSpeed: string;
  tCoolant: string;
  tOil: string;
  pOil: string;
  fuelRate: string;
  tIntManifold: string;
  pIntake: string;
  kwh: string;
  kvarh: string;
  runningHours: string;
  numStarts: string;
  numEStops: string;
  shutdowns: string;
  load2: string;
  engineSpeed2: string;
  tCoolant2: string;
  tOil2: string;
  pOil2: string;
  fuelRate2: string;
  tIntManifold2: string;
  pIntake2: string;
  isGood: boolean;
  isNotGood: boolean;
  remarks: string;
}

export interface GensetTestingData {
  emergencyButton: GensetStandardItem;
  apmAmf: GensetApmAmfData;
  engineCheck: GensetStandardItem;
}

export interface GensetAnalysisData {
  isNormal: boolean;
  remarkText: string;
  faultSymptom: string;
  faultAnalysis: string;
  workDone: string;
  faultPartSN: string;
  faultPartName: string;
}

export interface GensetTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export interface GensetReportData {
  inspection: GensetInspectionItem[];
  cleaning: GensetCleaningItem[];
  measurement: GensetMeasurementData;
  testing: GensetTestingData;
  analysis: GensetAnalysisData;
}

export const DEFAULT_GENSET_CUSTOMER_INFO: GensetCustomerInfo = {
  companyName: 'NeutraDC Cikarang',
  equipmentName: 'GENSET',
  ciDescription: '',
  ciName: '',
  type: '',
  serialNo: '',
  productName: 'KOHLER',
  prodYear: '',
  specification: '',
  location: '',
  area: '',
  mopNo: 'DME-TDE/MOP/Generator/03 2406/26',
  quarter: '',
  date: '',
  engineer: '',
};

export const DEFAULT_GENSET_INSPECTION_ITEMS: GensetInspectionItem[] = [
  { no: 'a', activity: 'Inspection of display unit Control Genset, make sure display is in good condition, then isolate system control with manual position selector switch and make sure genset already isolate before PM activity', parameter: 'Display is in good condition and no alarm,', isGood: true, isNotGood: false, remarks: '' },
  { no: 'b', activity: 'The team DME must be standby in the location LV panel distribution power room, Genset under maintenance and the team DME must be standby in the Power Room (1F-MAIN DC PANEL). if the any issue PLN black out us the team must be action roll back plan', parameter: 'Perform manual closing operation to close the ACB in the power room', isGood: true, isNotGood: false, remarks: '' },
  { no: 'c', activity: 'Replace filter Water Separator ensure the valve closed, open drain filter water separator until the condition no fuel and replace new filter water separator', parameter: 'No water in the fuel', isGood: true, isNotGood: false, remarks: '' },
  { no: 'd', activity: 'Fuel Filter & Fuel Pre-Filter collect the remaining fuel with a drain pan external', parameter: 'No fuel leakage.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'e', activity: 'Check level oil and condition using dip stick and inspection leaked oil in engine generator with deep stick', parameter: 'Oil in normal level, viscosity and color normal', isGood: true, isNotGood: false, remarks: '' },
  { no: 'f', activity: 'Oil Filter & Oil Pre-Filter collect the remaining oil with a drain pan externa', parameter: 'No oil leaks around the filter housing.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'g', activity: 'Replace Air Filter', parameter: 'No "Air Filter Clogged" alarm.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'h', activity: 'Check the radiator water level and leaks in the pipes.', parameter: 'There are no signs of leakage', isGood: true, isNotGood: false, remarks: '' },
  { no: 'i', activity: 'Inspect the condition of the radiator fan belt (tension, visual damage)', parameter: 'not loose/too tight', isGood: true, isNotGood: false, remarks: '' },
  { no: 'j', activity: 'Verify the position and function of the daily tank inlet/outlet valve.', parameter: 'Valve operates smoothly (opens/closes perfectly).', isGood: true, isNotGood: false, remarks: '' },
  { no: 'k', activity: 'Inspect the daily tank pipes for leaks and record the fuel level.', parameter: 'No leaks in the pipes.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'l', activity: 'Check for water/sediment contamination in the tank through the sight glass.', parameter: 'No water layer or deposits in the sight glass.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'm', activity: 'Inspect the alternator, terminal block, and fuses (use a multi tester).', parameter: 'No short circuits/overheating at the terminals.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'n', activity: 'Check the battery connections (tighten if loose).', parameter: 'Battery terminals are tight, no corrosion', isGood: true, isNotGood: false, remarks: '' },
  { no: 'o', activity: 'Check all power and battery cable connections.', parameter: 'All connections are tight, no frayed wires.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'p', activity: 'Test the indicator lights and push buttons', parameter: 'All lights are on, buttons are responsive (not stuck).', isGood: true, isNotGood: false, remarks: '' },
  { no: 'q', activity: 'Visually check the control modules on the PKG and APM panels.', parameter: 'No burnt components/burnt smell.', isGood: true, isNotGood: false, remarks: '' },
  { no: 'r', activity: 'Inspect the condition of the exhaust system.', parameter: 'No exhaust gas leaks.', isGood: true, isNotGood: false, remarks: '' },
  { no: 's', activity: 'Check the alarm log and record any alarms that occur', parameter: 'No unidentified active alarms.', isGood: true, isNotGood: false, remarks: '' },
  { no: 't', activity: 'Checking the Condition and Function of the Heater', parameter: 'no damage, rust, or frayed cables).', isGood: true, isNotGood: false, remarks: '' },
];

export const DEFAULT_GENSET_CLEANING_ITEMS: GensetCleaningItem[] = [
  { no: 'a', activity: 'Clean the engine, hoses, accessories, radiator fan, air ducts, air filter, fuel inlet filter, fuel system, heat exchanger, and base plate while ensuring that there is no damage to the paint, seals, or materials.', parameter: 'No damage to paint', isGood: true, isNotGood: false, remarks: '' },
  { no: 'b', activity: 'Cleaning of air filter & fuel filter', parameter: 'Clean filters', isGood: true, isNotGood: false, remarks: '' },
  { no: 'c', activity: 'Cleaning of Generator body & battery', parameter: 'No corrosion', isGood: true, isNotGood: false, remarks: '' },
  { no: 'd', activity: 'Cleaning the inside and outside of the PKG (Power Generation Panel) and APM (Automatic Power Management) panels.', parameter: 'No corrosion or excessive moisture.', isGood: true, isNotGood: false, remarks: '' },
];

export const DEFAULT_GENSET_MEASUREMENT_DATA: GensetMeasurementData = {
  outputVC: { rs: '', st: '', tr: '', rn: '', sn: '', tn: '', ng: '', r: '', s: '', t: '', n: '', kw: '', kva: '', kvar: '', isGood: true, isNotGood: false, remarks: '' },
  dcBattery: { backup: ['', '', '', '', ''], existing: ['', '', '', '', ''], isGood: true, isNotGood: false, remarks: '' },
  torqueNut: { isGood: true, isNotGood: false, remarks: '' },
  dcAlternator: { isGood: true, isNotGood: false, remarks: '' },
  grounding: { isGood: true, isNotGood: false, remarks: '' },
  batteryImpedance: { backup: ['', '', '', '', ''], existing: ['', '', '', '', ''], isGood: true, isNotGood: false, remarks: '' },
  noise: { isGood: true, isNotGood: false, remarks: '' },
  vibration: { isGood: true, isNotGood: false, remarks: '' },
  coolant: { isGood: true, isNotGood: false, remarks: '' },
  thermalScan: { isGood: true, isNotGood: false, remarks: '' },
  heatingCurrent: { isGood: true, isNotGood: false, remarks: '' },
};

export const DEFAULT_GENSET_TESTING_DATA: GensetTestingData = {
  emergencyButton: { isGood: true, isNotGood: false, remarks: '' },
  apmAmf: {
    vRn: '', vSn: '', vTn: '', vRs: '', vSt: '', vTr: '',
    curR: '', curS: '', curT: '', kwR: '', kwS: '', kwT: '',
    pfR: '', pfS: '', pfT: '', kvaR: '', kvaS: '', kvaT: '',
    batteryVolts: '', load: '', engineSpeed: '', tCoolant: '', tOil: '', pOil: '', fuelRate: '', tIntManifold: '', pIntake: '',
    kwh: '', kvarh: '', runningHours: '', numStarts: '', numEStops: '', shutdowns: '',
    load2: '', engineSpeed2: '', tCoolant2: '', tOil2: '', pOil2: '', fuelRate2: '', tIntManifold2: '', pIntake2: '',
    isGood: true, isNotGood: false, remarks: ''
  },
  engineCheck: { isGood: true, isNotGood: false, remarks: '' },
};

export const DEFAULT_GENSET_ANALYSIS_DATA: GensetAnalysisData = {
  isNormal: true,
  remarkText: 'Genset (Generator) beroperasi dalam kondisi normal, parameter tegangan, arus, temperatur, grounding, impedansi baterai, kebisingan dan getaran sesuai standar manufaktur.',
  faultSymptom: '',
  faultAnalysis: '',
  workDone: '',
  faultPartSN: '',
  faultPartName: '',
};

export const DEFAULT_GENSET_TIME_SPENT: GensetTimeSpent = {
  date: '',
  departure: '',
  start: '',
  finish: '',
};

export const DEFAULT_GENSET_REPORT_DATA: GensetReportData = {
  inspection: DEFAULT_GENSET_INSPECTION_ITEMS,
  cleaning: DEFAULT_GENSET_CLEANING_ITEMS,
  measurement: DEFAULT_GENSET_MEASUREMENT_DATA,
  testing: DEFAULT_GENSET_TESTING_DATA,
  analysis: DEFAULT_GENSET_ANALYSIS_DATA,
};
