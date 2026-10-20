// ============================================================================
// FILE: frontend/utils/documentRevision.ts
// Deskripsi: Status revisi dokumen Laporan CM & PIR (Final vs Revisi) beserta riwayatnya.
//            Setiap kali laporan ditandai revisi tercatat sebagai "Revisi ke-N" di
//            revisionHistory, jadi jumlah & alasan revisi tidak hilang ketika
//            revisionNote diganti atau dibersihkan saat laporan ditandai Final.
// ============================================================================

import { arrayUnion, serverTimestamp } from 'firebase/firestore';

export type RevisionStatus = 'final' | 'revisi';

// 'revisi'  = laporan ditandai perlu diperbaiki (dihitung satu kali revisi)
// 'catatan' = catatan revisi diubah selagi laporan masih berstatus revisi
// 'final'   = laporan disetujui Final setelah diperbaiki
export type RevisionAction = 'revisi' | 'catatan' | 'final';

export interface RevisionHistoryEntry {
  action: RevisionAction;
  by: string;
  at: string;     // ISO string; serverTimestamp() tidak bisa dipakai di dalam array
  note?: string;
}

export interface RevisionFields {
  revisionStatus?: RevisionStatus;
  isRevision?: boolean;
  revisionNote?: string;
  revisionUpdatedAt?: any;
  revisionUpdatedBy?: string;
  revisionHistory?: RevisionHistoryEntry[];
}

/** Hanya Standby Engineer & QC DME yang boleh mengubah status revisi. */
export const canChangeRevisionStatus = (userRole: string | null | undefined, isQcDme: boolean): boolean =>
  isQcDme || userRole === 'qc_dme' || userRole === 'standby_engineer';

export const isRevisionActive = (report: RevisionFields): boolean =>
  report.revisionStatus === 'revisi' || report.isRevision === true;

const toIsoString = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return '';
};

const storedHistory = (report: RevisionFields): RevisionHistoryEntry[] =>
  Array.isArray(report.revisionHistory) ? report.revisionHistory : [];

// Laporan yang ditandai revisi sebelum riwayat dicatat hanya punya revisionNote.
const legacyRevisionEntry = (report: RevisionFields): RevisionHistoryEntry => {
  const entry: RevisionHistoryEntry = {
    action: 'revisi',
    by: report.revisionUpdatedBy || '-',
    at: toIsoString(report.revisionUpdatedAt),
  };
  if (report.revisionNote) entry.note = report.revisionNote;
  return entry;
};

/** Riwayat revisi urut kronologis, termasuk revisi lama yang belum punya riwayat. */
export const getRevisionHistory = (report: RevisionFields): RevisionHistoryEntry[] => {
  const history = storedHistory(report);
  if (history.length > 0 || !isRevisionActive(report)) return history;
  return [legacyRevisionEntry(report)];
};

/** Berapa kali laporan ditandai revisi. */
export const getRevisionCount = (report: RevisionFields): number =>
  getRevisionHistory(report).filter(entry => entry.action === 'revisi').length;

/** Riwayat terbaru di atas, masing-masing dengan nomor putaran revisinya. */
export const getNumberedRevisionHistory = (report: RevisionFields): Array<RevisionHistoryEntry & { round: number }> => {
  let round = 0;
  return getRevisionHistory(report)
    .map(entry => {
      if (entry.action === 'revisi') round += 1;
      return { ...entry, round };
    })
    .reverse();
};

/**
 * Entri riwayat yang ditambahkan bila status disimpan, atau null bila tidak ada yang berubah
 * (Final disimpan Final, atau Revisi disimpan dengan catatan yang sama).
 */
export const planRevisionChange = (
  report: RevisionFields,
  status: RevisionStatus,
  note: string,
  by: string,
  now: Date = new Date()
): RevisionHistoryEntry[] | null => {
  const wasRevisi = isRevisionActive(report);
  const trimmedNote = note.trim();
  if (status === 'final' && !wasRevisi) return null;
  if (status === 'revisi' && wasRevisi && trimmedNote === (report.revisionNote || '').trim()) return null;

  const entries: RevisionHistoryEntry[] = [];
  if (wasRevisi && storedHistory(report).length === 0) entries.push(legacyRevisionEntry(report));

  const entry: RevisionHistoryEntry = {
    action: status === 'final' ? 'final' : wasRevisi ? 'catatan' : 'revisi',
    by,
    at: now.toISOString(),
  };
  if (status === 'revisi') entry.note = trimmedNote;
  entries.push(entry);
  return entries;
};

/** Payload updateDoc untuk menyimpan status revisi, atau null bila tidak ada perubahan. */
export const buildRevisionUpdate = (report: RevisionFields, status: RevisionStatus, note: string, by: string) => {
  const entries = planRevisionChange(report, status, note, by);
  if (!entries) return null;
  const isRevisi = status === 'revisi';
  return {
    action: entries[entries.length - 1].action,
    revisionCount: getRevisionCount({ revisionHistory: [...storedHistory(report), ...entries] }),
    payload: {
      revisionStatus: status,
      isRevision: isRevisi,
      revisionNote: isRevisi ? note.trim() : '',
      revisionUpdatedAt: serverTimestamp(),
      revisionUpdatedBy: by,
      revisionHistory: arrayUnion(...entries),
      updatedAt: serverTimestamp(),
    },
  };
};
