// ============================================================================
// FILE: frontend/config/pmPredictiveProfiles.ts
// Deskripsi: Profil Predictive Report per jenis unit (FCU dan akun maintenance lain).
//            - cards: label kartu laporan PM -> parameter / nameplate / visual.
//            - params: satuan kanonik + aturan batas acuan beserta sumbernya.
//            - equipment: pengelompokan parameter ke equipment di dalam unit.
//            Batas acuan sengaja ditulis di sini (bukan dikarang AI) agar status dan
//            proyeksi selalu bisa ditelusuri ke standar. Parameter tanpa standar absolut
//            dinilai terhadap baseline unit atau hanya dipantau trennya. File ini tanpa
//            import nilai supaya bisa diuji langsung dengan Node (scripts/test-pm-predictive-engine.mjs).
// ============================================================================

export type PmCanonicalUnit = 'V' | 'kV' | 'A' | '%' | 'mm/s' | 'dB(A)' | 'm/s' | '%RH' | '°C' | 'bar' | 'psi'
  | 'ohm' | 'Hz' | 'kW' | 'PF' | 'lux' | 'rpm' | 'µF' | 'mm' | 'µSv/h' | 'kg' | 'mg/L' | 'pH';

/**
 * Aturan status. Semua batas bersifat "melewati = status naik".
 * - band: deviasi % dari nominal (dua sisi; batas bawah peringatan boleh berbeda lewat
 *   warningLowPct); nominal bisa diambil dari nameplate.
 * - upper / lower: batas atas / bawah absolut.
 * - range: batas bawah & atas absolut.
 * - iso10816: zona getaran ISO 10816-1; kelas mesin dari daya nameplate (defaultClass bila tidak ada).
 * - dropFromBaseline / riseFromBaseline: penurunan / kenaikan % dari titik data pertama (baseline) unit ini.
 * - changeFromBaseline: perubahan % (dua arah) dari baseline.
 * - riseFromPrevious: kenaikan absolut dari periode sebelumnya.
 * - nonNegative: nilai negatif menandakan kejanggalan pembacaan/aliran.
 * - pctOfRatedCurrent: % dari arus nominal nameplate (FLA motor / In panel); tanpa itu tidak dinilai.
 */
export type PmRule =
  | { type: 'band'; nominal: number; nominalFrom?: 'ratedVoltageLL' | 'ratedVoltageLN'; watchPct?: number; warningPct?: number; warningLowPct?: number; alarmPct?: number }
  | { type: 'upper'; watch?: number; warning: number; alarm?: number }
  | { type: 'lower'; watch?: number; warning: number; alarm?: number }
  | { type: 'iso10816'; defaultClass?: 1 | 2 | 3 }
  | { type: 'pctOfRatedCurrent'; watchPct?: number; warningPct: number; alarmPct?: number; ratedLabel?: string }
  | { type: 'range'; lowAlarm?: number; lowWarning?: number; highWatch?: number; highWarning?: number; highAlarm?: number }
  | { type: 'dropFromBaseline'; watchPct: number; warningPct: number; alarmPct?: number }
  | { type: 'riseFromBaseline'; watchPct: number; warningPct: number; alarmPct?: number }
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
  /** Potongan email akun (mis. "ahu"), mengikuti pemilihan template kartu di ReportForm. */
  accountIncludes?: string[];
  namePattern?: RegExp;
  cards: PmCardMapping[];
  params: Record<string, PmParamDef>;
  equipment: PmEquipmentDef[];
  visualLabels: Record<string, string>;
  /** Contoh nama unit untuk kolom riwayat (placeholder). */
  unitExample?: string;
  /** Petunjuk AI membaca foto nameplate: rating yang dicari untuk jenis unit ini. */
  nameplateHint?: string;
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
  unitExample: 'FCU-01 Lt.2',
  nameplateHint: 'Nameplate motor fan FCU: arus nominal (FLA) sebagai ratedCurrent, daya motor (kW), tegangan rating.',
};

// ─── Blok bersama untuk profil akun maintenance lain ─────────────────────────
// Batas mengikuti kolom "Standard" service report perusahaan (sr.md) bila ada, lalu
// standar nasional/internasional. Nominal tegangan memakai SNI 400/230 V seperti FCU.
// Id parameter sama antar profil (v_rs, i_r, ...) karena parameter turunan di
// pmPredictiveEngine.ts menghitung dari id tersebut.

type ParamMap = Record<string, PmParamDef>;

const card = (param: string, match: string[]): PmCardMapping => ({ kind: 'measurement', param, match });
const visual = (visualKey: string, match: string[]): PmCardMapping => ({ kind: 'visual', visualKey, match });
const equipment = (id: string, name: string, role: string, params: string[], visualKeys?: string[]): PmEquipmentDef => ({ id, name, role, params, visualKeys });

const NAMEPLATE_CARD: PmCardMapping = { kind: 'nameplate', match: ['nameplate', 'nameplat', 'pelatnama'] };

// Kartu tegangan & arus 3 fasa. Kata kunci panjang ("voltagers") untuk label seperti
// "Phase-to-Phase Voltage - Voltage R-S (V)"; label pendek ("R-S") cocok persis.
const VOLTAGE_CARDS: PmCardMapping[] = [
  card('v_rs', ['rs', 'sr', 'voltagers']),
  card('v_rt', ['rt', 'tr', 'voltagert', 'voltagetr']),
  card('v_st', ['st', 'ts', 'voltagest']),
  card('v_rn', ['rn', 'voltagern']),
  card('v_sn', ['sn', 'voltagesn']),
  card('v_tn', ['tn', 'voltagetn']),
  card('v_ng', ['ng', 'ntog', 'voltageng', 'netralground', 'neutralground', 'neutraltoground', 'netraltoground', 'netralkeground']),
];
const NG_VOLTAGE_CARD = VOLTAGE_CARDS[6];
const CURRENT_CARDS: PmCardMapping[] = [
  card('i_r', ['currentr', 'arusr', 'amperer', 'ir']),
  card('i_s', ['currents', 'aruss', 'amperes', 'is']),
  card('i_t', ['currentt', 'arust', 'amperet', 'it']),
];
const NEUTRAL_CURRENT_CARD = card('i_n', ['currentn', 'arusn', 'amperen', 'in']);
// Satu angka tegangan fasa-fasa / fasa-netral ("Measurement voltage fasa to fasa").
const LINE_VOLTAGE_CARDS: PmCardMapping[] = [
  card('v_ll', ['fasatofasa', 'phasetophase', 'linetoline', 'lineline']),
  card('v_ln', ['fasatonetral', 'phasetoneutral', 'phasetonetral', 'linetoneutral', 'lineneutral']),
];
// Unit 1 fasa: satu angka tegangan & arus ("Checking Voltase", "Measurement Ampere").
const SUPPLY_VOLTAGE_CARD = card('v_1', ['voltage', 'voltase', 'tegangan', 'vac', 'voltagevac']);
const LOAD_CURRENT_CARD = card('i_1', ['ampere', 'arus', 'current', 'amper', 'arusampere']);

const EARTH_CARD = card('earth', ['grounding', 'earthing', 'earth', 'ground', 'pentanahan', 'pembumian']);
const THERMAL_CARD = card('thermal', ['thermal', 'termal', 'thermography', 'thermografi', 'flir', 'infrared', 'hotspot']);
const NOISE_CARD = card('noise', ['noise', 'kebisingan', 'soundlevel', 'sound']);
const VIBRATION_CARD = card('vibration', ['vibration', 'vibrasi', 'getaran']);
const TEMPERATURE_CARD = card('temperature', ['temperature', 'temperatur', 'suhu']);
const HUMIDITY_CARD = card('humidity', ['humidity', 'kelembapan', 'kelembaban', 'rh']);
const AIRFLOW_CARD = card('airflow', ['airflow', 'aliranudara', 'kecepatanudara', 'embusan']);
const FREQUENCY_CARD = card('frequency', ['frequency', 'frekuensi', 'freq', 'hz']);
const PF_CARD = card('pf', ['cosphi', 'cosp', 'factordaya', 'faktordaya', 'powerfactor', 'pf']);
const POWER_CARD = card('kw', ['dayadpm', 'dayakw', 'meterkw', 'kw', 'dayaaktif', 'activepower']);

const V3_PARAMS = ['v_rs', 'v_rt', 'v_st', 'v_rn', 'v_sn', 'v_tn', 'v_ng', 'v_unbalance'];
const I3_PARAMS = ['i_r', 'i_s', 'i_t', 'i_unbalance', 'i_load_pct'];
const I4_PARAMS = ['i_r', 'i_s', 'i_t', 'i_n', 'i_unbalance', 'i_load_pct'];

interface VoltageBasis { ll: PmRule[]; ln: PmRule[]; source: string }

/** Panel distribusi & beban IT: toleransi SR/SNI, kritis di luar toleransi ITIC. */
const PANEL_VOLTAGE: VoltageBasis = {
  ll: [{ type: 'band', nominal: 400, warningPct: 5, warningLowPct: 10, alarmPct: 10 }],
  ln: [{ type: 'band', nominal: 230, warningPct: 5, warningLowPct: 10, alarmPct: 10 }],
  source: 'Standar service report: toleransi +5%/-10% dari nominal SNI 04-0227-2003 (400/230 V). Kritis di luar 90-110% nominal, batas toleransi steady-state peralatan IT pada ITI (CBEMA) Curve.',
};
/** Beban motor/kompresor: sama dengan FCU (SNI + toleransi motor NEMA MG-1 terhadap nameplate). */
const MOTOR_VOLTAGE: VoltageBasis = { ll: VOLTAGE_LL_RULES, ln: VOLTAGE_LN_RULES, source: VOLTAGE_SOURCE };

const NG_SOURCE = 'Batas internal mengikuti praktik kualitas daya peralatan IT: tegangan netral-ground idealnya <2 V; >5 V menandakan masalah sambungan netral, pembumian, atau arus netral berlebih.';
const UNBALANCE_SOURCE = 'EN 50160 & IEC 61000-2-2: ketidakseimbangan tegangan suplai maksimal 2%; >1% mulai dipantau; 5% batas operasi motor (NEMA MG-1).';

function voltageParams(basis: VoltageBasis, where: string): ParamMap {
  const ll = (a: string, b: string): PmParamDef => ({
    label: `Tegangan ${a}-${b}`, unit: 'V', expected: `Tegangan fasa-fasa (line-to-line) ${a}-${b} ${where}, mode V AC`, rules: basis.ll, source: basis.source,
  });
  const ln = (a: string): PmParamDef => ({
    label: `Tegangan ${a}-N`, unit: 'V', expected: `Tegangan fasa-netral ${a}-N ${where}, mode V AC`, rules: basis.ln, source: basis.source,
  });
  return {
    v_rs: ll('R', 'S'), v_rt: ll('R', 'T'), v_st: ll('S', 'T'),
    v_rn: ln('R'), v_sn: ln('S'), v_tn: ln('T'),
    v_ng: { label: 'Tegangan netral-ground', unit: 'V', expected: `Tegangan antara netral dan ground (N-G) ${where}, mode V AC`, rules: [{ type: 'upper', watch: 2, warning: 5 }], source: NG_SOURCE },
    v_unbalance: { label: 'Ketidakseimbangan tegangan', unit: '%', derived: 'voltageUnbalanceLL', rules: [{ type: 'upper', watch: 1, warning: 2, alarm: 5 }], source: UNBALANCE_SOURCE },
  };
}

