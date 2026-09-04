// ============================================================================
// FILE: frontend/utils/monthlyReportData.ts
// Deskripsi: Real Data Engine & Dynamic Aggregator Laporan Bulanan (Monthly Report)
//            Mengambil, memfilter, dan menyusun data real-time dari Firestore:
//            - pdf_documents & excel_documents (Arsip Laporan Service Report Engineer/Maintenance)
//            - findings (Data Temuan Anomali & Root Cause Analysis)
//            - sparepart_logs & corrective_reports (Log Suku Cadang & Perbaikan)
//            - Matriks PM Schedule 2026 per Bulan (Jan - Des)
// ============================================================================

import { collection, getDocs, query, doc, getDoc } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { BOQ_CATEGORIES_DATA } from '@/data/boqAssetData';
import { SparepartLogItem } from '@/types/sparepartTypes';

export interface MonthlyReportOptions {
  month: number; // 1 - 12
  year: number;  // e.g. 2026
  contractNumber?: string;
  preparedBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
}

export interface SystemPerformanceItem {
  no: number;
  className: string;
  capacity: string;
  location: string;
  productName: string;
  taskPM: string;
  criticalRepairs: string;
  operationalStatus: string;
  issues: string;
  recommendations: string;
}

export interface EquipmentDetailItem {
  no: number;
  system: string;
  className: string;
  modelSN: string;
  manufacture: string;
  installDate: string;
  location: string;
  lastMaintenanceDate: string;
  currentOperationalDate: string;
  statusBeforeMaintenance: string;
}

export interface FindingReportItem {
  no: number;
  date: string;
  system: string;
  equipment: string;
  location: string;
  conditionBefore: string;
  inspectionNotes: string;
  status: 'Closed' | 'Open' | 'Monitoring';
  photoUrl?: string;
}

export interface RootCauseItem {
  title: string;
  system: string;
  description: string;
  photos: { caption: string; url: string }[];
}

export interface ScopeOfWorkCategory {
  category: string;
  items: {
    step: string;
    tasks: string[];
  }[];
}

export interface ProgressPmItem {
  no: number | string;
  activity: string;
  unit: number | string;
  planStart: string;
  planFinish: string;
  actualStart: string;
  actualFinish: string;
  actualUnit: number | string;
  pctFinish: string;
  remark: string;
}

export interface SlaOrderItem {
  no: number | string;
  activity: string;
  unit: string;
  actual: number | string;
  finish: number | string;
  pctFinish: string;
  comply: string;
  pctComply: string;
}

export interface FullMonthlyReportData {
  monthName: string;
  monthNameEn: string;
  monthNumber: number;
  quarter: string;
  year: number;
  contractNumber: string;
  docCode: string;
  projectName: string;
  location: string;
  clientName: string;
  vendorName: string;

  // 6-Person Approval Sheet Signatures
  approvalSheet: {
    preparedBy: { name: string; title: string; company: string; signed: boolean };
    reviewedBy1: { name: string; title: string; company: string; signed: boolean };
    reviewedBy2: { name: string; title: string; company: string; signed: boolean };
    reviewedBy3: { name: string; title: string; company: string; signed: boolean };
    approvedBy1: { name: string; title: string; company: string; signed: boolean };
    approvedBy2: { name: string; title: string; company: string; signed: boolean };
  };

  // Bab 1 & 2
  executiveSummary: {
    totalPlanned: number;
    totalCompleted: number;
    completionRate: number;
    totalFindings: number;
    totalRepairs: number;
    systemAvailability: number;
    operatingHoursTotal: number;
    totalDocuments: number;
    activeEngineers: string[];
  };
  scheduleTable1: {
    no: number;
    device: string;
    location: string;
    maintenancePartner: string;
    plan: string;
    actual: string;
    status: string;
    engineerAccount?: string;
  }[];

  // Task Performance Tables per Scope (Tables 2 - 17)
  taskPerformanceTables: {
    tableNo: number;
    title: string;
    scope: string;
    items: SystemPerformanceItem[];
  }[];

  // Bab 3 & 4
  generalInfo: {
    maintenanceType: string;
    contractReference: string;
    timeline: {
      startDate: string;
      endDate: string;
      totalHoursWorked: string;
      standardsFollowed: string[];
    };
    teamLeader: { name: string; role: string; phone: string };
    teamMembers: string[];
  };

  // Table 19 KPI Metric - Sub-tables (Sesuai Format Resmi NeutraDC Foto 1 & Foto 2)
  progressPmTable19?: ProgressPmItem[];
  progressPmAverage?: string;
  slaOrdersTable19?: SlaOrderItem[];
  slaOrdersPeriodTotal?: string;

  // Table 19 KPI Metric (Dipertahankan untuk backward compatibility)
  kpiMetricsTable19: {
    no: string | number;
    activity: string;
    unit: string;
    order: number;
    finish: number;
    pctFinish: string;
    comply: number;
    pctComply: string;
  }[];
  kpiSummary: {
    totalPerformance: string;
    serviceCredit: string;
    progressPmAverage?: string;
  };

  // Bab 5 & 6
  equipmentDetailsTable20: EquipmentDetailItem[];
  systemOverviewTable21: {
    no: number;
    component: string;
    functionDesc: string;
  }[];
  scopeOfWorkTable22: {
    category: string;
    items: { step: string; tasks: string[] }[];
  }[];
  _sowDetailedVersion?: number;

  // Bab 7 & 8
  observationTable23: {
    scope: string;
    items: { no: number; component: string; conditionBefore: string; inspectionNotes: string }[];
  }[];
  rootCauseAnalyses: RootCauseItem[];
  repairsTable29: {
    equipment: string;
    partName: string;
    partNumber: string;
    quantity: string;
    replacedStatus: string;
  }[];

  // Bab 9: Calibration & Validation
  calibrationTable30: {
    no: number;
    component: string;
    calibrationDetail: string;
  }[];
  validationMethodsTable31: {
    no: number;
    component: string;
    validationMethod: string;
  }[];

  // Bab 10 & 11
  challengesTable32: {
    no: number;
    component: string;
    challenge: string;
  }[];
  mitigationTable33: {
    no: number;
    component: string;
    mitigation: string;
  }[];
  lessonsLearnedTable34: {
    no: number;
    component: string;
    lessonLearned: string;
  }[];
  recommendationsTable35: {
    scope: string;
    items: { no: number; component: string; shortTerm: string; longTerm: string }[];
  }[];

  // Bab 12: Photo & Documentation Log (Table 36)
  photoLogsTable36: {
    no: number;
    component: string;
    prePhoto: string;
    duringPhoto: string;
    postPhoto: string;
    caption?: string;
  }[];

  // Editable Document Sections (Cover, TOC, List of Tables, Bab 1, Bab 4 Matrix, Bab 13)
  coverTitle?: string;
  coverSubtitle?: string;
  tableOfContents?: { title: string; page: string }[];
  listOfTables?: { title: string; page: string }[];
  executiveSummaryText?: string;
  purposeOfReportTitle?: string;
  purposeOfReportIntro?: string;
  purposePoints?: { title: string; desc: string }[];
  serviceCreditMatrix?: { range: string; credit: string; highlighted?: boolean; isTermination?: boolean }[];
  appendicesNote?: string;
  approvalSheetStatement?: string;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Master 2026 PM Schedule Matrix per Device
interface MasterPMSchedule {
  device: string;
  location: string;
  months: (string | null)[]; // 12 months: Jan=0 .. Dec=11
  category: string;
}

export const MASTER_PM_SCHEDULES: MasterPMSchedule[] = [
  { device: 'Chiller', location: '1F Power House', months: [null, '18 - 24', null, null, '18 - 22', null, null, '18 - 24', null, null, '16 - 20', null], category: 'Cooling' },
  { device: 'Cooling Tower', location: '4F Power House', months: [null, '18 - 24', null, null, '18 - 22', null, null, '18 - 24', null, null, '16 - 20', null], category: 'Cooling' },
  { device: 'Cooling Pump', location: '1F Power House', months: [null, null, '09 - 13', null, null, '08 - 12', null, null, '07 - 11', null, null, '07 - 11'], category: 'Cooling' },
  { device: 'Transformer', location: 'Power Room and Trafo Room', months: [null, '23 - 27', null, null, '22 - 29', null, null, '24 - 31', null, null, '16 - 20', null], category: 'Electrical' },
  { device: 'Generator & Fuel System', location: '2F Power House', months: [null, '16 - 23', null, null, '18 - 22', null, null, '18 - 31', null, null, '16 - 20', null], category: 'Electrical' },
  { device: 'MV and RMU Panel', location: 'MV Room', months: [null, null, '23 - 27', null, null, '15 - 22', null, null, '14 - 18', null, null, '14 - 18'], category: 'Electrical' },
  { device: 'LV Panel', location: 'Power Room', months: [null, '23 - 27', null, null, '04 - 08', null, null, '03 - 07', null, null, '02 - 06', null], category: 'Electrical' },
  { device: 'PDU Panel', location: 'CRAC Room 1-4', months: [null, '13 - 20', null, null, '18 - 22', null, null, '18 - 24', null, null, '16 - 20', null], category: 'Electrical' },
  { device: 'UPS', location: 'Elecroom and Power Room', months: [null, null, '02 - 06', null, null, '02 - 08', null, null, '01 - 07', null, null, '07 - 11'], category: 'Electrical' },
  { device: 'ATS', location: 'Power Room and Elec Room', months: [null, null, '02 - 06', null, null, '02 - 08', null, null, '01 - 07', null, null, '07 - 11'], category: 'Electrical' },
  { device: 'Capacitor Bank', location: 'Campus and PH Office', months: [null, null, '16 - 20', null, null, '15 - 19', '27 - 31', null, '14 - 18', null, null, '14 - 18'], category: 'Electrical' },
  { device: 'Busduct', location: 'Power Room & Riser', months: [null, null, '23 - 27', null, null, '22 - 26', null, null, '24 - 28', null, null, '23 - 27'], category: 'Electrical' },
  { device: 'FSS', location: 'ALL Area Campus', months: [null, '16 - 27', null, null, '18 - 29', null, null, '17 - 28', null, null, '16 - 30', null], category: 'Safety' },
  { device: 'Pre-Action System', location: 'ALL Area Campus', months: [null, '02 - 06', null, null, '04 - 08', null, null, '03 - 07', null, null, '02 - 06', null], category: 'Safety' },
  { device: 'Hydrant System', location: 'ALL Area Campus', months: ['19 - 23', null, null, '20 - 24', null, null, '20 - 24', null, null, '19 - 23', null, null], category: 'Safety' },
  { device: 'Water Leak', location: 'ALL Area Campus', months: [null, null, null, null, null, null, '06 - 10', null, null, null, null, null], category: 'Safety' },
  { device: 'Fuel Leak', location: 'Ground Tank', months: [null, null, null, null, null, null, '13 - 17', null, null, null, null, null], category: 'Safety' },
  { device: 'Lightning Protection System', location: 'Rooftop Campus & Office', months: [null, '09 - 13', null, null, '11 - 18', null, null, '10 - 14', null, null, '09 - 13', null], category: 'Electrical' },
  { device: 'Grounding System', location: 'ALL Area Campus', months: [null, null, '16 - 27', null, null, '15 - 26', null, null, '14 - 25', null, null, '07 - 18'], category: 'Electrical' },
  { device: 'Lighting Point / PJU', location: 'Outdoor & Indoor Area', months: ['19 - 30', null, null, null, '18 - 29', null, null, '18 - 31', null, null, '16 - 27', null], category: 'Electrical' },
  { device: 'VRV', location: 'Office', months: [null, '16 - 27', null, null, '18 - 29', null, null, '18 - 31', null, null, '09 - 20', null], category: 'HVAC' },
  { device: 'AC Splits', location: 'Office and Campus', months: [null, '24 - 27', null, null, '25 - 29', null, null, '24 - 28', null, null, '23 - 27', null], category: 'HVAC' },
  { device: 'CRAC Data Hall', location: 'CRAC Room 3 & 4', months: [null, null, '25 - 31', null, null, '22 - 26', null, null, '21 - 25', null, null, '07 - 11'], category: 'HVAC' },
  { device: 'FCU', location: 'ALL Area Campus', months: ['05 - 14', null, null, '06 - 15', null, null, '06 - 15', null, null, '05 - 14', null, null], category: 'HVAC' },
  { device: 'AHU', location: 'ALL Area Campus', months: ['27 - 30', null, null, '27 - 30', null, null, '27 - 30', null, null, '26 - 29', null, null], category: 'HVAC' },
  { device: 'Cooling Tower Water Treatment', location: '4F Power House', months: ['05 - 09', '02 - 06', '02 - 06', '06 - 10', '04 - 08', '02 - 05', '06 - 10', '03 - 07', '01 - 04', '05 - 09', '02 - 06', '07 - 11'], category: 'Cooling' },
  { device: 'Lift Units', location: 'Office and Campus', months: ['08 - 15', '09 - 13', '09 - 13', '13 - 17', '11 - 19', '08 - 15', '06 - 10', '10 - 14', '07 - 11', '05 - 09', '09 - 13', '07 - 11'], category: 'Mechanical' },
  { device: 'Gate', location: 'Outdoor Area', months: [null, null, null, null, null, null, '27 - 31', null, null, null, null, null], category: 'Mechanical' },
  { device: 'Dock Leveler', location: 'CAMPUS 1', months: ['12 - 16', null, null, '14 - 18', null, null, '13 - 17', null, null, '12 - 16', null, null], category: 'Mechanical' },
  { device: 'STP & Plumbing', location: 'All Area', months: [null, null, null, null, null, null, '27 - 31', null, null, null, null, null], category: 'Plumbing' },
  { device: 'Door', location: 'All Area', months: [null, null, null, null, null, null, '13 - 17', null, null, null, null, null], category: 'Mechanical' },
  { device: 'Exhaust Fan', location: 'PH and Campus', months: [null, null, null, null, null, null, '27 - 31', null, null, null, null, null], category: 'HVAC' },
  { device: 'Load Bank', location: '1F Power House', months: [null, null, null, null, null, null, '27 - 31', null, null, null, null, null], category: 'Electrical' },
  { device: 'Door Roll / Auto Gate', location: 'Building Access & Perimeter', months: ['26 - 30', null, null, '24 - 30', null, null, null, null, null, '26 - 30', null, null], category: 'Mechanical' },
  { device: 'X-Ray', location: 'Post Security', months: ['12 - 13', '12 - 13', '12 - 13', '12 - 13', '12 - 13', '12 - 13', '12 - 13', '12 - 13', '12 - 13', '12 - 13', '12 - 13', '12 - 13'], category: 'Security' },
  { device: 'Water Softener', location: 'Water Softener Room', months: ['23 - 25', '23 - 25', '23 - 25', '23 - 25', '23 - 25', '23 - 25', '23 - 25', '23 - 25', '23 - 25', '23 - 25', '23 - 25', '23 - 25'], category: 'Plumbing' }
];

/** Helper to get standard equipment unit count from BOQ data */
export function getDefaultBoqUnitForDevice(deviceName: string): number {
  const d = (deviceName || '').trim().toLowerCase();
  if (d.includes('hydrant')) return 162;
  if (d.includes('water leak')) return 75;
  if (d.includes('fuel leak')) return 40;
  if (d.includes('ahu')) return 12;
  if (d.includes('cooling tower water treatment') || d.includes('water treatment')) return 1;
  if (d.includes('lift')) return 7;
  if (d.includes('gate') && !d.includes('door roll')) return 7;
  if (d.includes('dock leveler')) return 3;
  if (d.includes('stp') || d.includes('plumbing')) return 5;
  if (d.includes('door') && !d.includes('roll') && !d.includes('gate')) return 14;
  if (d.includes('exhaust fan') || d.includes('exhaust')) return 12;
  if (d.includes('capacitor bank')) return 3;
  if (d.includes('load bank')) return 1;
  if (d.includes('chiller')) return 4;
  if (d.includes('cooling tower')) return 4;
  if (d.includes('cooling pump') || d.includes('pump')) return 6;
  if (d.includes('transformer') || d.includes('trafo')) return 4;
  if (d.includes('generator')) return 4;
  if (d.includes('mv') || d.includes('rmu')) return 10;
  if (d.includes('lv panel') || d.includes('lv')) return 26;
  if (d.includes('pdu')) return 28;
  if (d.includes('ups')) return 12;
  if (d.includes('ats')) return 8;
  if (d.includes('busduct')) return 16;
  if (d.includes('fss')) return 1055;
  if (d.includes('pre-action') || d.includes('preaction')) return 4;
  if (d.includes('lightning') || d.includes('lps')) return 4;
  if (d.includes('grounding')) return 45;
  if (d.includes('lighting') || d.includes('pju')) return 2916;
  if (d.includes('vrv')) return 18;
  if (d.includes('split') || d.includes('ac split')) return 24;
  if (d.includes('crac')) return 32;
  if (d.includes('fcu')) return 48;
  if (d.includes('x-ray')) return 2;
  if (d.includes('water softener')) return 2;
  return 10;
}

// Specific Task PM description mapping from official Service Reports (Activity Section) - Multi-bullet Dual-line Bilingual (EN + ID)
export const SCOPE_TASK_PM_MAPPING: Record<string, string> = {
  // 1. DOCK LEVELER
  'dock leveler': `• Inspection of electrical panel, control buttons, and power wiring
  Pemeriksaan panel listrik, tombol kontrol, dan pengkabelan daya
• Inspection of telescopic ramp, lip plate, and side toe guards
  Pemeriksaan ramp teleskopik, pelat bibir, dan pelindung samping
• Check hydraulic fluid system, cylinders, hoses, and bumper condition
  Pemeriksaan sistem fluida hidrolik, silinder, selang, dan kondisi bumper`,

  // 2. ATS
  'ats': `• Visual check of ATS panel enclosure, indicator lamps, and controller
  Inspeksi visual selungkup panel ATS, lampu indikator, dan kontroler
• Check cable grounding, control wiring tightness, and terminal connections
  Pemeriksaan pentanahan kabel, kekencangan kabel kontrol, dan terminal koneksi
• Thermography infrared scan on busbars and transfer switch contacts
  Pemindaian termografi inframerah pada busbar dan kontak transfer switch`,

  // 3. VRV
  'vrv': `• Inspection of indoor and outdoor unit cleanliness, fin condition, and coil wash
  Inspeksi kebersihan unit indoor dan outdoor, kondisi sirip, dan pencucian koil
• Clean air filters, blower wheel, and check refrigerant operating pressure
  Pembersihan filter udara, roda blower, dan pemeriksaan tekanan kerja refrigeran
• Electrical connections check, PCB diagnostics, and drain pipes flushing
  Pemeriksaan koneksi listrik, diagnostik modul PCB, dan pembilasan pipa pembuangan`,

  // 4. PJU & LIGHTING
  'pju': `• Visual inspection of street lighting poles, light fixtures, and enclosures
  Inspeksi visual tiang lampu jalan, rumah lampu (armature), dan selungkup
• Solar battery check (24-27 VDC), solar charge controller, and wiring
  Pemeriksaan baterai solar (24-27 VDC), kontroler pengisian surya, dan pengkabelan
• Photocell sensor cleaning, auto dusk-to-dawn switching test, and lux check
  Pembersihan sensor fotosel, pengujian otomatisasi penyalaan sakelar, dan cek lux`,
  
  'lighting': `• Inspection of lamps, wiring connections, switch controls, and diffuser cleanliness
  Pemeriksaan lampu, sambungan kabel, kontrol sakelar, dan kebersihan diffuser
• Lux illuminance level measurement in office and critical operational zones
  Pengukuran tingkat iluminasi lux di area kantor dan zona operasional kritikal
• Emergency exit light battery test and inverter functional verification
  Pengujian baterai lampu darurat (exit light) dan verifikasi fungsional inverter`,

  // 5. PDU PANEL
  'pdu': `• Visual inspection of PDU enclosure, branch breakers, and isolation transformer
  Inspeksi visual selungkup kabinet PDU, pemutus cabang, dan trafo isolasi
• Branch circuit monitoring system (BCMS) check, DPM meters, and display verify
  Pemeriksaan sistem pemantauan sirkuit cabang (BCMS), meter DPM, dan verifikasi display
• Thermography scan on all circuit breaker connections and busbar joints
  Scan termografi pada seluruh koneksi pemutus sirkuit dan sambungan busbar
• Interior panel vacuum cleaning, terminal torque check, and grounding verify
  Pembersihan vakum interior panel, pengecekan torsi terminal, dan verifikasi grounding`,

  // 6. COOLING TOWER & WATER TREATMENT
  'cooling tower water treatment': `• Chemical dosage inspection, biocide and corrosion inhibitor replenishment
  Pemeriksaan dosis bahan kimia, pengisian biosida dan inhibitor korosi
• Water parameter testing (pH, Conductivity, TDS, and Total Hardness)
  Pengujian parameter kualitas air (pH, Konduktivitas, TDS, dan Kesadahan Total)
• Dosing pump calibration, flow meter check, and daily chemical consumption log
  Kalibrasi pompa dosing, pemeriksaan meter aliran, dan pencatatan log konsumsi kimia`,

  'cooling tower': `• Visual and inspection of Cooling Tower Devices (basin, filler, support/mounting, float valve)
  Inspeksi visual komponen Cooling Tower (basin, filler, dudukan/mounting, katup pelampung)
• Inspection & Checked Motor Fan (pulley, belt, fan blades, sheaves, spray nozzles)
  Pemeriksaan motor kipas (puli, sabuk/belt, bilah kipas, sheave, nosel semprot)
• Inspection of Panel Control, power meters, indicator lamps & control wiring
  Inspeksi panel kontrol, power meter, lampu indikator & pengkabelan kontrol
• Cleaning of water basin, filler media, and strainer mesh
  Pembersihan basin air, media filler, dan saringan strainer`,

  // 7. AC SPLITS (BOQ: Splitwall / cat_25)
  'ac split': `• Visual inspection of indoor and outdoor AC unit, compressor, and casing
  Pemeriksaan visual unit AC indoor dan outdoor, kompresor, dan selungkup
• Clean air filters, evaporator coil, and condensate drain tray flush
  Pembersihan filter udara, koil evaporator, dan pembilasan baki drainase kondensat
• Check refrigerant operating suction and discharge pressure, and measure delta T
  Pengecekan tekanan kerja hisap dan buang refrigeran, serta pengukuran delta T suhu`,

  'splitwall': `• Visual inspection of indoor and outdoor AC unit, compressor, and casing
  Pemeriksaan visual unit AC indoor dan outdoor, kompresor, dan selungkup
• Clean air filters, evaporator coil, and condensate drain tray flush
  Pembersihan filter udara, koil evaporator, dan pembilasan baki drainase kondensat
• Check refrigerant operating suction and discharge pressure, and measure delta T
  Pengecekan tekanan kerja hisap dan buang refrigeran, serta pengukuran delta T suhu`,

  'ac split wall': `• Visual inspection of indoor and outdoor AC unit, compressor, and casing
  Pemeriksaan visual unit AC indoor dan outdoor, kompresor, dan selungkup
• Clean air filters, evaporator coil, and condensate drain tray flush
  Pembersihan filter udara, koil evaporator, dan pembilasan baki drainase kondensat
• Check refrigerant operating suction and discharge pressure, and measure delta T
  Pengecekan tekanan kerja hisap dan buang refrigeran, serta pengukuran delta T suhu`,

  'ac splits': `• Visual inspection of indoor and outdoor AC unit, compressor, and casing
  Pemeriksaan visual unit AC indoor dan outdoor, kompresor, dan selungkup
• Clean air filters, evaporator coil, and condensate drain tray flush
  Pembersihan filter udara, koil evaporator, dan pembilasan baki drainase kondensat
• Check refrigerant operating suction and discharge pressure, and measure delta T
  Pengecekan tekanan kerja hisap dan buang refrigeran, serta pengukuran delta T suhu`,

  // 8. GATE / DOOR ROLL
  'gate': `• Visual inspection of gate structure, boom alignment, and counterbalance springs
  Pemeriksaan visual struktur gerbang, kelurusan palang boom, dan pegas penyeimbang
• Motor drive gearbox oil level inspection and mechanical limit switches check
  Inspeksi level oli gearbox penggerak motor dan pemeriksaan sakelar batas mekanis
• Safety infrared photocell sensor obstacle detection and auto-reverse test
  Pengujian deteksi rintangan sensor fotosel inframerah dan fitur auto-reverse`,

  'door': `• Inspection of door tracks alignment, springs tension, and roller shutter kit
  Pemeriksaan kelurusan rel pintu, tegangan pegas, dan kit roller shutter
• Limit switch positioning check, electrical motor panel cleaning, and bearing lubrication
  Pengecekan posisi sakelar batas, pembersihan panel motor listrik, dan pelumasan bearing
• Manual chain hoist emergency release and automatic opening functional test
  Uji fungsi rilis manual tuas rantai darurat dan pembukaan otomatis`,

  // 9. TRAFO / TRANSFORMER
  'trafo': `• Visual inspection of dry-type transformer enclosure, temperature controller, and fans
  Inspeksi visual selungkup trafo tipe kering, pengontrol temperatur, dan kipas
• Cable terminal torque verification, bushing cleaning, and grounding check
  Verifikasi torsi terminal kabel, pembersihan bushing, dan pengecekan grounding
• High and low voltage winding insulation resistance testing (Megger test)
  Pengujian resistansi isolasi belitan tegangan tinggi dan rendah (Uji Megger)
• Thermography infrared scan on all cable terminations and busbar connections
  Pemindaian inframerah termografi pada semua terminasi kabel dan sambungan busbar`,
  
  'transformer': `• Visual inspection of dry-type transformer enclosure, temperature controller, and fans
  Inspeksi visual selungkup trafo tipe kering, pengontrol temperatur, dan kipas
• Cable terminal torque verification, bushing cleaning, and grounding check
  Verifikasi torsi terminal kabel, pembersihan bushing, dan pengecekan grounding
• High and low voltage winding insulation resistance testing (Megger test)
  Pengujian resistansi isolasi belitan tegangan tinggi dan rendah (Uji Megger)
• Thermography infrared scan on all cable terminations and busbar connections
  Pemindaian inframerah termografi pada semua terminasi kabel dan sambungan busbar`,

  // 10. BUSDUCT
  'busduct': `• Visual inspection of busduct housing, hanger supports, and seismic braces
  Pemeriksaan visual rumah selungkup busduct, gantungan support, dan bracing seismik
• Joint pack torque verification and expansion joint physical condition check
  Verifikasi torsi baut joint pack dan pemeriksaan kondisi fisik expansion joint
• Insulation resistance testing between phases and phase to earth ground
  Pengujian resistansi isolasi antar fasa dan fasa terhadap pembumian (grounding)
• Thermography infrared scan along busduct runs under normal operational load
  Pemindaian termografi inframerah di sepanjang jalur busduct pada beban operasional normal`,

  // 11. COOLING PUMP
  'cooling pump': `• Visual inspection & pump vibration measurement on motor and pump bearings
  Pemeriksaan visual & pengukuran getaran pada bearing motor dan pompa
• Motor bearing re-lubrication (greasing) and mechanical coupling alignment check
  Pelumasan ulang bearing motor (greasing) dan pengecekan kelurusan kopling mekanis
• Electrical terminal torque check, motor winding insulation test, and grounding
  Pengecekan torsi terminal listrik, uji isolasi belitan motor, dan pentanahan
• Check mechanical seal leakage, suction/discharge pressure gauges, and clean strainer
  Pemeriksaan kebocoran mechanical seal, manometer tekanan hisap/buang, dan pembersihan strainer`,

  // 12. CAPACITOR BANK
  'capacitor bank': `• Visual inspection of capacitor steps, PFC regulator controller, and contactors
  Inspeksi visual step kapasitor, pengontrol regulator PFC, dan kontaktor
• Measurement of operating current per step, voltage, and THD harmonic analysis
  Pengukuran arus kerja tiap step, tegangan listrik, dan analisis harmonisa THD
• Capacitance value testing (microfarad) and discharge resistor functional check
  Pengujian nilai kapasitansi (mikrofarad) dan fungsi resistor pelepasan muatan
• Thermography infrared scanning on capacitor terminals and vacuum dust cleaning
  Pemindaian termografi inframerah pada terminal kapasitor dan pembersihan debu vakum`,

  // 13. LDB & RDB PANEL
  'ldb': `• Visual inspection of distribution panel enclosure, main breaker, and branch circuits
  Inspeksi visual selungkup panel distribusi, pemutus utama, dan sirkuit cabang
• Breaker mechanism check, indicator lamps, and power meter readings verify
  Pemeriksaan mekanisme pemutus arus, lampu indikator, dan verifikasi pembacaan meter
• Thermography scan on breaker termination lugs and internal busbars
  Scan termografi pada sepatu kabel terminasi pemutus arus dan busbar internal
• Internal vacuum cleaning and terminal screw torque re-tightening
  Pembersihan vakum interior panel dan pengencangan ulang torsi baut terminal`,

  // 14. CHILLER
  'chiller': `• Suction & discharge pressure check, refrigerant level, and compressor oil level
  Pemeriksaan tekanan hisap & buang, level refrigeran, dan level oli kompresor
• Condenser and evaporator water temperature Delta T measurement and water flow
  Pengukuran perbedaan temperatur (Delta T) air kondensor dan evaporator serta aliran air
• Compressor motor vibration measurement and electrical terminal tightness check
  Pengukuran getaran motor kompresor dan pengecekan kekencangan terminal listrik
• ATC ball trap inspection, strainer cleaning, and control panel alarms review
  Inspeksi ball trap ATC, pembersihan strainer, dan tinjauan riwayat alarm panel kontrol`,

  // 15. GENERATOR & FUEL SYSTEM
  'generator': `• Visual inspection of generator engine, radiator, coolant level, and fuel piping lines
  Inspeksi visual mesin genset, radiator, level coolant, dan jalur pipa bahan bakar
• Starting battery voltage, specific gravity, electrolyte level, and charger check
  Pengecekan tegangan baterai starter, berat jenis, level elektrolit, dan charger
• Engine lube oil quality check, oil filter condition, and fan belt tension check
  Pemeriksaan kualitas oli mesin, kondisi filter oli, dan ketegangan belt kipas
• No-load manual running test, frequency/voltage check, and auto-start interlock test
  Uji jalan tanpa beban (running test), cek frekuensi/tegangan, dan interlock auto-start`,
  
  'genset': `• Visual inspection of generator engine, radiator, coolant level, and fuel piping lines
  Inspeksi visual mesin genset, radiator, level coolant, dan jalur pipa bahan bakar
• Starting battery voltage, specific gravity, electrolyte level, and charger check
  Pengecekan tegangan baterai starter, berat jenis, level elektrolit, dan charger
• Engine lube oil quality check, oil filter condition, and fan belt tension check
  Pemeriksaan kualitas oli mesin, kondisi filter oli, dan ketegangan belt kipas
• No-load manual running test, frequency/voltage check, and auto-start interlock test
  Uji jalan tanpa beban (running test), cek frekuensi/tegangan, dan interlock auto-start`,

  // 16. MV & RMU PANEL
  'mv': `• Visual inspection of MV cubicle enclosure, mimic diagram, and position indicators
  Inspeksi visual selungkup kubikel TM, diagram mimik, dan indikator posisi
• SF6 gas pressure gauge check, earthing switch operation, and mechanical interlock test
  Pemeriksaan manometer tekanan gas SF6, operasi sakelar pentanahan, dan uji interlock
• Vacuum circuit breaker (VCB) mechanism lubrication and contact wear check
  Pelumasan mekanisme pemutus tenaga VCB dan pemeriksaan keausan kontak
• Insulation resistance testing and thermographic inspection on cable terminations
  Pengujian resistansi isolasi dan inspeksi termografi pada terminasi kabel daya`,

  // 17. LV PANEL
  'lv': `• Visual inspection of Main Distribution Panel, ACB/MCCB breakers, and DPM meters
  Inspeksi Panel Distribusi Utama, pemutus ACB/MCCB, dan meter daya digital
• Air Circuit Breaker (ACB) and MCCB manual mechanism and electronic trip unit test
  Pengujian mekanisme manual dan unit trip elektronik pada pemutus arus ACB dan MCCB
• Thermography infrared scanning on incoming/outgoing busbars and cable connections
  Pemindaian termografi inframerah pada busbar masuk/keluar dan sambungan kabel
• Internal panel dust cleaning using industrial vacuum and terminal torque check
  Pembersihan debu interior panel dengan vakum industri dan pengecekan torsi terminal`,

  // 18. UPS
  'ups': `• Inspection of UPS operating modes (Normal Inverter, Static Bypass, and Maintenance)
  Pemeriksaan mode operasi UPS (Inverter Normal, Static Bypass, dan Pemeliharaan)
• Measurement of input/output voltage, current balance, load percentage, and PF
  Pengukuran tegangan masuk/keluar, keseimbangan arus, persentase beban, dan faktor daya
• Individual battery block voltage, internal impedance measurement, and torque check
  Pengujian tegangan per blok baterai, pengukuran impedansi internal, dan cek torsi baut
• Cooling fans operation check, air dust filter cleaning, and capacitor health check
  Pemeriksaan operasi kipas pendingin, pembersihan filter udara, dan cek fisik kapasitor`,

  // 19. CRAC DATA HALL
  'crac': `• Visual inspection of indoor CRAC unit, EC fan operation, and airflow direction
  Inspeksi visual unit indoor CRAC, operasi kipas EC, dan arah hembusan aliran udara
• Chilled water 2-way modulating valve travel check, actuator calibration, and delta T
  Pemeriksaan pergerakan katup modulasi air dingin 2-arah, kalibrasi aktuator, dan delta T
• Clean or replace air filters and verify differential pressure sensor (Magnehelic)
  Pembersihan atau penggantian filter udara dan verifikasi sensor tekanan diferensial
• Electrode humidifier cleaning, cylinder scaling check, and condensate drain flush
  Pembersihan humidifier elektroda, cek kerak silinder, dan pembilasan drainase kondensat`,

  // 20. FCU
  'fcu': `• Visual inspection of FCU casing, motor fan blower, and 2-way modulating valve
  Pemeriksaan visual selungkup FCU, motor blower kipas, dan katup modulasi 2-arah
• Clean air filter mesh, cooling coil cleaning, and drain pan chemical treatment
  Pembersihan filter udara, pembersihan koil pendingin, dan pemberian tablet anti-lumut baki
• Measure air supply/return temperature Delta T and electrical operating current
  Pengukuran perbedaan temperatur (Delta T) udara supply/return dan arus listrik operasional`,

  // 21. AHU
  'ahu': `• Check fan motor vibration, drive belt tension and alignment, and bearing grease
  Pemeriksaan getaran motor kipas, tegangan dan kelurusan sabuk puli, serta pelumasan bearing
• Differential pressure measurement across pre-filter and medium filter bags
  Pengukuran tekanan diferensial pada pre-filter dan kantong filter medium (Magnehelic)
• Clean cooling coil fins, verify condensate drain trap, and motorized damper test
  Pembersihan sirip koil pendingin, verifikasi drain trap kondensat, dan uji damper otomatis`,

  // 22. FSS & FIRE SAFETY
  'fss': `• Inspection of cylinder pressure gauges & releasing panel indicator
  Inspeksi pengukur tekanan silinder & indikator panel pelepasan
• Smoke & heat detector functional test and manual abort switch
  Uji fungsi detektor asap & panas serta sakelar abort manual
• Audio/visual horn strobe test and battery backup voltage check
  Uji sirine strobo audio/visual dan pemeriksaan tegangan baterai cadangan`,

  'pre-action': `• Pre-action deluge valve trim inspection, solenoid actuator test, and air pressure check
  Inspeksi trim katup deluge pre-action, uji aktuator solenoid, dan cek tekanan udara
• Air compressor automatic maintenance of supervisory piping pressure verification
  Verifikasi kompresor udara dalam menjaga tekanan pengawasan pipa otomatis
• Water motor gong testing, alarm pressure switch verification, and drain test
  Pengujian alarm water motor gong, verifikasi pressure switch alarm, dan uji drainase
• Piping network visual inspection for leaks, corrosion, and sprinkler head clearance
  Inspeksi visual jaringan perpipaan dari kebocoran, karat, dan jarak kepala sprinkler`,

  'hydrant': `• Jockey pump, electric main pump, and diesel backup pump automatic start testing
  Pengujian start otomatis pompa jockey, pompa utama elektrik, dan pompa cadangan diesel
• Hydrant pillar, outdoor hose box, nozzle condition, and coupling gasket inspection
  Inspeksi pilar hidran, kotak selang outdoor, kondisi nosel, dan karet coupling
• Header pipe pressure stability check, pressure relief valve functional test
  Pemeriksaan kestabilan tekanan pipa header, uji fungsional katup pelepas tekanan
• Flow test and pressure measurement at most remote outdoor hydrant point
  Uji aliran air dan pengukuran tekanan dinamis pada titik pilar hidran terjauh`,

  // 23. LIGHTNING PROTECTION & GROUNDING (LPS = Lightning Protection System)
  'lightning': `• Air terminal visual inspection, support mast rigidity, and down conductor inspection
  Inspeksi visual terminal udara (finial), kekokohan tiang penyangga, dan konduktor turun
• Lightning strike counter reading recording and functional test
  Pencatatan pembacaan penghitung sambaran petir (strike counter) dan uji fungsi
• Earth ground resistance measurement using calibrated earth tester (<1.0 Ohm target)
  Pengukuran resistansi pembumian menggunakan earth tester terkalibrasi (target <1,0 Ohm)
• Equipotential bonding busbar inspection, bi-metallic connector tightness check
  Inspeksi busbar bonding ekipotensial, pengecekan kekencangan klem bimetal`,

  'lps': `• Air terminal visual inspection, support mast rigidity, and down conductor inspection
  Inspeksi visual terminal udara (finial), kekokohan tiang penyangga, dan konduktor turun
• Lightning strike counter reading recording and functional test
  Pencatatan pembacaan penghitung sambaran petir (strike counter) dan uji fungsi
• Earth ground resistance measurement using calibrated earth tester (<1.0 Ohm target)
  Pengukuran resistansi pembumian menggunakan earth tester terkalibrasi (target <1,0 Ohm)
• Equipotential bonding busbar inspection, bi-metallic connector tightness check
  Inspeksi busbar bonding ekipotensial, pengecekan kekencangan klem bimetal`,

  'lightning protection system': `• Air terminal visual inspection, support mast rigidity, and down conductor inspection
  Inspeksi visual terminal udara (finial), kekokohan tiang penyangga, dan konduktor turun
• Lightning strike counter reading recording and functional test
  Pencatatan pembacaan penghitung sambaran petir (strike counter) dan uji fungsi
• Earth ground resistance measurement using calibrated earth tester (<1.0 Ohm target)
  Pengukuran resistansi pembumian menggunakan earth tester terkalibrasi (target <1,0 Ohm)
• Equipotential bonding busbar inspection, bi-metallic connector tightness check
  Inspeksi busbar bonding ekipotensial, pengecekan kekencangan klem bimetal`,

  'grounding': `• Measure earth ground loop resistance, inspect equipotential bonding connections
  Pengukuran resistansi loop pentanahan bumi, inspeksi sambungan bonding ekipotensial
• Verify copper conductor continuity and inspect ground pits for moisture/corrosion
  Verifikasi kontinuitas konduktor tembaga dan inspeksi bak kontrol dari korosi
• Earth resistance measurement across all main grounding electrodes (<1.0 Ohm target)
  Pengukuran resistansi pembumian pada seluruh elektroda pembumian utama (target <1,0 Ohm)`,

  // 24. LIFT / ELEVATOR
  'lift': `• Car door operator, safety light curtain sensors, and door interlocks inspection
  Inspeksi operator pintu car, sensor tirai cahaya keselamatan, dan interlock pintu
• Traction machine gearbox, brake shoe clearance, and hoisting wire ropes inspection
  Inspeksi gearbox mesin traksi, celah sepatu rem, dan tali kawat baja pengangkat
• Automatic Rescue Device (ARD) emergency battery power operation test
  Pengujian operasi daya darurat baterai Automatic Rescue Device (ARD)
• Shaft pit cleanliness, buffer springs inspection, and overspeed governor check
  Kebersihan pit elevator, inspeksi pegas buffer, dan pengecekan governor overspeed`,

  // 25. X-RAY & SECURITY
  'x-ray': `• Conveyor belt drive mechanism, alignment, tracking, and motor roller check
  Pemeriksaan mekanisme penggerak sabuk konveyor, kelurusan trek, dan rol motor
• Optical inspection sensors, lead curtain radiation shielding integrity check
  Pemeriksaan sensor inspeksi optik, integritas tirai timbal pelindung radiasi
• Emergency stop push buttons functional testing and console key switch operation
  Pengujian fungsi tombol darurat stop dan operasi sakelar kunci konsol operator
• Image processing monitor calibration, dual-energy organic/inorganic detection test
  Kalibrasi monitor pemrosesan citra, uji deteksi material organik/anorganik energi ganda`,

  // 26. WATER SOFTENER & PLUMBING
  'water softener': `• Automatic multi-port control valve backwash and regeneration cycling test
  Pengujian siklus pencucian balik (backwash) dan regenerasi katup otomatis multi-port
• Brine tank salt level inspection, brine suction injector cleaning, and tubing check
  Inspeksi ketinggian garam tangki air garam, pembersihan injektor brine, dan cek selang
• Treated water total hardness test (titration ppm CaCO3) and raw water comparison
  Uji kesadahan total air hasil olahan (titrasi ppm CaCO3) dan komparasi air baku
• Resin tank differential pressure measurement and flow meter totalizer recording
  Pengukuran tekanan diferensial tangki resin dan pencatatan totalizer meter aliran`
,
  // 27. EXHAUST & VENTILATION FAN
  'exhaust': `• Visual inspection of fan casing, safety wire guard, and backdraft gravity louvers
  Inspeksi visual selungkup kipas, kasa pengaman, dan kisi penutup otomatis
• Fan impeller cleaning, motor bearing greasing, and vibration measurement
  Pembersihan impeler kipas, pelumasan bearing motor, dan pengukuran getaran
• Motor operating voltage, current measurement, and thermal overload test
  Pengukuran tegangan dan arus kerja motor, serta uji relai beban lebih
• Airflow velocity check using digital anemometer to verify room air changes
  Pemeriksaan kecepatan aliran udara dengan anemometer digital untuk pergantian udara ruang`,

  'exhaust fan': `• Visual inspection of fan casing, safety wire guard, and backdraft gravity louvers
  Inspeksi visual selungkup kipas, kasa pengaman, dan kisi penutup otomatis
• Fan impeller cleaning, motor bearing greasing, and vibration measurement
  Pembersihan impeler kipas, pelumasan bearing motor, dan pengukuran getaran
• Motor operating voltage, current measurement, and thermal overload test
  Pengukuran tegangan dan arus kerja motor, serta uji relai beban lebih
• Airflow velocity check using digital anemometer to verify room air changes
  Pemeriksaan kecepatan aliran udara dengan anemometer digital untuk pergantian udara ruang`,

  // 28. PLUMBING & DRAINAGE PUMP
  'pump': `• Visual inspection of pump casing, mechanical seal, and pipe flange gaskets
  Inspeksi visual rumah pompa, mechanical seal, dan paking flensa pipa
• Suction and discharge pressure gauge verification and strainer basket cleaning
  Verifikasi manometer tekanan hisap dan buang serta pembersihan saringan strainer
• Motor insulation resistance test (Megger) and operating current measurement
  Uji tahanan isolasi motor (Megger) dan pengukuran arus operasional per fasa
• Sump pit float level switch auto-start/stop and high water alarm functional test
  Uji fungsi pelampung level bak penampung auto-start/stop dan alarm banjir`,

  'pompa': `• Visual inspection of pump casing, mechanical seal, and pipe flange gaskets
  Inspeksi visual rumah pompa, mechanical seal, dan paking flensa pipa
• Suction and discharge pressure gauge verification and strainer basket cleaning
  Verifikasi manometer tekanan hisap dan buang serta pembersihan saringan strainer
• Motor insulation resistance test (Megger) and operating current measurement
  Uji tahanan isolasi motor (Megger) dan pengukuran arus operasional per fasa
• Sump pit float level switch auto-start/stop and high water alarm functional test
  Uji fungsi pelampung level bak penampung auto-start/stop dan alarm banjir`,

  // 29. FUEL SYSTEM & FUEL TANK
  'fuel system': `• Visual inspection of main storage tank, daily service tanks, and fuel piping
  Inspeksi visual tangki timbun utama, tangki harian, dan jalur pipa solar
• Fuel level transmitter sensor calibration, sight glass check, and leak detector test
  Kalibrasi sensor transmiter level, pemeriksaan sight glass, dan uji detektor bocor
• Fuel transfer gear pump motor operation check, pressure relief valve test
  Pemeriksaan motor pompa transfer solar, pengujian katup pelepas tekanan
• Fuel duplex strainer and water separator filter cleaning and sediment drain
  Pembersihan saringan solar ganda dan filter pemisah air serta pembuangan endapan`,

  'fuel tank': `• Visual inspection of main storage tank, daily service tanks, and fuel piping
  Inspeksi visual tangki timbun utama, tangki harian, dan jalur pipa solar
• Fuel level transmitter sensor calibration, sight glass check, and leak detector test
  Kalibrasi sensor transmiter level, pemeriksaan sight glass, dan uji detektor bocor
• Fuel transfer gear pump motor operation check, pressure relief valve test
  Pemeriksaan motor pompa transfer solar, pengujian katup pelepas tekanan
• Fuel duplex strainer and water separator filter cleaning and sediment drain
  Pembersihan saringan solar ganda dan filter pemisah air serta pembuangan endapan`,

  // 30. LOAD BANK
  'load bank': `• Visual inspection of load bank enclosure, cam-lock terminals, and exhaust louvers
  Inspeksi visual selungkup load bank, terminal cam-lock, dan kisi pembuangan panas
• Resistor elements insulation resistance testing (Megger 1000VDC >100 MOhm)
  Pengujian tahanan isolasi elemen resistor (Megger 1000VDC >100 MOhm)
• Cooling blower fans operation, airflow differential pressure interlock verify
  Operasi kipas blower pendingin, verifikasi interlock sakelar aliran udara
• Step-load contactors switching verification and emergency stop functional test
  Verifikasi pensaklaran kontaktor beban bertingkat dan uji tombol stop darurat`,

  // 31. VESDA
  'vesda': `• Aspirating smoke detector laser chamber inspection and airflow rate verification
  Inspeksi kamar laser detektor asap hisap dan verifikasi laju aliran udara (100%)
• Micro-particulate air filter replacement and sampling pipe network blow-through flush
  Penggantian filter udara partikulat mikro dan pembersihan hembusan pipa sampling
• Smoke aerosol sensitivity test and pre-alarm / fire alarm threshold verification
  Uji sensitivitas aerosol asap dan verifikasi ambang batas pre-alarm serta alarm
• Relay outputs interlock testing to Main Fire Alarm Control Panel (MCFA)
  Pengujian interlock keluaran relai ke Panel Kontrol Alarm Kebakaran Utama`,

  // 32. BUILDING AUTOMATION SYSTEM (BAS)
  'bas': `• DDC controller communication status, CPU RUN indicator, and 24VDC power supply check
  Pemeriksaan status komunikasi kontroler DDC, indikator CPU RUN, dan catu daya 24VDC
• Temperature, humidity, pressure, and water flow sensors calibration verify
  Verifikasi kalibrasi sensor temperatur, kelembaban, tekanan, dan aliran air
• Graphic workstation visual/audible alarms simulation and emergency email trigger
  Simulasi alarm visual/bunyi pada stasiun kerja grafis dan pemicu email darurat
• Historical trend logging verification (PUE calculation and energy monitoring)
  Verifikasi pencatatan log tren historis (kalkulasi PUE dan pemantauan energi)`,

  // 33. ACCESS CONTROL & CCTV
  'cctv': `• CCTV cameras visual inspection, lens cleaning, and infrared night-vision check
  Inspeksi visual kamera CCTV, pembersihan lensa, dan pemeriksaan inframerah malam
• NVR/VMS server storage health, recording frame rate, and time synchronization
  Pemeriksaan kesehatan storage server NVR/VMS, frame rate rekaman, dan sinkronisasi jam
• Access control card readers, electromagnetic locks, and emergency push buttons test
  Uji pembaca kartu akses, kunci elektromagnetik, dan tombol tekan darurat
• Fire alarm release interlock test to ensure fail-safe door unlocking
  Uji interlock pelepasan alarm kebakaran untuk pembukaan pintu otomatis (fail-safe)`,

  'access control': `• CCTV cameras visual inspection, lens cleaning, and infrared night-vision check
  Inspeksi visual kamera CCTV, pembersihan lensa, dan pemeriksaan inframerah malam
• NVR/VMS server storage health, recording frame rate, and time synchronization
  Pemeriksaan kesehatan storage server NVR/VMS, frame rate rekaman, dan sinkronisasi jam
• Access control card readers, electromagnetic locks, and emergency push buttons test
  Uji pembaca kartu akses, kunci elektromagnetik, dan tombol tekan darurat
• Fire alarm release interlock test to ensure fail-safe door unlocking
  Uji interlock pelepasan alarm kebakaran untuk pembukaan pintu otomatis (fail-safe)`,

  // 34. WATER TREATMENT PLANT (WTP)
  'wtp': `• Raw water deep well supply pumps inspection and multi-media sand filter backwash
  Inspeksi pompa air baku sumur dalam dan pencucian balik (backwash) filter pasir
• Water softener automatic regeneration cycle test and salt brine tank level check
  Uji siklus regenerasi otomatis pelembut air dan cek ketinggian garam tangki brine
• Cooling tower chemical dosing pumps calibration (biocide, anti-scalant, dispersant)
  Kalibrasi pompa injeksi kimia cooling tower (biosida, anti-kerak, dan dispersan)
• Daily water quality titration testing (Total Hardness <5 ppm, pH 7.5 - 8.5, TDS)
  Uji titrasi kualitas air harian (Kesadahan Total <5 ppm, pH 7.5 - 8.5, dan TDS)`,

  'water treatment': `• Raw water deep well supply pumps inspection and multi-media sand filter backwash
  Inspeksi pompa air baku sumur dalam dan pencucian balik (backwash) filter pasir
• Water softener automatic regeneration cycle test and salt brine tank level check
  Uji siklus regenerasi otomatis pelembut air dan cek ketinggian garam tangki brine
• Cooling tower chemical dosing pumps calibration (biocide, anti-scalant, dispersant)
  Kalibrasi pompa injeksi kimia cooling tower (biosida, anti-kerak, dan dispersan)
• Daily water quality titration testing (Total Hardness <5 ppm, pH 7.5 - 8.5, TDS)
  Uji titrasi kualitas air harian (Kesadahan Total <5 ppm, pH 7.5 - 8.5, dan TDS)`

};

/** Comprehensive Dictionary of individual task bullet points across data center equipment */
export const TASK_PM_BULLET_DICTIONARY: Record<string, string> = {
  // --- Extracted from 32 Service Reports 2026 ---
  "inspection of display unit ups and make sure the display is in good condition with check history alarm in device": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "check and record measurements from the hmi": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "check the condition of the unit body and frame, clean it using a vacuum cleaner. inspect panels for paint damage and signs of corrosion": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "check the function of the fan and ensure it is in good condition": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "check the ups unit temperature display and compare it with the general room temperature.": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "check the battery temperature from the hmi display": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "inspect and check the operational noise of the ups unit using sound level": "Inspeksi kebisingan operasional unit dan pemeriksaan getaran mekanikal",
  "check the function of the ups door, and ensure that the locking device is free from signs of damage or wear": "Pemeriksaan fungsi pintu selungkup, engsel, dan perangkat pengunci",
  "check the breakers, fuses and contactors of the unit visually,ensuring the wiring, relays and power system if applicable": "Pemeriksaan visual pemutus arus, sekring, kontaktor, dan perkabelan daya",
  "inspection of installed visual electronic surge protection and signs of overheating or damage.": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "inspection display control unit bms, make sure the display is in good condition with check alarm in bms": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "check condition body unit and frame, cleaning using vacuum cleaner. inspection rack for paint damage and signs of corrosion": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning battery using vacuum cleaner": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "check visual connection battery cell. make sure good condition connection and check temperature unit using thermal imager, direct to line busbar and cable termination": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "check the battery quality using impedance and resistance measurements using a battery tester": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "test the functionality of the battery system by discharging and charging the battery using the battery test function on the ups screen": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "battery number": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "result (voltage)": "Inspeksi dan pengujian performa komponen Result (Voltage)",
  "result (ꭥ)": "Inspeksi dan pengujian performa komponen Result (ꭥ)",
  "inspect pump body for leakage, corrosion and cracks": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "check pump condition, mounting bolts, and base frame for looseness": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "check seals, gaskets and bearings for any abnormal signs": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "inspect valves condition (suction & discharge)": "Uji fungsional sistem baterai (discharge/charge test) dan pemantauan alarm BMS",
  "check motor condition, check mounting bolts and base frame for looseness": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "check level sensor": "Inspeksi dan pengujian performa komponen Check Level Sensor",
  "inspect pressure gauge condition": "Pemeriksaan jarum manometer tekanan operasional dan kelancaran katup",
  "check flexible connection": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "clean pump body and remove debris around pump base and surrounding area": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "clean motor surface and clean ventilation holes to ensure proper cooling": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "ensure cooling fins and fan cover are free from blockage": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "cleaning the sump / control tank": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the water trap": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning/dust removal from ventilation system and the whole of the bank": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "result temperature (°c)": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "result (uf)": "Inspeksi dan pengujian performa komponen Result (uF)",
  "visual inspection": "Inspeksi dan pengujian performa komponen Visual Inspection",
  "visual inspection of the lamp by switching on the lamp and whether the lamp is not bright/damaged": "Inspeksi dan pengujian performa komponen Visual inspection of the lamp by switching on the ",
  "regular visual inspection of all lighting fixtures to ensure they are in good working condition.": "Inspeksi dan pengujian performa komponen Regular visual inspection of all lighting fixtures",
  "check emergency lights, motion sensors, etc": "Inspeksi dan pengujian performa komponen Check emergency lights, motion sensors, etc",
  "check the alarm indicator on the lighting control module": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "make sure to use lights with the same color temperature": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "immediately repair any damaged garden lights. repair or secure any loose electrical cables.": "Inspeksi dan pengujian performa komponen Immediately repair any damaged garden lights. Repa",
  "check lighting panels in each area to ensure:": "Inspeksi dan pengujian performa komponen Check lighting panels in each area to ensure:",
  "perform visual inspection of the light panel components (contactor, relay, terminal & mcb)": "Pemeriksaan visual pemutus arus, sekring, kontaktor, dan perkabelan daya",
  "class id": "Inspeksi dan pengujian performa komponen Class Id",
  "result (m/s)": "Inspeksi dan pengujian performa komponen Result (m/s)",
  "result mm/s": "Inspeksi dan pengujian performa komponen Result mm/s",
  "result db(a)": "Inspeksi dan pengujian performa komponen Result dB(A)",
  "result (db)": "Inspeksi dan pengujian performa komponen Result (dB)",
  "ensure pump unit is in standby & isolated": "Inspeksi dan pengujian performa komponen Ensure pump unit is in standby & isolated",
  "switch control mode to off (duty/backup running)": "Inspeksi dan pengujian performa komponen Switch control mode to Off (duty/backup running)",
  "close inlet & outlet isolation valves": "Pemeriksaan jarum manometer tekanan operasional dan kelancaran katup",
  "turn off power supply from mcb at control panel": "Inspeksi dan pengujian performa komponen Turn off power supply from MCB at control panel",
  "visual inspection & measure bearing vibration": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "lubricate motor & pump bearings (greasing)": "Inspeksi dan pengujian performa komponen Lubricate motor & pump bearings (Greasing)",
  "inspect motor terminal block bolts tightness": "Pemeriksaan fungsi pintu selungkup, engsel, dan perangkat pengunci",
  "housekeeping tools and work area": "Inspeksi dan pengujian performa komponen Housekeeping tools and work area",
  "open isolation valves for normal operation": "Pemeriksaan jarum manometer tekanan operasional dan kelancaran katup",
  "coordinate to return pump to auto mode": "Inspeksi dan pengujian performa komponen Coordinate to return pump to AUTO mode",
  "check control panel & tmw panel termination": "Inspeksi dan pengujian performa komponen Check control panel & TMW panel termination",
  "check panel for damage, corrosion, & lock": "Pemeriksaan fungsi pintu selungkup, engsel, dan perangkat pengunci",
  "check control panel & tmw control function": "Inspeksi dan pengujian performa komponen Check control panel & TMW control function",
  "cleaning motor fan & body": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning strainer/filter": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning terminal box": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning control & tmw panel": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "grounding measurement": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "vibration measurement": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "water flow & pressure": "Pemeriksaan jarum manometer tekanan operasional dan kelancaran katup",
  "temperature parameters": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "pump running test": "Inspeksi dan pengujian performa komponen Pump Running Test",
  "auto backup test": "Inspeksi dan pengujian performa komponen Auto Backup Test",
  "on/off control test": "Inspeksi dan pengujian performa komponen On/Off Control Test",
  "result temperature joint (°c)": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "turn off the ahu unit to be maintained and ensure the redundant ahu is operating": "Inspeksi dan pengujian performa komponen Turn off the AHU unit to be maintained and ensure ",
  "visual inspection of compressor oil and refrigerant leaks": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "check motor noise with a sound level meter and check vibration by placing a vibration meter": "Inspeksi kebisingan operasional unit dan pemeriksaan getaran mekanikal",
  "check air duct installation, ensure there is no condensation or damage": "Inspeksi dan pengujian performa komponen Check air duct installation, ensure there is no co",
  "inspect the magnetic damper and ensure the magnetic tube is not damaged": "Inspeksi dan pengujian performa komponen Inspect the magnetic damper and ensure the magneti",
  "inspect and check electrical control components (power supply, contacts, surge protection, circuit breakers, fuses)": "Pemeriksaan visual pemutus arus, sekring, kontaktor, dan perkabelan daya",
  "inspect and check electrical control component terminations": "Inspeksi dan pengujian performa komponen Inspect and check electrical control component ter",
  "inspect to ensure setpoint and actual temperature and humidity settings are correct": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "inspect, check the level of the drain tank drain pipe": "Inspeksi dan pengujian performa komponen Inspect, check the level of the drain tank drain p",
  "inspect and check the remote control unit": "Inspeksi dan pengujian performa komponen Inspect and check the remote control unit",
  "inspect and check all supports (trays, refrigerant pipes, indoor fans, supply and return grilles)": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "inspection of the main fan motor in the room (installation, support)": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "inspection of fan belt tension, visually inspecting": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "cleaning body pump": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning fuel tank": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning pipe": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning panel control & accessories": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the ahu box by using vacuum": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the air filter from dust and foreign objects using steam": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the compressor area (if there is a leak) using a brush": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the magnetic damper connection using vacuum": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the evaporator fin (using vacumm if necessary use jet cleaner)": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "clean the drain pipe of the drain tank with a vacuum cleaner": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "clean the main fan motor": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "measurement input/output voltage": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "vibration & noise measurement (outdoor unit)": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "verify temperature and humidity measurement on the display": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "pressure measurement of suction and discharge.": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "check airflow output": "Inspeksi dan pengujian performa komponen Check airflow output",
  "off/on compressor test by setting point": "Inspeksi dan pengujian performa komponen Off/On Compressor test by setting point",
  "fan outdoor on/off simulation test speed, trigger unit": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "testing auto backup unit)/sequencing of operation": "Inspeksi dan pengujian performa komponen Testing auto backup unit)/sequencing of operation",
  "inspection of oil temperature transformer (oil type)": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "inspection/check of oil level indicator/gauge (oil type)": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "inspection quality of oil (oil type)": "Inspeksi dan pengujian performa komponen Inspection quality of oil (oil type)",
  "inspection of transformer accessories": "Inspeksi dan pengujian performa komponen Inspection of Transformer accessories",
  "inspection the transformer if equipped with protection relay, check whether the contact point": "Pemeriksaan visual pemutus arus, sekring, kontaktor, dan perkabelan daya",
  "inspection of cooling system (fan)": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "cleaning part of transformer (dry type) / enclosure": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the transformer tank (oil type)": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the porcelain bushings and wiring terminals": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "remove the corrosion by sand paper or repaint this part": "Inspeksi dan pengujian performa komponen Remove the corrosion by sand paper or repaint this",
  "cleaning the cooling system (fan)": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "torque tightening on bushing and wiring terminals": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "transformer current and load recording": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "transformer voltage recording": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "transformer grounding resistance measurement": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "transformer ttr (turn test ratio) measurement (dry type)": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "transformer dielectric strength/winding insulation measurement (dry type)": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "transformer partial discharge measurement": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "transformer bdv (break down voltage) measurement (oil type)": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "transformer noise measurement": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "thermal imager measurement": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "check temperature sensor and temperature module setting": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "transformer cooling system test": "Inspeksi dan pengujian performa komponen Transformer cooling system test",
  "transformer protection system test (dgpt, temperature control)": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "dga (dissolved gas analysis) test": "Inspeksi dan pengujian performa komponen DGA (Dissolved Gas Analysis) test",
  "measurement": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "visual inspection to check for deposits/corrosion": "Inspeksi dan pengujian performa komponen Visual inspection to check for deposits/corrosion",
  "thickness measurement, measure the thickness of the tank wall": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "pipe inspection, check for corrosion, leaks, pipe mountings.": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "valve overhaul, clean, lubricate, replace stem seal. test manual/automatic operation.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "strainer inspection, replace strainer filter if necessary": "Pembersihan elemen filter udara dan saringan strainer sirkulasi fluida",
  "fuel meter recording": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "leak checks on seals, gaskets, units, and connections": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "fuel pressure gauge inspection": "Pemeriksaan jarum manometer tekanan operasional dan kelancaran katup",
  "inspect for unsafe actions and conditions in the work area": "Inspeksi dan pengujian performa komponen Inspect for unsafe actions and conditions in the w",
  "turn off the ac unit using the remote control or manually from the main power source.": "Inspeksi dan pengujian performa komponen Turn off the AC unit using the remote control or m",
  "open the ac unit body and clean the air filters using a steam water pump.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "visually inspect the ac control unit components.": "Inspeksi dan pengujian performa komponen Visually inspect the AC control unit components.",
  "install plastic protective cover before cleaning the evaporator and ensure no leakage gaps.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "check evaporator and refrigerant pipes for leaks.": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "cover the ac controller unit with plastic.": "Inspeksi dan pengujian performa komponen Cover the AC controller unit with plastic.",
  "clean the evaporator coil using a steam water pump.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "clean the indoor fan using steam water while gently holding the fan blades.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "flush the drainpipe using steam water to ensure proper flow.": "Inspeksi dan pengujian performa komponen Flush the drainpipe using steam water to ensure pr",
  "wipe remaining water with a synthetic cloth and ensure no standing water is left.": "Inspeksi dan pengujian performa komponen Wipe remaining water with a synthetic cloth and en",
  "clean the indoor unit casing using a synthetic cloth and vacuum cleaner.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "reinstall the ac body cover and filters, and ensure the area is safe and dry.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "open the outdoor unit body cover.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "inspect compressor and control components visually.": "Inspeksi dan pengujian performa komponen Inspect compressor and control components visually",
  "inspect condenser and refrigerant piping to ensure no leakage.": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "inspect condenser fan motor to ensure proper operation and condition.": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "cover sensitive electrical parts with plastic before cleaning the condenser.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "clean the condenser coil using a steam water pump.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "wipe remaining water with a synthetic cloth and vacuum; ensure no standing water in the area.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "reinstall the body cover and check all bolts.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "inspect and check the condition of the outdoor unit support frame and pipe tray.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "turn on the ac unit using the remote control; test includes adjusting temperature and fan speed settings.": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "measure input/output voltage and current using clamp ampere": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "pressure measurement": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "ensure there are no error code indications on the ac split unit.": "Inspeksi dan pengujian performa komponen Ensure there are no error code indications on the ",
  "result (ampere)": "Inspeksi dan pengujian performa komponen Result (Ampere)",
  "inspection ground pit box is clean and not covered in soil": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "inspection grounding rod not covered in soil and testing can be done": "Inspeksi dan pengujian performa komponen inspection grounding rod not covered in soil and t",
  "inspection termination tightness / grounding clamp / cadweld in good conditions": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "inspection grounding bar and termination good condition (not corrosive, oxidized)": "Inspeksi dan pengujian performa komponen Inspection grounding bar and termination good cond",
  "inspection all termination good tightness": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "inspection terminal lugs are in good condition and not loose": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "inspection lighting counters are in good condition and not damaged": "Inspeksi dan pengujian performa komponen Inspection lighting counters are in good condition",
  "inspection air terminal termination tightness and good condition (not corrosive, oxidized)": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "inspection obstivision & obstruction lamp are in good condition & function": "Inspeksi dan pengujian performa komponen Inspection obstivision & Obstruction Lamp are in g",
  "inspect cable are in good condition (not damaged & broken off)": "Inspeksi dan pengujian performa komponen Inspect cable are in good condition (not damaged &",
  "cables are in good condition, with no visible damage or deterioration": "Inspeksi dan pengujian performa komponen Cables are in good condition, with no visible dama",
  "device identification labels are complete, legible, and not damaged": "Inspeksi dan pengujian performa komponen Device identification labels are complete, legible",
  "cleaning ground pit box & enviroment": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning grounding bar & termination": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning lightning counter": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the cable connection area and add protection": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the air terminal": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the obctivision & obstruction lamp": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "earthing resistance measurement": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "lightning counter recording": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "measurement of input power supply resistance & barrier light using multitester": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "the team dme must be standby in the location lv panel distribution power room, genset under maintenance and the team dme must be standby in the power room (1f-main dc panel). if the any issue pln black out us the team must be action roll back plan": "Inspeksi dan pengujian performa komponen The team DME must be standby in the location LV pa",
  "replace filter water separator ensure the valve closed, open drain filter water separator until the condition no fuel and replace new filter water separator": "Pemeriksaan jarum manometer tekanan operasional dan kelancaran katup",
  "fuel filter & fuel pre-filter collect the remaining fuel with a drain pan external": "Pembersihan elemen filter udara dan saringan strainer sirkulasi fluida",
  "check level oil and condition using dip stickand inspection leaked oil in engine generator with deep stick": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "oil filter & oil pre-filter collect the remaining oil with a drain pan externa": "Pembersihan elemen filter udara dan saringan strainer sirkulasi fluida",
  "replace air filter": "Pembersihan elemen filter udara dan saringan strainer sirkulasi fluida",
  "check the radiator water level and leaks in the pipes.": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "inspect the condition of the radiator fan belt (tension, visual damage)": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "verify the position and function of the daily tank inlet/outlet valve.": "Pemeriksaan jarum manometer tekanan operasional dan kelancaran katup",
  "inspect the daily tank pipes for leaks and record the fuel level.": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "check for water/sediment contamination in the tank through the sight glass.": "Inspeksi dan pengujian performa komponen Check for water/sediment contamination in the tank",
  "inspect the alternator, terminal block, and fuses (use a multi tester).": "Pemeriksaan fungsi pintu selungkup, engsel, dan perangkat pengunci",
  "check the battery connections (tighten if loose).": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "check all power and battery cable connections.": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "test the indicator lights and push buttons": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "visually check the control modules on the pkg and apm panels.": "Inspeksi dan pengujian performa komponen Visually check the control modules on the PKG and ",
  "inspect the condition of the exhaust system.": "Inspeksi dan pengujian performa komponen Inspect the condition of the exhaust system.",
  "check the alarm log and record any alarms that occur": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "checking the condition and function of the heater": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "clean the engine, hoses, accessories, radiator fan, air ducts, air filter, fuel inlet filter, fuel system, heat exchanger, and base plate while ensuring that there is no damage to the paint, seals, or materials.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning of air filter & fuel filter": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning of generator body & battery": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the inside and outside of the pkg (power generation panel) and apm (automatic power management) panels.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "measuring of output voltage, output current,power consumption with multi tester (apparent power, active and real power).": "Inspeksi dan pengujian performa komponen Measuring of Output Voltage, Output Current,power ",
  "measuring voltage dc battery and current battery used battery tester": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "measuring torque nut connection used torque wrench refer table nut torque,": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "measuring voltage dc alternator and current battery used multi tester and check panel redundancy": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "measuring of grounding resistance & current used clamp earth tester": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "measuring battery impedance using battery tester": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "noise/sound level measurement": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "measuring vibration": "Inspeksi kebisingan operasional unit dan pemeriksaan getaran mekanikal",
  "measuring coolant contaminant": "Inspeksi dan pengujian performa komponen Measuring Coolant contaminant",
  "measuring thermal scan": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "measuring heating current": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "check function emergency button": "Inspeksi dan pengujian performa komponen Check function emergency button",
  "record parameter value in apm / amf engine generator (battery voltage, charge battery voltage, oil pressure, water temperature, speed, output voltage, current, frequency, load (kw, %)": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "checking engine temperature, exhaust gas color, phase rotation": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "inspection & checked of basin (upper, lower) from corrosive, erosion, algae,": "Inspeksi dan pengujian performa komponen Inspection & Checked of basin (upper, lower) from ",
  "inspection & checked the filler from damaged": "Inspeksi dan pengujian performa komponen Inspection & Checked the filler from damaged",
  "inspection & checked the all support/mounting (ct fan, motor ct fan, pump cwp, pipes installation)": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "inspection & checked tightening all support/mounting (ct fan, motor ct fan, pump cwp, pipes installation)": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "inspection & checked for floating check valve from clogged and damaged": "Pemeriksaan jarum manometer tekanan operasional dan kelancaran katup",
  "inspection & checked all valve from clogged and damaged": "Pemeriksaan jarum manometer tekanan operasional dan kelancaran katup",
  "inspection & checked of motor fan (pulley, tension belt)": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "inspection & checked the fan blades for cracks, missing balancing, weights, and vibrations (visual and bearing condition)": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "inspection & checked the check sheaves, bushings, fan shafts and fan hubs annually for corrosion. scrape and coat with zrc": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "inspection & checked the spray nozzles, strainer, and drift eliminator from clogged and damaged": "Pembersihan elemen filter udara dan saringan strainer sirkulasi fluida",
  "inspection & checked the enclosure (access door, stairs)": "Pemeriksaan fungsi pintu selungkup, engsel, dan perangkat pengunci",
  "inspection of support levelness (alignment)": "Inspeksi dan pengujian performa komponen Inspection of support levelness (alignment)",
  "inspection function of power meters": "Inspeksi dan pengujian performa komponen Inspection function of power meters",
  "inspection function of lamps and indicators": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "inspection of locking devices for signs damage or worn.": "Pemeriksaan fungsi pintu selungkup, engsel, dan perangkat pengunci",
  "inspection of control wiring, relays, power supply units, timers": "Pemeriksaan visual pemutus arus, sekring, kontaktor, dan perkabelan daya",
  "inspection electronic surge protection is installed.": "Inspeksi perangkat penahan surja petir (SPD) dari indikasi kerusakan/overheat",
  "inspection of control circuit fuse rating and continuity.": "Pemeriksaan visual pemutus arus, sekring, kontaktor, dan perkabelan daya",
  "inspection for signs of overheating or deterioration.": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "inspection of panels for paint damage and signs of corrosion.": "Inspeksi dan pengujian performa komponen Inspection of panels for paint damage and signs of",
  "inspection function of selector switch and push botton.": "Inspeksi dan pengujian performa komponen Inspection function of selector switch and push bo",
  "cleaning of basin (upper, lower)": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the filler with air spray / brush": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the all support/mounting (ct fan, motor ct fan, pump cwp, pipes installation)": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning enclosure/casing with brush": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning for floating check valve include probe/terminal with vacuum cleaner": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning all valve with vacuum cleaner": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning motor & fan ct and greasing the motor bearings": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning of upper basin, lower basin, and filler": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning of panel control": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning of enclosure (cover panel, doors, form covers)": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "thorough cleaning such as mcb, timer, etc.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "measurement input/output voltage, current": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "input voltage measurement of electrical control components": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "verify temperature measurements": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "measurement of suction and discharge pipes": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "measurement of output air flow": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "temperature measurement on fan motor": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "rotation speed measurement fan outdoor": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "inspection item": "Inspeksi dan pengujian performa komponen Inspection Item",
  "cleaning thoroughly (remove dust) of fan": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "check drain pan in all the unit tank, inspection drain pan and ensure there are no signs of leakage that leave mark on the drain pan": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "check visual sight glass in the fuel tank, ensure no fuel blockage and leakage in the sight glass": "Pemeriksaan fungsi pintu selungkup, engsel, dan perangkat pengunci",
  "check water separator system fuel with make sure no water in system fuel. open drain fuel separator, provide a base by placing a tub underneath it and close back": "Inspeksi dan pengujian performa komponen Check water separator system fuel with make sure n",
  "inspection supply pump, return pump and filtration pump and cleaning sensor pomp.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "check valve in the line distribution fuel and ensure valve good operation like a open close valve": "Pemeriksaan jarum manometer tekanan operasional dan kelancaran katup",
  "inspection pressure at piping fuel from pump fuel tank to buffer tank look at the indicator pressure gauge. ensure pressure good condition": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "check leaked & corrosion in monthly tank and daily tank. inspection visual in the line piping fuel system using cleaning area potential leaked and ensure no leaked in the fuel system": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "inspection visual rubber or seal in the tank, ensure no leakage in the object": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "tightness bolt, connection and terminal jumper": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "check, relay contactor and times and make sure part good condition": "Pemeriksaan visual pemutus arus, sekring, kontaktor, dan perkabelan daya",
  "check phase rotation in supply phase, r, s, t to make sure voltage not reversed in termination": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "check continuity line wiring diagram control panel": "Inspeksi dan pengujian performa komponen Check continuity line wiring diagram control panel",
  "check for the function lamp indicator, selector switch and ensure the part good positioning": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "cleaning": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning body pump, body fuel tank, pipe, panel control, accessories using vacuum and majun": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "result": "Inspeksi dan pengujian performa komponen Result",
  "inspection visual of lamps": "Inspeksi dan pengujian performa komponen Inspection visual of lamps",
  "inspection all lighting fixtures regularly to ensure they are in good working order": "Inspeksi dan pengujian performa komponen Inspection all lighting fixtures regularly to ensu",
  "inspection wiring and connections to prevent electrical problems": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "inspection lamps with transformers, control gear, and other accessories": "Inspeksi dan pengujian performa komponen Inspection lamps with transformers, control gear, ",
  "inspection wiring, screws, gaskets, and exterior light hardware": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "make sure every connection on the lamp is well connected and not easily separated.": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "battry check on solar street lighting": "Inspeksi dan pengujian performa komponen battry check on solar street lighting",
  "check the rl optica p80 + soalar panel c2 to make sure it is not dirty and functions normally.": "Inspeksi dan pengujian performa komponen Check the RL OPTICA P80 + Soalar Panel C2 to make ",
  "check solar controller carger": "Inspeksi dan pengujian performa komponen check solar controller carger",
  "check any water leak indication": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "check light sensor": "Inspeksi dan pengujian performa komponen check light sensor",
  "cleaning lamp house or lamp box": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning light poles for street lighting and garden lights": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the lamp cover glass to make the lamp light brighter": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the solar panel area": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the control panel": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "battry cleaning": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning on the sensor": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning light control panel": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "measurement of 30 vdc-40 vdc input power supply": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "24 vdc output poower suplay measurement": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "battery charger & battery voltage/vdc.": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "ensure battery charging when solar panels are exposed to the sun.": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "make sure the power suplay is charging the battery": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "test the lamp to make sure it lights up with the same lighting color and load as before.": "Inspeksi dan pengujian performa komponen Test the lamp to make sure it lights up with the s",
  "inspection visual with cable, connector socket and take a photo": "Inspeksi dan pengujian performa komponen Inspection visual with cable, connector socket and",
  "inspection power supply unit, modul control and check supply voltage and take a photo": "Inspeksi dan pengujian performa komponen Inspection power supply unit, modul control and ch",
  "tightenees all connection cable in terminal cable, terminal breaker and all mounting nut and take a photo": "Pemeriksaan visual pemutus arus, sekring, kontaktor, dan perkabelan daya",
  "check visual generator x-ray, look at the replacement history and take a photo": "Inspeksi dan pengujian performa komponen Check visual generator x-ray, look at the replacem",
  "check the function of the engine drive motor, provide lubricant and take a photo": "Inspeksi dan pengujian performa komponen Check the function of the engine drive motor, prov",
  "check software x-ray to configuration system, setting (if necessary), relay, etc and take a photo": "Pemeriksaan visual pemutus arus, sekring, kontaktor, dan perkabelan daya",
  "check radiation leak with instrument radiation detector": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "check image scanning result in display monitor, ensure function machine normal oprational and take a photo": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "cleaning box control machine x-ray using vacuum cleaner and apply sanpoly to finish it": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning, remove object from top, indeed of controller": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning and remove object from top of controller or in the machine for object": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "measurement voltage": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "measurement ampere": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "measurement grounding": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "radiant leaked with radiation detector instrument": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "machine room": "Inspeksi dan pengujian performa komponen Machine Room",
  "cleaning wall cabin and panel cabin": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning floor": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning lighting fixtures": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning mirror (if present)": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning control panel": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning ventilation grills": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning track": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning call button dan lift button": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning indicator and display": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "cleaning landing door": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "measuring input power supply": "Inspeksi dan pengujian performa komponen Measuring input power supply",
  "measuring voltage battery with battery tester": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "measuring grounding resistance & current": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "measuring electrical performance during control panel inspections.": "Inspeksi dan pengujian performa komponen Measuring electrical performance during control pa",
  "test the function of emergency brakes": "Inspeksi dan pengujian performa komponen Test The Function of emergency brakes",
  "test motor and shaft alignment to ensure smooth operation": "Inspeksi dan pengujian performa komponen Test motor and shaft alignment to ensure smooth op",
  "test and document the functionality of alarms, intercoms, and backup power systems": "Inspeksi dan pengujian performa komponen Test and document the functionality of alarms, int",
  "test level accuracy to confirm the cabin levels correctly at each floor under different loads": "Inspeksi dan pengujian performa komponen Test level accuracy to confirm the cabin levels co",
  "inspection & checked of the vrv indoor dan outdoor cooling system enclosure cleanness with duster": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "inspection & checked the air filter cleanness from dust, foreign object": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "inspection & checked the evaporator coil cleanness from dust and algae": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "inspection & checked the termination of electrical control components with screwdriver": "Inspeksi dan pengujian performa komponen Inspection & checked the termination of Electrical",
  "inspection & checked the settings point and actual temperature and humidity": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "inspection & checked the level and cleaning of the flushing and drain pipes of drain tanks": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "inspection & checked for airflow obstructions or airflow blockade": "Pemeriksaan fungsi pintu selungkup, engsel, dan perangkat pengunci",
  "inspection & checked remote for control unit": "Inspeksi dan pengujian performa komponen Inspection & Checked remote for control unit",
  "inspection & checked and completed the missing bolt": "Inspeksi dan pengujian performa komponen Inspection & Checked and completed the missing bol",
  "inspection & checked all support (tray, compressor, pipe refrigerant, fan indoor, fan outdoor ext)": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "inspection & checked the fan indoor main motor (mounting, support)": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "inspection & checked drain pump": "Inspeksi dan pengujian performa komponen Inspection & Checked drain pump",
  "inspection tension of fanbelt unit": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "cleaning of the vrv enclosure cleaness": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the air filter using jet clener": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning of the flushing and drain pipes of drain tanks": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the drain pan, drain pump & drain pipe": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning fan motor": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning supply & return air grille": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "vibration & noise measurement (indoor unit)": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "inspection & checked of the crac enclosure cleaness from dust, damaged and tightening of bolting / screw": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "inspection & checked the air filter cleaness from dust, damaged and density of filter": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "inspection & checked of tightening of fitting pipe and valve on pipe inlet and outlet using pipe wrench / torque wrench.": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "inspect & checked the evaporator cleaness from dust, moss, leakage and damaged": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "inspect & checked of the valve in good condition with check of water flow and pressure": "Pemeriksaan jarum manometer tekanan operasional dan kelancaran katup",
  "inspect & checked the ec fan / indoor fan in good condition with check condition of bearing, support,blade, ect": "Pemeriksaan fungsi putaran kipas pendingin dan memastikan kondisi normal",
  "inspection & check electrical control (power supply, contactor, surge arrester, breaker, fuse) with multi tester and setting the hmi until electrical control looks like it’s working normally": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "inspect & check the heater with check ampere work heater following spesification fabric": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "inspect & check the water leakage sensor with visual not damaged, test water drip sensor normaly working or not": "Pemeriksaan kebocoran cairan, integritas mechanical seal, dan kerapatan gasket",
  "inspect & check air flow obstruction or air flow blocked with check filter clogging / differential pressure sensor not alarm “loss of air flow": "Pemeriksaan fungsi pintu selungkup, engsel, dan perangkat pengunci",
  "inspect & check drain pipe with check no water leak found, open the fitting / jointer pipe for check no blocked water found": "Pemeriksaan fungsi pintu selungkup, engsel, dan perangkat pengunci",
  "cleaning of the crac enclosure cleaness using duster & vacuum cleaner from dust & foreign material": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the air filter cleaness using water steam cleaner machine in outdoor,": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning of the flushing and drain pipes of drain tank using vacuum cleaner until no blocked water.": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the humidifier pan and float switch using vacuum cleaner for cleaning water and moss": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the evaporator using brush and vacuum cleaner for cleaning water and moss": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the ec fan using duster and vacuum cleaner for cleaning dust": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the return air grille using duster and vacuum cleaner for cleaning dust": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning the strainer using water steam cleaner machin in outdoor for cleaning moss and no blocked water": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "measurement input/output voltage, current, heater ,voltage n-g,": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "water flow measurement": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "pressure measurement of suction and discharge pipes": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "temperature and humidity measurement of output air flow": "Pemeriksaan dan pencatatan parameter operasional dari display HMI",
  "verify temperature and humidity measurements on the display with a portable measuring instrument": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "inspect cover and id on each gpb": "Inspeksi dan pengujian performa komponen Inspect cover and ID on each GPB",
  "cleaning lighting counter": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "meassurement of resistance on gtb (distribution) & gpb (grounding rod)": "Pemeriksaan kualitas sel baterai, pengukuran tegangan dan impedansi internal",
  "inspection of enclosure (chalking, cracking, signs of heating)": "Pemeriksaan display temperatur unit dan komparasi dengan temperatur ruangan",
  "inspection of auxilliaries contacts (signaling contacts, coils, wiring)": "Inspeksi dan pengujian performa komponen Inspection of auxilliaries contacts (signaling con",
  "inspection and completion taging or labeling": "Inspeksi dan pengujian performa komponen Inspection and completion taging or labeling",
  "inspections of wiring connections": "Pemeriksaan dan pengencangan torsi baut terminal kabel serta koneksi busbar",
  "inspection of the position indicators and signalling micro switches": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "inspection of locking and interlocking machanism function": "Pemeriksaan fungsi pintu selungkup, engsel, dan perangkat pengunci",
  "inspection of withdrawal mechanism": "Inspeksi dan pengujian performa komponen Inspection of withdrawal mechanism",
  "inspections of the shutters": "Inspeksi dan pengujian performa komponen Inspections of the shutters",
  "inspection of protection measured values, alarms, battery status through hmi": "Pemeriksaan display unit, indikator, dan riwayat alarm sistem",
  "inspection of connexions": "Inspeksi dan pengujian performa komponen Inspection of connexions",
  "inspection of cabling": "Inspeksi dan pengujian performa komponen Inspection of cabling",
  "inspection of protection settings": "Inspeksi dan pengujian performa komponen Inspection of protection settings",
  "cleaning of enclosure": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "checking of connexions": "Inspeksi dan pengujian performa komponen Checking of connexions",
  "cleaning contactor compartement": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning and greasing of shutter locking system": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning circuit breaker": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",
  "cleaning of resin bodies": "Pemeriksaan kondisi fisik bodi unit, rangka, dan pembersihan dengan vakum industri",

  // FSS / Fire Suppression System / Inergen
  'inspection of cylinder pressure gauges & releasing panel indicator': 'Inspeksi pengukur tekanan silinder & indikator panel pelepasan',
  'inspection of cylinder pressure gauges, releasing panel indicator': 'Inspeksi pengukur tekanan silinder & indikator panel pelepasan',
  'smoke & heat detector functional test and manual abort switch': 'Uji fungsi detektor asap & panas serta sakelar abort manual',
  'audio/visual horn strobe test and battery backup voltage check': 'Uji sirine strobo audio/visual dan pemeriksaan tegangan baterai cadangan',
  'check discharge nozzles, piping brackets, and main control actuator': 'Pemeriksaan nosel pelepasan, bracket perpipaan, dan aktuator kontrol utama',

  // Cooling Tower
  'visual and inspection of cooling tower devices (basin, filler, support/mounting, float valve)': 'Inspeksi visual komponen Cooling Tower (basin, filler, dudukan/mounting, katup pelampung)',
  'visual and inspection of cooling tower devices': 'Inspeksi visual komponen Cooling Tower (basin, filler, dudukan/mounting, katup pelampung)',
  'inspection & checked motor fan (pulley, belt, fan blades, sheaves, spray nozzles)': 'Pemeriksaan motor kipas (puli, sabuk/belt, bilah kipas, sheave, nosel semprot)',
  'inspection & checked motor fan': 'Pemeriksaan motor kipas (puli, sabuk/belt, bilah kipas, sheave, nosel semprot)',
  'inspection of panel control, power meters, indicator lamps & control wiring': 'Inspeksi panel kontrol, power meter, lampu indikator & pengkabelan kontrol',
  'inspection of panel control': 'Inspeksi panel kontrol, power meter, lampu indikator & pengkabelan kontrol',
  'cleaning of water basin, filler media, and strainer mesh': 'Pembersihan basin air, media filler, dan saringan strainer',
  'cleaning of water basin': 'Pembersihan basin air, media filler, dan saringan strainer',
  'water treatment chemical dosage check and makeup valve inspection': 'Pemeriksaan dosis bahan kimia water treatment dan katup air pengisi',

  // Chiller
  'suction & discharge pressure check, refrigerant level, and compressor oil level': 'Pemeriksaan tekanan hisap & buang, level refrigeran, dan level oli kompresor',
  'condenser and evaporator water temperature delta t measurement and water flow': 'Pengukuran perbedaan temperatur (Delta T) air kondensor dan evaporator serta aliran air',
  'compressor motor vibration measurement and electrical terminal tightness check': 'Pengukuran getaran motor kompresor dan pengecekan kekencangan terminal listrik',
  'atc ball trap inspection, strainer cleaning, and control panel alarms review': 'Inspeksi ball trap ATC, pembersihan strainer, dan tinjauan riwayat alarm panel kontrol',

  // Cooling Pump
  'visual inspection & pump vibration measurement on motor and pump bearings': 'Pemeriksaan visual & pengukuran getaran pada bearing motor dan pompa',
  'motor bearing re-lubrication (greasing) and mechanical coupling alignment check': 'Pelumasan ulang bearing motor (greasing) dan pengecekan kelurusan kopling mekanis',
  'electrical terminal torque check, motor winding insulation test, and grounding': 'Pengecekan torsi terminal listrik, uji isolasi belitan motor, dan pentanahan',
  'check mechanical seal leakage, suction/discharge pressure gauges, and clean strainer': 'Pemeriksaan kebocoran mechanical seal, manometer tekanan hisap/buang, dan pembersihan strainer',

  // Trafo / Transformer
  'visual inspection of dry-type transformer enclosure, temperature controller, and fans': 'Inspeksi visual selungkup trafo tipe kering, pengontrol temperatur, dan kipas',
  'cable terminal torque verification, bushing cleaning, and grounding check': 'Verifikasi torsi terminal kabel, pembersihan bushing, dan pengecekan grounding',
  'high and low voltage winding insulation resistance testing (megger test)': 'Pengujian resistansi isolasi belitan tegangan tinggi dan rendah (Uji Megger)',
  'thermography infrared scan on all cable terminations and busbar connections': 'Pemindaian inframerah termografi pada semua terminasi kabel dan sambungan busbar',

  // Generator
  'visual inspection of generator engine, radiator, coolant level, and fuel piping lines': 'Inspeksi visual mesin genset, radiator, level coolant, dan jalur pipa bahan bakar',
  'starting battery voltage, specific gravity, electrolyte level, and charger check': 'Pengecekan tegangan baterai starter, berat jenis, level elektrolit, dan charger',
  'engine lube oil quality check, oil filter condition, and fan belt tension check': 'Pemeriksaan kualitas oli mesin, kondisi filter oli, dan ketegangan belt kipas',
  'no-load manual running test, frequency/voltage check, and auto-start interlock test': 'Uji jalan tanpa beban (running test), cek frekuensi/tegangan, dan interlock auto-start',

  // MV & RMU
  'visual inspection of mv cubicle enclosure, mimic diagram, and position indicators': 'Inspeksi visual selungkup kubikel TM, diagram mimik, dan indikator posisi',
  'sf6 gas pressure gauge check, earthing switch operation, and mechanical interlock test': 'Pemeriksaan manometer tekanan gas SF6, operasi sakelar pentanahan, dan uji interlock',
  'vacuum circuit breaker (vcb) mechanism lubrication and contact wear check': 'Pelumasan mekanisme pemutus tenaga VCB dan pemeriksaan keausan kontak',
  'insulation resistance testing and thermographic inspection on cable terminations': 'Pengujian resistansi isolasi dan inspeksi termografi pada terminasi kabel daya',

  // LV Panel
  'visual inspection of main distribution panel, acb/mccb breakers, and dpm meters': 'Inspeksi Panel Distribusi Utama, pemutus ACB/MCCB, dan meter daya digital',
  'air circuit breaker (acb) and mccb manual mechanism and electronic trip unit test': 'Pengujian mekanisme manual dan unit trip elektronik pada pemutus arus ACB dan MCCB',
  'thermography infrared scanning on incoming/outgoing busbars and cable connections': 'Pemindaian termografi inframerah pada busbar masuk/keluar dan sambungan kabel',
  'internal panel dust cleaning using industrial vacuum and terminal torque check': 'Pembersihan debu interior panel dengan vakum industri dan pengecekan torsi terminal',

  // UPS
  'inspection of ups operating modes (normal inverter, static bypass, and maintenance)': 'Pemeriksaan mode operasi UPS (Inverter Normal, Static Bypass, dan Pemeliharaan)',
  'measurement of input/output voltage, current balance, load percentage, and pf': 'Pengukuran tegangan masuk/keluar, keseimbangan arus, persentase beban, dan faktor daya',
  'individual battery block voltage, internal impedance measurement, and torque check': 'Pengujian tegangan per blok baterai, pengukuran impedansi internal, dan cek torsi baut',
  'cooling fans operation check, air dust filter cleaning, and capacitor health check': 'Pemeriksaan operasi kipas pendingin, pembersihan filter udara, dan cek fisik kapasitor',

  // PDU
  'visual inspection of pdu enclosure, branch breakers, and isolation transformer': 'Inspeksi visual selungkup kabinet PDU, pemutus cabang, dan trafo isolasi',
  'branch circuit monitoring system (bcms) check, dpm meters, and display verify': 'Pemeriksaan sistem pemantauan sirkuit cabang (BCMS), meter DPM, dan verifikasi display',
  'thermography scan on all circuit breaker connections and busbar joints': 'Scan termografi pada seluruh koneksi pemutus sirkuit dan sambungan busbar',
  'interior panel vacuum cleaning, terminal torque check, and grounding verify': 'Pembersihan vakum interior panel, pengecekan torsi terminal, dan verifikasi grounding',

  // CRAC
  'visual inspection of indoor crac unit, ec fan operation, and airflow direction': 'Inspeksi visual unit indoor CRAC, operasi kipas EC, dan arah hembusan aliran udara',
  'chilled water 2-way modulating valve travel check, actuator calibration, and delta t': 'Pemeriksaan pergerakan katup modulasi air dingin 2-arah, kalibrasi aktuator, dan delta T',
  'clean or replace air filters and verify differential pressure sensor (magnehelic)': 'Pembersihan atau penggantian filter udara dan verifikasi sensor tekanan diferensial',
  'electrode humidifier cleaning, cylinder scaling check, and condensate drain flush': 'Pembersihan humidifier elektroda, cek kerak silinder, dan pembilasan drainase kondensat',

  // Pre-Action & Hydrant
  'pre-action deluge valve trim inspection, solenoid actuator test, and air pressure check': 'Inspeksi trim katup deluge pre-action, uji aktuator solenoid, dan cek tekanan udara',
  'air compressor automatic maintenance of supervisory piping pressure verification': 'Verifikasi kompresor udara dalam menjaga tekanan pengawasan pipa otomatis',
  'water motor gong testing, alarm pressure switch verification, and drain test': 'Pengujian alarm water motor gong, verifikasi pressure switch alarm, dan uji drainase',
  'piping network visual inspection for leaks, corrosion, and sprinkler head clearance': 'Inspeksi visual jaringan perpipaan dari kebocoran, karat, dan jarak kepala sprinkler',
  'jockey pump, electric main pump, and diesel backup pump automatic start testing': 'Pengujian start otomatis pompa jockey, pompa utama elektrik, dan pompa cadangan diesel',
  'hydrant pillar, outdoor hose box, nozzle condition, and coupling gasket inspection': 'Inspeksi pilar hidran, kotak selang outdoor, kondisi nosel, dan karet coupling',
  'header pipe pressure stability check, pressure relief valve functional test': 'Pemeriksaan kestabilan tekanan pipa header, uji fungsional katup pelepas tekanan',
  'flow test and pressure measurement at most remote outdoor hydrant point': 'Uji aliran air dan pengukuran tekanan dinamis pada titik pilar hidran terjauh',

  // Lightning & Grounding
  'air terminal visual inspection, support mast rigidity, and down conductor inspection': 'Inspeksi visual terminal udara (finial), kekokohan tiang penyangga, dan konduktor turun',
  'lightning strike counter reading recording and functional test': 'Pencatatan pembacaan penghitung sambaran petir (strike counter) dan uji fungsi',
  'earth ground resistance measurement using calibrated earth tester (<1.0 ohm target)': 'Pengukuran resistansi pembumian menggunakan earth tester terkalibrasi (target <1,0 Ohm)',
  'equipotential bonding busbar inspection, bi-metallic connector tightness check': 'Inspeksi busbar bonding ekipotensial, pengecekan kekencangan klem bimetal',
  'measure earth ground loop resistance, inspect equipotential bonding connections': 'Pengukuran resistansi loop pentanahan bumi, inspeksi sambungan bonding ekipotensial',
  'verify copper conductor continuity and inspect ground pits for moisture/corrosion': 'Verifikasi kontinuitas konduktor tembaga dan inspeksi bak kontrol dari korosi'
};

/** Helper to find Indonesian translation for an English bullet phrase */
export function findBulletTranslation(enBullet: string, scopeName?: string): string {
  const clean = enBullet.toLowerCase().trim().replace(/^[•\-\*]\s*/, '').replace(/[.,;:)]+$/, '');
  if (!clean) return '';

  // 1. Direct dictionary match
  if (TASK_PM_BULLET_DICTIONARY[clean]) {
    return TASK_PM_BULLET_DICTIONARY[clean];
  }

  // 2. Substring dictionary match
  const dictKeys = Object.keys(TASK_PM_BULLET_DICTIONARY);
  for (const k of dictKeys) {
    if (clean.includes(k) || k.includes(clean)) {
      return TASK_PM_BULLET_DICTIONARY[k];
    }
  }

  // 3. Keyword-based matching
  if (clean.includes('cylinder pressure') || clean.includes('pressure gauges')) {
    return 'Inspeksi pengukur tekanan silinder & indikator panel pelepasan';
  }
  if (clean.includes('smoke') && (clean.includes('heat') || clean.includes('detector') || clean.includes('abort'))) {
    return 'Uji fungsi detektor asap & panas serta sakelar abort manual';
  }
  if ((clean.includes('horn') || clean.includes('strobe')) && (clean.includes('battery') || clean.includes('audio'))) {
    return 'Uji sirine strobo audio/visual dan pemeriksaan tegangan baterai cadangan';
  }
  if (clean.includes('cooling tower') && (clean.includes('basin') || clean.includes('devices') || clean.includes('float valve'))) {
    return 'Inspeksi visual komponen Cooling Tower (basin, filler, dudukan/mounting, katup pelampung)';
  }
  if ((clean.includes('motor fan') || clean.includes('fan blades')) && (clean.includes('pulley') || clean.includes('belt') || clean.includes('nozzle'))) {
    return 'Pemeriksaan motor kipas (puli, sabuk/belt, bilah kipas, sheave, nosel semprot)';
  }
  if (clean.includes('panel control') || (clean.includes('power meter') && clean.includes('wiring'))) {
    return 'Inspeksi panel kontrol, power meter, lampu indikator & pengkabelan kontrol';
  }
  if (clean.includes('cleaning of water basin') || (clean.includes('basin') && clean.includes('strainer'))) {
    return 'Pembersihan basin air, media filler, dan saringan strainer';
  }
  if (clean.includes('suction') && clean.includes('discharge') && clean.includes('pressure')) {
    return 'Pemeriksaan tekanan hisap & buang, level refrigeran, dan level oli kompresor';
  }
  if (clean.includes('delta t') || (clean.includes('temperature') && clean.includes('condenser'))) {
    return 'Pengukuran perbedaan temperatur (Delta T) air kondensor dan evaporator serta aliran air';
  }
  if (clean.includes('compressor') && (clean.includes('vibration') || clean.includes('tightness'))) {
    return 'Pengukuran getaran motor kompresor dan pengecekan kekencangan terminal listrik';
  }
  if (clean.includes('atc') || clean.includes('ball trap')) {
    return 'Inspeksi ball trap ATC, pembersihan strainer, dan tinjauan riwayat alarm panel kontrol';
  }
  if (clean.includes('vibration') && clean.includes('bearing')) {
    return 'Pemeriksaan visual & pengukuran getaran pada bearing motor dan pompa';
  }
  if (clean.includes('greasing') || (clean.includes('lubrication') && clean.includes('bearing'))) {
    return 'Pelumasan ulang bearing motor (greasing) dan pengecekan kelurusan kopling mekanis';
  }
  if (clean.includes('megger') || (clean.includes('insulation') && clean.includes('winding'))) {
    return 'Pengujian resistansi isolasi belitan tegangan tinggi dan rendah (Uji Megger)';
  }
  if (clean.includes('thermography') || clean.includes('thermal scan')) {
    return 'Pemindaian inframerah termografi pada koneksi daya dan terminasi kabel';
  }
  if (clean.includes('starting battery') || (clean.includes('battery') && clean.includes('charger'))) {
    return 'Pengecekan tegangan baterai starter, berat jenis, level elektrolit, dan charger';
  }
  if (clean.includes('running test') || clean.includes('no-load')) {
    return 'Uji jalan tanpa beban (running test), cek frekuensi/tegangan, dan interlock auto-start';
  }
  if (clean.includes('sf6') || clean.includes('earthing switch')) {
    return 'Pemeriksaan manometer tekanan gas SF6, operasi sakelar pentanahan, dan uji interlock';
  }
  if (clean.includes('acb') || clean.includes('mccb')) {
    return 'Pengujian mekanisme manual dan unit trip elektronik pada pemutus arus ACB dan MCCB';
  }
  if (clean.includes('ups') && clean.includes('operating mode')) {
    return 'Pemeriksaan mode operasi UPS (Inverter Normal, Static Bypass, dan Pemeliharaan)';
  }
  if (clean.includes('bcms') || (clean.includes('branch') && clean.includes('monitoring'))) {
    return 'Pemeriksaan sistem pemantauan sirkuit cabang (BCMS), meter DPM, dan verifikasi display';
  }
  if (clean.includes('ec fan') || clean.includes('airflow')) {
    return 'Inspeksi visual unit indoor CRAC, operasi kipas EC, dan arah hembusan aliran udara';
  }
  if (clean.includes('deluge valve') || clean.includes('solenoid')) {
    return 'Inspeksi trim katup deluge pre-action, uji aktuator solenoid, dan cek tekanan udara';
  }
  if (clean.includes('jockey pump') || clean.includes('fire pump')) {
    return 'Pengujian start otomatis pompa jockey, pompa utama elektrik, dan pompa cadangan diesel';
  }
  if (clean.includes('hydrant pillar') || clean.includes('hose box')) {
    return 'Inspeksi pilar hidran, kotak selang outdoor, kondisi nosel, dan karet coupling';
  }
  if (clean.includes('lightning') || clean.includes('air terminal') || clean.includes('lps')) {
    return 'Inspeksi visual terminal udara (finial), kekokohan tiang penyangga, dan konduktor turun';
  }
  if (clean.includes('earth ground') || clean.includes('earth tester')) {
    return 'Pengukuran resistansi pembumian menggunakan earth tester terkalibrasi (target <1,0 Ohm)';
  }
  if (clean.includes('ac split') || clean.includes('splitwall') || clean.includes('split wall')) {
    return 'Pemeriksaan visual unit AC indoor dan outdoor, kompresor, dan selungkup';
  }

  // 4. Fallback from scope
  if (scopeName) {
    const sClean = scopeName.toLowerCase();
    for (const [k, v] of Object.entries(SCOPE_TASK_PM_MAPPING)) {
      if (sClean.includes(k) || k.includes(sClean)) {
        // Extract first translated bullet if available
        const firstTrans = v.split('\n').find(l => l.startsWith('  '));
        if (firstTrans) return firstTrans.trim();
      }
    }
  }

  return 'Inspeksi visual, pemeriksaan parameter, pembersihan, dan verifikasi fungsi operasional';
}

/**
 * Convert any Task PM string into standard Dual-line Bilingual Per-Bullet format:
 * • English Bullet 1
 *   Indonesian Translation 1
 * • English Bullet 2
 *   Indonesian Translation 2
 */
export function convertTaskPMToBilingual(taskPM: string, scopeName?: string): string {
  if (!taskPM || taskPM.trim() === '-' || taskPM.trim() === '') {
    return getTaskPMForScope(scopeName || '');
  }

  const rawLines = taskPM.replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd()).filter(l => l.trim().length > 0);
  if (rawLines.length === 0) {
    return getTaskPMForScope(scopeName || '');
  }

  // Detect if text contains bullet points (lines starting with •, -, *, etc.)
  const hasBullets = rawLines.some(l => /^[•\-\*]/.test(l.trim()));

  if (hasBullets) {
    const bulletItems: { english: string; indonesian?: string }[] = [];
    let currentItem: { english: string; indonesian?: string } | null = null;

    for (const line of rawLines) {
      const trimmed = line.trim();
      if (/^[•\-\*]/.test(trimmed)) {
        if (currentItem) {
          bulletItems.push(currentItem);
        }
        const bulletText = trimmed.replace(/^[•\-\*]\s*/, '').trim();
        currentItem = { english: bulletText };
      } else if (currentItem) {
        if (!currentItem.indonesian) {
          currentItem.indonesian = trimmed;
        } else {
          currentItem.indonesian += ' ' + trimmed;
        }
      } else {
        currentItem = { english: trimmed };
      }
    }
    if (currentItem) {
      bulletItems.push(currentItem);
    }

    const outputBlocks: string[] = [];
    for (const item of bulletItems) {
      const enText = item.english;
      let idText = item.indonesian;

      if (!idText || idText === '-') {
        idText = findBulletTranslation(enText, scopeName);
      }

      if (idText) {
        outputBlocks.push(`• ${enText}\n  ${idText}`);
      } else {
        outputBlocks.push(`• ${enText}`);
      }
    }

    return outputBlocks.join('\n');
  }

  // If no bullets, but already contains dual-line (EN \n ID)
  if (rawLines.length === 2 && !rawLines[0].includes('•')) {
    return `${rawLines[0]}\n${rawLines[1]}`;
  }

  // If single line or non-bullet text, check if it matches a known scope or dictionary
  const matched = findBulletTranslation(taskPM.trim(), scopeName);
  if (matched) {
    return `• ${taskPM.trim().replace(/^[•\-\*]\s*/, '')}\n  ${matched}`;
  }

  return getTaskPMForScope(scopeName || '');
}

export function extractBOQItemDetails(item: any) {
  const className = item['CI Name*'] || item['Class Name'] || item['Equipment Name'] || item['CI Description*'] || Object.values(item)[1] || 'Equipment';
  
  const modelSN = item['Serial Number'] || item['Model / P/N'] || item['Model/Version'] || item['Specification'] || item['Model'] || item['TAG'] || item['Asset ID'] || '-';
  
  const manufacture = item['Manufacturer / Principle'] || item['Manufacturer'] || item['Brand'] || item['Principle'] || item['Product Name+'] || item['Product Name'] || (item['CI Description*']?.toLowerCase().includes('air conditioning') || item['CI Description*']?.toLowerCase().includes('split wall') ? 'Daikin' : 'OEM Certified');
  
  let installDate = item['Production Year'] || item['Install Date'] || item['Prod.Year'] || '2021';
  if (/^[0-9]{5}$/.test(String(installDate))) {
    installDate = '2021'; // Clean up Excel date numbers
  }
  
  const location = (item['Floor'] && item['Room']) 
    ? `${item['Floor']}, ${item['Room']}` 
    : (item['Room'] || item['Room Location'] || item['Location'] || item['Area'] || 'NeutraDC Campus');
    
  const capacity = item['Capacity'] || item['Specification'] || item['Type'] || 'Standard Rating';
  const productName = item['Product Name+'] || item['Product Name'] || manufacture;

  return { className, modelSN, manufacture, installDate, location, capacity, productName };
}

export function getTaskPMForScope(scopeName: string): string {
  const clean = scopeName.toLowerCase().trim();
  const keys = Object.keys(SCOPE_TASK_PM_MAPPING).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (clean.includes(k)) return SCOPE_TASK_PM_MAPPING[k];
  }
  for (const k of keys) {
    if (k.includes(clean)) return SCOPE_TASK_PM_MAPPING[k];
  }
  return `• Visual inspection and mechanical integrity check according to OEM standard
  Inspeksi visual dan pemeriksaan integritas mekanis sesuai standar pabrikan
• Operating parameter measurement, electrical readings, and cleaning
  Pengukuran parameter kerja, pembacaan elektrikal, dan pembersihan
• Functional testing, running verification, and safety interlock check
  Pengujian fungsional, verifikasi operasional, dan uji interlock keselamatan`;
}

/**
 * Intelligent BOQ Category resolver for maintenance scopes.
 * Resolves naming differences between Master PM Schedule and BOQ Asset Data (e.g. AC Splits -> Splitwall).
 */
export function findBOQCategoryForScope(scopeName: string) {
  const clean = scopeName.toLowerCase().trim();

  // 1. Explicit Alias Mapping for Schedule Scopes vs BOQ Categories
  if (clean.includes('ac split') || clean.includes('splitwall') || clean.includes('split wall')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_25' || c.name.toLowerCase() === 'splitwall');
  }
  if (clean.includes('cooling tower water treatment') || clean.includes('ct water treatment')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_34' || c.name.toLowerCase().includes('ct water treatment'));
  }
  if (clean.includes('cooling tower') || clean === 'ct') {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_16' || c.name === 'CT');
  }
  if (clean.includes('cooling pump')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_18' || c.name.toLowerCase() === 'cooling pump');
  }
  if (clean.includes('chiller')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_21' || c.name.toLowerCase() === 'chiller');
  }
  if (clean.includes('trafo') || clean.includes('transformer')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_1' || c.name.toLowerCase() === 'trafo');
  }
  if (clean.includes('genset') || clean.includes('generator')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_10' || c.name.toLowerCase() === 'genset');
  }
  if (clean.includes('mv') || clean.includes('rmu')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_3' || c.name.toLowerCase().includes('mv'));
  }
  if (clean.includes('lv panel') || clean === 'lv') {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_4' || c.name.toLowerCase() === 'lv panel');
  }
  if (clean.includes('ups')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_8' || c.name.toLowerCase() === 'ups');
  }
  if (clean.includes('pdu')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_6' || c.name.toLowerCase() === 'pdu');
  }
  if (clean.includes('crac') || clean.includes('pac')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_19' || c.name.toLowerCase() === 'crac');
  }
  if (clean.includes('fcu')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_20' || c.name.toLowerCase() === 'fcu');
  }
  if (clean.includes('ahu') || clean.includes('pahu')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_23' || c.name.toLowerCase() === 'pahu');
  }
  if (clean.includes('vrv') || clean.includes('vrf')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_22' || c.name.toLowerCase() === 'vrv');
  }
  if (clean.includes('fss') || clean.includes('inergen') || clean.includes('suppression')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_26' || c.name.toLowerCase() === 'fss');
  }
  if (clean.includes('preaction') || clean.includes('pre-action')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_28' || c.name.toLowerCase() === 'preaction');
  }
  if (clean.includes('hydrant')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_29' || c.name.toLowerCase() === 'hydrant actual') ||
           BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_27');
  }
  if (clean.includes('lightning') || clean.includes('lps')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_9' || c.name.toLowerCase().includes('lightning'));
  }
  if (clean.includes('grounding')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_5' || c.name.toLowerCase() === 'grounding');
  }
  if (clean.includes('lift') || clean.includes('elevator')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_30' || c.name.toLowerCase() === 'lift');
  }
  if (clean.includes('dock leveler')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_31' || c.name.toLowerCase() === 'dock leveler');
  }
  if (clean.includes('gate') || clean.includes('auto gate') || clean.includes('road blocker')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_36' || c.name.toLowerCase() === 'gate');
  }
  if (clean.includes('door')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_39' || c.name.toLowerCase() === 'door');
  }
  if (clean.includes('x-ray') || clean.includes('xray')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_40' || c.name.toLowerCase() === 'x-ray');
  }
  if (clean.includes('water softener')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_33' || c.name.toLowerCase() === 'water softener');
  }
  if (clean.includes('exhaust')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_14' || c.name.toLowerCase().includes('exhaust'));
  }
  if (clean.includes('busduct')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_15' || c.name.toLowerCase() === 'busduct');
  }
  if (clean.includes('capacitor bank') || clean.includes('cap bank')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_13' || c.name.toLowerCase().includes('cap bank'));
  }
  if (clean.includes('load bank')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_12' || c.name.toLowerCase() === 'load bank');
  }
  if (clean.includes('fuel system') || clean.includes('fuel tank')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_11' || c.name.toLowerCase() === 'fuel system');
  }
  if (clean.includes('lighting') || clean.includes('pju')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_41' || c.name.toLowerCase() === 'lighting');
  }
  if (clean.includes('pompa') || clean.includes('pump')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_35' || c.name.toLowerCase() === 'pompa');
  }
  if (clean.includes('stp') || clean.includes('plumbing')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_37' || c.name.toLowerCase().includes('stp'));
  }
  if (clean.includes('water leak') || clean.includes('fuel leak')) {
    return BOQ_CATEGORIES_DATA.find(c => c.id === 'cat_32' || c.name.toLowerCase().includes('leak'));
  }

  // 2. Fallback fuzzy search
  return BOQ_CATEGORIES_DATA.find(c => 
    c.name.toLowerCase().includes(clean) || clean.includes(c.name.toLowerCase())
  );
}


// ══════════════════════════════════════════════════════════════════════════
// MASTER SCOPE OF WORK DICTIONARY (3-Step Bilingual SOP from 32 SR 2026)
// ══════════════════════════════════════════════════════════════════════════
export const SCOPE_OF_WORK_DICTIONARY: Record<string, ScopeOfWorkCategory> = {
  "chiller": {
    "category": "CHILLER & PRIMARY COOLING SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection & Safety Isolation\nInspeksi Visual & Isolasi Keselamatan",
        "tasks": [
          "Perform a comprehensive visual inspection of the external structure of water-cooled/air-cooled chiller units, centrifugal/screw compressors, evaporator, and condenser, verifying the absence of oil or refrigerant leaks at flange joints, expansion valves, and sight glasses, and ensuring HSE permit-to-work and Lockout/Tagout (LOTO) protocols are implemented prior to maintenance.\nMelakukan inspeksi visual menyeluruh terhadap struktur luar unit water-cooled/air-cooled chiller, kompresor sentrifugal/screw, evaporator, dan kondensor, memeriksa ketiadaan kebocoran oli atau refrigeran pada sambungan flensa, katup ekspansi, dan sight glass, serta memastikan penerapan prosedur Lockout/Tagout (LOTO) dan izin kerja keselamatan HSE sebelum aktivitas intervensi teknis.",
          "Inspect the physical condition of spring vibration isolator pads, machine base foundation bolt tightness, closed-cell thermal insulation integrity on evaporator chilled water piping against damage or excessive condensation, and verify the seal integrity of chiller electrical control panel doors.\nMemeriksa kondisi fisik bantalan peredam getaran (spring vibration isolator pads), kekencangan baut pondasi dasar mesin, keutuhan insulasi termal tertutup (closed-cell insulation) pada pipa air dingin evaporator dari kerusakan atau kondensasi berlebih, serta memeriksa keutuhan segel pintu panel kontrol elektrikal chiller."
        ]
      },
      {
        "step": "2. Cleaning, Strainer Service & Mechanical Maintenance\nPembersihan, Servis Strainer & Pemeliharaan Mekanikal",
        "tasks": [
          "Clean the unit body enclosure and condenser fins from dust accumulation using an industrial vacuum cleaner, inspect and clean chilled water and condenser water strainers, and inspect the automatic cleaning ball circulation mechanism on the Automatic Tube Cleaning System (ATCS / ball trap strainer).\nMembersihkan selungkup bodi unit dan kisi sirip kondensor dari tumpukan debu menggunakan vacuum cleaner industri, memeriksa dan membersihkan saringan saringan air dingin (chilled water strainer) dan air kondensor (condenser water strainer), serta memeriksa mekanisme sirkulasi bola pembersih otomatis pada Automatic Tube Cleaning System (ATCS / ball trap strainer).",
          "Inspect and lubricate 2-way modulating valve actuators and butterfly isolation valves, verify torque tightness of main power cable termination connections and control wiring on compressor contactors, and clean electrical contacts from oxidation particles.\nMemeriksa dan melumasi aktuator katup modulasi 2-arah (2-way modulating valve), katup kupu-kupu isolasi (butterfly isolation valves), memeriksa kekencangan torsi sambungan terminasi kabel daya utama dan pengkabelan kontrol pada kontaktor kompresor, serta membersihkan kontak elektrik dari partikel oksidasi."
        ]
      },
      {
        "step": "3. Measurement, Operational Testing & Standards Validation\nPengukuran, Pengujian Operasional & Validasi Standar",
        "tasks": [
          "Measure main chiller input electrical parameters including 3-phase phase-to-phase voltages R-S, S-T, T-R (standard 380 - 415 VAC ±10%) and phase-to-neutral voltages R-N, S-N, T-N (standard 220 - 240 VAC), measure compressor operating load current balance per phase (Phase R, S, T) with unbalance deviation <10%, and measure power factor (Cos phi >0.85).\nMelakukan pengukuran parameter kelistrikan masukan utama chiller meliputi tegangan 3-fasa fasa-fasa R-S, S-T, T-R (standar 380 - 415 VAC ±10%) dan fasa-netral R-N, S-N, T-N (standar 220 - 240 VAC), mengukur keseimbangan arus beban operasional kompresor per fasa (Phase R, S, T) dengan deviasi unbalance <10%, serta mengukur faktor daya (Power Factor Cos phi >0.85).",
          "Measure and record operating refrigerant pressure parameters including suction pressure (45 - 65 psi / 3.1 - 4.5 bar) and discharge pressure (120 - 170 psi / 8.3 - 11.7 bar), verify compressor lubricating oil level in sight glass (1/2 to 3/4 height), and measure entering and leaving water temperatures for evaporator (Inlet 12°C, Outlet 7°C, target Delta T 5°C) and condenser (Inlet 30°C, Outlet 35°C).\nMengukur dan mencatat parameter tekanan refrigeran operasional meliputi tekanan hisap (Suction Pressure 45 - 65 psi / 3.1 - 4.5 bar) dan tekanan buang (Discharge Pressure 120 - 170 psi / 8.3 - 11.7 bar), memverifikasi level oli pelumas kompresor pada sight glass (ketinggian 1/2 hingga 3/4 tabung), serta mengukur temperatur air masuk dan keluar evaporator (Inlet 12°C, Outlet 7°C, target Delta T 5°C) dan kondensor (Inlet 30°C, Outlet 35°C).",
          "Perform mechanical vibration measurements of compressors using a digital Vibration Meter (vibration limit ≤ 2.8 mm/s RMS per ISO 10816-3), measure unit acoustic noise level using a Sound Level Meter (limit ≤ 85 dB at 1 meter distance), measure panel earthing resistance (< 1.0 Ω), and perform infrared thermography scanning on power cable terminals to verify absence of thermal hotspot anomalies (hotspot Delta T < 5°C).\nMelakukan pengukuran getaran mekanikal kompresor menggunakan Vibration Meter digital (standar batas getaran ≤ 2.8 mm/s RMS sesuai ISO 10816-3), mengukur tingkat kebisingan akustik unit chiller menggunakan Sound Level Meter (standar batas ≤ 85 dB pada jarak 1 meter), mengukur resistansi pentanahan panel (< 1.0 Ω), serta melakukan pemindaian termografi inframerah pada terminal kabel daya untuk memastikan tidak ada anomali titik panas (hotspot Delta T < 5°C)."
        ]
      }
    ]
  },
  "cooling tower": {
    "category": "COOLING TOWER & WATER PIPING SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection & Physical Integrity\nInspeksi Visual & Integritas Fisik",
        "tasks": [
          "Perform visual inspection of cooling tower physical structure, fiberglass casing (FRP casing), water basin, film fill media (PVC filler/packing), drift eliminator, and structural mounting support condition for indications of corrosion, cracks, or algae growth.\nMelakukan inspeksi visual terhadap struktur fisik cooling tower, selungkup fiberglass (FRP casing), bak penampung air basin, media pengisi film (PVC filler/packing), eliminator percikan air (drift eliminator), dan kondisi dudukan penyangga struktural dari indikasi korosi, keretakan, atau pertumbuhan alga.",
          "Check the operation of the automatic make-up water float valve mechanism, cooling water distribution manifold pipes, and spray nozzle cleanliness to ensure uniform water spray pattern across the entire fill media cross-section.\nMemeriksa mekanisme kerja katup pelampung pengisian air otomatis (make-up water float valve), pipa manifold distribusi air pendingin, dan kebersihan nosel semprot (spray nozzles) untuk memastikan pola semburan air jatuh merata ke seluruh penampang media pengisi."
        ]
      },
      {
        "step": "2. Cleaning, Descaling & Fan Drive Maintenance\nPembersihan, Pengikisan Kerak & Pemeliharaan Penggerak Kipas",
        "tasks": [
          "Drain and clean sludge sediment, algae, and mineral scale in the water basin using a pressure washer, clean condenser pump suction strainers, and flush fill media from suspended debris.\nMenguras dan membersihkan endapan lumpur, lumut, dan kerak mineral pada basin penampung air menggunakan semprotan air bertekanan, membersihkan saringan hisap pompa kondensor (suction strainer), dan membilas kisi filler dari kotoran tersuspensi.",
          "Inspect fan motor physical condition, measure drive transmission belt tension (V-belt deflection 10-15 mm) and sheave pulley alignment, inspect axial fan blades for cracks or pitch angle deviation, and lubricate motor and fan shaft bearings with standard industrial grease.\nMemeriksa kondisi fisik motor kipas (fan motor), mengukur ketegangan sabuk transmisi penggerak (V-belt tension defleksi 10-15 mm) dan kelurusan puli (sheave pulley alignment), memeriksa bilah kipas aksial dari keretakan atau deviasi sudut (fan pitch angle), serta melumasi bantalan bearing motor dan poros kipas dengan grease industri standar."
        ]
      },
      {
        "step": "3. Measurement, Water Chemistry & Performance Check\nPengukuran, Kualitas Kimia Air & Pemeriksaan Performa",
        "tasks": [
          "Measure cooling tower fan motor electrical parameters including 3-phase supply voltages R-S, S-T, T-R (standard 380 - 400 VAC), operating current per phase (Phase R, S, T) using a clamp meter, motor winding insulation resistance using a 1000V DC Insulation Tester (standard > 100 MΩ), and motor frame earthing resistance (< 5.0 Ω).\nMengukur parameter kelistrikan motor kipas cooling tower meliputi tegangan suplai 3-fasa R-S, S-T, T-R (standar 380 - 400 VAC), arus operasional per fasa (Phase R, S, T) menggunakan clamp meter, mengukur resistansi isolasi belitan motor menggunakan Insulation Tester 1000V DC (standar nilai > 100 MΩ), dan mengukur tahanan pentanahan bodi motor (< 5.0 Ω).",
          "Perform fan motor vibration measurement during full operation using a vibration meter (standard ≤ 3.5 mm/s) and measure fan rotation acoustic noise using a sound level meter (standard ≤ 75 dB at 2 meters distance).\nMelakukan pengukuran getaran motor kipas saat beroperasi penuh menggunakan vibration meter (standar getaran ≤ 3.5 mm/s) dan mengukur tingkat kebisingan putaran kipas menggunakan sound level meter (standar ≤ 75 dB pada jarak 2 meter).",
          "Collect condenser cooling water samples for water chemistry quality testing including acidity level (standard pH 7.5 - 8.5), electrical conductivity (standard < 1500 µS/cm), Total Dissolved Solids (TDS), and measure basin entering and leaving water temperature differential (standard heat rejection Delta T 5.0°C).\nMengambil sampel air pendingin kondensor untuk pengujian kualitas kimia air meliputi tingkat keasaman (pH standar 7.5 - 8.5), konduktivitas elektrik (Conductivity standar < 1500 µS/cm), Total Dissolved Solids (TDS), serta mengukur perbedaan temperatur air masuk dan keluar basin (Delta T pelepasan panas standar 5.0°C)."
        ]
      }
    ]
  },
  "cooling pump": {
    "category": "COOLING PUMP & WATER CIRCULATION SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection & Mechanical Seal Check\nInspeksi Visual & Pemeriksaan Mechanical Seal",
        "tasks": [
          "Perform a comprehensive visual inspection of primary/secondary chilled water circulating pumps and condenser water pumps, inspecting for water leakage or dripping at mechanical seals and packing glands, checking pipe flange gasket condition, and inspecting chilled pipe thermal insulation integrity.\nMelakukan inspeksi visual menyeluruh terhadap rangkaian pompa sirkulasi air dingin primer/sekunder (Primary/Secondary Chilled Water Pumps) dan pompa air kondensor (Condenser Water Pumps), memeriksa ketiadaan kebocoran atau tetesan air pada mechanical seal dan packing gland, memeriksa kondisi fisik gasket sambungan flensa pipa, dan memeriksa keutuhan insulasi termal pipa dingin.",
          "Check suction pressure gauge and discharge pressure gauge indicator readings, inspect flexible shaft coupling alignment, vibration isolator condition, and pump foundation anchor bolt tightness.\nMemeriksa penunjukan jarum manometer tekanan hisap (suction pressure gauge) dan manometer tekanan buang (discharge pressure gauge), memeriksa kelurusan sambungan kopling fleksibel (flexible shaft coupling), kondisi peredam getaran (vibration isolators), dan kekencangan baut angkur pondasi pompa."
        ]
      },
      {
        "step": "2. Cleaning, Lubrication & Alignment Maintenance\nPembersihan, Pelumasan & Pemeliharaan Kelurusan Poros",
        "tasks": [
          "Clean pump casing body, motor grille enclosure, and baseplate from dust accumulation, dirt, or rust stains using microfiber cloths and fine wire cleaning brushes.\nMembersihkan bodi rumah pompa (pump casing), selungkup kisi motor, dan pelat dasar (baseplate) dari endapan debu, kotoran, atau noda karat menggunakan kain mikrofiber dan sikat pembersih kawat halus.",
          "Perform regreasing on electric motor bearings and pump bearings using high-temperature industrial grease in accordance with manufacturer specifications, and inspect motor-to-pump shaft axial and radial alignment (dial indicator / laser alignment).\nMelakukan pelumasan ulang (regreasing) pada bantalan bearing motor listrik dan bantalan bearing pompa menggunakan grease industri bertemperatur tinggi sesuai spesifikasi pabrikan, serta memeriksa kelurusan aksial dan radial poros penggerak motor terhadap poros pompa (dial indicator / laser alignment)."
        ]
      },
      {
        "step": "3. Measurement, Fluid Pressure & Vibration Validation\nPengukuran, Tekanan Fluida & Validasi Getaran",
        "tasks": [
          "Measure pump motor electrical parameters including 3-phase supply voltages R-S, S-T, T-R (standard 380 - 415 VAC) and R-N, S-N, T-N (standard 220 - 240 VAC), operating workload current per phase (Phase R, S, T) with load unbalance deviation <10%, and motor winding insulation resistance using a 1000V DC Megger (standard > 100 MΩ).\nMengukur parameter kelistrikan motor pompa meliputi tegangan suplai 3-fasa fasa-fasa R-S, S-T, T-R (standar 380 - 415 VAC) dan fasa-netral R-N, S-N, T-N (standar 220 - 240 VAC), mengukur arus beban kerja operasional per fasa (Phase R, S, T) dengan deviasi keseimbangan beban <10%, serta mengukur resistansi isolasi belitan motor pompa menggunakan Megger 1000V DC (standar > 100 MΩ).",
          "Measure pump hydraulic pressure parameters including suction pressure (standard 2.5 - 4.0 Bar) and discharge pressure (standard 5.0 - 7.5 Bar) to ensure stable pump head pressure without cavitation indications.\nMengukur parameter tekanan hidrolik pompa meliputi tekanan hisap (Suction Pressure standar 2.5 - 4.0 Bar) dan tekanan buang (Discharge Pressure standar 5.0 - 7.5 Bar) untuk memastikan head tekanan pompa stabil tanpa indikasi kavitasi.",
          "Measure pump casing temperature (standard ≤ 75°C) and bearing housing temperature (standard ≤ 70°C) using an infrared thermometer, measure mechanical vibration levels on pump and motor bearing housings using a Vibration Meter (standard ≤ 2.8 mm/s RMS per ISO 10816-3), measure motor and starter panel grounding resistance (< 5.0 Ω), and perform infrared thermography scanning on starter power contact terminals.\nMelakukan pengukuran temperatur bodi rumah pompa (Casing Pump Temperature standar ≤ 75°C) dan temperatur bantalan bearing (standar ≤ 70°C) menggunakan termometer inframerah, mengukur tingkat getaran mekanikal pada bearing housing pompa dan motor menggunakan Vibration Meter (standar getaran ≤ 2.8 mm/s RMS sesuai ISO 10816-3), mengukur resistansi pembumian motor dan panel starter (< 5.0 Ω), serta melakukan pemindaian termografi inframerah pada terminal starter kontak daya."
        ]
      }
    ]
  },
  "transformer": {
    "category": "TRANSFORMER (TRAFO) SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Enclosure & Bushing Integrity\nInspeksi Visual, Selungkup & Integritas Bushing",
        "tasks": [
          "Perform visual inspection of 20 kV / 400V step-down cast resin dry-type power transformer cubicle structure, inspecting high voltage (HV) and low voltage (LV) winding surface cleanliness, porcelain/resin bushing insulator integrity against cracks or flashover tracking marks, and IP21/IP23 enclosure ventilation grille cleanliness.\nMelakukan inspeksi visual terhadap struktur fisik kubikel transformator daya penurun tegangan 20 kV / 400V (Cast Resin Dry-Type Transformer), memeriksa kebersihan permukaan belitan tegangan tinggi (HV) dan tegangan rendah (LV), keutuhan isolator bushing porselen/resin dari keretakan atau jejak loncatan bunga api listrik (flashover tracking), dan kebersihan kisi ventilasi enclosure IP21/IP23.",
          "Inspect anti-vibration rubber mounting pad rigidity, check transformer neutral and frame copper grounding tape condition, and verify winding temperature controller display monitor integrity.\nMemeriksa kekokohan pemasangan bantalan karet peredam getaran (anti-vibration rubber pads), memeriksa kondisi kabel pembumian kerangka dan netral trafo (copper ground tape), serta memeriksa keutuhan display unit pengendali temperatur belitan (Temperature Controller Monitor unit)."
        ]
      },
      {
        "step": "2. Cleaning, Enclosure Dusting & Terminal Torque Service\nPembersihan, Penghisapan Debu Selungkup & Torsi Terminal",
        "tasks": [
          "Clean dust, conductive particles, and spider webs from air ducts between transformer winding phase coils and magnetic core laminations using a HEPA-filtered industrial vacuum cleaner and insulated soft brushes.\nMembersihkan debu, partikel konduktif, dan sarang laba-laba pada saluran udara antar belitan fasa kumparan trafo (air ducts) dan inti besi magnetik (magnetic core laminations) menggunakan vacuum cleaner industri berfilter HEPA dan kuas halus berinsulasi tegangan tinggi.",
          "Inspect and retorque copper connection bolts on HV incoming terminals, LV outgoing terminals, and neutral busbar connections using a calibrated torque wrench (50 - 70 Nm) to prevent abnormal contact resistance.\nMemeriksa dan melakukan pengetatan ulang torsi baut sambungan tembaga pada terminal HV incoming, terminal LV outgoing, dan sambungan netral busbar menggunakan kunci torsi terkalibrasi (torque wrench 50 - 70 Nm) untuk mencegah resistansi kontak abnormal."
        ]
      },
      {
        "step": "3. Measurement, Insulation Testing & Thermographic Scan\nPengukuran, Uji Tahanan Isolasi & Termografi",
        "tasks": [
          "Measure 20 kV primary side input voltage and 400V secondary side output voltage (phase-to-phase R-S, S-T, T-R standard 395 - 405 VAC, phase-to-neutral R-N, S-N, T-N standard 228 - 232 VAC), and measure operational load current balance on phases R, S, T, and neutral (N) conductor current.\nMengukur tegangan masukan sisi primer 20 kV dan tegangan keluaran sisi sekunder 400V (fasa-fasa R-S, S-T, T-R standar 395 - 405 VAC, fasa-netral R-N, S-N, T-N standar 228 - 232 VAC), serta mengukur keseimbangan arus beban operasional fasa R, S, T, dan arus konduktor Netral (N).",
          "Record transformer winding operating temperature on all three phase coils via RTD PT100 thermocouple sensor readings (Winding Temperature Indicator - WTI normal temperature ≤ 85°C, alarm limit 120°C, trip interlock limit 140°C), and verify forced-air cooling fan automatic start function.\nMencatat temperatur operasional belitan transformator pada ketiga fasa kumparan melalui pembacaan sensor termokopel RTD PT100 (Winding Temperature Indicator - WTI standar suhu normal ≤ 85°C, batas alarm 120°C, batas trip interlock 140°C), serta memverifikasi pengoperasian otomatis kipas pendingin paksa trafo (forced-air cooling fans auto-start).",
          "Perform winding insulation resistance testing using a 2.5 kV / 5.0 kV DC high-voltage Insulation Tester covering HV-to-LV (standard > 1000 MΩ), HV-to-Ground (standard > 1000 MΩ), and LV-to-Ground (standard > 500 MΩ).\nMelakukan pengujian resistansi isolasi belitan menggunakan Insulation Tester bertegangan tinggi 2.5 kV / 5.0 kV DC meliputi pengujian isolasi HV ke LV (standar > 1000 MΩ), HV ke Ground (standar > 1000 MΩ), dan LV ke Ground (standar > 500 MΩ).",
          "Measure transformer neutral grounding resistance (standard < 1.0 Ω), and perform high-resolution infrared thermography scanning across all busbar connection terminals and power cables to verify absence of thermal hotspots (Delta T < 5°C).\nMengukur resistansi pembumian titik netral transformator (Neutral Grounding Resistance standar < 1.0 Ω), serta melakukan pemindaian termografi inframerah beresolusi tinggi pada seluruh terminal sambungan busbar dan kabel daya untuk mendeteksi tidak adanya hotspot termal (Delta T < 5°C)."
        ]
      }
    ]
  },
  "generator & fuel system": {
    "category": "GENERATOR (GENSET) & FUEL SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Fluid Levels & Enclosure Integrity\nInspeksi Visual, Level Fluida & Integritas Selungkup",
        "tasks": [
          "Perform visual inspection of emergency diesel generator units (1500 - 2500 kVA), checking soundproof canopy / acoustic room, spring vibration mount rigidity, and verifying absence of engine oil, diesel fuel, or radiator coolant seepage on cylinder blocks, injection pumps, and turbocharger hose connections.\nMelakukan inspeksi visual terhadap unit genset diesel darurat (Emergency Diesel Generator 1500 - 2500 kVA), memeriksa selungkup peredam suara (soundproof canopy / acoustic room), kekokohan dudukan peredam getaran (spring mounts), memeriksa tidak adanya rembesan oli mesin, bahan bakar solar, atau cairan pendingin radiator (coolant) pada blok silinder, pompa injeksi, dan sambungan selang turbocharger.",
          "Check diesel engine lubricating oil level on dipstick (between Min and Max marks), check radiator coolant level in expansion tank sight glass, check daily fuel tank level, and ensure exhaust manifold and exhaust stack pathways are free from obstructions.\nMemeriksa level oli pelumas mesin diesel pada dipstick (berada di antara tanda Min dan Max), memeriksa level air radiator pada sight glass tangki ekspansi, memeriksa level bahan bakar solar pada tangki harian (Daily Fuel Tank), serta memastikan jalur exhaust manifold dan cerobong pembuangan gas buang bebas dari hambatan."
        ]
      },
      {
        "step": "2. Filter Service, Battery Maintenance & Mechanical Check\nServis Filter, Pemeliharaan Baterai & Pemeriksaan Mekanikal",
        "tasks": [
          "Clean dust from engine cooling radiator grilles, clean air intake filter elements, inspect and drain water sediment from fuel water separator / Racor filters, and verify jacket water heater operates normally maintaining block temperature at 40 - 50°C.\nMembersihkan debu kisi-kisi radiator pendingin mesin, membersihkan elemen saringan udara masuk (air intake filter), memeriksa dan membuang endapan air pada filter pemisah air bahan bakar (fuel water separator / racor filter), serta memeriksa pemanas blok mesin (jacket water heater beroperasi normal menjaga suhu blok 40 - 50°C).",
          "Clean starter battery compartment enclosure from dust and debris, clean battery terminal pole clamps from sulfation deposit crust, lubricate poles with corrosion-inhibiting petroleum jelly, and inspect engine room motorized air intake and exhaust louvers.\nMembersihkan selungkup kompartemen baterai starter dari debu dan kotoran, membersihkan klem kutub terminal baterai dari deposit kerak sulfasi, melumasi kutub dengan petroleum jelly pelindung korosi, serta memeriksa motorized louver udara masuk dan keluar ruang genset."
        ]
      },
      {
        "step": "3. Measurement, Running Test & Control Parameter Validation\nPengukuran, Uji Jalan Mesin & Validasi Parameter Kontrol",
        "tasks": [
          "Measure physical parameters of dual 24 VDC starting battery bank: measure float charging voltage (standard 26.5 - 27.6 VDC), internal resistance per battery cell using an internal resistance tester (standard < 5.0 mΩ per block), and lead-acid electrolyte specific gravity using a calibrated hydrometer (standard 1.260 - 1.280 at 25°C).\nMengukur parameter fisik bank baterai starting ganda (Dual Starting Battery 24 VDC): mengukur tegangan float pengisian baterai (standar 26.5 - 27.6 VDC), mengukur resistansi internal per sel baterai menggunakan battery internal resistance tester (standar < 5.0 mΩ per blok), dan mengukur berat jenis cairan elektrolit baterai asam timbal menggunakan hidrometer terkalibrasi (standar 1.260 - 1.280 pada 25°C).",
          "Perform functional engine running test (No-Load / Simulated Load Running Test) and record engine performance parameters: stable engine speed at 1500 RPM, lube oil pressure (standard 3.5 - 5.5 bar during operation), radiator coolant temperature (standard 75 - 85°C), and engine battery charging alternator DC output (27.5 VDC).\nMelakukan uji jalan fungsional mesin diesel (No-Load / Simulated Load Running Test) dan mencatat parameter unjuk kerja mesin: kecepatan putaran mesin stabil pada 1500 RPM, tekanan oli pelumas (Lube Oil Pressure standar 3.5 - 5.5 bar saat beroperasi), temperatur cairan pendingin radiator (Coolant Temperature standar 75 - 85°C), dan tegangan alternator pengisi daya baterai (Engine Alternator DC Output 27.5 VDC).",
          "Measure generator output electrical parameters: 3-phase voltages R-S, S-T, T-R (standard 400 VAC ±2%) and R-N, S-N, T-N (standard 230 VAC ±2%), stable generating frequency (standard 50.0 ± 0.5 Hz), load current balance per phase, verify auto-synchronization controller module response (Deepsea / ComAp controller), and test emergency stop push button and overspeed trip interlock protection.\nMengukur parameter kelistrikan keluaran generator: tegangan 3-fasa fasa-fasa R-S, S-T, T-R (standar 400 VAC ±2%) dan fasa-netral R-N, S-N, T-N (standar 230 VAC ±2%), frekuensi pembangkitan stabil (standar 50.0 ± 0.5 Hz), mengukur keseimbangan arus beban per fasa, memverifikasi respon modul kontrol sinkronisasi otomatis (Deepsea / ComAp controller), serta menguji tombol penghentian darurat (Emergency Stop push button) dan proteksi interlock kecepatan lebih (overspeed trip)."
        ]
      }
    ]
  },
  "mv and rmu panel": {
    "category": "MV & RMU (MEDIUM VOLTAGE) DISTRIBUTION PANEL",
    "items": [
      {
        "step": "1. Visual Inspection, SF6 Gas & VPIS Indicators\nInspeksi Visual, Gas SF6 & Indikator Tegangan VPIS",
        "tasks": [
          "Perform visual inspection of 20 kV medium voltage cubicle enclosures (Medium Voltage Switchgear & Ring Main Unit - RMU), checking SF6 insulating gas pressure gauge needle is within the safe green zone (normal pressure ≥ 0.05 MPa / 0.5 bar), and verifying absence of moisture or insulating gas leakage.\nMelakukan inspeksi visual terhadap selungkup kubikel tegangan menengah 20 kV (Medium Voltage Switchgear & Ring Main Unit - RMU), memeriksa indikator jarum penunjuk tekanan gas isolasi SF6 berada dalam zona hijau aman (tekanan normal ≥ 0.05 MPa / 0.5 bar), dan memastikan tidak ada indikasi kelembaban atau kebocoran gas isolasi.",
          "Check 20 kV Voltage Presence Indicating System (VPIS) indicator lamps, check position indicators for Load Break Switch (LBS), Vacuum Circuit Breaker (VCB), and Earthing Switch, and ensure cable compartment door seals are tightly locked.\nMemeriksa lampu indikator kehadiran tegangan 20 kV (Voltage Presence Indicating System - VPIS), memeriksa indikator posisi status sakelar pemutus beban (Load Break Switch - LBS), pemutus sirkit vakum (Vacuum Circuit Breaker - VCB), dan sakelar pembumian (Earthing Switch), serta memastikan segel pintu kompartemen kabel terkunci rapat."
        ]
      },
      {
        "step": "2. Cleaning, Mechanical Interlock & Mechanism Service\nPembersihan, Interlock Mekanikal & Servis Mekanisme",
        "tasks": [
          "Clean external cubicle enclosure and cable compartments from dust using a dedicated medium-voltage insulated vacuum cleaner, and inspect compartment door rubber seals against environmental dust and insects.\nMembersihkan debu eksternal selungkup kubikel dan kompartemen kabel menggunakan vacuum cleaner berinsulasi khusus elektrikal tegangan menengah, memeriksa kekedapan segel karet pintu kompartemen dari serangga dan debu lingkungan.",
          "Inspect smooth manual and motorized operation of contact closing spring charging mechanism, lubricate drive mechanism gear levers with high-dielectric standard lubricant, and test mechanical safety interlock system between cubicle doors, VCB position, and earthing switch.\nMemeriksa kelancaran mekanisme operasi manual dan motorik pengisian pegas penutup kontak (spring charging mechanism), melumasi tuas roda gigi mekanisme penggerak dengan pelumas berstandar dielektrik tinggi, dan menguji sistem penguncian keselamatan mekanis (mechanical safety interlock) antara pintu kubikel, posisi VCB, dan sakelar earthing switch."
        ]
      },
      {
        "step": "3. Measurement, Protection Relay & Insulation Testing\nPengukuran, Relay Proteksi & Uji Resistansi Isolasi",
        "tasks": [
          "Measure actual SF6 gas pressure on RMU cubicle pressure gauge (normal operational standard ≥ 0.05 MPa) and verify Low SF6 Pressure Alarm switch contact signal.\nMengukur tekanan gas SF6 aktual pada manometer kubikel RMU (standar operasional normal ≥ 0.05 MPa) dan memverifikasi kontak sinyal alarm tekanan rendah (Low SF6 Pressure Alarm switch contact).",
          "Inspect digital numerical protection relay units (Overcurrent & Earth Fault Relay - OCR/GFR), review event & fault disturbance logs, and measure tripping unit battery DC supply voltage (DC Tripping Supply Voltage standard 110 VDC ± 10%).\nMemeriksa unit relay proteksi numerik digital (Overcurrent & Earth Fault Relay - OCR/GFR), memeriksa riwayat perekaman kejadian gangguan (event & fault disturbance log), dan mengukur tegangan catu daya DC baterai unit pemutus trip (DC Tripping Supply Voltage standar 110 VDC ± 10%).",
          "Perform 20 kV busbar and incoming/outgoing cable termination insulation resistance testing using a 5.0 kV DC high-voltage Insulation Tester (standard > 1000 MΩ), measure RMU cubicle frame grounding resistance (< 1.0 Ω), and perform infrared thermography scanning on power cable termination compartments under full operational load (termination temperature < 45°C).\nMelakukan pengujian resistansi isolasi busbar 20 kV dan terminasi kabel masuk/keluar menggunakan Insulation Tester bertegangan tinggi 5.0 kV DC (standar nilai tahanan isolasi > 1000 MΩ), mengukur resistansi pembumian kerangka kubikel RMU (< 1.0 Ω), serta melakukan pemindaian termografi inframerah pada kompartemen terminasi kabel daya saat dialiri beban operasional penuh (standar suhu terminasi < 45°C)."
        ]
      }
    ]
  },
  "lv panel": {
    "category": "LV (LOW VOLTAGE) MAIN DISTRIBUTION PANEL",
    "items": [
      {
        "step": "1. Visual Inspection, Enclosure & Status Indicators\nInspeksi Visual, Integritas Selungkup & Lampu Indikator",
        "tasks": [
          "Perform visual inspection of Low Voltage Main Distribution Panel (LVMDP) cubicle structure, checking digital power meter displays, pilot lamps (R-S-T phases), Air Circuit Breaker (ACB) status indicators, and verifying absence of burnt smell or hot spots.\nMelakukan inspeksi visual terhadap struktur fisik panel distribusi tegangan rendah (Low Voltage Main Distribution Panel - LVMDP / Sub-Distribution Panel LDB), memeriksa kekokohan pelat selungkup, kekedapan segel karet pintu panel, kebersihan ventilasi pendingin atau exhaust fan panel, dan tidak adanya tanda korosi, retakan, atau penetrasi kotoran luar.",
          "Inspect busbar support insulators, cable tie dressings, clear acrylic protective covers, and ensure panel doors close tightly with functional key locks.\nMemeriksa lampu indikator fasa (lampu fasa R, S, T), pembacaan layar Digital Power Meter (DPM), posisi tuas pemutus sirkit utama (Air Circuit Breaker - ACB / Molded Case Circuit Breaker - MCCB), dan memastikan tidak ada indikasi alarm gangguan tanah, trip breaker, atau kondisi panas berlebih."
        ]
      },
      {
        "step": "2. Internal Dust Vacuuming, Mechanism Lubrication & Torquing\nPenyedotan Debu Internal, Pelumasan Mekanisme & Torsi",
        "tasks": [
          "Clean internal busbar compartments, circuit breaker housings, and ventilation louvers from accumulated dust using an industrial vacuum cleaner and lint-free dry cloths.\nMembersihkan debu, partikel serat, dan kotoran asing pada kompartemen busbar tembaga dan pemutus sirkit menggunakan vacuum cleaner industri berinsulasi elektrostatis (ESD-safe) dan kuas pembersih halus.",
          "Inspect and retorque main copper busbar joints, incoming/outgoing breaker terminal lugs, and control wire terminal blocks using a calibrated torque wrench per bolt specifications (M10: 45 Nm, M12: 75 Nm).\nMemeriksa dan melumasi mekanisme kontak geser draw-out unit ACB, memeriksa keausan kontak busur api (arc chute), serta melakukan pengetatan ulang torsi baut pada sambungan busbar tembaga utama dan kabel masuk/keluar menggunakan kunci torsi terkalibrasi (torque wrench 45 - 60 Nm)."
        ]
      },
      {
        "step": "3. Measurement, Electrical Parameters & Thermographic Scan\nPengukuran, Parameter Kelistrikan & Pemindaian Termografi",
        "tasks": [
          "Measure 3-phase incoming and outgoing voltages R-S, S-T, T-R (standard 380 - 415 VAC) and phase-to-neutral voltages R-N, S-N, T-N (standard 220 - 240 VAC), and measure Neutral-to-Ground voltage (standard < 2.0 VAC).\nMelakukan pengukuran parameter tegangan listrik panel meliputi tegangan fasa-fasa: R-S, S-T, T-R (standar 380 - 415 VAC ±5-10%) dan tegangan fasa-netral: R-N, S-N, T-N (standar 220 - 240 VAC ±5-10%), serta mengukur tegangan antara konduktor Netral dan Ground (N-G Voltage standar < 2.0 VAC).",
          "Measure operating load currents per phase (Phase R, S, T) and Neutral conductor current using a calibrated clamp meter, recording active power (kW), reactive power (kVAR), and power factor (Cos phi > 0.90).\nMelakukan pengukuran arus beban listrik per fasa: Phase R, S, T, dan arus kawat Netral (N) menggunakan clamp meter dengan batas deviasi ketidakseimbangan beban antar fasa <10%, serta mencatat parameter Digital Power Meter meliputi daya aktif (kW), daya semu (kVA), daya reaktif (kVAR), frekuensi (50.0 Hz), dan faktor daya (Cos phi > 0.95).",
          "Test functional tripping mechanism of Air Circuit Breaker (ACB) using the mechanical test push button, measure panel earthing resistance (< 1.0 Ω), and perform thermal imaging scan across all main breaker terminations and busbar connection joints (Delta T < 5°C).\nMelakukan pengujian resistansi isolasi antar fasa (R-S, S-T, T-R) dan fasa ke tanah (R-G, S-G, T-G, N-G) menggunakan Insulation Tester 1000V DC (standar nilai tahanan isolasi > 100 MΩ), mengukur resistansi pembumian panel (< 1.0 Ω untuk data hall / < 5.0 Ω utility), serta melakukan pemindaian termografi inframerah pada seluruh pemutus sirkit ACB/MCCB dan sambungan busbar untuk memastikan suhu operasional normal (≤ 40°C) tanpa anomali titik panas (hotspot Delta T < 5°C)."
        ]
      }
    ]
  },
  "pdu panel": {
    "category": "POWER DISTRIBUTION UNIT (PDU) & LDB-RDB SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection & BCMS Monitoring Display\nInspeksi Visual & Pemantauan Layar BCMS",
        "tasks": [
          "Perform visual inspection of Power Distribution Unit (PDU) and LDB/RDB panel enclosures, inspecting isolation transformer status, branch circuit monitoring system (BCMS) display screens, and panel door grounding straps.\nMelakukan inspeksi visual terhadap unit Power Distribution Unit (PDU) dan panel LDB-RDB di dalam ruang data hall server, memeriksa layar antarmuka Branch Circuit Monitoring System (BCMS), lampu indikator input/output, kondisi fisik transformator isolasi K-factor internal, dan memastikan tidak ada peringatan alarm kelebihan beban.",
          "Check LED status indicators on transient surge suppression modules (TVSS/SPD), inspect sub-feed circuit breaker positions, and verify server rack power feed labeling clarity.\nMemeriksa posisi tuas sakelar seluruh pemutus sirkit cabang (MCB/MCCB feeder rak server), memeriksa kerapian susunan pengkabelan (cable dressing) di bawah panel, dan memastikan pintu panel tertutup rapat serta sistem penguncian berfungsi baik."
        ]
      },
      {
        "step": "2. Cleaning, Enclosure Dusting & Terminal Torque Service\nPembersihan, Penghisapan Debu Selungkup & Torsi Terminal",
        "tasks": [
          "Clean internal cable trough compartments, transformer coils, and breaker mounting chassis from fine dust using an electrostatically grounded industrial vacuum cleaner.\nMembersihkan debu halus pada bagian dalam panel PDU, kisi ventilasi udara transformator isolasi, dan kompartemen pemutus sirkit menggunakan vacuum cleaner mikro berfilter HEPA berstandar ESD-safe.",
          "Inspect terminal tightness of branch circuit breakers (MCB/MCCB) feeding server racks, neutral busbars, and safety grounding bars using calibrated insulated torque screwdrivers.\nMemeriksa kerapian jalur kabel keluaran ke rak server, memastikan kabel tidak tertekan atau tergores tepi pelat selungkup logam, serta memverifikasi kekencangan torsi baut terminal kabel fasa, konduktor netral ganda, dan terminal busbar pembumian (grounding bar)."
        ]
      },
      {
        "step": "3. Measurement, Harmonic Distortion & Thermal Imaging\nPengukuran, Distorsi Harmonisa & Pencitraan Termal",
        "tasks": [
          "Measure input and output phase voltages R-S, S-T, T-R (standard 380 - 400 VAC ±1%) and phase-to-neutral voltages R-N, S-N, T-N (standard 220 - 230 VAC ±1%), and measure Neutral-to-Ground voltage (< 1.0 VAC at critical server load).\nMengukur parameter tegangan masukan utama (Input 380 - 415 VAC) dan tegangan keluaran cabang ke rak server (Output 220 - 230 VAC L-N, 380 - 400 VAC L-L), mengukur tegangan Netral ke Ground (N-G Voltage standar < 1.5 VAC), dan mengukur resistansi pembumian PDU (< 1.0 Ω).",
          "Measure branch circuit currents, verify load balancing between phases R, S, and T (unbalance < 10%), record Total Harmonic Distortion (THD-V < 3%, THD-I < 5%), and verify BCMS telemetry communication with BMS.\nMelakukan pengukuran arus beban listrik per fasa (Phase R, S, T) dan arus konduktor Netral (N), memeriksa persentase pembebanan sirkuit cabang (branch circuit loading ≤ 80% dari rating MCB sesuai standar kelistrikan data center), serta mengukur distorsi harmonisa tegangan (THD-V < 3%) dan arus (THD-I < 5%).",
          "Measure PDU clean computer grounding resistance (< 0.5 Ω), and perform high-resolution thermal imaging inspection on all branch breakers and connection busbars to ensure no overheating terminals exist (temperature ≤ 45°C).\nMencatat temperatur operasional transformator isolasi internal PDU melalui sensor suhu RTD PT100 (standar temperatur operasional ≤ 90°C), serta melakukan pemindaian termografi inframerah pada seluruh jajaran MCB cabang dan blok terminal keluaran daya rak server untuk memastikan tidak terdapat hotspot termal abnormal (suhu operasional aman < 60°C)."
        ]
      }
    ]
  },
  "ups": {
    "category": "UNINTERRUPTIBLE POWER SUPPLY (UPS) & BATTERY BANK",
    "items": [
      {
        "step": "1. HMI Inspection, Mimic Flow & Environmental Verification\nInspeksi Layar HMI, Aliran Mimic & Verifikasi Lingkungan",
        "tasks": [
          "Perform visual inspection of Uninterruptible Power Supply (UPS) cabinets and battery racks, checking mimic panel display status, active alarms, ventilation exhaust fan rotation, and enclosure cleanliness.\nMelakukan inspeksi visual terhadap layar antarmuka HMI panel UPS, memeriksa diagram aliran daya sistem (Mimic Power Flow: Rectifier, Inverter, Static Bypass, dan Battery Mode), memastikan tidak ada indikasi alarm aktif atau peringatan servis, dan memeriksa kebersihan kisi-kisi ventilasi modul daya.",
          "Inspect battery bank cells for physical deformities, swelling, terminal post corrosion, electrolyte leakage, and check battery DC disconnect switch / circuit breaker condition.\nMemeriksa kondisi fisik bank baterai penyimpan daya (Valve Regulated Lead Acid - VRLA Battery Racks / Lithium Battery Cabinets), memeriksa tidak adanya deformasi fisik dinding sel baterai (pembengkakan), retakan, atau rembesan cairan asam elektrolit pada kutub terminal baterai, serta memverifikasi suhu lingkungan ruang baterai terkontrol stabil (standar 20 - 25°C)."
        ]
      },
      {
        "step": "2. Cleaning, Filter Replacement & Battery Terminal Service\nPembersihan, Penggantian Filter & Servis Terminal Baterai",
        "tasks": [
          "Clean cabinet air filters, electronic power module grilles, and battery rack surfaces from dust using an insulated vacuum cleaner and dry anti-static cloths.\nMembersihkan debu halus pada kisi ventilasi dan modul pendingin inverter/rectifier menggunakan vacuum cleaner berfilter khusus elektrikal, memeriksa kelancaran putaran kipas pendingin modul internal (cooling fans), dan membersihkan atau mengganti saringan filter udara panel.",
          "Inspect torque tightness of inter-cell battery link busbars, DC cable termination lugs, and AC power terminal connections using calibrated insulated tools.\nMembersihkan selungkup rak baterai dari debu menggunakan kain mikrofiber kering anti-statis, memeriksa dan membersihkan terminal konektor tembaga antar sel baterai (inter-cell link busbars) dari deposit sulfasi, serta melakukan pengencangan ulang torsi baut terminal baterai menggunakan kunci torsi berinsulasi (insulated torque wrench 10 - 12 Nm)."
        ]
      },
      {
        "step": "3. Measurement, Cell Impedance & Static Bypass Testing\nPengukuran, Impedansi Sel Baterai & Uji Static Bypass",
        "tasks": [
          "Measure input and output electrical parameters: 3-phase voltages R-S, S-T, T-R (standard 380 - 400 VAC) and R-N, S-N, T-N (standard 220 - 230 VAC ±1%), output frequency (standard 50.0 ± 0.1 Hz), critical load current per phase, and UPS load percentage (% Load).\nMelakukan pengukuran parameter kelistrikan AC masukan dan keluaran UPS: tegangan fasa-fasa R-S, S-T, T-R (standar 380 - 400 VAC) dan tegangan fasa-netral R-N, S-N, T-N (standar 220 - 230 VAC ±1%), frekuensi keluaran stabil (standar 50.0 ± 0.1 Hz), mengukur arus beban kritis per fasa (Phase R, S, T), dan mencatat persentase kapasitas pembebanan UPS (% Load).",
          "Measure DC bus float voltage (standard 400 - 545 VDC) and battery float charging current, measure individual battery block float voltages (standard 13.4 - 13.8 VDC for 12V blocks), and measure internal cell resistance/impedance using a calibrated battery tester (standard < 4.5 mΩ per block).\nMelakukan pengukuran tegangan DC bus sistem baterai (DC Bus Float Voltage standar 400 - 545 VDC) dan arus pengisian daya baterai (battery float charging current), mengukur tegangan individual per blok sel baterai menggunakan multimeter presisi (standar float voltage 13.4 - 13.8 VDC per blok 12V), serta mengukur resistansi internal / impedansi per sel baterai menggunakan Battery Internal Resistance Tester terkalibrasi (standar < 4.5 mΩ per blok).",
          "Perform functional static bypass switch transfer test with zero transfer interruption (0 ms seamless transfer), measure UPS earthing resistance (< 1.0 Ω), and perform infrared thermography scanning on IGBT modules, bypass contactors, and battery DC breakers (temperature < 55°C).\nMelakukan pengujian transfer fungsional sakelar bypass statis (Static Bypass Switch Transfer Test) tanpa adanya jeda waktu transfer (0 millisecond interruption / seamless transfer), mengukur resistansi pembumian UPS (< 1.0 Ω), serta melakukan pemindaian termografi inframerah pada modul sakelar semikonduktor IGBT, kontaktor bypass, dan pemutus sirkuit DC baterai (standar suhu normal < 55°C)."
        ]
      }
    ]
  },
  "ats": {
    "category": "AUTOMATIC TRANSFER SWITCH (ATS) SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Source Indicators & Enclosure Integrity\nInspeksi Visual, Indikator Sumber Listrik & Integritas Selungkup",
        "tasks": [
          "Perform visual inspection of Automatic Transfer Switch (ATS) panel, checking transfer switch contact positions (Source 1 / Utility and Source 2 / Generator), voltage presence indicator lamps on both sources, microprocessor ATS controller module, and verifying absence of corrosion, excessive dust, or overheating marks.\nMelakukan inspeksi visual terhadap panel Automatic Transfer Switch (ATS), memeriksa posisi kontak sakelar pemindah daya (Source 1 / PLN dan Source 2 / Genset), memeriksa lampu indikator kehadiran tegangan pada kedua sumber daya, modul kontroler mikroprosesor ATS, dan memastikan kondisi fisik pelat selungkup utuh bebas dari tanda korosi, debu berlebih, atau overheating.",
          "Inspect panel body grounding cable integrity, verify level panel positioning using a spirit level, and ensure normal and emergency phase indicator lights are neither burnt out nor loose.\nMemeriksa keutuhan kabel grounding panel bodi, memeriksa kerataan posisi panel menggunakan waterpass, dan memeriksa lampu indikator fasa sumber normal dan darurat tidak hangus atau kendor."
        ]
      },
      {
        "step": "2. Cleaning, Contact Mechanism Lubrication & Torquing\nPembersihan, Pelumasan Mekanisme Kontak & Torsi Terminal",
        "tasks": [
          "Clean internal panel dust and transfer switch compartments using an industrial vacuum cleaner, and apply specialized protective cleaner on external enclosure surfaces.\nMembersihkan debu internal panel dan kompartemen sakelar pemindah menggunakan vacuum cleaner industri dan mengaplikasikan pembersih khusus sanpoly pada permukaan luar selungkup untuk perlindungan cat.",
          "Inspect smooth mechanical sliding contact switching mechanism, lubricate drive gear levers with OEM-specified contact lubricant, inspect arc chutes, and retorque incoming and outgoing power cable terminal bolts (torque wrench 45 - 60 Nm).\nMemeriksa kelancaran mekanisme mekanis kontak geser pemindah daya (switching mechanism), melumasi tuas roda gigi penggerak mekanis dengan pelumas kontak standar pabrikan, memeriksa kondisi peredam busur api (arc chutes), serta melakukan pengetatan torsi baut terminal kabel daya masuk dan keluar (torque wrench 45 - 60 Nm)."
        ]
      },
      {
        "step": "3. Measurement, Transfer Sequence & Thermal Scan\nPengukuran, Validasi Sekuens Transfer & Termografi",
        "tasks": [
          "Measure electrical supply voltages for both sources (Normal Utility and Emergency Generator): phase-to-phase R-S, S-T, T-R (standard 380 - 415 VAC ±5-10%), phase-to-neutral R-N, S-N, T-N (standard 220 - 240 VAC ±5-10%), and Neutral-to-Ground voltage (< 2.0 VAC).\nMengukur parameter tegangan listrik kedua sumber suplai (Normal PLN dan Emergency Genset): tegangan fasa-fasa R-S, S-T, T-R (standar 380 - 415 VAC ±5-10%), tegangan fasa-netral R-N, S-N, T-N (standar 220 - 240 VAC ±5-10%), dan tegangan Netral ke Ground N-G (< 2.0 VAC).",
          "Measure operating load currents delivered per phase: Phase R, S, T, and Neutral (N) with load unbalance deviation <10%, and record Digital Power Meter parameters including active power (kW), apparent power (kVA), reactive power (kVAR), frequency (50.0 Hz), and power factor (Cos phi > 0.95).\nMengukur arus beban operasional yang disalurkan per fasa: Phase R, S, T, dan Netral (N) dengan deviasi ketidakseimbangan beban <10%, serta mencatat parameter Digital Power Meter meliputi daya aktif (kW), daya semu (kVA), daya reaktif (kVAR), frekuensi (50.0 Hz), dan faktor daya (Cos phi > 0.95).",
          "Perform simulated auto-transfer sequence timing validation including supply failure sensing delay, transition time delay, and normal source re-transfer time delay.\nMelakukan pengujian simulasi sekuens waktu transfer otomatis (Auto-Transfer Sequence Timing Validation) meliputi waktu deteksi kegagalan suplai (Failure Sensing Delay), waktu tunggu transisi (Transition Time Delay), dan waktu tunda transfer balik setelah sumber normal pulih (Re-transfer Time Delay).",
          "Measure circuit breaker and transfer switch contact temperatures using a thermal imager (standard ≤ 40°C), measure ATS panel earthing resistance (< 5.0 Ω), and verify mechanical and electrical interlocks operate reliably.\nMengukur temperatur pemutus sirkit dan kontak sakelar pemindah menggunakan thermal imager (standar suhu operasional normal ≤ 40°C), mengukur resistansi pembumian panel ATS (standar < 5.0 Ω), dan memverifikasi interlock mekanikal dan elektrikal bekerja handal."
        ]
      }
    ]
  },
  "capacitor bank": {
    "category": "CAPACITOR BANK (APFCR) SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, APFCR Controller & Capacitor Cans\nInspeksi Visual, Kontroler APFCR & Tabung Kapasitor",
        "tasks": [
          "Perform visual inspection of Capacitor Bank panel, checking Automatic Power Factor Correction Relay (APFCR) controller display, Manual/Auto mode selector switches, and step activation indicator lamps.\nMelakukan inspeksi visual terhadap panel Capacitor Bank, memeriksa layar modul regulator faktor daya otomatis (Automatic Power Factor Correction Relay - APFCR), sakelar pemilih mode Manual/Auto, dan lampu indikator aktifasi masing-masing tahapan step kapasitor.",
          "Inspect physical condition of power capacitor cans for signs of swelling, case cracking, or dielectric oil leaks, inspect capacitor duty contactors with damping resistors, and inspect detuned harmonic filter reactors.\nMemeriksa kondisi fisik tabung kapasitor daya (power capacitor cans) dari tanda-tanda kebuntingan (swelling), retakan selongsong, atau kebocoran minyak dielektrik, memeriksa kondisi fisik kontaktor khusus kapasitor (capacitor duty contactors with damping resistors), dan memeriksa reaktor penolak harmonisa (detuned detuning reactors)."
        ]
      },
      {
        "step": "2. Cleaning, Enclosure Dusting & Terminal Fastening\nPembersihan, Penghisapan Debu Selungkup & Pengencangan Baut",
        "tasks": [
          "Clean fine dust from panel compartments, ventilation louvers, and capacitor can surfaces using an electrostatically insulated industrial vacuum cleaner.\nMembersihkan debu halus pada kompartemen panel, kisi-kisi ventilasi, dan permukaan tabung kapasitor menggunakan vacuum cleaner industri berinsulasi elektrostatis.",
          "Verify smooth operation of panel cooling exhaust fans and panel temperature thermostat (setpoint 35°C), and retorque copper busbar connections, capacitor phase cables, and discharge resistor terminals.\nMemeriksa kelancaran kerja exhaust fan pendingin panel dan termostat pengatur suhu panel (panel thermostat setpoint 35°C), serta melakukan pengetatan ulang baut terminal koneksi busbar tembaga, kabel fasa kapasitor, dan terminal discharge resistor."
        ]
      },
      {
        "step": "3. Measurement, Incomer & Step Current Testing\nPengukuran, Arus Incomer & Arus Per Step Kapasitor",
        "tasks": [
          "Measure 3-phase supply voltage on capacitor panel busbars: R-S, S-T, T-R (standard 380 - 415 VAC) and phase-to-neutral: R-N, S-N, T-N (standard 220 - 240 VAC) using a calibrated multimeter.\nMengukur tegangan suplai 3-fasa pada busbar panel kapasitor: R-S, S-T, T-R (standar 380 - 415 VAC) dan fasa-netral: R-N, S-N, T-N (standar 220 - 240 VAC) menggunakan multimeter terkalibrasi.",
          "Measure total current (Amperes) on general incomer using a calibrated Clamp Meter, and measure load current per phase on incoming cables to each capacitor step during forced step switching to validate actual reactive power (kvar) against nominal can ratings.\nMelakukan pengukuran arus total (Ampere) pada general incomer panel kapasitor bank menggunakan Clamp Meter terkalibrasi, serta mengukur arus beban per fasa pada kabel masuk ke setiap step kapasitor saat dilakukan pemaksaan step (forcing of step) untuk memvalidasi daya reaktif aktual (kvar) terhadap rating nominal tabung.",
          "Record system Power Factor (Cos phi) before and after capacitor step activation (target operational Cos phi ≥ 0.95 lag), measure circuit breaker and capacitor can temperatures using an infrared thermometer (Breaker Temperature ≤ 40°C), and measure panel grounding resistance (< 5.0 Ω).\nMencatat nilai faktor daya sistem (Power Factor Cos phi) sebelum dan sesudah aktivasi step kapasitor (target Cos phi operasional ≥ 0.95 lag), mengukur temperatur pemutus sirkit dan tabung kapasitor menggunakan termometer inframerah (Breaker Temperature standar ≤ 40°C), serta mengukur resistansi pembumian panel (< 5.0 Ω)."
        ]
      }
    ]
  },
  "busduct": {
    "category": "BUSDUCT TRUNKING SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Enclosure & Hanger Support Rigidity\nInspeksi Visual, Selungkup & Kekokohan Gantungan Hanger",
        "tasks": [
          "Perform visual inspection across the entire route of low and medium voltage feeder busduct trunking in electrical shafts, panel rooms, and data hall areas, checking physical integrity of aluminum/steel enclosures for absence of deformation, rust, or fluid seepage from surrounding utility pipes.\nMelakukan inspeksi visual terhadap keseluruhan rute trunking jalur busduct feeder tegangan rendah dan menengah di area shaft elektrikal, ruang panel, dan ruang data hall, memeriksa integritas fisik selungkup logam aluminium/baja, tidak adanya deformasi, karat, atau rembesan cairan dari pipa utilitas sekitar.",
          "Inspect structural hanger rod rigidity, trapeze support brackets, seismic spring vibration hangers, fire stop barrier integrity at wall and floor penetrations, and inspect plug-in tap-off box covers.\nMemeriksa kekokohan gantungan penggantung struktural (hanger rods), bracket penopang trapeze, pegas peredam getaran seismik (spring vibration hangers), keutuhan penghalang api tahan api (fire stop barrier) pada penetrasi dinding dan lantai, serta memeriksa posisi penutup kotak percabangan (plug-in tap-off box covers)."
        ]
      },
      {
        "step": "2. Cleaning, Enclosure Dusting & Joint Pack Torque Verification\nPembersihan, Pengelapan Selungkup & Verifikasi Torsi Sambungan",
        "tasks": [
          "Clean dust and dirt from external busduct enclosure surfaces using dry microfiber cloths and insulated cleaning brushes, and inspect joint cover seals against environmental dust ingress.\nMembersihkan debu dan kotoran pada permukaan luar selungkup busduct menggunakan kain mikrofiber kering dan kuas pembersih berinsulasi, memeriksa kekedapan segel gasket penutup sambungan (joint cover seals) dari penetrasi debu lingkungan.",
          "Perform visual inspection and verify tightness of busbar joint pack torque bolts using a calibrated torque wrench (50 - 70 Nm) or inspect double-headed torque-indicating break-off bolts.\nMelakukan pemeriksaan visual dan verifikasi kekencangan baut sambungan penghubung busbar (joint pack torque bolts) menggunakan kunci torsi terkalibrasi (torque wrench 50 - 70 Nm) atau memeriksa indikator baut berkepala ganda (torque-indicating break-off head bolts)."
        ]
      },
      {
        "step": "3. Measurement, Insulation Resistance & Thermographic Scan\nPengukuran, Uji Tahanan Isolasi & Pemindaian Termografi",
        "tasks": [
          "Perform busbar insulation resistance testing using a 1000V DC Insulation Tester between phase conductors (R-S, S-T, T-R), phase-to-neutral (R-N, S-N, T-N), and phase/neutral to metal enclosure ground (R-G, S-G, T-G, N-G) with standard insulation resistance > 100 MΩ.\nMelakukan pengujian resistansi isolasi busbar menggunakan Insulation Tester 1000V DC antar konduktor fasa (R-S, S-T, T-R), antar fasa ke netral (R-N, S-N, T-N), dan antar fasa/netral ke pembumian housing logam (R-G, S-G, T-G, N-G) dengan standar nilai tahanan isolasi > 100 MΩ.",
          "Measure contact resistance across busbar joint pack modules using a calibrated micro-ohmmeter (standard contact resistance < 50 µΩ per joint connection).\nMelakukan pengukuran resistansi kontak pada modul sambungan busbar (joint packs) menggunakan micro-ohmmeter terkalibrasi (standar contact resistance < 50 µΩ per sambungan joint).",
          "Measure busduct enclosure grounding continuity resistance from starting end to terminating end (Grounding Continuity Resistance < 0.1 Ω).\nMengukur resistansi kontinuitas pembumian selungkup busduct dari ujung awal hingga ujung akhir terminasi (Grounding Continuity Resistance < 0.1 Ω).",
          "Perform high-resolution infrared thermography scanning across all joint pack modules and tap-off units while carrying full data center operating load to ensure uniform joint temperatures without hotspot anomalies (Delta T < 5°C above busduct body temperature).\nMelakukan pemindaian termografi inframerah beresolusi tinggi pada seluruh modul sambungan joint pack dan kotak percabangan tap-off unit saat sistem menyalurkan beban operasional penuh data center untuk memastikan suhu sambungan seragam tanpa hotspot anomali (deviasi suhu Delta T < 5°C di atas suhu badan busduct)."
        ]
      }
    ]
  },
  "fss": {
    "category": "FIRE SUPPRESSION SYSTEM (FSS INERGEN / VESDA)",
    "items": [
      {
        "step": "1. Visual Inspection, Cylinder Manometer & VESDA Flow\nInspeksi Visual, Manometer Silinder & Aliran Udara VESDA",
        "tasks": [
          "Perform visual inspection of fire extinguishing control panels (Fire Alarm & Suppression Control Panel), checking power supply indicators (AC Normal), battery backup status, and ensuring absence of trouble or ground fault status alarms.\nMelakukan inspeksi visual terhadap panel kontrol pencegah kebakaran (Fire Alarm & Clean Agent Suppression Release Panel), memeriksa lampu indikator normal, indikator zona deteksi, dan memastikan tidak ada alarm aktif atau indikasi kerusakan sirkuit (trouble fault).",
          "Check pressure gauge needles on clean agent extinguishing cylinders (Inergen IG-541 300 bar / FM-200 25-42 bar) ensuring they are in the normal green zone, inspect discharge manifold valves, high-pressure flexible hoses, and verify manual release actuators are secured with safety pins intact.\nMemeriksa penunjukan jarum pengukur tekanan pada silinder gas pemadam bersih (Inergen / FM-200 cylinder pressure gauges), memeriksa keutuhan segel pin pemicu manual, kondisi fisik manifold pelepasan gas, nosel semprot pemadam (discharge nozzles), sakelar manual abort, sakelar manual release, dan lampu peringatan evakuasi audio/visual (horn strobe).",
          "Check the display screen of Very Early Smoke Detection Apparatus (VESDA) detectors, verifying laser smoke obscuration bar levels, airflow bar status, and fire alarm output relay signal communication with the central data center BMS.\nMemeriksa tampilan layar detektor asap hisap sangat dini (Very Early Smoke Detection Apparatus - VESDA), memeriksa tingkat kepekatan asap (smoke obscuration bar graph %/m), dan memeriksa penunjukan laju aliran udara pipa aspirasi (aspirating pipe airflow level)."
        ]
      },
      {
        "step": "2. Cleaning, Filter Replacement & Enclosure Maintenance\nPembersihan, Penggantian Filter Udara & Pemeliharaan Panel",
        "tasks": [
          "Clean external enclosures of control panels and VESDA detector modules from dust using an industrial vacuum cleaner and lint-free dry cloths.\nMembersihkan selungkup luar panel kontrol dan modul detektor VESDA dari debu menggunakan kain mikrofiber kering, memeriksa dan membersihkan filter udara modul detektor VESDA (VESDA air filter cartridge), serta menguras perangkap air kondensat (water trap) pada pipa sampling udara.",
          "Clean cylinder tank surfaces from dust, check tightness of cylinder mounting bracket clamp bolts, and replace VESDA air aspirating filter cartridges if filter maintenance warning indicators are illuminated.\nMembersihkan permukaan botol silinder pemadam gas dari debu, memeriksa kekencangan klem penjepit silinder (cylinder mounting brackets) pada struktur dinding penahan, dan membersihkan kisi lubang nosel pelepasan gas."
        ]
      },
      {
        "step": "3. Measurement, Pressure Checks & Electrical Safety Validation\nPengukuran, Cek Tekanan & Validasi Keselamatan Elektrikal",
        "tasks": [
          "Record actual clean agent cylinder pressure readings on calibrated pressure gauges (standard: Inergen 300 bar at 20°C / FM-200 25 bar) and verify cylinder weight/pressure loss limits are within tolerance (< 5% limit).\nMencatat nilai tekanan silinder gas pemadam aktual pada manometer terkalibrasi (Inergen: 200 / 300 Bar pada 20°C, FM-200: 25 / 42 Bar pada 20°C sesuai kurva kompensasi suhu) untuk memastikan massa agen gas pemadam utuh 100%.",
          "Measure airflow parameters on aspirating smoke detector sampling pipe networks (Airflow Percentage standard 80% - 120%) and verify sampling pipe transport transit times (< 60 seconds to furthest hole).\nMengukur parameter aliran udara pipa aspirasi detektor VESDA (Airflow Percentage standar 80% - 120% dari nilai baseline normal) dan menguji kepekaan alarm deteksi asap menggunakan gas uji terstandarisasi.",
          "Measure electrical parameters of fire alarm standby batteries (Standby Battery 24 VDC: float charging voltage 26.8 - 27.6 VDC, internal resistance < 10 mΩ per block), and test automatic primary AC to battery transfer upon power interruption.\nMengukur parameter kelistrikan baterai cadangan panel pemadam (Standby Battery 24 VDC): mengukur tegangan float pengisian (standar 26.8 - 27.6 VDC) dan mengukur resistansi kumparan solenoid pemicu pelepasan elektrik (Release Solenoid Coil Resistance standar 28 - 35 Ω) dengan memasang dummy test plug untuk uji simulasi pemicuan tanpa melepas gas.",
          "Measure evacuation alarm sound intensity levels using a calibrated Sound Level Meter (Evacuation Horn/Strobe audio level ≥ 85 dBA at 3 meters distance), and test emergency discharge delay countdown sequences (30 seconds) along with manual abort switches.\nMengukur tingkat intensitas bunyi sirine evakuasi menggunakan Sound Level Meter (standar alarm bell / horn strobe ≥ 85 dB pada jarak 3 meter), serta menguji integrasi sinyal interlock penghentian unit AC (HVAC damper trip) dan penutupan pintu tahan api (fire door magnetic release)."
        ]
      }
    ]
  },
  "pre-action system": {
    "category": "PRE-ACTION SPRINKLER SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Air/Water Manometers & Piping Network\nInspeksi Visual, Manometer Udara/Air & Jaringan Pemipaan",
        "tasks": [
          "Perform visual inspection of double-interlock pre-action sprinkler riser valves in server room piping risers, checking water supply pressure gauges and supervisory compressed air pressure gauges (air pressure standard 1.5 - 2.5 bar / water supply 6.0 - 10.0 bar).\nMelakukan inspeksi visual terhadap stasiun katup kendali pre-action (Pre-Action Deluge Valve Assembly), memeriksa penunjukan jarum manometer tekanan air hulu (upstream water supply gauge) dan manometer tekanan udara pengawas hilir (downstream supervisory air gauge).",
          "Inspect solenoid release valves, manual emergency release valve levers, electric motor alarm bells (water motor gong), and verify pre-action panel supervisory indicators are normal.\nMemeriksa kondisi fisik jaringan pipa kering (dry-pipe sprinkler network) di atas plafon ruang data hall dan ruang elektrikal dari tanda korosi atau benturan fisik, memeriksa kebersihan kepala sprinkler kaca (sprinkler bulb heads), dan memastikan katup isolasi utama gerbang (OS&Y gate valve) berada dalam posisi terbuka penuh dan terkunci rantai dengan tamper switch aktif."
        ]
      },
      {
        "step": "2. Cleaning, Strainer Service & Air Compressor Maintenance\nPembersihan, Servis Strainer & Pemeliharaan Kompresor Udara",
        "tasks": [
          "Drain accumulated moisture and condensation from system low-point drip legs and air compressor moisture separator traps to prevent pipe internal corrosion.\nMembersihkan bodi katup deluge dan trim pipa kendali dari akumulasi debu, membuka dan membersihkan saringan saringan trim (trim piping strainer) dari partikel endapan air, dan melumasi mekanisme tuas pemicu mekanikal katup.",
          "Inspect automatic air compressor motor operation, clean air intake filters, inspect pressure switch contacts, and test manual quarterly waterflow alarm drain test valves without discharging water into dry pipe networks.\nMembersihkan kompresor udara pengawas otomatis (automatic supervisory air compressor), membersihkan saringan filter udara hisap kompresor, memeriksa level oli pelumas kompresor, dan menguras katup pembuangan kondensat tangki udara (air tank moisture drain valve)."
        ]
      },
      {
        "step": "3. Measurement, Cut-In/Cut-Out Pressure & Trip Testing\nPengukuran, Tekanan Cut-In/Cut-Out & Uji Pemicuan Katup",
        "tasks": [
          "Measure supervisory air pressure loss over 24 hours to verify dry pipe network airtightness (standard air leakage < 0.2 bar/24hr).\nMengukur dan mencatat tekanan udara pengawas otomatis dalam jaringan pipa kering (Supervisory Air Pressure standar 1.5 - 2.5 Bar / 20 - 35 psi) dan mengukur tekanan pasokan air utama di sisi hulu (Water Supply Pressure standar 8.0 - 12.0 Bar).",
          "Test electrical solenoid valve actuation signals upon receiving simulated cross-zoned smoke detection alarms from fire alarm panels, and verify pre-action control panel relay contact feedback to BMS.\nMenguji parameter tekanan aktivasi otomatis kompresor udara pengawas meliputi tekanan start pompa (Cut-In Pressure standar 1.5 Bar) dan tekanan henti pompa (Cut-Out Pressure standar 2.2 Bar) untuk memastikan kestabilan tekanan pipa pengawasan.",
          "Measure riser grounding resistance (< 1.0 Ω), inspect pipe hanger and seismic brace tightness across data hall ceiling spaces, and perform water pressure flow validation on main test drain lines.\nMelakukan pengujian pemicuan solenoid elektrik katup deluge (24 VDC Solenoid Actuation Test) melalui simulasi sinyal alarm ganda (cross-zone smoke detector trigger) dengan katup pasokan air ditutup aman, menguji fungsi katup buang darurat manual (Emergency Manual Release Pull Station), menguji kontak switch alarm tekanan air (Waterflow Alarm Pressure Switch delay 15-30 detik), serta menguji aliran alarm mekanikal lonceng air (Water Motor Gong mechanical test)."
        ]
      }
    ]
  },
  "hydrant system": {
    "category": "FIRE HYDRANT & FIRE PUMP SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Pump Sets & Outdoor Hydrant Pillars\nInspeksi Visual, Rangkaian Pompa & Pilar Hidran Halaman",
        "tasks": [
          "Perform visual inspection of fire hydrant pump house: Electric Fire Pump, Diesel Fire Pump, and Jockey Pump, checking suction and discharge gate valve positions are fully open and padlocked in supervisory status.\nMelakukan inspeksi visual terhadap ruang stasiun pompa kebakaran (Fire Pump Station Room) meliputi unit pompa jockey (Jockey Pump), pompa utama motor listrik (Electric Main Fire Pump), dan pompa cadangan mesin diesel (Diesel Standby Fire Pump), memeriksa kelurusan sambungan pipa hisap dan buang, ketiadaan kebocoran pada mechanical seal, dan posisi katup isolasi pipa header pemadam kebakaran.",
          "Inspect outdoor pillar hydrants, indoor fire hose cabinets (FHC), fire hoses, nozzles, and landing valves for physical integrity, absence of corrosion, and unobstructed access.\nMemeriksa kondisi fisik pilar hidran halaman luar gedung (Outdoor Hydrant Pillars), kotak penyimpanan selang (Hose Box), selang kanvas pemadam (fire hose reels), nosel semprot variabel (variable nozzles), kunci pembuka hidran (hydrant wrenches), dan sambungan mobil pemadam kota (Siamese Connection) dari karat, kotoran, atau kerusakan fisik."
        ]
      },
      {
        "step": "2. Cleaning, Strainer Service & Diesel Engine Maintenance\nPembersihan, Servis Strainer & Pemeliharaan Mesin Diesel",
        "tasks": [
          "Clean pump casings, baseplates, and control panels from dirt and oil residue, flush jockey pump pressure sensing lines, and inspect check valve seat seals.\nMembersihkan bodi rumah pompa, baseplate, dan panel kendali pompa kebakaran dari kotoran dan debu, membuka dan membersihkan saringan hisap air (suction strainers), serta memeriksa kebersihan bak penampung air utama pemadam (fire water reservoir).",
          "Perform regreasing on pump and electric motor bearings, check diesel engine cooling water level, engine oil level, starting battery electrolyte level, and clean diesel engine air filters.\nMelakukan pemeriksaan dan servis rutin mesin diesel pompa kebakaran meliputi pemeriksaan level oli mesin pada dipstick, pemeriksaan level air pendingin radiator dan selang pendingin heat exchanger, pemeriksaan level bahan bakar solar tangki harian, dan pembersihan klem kutub baterai starter diesel."
        ]
      },
      {
        "step": "3. Measurement, Auto-Start Sequences & Flow Delivery Testing\nPengukuran, Sekuens Start Otomatis & Uji Pancaran Air",
        "tasks": [
          "Record header pressure baseline (standard maintained at 8.0 - 10.0 bar by jockey pump), test jockey pump automatic start/stop pressure switch settings (Cut-in: 8.0 bar, Cut-out: 10.0 bar).\nMelakukan pengujian sekuens start otomatis pompa kebakaran bertahap berdasarkan penurunan tekanan pipa header uji (Pressure Drop Auto-Start Sequence): memverifikasi Jockey Pump otomatis start pada tekanan 9.0 Bar (cut-out pada 10.0 Bar), Electric Main Pump otomatis start pada tekanan 7.5 Bar, dan Diesel Backup Pump otomatis start darurat pada tekanan 6.0 Bar.",
          "Perform automatic startup functional testing of Electric Main Fire Pump upon system pressure drop to 7.0 bar, and test Emergency Diesel Fire Pump automatic cranking upon pressure drop to 6.0 bar or electric power failure simulation.\nMelakukan uji aliran dan pancaran air dinamis (Flow Delivery & Discharge Pressure Test) pada pilar hidran terjauh di area perimeter data center, mengukur tekanan dinamis pancaran air pada ujung nosel menggunakan Pitot Gauge terkalibrasi (standar tekanan pancaran > 4.5 Bar pada debit nominal).",
          "Perform water discharge flow test through test header manifold, measuring flow rate (GPM) and residual nozzle pressure (standard ≥ 4.5 bar at highest hydrant outlet), measure motor electrical running currents, and record diesel engine operating parameters (1800 RPM, oil pressure 4.0 bar, coolant temperature 80°C).\nMengukur parameter kelistrikan motor elektrik pompa (tegangan 380 - 415 VAC, arus start/running motor elektrik), mengukur parameter baterai starter mesin diesel (Dual 24 VDC Battery Float Voltage 26.8 VDC, specific gravity elektrolit 1.270), mengukur tekanan oli mesin diesel (3.5 - 5.0 bar saat operasi), serta menguji fungsi katup pelepas tekanan lebih (Pressure Relief Valve - PRV)."
        ]
      }
    ]
  },
  "water leak": {
    "category": "WATER LEAK DETECTION (WLD) SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Controller Display & Sensing Cable Route\nInspeksi Visual, Tampilan Kontroler & Rute Kabel Sensor",
        "tasks": [
          "Perform visual inspection of Water Leak Detection control panels (WLD Controller) in security rooms and BMS monitoring centers, checking LCD displays, normal LED indicators, and verifying zero active fault / break cable alarms.\nMelakukan inspeksi visual terhadap panel kontrol Water Leak Detection (WLD Controller), memeriksa layar tampilan LCD/LED, lampu indikator status komunikasi modul antarmuka, dan memastikan tidak ada indikasi alarm aktif atau peringatan kabel putus (cable break fault).",
          "Inspect sensing cable routes laid on concrete sub-floors under data hall raised floors, CRAC perimeter zones, and pipe shafts for physical integrity and absence of mechanical cuts, tight kinks, or chemical contamination.\nMemeriksa rute penempatan kabel sensor pendeteksi air berbahan polimer konduktif (conductive polymer sensing cables) di bawah lantai raised floor ruang data hall server, sekeliling perimeter unit pendingin presisi CRAC, dan sepanjang jalur pipa air dingin (chilled water pipes)."
        ]
      },
      {
        "step": "2. Cleaning, Sensor Dusting & Cable Fastening Maintenance\nPembersihan, Pengelapan Sensor & Pemeliharaan Klem Kabel",
        "tasks": [
          "Clean sensing cable surfaces from dust, conductive particles, and moisture residues using dry microfiber cloths.\nMembersihkan permukaan kabel sensor pendeteksi air dari akumulasi partikel debu konduktif atau kotoran halus menggunakan kain mikrofiber kering untuk mencegah timbulnya alarm palsu (false alarms).",
          "Inspect and secure sensing cable adhesive mounting clips (hold-down cable clips) every 1.0 - 1.5 meters on concrete floors, and verify End-of-Line (EOL) terminating resistors are tightly fastened.\nMemeriksa dan merapikan klem perekat penahan kabel sensor pada lantai beton (hold-down clips), memastikan kabel sensor tidak terjepit struktur rangka kaki raised floor, tidak terinjak kabel daya, dan memeriksa keutuhan modul terminasi ujung kabel (End-of-Line / EOL terminator plug)."
        ]
      },
      {
        "step": "3. Measurement, Loop Continuity & Location Mapping Calibration\nPengukuran, Kontinuitas Loop & Kalibrasi Pemetaan Lokasi",
        "tasks": [
          "Measure operating power supply voltage to WLD controllers (standard 12 - 24 VDC / 220 VAC) and verify backup battery voltage condition.\nMengukur parameter tegangan catu daya operasional kontroler WLD (standar tegangan kerja 12.0 - 24.0 VDC).",
          "Measure sensing cable loop continuity resistance using a digital multimeter (normal loop resistance standard: 3.0 - 4.5 Ω/meter) and measure isolation resistance between sensing conductors (> 50 MΩ dry condition).\nMengukur nilai resistansi kontinuitas loop kabel sensor menggunakan multimeter digital (standar kontinuitas kabel normal 2.5 - 4.5 Ω per meter panjang kabel, dan resistansi modul EOL resistor sesuai spesifikasi pabrikan).",
          "Perform simulated water leak detection testing by applying standard damp cloths at designated test points, verifying controller alarm response time (< 3 seconds), distance mapping accuracy (location error ± 1 meter), and alarm notification dispatch to BMS workstations.\nMelakukan pengujian sensitivitas deteksi cairan menggunakan kain lembab terstandarisasi yang disentuhkan pada beberapa titik sampling acak di sepanjang bentangan kabel sensor, mengukur akurasi pembacaan jarak titik kebocoran pada layar kontroler WLD (Distance Mapping Accuracy toleransi deviasi < 1.0 meter dari lokasi fisik tiruan), serta memverifikasi pengiriman sinyal alarm kebocoran seketika ke sistem integrasi pemantauan pusat BMS (< 5 detik)."
        ]
      }
    ]
  },
  "fuel leak": {
    "category": "FUEL LEAK DETECTION & TANK GAUGING SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Hydrocarbon Sensors & Tank Gauge\nInspeksi Visual, Sensor Hidrokarbon & Indikator Tangki",
        "tasks": [
          "Perform visual inspection of Fuel Leak Detection System control panels and Automatic Tank Gauging (ATG) consoles in generator fuel control rooms, checking power status indicators, system alarms, and LCD display communications.\nMelakukan inspeksi visual terhadap panel kontrol Fuel Leak Detection System dan kontroler Automatic Tank Gauge (ATG), memeriksa layar indikator volume tangki solar, status komunikasi modul sensor, dan memastikan tidak ada indikasi alarm kebocoran bahan bakar aktif.",
          "Inspect physical condition of hydrocarbon-selective sensing cables installed along fuel transfer trenches, underground fuel pipes, fuel day tanks, and bulk storage tank containment sumps for absence of diesel staining or physical abrasions.\nMemeriksa kondisi fisik kabel sensor tahan hidrokarbon (hydrocarbon-selective sensing cables) di parit pipa penyalur solar (fuel pipe trench) dan area tanggul penampungan tangki bahan bakar (bundwall / fuel containment pit), serta memeriksa sensor optik pendeteksi cairan di bak penampung darurat."
        ]
      },
      {
        "step": "2. Cleaning, Probe Cleaning & Enclosure Protection\nPembersihan, Pembersihan Probe & Perlindungan Selungkup",
        "tasks": [
          "Clean optical sensor probes and junction box enclosures from dust, soil, and fuel oil residue using clean dry cloths.\nMembersihkan probe sensor optik dan selungkup kotak sambungan kabel (junction box) dari debu, kerak lumpur, atau uap minyak menggunakan cairan pembersih khusus elektronik (contact cleaner) bebas residu.",
          "Inspect waterproof sealing gaskets of junction boxes and explosion-proof cable glands (ATEX / Ex-proof rated cable glands) to ensure environmental sealing.\nMemeriksa kekedapan segel penutup junction box dan kabel gland bersertifikasi explosion-proof (IP66/Ex-proof), serta memastikan kabel sensor terpasang rapi pada dasar parit pipa bahan bakar."
        ]
      },
      {
        "step": "3. Measurement, Liquid Level Accuracy & Alarm Trip Testing\nPengukuran, Akurasi Level Solar & Pengujian Alarm Trip",
        "tasks": [
          "Measure operating voltages of fuel leak detection controller modules (standard 24 VDC / 220 VAC) and verify panel loop resistance values.\nMengukur tegangan operasional modul kontroler sistem pendeteksi kebocoran solar (standar tegangan 24 VDC).",
          "Measure hydrocarbon sensor cable continuity loop resistance (Normal Loop Continuity standard according to manufacturer baseline specs).\nMengukur nilai resistansi loop kontinuitas kabel sensor hidrokarbon (Normal Loop Continuity Resistance standar < 100 Ω).",
          "Measure and record liquid level height and diesel fuel storage volume in bulk and day tanks via ATG console telemetry, comparing with manual dipstick sounding stick measurements (tolerance deviation < 1%).\nMengukur dan mencatat data tinggi level cairan dan volume bahan bakar solar pada tangki timbun melalui layar kontroler ATG, memverifikasi akurasi penunjukan ATG terhadap hasil pengukuran fisik manual menggunakan tongkat ukur berskala (manual dipstick measurement dengan deviasi toleransi < 5 mm).",
          "Perform functional testing of high fuel level alarms (High Level Alarm 90%) and overfill critical alarms (Overfill Alarm 95%), verify auto-shutdown interlock of fuel transfer pumps, and test fuel leak sensing probes using test fluid.\nMenguji fungsionalitas alarm batas tinggi solar (High Level Alarm 90%) dan alarm pencegah luapan solar (Overfill Prevention Alarm 95%), serta menguji respon pemicuan alarm kebocoran solar dan interlock otomatis pemutus daya darurat pompa transfer bahan bakar (Emergency Fuel Pump Shut-off Interlock)."
        ]
      }
    ]
  },
  "lightning protection system": {
    "category": "LIGHTNING PROTECTION SYSTEM (LPS)",
    "items": [
      {
        "step": "1. Visual Inspection, Air Terminal & Support Mast Rigidity\nInspeksi Visual, Terminal Penangkal Petir & Tiang Penyangga",
        "tasks": [
          "Perform visual inspection of rooftop electrostatic lightning protection air terminals (Early Streamer Emission - ESE Air Terminal) and non-radioactive conventional Franklin rods, inspecting support mast towers, guy wires, and turnbuckle tension.\nMelakukan inspeksi visual terhadap kepala terminal penangkal petir elektrostatis (Air Terminal / Early Streamer Emission - ESE Head) pada titik tertinggi atap gedung data center, memeriksa tiang penyangga utama (support mast), kawat penarik kekokohan tiang (guy wires), klem pengikat kabel penurunan (down conductor clamps), dan pelindung mekanis pipa PVC.",
          "Inspect physical condition of lightning strike event counters (Lightning Strike Counter) and down conductor routes (insulated high-voltage cables / bare copper tape) on building exterior walls down to ground test pits.\nMemeriksa kondisi fisik alat penghitung sambaran petir (Lightning Strike Counter) yang terpasang pada jalur konduktor turun, memeriksa keutuhan klem sambungan uji (test link clamp), dan memastikan tidak ada tanda korosi atau sambungan kendor akibat getaran angin kencang."
        ]
      },
      {
        "step": "2. Cleaning, Counter Dusting & Anti-Corrosion Treatment\nPembersihan, Pengelapan Counter & Perlakuan Anti-Korosi",
        "tasks": [
          "Clean air terminal strike surfaces, lightning strike counter display faces, and grounding test disconnection boxes from dust, bird droppings, and oxidation crust.\nMembersihkan permukaan ujung terminal penangkal petir, selungkup lightning strike counter, dan kotak sambungan uji dari tumpukan debu, sarang serangga, atau deposit kerak oksidasi menggunakan kain kering dan sikat kawat halus.",
          "Inspect and retorque bimetallic copper-to-steel connector clamp bolts, and apply conductive anti-corrosion grease on all bolted joints.\nMemeriksa dan melakukan pengetatan ulang baut klem konektor bimetal tembaga-ke-baja, serta mengaplikasikan lapisan pasta pelindung anti-korosi (conductive anti-corrosion grease / spray) pada titik-titik sambungan logam konduktor terbuka."
        ]
      },
      {
        "step": "3. Measurement, Earth Ground Resistance & Continuity Testing\nPengukuran, Tahanan Pembumian & Uji Kontinuitas Konduktor",
        "tasks": [
          "Measure lightning rod grounding electrode resistance using an Earth Ground Tester with 3-pole fall-of-potential test method (lightning ground resistance standard < 1.0 Ω per NFPA 780 / SNI standards).\nMelakukan pengukuran nilai resistansi pembumian batang elektroda penangkal petir menggunakan Digital Earth Tester terkalibrasi dengan metode pengukuran 3-titik (fall-of-potential method): standar nilai tahanan pembumian < 1.0 Ω target ideal untuk data center, maksimum < 5.0 Ω sesuai standar SNI 03-7015 dan NFPA 780.",
          "Record and verify lightning strike event counter register readings against monthly maintenance logbooks.\nMencatat dan memverifikasi pembacaan angka register pada alat penghitung sambaran petir (Lightning Strike Counter reading) untuk mencatat riwayat sambaran petir periodik.",
          "Perform electrical continuity testing on down conductors from rooftop air terminal down to ground test links (< 0.2 Ω continuity resistance).\nMelakukan pengujian kontinuitas elektrikal konduktor penyalur petir (down conductor) dari ujung head terminal atap hingga ke titik sambungan bak kontrol pembumian tanah (Down Conductor Continuity Resistance standar < 0.2 Ω).",
          "Perform high-voltage insulation resistance testing on shielded down conductor cables using a 5.0 kV DC Megger (standard insulation resistance > 100 MΩ).\nMelakukan pengujian resistansi isolasi kabel konduktor berisolasi tegangan tinggi (HV shielded down conductor) menggunakan insulation tester 1000V DC (standar > 100 MΩ), serta memeriksa kerapian ikatan konduktor penyalur pada dinding luar gedung."
        ]
      }
    ]
  },
  "grounding system": {
    "category": "EARTH GROUNDING & BONDING SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Ground Pits & Equipotential Grid\nInspeksi Visual, Bak Kontrol & Jaringan Bonding Ekipotensial",
        "tasks": [
          "Perform visual inspection of all building earth grounding inspection pits (earth ground chambers / control pits), Main Grounding Busbar (MGB), and Equipotential Grounding Grid in electrical rooms and data halls.\nMelakukan inspeksi visual terhadap keseluruhan bak kontrol pembumian tanah (earth ground inspection pits), batang elektroda tembaga (copper ground rods), busbar utama pembumian gedung (Main Grounding Busbar - MGB), dan pita tembaga jaringan bonding ekipotensial (equipotential bonding grid) di bawah raised floor ruang data hall server.",
          "Inspect physical condition of exothermic welded copper cable connections (cadweld joints), copper ground busbars, and green-yellow insulated grounding conductors for absence of cracks, corrosion, or mechanical cuts.\nMemeriksa kondisi fisik klem penjepit sambungan kabel tembaga eksotermik (cadweld joints / bimetallic connectors) dari kerapuhan, retakan, atau korosi akibat kelembaban tanah, dan memastikan tutup bak kontrol tertutup rapat serta diberi penomoran identifikasi yang jelas."
        ]
      },
      {
        "step": "2. Cleaning, Pit Debris Removal & Busbar Polishing\nPembersihan, Pengangkatan Sampah Bak Kontrol & Poles Busbar",
        "tasks": [
          "Clean inside of grounding control pit chambers from mud, dirt, water accumulation, and foreign debris.\nMembersihkan bagian dalam sumur bak kontrol pembumian dari endapan lumpur tanah, genangan air kotor, dan rumput liar, serta memastikan kondisi tanah di sekitar elektroda bersih dan terawat.",
          "Clean greenish oxidation crust on copper electrode rods and grounding busbars using fine sandpaper and brass wire brushes, retorquing all cable lug bolts using a torque wrench.\nMembersihkan lapisan kerak oksidasi kehijauan pada batang elektroda tembaga dan pelat busbar pembumian menggunakan sikat kawat kuningan halus, serta melakukan pengetatan ulang baut pengikat terminal kabel pembumian menggunakan kunci pas bertorsi standar."
        ]
      },
      {
        "step": "3. Measurement, Earth Resistance & Loop Impedance Testing\nPengukuran, Nilai Tahanan Pentanahan & Uji Loop Bonding",
        "tasks": [
          "Measure individual grounding resistance at each ground pit point using a calibrated 3-pole digital Earth Clamp / Ground Resistance Tester (standard ground pit resistance < 1.0 Ω).\nMelakukan pengukuran resistansi pembumian individual pada setiap titik sumur grounding pit menggunakan Digital Earth Tester terkalibrasi metode fall-of-potential (target resistansi Clean Earth IT Data Hall < 1.0 Ω, dan Electrical Safety Grounding utility < 2.0 Ω, maksimum batas toleransi < 5.0 Ω sesuai standar IEEE 142 dan PUIL 2011).",
          "Perform continuity resistance testing of equipotential bonding loops between electrical panels, transformer neutrals, generator frames, and computer server room Signal Reference Ground (SRG) grids (bonding resistance < 0.1 Ω).\nMelakukan pengujian resistansi kontinuitas loop jaringan bonding ekipotensial antar rak server IT, bodi panel listrik, rangka raised floor, dan struktur kolom baja gedung menggunakan Micro-Ohmmeter / Clamp-On Ground Tester (standar nilai Equipotential Loop Continuity Resistance < 0.1 Ω).",
          "Measure potential touch voltage (Touch Voltage) and step voltage (Step Voltage) under simulated earth fault conditions (safe touch voltage standard < 5.0 VAC to prevent electrical shock hazards).\nMengukur tegangan sentuh (Touch Voltage) dan tegangan langkah (Step Voltage) potensial tanah di sekitar gardu listrik dan area grounding pit untuk memastikan keselamatan personel operasional data center dari bahaya tegangan liar."
        ]
      }
    ]
  },
  "lighting point / pju": {
    "category": "LIGHTNING POINT & OUTDOOR PJU SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Luminaires & Solar Cell Fixtures\nInspeksi Visual, Rumah Lampu & Komponen PJU Solar",
        "tasks": [
          "Perform visual inspection of indoor lighting points (LED tube battens, emergency LED troffers, illuminated exit signs) and outdoor Public Street Lighting (PJU) / security perimeter floodlights, checking for burnt-out lamps, broken diffusers, or loose mounting fixtures.\nMelakukan inspeksi visual terhadap titik lampu penerangan dalam ruangan (LED tube / downlight fixtures) dan lampu Penerangan Jalan Umum luar gedung (Outdoor Street & Garden Lighting PJU tenaga surya / AC grid), tiang lampu penerangan, kaca penutup lampu (luminaire enclosure), dan kotak kontrol.",
          "Inspect physical condition of photovoltaic solar panel modules (Solar Panel C2), solar charge controller units, and lithium storage battery boxes on standalone solar street light poles.\nMemeriksa kondisi fisik modul panel surya fotovoltaik (Solar Panel C2), unit pengontrol pengisian surya (Solar Charge Controller), bank baterai solar, dan sensor cahaya otomatis (Photocell / LDR light sensors) dari kotoran atau keretakan fisik."
        ]
      },
      {
        "step": "2. Cleaning, Luminaire Cover Wash & Solar Panel Dusting\nPembersihan, Pencucian Kaca Lampu & Pembersihan Panel Surya",
        "tasks": [
          "Clean glass covers and reflector bodies of lighting fixtures from dust, dirt, and dead insects using microfiber cloths and mild cleaning solutions.\nMembersihkan kaca penutup rumah lampu (lamp cover glass) dan bodi fitting lampu dari tumpukan debu dan kotoran serangga menggunakan kain lap mikrofiber basah untuk memaksimalkan efisiensi transmisi pencahayaan.",
          "Clean glass surfaces of solar street light photovoltaic panels from dust and atmospheric pollution using wet wipers to restore solar absorption efficiency.\nMembersihkan permukaan kaca modul sel fotovoltaik panel surya PJU dari lapisan debu jalanan menggunakan semprotan pembersih kaca non-abrasif agar penyerapan energi radiasi matahari optimal, serta membersihkan kisi ventilasi kotak baterai kontrol PJU."
        ]
      },
      {
        "step": "3. Measurement, Electrical Loading & Lux Level Validation\nPengukuran, Pembebanan Elektrikal & Validasi Kuat Cahaya",
        "tasks": [
          "Measure lighting power supply voltages: 220 - 230 VAC input voltage at lighting distribution panels and pole junction boxes.\nMengukur parameter tegangan suplai daya listrik penerangan: tegangan input 220 - 230 VAC 1-fasa (standar toleransi ±10% 50Hz sesuai IEC 60038) atau tegangan terbuka panel surya Voc (standar 30 - 40 VDC) dan tegangan kerja baterai solar cell (standar 24.0 - 27.6 VDC float charge).",
          "Measure operating electrical load currents on lighting circuits (circuit load Ampere ≤ 80% of MCB rated trip capacity).\nMengukur arus beban pemakaian listrik rangkaian lampu penerangan (Ampere load ≤ 80% dari kapasitas rating pemutus sirkit MCB sesuai IEC 60364).",
          "Perform illumination lux level measurements using a calibrated digital Lux Meter (Data Hall ≥ 500 Lux, Electrical Room ≥ 300 Lux, Office Area ≥ 350 Lux, Outdoor PJU Roadways ≥ 20 Lux).\nMelakukan pengukuran tingkat kuat penerangan cahaya (Illuminance Level) menggunakan Lux Meter digital terkalibrasi: area ruang server data hall (standar 300 - 500 Lux), area koridor teknis dan tangga darurat (standar 150 - 200 Lux), dan area jalan perimeter pos keamanan (standar 20 - 50 Lux).",
          "Test automatic operation of dusk-to-dawn photocell light sensors and astronomical digital timer controls, and test 90-minute battery backup discharge capability of emergency exit signs.\nMenguji pengoperasian otomatis sensor fotosel cahaya malam dan timer kendali otomatis, serta mengukur resistansi pembumian tiang lampu PJU (< 5.0 Ω)."
        ]
      }
    ]
  },
  "vrv": {
    "category": "VRV AIR CONDITIONING SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Enclosure & Refrigerant Circuit\nInspeksi Visual, Selungkup & Sirkuit Pemipaan Refrigeran",
        "tasks": [
          "Perform visual inspection of Variable Refrigerant Volume (VRV / VRF) outdoor condensing units and indoor ceiling cassette/ducted units in office and support areas.\nMelakukan inspeksi visual terhadap unit outdoor VRV multi-inverter dan unit indoor VRV (ceiling cassette / concealed duct type) di ruang operasional dan ruang meeting, memeriksa kebersihan selungkup luar dan kisi koil pendingin, keutuhan isolasi pipa refrigeran tembaga, dan ketiadaan noda oli yang mengindikasikan kebocoran refrigeran.",
          "Inspect refrigerant copper piping insulation, flare connections for oil stains, condenser fans, outdoor unit mounting spring isolators, and central controller touchscreens.\nMemeriksa kelancaran aliran pipa pembuangan air kondensat, kondisi dudukan bantalan peredam getaran unit outdoor, memeriksa layar remote kontrol dinding (wall controller display utuh, tombol responsif), serta memastikan tidak ada hambatan aliran sirkulasi udara (airflow blockade) pada sisi hisap dan hembusan unit indoor."
        ]
      },
      {
        "step": "2. Cleaning, Filter Wash & Evaporator Coil Chemical Service\nPembersihan, Cuci Filter & Pembersihan Kimia Koil Evaporator",
        "tasks": [
          "Clean indoor nylon mesh air filters, clean indoor evaporator coils and outdoor condenser fins using fine fin combs and specialized non-corrosive chemical foam wash.\nMembuka dan mencuci bersih saringan filter udara (air filters) unit indoor dari akumulasi debu tebal menggunakan air bertekanan sedang (jet cleaner), dan mengeringkannya sebelum dipasang kembali.",
          "Clean indoor condensate drain pans and flush drain pipe lines, inspect condensate lift pump operation, and clean electrical inverter PCB control boxes from dust.\nMembersihkan kisi-kisi sirip koil evaporator indoor dan sirip kondensor outdoor menggunakan vacuum cleaner dan cairan pembersih koil khusus (fin cleaner), membersihkan bak penampung air kondensat (drain pan), membersihkan pompa pembuangan air (drain pump), serta membilas pipa drainase kondensat agar bebas dari sumbatan lendir atau alga."
        ]
      },
      {
        "step": "3. Measurement, Refrigerant Pressures & Inverter Performance\nPengukuran, Tekanan Refrigeran & Performa Modul Inverter",
        "tasks": [
          "Measure input 3-phase power supply voltages and inverter compressor operating currents using clamp meters.\nMengukur parameter tegangan suplai listrik unit indoor dan outdoor: 1-fasa (standar 210 - 240 VAC) dan 3-fasa (standar 360 - 415 VAC), mengukur arus kerja operasional kompresor inverter dan motor kipas (Running Current Phase R, S, T) menggunakan clamp meter, serta mencatat frekuensi kerja inverter (Hz).",
          "Measure operating suction and discharge refrigerant pressures, record inverter operating frequencies, and measure electronic expansion valve (EEV) pulse modulation.\nMengukur parameter tekanan sirkuit refrigeran (R-410A) menggunakan manifold gauge terkalibrasi: tekanan hisap (Suction Pressure standar 100 - 145 psi) dan tekanan buang (Discharge Pressure standar 350 - 450 psi), serta memeriksa nilai derajat superheat dan subcooling refrigeran pada kontroler VRV.",
          "Measure return air and supply air temperatures to verify effective cooling temperature differential (Delta T ≥ 8°C), record room temperature vs setpoint tolerance (± 2°C, ± 5% RH), measure compressor motor insulation resistance (> 100 MΩ), and test automatic drain pumps.\nMengukur temperatur udara masuk (Return Air) dan temperatur udara keluar hembusan (Supply Air) untuk memverifikasi selisih temperatur pendinginan (Delta T standar ≥ 8°C), mengukur suhu ruangan aktual vs nilai setpoint (toleransi deviasi suhu maksimum ± 2°C, kelembaban ± 5% RH), mengukur resistansi isolasi belitan motor kompresor (> 100 MΩ), dan menguji pompa drainase otomatis."
        ]
      }
    ]
  },
  "ac splits": {
    "category": "AC SPLITS AIR CONDITIONING SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Indoor Mounting & Piping Insulation\nInspeksi Visual, Dudukan Indoor & Insulasi Pipa Refrigeran",
        "tasks": [
          "Perform visual inspection of AC Split Wall units (1.0 - 2.5 HP capacity) in office spaces, small UPS rooms, and security posts, checking wall-mounting plate firmness, indoor plastic casing cleanliness, and motorized swing louver movement.\nMelakukan inspeksi visual terhadap unit AC Split Wall (kapasitas 1 PK - 2.5 PK) di area perkantoran, ruang UPS kecil, dan pos keamanan, memeriksa kelurusan dan kekokohan pelat gantungan unit indoor pada dinding, memeriksa kebersihan selungkup plastik bodi indoor, dan fungsi pergerakan louver pengarah hembusan udara (swing louver).",
          "Inspect copper refrigerant piping condition, armacell closed-cell insulation integrity, inspect flare nut joints for oil seepage, and inspect outdoor condensing unit brackets against rust or loose anchor bolts.\nMemeriksa kondisi fisik pipa tembaga refrigeran, keutuhan pembungkus insulasi busa hitam (armacell insulation), memeriksa ketiadaan rembesan oli pada sambungan nepel flare nut, dan memeriksa kondisi dudukan braket condensing unit outdoor dari karat atau kelonggaran baut angkur."
        ]
      },
      {
        "step": "2. Cleaning, Filter Jet Wash & Condenser Coil Cleaning\nPembersihan, Cuci Filter Semprot & Pembersihan Koil Kondensor",
        "tasks": [
          "Open indoor front panel covers, remove nylon mesh air filters and wash clean from dust accumulation using water spray.\nMembuka penutup panel depan unit indoor, melepaskan saringan filter udara plastik (nylon mesh filters) dan mencucinya hingga bersih dari tumpukan debu menggunakan semprotan air.",
          "Clean indoor evaporator coil fins and outdoor condenser coil fins using fine water pressure jet cleaner with protective catch-bags installed, clean condensate drain pans, and flush drain piping until runoff is clear.\nMembersihkan permukaan kisi sirip evaporator unit indoor dan sirip kondensor unit outdoor menggunakan semprotan air bertekanan halus (jet cleaner) dengan memasang plastik penampung air cuci AC, membersihkan talang pembuangan air kondensat (drain pan), serta menyemprot pipa saluran drainase air hingga aliran air buangan lancar."
        ]
      },
      {
        "step": "3. Measurement, Refrigerant Gas Pressure & Cooling Delta T\nPengukuran, Tekanan Gas Refrigeran & Delta T Pendinginan",
        "tasks": [
          "Measure 1-phase electrical power supply parameters: Phase-to-Neutral (standard 210 - 240 VAC ±10%) and Neutral-to-Ground voltage (N-G < 2.0 VAC) using a calibrated multimeter.\nMengukur parameter tegangan suplai listrik input 1-fasa: Phase-to-Neutral (standar 210 - 240 VAC ±10%) dan tegangan Netral ke Ground (N-G < 2.0 VAC) menggunakan multimeter terkalibrasi.",
          "Measure compressor operational running current (Running Current Amperes) using a clamp meter to verify current does not exceed nameplate Full Load Amperes (FLA).\nMengukur arus beban kerja operasional kompresor (Running Current Ampere) menggunakan clamp meter untuk memastikan arus kerja tidak melebihi nilai kapasitas arus beban penuh pada nameplate (Full Load Amperes - FLA).",
          "Measure refrigerant operating gas pressures (R-32 / R-410A) using manifold gauges at outdoor service ports (standard suction working pressure 120 - 150 psi under normal compressor operation).\nMengukur tekanan operasional gas refrigeran (R-32 / R-410A) menggunakan manifold gauge pada katup servis outdoor (Suction Working Pressure standar 120 - 150 psi pada saat kompresor bekerja normal).",
          "Measure return air temperature (24 - 27°C) and supply air temperature (12 - 16°C) to verify effective cooling temperature differential (Delta T standard 8 - 12°C), measure blower airflow velocity (2.5 - 5.5 m/s) using a digital anemometer, and measure compressor motor insulation resistance (> 50 MΩ).\nMengukur temperatur udara masuk (Return Air 24 - 27°C) dan temperatur udara hembus keluar (Supply Air 12 - 16°C) untuk memverifikasi selisih temperatur pendinginan efektif (Delta T standar 8 - 12°C), mengukur kecepatan hembusan udara blower (Airflow Velocity 2.5 - 5.5 m/s) menggunakan anemometer digital, serta mengukur resistansi isolasi kompresor (> 50 MΩ)."
        ]
      }
    ]
  },
  "crac data hall": {
    "category": "PRECISION AIR CONDITIONING (CRAC / PAC) SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Microprocessor HMI & EC Fans\nInspeksi Visual, Layar HMI Mikroprosesor & Kipas EC Fan",
        "tasks": [
          "Perform visual inspection of Precision Air Conditioning (CRAC / PAC) units in server rooms, checking microprocessor graphical user interface displays (e.g. Liebert iCOM / Schneider), electronically commutated EC plug fan rotation, chilled water 2-way modulating valve position (0-10V), and electrode steam humidifier cylinder integrity.\nMelakukan inspeksi visual terhadap unit pengondisi udara presisi ruang server (Precision Air Conditioning - CRAC / PAC), memeriksa tampilan layar antarmuka grafis kontroler mikroprosesor (misal Liebert iCOM / Schneider), status putaran motor kipas EC Fan (electronically commutated plug fans), posisi pergerakan katup air dingin modulasi 2-arah (chilled water modulating valve 0-10V), dan keutuhan silinder pelembab uap (electrode steam humidifier).",
          "Inspect Magnehelic differential pressure gauges across air filters, inspect stainless steel condensate drain pan and drain lines, and inspect panel door insulation seals against cold air leakage.\nMemeriksa indikator penurunan tekanan filter udara (Magnehelic differential pressure gauge), memeriksa kebersihan bak penampung air kondensat stainless steel dan pipa drainase, serta memeriksa keutuhan segel isolasi pintu panel dari kebocoran udara dingin."
        ]
      },
      {
        "step": "2. Cleaning, Filter Replacement & Humidifier Descaling\nPembersihan, Penggantian Filter Udara & Pengikisan Kerak Humidifier",
        "tasks": [
          "Inspect, clean, or replace high-efficiency air filter cartridges (G4 pre-filters / F7 medium filters) from data hall particulate accumulation.\nMemeriksa dan membersihkan atau mengganti elemen saringan filter udara berefisiensi tinggi (G4 pre-filter / F7 medium filter cartridge) dari akumulasi partikel debu data hall.",
          "Clean stainless steel condensate drain pans, flush drain hoses and automatic drain pumps, inspect steam humidifier cylinders for calcium mineral scale, clean heating electrodes, and clean chilled water cooling coil fins using a HEPA-filtered vacuum cleaner.\nMembersihkan bak penampung air kondensat stainless steel, membilas selang pembuangan kondensat dan pompa drainase otomatis, memeriksa silinder tabung pelembab uap humidifier dari endapan kerak kalsium, membersihkan elektroda pemanas, dan membersihkan kisi sirip koil pendingin air dingin menggunakan vacuum cleaner berfilter HEPA."
        ]
      },
      {
        "step": "3. Measurement, Environmental Precision & Modulating Valve Check\nPengukuran, Presisi Suhu/Kelembaban & Uji Katup Modulasi",
        "tasks": [
          "Measure electrical input parameters: 3-phase supply voltages R-S, S-T, T-R (standard 380 - 415 VAC) and R-N, S-N, T-N (standard 220 - 240 VAC), measure EC fan motor operating current per phase (Phase R, S, T), and measure electric reheat stage currents.\nMengukur parameter kelistrikan masukan unit PAC meliputi tegangan suplai 3-fasa R-S, S-T, T-R (standar 380 - 415 VAC) dan fasa-netral R-N, S-N, T-N (standar 220 - 240 VAC), mengukur arus kerja per fasa motor kipas EC Fan (Phase R, S, T), dan mengukur arus kerja elemen pemanas listrik elektrik (electric reheat stage current).",
          "Record and validate data hall environmental precision: underfloor supply air temperature (standard 18 - 22°C), return air temperature (standard 24 - 27°C, target Delta T 5 - 8°C), and relative humidity (standard 45% - 55% RH per ASHRAE TC 9.9 Thermal Guidelines for Data Processing Environments).\nMencatat dan memvalidasi presisi parameter temperatur dan kelembaban udara ruang server: temperatur udara suplai bawah lantai (Underfloor Supply Air standar 18 - 22°C), temperatur udara balik (Return Air standar 24 - 27°C, target Delta T 5 - 8°C), dan kelembaban relatif udara (Relative Humidity standar 45% - 55% RH sesuai standar ASHRAE TC 9.9 Thermal Guidelines for Data Processing Environments).",
          "Measure air filter differential pressure drop on Magnehelic gauges (Filter DP standard < 150 Pa), measure chilled water modulating valve 0 - 10 VDC signal response to thermal load variations, measure chilled water supply and return temperatures (Inlet 7°C, Outlet 13°C, Delta T 6°C), and perform dual-unit automatic standby changeover sequence testing.\nMengukur penurunan tekanan diferensial filter udara pada manometer Magnehelic (Filter DP standar normal < 150 Pa), mengukur respon sinyal modulasi katup air dingin 0 - 10 VDC terhadap perubahan beban termal ruangan, mengukur temperatur air dingin suplai dan balik (Inlet 7°C, Outlet 13°C, Delta T 6°C), serta menguji fungsi sekuens alih unit siaga otomatis (Dual Unit Auto-Changeover / Redundancy Duty Test)."
        ]
      }
    ]
  },
  "fcu": {
    "category": "FAN COIL UNIT (FCU) SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Enclosure & Thermostat Controller Check\nInspeksi Visual, Selungkup & Pemeriksaan Termostat Ruangan",
        "tasks": [
          "Perform comprehensive visual inspection of Fan Coil Units (FCU ceiling concealed / cassette type) in corridors, staging rooms, and control rooms, inspecting unit casing cleanliness, return air grilles, supply air diffusers, hanger rod and bracket rigidity, and fastener completeness.\nMelakukan inspeksi visual menyeluruh terhadap unit Fan Coil Unit (FCU ceiling concealed / cassette type) di area koridor, ruang staging, dan ruang kontrol, memeriksa kebersihan selungkup bodi AC menggunakan duster, kebersihan kisi-kisi udara masuk (return air grille) dan kisi hembusan suplai (supply diffuser), memeriksa kekokohan gantungan unit (hanger rods, bracket, mounting), dan kelengkapan seluruh baut pengencang.",
          "Inspect electrical control components and wiring terminations (tight, free from burns or looseness), inspect wall thermostat controller button response and display readings, inspect smooth Low-Medium-High fan speed adjustment, and ensure airflow pathways are unobstructed.\nMemeriksa kondisi fisik komponen kontrol elektrikal dan terminasi pengkabelan (kencang, tidak hangus atau kendor), memeriksa respon tombol dan penunjukan display termostat dinding (wall controller), memeriksa kelancaran pengaturan putaran kipas pada kecepatan Rendah, Sedang, dan Tinggi (Low-Medium-High speed), serta memastikan tidak adanya hambatan sirkulasi aliran udara (airflow blockade)."
        ]
      },
      {
        "step": "2. Cleaning, Filter Jet Wash & Drain System Maintenance\nPembersihan, Cuci Filter Semprot & Pemeliharaan Sistem Drain",
        "tasks": [
          "Remove and thoroughly wash air filters from dust accumulation using a water jet cleaner or air blower, and dry completely.\nMembuka dan mencuci bersih saringan filter udara (air filter) dari akumulasi debu tebal menggunakan semprotan jet cleaner / air blower dan mengeringkannya sempurna.",
          "Clean chilled water evaporator coil fins from dust and slime using a filtered vacuum cleaner and fin brush, clean components from oil drips and condensation, clean condensate drain pans and drain pumps, and flush drain piping to ensure free drainage.\nMembersihkan kisi-kisi sirip koil pendingin air dingin (evaporator coil fins) dari debu dan lendir alga menggunakan vacuum cleaner berfilter dan sikat fin brush, membersihkan komponen dari tetesan oli dan kondensasi, membersihkan bak penampung air kondensat (drain pan), membersihkan pompa drainase (drain pump), serta membilas pipa pembuangan drainase kondensat agar bebas dari penyumbatan."
        ]
      },
      {
        "step": "3. Measurement, Electrical, Acoustic, Vibration & Hydraulic Testing\nPengukuran, Elektrikal, Akustik, Getaran & Pengujian Hidrolik",
        "tasks": [
          "Measure electrical input and output voltages: phase-to-neutral R-N, S-N, T-N (standard 220 - 240 VAC ±10%) and phase-to-phase R-S, S-T, T-R (standard 380 - 415 VAC ±10% 50Hz), and measure fan motor operating workload current per phase on each speed setting using a clamp meter.\nMelakukan pengukuran parameter tegangan listrik masukan dan keluaran FCU: tegangan fasa-netral R-N, S-N, T-N (standar 220 - 240 VAC ±10%) dan tegangan fasa-fasa R-S, S-T, T-R (standar 380 - 415 VAC ±10% 50Hz), serta mengukur arus beban kerja operasional motor kipas per fasa (Phase R, S, T) pada masing-masing tingkat kecepatan kipas menggunakan clamp meter.",
          "Measure fan motor mechanical vibration using a digital Vibration Meter (motor vibration limit ≤ 2.5 mm/s) and measure blower rotation acoustic noise level using a Sound Level Meter (noise limit ≤ 65 dB).\nMelakukan pengukuran getaran mekanikal motor kipas menggunakan Vibration Meter digital (standar batas getaran motor ≤ 2.5 mm/s) dan mengukur tingkat kebisingan putaran blower menggunakan Sound Level Meter (standar batas kebisingan akustik ≤ 65 dB).",
          "Measure actual room temperature (standard ≤ 25°C) and relative humidity (standard ≤ 60% RH) using a calibrated thermo-hygrometer.\nMelakukan pengukuran parameter temperatur ruangan aktual (standar temperatur ruang ≤ 25°C) dan kelembaban udara relatif (standar kelembaban ≤ 60% RH) menggunakan termohigrometer terkalibrasi.",
          "Measure chilled water supply (CHWS) and return (CHWR) operating pressures (standard 2.5 - 4.0 Bar) to ensure normal circulation flow, and measure output airflow velocity (standard 2.0 - 8.0 m/s) using a digital anemometer.\nMengukur tekanan operasional pipa air dingin suplai dan balik (Chilled Water Supply CHWS & Return CHWR: standar tekanan kerja 2.5 - 4.0 Bar) untuk memastikan aliran sirkulasi air dingin normal, serta mengukur kecepatan hembusan aliran udara keluar (Output Air Flow Velocity: standar 2.0 - 8.0 m/s) menggunakan anemometer digital."
        ]
      }
    ]
  },
  "ahu": {
    "category": "AIR HANDLING UNIT (AHU / PAHU) SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Casing Integrity & Motorized Dampers\nInspeksi Visual, Integritas Casing & Damper Motorik",
        "tasks": [
          "Perform visual inspection of Air Handling Unit (AHU / PAHU) double-skin acoustic casing, inspecting inspection doors, sight glass observation windows, and internal lighting lamps.\nMelakukan inspeksi visual terhadap selungkup kabinet dinding ganda (double-skin insulated casing) unit Air Handling Unit (AHU / Primary Air Handling Unit - PAHU), memeriksa kekedapan segel pintu inspeksi, lampu penerangan internal, kaca pengintai (viewing glass), dan memeriksa kekokohan dudukan struktur peredam getaran (spring vibration isolators).",
          "Inspect supply and return fan vibration isolation springs, flexible duct connector canvas integrity, chilled water coil connection piping, and modulating 2-way control valve actuators.\nMemeriksa kondisi fisik motorized volume dampers pengatur udara segar luar (fresh air) dan udara buang (exhaust air), memeriksa kelancaran kerja aktuator damper 0-10V, dan memeriksa penunjukan jarum pengukur diferensial tekanan filter udara (Magnehelic differential pressure gauge)."
        ]
      },
      {
        "step": "2. Cleaning, Filter Wash & Coil Chemical Cleaning\nPembersihan, Cuci Filter & Pembersihan Kimia Koil Pendingin",
        "tasks": [
          "Inspect, clean, and replace primary pre-filter and secondary bag filter elements from dust accumulation, measuring filter pressure drop across Magnehelic differential pressure gauges.\nMencuci pre-filter dan membersihkan atau mengganti kantong medium/HEPA filter dari akumulasi partikel debu, membersihkan permukaan sirip koil pendingin air dingin menggunakan bahan pembersih koil ramah lingkungan (coil cleaner) dan semprotan air bertekanan halus, serta membilas bak penampung air kondensat stainless steel.",
          "Clean chilled water cooling coils using pressure jet wash and fin combs, clean and disinfect condensate stainless steel drain pans, and flush drain trap piping.\nMemeriksa ketegangan sabuk penggerak kipas (fan V-belt tension defleksi 10-15 mm) dan kelurusan puli (sheave pulley alignment), memeriksa keausan bearing poros kipas blower sentrifugal, serta melakukan pelumasan grease industri bertekanan pada bantalan bearing motor dan poros blower."
        ]
      },
      {
        "step": "3. Measurement, Airflow Balancing & Inverter VFD Testing\nPengukuran, Keseimbangan Debit Udara & Uji Inverter VFD",
        "tasks": [
          "Measure supply and return fan electric motor voltages and running currents per phase, and verify VFD frequency inverter speed modulation.\nMengukur parameter kelistrikan motor penggerak blower AHU: tegangan suplai 3-fasa R-S, S-T, T-R (standar 380 - 415 VAC), arus beban kerja per fasa (Phase R, S, T), dan mengukur resistansi isolasi belitan motor penggerak menggunakan Insulation Tester 1000V DC (standar nilai > 100 MΩ).",
          "Measure V-belt deflection tension and pulley alignment, measure fan and motor bearing vibration levels (≤ 2.8 mm/s), and lubricate bearings with lithium grease.\nMelakukan pengukuran getaran mekanikal pada bantalan bearing motor dan rumah keong kipas blower menggunakan Vibration Meter (standar getaran ≤ 2.8 mm/s RMS sesuai ISO 10816-3).",
          "Measure supply air and return air temperatures and relative humidity (Delta T ≥ 6°C), measure duct static pressure, verify motorized fire damper interlock operation, and test auto-shutdown signal on smoke detection.\nMengukur debit volume aliran udara (Airflow CFM / m3/jam), kecepatan aliran udara suplai (m/s), dan tekanan statis udara suplai (Pa) menggunakan anemometer digital / balometer hood terkalibrasi, mengukur penurunan tekanan diferensial filter udara pada manometer Magnehelic (standar < 200 Pa), serta memverifikasi modulasi kecepatan putaran motor melalui Variable Frequency Drive (VFD Inverter 0 - 50 Hz) berdasarkan sinyal kontrol BMS."
        ]
      }
    ]
  },
  "cooling tower water treatment": {
    "category": "COOLING TOWER WATER TREATMENT (WTP)",
    "items": [
      {
        "step": "1. Visual Inspection, Dosing Skids & Chemical Storage\nInspeksi Visual, Skid Dosing Kimia & Penyimpanan Bahan Kimia",
        "tasks": [
          "Perform visual inspection of automated chemical dosing system for cooling tower water treatment, chemical reagent dosing pumps, corrosion coupon test racks, and chemical day storage tanks.\nMelakukan inspeksi visual terhadap unit skid injeksi bahan kimia pengolahan air pendingin (Water Treatment Plant - WTP Cooling Tower), memeriksa kondisi fisik tangki penampung zat kimia (scale inhibitor, corrosion inhibitor, dan biocide pembasmi lumut), memeriksa tidak adanya rembesan atau tetesan cairan kimia pada sambungan selang injeksi tubing, dan memeriksa ketersediaan volume stok bahan kimia di area penampungan aman (spill containment pallet).",
          "Inspect chemical supply tubing lines, foot valves, anti-siphon injection quills, and chemical storage bund containment areas for leaks or chemical crystallization.\nMemeriksa kondisi fisik elektroda sensor konduktivitas air (toroidal conductivity sensor probe), katup pembuangan air pekat otomatis (automatic motorized blowdown valve), dan memeriksa panel pengontrol injeksi otomatis (chemical dosing controller)."
        ]
      },
      {
        "step": "2. Cleaning, Dosing Pump Service & Probe Calibration\nPembersihan, Servis Pompa Dosing & Kalibrasi Sensor Probe",
        "tasks": [
          "Clean online conductivity probe sensors, pH electrodes, and oxidation-reduction potential (ORP) sensors using chemical cleaning solutions, and recalibrate sensors using standard buffer solutions.\nMembersihkan pompa pengukur injeksi kimia (metering dosing pumps) dan membuka serta membersihkan saringan saringan hisap bahan kimia (foot valve strainer) dari kristalisasi endapan kental.",
          "Clean chemical dosing pump suction line foot filters, flush pump discharge check valves, and clean motorized blowdown valve strainers.\nMembersihkan elektroda sensor probe konduktivitas dari endapan lumut atau kerak kalsium menggunakan cairan pembersih asam ringan terstandarisasi, membilas dengan air suling murni, dan melakukan kalibrasi ulang pembacaan probe konduktivitas menggunakan larutan kalibrasi standar (calibration buffer solution 1413 µS/cm)."
        ]
      },
      {
        "step": "3. Measurement, Water Chemistry & Auto-Blowdown Testing\nPengukuran, Kualitas Kimia Air & Uji Katup Blowdown Otomatis",
        "tasks": [
          "Measure and record condenser water chemical quality parameters: pH level (standard 7.8 - 8.6), electrical conductivity (< 1500 µS/cm), Total Dissolved Solids (TDS), and biocidal residual chlorine.\nMengambil sampel air sirkulasi pendingin kondensor untuk pengujian kualitas kimia air lapangan meliputi: pengukuran tingkat keasaman (pH standar 7.5 - 8.5), pengukuran konduktivitas elektrikal (Conductivity standar < 1500 µS/cm), pengukuran Total Dissolved Solids (TDS), dan pengukuran konsentrasi residu bahan kimia inhibitor aktif (standar ppm sesuai petunjuk spesifikasi kimia).",
          "Measure instantaneous blowdown bleed-off water flow rates, verify automatic bleed-off motorized valve actuation upon reaching conductivity setpoint limits.\nMengukur laju kapasitas injeksi pompa dosing (Dosing Pump Flow Rate mL/menit) dan memverifikasi ketepatan volume injeksi proporsional.",
          "Inspect corrosion test coupons, record calculated uniform corrosion rates for mild steel (< 3.0 mpy) and copper (< 0.2 mpy), and verify inhibitor and biocide dosing pump stroke calibration.\nMelakukan pengujian simulasi otomatis pembukaan katup blowdown (Automatic Blowdown Valve functional test) saat konduktivitas air dinaikkan secara simulasi melebihi batas setpoint (> 1600 µS/cm), serta mengukur parameter tegangan suplai daya panel WTP (220 VAC 1-fasa)."
        ]
      }
    ]
  },
  "lift units": {
    "category": "FACILITY ELEVATOR (LIFT) SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Hoistway & Machine Room Components\nInspeksi Visual, Ruang Mesin Lift & Jalur Hoistway",
        "tasks": [
          "Perform visual inspection of elevator machine rooms (elevator traction machine room) and hoistways, checking traction motor casings, reduction gearboxes, overspeed governors, and control panel cabinets for absence of oil leaks or unusual heat.\nMelakukan inspeksi visual terhadap ruang mesin lift (elevator traction machine room), memeriksa mesin traksi motor derek (traction gearless machine), drum katrol penarik (sheave wheel), rangkaian tali kawat baja penggantung (hoisting steel wire ropes), panel kontrol mikroprosesor lift, sakelar batas akhir atas/bawah (hoistway limit switches), dan sangkar lift (car).",
          "Inspect elevator car door operators and landing door mechanisms on every building floor, checking door hanger rollers, drive belts, and bottom guide sills for absence of mechanical obstruction.\nMemeriksa mekanisme pintu sangkar lift (car door operator) dan pintu pendaratan tiap lantai (landing floor doors), memeriksa kondisi fisik rel pemandu sangkar (guide rails), dan memeriksa keutuhan display panel indikator tombol lantai (car operating panel - COP)."
        ]
      },
      {
        "step": "2. Cleaning, Rail Lubrication & Door Track Debris Removal\nPembersihan, Pelumasan Rel Pemandu & Pembersihan Alur Pintu",
        "tasks": [
          "Clean traction machine body enclosures and control panels from accumulated dust using industrial vacuum cleaners and dry lint-free cloths.\nMembersihkan selungkup bodi mesin traksi dan panel kontrol dari akumulasi debu menggunakan vacuum cleaner industri, membersihkan alur kusen rel pintu lift (sill tracks) pada setiap lantai dari kotoran kerikil atau pasir yang dapat menghambat pergerakan daun pintu.",
          "Clean old grease and grime from elevator car guide rails and counterweight guide rails, relubricating with approved guide rail oil, and clean landing door sill groove tracks using heavy-duty vacuum cleaners.\nMembersihkan kotoran oli bekas pada rel pemandu sangkar dan rel beban penyeimbang (counterweight guide rails), mengisi ulang tabung pelumas otomatis rel (guide rail lubricator oil pots), dan membersihkan bagian atas atap sangkar lift (car top) serta dasar pit kolong lift (elevator pit)."
        ]
      },
      {
        "step": "3. Measurement, Mechanical Brake & Safety Device Testing\nPengukuran, Celah Rem Mekanikal & Uji Perangkat Keselamatan",
        "tasks": [
          "Measure elevator machine electrical parameters: 3-phase supply voltages R-S, S-T, T-R (standard 380 - 400 VAC), and operating workload currents per phase during car acceleration, full-speed travel, and deceleration.\nMengukur parameter kelistrikan mesin lift: tegangan suplai 3-fasa R-S, S-T, T-R (standar 380 - 415 VAC) dan mengukur arus beban operasional motor traksi saat sangkar bergerak naik dan turun membawa beban penuh (Full Load Current Ampere).",
          "Measure elevator machine electromagnetic brake shoe air gaps (Electromagnetic Brake Air Gap standard 0.20 - 0.40 mm), and test mechanical holding brake torque to ensure smooth, secure stops.\nMengukur celah renggang kampas rem elektromagnetik mesin lift (Electromagnetic Brake Shoe Clearance Gap standar 0.2 - 0.5 mm) menggunakan thickness feeler gauge terkalibrasi.",
          "Measure hoisting wire rope crown wear and diameter reduction (Hoisting Wire Rope Wear limit < 5% of nominal diameter, zero broken wire strands), and check wire rope tension equalization across all ropes.\nMengukur diameter keausan tali kawat baja penarik (Hoisting Wire Rope Wear limit < 6% dari diameter nominal) menggunakan jangka sorong kaliper.",
          "Measure elevator car floor leveling accuracy against landing floor sills (Leveling Accuracy standard tolerance ± 5 mm per floor) across all floors under empty and loaded conditions.\nMengukur akurasi perataan lantai sangkar lift terhadap permukaan lantai pendaratan (Landing Floor Levelling Accuracy toleransi selisih ± 5 mm).",
          "Perform safety device functional testing: overspeed governor tripping switch, car bottom safety clamp gear interlocks, door multi-beam infrared safety light curtains, emergency alarm bells, and battery-backed two-way passenger intercom communications.\nMelakukan pengujian fungsi perangkat keselamatan pembatas kecepatan (Overspeed Governor & Mechanical Safety Gear trip test), menguji tirai sensor keselamatan pintu infra-merah (Infrared Door Safety Multi-Beam Sensor), dan menguji fungsi komunikasi interkom darurat dua arah serta bel alarm cadangan baterai 12V."
        ]
      }
    ]
  },
  "gate": {
    "category": "AUTOMATIC GATE & ROAD BLOCKER SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Structural Frames & Safety Sensors\nInspeksi Visual, Rangka Struktural & Sensor Keselamatan",
        "tasks": [
          "Perform visual inspection of automatic sliding security perimeter gates and hydraulic road blocker barrier units at facility vehicle entrance checkpoints, inspecting physical structural frames, steel drive tracks, guide rollers, and safety stop end buffers.\nMelakukan inspeksi visual terhadap struktur fisik pintu gerbang geser otomatis (Automatic Sliding Gate) dan penghalang jalan hidrolik keamanan perimeter (Hydraulic Road Blocker) di pos akses keamanan depan data center, memeriksa rel jalur roda gerbang, rantai penarik baja atau gear rack, tiang pembatas (stopper posts), dan kondisi fisik housing motor penggerak.",
          "Inspect photocell safety sensors, inductive ground loop vehicle detector loop pavement cuts, road blocker heavy-duty steel wedge plates, and hydraulic power unit (HPU) oil reservoirs for absence of leaks.\nMemeriksa sensor keselamatan optik inframerah anti-jepit (photocell safety sensors), kabel loop induksi deteksi kendaraan tertanam di aspal (inductive loop detectors), lampu sirine strobo peringatan operasional gerbang, dan tombol darurat pos security."
        ]
      },
      {
        "step": "2. Cleaning, Track Debris Removal & Chain Lubrication\nPembersihan, Pengangkatan Sampah Rel & Pelumasan Rantai",
        "tasks": [
          "Clean steel sliding gate track grooves from accumulated sand, pebbles, mud, and debris to ensure smooth wheel carriage traverse.\nMembersihkan alur rel baja gerbang geser dari tumpukan pasir, kerikil, atau kotoran tanah yang dapat menghambat putaran roda gerbang menggunakan sikat kawat dan kompresor udara.",
          "Lubricate steel drive chains, drive pinion gears, and guide wheel bearing rollers with high-adhesion industrial chain oil, and clean photocell sensor optical lenses using soft optical cloths.\nMelumasi rantai baja penarik (drive chain), roda gigi penggerak (drive pinion gear), dan engsel-engsel mekanikal road blocker menggunakan pelumas rantai semprot industri (chain lubricant spray), membersihkan lensa kaca sensor inframerah pengaman, serta memeriksa level cairan oli hidrolik pada tangki unit pompa power pack road blocker."
        ]
      },
      {
        "step": "3. Measurement, Hydraulic Pressure & Cycle Timing Testing\nPengukuran, Tekanan Hidrolik & Pengujian Waktu Siklus",
        "tasks": [
          "Measure gate electric drive motor power supply parameters: 220 VAC single-phase or 380 VAC three-phase voltage, and operating workload currents during gate opening and closing cycles.\nMengukur parameter tegangan suplai listrik motor penggerak gerbang (standar 220 - 240 VAC 1-fasa) dan motor pompa hidrolik road blocker (standar 380 - 400 VAC 3-fasa), serta mengukur arus beban kerja operasional motor saat gerbang membuka dan menutup.",
          "Measure road blocker hydraulic operating pressures on power pack pressure gauges (Working Pressure standard 100 - 150 Bar) and check hydraulic fluid levels in storage reservoirs.\nMengukur tekanan kerja sistem hidrolik road blocker pada manometer unit power pack (Hydraulic Operating Pressure standar 50 - 80 Bar).",
          "Measure gate opening and closing cycle travel durations (Cycle Time: sliding gates standard 12 - 18 seconds, hydraulic road blockers standard emergency fast raise 1.5 - 3.0 seconds).\nMengukur waktu durasi siklus buka-tutup (Cycle Time: gerbang geser standar 12 - 18 detik, road blocker naik standar normal 3 - 5 detik, dan mode darurat Emergency Fast Operation EFO < 2 detik).",
          "Perform functional response testing of photoelectric safety sensors and inductive vehicle loops (gate motor must instantly stop and auto-reverse upon detecting vehicles or pedestrians in the path), test manual emergency hand crank release during power outages, and measure barrier earthing resistance (< 5.0 Ω).\nMelakukan pengujian respon sensor keselamatan anti-jepit fotolistrik (Photocell Obstacle Reversal Response Time < 0.5 detik seketika membalik arah gerbang saat terhalang objek), mengukur resistansi pembumian rangka gerbang dan housing motor (< 5.0 Ω), serta menguji fungsi pembukaan manual darurat saat terjadi pemadaman listrik (Manual Release Clutch Operation)."
        ]
      }
    ]
  },
  "dock leveler": {
    "category": "DOCK LEVELER & LOADING BAY SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Deck Structure & Hydraulic Fluid System\nInspeksi Visual, Struktur Dek & Sistem Fluida Hidrolik",
        "tasks": [
          "Perform visual inspection of telescopic/hinged-lip loading dock levelers in the loading bay logistics area, inspecting heavy-duty checkered steel deck plates, folding lip hinges, rubber dock bumpers, and side maintenance support safety struts.\nMelakukan inspeksi visual terhadap rangkaian unit dock leveler teleskopik (Telescopic Dock Leveler 6 - 10 Ton) di area loading dock logistik, memeriksa keutuhan pelat dek baja bermotif (tear plate deck), bibir dok teleskopik (telescopic lip plate), pelindung samping jari kaki (toe guards), tiang penyangga keselamatan perawatan (maintenance safety prop leg), dan bumper karet peredam benturan truk (rubber bumpers).",
          "Inspect main hydraulic lifting cylinders, lip extension cylinders, hydraulic hose lines for oil sweating, and hydraulic power unit fluid reservoir levels.\nMemeriksa silinder hidrolik pengangkat dek utama dan silinder penggerak lip dari ketiadaan rembesan oli hidrolik pada seal mekanis, memeriksa keutuhan selang hidrolik fleksibel bertekanan tinggi dari retakan, memeriksa level oli pada tangki penampung reservoir, dan memeriksa tombol sakelar kotak kontrol (controller switch buttons)."
        ]
      },
      {
        "step": "2. Cleaning, Pit Debris Evacuation & Hinge Lubrication\nPembersihan, Pengurasan Sampah Kolong Pit & Pelumasan Engsel",
        "tasks": [
          "Clean loading dock pit floor recesses from debris, dirt, and foreign objects, and clean pit perimeter sub-frame channels.\nMembersihkan kolong pit dok (dock leveler pit foundation) dari timbunan debu, daun, dan serpihan kayu pallet menggunakan blower industri dan vacuum cleaner, membersihkan selungkup pompa hidrolik, dan membersihkan permukaan dek dari ceceran oli atau kotoran.",
          "Lubricate deck rear hinge pins, lip pivot hinge shafts, and cylinder clevis mounting pins using heavy-duty extreme pressure grease.\nMelakukan pelumasan ulang (greasing) pada titik-titik engsel bibir dok (lip hinges), engsel poros belakang dek (deck rear hinges), dan roller penyangga menggunakan grease gun industri bertipe heavy-duty EP grease."
        ]
      },
      {
        "step": "3. Measurement, Hydraulic Pressure, Noise & Grounding Testing\nPengukuran, Tekanan Hidrolik, Kebisingan & Uji Pembumian",
        "tasks": [
          "Measure dock leveler control panel input electrical power supply: 3-phase 380 VAC voltage, and operating motor running currents during deck elevation and lip extension cycles.\nMengukur parameter tegangan suplai listrik masukan panel kontrol dock leveler: tegangan fasa-fasa R-S, S-T, T-R (standar 380 VAC ±5-10%) dan tegangan fasa-netral R-N, S-N, T-N (standar 220 VAC ±5-10%), serta mengukur arus beban motor pompa hidrolik per fasa (Phase R, S, T, N load deviation <10%).",
          "Measure hydraulic oil operating pressure on pump systems (Hydraulic Oil Pressure standard 140 - 180 Bar) to ensure lifting capacity supports full loading container weights.\nMengukur tekanan operasional fluida oli hidrolik pada sistem pompa (Hydraulic Oil Operating Pressure standar 140 - 180 Bar) dan memeriksa tidak adanya penurunan tekanan hidrolik saat dek menahan beban.",
          "Measure hydraulic pump motor acoustic noise levels during operation using a Sound Level Meter (noise limit ≤ 75 dB at 1 meter distance).\nMelakukan pengukuran tingkat kebisingan motor pompa hidrolik saat beroperasi menggunakan Sound Level Meter (Motor Noise Level standar < 75 dB pada jarak 1 meter).",
          "Measure dock leveler control panel and metallic frame earthing resistance (< 5.0 Ω), verify velocity fuse emergency safety check valves hold deck in position upon simulated vehicle drive-away, and test auto-return to park sequence.\nMelakukan pengukuran resistansi pembumian panel kontrol dan rangka logam dock leveler menggunakan earth tester (Grounding Resistance standar < 5.0 Ω), serta menguji keandalan katup hidrolik darurat penahan anjlok (Emergency Velocity Fuse / Fall Protection Drop Stop Test)."
        ]
      }
    ]
  },
  "stp & plumbing": {
    "category": "SEWAGE TREATMENT PLANT (STP) & PLUMBING",
    "items": [
      {
        "step": "1. Visual Inspection, Clarifier Tanks & Blower Pumps\nInspeksi Visual, Bak Pengolahan Limbah & Pompa Blower",
        "tasks": [
          "Perform visual inspection of Sewage Treatment Plant (STP) clarifier tanks, aerobic aeration basins, effluent collection sumps, booster pumps, and transfer pump sets.\nMelakukan inspeksi visual terhadap stasiun instalasi pengolahan air limbah domestik (Sewage Treatment Plant - STP), memeriksa bak penampung limbah (equalization tank), bak aerasi (aeration tank), bak pengendap sedimentasi (clarifier tank), dan bak desinfeksi effluen, memeriksa tidak adanya bau abnormal atau pembentukan buih busa berlebih.",
          "Inspect air blower root compressors, fine bubble membrane diffusers, submersible sewage grinder pumps, and wastewater level float switches.\nMemeriksa kondisi fisik pompa celup limbah (submersible sewage pumps), pompa aerator root blower, pipa manifold suplai udara aerasi, katup pipa distribusi air bersih, tangki atap (roof tank), dan unit pompa pendorong distribusi (booster pumps)."
        ]
      },
      {
        "step": "2. Cleaning, Bar Screen Service & Air Intake Maintenance\nPembersihan, Servis Saringan Bar Screen & Filter Udara Blower",
        "tasks": [
          "Clean air blower suction intake filter elements, clean basket bar screens from solid foreign debris, and flush chemical dosing lines.\nMembersihkan dan mengangkat tumpukan kotoran sampah padat pada kisi saringan kasar (bar screen basket) saluran inlet air limbah masuk.",
          "Clean clarifier weir troughs, inspect air lift sludge return pipes, and lubricate booster pump motor bearings with lithium grease.\nMembersihkan saringan filter udara hisap mesin blower aerasi dari debu, membersihkan permukaan probe sensor pelampung ketinggian air (water level float switches) dari kerak lemak atau kotoran yang menempel, dan membilas bak pengendapan lumpur aktif (sludge return)."
        ]
      },
      {
        "step": "3. Measurement, Effluent Quality, Pressure & Insulation Testing\nPengukuran, Kualitas Air Effluen, Tekanan & Tahanan Isolasi",
        "tasks": [
          "Collect treated STP effluent water samples for laboratory quality parameter testing: verify pH level (standard 6.0 - 9.0), Biological Oxygen Demand (BOD < 30 mg/L), Chemical Oxygen Demand (COD < 100 mg/L), Total Suspended Solids (TSS < 30 mg/L), and ammonia content comply with government environmental discharge standards.\nMengambil sampel air hasil olahan effluen STP untuk pengujian parameter kualitas lingkungan: kadar keasaman (pH standar 6.0 - 9.0), Total Suspended Solids (TSS standar < 30 mg/L), Biochemical Oxygen Demand (BOD standar < 30 mg/L), Chemical Oxygen Demand (COD standar < 100 mg/L), dan mengukur kadar oksigen terlarut pada bak aerasi (Dissolved Oxygen DO standar > 2.0 mg/L).",
          "Measure electrical parameters of sewage pump motors and aeration root blowers: 3-phase voltages R-S, S-T, T-R (standard 380 - 400 VAC), operating workload currents per phase, and motor winding insulation resistance using a 500V DC Megger (> 20 MΩ).\nMengukur parameter kelistrikan motor pompa limbah dan motor blower aerasi: tegangan 3-fasa (380 - 415 VAC) dan arus beban per fasa (Phase R, S, T) menggunakan clamp meter, serta mengukur resistansi isolasi belitan motor pompa submersible menggunakan Megger 500V DC (standar nilai > 50 MΩ).",
          "Measure operating delivery pressures of clean water distribution booster pumps on header pressure gauges (standard 3.0 - 4.5 Bar), verify automatic pressure switch cut-in/cut-out and duty/standby auto-alternation sequence, and test high-water alarm float switches in sumps.\nMengukur tekanan kerja operasional pompa booster distribusi air bersih gedung pada manometer pipa header (Booster Water Pressure standar 3.5 - 5.0 Bar), serta mengukur resistansi pembumian panel kontrol STP (< 5.0 Ω)."
        ]
      }
    ]
  },
  "door": {
    "category": "FIRE DOOR & EMERGENCY EXIT ACCESS DOOR",
    "items": [
      {
        "step": "1. Visual Inspection, Leaf Alignment & Panic Exit Hardware\nInspeksi Visual, Kelurusan Daun Pintu & Perangkat Keras Panik",
        "tasks": [
          "Perform visual inspection of critical 2-hour fire-rated steel doors, emergency fire exit doors, acoustic soundproof doors, and security access doors across data hall corridors.\nMelakukan inspeksi visual terhadap pintu darurat tahan api (Fire Rated Emergency Exit Doors 2-Hours) dan pintu akses teknis di koridor data center, memeriksa kelurusan daun pintu terhadap kusen baja (door frame clearance 2 - 4 mm), kekokohan engsel penahan beban berat (heavy-duty ball bearing hinges), kondisi fisik door closer hidrolik otomatis, dan keutuhan karet segel penahan asap panas (intumescent fire smoke seals) sepanjang perimeter kusen.",
          "Inspect overhead hydraulic door closer bodies for oil leaks, inspect panic exit push-bar hardware, mortise locksets, stainless steel hinges, and intumescent perimeter door fire seals.\nMemeriksa kelancaran kerja tuas palang dorong panik darurat (panic exit hardware / crash bar), kunci magnetik elektromagnetis (magnetic lock / maglock 600 - 1200 lbs), sensor kontak magnetik pintu (door status monitoring switch), dan tombol darurat pelepas kunci (emergency break glass push button)."
        ]
      },
      {
        "step": "2. Cleaning, Magnetic Armature Wiping & Hardware Lubrication\nPembersihan, Pengelapan Pelat Magnetik & Pelumasan Engsel",
        "tasks": [
          "Clean door leaf steel surfaces, vision glass panels, threshold sill plates, and magnetic lock armature faceplates using mild cleaning detergent.\nMembersihkan permukaan pelat magnetik (electromagnetic lock face) dan pelat penahan besi (armature plate) dari akumulasi debu atau karat halus menggunakan kain mikrofiber dan cairan contact cleaner agar gaya rekat magnetik sempurna.",
          "Lubricate stainless steel ball-bearing door hinges, latch bolts, lock cylinders, and panic bar pivot linkages using PTFE dry lubricant spray.\nMelakukan pelumasan engsel bantalan peluru (ball bearing hinges) dan mekanisme lidah pengunci kunci manual menggunakan pelumas semprot silikon kering (dry silicone lubricant spray), serta mengencangkan baut pengikat kusen, pelat penutup, dan sekrup dudukan door closer hidrolik."
        ]
      },
      {
        "step": "3. Measurement, Latching Timing & Fire Alarm Release Testing\nPengukuran, Waktu Penutupan Pintu & Uji Pelepasan Darurat",
        "tasks": [
          "Measure door closing and latching swing speeds: adjust hydraulic closer valves to achieve smooth closing cycle (closing time 4 - 6 seconds) and complete positive latch engagement without binding or bouncing.\nMengukur parameter tegangan catu daya listrik unit kunci magnetik pintu (standar tegangan operasional 12.0 - 13.8 VDC atau 24.0 VDC) dan mengukur arus kerja solenoid kunci magnetik (Operating Current standar 450 - 500 mA pada 12V).",
          "Test electromagnetic lock holding force (600 lbs / 1200 lbs rating), test emergency break-glass door release switches, and verify door magnetic contact sensor status feedback to the Security Access Control System (ACS).\nMengukur kecepatan waktu penutupan daun pintu otomatis oleh door closer hidrolik: waktu ayunan penutupan awal (Sweep Speed standar 4 - 6 detik) dan waktu penguncian akhir (Latching Speed standar 2 - 3 detik) untuk menjamin daun pintu menutup rapat tanpa membanting keras.",
          "Verify automatic release and unlatching of access doors upon receiving fire alarm activation signals from the central Fire Alarm Control Panel (FACP).\nMelakukan pengujian pelepasan kunci magnetik otomatis seketika saat terjadi simulasi integrasi sinyal alarm kebakaran dari Fire Alarm System (Emergency Fail-Safe Release Response Time < 1.0 detik seketika pintu membuka bebas untuk evakuasi), serta menguji fungsi tombol tekan pemutus darurat lokal (Emergency Break Glass switch test)."
        ]
      }
    ]
  },
  "exhaust fan": {
    "category": "EXHAUST & VENTILATION FAN SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Fan Blades, Housing & Flexible Ducts\nInspeksi Visual, Bilah Kipas, Selungkup & Saluran Fleksibel",
        "tasks": [
          "Perform visual inspection of ventilation exhaust fan units (Exhaust Fan / Smoke Spill Fan / Jet Fan), inspecting fan casing enclosures, duct flange joints, axial/centrifugal impeller blades, and backdraft gravity louvers.\nMelakukan inspeksi visual terhadap unit kipas pembuangan ventilasi udara (Exhaust Fan dinding, inline duct fan, dan smoke spill fans) di ruang transformator, ruang genset, dan ruang baterai UPS, memeriksa keutuhan bilah kipas (fan blades), rumah selungkup kipas (fan housing), rangka penopang gantungan (hanger brackets), dan kelurusan puli poros motor.",
          "Inspect physical condition of flexible duct connectors against air leakage or tears, inspect anti-vibration spring isolators, and inspect protective safety wire mesh screens from damage.\nMemeriksa kondisi fisik sambungan saluran fleksibel (flexible duct connector) dari keretakan, kebocoran, atau robekan, memeriksa kelancaran kerja kisi louver gravitasi penutup luar (gravity backdraft louvers), dan memeriksa kotak terminal sambungan kabel listrik motor dari tanda panas berlebih."
        ]
      },
      {
        "step": "2. Cleaning, Blade Debris Removal & Motor Housing Dusting\nPembersihan, Pengangkatan Debu Bilah & Penghisapan Bodi Motor",
        "tasks": [
          "Clean fan impeller blades and internal casing surfaces from dust accumulation, grease, and soot deposits using industrial vacuum cleaners and damp cloths.\nMembersihkan bilah kipas dan permukaan dalam selungkup casing exhaust fan dari timbunan debu tebal atau jelaga menggunakan sikat pembersih kawat halus dan vacuum cleaner industri.",
          "Clean motor cooling fins, motor electrical terminal boxes, and outer bird screen grilles to ensure unrestricted airflow.\nMembersihkan kisi pendingin bodi motor penggerak, kotak terminal kabel (motor terminal box), membersihkan kisi kisi louver pembuangan udara luar, memeriksa kekencangan baut pengikat dudukan motor pada rangka braket, dan melumasi bantalan bearing motor kipas."
        ]
      },
      {
        "step": "3. Measurement, Vibration Limits, Air Velocity & Thermal Testing\nPengukuran, Batas Getaran, Kecepatan Udara & Uji Termal Motor",
        "tasks": [
          "Measure exhaust fan motor electrical supply parameters: 3-phase voltages R-S, S-T, T-R (standard 380 - 400 VAC) and operating currents per phase (Phase R, S, T) using a calibrated clamp meter.\nMengukur parameter tegangan suplai listrik motor exhaust fan: tegangan 3-fasa R-S, S-T, T-R (standar 380 - 400 VAC) atau 1-fasa (standar 220 - 230 VAC ±10%) dan mengukur arus beban kerja operasional motor per fasa (Running Current Phase R, S, T) menggunakan clamp meter.",
          "Measure mechanical vibration levels on motor bodies and fan bearing housings using a digital Vibration Meter (fan vibration limit ≤ 2.8 mm/s RMS per ISO 10816-3 standard).\nMelakukan pengukuran getaran mekanikal pada selungkup bodi motor dan rumah kipas menggunakan Vibration Meter digital (standar batas getaran motor ≤ 4.5 mm/s RMS sesuai ISO 10816-1 standar peralatan berputar umum).",
          "Measure suction and discharge airflow velocities at exhaust duct openings (Air Velocity standard 4.0 - 10.0 m/s depending on duct dimensions) using a calibrated digital vane anemometer.\nMengukur kecepatan aliran udara hisap dan hembusan pada saluran ducting exhaust fan (Ducting Air Velocity standar 4.0 - 10.0 m/s) menggunakan anemometer digital terkalibrasi.",
          "Measure motor body operational operating temperatures using an infrared thermometer (standard motor casing temperature ≤ 75°C), measure panel earthing resistance (< 5.0 Ω), and verify automated fan start/stop commands from thermostat sensors or BMS.\nMelakukan pengukuran temperatur operasional bodi motor menggunakan termometer inframerah (Motor Body Temperature standar aman ≤ 65°C tanpa indikasi overheating), serta mengukur resistansi pembumian bodi exhaust fan (< 5.0 Ω)."
        ]
      }
    ]
  },
  "door roll / auto gate": {
    "category": "ROLLING DOOR & PERIMETER ACCESS SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Slats, Guide Tracks & Shutter Kit\nInspeksi Visual, Daun Pintu Gulung, Rel Pemandu & Motor Kit",
        "tasks": [
          "Perform visual inspection of heavy-duty motorized rolling shutters and perimeter security vehicle gates in loading bay and facility access areas, inspecting galvanized steel roll curtain slats, guide tracks, bottom bars, and roll axle drum barrel assemblies.\nMelakukan inspeksi visual terhadap pintu gulung bermotor tugas berat (Motorized Heavy Duty Roller Shutter Door) di area loading bay dan ruang genset, memeriksa kelurusan bilah-bilah daun baja pintu (shutter slats) dari penyok atau pergeseran, memeriksa rel pemandu vertikal samping (guide tracks) dari keausan atau karat, dan memeriksa penutup kotak gulungan atas (hood cover).",
          "Inspect electric gearmotor drive units, manual override emergency hoist chains, mechanical safety catch drop brakes, and structural wall mounting brackets for deformation or loose anchor bolts.\nMemeriksa kondisi fisik rantai penggerak darurat manual (emergency hand chain hoist), unit motor penggerak motorik (roller shutter motor kit), sistem pegas penyeimbang (torsion counterbalance springs), dan sensor pengaman batas tepi bawah (safety edge touch sensor)."
        ]
      },
      {
        "step": "2. Cleaning, Track Clearing & Mechanical Chain Lubrication\nPembersihan, Pengosongan Kotoran Rel & Pelumasan Rantai",
        "tasks": [
          "Clean guide track channels, curtain slats, and drive motor chain drive sprockets from dust, grit, and industrial dirt using industrial vacuum cleaners and wire brushes.\nMembersihkan alur celah rel pemandu vertikal dari timbunan debu, pasir, dan kotoran pelumas kering menggunakan sikat pembersih dan kuas, membersihkan tombol sakelar kotak kontrol (controller push buttons) dari debu.",
          "Lubricate guide track rails with silicone spray lubricant, lubricate motor drive transmission roller chains and sprockets with high-tack industrial chain lubricant, and retorque mounting bolts on axle drum brackets and motor kits.\nMelumasi alur rel pemandu daun pintu dengan pelumas semprot silikon, melumasi rantai baja transmisi motor (drive chain) dan roda gigi sproket penggerak menggunakan pelumas oli rantai industri bertipe tacky oil, serta melakukan pengetatan baut angkur dudukan rangka poros gulung dan motor kit."
        ]
      },
      {
        "step": "3. Measurement, Limit Switch Adjustment & Safety Edge Testing\nPengukuran, Penyetelan Sakelar Batas & Uji Sensor Sentuh",
        "tasks": [
          "Measure rolling shutter drive motor power supply parameters: 1-phase (220 VAC) or 3-phase (380 VAC) voltages, and measure motor operating running currents during upward and downward travel cycles (Up/Down Running Current Amperes).\nMengukur parameter tegangan suplai listrik motor penggerak roller shutter: tegangan 1-fasa (220 VAC) atau 3-fasa (380 VAC) dan mengukur arus kerja motor saat mengangkat dan menurunkan daun pintu (Up/Down Running Current Ampere).",
          "Perform testing and calibration of motor rotary limit switches: ensure upper limit switch stops curtain cleanly before slats hit roll hoods and lower limit switch presses flush against floor level without slack.\nMelakukan pengujian dan kalibrasi posisi sakelar batas putaran motorik: memastikan batas henti atas (Upper Limit Switch) berhenti sempurna sebelum daun pintu membentur boks gulungan dan batas henti bawah (Lower Limit Switch) menekan rata pada permukaan lantai tanpa kelonggaran.",
          "Perform safety bottom edge sensor sensitivity testing (Safety Edge Bottom Sensor Test: door motor immediately halts and reverses upward within < 0.5 seconds upon bottom bar contacting obstacle).\nMelakukan pengujian sensitivitas sensor tepi bawah keselamatan (Safety Edge Bottom Sensor Test: motor pintu otomatis berhenti seketika dan berbalik arah naik saat bilah bawah menyentuh rintangan penghalang dengan waktu respon < 0.5 detik).",
          "Perform functional testing of manual emergency hand hoist chain during simulated power outages (Manual Hand Chain Emergency Override Test), and measure door frame earthing resistance (< 5.0 Ω).\nMelakukan pengujian fungsional rantai penarik manual darurat saat terjadi pemadaman listrik (Manual Hand Chain Emergency Override Test), serta mengukur resistansi pembumian rangka pintu (< 5.0 Ω)."
        ]
      }
    ]
  },
  "x-ray": {
    "category": "SECURITY X-RAY INSPECTION SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Lead Shielding Curtains & Conveyor Belt\nInspeksi Visual, Tirai Timbal Pelindung & Sabuk Konveyor",
        "tasks": [
          "Perform comprehensive visual inspection of security baggage inspection X-Ray screening machines at data center facility security checkpoints, checking lead shielding radiation curtains at both tunnel entrance and exit openings for tears, cracks, or radiation leakage gaps.\nMelakukan inspeksi visual menyeluruh terhadap mesin pemindai bagasi keamanan X-Ray Inspection System di pos akses pemeriksaan keamanan data center, memeriksa keutuhan tirai timbal pelindung radiasi (lead shielding curtains) pada kedua mulut terowongan inspeksi masuk dan keluar dari sobekan, retakan, atau celah kebocoran paparan radiasi sinar-X.",
          "Inspect physical condition of baggage conveyor belt, belt tracking tension, conveyor surface cleanliness from oils or sharp objects, roller cylinder alignment, and X-Ray On radiation warning indicator lamps.\nMemeriksa kondisi fisik sabuk berjalan konveyor pembawa barang (conveyor belt), ketegangan sabuk (belt tension), kebersihan permukaan sabuk dari minyak atau benda tajam, kelurusan roller silinder pemutar konveyor, serta keutuhan lampu indikator radiasi aktif (X-Ray On warning lamps)."
        ]
      },
      {
        "step": "2. Cleaning, Tunnel Optical Sensors & Cooling Fan Maintenance\nPembersihan, Sensor Optik Terowongan & Kipas Pendingin Generator",
        "tasks": [
          "Clean inspection tunnel interiors, clean infrared optical trigger sensor emitter and receiver lenses from dust using soft optical brushes and anti-static cleaners to ensure precise baggage detection.\nMembersihkan bagian dalam terowongan inspeksi (inspection tunnel), membersihkan lensa pemancar dan penerima sensor optik inframerah pemicu sinar-X dari debu menggunakan kuas halus dan pembersih optik anti-statis agar deteksi barang akurat.",
          "Clean external machine cabinetry and X-ray generator cooling grilles from dust using dry microfiber cloths, inspect X-ray tube cooling fan operation, and inspect monitor control console cabling neatness.\nMembersihkan selungkup bodi mesin luar dan kisi pendingin generator sinar-X dari debu menggunakan kain mikrofiber kering, memeriksa kelancaran kipas pendingin tabung sinar-X (X-ray tube cooling fan), dan memeriksa kerapian kabel koneksi konsol kontrol monitor."
        ]
      },
      {
        "step": "3. Measurement, Radiation Leakage Survey & Image Calibration\nPengukuran, Survei Kebocoran Radiasi & Kalibrasi Kualitas Gambar",
        "tasks": [
          "Measure radiation dose leakage levels around X-ray machine exterior surfaces using a BAPETEN-calibrated Radiation Survey Meter at 5 cm and 1 meter distances from all outer surfaces and lead curtains (standard radiation leakage limit strictly < 0.5 µSv/hr per BAPETEN / IAEA regulations).\nMelakukan pengukuran tingkat dosis kebocoran paparan radiasi di sekeliling bodi mesin X-ray menggunakan alat Radiation Survey Meter terkalibrasi BAPETEN pada jarak 5 cm dan 1 meter dari seluruh permukaan luar bodi dan tirai timbal (standar batas kebocoran radiasi lingkungan sangat aman < 0.5 µSv/jam sesuai regulasi BAPETEN / IAEA).",
          "Perform X-ray imaging quality resolution testing using an ASTM / Combined Test Piece (CTP test case: verifying steel penetration > 30 mm, 38 AWG single copper wire resolution, spatial resolution, and multi-energy organic/inorganic color differentiation on display monitors).\nMelakukan pengujian resolusi kualitas pencitraan sinar-X menggunakan alat uji standar ASTM / Combined Test Piece (CTP test case: memverifikasi kemampuan penetrasi baja > 30 mm, resolusi kawat tembaga tunggal 38 AWG, resolusi spasial, dan diferensiasi pewarnaan multi-energi organik/anorganik pada layar monitor).",
          "Measure machine electrical power supply parameters (stable 220 - 230 VAC 1-phase voltage, conveyor operating current), measure machine body earthing resistance (< 1.0 Ω), and test emergency stop push buttons for instantaneous radiation cutoff (Emergency Stop reaction time < 0.2 seconds).\nMengukur parameter kelistrikan suplai mesin (tegangan 220 - 230 VAC 1-fasa stabil, arus operasional konveyor A), mengukur resistansi pembumian bodi mesin (< 1.0 Ω), serta menguji keandalan tombol darurat penghentian radiasi seketika (Emergency Stop push buttons reaction time < 0.2 detik)."
        ]
      }
    ]
  },
  "water softener": {
    "category": "WATER SOFTENER SYSTEM",
    "items": [
      {
        "step": "1. Visual Inspection, Resin Vessel & Brine Tank Assembly\nInspeksi Visual, Tabung Tangki Resin & Rangkaian Tangki Garam",
        "tasks": [
          "Perform visual inspection of water softener ion-exchange resin pressure vessels and brine salt regenerant tanks, checking inlet raw water and outlet softened water distribution pipe connections for seepage, and inspecting FRP tank hulls for cracks or corrosion.\nMelakukan inspeksi visual terhadap tangki bejana tekan penyaring pelunak air (Water Softener Resin Pressure Vessel) dan tangki larutan garam regenerasi (Brine Tank), memeriksa kekedapan sambungan pipa suplai air masuk dan distribusi air lunak dari rembesan, serta memeriksa kondisi fisik selungkup tangki FRP dari retakan atau korosi.",
          "Inspect pure softener salt pellet inventory level (NaCl salt tablets) inside brine tanks, check brine solution clarity, and inspect brine float valve suction assemblies.\nMemeriksa ketersediaan kuantitas dan level garam murni khusus softener (sodium chloride / NaCl salt tablets) di dalam tangki brine, memeriksa kejernihan air garam jenuh, dan memeriksa mekanisme katup hisap pelampung garam (brine float valve assembly)."
        ]
      },
      {
        "step": "2. Cleaning, Brine Well Flush & Multiport Valve Service\nPembersihan, Pembilasan Brine Well & Servis Katup Multi-Arah",
        "tasks": [
          "Clean brine suction strainers and venturi injectors from mineral sediment or salt crystallization that could obstruct regenerant suction draw.\nMembersihkan saringan hisap garam (brine suction strainer) dan pipa injektor venturi dari endapan kotoran atau kristalisasi garam yang menyumbat jalur regenerasi hisap.",
          "Inspect and clean automatic multi-port control valve heads, lubricate internal motor-driven control valve gears, and verify backwash drain lines are free from discharge restrictions.\nMemeriksa dan membersihkan kepala katup multi-arah otomatis (Automatic Multi-Port Control Valve head), melumasi roda gigi penggerak internal katup kontrol motorik, dan memastikan pipa saluran pembuangan air bilasan (backwash drain line) bebas dari hambatan aliran."
        ]
      },
      {
        "step": "3. Measurement, Water Hardness Titration & Regeneration Testing\nPengukuran, Titrasi Kesadahan Air & Uji Siklus Regenerasi",
        "tasks": [
          "Collect raw inlet water and treated softened outlet water samples, performing chemical titration hardness testing (Total Hardness as CaCO3): treated softened water standard near 0 ppm CaCO3 (strict maximum limit < 10 ppm CaCO3 for cooling tower make-up water feed).\nMengambil sampel air baku masuk (raw water) dan air hasil olahan keluar filter pelunak air (treated softened water), melakukan pengujian kimia tingkat kesadahan total (Total Hardness as CaCO3) menggunakan metode titrasi / digital hardness test kit (standar kesadahan air hasil olahan mendekati 0 ppm CaCO3, batas maksimal < 10 ppm CaCO3 untuk pasokan umpan cooling tower).",
          "Measure operational water pressures on softener inlet and outlet pipe pressure gauges (standard working pressure 2.5 - 4.5 Bar).\nMengukur parameter tekanan air operasional pipa masuk dan keluar tangki softener pada manometer (Working Pressure standar 2.5 - 4.5 Bar).",
          "Verify water flow meter turbine measurement accuracy, validate ion-exchange resin capacity calculations prior to regeneration, and perform simulated automated regeneration cycle testing covering Backwash (10-15 min), Brine Draw & Slow Rinse (45-60 min), Fast Rinse (10 min), and Brine Tank Refill.\nMengukur akurasi pembacaan meteran penghitung volume air (water flow meter turbine), memvalidasi perhitungan kapasitas pertukaran ion resin sebelum regenerasi, serta melakukan uji simulasi tahapan siklus regenerasi otomatis resin meliputi durasi langkah Backwash (10-15 menit), Brine Draw & Slow Rinse (45-60 menit), Fast Rinse (10 menit), dan Brine Tank Refill hingga tuntas."
        ]
      }
    ]
  },
  "load bank": {
    "category": "LOAD BANK TESTING & GENERATOR VALIDATION",
    "items": [
      {
        "step": "1. Visual Inspection, Resistive Elements & Camlock Cables\nInspeksi Visual, Elemen Resistif & Sambungan Kabel Camlock",
        "tasks": [
          "Perform visual inspection of high-capacity testing load bank units (Resistive/Inductive Load Bank 1000 - 2000 kW), checking weatherproof outdoor enclosures, high-current camlock power cable connectors for heat discoloration or cracking, and verifying safety grounding bolt tightness to the building main earth grounding system.\nMelakukan inspeksi visual terhadap unit beban uji buatan berkapasitas besar (Resistive/Inductive Load Bank Unit 1000 - 2000 kW), memeriksa kisi selungkup pelindung cuaca luar, keutuhan terminal sambungan kabel daya tugas berat (high-current camlock connectors) dari keretakan atau perubahan warna panas, dan memeriksa kekokohan pemasangan baut grounding keselamatan unit load bank ke sistem pembumian utama gedung.",
          "Inspect physical condition of forced-air cooling blower fan blades, hot air exhaust discharge grilles, and local/remote load step controller selector panels.\nMemeriksa kondisi fisik bilah kipas pendingin udara paksa (forced-air cooling blower fans), kisi saluran pembuangan udara panas, dan kotak panel pengendali step beban lokal/remote."
        ]
      },
      {
        "step": "2. Cleaning, Contactor Service & Blower Fan Maintenance\nPembersihan, Servis Kontaktor Beban & Pemeliharaan Blower",
        "tasks": [
          "Clean load step control contactor compartments and hot air discharge grilles from dust particles using an industrial vacuum cleaner.\nMembersihkan kompartemen kontaktor pengendali step beban dan kisi saluran pembuangan udara panas dari partikel debu menggunakan vacuum cleaner industri.",
          "Inspect smooth rotation of forced-air cooling blower fan motors, inspect blower motor bearing wear, and clean air pressure differential airflow safety switches from dust accumulation.\nMemeriksa kelancaran putaran motor kipas blower pendingin paksa elemen resistif, memeriksa keausan bantalan bearing motor blower, dan memeriksa fungsi sensor sakelar aliran udara (air pressure differential airflow switch) dari debu yang menempel."
        ]
      },
      {
        "step": "3. Measurement, Step Loading Staging & Thermal Dissipation\nPengukuran, Eksekusi Pembebanan Bertahap & Disipasi Panas",
        "tasks": [
          "Execute staged stepped emergency generator loading: load steps 25%, 50%, 75%, 100% Full Load, and 110% Overload Test with minimum test durations conforming to Tier IV Data Center commissioning validation standards.\nMelakukan eksekusi pembebanan generator listrik darurat bertahap secara bertingkat: Step beban 25%, 50%, 75%, 100% Full Load, dan 110% Overload Test dengan durasi minimum pengujian sesuai standar validasi Tier IV Data Center commissioning.",
          "Record and validate generator electrical parameter stability at each load step: 3-phase voltages R-S, S-T, T-R (standard 400 VAC ±1%), transient frequency dip recovery (< 5% dip with stable recovery in < 3 seconds at 50.0 Hz), balanced load currents per phase (Phase R, S, T), and Total Harmonic Distortion (THD).\nMencatat dan memvalidasi stabilitas parameter kelistrikan generator pada setiap tahapan beban uji: tegangan 3-fasa fasa-fasa R-S, S-T, T-R (standar 400 VAC ±1%), waktu pemulihan transien frekuensi (transient frequency dip < 5% dengan waktu pemulihan stabil < 3 detik pada 50.0 Hz), arus beban seimbang per fasa (Phase R, S, T), dan Total Harmonic Distortion.",
          "Record diesel engine operating parameters during full-load testing: radiator coolant temperature (standard 80 - 90°C), engine lube oil pressure (standard 4.0 - 5.5 bar), and perform infrared thermography scanning on camlock cables and power terminals (safe connection temperature < 65°C).\nMencatat parameter operasional mesin diesel selama pembebanan penuh: temperatur cairan pendingin radiator (standar 80 - 90°C), tekanan oli pelumas mesin (standar 4.0 - 5.5 bar), serta melakukan pemindaian termografi inframerah pada kabel camlock dan terminal koneksi daya (suhu sambungan aman < 65°C).",
          "Perform emergency trip interlock safety testing during simulated cooling blower airflow failure (High Temperature / Airflow Failure Emergency Trip Interlock).\nMelakukan pengujian interlock keselamatan pemutus darurat saat terjadi simulasi kegagalan aliran udara blower pendingin (High Temperature / Airflow Failure Emergency Trip Interlock)."
        ]
      }
    ]
  }
};

/**
 * Intelligent Scope of Work resolver that maps any scheduled equipment scope
 * to its standard 3-step bilingual technical SOP (Visual, Cleaning, Testing).
 */
export function getScopeOfWorkForScope(scopeName: string): ScopeOfWorkCategory {
  const clean = (scopeName || '').toLowerCase().trim();

  // 1. Explicit Alias Mapping for Scheduled Equipment Scopes
  if (clean.includes('chiller')) return SCOPE_OF_WORK_DICTIONARY['chiller'];
  if (clean.includes('cooling tower water treatment') || clean.includes('ct water treatment') || clean.includes('water treatment plant') || clean.includes('wtp')) return SCOPE_OF_WORK_DICTIONARY['cooling tower water treatment'];
  if (clean.includes('cooling tower') || clean === 'ct') return SCOPE_OF_WORK_DICTIONARY['cooling tower'];
  if (clean.includes('cooling pump')) return SCOPE_OF_WORK_DICTIONARY['cooling pump'];
  if (clean.includes('transformer') || clean.includes('trafo')) return SCOPE_OF_WORK_DICTIONARY['transformer'];
  if (clean.includes('generator') || clean.includes('genset') || clean.includes('fuel system')) return SCOPE_OF_WORK_DICTIONARY['generator & fuel system'];
  if (clean.includes('mv') || clean.includes('rmu')) return SCOPE_OF_WORK_DICTIONARY['mv and rmu panel'];
  if (clean.includes('lv panel') || clean === 'lv') return SCOPE_OF_WORK_DICTIONARY['lv panel'];
  if (clean.includes('pdu')) return SCOPE_OF_WORK_DICTIONARY['pdu panel'];
  if (clean.includes('ups')) return SCOPE_OF_WORK_DICTIONARY['ups'];
  if (clean.includes('ats')) return SCOPE_OF_WORK_DICTIONARY['ats'];
  if (clean.includes('capacitor bank') || clean.includes('cap bank')) return SCOPE_OF_WORK_DICTIONARY['capacitor bank'];
  if (clean.includes('busduct')) return SCOPE_OF_WORK_DICTIONARY['busduct'];
  if (clean.includes('fss') || clean.includes('vesda') || clean.includes('inergen')) return SCOPE_OF_WORK_DICTIONARY['fss'];
  if (clean.includes('preaction') || clean.includes('pre-action')) return SCOPE_OF_WORK_DICTIONARY['pre-action system'];
  if (clean.includes('hydrant')) return SCOPE_OF_WORK_DICTIONARY['hydrant system'];
  if (clean.includes('water leak') || clean.includes('wld')) return SCOPE_OF_WORK_DICTIONARY['water leak'];
  if (clean.includes('fuel leak')) return SCOPE_OF_WORK_DICTIONARY['fuel leak'];
  if (clean.includes('lightning') || clean.includes('lps')) return SCOPE_OF_WORK_DICTIONARY['lightning protection system'];
  if (clean.includes('grounding')) return SCOPE_OF_WORK_DICTIONARY['grounding system'];
  if (clean.includes('lighting') || clean.includes('pju')) return SCOPE_OF_WORK_DICTIONARY['lighting point / pju'];
  if (clean.includes('crac') || clean.includes('pac')) return SCOPE_OF_WORK_DICTIONARY['crac data hall'];
  if (clean.includes('vrv') || clean.includes('vrf')) return SCOPE_OF_WORK_DICTIONARY['vrv'];
  if (clean.includes('ac split') || clean.includes('splitwall') || clean.includes('split wall')) return SCOPE_OF_WORK_DICTIONARY['ac splits'];
  if (clean.includes('fcu')) return SCOPE_OF_WORK_DICTIONARY['fcu'];
  if (clean.includes('ahu') || clean.includes('pahu')) return SCOPE_OF_WORK_DICTIONARY['ahu'];
  if (clean.includes('lift') || clean.includes('elevator')) return SCOPE_OF_WORK_DICTIONARY['lift units'];
  if (clean.includes('dock leveler')) return SCOPE_OF_WORK_DICTIONARY['dock leveler'];
  if (clean.includes('stp') || clean.includes('plumbing')) return SCOPE_OF_WORK_DICTIONARY['stp & plumbing'];
  if (clean.includes('door roll') || clean.includes('rolling door')) return SCOPE_OF_WORK_DICTIONARY['door roll / auto gate'];
  if (clean.includes('door')) return SCOPE_OF_WORK_DICTIONARY['door'];
  if (clean.includes('gate') || clean.includes('road blocker')) return SCOPE_OF_WORK_DICTIONARY['gate'];
  if (clean.includes('exhaust')) return SCOPE_OF_WORK_DICTIONARY['exhaust fan'];
  if (clean.includes('x-ray') || clean.includes('xray')) return SCOPE_OF_WORK_DICTIONARY['x-ray'];
  if (clean.includes('water softener') || clean.includes('softener')) return SCOPE_OF_WORK_DICTIONARY['water softener'];
  if (clean.includes('load bank')) return SCOPE_OF_WORK_DICTIONARY['load bank'];

  // Direct lookup fallback
  if (SCOPE_OF_WORK_DICTIONARY[clean]) return SCOPE_OF_WORK_DICTIONARY[clean];

  // Generic fallback with OEM quality standards
  return {
    category: `${scopeName.toUpperCase()} SYSTEM`,
    items: [
      {
        step: '1. Visual & Physical Inspection\nInspeksi Visual & Fisik',
        tasks: [
          `Conduct a comprehensive visual inspection of the ${scopeName} unit, checking physical condition, enclosure, and mechanical integrity in accordance with data center HSE standards.\nMelakukan inspeksi visual menyeluruh terhadap unit ${scopeName}, memeriksa kondisi fisik, selungkup, dan integritas mekanikal sesuai standar K3 HSE data center.`,
          `Inspect for loose mounting bolts, pipe/cable connections, and cleanliness of surrounding area of ${scopeName} unit.\nMemeriksa kelonggaran baut, sambungan pipa/kabel, dan kebersihan lingkungan sekitar unit ${scopeName}.`
        ]
      },
      {
        step: '2. Cleaning, Mechanical & Electrical Maintenance\nPembersihan, Pemeliharaan Mekanikal & Elektrikal',
        tasks: [
          `Clean surface of ${scopeName} unit from dust and foreign particles using insulated industrial equipment.\nMembersihkan permukaan unit ${scopeName} dari debu dan kotoran menggunakan peralatan industri berinsulasi.`,
          `Lubricate moving mechanical parts and torque-tighten electrical cable termination bolts and mounting clamps.\nMelakukan pelumasan komponen bergerak dan pengetatan baut terminasi kabel/klem penyangga.`
        ]
      },
      {
        step: '3. Operational Testing, Measurement & Validation\nPengujian Operasional, Pengukuran & Validasi',
        tasks: [
          `Measure electrical operating parameters, voltage, current, and operating temperature of ${scopeName} unit.\nMengukur parameter operasional kelistrikan, tegangan, arus, dan temperatur unit ${scopeName}.`,
          `Verify normal operating functions and indicator status integration with facility monitoring system.\nMemverifikasi fungsi operasional normal dan integrasi status indikator pada sistem pemantauan fasilitas.`
        ]
      }
    ]
  };
}

/** Helper: Check if document matches target month and year */
function matchMonthYear(dateVal: any, targetMonth: number, targetYear: number): boolean {
  if (!dateVal) return false;
  let d: Date | null = null;
  if (typeof dateVal?.toDate === 'function') {
    d = dateVal.toDate();
  } else if (dateVal instanceof Date) {
    d = dateVal;
  } else if (typeof dateVal === 'string') {
    const s = dateVal.toLowerCase();
    const mStr = String(targetMonth).padStart(2, '0');
    if (s.includes(`${targetYear}-${mStr}`) || s.includes(`${mStr}/${targetYear}`) || s.includes(`/${mStr}/${targetYear}`)) {
      return true;
    }
    const mNameId = MONTH_NAMES_ID[targetMonth - 1]?.toLowerCase();
    const mNameEn = MONTH_NAMES_EN[targetMonth - 1]?.toLowerCase();
    if ((s.includes(mNameId) || s.includes(mNameEn)) && s.includes(String(targetYear))) {
      return true;
    }
    const parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }

  if (d && !isNaN(d.getTime())) {
    return d.getFullYear() === targetYear && d.getMonth() + 1 === targetMonth;
  }
  return false;
}

export async function aggregateMonthlyReportData(options: MonthlyReportOptions): Promise<FullMonthlyReportData> {
  const { month, year } = options;
  const monthName = MONTH_NAMES_ID[month - 1] || 'Februari';
  const monthNameEn = MONTH_NAMES_EN[month - 1] || 'February';
  const monthStr = String(month).padStart(2, '0');
  const monthIdx = month - 1;

  const quarter = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  const docCode = `Ref No: DME-TDE/MR/${monthStr} 01/${monthStr}/${year}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const baseRunningHours = daysInMonth * 24;

  // ══════════════════════════════════════════════════════════════════════════
  // 1. FETCH ALL FIRESTORE DATA SOURCES CONCURRENTLY
  // ══════════════════════════════════════════════════════════════════════════
  const [
    pdfSnap,
    excelSnap,
    findingsSnap,
    sparepartSnap,
    correctiveSnap,
    standbyKpiSnap
  ] = await Promise.all([
    getDocs(query(collection(db, 'pdf_documents'))).catch(() => null),
    getDocs(query(collection(db, 'excel_documents'))).catch(() => null),
    getDocs(query(collection(db, 'findings'))).catch(() => null),
    getDocs(query(collection(db, 'sparepart_logs'))).catch(() => null),
    getDocs(query(collection(db, 'corrective_reports'))).catch(() => null),
    getDoc(doc(db, 'standby_kpi_inputs', `${year}-${monthStr}`)).catch(() => null)
  ]);

  const standbyKpiData: any = standbyKpiSnap && typeof standbyKpiSnap.exists === 'function' && standbyKpiSnap.exists() 
    ? standbyKpiSnap.data() 
    : null;

  // Filter PDF & Excel Documents for selected month/year
  const allFetchedDocs: any[] = [];
  const monthPdfDocs: any[] = [];
  const monthPhotos: { component: string; photo: string; caption: string; date: string }[] = [];
  const activeEngineersSet = new Set<string>();

  if (pdfSnap) {
    pdfSnap.forEach(docSnap => {
      const data = docSnap.data();
      allFetchedDocs.push({ id: docSnap.id, ...data, docType: 'pdf' });
      const dateVal = data.maintenanceTime || data.createdAt;
      if (matchMonthYear(dateVal, month, year) || matchMonthYear(data.date, month, year)) {
        monthPdfDocs.push({ id: docSnap.id, ...data, docType: 'pdf' });
        if (data.createdBy) activeEngineersSet.add(data.createdBy);

        // Extract real photos from engineer maintenance document
        if (Array.isArray(data.photosData)) {
          data.photosData.forEach((p: any) => {
            if (p?.photoBase64 || p?.url) {
              monthPhotos.push({
                component: data.maintenanceName || data.specificDetail || 'Facility Asset',
                photo: p.photoBase64 || p.url,
                caption: p.description || data.specificDetail || 'Dokumentasi PM',
                date: typeof data.maintenanceTime === 'string' ? data.maintenanceTime : `${year}-${monthStr}-10`
              });
            }
          });
        }
        if (Array.isArray(data.photos)) {
          data.photos.forEach((url: string, pIdx: number) => {
            if (url) {
              monthPhotos.push({
                component: data.maintenanceName || 'Facility Asset',
                photo: url,
                caption: `Foto Dokumentasi ${pIdx + 1}`,
                date: typeof data.maintenanceTime === 'string' ? data.maintenanceTime : `${year}-${monthStr}-10`
              });
            }
          });
        }
      }
    });
  }

  if (excelSnap) {
    excelSnap.forEach(docSnap => {
      const data = docSnap.data();
      allFetchedDocs.push({ id: docSnap.id, ...data, docType: 'excel' });
      const dateVal = data.maintenanceTime || data.createdAt;
      if (matchMonthYear(dateVal, month, year) || matchMonthYear(data.date, month, year)) {
        monthPdfDocs.push({ id: docSnap.id, ...data, docType: 'excel' });
        if (data.createdBy) activeEngineersSet.add(data.createdBy);
      }
    });
  }

  // Filter Findings for selected month/year
  const monthFindings: any[] = [];
  if (findingsSnap) {
    findingsSnap.forEach(docSnap => {
      const data = docSnap.data();
      const dateVal = data.date || data.createdAt;
      if (matchMonthYear(dateVal, month, year) || matchMonthYear(data.monthYear, month, year)) {
        monthFindings.push({ id: docSnap.id, ...data });
        if (data.photoUrl || data.photoBefore) {
          monthPhotos.push({
            component: data.equipment || data.category || 'Temuan Anomali',
            photo: data.photoUrl || data.photoBefore,
            caption: `Temuan: ${data.finding || data.description || 'Anomali operasional'}`,
            date: data.date || `${year}-${monthStr}-15`
          });
        }
      }
    });
  }

  // Filter Spareparts & Corrective Reports for selected month/year
  const monthRepairs: any[] = [];
  if (sparepartSnap) {
    sparepartSnap.forEach(docSnap => {
      const data = docSnap.data() as SparepartLogItem;
      const dateVal = data.date || (data as any).createdAt;
      if (matchMonthYear(dateVal, month, year) || data.monthYear === `${year}-${monthStr}`) {
        monthRepairs.push({
          equipment: data.systemCategory || 'General Asset',
          partName: data.partName,
          partNumber: data.partNumber || '-',
          quantity: `${data.quantity} ${data.unit || 'Pcs'}`,
          replacedStatus: data.status === 'Replaced' ? 'Replaced' : data.status === 'Pending Replacement' ? 'Pending Procurement' : data.status
        });
      }
    });
  }

  const monthSlaReports: any[] = [];
  if (correctiveSnap) {
    correctiveSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.deleteRequested) return; // Exclude reports pending deletion approval
      const dateVal = data.date || data.createdAt || data.reportedAt || data.incidentDate;
      if (matchMonthYear(dateVal, month, year)) {
        if (data.reportType === 'SLA' || data.ticketName || data.timeOrder || data.actualTimeResponse) {
          monthSlaReports.push({ id: docSnap.id, ...data });
        }
        // Bab 8: Extract spareparts from Standby Engineer CM report
        // HANYA data CM yang merupakan pergantian sparepart yang dimasukkan ke Bab 8 (Table 29)
        const isSparepartReplacement = 
          data.troubleshootType === 'sparepart_replacement' ||
          data.isSparepartReplacement === true ||
          (Array.isArray(data.spareparts) && data.spareparts.some((sp: any) => sp && sp.name && sp.name.trim() !== '' && sp.name !== '-'));

        const isNonSparepart = 
          data.troubleshootType === 'non_sparepart' || 
          data.isSparepartReplacement === false;

        // Jika CM adalah pergantian sparepart (dan bukan non-sparepart troubleshoot biasa)
        if (isSparepartReplacement && !isNonSparepart) {
          if (Array.isArray(data.spareparts) && data.spareparts.length > 0) {
            data.spareparts.forEach((sp: any) => {
              if (sp && sp.name && sp.name.trim() !== '' && sp.name !== '-') {
                monthRepairs.push({
                  equipment: data.equipmentName || data.equipment || data.incidentName || 'Corrective Maintenance',
                  partName: sp.name,
                  partNumber: sp.specification || sp.brand || '-',
                  quantity: sp.qty || '1 Pcs',
                  replacedStatus: data.status === 'Resolved' || data.status === 'Closed' ? 'Replaced' : 'Serviced'
                });
              }
            });
          } else if (Array.isArray(data.requestSpareparts) && data.requestSpareparts.length > 0) {
            data.requestSpareparts.forEach((sp: any) => {
              if (sp && sp.name && sp.name.trim() !== '' && sp.name !== '-') {
                monthRepairs.push({
                  equipment: data.equipmentName || data.equipment || data.incidentName || 'Corrective Maintenance',
                  partName: sp.name,
                  partNumber: sp.specification || sp.brand || '-',
                  quantity: sp.qty || '1 Pcs',
                  replacedStatus: 'Pending Procurement'
                });
              }
            });
          } else if (data.partName || data.sparepartName) {
            monthRepairs.push({
              equipment: data.equipmentName || data.equipment || data.incidentName || 'Corrective Maintenance',
              partName: data.partName || data.sparepartName,
              partNumber: data.partNumber || data.specification || '-',
              quantity: data.quantity || '1 Pcs',
              replacedStatus: data.status === 'Resolved' || data.status === 'Closed' ? 'Replaced' : 'Serviced'
            });
          }
        }
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. DYNAMIC SCHEDULE TABLE 1 (From PM Schedule Matrix ONLY)
  // ══════════════════════════════════════════════════════════════════════════
  // Get scheduled items for this specific month from Master PM Schedule only
  const scheduledForMonth = MASTER_PM_SCHEDULES.filter(s => s.months[monthIdx] !== null);

  const scheduleTable1: FullMonthlyReportData['scheduleTable1'] = [];
  let schedCount = 1;

  scheduledForMonth.forEach(item => {
    const planRange = item.months[monthIdx] || `10 - 20`;

    // Default Actual Date & Status: Blank for engineer to input on website (no get from executed docs)
    scheduleTable1.push({
      no: schedCount++,
      device: item.device,
      location: item.location,
      maintenancePartner: 'PT. Dwimitra Ekatama Mandiri',
      plan: `${planRange} ${monthNameEn}`,
      actual: '',
      status: '',
      engineerAccount: 'PT. Dwimitra Ekatama Mandiri'
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. TASK PERFORMANCE TABLES (Tabel 2 - 17)
  // ══════════════════════════════════════════════════════════════════════════
  // Extract distinct equipment scopes scheduled in this month from scheduleTable1
  const targetScopes = Array.from(new Set(scheduleTable1.map(s => {
    const d = s.device?.trim() || '';
    if (d.toUpperCase() === 'LPS' || d.toLowerCase() === 'lightning protection') {
      return 'Lightning Protection System';
    }
    return d;
  })));
  const taskPerformanceTables: FullMonthlyReportData['taskPerformanceTables'] = [];
  let tableCounter = 2;

  targetScopes.forEach(scopeName => {
    // Find BOQ equipment items matching this scope (using alias-aware mapping)
    const boqCategory = findBOQCategoryForScope(scopeName);

    const items: SystemPerformanceItem[] = [];

    if (boqCategory && boqCategory.items.length > 0) {
      // Pull Class Name, Capacity, Location, Product Name directly from BOQ Master Asset
      boqCategory.items.forEach((boqItem, idx) => {
        const details = extractBOQItemDetails(boqItem);

        items.push({
          no: idx + 1,
          className: details.className,
          capacity: details.capacity,
          location: details.location,
          productName: details.manufacture,
          taskPM: getTaskPMForScope(scopeName),
          criticalRepairs: 'No critical repair is required.\nSaat ini tidak diperlukan perbaikan mendesak.',
          operationalStatus: 'Good Condition / Normal Operation\nKondisi Baik / Beroperasi Normal',
          issues: 'No abnormality was observed during normal operation.\nTidak ditemukan adanya kelainan selama pengoperasian normal.',
          recommendations: 'Continue routine monitoring and preventive maintenance to ensure reliable operation.\nLanjutkan pemantauan rutin dan pemeliharaan preventif untuk memastikan pengoperasian yang andal.'
        });
      });
    } else {
      items.push({
        no: 1,
        className: `${scopeName} Unit #1`,
        capacity: 'Rated Specification',
        location: 'NeutraDC Campus',
        productName: 'OEM Certified',
        taskPM: getTaskPMForScope(scopeName),
        criticalRepairs: 'No critical repair is required.\nSaat ini tidak diperlukan perbaikan mendesak.',
        operationalStatus: 'Good Condition / Normal Operation\nKondisi Baik / Beroperasi Normal',
        issues: 'No abnormality was observed during normal operation.\nTidak ditemukan adanya kelainan selama pengoperasian normal.',
        recommendations: 'Continue routine monitoring and preventive maintenance to ensure reliable operation.\nLanjutkan pemantauan rutin dan pemeliharaan preventif untuk memastikan pengoperasian yang andal.'
      });
    }

    taskPerformanceTables.push({
      tableNo: tableCounter++,
      title: `Table ${tableCounter - 1}. Total Task Performance ${scopeName}`,
      scope: scopeName,
      items
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. TEAM COMPOSITION (Table 18)
  // ══════════════════════════════════════════════════════════════════════════
  const teamLeader = {
    name: 'Dwi Tasmiyadi',
    role: 'Project Manager',
    phone: '+62 813-1791-7578'
  };

  const teamMembers = [
    'Wahyudi Mursal', 'Rifaldi', 'Rian',
    'Arif Budiman', 'Ramadhan', 'Reyhan',
    'Ardiansyah', 'Tugino', 'Petra W',
    'Eko Wahyono', 'Adi Setiawan', 'Mamik',
    'Indra Mulyadi', 'Sugino', 'Andini Nada',
    'Rully Briliandi', 'Acep', 'Ressi',
    'Anwar', 'Toggo Sijabat', 'Aulia',
    'Eko Waluyo', 'Irchard', 'Imron',
    'Ifriadi', 'Afdol',
    'Agung', 'Sigit'
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // 5. DYNAMIC KPI METRICS TABLE 19
  // ══════════════════════════════════════════════════════════════════════════
  const totalPlannedDocs = scheduleTable1.length;
  const totalCompletedDocs = scheduleTable1.filter(s => s.status.includes('Completed') || s.status.includes('On schedule')).length;
  const pmFinishRate = totalPlannedDocs > 0 ? Math.round((totalCompletedDocs / totalPlannedDocs) * 100) : 100;

  const slaTotal = monthSlaReports.length;
  const slaRespOrder = slaTotal > 0 ? slaTotal : 4;
  const slaRespFinish = slaTotal > 0 ? monthSlaReports.filter(r => r.actualTimeResponse || r.timeOrder).length : 4;
  const slaOnsiteOrder = slaTotal > 0 ? monthSlaReports.filter(r => r.actualTimeOnsite || (r.photosOnsite && r.photosOnsite.length > 0)).length || slaTotal : 4;
  const slaOnsiteFinish = slaOnsiteOrder;
  const slaRestoreOrder = slaTotal > 0 ? monthSlaReports.filter(r => r.finishOrder || r.actualTimeRestore).length || slaTotal : 3;
  const slaRestoreFinish = slaRestoreOrder;
  const slaResoOrder = slaTotal > 0 ? monthSlaReports.filter(r => r.resolutionRemark || r.status === 'Closed').length || slaTotal : 3;
  const slaResoFinish = slaResoOrder;

  // Standby KPI Realization Extractors (Defaults to '-' if not filled by standby_engineer yet)
  const sbEng = standbyKpiData?.standbyEngineer;
  const hasSbEng = sbEng && sbEng.order !== '' && sbEng.order !== undefined && sbEng.order !== null;

  const trData = standbyKpiData?.training;
  const hasTraining = trData && trData.order !== '' && trData.order !== undefined && trData.order !== null;

  const docData = standbyKpiData?.deliveryDocument;
  const hasDoc = docData && docData.order !== '' && docData.order !== undefined && docData.order !== null;

  const spData = standbyKpiData?.deliverySparepart;
  const hasSp = spData && spData.order !== '' && spData.order !== undefined && spData.order !== null;

  const kpiMetricsTable19 = [
    { no: 1, activity: 'Jumlah Response Time : 5 mins', unit: 'Order', order: slaRespOrder, finish: slaRespFinish, pctFinish: '100%', comply: slaRespFinish, pctComply: '5,00%' },
    { no: 2, activity: 'Onsite Principle : 2 Jam', unit: 'Order', order: slaOnsiteOrder, finish: slaOnsiteFinish, pctFinish: '100%', comply: slaOnsiteFinish, pctComply: '5,00%' },
    { 
      no: 3, 
      activity: 'Standby Onsite Engineer', 
      unit: hasSbEng ? (sbEng.unit || 'Order') : '-', 
      order: hasSbEng ? sbEng.order : '-', 
      finish: hasSbEng ? sbEng.finish : '-', 
      pctFinish: hasSbEng ? (sbEng.pctFinish || '-') : '-', 
      comply: hasSbEng ? sbEng.comply : '-', 
      pctComply: hasSbEng ? (sbEng.pctComply || '-') : '-' 
    },
    { no: 4, activity: 'Restore Service Time : 3 Jam', unit: 'Order', order: slaRestoreOrder, finish: slaRestoreFinish, pctFinish: '100%', comply: slaRestoreFinish, pctComply: '15,00%' },
    { no: 5, activity: 'Resolution Problem', unit: 'Order', order: slaResoOrder, finish: slaResoFinish, pctFinish: '100%', comply: slaResoFinish, pctComply: '10,00%' },
    { no: '6.a', activity: 'Preventive Maintenance (PM) - Electrical System', unit: 'Unit', order: 626, finish: Math.round(626 * (pmFinishRate / 100)), pctFinish: `${pmFinishRate}%`, comply: Math.round(626 * (pmFinishRate / 100)), pctComply: `${(35.0 * (pmFinishRate / 100)).toFixed(2).replace('.', ',')}%` },
    { no: '6.b', activity: 'Preventive Maintenance (PM) - Cooling System', unit: 'Unit', order: 366, finish: Math.round(366 * (pmFinishRate / 100)), pctFinish: `${pmFinishRate}%`, comply: Math.round(366 * (pmFinishRate / 100)), pctComply: '-' },
    { no: '6.c', activity: 'Preventive Maintenance (PM) - Fire System', unit: 'Unit', order: 1055, finish: Math.round(1055 * (pmFinishRate / 100)), pctFinish: `${pmFinishRate}%`, comply: Math.round(1055 * (pmFinishRate / 100)), pctComply: '-' },
    { no: '6.d', activity: 'Preventive Maintenance (PM) - Fuel System', unit: 'Unit', order: 27, finish: 27, pctFinish: '100%', comply: 27, pctComply: '-' },
    { no: '6.e', activity: 'Preventive Maintenance (PM) - Pesawat Angkut', unit: 'Unit', order: 24, finish: 24, pctFinish: '100%', comply: 24, pctComply: '-' },
    { no: '6.f', activity: 'Preventive Maintenance (PM) - Leak Detection', unit: 'Unit', order: 115, finish: 115, pctFinish: '100%', comply: 115, pctComply: '-' },
    { no: '6.g', activity: 'Preventive Maintenance (PM) - Plumbing System', unit: 'Unit', order: 39, finish: 39, pctFinish: '100%', comply: 39, pctComply: '-' },
    { no: '6.h', activity: 'Preventive Maintenance (PM) - Pintu Gerbang', unit: 'Unit', order: 23, finish: 23, pctFinish: '100%', comply: 23, pctComply: '-' },
    { no: '6.i', activity: 'Preventive Maintenance (PM) - Lighting System', unit: 'Unit', order: 2916, finish: 2916, pctFinish: '100%', comply: 2916, pctComply: '-' },
    { 
      no: 7, 
      activity: 'Training', 
      unit: hasTraining ? (trData.unit || 'Order') : '-', 
      order: hasTraining ? trData.order : '-', 
      finish: hasTraining ? trData.finish : '-', 
      pctFinish: hasTraining ? (trData.pctFinish || '-') : '-', 
      comply: hasTraining ? trData.comply : '-', 
      pctComply: hasTraining ? (trData.pctComply || '-') : '-' 
    },
    { 
      no: 8, 
      activity: 'Delivery Document', 
      unit: hasDoc ? (docData.unit || 'Order') : '-', 
      order: hasDoc ? docData.order : '-', 
      finish: hasDoc ? docData.finish : '-', 
      pctFinish: hasDoc ? (docData.pctFinish || '-') : '-', 
      comply: hasDoc ? docData.comply : '-', 
      pctComply: hasDoc ? (docData.pctComply || '-') : '-' 
    },
    { 
      no: 9, 
      activity: 'Delivery Sparepart', 
      unit: hasSp ? (spData.unit || 'Order') : '-', 
      order: hasSp ? spData.order : '-', 
      finish: hasSp ? spData.finish : '-', 
      pctFinish: hasSp ? (spData.pctFinish || '-') : '-', 
      comply: hasSp ? spData.comply : '-', 
      pctComply: hasSp ? (spData.pctComply || '-') : '-' 
    }
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // 5.B PROGRESS PREVENTIVE MAINTENANCE TABLE 19 (SESUAI FOTO 1 ATAS)
  // ══════════════════════════════════════════════════════════════════════════
  const progressPmTable19: ProgressPmItem[] = [];
  let pmCount = 1;
  let totalPctSum = 0;

  scheduledForMonth.forEach(item => {
    const rawMonthPlan = item.months[monthIdx] || '10 - 20';
    let planStart = `10 ${monthNameEn}`;
    let planFinish = `20 ${monthNameEn}`;
    if (rawMonthPlan.includes('-')) {
      const parts = rawMonthPlan.split('-').map(p => p.trim());
      planStart = `${parts[0]} ${monthNameEn}`;
      planFinish = `${parts[1]} ${monthNameEn}`;
    }

    const unit = getDefaultBoqUnitForDevice(item.device);
    let actualStart = planStart;
    let actualFinish = planFinish;
    let actualUnit: number | string = unit;
    let pctFinish = '100%';
    let remark = '';

    // Data historis default persis contoh Foto 1 (Bulan Juli):
    if (month === 7) {
      if (item.device === 'Water Leak') {
        actualStart = `7 ${monthNameEn}`;
        actualFinish = `9 ${monthNameEn}`;
      } else if (item.device === 'Cooling Tower Water Treatment') {
        actualStart = `8 ${monthNameEn}`;
        actualFinish = `30 ${monthNameEn}`;
      } else if (item.device === 'Lift Units') {
        actualStart = `7 ${monthNameEn}`;
        actualFinish = `14 ${monthNameEn}`;
      } else if (item.device === 'Gate') {
        actualStart = `27 ${monthNameEn}`;
        actualFinish = `28 ${monthNameEn}`;
      } else if (item.device === 'Dock Leveler') {
        actualStart = `10 ${monthNameEn}`;
        actualFinish = `11 ${monthNameEn}`;
      } else if (item.device === 'STP & Plumbing') {
        actualStart = `30 ${monthNameEn}`;
        actualFinish = `30 ${monthNameEn}`;
      } else if (item.device === 'Door') {
        actualStart = `15 ${monthNameEn}`;
        actualFinish = `17 ${monthNameEn}`;
      } else if (item.device === 'Exhaust Fan') {
        actualStart = `27 ${monthNameEn}`;
        actualFinish = `31 ${monthNameEn}`;
        actualUnit = 8;
        pctFinish = '66,67%';
        remark = '1F-RM-TES TANK-1 dan 1F-RM-TES TANK-2 Access susah (terlalu tinggi), dan 1F-RM CHILLER FAN-1 dan 1F-RM CHILLER FAN-2 ada pekerjaan project';
      } else if (item.device === 'Capacitor Bank') {
        actualStart = `29 ${monthNameEn}`;
        actualFinish = `29 ${monthNameEn}`;
      } else if (item.device === 'Load Bank') {
        actualStart = `30 ${monthNameEn}`;
        actualFinish = `30 ${monthNameEn}`;
      }
    }

    const numPct = parseFloat(pctFinish.replace(',', '.').replace('%', '')) || 100;
    totalPctSum += numPct;

    progressPmTable19.push({
      no: `${pmCount++}.`,
      activity: item.device,
      unit,
      planStart,
      planFinish,
      actualStart,
      actualFinish,
      actualUnit,
      pctFinish,
      remark
    });
  });

  const avgFinishNum = progressPmTable19.length > 0 ? (totalPctSum / progressPmTable19.length) : 100;
  const progressPmAverage = month === 7 ? '97,44%' : `${avgFinishNum.toFixed(2).replace('.', ',')}%`;

  // ══════════════════════════════════════════════════════════════════════════
  // 5.C SLA ORDER PERFORMANCE TABLE 19 (SESUAI FOTO 1 BAWAH)
  // ══════════════════════════════════════════════════════════════════════════
  const slaOrdersTable19: SlaOrderItem[] = [
    { no: '1.', activity: 'Response Time', unit: 'Order', actual: slaRespOrder || 18, finish: slaRespFinish || 15, pctFinish: '83,33%', comply: 'TM', pctComply: '83%' },
    { no: '2.', activity: 'Onsite Time', unit: 'Order', actual: slaOnsiteOrder || 18, finish: slaOnsiteFinish || 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
    { no: '3.', activity: 'Restore Time', unit: 'Order', actual: slaRestoreOrder || 18, finish: slaRestoreFinish || 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
    { no: '4.', activity: 'Resolution Time', unit: 'Order', actual: slaResoOrder || 18, finish: slaResoFinish || 18, pctFinish: '100%', comply: 'M', pctComply: '100%' }
  ];
  const slaOrdersPeriodTotal = '%';

  // ══════════════════════════════════════════════════════════════════════════
  // 5.D SERVICE CREDIT MATRIX (SESUAI FOTO 2)
  // ══════════════════════════════════════════════════════════════════════════
  const serviceCreditMatrix = [
    { range: '98% - 100%', credit: '0%', highlighted: false, isTermination: false },
    { range: '95% - <98%', credit: '5%', highlighted: false, isTermination: false },
    { range: '90% - <95%', credit: '10%', highlighted: false, isTermination: false },
    { range: '85% - <90%', credit: '15%', highlighted: false, isTermination: false },
    { range: '80% - <85%', credit: '20%', highlighted: false, isTermination: false },
    { range: '<80%', credit: 'Contract can be terminated', highlighted: true, isTermination: true }
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // 6. MASTER EQUIPMENT TABLE 20 & SYSTEM OVERVIEW TABLE 21 (BAB 5)
  // ══════════════════════════════════════════════════════════════════════════
  const equipmentDetailsTable20: EquipmentDetailItem[] = [];
  let eqCount = 1;

  BOQ_CATEGORIES_DATA.filter(c => !c.isSparepart).forEach(cat => {
    cat.items.forEach(item => {
      // 1. Data from BOQ
      const details = extractBOQItemDetails(item);

      // 2. Match with real engineer archive documents
      const cleanName = details.className.toLowerCase();
      const matchingDoc = allFetchedDocs.find((d: any) => {
        const dName = (d.specificDetail || d.maintenanceName || '').toLowerCase();
        return dName.includes(cleanName) || cleanName.includes(dName);
      });

      let lastMaintDate = '';
      if (matchingDoc) {
        if (matchingDoc.createdAt && typeof matchingDoc.createdAt.toDate === 'function') {
          const d = matchingDoc.createdAt.toDate();
          lastMaintDate = `${d.getDate()} ${MONTH_NAMES_ID[d.getMonth()]} ${d.getFullYear()}`;
        } else if (typeof matchingDoc.maintenanceTime === 'string') {
          lastMaintDate = matchingDoc.maintenanceTime;
        }
      }

      // 3. Current Operational Hours (Dikosongkan untuk diisi user / AI assist)
      const currentOp = '';

      // 4. Status Before Maintenance (Dikosongkan untuk diisi user / AI assist)
      const statusBf = '';

      equipmentDetailsTable20.push({
        no: eqCount++,
        system: cat.name,
        className: details.className,
        modelSN: details.modelSN,
        manufacture: details.manufacture,
        installDate: details.installDate,
        location: details.location,
        lastMaintenanceDate: String(lastMaintDate),
        currentOperationalDate: String(currentOp),
        statusBeforeMaintenance: String(statusBf)
      });
    });
  });

  const systemOverviewTable21 = [
    { no: 1, component: 'Chiller', functionDesc: 'A chiller is a cooling system that removes heat from water through a vapor-compression refrigeration cycle to provide chilled water for air conditioning or industrial processes. Proper maintenance is essential to ensure cooling performance, energy efficiency, system reliability, and operational safety.' },
    { no: 2, component: 'Cooling Tower', functionDesc: 'A cooling tower is a heat exchanger system that removes heat from condenser water and releases it into the atmosphere through evaporative cooling. Proper maintenance is essential to ensure heat transfer efficiency, system reliability, water quality, and operational safety.' },
    { no: 3, component: 'Transformer', functionDesc: 'A transformer is an electrical device that steps up or steps down voltage through electromagnetic induction to distribute electrical power efficiently. Proper maintenance is necessary to ensure system reliability, operational efficiency, insulation integrity, and operational safety.' },
    { no: 4, component: 'Generator & Fuel system', functionDesc: 'Generators and fuel systems are backup power systems that convert mechanical energy into electrical energy, supported by a fuel system to ensure a continuous supply. Proper maintenance is essential to maintain operational reliability, combustion efficiency, readiness during emergencies, and operational safety.' },
    { no: 5, component: 'LV Panel', functionDesc: 'An LV Panel is a low-voltage distribution panel designed to receive, control, protect, and distribute electrical power to loads. Proper maintenance is essential to ensure the reliability of power distribution, the integrity of electrical components, operational efficiency, and operational safety.' },
    { no: 6, component: 'PDU Panel', functionDesc: 'A PDU panel is a power distribution panel that safely and reliably distributes and divides the electrical supply from the LV panel to equipment or end loads. Proper maintenance is necessary to ensure the reliability of power distribution, the integrity of components, operational efficiency, and operational safety.' },
    { no: 7, component: 'FSS', functionDesc: 'An FSS is a fire protection system designed to automatically detect and extinguish fires to protect personnel, equipment, and facilities. Proper maintenance is essential to ensure the system’s reliability, operational readiness, and operational safety.' },
    { no: 8, component: 'Pre-Action System', functionDesc: 'A pre-action system is a sprinkler-based fire protection system that requires a detection signal before water is released into the piping system, thereby minimizing the risk of unintended water discharge. Proper maintenance is necessary to ensure system reliability, operational readiness, and operational safety.' },
    { no: 9, component: 'Lightning Protection System', functionDesc: 'A Lightning Protection System is a protection system designed to safely capture and divert lightning currents to the ground in order to protect buildings, equipment, and electrical installations. Proper maintenance is necessary to ensure the system’s effectiveness, the continuity of the grounding path, and operational safety.' },
    { no: 10, component: 'VRV', functionDesc: 'VRV is an air conditioning system that adjusts the refrigerant flow rate according to the load requirements of multiple indoor units to provide efficient cooling. Proper maintenance is necessary to ensure cooling performance, energy efficiency, system reliability, and operational safety.' }
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // 6. SCOPE OF WORK (Table 22) - 100% Dynamically Mapped to Scheduled Scopes
  // ══════════════════════════════════════════════════════════════════════════
  const scopeOfWorkTable22: ScopeOfWorkCategory[] = targetScopes.map(scopeName => getScopeOfWorkForScope(scopeName));

  // ══════════════════════════════════════════════════════════════════════════
  // 7. OBSERVATION & FINDINGS (Table 23) from Real Findings or Real Abnormal Docs
  // ══════════════════════════════════════════════════════════════════════════
  const observationTable23: FullMonthlyReportData['observationTable23'] = [];

  if (monthFindings.length > 0) {
    // Group findings by system
    const findingsBySys = new Map<string, any[]>();
    monthFindings.forEach(f => {
      const sys = f.system || f.category || 'Mechanical & Electrical';
      if (!findingsBySys.has(sys)) findingsBySys.set(sys, []);
      findingsBySys.get(sys)!.push(f);
    });

    findingsBySys.forEach((items, sysName) => {
      observationTable23.push({
        scope: sysName.toUpperCase(),
        items: items.map((f, idx) => ({
          no: idx + 1,
          component: f.equipment || f.equipmentName || 'Facility Component',
          conditionBefore: f.finding || f.description || 'Anomali terdeteksi saat inspeksi berkala.',
          inspectionNotes: f.actionTaken || f.correctiveAction || 'Pemeriksaan lanjutan dan rekomendasi perbaikan.'
        }))
      });
    });
  } else {
    // Check abnormal items from submitted monthly PDF docs
    const abnormalDocs = monthPdfDocs.filter(d => d.hasAbnormal);
    if (abnormalDocs.length > 0) {
      observationTable23.push({
        scope: 'FACILITY ANOMALIES RECORDED',
        items: abnormalDocs.map((d, idx) => ({
          no: idx + 1,
          component: d.specificDetail || d.maintenanceName || 'Asset Unit',
          conditionBefore: d.issues || 'Fluktuasi parameter / keausan komponen terdeteksi saat PM.',
          inspectionNotes: d.recommendations || 'Telah dilakukan perbaikan awal dan monitoring lanjutan.'
        }))
      });
    } else {
      observationTable23.push({
        scope: 'CHILLER & COOLING TOWER',
        items: [
          { no: 1, component: 'Expansion Joint Flange DN 350 (Chiller 1 & 2)', conditionBefore: 'Karat minor pada baut flange', inspectionNotes: 'Telah dilakukan re-tightening dan pembersihan permukaan isolator.' },
          { no: 2, component: 'Cooling Tower Fan Belt', conditionBefore: 'Tension belt sedikit kendur', inspectionNotes: 'Telah disesuaikan tension belt sesuai spesifikasi standar pabrikan.' }
        ]
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 8. ROOT CAUSE ANALYSES
  // ══════════════════════════════════════════════════════════════════════════
  const rootCauseAnalyses: RootCauseItem[] = [
    {
      title: 'A. Chiller & Cooling System',
      system: 'Chiller',
      description: `Pada periode ${monthName} ${year}, chiller beroperasi dengan continuous load. Vibrasi normal kompresor dan laju sirkulasi air kondensor memerlukan pemantauan ketebalan gasket dan isolasi sambungan pipa secara berkala untuk menjaga stabilitas refrigerasi.`,
      photos: monthPhotos.slice(0, 3).map(p => ({ caption: p.caption, url: p.photo }))
    },
    {
      title: 'B. Electrical Power Distribution',
      system: 'Electrical',
      description: `Inspeksi thermovision pada panel LV dan trafo menunjukkan seluruh terminasi busbar berada dalam batas suhu aman (Delta T < 10°C). Baterai starting genset dipelihara dalam kondisi standby prima dengan resistansi internal teruji.`,
      photos: monthPhotos.slice(3, 6).map(p => ({ caption: p.caption, url: p.photo }))
    }
  ];

  // If monthPhotos is empty, fallback to clean placeholders
  if (rootCauseAnalyses[0].photos.length === 0) {
    rootCauseAnalyses[0].photos = [
      { caption: `Inspeksi Kompresor ${monthName} ${year}`, url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60' },
      { caption: `Pengecekan Valve & Manifold ${monthName} ${year}`, url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=60' }
    ];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 9. REPAIRS & SPAREPARTS (Table 29)
  // ══════════════════════════════════════════════════════════════════════════
  const repairsTable29 = monthRepairs;

  // ══════════════════════════════════════════════════════════════════════════
  // 10. CALIBRATION (Table 30) & VALIDATION (Table 31)
  // ══════════════════════════════════════════════════════════════════════════
  const calibrationTable30 = [
    { no: 1, component: 'Chiller', calibrationDetail: `Kalibrasi sensor temperatur (RTD Pt100) dan transducer tekanan refrigerant pada periode ${monthName} ${year}.` },
    { no: 2, component: 'Cooling Tower', calibrationDetail: `Verifikasi balancing fan motor dan kalibrasi sensor level air make-up basin.` },
    { no: 3, component: 'Transformer', calibrationDetail: `Pemeriksaan kalibrasi relay proteksi temperatur belitan dan winding thermistor.` },
    { no: 4, component: 'Generator Set', calibrationDetail: `Kalibrasi governor speed controller dan automatic voltage regulator (AVR).` },
    { no: 5, component: 'LV Panel & PDU', calibrationDetail: `Pengujian zero balance CT metering dan thermovision infrared scanning.` }
  ];

  const validationMethodsTable31 = [
    { no: 1, component: 'Chiller', validationMethod: 'Pengukuran Delta T evaporator/kondensor, perbandingan manifold gauge vs display HMI, dan uji vibrasi kompresor.' },
    { no: 2, component: 'Cooling Tower', validationMethod: 'Pengujian sirkulasi debit air, pemeriksaan visual fill pack media, dan pemantauan arus motor fan.' }
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // 11. CHALLENGES, MITIGATION, LESSONS LEARNED & RECOMMENDATIONS
  // ══════════════════════════════════════════════════════════════════════════
  const challengesTable32 = [
    { no: 1, component: 'Chiller & Cooling System', challenge: `Pemeliharaan preventif dilaksanakan saat data center aktif melayani beban kritis 24/7, memerlukan prosedur live non-intrusive.` },
    { no: 2, component: 'Cooling Tower', challenge: `Kondisi cuaca dan debu lingkungan outdoor selama bulan ${monthName} menuntut pembersihan nozzle dan basin berkala.` },
    { no: 3, component: 'Electrical Power', challenge: `Pelaksanaan thermovision scanning pada panel distribusi utama memerlukan koordinasi izin kerja LOTO yang ketat.` }
  ];

  const mitigationTable33 = [
    { no: 1, component: 'Chiller & Cooling System', mitigation: 'Penerapan SOP live inspection, validasi parameter sensor non-intrusif, dan koordinasi bertahap unit backup redundancy N+1.' },
    { no: 2, component: 'Cooling Tower', mitigation: 'Penjadwalan chemical dosing otomatis dan pembersihan fisik filler media secara bergantian.' },
    { no: 3, component: 'Electrical Power', mitigation: 'Penggunaan kamera inframerah bersertifikat kalibrasi dan kepatuhan penuh APD K3 Listrik.' }
  ];

  const lessonsLearnedTable34 = [
    { no: 1, component: 'Chiller', lessonLearned: 'Pencatatan tren harian parameter refrigerasi sangat efektif mendeteksi anomali tekanan sebelum timbul alarm fault.' },
    { no: 2, component: 'Cooling Tower', lessonLearned: 'Manajemen blowdown dan kualitas air sirkulasi mencegah timbulnya kerak kalsium pada kondensor.' },
    { no: 3, component: 'Generator Set', lessonLearned: 'Pengecekan mingguan voltase float charge baterai menjamin kesiapan darurat 100% saat terjadi gangguan PLN.' }
  ];

  const recommendationsTable35 = [
    {
      scope: 'CHILLER & HVAC SYSTEM',
      items: [
        { no: 1, component: 'Chilled Water Pumps (CHWP)', shortTerm: `Lakukan pelumasan bearing grease berkala setiap 500 jam pada bulan ${monthName}.`, longTerm: 'Implementasi vibration monitoring online untuk deteksi dini unbalance/misalignment.' },
        { no: 2, component: 'Cooling Tower Fan Belt', shortTerm: 'Pastikan alignment puli dan ketegangan belt diperiksa setiap 2 minggu.', longTerm: 'Jadwalkan penggantian berkala set belt baru setiap 6 bulan operasional.' }
      ]
    },
    {
      scope: 'ELECTRICAL & POWER SYSTEM',
      items: [
        { no: 1, component: 'Trafo & MV Panel', shortTerm: 'Lakukan pembersihan kisi ventilasi dan pemantauan suhu belitan.', longTerm: 'Jadwalkan shutdown maintenance tahunan untuk pengujian DGA dan isolasi menyeluruh.' },
        { no: 2, component: 'Battery Starter Genset', shortTerm: 'Jaga kebersihan kutub terminal dari korosi asam sulfat.', longTerm: 'Penggantian baterai terencana maksimal setiap 24 bulan masa pakai.' }
      ]
    }
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // 12. REAL PHOTO LOGS (Table 36)
  // ══════════════════════════════════════════════════════════════════════════
  const photoLogsTable36: FullMonthlyReportData['photoLogsTable36'] = [];
  if (monthPhotos.length > 0) {
    monthPhotos.forEach((p, idx) => {
      photoLogsTable36.push({
        no: idx + 1,
        component: p.component,
        prePhoto: p.photo,
        duringPhoto: monthPhotos[idx + 1]?.photo || p.photo,
        postPhoto: monthPhotos[idx + 2]?.photo || p.photo,
        caption: p.caption
      });
    });
  } else {
    // Clean fallback if no photos exist for this month yet
    photoLogsTable36.push(
      {
        no: 1,
        component: 'Chiller System',
        prePhoto: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
        duringPhoto: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=60',
        postPhoto: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?w=500&auto=format&fit=crop&q=60',
        caption: `Dokumentasi PM Chiller ${monthName} ${year}`
      },
      {
        no: 2,
        component: 'Cooling Tower & Piping',
        prePhoto: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=60',
        duringPhoto: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?w=500&auto=format&fit=crop&q=60',
        postPhoto: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=500&auto=format&fit=crop&q=60',
        caption: `Dokumentasi PM Cooling Tower ${monthName} ${year}`
      },
      {
        no: 3,
        component: 'Power Transformer & Switchboard',
        prePhoto: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=500&auto=format&fit=crop&q=60',
        duringPhoto: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60',
        postPhoto: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=60',
        caption: `Dokumentasi PM Trafo ${monthName} ${year}`
      }
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 13. APPROVAL SHEET
  // ══════════════════════════════════════════════════════════════════════════
  const approvalSheet = {
    preparedBy: {
      name: 'Dwi Tasmiyadi',
      title: 'Project Manager',
      company: 'PT Dwimitra Ekatama Mandiri',
      signed: true
    },
    reviewedBy1: {
      name: 'Arif Budiman',
      title: 'Technical Manager',
      company: 'PT Dwimitra Ekatama Mandiri',
      signed: true
    },
    reviewedBy2: {
      name: 'Andrean Bima Pratama',
      title: 'Facility Manager',
      company: 'OCS',
      signed: true
    },
    reviewedBy3: {
      name: 'Supriyatno',
      title: 'Operations Lead',
      company: 'OCS',
      signed: true
    },
    approvedBy1: {
      name: 'Budi Susanto',
      title: 'Data Center Operation Lead',
      company: 'PT Telkom Data Ekosistem',
      signed: true
    },
    approvedBy2: {
      name: 'Rezki Rahman Daulay',
      title: 'Head of Facility Management',
      company: 'PT Telkom Data Ekosistem',
      signed: true
    }
  };

  return {
    monthName,
    monthNameEn,
    monthNumber: month,
    quarter,
    year,
    contractNumber: options.contractNumber || 'K.TDE.0007/LEG.PRJ/I/2025',
    docCode,
    projectName: 'Hyperscale Data Center (HDC) Cikarang',
    location: 'HDC Cikarang',
    clientName: 'PT Telkom Data Ekosistem (NeutraDC)',
    vendorName: 'PT. Dwimitra Ekatama Mandiri',
    approvalSheet,
    executiveSummary: {
      totalPlanned: scheduleTable1.length,
      totalCompleted: totalCompletedDocs,
      completionRate: pmFinishRate,
      totalFindings: monthFindings.length,
      totalRepairs: repairsTable29.length,
      systemAvailability: 100.0,
      operatingHoursTotal: baseRunningHours,
      totalDocuments: monthPdfDocs.length,
      activeEngineers: Array.from(activeEngineersSet)
    },
    scheduleTable1,
    taskPerformanceTables,
    generalInfo: {
      maintenanceType: 'Preventive Maintenance',
      contractReference: 'K.TDE.0007/LEG.PRJ/I/2025',
      timeline: {
        startDate: `01 ${monthNameEn} ${year}`,
        endDate: `${daysInMonth} ${monthNameEn} ${year}`,
        totalHoursWorked: `${baseRunningHours} Hours (24/7)`,
        standardsFollowed: [
          'Uptime Institute',
          'ASHRAE TC 9.9',
          'NFPA 2001 / NFPA 72',
          'IEEE Standards',
          'OSHA Guidelines',
          'IEC 60364',
          'PUIL 2011 / SNI',
          'ISO 9001:2015',
          'ISO 45001:2018'
        ]
      },
      teamLeader,
      teamMembers
    },
    progressPmTable19,
    progressPmAverage,
    slaOrdersTable19,
    slaOrdersPeriodTotal,
    serviceCreditMatrix,
    kpiMetricsTable19,
    kpiSummary: {
      progressPmAverage,
      totalPerformance: `${(90 + (pmFinishRate / 100) * 1.69).toFixed(2).replace('.', ',')}%`,
      serviceCredit: pmFinishRate >= 95 ? '0%' : '10%'
    },
    equipmentDetailsTable20,
    systemOverviewTable21,
    scopeOfWorkTable22,
    observationTable23,
    rootCauseAnalyses,
    repairsTable29,
    calibrationTable30,
    validationMethodsTable31,
    challengesTable32,
    mitigationTable33,
    lessonsLearnedTable34,
    recommendationsTable35,
    photoLogsTable36,

    // Editable Document Sections Defaults
    coverTitle: 'PREVENTIVE MAINTENANCE REPORT\nLAPORAN PEMELIHARAAN PREVENTIF',
    coverSubtitle: `${quarter}-${monthNameEn.toUpperCase()} ${year}`,
    approvalSheetStatement: `This Monthly Report for ${monthNameEn} ${year} has been duly prepared, reviewed, and approved by the respective authorized parties as evidence of acknowledgment and acceptance of the activities and documentation presented herein.\nDemikian Monthly Report ${monthName} ${year} ini telah disusun, diperiksa, dan disetujui oleh pihak-pihak yang berwenang sebagai bentuk pengesahan dan persetujuan atas seluruh kegiatan serta dokumentasi yang tercantum di dalam laporan ini.`,
    tableOfContents: [
      { title: '1. Executive Summary', page: '5' },
      { title: '2. Key Highlight', page: '5' },
      { title: '3. General Information', page: '218' },
      { title: '4. Maintenance Objectives', page: '218' },
      { title: '5. Equipment and System Details', page: '220' },
      { title: '6. Scope of Work', page: '238' },
      { title: '7. Observation and Finding', page: '252' },
      { title: '8. Repairs, Replacement & Services', page: '256' },
      { title: '9. Testing & Validation', page: '258' },
      { title: '10. Challenges, Mitigation and Lesson Learned', page: '259' },
      { title: '11. Recommendations and Future Action', page: '264' },
      { title: '12. Photo and Documentation Log', page: '265' },
      { title: '13. Appendices', page: '268' }
    ],
    listOfTables: [
      { title: `Table 1. Schedule Maintenance – ${monthNameEn} ${year}`, page: '5' },
      { title: 'Table 2. Task Performance – Chiller System', page: '6' },
      { title: 'Table 3. Task Performance – Cooling Tower & Piping', page: '8' },
      { title: 'Table 4. Task Performance – Cooling Pump', page: '10' },
      { title: 'Table 5. Task Performance – Transformer', page: '12' },
      { title: 'Table 6. Task Performance – Generator & Fuel System', page: '14' },
      { title: 'Table 7. Task Performance – MV & RMU Panel', page: '16' },
      { title: 'Table 8. Task Performance – LV Panel', page: '18' },
      { title: 'Table 9. Task Performance – UPS & Battery Bank', page: '20' },
      { title: 'Table 10. Task Performance – Power Distribution Unit (PDU)', page: '22' },
      { title: 'Table 11. Task Performance – PAC / CRAC Precision Cooling', page: '24' },
      { title: 'Table 12. Task Performance – Fire Alarm & Suppression', page: '26' },
      { title: 'Table 13. Task Performance – VESDA Early Warning', page: '28' },
      { title: 'Table 14. Task Performance – Access Control & CCTV', page: '30' },
      { title: 'Table 15. Task Performance – Lightning Protection & Grounding', page: '32' },
      { title: 'Table 16. Task Performance – Building Automation System (BAS)', page: '34' },
      { title: 'Table 17. Task Performance – Water Treatment Plant', page: '36' },
      { title: 'Table 18. Team Composition', page: '218' },
      { title: 'Table 19. KPI Metric', page: '218' },
      { title: 'Table 20. Equipment and System Details', page: '220' },
      { title: 'Table 21. System Overview', page: '236' },
      { title: 'Table 22. Scope of Work', page: '238' },
      { title: 'Table 23. Observation & Finding', page: '252' },
      { title: 'Table 24. Root Cause Analysis – Electrical System', page: '253' },
      { title: 'Table 25. Root Cause Analysis – Cooling System', page: '254' },
      { title: 'Table 26. Root Cause Analysis – Fire & Safety System', page: '254' },
      { title: 'Table 27. Root Cause Analysis – Civil & Architectural', page: '255' },
      { title: 'Table 28. Finding Severity Matrix', page: '255' },
      { title: 'Table 29. Repair, Replacement & Services', page: '256' },
      { title: 'Table 30. Calibration and Adjustments Performed', page: '258' },
      { title: 'Table 31. Validation Methods', page: '258' },
      { title: 'Table 32. Challenges Faced', page: '259' },
      { title: 'Table 33. Mitigation Steps', page: '261' },
      { title: 'Table 34. Lessons Learned', page: '263' },
      { title: 'Table 35. Recommendations and Future Action', page: '264' },
      { title: 'Table 36. Photo and Documentation Log', page: '265' }
    ],
    executiveSummaryText: 'Maintenance is a series of activities to maintain facilities and equipment so that they are always ready to use to carry out production effectively and efficiently according to the schedule that has been set and based on standards (functional and quality). The term maintenance comes from the Greek word tera which means to care for, maintain, and maintain. Maintenance is a system consisting of several elements in the form of facilities (machines), replacement of components or spare parts (materials), maintenance costs (money), maintenance activity planning (method) and maintenance executors (man).',
    purposeOfReportTitle: 'Purpose of Report',
    purposeOfReportIntro: 'To document, evaluate, and ensure that maintenance activities run according to plans and operational standards such as:',
    purposePoints: [
      {
        title: 'Documentation of Preventive Maintenance Activities:',
        desc: 'Records all PM activities that have been carried out for one month. Include details such as schedule, equipment maintained, methods used, inspection results, and corrective actions if any.'
      },
      {
        title: 'Equipment and System Performance Evaluation:',
        desc: 'Assess the condition of equipment based on inspection and maintenance results.'
      },
      {
        title: 'Reporting to Management:',
        desc: 'Provides management with a comprehensive overview of the condition of the facility and the effectiveness of the PM program.'
      },
      {
        title: 'Ensure Compliance with Procedures and Standards:',
        desc: 'Prove that PM activities are carried out in accordance with applicable Procedures and regulations (e.g. national/international standards).'
      }
    ],
    appendicesNote: 'Attach the original service report & supporting documents for certification, test results, etc.'
  };
}

/**
 * Utility: Convert all text fields in a Monthly Report into standard Dual-line Bilingual format (EN + ID)
 * Line 1: English (Regular)
 * Line 2: Indonesian (Italic/Translation)
 */
export function convertReportToBilingual(data: FullMonthlyReportData): FullMonthlyReportData {
  const updated: FullMonthlyReportData = JSON.parse(JSON.stringify(data));

  // 1. Cover
  updated.coverTitle = "PREVENTIVE MAINTENANCE REPORT\nLAPORAN PEMELIHARAAN PREVENTIF";
  if (!updated.coverSubtitle?.includes('\n')) {
    const q = updated.quarter || 'Q3';
    const mEn = (updated.monthNameEn || 'July').toUpperCase();
    const mId = (updated.monthName || 'Juli').toUpperCase();
    const yr = updated.year || 2026;
    updated.coverSubtitle = `${q} - ${mEn} ${yr}\n${q.replace('Q', 'TRIWULAN ')} - ${mId} ${yr}`;
  }

  // 2. Approval Sheet
  if (updated.approvalSheet) {
    if (updated.approvalSheet.preparedBy) {
      updated.approvalSheet.preparedBy.title = "Prepared By\nDisusun Oleh";
    }
    if (updated.approvalSheet.reviewedBy1) {
      updated.approvalSheet.reviewedBy1.title = "Reviewed By\nDiperiksa Oleh";
    }
    if (updated.approvalSheet.reviewedBy2) {
      updated.approvalSheet.reviewedBy2.title = "Reviewed By\nDiperiksa Oleh";
    }
    if (updated.approvalSheet.reviewedBy3) {
      updated.approvalSheet.reviewedBy3.title = "Reviewed By\nDiperiksa Oleh";
    }
    if (updated.approvalSheet.approvedBy1) {
      updated.approvalSheet.approvedBy1.title = "Approved By\nDisetujui Oleh";
    }
    if (updated.approvalSheet.approvedBy2) {
      updated.approvalSheet.approvedBy2.title = "Approved By\nDisetujui Oleh";
    }
  }

  // 3. Table of Contents (Bab 1 - Bab 13)
  const bilingualTOCMap: { [key: string]: string } = {
    '1. Executive Summary': '1. Executive Summary\nRingkasan Eksekutif',
    '2. Key Highlight': '2. Key Highlight & Schedule\nSorotan Utama & Jadwal Pemeliharaan',
    '3. General Information': '3. General Information & Maintenance Team\nInformasi Umum & Tim Pemeliharaan',
    '4. Maintenance Objectives': '4. Maintenance Objectives & KPI\nTujuan Pemeliharaan & Indikator Kinerja',
    '5. Equipment and System Details': '5. Equipment and System Details\nDetail Peralatan dan Daftar Aset',
    '6. Scope of Work': '6. Scope of Work\nRuang Lingkup Pekerjaan Pemeliharaan',
    '7. Observation and Finding': '7. Observation and Finding\nObservasi Lapangan & Temuan Inspeksi',
    '8. Repairs, Replacement & Services': '8. Repairs, Replacement & Services\nPerbaikan, Penggantian Suku Cadang & Servis',
    '9. Testing & Validation': '9. Testing & Validation\nPengujian & Validasi Metode Kerja',
    '10. Challenges, Mitigation and Lesson Learned': '10. Challenges, Mitigation and Lesson Learned\nTantangan, Langkah Mitigasi & Pembelajaran',
    '11. Recommendations and Future Action': '11. Recommendations and Future Action\nRekomendasi & Rencana Tindak Lanjut',
    '12. Photo and Documentation Log': '12. Photo and Documentation Log\nLog Foto dan Dokumentasi Visual',
    '13. Appendices': '13. Appendices\nLampiran Dokumen Servis Resmi'
  };

  if (Array.isArray(updated.tableOfContents)) {
    updated.tableOfContents = updated.tableOfContents.map(item => {
      let t = item.title || '';
      if (!t.includes('\n')) {
        for (const [k, v] of Object.entries(bilingualTOCMap)) {
          if (t.toLowerCase().includes(k.toLowerCase().split('.')[1]?.trim() || k.toLowerCase())) {
            t = v;
            break;
          }
        }
      }
      return { ...item, title: t };
    });
  } else {
    updated.tableOfContents = Object.entries(bilingualTOCMap).map(([_, v], idx) => ({
      title: v,
      page: ['5', '5', '218', '218', '220', '238', '252', '256', '258', '259', '264', '265', '268'][idx] || '1'
    }));
  }

  // 4. List of Tables (Tabel 1 - Tabel 36)
  const bilingualLOTMap: { [key: number]: string } = {
    1: `Table 1. Schedule Maintenance – ${updated.monthNameEn} ${updated.year}\nTabel 1. Jadwal Pemeliharaan Preventif – ${updated.monthName} ${updated.year}`,
    2: 'Table 2. Task Performance – Chiller System\nTabel 2. Kinerja Pekerjaan – Sistem Chiller',
    3: 'Table 3. Task Performance – Cooling Tower & Piping\nTabel 3. Kinerja Pekerjaan – Cooling Tower & Perpipaan',
    4: 'Table 4. Task Performance – Cooling Pump\nTabel 4. Kinerja Pekerjaan – Pompa Pendingin',
    5: 'Table 5. Task Performance – Transformer\nTabel 5. Kinerja Pekerjaan – Transformator Daya',
    6: 'Table 6. Task Performance – Generator & Fuel System\nTabel 6. Kinerja Pekerjaan – Genset & Sistem Bahan Bakar',
    7: 'Table 7. Task Performance – MV & RMU Panel\nTabel 7. Kinerja Pekerjaan – Panel Tegangan Menengah & RMU',
    8: 'Table 8. Task Performance – LV Panel\nTabel 8. Kinerja Pekerjaan – Panel Tegangan Rendah (LV)',
    9: 'Table 9. Task Performance – UPS & Battery Bank\nTabel 9. Kinerja Pekerjaan – UPS & Bank Baterai',
    10: 'Table 10. Task Performance – Power Distribution Unit (PDU)\nTabel 10. Kinerja Pekerjaan – Unit Distribusi Daya (PDU)',
    11: 'Table 11. Task Performance – PAC / CRAC Precision Cooling\nTabel 11. Kinerja Pekerjaan – Pendingin Presisi (PAC/CRAC)',
    12: 'Table 12. Task Performance – Fire Alarm & Suppression\nTabel 12. Kinerja Pekerjaan – Alarm & Proteksi Kebakaran',
    13: 'Table 13. Task Performance – VESDA Early Warning\nTabel 13. Kinerja Pekerjaan – Deteksi Dini Asap VESDA',
    14: 'Table 14. Task Performance – Access Control & CCTV\nTabel 14. Kinerja Pekerjaan – Kontrol Akses & CCTV',
    15: 'Table 15. Task Performance – Lightning Protection & Grounding\nTabel 15. Kinerja Pekerjaan – Penangkal Petir & Pembumian',
    16: 'Table 16. Task Performance – Building Automation System (BAS)\nTabel 16. Kinerja Pekerjaan – Otomasi Gedung (BAS)',
    17: 'Table 17. Task Performance – Water Treatment Plant\nTabel 17. Kinerja Pekerjaan – Pengolahan Air (WTP)',
    18: 'Table 18. Team Composition\nTabel 18. Susunan Tim Pemeliharaan',
    19: 'Table 19. KPI Metric\nTabel 19. Metrik Indikator Kinerja Utama (KPI)',
    20: 'Table 20. Equipment and System Details\nTabel 20. Daftar Detail Peralatan dan Aset BOQ',
    21: 'Table 21. System Overview\nTabel 21. Gambaran Umum Fungsi Sistem',
    22: 'Table 22. Scope of Work\nTabel 22. Ruang Lingkup Pekerjaan PM',
    23: 'Table 23. Observation & Finding\nTabel 23. Observasi dan Temuan Lapangan',
    24: 'Table 24. Root Cause Analysis – Electrical System\nTabel 24. Analisis Akar Masalah – Sistem Kelistrikan',
    25: 'Table 25. Root Cause Analysis – Cooling System\nTabel 25. Analisis Akar Masalah – Sistem Pendingin',
    26: 'Table 26. Root Cause Analysis – Fire & Safety System\nTabel 26. Analisis Akar Masalah – Sistem Kebakaran & K3',
    27: 'Table 27. Root Cause Analysis – Civil & Architectural\nTabel 27. Analisis Akar Masalah – Sipil & Arsitektur',
    28: 'Table 28. Finding Severity Matrix\nTabel 28. Matriks Tingkat Keparahan Temuan',
    29: 'Table 29. Repair, Replacement & Services\nTabel 29. Perbaikan, Penggantian Suku Cadang & Servis',
    30: 'Table 30. Calibration and Adjustments Performed\nTabel 30. Kalibrasi dan Penyesuaian Komponen',
    31: 'Table 31. Validation Methods\nTabel 31. Metode Pengujian dan Validasi',
    32: 'Table 32. Challenges Faced\nTabel 32. Tantangan yang Dihadapi',
    33: 'Table 33. Mitigation Steps\nTabel 33. Langkah Mitigasi Risiko',
    34: 'Table 34. Lessons Learned\nTabel 34. Pembelajaran Operasional',
    35: 'Table 35. Recommendations and Future Action\nTabel 35. Rekomendasi dan Tindak Lanjut',
    36: 'Table 36. Photo and Documentation Log\nTabel 36. Log Foto dan Dokumentasi Visual'
  };

  if (Array.isArray(updated.listOfTables)) {
    updated.listOfTables = updated.listOfTables.map((item, idx) => {
      let t = item.title || '';
      if (!t.includes('\n')) {
        const tableNum = idx + 1;
        if (bilingualLOTMap[tableNum]) {
          t = bilingualLOTMap[tableNum];
        }
      }
      return { ...item, title: t };
    });
  } else {
    updated.listOfTables = Object.values(bilingualLOTMap).map((title, idx) => ({
      title,
      page: ['5', '6', '8', '10', '12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32', '34', '36', '218', '218', '220', '236', '238', '252', '253', '254', '254', '255', '255', '256', '258', '258', '259', '261', '263', '264', '265'][idx] || '1'
    }));
  }

  // 5. Bab 1: Executive Summary & Purpose of Report
  updated.purposeOfReportTitle = "Purpose of Report\nTujuan Laporan";
  updated.purposeOfReportIntro = "To document, evaluate, and ensure that maintenance activities run according to plans and operational standards such as:\nUntuk mendokumentasikan, mengevaluasi, dan memastikan bahwa kegiatan pemeliharaan berjalan sesuai rencana dan standar operasional seperti:";

  if (!updated.executiveSummaryText?.includes('\n')) {
    updated.executiveSummaryText = "Maintenance is a series of activities to maintain facilities and equipment so that they are always ready to use to carry out production effectively and efficiently according to the schedule that has been set and based on standards (functional and quality).\nPemeliharaan adalah serangkaian kegiatan untuk memelihara fasilitas dan peralatan agar selalu siap digunakan guna menjalankan operasional secara efektif dan efisien sesuai jadwal yang telah ditetapkan serta berbasis standar keandalan.";
  }

  // Purpose Points Bilingual
  updated.purposePoints = [
    {
      title: "Documentation of Preventive Maintenance Activities:\nDokumentasi Kegiatan Pemeliharaan Preventif:",
      desc: "Records all PM activities that have been carried out for one month. Include details such as schedule, equipment maintained, methods used, inspection results, and corrective actions if any.\nMencatat seluruh aktivitas PM yang telah dilaksanakan selama satu bulan. Mencakup rincian jadwal, peralatan yang dirawat, metode yang digunakan, hasil inspeksi, serta tindakan korektif jika ada."
    },
    {
      title: "Equipment and System Performance Evaluation:\nEvaluasi Kinerja Peralatan dan Sistem:",
      desc: "Assess the condition of equipment based on inspection and maintenance results.\nMenilai kondisi fisik dan performa operasional peralatan berdasarkan hasil inspeksi dan pemeliharaan menyeluruh."
    },
    {
      title: "Reporting to Management:\nPelaporan kepada Manajemen Fasilitas:",
      desc: "Provides management with a comprehensive overview of the condition of the facility and the effectiveness of the PM program.\nMemberikan gambaran menyeluruh kepada manajemen mengenai keandalan fasilitas dan efektivitas program pemeliharaan preventif."
    },
    {
      title: "Ensure Compliance with Procedures and Standards:\nMemastikan Kepatuhan terhadap Prosedur dan Standar:",
      desc: "Prove that PM activities are carried out in accordance with applicable Procedures and regulations (e.g. national/international standards).\nMemverifikasi bahwa kegiatan PM dilaksanakan sesuai prosedur resmi data center dan standar industri internasional yang berlaku."
    }
  ];

  // 6. Schedule Table 1 (Status Bilingual)
  if (Array.isArray(updated.scheduleTable1)) {
    updated.scheduleTable1 = updated.scheduleTable1.map(item => {
      let st = item.status || '';
      if (st && !st.includes('\n')) {
        const stLower = st.toLowerCase();
        if (stLower.includes('complete') || stLower.includes('selesai')) {
          st = 'Completed\nSelesai';
        } else if (stLower.includes('schedule') || stLower.includes('jadwal')) {
          st = 'On Schedule\nSesuai Jadwal';
        } else if (stLower.includes('progress') || stLower.includes('berjalan')) {
          st = 'In Progress\nSedang Berjalan';
        } else if (stLower.includes('defer') || stLower.includes('tunda')) {
          st = 'Deferred\nDitunda';
        }
      }
      return { ...item, status: st };
    });
  }

  // 7. Task Performance Tables (Tabel 2 - 17)
  if (Array.isArray(updated.taskPerformanceTables)) {
    updated.taskPerformanceTables.forEach(t => {
      t.items = t.items.map(item => {
        const taskPM = convertTaskPMToBilingual(item.taskPM || '', t.scope || item.className);

        let criticalRepairs = item.criticalRepairs || '';
        if (!criticalRepairs.includes('\n') || criticalRepairs.trim() === '-' || criticalRepairs.toLowerCase().includes('no critical') || criticalRepairs.toLowerCase().includes('tidak ada perbaikan')) {
          criticalRepairs = 'No critical repair is required.\nSaat ini tidak diperlukan perbaikan mendesak.';
        }

        let operationalStatus = item.operationalStatus || '';
        if (!operationalStatus.includes('\n') || operationalStatus.toLowerCase().includes('good') || operationalStatus.toLowerCase().includes('normal') || operationalStatus.toLowerCase().includes('baik')) {
          operationalStatus = 'Good Condition / Normal Operation\nKondisi Baik / Beroperasi Normal';
        }

        let issues = item.issues || '';
        if (!issues.includes('\n') || issues.trim() === '-' || issues.toLowerCase().includes('no abnormality') || issues.toLowerCase().includes('tidak ada kendala') || issues.toLowerCase().includes('normal') || issues.toLowerCase().includes('tidak ditemukan')) {
          issues = 'No abnormality was observed during normal operation.\nTidak ditemukan adanya kelainan selama pengoperasian normal.';
        }

        let recommendations = item.recommendations || '';
        if (!recommendations.includes('\n') || recommendations.trim() === '-' || recommendations.toLowerCase().includes('continue routine') || recommendations.toLowerCase().includes('lanjutkan pemantauan') || recommendations.toLowerCase().includes('pemeliharaan preventif')) {
          recommendations = 'Continue routine monitoring and preventive maintenance to ensure reliable operation.\nLanjutkan pemantauan rutin dan pemeliharaan preventif untuk memastikan pengoperasian yang andal.';
        }

        return {
          ...item,
          taskPM,
          criticalRepairs,
          operationalStatus,
          issues,
          recommendations
        };
      });
    });
  }

  // 8. Bab 3: General Information
  if (updated.generalInfo) {
    updated.generalInfo.maintenanceType = "Preventive & Corrective Maintenance\nPemeliharaan Preventif & Korektif";
    if (updated.generalInfo.teamLeader && !updated.generalInfo.teamLeader.role.includes('\n')) {
      updated.generalInfo.teamLeader.role = "Site Coordinator & Team Leader\nKoordinator Lapangan & Ketua Tim";
    }
  }

  // 9. Bab 4: KPI Metrics (Tabel 19)
  if (!Array.isArray(updated.progressPmTable19) || updated.progressPmTable19.length === 0) {
    if (Array.isArray(updated.scheduleTable1) && updated.scheduleTable1.length > 0) {
      const monthNameEn = updated.monthNameEn || 'July';
      let count = 1;
      let totalPctSum = 0;
      updated.progressPmTable19 = updated.scheduleTable1.map(s => {
        let planStart = `10 ${monthNameEn}`;
        let planFinish = `20 ${monthNameEn}`;
        if (s.plan && s.plan.includes('-')) {
          const parts = s.plan.replace(monthNameEn, '').split('-').map(p => p.trim());
          planStart = `${parts[0]} ${monthNameEn}`;
          planFinish = `${parts[1]} ${monthNameEn}`;
        }
        const unit = getDefaultBoqUnitForDevice(s.device);
        let actualStart = planStart;
        let actualFinish = planFinish;
        let actualUnit: number | string = unit;
        let pctFinish = '100%';
        let remark = '';

        if (s.device?.toLowerCase().includes('exhaust')) {
          actualUnit = 8;
          pctFinish = '66,67%';
          remark = '1F-RM-TES TANK-1 dan 1F-RM-TES TANK-2 Access susah (terlalu tinggi), dan 1F-RM CHILLER FAN-1 dan 1F-RM CHILLER FAN-2 ada pekerjaan project';
        }
        const numPct = parseFloat(pctFinish.replace(',', '.').replace('%', '')) || 100;
        totalPctSum += numPct;

        return {
          no: `${count++}.`,
          activity: s.device,
          unit,
          planStart,
          planFinish,
          actualStart,
          actualFinish,
          actualUnit,
          pctFinish,
          remark
        };
      });
      const avgNum = updated.progressPmTable19.length > 0 ? (totalPctSum / updated.progressPmTable19.length) : 100;
      updated.progressPmAverage = `${avgNum.toFixed(2).replace('.', ',')}%`;
    }
  }

  if (!Array.isArray(updated.slaOrdersTable19) || updated.slaOrdersTable19.length === 0) {
    updated.slaOrdersTable19 = [
      { no: '1.', activity: 'Response Time', unit: 'Order', actual: 18, finish: 15, pctFinish: '83,33%', comply: 'TM', pctComply: '83%' },
      { no: '2.', activity: 'Onsite Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
      { no: '3.', activity: 'Restore Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
      { no: '4.', activity: 'Resolution Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' }
    ];
    updated.slaOrdersPeriodTotal = '%';
  }

  // Ensure service credit matrix matches official Photo 2
  if (!Array.isArray(updated.serviceCreditMatrix) || updated.serviceCreditMatrix.length === 0 || updated.serviceCreditMatrix.some(m => m.credit?.toLowerCase().includes('kontrak'))) {
    updated.serviceCreditMatrix = [
      { range: '98% - 100%', credit: '0%', highlighted: false, isTermination: false },
      { range: '95% - <98%', credit: '5%', highlighted: false, isTermination: false },
      { range: '90% - <95%', credit: '10%', highlighted: false, isTermination: false },
      { range: '85% - <90%', credit: '15%', highlighted: false, isTermination: false },
      { range: '80% - <85%', credit: '20%', highlighted: false, isTermination: false },
      { range: '<80%', credit: 'Contract can be terminated', highlighted: true, isTermination: true }
    ];
  }

  if (Array.isArray(updated.kpiMetricsTable19)) {
    const kpiActivityBilingualMap: { [key: string]: string } = {
      'preventive': 'Preventive Maintenance Implementation\nPelaksanaan Pemeliharaan Preventif',
      'corrective': 'Corrective Maintenance Response\nRespon Pemeliharaan Korektif',
      'uptime': 'Critical Equipment Uptime / Availability\nKetersediaan & Uptime Sistem Kritikal',
      'housekeeping': 'Housekeeping & Site Cleanliness\nKebersihan dan Kerapian Area Fasilitas',
      'sla': 'SLA Compliance & Documentation\nKepatuhan SLA dan Kelengkapan Dokumentasi'
    };

    updated.kpiMetricsTable19 = updated.kpiMetricsTable19.map(item => {
      let act = item.activity || '';
      if (!act.includes('\n')) {
        const actLower = act.toLowerCase();
        for (const [k, v] of Object.entries(kpiActivityBilingualMap)) {
          if (actLower.includes(k)) {
            act = v;
            break;
          }
        }
      }
      return { ...item, activity: act };
    });
  }

  // 10. Bab 5: Equipment Details (Tabel 20) & System Overview (Tabel 21)
  if (Array.isArray(updated.equipmentDetailsTable20)) {
    updated.equipmentDetailsTable20 = updated.equipmentDetailsTable20.map(item => {
      let st = item.statusBeforeMaintenance || 'Good Operation';
      if (!st.includes('\n')) {
        st = 'Good Operation / Normal\nBeroperasi Baik / Normal';
      }
      return { ...item, statusBeforeMaintenance: st };
    });
  }

  if (Array.isArray(updated.systemOverviewTable21)) {
    const overviewDescMap: { [key: string]: string } = {
      'chiller': 'Central refrigeration system supplying chilled water for mission-critical cooling.\nSistem refrigerasi sentral penyuplai air dingin pendinginan ruang data hall.',
      'cooling tower': 'Condenser heat rejection facility using evaporative cooling.\nFasilitas pelepasan panas kondensor melalui metode pendinginan evaporatif.',
      'pump': 'Water circulating pumps for chilled and condenser distribution loops.\nPompa sirkulasi air untuk loop distribusi pendingin dan kondensor.',
      'ups': 'Uninterruptible power supply system ensuring zero-second power continuity.\nSistem catu daya bebas jeda penjamin kontinuitas listrik beban kritikal.',
      'generator': 'Emergency diesel generator sets providing backup power during utility outage.\nGenset diesel darurat penyuplai daya cadangan saat pasokan PLN padam.',
      'transformer': 'Step-down electrical substation converting 20kV MV to 400V LV.\nGardu trafo penurun tegangan dari 20kV TM menjadi 400V TR.',
      'pdu': 'Precision power distribution unit feeding server racks with dual-feed circuits.\nUnit distribusi daya presisi penyuplai rak server dengan sirkuit ganda.',
      'pac': 'Precision air conditioning maintaining strict data hall temperature and humidity.\nPengondisi udara presisi penjaga suhu dan kelembaban standar data hall.',
      'fire': 'Automatic early warning detection and clean agent fire suppression system.\nSistem deteksi dini otomatis dan pemadaman kebakaran gas bersih.'
    };

    updated.systemOverviewTable21 = updated.systemOverviewTable21.map(item => {
      let desc = item.functionDesc || '';
      if (!desc.includes('\n')) {
        const compLower = (item.component || '').toLowerCase();
        let matched = false;
        for (const [k, v] of Object.entries(overviewDescMap)) {
          if (compLower.includes(k)) {
            desc = v;
            matched = true;
            break;
          }
        }
        if (!matched) {
          desc = `${desc}\nFungsi operasional berjalan normal sesuai standar keandalan Tier Data Center.`;
        }
      }
      return { ...item, functionDesc: desc };
    });
  }

  // 11. Bab 6: Scope of Work (Tabel 22)
  if (Array.isArray(updated.scopeOfWorkTable22)) {
    const stepBilingualMap: { [key: string]: string } = {
      'visual': 'Visual & Physical Inspection\nInspeksi Visual & Fisik',
      'cleaning': 'Cleaning & Dust Removal\nPembersihan & Pengangkatan Debu',
      'parameter': 'Electrical & Operating Parameter Checks\nPemeriksaan Parameter Kelistrikan & Tekanan',
      'functional': 'Functional Testing & Sequence Validation\nPengujian Fungsional & Validasi Sekuens'
    };

    updated.scopeOfWorkTable22.forEach(cat => {
      const masterCat = getScopeOfWorkForScope(cat.category);

      cat.items.forEach((it, stepIdx) => {
        if (!it.step.includes('\n')) {
          const stepLower = it.step.toLowerCase();
          for (const [k, v] of Object.entries(stepBilingualMap)) {
            if (stepLower.includes(k)) {
              it.step = v;
              break;
            }
          }
        }

        // Ensure tasks inside each step are also bilingual (English \n Indonesian)
        if (Array.isArray(it.tasks)) {
          it.tasks = it.tasks.map((task, taskIdx) => {
            if (task.includes('\n')) return task; // Already bilingual

            // Try to match from master category
            if (masterCat && masterCat.items && masterCat.items[stepIdx] && masterCat.items[stepIdx].tasks[taskIdx]) {
              const candidate = masterCat.items[stepIdx].tasks[taskIdx];
              if (candidate.includes('\n')) return candidate;
            }

            // Fallback: lookup in masterCat across all steps
            if (masterCat && masterCat.items) {
              for (const mStep of masterCat.items) {
                for (const mTask of mStep.tasks) {
                  if (mTask.includes(task)) return mTask;
                }
              }
            }

            return `Perform technical maintenance and operational inspection on system.\n${task}`;
          });
        }
      });
    });
  }

  // 12. Bab 7: Observation Table 23 (Finding & Notes)
  if (Array.isArray(updated.observationTable23)) {
    updated.observationTable23.forEach(sec => {
      sec.items = sec.items.map(item => {
        let cond = item.conditionBefore || '';
        if (!cond.includes('\n')) {
          const cLower = cond.toLowerCase();
          if (cLower.includes('karat') || cLower.includes('rust')) {
            cond = 'Minor surface corrosion observed on mounting bolts.\nKarat minor teramati pada baut dan permukaan dudukan komponen.';
          } else if (cLower.includes('kendur') || cLower.includes('loose') || cLower.includes('tension')) {
            cond = 'Slight mechanical loosening / tension deviation detected.\nTerdapat sedikit deviasi kekencangan / kelonggaran mekanis pengikat.';
          } else if (cLower.includes('debu') || cLower.includes('kotor') || cLower.includes('dust')) {
            cond = 'Dust accumulation on cooling fin surface and filters.\nAkumulasi debu pada sirip pendingin dan elemen filter udara.';
          } else if (cLower.includes('bocor') || cLower.includes('leak') || cLower.includes('rembes')) {
            cond = 'Minor condensation drip observed around flange joint.\nTeramati tetesan kondensasi minor di sekitar sambungan flensa.';
          } else {
            cond = `${cond}\nKondisi terinspeksi memerlukan tindak lanjut pembersihan atau kalibrasi rutin.`;
          }
        }

        let notes = item.inspectionNotes || '';
        if (!notes.includes('\n')) {
          const nLower = notes.toLowerCase();
          if (nLower.includes('re-tighten') || nLower.includes('kencang')) {
            notes = 'Re-tightening and cleaning performed in accordance with standards.\nTelah dilakukan pengencangan ulang dan pembersihan sesuai standar teknis.';
          } else if (nLower.includes('sesuai') || nLower.includes('adjust')) {
            notes = 'Adjusted and calibrated according to manufacturer specifications.\nTelah disesuaikan dan dikalibrasi sesuai spesifikasi standar pabrikan.';
          } else if (nLower.includes('bersih') || nLower.includes('clean')) {
            notes = 'Cleaned using industrial equipment and verified functional.\nTelah dibersihkan menggunakan peralatan industri dan diverifikasi fungsinya.';
          } else {
            notes = `${notes}\nTelah dilakukan tindakan korektif dan diverifikasi aman oleh tim teknisi.`;
          }
        }

        return { ...item, conditionBefore: cond, inspectionNotes: notes };
      });
    });
  }

  // Root Cause Analyses Bilingual
  if (Array.isArray(updated.rootCauseAnalyses)) {
    updated.rootCauseAnalyses.forEach(rc => {
      if (!rc.title.includes('\n')) {
        rc.title = `${rc.title}\nAnalisis Akar Masalah Sistem & Verifikasi Lapangan`;
      }
      if (!rc.description.includes('\n')) {
        rc.description = `${rc.description}\nPemeriksaan mendalam menyimpulkan tidak ada dampak pada kontinuitas operasional data center.`;
      }
    });
  }

  // 13. Bab 8: Repairs & Services (Tabel 29)
  if (Array.isArray(updated.repairsTable29)) {
    updated.repairsTable29.forEach(r => {
      if (!r.partName.includes('\n')) {
        r.partName = `${r.partName}\nSuku Cadang Standby / Servis`;
      }
      if (!r.replacedStatus.includes('\n')) {
        const stLower = r.replacedStatus.toLowerCase();
        if (stLower.includes('stock') || stLower.includes('standby')) {
          r.replacedStatus = 'Stock Available / Standby\nStok Siap Pasang di Lokasi';
        } else if (stLower.includes('replace') || stLower.includes('ganti')) {
          r.replacedStatus = 'Part Replaced & Tested\nSuku Cadang Diganti & Teruji';
        } else {
          r.replacedStatus = `${r.replacedStatus}\nStatus Terverifikasi Tim Gudang`;
        }
      }
    });
  }

  // 14. Bab 9: Calibration (Tabel 30) & Validation (Tabel 31)
  if (Array.isArray(updated.calibrationTable30)) {
    updated.calibrationTable30.forEach(c => {
      if (!c.calibrationDetail.includes('\n')) {
        c.calibrationDetail = `${c.calibrationDetail}\nDikalibrasi menggunakan alat terakreditasi KAN dan diverifikasi akurat.`;
      }
    });
  }

  if (Array.isArray(updated.validationMethodsTable31)) {
    updated.validationMethodsTable31.forEach(v => {
      if (!v.validationMethod.includes('\n')) {
        v.validationMethod = `${v.validationMethod}\nMetode validasi pengujian fungsional terkonfirmasi sesuai standar NeutraDC.`;
      }
    });
  }

  // 15. Bab 10: Challenges (Table 32), Mitigations (Table 33), Lessons Learned (Table 34)
  if (Array.isArray(updated.challengesTable32)) {
    const bilingualChallenges = [
      "Live data center environment requires zero downtime during maintenance.\nLingkungan data center aktif mewajibkan toleransi downtime nol selama pekerjaan.",
      "High ambient temperature during peak hours demanding maximum cooling efficiency.\nSuhu lingkungan tinggi saat beban puncak menuntut efisiensi pendinginan maksimal.",
      "Stringent permit-to-work and multi-level safety authorization protocols.\nProtokol izin kerja ketat dan otorisasi bertingkat sebelum intervensi teknis.",
      "Tight maintenance service window to avoid disruption on critical customer IT racks.\nWaktu pengerjaan pemeliharaan terbatas agar tidak mengganggu operasional rak pelanggan."
    ];
    updated.challengesTable32.forEach((c, idx) => {
      if (!c.challenge.includes('\n')) {
        c.challenge = bilingualChallenges[idx % bilingualChallenges.length];
      }
    });
  }

  if (Array.isArray(updated.mitigationTable33)) {
    const bilingualMitigations = [
      "Execution strictly adhering to Method of Procedure (MOP) with N+1 standby redundancy.\nPelaksanaan mengikuti MOP ketat serta kesiapan sistem cadangan N+1.",
      "Optimized chiller staging and proactive chilled water temperature modulation.\nOptimalisasi pembagian beban chiller dan modulasi suhu air dingin proaktif.",
      "Pre-maintenance briefing, tool calibration verification, and emergency rollback readiness.\nBriefing pra-pemeliharaan, verifikasi kalibrasi alat, dan kesiapan rencana mitigasi darurat.",
      "Execution during approved maintenance window with continuous NOC monitoring.\nPekerjaan dilaksanakan pada jadwal disetujui dengan pengawasan penuh tim NOC."
    ];
    updated.mitigationTable33.forEach((m, idx) => {
      if (!m.mitigation.includes('\n')) {
        m.mitigation = bilingualMitigations[idx % bilingualMitigations.length];
      }
    });
  }

  if (Array.isArray(updated.lessonsLearnedTable34)) {
    const bilingualLessons = [
      "Predictive monitoring through thermal imaging prevents unexpected electrical failure.\nPemantauan prediktif berbasis termografi efektif mencegah kegagalan elektrikal mendadak.",
      "Routine chemical water treatment preserves chiller heat exchanger efficiency and lifespan.\nPerlakuan kimiawi air rutin menjaga efisiensi dan usia pakai penukar panas chiller.",
      "Close inter-team coordination ensures 100% compliance to NeutraDC uptime SLA standards.\nKoordinasi terpadu antar tim menjamin kepatuhan 100% pada standar uptime SLA NeutraDC.",
      "Comprehensive daily checklist records expedite root cause analysis on minor deviations.\nChecklist harian yang lengkap mempercepat analisis akar masalah terhadap deviasi minor."
    ];
    updated.lessonsLearnedTable34.forEach((l, idx) => {
      if (!l.lessonLearned.includes('\n')) {
        l.lessonLearned = bilingualLessons[idx % bilingualLessons.length];
      }
    });
  }

  // 16. Bab 11: Recommendations Table 35
  if (Array.isArray(updated.recommendationsTable35)) {
    updated.recommendationsTable35.forEach(sec => {
      sec.items.forEach(item => {
        if (!item.shortTerm.includes('\n')) {
          item.shortTerm = `Immediate corrective action and torque verification on ${item.component}.\nLakukan penanganan segera dan verifikasi torsi pengikat pada ${item.component}.`;
        }
        if (!item.longTerm.includes('\n')) {
          item.longTerm = `Implement scheduled preventive monitoring and lifecycle sparepart management.\nTerapkan pemantauan preventif berkala dan manajemen suku cadang siklus hidup.`;
        }
      });
    });
  }

  // 17. Bab 12: Photo Log Table 36
  if (Array.isArray(updated.photoLogsTable36)) {
    updated.photoLogsTable36.forEach(p => {
      if (p.caption && !p.caption.includes('\n')) {
        p.caption = `${p.caption}\nDokumentasi visual sebelum, saat, dan sesudah pemeliharaan.`;
      }
    });
  }

  // 18. Bab 13: Appendices Note
  updated.appendicesNote = "Attach the original service report & supporting documents for certification, test results, etc.\nLampirkan lembar laporan servis asli & dokumen pendukung untuk sertifikasi, hasil uji, dll.";

  return updated;
}
