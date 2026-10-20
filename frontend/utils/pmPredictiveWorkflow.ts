// ============================================================================
// FILE: frontend/utils/pmPredictiveWorkflow.ts
// Deskripsi: Langkah Predictive Report dari laporan PM yang dipakai bersama oleh
//            generate satu laporan (PmPredictiveModal) dan generate per quarter
//            (PmPredictiveQuarterModal): pemetaan foto kartu, draf angka yang
//            dikonfirmasi engineer, penyusunan bagian equipment, perakitan dokumen,
//            dan deteksi quarter laporan PM. Tanpa React/Firebase agar bisa diuji
//            langsung dengan Node: scripts/test-pm-predictive-workflow.mjs.
// ============================================================================

import type { PmProfile } from '@/config/pmPredictiveProfiles';
import type { PmSourcePhoto } from '@/utils/pmPredictiveService';
import type {
  PmPredictiveReport, PmConfidence, PmVisualCondition, PmNameplate, PmReading, PmVisualObservation,
  PmEquipmentSection, PmCardKind, PmExtractResult, PmHistory, PmSignatory,
} from '@/types/pmPredictiveTypes';
// Import nilai memakai path relatif .ts agar modul ini bisa dijalankan Node tanpa bundler.
import {
  matchCard, convertToCanonical, computeDerived, mergeHistory, buildSections, worstStatus, effectiveStatus,
  unitKeyOf, toISODate,
} from './pmPredictiveEngine.ts';

export interface PmPredictiveSourceDoc {
  id: string;
  maintenanceName: string;
  maintenanceTime: string;
  specificDetail?: string;
  createdBy: string;
  fileName?: string;
  createdAt?: any;
}

export type RowState = 'pending' | 'done' | 'failed' | 'manual';

export interface CardPlan {
  photo: PmSourcePhoto;
  kind: PmCardKind;
  param?: string;
  visualKey?: string;
}

export interface MeasureRow {
  photoIndex: number;
  cardLabel: string;
  param: string;
  aiValue: number | null;
  aiUnit?: string;
  aiRaw?: string;
  aiConfidence: PmConfidence;
  aiConverted: number | null;
  input: string;
  note?: string;
  state: RowState;
}

export interface VisualRow {
  photoIndex: number;
  cardLabel: string;
  key: string;
  condition: PmVisualCondition;
  observation: string;
  aiConfidence: PmConfidence;
  state: RowState;
}

/** Angka & observasi satu laporan PM yang sedang diperiksa engineer. */
export interface PmReadingDraft {
  measures: MeasureRow[];
  visuals: VisualRow[];
  nameplate: PmNameplate;
  nameplatePhotoIndex: number | null;
  nameplateState: RowState;
  /** Pilihan engineer per equipment; tanpa pilihan = ikut deteksi (ada angka/observasi). */
  selection: Record<string, boolean>;
}

/** Equipment di dalam unit beserta baris angka & observasinya di langkah konfirmasi. */
export interface EquipmentGroup {
  id: string;
  name: string;
  rows: MeasureRow[];
  visuals: VisualRow[];
  /** Ada angka/observasi yang terbaca (oleh AI atau diisi manual): dicentang otomatis. */
  detected: boolean;
}

// ─── Input & tanggal ─────────────────────────────────────────────────────────