function lineVoltageParams(basis: VoltageBasis, where: string): ParamMap {
  return {
    v_ll: { label: 'Tegangan fasa-fasa', unit: 'V', expected: `Tegangan fasa-fasa (line-to-line) ${where}, mode V AC`, rules: basis.ll, source: basis.source },
    v_ln: { label: 'Tegangan fasa-netral', unit: 'V', expected: `Tegangan fasa-netral ${where}, mode V AC`, rules: basis.ln, source: basis.source },
  };
}

const PANEL_CURRENT_RULES: PmRule[] = [{ type: 'pctOfRatedCurrent', warningPct: 80, alarmPct: 100, ratedLabel: 'In nameplate' }];
const PANEL_CURRENT_SOURCE = 'Standar service report: beban maksimal 80% kapasitas pengaman. Arus per fasa dibanding arus pengenal (In) panel/breaker pada nameplate: >80% peringatan, >100% kritis.';
const CURRENT_UNBALANCE_SOURCE = 'Standar service report: deviasi beban antar fasa maksimal 10%; >5% mulai dipantau, >20% (batas internal) perlu investigasi segera (terminal, belitan, pembagian beban).';
const NEUTRAL_SOURCE = 'Dipantau tren: kenaikan arus netral menandakan beban antar fasa tidak seimbang atau harmonisa kelipatan tiga dari beban elektronik (SMPS).';

function currentParams(where: string, kind: 'motor' | 'panel', withNeutral = false): ParamMap {
  const motor = kind === 'motor';
  const phase = (p: string): PmParamDef => ({
    label: `Arus fasa ${p}`, unit: 'A', expected: `Arus fasa ${p} ${where}, clamp meter mode A AC`,
    rules: motor ? PHASE_CURRENT_RULES : PANEL_CURRENT_RULES, source: motor ? PHASE_CURRENT_SOURCE : PANEL_CURRENT_SOURCE,
  });
  const out: ParamMap = {
    i_r: phase('R'), i_s: phase('S'), i_t: phase('T'),
    i_unbalance: {
      label: 'Ketidakseimbangan arus', unit: '%', derived: 'currentUnbalance', minBasis: 0.5,
      rules: [{ type: 'upper', watch: 5, warning: 10, alarm: 20 }], source: CURRENT_UNBALANCE_SOURCE,
    },
    i_load_pct: motor
      ? { label: 'Beban arus terhadap FLA nameplate', unit: '%', derived: 'currentLoadPct', rules: [{ type: 'upper', watch: 80, warning: 90, alarm: 100 }], source: 'Arus fasa tertinggi dibanding arus nominal (FLA) nameplate; >100% berarti motor bekerja di atas rating.' }
      : { label: 'Beban arus terhadap In nameplate', unit: '%', derived: 'currentLoadPct', rules: [{ type: 'upper', warning: 80, alarm: 100 }], source: 'Arus fasa tertinggi dibanding arus pengenal (In) panel/breaker; standar service report membatasi beban 80%, >100% berarti beban lebih.' },
  };
  if (withNeutral) {
    out.i_n = { label: 'Arus netral', unit: 'A', expected: `Arus netral (N) ${where}, clamp meter mode A AC`, rules: [], source: NEUTRAL_SOURCE };
  }
  return out;
}

const SUPPLY_230 = { rules: [{ type: 'band', nominal: 230, warningPct: 10 }] as PmRule[], source: 'Standar service report & IEC 60038: tegangan suplai 1 fasa 230 V ±10% pada operasi normal.' };
const MOTOR_SUPPLY_1P = { rules: VOLTAGE_LN_RULES, source: VOLTAGE_SOURCE };
const RATED_CURRENT_1P = {
  rules: [{ type: 'pctOfRatedCurrent', watchPct: 80, warningPct: 90, alarmPct: 100, ratedLabel: 'arus nominal nameplate' }] as PmRule[],
  source: 'Arus beban dibanding arus nominal (FLA/RLA) pada nameplate: >80% pantau, >90% peringatan, >100% kritis.',
};
const TREND_CURRENT_1P = { rules: [] as PmRule[], source: 'Dipantau tren; kartu PM tidak memuat rating MCB. Standar service report membatasi beban 80% kapasitas MCB (IEC 60364).' };

function singlePhaseParams(where: string, voltage: { rules: PmRule[]; source: string }, current: { rules: PmRule[]; source: string }): ParamMap {
  return {
    v_1: { label: 'Tegangan suplai', unit: 'V', expected: `Tegangan suplai fasa-netral ${where}, mode V AC`, rules: voltage.rules, source: voltage.source },
    i_1: { label: 'Arus beban', unit: 'A', expected: `Arus beban ${where}, clamp meter mode A AC`, rules: current.rules, source: current.source },
  };
}

const EARTH: PmParamDef = {
  label: 'Resistans pembumian', unit: 'ohm', expected: 'Resistans pembumian dari earth tester / clamp earth tester (ohm)',
  rules: [{ type: 'upper', warning: 5 }], source: 'Standar service report & IEC 60364 / PUIL 2011: resistans pembumian <5 ohm.',
};
const THERMAL: PmParamDef = {
  label: 'Suhu titik terpanas (thermal imager)', unit: '°C', expected: 'Suhu tertinggi (max/spot) yang tampil di layar thermal imager pada sambungan/breaker',
  rules: [{ type: 'upper', warning: 40, alarm: 70 }],
  source: 'Standar service report: suhu sambungan/breaker <40 °C. NETA MTS-2019 Tabel 100.18: lebih dari 40 °C di atas suhu ambien (±30 °C) = defisiensi mayor, perbaikan segera (kritis).',
};
const NOISE_NAB: PmParamDef = { ...FCU_PROFILE.params.noise, expected: 'Tingkat kebisingan di dekat unit dari sound level meter' };
const NOISE_MOTOR: PmParamDef = {
  label: 'Kebisingan motor', unit: 'dB(A)', expected: 'Tingkat kebisingan di dekat motor dari sound level meter',
  rules: [{ type: 'upper', warning: 75 }, { type: 'riseFromPrevious', watch: 3, warning: 6 }],
  source: 'Standar service report: kebisingan motor <=75 dB(A); kenaikan >=3 dB dari periode sebelumnya (energi bunyi 2x) perlu dipantau.',
};
const TEMPERATURE_AIR: PmParamDef = FCU_PROFILE.params.temperature;
const HUMIDITY: PmParamDef = FCU_PROFILE.params.humidity;
const AIRFLOW: PmParamDef = { ...FCU_PROFILE.params.airflow, expected: 'Kecepatan udara keluar unit dari anemometer' };
const FREQUENCY: PmParamDef = {
  label: 'Frekuensi', unit: 'Hz', expected: 'Frekuensi sistem pada power meter / multimeter (Hz)',
  rules: [{ type: 'band', nominal: 50, warningPct: 0.4 }], source: 'Aturan Jaringan Jawa-Madura-Bali (Permen ESDM No. 3/2007): frekuensi dijaga 49,8-50,2 Hz pada operasi normal.',
};
const POWER_FACTOR: PmParamDef = {
  label: 'Faktor daya (cos phi)', unit: 'PF', expected: 'Faktor daya (cos phi / PF) pada digital power meter',
  rules: [{ type: 'lower', warning: 0.85 }], source: 'Tarif tenaga listrik PLN (Permen ESDM No. 28/2016): pemakaian kVARh dikenakan biaya bila faktor daya rata-rata <0,85.',
};
const ACTIVE_POWER: PmParamDef = {
  label: 'Daya aktif', unit: 'kW', expected: 'Daya aktif (kW) pada digital power meter', rules: [],
  source: 'Dipantau tren beban; tidak ada batas absolut tanpa data kapasitas desain.',
};

function vibrationParam(subject: string, defaultClass: 1 | 2 | 3): PmParamDef {
  return {
    label: `Getaran ${subject}`, unit: 'mm/s', expected: `Getaran velocity RMS pada ${subject} dari vibration meter`,
    rules: [{ type: 'iso10816', defaultClass }],
    source: `ISO 10816-1: kelas mesin dari daya nameplate (I <=15 kW, II 15-75 kW, III >75 kW); peringatan mulai zona C, kritis mulai zona D. Tanpa daya nameplate dipakai kelas ${['I', 'II', 'III'][defaultClass - 1]}.`,
  };
}

const BATTERY_SOURCE = 'Tegangan istirahat baterai lead-acid terhadap kapasitas (12,65 V = 100%, ±12,45 V = 75%, ±12,24 V = 50%): turun >2% dari baseline pantau, >3% peringatan, >5% kritis. Acuan awal = pengukuran pertama unit ini; ukur pada kondisi yang sama (istirahat atau float) setiap periode.';
const batteryParam = (label: string, expected: string): PmParamDef => ({
  label, unit: 'V', expected, rules: [{ type: 'dropFromBaseline', watchPct: 2, warningPct: 3, alarmPct: 5 }], source: BATTERY_SOURCE,
});

const REFRIGERANT_SOURCE = 'Tidak ada data desain pada kartu PM (batas internal): perubahan dari baseline unit ini menandakan perubahan muatan refrigeran, kondisi kondensor/evaporator, atau beban.';
const SUCTION: PmParamDef = { label: 'Tekanan suction refrigeran', unit: 'psi', expected: 'Tekanan suction (low side) pada manifold gauge', rules: [{ type: 'changeFromBaseline', watchPct: 15, warningPct: 25 }], source: REFRIGERANT_SOURCE };
const DISCHARGE: PmParamDef = { label: 'Tekanan discharge refrigeran', unit: 'psi', expected: 'Tekanan discharge (high side) pada manifold gauge', rules: [{ type: 'changeFromBaseline', watchPct: 15, warningPct: 25 }], source: REFRIGERANT_SOURCE };

const PANEL_NAMEPLATE = 'Nameplate panel/breaker utama: arus pengenal (In) sebagai ratedCurrent dan tegangan kerja (Ue) sebagai ratedVoltage; abaikan tegangan isolasi (Ui).';
const MOTOR_NAMEPLATE = 'Nameplate motor: arus nominal (FLA) sebagai ratedCurrent, daya motor (kW; HP x 0,746) sebagai ratedPowerKw, tegangan rating.';

// ─── Panel distribusi tegangan rendah ────────────────────────────────────────

const ATS_PROFILE: PmProfile = {
  id: 'ats', version: 1, unitType: 'ATS (Automatic Transfer Switch)', accounts: ['ats@gmail.com'],
  namePattern: /\bats\b|transfer\s*switch/i,
  cards: [...VOLTAGE_CARDS, ...CURRENT_CARDS, NEUTRAL_CURRENT_CARD, POWER_CARD, PF_CARD, THERMAL_CARD, EARTH_CARD, NAMEPLATE_CARD],
  params: { ...voltageParams(PANEL_VOLTAGE, 'pada terminal ATS'), ...currentParams('pada output ATS', 'panel', true), kw: ACTIVE_POWER, pf: POWER_FACTOR, thermal: THERMAL, earth: EARTH },
  equipment: [
    equipment('power', 'Suplai Tegangan ATS', 'Tegangan sumber yang dipindahkan ATS ke beban; kualitasnya menentukan kestabilan beban hilir.', V3_PARAMS),
    equipment('load', 'Beban & Arus ATS', 'Arus yang mengalir melalui kontak ATS; beban tinggi atau tidak seimbang mempercepat keausan kontak.', [...I4_PARAMS, 'kw', 'pf']),
    equipment('conn', 'Terminasi, Busbar & Pembumian', 'Kondisi sambungan, busbar, dan pembumian panel; hotspot menandakan sambungan longgar atau beban lebih.', ['thermal', 'earth']),
  ],
  visualLabels: {}, unitExample: 'ATS-01 Power Room A', nameplateHint: PANEL_NAMEPLATE,
};

