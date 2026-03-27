export const REPORT_TEMPLATES: Record<string, string[]> = {
  'fcu@gmail.com': [
    'R-S', 'R-T', 'S-T', 'R-N', 'S-N', 'T-N',
    'Current R', 'Current S', 'Current T',
    'Checking Vibration', 'Checking Air Flow', 'Checking Humidity',
    'Checking Noise', 'Pressure Supply', 'Pressure Return',
    'Checking Temperature', 'Cleaning Filter', 'Cleaning evaporator'
  ],
  'dock': [
    'Pengecekan Hidrolik', 'Pengecekan Platform/Deck', 'Pengecekan Lip Plate',
    'Pelumasan Moving Parts', 'Pengecekan Safety Features', 'Test Operasional'
  ],
  'leveler': [
    'Pengecekan Hidrolik', 'Pengecekan Platform/Deck', 'Pengecekan Lip Plate',
    'Pelumasan Moving Parts', 'Pengecekan Safety Features', 'Test Operasional'
  ],
  'pdu@gmail.com': [
    'Name Plate', 'Measurement Temp Monitoring ISO-TRANS', 'Cleaning Panels menggunakan vacuum cleaner',
    'Measurement Panel', 'Pengecekan Digital Power Meter (KW)', 'Pengecekan Digital Power Meter (Volt)',
    'Pengecekan Digital Power Meter (Volt)', 'Pengecekan Digital Power Meter (Ampere)', 'Measurement Noise',
    'Measurement Voltage R-S', 'Measurement Voltage S-T', 'Measurement Voltage T-R', 'Measurement Voltage R-N',
    'Measurement Voltage S-N', 'Measurement Voltage T-N', 'Measurement Grounding', 'Measurement Ampere (R)',
    'Measurement Ampere (S)', 'Measurement Ampere (T)', 'Measurement Ampere (N)'
  ],
  'lps@gmail.com': [
    'Nameplate tiang', 'Cleaning Lightning Counter', 'Cleaning Obstruction lamp',
    'Tigtening air terminal', 'Measurement obstruction lamp', 'Earthing resistance measurement',
    'Lightning counter recording', 'Test continuitas wiring cable lightning'
  ],
  'pju@gmail.com': [
    'Cleaning Panel PJU dan Batrai', 'Tightening', 'Cleaning Solar Cell',
    'Check Tegangan Batrai 1', 'Check Tegangan Batrai 2', 'Check Tegangan 2 Batrai',
    'Check Tegangan Solar Cell', 'Tightening Sambungan Kabel', 'Check Visual Lampu LED',
    'Cleaning LED Lampu Box LED'
  ],
  'grounding@gmail.com': [
    'Measurement', 'Before', 'After', 'Tightening'
  ],
  'ldb/rdb@gmail.com': [
    'Condition panel', 'Tightening panel', 'Cleaning panel',
    'Check Thermal Imager', 'Measurement Grounding', 'Measurement Voltage R - S',
    'Measurement Voltage S - T', 'Measurement Voltage T - R', 'Measurement Voltage R - N',
    'Measurement Voltage S - N', 'Measurement Voltage T - N', 'Measurement Voltage N - G',
    'Measurement Ampere R', 'Measurement Ampere S', 'Measurement Ampere T',
    'Measurement Ampere N', 'Measurement Voltage DPM', 'Measurement Voltage DPM',
    'Measurement Ampere DPM', 'Measurement Daya DPM'
  ],
  'acsplit@gmail.com': [
    'Condition unit', 'Cleaning evaporator', 'Vacum draine AC', 'Cleaning Filter',
    'Measurement Voltage', 'Measurement ampere', 'Cleaning fan outdoor', 'Cleaning Filter',
    'Measurement pressure freon'
  ],
  'busduct@gmail.com': [
    'Visual inspect busduct', 'Cleaning busduct', 'Cleaning busduct',
    'Cleaning busduct', 'Cleaning busduct', 'Thermal on joint conection',
  ],
  'lightingsystem@gmail.com': [
    'Nameplate', 'measurement voltage', 'measurement ampere',
    'cleaning lampu', 'cleaning lampu', 'cleaning lampu',
    'cleaning lampu', 'cleaning lampu', 'cleaning lampu',
    'cleaning lampu', 'cleaning lampu', 'cleaning lampu'
  ]
};

