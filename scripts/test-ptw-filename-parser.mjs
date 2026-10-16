// Uji parser metadata PTW dari nama file (parsePTWFromFilename di ptwPdfParser.ts).
// Jalankan: node --test scripts/test-ptw-filename-parser.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// pdf.js (diimpor di modul yang sama) butuh DOMMatrix saat load; tidak dipakai oleh parser nama file.
globalThis.DOMMatrix ??= class {};
const { parsePTWFromFilename } = await import('../frontend/utils/ptwPdfParser.ts');

const REQUIRED = ['sequenceNumber', 'equipmentCode', 'quarter', 'startDate', 'endDate'];
const thisYear = new Date().getFullYear();

test('nama file tanpa tahun ("14 Oktober 0838") tetap lengkap', () => {
  const r = parsePTWFromFilename('PTW CM Lift 14 Oktober 0838.pdf');
  for (const key of REQUIRED) assert.ok(r?.[key], `field ${key} kosong`);
  assert.equal(r.sequenceNumber, '0838');
  assert.equal(r.equipmentCode, 'LIFT');
  assert.equal(r.ptwType, 'CM');
  assert.equal(r.quarter, '4');
  assert.match(r.startDate, /^\d{4}-10-14$/);
  assert.equal(r.endDate, r.startDate);
});

test('variasi nama file batch yang dilaporkan user', () => {
  const cases = [
    ['PTW CM Panel PJU 14 Oktober 0839.pdf', '0839', 'PJU'],
    ['PTW CM Selenoid Valve Blowdown CT 14 Oktober 0841.pdf', '0841', 'CT'],
    ['PTW PM Door 14 Oktober 0836.pdf', '0836', 'DOOR'],
  ];
  for (const [name, seq, eq] of cases) {
    const r = parsePTWFromFilename(name);
    for (const key of REQUIRED) assert.ok(r?.[key], `${name}: field ${key} kosong`);
    assert.equal(r.sequenceNumber, seq);
    assert.equal(r.equipmentCode, eq);
  }
});

test('tahun tebakan tidak lompat > 6 bulan ke depan', () => {
  const r = parsePTWFromFilename('PTW PM AHU 3 Mar 0500.pdf');
  const year = Number(r.startDate.slice(0, 4));
  assert.ok(year === thisYear || year === thisYear - 1);
  const guessed = new Date(year, 2, 3);
  const limit = new Date();
  limit.setMonth(limit.getMonth() + 6);
  assert.ok(guessed <= limit);
});

test('nama file dengan tahun tetap seperti sebelumnya', () => {
  const r = parsePTWFromFilename('PTW CM UPS(MovementBattery) 10 Agustus 2026 0652.pdf');
  assert.equal(r.startDate, '2026-08-10');
  assert.equal(r.quarter, '3');
  assert.equal(r.sequenceNumber, '0652');
  assert.equal(r.equipmentCode, 'UPS');
});

test('kata yang mirip nama bulan tidak dianggap tanggal', () => {
  const r = parsePTWFromFilename('PTW CM Lift 2 Desk 0838.pdf');
  assert.equal(r.startDate, undefined);
  assert.equal(r.quarter, undefined);
});