const LDB_PROFILE: PmProfile = {
  id: 'ldbrdb', version: 1, unitType: 'Panel LDB / RDB', accounts: ['ldbrdb@gmail.com', 'ldb/rdb@gmail.com', 'ldb@gmail.com'], accountIncludes: ['ldb', 'rdb'],
  namePattern: /\b[lr]db\b/i,
  cards: [...VOLTAGE_CARDS, ...CURRENT_CARDS, NEUTRAL_CURRENT_CARD, POWER_CARD, PF_CARD, THERMAL_CARD, EARTH_CARD, NAMEPLATE_CARD],
  params: { ...voltageParams(PANEL_VOLTAGE, 'pada incoming panel'), ...currentParams('pada incoming panel', 'panel', true), kw: ACTIVE_POWER, pf: POWER_FACTOR, thermal: THERMAL, earth: EARTH },
  equipment: [
    equipment('power', 'Suplai Tegangan Panel', 'Tegangan incoming panel distribusi beban (lighting/rack/mekanikal).', V3_PARAMS),
    equipment('load', 'Beban & Arus Panel', 'Arus per fasa dan netral panel; menunjukkan margin kapasitas dan keseimbangan pembagian beban.', [...I4_PARAMS, 'kw', 'pf']),
    equipment('conn', 'Terminasi, Busbar & Pembumian', 'Kondisi sambungan, busbar, breaker, dan pembumian panel.', ['thermal', 'earth']),
  ],
  visualLabels: {}, unitExample: 'LDB-1F-06', nameplateHint: PANEL_NAMEPLATE,
};

const LV_PROFILE: PmProfile = {
  id: 'lv', version: 1, unitType: 'Panel LV (Low Voltage)', accounts: ['lv@gmail.com'],
  namePattern: /\blv\b|\blvmdp\b|\bmdp\b/i,
  cards: [...VOLTAGE_CARDS, ...LINE_VOLTAGE_CARDS, ...CURRENT_CARDS, NEUTRAL_CURRENT_CARD, POWER_CARD, PF_CARD, THERMAL_CARD, EARTH_CARD, NAMEPLATE_CARD],
  params: {
    ...voltageParams(PANEL_VOLTAGE, 'pada busbar panel LV'), ...lineVoltageParams(PANEL_VOLTAGE, 'pada busbar panel LV'),
    ...currentParams('pada incoming panel LV', 'panel', true), kw: ACTIVE_POWER, pf: POWER_FACTOR, thermal: THERMAL, earth: EARTH,
  },
  equipment: [
    equipment('power', 'Suplai Tegangan Busbar LV', 'Tegangan busbar utama panel tegangan rendah yang mendistribusikan daya ke panel hilir.', ['v_ll', 'v_ln', ...V3_PARAMS]),
    equipment('load', 'Beban & Arus Panel LV', 'Arus per fasa dan netral incoming panel LV; menunjukkan margin kapasitas trafo/feeder.', [...I4_PARAMS, 'kw', 'pf']),
    equipment('conn', 'Terminasi, Busbar & Pembumian', 'Kondisi sambungan, busbar, breaker, dan pembumian panel.', ['thermal', 'earth']),
  ],
  visualLabels: {}, unitExample: 'LVMDP-01', nameplateHint: PANEL_NAMEPLATE,
};

const BUSDUCT_PROFILE: PmProfile = {
  id: 'busduct', version: 1, unitType: 'Busduct', accounts: ['busduct@gmail.com'],
  namePattern: /bus\s*duct/i,
  cards: [...VOLTAGE_CARDS, ...CURRENT_CARDS, NEUTRAL_CURRENT_CARD, THERMAL_CARD, EARTH_CARD, NAMEPLATE_CARD],
  params: { ...voltageParams(PANEL_VOLTAGE, 'pada tap-off busduct'), ...currentParams('pada busduct', 'panel', true), thermal: THERMAL, earth: EARTH },
  equipment: [
    equipment('joint', 'Sambungan (Joint) Busduct', 'Sambungan antar segmen busduct; kenaikan suhu joint menandakan baut kendor atau kontak teroksidasi.', ['thermal', 'earth']),
    equipment('power', 'Tegangan & Beban Busduct', 'Tegangan dan arus yang disalurkan busduct ke panel hilir.', [...V3_PARAMS, ...I4_PARAMS]),
  ],
  visualLabels: {}, unitExample: 'Busduct Riser A', nameplateHint: 'Nameplate busduct: arus pengenal (In) sebagai ratedCurrent, tegangan kerja sebagai ratedVoltage.',
};

const CAPACITOR_PROFILE: PmProfile = {
  id: 'capacitorbank', version: 1, unitType: 'Capacitor Bank (APFC)', accounts: ['capacitorbank@gmail.com'],
  namePattern: /capacitor|kapasitor|\bapfc/i,
  cards: [
    ...VOLTAGE_CARDS, ...CURRENT_CARDS, NEUTRAL_CURRENT_CARD,
    card('capacitance', ['capacitance', 'kapasitansi']),
    card('thd_v', ['thdv', 'thd', 'harmonic', 'harmonisa']),
    PF_CARD, THERMAL_CARD, EARTH_CARD, NAMEPLATE_CARD,
  ],
  params: {
    ...voltageParams(PANEL_VOLTAGE, 'pada panel capacitor bank'), ...currentParams('pada incoming capacitor bank', 'panel', true),
    capacitance: {
      label: 'Kapasitansi', unit: 'µF', expected: 'Nilai kapasitansi pada capacitance meter (µF)', rules: [{ type: 'changeFromBaseline', watchPct: 5, warningPct: 10 }],
      source: 'Standar service report: kapasitansi dalam 10% dari nilai nameplate. Kartu PM tidak memuat nilai nameplate, sehingga dibandingkan terhadap pengukuran pertama (baseline): berubah >5% pantau, >10% peringatan.',
    },
    thd_v: { label: 'THD tegangan', unit: '%', expected: 'Total harmonic distortion tegangan (THDv %) pada power quality analyzer', rules: [{ type: 'upper', warning: 8 }], source: 'IEEE 519-2014: THD tegangan pada bus <=1 kV maksimal 8%.' },
    pf: POWER_FACTOR, thermal: THERMAL, earth: EARTH,
  },
  equipment: [
    equipment('power', 'Suplai Tegangan Panel', 'Tegangan bus tempat capacitor bank terhubung.', V3_PARAMS),
    equipment('load', 'Arus Kapasitor & Faktor Daya', 'Arus step kapasitor dan faktor daya hasil koreksi; arus turun menandakan kapasitor melemah atau step tidak bekerja.', [...I4_PARAMS, 'pf']),
    equipment('capacitor', 'Unit Kapasitor & Harmonisa', 'Kapasitansi unit kapasitor dan distorsi harmonisa; harmonisa tinggi memanaskan dan memperpendek umur kapasitor.', ['capacitance', 'thd_v']),
    equipment('conn', 'Terminasi, Busbar & Pembumian', 'Kondisi sambungan, kontaktor, fuse, dan pembumian panel.', ['thermal', 'earth']),
  ],
  visualLabels: {}, unitExample: 'Capacitor Bank-01', nameplateHint: 'Nameplate capacitor bank/kapasitor: tegangan rating sebagai ratedVoltage, arus rating sebagai ratedCurrent, daya kVAR dan kapasitansi (µF) di notes.',
};

const PDU_PROFILE: PmProfile = {
  id: 'pdu', version: 1, unitType: 'PDU (Power Distribution Unit)', accounts: ['pdu@gmail.com'],
  namePattern: /\bpdu\b/i,
  cards: [
    ...VOLTAGE_CARDS, ...CURRENT_CARDS, NEUTRAL_CURRENT_CARD,
    card('t_isotrans', ['isotrans', 'trafoisolasi', 'isolationtransformer']),
    POWER_CARD, PF_CARD, THERMAL_CARD, EARTH_CARD, NOISE_CARD, NAMEPLATE_CARD,
  ],
  params: {
    ...voltageParams(PANEL_VOLTAGE, 'pada PDU'), ...currentParams('pada output PDU', 'panel', true),
    t_isotrans: {
      label: 'Suhu trafo isolasi', unit: '°C', expected: 'Suhu trafo isolasi (isotrans) pada display PDU atau thermometer', rules: [],
      source: 'Dipantau tren; batas suhu bergantung kelas isolasi trafo pada nameplate (mis. kelas F 155 °C, kelas H 180 °C, IEC 60076-11).',
    },
    kw: ACTIVE_POWER, pf: POWER_FACTOR, thermal: THERMAL, earth: EARTH, noise: NOISE_NAB,
  },
  equipment: [
    equipment('power', 'Suplai Tegangan PDU', 'Tegangan input/output PDU yang mencatu rak server.', V3_PARAMS),
    equipment('load', 'Beban Output PDU', 'Arus per fasa, netral, dan faktor daya beban IT; netral tinggi menandakan harmonisa beban SMPS.', [...I4_PARAMS, 'kw', 'pf']),
    equipment('isotrans', 'Trafo Isolasi (Isotrans)', 'Trafo isolasi di dalam PDU; suhu dan kebisingan naik menandakan beban lebih atau harmonisa.', ['t_isotrans', 'noise']),
    equipment('conn', 'Terminasi & Pembumian', 'Kondisi sambungan breaker output dan pembumian PDU.', ['thermal', 'earth']),
  ],
  visualLabels: {}, unitExample: 'PDU-A1 Data Hall 1', nameplateHint: 'Nameplate PDU/trafo isolasi: kVA di notes, arus output sebagai ratedCurrent, tegangan output sebagai ratedVoltage.',
};

const TRAFO_PROFILE: PmProfile = {
  id: 'trafo', version: 1, unitType: 'Transformator Distribusi', accounts: ['trafo@gmail.com'],
  namePattern: /\btrafo\b|transformat|transformer/i,
  cards: [...VOLTAGE_CARDS, ...CURRENT_CARDS, NEUTRAL_CURRENT_CARD, POWER_CARD, THERMAL_CARD, EARTH_CARD, NOISE_CARD, NAMEPLATE_CARD],
  params: { ...voltageParams(PANEL_VOLTAGE, 'pada sisi tegangan rendah trafo'), ...currentParams('pada sisi tegangan rendah trafo', 'panel', true), kw: ACTIVE_POWER, thermal: THERMAL, earth: EARTH, noise: NOISE_NAB },
  equipment: [
    equipment('power', 'Tegangan Sekunder Trafo', 'Tegangan output sisi tegangan rendah; menunjukkan setelan tap dan kondisi suplai PLN.', V3_PARAMS),
    equipment('load', 'Beban Trafo', 'Arus sekunder terhadap rating trafo; beban tinggi menaikkan suhu belitan dan mempercepat penuaan isolasi.', [...I4_PARAMS, 'kw']),
    equipment('core', 'Belitan, Inti & Sambungan', 'Kondisi termal sambungan/terminal, kebisingan inti, dan pembumian trafo.', ['thermal', 'noise', 'earth']),
  ],
  visualLabels: {}, unitExample: 'Trafo-01 Trafo Room 1',
  nameplateHint: 'Nameplate trafo: daya (kVA) di notes, tegangan dan arus SISI TEGANGAN RENDAH (sekunder) sebagai ratedVoltage dan ratedCurrent.',
};

