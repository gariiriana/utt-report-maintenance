export interface CTCustomerInfo {
  companyName: string;
  type: string;
  spesification: string;
  mopNo: string;
  equipmentName: string;
  serialNo: string;
  quarter: string;
  ciDescription: string;
  productName: string;
  location: string;
  date: string;
  ciName: string;
  productYears: string;
  area: string;
  engineer: string;
}

export interface CTInspectionItem {
  no: string;
  activity: string;
  parameter: string;
  condition: 'Good' | 'Not good' | '';
  remarks: string;
}

export interface CTCleaningItem {
  no: string;
  activity: string;
  parameter: string;
  condition: 'Good' | 'Not good' | '';
  remarks: string;
}

export interface CTMeasurementData {
  rnVoltage: string;
  snVoltage: string;
  tnVoltage: string;
  rsVoltage: string;
  stVoltage: string;
  trVoltage: string;
  rCurrent: string;
  sCurrent: string;
  tCurrent: string;
  voltageCurrentCondition: 'Good' | 'Not good' | '';
  voltageCurrentRemarks: string;

  tempMeasurements: string;
  tempCondition: 'Good' | 'Not good' | '';
  tempRemarks: string;

  suctionPressure: string;
  dischargePressure: string;
  suctionDischargeCondition: 'Good' | 'Not good' | '';
  suctionDischargeRemarks: string;

  outputAirFlow: string;
  outputAirFlowCondition: 'Good' | 'Not good' | '';
  outputAirFlowRemarks: string;

  motorTemp: string;
  motorTempCondition: 'Good' | 'Not good' | '';
  motorTempRemarks: string;

  fanOutdoorRpm: string;
  fanOutdoorRpmCondition: 'Good' | 'Not good' | '';
  fanOutdoorRpmRemarks: string;
}

export interface CTAnalysisData {
  isNormal: boolean;
  isAbnormal: boolean;
  remark: string;
  faultSymptom: string;
  faultAnalysis: string;
  workDone: string;
  faultPartSN: string;
  faultPartName: string;
}

export interface CTTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export interface CTReportData {
  visualInspectionCT: CTInspectionItem[];
  visualInspectionPanel: CTInspectionItem[];
  cleaningCT: CTCleaningItem[];
  cleaningPanel: CTCleaningItem[];
  measurement: CTMeasurementData;
  analysis: CTAnalysisData;
}

export const DEFAULT_CT_CUSTOMER_INFO: CTCustomerInfo = {
  companyName: 'Neutra DC',
  type: '',
  spesification: '',
  mopNo: 'DME-TDE/MOP/CTWT/03 1006/26',
  equipmentName: 'Cooling Tower',
  serialNo: '',
  quarter: '',
  ciDescription: '',
  productName: '',
  location: '',
  date: '',
  ciName: '',
  productYears: '',
  area: '',
  engineer: '',
};

export const DEFAULT_CT_VISUAL_INSPECTION_CT: CTInspectionItem[] = [
  { no: 'a', activity: 'Inspection & Checked of basin (upper, lower) from corrosive, erosion, algae', parameter: '', condition: 'Good', remarks: '' },
  { no: 'b', activity: 'Inspection & Checked the filler from damaged', parameter: '', condition: 'Good', remarks: '' },
  { no: 'c', activity: 'Inspection & Checked the all support/mounting (CT Fan, Motor CT Fan, Pump CWP, pipes installation)', parameter: '', condition: 'Good', remarks: '' },
  { no: 'd', activity: 'Inspection & Checked tightening all support/mounting (CT Fan, Motor CT Fan, Pump CWP, pipes installation)', parameter: '', condition: 'Good', remarks: '' },
  { no: 'e', activity: 'Inspection & Checked for floating check valve from clogged and damaged', parameter: '', condition: 'Good', remarks: '' },
  { no: 'f', activity: 'Inspection & Checked all valve from clogged and damaged', parameter: '', condition: 'Good', remarks: '' },
  { no: 'g', activity: 'Inspection & Checked of Motor Fan (pulley, tension belt)', parameter: '', condition: 'Good', remarks: '' },
  { no: 'h', activity: 'Inspection & Checked the fan blades for cracks, missing balancing, weights, and vibrations (visual and bearing condition)', parameter: '', condition: 'Good', remarks: '' },
  { no: 'i', activity: 'Inspection & Checked the Check sheaves, bushings, fan shafts and fan hubs Annually for corrosion. Scrape and coat with ZRC', parameter: '', condition: 'Good', remarks: '' },
  { no: 'j', activity: 'Inspection & Checked the spray nozzles, Strainer, and Drift Eliminator from clogged and damaged', parameter: '', condition: 'Good', remarks: '' },
  { no: 'k', activity: 'Inspection & Checked the enclosure (Access door, stairs)', parameter: '', condition: 'Good', remarks: '' },
];

