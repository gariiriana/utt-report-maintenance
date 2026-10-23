// Uji profil Predictive Report semua akun maintenance (pmPredictiveProfiles.ts): integritas
// profil, pemetaan kartu template "Buat Laporan" tiap akun, aturan batas baru, dan satu alur
// lengkap untuk akun non-FCU. Jalankan: node --test scripts/test-pm-predictive-profiles.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PM_PREDICTIVE_PROFILES, resolvePmProfile } from '../frontend/config/pmPredictiveProfiles.ts';
import { REPORT_TEMPLATES, VRV_TEMPLATE, AHHU_TEMPLATE, LV_ATS_TRAFO_TEMPLATE } from '../frontend/config/templates.ts';
import { planCards, initDraft, applyExtraction, composeAnalysis, buildPmReport } from '../frontend/utils/pmPredictiveWorkflow.ts';
import { evaluateParam, convertToCanonical, matchCard } from '../frontend/utils/pmPredictiveEngine.ts';
import { exportParams, paramRowText, limitSourceRows, nameplateText, sectionStatusLines } from '../frontend/utils/pmPredictiveExportShared.ts';

const byId = id => PM_PREDICTIVE_PROFILES.find(p => p.id === id);
const photosOf = labels => labels.map((description, i) => ({ index: i + 1, description, photoBase64: 'data:image/jpeg;base64,AAAA' }));
const measuredParams = (profile, labels) => planCards(profile, photosOf(labels)).filter(p => p.kind === 'measurement').map(p => p.param).sort();
const at = (profile, param, value, nameplate = {}, series = []) =>
  evaluateParam({ param, def: profile.params[param], series, value, date: '2026-07-10', nameplate });

// Akun engineer yang punya template/registry service report.
const ACCOUNTS = [
  'ats@gmail.com', 'mv@gmail.com', 'grounding@gmail.com', 'crac@gmail.com', 'vrv@gmail.com', 'lift@gmail.com', 'xray@gmail.com',
  'pju@gmail.com', 'genset@gmail.com', 'generator@gmail.com', 'pdu@gmail.com', 'coolingtower@gmail.com', 'lv@gmail.com',
  'acsplit@gmail.com', 'ups@gmail.com', 'gate@gmail.com', 'trafo@gmail.com', 'ahu@gmail.com', 'ahhu@utt.com', 'pump@gmail.com',
  'coolingpump@gmail.com', 'dockleveler@gmail.com', 'door@gmail.com', 'exhaustfan@gmail.com', 'exaustfan@utt.com',
  'exausttan@utt.com', 'fcu@gmail.com', 'ldbrdb@gmail.com', 'ldb/rdb@gmail.com', 'ldb@gmail.com', 'busduct@gmail.com',
  'capacitorbank@gmail.com', 'lightingsystem@gmail.com', 'lps@gmail.com', 'fss@gmail.com', 'wld@gmail.com', 'fld@gmail.com',
];

test('setiap akun engineer punya tepat satu profil', () => {
  for (const account of ACCOUNTS) {
    assert.ok(resolvePmProfile(account), `profil untuk ${account}`);
    assert.equal(PM_PREDICTIVE_PROFILES.filter(p => p.accounts.includes(account)).length, 1, `${account} hanya di satu profil`);
  }
  assert.equal(resolvePmProfile(' UPS@gmail.com ')?.id, 'ups');
  assert.equal(resolvePmProfile('someone@x.com', 'PM Panel ATS Power Room A')?.id, 'ats', 'cadangan dari nama maintenance');
  assert.equal(resolvePmProfile('someone@x.com', 'Laporan Bulanan'), null);
  assert.equal(resolvePmProfile(''), null);
  const ids = PM_PREDICTIVE_PROFILES.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, 'id profil unik');
});

