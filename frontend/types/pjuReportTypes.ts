// ─── PJU (Street & Garden Lighting) Service Report Types ─────────────────────────────

export interface PJUPhotoInput {
  base64: string;
  category?: string;
  label: string;
  parameter?: string;
}

export interface PJUAnalyzeRequest {
  photos: PJUPhotoInput[];
}

export interface PJUInspectionItem {
  no: string;
  activity: string;
  parameter: string;
  condition: 'Good' | 'Not Good' | 'Not Applied';
  remarks: string;
}

export interface PJUMeasurementItem {
  no: string;
  activity: string;
  parameter: string;
  condition: 'Good' | 'Not Good';
  remarks: string;
}

export interface PJUTestItem {
  no: string;
  activity: string;
  parameter: string;
  condition: 'Good' | 'Not Good';
  remarks: string;
}

export interface PJUOperationStatusData {
  is_normal: boolean;
  remark: string;
  fault_symptom: string;
  fault_analysis: string;
  work_done: string;
  fault_part_sn: string;
  fault_part_name: string;
}

export interface PJUReportData {
  visual_inspection: PJUInspectionItem[];
  cleaning: PJUInspectionItem[];
  measurement: PJUMeasurementItem[];
  test: PJUTestItem[];
  operation_status: PJUOperationStatusData;
}

export interface PJUCustomerInfo {
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

export interface PJUTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export const DEFAULT_PJU_CUSTOMER_INFO: PJUCustomerInfo = {
  companyName: 'NEUTRA DC CIKARANG',
  equipmentName: 'PJU',
  ciDescription: '-',
  ciName: 'PJU',
  type: '-',
  serialNo: '-',
  productName: '-',
  productYears: '-',
  specification: 'SOLAR CELL',
  location: 'NEUTRA DC',
  area: '-',
  mopNo: 'MOP/DME/01-06/02/2026',
  quarter: 'Q1',
  date: '',
  engineer: 'Tugino',
};

export const DEFAULT_PJU_REPORT_DATA: PJUReportData = {
  visual_inspection: [
    { no: 'a.', activity: 'Inspection visual of lamps', parameter: 'Installed', condition: 'Good', remarks: '' },
    { no: 'b.', activity: 'Inspection all lighting fixtures regularly to ensure they are in good working order', parameter: 'Normal function', condition: 'Good', remarks: '' },
    { no: 'c.', activity: 'Inspection wiring and connections to prevent electrical problems', parameter: 'Connection is well established', condition: 'Good', remarks: '' },
    { no: 'd.', activity: 'Inspection lamps with transformers, control gear, and other accessories', parameter: 'Not damaged', condition: 'Good', remarks: '' },
    { no: 'e.', activity: 'Inspection wiring, screws, gaskets, and exterior light hardware', parameter: 'Connection is well established', condition: 'Good', remarks: '' },
    { no: 'f.', activity: 'Make sure to use lights with the same color temperature', parameter: 'Normal function', condition: 'Good', remarks: '' },
    { no: 'g.', activity: 'Make sure every connection on the lamp is well connected and not easily separated.', parameter: 'Connection is well established', condition: 'Good', remarks: '' },
    { no: 'h.', activity: 'battry check on solar street lighting', parameter: '24 VDC - 27 VDC', condition: 'Good', remarks: '' },
    { no: 'i.', activity: 'Check the RL OPTICA P80 + Soalar Panel C2 to make sure it is not dirty and functions normally.', parameter: 'Normal function', condition: 'Good', remarks: '' },
    { no: 'j.', activity: 'check solar controller carger', parameter: '30 VDC - 40 VDC', condition: 'Good', remarks: '' },
    { no: 'k.', activity: 'check any water leak indication', parameter: 'Connection is well established', condition: 'Good', remarks: '' },
    { no: 'l.', activity: 'check light sensor', parameter: 'Normal function', condition: 'Good', remarks: '' },
  ],
  cleaning: [
    { no: 'a.', activity: 'cleaning lamp house or lamp box', parameter: 'Clean', condition: 'Good', remarks: '' },
    { no: 'b.', activity: 'cleaning light poles for street lighting and garden lights', parameter: 'Clean', condition: 'Good', remarks: '' },
    { no: 'c.', activity: 'cleaning the lamp cover glass to make the lamp light brighter', parameter: 'Clean', condition: 'Good', remarks: '' },
    { no: 'd.', activity: 'cleaning the cable connection area and add protection', parameter: 'Clean', condition: 'Good', remarks: '' },
    { no: 'e.', activity: 'cleaning the solar panel area', parameter: 'Clean', condition: 'Good', remarks: '' },
    { no: 'f.', activity: 'cleaning the control panel', parameter: 'Clean', condition: 'Good', remarks: '' },
    { no: 'g.', activity: 'battry cleaning', parameter: 'Clean', condition: 'Good', remarks: '' },
    { no: 'h.', activity: 'cleaning on the sensor', parameter: 'Clean', condition: 'Good', remarks: '' },
    { no: 'i.', activity: 'cleaning light control panel', parameter: 'Clean', condition: 'Good', remarks: '' },
  ],
  measurement: [
    { no: 'a.', activity: 'Measurement of 30 VDC-40 VDC input power supply', parameter: '30 VDC - 40 VDC', condition: 'Good', remarks: '' },
    { no: 'b.', activity: '24 VDC output poower suplay measurement', parameter: '24 VDC - 27 VDC', condition: 'Good', remarks: '' },
    { no: 'c.', activity: 'Battery Charger & battery Voltage/VDC.', parameter: '24 VDC - 27 VDC', condition: 'Good', remarks: '' },
  ],
  test: [
    { no: 'a.', activity: 'Ensure battery charging when solar panels are exposed to the sun.', parameter: '25 VDC - 40 VDC', condition: 'Good', remarks: '' },
    { no: 'b.', activity: 'Make sure the power suplay is charging the battery', parameter: 'Input 25 VDC', condition: 'Good', remarks: '' },
    { no: 'c.', activity: 'Test the lamp to make sure it lights up with the same lighting color and load as before.', parameter: 'Lamp on and bright normal', condition: 'Good', remarks: '' },
  ],
  operation_status: {
    is_normal: true,
    remark: '',
    fault_symptom: '',
    fault_analysis: '',
    work_done: '',
    fault_part_sn: '',
    fault_part_name: '',
  },
};

export const DEFAULT_PJU_TIME_SPENT: PJUTimeSpent = {
  date: '',
  departure: '',
  start: '',
  finish: '',
};
