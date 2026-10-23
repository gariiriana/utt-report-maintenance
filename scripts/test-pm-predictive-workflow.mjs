// Uji alur Predictive Report dari laporan PM yang dipakai bersama generate satu laporan
// dan generate per quarter (pmPredictiveWorkflow.ts), serta teks ekspor dokumen
// (pmPredictiveExportShared.ts). Jalankan: node --test scripts/test-pm-predictive-workflow.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quarterFromText, detectQuarter, quarterLabel, quarterMonthsText, maintenanceDateOf, planCards, initDraft,
  applyExtraction, composeAnalysis, buildPmReport, draftStats, latestEarlier, normalizeReport,
} from '../frontend/utils/pmPredictiveWorkflow.ts';
import {
  METHOD_TEXT, paramRowText, exportParams, hasComparison, nameplateText, sectionStatusLines, limitSourceRows, attentionText,
} from '../frontend/utils/pmPredictiveExportShared.ts';
import { PM_PREDICTIVE_PROFILES } from '../frontend/config/pmPredictiveProfiles.ts';

const fcu = PM_PREDICTIVE_PROFILES.find(p => p.id === 'fcu');

test('quarter dari nama laporan diutamakan, cadangan bulan PM', () => {
  assert.equal(quarterFromText('PM FCU Q2 2026'), 2);
  assert.equal(quarterFromText('Maintenance Triwulan II'), 2);
  assert.equal(quarterFromText('Kuartal 3 - 2025'), 3);
  assert.equal(quarterFromText('PM_FCU_TW-4.pdf'), 4);
  assert.equal(quarterFromText('Quarter 1'), 1);
  assert.equal(quarterFromText('FCU Q12 Lt 3'), null, 'Q12 bukan quarter');
  assert.equal(quarterFromText('AQ2 Tower'), null, 'harus kata tersendiri');
  assert.equal(quarterFromText('Maintenance Bulanan'), null);

  assert.deepEqual(detectQuarter({ maintenanceName: 'PM FCU Q2 2026', maintenanceTime: '2026-07-03' }), { year: 2026, quarter: 2 }, 'PM Q2 yang dikerjakan awal Juli tetap Q2');
  assert.deepEqual(detectQuarter({ maintenanceName: 'Maintenance FCU', maintenanceTime: '12/05/2026' }), { year: 2026, quarter: 2 });
  assert.deepEqual(detectQuarter({ maintenanceName: 'Maintenance FCU', maintenanceTime: '2026-10-01 - 2026-10-02' }), { year: 2026, quarter: 4 });
  assert.deepEqual(detectQuarter({ maintenanceName: 'PM Q1', fileName: 'PM_Q1_2027.pdf', maintenanceTime: '2026-12-30' }), { year: 2027, quarter: 1 });
  assert.equal(quarterLabel({ year: 2026, quarter: 2 }), 'Q2 2026');
  assert.equal(quarterMonthsText({ year: 2026, quarter: 2 }), 'April - Juni 2026');
  assert.equal(maintenanceDateOf({ maintenanceTime: '3/4/2026' }), '2026-04-03');
});

// Foto kartu template FCU + hasil baca AI tiruan.
const photos = [
  ['R-S', 401], ['R-T', 399], ['S-T', 400], ['R-N', 231], ['S-N', 230], ['T-N', 229],
  ['Current R', 2.7], ['Current S', 2.7], ['Current T', 2.7], ['Checking Vibration', 1.1], ['Checking Air Flow', 3.0],
  ['Checking Humidity', 55], ['Checking Noise', 62], ['Pressure Supply', 3.1], ['Pressure Return', 2.7],
  ['Checking Temperature', 22.5], ['Nameplate', null], ['Cleaning evaporator', null],
].map(([description], i) => ({ index: i + 1, description, photoBase64: 'data:image/jpeg;base64,AAAA' }));
const readings = Object.fromEntries([
  ['R-S', 401], ['R-T', 399], ['S-T', 400], ['R-N', 231], ['S-N', 230], ['T-N', 229],
  ['Current R', 2.7], ['Current S', 2.7], ['Current T', 2.7], ['Checking Vibration', 1.1], ['Checking Air Flow', 3.0],
  ['Checking Humidity', 55], ['Checking Noise', 62], ['Pressure Supply', 3.1], ['Pressure Return', 2.7], ['Checking Temperature', 22.5],
]);

