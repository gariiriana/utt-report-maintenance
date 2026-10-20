// ============================================================================
// FILE: frontend/config/pmPredictiveProfiles.ts
// Deskripsi: Profil Predictive Report per jenis unit (pilot: FCU).
//            - cards: label kartu laporan PM -> parameter / nameplate / visual.
//            - params: satuan kanonik + aturan batas acuan beserta sumbernya.
//            - equipment: pengelompokan parameter ke equipment di dalam unit.
//            Batas acuan sengaja ditulis di sini (bukan dikarang AI) agar status dan
//            proyeksi selalu bisa ditelusuri ke standar. File ini tanpa import nilai
//            supaya bisa diuji langsung dengan Node (scripts/test-pm-predictive-engine.mjs).
// ============================================================================

export type PmCanonicalUnit = 'V' | 'A' | '%' | 'mm/s' | 'dB(A)' | 'm/s' | '%RH' | '°C' | 'bar';

/**
 * Aturan status. Semua batas bersifat "melewati = status naik".
 * - band: deviasi % dari nominal (dua sisi; batas bawah peringatan boleh berbeda lewat
 *   warningLowPct); nominal bisa diambil dari nameplate.
 * - upper: batas atas absolut.
 * - range: batas bawah & atas absolut.
 * - dropFromBaseline: penurunan % dari titik data pertama (baseline) unit ini.
 * - changeFromBaseline: perubahan % (dua arah) dari baseline.
 * - riseFromPrevious: kenaikan absolut dari periode sebelumnya.
 * - nonNegative: nilai negatif menandakan kejanggalan pembacaan/aliran.
 * - pctOfRatedCurrent: % dari arus nominal (FLA) nameplate; tanpa FLA tidak dinilai.
 */
export type PmRule =
  | { type: 'band'; nominal: number; nominalFrom?: 'ratedVoltageLL' | 'ratedVoltageLN'; watchPct?: number; warningPct?: number; warningLowPct?: number; alarmPct?: number }
  | { type: 'upper'; watch?: number; warning: number; alarm?: number }
  | { type: 'pctOfRatedCurrent'; watchPct?: number; warningPct: number; alarmPct?: number }
  | { type: 'range'; lowAlarm?: number; lowWarning?: number; highWatch?: number; highWarning?: number; highAlarm?: number }
  | { type: 'dropFromBaseline'; watchPct: number; warningPct: number; alarmPct?: number }
  | { type: 'changeFromBaseline'; watchPct: number; warningPct: number }
  | { type: 'riseFromPrevious'; watch: number; warning?: number }
  | { type: 'nonNegative' };

export interface PmParamDef {
  label: string;
  unit: PmCanonicalUnit;
  /** Petunjuk untuk AI pembaca foto. */
  expected?: string;
  /** Parameter turunan dihitung dari parameter lain, bukan dibaca dari foto. */
  derived?: 'voltageUnbalanceLL' | 'currentUnbalance' | 'currentLoadPct' | 'pressureDiff';
  rules: PmRule[];
  /** Sumber batas acuan, dicetak di lampiran laporan. */
  source: string;
  /** Nilai rata-rata minimum agar hasil turunan bermakna (mis. arus sangat kecil). */
  minBasis?: number;
}

export interface PmCardMapping {
  kind: 'measurement' | 'nameplate' | 'visual';
  param?: string;
  visualKey?: string;
  /** Label kartu yang sudah dinormalisasi (huruf kecil, tanpa spasi/tanda baca). */
  match: string[];
}

export interface PmEquipmentDef {
  id: string;
  name: string;
  role: string;
  params: string[];
  visualKeys?: string[];
}

export interface PmProfile {
  id: string;
  version: number;
  unitType: string;
  accounts: string[];
  namePattern?: RegExp;
  cards: PmCardMapping[];
  params: Record<string, PmParamDef>;
  equipment: PmEquipmentDef[];
  visualLabels: Record<string, string>;
}

