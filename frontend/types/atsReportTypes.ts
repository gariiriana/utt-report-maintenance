// ============================================================================
// FILE: frontend/types/atsReportTypes.ts
// Deskripsi: Definisi Tipe TypeScript & Template Nilai Bawaan (Default Values)
//            untuk Laporan Service Maintenance ATS (Automatic Transfer Switch).
//            Berisi interface foto input AI, tabel inspeksi visual, pengukuran power meter,
//            pengukuran tegangan/arus (V/A), thermovisi, dan tahanan pembumian (grounding).
// ============================================================================

/** Input Foto untuk Analisa Otomatis AI Gemini */
export interface ATSPhotoInput {
  base64: string; // Gambar format base64
  category: 'visual_inspection' | 'power_meter' | 'thermal' | 'grounding'; // Kategori foto
  label: string;    // Label deskripsi foto
  parameter?: string; // Parameter opsional
}

/** Body Request untuk Endpoint Backend POST /api/ai/ats-report */
export interface ATSAnalyzeRequest {
  photos: ATSPhotoInput[];
}

/** Struktur 1 Baris Tabel Inspeksi Visual & Cek fisik ATS */
export interface VisualInspectionItem {
  no: string;                               // Poin inspeksi (a - p)
  activity: string;                         // Jenis aktivitas pemeriksaan
  parameter: string;                        // Standar kondisi ideal
  condition: 'Good' | 'Not Good';           // Hasil kondisi (Baik / Tidak Baik)
  remarks: string;                          // Catatan tambahan insinyur
}

/** Pembacaan Baris Tegangan Fasa Power Meter */
export interface PowerMeterRow {
  voltage: string;                          // Nilai tegangan (Volt)
  remarks: string;                          // Catatan
}

/** Data Pencatatan Digital Power Meter Panel ATS */
export interface PowerMeterData {
  rs: PowerMeterRow;                        // Tegangan Fasa R-S
  st: PowerMeterRow;                        // Tegangan Fasa S-T
  tr: PowerMeterRow;                        // Tegangan Fasa T-R
  rn: PowerMeterRow;                        // Tegangan Fasa R-N
  sn: PowerMeterRow;                        // Tegangan Fasa S-N
  tn: PowerMeterRow;                        // Tegangan Fasa T-N
  n: PowerMeterRow;                         // Tegangan Netral
  kw: string;                               // Daya Aktif (kW)
  kva: string;                              // Daya Semu (kVA)
  kvar: string;                             // Daya Reaktif (kVAR)
  cos_p: string;                            // Faktor Daya (Cos Phi)
  r_ampere: string;                         // Arus Beban Fasa R (Ampere)
  s_ampere: string;                         // Arus Beban Fasa S (Ampere)
  t_ampere: string;                         // Arus Beban Fasa T (Ampere)
  n_ampere: string;                         // Arus Netral (Ampere)
}

/** Data Pengukuran Tegangan & Arus Manual */
export interface VoltageCurrentData {
  voltage_rs: string;
  voltage_st: string;
  voltage_tr: string;
  voltage_rn: string;
  voltage_sn: string;
  voltage_tn: string;
  voltage_ng: string;                       // Tegangan Netral ke Ground
  ampere_r: string;
  ampere_s: string;
  ampere_t: string;
  remarks: string;
}

/** Hasil Pengukuran Suhu Thermal Imager */
export interface ThermalData {
  result_temperature: string;               // Suhu terukur (°C)
  standard: string;                         // Standar batas maksimum (misal "40°C")
  remarks: string;                          // Catatan (misal "Normal, tidak ada hotspot")
}

/** Hasil Pengukuran Tahanan Pembumian Grounding */
export interface GroundingData {
  result_ohm: string;                       // Nilai tahanan terukur (Ohm / Ω)
  standard: string;                         // Standar maksimum (misal "<5 Ω")
  remarks: string;                          // Catatan
}

/** Status Operasional & Analisis Kerusakan */
export interface OperationStatusData {
  is_normal: boolean;                       // Apakah sistem ATS beroperasi normal
  remark: string;                           // Ringkasan catatan
  fault_symptom: string;                    // Gejala kegagalan/gangguan
  fault_analysis: string;                   // Analisis penyebab gangguan
  work_done: string;                        // Tindakan perbaikan yang dilakukan
  fault_part_sn: string;                    // Serial Number komponen rusak
  fault_part_name: string;                  // Nama komponen rusak
}

/** Struktur Lengkap Data Laporan ATS */
export interface ATSReportData {
  visual_inspection: VisualInspectionItem[];
  power_meter_recording: PowerMeterData;
  voltage_current: VoltageCurrentData;
  thermal_measurement: ThermalData;
  grounding_resistance: GroundingData;
  operation_status: OperationStatusData;
}

/** Informasi Pelanggan & Lokasi Perangkat (Input Manual Insinyur) */
export interface ATSCustomerInfo {
  companyName: string;                      // Nama perusahaan (Neutra DC Cikarang)
  equipmentName: string;                    // Nama Perangkat (ATS)
  ciDescription: string;                    // Deskripsi Perangkat
  ciName: string;                           // Tag Nama Perangkat (1F - ATS - A)
  type: string;                             // Tipe/Model Perangkat
  serialNo: string;                         // Nomor Seri
  productName: string;                      // Merk/Manufaktur (ASCO)
  productYears: string;                     // Tahun Pembuatan
  specification: string;                    // Spesifikasi Kapasitas (4000 A)
  location: string;                         // Lokasi Ruangan (Power Room A)
  area: string;                             // Area Gedung (Campus 5)
  mapNo: string;                            // Nomor Dokumen Acuan Prosedur
  quarter: string;                          // Kuartal Pelaksanaan (Q1/Q2/Q3/Q4)
  date: string;                             // Tanggal Pelaksanaan
  engineer: string;                         // Nama Insinyur Pelaksana
}

/** Data Rincian Waktu Kerja (Time Spent) */
export interface ATSTimeSpent {
  date: string;                             // Tanggal
  departure: string;                        // Jam Berangkat
  start: string;                            // Jam Mulai Kerja
  finish: string;                           // Jam Selesai Kerja
}

/** Dokumen Laporan Lengkap ATS Service Report */
export interface ATSFullReport {
  customerInfo: ATSCustomerInfo;
  reportData: ATSReportData;
  timeSpent: ATSTimeSpent;
}

// ─── NILAI DEFAULT BAWAAN (DEFAULT VALUES) ──────────────────────────────

export const DEFAULT_CUSTOMER_INFO: ATSCustomerInfo = {
  companyName: 'Neutra DC Cikarang',
  equipmentName: 'ATS',
  ciDescription: 'ATS - A',
  ciName: '1F - ATS - A',
  type: 'Starline',
  serialNo: '001 WB',
  productName: 'ASCO',
  productYears: '2021',
  specification: '4000 A',
  location: 'Power Room A',
  area: 'Campus 5',
  mapNo: 'DME-TDE/MOP/ATS/02 1805/25',
  quarter: 'Q3',
  date: '2025-09-06',
  engineer: 'Eko Wahyono',
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

// Standard Check Points ATS
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