test('akun yang dapat template kartu lewat potongan email (ReportForm) juga dapat profil', () => {
  // ReportForm.getAccountTemplate: email memuat ahu/ahhu, dock/leveler, ldb/rdb.
  const cases = [
    ['ahu2@gmail.com', 'ahu'], ['ahhu.indoor@utt.com', 'ahu'], ['dock@gmail.com', 'dockleveler'], ['leveler2@gmail.com', 'dockleveler'],
    ['rdb@gmail.com', 'ldbrdb'], ['ldb2@utt.com', 'ldbrdb'], ['watersoftener@gmail.com', 'watersoftener'],
  ];
  for (const [account, id] of cases) assert.equal(resolvePmProfile(account, 'Laporan Bulanan')?.id, id, account);
  for (const key of Object.keys(REPORT_TEMPLATES)) {
    const account = key.includes('@') ? key : `${key}@gmail.com`;
    assert.ok(resolvePmProfile(account), `template ${key} tanpa profil`);
  }
  assert.equal(resolvePmProfile('ahu@gmail.com', 'PM Panel ATS')?.id, 'ahu', 'akun didahulukan dari nama maintenance');
  assert.equal(resolvePmProfile('someone@x.com', 'PM Water Softener Q3')?.id, 'watersoftener');
});

test('integritas profil: kartu, equipment, dan visual merujuk definisi yang ada', () => {
  for (const p of PM_PREDICTIVE_PROFILES) {
    for (const c of p.cards) {
      if (c.kind === 'measurement') assert.ok(p.params[c.param], `${p.id}: kartu ${c.match[0]} -> parameter ${c.param} tidak ada`);
      if (c.kind === 'visual') assert.ok(c.visualKey, `${p.id}: kartu visual tanpa key`);
    }
    const visualKeys = new Set(p.cards.filter(c => c.kind === 'visual').map(c => c.visualKey));
    for (const eq of p.equipment) {
      for (const param of eq.params) assert.ok(p.params[param], `${p.id}/${eq.id}: parameter ${param} tidak ada`);
      for (const key of eq.visualKeys || []) assert.ok(visualKeys.has(key), `${p.id}/${eq.id}: visual ${key} tidak punya kartu`);
    }
    for (const [key, def] of Object.entries(p.params)) {
      assert.ok(def.label && def.source, `${p.id}.${key}: label & sumber wajib`);
      assert.ok(p.equipment.some(eq => eq.params.includes(key)), `${p.id}.${key} tidak masuk equipment mana pun`);
    }
    for (const a of [...p.accounts, ...(p.accountIncludes || [])]) assert.equal(a, a.toLowerCase().trim(), `${p.id}: akun ${a} harus huruf kecil`);
    assert.ok(p.accounts.length || p.accountIncludes?.length, `${p.id}: tanpa akun`);
  }
});

test('teks yang dicetak ke PDF hanya memakai karakter WinAnsi dan tanpa kata terlarang ekspor', () => {
  const winAnsiExtra = new Set([...'–—‘’“”•…€']);
  const banned = ['Info', 'Belum Dapat Dinilai', 'Dinilai dari tren', 'Proyeksi', 'proyeksi', 'Baseline', 'predictive sebelumnya', 'AI'];
  for (const p of PM_PREDICTIVE_PROFILES) {
    const texts = [p.unitType, ...Object.values(p.params).flatMap(d => [d.label, d.unit, d.source]), ...p.equipment.flatMap(e => [e.name, e.role])];
    for (const t of texts) {
      for (const ch of t) assert.ok(ch.charCodeAt(0) <= 0xff || winAnsiExtra.has(ch), `${p.id}: karakter "${ch}" tidak tercetak di font PDF: ${t}`);
      for (const b of banned) assert.ok(!t.includes(b), `${p.id}: "${b}" dalam "${t}"`);
    }
  }
});

