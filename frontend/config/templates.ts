export const REPORT_TEMPLATES: Record<string, string[]> = {
  'pump@gmail.com': [
    'Condition Pump',
    'Cleaning Pump',
    'Check seal gasket',
    'Check condition Valve',
    'Measurement Vibration',
    'Measurement Temperature',
    'Measurement Grounding',
    'Measurement Voltage Fasa to Fasa',
    'Measurement Fasa to Netral',
    'Measurement Ampere R',
    'Measurement Ampere S',
    'Measurement Ampere T'
  ],
  'busduct@gmail.com': [
    'Visual inspect busduct',
    'Nameplate',
    'Cleaning busduct',
    'Cleaning busduct',
    'Cleaning busduct',
    'Thermal on joint conection'
  ],
  'mv@gmail.com': [
    'NAMEPLAT',
    'MEASUREMENT SUMMARY ON DPM',
    'MEASUREMENT LINE LINE VOLTAGE ON DPM',
    'MEASUREMENT CURRENT ON DPM',
    'MEASUREMENT LINE NEUTRAL VOLTAGE ON DPM',
    'MEASUREMENT FREQUENCY ON DPM',
    'MEASUREMENT TEMPERATURE USING THERMAL IMAGER',
    'MEASUREMENT VOLTAGE PHASE TO NETRAL',
    'MEASUREMENT GROUNDING',
    'CLEANING PANEL USING VACCUM CLEANER',
    'CLEANING PANEL',
    'CLEANING PANEL'
  ],
  'pju@gmail.com': [
    'Cleaning Panel PJU dan Batrai',
    'Tightening',
    'Cleaning Solar Cell',
    'Check Tegangan Batrai 1',
    'Check Tegangan Batrai 2',
    'Check Tegangan 2 Batrai',
    'Check Tegangan Solar Cell',
    'Tightening Sambungan Kabel',
    'Check Visual Lampu LED',
    'Cleaning LED Lampu Box LED',
    'Measurement lux lamp'
  ],
  'fcu@gmail.com': [
    'R-S',
    'R-T',
    'S-T',
    'R-N',
    'S-N',
    'T-N',
    'Current R',
    'Current S',
    'Current T',
    'Checking Vibration',
    'Checking Air Flow',
    'Checking Humidity',
    'Checking Noise',
    'Pressure Supply',
    'Pressure Return',
    'Checking Temperature',
    'Nameplate',
    'Cleaning evaporator'
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
    'Name Plate',
    'Cleaning Panels menggunakan vacuum cleaner',
    'Pengecekan Digital Power Meter (Volt)',
    'Pengecekan Digital Power Meter (KW)',
    'Pengecekan Digital Power Meter (Volt)',
    'Pengecekan Digital Power Meter (Ampere)',
    'Measurement Voltage R-S',
    'Measurement Voltage S-T',
    'Measurement Voltage T-R',
    'Measurement Voltage R-N',
    'Measurement Voltage S-N',
    'Measurement Voltage T-N',
    'Measurement N-G',
    'Measurement Ampere (R)',
    'Measurement Ampere (S)',
    'Measurement Ampere (T)',
    'Measurement Ampere (N)',
    'Measurement Grounding',
    'Flir',
    'Temperature Isotrans',
    'Measurement Noise',
    'Factor daya'
  ],
  'coolingtower@gmail.com': [
    // Visual Inspection & Maintenance - CT Devices
    'Inspection & Checked of basin (upper, lower) from corrosive, erosion, algae',
    'Inspection & Checked the filler from damaged',
    'Inspection & Checked the all support/mounting (CT Fan, Motor CT Fan, Pump CWP, pipes installation)',
    'Inspection & Checked tightening all support/mounting (CT Fan, Motor CT Fan, Pump CWP, pipes installation)',
    'Inspection & Checked for floating check valve from clogged and damaged',
    'Inspection & Checked all valve from clogged and damaged',
    'Inspection & Checked of Motor Fan (pulley, tension belt)',
    'Inspection & Checked the fan blades for cracks, missing balancing, weights, and vibrations',
    'Inspection & Checked the Check sheaves, bushings, fan shafts and fan hubs Annually for corrosion',
    'Inspection & Checked the spray nozzles, Strainer, and Drift Eliminator from clogged and damaged',
    'Inspection & Checked the enclosure (Access door, stairs)',
    // Visual Inspection & Maintenance - Panel Control
    'Inspection of support levelness (alignment)',
    'Inspection function of power meters',
    'Inspection function of lamps and indicators',
    'Inspection of locking devices for signs damage or worn',
    'Inspection of control wiring, relays, power supply units, timers',
    'Inspection electronic surge protection is installed',
    'Inspection of control circuit fuse rating and continuity',
    'Inspection for signs of overheating or deterioration',
    'Inspection of panels for paint damage and signs of corrosion',
    'Inspection function of selector switch and push button',
    // Cleaning - CT & Panel Control
    'Cleaning of basin (upper, lower)',
    'Cleaning the filler with air spray / brush',
    'Cleaning the all support/mounting (CT Fan, Motor CT Fan, Pump CWP, pipes installation)',
    'Cleaning enclosure/casing with brush',
    'Cleaning for floating check valve include probe/terminal with vacuum cleaner',
    'Cleaning all valve with vacuum cleaner',
    'Cleaning Motor & Fan CT and Greasing the Motor bearings',
    'Cleaning of upper basin, lower basin, and filler',
    'Cleaning of enclosure (cover panel, doors, form covers)',
    'Thorough cleaning such as mcb, timer, etc.',
    // Measurement
    'Measurement input/output voltage (R-N, S-N, T-N, R-S, S-T, T-R) & current (R, S, T)',
    'Verify temperature measurements (°C)',
    'Measurement of suction and discharge pipes pressure (bar)',
    'Measurement of output air flow',
    'Temperature measurement on fan motor',
    'Rotation speed measurement fan outdoor (RPM)'
  ],
  'generator@gmail.com': [
    // Visual Inspection (a-t)
    'Inspection of display unit Control Genset, make sure display is in good condition, isolate system control',
    'Standby in location LV panel distribution power room, Genset under maintenance',
    'Replace filter Water Separator ensure valve closed, open drain filter water separator',
    'Fuel Filter & Fuel Pre-Filter collect remaining fuel with drain pan external',
    'Check level oil and condition using dip stick and inspection leaked oil',
    'Oil Filter & Oil Pre-Filter collect remaining oil with drain pan external',
    'Replace Air Filter',
    'Check radiator water level and leaks in pipes',
    'Inspect condition of radiator fan belt (tension, visual damage)',
    'Verify position and function of daily tank inlet/outlet valve',
    'Inspect daily tank pipes for leaks and record fuel level',
    'Check for water/sediment contamination in tank through sight glass',
    'Inspect alternator, terminal block, and fuses (multi tester)',
    'Check battery connections (tighten if loose)',
    'Check all power and battery cable connections',
    'Test indicator lights and push buttons',
    'Visually check control modules on PKG and APM panels',
    'Inspect condition of exhaust system',
    'Check alarm log and record any alarms that occur',
    'Checking Condition and Function of Heater',
    // Cleaning Generator (a-d)
    'Clean engine, hoses, accessories, radiator fan, air ducts, air filter, fuel system',
    'Cleaning of air filter & fuel filter',
    'Cleaning of Generator body & battery',
    'Cleaning inside and outside of PKG and APM panels',
    // Measurements (a-i)
    'Measuring Output Voltage, Output Current, power consumption with multi tester',
    'Measuring voltage DC battery and current battery used battery tester',
    'Measuring torque nut connection used torque wrench refer table nut torque',
    'Measuring voltage DC alternator and current battery used multi tester',
    'Measuring Grounding Resistance & Current used clamp earth tester',
    'Measuring battery impedance using battery tester',
    'Noise/Sound Level Measurement',
    'Measuring Vibration',
    'Measuring Coolant contaminant'
  ],
  'lps@gmail.com': [
    'Nameplate tiang', 'Cleaning Lightning Counter', 'Cleaning Obstruction lamp',
    'Tigtening air terminal', 'Measurement obstruction lamp', 'Earthing resistance measurement',
    'Lightning counter recording', 'Test continuitas wiring cable lightning'
  ],
  'grounding@gmail.com': [
    'Measurement', 'Before', 'After', 'Tightening'
  ],
  'ldb/rdb@gmail.com': [
    'Condition panel',
    'Tightening panel',
    'Cleaning panel',
    'Check Thermal Imager',
    'Measurement Grounding',
    'Measurement Voltage R - S',
    'Measurement Voltage S - T',
    'Measurement Voltage T - R',
    'Measurement Voltage R - N',
    'Measurement Voltage S - N',
    'Measurement Voltage T - N',
    'Measurement Voltage N - G',
    'Measurement Ampere R',
    'Measurement Ampere S',
    'Measurement Ampere T',
    'Measurement Ampere N',
    'Measurement Voltage DPM',
    'Measurement Voltage DPM',
    'Measurement Ampere DPM',
    'Measurement Daya DPM',
    'Measurement Cos Phi'
  ],
  'acsplit@gmail.com': [
    'Nameplate / Unit ID Split Wall AC',
    'Inspeksi Area & Turn Off AC (Remote/Power)',
    'Cleaning Air Filter & Cover Indoor Unit',
    'Cleaning Evaporator Coil (Steam Water Pump)',
    'Flush Drain Pan & Vacuum Drain Pipe',
    'Inspeksi & Cleaning Outdoor Condenser Coil',
    'Inspeksi Fan Motor & Kelistrikan Outdoor',
    'Pengukuran Tegangan Voltage (VAC)',
    'Pengukuran Arus Ampere (A)',
    'Pengukuran Tekanan Refrigerant R32 (115-145 psi)',
    'Pengujian Temperatur & Embusan Air Flow',
    'Pemeriksaan Remote Control & Controller Unit',
    'Reinstall Body Cover & Final Cleanness'
  ],
  'dockleveler@gmail.com': [
    'Pengecekan Hidrolik',
    'Pengecekan Platform/Deck',
    'Pengecekan Lip Plate',
    'Pelumasan Moving Parts',
    'Pengecekan Safety Features',
    'Test Operasional',
    'Noise',
    'R-S',
    'S-T',
    'R-T',
    'R-N',
    'S-N',
    'T-N',
    'N-G',
    'Ampere R',
    'Ampere S',
    'Ampere T'
  ],
  'door@gmail.com': [
    'Cleaning rolling dor',
    'clening motor',
    'lubrication chain motor',
    'lubrication gear motor',
    'cleaning panel',
    'Tightening',
    'measrument R-S',
    'measrument S-T',
    'measrument T-R',
    'measrument R-N',
    'measrument S-N',
    'measrument T-N',
    'measrument N-G',
    'measrument Ampere R',
    'measrument Ampere S',
    'measrument Ampere T'
  ],
  'gate@gmail.com': [
    'Cleaning Motor',
    'Voltage Measurement',
    'Tightening Wheel',
    'Setting Magnetic Sensor',
    'Ampere Measurement',
    'Lubricant Roll',
    'Lubricant Bearing Gear',
    'Tigtening Bolt Base Frame',
    'Tigtening Bolt Module'
  ],
  'capacitorbank@gmail.com': [
    'Perform a visual inspection and check the PFC/varimetric regulator settings',
    'Inspection and check current (A) at general incomer to the capasitor bank using Clamp Meter',
    'Inspection and check current at incomer to each step with forcing of step',
    'Inspection and check THDv/i using Power Quality Analyzer while the capacitor bank operating',
    'Inspection and check capasitors are discharged',
    'Inspection and check condition of components (capasitors, switches and fuses)',
    'Inspection capacitance values with capacitance meter',
    'Inspection for any physical abnormalities, such as swelling or leaks, that would indicate failure',
    'Cleaning, remove object from top of controller using vacuum cleaner',
    'Inspection DPM, and make sure measurement on reading in DPM',
    'Inspect for access gaps in the panel that could allow dust and water to enter, make sure there are no holes by using sealant',
    'Cleaning/dust removal from ventilation system and the whole of the bank',
    'Clean the chassis of dust and dirt using a vacuum or dry cloth.',
    'Clean the operating mechanism of dust and dirt',
    'Clean the surface of the busbar from dust using dry cloth or vacuum',
    'Clean the fan and ventilation grill using vacuum cleaner',
    'Phase-to-Phase Voltage - Voltage R-S (V)',
    'Phase-to-Phase Voltage - Voltage S-T (V)',
    'Phase-to-Phase Voltage - Voltage T-R (V)',
    'Phase-to-Neutral Voltage - Voltage R-N (V)',
    'Phase-to-Neutral Voltage - Voltage S-N (V)',
    'Phase-to-Neutral Voltage - Voltage T-N (V)',
    'Phase-to-Neutral Voltage - Voltage N-G (V)',
    'Current / Ampere - Ampere R (A)',
    'Current / Ampere - Ampere S (A)',
    'Current / Ampere - Ampere T (A)',
    'Current / Ampere - Ampere N (A)',
    'Thermal Measurement (<40°C)',
    'Grounding Resistance Measurement (<5 Ω)',
    'Capacitance Measurement (uF)'
  ],
  'ldbrdb@gmail.com': [
    'Condition panel',
    'Tightening panel',
    'Cleaning panel',
    'Check Thermal Imager',
    'Measurement Grounding',
    'Measurement Voltage R - S',
    'Measurement Voltage S - T',
    'Measurement Voltage T - R',
    'Measurement Voltage R - N',
    'Measurement Voltage S - N',
    'Measurement Voltage T - N',
    'Measurement Voltage N - G',
    'Measurement Ampere R',
    'Measurement Ampere S',
    'Measurement Ampere T',
    'Measurement Ampere N',
    'Measurement Voltage DPM',
    'Measurement Voltage DPM',
    'Measurement Ampere DPM',
    'Measurement Daya DPM',
    'Measurement Cos Phi'
  ],
  'lightingsystem@gmail.com': [
    'Nameplate', 'measurement voltage', 'measurement ampere',
    'cleaning lampu', 'cleaning lampu', 'cleaning lampu',
    'cleaning lampu', 'cleaning lampu', 'cleaning lampu',
    'cleaning lampu', 'cleaning lampu', 'cleaning lampu'
  ],
  'crac@gmail.com': [
    'Display CRAC', 'Cleaning Filter', 'Cleaning unit', 'Measurement Grounding',
    'Measurement temperature/Humidity', 'Measurement air flow', 'Measurement vibration',
    'Measurement Voltage fasa to fasa', 'Measurement Voltage fasa to netral',
    'Measurement Voltage power supply', 'Measurement Ampere', 'Measurement DPM'
  ],
  'wld@gmail.com': [
    'Status', 'Test Ping', 'System Setting', 'Communication Setting',
    'Tag Cable', 'Cleaning', 'Fg Map', 'Test'
  ],
  'fld@gmail.com': [
    'Status', 'Test Ping', 'System Setting', 'FG BBOX #2 CABLES',
    'Tag Cable', 'Cleaning', 'MAPS', 'Test'
  ],
  'exaustfan@utt.com': [
    'Cleaning Fan',
    'Check Fan Blade',
    'Measurement air flow',
    'Measurement Voltage',
    'Measurement Ampere',
    'Measurement Vibration',
    'RS',
    'ST',
    'TR',
    'RN',
    'SN',
    'TN',
    'NG',
    'R',
    'Ampere R',
    'Ampere S',
    'Ampere T',
    'Ampere N'
  ],
  'exausttan@utt.com': [
    'Cleaning Fan',
    'Check Fan Blade',
    'Measurement air flow',
    'Measurement Voltage',
    'Measurement Ampere',
    'Measurement Vibration',
    'RS',
    'ST',
    'TR',
    'RN',
    'SN',
    'TN',
    'NG',
    'R',
    'Ampere R',
    'Ampere S',
    'Ampere T',
    'Ampere N'
  ],
  'trafo@gmail.com': [
    'Condition Panel',
    'Cleaning trafo',
    'Measurement Noise',
    'Check Thermal Imager',
    'Measurement Grounding',
    'Measurement Voltage R - S',
    'Measurement Voltage S - T',
    'Measurement Voltage T - R',
    'Measurement Voltage R - N',
    'Measurement Voltage S - N',
    'Measurement Voltage T - N',
    'Measurement Voltage N - G',
    'Measurement Ampere R',
    'Measurement Ampere S',
    'Measurement Ampere T',
    'Measurement Ampere N',
    'Measurement Voltage DPM',
    'Measurement Voltage DPM',
    'Measurement Ampere DPM',
    'Measurement Daya DPM'
  ],
  'ats@gmail.com': [
    'Condition Panel',
    'Cleaning panel',
    'Check Thermal Imager',
    'Measurement Grounding',
    'Measurement Voltage R - S',
    'Measurement Voltage S - T',
    'Measurement Voltage T - R',
    'Measurement Voltage R - N',
    'Measurement Voltage S - N',
    'Measurement Voltage T - N',
    'Measurement Voltage N - G',
    'Measurement Ampere R',
    'Measurement Ampere S',
    'Measurement Ampere T',
    'Measurement Ampere N',
    'Measurement Voltage DPM',
    'Measurement Voltage DPM',
    'Measurement Ampere DPM',
    'Measurement Daya DPM'
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

export const AHHU_TEMPLATE = {
  outdoor: [
    'MEASUREMENT VOLTAGE R-S',
    'MEASUREMENT VOLTAGE S-T',
    'MEASUREMENT VOLTAGE T-R',
    'MEASUREMENT VOLTAGE R-N',
    'MEASUREMENT VOLTAGE S-N',
    'MEASUREMENT VOLTAGE T-N',
    'MEASUREMENT VOLTAGE N-G',
    'MEASUREMENT CURRENT R',
    'MEASUREMENT CURRENT S',
    'MEASUREMENT CURRENT T',
    'MEASUREMENT SUCTION & DISCHARGE',
    'CLEANING UNIT'
  ],
  indoor: [
    'MEASUREMENT VOLTAGE R-S',
    'MEASUREMENT VOLTAGE S-T',
    'MEASUREMENT VOLTAGE T-R',
    'MEASUREMENT VOLTAGE R-N',
    'MEASUREMENT VOLTAGE S-N',
    'MEASUREMENT VOLTAGE T-N',
    'MEASUREMENT VOLTAGE N-G',
    'MEASUREMENT CURRENT R',
    'MEASUREMENT CURRENT S',
    'MEASUREMENT CURRENT T',
    'MEASUREMENT VIBRATION',
    'MEASUREMENT TEMPERATURE',
    'MEASUREMENT AIR FLOW',
    'MEASUREMENT NOISE',
    'MEASUREMENT HUMIDITY'
  ]
};

export const LV_ATS_TRAFO_TEMPLATE = (email: string) => {
  if (email === 'lv@gmail.com') {
    return [
      'Cleaning panel', 'Cleaning panel', 'Cleaning panel',
      'Check Thermal Imager', 'Measurement Grounding', 'Measurement voltage fasa to fasa',
      'Measurement voltage fasa to netral', 'Measurement voltage N to G',
      'Measurement Ampere R', 'Measurement Ampere S', 'Measurement Ampere T',
      'Measurement Ampere N'
    ];
  }

  return [
    'Condition Panel',
    'Cleaning panel',
    'Check Thermal Imager',
    'Measurement Grounding',
    'Measurement Voltage R - S',
    'Measurement Voltage S - T',
    'Measurement Voltage T - R',
    'Measurement Voltage R - N',
    'Measurement Voltage S - N',
    'Measurement Voltage T - N',
    'Measurement Voltage N - G',
    'Measurement Ampere R',
    'Measurement Ampere S',
    'Measurement Ampere T',
    'Measurement Ampere N',
    'Measurement Voltage DPM',
    'Measurement Voltage DPM',
    'Measurement Ampere DPM',
    'Measurement Daya DPM'
  ];
};

export interface HSEChecklist {
  mop: boolean;
  jsa: boolean;
  ptw: boolean;
  loto: boolean;
  lockOut: boolean;
  tagOut: boolean;
  ppe: boolean;
  toolsBertagging: boolean;
  logMaintenance: boolean;
  housekeeping: boolean;
  safeCondition: boolean;
  safeAction: boolean;
  safetySign: boolean;
  ppeKhusus: boolean;
  bodyHarness: boolean;
  sarungTanganKaretHighVoltage: boolean;
  sarungTanganKaretChemical: boolean;
  apron: boolean;
  kedokLas: boolean;
  coverShoes: boolean;
  respirator: boolean;
  sarungTanganCutResistance: boolean;
  pitaBaricade: boolean;
  safetyCone: boolean;
  stikBariket: boolean;
  underMaintenance: boolean;
  dokumen: boolean;
  msds: boolean;
  pelindungMata: boolean;
}

export const INITIAL_HSE_CHECKLIST: HSEChecklist = {
  mop: false,
  jsa: false,
  ptw: false,
  loto: false,
  lockOut: false,
  tagOut: false,
  ppe: false,
  toolsBertagging: false,
  logMaintenance: false,
  housekeeping: false,
  safeCondition: false,
  safeAction: false,
  safetySign: false,
  ppeKhusus: false,
  bodyHarness: false,
  sarungTanganKaretHighVoltage: false,
  sarungTanganKaretChemical: false,
  apron: false,
  kedokLas: false,
  coverShoes: false,
  respirator: false,
  sarungTanganCutResistance: false,
  pitaBaricade: false,
  safetyCone: false,
  stikBariket: false,
  underMaintenance: false,
  dokumen: false,
  msds: false,
  pelindungMata: false,
};

export const HSE_CHECKLIST_LABELS: { key: keyof HSEChecklist; label: string; subItems?: { key: keyof HSEChecklist; label: string }[] }[] = [
  { key: 'mop', label: 'MOP' },
  { key: 'jsa', label: 'JSA' },
  { key: 'ptw', label: 'PTW' },
  {
    key: 'loto',
    label: 'LOTO',
    subItems: [
      { key: 'lockOut', label: 'Lock Out' },
      { key: 'tagOut', label: 'Tag Out' },
    ]
  },
  { key: 'ppe', label: 'PPE Mandatory' },
  {
    key: 'ppeKhusus',
    label: 'PPE Khusus',
    subItems: [
      { key: 'bodyHarness', label: 'Body Harness' },
      { key: 'sarungTanganKaretHighVoltage', label: 'Sarung Tangan Karet High Voltage Resistance' },
      { key: 'sarungTanganKaretChemical', label: 'Sarung Tangan Karet Chemical Resistance' },
      { key: 'apron', label: 'Apron' },
      { key: 'kedokLas', label: 'Kedok Las' },
      { key: 'coverShoes', label: 'Cover Shoes' },
      { key: 'respirator', label: 'Respirator' },
      { key: 'sarungTanganCutResistance', label: 'Sarung Tangan Cut Resistance' },
      { key: 'pelindungMata', label: 'Pelindung Mata' },
    ]
  },
  {
    key: 'dokumen',
    label: 'Dokumen',
    subItems: [
      { key: 'msds', label: 'MSDS' },
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

export const HSE_REPORT_TYPES = {
  INSPECTION: 'inspection',
  SIO: 'sio',
  SILO: 'silo'
} as const;

export type HSEReportType = typeof HSE_REPORT_TYPES[keyof typeof HSE_REPORT_TYPES];

export const MAINTENANCE_CATEGORIES = [
  'LIFT',
  'FIRE ALARM',
  'FIRE HYDRANT',
  'GENSET',
  'TRAFO',
  'PUMP',
  'HVAC',
  'ELECTRICAL',
  'OTHER'
];