export const DEFAULT_CT_VISUAL_INSPECTION_PANEL: CTInspectionItem[] = [
  { no: 'a', activity: 'Inspection of support levelness (alignment)', parameter: '', condition: 'Good', remarks: '' },
  { no: 'b', activity: 'Inspection function of power meters', parameter: '', condition: 'Good', remarks: '' },
  { no: 'c', activity: 'Inspection function of lamps and indicators', parameter: '', condition: 'Good', remarks: '' },
  { no: 'd', activity: 'Inspection of locking devices for signs damage or worn', parameter: '', condition: 'Good', remarks: '' },
  { no: 'e', activity: 'Inspection of control wiring, relays, power supply units, timers', parameter: '', condition: 'Good', remarks: '' },
  { no: 'f', activity: 'Inspection electronic surge protection is installed', parameter: '', condition: 'Good', remarks: '' },
  { no: 'g', activity: 'Inspection of control circuit fuse rating and continuity', parameter: '', condition: 'Good', remarks: '' },
  { no: 'h', activity: 'Inspection for signs of overheating or deterioration', parameter: '', condition: 'Good', remarks: '' },
  { no: 'i', activity: 'Inspection of panels for paint damage and signs of corrosion', parameter: '', condition: 'Good', remarks: '' },
  { no: 'j', activity: 'Inspection function of selector switch and push button', parameter: '', condition: 'Good', remarks: '' },
];

export const DEFAULT_CT_CLEANING_CT: CTCleaningItem[] = [
  { no: 'a', activity: 'Cleaning of basin (upper, lower)', parameter: '', condition: 'Good', remarks: '' },
  { no: 'b', activity: 'Cleaning the filler with air spray / brush', parameter: '', condition: 'Good', remarks: '' },
  { no: 'c', activity: 'Cleaning the all support/mounting (CT Fan, Motor CT Fan, Pump CWP, pipes installation)', parameter: '', condition: 'Good', remarks: '' },
  { no: 'd', activity: 'Cleaning enclosure/casing with brush', parameter: '', condition: 'Good', remarks: '' },
  { no: 'e', activity: 'Cleaning for floating check valve include probe/terminal with vacuum cleaner', parameter: '', condition: 'Good', remarks: '' },
  { no: 'f', activity: 'Cleaning all valve with vacuum cleaner', parameter: '', condition: 'Good', remarks: '' },
  { no: 'h', activity: 'Cleaning Motor & Fan CT and Greasing the Motor bearings', parameter: '', condition: 'Good', remarks: '' },
  { no: 'i', activity: 'Cleaning of upper basin, lower basin, and filler', parameter: '', condition: 'Good', remarks: '' },
];

export const DEFAULT_CT_CLEANING_PANEL: CTCleaningItem[] = [
  { no: 'a', activity: 'Cleaning of enclosure (cover panel, doors, form covers)', parameter: '', condition: 'Good', remarks: '' },
  { no: 'b', activity: 'Thorough cleaning such as mcb, timer, etc.', parameter: '', condition: 'Good', remarks: '' },
];

export const DEFAULT_CT_MEASUREMENT: CTMeasurementData = {
  rnVoltage: '',
  snVoltage: '',
  tnVoltage: '',
  rsVoltage: '',
  stVoltage: '',
  trVoltage: '',
  rCurrent: '',
  sCurrent: '',
  tCurrent: '',
  voltageCurrentCondition: 'Good',
  voltageCurrentRemarks: '',

  tempMeasurements: '',
  tempCondition: 'Good',
  tempRemarks: '',

  suctionPressure: '',
  dischargePressure: '',
  suctionDischargeCondition: 'Good',
  suctionDischargeRemarks: '',

  outputAirFlow: '',
  outputAirFlowCondition: 'Good',
  outputAirFlowRemarks: '',

  motorTemp: '',
  motorTempCondition: 'Good',
  motorTempRemarks: '',

  fanOutdoorRpm: '',
  fanOutdoorRpmCondition: 'Good',
  fanOutdoorRpmRemarks: '',
};

export const DEFAULT_CT_ANALYSIS: CTAnalysisData = {
  isNormal: true,
  isAbnormal: false,
  remark: 'System Cooling Tower beroperasi normal tanpa kendala.',
  faultSymptom: '',
  faultAnalysis: '',
  workDone: 'Maintenance rutin Cooling Tower & pembersihan.',
  faultPartSN: '',
  faultPartName: '',
};

export const DEFAULT_CT_TIME_SPENT: CTTimeSpent = {
  date: new Date().toISOString().split('T')[0],
  departure: '08:00',
  start: '08:30',
  finish: '16:00',
};

export const DEFAULT_CT_REPORT_DATA: CTReportData = {
  visualInspectionCT: DEFAULT_CT_VISUAL_INSPECTION_CT,
  visualInspectionPanel: DEFAULT_CT_VISUAL_INSPECTION_PANEL,
  cleaningCT: DEFAULT_CT_CLEANING_CT,
  cleaningPanel: DEFAULT_CT_CLEANING_PANEL,
  measurement: DEFAULT_CT_MEASUREMENT,
  analysis: DEFAULT_CT_ANALYSIS,
};