export function parseInput(text: string): number | null {
  const s = (text || '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function isInputInvalid(text: string): boolean {
  return Boolean((text || '').trim()) && parseInput(text) === null;
}

export function hasNameplateData(n: PmNameplate | null | undefined): boolean {
  return Boolean(n && (n.brand || n.model || n.ratedVoltage || n.ratedCurrent || n.ratedPowerKw));
}

/** Tanggal pelaksanaan PM (YYYY-MM-DD) dari maintenanceTime, cadangan createdAt. */
export function maintenanceDateOf(d: Pick<PmPredictiveSourceDoc, 'maintenanceTime' | 'createdAt'>): string {
  const raw = (d.maintenanceTime || '').trim();
  const first = raw.includes(' - ') ? raw.split(' - ')[0].trim() : raw;
  const iso = (y: number, m: number, day: number) => `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  let m = first.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = first.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  const parsed = first ? new Date(first) : null;
  if (parsed && !isNaN(parsed.getTime())) return toISODate(parsed);
  const created = d.createdAt?.toDate ? d.createdAt.toDate() : d.createdAt ? new Date(d.createdAt) : null;
  return created && !isNaN(created.getTime()) ? toISODate(created) : toISODate(new Date());
}

/** Jalankan tugas dengan paralelisme terbatas (jaga kuota per menit AI gratis). */
export async function runPool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ─── Quarter ─────────────────────────────────────────────────────────────────

export interface PmQuarter {
  year: number;
  quarter: number; // 1-4
}

const ROMAN_QUARTER: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 };
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "Q2", "Quarter 2", "Kuartal 2", "Triwulan II", "TW-2" pada nama laporan; null bila tidak ada. */
export function quarterFromText(text: string): number | null {
  const s = text || '';
  let m = s.match(/(?:^|[^a-z0-9])(?:q|quarter|kuartal|triwulan|tw)\s*[-.]?\s*([1-4])(?![0-9])/i);
  if (m) return Number(m[1]);
  m = s.match(/(?:^|[^a-z0-9])(?:quarter|kuartal|triwulan|tw)\s*[-.]?\s*(iv|i{1,3})(?![a-z])/i);
  return m ? ROMAN_QUARTER[m[1].toLowerCase()] : null;
}

/**
 * Quarter laporan PM. Quarter yang ditulis di nama laporan diutamakan (PM Q2 bisa
 * dikerjakan awal Juli); tanpa itu dipakai bulan pelaksanaan PM.
 */
export function detectQuarter(d: Pick<PmPredictiveSourceDoc, 'maintenanceName' | 'fileName' | 'maintenanceTime' | 'createdAt'>): PmQuarter {
  const date = maintenanceDateOf(d);
  const dateYear = Number(date.slice(0, 4));
  const text = `${d.maintenanceName || ''} ${d.fileName || ''}`;
  const named = quarterFromText(text);
  if (named) {
    const y = text.match(/(?:^|\D)(20\d{2})(?!\d)/);
    return { year: y ? Number(y[1]) : dateYear, quarter: named };
  }
  return { year: dateYear, quarter: Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1 };
}

export const quarterKey = (q: PmQuarter) => `${q.year}-Q${q.quarter}`;
export const quarterLabel = (q: PmQuarter) => `Q${q.quarter} ${q.year}`;
export const quarterMonthsText = (q: PmQuarter) => `${MONTHS_ID[(q.quarter - 1) * 3]} - ${MONTHS_ID[(q.quarter - 1) * 3 + 2]} ${q.year}`;

// ─── Foto kartu & draf angka ─────────────────────────────────────────────────

/** Peran tiap foto kartu: pengukuran (sekali per parameter), nameplate, atau visual. */
export function planCards(profile: PmProfile, photos: PmSourcePhoto[]): CardPlan[] {
  const usedParams = new Set<string>();
  let hasNameplate = false;
  return photos.map(photo => {
    const m = matchCard(profile, photo.description);
    if (m?.kind === 'measurement' && m.param && !usedParams.has(m.param)) {
      usedParams.add(m.param);
      return { photo, kind: 'measurement' as const, param: m.param };
    }
    if (m?.kind === 'nameplate' && !hasNameplate) {
      hasNameplate = true;
      return { photo, kind: 'nameplate' as const };
    }
    if (m?.kind === 'visual' && m.visualKey) return { photo, kind: 'visual' as const, visualKey: m.visualKey };
    // Kartu di luar profil (atau duplikat) tetap dinilai secara visual.
    return { photo, kind: 'visual' as const, visualKey: `other-${photo.index}` };
  });
}

export const EMPTY_DRAFT: PmReadingDraft = {
  measures: [], visuals: [], nameplate: {}, nameplatePhotoIndex: null, nameplateState: 'manual', selection: {},
};

/** Draf kosong dari rencana kartu: 'pending' sebelum AI membaca, 'manual' tanpa AI. */
export function initDraft(plans: CardPlan[], state: RowState): PmReadingDraft {
  const np = plans.find(p => p.kind === 'nameplate');
  return {
    measures: plans.filter(p => p.kind === 'measurement').map(p => ({
      photoIndex: p.photo.index, cardLabel: p.photo.description, param: p.param!,
      aiValue: null, aiConfidence: 'rendah' as const, aiConverted: null, input: '', state,
    })),
    visuals: plans.filter(p => p.kind === 'visual').map(p => ({
      photoIndex: p.photo.index, cardLabel: p.photo.description || `Foto #${p.photo.index}`, key: p.visualKey!,
      condition: 'tidak jelas' as const, observation: '', aiConfidence: 'rendah' as const, state,
    })),
    nameplate: {},
    nameplatePhotoIndex: np ? np.photo.index : null,
    nameplateState: np ? state : 'manual',
    selection: {},
  };
}

