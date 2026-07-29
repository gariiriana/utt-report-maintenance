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
    'Inspection & Checked of door movement',
    'Inspection & Checked of signs of waer, rust, dents, and damageon door tracks',
    'Inspection & Checked door tracks are aligned and not sagging',
    'Inspection & Checked of door parts for any signs of damage (spring, motor, frame, cover)',
    'Inspection & Checked of Bumper , Rubber Lip and Lip hinge',
    'Inspection & Checked of Controller Swicth button',
    'Check Motor Condition, Check motor body for overheating, Listen for abnormal sound, Check cable connection',
    'Check Base Frame, Shaft & Door Alignment Base Frame',
    'Motor & Gearbox Inspection',
    'Check Roller Shutter Kit',
    'Cleaning Of Electrical Panel & Electrrical Swicth button',
    'Clean the door tracks from dust, dirt, and debris using a brush or cloth',
    'Thermal Measurement Joint (<40°C)'
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
    // Visual Inspection & Maintenance (a - l)
    'Inspection visual of lamps',
    'Inspection all lighting fixtures regularly to ensure they are in good working order',
    'Inspection wiring and connections to prevent electrical problems',
    'Inspection lamps with transformers, control gear, and other accessories',
    'Inspection wiring, screws, gaskets, and exterior light hardware',
    'Make sure to use lights with the same color temperature',
    'Make sure every connection on the lamp is well connected and not easily separated',
    'Battery check on solar street lighting (24 VDC - 27 VDC)',
    'Check the RL OPTICA P80 + Solar Panel C2 to make sure it is not dirty and functions normally',
    'Check solar controller charger (30 VDC - 40 VDC)',
    'Check any water leak indication',
    'Check light sensor',
    // Cleaning (a - i)
    'Cleaning lamp house or lamp box',
    'Cleaning light poles for street lighting and garden lights',
    'Cleaning the lamp cover glass to make the lamp light brighter',
    'Cleaning the cable connection area and add protection',
    'Cleaning the solar panel area',
    'Cleaning the control panel',
    'Battery cleaning',
    'Cleaning on the sensor',
    'Cleaning light control panel',
    // Measurement (a - c)
    'Measurement of 30 VDC-40 VDC input power supply',
    'Measurement of 24 VDC output power supply',
    'Battery Charger & battery Voltage/VDC (24 VDC - 27 VDC)',
    // Test (a - c)
    'Ensure battery charging when solar panels are exposed to the sun (25 VDC - 40 VDC)',
    'Make sure the power supply is charging the battery (Input 25 VDC)',
    'Test the lamp to make sure it lights up with the same lighting color and load as before',
  ],
  'fcu@gmail.com': [
    // Visual Inspection & Maintenance
    'Checked AC enclosure cleanness with duster',
    'Checked Air Filter cleanness from dust',
    'Checked mounting, vibration, noise with vibration meter and sound level meter',
    'Checked Evaporator Coil cleanness from dust and algae',
    'Checked Electrical control Components',
    'Checked termination of Electrical control Components',
    'Checked supply and return operation pressure',
    'Checked settings point and actual Temperature and Humidity',
    'Checked level and cleaning of flushing and Drain pipes of drain tanks',
    'Checked for airflow obstructions or Airflow Blockade',
    'Checked remote for control unit',
    'Checked and completed missing bolt',
    'Checked all support (tray, compressor, pipe refrigerant, fan indoor, fan)',
    'Inspection & Checked Fan indoor main motor (mounting, support)',
    'Checked drain pump',
    'Inspection tension of fanbelt unit',
    'Check pressure FCU with CHWS',
    'Check pressure FCU with CHWR',
    // Cleaning
    'Cleaning of AC enclosure cleanness',
    'Cleaning Air Filter cleanness',
    'Cleaning component AC from oil & refrigerant',
    'Cleaning flushing and Drain pipes of drain tanks',
    'Cleaning drain pan, drain pump & drain pipe',
    'Cleaning Evaporator Coil cleanness',
    'Cleaning component AC from oil',
    'Cleaning fan motor',
    'Cleaning return air grille',
    'Cleaning airflow obstructions or Airflow Blockade',
    // Measurements
    'Measurement Voltage R-N, S-N, T-N',
    'Measurement Voltage R-S, S-T, T-R',
    'Measurement Current R, S, T',
    'Measurement Vibration & Noise',
    'Measurement Temperature & Humidity',
    'Measurement Supply & Return Pipes Pressure',
    'Measurement Output Airflow',
    // Status & Remarks
    'Normal / Abnormal Operation & Remarks'
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
    // Inspection / Checking (1 - 11)
    'Inspection unsafe action and unsafe condition before start activity maintenance',
    'Check cable grounding to act know voltage in body panel. Measurement current and resistance using claim earth',
    'Inspection & check visual all support panel like a condition paint panel, pilot lamp, chassis panel, padlock system and cleaning using vacuum cleaner.',
    'Inspection & check status breaker incoming and outgoing, cable wiring panel, and fuse',
    'Inspection relay, power supply unit, measurement voltage',
    'Inspection visual tightness all connection cable in terminal cable, label marking, terminal breaker and all mounting nut.',
    'Check condition connection cable using thermal imager if the found anomaly like a hot spot on the connection.',
    'Cleaning panel used vacuum cleaner and apply sanpoly to finish it',
    'Inspection and check visual trafo isotrans with analysis condition temperature operational trafo using thermal imager and measurement noise with sound level',
    'Cleaning, remove object from top of controller',
    'Inspection DPM, and ensure measurement on reading in DPM. Take a photo',
    // Cleaning (1 - 2)
    'Cleaning support panels using a vacuum cleaner',
    'Clean the panel with a vacuum and apply sanpoly.',
    // Digital Power Meter (DPM) Recording
    'Digital Power Meter Ampere R, S, T, N',
    'Digital Power Meter Power KW, KVA, KVAR, Cos p',
    'Digital Power Meter Voltage R-S, S-T, T-R',
    'Digital Power Meter Voltage R-N, S-N, T-N, N-G',
    // Temperature Monitoring ISO-Trans
    'Temperature Monitoring ISO-Trans R, S, T (°C)',
    // Voltage & Ampere Measurement
    'Voltage & Ampere Measurement Voltage R-S, S-T, T-R, R-N, S-N, T-N, N-G',
    'Voltage & Ampere Measurement Ampere R, S, T, N',
    // Thermal Measurement
    'Thermal Measurement Breaker Temperature (°C)',
    'Thermal Measurement Terminal Cable Temperature (°C)'
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
    'Condition panel', 'Tightening panel', 'Cleaning panel',
    'Check Thermal Imager', 'Measurement Grounding', 'Measurement Voltage R - S',
    'Measurement Voltage S - T', 'Measurement Voltage T - R', 'Measurement Voltage R - N',
    'Measurement Voltage S - N', 'Measurement Voltage T - N', 'Measurement Voltage N - G',
    'Measurement Ampere R', 'Measurement Ampere S', 'Measurement Ampere T',
    'Measurement Ampere N', 'Measurement Voltage DPM', 'Measurement Voltage DPM',
    'Measurement Ampere DPM', 'Measurement Daya DPM'
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
    'Inspection & Checked of electrical panel (Voltage, Current, Grounding)',
    'Inspection & Checked of Telescopic Ramp ( Leakage, alignment, Corrosion)',
    'Inspection & Checked Condition of Lip plate, Toe Guards, Deck and Saffety Leg)',
    'Inspection & Checked of Bumper , Rubber Lip and Lip hinge',
    'Inspection & Checked of Controller Swicth button',
    'Inspection & Checked Condition Of Fluid system',
    'Inspection & Checked of Motor Fluid Pump (Mech seal, Leakage, performance, and terminal box)',
    'Cleaning Of Electrical Panel & Electrrical Swicth button',
    'Cleaning of Telescopic Ramp',
    'Cleaning of Motor Fulid Pump, Telescopic Hose, and Reservoir Tank',
    'Lubrication of Lip Hinge, Deck Hinge, and Support Dock leveller',
    'Filling Fluid of Reservoir Tank Or Flushing',
    'Motor Noise Measurement (<75 dB)',
    'Grounding Breaker Measurement (<5Ω)',
    'Voltage & Ampere Measurement'
  ],
  'door@gmail.com': [
    'Inspection & Checked of door movement',
    'Inspection & Checked of signs of waer, rust, dents, and damageon door tracks',
    'Inspection & Checked door tracks are aligned and not sagging',
    'Inspection & Checked of door parts for any signs of damage (spring, motor, frame, cover)',
    'Inspection & Checked of Bumper , Rubber Lip and Lip hinge',
    'Inspection & Checked of Controller Swicth button',
    'Check Motor Condition, Check motor body for overheating, Listen for abnormal sound, Check cable connection,',
    'Check Base Frame, Shaft & Door Alignment Base Frame',
    'Motor & Gearbox Inspection',
    'Check Roller Shutter Kit',
    'Cleaning Of Electrical Panel & Electrrical Swicth button',
    'Clean the door tracks from dust, dirt, and debris using a brush or cloth',
    'Apply approved lubricant to the door motor and moving parts as required',
    'Tightening bolts, Check all bolts and fasteners on the door system',
    'Tightening and check cable control and electrical components termination',
    'Voltage & Ampere Measurement',
    'Noise/Sound Level Measurement (≤ 75 dB(A))',
    'Grounding Resistance Measurement (<5 Ω)'
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
    'Inspection of support levelness used water pass to analysis positioning support panel',
    'Inspection & check visual all support panel like a condition paint panel, pilot lamp, chasiss panel padlock system ect.',
    'Check inspection visual push bottom panel, selector switch, and display DPM',
    'Inspection visual breaker panel (MCCB, MCB), cable and wiring panel, and fuse',
    'Inspection relay, power supply unit, aux contact',
    'Check condition line busbar in the termination busbar RTS using thermal imager',
    'Inspection visual cable connection in the terminal cable MCB / MCCB using thermal imager',
    'cleaning panel used vacuum cleaner and apply sanpoly to finish cleaning body panel',
    'Cleaning, remove object from top of controller using vacuum cleaner',
    'Inspection DPM, and make sure measurement on reading in DPM',
    'Inspect for access gaps in the panel that could allow dust and water to enter, make sure there are no holes by using sealant',
    'Digital Power Meter Recording',
    'Voltage & Ampere Measurement',
    'Thermal Measurement (<40°C)',
    'Grounding Resistance Measurement (<5 Ω)'
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
    'MEASUREMENT VOLTAGE R-T',
    'MEASUREMENT VOLTAGE S-T',
    'MEASUREMENT VOLTAGE R-N',
    'MEASUREMENT VOLTAGE T-N',
    'MEASUREMENT VOLTAGE S-N',
    'MEASUREMENT VOLTAGE N-G',
    'MEASUREMENT CURRENT R',
    'MEASUREMENT CURRENT S',
    'MEASUREMENT CURRENT T',
    'MEASUREMENT SUCTION & DISCHARGE',
    'CLEANING UNIT'
  ],
  indoor: [
    'MEASUREMENT VOLTAGE R-S',
    'MEASUREMENT VOLTAGE R-T',
    'MEASUREMENT VOLTAGE S-T',
    'MEASUREMENT VOLTAGE R-N',
    'MEASUREMENT VOLTAGE T-N',
    'MEASUREMENT VOLTAGE S-N',
    'MEASUREMENT VOLTAGE N-G',
    'MEASUREMENT CURRENT R',
    'MEASUREMENT CURRENT S',
    'MEASUREMENT CURRENT T',
    'MEASUREMENT VIBRATION',
    'MEASUREMENT TEMPERATURE',
    'MEASUREMENT HUMIDITY',
    'MEASUREMENT AIR FLOW',
    'MEASUREMENT NOISE'
  ],
  'trafo@gmail.com': [
    'Nameplate / Unit ID Transformator',
    'Inspeksi Enclosure & Tank Trafo (Baut/Karet/Bushing)',
    'Inspeksi Winding HV/LV & Terminals',
    'Inspeksi Level Minyak & Temperature Gauge (Oil Type)',
    'Inspeksi Relai Proteksi (DGPT/Temperature Control)',
    'Cleaning Enclosure, Tank & Cooling Fan',
    'Pengukuran Arus Ampere R, S, T, N',
    'Pengukuran Tegangan Voltage Fasa-Fasa (RS, ST, TR)',
    'Pengukuran Tegangan Voltage Fasa-Netral (RN, SN, TN, NG)',
    'Pengukuran TTR (Turn Test Ratio) & Dielectric Winding',
    'Pengukuran Grounding Resistance (Ohm)',
    'Pengukuran Noise Sound Level (dB - SNI 04-0204-1989)',
    'Pengujian Thermal Imager (Kamera Termal Hotspot)',
    'Pengaturan Temp Sensor & Setting Modul (Fan On/Off, Alarm, Trip)',
    'Pengujian Proteksi & Dissolved Gas Analysis (DGA)'
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
    'Check Thermal Imager', 'Measurement Grounding', 'Measurement Voltage R - S',
    'Measurement Voltage S - T', 'Measurement Voltage T - R', 'Measurement Voltage R - N',
    'Measurement Voltage S - N', 'Measurement Voltage T - N', 'Measurement Voltage N - G',
    'Measurement Ampere R', 'Measurement Ampere S', 'Measurement Ampere T',
    'Measurement Ampere N', 'Measurement Voltage DPM', 'Measurement Voltage DPM',
    'Measurement Ampere DPM', 'Measurement Daya DPM'
  ];
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