test('kartu template tiap akun terpetakan ke parameter yang benar', () => {
  const V = ['v_ng', 'v_rn', 'v_rs', 'v_rt', 'v_sn', 'v_st', 'v_tn'];
  const I3 = ['i_r', 'i_s', 'i_t'];
  const I4 = [...I3, 'i_n'];
  const cases = [
    ['ats@gmail.com', REPORT_TEMPLATES['ats@gmail.com'], [...V, ...I4, 'earth', 'kw', 'thermal']],
    ['trafo@gmail.com', REPORT_TEMPLATES['trafo@gmail.com'], [...V, ...I4, 'earth', 'kw', 'noise', 'thermal']],
    ['ldbrdb@gmail.com', REPORT_TEMPLATES['ldbrdb@gmail.com'], [...V, ...I4, 'earth', 'kw', 'pf', 'thermal']],
    ['lv@gmail.com', LV_ATS_TRAFO_TEMPLATE('lv@gmail.com'), [...I4, 'earth', 'thermal', 'v_ll', 'v_ln', 'v_ng']],
    ['mv@gmail.com', REPORT_TEMPLATES['mv@gmail.com'], ['earth', 'frequency', 'i_mv', 'thermal', 'v_ll_mv', 'v_ln_mv']],
    ['pdu@gmail.com', REPORT_TEMPLATES['pdu@gmail.com'], [...V, ...I4, 'earth', 'kw', 'noise', 'pf', 't_isotrans', 'thermal']],
    ['capacitorbank@gmail.com', REPORT_TEMPLATES['capacitorbank@gmail.com'], [...V, ...I4, 'capacitance', 'earth', 'thd_v', 'thermal']],
    ['busduct@gmail.com', REPORT_TEMPLATES['busduct@gmail.com'], ['thermal']],
    ['generator@gmail.com', REPORT_TEMPLATES['generator@gmail.com'], ['earth', 'noise', 'v_batt', 'v_charge', 'vibration']],
    ['pump@gmail.com', REPORT_TEMPLATES['pump@gmail.com'], [...V, ...I4, 'earth', 'temperature', 'vibration']],
    ['coolingtower@gmail.com', REPORT_TEMPLATES['coolingtower@gmail.com'], ['airflow', 'p_pipe', 'rpm', 't_motor', 'temperature', 'v_rn']],
    ['crac@gmail.com', REPORT_TEMPLATES['crac@gmail.com'], ['airflow', 'earth', 'i_1', 'temperature', 'v_ll', 'v_ln', 'vibration']],
    ['vrv@gmail.com', VRV_TEMPLATE.indoor, ['airflow', 'humidity', 'i_1', 'noise', 'temperature', 'v_1', 'vibration']],
    ['vrv@gmail.com', VRV_TEMPLATE.outdoor, [...V, ...I3, 'p_discharge', 'p_suction']],
    ['ahu@gmail.com', AHHU_TEMPLATE.indoor, [...V, ...I3, 'airflow', 'humidity', 'noise', 'temperature', 'vibration']],
    ['ahu@gmail.com', AHHU_TEMPLATE.outdoor, [...V, ...I3, 'p_suction']],
    ['acsplit@gmail.com', REPORT_TEMPLATES['acsplit@gmail.com'], ['i_1', 'p_refrigerant', 'temperature', 'v_1']],
    ['exaustfan@utt.com', REPORT_TEMPLATES['exaustfan@utt.com'], [...V, ...I4, 'airflow', 'vibration']],
    ['dockleveler@gmail.com', REPORT_TEMPLATES['dockleveler@gmail.com'], [...V, ...I3, 'noise']],
    ['door@gmail.com', REPORT_TEMPLATES['door@gmail.com'], [...V, ...I3, 'earth', 'noise']],
    ['gate@gmail.com', REPORT_TEMPLATES['gate@gmail.com'], ['i_1', 'v_1']],
    ['pju@gmail.com', REPORT_TEMPLATES['pju@gmail.com'], ['lux', 'v_batt1', 'v_batt2', 'v_batt_total', 'v_solar']],
    ['lightingsystem@gmail.com', REPORT_TEMPLATES['lightingsystem@gmail.com'], ['i_1', 'v_1']],
    ['lps@gmail.com', REPORT_TEMPLATES['lps@gmail.com'], ['earth']],
    ['grounding@gmail.com', REPORT_TEMPLATES['grounding@gmail.com'], ['earth']],
    ['wld@gmail.com', REPORT_TEMPLATES['wld@gmail.com'], []],
    ['fld@gmail.com', REPORT_TEMPLATES['fld@gmail.com'], []],
  ];
  for (const [account, labels, want] of cases) {
    assert.deepEqual(measuredParams(resolvePmProfile(account), labels), [...want].sort(), account);
  }
});