// ─── Tegangan menengah ───────────────────────────────────────────────────────

const MV_VOLTAGE_SOURCE = 'SPLN 1:1995: tegangan menengah 20 kV dengan toleransi +5%/-10%.';
const MV_PROFILE: PmProfile = {
  id: 'mv', version: 1, unitType: 'Panel MV / RMU 20 kV', accounts: ['mv@gmail.com'],
  namePattern: /\bmv\b|\brmu\b|kubikel|cubicle|\b20\s*kv\b/i,
  cards: [
    card('v_ll_mv', ['lineline', 'linetoline', 'phasetophase']),
    card('v_ln_mv', ['lineneutral', 'linetoneutral']),
    card('i_mv', ['currentondpm', 'current', 'arus', 'ampere']),
    FREQUENCY_CARD, THERMAL_CARD, EARTH_CARD, NAMEPLATE_CARD,
  ],
  params: {
    v_ll_mv: { label: 'Tegangan fasa-fasa 20 kV', unit: 'kV', expected: 'Tegangan line-line pada digital power meter panel MV (kV)', rules: [{ type: 'band', nominal: 20, warningPct: 5, warningLowPct: 10 }], source: MV_VOLTAGE_SOURCE },
    v_ln_mv: { label: 'Tegangan fasa-netral 20 kV', unit: 'kV', expected: 'Tegangan line-neutral pada digital power meter panel MV (kV)', rules: [{ type: 'band', nominal: 11.55, warningPct: 5, warningLowPct: 10 }], source: MV_VOLTAGE_SOURCE },
    i_mv: { label: 'Arus beban 20 kV', unit: 'A', expected: 'Arus beban pada digital power meter panel MV', rules: [], source: 'Dipantau tren beban; batas bergantung rating CT dan setelan proteksi yang tidak tercatat di kartu PM.' },
    frequency: FREQUENCY, thermal: THERMAL, earth: EARTH,
  },
  equipment: [
    equipment('grid', 'Tegangan & Frekuensi Jaringan 20 kV', 'Kualitas suplai PLN tegangan menengah yang masuk ke RMU/kubikel.', ['v_ll_mv', 'v_ln_mv', 'frequency']),
    equipment('load', 'Beban Feeder 20 kV', 'Arus beban yang disalurkan panel MV ke trafo distribusi.', ['i_mv']),
    equipment('conn', 'Terminasi Kabel & Pembumian', 'Kondisi termal terminasi kabel/busbar dan pembumian panel MV.', ['thermal', 'earth']),
  ],
  visualLabels: {}, unitExample: 'RMU-01 MV Room', nameplateHint: 'Nameplate panel MV/RMU: tegangan rating (kV) di notes, arus pengenal (A) sebagai ratedCurrent.',
};

// ─── Sumber cadangan ─────────────────────────────────────────────────────────

const GENSET_PROFILE: PmProfile = {
  id: 'genset', version: 1, unitType: 'Generator Set (Genset)', accounts: ['genset@gmail.com', 'generator@gmail.com'],
  namePattern: /genset|generator/i,
  cards: [
    ...VOLTAGE_CARDS, ...CURRENT_CARDS, FREQUENCY_CARD,
    card('v_batt', ['voltagedcbattery', 'dcbattery', 'batteryvoltage', 'teganganbaterai', 'teganganbatrai', 'vbatt']),
    card('v_charge', ['voltagedcalternator', 'dcalternator', 'chargingalternator', 'charging', 'charger']),
    VIBRATION_CARD, NOISE_CARD, THERMAL_CARD, EARTH_CARD, NAMEPLATE_CARD,
  ],
  params: {
    ...voltageParams(PANEL_VOLTAGE, 'pada output generator'), ...currentParams('pada output generator', 'panel'), frequency: FREQUENCY,
    v_batt: batteryParam('Tegangan baterai starter', 'Tegangan DC baterai starter genset dari battery tester / multimeter (V DC)'),
    v_charge: { label: 'Tegangan pengisian (alternator/charger)', unit: 'V', expected: 'Tegangan DC pengisian dari alternator / battery charger (V DC)', rules: [], source: 'Dipantau tren; tegangan pengisian bergantung sistem baterai (12/24 V) dan setelan charger.' },
    vibration: {
      label: 'Getaran engine/genset', unit: 'mm/s', expected: 'Getaran velocity RMS pada engine/generator dari vibration meter',
      rules: [{ type: 'riseFromBaseline', watchPct: 25, warningPct: 50 }],
      source: 'ISO 10816-1 kriteria II: perubahan getaran >25% dianggap signifikan. Batas absolut genset (ISO 8528-9) bergantung daya dan putaran, sehingga dinilai terhadap baseline unit ini: naik >25% pantau, >50% peringatan.',
    },
    noise: {
      label: 'Kebisingan genset', unit: 'dB(A)', expected: 'Tingkat kebisingan di ruang genset dari sound level meter', rules: [{ type: 'riseFromPrevious', watch: 3, warning: 6 }],
      source: 'Kebisingan ruang genset umumnya di atas NAB 85 dB(A) (Permenaker No. 5/2018, wajib APD telinga); yang dinilai kenaikan >=3 dB dari periode sebelumnya.',
    },
    thermal: THERMAL, earth: EARTH,
  },
  equipment: [
    equipment('output', 'Output Generator', 'Tegangan, arus, dan frekuensi keluaran alternator saat uji jalan.', [...V3_PARAMS, ...I3_PARAMS, 'frequency']),
    equipment('starting', 'Sistem Starting & Baterai', 'Baterai starter dan pengisiannya; tegangan turun menandakan baterai melemah atau charger bermasalah.', ['v_batt', 'v_charge']),
    equipment('engine', 'Engine & Mounting', 'Getaran dan kebisingan engine; kenaikan menandakan mounting aus, misalignment, atau masalah pembakaran.', ['vibration', 'noise']),
    equipment('conn', 'Terminasi & Pembumian', 'Kondisi termal terminal output dan pembumian genset.', ['thermal', 'earth']),
  ],
  visualLabels: {}, unitExample: 'Genset-01', nameplateHint: 'Nameplate genset/alternator: daya (kW; kVA di notes) sebagai ratedPowerKw, arus rating sebagai ratedCurrent, tegangan rating.',
};

const UPS_PROFILE: PmProfile = {
  id: 'ups', version: 1, unitType: 'UPS (Uninterruptible Power Supply)', accounts: ['ups@gmail.com'],
  namePattern: /\bups\b/i,
  cards: [
    // Output didahulukan agar "Output Voltage R-N" tidak terbaca sebagai tegangan input.
    card('vo_rn', ['outputrn', 'outputvoltagern', 'outrn']),
    card('vo_sn', ['outputsn', 'outputvoltagesn', 'outsn']),
    card('vo_tn', ['outputtn', 'outputvoltagetn', 'outtn']),
    ...VOLTAGE_CARDS, ...CURRENT_CARDS, NEUTRAL_CURRENT_CARD,
    card('ups_load', ['loadpercent', 'persenbeban', 'load', 'beban']),
    card('t_batt', ['batterytemperature', 'temperaturebattery', 'batterytemp', 'suhubaterai', 'suhubatrai']),
    card('v_batt', ['batteryvoltage', 'voltagebattery', 'teganganbaterai', 'teganganbatrai', 'vbatt', 'battery', 'baterai', 'batrai']),
    FREQUENCY_CARD, THERMAL_CARD, EARTH_CARD, NAMEPLATE_CARD,
  ],
  params: {
    ...voltageParams(PANEL_VOLTAGE, 'pada input UPS'),
    vo_rn: { label: 'Tegangan output R-N', unit: 'V', expected: 'Tegangan output fasa-netral R-N UPS', rules: PANEL_VOLTAGE.ln, source: PANEL_VOLTAGE.source },
    vo_sn: { label: 'Tegangan output S-N', unit: 'V', expected: 'Tegangan output fasa-netral S-N UPS', rules: PANEL_VOLTAGE.ln, source: PANEL_VOLTAGE.source },
    vo_tn: { label: 'Tegangan output T-N', unit: 'V', expected: 'Tegangan output fasa-netral T-N UPS', rules: PANEL_VOLTAGE.ln, source: PANEL_VOLTAGE.source },
    ...currentParams('pada output UPS', 'panel', true),
    ups_load: {
      label: 'Beban UPS', unit: '%', expected: 'Persentase beban output pada layar UPS (% load)', rules: [{ type: 'upper', watch: 80, warning: 90, alarm: 100 }],
      source: 'Batas internal mengikuti praktik operasi UPS: beban >80% mengurangi margin lonjakan dan waktu cadangan baterai; >100% = overload (UPS pindah ke bypass).',
    },
    t_batt: {
      label: 'Suhu baterai', unit: '°C', expected: 'Suhu baterai/ruang baterai pada layar UPS atau thermometer', rules: [{ type: 'upper', watch: 27, warning: 33 }],
      source: 'IEEE Std 1188: suhu operasi baterai VRLA 25 °C; umur baterai turun ±50% untuk setiap kenaikan ±8 °C di atas 25 °C (>33 °C peringatan; >27 °C pantau, batas internal).',
    },
    v_batt: batteryParam('Tegangan baterai', 'Tegangan DC string baterai pada layar UPS / multimeter (V DC)'),
    frequency: FREQUENCY, thermal: THERMAL, earth: EARTH,
  },
  equipment: [
    equipment('input', 'Input UPS', 'Tegangan suplai utama yang masuk ke rectifier UPS.', V3_PARAMS),
    equipment('output', 'Output & Beban UPS', 'Tegangan, arus, frekuensi, dan persentase beban critical bus yang dicatu UPS.', ['vo_rn', 'vo_sn', 'vo_tn', ...I4_PARAMS, 'ups_load', 'frequency']),
    equipment('battery', 'Baterai UPS', 'String baterai cadangan; suhu tinggi dan tegangan turun memperpendek umur dan waktu backup.', ['v_batt', 't_batt']),
    equipment('conn', 'Terminasi & Pembumian', 'Kondisi termal terminal/breaker dan pembumian UPS.', ['thermal', 'earth']),
  ],
  visualLabels: {}, unitExample: 'UPS-A1', nameplateHint: 'Nameplate UPS: kapasitas (kVA/kW) sebagai ratedPowerKw (kW), arus output rating sebagai ratedCurrent, tegangan output rating.',
};

// ─── Pendingin & tata udara ──────────────────────────────────────────────────