/** Tandai foto tertentu sedang dibaca ulang. */
export function markDraftPending(draft: PmReadingDraft, indexes: Set<number>): PmReadingDraft {
  return {
    ...draft,
    measures: draft.measures.map(r => (indexes.has(r.photoIndex) ? { ...r, state: 'pending' as const, note: undefined } : r)),
    visuals: draft.visuals.map(r => (indexes.has(r.photoIndex) ? { ...r, state: 'pending' as const } : r)),
    nameplateState: draft.nameplatePhotoIndex !== null && indexes.has(draft.nameplatePhotoIndex) ? 'pending' : draft.nameplateState,
  };
}

/** Masukkan hasil baca AI satu kelompok foto ke draf (foto gagal ditandai untuk diisi manual). */
export function applyExtraction(draft: PmReadingDraft, profile: PmProfile, results: PmExtractResult[], failedIdx: number[]): PmReadingDraft {
  const byIndex = new Map(results.map(r => [r.index, r]));
  const failed = new Set(failedIdx);
  const measures = draft.measures.map(row => {
    if (failed.has(row.photoIndex)) return { ...row, state: 'failed' as const, note: 'AI gagal membaca foto ini; isi manual.' };
    const r = byIndex.get(row.photoIndex);
    if (!r) return row;
    const conv = convertToCanonical(r.value, r.unit, profile.params[row.param].unit);
    return {
      ...row,
      aiValue: r.value, aiUnit: r.unit, aiRaw: r.raw, aiConfidence: r.confidence,
      aiConverted: conv.value,
      input: conv.value === null ? '' : String(conv.value),
      note: conv.note || (r.value === null ? (r.observation || 'Angka tidak terbaca; isi manual.') : r.observation || undefined),
      state: 'done' as const,
    };
  });
  const visuals = draft.visuals.map(row => {
    if (failed.has(row.photoIndex)) return { ...row, state: 'failed' as const };
    const r = byIndex.get(row.photoIndex);
    if (!r) return row;
    return { ...row, condition: (r.condition || 'tidak jelas') as PmVisualCondition, observation: r.observation || '', aiConfidence: r.confidence, state: 'done' as const };
  });
  let { nameplate, nameplateState } = draft;
  const npIndex = draft.nameplatePhotoIndex;
  if (npIndex !== null) {
    if (failed.has(npIndex)) nameplateState = 'failed';
    const r = byIndex.get(npIndex);
    if (r) {
      if (r.nameplate) nameplate = { ...r.nameplate, source: 'foto' };
      nameplateState = 'done';
    }
  }
  return { ...draft, measures, visuals, nameplate, nameplateState };
}

/** Draf dari predictive tersimpan, untuk mengedit ulang angka lalu analisis ulang. */
export function draftFromReport(report: PmPredictiveReport, profile: PmProfile, photos: PmSourcePhoto[]): PmReadingDraft {
  const excluded = new Set(report.excludedEquipment || []);
  const analysed = new Set(report.sections.map(s => s.id));
  return {
    measures: report.readings.map(r => ({
      photoIndex: r.photoIndex, cardLabel: r.cardLabel, param: r.param,
      aiValue: r.aiValue, aiUnit: r.aiUnit, aiRaw: r.aiRaw, aiConfidence: r.aiConfidence,
      aiConverted: convertToCanonical(r.aiValue, r.aiUnit, r.unit).value,
      input: r.value === null ? '' : String(r.value),
      note: r.note,
      state: r.aiRaw || r.aiValue !== null ? 'done' : 'manual',
    })),
    visuals: report.visuals.map(v => ({
      photoIndex: v.photoIndex, cardLabel: v.cardLabel, key: v.key, condition: v.condition,
      observation: v.observation, aiConfidence: v.aiConfidence, state: 'done' as const,
    })),
    nameplate: report.nameplate || {},
    nameplatePhotoIndex: photos.find(p => matchCard(profile, p.description)?.kind === 'nameplate')?.index ?? null,
    nameplateState: 'done',
    // Equipment tanpa data di predictive lama dibiarkan ikut deteksi otomatis.
    selection: Object.fromEntries([
      ...[...excluded].map(id => [id, false] as const),
      ...[...analysed].filter(id => !excluded.has(id)).map(id => [id, true] as const),
    ]),
  };
}

