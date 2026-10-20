// Uji mesin hitung Predictive Report dari laporan PM (pmPredictiveEngine.ts).
// Jalankan: node --test scripts/test-pm-predictive-engine.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchCard, unitKeyOf, convertToCanonical, computeDerived, mergeHistory,
  evaluateParam, buildSections, worstStatus, fallbackNarrative, fallbackSummary,
} from '../frontend/utils/pmPredictiveEngine.ts';
import { resolvePmProfile, PM_PREDICTIVE_PROFILES } from '../frontend/config/pmPredictiveProfiles.ts';

const fcu = PM_PREDICTIVE_PROFILES.find(p => p.id === 'fcu');

test('profil FCU dipilih dari akun atau nama maintenance', () => {
  assert.equal(resolvePmProfile('FCU@gmail.com ')?.id, 'fcu');
  assert.equal(resolvePmProfile('someone@x.com', 'Maintenance FCU Lantai 2')?.id, 'fcu');
  assert.equal(resolvePmProfile('ups@gmail.com', 'Maintenance UPS'), null);
});

test('semua kartu template FCU terpetakan', () => {
  const template = ['R-S', 'R-T', 'S-T', 'R-N', 'S-N', 'T-N', 'Current R', 'Current S', 'Current T',
    'Checking Vibration', 'Checking Air Flow', 'Checking Humidity', 'Checking Noise', 'Pressure Supply',
    'Pressure Return', 'Checking Temperature', 'Nameplate', 'Cleaning evaporator'];
  const want = ['v_rs', 'v_rt', 'v_st', 'v_rn', 'v_sn', 'v_tn', 'i_r', 'i_s', 'i_t', 'vibration', 'airflow',
    'humidity', 'noise', 'p_supply', 'p_return', 'temperature', 'nameplate', 'visual:evaporator'];
  const got = template.map(label => {
    const m = matchCard(fcu, label);
    return m?.kind === 'measurement' ? m.param : m?.kind === 'visual' ? `visual:${m.visualKey}` : m?.kind;
  });
  assert.deepEqual(got, want);
  assert.equal(matchCard(fcu, 'Measurement Voltage R - S')?.param, 'v_rs');
  assert.equal(matchCard(fcu, 'Measurement Ampere T')?.param, 'i_t');
  assert.equal(matchCard(fcu, 'Foto bebas'), null);
});

test('kunci unit menyamakan variasi penulisan nama unit', () => {
  const a = unitKeyOf('fcu@gmail.com', 'FCU-01 Lt.2');
  assert.equal(unitKeyOf('FCU@gmail.com', 'fcu 1 lt 2'), a);
  assert.equal(unitKeyOf('fcu@gmail.com', 'FCU01 LT2'), a);
  assert.notEqual(unitKeyOf('fcu@gmail.com', 'FCU-10 Lt.2'), a);
});

test('konversi satuan ke satuan kanonik', () => {
  assert.equal(convertToCanonical(0.1, 'in/s', 'mm/s').value, 2.54);
  assert.equal(convertToCanonical(30, 'psi', 'bar').value, 2.0684);
  assert.equal(convertToCanonical(226, 'V~', 'V').value, 226);
  assert.equal(convertToCanonical(55.1, '', '%RH').value, 55.1);
  const g = convertToCanonical(0.3, 'g', 'mm/s');
  assert.equal(g.value, null);
  assert.match(g.note, /mm\/s/);
});

test('parameter turunan: ketidakseimbangan, beban FLA, selisih tekanan', () => {
  const d = computeDerived(fcu, { v_rs: 400, v_rt: 404, v_st: 396, i_r: 1.0, i_s: 1.1, i_t: 1.2, p_supply: 3.2, p_return: 2.7 }, { ratedCurrent: 1.5 });
  assert.equal(d.v_unbalance, 1);
  assert.equal(d.i_unbalance, 9.091);
  assert.equal(d.i_load_pct, 80);
  assert.equal(d.p_diff, 0.5);
  assert.equal(computeDerived(fcu, { i_r: 0.1, i_s: 0.2, i_t: 0.1 }, {}).i_unbalance, null, 'arus sangat kecil tidak dinilai');
  assert.equal(computeDerived(fcu, { i_r: 1 }, {}).i_load_pct, null, 'tanpa FLA tidak dihitung');
});