test('kartu pekerjaan (cleaning/tightening) tidak pernah dibaca sebagai alat ukur', () => {
  const templates = { ...REPORT_TEMPLATES, 'vrv@gmail.com': [...VRV_TEMPLATE.indoor, ...VRV_TEMPLATE.outdoor] };
  for (const [account, labels] of Object.entries(templates)) {
    const profile = resolvePmProfile(account);
    if (!profile) continue;
    for (const plan of planCards(profile, photosOf(labels))) {
      if (/^\s*(cleaning|clening|tightening|tigtening|lubrication|lubricant|pelumasan)/i.test(plan.photo.description)) {
        assert.notEqual(plan.kind, 'measurement', `${account}: "${plan.photo.description}"`);
      }
    }
  }
  const pju = byId('pju');
  assert.equal(matchCard(pju, 'Cleaning Solar Cell')?.visualKey, 'solar');
  assert.equal(matchCard(pju, 'Check Tegangan Solar Cell')?.param, 'v_solar');
});

test('kartu paling persis dipakai bila beberapa kartu cocok ke parameter yang sama', () => {
  const plans = planCards(byId('capacitorbank'), photosOf(['Inspection capacitance values with capacitance meter', 'Capacitance Measurement (uF)']));
  assert.deepEqual(plans.map(p => p.kind), ['visual', 'measurement']);
  const fcuDup = planCards(PM_PREDICTIVE_PROFILES[0], photosOf(['R-S', 'R-S']));
  assert.deepEqual(fcuDup.map(p => p.kind), ['measurement', 'visual'], 'label sama: kartu pertama');
});

test('FSS: kata kunci paling spesifik menang, batas tabung NFPA 2001', () => {
  const fss = byId('fss');
  const plans = planCards(fss, photosOf(['Check Pressure Switch', 'Check Pressure Cylinder FM200', 'Tegangan Baterai Panel', 'Cleaning Nozzle']));
  assert.deepEqual(plans.map(p => (p.kind === 'measurement' ? p.param : p.kind)), ['visual', 'p_cylinder', 'v_batt', 'visual']);
  const base = [{ date: '2026-04-10', value: 42, reportId: 'q2' }];
  assert.equal(at(fss, 'p_cylinder', 41, {}, base).status, 'normal', 'turun 2.4%');
  assert.equal(at(fss, 'p_cylinder', 39.5, {}, base).status, 'watch', 'turun 6%');
  assert.equal(at(fss, 'p_cylinder', 37, {}, base).status, 'warning', 'turun 11.9%');
  assert.equal(at(fss, 'agent_weight', 47, {}, [{ date: '2026-04-10', value: 50, reportId: 'q2' }]).status, 'warning', 'berat agen turun 6%');
  assert.equal(convertToCanonical(110, 'lb', 'kg').value, 49.8951);
  assert.equal(resolvePmProfile('someone@x.com', 'PM FSS & VESDA Data Hall')?.id, 'fss');
});