const VOLTAGE_SOURCE = 'Suplai: SNI 04-0227-2003 nominal 400/230 V, toleransi +5%/-10%. Motor: NEMA MG-1 toleransi tegangan +/-10% dari rating nameplate (bila nameplate tidak terbaca dipakai 400/230 V).';

// Peringatan dari standar suplai PLN; kritis bila keluar dari toleransi motor terhadap rating nameplate.
const VOLTAGE_LL_RULES: PmRule[] = [
  { type: 'band', nominal: 400, warningPct: 5, warningLowPct: 10 },
  { type: 'band', nominal: 400, nominalFrom: 'ratedVoltageLL', alarmPct: 10 },
];
const VOLTAGE_LN_RULES: PmRule[] = [
  { type: 'band', nominal: 230, warningPct: 5, warningLowPct: 10 },
  { type: 'band', nominal: 230, nominalFrom: 'ratedVoltageLN', alarmPct: 10 },
];

// Arus per fasa dibanding FLA nameplate (ambang sama dengan beban %FLA); tanpa FLA tidak dinilai.
const PHASE_CURRENT_RULES: PmRule[] = [{ type: 'pctOfRatedCurrent', watchPct: 80, warningPct: 90, alarmPct: 100 }];
const PHASE_CURRENT_SOURCE = 'Arus per fasa dibanding arus nominal (FLA) nameplate: >80% pantau, >90% peringatan, >100% kritis. Keseimbangan antar fasa dinilai pada baris ketidakseimbangan arus.';