test('riwayat dibawa maju tanpa titik ganda atau titik masa depan', () => {
  const prev = { airflow: [
    { date: '2026-01-10', value: 3.0, reportId: 'q1' },
    { date: '2026-04-10', value: 2.8, reportId: 'q2' },
    { date: '2026-10-10', value: 2.5, reportId: 'q4' },
  ] };
  const h = mergeHistory(prev, { airflow: 2.6, noise: 60 }, '2026-07-10', 'q3');
  assert.deepEqual(h.airflow.map(p => p.reportId), ['q1', 'q2', 'q3']);
  assert.deepEqual(h.noise.map(p => p.value), [60]);
  const again = mergeHistory(h, { airflow: 2.65 }, '2026-07-10', 'q3');
  assert.deepEqual(again.airflow.map(p => p.value), [3.0, 2.8, 2.65]);
});

test('tegangan: peringatan dari SNI 400 V +5/-10%, kritis dari toleransi motor nameplate ±10%', () => {
  const def = fcu.params.v_rs;
  const at = (value, nameplate = {}) => evaluateParam({ param: 'v_rs', def, series: [], value, date: '2026-07-10', nameplate }).status;
  assert.equal(at(412), 'normal');
  assert.equal(at(365), 'normal', 'turun 8.75% masih dalam -10% SNI');
  assert.equal(at(425), 'warning');
  assert.equal(at(355), 'alarm', 'tanpa nameplate, -10% SNI sama dengan batas toleransi motor 400 V');
  assert.equal(at(358, { ratedVoltage: 380 }), 'warning', 'di bawah SNI tapi masih dalam toleransi motor 380 V (342-418 V)');
  assert.equal(at(445), 'alarm');
  assert.equal(at(401, { ratedVoltage: 380 }), 'normal', 'motor 380 V dengan suplai 401 V bukan peringatan');
  assert.equal(at(420, { ratedVoltage: 380 }), 'alarm', 'di atas 418 V = keluar toleransi motor 380 V');
  assert.equal(evaluateParam({ param: 'v_rn', def: fcu.params.v_rn, series: [], value: 226, date: '2026-07-10', nameplate: {} }).status, 'normal');
  const text = evaluateParam({ param: 'v_rs', def, series: [], value: 401, date: '2026-07-10', nameplate: { ratedVoltage: 380 } }).limitText;
  assert.equal(text, 'Normal 360-420 V (nominal 400 V +5%/-10%); kritis di luar 342-418 V (rating nameplate 380 V ±10%)');
});

test('tren airflow turun diproyeksikan ke batas peringatan', () => {
  const series = [
    { date: '2026-01-10', value: 3.0, reportId: 'q1' },
    { date: '2026-04-10', value: 2.8, reportId: 'q2' },
  ];
  const r = evaluateParam({ param: 'airflow', def: fcu.params.airflow, series, value: 2.6, date: '2026-07-10', nameplate: {} });
  assert.equal(r.status, 'normal', 'turun 13% dari baseline masih di bawah batas pantau 15%');
  assert.equal(r.points, 3);
  assert.equal(r.confidence, 'Sedang');
  assert.ok(r.trendPerQuarter < 0);
  assert.equal(r.projection?.level, 'warning');
  assert.equal(r.projection?.limit, 2.25);
  assert.ok(r.projection.date > '2026-07-10' && r.projection.date < '2027-01-01', r.projection.date);
});

