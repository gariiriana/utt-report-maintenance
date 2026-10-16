// Uji rekap HSE Weekly Report (hseWeeklyReport.ts + HSEWeeklyExcelExport.ts).
// Jalankan: node --test scripts/test-hse-weekly-report.mjs
process.env.TZ = 'Asia/Jakarta';

import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  getWeekRange, formatWeekLabel, toLocalYmd, buildHSEWeeklyReport,
} from '../frontend/utils/hseWeeklyReport.ts';
import { buildHSEWeeklyWorkbook, findingPhotoKey, hseWeeklyFileName } from '../frontend/utils/HSEWeeklyExcelExport.ts';

// PNG 1x1 putih sebagai foto contoh
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
const photo = (w = 640, h = 480) => ({ base64: PNG, width: w, height: h });

const week = getWeekRange('2026-10-16');

test('minggu kerja Senin–Minggu & nomor minggu ISO', () => {
  assert.equal(week.start, '2026-10-12');
  assert.equal(week.end, '2026-10-18');
  assert.equal(week.isoWeek, 42);
  assert.deepEqual(getWeekRange('2026-10-18').days, week.days);
  assert.equal(getWeekRange('2026-10-19').start, '2026-10-19');
  // Minggu yang melewati pergantian tahun ikut tahun ISO dari hari Kamis
  const ny = getWeekRange('2027-01-01');
  assert.equal(ny.start, '2026-12-28');
  assert.equal(ny.isoWeek, 53);
  assert.equal(ny.isoYear, 2026);
  assert.equal(formatWeekLabel(week), '12 – 18 Okt 2026');
  assert.equal(formatWeekLabel(getWeekRange('2026-10-01')), '28 Sep – 4 Okt 2026');
  assert.equal(formatWeekLabel(ny), '28 Des 2026 – 3 Jan 2027');
});

test('tanggal ISO UTC inspeksi dikonversi ke tanggal lokal WIB', () => {
  assert.equal(toLocalYmd('2026-10-12'), '2026-10-12');
  // 18:30 UTC tanggal 11 = 01:30 WIB tanggal 12
  assert.equal(toLocalYmd('2026-10-11T18:30:00.000Z'), '2026-10-12');
  assert.equal(toLocalYmd({ seconds: Date.UTC(2026, 9, 18, 16, 0) / 1000 }), '2026-10-18');
  assert.equal(toLocalYmd(''), null);
  assert.equal(toLocalYmd('bukan tanggal'), null);
});

const hseDocs = [
  // Inspeksi yang sama tersimpan 2x (export PDF UTT + NeutraDC) → dihitung 1
  { id: 'i1n', hseType: 'inspection', reportType: 'neutradc', date: '2026-10-11T18:30:00.000Z', aktivitas: 'PM Genset', lokasi: 'Genset Room', pic: 'Budi', authorEmail: 'hse@x.com', checklist: { mop: true, jsa: true, ptw: true, ppe: true } },
  { id: 'i1u', hseType: 'inspection', reportType: 'utt', date: '2026-10-11T18:31:10.000Z', aktivitas: 'PM Genset ', lokasi: 'genset room', pic: 'Budi', authorEmail: 'hse@x.com', checklist: { mop: true, jsa: true, ptw: true, ppe: true } },
  { id: 'i2', reportType: 'utt', date: '2026-10-14T02:00:00.000Z', aktivitas: 'Cleaning Chiller', lokasi: 'Chiller Area', pic: 'Andi', authorEmail: 'hse@x.com', checklist: { mop: true, lockOut: true } },
  // Di luar minggu (Minggu malam WIB minggu sebelumnya)
  { id: 'i0', hseType: 'inspection', reportType: 'utt', date: '2026-10-11T10:00:00.000Z', aktivitas: 'Lama', lokasi: 'X', authorEmail: 'hse@x.com' },
  { id: 'sio', hseType: 'sio', reportType: 'utt', date: '2026-10-13', aktivitas: 'SIO', lokasi: 'X' },
  { id: 't2', hseType: 'tbm', date: '2026-10-13', time: '08:00', totalSDM: 12, lokasi: 'Lobby', keterangan: 'Bahaya listrik' },
  { id: 't1', hseType: 'tbm', date: '2026-10-12', time: '07:45', totalSDM: '9', lokasi: 'Lobby' },
  { id: 't3', hseType: 'tbm', date: '2026-10-13', time: '13:00', totalSDM: 4, lokasi: 'Lobby', deleteRequested: true },
  { id: 'n1', hseType: 'induction', date: '2026-10-15', time: '09:00', pesertaList: [
    { nama: 'Rudi', perusahaan: 'PT A', jabatan: 'Teknisi' },
    { nama: 'Sari', perusahaan: 'PT B' },
    { nama: '  ', perusahaan: 'PT C' },
  ], jabatan: 'Vendor' },
  { id: 'n2', hseType: 'induction', date: '2026-10-16', nama: 'Joko', perusahaan: 'PT A', jabatan: 'Helper' },
];