const FCU_PROFILE: PmProfile = {
  id: 'fcu',
  version: 2,
  unitType: 'FCU (Fan Coil Unit)',
  accounts: ['fcu@gmail.com'],
  namePattern: /\bfcu\b|fan\s*coil/i,
  cards: [
    { kind: 'measurement', param: 'v_rs', match: ['rs', 'sr'] },
    { kind: 'measurement', param: 'v_rt', match: ['rt', 'tr'] },
    { kind: 'measurement', param: 'v_st', match: ['st', 'ts'] },
    { kind: 'measurement', param: 'v_rn', match: ['rn'] },
    { kind: 'measurement', param: 'v_sn', match: ['sn'] },
    { kind: 'measurement', param: 'v_tn', match: ['tn'] },
    { kind: 'measurement', param: 'i_r', match: ['currentr', 'arusr', 'amperer', 'ir'] },
    { kind: 'measurement', param: 'i_s', match: ['currents', 'aruss', 'amperes', 'is'] },
    { kind: 'measurement', param: 'i_t', match: ['currentt', 'arust', 'amperet', 'it'] },
    { kind: 'measurement', param: 'vibration', match: ['vibration', 'vibrasi', 'getaran'] },
    { kind: 'measurement', param: 'airflow', match: ['airflow', 'aliranudara', 'kecepatanudara'] },
    { kind: 'measurement', param: 'humidity', match: ['humidity', 'kelembapan', 'kelembaban'] },
    { kind: 'measurement', param: 'noise', match: ['noise', 'kebisingan', 'soundlevel'] },
    { kind: 'measurement', param: 'p_supply', match: ['pressuresupply', 'supplypressure', 'tekanansupply', 'chws'] },
    { kind: 'measurement', param: 'p_return', match: ['pressurereturn', 'returnpressure', 'tekananreturn', 'chwr'] },
    { kind: 'measurement', param: 'temperature', match: ['temperature', 'temperatur', 'suhu'] },
    { kind: 'nameplate', match: ['nameplate', 'pelatnama', 'nameplat'] },
    { kind: 'visual', visualKey: 'evaporator', match: ['evaporator', 'coil'] },
  ],
  params: {
    v_rs: { label: 'Tegangan R-S', unit: 'V', expected: 'Tegangan fasa-fasa (line-to-line) R-S, clamp meter mode V AC', rules: VOLTAGE_LL_RULES, source: VOLTAGE_SOURCE },
    v_rt: { label: 'Tegangan R-T', unit: 'V', expected: 'Tegangan fasa-fasa (line-to-line) R-T, clamp meter mode V AC', rules: VOLTAGE_LL_RULES, source: VOLTAGE_SOURCE },
    v_st: { label: 'Tegangan S-T', unit: 'V', expected: 'Tegangan fasa-fasa (line-to-line) S-T, clamp meter mode V AC', rules: VOLTAGE_LL_RULES, source: VOLTAGE_SOURCE },
    v_rn: { label: 'Tegangan R-N', unit: 'V', expected: 'Tegangan fasa-netral R-N, clamp meter mode V AC', rules: VOLTAGE_LN_RULES, source: VOLTAGE_SOURCE },
    v_sn: { label: 'Tegangan S-N', unit: 'V', expected: 'Tegangan fasa-netral S-N, clamp meter mode V AC', rules: VOLTAGE_LN_RULES, source: VOLTAGE_SOURCE },
    v_tn: { label: 'Tegangan T-N', unit: 'V', expected: 'Tegangan fasa-netral T-N, clamp meter mode V AC', rules: VOLTAGE_LN_RULES, source: VOLTAGE_SOURCE },
    v_unbalance: {
      label: 'Ketidakseimbangan tegangan', unit: '%', derived: 'voltageUnbalanceLL',
      rules: [{ type: 'upper', watch: 1, warning: 2, alarm: 5 }],
      source: 'NEMA MG-1: ketidakseimbangan >1% menuntut derating motor, maksimum operasi 5%.',
    },
    i_r: { label: 'Arus fasa R', unit: 'A', expected: 'Arus fasa R motor fan FCU, clamp meter mode A AC', rules: PHASE_CURRENT_RULES, source: PHASE_CURRENT_SOURCE },
    i_s: { label: 'Arus fasa S', unit: 'A', expected: 'Arus fasa S motor fan FCU, clamp meter mode A AC', rules: PHASE_CURRENT_RULES, source: PHASE_CURRENT_SOURCE },
    i_t: { label: 'Arus fasa T', unit: 'A', expected: 'Arus fasa T motor fan FCU, clamp meter mode A AC', rules: PHASE_CURRENT_RULES, source: PHASE_CURRENT_SOURCE },
    i_unbalance: {
      label: 'Ketidakseimbangan arus', unit: '%', derived: 'currentUnbalance', minBasis: 0.5,
      rules: [{ type: 'upper', watch: 5, warning: 10, alarm: 20 }],
      source: 'Praktik umum pemeliharaan motor: ketidakseimbangan arus >10% perlu investigasi (terminal, belitan, suplai).',
    },
    i_load_pct: {
      label: 'Beban arus terhadap FLA nameplate', unit: '%', derived: 'currentLoadPct',
      rules: [{ type: 'upper', watch: 80, warning: 90, alarm: 100 }],
      source: 'Arus fasa tertinggi dibanding arus nominal (FLA) nameplate; >100% berarti motor bekerja di atas rating.',
    },
    vibration: {
      label: 'Getaran motor fan', unit: 'mm/s', expected: 'Getaran velocity RMS pada motor/fan FCU dari vibration meter',
      rules: [{ type: 'upper', warning: 1.8, alarm: 4.5 }],
      source: 'ISO 10816-1 mesin kelas I (<=15 kW): zona C mulai 1.8 mm/s, zona D mulai 4.5 mm/s RMS.',
    },
    noise: {
      label: 'Kebisingan', unit: 'dB(A)', expected: 'Tingkat kebisingan di dekat FCU dari sound level meter',
      rules: [{ type: 'upper', warning: 85 }, { type: 'riseFromPrevious', watch: 3, warning: 6 }],
      source: 'Permenaker No. 5/2018: NAB kebisingan 85 dB(A); kenaikan >=3 dB dari periode sebelumnya (energi bunyi 2x) perlu dipantau.',
    },
    p_supply: { label: 'Tekanan chilled water supply', unit: 'bar', expected: 'Tekanan pipa chilled water supply (pressure gauge)', rules: [], source: 'Tidak ada batas absolut (data desain tidak tersedia); kondisi aliran dinilai dari selisih tekanan supply-return.' },
    p_return: { label: 'Tekanan chilled water return', unit: 'bar', expected: 'Tekanan pipa chilled water return (pressure gauge)', rules: [], source: 'Tidak ada batas absolut (data desain tidak tersedia); kondisi aliran dinilai dari selisih tekanan supply-return.' },
    p_diff: {
      label: 'Selisih tekanan supply-return', unit: 'bar', derived: 'pressureDiff',
      rules: [{ type: 'nonNegative' }, { type: 'changeFromBaseline', watchPct: 20, warningPct: 35 }],
      source: 'Perubahan selisih tekanan dari baseline unit ini: >20% indikasi perubahan aliran (strainer, valve, kotoran coil).',
    },
    airflow: {
      label: 'Kecepatan aliran udara', unit: 'm/s', expected: 'Kecepatan udara keluar FCU dari anemometer',
      rules: [{ type: 'dropFromBaseline', watchPct: 15, warningPct: 25, alarmPct: 40 }],
      source: 'Penurunan dari baseline unit ini (data desain tidak tersedia): >15% indikasi filter/coil kotor atau masalah fan.',
    },
    temperature: {
      label: 'Temperatur udara', unit: '°C', expected: 'Temperatur udara pada titik ukur di foto (thermometer / thermo-hygrometer)',
      rules: [{ type: 'upper', warning: 27, alarm: 32 }],
      source: 'ASHRAE TC 9.9: batas atas rekomendasi 27 °C, batas allowable kelas A1 32 °C.',
    },
    humidity: {
      label: 'Kelembapan relatif', unit: '%RH', expected: 'Kelembapan relatif udara dari hygrometer',
      rules: [{ type: 'range', lowAlarm: 8, lowWarning: 20, highWatch: 60, highWarning: 70, highAlarm: 80 }],
      source: 'ASHRAE TC 9.9: rekomendasi maks 60 %RH (70 %RH dengan polutan rendah); >80 %RH risiko kondensasi (batas internal).',
    },
  },
  equipment: [
    { id: 'power', name: 'Suplai Listrik FCU', role: 'Catu daya 3 fasa ke motor fan dan panel kontrol FCU.', params: ['v_rs', 'v_rt', 'v_st', 'v_rn', 'v_sn', 'v_tn', 'v_unbalance'] },
    { id: 'fan_motor', name: 'Motor Fan (Blower)', role: 'Penggerak blower yang mensirkulasikan udara melewati coil; kondisi bearing, belt, dan belitan tercermin dari arus, getaran, dan kebisingan.', params: ['i_r', 'i_s', 'i_t', 'i_unbalance', 'i_load_pct', 'vibration', 'noise'] },
    { id: 'chw', name: 'Coil & Sirkulasi Chilled Water', role: 'Pertukaran panas chilled water di coil; tekanan supply/return menunjukkan kondisi aliran, strainer, dan valve.', params: ['p_supply', 'p_return', 'p_diff'] },
    { id: 'air', name: 'Evaporator Coil & Aliran Udara', role: 'Kinerja perpindahan panas ke udara ruangan; dipengaruhi kebersihan coil dan filter serta kinerja fan.', params: ['airflow', 'temperature', 'humidity'], visualKeys: ['evaporator'] },
  ],
  visualLabels: { evaporator: 'Kebersihan evaporator coil' },
};

export const PM_PREDICTIVE_PROFILES: PmProfile[] = [FCU_PROFILE];

/** Profil untuk laporan PM berdasarkan akun pembuat, lalu nama maintenance. */
export function resolvePmProfile(account: string | undefined, maintenanceName?: string): PmProfile | null {
  const email = (account || '').toLowerCase().trim();
  const byAccount = PM_PREDICTIVE_PROFILES.find(p => p.accounts.includes(email));
  if (byAccount) return byAccount;
  if (maintenanceName) {
    return PM_PREDICTIVE_PROFILES.find(p => p.namePattern?.test(maintenanceName)) || null;
  }
  return null;
}