const CRAC_PROFILE: PmProfile = {
  id: 'crac', version: 1, unitType: 'CRAC (Computer Room Air Conditioner)', accounts: ['crac@gmail.com'],
  namePattern: /\bcrac\b|\bpac\b|precision\s*air/i,
  cards: [
    ...VOLTAGE_CARDS, ...LINE_VOLTAGE_CARDS, ...CURRENT_CARDS, LOAD_CURRENT_CARD,
    TEMPERATURE_CARD, HUMIDITY_CARD, AIRFLOW_CARD, VIBRATION_CARD, NOISE_CARD, EARTH_CARD, NAMEPLATE_CARD,
    visual('filter', ['filter']),
  ],
  params: {
    ...voltageParams(MOTOR_VOLTAGE, 'pada panel CRAC'), ...lineVoltageParams(MOTOR_VOLTAGE, 'pada panel CRAC'),
    ...currentParams('pada CRAC', 'motor'),
    i_1: { label: 'Arus beban CRAC', unit: 'A', expected: 'Arus beban CRAC, clamp meter mode A AC', rules: RATED_CURRENT_1P.rules, source: RATED_CURRENT_1P.source },
    temperature: TEMPERATURE_AIR, humidity: HUMIDITY, airflow: AIRFLOW, vibration: vibrationParam('motor fan CRAC', 1), noise: NOISE_NAB, earth: EARTH,
  },
  equipment: [
    equipment('power', 'Suplai Listrik CRAC', 'Catu daya 3 fasa ke kompresor, fan, dan heater/humidifier CRAC.', ['v_ll', 'v_ln', ...V3_PARAMS, 'earth']),
    equipment('motor', 'Kompresor & Motor Fan', 'Beban listrik dan getaran motor; kenaikan arus/getaran menandakan bearing aus, belt, atau beban kompresor naik.', [...I3_PARAMS, 'i_1', 'vibration', 'noise']),
    equipment('air', 'Udara Ruang & Aliran Udara', 'Kinerja pendinginan ruang data center; dipengaruhi kebersihan filter/coil dan kinerja fan.', ['temperature', 'humidity', 'airflow'], ['filter']),
  ],
  visualLabels: { filter: 'Kebersihan filter udara' }, unitExample: 'CRAC-01 Data Hall 1', nameplateHint: MOTOR_NAMEPLATE,
};

const VRV_PROFILE: PmProfile = {
  id: 'vrv', version: 1, unitType: 'VRV (Variable Refrigerant Volume)', accounts: ['vrv@gmail.com'],
  namePattern: /\bvr[vf]\b/i,
  cards: [
    ...VOLTAGE_CARDS, ...CURRENT_CARDS, SUPPLY_VOLTAGE_CARD, LOAD_CURRENT_CARD,
    card('p_suction', ['pressuresuction', 'suctionpressure', 'tekanansuction', 'suction']),
    card('p_discharge', ['pressuredischarge', 'dischargepressure', 'tekanandischarge', 'discharge']),
    VIBRATION_CARD, TEMPERATURE_CARD, HUMIDITY_CARD, AIRFLOW_CARD, NOISE_CARD, NAMEPLATE_CARD,
    visual('evaporator', ['evaporator']), visual('condenser', ['kondensor', 'condenser', 'condensor']), visual('filter', ['filter']),
  ],
  params: {
    ...voltageParams(MOTOR_VOLTAGE, 'pada outdoor unit VRV'), ...currentParams('pada outdoor unit VRV', 'motor'),
    ...singlePhaseParams('pada indoor unit VRV', MOTOR_SUPPLY_1P, RATED_CURRENT_1P),
    p_suction: SUCTION, p_discharge: DISCHARGE,
    vibration: vibrationParam('motor fan indoor', 1), temperature: TEMPERATURE_AIR, humidity: HUMIDITY, airflow: AIRFLOW, noise: NOISE_NAB,
  },
  equipment: [
    equipment('outdoor_power', 'Suplai Listrik Outdoor', 'Catu daya 3 fasa ke kompresor inverter dan fan outdoor.', V3_PARAMS),
    equipment('compressor', 'Kompresor & Siklus Refrigeran', 'Arus kompresor dan tekanan refrigeran; perubahan menandakan muatan refrigeran atau kondensor kotor.', [...I3_PARAMS, 'p_suction', 'p_discharge'], ['condenser']),
    equipment('indoor', 'Suplai & Motor Fan Indoor', 'Catu daya 1 fasa, arus, getaran, dan kebisingan fan indoor unit.', ['v_1', 'i_1', 'vibration', 'noise']),
    equipment('air', 'Udara Ruang & Coil Indoor', 'Kinerja pendinginan ruang; dipengaruhi kebersihan filter, coil evaporator, dan kinerja fan.', ['temperature', 'humidity', 'airflow'], ['evaporator', 'filter']),
  ],
  visualLabels: { evaporator: 'Kebersihan evaporator coil', condenser: 'Kebersihan coil kondensor', filter: 'Kebersihan filter udara' },
  unitExample: 'VRV-01 Indoor Lt.2', nameplateHint: MOTOR_NAMEPLATE,
};

const AHU_PROFILE: PmProfile = {
  id: 'ahu', version: 1, unitType: 'AHU (Air Handling Unit)', accounts: ['ahu@gmail.com', 'ahhu@utt.com', 'ahu@utt.com', 'ahhu@gmail.com'], accountIncludes: ['ahu', 'ahhu'],
  namePattern: /\bah+u\b|air\s*handling/i,
  cards: [
    ...VOLTAGE_CARDS, ...CURRENT_CARDS,
    card('p_suction', ['suctiondischarge', 'pressuresuction', 'suctionpressure', 'suction']),
    card('p_discharge', ['pressuredischarge', 'dischargepressure', 'discharge']),
    VIBRATION_CARD, TEMPERATURE_CARD, HUMIDITY_CARD, AIRFLOW_CARD, NOISE_CARD, NAMEPLATE_CARD,
  ],
  params: {
    ...voltageParams(MOTOR_VOLTAGE, 'pada panel AHU'), ...currentParams('pada motor AHU', 'motor'),
    p_suction: { ...SUCTION, expected: 'Tekanan suction (low side) pada manifold gauge; tulis tekanan discharge di raw bila ikut terlihat' }, p_discharge: DISCHARGE,
    vibration: vibrationParam('motor fan AHU', 1), temperature: TEMPERATURE_AIR, humidity: HUMIDITY, airflow: AIRFLOW, noise: NOISE_NAB,
  },
  equipment: [
    equipment('power', 'Suplai Listrik AHU', 'Catu daya 3 fasa ke motor blower (indoor) atau kompresor (outdoor).', V3_PARAMS),
    equipment('motor', 'Motor Blower / Kompresor', 'Arus, getaran, dan kebisingan motor; kenaikan menandakan bearing, belt, atau beban naik.', [...I3_PARAMS, 'vibration', 'noise']),
    equipment('refrigerant', 'Siklus Refrigeran (Outdoor)', 'Tekanan refrigeran unit outdoor; perubahan menandakan muatan refrigeran atau kondensor kotor.', ['p_suction', 'p_discharge']),
    equipment('air', 'Udara Supply & Coil', 'Temperatur, kelembapan, dan aliran udara supply AHU.', ['temperature', 'humidity', 'airflow']),
  ],
  visualLabels: {}, unitExample: 'AHU-01 Indoor', nameplateHint: MOTOR_NAMEPLATE,
};

const ACSPLIT_PROFILE: PmProfile = {
  id: 'acsplit', version: 1, unitType: 'AC Split', accounts: ['acsplit@gmail.com'],
  namePattern: /\bac\s*split|split\s*(wall|duct)/i,
  cards: [
    SUPPLY_VOLTAGE_CARD, LOAD_CURRENT_CARD,
    card('p_refrigerant', ['refrigerant', 'r32', 'tekananrefrigerant', 'pressure', 'tekanan']),
    TEMPERATURE_CARD, AIRFLOW_CARD, NAMEPLATE_CARD,
    visual('evaporator', ['evaporator']), visual('condenser', ['condenser', 'kondensor', 'outdoorcondenser']),
    visual('filter', ['airfilter', 'filter']), visual('drain', ['drain']),
  ],
  params: {
    ...singlePhaseParams('pada unit AC split', MOTOR_SUPPLY_1P, RATED_CURRENT_1P),
    p_refrigerant: { label: 'Tekanan refrigeran R32', unit: 'psi', expected: 'Tekanan refrigeran R32 (suction) pada manifold gauge', rules: [{ type: 'range', lowWarning: 115, highWarning: 145 }], source: 'Standar template PM AC Split: tekanan kerja refrigeran R32 115-145 psi.' },
    temperature: { ...TEMPERATURE_AIR, expected: 'Temperatur udara keluar indoor unit (thermometer)' }, airflow: AIRFLOW,
  },
  equipment: [
    equipment('power', 'Suplai Listrik & Kompresor', 'Tegangan suplai 1 fasa dan arus kerja kompresor AC.', ['v_1', 'i_1']),
    equipment('refrigerant', 'Siklus Refrigeran & Outdoor', 'Tekanan refrigeran R32 dan kebersihan kondensor outdoor.', ['p_refrigerant'], ['condenser']),
    equipment('indoor', 'Indoor Unit (Udara & Coil)', 'Temperatur udara keluar dan kebersihan filter, evaporator, serta saluran drain.', ['temperature', 'airflow'], ['evaporator', 'filter', 'drain']),
  ],
  visualLabels: { evaporator: 'Kebersihan evaporator coil', condenser: 'Kebersihan coil kondensor outdoor', filter: 'Kebersihan filter udara', drain: 'Kondisi drain pan & pipa drain' },
  unitExample: 'AC Split-01 Pos Security', nameplateHint: 'Nameplate AC split: arus kerja nominal (rated current) sebagai ratedCurrent, daya input (kW) sebagai ratedPowerKw, tegangan rating.',
};