test('Water Softener: kartu bebas terpetakan, batas NSF/ANSI 44 & Permenkes 2/2023', () => {
  const ws = byId('watersoftener');
  const labels = [
    'Check Hardness Inlet', 'Check Hardness Outlet', 'TDS Outlet', 'pH Air', 'Pressure Inlet', 'Pressure Gauge Outlet',
    'Cleaning Brine Tank', 'Kondisi Tangki Resin', 'Control Valve', 'Check Kebocoran Pipa',
  ];
  const photos = photosOf(labels);
  const plans = planCards(ws, photos);
  assert.deepEqual(plans.map(p => (p.kind === 'measurement' ? p.param : p.visualKey)),
    ['hardness_in', 'hardness_out', 'tds', 'ph', 'p_supply', 'p_return', 'brine', 'resin', 'valve', 'piping']);
  assert.equal(matchCard(ws, 'Kesadahan Air Baku')?.param, 'hardness_in');
  assert.equal(matchCard(ws, 'Test Kesadahan')?.param, 'hardness_out');
  assert.equal(matchCard(ws, 'Tekanan Keluar')?.param, 'p_return');

  assert.equal(at(ws, 'hardness_out', 5).status, 'normal');
  assert.equal(at(ws, 'hardness_out', 25).status, 'warning', 'tembus 1 gpg');
  assert.equal(at(ws, 'hardness_out', 85).status, 'alarm', 'bukan air lunak');
  assert.equal(at(ws, 'ph', 7.2).status, 'normal');
  assert.equal(at(ws, 'ph', 9.1).status, 'warning');
  assert.equal(at(ws, 'ph', 6.1).status, 'warning');
  assert.equal(at(ws, 'ph', 7.2).limitText, 'Normal 6.5-8.5 pH; peringatan <6.5 atau >8.5 pH', 'batas bawah ikut tercetak');
  assert.equal(at(byId('acsplit'), 'p_refrigerant', 130).limitText, 'Normal 115-145 psi; peringatan <115 atau >145 psi');
  assert.equal(at(byId('crac'), 'humidity', 50).limitText, 'Normal 20-60 %RH; pantau >60 %RH; peringatan <20 atau >70 %RH; kritis <8 atau >80 %RH');
  assert.equal(convertToCanonical(2, 'gpg', 'mg/L').value, 34.2);
  assert.equal(convertToCanonical(120, 'ppm', 'mg/L').value, 120);
  assert.equal(convertToCanonical(7.4, 'pH', 'pH').value, 7.4);
  assert.equal(convertToCanonical(7.4, 'V', 'pH').value, null);

  const values = { 1: 180, 2: 8, 3: 210, 4: 7.4, 5: 3.4, 6: 3.0 };
  const results = photos.map(p => (values[p.index] !== undefined
    ? { index: p.index, value: values[p.index], unit: p.index <= 3 ? 'ppm' : '', confidence: 'tinggi' }
    : { index: p.index, value: null, confidence: 'tinggi', condition: 'baik', observation: 'Kondisi baik' }));
  const analysis = composeAnalysis(ws, applyExtraction(initDraft(plans, 'pending'), ws, results, []), null, '2026-07-20', 'pm-ws');
  assert.ok(!('error' in analysis), analysis.error);
  assert.deepEqual(analysis.sections.map(s => s.id), ['softening', 'quality', 'regeneration']);
  const pDiff = analysis.sections[0].params.find(p => p.param === 'p_diff');
  assert.equal(pDiff.value, 0.4);
  assert.equal(pDiff.status, 'normal');
  assert.equal(analysis.sections[2].visuals.length, 3);
});

test('panel: tegangan SNI/ITIC, arus terhadap In nameplate, pembumian, thermal', () => {
  const ats = byId('ats');
  assert.equal(at(ats, 'v_rs', 395).status, 'normal');
  assert.equal(at(ats, 'v_rs', 430).status, 'warning');
  assert.equal(at(ats, 'v_rs', 445).status, 'alarm');
  assert.equal(at(ats, 'v_rs', 355).status, 'alarm');
  assert.equal(at(ats, 'v_rs', 395).limitText, 'Normal 360-420 V (nominal 400 V +5%/-10%); kritis di luar 360-440 V (nominal 400 V ±10%)');
  assert.equal(at(ats, 'i_r', 450, { ratedCurrent: 630 }).status, 'normal');
  assert.equal(at(ats, 'i_r', 520, { ratedCurrent: 630 }).status, 'warning', '82.5% In');
  assert.equal(at(ats, 'i_r', 640, { ratedCurrent: 630 }).status, 'alarm');
  assert.equal(at(ats, 'i_r', 450, { ratedCurrent: 630 }).limitText, 'peringatan >504 A; kritis >630 A (In nameplate 630 A)');
  assert.equal(at(ats, 'v_ng', 1.2).status, 'normal');
  assert.equal(at(ats, 'v_ng', 3).status, 'watch');
  assert.equal(at(ats, 'earth', 2.1).status, 'normal');
  assert.equal(at(ats, 'earth', 6).status, 'warning');
  assert.equal(at(ats, 'thermal', 38).status, 'normal');
  assert.equal(at(ats, 'thermal', 45).status, 'warning');
  assert.equal(at(ats, 'thermal', 75).status, 'alarm');
  assert.equal(at(byId('lps'), 'earth', 8).status, 'normal', 'LPS memakai batas 10 ohm');
});

test('getaran ISO 10816-1: kelas dari daya nameplate, cadangan kelas profil', () => {
  const pump = byId('pump');
  assert.equal(at(pump, 'vibration', 2.5).status, 'normal', 'tanpa nameplate: kelas II (pompa)');
  assert.equal(at(pump, 'vibration', 2.5, { ratedPowerKw: 11 }).status, 'warning', '11 kW = kelas I');
  assert.equal(at(pump, 'vibration', 7.5, { ratedPowerKw: 37 }).status, 'alarm');
  assert.equal(at(pump, 'vibration', 7.5, { ratedPowerKw: 90 }).status, 'warning', '90 kW = kelas III');
  assert.equal(at(pump, 'vibration', 2.5, { ratedPowerKw: 37 }).limitText, 'ISO 10816-1 kelas II (daya nameplate 37 kW): peringatan >2.8 mm/s; kritis >7.1 mm/s');
  assert.equal(at(byId('exhaustfan'), 'vibration', 1).limitText, 'ISO 10816-1 kelas I: peringatan >1.8 mm/s; kritis >4.5 mm/s', 'tanpa tulisan "nameplate tidak tersedia"');
});