test('baseline pertama: tanpa tren dan tanpa proyeksi', () => {
  const r = evaluateParam({ param: 'airflow', def: fcu.params.airflow, series: [], value: 3.1, date: '2026-07-10', nameplate: {} });
  assert.equal(r.status, 'normal');
  assert.equal(r.trendPerQuarter, null);
  assert.equal(r.projection, null);
  assert.match(r.note, /baseline/i);
});

test('arus per fasa dinilai terhadap FLA nameplate; tanpa FLA tidak dinilai', () => {
  const at = (value, nameplate) => evaluateParam({ param: 'i_r', def: fcu.params.i_r, series: [], value, date: '2026-07-10', nameplate });
  assert.equal(at(2.7, { ratedCurrent: 4 }).status, 'normal');
  assert.equal(at(3.5, { ratedCurrent: 4 }).status, 'watch', '87.5% FLA');
  assert.equal(at(3.7, { ratedCurrent: 4 }).status, 'warning', '92.5% FLA');
  assert.equal(at(4.2, { ratedCurrent: 4 }).status, 'alarm', 'di atas FLA');
  assert.equal(at(2.7, { ratedCurrent: 4 }).limitText, 'pantau >3.2 A; peringatan >3.6 A; kritis >4 A (FLA nameplate 4 A)');
  const noFla = at(2.7, {});
  assert.equal(noFla.status, 'unknown');
  assert.equal(noFla.limitText, '');
});

test('getaran, kebisingan, dan selisih tekanan negatif', () => {
  const vib = (v) => evaluateParam({ param: 'vibration', def: fcu.params.vibration, series: [], value: v, date: '2026-07-10', nameplate: {} }).status;
  assert.equal(vib(1.2), 'normal');
  assert.equal(vib(2.5), 'warning');
  assert.equal(vib(5), 'alarm');
  const noise = evaluateParam({ param: 'noise', def: fcu.params.noise, series: [{ date: '2026-04-10', value: 58, reportId: 'q2' }], value: 62, date: '2026-07-10', nameplate: {} });
  assert.equal(noise.status, 'watch');
  const dp = evaluateParam({ param: 'p_diff', def: fcu.params.p_diff, series: [], value: -0.2, date: '2026-07-10', nameplate: {} });
  assert.equal(dp.status, 'warning');
});

test('bagian equipment FCU lengkap dengan status terburuk dan narasi cadangan', () => {
  const values = computeDerived(fcu, {
    v_rs: 401, v_rt: 399, v_st: 400, v_rn: 231, v_sn: 230, v_tn: 229,
    i_r: 1.0, i_s: 1.3, i_t: 1.0, vibration: 2.2, noise: 60, p_supply: 3.0, p_return: 2.6,
    airflow: 2.9, temperature: 22, humidity: 55,
  }, { ratedCurrent: 2 });
  const history = mergeHistory({}, values, '2026-07-10', 'q3');
  const visuals = [{ key: 'evaporator', photoIndex: 18, cardLabel: 'Cleaning evaporator', condition: 'baik', observation: 'Bersih', aiConfidence: 'tinggi' }];
  const sections = buildSections(fcu, values, history, visuals, '2026-07-10', { ratedCurrent: 2 });
  assert.deepEqual(sections.map(s => s.id), ['power', 'fan_motor', 'chw', 'air']);
  const fan = sections.find(s => s.id === 'fan_motor');
  assert.equal(fan.status, 'warning', 'getaran 2.2 mm/s masuk zona C dan arus tak seimbang 18%');
  assert.equal(sections.find(s => s.id === 'power').status, 'normal');
  assert.equal(worstStatus(sections.map(s => s.status)), 'warning');
  for (const s of sections) s.narrative = fallbackNarrative(s);
  assert.match(fan.narrative.kondisi, /Getaran motor fan 2.2 mm\/s \(Peringatan\)/);
  assert.match(sections[0].narrative.analisisTren, /baseline/);
  const sum = fallbackSummary('FCU-01', sections);
  assert.match(sum.ringkasan, /Peringatan/);
  assert.ok(sum.prioritas.length >= 1);
});
