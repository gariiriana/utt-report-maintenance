// ============================================================================
// FILE: frontend/types/sopEopTypes.ts
// Deskripsi: Definisi Tipe Data & Template Standar untuk Dokumen SOP & EOP
//            PT Dwimitra Ekatama Mandiri / NeutraDC Cikarang
// ============================================================================

export interface SOPCIEquipmentItem {
  id?: string;
  no: number;
  classId: string;
  ciName: string;
  ciDescription: string;
  capacity: string;
  serialNumber: string;
  mfd: string;
  productName: string;
  model: string;
  room: string;
}

export interface SOPAffectedSystemItem {
  key: string;
  labelEn: string;
  labelId: string;
  checked: boolean;
}

export interface SOPReferencedDocItem {
  id?: string;
  name: string;
  number: string;
}

export interface SOPPrerequisiteItem {
  id?: string;
  requirementEn: string;
  requirementId: string;
  time: string;
  initial: string;
}

export interface SOPWorkStepItem {
  id?: string;
  no: number;
  actionEn: string;
  actionId: string;
  expectedOutcomeEn: string;
  expectedOutcomeId: string;
  time: string;
  initial: string;
}

export interface EOPWorkStepItem {
  id?: string;
  no: number;
  actionEn: string;
  actionId: string;
  expectedOutcomeEn: string;
  expectedOutcomeId: string;
  time: string;
  name: string;
}

export interface DocumentSigner {
  roleEn: string;
  roleId: string;
  name: string;
  signatureBase64?: string;
  date?: string;
}

export interface SOPDocumentData {
  id?: string;
  type: 'SOP';
  // Section 1 – Document Overview
  documentTitle: string;
  documentPurposeEn: string;
  documentPurposeId: string;
  workLocationEn: string;
  workLocationId: string;

  // Section 2 – Equipment Information
  equipmentList: SOPCIEquipmentItem[];

  // Section 3 – Schedule / Work Information
  executionDate: string;
  referenceTicketNumber: string;
  executedByName: string;
  executedByJobTitle: string;

  // Section 4 – Affected Equipment / Systems
  affectedSystems: SOPAffectedSystemItem[];
  affectedSystemsDetails: string;

  // Section 5 – Referenced Documents / Attachments
  referencedDocuments: SOPReferencedDocItem[];

  // Section 6 – Environmental, Health & Safety (EHS)
  ehsRequirements: {
    ppeEn: string;
    ppeId: string;
    jewelryEn: string;
    jewelryId: string;
    commsEn: string;
    commsId: string;
    lotoEn: string;
    lotoId: string;
  };

  // Section 7 – Prerequisites
  prerequisites: SOPPrerequisiteItem[];

  // Section 8 – Dry Run
  dryRun: {
    jobTitle: string;
    name: string;
    date: string;
    signatureBase64?: string;
  };

  // Section 9 – Maintenance Period
  maintenancePeriod: '6_months' | 'annual' | 'custom';
  customPeriodLabel?: string;

  // Section 10 – Work Instruction / Procedures
  conditionsPriorToExecutionEn: string;
  conditionsPriorToExecutionId: string;
  workSteps: SOPWorkStepItem[];

  // Section 11 – Back Out Procedures
  backOutProcedure: string;

  // Section 12 – Document Information
  author: string;
  dateOfCreation: string;
  dateRevision: string;
  revisionNumber: string;

  // Section 13 – Approval
  approvals: DocumentSigner[];

  // Section 14 – Additional Information
  additionalInformation: string;

  createdAt?: Date | any;
  updatedAt?: Date | any;
}

export interface EOPDocumentData {
  id?: string;
  type: 'EOP';
  // Section 1 – Document Overview
  documentTitle: string;
  documentPurposeEn: string;
  documentPurposeId: string;
  workLocationEn: string;
  workLocationId: string;

  // Section 2 – Referenced Document / Attachments
  referencedDocuments: SOPReferencedDocItem[];

  // Section 3 – Environmental, Health & Safety
  ehsRequirements: {
    ppeEn: string;
    ppeId: string;
    commsEn: string;
    commsId: string;
  };

  // Section 4 – Work Instruction / Procedure
  expectedConditionsEn: string;
  expectedConditionsId: string;
  workSteps: EOPWorkStepItem[];