export function equipmentGroupsOf(profile: PmProfile, draft: PmReadingDraft): EquipmentGroup[] {
  const visualOwner = (key: string) => profile.equipment.find(eq => eq.visualKeys?.includes(key))?.id || 'other';
  const defs = [
    ...profile.equipment.map(eq => ({ id: eq.id, name: eq.name, params: eq.params })),
    { id: 'other', name: 'Observasi Visual Lainnya', params: [] as string[] },
  ];
  return defs.map(d => {
    const rows = draft.measures.filter(m => d.params.includes(m.param));
    const visuals = draft.visuals.filter(v => visualOwner(v.key) === d.id);
    const detected = rows.some(r => r.state === 'manual' || r.input.trim() !== '')
      || visuals.some(v => v.state === 'manual' || v.condition !== 'tidak jelas' || v.observation.trim() !== '');
    return { id: d.id, name: d.name, rows, visuals, detected };
  }).filter(g => g.rows.length || g.visuals.length);
}

export const isGroupIncluded = (draft: PmReadingDraft, g: EquipmentGroup) => draft.selection[g.id] ?? g.detected;

export interface PmDraftStats {
  groups: EquipmentGroup[];
  included: EquipmentGroup[];
  includedRows: MeasureRow[];
  pendingRows: number;
  lowConfidence: number;
  invalidInputs: number;
  failedIndexes: Set<number>;
}

/** Hitungan di langkah konfirmasi (angka kosong, keyakinan AI rendah, input tidak valid). */
export function draftStats(profile: PmProfile, draft: PmReadingDraft): PmDraftStats {
  const groups = equipmentGroupsOf(profile, draft);
  const included = groups.filter(g => isGroupIncluded(draft, g));
  const includedRows = included.flatMap(g => g.rows);
  return {
    groups,
    included,
    includedRows,
    pendingRows: includedRows.filter(m => m.state === 'failed' || (m.state !== 'manual' && m.input === '')).length,
    lowConfidence: includedRows.filter(m => m.state === 'done' && m.aiConfidence !== 'tinggi').length,
    invalidInputs: includedRows.filter(m => isInputInvalid(m.input)).length,
    failedIndexes: new Set([
      ...draft.measures.filter(m => m.state === 'failed').map(m => m.photoIndex),
      ...draft.visuals.filter(v => v.state === 'failed').map(v => v.photoIndex),
      ...(draft.nameplateState === 'failed' && draft.nameplatePhotoIndex !== null ? [draft.nameplatePhotoIndex] : []),
    ]),
  };
}

// ─── Analisis & perakitan dokumen ────────────────────────────────────────────

export interface PmAnalysis {
  readings: PmReading[];
  visuals: PmVisualObservation[];
  history: PmHistory;
  sections: PmEquipmentSection[];
  nameplate: PmNameplate;
  excludedIds: string[];
}

/**
 * Hitung status & tren dari draf yang sudah dikonfirmasi (sebelum narasi AI).
 * Angka equipment yang tidak dipilih tetap disimpan di readings, tetapi tidak masuk
 * riwayat (riwayat lamanya dibawa apa adanya) dan tidak dianalisis.
 */
export function composeAnalysis(
  profile: PmProfile,
  draft: PmReadingDraft,
  previous: PmPredictiveReport | null,
  maintenanceDate: string,
  reportId: string,
): PmAnalysis | { error: string } {
  const groups = equipmentGroupsOf(profile, draft);
  const included = groups.filter(g => isGroupIncluded(draft, g));
  if (!included.length) return { error: 'Pilih minimal satu equipment untuk dianalisis.' };
  const includedIds = new Set(included.map(g => g.id));
  const includedParams = new Set(included.flatMap(g => g.rows.map(r => r.param)));
  const includedVisuals = new Set(included.flatMap(g => g.visuals.map(v => v.photoIndex)));

  const nameplate: PmNameplate = hasNameplateData(draft.nameplate)
    ? { ...draft.nameplate, source: draft.nameplate.source || 'manual' }
    : hasNameplateData(previous?.nameplate) ? { ...previous!.nameplate, source: 'predictive sebelumnya' } : draft.nameplate;

  const readings: PmReading[] = draft.measures.map(m => {
    const value = parseInput(m.input);
    return {
      param: m.param, photoIndex: m.photoIndex, cardLabel: m.cardLabel, value, unit: profile.params[m.param].unit,
      aiValue: m.aiValue, aiUnit: m.aiUnit, aiRaw: m.aiRaw, aiConfidence: m.aiConfidence,
      edited: value !== m.aiConverted, note: m.note,
    };
  });
  const values: Record<string, number | null> = {};
  for (const r of readings) if (includedParams.has(r.param)) values[r.param] = r.value;
  const allValues = computeDerived(profile, values, nameplate);
  const history = mergeHistory(previous?.history, allValues, maintenanceDate, reportId);
  const visuals: PmVisualObservation[] = draft.visuals.map(v => ({
    key: v.key, photoIndex: v.photoIndex, cardLabel: v.cardLabel, condition: v.condition, observation: v.observation.trim(), aiConfidence: v.aiConfidence,
  }));
  const sections = buildSections(profile, allValues, history, visuals.filter(v => includedVisuals.has(v.photoIndex)), maintenanceDate, nameplate)
    .filter(s => includedIds.has(s.id));
  if (!sections.length) return { error: 'Belum ada angka atau observasi yang bisa dianalisis.' };
  return { readings, visuals, history, sections, nameplate, excludedIds: groups.filter(g => !includedIds.has(g.id)).map(g => g.id) };
}

