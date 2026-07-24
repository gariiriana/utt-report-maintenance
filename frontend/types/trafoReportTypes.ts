export interface TrafoCustomerInfo {
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

export interface TrafoInspectionItem {
  no: string;
  activity: string;
  parameter: string;
  statusOK: boolean;
  statusNOK: boolean;
  statusNA: boolean;
  remarks: string;
}

export interface TrafoMeasurementItem {
  no: string;
  activity: string;
  parameter: string;
  result: string;
  statusOK: boolean;
  statusNOK: boolean;
  statusNA: boolean;
  remarks: string;
}

export interface TrafoTestingItem {
  no: string;
  activity: string;
  parameter: string;
  result: string;
  statusOK: boolean;
  statusNOK: boolean;
  statusNA: boolean;
  remarks: string;
}

export interface TrafoFormat2Visual {
  no: string;
  activity: string;
  condition: 'Good' | 'Not Good' | 'Clean' | 'Not Clean';
  remarks: string;
}

export interface TrafoCurrentLoadRecording {
  rsVolt: string;
  stVolt: string;
  trVolt: string;
  ngVolt: string;
  rnVolt: string;
  snVolt: string;
  tnVolt: string;
  rAmp: string;
  sAmp: string;
  tAmp: string;
  nAmp: string;
  rKw: string;
  sKva: string;
  tKvar: string;
  remarks: string;
}

export interface TrafoVoltageCurrentMeasurement {
  rsVolt: string;
  stVolt: string;
  trVolt: string;
  ngVolt: string;
  rnVolt: string;
  snVolt: string;
  tnVolt: string;
  rAmp: string;
  sAmp: string;
  tAmp: string;
  nAmp: string;
  remarks: string;
}

export interface TrafoNoiseMeasurement {
  resultDb: string;
  remarks: string;
}

export interface TrafoThermalImager {
  resultTemp: string;
  remarks: string;
}

export interface TrafoTempSensorSetting {
  tempR: string;
  tempS: string;
  tempT: string;
  fanOn: string;
  fanOff: string;
  alarm: string;
  trip: string;
  remarks: string;
}

export interface TrafoAnalysis {
  isNormal: boolean;
  isAbnormal: boolean;
  remark: string;
  faultSymptom: string;
  faultAnalysis: string;
  workDone: string;
  faultPartSN: string;
  faultPartName: string;
}

export interface TrafoTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export interface TrafoReportData {
  // Format 1
  visualInspection: TrafoInspectionItem[];
  cleaning: TrafoInspectionItem[];
  measurement: TrafoMeasurementItem[];
  testing: TrafoTestingItem[];
  // Format 2
  format2VisualCheck: TrafoFormat2Visual[];
  currentLoad: TrafoCurrentLoadRecording;
  voltageCurrent: TrafoVoltageCurrentMeasurement;
  groundingOhm: string;
  groundingRemarks: string;
  noiseMeasurement: TrafoNoiseMeasurement;
  thermalImager: TrafoThermalImager;
  tempSensorSetting: TrafoTempSensorSetting;
  // Shared
  analysis: TrafoAnalysis;
}

export const DEFAULT_TRAFO_CUSTOMER_INFO: TrafoCustomerInfo = {
  companyName: 'Neutra DC Cikarang',
  type: 'Dry Type / Oil Type',
  specification: '1250 KVA / 20 KV',
  mopNo: 'DME-TDE/MOP/TR/01 0202/26',
  equipmentName: 'Transformator',
  serialNo: 'TR-2026-001',
  quarter: 'Q1',
  ciDescription: 'Transformer Unit',
  productName: 'Trafo Brand',
  location: 'Transformer Room',
  date: new Date().toISOString().split('T')[0],
  ciName: '',
  prodYear: '2021',
  area: 'Building Office',
  engineer: '',
};

export const DEFAULT_TRAFO_VISUAL_ITEMS: TrafoInspectionItem[] = [
  { no: 'a.', activity: 'Inspection of enclosure Transformer (dry type)', parameter: 'Enclosure condition, test pen leakage', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'b.', activity: 'Inspection/check of Transformer tank, bolts, nuts, welded parts from leakage, cracking & corrosion', parameter: 'No leaks or rust', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'c.', activity: 'Inspection/check of cable connection on terminals and ground wire', parameter: 'Tight connection, thermal camera check', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'd.', activity: 'Inspection/check of HV and LV Windings Insulation (dry type)', parameter: 'No insulation damage or hotspot', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'e.', activity: 'Inspection of actual temperature Transformer (dry type)', parameter: 'Winding & ambient temperature within limit', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'f.', activity: 'Inspection of oil temperature Transformer (oil type)', parameter: 'Oil temp meter normal', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'g.', activity: 'Inspection/check of oil level indicator/gauge (oil type)', parameter: 'Oil gauge normal level', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'h.', activity: 'Inspection quality of oil (oil type)', parameter: 'Oil clarity & BDV normal', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'i.', activity: 'Inspection of Transformer accessories', parameter: 'Accessories complete', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'j.', activity: 'Inspection the Transformer equipped with protection relay, check contact point', parameter: 'Relay contact function', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'k.', activity: 'Inspection of cooling system (Fan)', parameter: 'Fan operates smoothly', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
];

export const DEFAULT_TRAFO_CLEANING_ITEMS: TrafoInspectionItem[] = [
  { no: 'a.', activity: 'Cleaning part of Transformer (dry type) / enclosure', parameter: 'Clean from dust', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'b.', activity: 'Cleaning the transformer tank (oil type)', parameter: 'Clean and dry', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'c.', activity: 'Cleaning the porcelain bushings and wiring terminals', parameter: 'Clean from dirt', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'd.', activity: 'Remove the corrosion by sand paper or repaint this part', parameter: 'No active corrosion', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'e.', activity: 'Cleaning the cooling system (Fan)', parameter: 'Blades & grilles clean', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'f.', activity: 'Torque tightening on bushing and wiring terminals', parameter: 'All bolts torque checked', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
];

export const DEFAULT_TRAFO_MEASUREMENT_ITEMS: TrafoMeasurementItem[] = [
  { no: 'a.', activity: 'Transformer current and load recording', parameter: 'Ampere R, S, T, N', result: 'Normal', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'b.', activity: 'Transformer Voltage recording', parameter: 'RS, ST, TR, RN, SN, TN, NG', result: '400V / 230V', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'c.', activity: 'Transformer Grounding resistance measurement', parameter: '< 1 Ohm', result: '0.4 Ohm', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'd.', activity: 'Transformer TTR (Turn Test Ratio) measurement (dry type)', parameter: 'Ratio match nameplate', result: 'Normal', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'e.', activity: 'Transformer dielectric strength/Winding Insulation measurement (dry type)', parameter: '> 1000 M-Ohm', result: 'Pass', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'f.', activity: 'Transformer Partial Discharge measurement', parameter: 'Low PD level', result: 'Pass', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'g.', activity: 'Transformer BDV (Break Down Voltage) measurement (oil type)', parameter: '> 30 kV', result: 'Pass', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'h.', activity: 'Transformer Noise measurement', parameter: 'SNI 04-0204-1989', result: '58 dB', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'i.', activity: 'Thermal Imager measurement', parameter: 'No hotspot detected', result: '< 45 °C', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'j.', activity: 'Check temperature sensor and temperature module setting', parameter: 'Fan On/Off, Alarm, Trip', result: 'OK', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
];

export const DEFAULT_TRAFO_TESTING_ITEMS: TrafoTestingItem[] = [
  { no: 'a.', activity: 'Transformer cooling system test', parameter: 'Auto & Manual fan test', result: 'Pass', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'b.', activity: 'Transformer protection system test (DGPT, Temperature Control)', parameter: 'Trip & alarm test', result: 'Pass', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
  { no: 'c.', activity: 'DGA (Dissolved Gas Analysis) test', parameter: 'Oil gas analysis', result: 'Pass', statusOK: true, statusNOK: false, statusNA: false, remarks: '' },
];

export const DEFAULT_TRAFO_FORMAT2_VISUAL: TrafoFormat2Visual[] = [
  { no: '1a.', activity: 'Inspection of enclosure transformer from electrical leakage using test pen, visual check of corrosive, damaged', condition: 'Good', remarks: '' },
  { no: '1b.', activity: 'Visual Inspection of all nuts, bolt, crack and corrosion', condition: 'Good', remarks: '' },
  { no: '1c.', activity: 'Inspection of cable connection on terminal and grounding wire using thermal imager with capture images', condition: 'Good', remarks: '' },
  { no: '1d.', activity: 'Inspection of HV and LV winding insulation using thermal imager with capture images', condition: 'Good', remarks: '' },
  { no: '1e.', activity: 'Inspection of actual temperature transformer using thermal imager or temperature humidity meter', condition: 'Good', remarks: '' },
  { no: '2a.', activity: 'Make sure the area around the transformer is clean and there is no dirt or anything that can enter the transformer unit', condition: 'Clean', remarks: '' },
];

export const DEFAULT_TRAFO_REPORT_DATA: TrafoReportData = {
  visualInspection: DEFAULT_TRAFO_VISUAL_ITEMS,
  cleaning: DEFAULT_TRAFO_CLEANING_ITEMS,
  measurement: DEFAULT_TRAFO_MEASUREMENT_ITEMS,
  testing: DEFAULT_TRAFO_TESTING_ITEMS,

  format2VisualCheck: DEFAULT_TRAFO_FORMAT2_VISUAL,
  currentLoad: {
    rsVolt: '395', stVolt: '396', trVolt: '395', ngVolt: '1.2',
    rnVolt: '228', snVolt: '229', tnVolt: '228',
    rAmp: '120', sAmp: '122', tAmp: '119', nAmp: '5',
    rKw: '78', sKva: '85', tKvar: '32', remarks: 'Load normal'
  },
  voltageCurrent: {
    rsVolt: '395', stVolt: '396', trVolt: '395', ngVolt: '1.2',
    rnVolt: '228', snVolt: '229', tnVolt: '228',
    rAmp: '120', sAmp: '122', tAmp: '119', nAmp: '5',
    remarks: 'Voltage & Ampere balanced'
  },
  groundingOhm: '0.4',
  groundingRemarks: 'Complies < 1 Ohm',
  noiseMeasurement: { resultDb: '58', remarks: 'Complies SNI 04-0204-1989' },
  thermalImager: { resultTemp: '42', remarks: 'No hotspot detected' },
  tempSensorSetting: {
    tempR: '45', tempS: '46', tempT: '45',
    fanOn: '100', fanOff: '90', alarm: '110', trip: '130',
    remarks: 'Settings verified'
  },

  analysis: {
    isNormal: true,
    isAbnormal: false,
    remark: 'Transformator beroperasi dalam batas aman & normal.',
    faultSymptom: '',
    faultAnalysis: '',
    workDone: '',
    faultPartSN: '',
    faultPartName: '',
  },
};

export const DEFAULT_TRAFO_TIME_SPENT: TrafoTimeSpent = {
  date: new Date().toISOString().split('T')[0],
  departure: '08:00',
  start: '09:00',
  finish: '17:00',
};
