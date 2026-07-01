// ─── ATS Service Report Types ─────────────────────────────────────────────

/** Photo input for AI analysis */
export interface ATSPhotoInput {
  base64: string;
  category: 'visual_inspection' | 'power_meter' | 'thermal' | 'grounding';
  label: string;
  parameter?: string;
}

/** Request body for POST /api/ai/ats-report */
export interface ATSAnalyzeRequest {
  photos: ATSPhotoInput[];
}

/** A single row in the Visual Inspection & Check table */
export interface VisualInspectionItem {
  no: string;
  activity: string;
  parameter: string;
  condition: 'Good' | 'Not Good';
  remarks: string;
}

/** Voltage reading for a wire pair */
export interface PowerMeterRow {
  voltage: string;
  remarks: string;
}

/** Digital Power Meter Recording data */
export interface PowerMeterData {
  rs: PowerMeterRow;
  st: PowerMeterRow;
  tr: PowerMeterRow;
  rn: PowerMeterRow;
  sn: PowerMeterRow;
  tn: PowerMeterRow;
  n: PowerMeterRow;
  kw: string;
  kva: string;
  kvar: string;
  cos_p: string;
  r_ampere: string;
  s_ampere: string;
  t_ampere: string;
  n_ampere: string;
}

/** Voltage & Current Measurement data */
export interface VoltageCurrentData {
  voltage_rs: string;
  voltage_st: string;
  voltage_tr: string;
  voltage_rn: string;
  voltage_sn: string;
  voltage_tn: string;
  voltage_ng: string;
  ampere_r: string;
  ampere_s: string;
  ampere_t: string;
  remarks: string;
}

/** Thermal Measurement data */
export interface ThermalData {
  result_temperature: string;
  standard: string;
  remarks: string;
}

/** Grounding Resistance Measurement data */
export interface GroundingData {
  result_ohm: string;
  standard: string;
  remarks: string;
}

/** Normal/Abnormal Operation status */
export interface OperationStatusData {
  is_normal: boolean;
  remark: string;
  fault_symptom: string;
  fault_analysis: string;
  work_done: string;
  fault_part_sn: string;
  fault_part_name: string;
}

/** Full AI-generated ATS Service Report data */
export interface ATSReportData {
  visual_inspection: VisualInspectionItem[];
  power_meter_recording: PowerMeterData;
  voltage_current: VoltageCurrentData;
  thermal_measurement: ThermalData;
  grounding_resistance: GroundingData;
  operation_status: OperationStatusData;
}

/** Customer information (manual input by engineer) */
export interface ATSCustomerInfo {
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
  mapNo: string;
  quarter: string;
  date: string;
  engineer: string;
}

/** Time spent information */
export interface ATSTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

/** Complete ATS Service Report (customer info + AI data + time) */
export interface ATSFullReport {
  customerInfo: ATSCustomerInfo;
  reportData: ATSReportData;
  timeSpent: ATSTimeSpent;
}

// ─── Default Values ─────────────────────────────────────────────────────

export const DEFAULT_CUSTOMER_INFO: ATSCustomerInfo = {
  companyName: 'Neutra DC Cikarang',
  equipmentName: 'ATS',
  ciDescription: '',
  ciName: '',
  type: '',
  serialNo: '',
  productName: '',
  productYears: '',
  specification: '',
  location: '',
  area: '',
  mapNo: '',
  quarter: '',
  date: new Date().toISOString().split('T')[0],
  engineer: '',
};

export const DEFAULT_POWER_METER: PowerMeterData = {
  rs: { voltage: '', remarks: '' },
  st: { voltage: '', remarks: '' },
  tr: { voltage: '', remarks: '' },
  rn: { voltage: '', remarks: '' },
  sn: { voltage: '', remarks: '' },
  tn: { voltage: '', remarks: '' },
  n: { voltage: '', remarks: '' },
  kw: '', kva: '', kvar: '', cos_p: '',
  r_ampere: '', s_ampere: '', t_ampere: '', n_ampere: '',
};

export const DEFAULT_VOLTAGE_CURRENT: VoltageCurrentData = {
  voltage_rs: '', voltage_st: '', voltage_tr: '',
  voltage_rn: '', voltage_sn: '', voltage_tn: '', voltage_ng: '',
  ampere_r: '', ampere_s: '', ampere_t: '',
  remarks: '',
};