const COOLINGTOWER_PROFILE: PmProfile = {
  id: 'coolingtower', version: 1, unitType: 'Cooling Tower', accounts: ['coolingtower@gmail.com'],
  namePattern: /cooling\s*tower/i,
  cards: [
    ...VOLTAGE_CARDS, ...CURRENT_CARDS,
    card('t_motor', ['onfanmotor', 'motortemperature', 'temperaturemotor', 'suhumotor']),
    card('rpm', ['rotationspeed', 'rpm', 'putaran']),
    card('p_pipe', ['pipespressure', 'pipepressure', 'suctionanddischarge', 'tekananpipa']),
    // Tanpa kartu getaran: kartu inspeksi "fan blades ... vibrations" bukan foto vibration meter.
    TEMPERATURE_CARD, AIRFLOW_CARD, NAMEPLATE_CARD,
  ],
  params: {
    ...voltageParams(MOTOR_VOLTAGE, 'pada panel motor fan cooling tower'), ...currentParams('pada motor fan cooling tower', 'motor'),
    t_motor: { label: 'Suhu motor fan', unit: '°C', expected: 'Suhu permukaan motor fan dari thermometer infrared / thermal imager', rules: [], source: 'Dipantau tren; batas suhu permukaan motor bergantung kelas isolasi pada nameplate motor.' },
    rpm: {
      label: 'Putaran fan', unit: 'rpm', expected: 'Putaran fan cooling tower dari tachometer (RPM)', rules: [{ type: 'dropFromBaseline', watchPct: 5, warningPct: 10 }],
      source: 'Batas internal: putaran fan turun dari baseline unit ini menandakan slip/aus belt atau masalah motor; >5% pantau, >10% peringatan.',
    },
    p_pipe: {
      label: 'Tekanan pipa air kondensor', unit: 'bar', expected: 'Tekanan pipa suction/discharge pompa air kondensor (pressure gauge, bar)', rules: [{ type: 'changeFromBaseline', watchPct: 20, warningPct: 35 }],
      source: 'Batas internal: perubahan tekanan dari baseline unit ini >20% indikasi strainer/nozzle tersumbat atau perubahan aliran pompa.',
    },
    temperature: { label: 'Temperatur air', unit: '°C', expected: 'Temperatur air cooling tower (thermometer)', rules: [], source: 'Dipantau tren; temperatur air bergantung beban chiller dan cuaca saat pengukuran.' },
    airflow: AIRFLOW,
  },
  equipment: [
    equipment('power', 'Suplai Listrik Motor Fan', 'Catu daya 3 fasa ke motor fan cooling tower.', V3_PARAMS),
    equipment('motor', 'Motor & Fan Cooling Tower', 'Arus, suhu, dan putaran motor fan; kombinasi ini menunjukkan kondisi bearing, belt, dan beban fan.', [...I3_PARAMS, 't_motor', 'rpm']),
    equipment('water', 'Sirkulasi Air & Aliran Udara', 'Tekanan pipa, temperatur air, dan aliran udara keluar; dipengaruhi kebersihan basin, filler, dan nozzle.', ['p_pipe', 'temperature', 'airflow']),
  ],
  visualLabels: {}, unitExample: 'CT-01', nameplateHint: MOTOR_NAMEPLATE,
};

const PUMP_PROFILE: PmProfile = {
  id: 'pump', version: 1, unitType: 'Pompa (Chilled / Condenser Water Pump)', accounts: ['pump@gmail.com', 'coolingpump@gmail.com'],
  namePattern: /\bpump\b|\bpompa\b|\bchwp\b|\bcwp\b/i,
  cards: [...VOLTAGE_CARDS, ...CURRENT_CARDS, NEUTRAL_CURRENT_CARD, VIBRATION_CARD, TEMPERATURE_CARD, EARTH_CARD, NAMEPLATE_CARD],
  params: {
    ...voltageParams(MOTOR_VOLTAGE, 'pada panel motor pompa'), ...currentParams('pada motor pompa', 'motor', true),
    vibration: vibrationParam('motor/bearing pompa', 2),
    temperature: { label: 'Temperatur', unit: '°C', expected: 'Temperatur yang tampil di alat ukur (bearing motor atau air pipa)', rules: [], source: 'Dipantau tren; titik ukur (bearing motor atau air pipa) tidak dibedakan di kartu PM. Standar service report air chilled: supply 6-7 °C, return 11-13 °C.' },
    earth: EARTH,
  },
  equipment: [
    equipment('power', 'Suplai Listrik & Pembumian', 'Catu daya 3 fasa ke motor pompa dan pembumian body motor/panel.', [...V3_PARAMS, 'earth']),
    equipment('motor', 'Motor & Pompa', 'Arus, getaran, dan temperatur; kenaikan menandakan bearing aus, misalignment, kavitasi, atau impeller tersumbat.', [...I4_PARAMS, 'vibration', 'temperature']),
  ],
  visualLabels: {}, unitExample: 'CHWP-01', nameplateHint: MOTOR_NAMEPLATE,
};

const EXHAUST_PROFILE: PmProfile = {
  id: 'exhaustfan', version: 1, unitType: 'Exhaust Fan', accounts: ['exhaustfan@gmail.com', 'exaustfan@utt.com', 'exausttan@utt.com'],
  namePattern: /exh?aust/i,
  cards: [...VOLTAGE_CARDS, ...CURRENT_CARDS, NEUTRAL_CURRENT_CARD, AIRFLOW_CARD, VIBRATION_CARD, NAMEPLATE_CARD, visual('blade', ['fanblade', 'blade'])],
  params: { ...voltageParams(MOTOR_VOLTAGE, 'pada panel exhaust fan'), ...currentParams('pada motor exhaust fan', 'motor', true), airflow: AIRFLOW, vibration: vibrationParam('motor exhaust fan', 1) },
  equipment: [
    equipment('power', 'Suplai Listrik Exhaust Fan', 'Catu daya 3 fasa ke motor exhaust fan.', V3_PARAMS),
    equipment('motor', 'Motor & Fan Exhaust', 'Arus, getaran, dan aliran udara; penurunan aliran menandakan blade kotor atau saluran tersumbat.', [...I4_PARAMS, 'vibration', 'airflow'], ['blade']),
  ],
  visualLabels: { blade: 'Kondisi & kebersihan blade fan' }, unitExample: 'Exhaust Fan-01', nameplateHint: MOTOR_NAMEPLATE,
};

// ─── Transportasi & akses ────────────────────────────────────────────────────

const LIFT_PROFILE: PmProfile = {
  id: 'lift', version: 1, unitType: 'Lift (Elevator)', accounts: ['lift@gmail.com'],
  namePattern: /\blift\b|elevator/i,
  cards: [
    ...VOLTAGE_CARDS, ...CURRENT_CARDS,
    card('leveling', ['leveling', 'levelling', 'akurasiberhenti', 'stoppingaccuracy', 'selisihlantai']),
    VIBRATION_CARD, NOISE_CARD, THERMAL_CARD, EARTH_CARD, NAMEPLATE_CARD,
  ],
  params: {
    ...voltageParams(MOTOR_VOLTAGE, 'pada panel mesin lift'), ...currentParams('pada motor traksi lift', 'motor'),
    leveling: {
      label: 'Akurasi berhenti lantai (leveling)', unit: 'mm', expected: 'Selisih tinggi lantai kabin terhadap lantai gedung (mm, nilai mutlak)', rules: [{ type: 'upper', warning: 10, alarm: 20 }],
      source: 'EN 81-20:2014 5.12.1.1.4: akurasi berhenti ±10 mm; akurasi leveling harus terjaga ±20 mm.',
    },
    vibration: vibrationParam('mesin traksi lift', 2), noise: NOISE_NAB, thermal: THERMAL, earth: EARTH,
  },
  equipment: [
    equipment('power', 'Suplai Listrik Lift', 'Catu daya 3 fasa ke panel kontrol dan inverter mesin lift.', V3_PARAMS),
    equipment('machine', 'Mesin Traksi & Motor', 'Arus, getaran, dan kebisingan mesin traksi; kenaikan menandakan bearing, gearbox, atau rem bermasalah.', [...I3_PARAMS, 'vibration', 'noise']),
    equipment('leveling', 'Akurasi Berhenti Kabin', 'Ketepatan kabin berhenti di lantai; penyimpangan berisiko tersandung dan menandakan rem/encoder perlu penyetelan.', ['leveling']),
    equipment('conn', 'Panel Kontrol & Pembumian', 'Kondisi termal panel kontrol dan pembumian mesin lift.', ['thermal', 'earth']),
  ],
  visualLabels: {}, unitExample: 'Lift-01 Passenger', nameplateHint: MOTOR_NAMEPLATE,
};

const XRAY_PROFILE: PmProfile = {
  id: 'xray', version: 1, unitType: 'Mesin X-Ray (Baggage Scanner)', accounts: ['xray@gmail.com'],
  namePattern: /x-?\s*ray/i,
  cards: [
    NG_VOLTAGE_CARD, SUPPLY_VOLTAGE_CARD, LOAD_CURRENT_CARD,
    card('radiation', ['radiation', 'radiasi', 'leakage', 'kebocoran', 'surveymeter', 'dosis']),
    EARTH_CARD, NAMEPLATE_CARD,
  ],
  params: {
    ...singlePhaseParams('pada mesin X-ray', SUPPLY_230, RATED_CURRENT_1P),
    v_ng: { label: 'Tegangan netral-ground', unit: 'V', expected: 'Tegangan antara netral dan ground (N-G) pada stop kontak mesin X-ray', rules: [{ type: 'upper', watch: 2, warning: 5 }], source: NG_SOURCE },
    radiation: {
      label: 'Kebocoran radiasi', unit: 'µSv/h', expected: 'Laju dosis radiasi di permukaan/tirai mesin X-ray pada survey meter (µSv/h)', rules: [{ type: 'upper', watch: 0.5, warning: 5 }],
      source: 'Perka BAPETEN No. 4/2013: nilai batas dosis masyarakat 1 mSv/tahun (±0,5 µSv/jam untuk 2.000 jam kerja) = pantau. 21 CFR 1020.40: kebocoran kabinet X-ray maksimal 0,5 mR/jam pada 5 cm (±5 µSv/jam) = peringatan.',
    },
    earth: EARTH,
  },
  equipment: [
    equipment('power', 'Suplai Listrik & Pembumian', 'Catu daya mesin X-ray; tegangan stabil dan pembumian baik melindungi generator X-ray dan elektronik.', ['v_1', 'i_1', 'v_ng', 'earth']),
    equipment('radiation', 'Keselamatan Radiasi', 'Laju dosis di sekitar tirai dan kabinet; kenaikan menandakan tirai timbal aus atau pelindung bocor.', ['radiation']),
  ],
  visualLabels: {}, unitExample: 'X-Ray-01 Lobby', nameplateHint: 'Nameplate mesin X-ray: arus input rating sebagai ratedCurrent, tegangan input rating, daya (kW/VA) sebagai ratedPowerKw.',
};

const DOCK_PROFILE: PmProfile = {
  id: 'dockleveler', version: 1, unitType: 'Dock Leveler', accounts: ['dockleveler@gmail.com'], accountIncludes: ['dock', 'leveler'],
  namePattern: /dock\s*level/i,
  cards: [...VOLTAGE_CARDS, ...CURRENT_CARDS, NOISE_CARD, EARTH_CARD, NAMEPLATE_CARD],
  params: { ...voltageParams(MOTOR_VOLTAGE, 'pada panel dock leveler'), ...currentParams('pada motor pompa hidrolik', 'motor'), noise: NOISE_MOTOR, earth: EARTH },
  equipment: [
    equipment('power', 'Suplai Listrik & Pembumian', 'Catu daya 3 fasa ke motor pompa hidrolik dan pembumian panel.', [...V3_PARAMS, 'earth']),
    equipment('motor', 'Motor Pompa Hidrolik', 'Arus dan kebisingan motor pompa; kenaikan menandakan beban hidrolik naik atau bearing aus.', [...I3_PARAMS, 'noise']),
  ],
  visualLabels: {}, unitExample: 'Dock Leveler-01', nameplateHint: MOTOR_NAMEPLATE,
};

