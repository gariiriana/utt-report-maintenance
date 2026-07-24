// ─── FCU (Fan Coil Unit) Service Report Types ─────────────────────────────────────────────

/** Photo input for FCU AI analysis */
export interface FCUPhotoInput {
  base64: string;
  category?: string;
  label: string;
  parameter?: string;
}

/** Request body for POST /api/ai/fcu-report */
export interface FCUAnalyzeRequest {
  photos: FCUPhotoInput[];
}

/** A single row in the Visual Inspection or Cleaning table */
export interface FCUInspectionItem {
  no: string;
  activity: string;
  parameter: string;
  condition: 'Good' | 'Not good';
  remarks: string;
}

/** Input / Output Voltage and Current Measurement */
export interface FCUVoltageCurrentData {
  voltage_rn: string;
  voltage_sn: string;
  voltage_tn: string;
  voltage_rs: string;
  voltage_st: string;
  voltage_tr: string;
  current_r: string;
  current_s: string;
  current_t: string;
  condition: 'Good' | 'Not good';
  remarks: string;
}

/** Vibration & Noise Measurement */
export interface FCUVibrationNoiseData {
  vibration: string; // Standard <= 2.5
  noise: string;     // Standard <= 65 dB
  condition: 'Good' | 'Not good';
  remarks: string;
}

/** Temperature & Humidity Measurement */
export interface FCUTempHumidityData {
  temp: string; // Standard <= +-25°C
  rh: string;   // Standard <= +-60%
  condition: 'Good' | 'Not good';
  remarks: string;
}

/** Supply & Return Pipes Pressure Measurement */
export interface FCUPipePressureData {
  supply: string; // Standard 2.5 - 4 Bar
  return_val: string; // Standard 2.5 - 4 Bar
  condition: 'Good' | 'Not good';
  remarks: string;
}

/** Output Air Flow Measurement */
export interface FCUAirFlowData {
  air_flow: string; // Standard 2.0 - 8.0 m/s
  condition: 'Good' | 'Not good';
  remarks: string;
}

/** Normal / Abnormal Operation Analysis & Remarks */
export interface FCUOperationStatusData {
  is_normal: boolean;
  remark: string;
  fault_symptom: string;
  fault_analysis: string;
  work_done: string;
  fault_part_sn: string;
  fault_part_name: string;
}

/** Full AI-generated FCU Service Report Data */
export interface FCUReportData {
  visual_inspection: FCUInspectionItem[];
  cleaning: FCUInspectionItem[];
  voltage_current: FCUVoltageCurrentData;
  vibration_noise: FCUVibrationNoiseData;
  temp_humidity: FCUTempHumidityData;
  pipe_pressure: FCUPipePressureData;
  air_flow: FCUAirFlowData;
  operation_status: FCUOperationStatusData;
}