const findingDocs = [
  { id: 'f1', findingType: 'negative', severity: 'unsafe_action', status: 'open', findingDate: '2026-10-13', title: 'Tidak pakai helm', location: 'Genset' },
  { id: 'f2', severity: 'unsafe_condition', status: 'close', findingDate: '2026-10-12', title: 'Kabel terkelupas', afterNotes: 'Kabel diganti', location: 'Panel', targetPerson: '-' },
  { id: 'f3', findingType: 'positive', severity: 'safe_behavior', status: 'close', findingDate: '2026-10-14', title: 'APD lengkap', location: 'Chiller' },
];
const openFindingDocs = [
  { id: 'f1', findingType: 'negative', severity: 'unsafe_action', status: 'open', findingDate: '2026-10-13', title: 'Tidak pakai helm', location: 'Genset' },
  { id: 'old1', findingType: 'negative', severity: 'unsafe_condition', status: 'open', findingDate: '2026-10-02', title: 'Tangga rusak', location: 'Roof' },
  { id: 'old2', findingType: 'negative', severity: 'unsafe_condition', status: 'open', findingDate: '2026-10-01', title: 'Minta dihapus', deleteRequested: true },
];

const report = buildHSEWeeklyReport(week, hseDocs, findingDocs, openFindingDocs);

test('inspeksi: duplikat UTT/NeutraDC digabung, versi UTT dipertahankan, di luar minggu dibuang', () => {
  assert.deepEqual(report.inspections.map(i => i.id), ['i1u', 'i2']);
  assert.equal(report.inspections[0].date, '2026-10-12');
  assert.deepEqual(report.inspections[1].checks, { mop: true, jsa: false, ptw: false, loto: true, apd: false });
  assert.equal(report.summary.inspectedLocations, 2);
  assert.deepEqual(report.summary.checkCounts, { mop: 2, jsa: 1, ptw: 1, loto: 1, apd: 1 });
});

test('TBM & induction: urut tanggal, pengajuan hapus diabaikan, peserta kosong dibuang', () => {
  assert.deepEqual(report.tbm.map(t => t.id), ['t1', 't2']);
  assert.equal(report.summary.tbmAttendance, 21);
  assert.equal(report.summary.tbmDays, 2);
  assert.equal(report.summary.tbmAverage, 10.5);
  assert.deepEqual(report.inductions.map(i => i.participants.map(p => p.nama)), [['Rudi', 'Sari'], ['Joko']]);
  assert.equal(report.inductions[0].participants[1].jabatan, 'Vendor');
  assert.equal(report.summary.inductionParticipants, 3);
  assert.equal(report.summary.inductionCompanies, 2);
});

test('temuan: negatif dulu, carry-over hanya open lama yang belum diajukan hapus', () => {
  assert.deepEqual(report.findings.map(f => f.id), ['f2', 'f1', 'f3']);
  assert.equal(report.findings[0].type, 'negative');
  assert.equal(report.findings[0].targetPerson, '');
  assert.deepEqual(report.carryOverFindings.map(f => f.id), ['old1']);
  const s = report.summary;
  assert.equal(s.negative, 2);
  assert.equal(s.unsafeAction, 1);
  assert.equal(s.unsafeCondition, 1);
  assert.equal(s.positive, 1);
  assert.equal(s.closeRate, 50);
  assert.equal(s.totalOpen, 2);
});

