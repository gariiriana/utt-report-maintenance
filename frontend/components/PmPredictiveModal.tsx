// ============================================================================
// FILE: frontend/components/PmPredictiveModal.tsx
// Deskripsi: Generate Predictive Report dari satu laporan Preventive Maintenance
//            (dibuka dari kartu dokumen di Arsip Dokumen).
//            Alur: 1) siapkan unit & riwayat  2) AI membaca angka dari foto
//            3) engineer memeriksa & mengonfirmasi angka  4) status, tren, proyeksi
//            dihitung sistem lalu AI menulis analisis per equipment  5) edit, simpan,
//            unduh PDF/DOCX (dengan foto). Engineer memilih equipment yang dianalisis
//            dan bisa mengedit ulang angka predictive yang sudah tersimpan.
//            Riwayat tren dibaca dari predictive sebelumnya unit yang sama.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { X, Bot, Camera, CheckCircle2, AlertTriangle, Loader2, FileDown, FileText, Save, RotateCw, History, ChevronRight, PencilLine } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useModalScrollLock } from '@/utils/modalScrollLock';
import { resolvePmProfile, type PmProfile } from '@/config/pmPredictiveProfiles';
import {
  matchCard, unitKeyOf, convertToCanonical, computeDerived, mergeHistory, buildSections,
  worstStatus, effectiveStatus, fallbackNarrative, fallbackSummary, sectionAIContext, summaryAIContext,
  STATUS_LABEL, fmtNum, fmtDate, fmtMonthYear, toISODate,
} from '@/utils/pmPredictiveEngine';
import {
  loadPmSourcePhotos, prepareImageForAI, batchExtractItems, extractBatchAI, analyzeSectionAI, analyzeSummaryAI,
  getPmPredictive, findPreviousPmPredictive, savePmPredictive,
  type PmSourcePhoto, type PmExtractRequestItem,
} from '@/utils/pmPredictiveService';
import { exportPmPredictiveToPdf } from '@/utils/PmPredictivePdfExport';
import { exportPmPredictiveToDocx } from '@/utils/PmPredictiveWordExport';
import type {
  PmPredictiveReport, PmStatus, PmConfidence, PmVisualCondition, PmNameplate, PmReading,
  PmVisualObservation, PmEquipmentSection, PmCardKind,
} from '@/types/pmPredictiveTypes';

export interface PmPredictiveSourceDoc {
  id: string;
  maintenanceName: string;
  maintenanceTime: string;
  specificDetail?: string;
  createdBy: string;
  fileName?: string;
  createdAt?: any;
}

export interface PmPredictiveMarker {
  reportNumber: string;
  overallStatus: PmStatus;
  updatedAt: string;
}

interface PmPredictiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: PmPredictiveSourceDoc | null;
  readOnly?: boolean;
  onSaved?: (marker: PmPredictiveMarker) => void;
}

type Step = 'loading' | 'setup' | 'reading' | 'confirm' | 'analyzing' | 'result' | 'error';
type RowState = 'pending' | 'done' | 'failed' | 'manual';

interface CardPlan {
  photo: PmSourcePhoto;
  kind: PmCardKind;
  param?: string;
  visualKey?: string;
}