test('setiap parameter berangka selalu punya status, juga tanpa nameplate dan tanpa riwayat', () => {
  for (const p of PM_PREDICTIVE_PROFILES) {
    for (const [key, def] of Object.entries(p.params)) {
      const r = at(p, key, 1);
      assert.notEqual(r.status, 'unknown', `${p.id}.${key} (${def.label})`);
      assert.ok(r.limitText, `${p.id}.${key}: batas acuan kosong`);
    }
  }
  const ldb = byId('ldbrdb');
  assert.equal(at(ldb, 'i_n', 35).limitText, 'Pengukuran pertama menjadi acuan; berubah >20% pada pengukuran berikutnya = pantau');
  assert.equal(at(ldb, 'i_n', 50, {}, [{ date: '2026-04-10', value: 35, reportId: 'q2' }]).status, 'warning', 'arus netral naik 43% dari acuan awal');
  assert.equal(at(ldb, 'i_n', 40, {}, [{ date: '2026-04-10', value: 35, reportId: 'q2' }]).status, 'normal', 'naik 14%');
});

test('aturan baseline & batas bawah: baterai, getaran genset, lux, faktor daya, frekuensi', () => {
  const genset = byId('genset');
  const base = [{ date: '2026-04-10', value: 27.0, reportId: 'q2' }];
  assert.equal(at(genset, 'v_batt', 26.6, {}, base).status, 'normal', 'turun 1.5%');
  assert.equal(at(genset, 'v_batt', 26.3, {}, base).status, 'watch', 'turun 2.6%');
  assert.equal(at(genset, 'v_batt', 25.5, {}, base).status, 'alarm', 'turun 5.6%');
  assert.match(at(genset, 'v_batt', 27.1).note, /baseline/i);
  const vib = [{ date: '2026-04-10', value: 10, reportId: 'q2' }];
  assert.equal(at(genset, 'vibration', 12, {}, vib).status, 'normal');
  assert.equal(at(genset, 'vibration', 13, {}, vib).status, 'watch');
  assert.equal(at(genset, 'vibration', 16, {}, vib).status, 'warning');
  assert.equal(at(genset, 'vibration', 13, {}, vib).limitText, 'Naik >25% dari acuan awal 10 mm/s = pantau; >50% = peringatan');
  assert.equal(at(byId('pju'), 'lux', 65, {}, [{ date: '2026-04-10', value: 100, reportId: 'q2' }]).status, 'warning');
  const ldb = byId('ldbrdb');
  assert.equal(at(ldb, 'pf', 0.92).status, 'normal');
  assert.equal(at(ldb, 'pf', 0.8).status, 'warning');
  assert.equal(at(ldb, 'pf', 0.92).limitText, 'peringatan <0.85 PF');
  const mv = byId('mv');
  assert.equal(at(mv, 'frequency', 50.1).status, 'normal');
  assert.equal(at(mv, 'frequency', 49.6).status, 'warning');
  assert.equal(at(mv, 'frequency', 50).limitText, 'Normal 49.8-50.2 Hz (nominal 50 Hz ±0.4%)');
  assert.equal(at(mv, 'v_ll_mv', 20.4).status, 'normal');
  assert.equal(at(mv, 'v_ll_mv', 21.5).status, 'warning');
  assert.equal(at(byId('acsplit'), 'p_refrigerant', 130).status, 'normal');
  assert.equal(at(byId('acsplit'), 'p_refrigerant', 100).status, 'warning');
  assert.equal(at(byId('xray'), 'radiation', 0.2).status, 'normal');
  assert.equal(at(byId('xray'), 'radiation', 6).status, 'warning');
});