  // Section 5 – Document Information
  author: string;
  dateOfCreation: string;
  nextDateRevision: string;
  revisionNumber: string;

  // Section 6 – Dry Run
  dryRun: {
    jobTitle: string;
    name: string;
    date: string;
    signatureBase64?: string;
  };

  // Section 7 – Approval
  approvals: DocumentSigner[];

  // Section 8 – Additional Information
  additionalInformation: string;

  createdAt?: Date | any;
  updatedAt?: Date | any;
}

// ============================================================================
// DEFAULT DATA DARI TEMPLATE TRAFINDO TRANSFORMER RESMI
// ============================================================================

export const DEFAULT_AFFECTED_SYSTEMS: SOPAffectedSystemItem[] = [
  { key: 'electrical_distribution', labelEn: 'Electrical Distribution', labelId: 'Distribusi Kelistrikan', checked: false },
  { key: 'critical_power', labelEn: 'Critical Power Distribution', labelId: 'Distribusi Daya Kritis', checked: false },
  { key: 'ups_system', labelEn: 'UPS System', labelId: 'Sistem UPS', checked: false },
  { key: 'standby_generator', labelEn: 'Standby Generator', labelId: 'Generator Cadangan', checked: true },
  { key: 'drups', labelEn: 'DRUPS', labelId: 'DRUPS / UPS Dinamis', checked: false },
  { key: 'air_ventilation', labelEn: 'Air Ventilation', labelId: 'Ventilasi Udara', checked: false },
  { key: 'main_cooling', labelEn: 'Main Cooling System', labelId: 'Sistem Pendingin Utama', checked: false },
  { key: 'critical_area_cooling', labelEn: 'Critical Area Cooling', labelId: 'Pendingin Area Kritis', checked: false },
  { key: 'common_area_cooling', labelEn: 'Common Area Cooling', labelId: 'Pendingin Area Bersama', checked: false },
  { key: 'fire_detection', labelEn: 'Fire Detection', labelId: 'Deteksi Kebakaran', checked: false },
  { key: 'fire_protection', labelEn: 'Fire Protection', labelId: 'Proteksi Kebakaran', checked: false },
  { key: 'disable_fire', labelEn: 'Disable Fire System', labelId: 'Nonaktifkan Sistem Kebakaran', checked: false },
  { key: 'security_system', labelEn: 'Security System', labelId: 'Sistem Keamanan', checked: false },
  { key: 'controls_monitoring', labelEn: 'Controls / Monitoring', labelId: 'Kontrol / Pemantauan', checked: false },
  { key: 'lockout_tagout', labelEn: 'Lockout / Tag Required', labelId: 'Wajib Lockout / Tagout', checked: false },
];

export const DEFAULT_PREREQUISITES: SOPPrerequisiteItem[] = [
  {
    requirementEn: '1. Check PTW is approved.',
    requirementId: '1. Periksa bahwa PTW telah disetujui.',
    time: '',
    initial: ''
  },
  {
    requirementEn: '2. Note down vendor arrival Date / Time :',
    requirementId: '2. Catat Tanggal / Waktu kedatangan vendor :',
    time: '',
    initial: ''
  },
  {
    requirementEn: '3. Check all tools and materials are available and in good condition.',
    requirementId: '3. Periksa semua peralatan dan material telah tersedia dan dalam kondisi baik.',
    time: '',
    initial: ''
  },
  {
    requirementEn: '4. Ensure necessary reference documents is attached to this SOP.',
    requirementId: '4. Pastikan dokumen referensi yang diperlukan telah dilampirkan pada SOP ini.',
    time: '',
    initial: ''
  },
  {
    requirementEn: '5. Ensure personnel involving in this work are trained and competent to perform this procedure.',
    requirementId: '5. Pastikan personel yang terlibat dalam pekerjaan ini telah terlatih dan kompeten untuk melaksanakan prosedur ini.',
    time: '',
    initial: ''
  },
];