const DOOR_PROFILE: PmProfile = {
  id: 'door', version: 1, unitType: 'Rolling Door & Emergency Door', accounts: ['door@gmail.com'],
  namePattern: /\bdoor\b|rolling|\bpintu\b|shutter/i,
  cards: [...VOLTAGE_CARDS, ...CURRENT_CARDS, NOISE_CARD, EARTH_CARD, NAMEPLATE_CARD],
  params: { ...voltageParams(MOTOR_VOLTAGE, 'pada panel motor door'), ...currentParams('pada motor door', 'motor'), noise: NOISE_MOTOR, earth: EARTH },
  equipment: [
    equipment('power', 'Suplai Listrik & Pembumian', 'Catu daya ke motor rolling door dan pembumian panel.', [...V3_PARAMS, 'earth']),
    equipment('motor', 'Motor & Gearbox Door', 'Arus dan kebisingan motor; kenaikan menandakan rantai/gear kurang pelumasan atau rel tersendat.', [...I3_PARAMS, 'noise']),
  ],
  visualLabels: {}, unitExample: 'Rolling Door-01 Loading Dock', nameplateHint: MOTOR_NAMEPLATE,
};

const GATE_PROFILE: PmProfile = {
  id: 'gate', version: 1, unitType: 'Automatic Gate & Barrier', accounts: ['gate@gmail.com'],
  namePattern: /\bgate\b|barrier|\bpalang\b/i,
  cards: [
    ...VOLTAGE_CARDS, ...CURRENT_CARDS,
    // Template gate: "Voltage Measurement" tersisa "measurement" setelah awalan dibuang.
    card('v_1', ['measurement', 'voltage', 'voltase', 'tegangan']),
    card('i_1', ['amperemeasurement', 'ampere', 'arus', 'current']),
    NAMEPLATE_CARD,
  ],
  params: { ...voltageParams(MOTOR_VOLTAGE, 'pada panel gate'), ...currentParams('pada motor gate', 'motor'), ...singlePhaseParams('pada motor gate', MOTOR_SUPPLY_1P, RATED_CURRENT_1P) },
  equipment: [
    equipment('motor', 'Motor Gate', 'Tegangan dan arus motor penggerak gate/barrier; arus naik menandakan roda/rel berat atau gear kurang pelumasan.', ['v_1', 'i_1', ...V3_PARAMS, ...I3_PARAMS]),
  ],
  visualLabels: {}, unitExample: 'Gate-01 Utama', nameplateHint: MOTOR_NAMEPLATE,
};

// ─── Penerangan, proteksi petir, pembumian ───────────────────────────────────

const PJU_PROFILE: PmProfile = {
  id: 'pju', version: 1, unitType: 'PJU Tenaga Surya', accounts: ['pju@gmail.com'],
  namePattern: /\bpju\b|penerangan\s*jalan/i,
  cards: [
    card('v_batt1', ['batrai1', 'baterai1', 'battery1']),
    card('v_batt2', ['batrai2', 'baterai2', 'battery2']),
    card('v_batt_total', ['2batrai', '2baterai', 'batraiseri', 'totalbatrai']),
    card('v_solar', ['solarcell', 'panelsurya', 'solarpanel']),
    card('lux', ['luxlamp', 'lux', 'luxmeter', 'iluminasi', 'pencahayaan']),
    NAMEPLATE_CARD,
    visual('solar', ['solarcell', 'panelsurya', 'solarpanel']),
    visual('led', ['lampuled', 'ledlampu', 'boxled', 'visuallampu']),
    visual('panel', ['panelpju', 'batrai', 'baterai']),
  ],
  params: {
    v_batt1: batteryParam('Tegangan baterai 1', 'Tegangan DC baterai 1 dari multimeter (V DC)'),
    v_batt2: batteryParam('Tegangan baterai 2', 'Tegangan DC baterai 2 dari multimeter (V DC)'),
    v_batt_total: batteryParam('Tegangan 2 baterai (seri)', 'Tegangan DC dua baterai terhubung seri dari multimeter (V DC)'),
    v_solar: { label: 'Tegangan panel surya', unit: 'V', expected: 'Tegangan DC output panel surya dari multimeter (V DC)', rules: [], source: 'Dipantau tren; tegangan panel surya bergantung intensitas matahari saat pengukuran.' },
    lux: {
      label: 'Iluminasi lampu', unit: 'lux', expected: 'Nilai iluminasi pada layar lux meter', rules: [{ type: 'dropFromBaseline', watchPct: 20, warningPct: 30 }],
      source: 'IES LM-80/TM-21: umur LED dinyatakan saat fluks cahaya turun ke 70% (L70). Turun >20% dari baseline pantau, >30% peringatan.',
    },
  },
  equipment: [
    equipment('battery', 'Baterai & Panel Kontrol', 'Baterai penyimpan energi surya; tegangan turun menandakan kapasitas baterai melemah.', ['v_batt1', 'v_batt2', 'v_batt_total'], ['panel']),
    equipment('solar', 'Panel Surya', 'Modul surya pengisi baterai; kebersihan permukaan menentukan daya isi.', ['v_solar'], ['solar']),
    equipment('lamp', 'Lampu LED', 'Armatur LED; penurunan iluminasi menandakan degradasi LED atau kaca kotor.', ['lux'], ['led']),
  ],
  visualLabels: { solar: 'Kebersihan permukaan panel surya', led: 'Kondisi & kebersihan lampu LED', panel: 'Kondisi panel PJU dan baterai' },
  unitExample: 'PJU-01 Gerbang Utama', nameplateHint: 'Nameplate tiang/lampu PJU: daya lampu (W, konversi ke kW) sebagai ratedPowerKw, tegangan sistem (V DC) sebagai ratedVoltage.',
};

const LIGHTING_PROFILE: PmProfile = {
  id: 'lightingsystem', version: 1, unitType: 'Lighting System', accounts: ['lightingsystem@gmail.com'],
  namePattern: /lighting|penerangan|\blampu\b/i,
  cards: [
    SUPPLY_VOLTAGE_CARD, LOAD_CURRENT_CARD,
    card('lux', ['lux', 'luxmeter', 'iluminasi', 'pencahayaan']),
    NAMEPLATE_CARD, visual('lamp', ['lampu', 'lamp']),
  ],
  params: {
    ...singlePhaseParams('pada panel lighting', SUPPLY_230, TREND_CURRENT_1P),
    lux: {
      label: 'Iluminasi', unit: 'lux', expected: 'Nilai iluminasi pada layar lux meter', rules: [{ type: 'dropFromBaseline', watchPct: 20, warningPct: 30 }],
      source: 'IES LM-80/TM-21: umur LED dinyatakan saat fluks cahaya turun ke 70% (L70). Turun >20% dari baseline pantau, >30% peringatan.',
    },
  },
  equipment: [
    equipment('power', 'Suplai Panel Lighting', 'Tegangan dan arus beban panel penerangan.', ['v_1', 'i_1']),
    equipment('lamp', 'Lampu & Armatur', 'Kondisi dan kebersihan lampu; iluminasi turun menandakan degradasi lampu.', ['lux'], ['lamp']),
  ],
  visualLabels: { lamp: 'Kondisi & kebersihan lampu' }, unitExample: 'Lighting Panel Lt.1',
  nameplateHint: 'Nameplate lampu/armatur: merk, model, daya lampu (W di notes). Isi ratedCurrent HANYA bila pelat menunjukkan rating MCB/panel.',
};

const LPS_PROFILE: PmProfile = {
  id: 'lps', version: 1, unitType: 'Sistem Proteksi Petir (LPS)', accounts: ['lps@gmail.com'],
  namePattern: /\blps\b|penangkal\s*petir|lightning\s*protection/i,
  cards: [EARTH_CARD, NAMEPLATE_CARD, visual('terminal', ['airterminal', 'counter', 'continuitas', 'continuity', 'wiring'])],
  params: {
    earth: {
      label: 'Resistans pembumian penangkal petir', unit: 'ohm', expected: 'Resistans pembumian sistem penangkal petir dari earth tester (ohm)', rules: [{ type: 'upper', warning: 10 }],
      source: 'IEC 62305-3 & SNI 03-7015-2004: resistans pembumian sistem proteksi petir sebaiknya <10 ohm.',
    },
  },
  equipment: [
    equipment('earth', 'Pembumian & Konduktor Penyalur', 'Elektroda pembumian dan konduktor turun; resistans tinggi mengurangi kemampuan menyalurkan arus petir.', ['earth'], ['terminal']),
  ],
  visualLabels: { terminal: 'Kondisi air terminal, counter, dan kabel penyalur' }, unitExample: 'LPS Tower-01',
};

const GROUNDING_PROFILE: PmProfile = {
  id: 'grounding', version: 1, unitType: 'Sistem Pembumian (Grounding)', accounts: ['grounding@gmail.com'],
  namePattern: /grounding|pembumian|pentanahan|\bearthing\b/i,
  // Template grounding hanya berlabel "Measurement" untuk foto earth tester.
  cards: [card('earth', ['measurement', 'grounding', 'earthing', 'earth', 'ground', 'pentanahan', 'pembumian']), NAMEPLATE_CARD],
  params: { earth: EARTH },
  equipment: [equipment('earth', 'Elektroda & Sistem Pembumian', 'Bak kontrol dan elektroda pembumian; resistans naik menandakan korosi elektroda atau sambungan kendor.', ['earth'])],
  visualLabels: {}, unitExample: 'Grounding Pit-01',
};

// ─── Pemadam gas & deteksi asap ──────────────────────────────────────────────

// Akun FSS tidak punya template kartu; kata kunci mengikuti istilah yang lazim ditulis engineer.
const FSS_PROFILE: PmProfile = {
  id: 'fss', version: 1, unitType: 'Fire Suppression System (FSS) & VESDA', accounts: ['fss@gmail.com'],
  namePattern: /\bfss\b|fire\s*suppression|fm-?\s*200|novec|vesda/i,
  cards: [
    card('p_cylinder', ['cylinderpressure', 'pressurecylinder', 'tekanantabung', 'tabung', 'cylinder', 'silinder', 'pressure', 'tekanan']),
    card('agent_weight', ['agentweight', 'beratagen', 'weight', 'berat', 'timbang', 'penimbangan']),
    card('vesda_flow', ['vesdaflow', 'vesdaairflow', 'airflow', 'aliranudara']),
    card('v_batt', ['batteryvoltage', 'voltagebattery', 'teganganbaterai', 'teganganbatrai', 'battery', 'baterai', 'batrai', 'aki']),
    SUPPLY_VOLTAGE_CARD, EARTH_CARD, NAMEPLATE_CARD,
  ],
  params: {
    p_cylinder: {
      label: 'Tekanan tabung agen', unit: 'bar', expected: 'Tekanan pada pressure gauge tabung agen pemadam (bar)', rules: [{ type: 'dropFromBaseline', watchPct: 5, warningPct: 10 }],
      source: 'NFPA 2001: kontainer yang kehilangan tekanan lebih dari 10% (terkoreksi suhu) harus diisi ulang atau diganti; turun >5% mulai dipantau. Dibandingkan terhadap pengukuran pertama unit ini, jadi ukur pada suhu ruang yang sebanding.',
    },
    agent_weight: {
      label: 'Berat agen pemadam', unit: 'kg', expected: 'Berat bersih agen pemadam (tanpa tabung) dari timbangan atau liquid level indicator (kg)', rules: [{ type: 'dropFromBaseline', watchPct: 3, warningPct: 5 }],
      source: 'NFPA 2001: kontainer yang kehilangan berat agen lebih dari 5% harus diisi ulang atau diganti; turun >3% mulai dipantau. Dibandingkan terhadap pengukuran pertama unit ini.',
    },
    vesda_flow: {
      label: 'Aliran udara sampling VESDA', unit: '%', expected: 'Nilai airflow pada display detektor VESDA (%)', rules: [{ type: 'changeFromBaseline', watchPct: 10, warningPct: 20 }],
      source: 'Batas internal: perubahan aliran sampling dari baseline unit ini menandakan lubang sampling tersumbat atau pipa bocor/lepas; detektor juga memberi fault aliran sesuai ambang yang disetel.',
    },
    v_batt: batteryParam('Tegangan baterai panel', 'Tegangan DC baterai cadangan panel kontrol (V DC)'),
    v_1: { label: 'Tegangan suplai panel', unit: 'V', expected: 'Tegangan suplai fasa-netral panel kontrol, mode V AC', rules: SUPPLY_230.rules, source: SUPPLY_230.source },
    earth: EARTH,
  },
  equipment: [
    equipment('agent', 'Tabung & Agen Pemadam', 'Tabung agen pemadam gas; penurunan tekanan atau berat menandakan kebocoran katup/segel sehingga konsentrasi pemadaman tidak tercapai.', ['p_cylinder', 'agent_weight']),
    equipment('vesda', 'Deteksi Asap VESDA', 'Detektor aspirasi asap; aliran sampling stabil menjamin deteksi dini tetap sensitif.', ['vesda_flow']),
    equipment('panel', 'Panel Kontrol & Catu Daya', 'Catu daya utama dan baterai cadangan panel pemadam; baterai lemah berisiko sistem tidak bekerja saat listrik padam.', ['v_1', 'v_batt', 'earth']),
  ],
  visualLabels: {}, unitExample: 'FSS Data Hall 1',
  nameplateHint: 'Label tabung agen: jenis agen (FM-200/Novec), berat pengisian (kg) dan tekanan pengisian (bar) tulis di notes.',
};