test('matriks harian per hari Senin..Minggu', () => {
  const row = key => report.daily.find(r => r.key === key);
  assert.deepEqual(row('inspection').perDay, [1, 0, 1, 0, 0, 0, 0]);
  assert.deepEqual(row('tbmAttendance').perDay, [9, 12, 0, 0, 0, 0, 0]);
  assert.deepEqual(row('induction').perDay, [0, 0, 0, 2, 1, 0, 0]);
  assert.equal(row('negative').total, 2);
});

test('minggu kosong tetap menghasilkan laporan dengan close rate null', () => {
  const empty = buildHSEWeeklyReport(getWeekRange('2026-01-07'), [], []);
  assert.equal(empty.summary.closeRate, null);
  assert.equal(empty.daily.every(r => r.total === 0), true);
});

test('workbook: satu worksheet, bisa ditulis & dibaca ulang, isi utama & foto ada', async () => {
  const photos = {
    i1u: [photo(), photo(480, 640), photo(), photo(), photo(), photo(), photo(), photo()], // 8 foto → 2 baris thumbnail
    t1: [photo()],
    n1: [photo(), photo()],
    [findingPhotoKey('f2', 'before')]: [photo()],
    [findingPhotoKey('f2', 'after')]: [photo()],
    [findingPhotoKey('old1', 'before')]: [photo()],
  };
  const wb = buildHSEWeeklyWorkbook(report, {
    companyName: 'PT United Transworld Trading',
    siteName: 'Data Center NeutraDC Cikarang',
    preparedBy: 'HSE Officer',
    notes: 'Fokus minggu depan: LOTO panel LVMDP.',
    generatedAt: new Date('2026-10-16T07:00:00Z'),
    logos: { left: photo(300, 100), right: photo(300, 100) },
    photos,
  });
  const buffer = await wb.xlsx.writeBuffer();
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(buffer);
  assert.equal(back.worksheets.length, 1);
  const ws = back.worksheets[0];
  assert.equal(ws.name, 'HSE Weekly W42');

  const texts = [];
  ws.eachRow(row => row.eachCell(c => {
    const v = c.value;
    texts.push(v && typeof v === 'object' && 'richText' in v ? v.richText.map(r => r.text).join('') : String(v ?? ''));
  }));
  const all = texts.join('\n');
  for (const needle of ['HSE WEEKLY REPORT', 'HSE INSPECTION REPORT', 'ABSEN TBM', 'SAFETY INDUCTION', 'TEMUAN K3',
    'PM Genset', 'Tangga rusak', 'Rudi', 'LOTO panel LVMDP', 'Temuan masih OPEN dari minggu sebelumnya', 'Kabel diganti']) {
    assert.ok(all.includes(needle), `teks "${needle}" tidak ada di sheet`);
  }
  assert.ok(ws.rowCount < 45, `rowCount ${ws.rowCount}`);

  // 2 logo + 14 foto ikut tersimpan, dan baris inspeksi cukup tinggi untuk 2 baris thumbnail
  const photoCount = Object.values(photos).reduce((n, list) => n + list.length, 0);
  assert.equal(ws.getImages().length, 2 + photoCount);
  const inspectionRow = ws.getImages()
    .map(img => img.range.tl.nativeRow)
    .filter((row, _, rows) => rows.filter(r => r === row).length >= 8)[0];
  assert.ok(ws.getRow(inspectionRow + 1).height >= 100, `tinggi baris inspeksi ${ws.getRow(inspectionRow + 1).height}`);
  // Sel kosong foto diberi keterangan
  assert.ok(all.includes('Tidak ada foto'));
  assert.equal(hseWeeklyFileName(week), 'HSE_Weekly_Report_2026-W42 (12 – 18 Okt 2026).xlsx');
});