export const DEFAULT_DEFAULT_APPROVERS: DocumentSigner[] = [
  { roleEn: 'Project Manager', roleId: 'Manajer Proyek', name: 'Dwi Tasmiyadi' },
  { roleEn: 'Chief Engineering', roleId: 'Kepala Engineering', name: 'Habib Mulyana' },
  { roleEn: 'Facility Manager', roleId: 'Manajer Fasilitas', name: 'Supriyatno' },
  { roleEn: 'Assistant Manager HDC', roleId: 'Asisten Manajer HDC', name: 'Budi Susanto' },
];

export const DEFAULT_SOP_DATA: SOPDocumentData = {
  type: 'SOP',
  documentTitle: 'SOP PEMELIHARAAN TRANSFORMATOR (TRAFO)',
  documentPurposeEn: 'Guide to carry Transformer Maintenance',
  documentPurposeId: 'Panduan pelaksanaan Pemeliharaan Transformator',
  workLocationEn: 'Neutra DC Cikarang',
  workLocationId: 'Neutra DC Cikarang',

  equipmentList: [
    {
      no: 1,
      classId: 'TR',
      ciName: 'TRAFO 1',
      ciDescription: '1F–TR–B',
      capacity: '2500 kVA',
      serialNumber: '21CR30029',
      mfd: '2021',
      productName: 'TRAFINDO',
      model: 'Dry Type Cast Resin (Tipe Kering)',
      room: 'Trafo Room 1'
    },
    {
      no: 2,
      classId: 'TR',
      ciName: 'TRAFO 2',
      ciDescription: '1,3&4F–CH–TR–A',
      capacity: '2500 kVA',
      serialNumber: '21CR30030',
      mfd: '2021',
      productName: 'TRAFINDO',
      model: 'Dry Type Cast Resin (Tipe Kering)',
      room: 'Trafo Room 3'
    },
    {
      no: 3,
      classId: 'TR',
      ciName: 'TRAFO 3',
      ciDescription: '1,3&4F–CH–TR–B',
      capacity: '2500 kVA',
      serialNumber: '21CR30031',
      mfd: '2021',
      productName: 'TRAFINDO',
      model: 'Dry Type Cast Resin (Tipe Kering)',
      room: 'Trafo Room 4'
    },
    {
      no: 4,
      classId: 'TR',
      ciName: 'TRAFO 4',
      ciDescription: '1F–TR–A',
      capacity: '2500 kVA',
      serialNumber: '21CR30028',
      mfd: '2021',
      productName: 'TRAFINDO',
      model: 'Dry Type Cast Resin (Tipe Kering)',
      room: 'Power Room A'
    },
    {
      no: 5,
      classId: 'TR',
      ciName: 'TRAFO 5',
      ciDescription: '1F–TR–C',
      capacity: '2500 kVA',
      serialNumber: '22CR30062',
      mfd: '2021',
      productName: 'TRAFINDO',
      model: 'Dry Type Cast Resin (Tipe Kering)',
      room: 'Trafo Room 4'
    }
  ],

  executionDate: '-',
  referenceTicketNumber: '-',
  executedByName: 'Tim M/E PT Dwimitra Ekatama Mandiri',
  executedByJobTitle: 'Mechanical & Electrical Engineer',

  affectedSystems: DEFAULT_AFFECTED_SYSTEMS,
  affectedSystemsDetails: '1. Standby Generator will be running if the source in the MV panel shut down.\n1. Generator Cadangan akan beroperasi jika sumber pada panel MV padam/dimatikan.',

  referencedDocuments: [
    { name: 'Manual Book Transformer Trafndo', number: 'DOC-TR-MNL-001' },
    { name: 'Single Line Diagram NeutraDC', number: 'DWG-SLD-NDC-002' },
  ],

  ehsRequirements: {
    ppeEn: '1. Wear Personal Protective Equipment (PPE) such as rubber gloves and footwear, protective eye wear, and protective helmet.',
    ppeId: '1. Gunakan Alat Pelindung Diri (APD) seperti sarung tangan karet dan sepatu keselamatan, kacamata pelindung, serta helm pelindung.',
    jewelryEn: '2. Remove rings and metal wrist watches, jewelry, or any metal objects kept in the clothes pocket.',
    jewelryId: '2. Lepaskan cincin dan jam tangan logam, perhiasan, atau benda logam apa pun yang disimpan di dalam saku pakaian.',
    commsEn: '3. Communication device such as handy-talkie (HT) is on hand.',
    commsId: '3. Perangkat komunikasi seperti handy-talkie (HT) siap digunakan.',
    lotoEn: '4. Lock-Out / Tag-Out devices and tools.',
    lotoId: '4. Peralatan dan perlengkapan Lock-Out / Tag-Out.'
  },

  prerequisites: DEFAULT_PREREQUISITES,

  dryRun: {
    jobTitle: 'Chief Engineering',
    name: 'Habib Mulyana',
    date: '07 Sep 2026'
  },

  maintenancePeriod: 'annual',

  conditionsPriorToExecutionEn: 'Conditions / Equipment status prior to SOP Execution:',
  conditionsPriorToExecutionId: 'Kondisi / Status peralatan sebelum Pelaksanaan SOP:',

  workSteps: [
    {
      no: 1,
      actionEn: '1. Check the physical condition of the transformer.',
      actionId: '1. Periksa kondisi fisik transformator.',
      expectedOutcomeEn: 'Transformer is in good condition with no physical damage.',
      expectedOutcomeId: 'Transformator dalam kondisi baik tanpa kerusakan fisik.',
      time: '',
      initial: ''
    },
    {
      no: 2,
      actionEn: '2. Check the transformer oil level and condition.',
      actionId: '2. Periksa level dan kondisi oli transformator.',
      expectedOutcomeEn: 'Oil level is normal and there is no leakage.',
      expectedOutcomeId: 'Level oli normal dan tidak terdapat kebocoran.',
      time: '',
      initial: ''
    },
    {
      no: 3,
      actionEn: '3. Check cables and connection terminals.',
      actionId: '3. Periksa kabel dan terminal sambungan.',
      expectedOutcomeEn: 'Cables and terminals are properly connected with no overheating.',
      expectedOutcomeId: 'Kabel dan terminal terhubung dengan baik tanpa panas berlebih (overheating).',
      time: '',
      initial: ''
    },
    {
      no: 4,
      actionEn: '4. Check transformer grounding.',
      actionId: '4. Periksa pentanahan (grounding) transformator.',
      expectedOutcomeEn: 'Grounding is properly installed and safe.',
      expectedOutcomeId: 'Pentanahan terpasang dengan baik dan aman.',
      time: '',
      initial: ''
    },
    {
      no: 5,
      actionEn: '5. Check voltage and current indicators.',
      actionId: '5. Periksa indikator tegangan dan arus.',
      expectedOutcomeEn: 'Voltage and current are within normal operating limits.',
      expectedOutcomeId: 'Tegangan dan arus berada dalam batas operasional normal.',
      time: '',
      initial: ''
    },
    {
      no: 6,
      actionEn: '6. Check transformer temperature.',
      actionId: '6. Periksa suhu transformator.',
      expectedOutcomeEn: 'Temperature is within the permitted operating limit.',
      expectedOutcomeId: 'Suhu berada dalam batas operasional yang diizinkan.',
      time: '',
      initial: ''
    },
    {
      no: 7,
      actionEn: '7. Check transformer noise and vibration.',
      actionId: '7. Periksa kebisingan dan getaran transformator.',
      expectedOutcomeEn: 'No abnormal noise or vibration is detected.',
      expectedOutcomeId: 'Tidak terdeteksi kebisingan atau getaran abnormal.',
      time: '',
      initial: ''
    },
    {
      no: 8,
      actionEn: '8. Check alarms and protection systems.',
      actionId: '8. Periksa alarm dan sistem proteksi.',
      expectedOutcomeEn: 'No alarm/fault is present and the protection system is ready.',
      expectedOutcomeId: 'Tidak ada alarm/gangguan dan sistem proteksi dalam keadaan siap.',
      time: '',
      initial: ''
    },
    {
      no: 9,
      actionEn: '9. Monitor the transformer during operation.',
      actionId: '9. Pantau transformator selama pengoperasian.',
      expectedOutcomeEn: 'Transformer operates stably and parameters remain normal.',
      expectedOutcomeId: 'Transformator beroperasi secara stabil dan parameter tetap normal.',
      time: '',
      initial: ''
    },
    {
      no: 10,
      actionEn: '10. Review Chiller log sheet.',
      actionId: '10. Tinjau lembar log (log sheet) Chiller.',
      expectedOutcomeEn: 'Inspection data is completely recorded and traceable.',
      expectedOutcomeId: 'Data inspeksi tercatat lengkap dan dapat ditelusuri.',
      time: '',
      initial: ''
    },
    {
      no: 11,
      actionEn: '11. If an abnormal condition occurs, isolate the transformer according to the procedure.',
      actionId: '11. Jika terjadi kondisi abnormal, lakukan isolasi transformator sesuai prosedur.',
      expectedOutcomeEn: 'Transformer is safely isolated and the abnormal condition can be handled.',
      expectedOutcomeId: 'Transformator terisolasi dengan aman dan kondisi abnormal dapat ditangani.',
      time: '',
      initial: ''
    },
    {
      no: 12,
      actionEn: '12. Perform shutdown according to the procedure.',
      actionId: '12. Lakukan pemadaman (shutdown) sesuai prosedur.',
      expectedOutcomeEn: 'Transformer shuts down safely without causing system disruption.',
      expectedOutcomeId: 'Transformator padam dengan aman tanpa menimbulkan gangguan pada sistem.',
      time: '',
      initial: ''
    }
  ],

  backOutProcedure: 'N/A (T/A) - Jika timbul anomali kritis, kembalikan konfigurasi feeder penyulang dan aktifkan generator cadangan.',

  author: 'Alif Darmawan',
  dateOfCreation: '07 Sep 2026',
  dateRevision: 'N/A',
  revisionNumber: '0',

  approvals: DEFAULT_DEFAULT_APPROVERS,

  additionalInformation: 'Seluruh pekerjaan pemeliharaan transformator wajib mengikuti prosedur keselamatan K3, menggunakan APD lengkap, dan berkoordinasi langsung dengan pihak Facilities Management NeutraDC Cikarang.'
};

