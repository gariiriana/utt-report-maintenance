export interface PDUCustomerInfo {
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
  engineerTechnician: string;
}

export interface PDUInspectionItem {
  no: number;
  activity: string;
  parameter: string;
  condition: 'Good' | 'Not Good';
  remarks: string;
}

export interface PDUCleaningItem {
  no: number;
  activity: string;
  parameter: string;
  condition: string;
  remarks: string;
}

export interface PDUDPMRecording {
  r_ampere: string;
  s_ampere: string;
  t_ampere: string;
  n_ampere: string;
  kw: string;
  kva: string;
  kvar: string;
  cos_p: string;
  voltage_rs: string;
  voltage_st: string;
  voltage_tr: string;
  voltage_rn: string;
  voltage_sn: string;
  voltage_tn: string;
  voltage_ng: string;
  remarks: string;
}

export interface PDUISOTransTemp {
  r_temp: string;
  s_temp: string;
  t_temp: string;
  standard: string;
  remarks: string;
}

export interface PDUVoltageAmpere {
  voltage_rs: string;
  voltage_st: string;
  voltage_tr: string;
  voltage_rn: string;
  voltage_sn: string;
  voltage_tn: string;
  voltage_ng: string;
  current_r: string;
  current_s: string;
  current_t: string;
  current_n: string;
  remarks: string;
}

export interface PDUThermalItem {
  breaker: string;
  result_temp: string;
  standard: string;
  remarks: string;
}

export interface PDUGroundingItem {
  wire: string;
  result: string;
  standard: string;
  remarks: string;
}

export interface PDUNoiseItem {
  measurement: string;
  result: string;
  standard: string;
  remarks: string;
}

export interface PDUAnalysisRemark {
  isNormal: boolean;
  isAbnormal: boolean;
  remarkText: string;
  faultSymptom: string;
  faultAnalysis: string;
  workDone: string;
  faultPartSN: string;
  faultPartName: string;
}

export interface PDUTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export interface PDUReportData {
  inspection_checking: PDUInspectionItem[];
  cleaning: PDUCleaningItem[];
  dpm_recording: PDUDPMRecording;
  iso_trans_temp: PDUISOTransTemp;
  voltage_ampere: PDUVoltageAmpere;
  thermal_measurement: PDUThermalItem;
  grounding_resistance: PDUGroundingItem;
  noise_measurement: PDUNoiseItem;
  analysis_remark: PDUAnalysisRemark;
}

export const DEFAULT_PDU_CUSTOMER_INFO: PDUCustomerInfo = {
  companyName: 'NeutraDC Cikarang',
  type: 'Standing',
  specification: '400 A',
  mopNo: 'DME-TDE/MOP/PDU/01',
  equipmentName: 'PANEL PDU',
  serialNo: '21W00038',
  quarter: 'Q1',
  ciDescription: 'IT LOAD',
  productName: 'GSPE',
  location: 'Crac Room 1',
  date: new Date().toISOString().split('T')[0],
  ciName: '',
  prodYear: '2021',
  area: 'Campus',
  engineerTechnician: '',
};

export const DEFAULT_PDU_INSPECTION_ITEMS: PDUInspectionItem[] = [
  { no: 1, activity: 'Inspection unsafe action and unsafe condition before start activity maintenance', parameter: 'Complete personal protective equipment', condition: 'Good', remarks: '' },
  { no: 2, activity: 'Check cable grounding to act know voltage in body panel. Measurement current and resistance using claim earth', parameter: 'tight', condition: 'Good', remarks: '' },
  { no: 3, activity: 'Inspection & check visual all support panel like a condition paint panel, pilot lamp, chassis panel, padlock system and cleaning using vacuum cleaner.', parameter: 'does not peel or rust', condition: 'Good', remarks: '' },
  { no: 4, activity: 'Inspection & check status breaker incoming and outgoing, cable wiring panel, and fuse', parameter: 'The cable terminals are not loose,', condition: 'Good', remarks: '' },
  { no: 5, activity: 'Inspection relay, power supply unit, measurement voltage', parameter: 'Good Condition', condition: 'Good', remarks: '' },
  { no: 6, activity: 'Inspection visual tightness all connection cable in terminal cable, label marking, terminal breaker and all mounting nut.', parameter: 'tight', condition: 'Good', remarks: '' },
  { no: 7, activity: 'Check condition connection cable using thermal imager if the found anomaly like a hot spot on the connection.', parameter: 'Normally <45°C (depending on rating), make sure not to exceed manufacturer standards.', condition: 'Good', remarks: '' },
  { no: 8, activity: 'Cleaning panel used vacuum cleaner and apply sanpoly to finish it', parameter: 'Good condition & clean', condition: 'Good', remarks: '' },
  { no: 9, activity: 'Inspection and check visual trafo isotrans with analysis condition temperature operational trafo using thermal imager and measurement noise with sound level', parameter: 'Normally <70 dB(depending on rating), make sure not to exceed manufacturer standards.', condition: 'Good', remarks: '' },
  { no: 10, activity: 'Cleaning, remove object from top of controller', parameter: 'There are no dangerous foreign objects on the controller panel.', condition: 'Good', remarks: '' },
  { no: 11, activity: 'Inspection DPM, and ensure measurement on reading in DPM. Take a photo', parameter: 'All parameter ready reading in DPM', condition: 'Good', remarks: '' },
];