/** Customer Info for FCU Service Report */
export interface FCUCustomerInfo {
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

/** Time Spent */
export interface FCUTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

/** Complete FCU Service Report */
export interface FCUFullReport {
  customerInfo: FCUCustomerInfo;
  reportData: FCUReportData;
  timeSpent: FCUTimeSpent;
}

// ─── Default Values ─────────────────────────────────────────────────────

export const DEFAULT_FCU_CUSTOMER_INFO: FCUCustomerInfo = {
  companyName: 'Neutra DC Cikarang',
  equipmentName: 'FCU',
  ciDescription: 'FCU FUW-F Daikin',
  ciName: 'FCU Unit 01',
  type: 'FUW-F',
  serialNo: 'FCU-2024-001',
  productName: 'Daikin',
  productYears: '2022',
  specification: 'Ceiling Concealed',
  location: 'Data Hall 1',
  area: 'Building A',
  mopNo: 'MOP-FCU-001',
  quarter: 'Q3',
  date: new Date().toISOString().split('T')[0],
  engineer: 'Gari Iriana',
};

export const DEFAULT_FCU_VISUAL_INSPECTION: FCUInspectionItem[] = [
  { no: 'a', activity: 'Checked of the AC enclosure cleaness with duster', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'b', activity: 'Checked the Air Filter cleaness from dust', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'c', activity: 'Checked of mounting, vibration, noise with vibration meter and sound level meter', parameter: 'Normal', condition: 'Good', remarks: '' },
  { no: 'd', activity: 'Checked the Evaporator Coil cleaness from dust and algae', parameter: 'clean', condition: 'Good', remarks: '' },
  { no: 'e', activity: 'Checked the Electrical control Components', parameter: 'on function', condition: 'Good', remarks: '' },
  { no: 'f', activity: 'Checked the termination of Electrical control Components', parameter: 'on function', condition: 'Good', remarks: '' },
  { no: 'g', activity: 'Checked the supply and returnt operation pressure', parameter: 'Normal', condition: 'Good', remarks: '' },
  { no: 'h', activity: 'Checked the settings point and actual Temperature and Humidity', parameter: 'on function', condition: 'Good', remarks: '' },
  { no: 'i', activity: 'Checked the level and cleaning of the flushing and Drain pipes of drain tanks', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'j', activity: 'Checked for airflow obstructions or Airflow Blockade', parameter: 'No obstructions', condition: 'Good', remarks: '' },
  { no: 'k', activity: 'Checked remote for control unit', parameter: 'on function', condition: 'Good', remarks: '' },
  { no: 'l', activity: 'Checked and completed the missing bolt', parameter: 'Complete bolts', condition: 'Good', remarks: '' },
  { no: 'm', activity: 'Checked the all support (tray, compressor, pipe refrigerant, fan indoor,fan)', parameter: 'Complete', condition: 'Good', remarks: '' },
  { no: 'n', activity: 'Inspection & Checked the Fan indoor main motor (mounting, support)', parameter: 'Normal', condition: 'Good', remarks: '' },
  { no: 'o', activity: 'Checked drain pump.', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'p', activity: 'Inspection tension of fanbelt unit', parameter: 'Normal', condition: 'Good', remarks: '' },
  { no: 'q', activity: 'Check pressure FCU with CHWS', parameter: 'Normal', condition: 'Good', remarks: '' },
  { no: 'r', activity: 'Check Pressure FCU With CHWR', parameter: 'Normal', condition: 'Good', remarks: '' },
];

export const DEFAULT_FCU_CLEANING: FCUInspectionItem[] = [
  { no: 'a', activity: 'Cleaning of the AC enclosure cleaness', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'b', activity: 'Cleaning the Air Filter cleaness', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'c', activity: 'Cleaning the component AC from oil & referigerant', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'd', activity: 'Cleaning of the flushing and Drain pipes of drain tanks', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'e', activity: 'Cleaning the drain pan, drain pump & drain pipe', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'f', activity: 'Cleaning the Evaporator Coil cleaness', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'g', activity: 'Cleaning the component AC from oil', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'h', activity: 'Cleaning fan motor', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'i', activity: 'Cleaning return air grille', parameter: 'Clean', condition: 'Good', remarks: '' },
  { no: 'j', activity: 'Checked for airflow obstructions or Airflow Blockade', parameter: 'Clean', condition: 'Good', remarks: '' },
];

export const DEFAULT_FCU_VOLTAGE_CURRENT: FCUVoltageCurrentData = {
  voltage_rn: '',
  voltage_sn: '',
  voltage_tn: '',
  voltage_rs: '',
  voltage_st: '',
  voltage_tr: '',
  current_r: '',
  current_s: '',
  current_t: '',
  condition: 'Good',
  remarks: '',
};

export const DEFAULT_FCU_VIBRATION_NOISE: FCUVibrationNoiseData = {
  vibration: '',
  noise: '',
  condition: 'Good',
  remarks: '',
};

export const DEFAULT_FCU_TEMP_HUMIDITY: FCUTempHumidityData = {
  temp: '',
  rh: '',
  condition: 'Good',
  remarks: '',
};

export const DEFAULT_FCU_PIPE_PRESSURE: FCUPipePressureData = {
  supply: '',
  return_val: '',
  condition: 'Good',
  remarks: '',
};

export const DEFAULT_FCU_AIR_FLOW: FCUAirFlowData = {
  air_flow: '',
  condition: 'Good',
  remarks: '',
};

export const DEFAULT_FCU_OPERATION_STATUS: FCUOperationStatusData = {
  is_normal: true,
  remark: '',
  fault_symptom: '',
  fault_analysis: '',
  work_done: '',
  fault_part_sn: '',
  fault_part_name: '',
};

export const DEFAULT_FCU_REPORT_DATA: FCUReportData = {
  visual_inspection: DEFAULT_FCU_VISUAL_INSPECTION,
  cleaning: DEFAULT_FCU_CLEANING,
  voltage_current: DEFAULT_FCU_VOLTAGE_CURRENT,
  vibration_noise: DEFAULT_FCU_VIBRATION_NOISE,
  temp_humidity: DEFAULT_FCU_TEMP_HUMIDITY,
  pipe_pressure: DEFAULT_FCU_PIPE_PRESSURE,
  air_flow: DEFAULT_FCU_AIR_FLOW,
  operation_status: DEFAULT_FCU_OPERATION_STATUS,
};

export const DEFAULT_FCU_TIME_SPENT: FCUTimeSpent = {
  date: new Date().toISOString().split('T')[0],
  departure: '',
  start: '',
  finish: '',
};