function aiResults(scale = 1) {
  return photos.map(p => {
    if (p.description === 'Nameplate') return { index: p.index, value: null, confidence: 'tinggi', nameplate: { brand: 'Daikin', model: 'FWW', ratedVoltage: null, ratedCurrent: null, ratedPowerKw: null, phase: 3, frequencyHz: 50 } };
    if (p.description === 'Cleaning evaporator') return { index: p.index, value: null, confidence: 'tinggi', condition: 'baik', observation: 'Coil bersih' };
    return { index: p.index, value: Number((readings[p.description] * scale).toFixed(2)), unit: '', confidence: 'tinggi' };
  });
}

const src = (id, date, unit = 'FCU-01 Lt.2') => ({ id, maintenanceName: `PM FCU ${unit}`, maintenanceTime: date, specificDetail: unit, createdBy: 'FCU@gmail.com ' });

function generate(id, date, previous, scale = 1, failed = []) {
  const plans = planCards(fcu, photos);
  let draft = initDraft(plans, 'pending');
  draft = applyExtraction(draft, fcu, aiResults(scale).filter(r => !failed.includes(r.index)), failed);
  const analysis = composeAnalysis(fcu, draft, previous, date, id);
  assert.ok(!('error' in analysis), analysis.error);
  const sections = analysis.sections.map(s => ({ ...s, narrative: { kondisi: 'ok', analisisTren: 'ok', prediksiRisiko: 'ok', rekomendasi: ['ok'] }, narrativeSource: 'ai' }));
  return {
    draft,
    report: buildPmReport({
      profile: fcu, src: src(id, date), unitLabel: ' FCU-01 Lt.2 ', maintenanceDate: date, analysis, sections,
      summary: { ringkasan: 'ok', prioritas: [], source: 'ai' }, previous, generatedBy: 'fcu@gmail.com',
    }),
  };
}

test('alur foto -> draf -> analisis -> dokumen sama untuk satu laporan maupun per quarter', () => {
  const { draft, report } = generate('pm-q2', '2026-05-12', null);
  const stats = draftStats(fcu, draft);
  assert.equal(stats.invalidInputs, 0);
  assert.equal(stats.pendingRows, 0);
  assert.deepEqual(stats.included.map(g => g.id), ['power', 'fan_motor', 'chw', 'air']);
  assert.equal(report.account, 'fcu@gmail.com');
  assert.equal(report.unitKey, 'fcu@gmail.com|fcu1lt2');
  assert.equal(report.unitLabel, 'FCU-01 Lt.2');
  assert.equal(report.reportNumber, 'PDM-PM/DME-NDC/2026/05/M-Q2');
  assert.equal(report.nameplate.brand, 'Daikin');
  assert.equal(report.previousReportId, null);
  assert.equal(report.signatures.preparedBy.name, 'Asep Mohammad Fauzi');
  assert.notEqual(report.overallStatus, 'unknown');
});

test('foto gagal dibaca ditandai untuk diisi manual', () => {
  const plans = planCards(fcu, photos);
  const draft = applyExtraction(initDraft(plans, 'pending'), fcu, aiResults().filter(r => r.index !== 10), [10]);
  const stats = draftStats(fcu, draft);
  assert.deepEqual([...stats.failedIndexes], [10]);
  assert.equal(stats.pendingRows, 1);
});

test('riwayat quarter tersambung: Q3 memakai Q2 sebagai pembanding', () => {
  const q2 = generate('pm-q2', '2026-05-12', null).report;
  const q3 = generate('pm-q3', '2026-08-10', q2, 0.9).report;
  assert.equal(q3.previousReportId, 'pm-q2');
  assert.equal(q3.previousMaintenanceDate, '2026-05-12');
  assert.deepEqual(q3.history.airflow.map(p => p.reportId), ['pm-q2', 'pm-q3']);
  assert.equal(hasComparison(q2), false, 'laporan pertama tanpa kolom Sebelumnya/Perubahan');
  assert.equal(hasComparison(q3), true);
  assert.equal(latestEarlier([q2, q3, null], '2026-09-01')?.id, 'pm-q3');
  assert.equal(latestEarlier([q3], '2026-08-10'), null, 'tanggal sama bukan pembanding');
});