interface MeasureRow {
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

interface VisualRow {
  photoIndex: number;
  cardLabel: string;
  key: string;
  condition: PmVisualCondition;
  observation: string;
  aiConfidence: PmConfidence;
  state: RowState;
}

/** Equipment di dalam unit beserta baris angka & observasinya di langkah konfirmasi. */
interface EquipmentGroup {
  id: string;
  name: string;
  rows: MeasureRow[];
  visuals: VisualRow[];
  /** Ada angka/observasi yang terbaca (oleh AI atau diisi manual): dicentang otomatis. */
  detected: boolean;
}

interface HistoryLookup {
  unitKey: string;
  previous: PmPredictiveReport | null;
  total: number;
  newerExists: boolean;
}

export const STATUS_BADGE: Record<PmStatus, string> = {
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  watch: 'bg-amber-50 text-amber-700 border-amber-200',
  warning: 'bg-orange-50 text-orange-700 border-orange-300',
  alarm: 'bg-red-50 text-red-700 border-red-300',
  unknown: 'bg-slate-50 text-slate-500 border-slate-200',
};

const CONFIDENCE_BADGE: Record<PmConfidence, string> = {
  tinggi: 'bg-emerald-50 text-emerald-700',
  sedang: 'bg-amber-50 text-amber-700',
  rendah: 'bg-red-50 text-red-700',
};

const AUTHOR_NAME = 'Rizki Novri Yanda – Data Center Operation';

function maintenanceDateOf(d: PmPredictiveSourceDoc): string {
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

function parseInput(text: string): number | null {
  const s = (text || '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isInputInvalid(text: string): boolean {
  return Boolean((text || '').trim()) && parseInput(text) === null;
}

function hasNameplateData(n: PmNameplate | null | undefined): boolean {
  return Boolean(n && (n.brand || n.model || n.ratedVoltage || n.ratedCurrent || n.ratedPowerKw));
}

/** Jalankan tugas dengan paralelisme terbatas (jaga kuota per menit AI gratis). */
async function runPool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
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

function StatusBadge({ status, small }: { status: PmStatus; small?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full border font-black uppercase tracking-wide ${small ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'} ${STATUS_BADGE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PmPredictiveModal({ isOpen, onClose, document: srcDoc, readOnly = false, onSaved }: PmPredictiveModalProps) {
  const { user } = useAuth();
  useModalScrollLock(isOpen);

  const profile: PmProfile | null = useMemo(
    () => (srcDoc ? resolvePmProfile(srcDoc.createdBy, srcDoc.maintenanceName) : null),
    [srcDoc],
  );
  const maintenanceDate = useMemo(() => (srcDoc ? maintenanceDateOf(srcDoc) : ''), [srcDoc]);
  const account = (srcDoc?.createdBy || '').toLowerCase().trim();

  const [step, setStep] = useState<Step>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState('');
  const [existing, setExisting] = useState<PmPredictiveReport | null>(null);
  const [photos, setPhotos] = useState<PmSourcePhoto[]>([]);
  const [unitLabel, setUnitLabel] = useState('');
  const [lookup, setLookup] = useState<HistoryLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [measures, setMeasures] = useState<MeasureRow[]>([]);
  const [visualRows, setVisualRows] = useState<VisualRow[]>([]);
  const [nameplate, setNameplate] = useState<PmNameplate>({});
  const [nameplatePhotoIndex, setNameplatePhotoIndex] = useState<number | null>(null);
  const [nameplateState, setNameplateState] = useState<RowState>('manual');
  const [confirmed, setConfirmed] = useState(false);
  const [sectionProgress, setSectionProgress] = useState<Record<string, 'pending' | 'running' | 'ai' | 'otomatis'>>({});
  const [report, setReport] = useState<PmPredictiveReport | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState<{ src: string; title: string } | null>(null);
  /** Pilihan engineer per equipment; tanpa pilihan = ikut deteksi (ada angka/observasi). */
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  /** Sedang mengedit angka predictive yang sudah ada (dari langkah Hasil). */
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const runRef = useRef(0);

  const unitKey = useMemo(() => unitKeyOf(account, unitLabel), [account, unitLabel]);
  const photoByIndex = useMemo(() => new Map(photos.map(p => [p.index, p])), [photos]);

  const equipmentGroups: EquipmentGroup[] = useMemo(() => {
    if (!profile) return [];
    const visualOwner = (key: string) => profile.equipment.find(eq => eq.visualKeys?.includes(key))?.id || 'other';
    const defs = [
      ...profile.equipment.map(eq => ({ id: eq.id, name: eq.name, params: eq.params })),
      { id: 'other', name: 'Observasi Visual Lainnya', params: [] as string[] },
    ];
    return defs.map(d => {
      const rows = measures.filter(m => d.params.includes(m.param));
      const visuals = visualRows.filter(v => visualOwner(v.key) === d.id);
      const detected = rows.some(r => r.state === 'manual' || r.input.trim() !== '')
        || visuals.some(v => v.state === 'manual' || v.condition !== 'tidak jelas' || v.observation.trim() !== '');
      return { id: d.id, name: d.name, rows, visuals, detected };
    }).filter(g => g.rows.length || g.visuals.length);
  }, [profile, measures, visualRows]);

  const isIncluded = (g: EquipmentGroup) => selection[g.id] ?? g.detected;

  const plans: CardPlan[] = useMemo(() => {
    if (!profile) return [];
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
  }, [photos, profile]);

  // ─── Buka modal: predictive yang sudah ada langsung ditampilkan ───────────
  useEffect(() => {
    if (!isOpen || !srcDoc) return;
    const run = ++runRef.current;
    setStep('loading');
    setErrorMsg('');
    setExisting(null);
    setReport(null);
    setPhotos([]);
    setMeasures([]);
    setVisualRows([]);
    setNameplate({});
    setNameplatePhotoIndex(null);
    setConfirmed(false);
    setDirty(false);
    setLookup(null);
    setSelection({});
    setEditing(false);
    setUnitLabel((srcDoc.specificDetail || srcDoc.maintenanceName || '').trim());
    (async () => {
      try {
        const found = await getPmPredictive(srcDoc.id);
        if (run !== runRef.current) return;
        if (found) {
          setExisting(found);
          setReport(found);
          setUnitLabel(found.unitLabel);
          setStep('result');
          return;
        }
        if (readOnly) {
          setErrorMsg('Predictive Report belum dibuat untuk laporan ini.');
          setStep('error');
          return;
        }
        await startSetup(run);
      } catch (err: any) {
        if (run !== runRef.current) return;
        setErrorMsg(err?.message || 'Gagal memuat data predictive.');
        setStep('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, srcDoc?.id]);

  const startSetup = useCallback(async (run = runRef.current) => {
    if (!srcDoc) return;
    setStep('loading');
    setProgress('Memuat foto laporan PM...');
    const loaded = await loadPmSourcePhotos(srcDoc.id);
    if (run !== runRef.current) return;
    if (!loaded.length) {
      setErrorMsg('Laporan ini tidak memiliki foto yang bisa dibaca.');
      setStep('error');
      return;
    }
    setPhotos(loaded);
    setStep('setup');
  }, [srcDoc]);

  // ─── Cari predictive sebelumnya untuk unit yang sama ─────────────────────
  useEffect(() => {
    if (!isOpen || !srcDoc || step !== 'setup' || !unitLabel.trim()) return;
    if (lookup?.unitKey === unitKey) return;
    const timer = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const res = await findPreviousPmPredictive(unitKey, maintenanceDate, srcDoc.id);
        setLookup({ unitKey, ...res });
      } catch (err) {
        console.warn('Cari predictive sebelumnya gagal:', err);
        setLookup({ unitKey, previous: null, total: 0, newerExists: false });
      } finally {
        setLookupLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [isOpen, srcDoc, step, unitKey, unitLabel, maintenanceDate, lookup?.unitKey]);

  // ─── Langkah 2: AI membaca foto ──────────────────────────────────────────
  const initRows = (state: RowState) => {
    if (!profile) return;
    setMeasures(plans.filter(p => p.kind === 'measurement').map(p => ({
      photoIndex: p.photo.index, cardLabel: p.photo.description, param: p.param!,
      aiValue: null, aiConfidence: 'rendah', aiConverted: null, input: '', state,
    })));
    setVisualRows(plans.filter(p => p.kind === 'visual').map(p => ({
      photoIndex: p.photo.index, cardLabel: p.photo.description || `Foto #${p.photo.index}`, key: p.visualKey!,
      condition: 'tidak jelas', observation: '', aiConfidence: 'rendah', state,
    })));
    const np = plans.find(p => p.kind === 'nameplate');
    setNameplatePhotoIndex(np ? np.photo.index : null);
    setNameplateState(np ? state : 'manual');
    setNameplate({});
  };

  const applyResults = (results: Awaited<ReturnType<typeof extractBatchAI>>, failedIdx: number[]) => {
    if (!profile) return;
    const byIndex = new Map(results.map(r => [r.index, r]));
    const failed = new Set(failedIdx);
    setMeasures(prev => prev.map(row => {
      if (failed.has(row.photoIndex)) return { ...row, state: 'failed', note: 'AI gagal membaca foto ini; isi manual.' };
      const r = byIndex.get(row.photoIndex);
      if (!r) return row;
      const conv = convertToCanonical(r.value, r.unit, profile.params[row.param].unit);
      return {
        ...row,
        aiValue: r.value, aiUnit: r.unit, aiRaw: r.raw, aiConfidence: r.confidence,
        aiConverted: conv.value,
        input: conv.value === null ? '' : String(conv.value),
        note: conv.note || (r.value === null ? (r.observation || 'Angka tidak terbaca; isi manual.') : r.observation || undefined),
        state: 'done',
      };
    }));
    setVisualRows(prev => prev.map(row => {
      if (failed.has(row.photoIndex)) return { ...row, state: 'failed' };
      const r = byIndex.get(row.photoIndex);
      if (!r) return row;
      return { ...row, condition: (r.condition || 'tidak jelas') as PmVisualCondition, observation: r.observation || '', aiConfidence: r.confidence, state: 'done' };
    }));
    const npIndex = plans.find(p => p.kind === 'nameplate')?.photo.index;
    if (npIndex !== undefined) {
      if (failed.has(npIndex)) setNameplateState('failed');
      const r = byIndex.get(npIndex);
      if (r) {
        if (r.nameplate) setNameplate({ ...r.nameplate, source: 'foto' });
        setNameplateState('done');
      }
    }
  };

  const runExtraction = async (onlyIndexes?: Set<number>) => {
    if (!profile || !srcDoc) return;
    const run = runRef.current;
    if (onlyIndexes) {
      setMeasures(prev => prev.map(r => (onlyIndexes.has(r.photoIndex) ? { ...r, state: 'pending', note: undefined } : r)));
      setVisualRows(prev => prev.map(r => (onlyIndexes.has(r.photoIndex) ? { ...r, state: 'pending' } : r)));
    } else {
      initRows('pending');
      setSelection({});
      setEditing(false);
    }
    setStep('reading');
    const targets = plans.filter(p => !onlyIndexes || onlyIndexes.has(p.photo.index));
    const items: PmExtractRequestItem[] = [];
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i];
      setProgress(`Menyiapkan foto ${i + 1} dari ${targets.length}...`);
      const def = p.param ? profile.params[p.param] : undefined;
      items.push({
        index: p.photo.index,
        label: p.photo.description || `Foto #${p.photo.index}`,
        kind: p.kind,
        expected: def?.expected || (p.kind === 'visual' ? profile.visualLabels[p.visualKey || ''] || 'Kondisi fisik yang terlihat' : undefined),
        unit: def?.unit,
        imageBase64: await prepareImageForAI(p.photo.photoBase64),
      });
      if (run !== runRef.current) return;
    }
    const batches = batchExtractItems(items);
    let done = 0;
    setProgress(`AI membaca foto (0 dari ${batches.length} kelompok)...`);
    await runPool(batches.map(batch => async () => {
      try {
        const results = await extractBatchAI(profile.unitType, unitLabel, batch);
        if (run === runRef.current) applyResults(results, []);
      } catch (err: any) {
        console.warn('Baca foto AI gagal:', err);
        if (run === runRef.current) applyResults([], batch.map(b => b.index));
        toast.error(`Sebagian foto gagal dibaca AI: ${err?.message || 'error'}`);
      }
      done++;
      if (run === runRef.current) setProgress(`AI membaca foto (${done} dari ${batches.length} kelompok)...`);
    }), 2);
    if (run !== runRef.current) return;
    setConfirmed(false);
    setStep('confirm');
  };

  const startManual = () => {
    initRows('manual');
    setSelection({});
    setEditing(false);
    setConfirmed(false);
    setStep('confirm');
  };

  /** Buka kembali angka predictive tersimpan untuk dikoreksi, lalu analisis ulang. */
  const editReadings = async () => {
    if (!report || !srcDoc || !profile) return;
    const run = ++runRef.current;
    setStep('loading');
    setProgress('Memuat foto laporan PM...');
    let loaded = photos;
    if (!loaded.length) {
      try {
        loaded = await loadPmSourcePhotos(srcDoc.id);
      } catch (err) {
        console.warn('Foto laporan PM tidak bisa dimuat untuk edit:', err);
        loaded = [];
      }
      if (run !== runRef.current) return;
      setPhotos(loaded);
    }
    setUnitLabel(report.unitLabel);
    setMeasures(report.readings.map(r => ({
      photoIndex: r.photoIndex, cardLabel: r.cardLabel, param: r.param,
      aiValue: r.aiValue, aiUnit: r.aiUnit, aiRaw: r.aiRaw, aiConfidence: r.aiConfidence,
      aiConverted: convertToCanonical(r.aiValue, r.aiUnit, r.unit).value,
      input: r.value === null ? '' : String(r.value),
      note: r.note,
      state: r.aiRaw || r.aiValue !== null ? 'done' : 'manual',
    })));
    setVisualRows(report.visuals.map(v => ({
      photoIndex: v.photoIndex, cardLabel: v.cardLabel, key: v.key, condition: v.condition,
      observation: v.observation, aiConfidence: v.aiConfidence, state: 'done',
    })));
    setNameplate(report.nameplate || {});
    setNameplatePhotoIndex(loaded.find(p => matchCard(profile, p.description)?.kind === 'nameplate')?.index ?? null);
    setNameplateState('done');
    const excluded = new Set(report.excludedEquipment || []);
    const analysed = new Set(report.sections.map(s => s.id));
    // Equipment tanpa data di predictive lama dibiarkan ikut deteksi otomatis.
    setSelection(Object.fromEntries([
      ...[...excluded].map(id => [id, false] as const),
      ...[...analysed].filter(id => !excluded.has(id)).map(id => [id, true] as const),
    ]));
    setConfirmed(false);
    setEditing(true);
    setStep('confirm');
  };

  const cancelEdit = () => {
    runRef.current++;
    setEditing(false);
    setStep('result');
  };

  // ─── Langkah 4: hitung + narasi AI ───────────────────────────────────────
  const runAnalysis = async () => {
    if (!profile || !srcDoc || !user) return;
    const included = equipmentGroups.filter(isIncluded);
    if (!included.length) {
      toast.error('Pilih minimal satu equipment untuk dianalisis.');
      return;
    }
    const includedIds = new Set(included.map(g => g.id));
    const excludedIds = equipmentGroups.filter(g => !includedIds.has(g.id)).map(g => g.id);
    const includedParams = new Set(included.flatMap(g => g.rows.map(r => r.param)));
    const includedVisuals = new Set(included.flatMap(g => g.visuals.map(v => v.photoIndex)));
    const run = runRef.current;
    setStep('analyzing');
    setProgress('Menghitung status, tren, dan proyeksi...');

    let hist = lookup;
    if (!hist || hist.unitKey !== unitKey) {
      const res = await findPreviousPmPredictive(unitKey, maintenanceDate, srcDoc.id).catch(() => ({ previous: null, total: 0, newerExists: false }));
      hist = { unitKey, ...res };
      setLookup(hist);
    }
    const previous = hist.previous;

    const finalNameplate: PmNameplate = hasNameplateData(nameplate)
      ? { ...nameplate, source: nameplate.source || 'manual' }
      : hasNameplateData(previous?.nameplate) ? { ...previous!.nameplate, source: 'predictive sebelumnya' } : nameplate;

    const readings: PmReading[] = measures.map(m => {
      const value = parseInput(m.input);
      return {
        param: m.param, photoIndex: m.photoIndex, cardLabel: m.cardLabel, value, unit: profile.params[m.param].unit,
        aiValue: m.aiValue, aiUnit: m.aiUnit, aiRaw: m.aiRaw, aiConfidence: m.aiConfidence,
        edited: value !== m.aiConverted, note: m.note,
      };
    });
    // Angka equipment yang tidak dipilih tetap disimpan di readings, tetapi tidak masuk
    // riwayat (riwayat lamanya dibawa apa adanya) dan tidak dianalisis.
    const values: Record<string, number | null> = {};
    for (const r of readings) if (includedParams.has(r.param)) values[r.param] = r.value;
    const allValues = computeDerived(profile, values, finalNameplate);
    const history = mergeHistory(previous?.history, allValues, maintenanceDate, srcDoc.id);
    const visuals: PmVisualObservation[] = visualRows.map(v => ({
      key: v.key, photoIndex: v.photoIndex, cardLabel: v.cardLabel, condition: v.condition, observation: v.observation.trim(), aiConfidence: v.aiConfidence,
    }));
    const sections = buildSections(profile, allValues, history, visuals.filter(v => includedVisuals.has(v.photoIndex)), maintenanceDate, finalNameplate)
      .filter(s => includedIds.has(s.id));
    if (!sections.length) {
      toast.error('Belum ada angka atau observasi yang bisa dianalisis.');
      setStep('confirm');
      return;
    }

    setSectionProgress(Object.fromEntries(sections.map(s => [s.id, 'pending'])));
    const unitInfo = { unitType: profile.unitType, unitLabel: unitLabel.trim(), maintenanceName: srcDoc.maintenanceName, date: maintenanceDate, nameplate: finalNameplate };
    setProgress('AI menulis analisis per equipment...');
    const narrated: PmEquipmentSection[] = await runPool(sections.map(section => async () => {
      setSectionProgress(p => ({ ...p, [section.id]: 'running' }));
      try {
        const narrative = await analyzeSectionAI(sectionAIContext(unitInfo, section));
        setSectionProgress(p => ({ ...p, [section.id]: 'ai' }));
        return { ...section, narrative, narrativeSource: 'ai' as const };
      } catch (err) {
        console.warn(`Narasi AI ${section.id} gagal:`, err);
        setSectionProgress(p => ({ ...p, [section.id]: 'otomatis' }));
        return { ...section, narrative: fallbackNarrative(section), narrativeSource: 'otomatis' as const };
      }
    }), 2);
    if (run !== runRef.current) return;

    setProgress('AI menulis ringkasan eksekutif...');
    let summary: PmPredictiveReport['summary'];
    try {
      const s = await analyzeSummaryAI(summaryAIContext(unitInfo, narrated));
      summary = { ...s, source: 'ai' };
    } catch {
      summary = { ...fallbackSummary(unitLabel.trim(), narrated), source: 'otomatis' };
    }
    if (run !== runRef.current) return;

    const [yyyy, mm] = maintenanceDate.split('-');
    // Akun unit (mis. fcu@gmail.com) bukan nama orang: penanda tangan dibawa dari predictive
    // kuartal sebelumnya, cukup dikoreksi sekali di langkah Hasil.
    const carriedPreparer = previous?.signatures?.preparedBy?.name ? previous.signatures.preparedBy : null;
    const next: PmPredictiveReport = {
      id: srcDoc.id,
      reportNumber: existing?.reportNumber || report?.reportNumber || `PDM-PM/DME-NDC/${yyyy}/${mm}/${srcDoc.id.slice(-4).toUpperCase()}`,
      profileId: profile.id,
      profileVersion: profile.version,
      unitType: profile.unitType,
      account,
      unitLabel: unitLabel.trim(),
      unitKey,
      maintenanceName: srcDoc.maintenanceName,
      maintenanceDate,
      sourceDocId: srcDoc.id,
      sourceCollection: 'pdf_documents',
      sourceFileName: srcDoc.fileName,
      nameplate: finalNameplate,
      readings,
      visuals,
      history,
      previousReportId: previous?.id || null,
      previousMaintenanceDate: previous?.maintenanceDate || null,
      sections: narrated,
      excludedEquipment: excludedIds,
      overallStatus: worstStatus(narrated.map(effectiveStatus)),
      summary,
      // Saat edit angka, penanda tangan yang sudah dikoreksi di langkah Hasil tetap dipakai.
      signatures: report?.signatures || existing?.signatures || {
        authorName: AUTHOR_NAME,
        preparedBy: carriedPreparer || { name: 'Asep Mohammad Fauzi', title: '(Electrical Engineer)' },
        reviewedBy: { name: 'Arif Budiman', title: '(Technical Manager)' },
        acknowledgedBy1: { name: 'Habib Mulyana', title: '(Chief Engineer)' },
        acknowledgedBy2: { name: 'Supriyatno', title: '(Facility manager)' },
        approvedBy: { name: 'Budi Susanto', title: '(Assistant manager HDC Facility Management)' },
      },
      generatedBy: user.email || '',
      createdAt: existing?.createdAt,
    };
    setReport(next);
    setDirty(true);
    setEditing(false);
    setStep('result');
  };

  // ─── Simpan & PDF ────────────────────────────────────────────────────────
  const updateReport = (fn: (r: PmPredictiveReport) => PmPredictiveReport) => {
    setReport(r => {
      if (!r) return r;
      const updated = fn(r);
      return { ...updated, overallStatus: worstStatus(updated.sections.map(effectiveStatus)) };
    });
    setDirty(true);
  };

  const updateSection = (id: string, fn: (s: PmEquipmentSection) => PmEquipmentSection) =>
    updateReport(r => ({ ...r, sections: r.sections.map(s => (s.id === id ? fn(s) : s)) }));

  const save = async (): Promise<boolean> => {
    if (!report || readOnly) return true;
    setSaving(true);
    try {
      await savePmPredictive(report, !existing);
      const marker: PmPredictiveMarker = { reportNumber: report.reportNumber, overallStatus: report.overallStatus, updatedAt: new Date().toISOString() };
      setExisting(report);
      setDirty(false);
      onSaved?.(marker);
      toast.success('Predictive Report tersimpan');
      return true;
    } catch (err: any) {
      console.error('Simpan predictive gagal:', err);
      toast.error(`Gagal menyimpan: ${err?.message || 'error'}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** Foto kartu PM untuk dokumen; dimuat sekali lalu dipakai ulang untuk PDF & DOCX. */
  const photosForExport = async () => {
    if (photos.length || !srcDoc) return photos;
    try {
      const loaded = await loadPmSourcePhotos(srcDoc.id);
      setPhotos(loaded);
      return loaded;
    } catch (err) {
      console.warn('Foto laporan PM tidak bisa dimuat untuk ekspor:', err);
      return [];
    }
  };

  const download = async (kind: 'pdf' | 'docx') => {
    if (!report || exporting) return;
    if (dirty && !readOnly && !(await save())) return;
    setExporting(kind);
    try {
      const exportPhotos = await photosForExport();
      if (kind === 'pdf') await exportPmPredictiveToPdf(report, exportPhotos);
      else await exportPmPredictiveToDocx(report, exportPhotos);
    } finally {
      setExporting(null);
    }
  };

  const regenerate = async () => {
    setReport(null);
    setDirty(false);
    try {
      await startSetup();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memuat foto laporan PM.');
      setStep('error');
    }
  };

  const close = () => {
    if (dirty && !readOnly && !window.confirm('Predictive Report belum disimpan. Tutup dan buang perubahan?')) return;
    runRef.current++;
    onClose();
  };

  if (!isOpen || !srcDoc) return null;

  // ─── Render ──────────────────────────────────────────────────────────────
  const stepIndex = { loading: 0, setup: 0, reading: 1, confirm: 1, analyzing: 2, result: 3, error: 0 }[step];
  const steps = ['Siapkan', 'Konfirmasi Angka', 'Analisis', 'Hasil'];
  const includedGroups = equipmentGroups.filter(isIncluded);
  const includedRows = includedGroups.flatMap(g => g.rows);
  const pendingRows = includedRows.filter(m => m.state === 'failed' || (m.state !== 'manual' && m.input === '')).length;
  const lowConfidence = includedRows.filter(m => m.state === 'done' && m.aiConfidence !== 'tinggi').length;
  const invalidInputs = includedRows.filter(m => isInputInvalid(m.input)).length;
  const failedIndexes = new Set([
    ...measures.filter(m => m.state === 'failed').map(m => m.photoIndex),
    ...visualRows.filter(v => v.state === 'failed').map(v => v.photoIndex),
    ...(nameplateState === 'failed' && nameplatePhotoIndex !== null ? [nameplatePhotoIndex] : []),
  ]);

  const Thumb = ({ index, title }: { index: number; title: string }) => {
    const p = photoByIndex.get(index);
    if (!p) return <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Camera className="w-4 h-4 text-slate-400" /></div>;
    return (
      <button type="button" onClick={() => setZoom({ src: p.photoBase64, title })} className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-zoom-in" title="Perbesar foto">
        <img src={p.photoBase64} alt={title} className="w-full h-full object-cover" />
      </button>
    );
  };

  const renderSetup = () => {
    const mapped = plans.filter(p => p.kind === 'measurement').length;
    const others = plans.filter(p => p.kind === 'visual' && p.visualKey?.startsWith('other-'));
    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <p className="font-black text-slate-800 text-sm">{srcDoc.maintenanceName}</p>
            <p className="text-slate-500">Tanggal PM: <strong className="text-slate-700">{fmtDate(maintenanceDate)}</strong></p>
            <p className="text-slate-500">Jenis unit: <strong className="text-slate-700">{profile?.unitType}</strong></p>
            <p className="text-slate-500">{photos.length} foto · {mapped} pengukuran dikenali{plans.some(p => p.kind === 'nameplate') ? ' · nameplate' : ''}{others.length ? ` · ${others.length} kartu lain dinilai visual` : ''}</p>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs space-y-2">
            <label className="block font-bold text-slate-700">
              Nama unit untuk riwayat
              <input
                value={unitLabel}
                onChange={e => setUnitLabel(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="mis. FCU-01 Lt.2"
              />
            </label>
            <div className="flex items-start gap-1.5 text-slate-600">
              <History className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-500" />
              {lookupLoading || !lookup || lookup.unitKey !== unitKey ? (
                <span>Mencari predictive sebelumnya...</span>
              ) : lookup.previous ? (
                <span>Riwayat ditemukan: predictive PM <strong>{fmtDate(lookup.previous.maintenanceDate)}</strong> ({lookup.total} predictive untuk unit ini). Tren dihitung dari riwayat tersebut.</span>
              ) : (
                <span>Belum ada predictive sebelumnya untuk unit ini, jadi laporan ini menjadi <strong>baseline</strong>. Pastikan penulisan nama unit sama dengan kuartal lalu.</span>
              )}
            </div>
            {lookup?.unitKey === unitKey && lookup.newerExists && (
              <p className="text-amber-700 font-semibold">Ada predictive yang lebih baru untuk unit ini; laporan ini akan menjadi titik riwayat yang lebih lama.</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {plans.map(p => (
            <span key={p.photo.index} className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${p.kind === 'measurement' ? 'bg-blue-50 text-blue-700 border-blue-200' : p.kind === 'nameplate' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              #{p.photo.index} {p.photo.description || 'Tanpa label'}{p.kind === 'measurement' && profile ? ` → ${profile.params[p.param!].label}` : ''}
            </span>
          ))}
        </div>

        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
          AI membaca angka dari display alat ukur pada foto. Setelah itu Anda wajib memeriksa setiap angka sebelum masuk ke riwayat, karena satu angka yang salah akan memengaruhi tren kuartal berikutnya.
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button type="button" onClick={startManual} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer">
            Isi angka manual tanpa AI
          </button>
          <button
            type="button"
            onClick={() => runExtraction()}
            disabled={!unitLabel.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 cursor-pointer"
          >
            <Bot className="w-4 h-4" /> Baca angka dari foto (AI) <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderMeasureRow = (m: MeasureRow) => {
    if (!profile) return null;
    const def = profile.params[m.param];
    const flagged = m.state === 'failed' || (m.state === 'done' && (m.aiConfidence !== 'tinggi' || m.input === ''));
    return (
      <div key={m.photoIndex} className={`flex items-center gap-3 p-2.5 ${flagged ? 'bg-amber-50/60' : ''}`}>
        <Thumb index={m.photoIndex} title={`${m.cardLabel} — ${def.label}`} />
        <div className="flex-1 min-w-0 text-xs">
          <p className="font-bold text-slate-800 truncate">{def.label} <span className="font-medium text-slate-400">· kartu "{m.cardLabel}"</span></p>
          {m.state === 'done' && (
            <p className="text-slate-500 mt-0.5 flex flex-wrap items-center gap-1">
              AI: <strong className="text-slate-700">{m.aiRaw || (m.aiValue !== null ? `${m.aiValue} ${m.aiUnit || ''}` : 'tidak terbaca')}</strong>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${CONFIDENCE_BADGE[m.aiConfidence]}`}>{m.aiConfidence}</span>
            </p>
          )}
          {m.note && <p className="text-[10px] text-amber-700 mt-0.5">{m.note}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            value={m.input}
            onChange={e => setMeasures(prev => prev.map(r => (r.photoIndex === m.photoIndex ? { ...r, input: e.target.value } : r)))}
            inputMode="decimal"
            disabled={m.state === 'pending'}
            className={`w-20 sm:w-24 px-2 py-1.5 rounded-lg border text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-indigo-300 ${isInputInvalid(m.input) ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
            placeholder="-"
            aria-label={`Nilai ${def.label}`}
          />
          <span className="w-12 text-[11px] font-bold text-slate-500">{def.unit}</span>
        </div>
      </div>
    );
  };

  const renderVisualRow = (v: VisualRow) => (
    <div key={v.photoIndex} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2.5">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Thumb index={v.photoIndex} title={v.cardLabel} />
        <p className="text-xs font-bold text-slate-800 truncate">{v.cardLabel}</p>
      </div>
      <select
        value={v.condition}
        onChange={e => setVisualRows(prev => prev.map(r => (r.photoIndex === v.photoIndex ? { ...r, condition: e.target.value as PmVisualCondition } : r)))}
        className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white"
      >
        {(['baik', 'perlu perhatian', 'buruk', 'tidak jelas'] as const).map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <input
        value={v.observation}
        onChange={e => setVisualRows(prev => prev.map(r => (r.photoIndex === v.photoIndex ? { ...r, observation: e.target.value } : r)))}
        placeholder="Keterangan kondisi"
        className="sm:w-72 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
    </div>
  );

  const renderConfirm = () => {
    if (!profile) return null;
    return (
      <div className="space-y-4">
        {editing && (
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-900 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <span>Mengedit angka predictive yang sudah tersimpan. Setelah dianalisis ulang, status, tren, dan narasi disusun ulang dari angka terbaru.</span>
            <button type="button" onClick={cancelEdit} className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-white font-bold text-indigo-700 shrink-0 cursor-pointer">Batal edit</button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800">{includedGroups.length} dari {equipmentGroups.length} equipment dianalisis</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">{includedRows.length} angka</span>
          {lowConfidence > 0 && <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">{lowConfidence} keyakinan AI tidak tinggi, cek fotonya</span>}
          {pendingRows > 0 && <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700">{pendingRows} kosong / gagal dibaca</span>}
          {failedIndexes.size > 0 && (
            <button type="button" onClick={() => runExtraction(failedIndexes)} className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white flex items-center gap-1 cursor-pointer">
              <RotateCw className="w-3 h-3" /> Baca ulang {failedIndexes.size} foto gagal
            </button>
          )}
        </div>

        <p className="text-[11px] text-slate-500">
          Centang equipment yang ingin dimasukkan ke predictive. Equipment yang angka atau kondisinya ditemukan AI sudah dicentang otomatis.
        </p>

        {equipmentGroups.map(g => {
          const on = isIncluded(g);
          const filled = g.rows.filter(r => r.input.trim() !== '').length;
          const info = [
            g.rows.length ? `${filled}/${g.rows.length} angka` : '',
            g.visuals.length ? `${g.visuals.length} observasi` : '',
          ].filter(Boolean).join(' · ');
          return (
            <div key={g.id} className={`rounded-2xl border overflow-hidden ${on ? 'border-slate-200' : 'border-dashed border-slate-300'}`}>
              <label className={`px-3 py-2 border-b flex items-center gap-2 cursor-pointer ${on ? 'bg-slate-50 border-slate-200' : 'bg-white border-transparent'}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={e => setSelection(s => ({ ...s, [g.id]: e.target.checked }))}
                  className="w-4 h-4 accent-indigo-600 shrink-0"
                  aria-label={`Masukkan ${g.name} ke predictive`}
                />
                <span className={`flex-1 min-w-0 text-xs font-black ${on ? 'text-slate-800' : 'text-slate-400'}`}>{g.name}</span>
                <span className="text-[10px] font-semibold text-slate-500 shrink-0">{info}{g.detected && !editing && g.rows.some(r => r.state === 'done') ? ' · terdeteksi AI' : ''}</span>
              </label>
              {on ? (
                <div className="divide-y divide-slate-100">
                  {g.rows.map(renderMeasureRow)}
                  {g.visuals.map(renderVisualRow)}
                </div>
              ) : (
                <p className="px-3 pb-2.5 text-[11px] text-slate-500">Tidak dimasukkan ke predictive. Angkanya tetap disimpan, tetapi tidak dianalisis dan riwayat equipment ini tidak diperbarui.</p>
              )}
            </div>
          );
        })}

        <div className="rounded-2xl border border-violet-200 overflow-hidden">
          <div className="px-3 py-2 bg-violet-50 border-b border-violet-200 text-xs font-black text-violet-900 flex items-center justify-between gap-2">
            <span>Nameplate (rating pabrik)</span>
            {nameplateState === 'done' && <span className="text-[10px] font-semibold text-violet-700">dibaca AI, periksa kembali</span>}
          </div>
          <div className="p-3 flex gap-3">
            {nameplatePhotoIndex !== null && <Thumb index={nameplatePhotoIndex} title="Nameplate" />}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              {([
                ['brand', 'Merk', 'text'], ['model', 'Model', 'text'], ['ratedVoltage', 'Tegangan (V)', 'num'], ['ratedCurrent', 'Arus FLA (A)', 'num'],
                ['ratedPowerKw', 'Daya (kW)', 'num'], ['phase', 'Fasa', 'num'], ['frequencyHz', 'Frek. (Hz)', 'num'], ['serial', 'Serial', 'text'],
              ] as const).map(([key, lbl, kind]) => (
                <label key={key} className="font-bold text-slate-600">
                  {lbl}
                  <input
                    value={(nameplate as any)[key] ?? ''}
                    inputMode={kind === 'num' ? 'decimal' : undefined}
                    onChange={e => setNameplate(n => ({ ...n, [key]: kind === 'num' ? parseInput(e.target.value) : e.target.value, source: 'manual' }))}
                    className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </label>
              ))}
            </div>
          </div>
          {!hasNameplateData(nameplate) && lookup?.previous && hasNameplateData(lookup.previous.nameplate) && (
            <p className="px-3 pb-3 text-[11px] text-violet-800">Kosong: akan memakai nameplate dari predictive sebelumnya ({[lookup.previous.nameplate.brand, lookup.previous.nameplate.model].filter(Boolean).join(' ') || 'data rating'}).</p>
          )}
          {!hasNameplateData(nameplate) && (!lookup?.previous || !hasNameplateData(lookup.previous.nameplate)) && (
            <p className="px-3 pb-3 text-[11px] text-slate-500">Tanpa arus FLA nameplate, beban motor terhadap rating tidak bisa dinilai.</p>
          )}
        </div>

        <label className="flex items-start gap-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-600" />
          Saya sudah mencocokkan setiap angka dengan fotonya. Angka di atas benar dan siap masuk riwayat unit.
        </label>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          {editing && (
            <button type="button" onClick={cancelEdit} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer">
              Batal edit
            </button>
          )}
          <button
            type="button"
            onClick={runAnalysis}
            disabled={!confirmed || invalidInputs > 0 || includedGroups.length === 0}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
          >
            <Bot className="w-4 h-4" /> Analisis prediktif <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderResult = () => {
    if (!report) return null;
    const ta = 'w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-700';
    return (
      <div className="space-y-4">
        <div className={`p-4 rounded-2xl border ${STATUS_BADGE[report.overallStatus]}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Status keseluruhan · {report.unitLabel}</p>
              <p className="text-lg font-black">{STATUS_LABEL[report.overallStatus]}</p>
            </div>
            <div className="text-[11px] text-slate-600 sm:text-right">
              <p>No. {report.reportNumber}</p>
              <p>PM {fmtDate(report.maintenanceDate)} · {report.previousMaintenanceDate ? `riwayat sejak PM ${fmtDate(report.previousMaintenanceDate)}` : 'baseline'}</p>
            </div>
          </div>
          {(report.excludedEquipment || []).length > 0 && (
            <p className="mt-2 text-[11px] text-slate-600">
              Tidak dianalisis: {(report.excludedEquipment || []).map(id => (id === 'other' ? 'Observasi Visual Lainnya' : profile?.equipment.find(e => e.id === id)?.name || id)).join(', ')}
            </p>
          )}
        </div>

        <div className="p-3 rounded-2xl border border-slate-200 space-y-2">
          <p className="text-xs font-black text-slate-800">Ringkasan eksekutif {report.summary.source === 'otomatis' && <span className="font-semibold text-amber-700">(disusun otomatis, AI tidak tersedia)</span>}</p>
          <textarea rows={4} disabled={readOnly} value={report.summary.ringkasan} onChange={e => updateReport(r => ({ ...r, summary: { ...r.summary, ringkasan: e.target.value } }))} className={ta} />
          <label className="block text-[11px] font-bold text-slate-600">Prioritas tindakan (satu per baris)
            <textarea rows={3} disabled={readOnly} value={report.summary.prioritas.join('\n')} onChange={e => updateReport(r => ({ ...r, summary: { ...r.summary, prioritas: e.target.value.split('\n') } }))} className={ta} />
          </label>
        </div>

        {report.sections.map(section => {
          const status = effectiveStatus(section);
          return (
            <div key={section.id} className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">{section.name}</p>
                  <p className="text-[10px] text-slate-500">{section.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={status} />
                  {!readOnly && (
                    <select
                      value={section.statusOverride || ''}
                      onChange={e => updateSection(section.id, s => ({ ...s, statusOverride: (e.target.value || null) as PmStatus | null }))}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold bg-white"
                      title="Koreksi status oleh engineer"
                    >
                      <option value="">Status sistem ({STATUS_LABEL[section.status]})</option>
                      {(['normal', 'watch', 'warning', 'alarm'] as const).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {section.params.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] min-w-[640px]">
                    <thead className="bg-white text-slate-500 text-[10px] uppercase">
                      <tr>
                        <th className="text-left px-3 py-1.5">Parameter</th>
                        <th className="text-right px-2 py-1.5">Nilai</th>
                        <th className="text-right px-2 py-1.5">Sebelumnya</th>
                        <th className="text-left px-2 py-1.5">Batas acuan</th>
                        <th className="text-left px-2 py-1.5">Status</th>
                        <th className="text-left px-3 py-1.5">Tren / proyeksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {section.params.map(p => {
                        const unit = p.unit === '%' ? '%' : ` ${p.unit}`;
                        return (
                          <tr key={p.param} className="align-top">
                            <td className="px-3 py-1.5 font-semibold text-slate-800">{p.label}</td>
                            <td className="px-2 py-1.5 text-right font-black text-slate-900 whitespace-nowrap">{p.value === null ? '-' : `${fmtNum(p.value)}${unit}`}</td>
                            <td className="px-2 py-1.5 text-right text-slate-500 whitespace-nowrap">{p.previous ? `${fmtNum(p.previous.value)}${unit}` : '-'}</td>
                            <td className="px-2 py-1.5 text-slate-500">{p.limitText}</td>
                            <td className="px-2 py-1.5">{p.value === null ? <span className="text-slate-400">-</span> : p.status === 'unknown' ? <span className="text-slate-400 font-bold">Info</span> : <StatusBadge status={p.status} small />}</td>
                            <td className="px-3 py-1.5 text-slate-600">
                              {p.projection ? (
                                <span className="font-bold text-orange-700">Batas {p.projection.level === 'alarm' ? 'kritis' : 'peringatan'} ~{fmtMonthYear(p.projection.date)} <span className="font-medium">({p.confidence})</span></span>
                              ) : p.note}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {section.visuals.length > 0 && (
                <div className="px-3 py-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-0.5">
                  {section.visuals.map(v => <p key={v.photoIndex}><strong className="text-slate-800">{v.cardLabel}:</strong> {v.condition}{v.observation ? ` — ${v.observation}` : ''}</p>)}
                </div>
              )}

              <div className="p-3 border-t border-slate-100 space-y-2">
                {section.narrativeSource === 'otomatis' && <p className="text-[10px] font-bold text-amber-700">Narasi disusun otomatis karena AI tidak tersedia; silakan disempurnakan.</p>}
                {([['kondisi', 'Kondisi saat ini'], ['analisisTren', 'Analisis tren'], ['prediksiRisiko', 'Prediksi & risiko']] as const).map(([key, lbl]) => (
                  <label key={key} className="block text-[11px] font-bold text-slate-600">{lbl}
                    <textarea rows={3} disabled={readOnly} value={section.narrative[key]} onChange={e => updateSection(section.id, s => ({ ...s, narrative: { ...s.narrative, [key]: e.target.value } }))} className={ta} />
                  </label>
                ))}
                <label className="block text-[11px] font-bold text-slate-600">Rekomendasi (satu per baris)
                  <textarea rows={3} disabled={readOnly} value={section.narrative.rekomendasi.join('\n')} onChange={e => updateSection(section.id, s => ({ ...s, narrative: { ...s.narrative, rekomendasi: e.target.value.split('\n') } }))} className={ta} />
                </label>
              </div>
            </div>
          );
        })}

        {!readOnly && (
          <div className="p-3 rounded-2xl border border-slate-200 grid sm:grid-cols-2 gap-2 text-[11px]">
            <label className="font-bold text-slate-600">Prepared by (nama)
              <input value={report.signatures.preparedBy.name} onChange={e => updateReport(r => ({ ...r, signatures: { ...r.signatures, preparedBy: { ...r.signatures.preparedBy, name: e.target.value } } }))} className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold" />
            </label>
            <label className="font-bold text-slate-600">Jabatan
              <input value={report.signatures.preparedBy.title} onChange={e => updateReport(r => ({ ...r, signatures: { ...r.signatures, preparedBy: { ...r.signatures.preparedBy, title: e.target.value } } }))} className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold" />
            </label>
          </div>
        )}
      </div>
    );
  };

  // Portal ke body: kartu Arsip Dokumen berada di dalam elemen ber-transform (animasi),
  // yang membuat position: fixed terkurung di kolom konten dan tertutup sidebar.
  return createPortal(
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Predictive Report dari laporan PM">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col text-slate-800 overflow-hidden"
      >
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-indigo-700 via-blue-700 to-sky-600 text-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-sky-100">Predictive Report · dari laporan PM</p>
              <h2 className="text-base sm:text-lg font-black truncate">{unitLabel || srcDoc.maintenanceName}</h2>
            </div>
            <button type="button" onClick={close} className="p-2 rounded-xl hover:bg-white/15 cursor-pointer" aria-label="Tutup">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-1 sm:gap-2 text-[10px] sm:text-[11px] font-bold overflow-x-auto">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-1 sm:gap-2 shrink-0">
                <span className={`px-2 py-1 rounded-lg ${i === stepIndex ? 'bg-white text-indigo-700' : i < stepIndex ? 'bg-white/25 text-white' : 'bg-white/10 text-sky-100'}`}>{i + 1}. {s}</span>
                {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-sky-200" />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {!profile && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">Predictive Report dari laporan PM saat ini baru tersedia untuk unit FCU.</div>
          )}
          {profile && (step === 'loading' || step === 'reading' || step === 'analyzing') && (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm font-bold text-slate-700">{progress || 'Memuat...'}</p>
              {step === 'analyzing' && Object.keys(sectionProgress).length > 0 && (
                <div className="mt-2 space-y-1 text-xs text-left">
                  {Object.entries(sectionProgress).map(([id, st]) => (
                    <p key={id} className="flex items-center gap-2">
                      {st === 'running' || st === 'pending' ? <Loader2 className={`w-3.5 h-3.5 ${st === 'running' ? 'animate-spin text-indigo-500' : 'text-slate-300'}`} /> : st === 'ai' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                      <span className="font-semibold">{profile.equipment.find(e => e.id === id)?.name || 'Observasi visual lainnya'}</span>
                      {st === 'otomatis' && <span className="text-amber-700">(narasi otomatis)</span>}
                    </p>
                  ))}
                </div>
              )}
              {step === 'reading' && <p className="text-[11px] text-slate-500 max-w-sm">Layanan AI gratis dibatasi per menit; proses ini bisa memakan 1-2 menit.</p>}
            </div>
          )}
          {profile && step === 'error' && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {errorMsg}
            </div>
          )}
          {profile && step === 'setup' && renderSetup()}
          {profile && step === 'confirm' && renderConfirm()}
          {profile && step === 'result' && renderResult()}
        </div>

        {step === 'result' && report && (
          <div className="px-3 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between shrink-0">
            <p className="text-[11px] text-slate-500">
              {readOnly ? 'Mode lihat saja.' : dirty ? 'Ada perubahan yang belum disimpan.' : 'Tersimpan.'}
            </p>
            <div className="grid grid-cols-2 sm:flex gap-2">
              {!readOnly && (
                <button type="button" onClick={editReadings} disabled={saving || !!exporting} className="px-3 py-2 rounded-xl border border-indigo-200 bg-white text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-50 disabled:opacity-50 cursor-pointer">
                  <PencilLine className="w-3.5 h-3.5" /> Edit angka & equipment
                </button>
              )}
              {!readOnly && (
                <button type="button" onClick={regenerate} disabled={saving || !!exporting} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-100 disabled:opacity-50 cursor-pointer">
                  <Camera className="w-3.5 h-3.5" /> Ulangi dari foto
                </button>
              )}
              {!readOnly && (
                <button type="button" onClick={save} disabled={saving || !dirty} className="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan
                </button>
              )}
              <button type="button" onClick={() => download('pdf')} disabled={saving || !!exporting} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
                {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} {dirty && !readOnly ? 'Simpan & PDF' : 'PDF'}
              </button>
              <button type="button" onClick={() => download('docx')} disabled={saving || !!exporting} className="px-3 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-blue-800 disabled:opacity-50 cursor-pointer">
                {exporting === 'docx' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} {dirty && !readOnly ? 'Simpan & DOCX' : 'DOCX'}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {zoom && (
        <div className="fixed inset-0 z-[160] bg-black/85 flex flex-col items-center justify-center p-4" onClick={() => setZoom(null)}>
          <p className="text-white text-sm font-bold mb-3">{zoom.title}</p>
          <img src={zoom.src} alt={zoom.title} className="max-w-full max-h-[80vh] rounded-xl object-contain" />
        </div>
      )}
    </div>,
    document.body,
  );
}
