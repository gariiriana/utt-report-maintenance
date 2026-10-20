// Uji riwayat & hitungan status revisi dokumen CM/PIR (documentRevision.ts).
// Jalankan: node --test scripts/test-document-revision.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  canChangeRevisionStatus,
  getNumberedRevisionHistory,
  getRevisionCount,
  planRevisionChange,
} = await import('../frontend/utils/documentRevision.ts');

const at = (iso) => new Date(iso);

// Terapkan entri hasil planRevisionChange seperti yang dilakukan updateDoc + arrayUnion.
const apply = (report, status, note, by, now) => {
  const entries = planRevisionChange(report, status, note, by, now);
  if (!entries) return report;
  const isRevisi = status === 'revisi';
  return {
    ...report,
    revisionStatus: status,
    isRevision: isRevisi,
    revisionNote: isRevisi ? note.trim() : '',
    revisionUpdatedBy: by,
    revisionHistory: [...(report.revisionHistory || []), ...entries],
  };
};

test('hanya standby engineer & QC yang boleh mengubah status', () => {
  assert.equal(canChangeRevisionStatus('standby_engineer', false), true);
  assert.equal(canChangeRevisionStatus('qc_dme', false), true);
  assert.equal(canChangeRevisionStatus('engineer', true), true); // akun qcdme@dme.com
  for (const role of ['admin', 'engineer', 'Engineer_K2', 'DME', 'tde', undefined]) {
    assert.equal(canChangeRevisionStatus(role, false), false, `role ${role}`);
  }
});

test('dikembalikan dua kali lalu Final: hitungan & riwayat tetap tersimpan', () => {
  let r = {};
  assert.equal(getRevisionCount(r), 0);

  r = apply(r, 'revisi', ' Foto kurang ', 'qcdme@dme.com', at('2026-10-01T02:00:00Z'));
  assert.equal(getRevisionCount(r), 1);
  r = apply(r, 'final', '', 'agil@utt.com', at('2026-10-02T02:00:00Z'));
  assert.equal(r.revisionNote, '');
  r = apply(r, 'revisi', 'RCA belum jelas', 'qcdme@dme.com', at('2026-10-03T02:00:00Z'));
  assert.equal(getRevisionCount(r), 2);
  r = apply(r, 'final', '', 'qcdme@dme.com', at('2026-10-04T02:00:00Z'));

  assert.equal(getRevisionCount(r), 2);
  assert.deepEqual(
    getNumberedRevisionHistory(r).map(e => [e.action, e.round, e.note]),
    [
      ['final', 2, undefined],
      ['revisi', 2, 'RCA belum jelas'],
      ['final', 1, undefined],
      ['revisi', 1, 'Foto kurang'],
    ]
  );
});

test('ubah catatan selagi masih revisi tidak menambah hitungan', () => {
  let r = apply({}, 'revisi', 'Foto kurang', 'qcdme@dme.com', at('2026-10-01T02:00:00Z'));
  r = apply(r, 'revisi', 'Foto kurang, nomor tiket salah', 'qcdme@dme.com', at('2026-10-01T03:00:00Z'));
  assert.equal(getRevisionCount(r), 1);
  assert.equal(r.revisionHistory.at(-1).action, 'catatan');
});

test('simpan tanpa perubahan tidak menulis riwayat', () => {
  assert.equal(planRevisionChange({}, 'final', '', 'x'), null);
  const r = apply({}, 'revisi', 'Foto kurang', 'x', at('2026-10-01T02:00:00Z'));
  assert.equal(planRevisionChange(r, 'revisi', ' Foto kurang ', 'x'), null);
});

test('revisi lama (sebelum ada riwayat) dihitung sebagai Revisi ke-1', () => {
  const legacy = {
    revisionStatus: 'revisi',
    isRevision: true,
    revisionNote: 'Lengkapi tiket',
    revisionUpdatedBy: 'qcdme@dme.com',
    revisionUpdatedAt: { toDate: () => at('2026-09-29T01:00:00Z') },
  };
  assert.equal(getRevisionCount(legacy), 1);

  const entries = planRevisionChange(legacy, 'final', '', 'agil@utt.com', at('2026-10-05T01:00:00Z'));
  assert.deepEqual(entries.map(e => e.action), ['revisi', 'final']);
  assert.equal(entries[0].note, 'Lengkapi tiket');
  assert.equal(entries[0].at, '2026-09-29T01:00:00.000Z');

  const after = apply(legacy, 'final', '', 'agil@utt.com', at('2026-10-05T01:00:00Z'));
  assert.equal(getRevisionCount(after), 1);
  const again = apply(after, 'revisi', 'Foto buram', 'qcdme@dme.com', at('2026-10-06T01:00:00Z'));
  assert.equal(getRevisionCount(again), 2);
});