test('teks ekspor: tanpa Info, Belum Dapat Dinilai, Proyeksi, akun, atau baseline', () => {
  const report = generate('pm-q2', '2026-05-12', null).report;
  const fan = report.sections.find(s => s.id === 'fan_motor');
  const printed = exportParams(fan);
  assert.ok(!printed.some(p => p.param === 'i_load_pct'), 'beban %FLA tanpa nameplate FLA tidak dicetak');
  const phaseR = paramRowText(printed.find(p => p.param === 'i_r'));
  assert.deepEqual([phaseR.value, phaseR.previous, phaseR.change, phaseR.statusText], ['2.7 A', '-', '-', 'Normal'], 'tanpa FLA: dinilai dari keseimbangan antar fasa');
  assert.match(phaseR.limit, /^Rata-rata 3 fasa 2.7 A: Normal /);
  const unbalance = paramRowText(printed.find(p => p.param === 'i_unbalance'));
  assert.equal(unbalance.statusText, 'Normal');
  assert.ok(!('projection' in phaseR));
  for (const s of report.sections) {
    for (const p of exportParams(s)) assert.notEqual(paramRowText(p).statusText, '-', `${s.id}.${p.param} tanpa status`);
  }

  const allText = [
    METHOD_TEXT, nameplateText(report), sectionStatusLines(report), attentionText(report),
    ...report.sections.flatMap(s => exportParams(s).map(p => Object.values(paramRowText(p)).join(' '))),
    ...limitSourceRows([report]).flat(),
  ].join('\n');
  for (const banned of ['Info', 'Belum Dapat Dinilai', 'Dinilai dari tren', 'Proyeksi', 'proyeksi', 'fcu@gmail.com', 'Baseline', 'predictive sebelumnya', 'AI']) {
    assert.ok(!allText.includes(banned), `teks ekspor tidak boleh memuat "${banned}"`);
  }
  assert.equal(nameplateText({ ...report, nameplate: { ...report.nameplate, source: 'predictive sebelumnya' } }), 'Daikin FWW | 3 fasa | 50 Hz');
  assert.equal(nameplateText({ ...report, nameplate: { source: 'foto' } }), '', 'nameplate tidak terbaca: tanpa baris nameplate');
});

test('predictive lama dinormalisasi: status arus fasa terisi, narasi tanpa "mungkin" dan tanpa kalimat riwayat kosong', () => {
  const fresh = generate('pm-q2', '2026-05-12', null).report;
  // Bentuk dokumen sebelum perbaikan: arus fasa tanpa status, narasi AI dengan kata ragu.
  const old = {
    ...fresh,
    sections: fresh.sections.map(s => ({
      ...s,
      params: s.params.map(p => (['i_r', 'i_s', 'i_t', 'p_supply', 'p_return'].includes(p.param) ? { ...p, status: 'unknown', limitText: 'Dinilai dari tren' } : p)),
      narrative: {
        kondisi: 'Kondisi motor kemungkinan baik.',
        analisisTren: 'Pengukuran ini menjadi acuan awal tren unit.',
        prediksiRisiko: 'Proyeksi waktu untuk mencapai batas kritis tidak tersedia karena keterbatasan titik data historis. Namun, mode kegagalan yang mungkin terjadi adalah keausan bearing.',
        rekomendasi: ['Periksa bearing sesegera mungkin.', ''],
      },
    })),
    summary: { ringkasan: 'Unit dalam kondisi baik. Tidak terdapat proyeksi karena data historis belum tersedia.', prioritas: ['Pantau getaran.'], source: 'ai' },
  };
  const n = normalizeReport(old);
  const params = n.sections.flatMap(s => s.params);
  for (const key of ['i_r', 'i_s', 'i_t', 'p_supply', 'p_return']) {
    const p = params.find(x => x.param === key);
    assert.equal(p.status, 'normal', key);
    assert.notEqual(p.limitText, 'Dinilai dari tren', key);
  }
  const fan = n.sections.find(s => s.id === 'fan_motor');
  assert.deepEqual(fan.narrative, {
    kondisi: 'Kondisi motor terindikasi baik.',
    analisisTren: 'Pengukuran ini menjadi acuan awal tren unit.',
    prediksiRisiko: 'Mode kegagalan yang dapat terjadi adalah keausan bearing.',
    rekomendasi: ['Periksa bearing segera.'],
  });
  assert.equal(n.summary.ringkasan, 'Unit dalam kondisi baik.');
  assert.equal(n.summary.source, 'ai');
  assert.ok(!JSON.stringify(n).match(/mungkin|kemungkinan/i));
  assert.deepEqual(normalizeReport(n), n, 'aman dipanggil berulang');
});

test('dasar batas acuan gabungan: satu baris per sumber untuk banyak laporan', () => {
  const a = generate('pm-a', '2026-05-12', null).report;
  const b = generate('pm-b', '2026-05-13', null).report;
  const rows = limitSourceRows([a, b]);
  const voltage = rows.filter(([labels]) => labels.includes('Tegangan R-S'));
  assert.equal(voltage.length, 1);
  assert.equal(voltage[0][0].split(', ').filter(l => l === 'Tegangan R-S').length, 1, 'label tidak terulang');
  assert.deepEqual(rows, limitSourceRows([a]));
});