const AUTHOR_NAME = 'Rizki Novri Yanda – Data Center Operation';

/**
 * Penanda tangan default. Akun unit (mis. fcu@gmail.com) bukan nama orang: penyusun
 * dibawa dari predictive kuartal sebelumnya, cukup dikoreksi sekali di langkah Hasil.
 */
export function defaultSignatures(previous: PmPredictiveReport | null): PmPredictiveReport['signatures'] {
  const carried: PmSignatory | null = previous?.signatures?.preparedBy?.name ? previous.signatures.preparedBy : null;
  return {
    authorName: AUTHOR_NAME,
    preparedBy: carried || { name: 'Asep Mohammad Fauzi', title: '(Electrical Engineer)' },
    reviewedBy: { name: 'Arif Budiman', title: '(Technical Manager)' },
    acknowledgedBy1: { name: 'Habib Mulyana', title: '(Chief Engineer)' },
    acknowledgedBy2: { name: 'Supriyatno', title: '(Facility manager)' },
    approvedBy: { name: 'Budi Susanto', title: '(Assistant manager HDC Facility Management)' },
  };
}

export function reportNumberFor(docId: string, maintenanceDate: string): string {
  const [yyyy, mm] = maintenanceDate.split('-');
  return `PDM-PM/DME-NDC/${yyyy}/${mm}/${docId.slice(-4).toUpperCase()}`;
}

export interface BuildReportInput {
  profile: PmProfile;
  src: PmPredictiveSourceDoc;
  unitLabel: string;
  maintenanceDate: string;
  analysis: PmAnalysis;
  /** Bagian equipment yang sudah bernarasi. */
  sections: PmEquipmentSection[];
  summary: PmPredictiveReport['summary'];
  previous: PmPredictiveReport | null;
  /** Predictive tersimpan untuk laporan PM ini (nomor & createdAt dipertahankan). */
  existing?: PmPredictiveReport | null;
  /** Versi yang sedang diedit; penanda tangan yang sudah dikoreksi tetap dipakai. */
  current?: PmPredictiveReport | null;
  generatedBy: string;
}

export function buildPmReport(o: BuildReportInput): PmPredictiveReport {
  const account = (o.src.createdBy || '').toLowerCase().trim();
  const unitLabel = o.unitLabel.trim();
  return {
    id: o.src.id,
    reportNumber: o.existing?.reportNumber || o.current?.reportNumber || reportNumberFor(o.src.id, o.maintenanceDate),
    profileId: o.profile.id,
    profileVersion: o.profile.version,
    unitType: o.profile.unitType,
    account,
    unitLabel,
    unitKey: unitKeyOf(account, unitLabel),
    maintenanceName: o.src.maintenanceName,
    maintenanceDate: o.maintenanceDate,
    sourceDocId: o.src.id,
    sourceCollection: 'pdf_documents',
    sourceFileName: o.src.fileName,
    nameplate: o.analysis.nameplate,
    readings: o.analysis.readings,
    visuals: o.analysis.visuals,
    history: o.analysis.history,
    previousReportId: o.previous?.id || null,
    previousMaintenanceDate: o.previous?.maintenanceDate || null,
    sections: o.sections,
    excludedEquipment: o.analysis.excludedIds,
    overallStatus: worstStatus(o.sections.map(effectiveStatus)),
    summary: o.summary,
    signatures: o.current?.signatures || o.existing?.signatures || defaultSignatures(o.previous),
    generatedBy: o.generatedBy,
    createdAt: o.existing?.createdAt,
  };
}

/** Predictive pembanding terbaru (tanggal PM lebih awal) dari beberapa sumber. */
export function latestEarlier(candidates: (PmPredictiveReport | null | undefined)[], maintenanceDate: string): PmPredictiveReport | null {
  return candidates
    .filter((r): r is PmPredictiveReport => Boolean(r) && r!.maintenanceDate < maintenanceDate)
    .sort((a, b) => a.maintenanceDate.localeCompare(b.maintenanceDate))
    .pop() || null;
}