export const DEFAULT_EOP_DATA: EOPDocumentData = {
  type: 'EOP',
  documentTitle: 'EOP GANGGUAN / PADAM TRANSFORMATOR (TRAFO)',
  documentPurposeEn: 'Guide for actions that need to be taken when all operating TRAFO trip or stop due to fault.',
  documentPurposeId: 'Panduan tindakan yang perlu diambil saat seluruh TRAFO yang beroperasi trip atau padam karena gangguan.',
  workLocationEn: 'Neutra DC Cikarang',
  workLocationId: 'Neutra DC Cikarang',

  referencedDocuments: [
    { name: 'SOP Pemeliharaan Trafo', number: 'SOP-DME-NDC-TR-001' },
    { name: 'Emergency Contact Matrix NeutraDC', number: 'DOC-EMG-001' },
    { name: 'Single Line Diagram NeutraDC', number: 'DWG-SLD-NDC-002' },
  ],

  ehsRequirements: {
    ppeEn: '1. Wear Personal Protective Equipment (PPE) such as rubber gloves and footwear, protective eye wear, and protective helmet.',
    ppeId: '1. Gunakan Alat Pelindung Diri (APD) seperti sarung tangan karet dan sepatu bot, kacamata pelindung, dan helm pelindung.',
    commsEn: '2. Communication device such as handy-talkie (HT) is on hand.',
    commsId: '2. Perangkat komunikasi seperti handy-talkie (HT) tersedia / siap digunakan.'
  },

  expectedConditionsEn: 'Expected Conditions / Equipment Status: 1. Main power trip or alarm active. 2. Standby systems ready.',
  expectedConditionsId: 'Kondisi yang Diharapkan / Status Peralatan: 1. Daya utama trip atau alarm aktif. 2. Sistem cadangan siap.',

  workSteps: [
    {
      no: 1,
      actionEn: '1. Identify any alarm or abnormal condition on the transformer.',
      actionId: '1. Identifikasi adanya alarm atau kondisi abnormal pada trafo.',
      expectedOutcomeEn: 'The abnormal condition is identified correctly.',
      expectedOutcomeId: 'Kondisi abnormal teridentifikasi dengan benar.',
      time: '',
      name: ''
    },
    {
      no: 2,
      actionEn: '2. Check transformer temperature, oil level, and protection alarms.',
      actionId: '2. Periksa suhu trafo, level oli, dan alarm proteksi.',
      expectedOutcomeEn: 'Transformer operating condition is confirmed.',
      expectedOutcomeId: 'Kondisi operasional trafo terkonfirmasi.',
      time: '',
      name: ''
    },
    {
      no: 3,
      actionEn: '3. Secure the transformer area and wear appropriate PPE.',
      actionId: '3. Amankan area trafo dan gunakan APD yang sesuai.',
      expectedOutcomeEn: 'Personnel are protected from electrical and thermal hazards.',
      expectedOutcomeId: 'Personel terlindungi dari bahaya listrik dan termal.',
      time: '',
      name: ''
    },
    {
      no: 4,
      actionEn: '4. Trip and isolate the transformer according to the procedure.',
      actionId: '4. Trip dan isolasi trafo sesuai dengan prosedur.',
      expectedOutcomeEn: 'The transformer is safely isolated from the power source.',
      expectedOutcomeId: 'Trafo terisolasi secara aman dari sumber listrik.',
      time: '',
      name: ''
    },
    {
      no: 5,
      actionEn: '5. Inspect the transformer, panel, cables, and cooling system.',
      actionId: '5. Inspeksi trafo, panel, kabel, dan sistem pendingin.',
      expectedOutcomeEn: 'The potential cause of the fault is identified.',
      expectedOutcomeId: 'Penyebab potensial gangguan teridentifikasi.',
      time: '',
      name: ''
    },
    {
      no: 6,
      actionEn: '6. In case of smoke or fire, activate the emergency response and fire protection system.',
      actionId: '6. Jika terjadi asap atau kebakaran, aktifkan tanggap darurat dan sistem proteksi kebakaran.',
      expectedOutcomeEn: 'Fire is controlled and further damage is minimized.',
      expectedOutcomeId: 'Kebakaran terkendali dan kerusakan lebih lanjut diminimalkan.',
      time: '',
      name: ''
    },
    {
      no: 7,
      actionEn: '7. Report the condition to the supervisor/control room.',
      actionId: '7. Laporkan kondisi tersebut ke pengawas / ruang kontrol.',
      expectedOutcomeEn: 'Relevant personnel are informed of the emergency.',
      expectedOutcomeId: 'Personel terkait mendapatkan informasi keadaan darurat.',
      time: '',
      name: ''
    },
    {
      no: 8,
      actionEn: '8. Record the alarm, event time, and actions taken.',
      actionId: '8. Catat alarm, waktu kejadian, dan tindakan yang diambil.',
      expectedOutcomeEn: 'The emergency event is properly documented.',
      expectedOutcomeId: 'Peristiwa darurat terdokumentasi dengan baik.',
      time: '',
      name: ''
    },
    {
      no: 9,
      actionEn: '9. Perform inspection and corrective action after the condition is safe.',
      actionId: '9. Lakukan inspeksi dan tindakan perbaikan setelah kondisi aman.',
      expectedOutcomeEn: 'The fault is corrected and the transformer is ready for operation.',
      expectedOutcomeId: 'Gangguan telah diperbaiki dan trafo siap beroperasi.',
      time: '',
      name: ''
    },
    {
      no: 10,
      actionEn: '10. Re-energize the transformer after receiving authorization.',
      actionId: '10. Beri tegangan kembali (re-energize) trafo setelah menerima otorisasi.',
      expectedOutcomeEn: 'The transformer returns to safe and normal operation.',
      expectedOutcomeId: 'Trafo kembali beroperasi normal dan aman.',
      time: '',
      name: ''
    }
  ],

  author: 'Alif Darmawan',
  dateOfCreation: '07 Sep 2026',
  nextDateRevision: 'N/A',
  revisionNumber: '0',

  dryRun: {
    jobTitle: 'Chief Engineering',
    name: 'Habib Mulyana',
    date: '07 Sep 2026'
  },

  approvals: DEFAULT_DEFAULT_APPROVERS,

  additionalInformation: 'Setiap tindakan tanggap darurat (EOP) wajib memprioritaskan keselamatan jiwa (Life Safety), integritas beban kritis data hall, dan didokumentasikan dalam logbook insiden NeutraDC Cikarang.'
};