export const DEFAULT_PDU_CLEANING_ITEMS: PDUCleaningItem[] = [
  { no: 1, activity: 'Cleaning support panels using a vacuum cleaner', parameter: 'Clean', condition: 'Clean', remarks: '' },
  { no: 2, activity: 'Clean the panel with a vacuum and apply sanpoly.', parameter: 'Clean', condition: 'Clean', remarks: '' },
];

export const DEFAULT_PDU_DPM_RECORDING: PDUDPMRecording = {
  r_ampere: '',
  s_ampere: '',
  t_ampere: '',
  n_ampere: '',
  kw: '',
  kva: '',
  kvar: '',
  cos_p: '',
  voltage_rs: '',
  voltage_st: '',
  voltage_tr: '',
  voltage_rn: '',
  voltage_sn: '',
  voltage_tn: '',
  voltage_ng: '',
  remarks: '',
};

export const DEFAULT_PDU_ISO_TRANS_TEMP: PDUISOTransTemp = {
  r_temp: '',
  s_temp: '',
  t_temp: '',
  standard: 'Temperature < 45 °C',
  remarks: '',
};

export const DEFAULT_PDU_VOLTAGE_AMPERE: PDUVoltageAmpere = {
  voltage_rs: '',
  voltage_st: '',
  voltage_tr: '',
  voltage_rn: '',
  voltage_sn: '',
  voltage_tn: '',
  voltage_ng: '',
  current_r: '',
  current_s: '',
  current_t: '',
  current_n: '',
  remarks: '',
};

export const DEFAULT_PDU_THERMAL: PDUThermalItem = {
  breaker: 'Main Breaker Panel PDU',
  result_temp: '',
  standard: 'Temperature < 45 °C',
  remarks: '',
};

export const DEFAULT_PDU_GROUNDING: PDUGroundingItem = {
  wire: 'Grounding',
  result: '',
  standard: '<5Ω',
  remarks: '',
};

export const DEFAULT_PDU_NOISE: PDUNoiseItem = {
  measurement: 'Measurement Noise Sound Level',
  result: '',
  standard: '<75 dB',
  remarks: '',
};

export const DEFAULT_PDU_ANALYSIS_REMARK: PDUAnalysisRemark = {
  isNormal: true,
  isAbnormal: false,
  remarkText: 'Panel PDU beroperasi dengan normal, tegangan, arus, temperatur trafo ISO-Trans, resistansi grounding dan tingkat kebisingan sesuai standar manufaktur.',
  faultSymptom: '',
  faultAnalysis: '',
  workDone: '',
  faultPartSN: '',
  faultPartName: '',
};

export const DEFAULT_PDU_TIME_SPENT: PDUTimeSpent = {
  date: new Date().toISOString().split('T')[0],
  departure: '08:00',
  start: '09:00',
  finish: '12:00',
};

export const DEFAULT_PDU_REPORT_DATA: PDUReportData = {
  inspection_checking: DEFAULT_PDU_INSPECTION_ITEMS,
  cleaning: DEFAULT_PDU_CLEANING_ITEMS,
  dpm_recording: DEFAULT_PDU_DPM_RECORDING,
  iso_trans_temp: DEFAULT_PDU_ISO_TRANS_TEMP,
  voltage_ampere: DEFAULT_PDU_VOLTAGE_AMPERE,
  thermal_measurement: DEFAULT_PDU_THERMAL,
  grounding_resistance: DEFAULT_PDU_GROUNDING,
  noise_measurement: DEFAULT_PDU_NOISE,
  analysis_remark: DEFAULT_PDU_ANALYSIS_REMARK,
};