test('konversi satuan baru', () => {
  assert.equal(convertToCanonical(2.1, 'Ω', 'ohm').value, 2.1);
  assert.equal(convertToCanonical(2.1, 'ꭥ', 'ohm').value, 2.1);
  assert.equal(convertToCanonical(1.2, 'kΩ', 'ohm').value, 1200);
  assert.equal(convertToCanonical(8.5, 'bar', 'psi').value, 123.2823);
  assert.equal(convertToCanonical(20400, 'V', 'kV').value, 20.4);
  assert.equal(convertToCanonical(0.05, 'mR/h', 'µSv/h').value, 0.5);
  assert.equal(convertToCanonical(47, 'uF', 'µF').value, 47);
  assert.equal(convertToCanonical(0.92, '', 'PF').value, 0.92);
  assert.equal(convertToCanonical(2.1, 'MΩ', 'ohm').value, null, 'mega/mili ohm tidak ditebak');
});

test('alur lengkap akun ATS: foto -> draf -> analisis -> dokumen & teks ekspor', () => {
  const ats = byId('ats');
  const labels = REPORT_TEMPLATES['ats@gmail.com'];
  const values = {
    'Measurement Voltage R - S': 401, 'Measurement Voltage S - T': 399, 'Measurement Voltage T - R': 403,
    'Measurement Voltage R - N': 231, 'Measurement Voltage S - N': 230, 'Measurement Voltage T - N': 232, 'Measurement Voltage N - G': 1.1,
    'Measurement Ampere R': 410, 'Measurement Ampere S': 395, 'Measurement Ampere T': 420, 'Measurement Ampere N': 35,
    'Measurement Daya DPM': 280, 'Check Thermal Imager': 36.5, 'Measurement Grounding': 1.8,
  };
  const photos = photosOf(labels);
  const results = photos.map(p => (p.description in values
    ? { index: p.index, value: values[p.description], unit: p.description === 'Measurement Grounding' ? 'Ω' : '', confidence: 'tinggi' }
    : { index: p.index, value: null, confidence: 'tinggi', condition: 'baik', observation: 'Panel bersih' }));
  const draft = applyExtraction(initDraft(planCards(ats, photos), 'pending'), ats, results, []);
  const analysis = composeAnalysis(ats, draft, null, '2026-07-10', 'pm-ats');
  assert.ok(!('error' in analysis), analysis.error);
  assert.deepEqual(analysis.sections.map(s => s.id), ['power', 'load', 'conn', 'other']);
  const sections = analysis.sections.map(s => ({ ...s, narrative: { kondisi: 'ok', analisisTren: 'ok', prediksiRisiko: 'ok', rekomendasi: ['ok'] }, narrativeSource: 'ai' }));
  const report = buildPmReport({
    profile: ats, src: { id: 'pm-ats', maintenanceName: 'PM ATS Q3', maintenanceTime: '2026-07-10', specificDetail: 'ATS-01', createdBy: 'ats@gmail.com' },
    unitLabel: 'ATS-01', maintenanceDate: '2026-07-10', analysis, sections, summary: { ringkasan: 'ok', prioritas: [], source: 'ai' }, previous: null, generatedBy: 'ats@gmail.com',
  });
  assert.equal(report.profileId, 'ats');
  assert.equal(report.unitKey, 'ats@gmail.com|ats1');
  assert.equal(report.overallStatus, 'normal');
  const conn = report.sections.find(s => s.id === 'conn');
  assert.deepEqual(exportParams(conn).map(p => paramRowText(p).value), ['36.5 °C', '1.8 ohm']);
  assert.ok(limitSourceRows([report]).some(([labels, source]) => labels.includes('Resistans pembumian') && source.includes('5 ohm')));
  assert.equal(nameplateText(report), '', 'nameplate tidak terbaca: baris nameplate tidak dicetak');
  assert.match(sectionStatusLines(report), /Suplai Tegangan ATS: Normal/);
  for (const s of report.sections) {
    for (const p of exportParams(s)) assert.notEqual(paramRowText(p).statusText, '-', `${s.id}.${p.param} tanpa status`);
  }
  const load = report.sections.find(s => s.id === 'load');
  assert.match(paramRowText(exportParams(load).find(p => p.param === 'i_t')).limit, /^Rata-rata 3 fasa 408.33 A: Normal/, 'tanpa In nameplate: dinilai dari keseimbangan fasa');
});