// ─── Pengolahan air ──────────────────────────────────────────────────────────

const SOFTENER_PRESSURE_SOURCE = 'Dipantau tren; tekanan bergantung pompa/suplai air. Kinerja softener dinilai dari pressure drop inlet-outlet.';

// Akun water softener (email memuat "watersoftener") tidak punya template kartu. Kartu
// pertama yang kata kuncinya cocok dipakai, jadi kartu spesifik (kesadahan inlet, tekanan
// outlet) ditaruh sebelum kata kunci umum (hardness, pressure).
const WATERSOFTENER_PROFILE: PmProfile = {
  id: 'watersoftener', version: 1, unitType: 'Water Softener', accounts: [], accountIncludes: ['watersoftener'],
  namePattern: /softener|pelunak\s*air/i,
  cards: [
    card('hardness_in', ['hardnessinlet', 'inlethardness', 'rawwaterhardness', 'hardnessrawwater', 'hardnessairbaku', 'kesadahaninlet', 'kesadahanmasuk', 'kesadahanairbaku', 'kesadahanairmasuk']),
    card('hardness_out', ['hardnessoutlet', 'outlethardness', 'hardness', 'kesadahan']),
    card('tds', ['tds', 'tdsmeter', 'tdsair', 'tdswater', 'tdsinlet', 'tdsoutlet', 'nilaitds', 'totaldissolved']),
    card('ph', ['ph', 'phair', 'phwater', 'waterph', 'phmeter', 'phinlet', 'phoutlet', 'nilaiph', 'keasaman']),
    card('p_return', ['outletpressure', 'pressureoutlet', 'gaugeoutlet', 'outletgauge', 'tekananoutlet', 'tekanankeluar', 'tekananairkeluar']),
    card('p_supply', ['inletpressure', 'pressureinlet', 'gaugeinlet', 'inletgauge', 'tekananinlet', 'tekananmasuk', 'tekananairmasuk', 'pressure', 'tekanan']),
    NAMEPLATE_CARD,
    visual('brine', ['brine', 'salt', 'garam']),
    visual('resin', ['resin', 'vessel', 'mediatank', 'tangkimedia']),
    visual('valve', ['controlvalve', 'valve', 'katup', 'timer', 'controller', 'kontroler', 'regenerasi', 'regeneration', 'backwash']),
    visual('piping', ['piping', 'pipa', 'pipe', 'leak', 'bocor', 'kebocoran']),
  ],
  params: {
    hardness_in: {
      label: 'Kesadahan air baku (inlet)', unit: 'mg/L', expected: 'Kesadahan total air masuk softener dari test kit / hardness meter (mg/L atau ppm CaCO3)', rules: [],
      source: 'Dipantau tren: kesadahan air baku menentukan beban resin dan frekuensi regenerasi (klasifikasi USGS: 61-120 mg/L sedang, 121-180 keras, >180 sangat keras).',
    },
    hardness_out: {
      label: 'Kesadahan air hasil softener', unit: 'mg/L', expected: 'Kesadahan total air keluar softener dari test kit / hardness meter (mg/L atau ppm CaCO3)',
      rules: [{ type: 'upper', warning: 17.1, alarm: 60 }],
      source: 'NSF/ANSI 44: kapasitas softener habis saat kesadahan air keluar melewati 1 gpg (17,1 mg/L CaCO3), resin perlu regenerasi. Klasifikasi USGS: >60 mg/L bukan lagi air lunak (softener tidak bekerja).',
    },
    tds: {
      label: 'TDS air', unit: 'mg/L', expected: 'Total dissolved solids pada layar TDS meter (ppm / mg/L)', rules: [],
      source: 'Dipantau tren: softener menukar ion Ca/Mg dengan Na sehingga TDS relatif tetap; kenaikan tajam sesudah regenerasi menandakan sisa larutan garam (bilas kurang).',
    },
    ph: {
      label: 'pH air', unit: 'pH', expected: 'Nilai pH air dari pH meter / test kit', rules: [{ type: 'range', lowWarning: 6.5, highWarning: 8.5 }],
      source: 'Permenkes No. 2/2023 (pengganti Permenkes 492/2010): pH air 6,5-8,5.',
    },
    p_supply: { label: 'Tekanan air masuk (inlet)', unit: 'bar', expected: 'Tekanan air pada pressure gauge inlet softener (bar)', rules: [], source: SOFTENER_PRESSURE_SOURCE },
    p_return: { label: 'Tekanan air keluar (outlet)', unit: 'bar', expected: 'Tekanan air pada pressure gauge outlet softener (bar)', rules: [], source: SOFTENER_PRESSURE_SOURCE },
    p_diff: {
      label: 'Pressure drop softener (inlet-outlet)', unit: 'bar', derived: 'pressureDiff',
      rules: [{ type: 'nonNegative' }, { type: 'upper', warning: 1 }],
      source: 'NSF/ANSI 44: pressure drop softener maksimal 15 psi (±1 bar) pada debit layanan; di atas itu resin/distributor tersumbat atau debit melebihi kapasitas.',
    },
  },
  equipment: [
    equipment('softening', 'Resin & Kinerja Pelunakan', 'Tangki resin penukar ion yang mengikat kalsium/magnesium; kesadahan air keluar naik menandakan resin jenuh atau regenerasi tidak tuntas, pressure drop naik menandakan resin/distributor tersumbat.', ['hardness_in', 'hardness_out', 'p_supply', 'p_return', 'p_diff'], ['resin']),
    equipment('quality', 'Kualitas Air Keluar', 'pH dan TDS air hasil softener yang dipakai sistem gedung.', ['ph', 'tds']),
    equipment('regeneration', 'Sistem Regenerasi & Perpipaan', 'Tangki brine (garam), control valve/timer regenerasi, dan perpipaan; garam habis atau valve macet membuat resin tidak teregenerasi.', [], ['brine', 'valve', 'piping']),
  ],
  visualLabels: { brine: 'Level garam & kondisi tangki brine', resin: 'Kondisi tangki resin', valve: 'Kondisi control valve & siklus regenerasi', piping: 'Perpipaan & kebocoran' },
  unitExample: 'Water Softener-01',
  nameplateHint: 'Label tangki/control valve softener: merk, model, serial; kapasitas resin (liter/grain) dan debit layanan tulis di notes.',
};

// ─── Deteksi kebocoran (hanya observasi visual) ──────────────────────────────

const leakDetectionProfile = (id: string, account: string, unitType: string, namePattern: RegExp, unitExample: string): PmProfile => ({
  id, version: 1, unitType, accounts: [account], namePattern,
  cards: [
    visual('panel', ['status', 'systemsetting', 'communicationsetting', 'testping']),
    visual('sensor', ['tagcable', 'cable', 'fgmap', 'maps', 'test']),
  ],
  params: {},
  equipment: [
    equipment('panel', 'Panel & Komunikasi', 'Status panel deteksi, setelan sistem, dan komunikasi ke BMS.', [], ['panel']),
    equipment('sensor', 'Kabel Sensor & Uji Fungsi', 'Kabel sensor kebocoran, penandaan, peta zona, dan hasil uji fungsi.', [], ['sensor']),
  ],
  visualLabels: { panel: 'Status panel & tampilan sistem', sensor: 'Kondisi kabel sensor & hasil uji' },
  unitExample,
});
const WLD_PROFILE = leakDetectionProfile('wld', 'wld@gmail.com', 'Water Leak Detection (WLD)', /\bwld\b|water\s*leak/i, 'WLD Zone-01');
const FLD_PROFILE = leakDetectionProfile('fld', 'fld@gmail.com', 'Fuel Leak Detection (FLD)', /\bfld\b|fuel\s*leak/i, 'FLD Tank-01');

/** Urutan berpengaruh pada pencocokan nama maintenance: pola yang lebih spesifik lebih dulu. */
export const PM_PREDICTIVE_PROFILES: PmProfile[] = [
  FCU_PROFILE, CRAC_PROFILE, VRV_PROFILE, AHU_PROFILE, ACSPLIT_PROFILE, COOLINGTOWER_PROFILE, PUMP_PROFILE, EXHAUST_PROFILE,
  CAPACITOR_PROFILE, PDU_PROFILE, UPS_PROFILE, ATS_PROFILE, LDB_PROFILE, BUSDUCT_PROFILE, TRAFO_PROFILE, MV_PROFILE, LV_PROFILE,
  GENSET_PROFILE, LIFT_PROFILE, XRAY_PROFILE, PJU_PROFILE, LIGHTING_PROFILE, LPS_PROFILE, GROUNDING_PROFILE,
  DOCK_PROFILE, DOOR_PROFILE, GATE_PROFILE, FSS_PROFILE, WATERSOFTENER_PROFILE, WLD_PROFILE, FLD_PROFILE,
];

/** Profil untuk laporan PM berdasarkan akun pembuat (persis, lalu potongan email), lalu nama maintenance. */
export function resolvePmProfile(account: string | undefined, maintenanceName?: string): PmProfile | null {
  const email = (account || '').toLowerCase().trim();
  const byAccount = PM_PREDICTIVE_PROFILES.find(p => p.accounts.includes(email))
    || (email ? PM_PREDICTIVE_PROFILES.find(p => p.accountIncludes?.some(part => email.includes(part))) : undefined);
  if (byAccount) return byAccount;
  if (maintenanceName) {
    return PM_PREDICTIVE_PROFILES.find(p => p.namePattern?.test(maintenanceName)) || null;
  }
  return null;
}