export const DEFAULT_THERMAL: ThermalData = {
  result_temperature: '',
  standard: '40°C',
  remarks: '',
};

export const DEFAULT_GROUNDING: GroundingData = {
  result_ohm: '',
  standard: '<5 Ω',
  remarks: '',
};

export const DEFAULT_OPERATION_STATUS: OperationStatusData = {
  is_normal: true,
  remark: '',
  fault_symptom: '',
  fault_analysis: '',
  work_done: '',
  fault_part_sn: '',
  fault_part_name: '',
};

export const DEFAULT_VISUAL_INSPECTION: VisualInspectionItem[] = [
  { no: 'a', activity: 'Inspection unsafe action and unsafe condition before start activity maintenance', parameter: 'Good Condition', condition: 'Good', remarks: '' },
  { no: 'b', activity: 'Take a photo before action activity to indicate the initial condition of the equipment panel', parameter: 'Information before activity clear', condition: 'Good', remarks: '' },
  { no: 'c', activity: 'Check cable grounding to act know voltage in body panel. Measurement current and resistance using claim earth. Ensure grounding good connection', parameter: 'Tight & Good connection', condition: 'Good', remarks: '' },
  { no: 'd', activity: 'Inspection of support levelness used water pass to analysis positioning support panel', parameter: 'Horizontally aligned, not tilted', condition: 'Good', remarks: '' },
  { no: 'e', activity: 'Check and inspection visual of panels for paint damage and signs of corrosion', parameter: 'No peeling, No fading & No cracking', condition: 'Good', remarks: '' },
  { no: 'f', activity: 'Check function of enclosure (cover panel, doors, form covers, automatic shutters, screws, keys). Cleaning using vacuum cleaner', parameter: 'Physical condition intact, no cracks or dents', condition: 'Good', remarks: '' },
  { no: 'g', activity: 'Inspection visual and check function of power meters/controller compare with actual measurement, ensure by visual termination good connection', parameter: 'the display is lit up and clearly legible.', condition: 'Good', remarks: '' },
  { no: 'h', activity: 'Check lamp and indicator function by visual', parameter: 'Not loose, not burnt', condition: 'Good', remarks: '' },
  { no: 'i', activity: 'Inspection of control wiring, relays, power supply units, timers, etc.', parameter: 'There are no chipped, burnt, or worn wires.', condition: 'Good', remarks: '' },
  { no: 'j', activity: 'Inspection and check visual of auxiliary connections, ensure termination good connection using thermal imager', parameter: 'No looseness, no rust or corrosion.', condition: 'Good', remarks: '' },
  { no: 'k', activity: 'Inspection electronic surge protection is installed, control circuit fuse rating, and continuity', parameter: 'No rust', condition: 'Good', remarks: '' },
  { no: 'l', activity: 'Check condition connection cabel using thermal imager if the found anomali like a hot spot indeed connection.', parameter: 'No hotspots found, stable temperature, good connection', condition: 'Good', remarks: '' },
  { no: 'm', activity: 'Cleaning panel ATS used vacuum cleaner and apply sanpoliy to finish it', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'n', activity: 'Inspection visual busbar and isolators, make sure condition isolator from cracking, signs of heating with thermal imager. Cleaning using vacuum cleaner', parameter: 'No rust or oxidation on the surface.', condition: 'Good', remarks: '' },
  { no: 'o', activity: 'Inspection visual of CT connections and make sure good connection no miss connection. Cleaning using vacuum cleaner', parameter: 'Good connection', condition: 'Good', remarks: '' },
  { no: 'p', activity: 'Inspection visual from downstream power connections (connecting pads, cable mechanical strength)', parameter: 'Good connection', condition: 'Good', remarks: '' },
];

export const DEFAULT_TIME_SPENT: ATSTimeSpent = {
  date: new Date().toISOString().split('T')[0],
  departure: '',
  start: '',
  finish: '',
};

export const DEFAULT_REPORT_DATA: ATSReportData = {
  visual_inspection: DEFAULT_VISUAL_INSPECTION,
  power_meter_recording: DEFAULT_POWER_METER,
  voltage_current: DEFAULT_VOLTAGE_CURRENT,
  thermal_measurement: DEFAULT_THERMAL,
  grounding_resistance: DEFAULT_GROUNDING,
  operation_status: DEFAULT_OPERATION_STATUS,
};