export const VRV_TEMPLATE = {
  outdoor: [
    'Voltage R-S', 'Voltage R-T', 'Voltage S-T', 'Voltage R-N', 'Voltage S-N', 'Voltage T-N', 'Voltage N-G',
    'Current R', 'Current S', 'Current T', 'Pressure Suction', 'Pressure Discharge', 
    'Cleaning Kondensor', 'Cleaning Fan', 'Nameplate'
  ],
  indoor: [
    'Checking Voltase', 'Checking Ampere', 'Checking Vibration',
    'Checking Temperature', 'Checking Humidity', 'Checking Air Flow',
    'Checking Noise', 'Vacuum Drain pump', 'Vacuum Drain pipe',
    'Test Drain', 'Cleaning Filter', 'Cleaning Evaporator',
    'Cleaning Fan', 'Nameplate', 'Remote'
  ]
};

export const LV_ATS_TRAFO_TEMPLATE = (email: string) => {
  const isTrafo = email === 'trafo@gmail.com';
  let template = [
    'Condition Panel', 'Check water pas', isTrafo ? 'Cleaning trafo' : 'Cleaning panel',
    'Check Thermal Imager', 'Measurement Grounding', 'Measurement Voltage R - S',
    'Measurement Voltage S - T', 'Measurement Voltage T - R', 'Measurement Voltage R - N',
    'Measurement Voltage S - N', 'Measurement Voltage T - N', 'Measurement Voltage N - G',
    'Measurement Ampere R', 'Measurement Ampere S', 'Measurement Ampere T',
    'Measurement Ampere N', 'Measurement Voltage DPM', 'Measurement Voltage DPM',
    'Measurement Ampere DPM', 'Measurement Daya DPM'
  ];

  if (email === 'ats@gmail.com' || isTrafo) {
    template = template.filter(t => t !== 'Check water pas');
  }

  if (isTrafo) {
    const cleaningIdx = template.indexOf('Cleaning trafo');
    if (cleaningIdx !== -1) {
      template.splice(cleaningIdx + 1, 0, 'Measurement Noise');
    }
  }
  return template;
};

export interface HSEChecklist {
  mop: boolean;
  jsa: boolean;
  ptw: boolean;
  ppe: boolean;
  toolsBertagging: boolean;
  logMaintenance: boolean;
  housekeeping: boolean;
  safeCondition: boolean;
  safeAction: boolean;
  safetySign: boolean;
  ppeKhusus: boolean;
  bodyHarness: boolean;
  sarungTanganKulit: boolean;
  apron: boolean;
  kedokLas: boolean;
  coverShoes: boolean;
  respirator: boolean;
  pitaBaricade: boolean;
  safetyCone: boolean;
  stikBariket: boolean;
  underMaintenance: boolean;
}

export const INITIAL_HSE_CHECKLIST: HSEChecklist = {
  mop: false,
  jsa: false,
  ptw: false,
  ppe: false,
  toolsBertagging: false,
  logMaintenance: false,
  housekeeping: false,
  safeCondition: false,
  safeAction: false,
  safetySign: false,
  ppeKhusus: false,
  bodyHarness: false,
  sarungTanganKulit: false,
  apron: false,
  kedokLas: false,
  coverShoes: false,
  respirator: false,
  pitaBaricade: false,
  safetyCone: false,
  stikBariket: false,
  underMaintenance: false,
};

export const HSE_CHECKLIST_LABELS: { key: keyof HSEChecklist; label: string; subItems?: { key: keyof HSEChecklist; label: string }[] }[] = [
  { key: 'mop', label: 'MOP' },
  { key: 'jsa', label: 'JSA' },
  { key: 'ptw', label: 'PTW' },
  { key: 'ppe', label: 'PPE Mandatory' },
  { 
      key: 'ppeKhusus', 
      label: 'PPE Khusus',
      subItems: [
          { key: 'bodyHarness', label: 'Body Harness' },
          { key: 'sarungTanganKulit', label: 'Sarung Tangan Kulit' },
          { key: 'apron', label: 'Apron' },
          { key: 'kedokLas', label: 'Kedok Las' },
          { key: 'coverShoes', label: 'Cover Shoes' },
          { key: 'respirator', label: 'Respirator' },
      ]
  },
  { key: 'toolsBertagging', label: 'Tools Bertagging & sdh di-checklist' },
  { key: 'logMaintenance', label: 'Log Maintenance' },
  { key: 'housekeeping', label: 'Housekeeping Area Kerja' },
  {
      key: 'safetySign',
      label: 'Safety Sign',
      subItems: [
          { key: 'pitaBaricade', label: 'Pita Baricade' },
          { key: 'safetyCone', label: 'Safety Cone' },
          { key: 'stikBariket', label: 'Stik Bariket' },
          { key: 'underMaintenance', label: 'Under Maintenance' },
      ]
  },
  { key: 'safeCondition', label: 'Safe Condition' },
  { key: 'safeAction', label: 'Safe Action' },
];
