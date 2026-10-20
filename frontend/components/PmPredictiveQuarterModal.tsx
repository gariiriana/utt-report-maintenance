// ============================================================================
// FILE: frontend/components/PmPredictiveQuarterModal.tsx
// Deskripsi: Generate Predictive Report sekaligus untuk seluruh laporan PM dalam
//            satu quarter (dibuka dari header Arsip Dokumen akun unit, mis. FCU).
//            Alurnya sama dengan generate satu laporan: 1) pilih laporan & nama unit
//            2) AI membaca angka dari foto setiap laporan, engineer memeriksa &
//            mengonfirmasi angka per laporan  3) status & tren dihitung sistem, AI
//            menulis analisis (urut tanggal, riwayat unit tersambung)  4) edit,
//            simpan semua, unduh satu PDF/DOCX gabungan untuk quarter tersebut.
//            Predictive yang sudah tersimpan bisa dipakai apa adanya atau dibuat ulang.
// ============================================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { X, Bot, CheckCircle2, AlertTriangle, Loader2, FileDown, FileText, Save, ChevronRight, CalendarRange, Circle, RotateCw } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useModalScrollLock } from '@/utils/modalScrollLock';
import { resolvePmProfile } from '@/config/pmPredictiveProfiles';
import { unitKeyOf, fmtDate } from '@/utils/pmPredictiveEngine';
import {
  loadPmSourcePhotos, getPmPredictive, findPreviousPmPredictive, savePmPredictive, readPlansWithAI, narrateSections,
  type PmSourcePhoto,
} from '@/utils/pmPredictiveService';
import {
  EMPTY_DRAFT, planCards, initDraft, markDraftPending, applyExtraction, draftStats, composeAnalysis, buildPmReport,
  maintenanceDateOf, detectQuarter, quarterKey, quarterLabel, quarterMonthsText, latestEarlier, runPool,
  type PmPredictiveSourceDoc, type PmReadingDraft, type PmQuarter,
} from '@/utils/pmPredictiveWorkflow';
import { exportPmPredictiveBundleToPdf } from '@/utils/PmPredictivePdfExport';
import { exportPmPredictiveBundleToDocx } from '@/utils/PmPredictiveWordExport';
import { markerOf, type PmPredictiveMarker } from './PmPredictiveModal';
import {
  PmReadingsEditor, PmPredictiveResultView, PmPhotoZoom, PmStatusBadge, PmPreparedByInput, applyReportChange, type PmZoom,
} from './PmPredictiveParts';
import type { PmPredictiveReport, PmSignatory } from '@/types/pmPredictiveTypes';

export interface PmQuarterSourceDoc extends PmPredictiveSourceDoc {
  pmPredictive?: PmPredictiveMarker | null;
}

interface PmPredictiveQuarterModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Laporan PM yang punya profil predictive (sudah difilter pemanggil). */
  documents: PmQuarterSourceDoc[];
  readOnly?: boolean;
  onSaved?: (docId: string, marker: PmPredictiveMarker) => void;
}

type Step = 'pick' | 'reading' | 'confirm' | 'analyzing' | 'result';
type Phase = 'idle' | 'running' | 'done' | 'failed';

interface Item {
  doc: PmQuarterSourceDoc;
  date: string;
  include: boolean;
  /** true = buat (ulang) predictive dari foto; false = pakai predictive tersimpan. */
  regenerate: boolean;
  unitLabel: string;
  existing: PmPredictiveReport | null;
  photos: PmSourcePhoto[];
  draft: PmReadingDraft;
  confirmed: boolean;
  read: Phase;
  analyze: Phase;
  error?: string;
  report: PmPredictiveReport | null;
  dirty: boolean;
}

const btn = 'px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer';

function PhaseIcon({ phase }: { phase: Phase }) {
  if (phase === 'running') return <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />;
  if (phase === 'done') return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
  if (phase === 'failed') return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
  return <Circle className="w-4 h-4 text-slate-300 shrink-0" />;
}

export function PmPredictiveQuarterModal({ isOpen, onClose, documents, readOnly = false, onSaved }: PmPredictiveQuarterModalProps) {
  const { user } = useAuth();
  useModalScrollLock(isOpen);

  const accounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of documents) {
      const a = (d.createdBy || '').toLowerCase().trim();
      counts.set(a, (counts.get(a) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  }, [documents]);
  const [account, setAccount] = useState('');
  const accountDocs = useMemo(() => documents.filter(d => (d.createdBy || '').toLowerCase().trim() === account), [documents, account]);
  const quarters = useMemo(() => {
    const map = new Map<string, PmQuarter & { count: number }>();
    for (const d of accountDocs) {
      const q = detectQuarter(d);
      const key = quarterKey(q);
      map.set(key, { ...q, count: (map.get(key)?.count || 0) + 1 });
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [accountDocs]);
  const [qKey, setQKey] = useState('');
  const quarter = quarters.find(([k]) => k === qKey)?.[1] || null;
  const profile = useMemo(() => (accountDocs[0] ? resolvePmProfile(account, accountDocs[0].maintenanceName) : null), [account, accountDocs]);

  const [step, setStep] = useState<Step>('pick');
  const [items, setItems] = useState<Record<string, Item>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [progress, setProgress] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<PmZoom | null>(null);
  const [busy, setBusy] = useState<'save' | 'pdf' | 'docx' | null>(null);
  const runRef = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const patch = (id: string, p: Partial<Item> | ((it: Item) => Partial<Item>)) =>
    setItems(prev => (prev[id] ? { ...prev, [id]: { ...prev[id], ...(typeof p === 'function' ? p(prev[id]) : p) } } : prev));

  // Buka modal: mulai dari langkah pertama. Hanya saat dibuka; daftar dokumen ikut
  // berubah setelah simpan (penanda predictive) dan tidak boleh mengulang alur.
  useEffect(() => {
    if (!isOpen) return;
    runRef.current++;
    setStep('pick');
    setActiveId(null);
  }, [isOpen]);

  // Akun terbanyak & quarter terbaru dipilih otomatis.
  useEffect(() => {
    if (!isOpen) return;
    setAccount(a => (a && accounts.includes(a) ? a : accounts[0] || ''));
  }, [isOpen, accounts]);

  useEffect(() => {
    if (!isOpen) return;
    setQKey(k => (quarters.some(([key]) => key === k) ? k : quarters[0]?.[0] || ''));
  }, [isOpen, quarters]);

  // Daftar laporan quarter terpilih + predictive yang sudah tersimpan.
  useEffect(() => {
    if (!isOpen || !quarter || step !== 'pick') return;
    const run = ++runRef.current;
    const docs = accountDocs
      .filter(d => quarterKey(detectQuarter(d)) === qKey)
      .map(d => ({ doc: d, date: maintenanceDateOf(d) }))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.doc.specificDetail || '').localeCompare(b.doc.specificDetail || '', 'id', { numeric: true }));
    const next: Record<string, Item> = {};
    for (const { doc, date } of docs) {
      // Saat dibuka ulang, predictive & foto yang sudah dimuat dipakai lagi.
      const prev = itemsRef.current[doc.id];
      next[doc.id] = prev ? { ...prev, doc, date, report: null, dirty: false, analyze: 'idle', read: 'idle', confirmed: false, error: undefined } : {
        doc, date, include: true, regenerate: !doc.pmPredictive, unitLabel: (doc.specificDetail || doc.maintenanceName || '').trim(),
        existing: null, photos: [], draft: EMPTY_DRAFT, confirmed: false, read: 'idle', analyze: 'idle', report: null, dirty: false,
      };
    }
    setItems(next);
    setOrder(docs.map(d => d.doc.id));
    const toLoad = docs.filter(d => d.doc.pmPredictive && !next[d.doc.id].existing).map(d => d.doc.id);
    if (!toLoad.length) return;
    setLoadingExisting(true);
    runPool(toLoad.map(id => async () => {
      const found = await getPmPredictive(id).catch(() => null);
      if (run !== runRef.current) return;
      patch(id, found ? { existing: found, unitLabel: found.unitLabel, regenerate: false } : { regenerate: true });
    }), 4).finally(() => { if (run === runRef.current) setLoadingExisting(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, qKey, account, accountDocs]);

  const list = order.map(id => items[id]).filter(Boolean);
  const included = list.filter(it => it.include);
  const toGenerate = included.filter(it => it.regenerate);
  const generated = toGenerate.filter(it => it.read === 'done');
  const reportOf = (it: Item) => it.report || (!it.regenerate ? it.existing : null);
  const period = quarter ? { label: quarterLabel(quarter), months: quarterMonthsText(quarter) } : null;
  const anyDirty = list.some(it => it.dirty);

  // ─── Baca foto semua laporan (berurutan agar kuota AI gratis aman) ────────
  const startReading = async (manual: boolean) => {
    if (!profile) return;
    if (toGenerate.some(it => !it.unitLabel.trim())) {
      toast.error('Isi nama unit untuk setiap laporan yang akan dibuat predictive-nya.');
      return;
    }
    const run = ++runRef.current;
    const isCancelled = () => run !== runRef.current;
    setStep('reading');
    for (const it of toGenerate) patch(it.doc.id, { read: 'idle', analyze: 'idle', report: null, confirmed: false, error: undefined });
    const readOk: string[] = [];
    for (let i = 0; i < toGenerate.length; i++) {
      const it = toGenerate[i];
      const id = it.doc.id;
      patch(id, { read: 'running' });
      setProgress(`Laporan ${i + 1} dari ${toGenerate.length}: memuat foto...`);
      const photos = it.photos.length ? it.photos : await loadPmSourcePhotos(id).catch(() => [] as PmSourcePhoto[]);
      if (isCancelled()) return;
      if (!photos.length) {
        patch(id, { read: 'failed', error: 'Laporan ini tidak memiliki foto yang bisa dibaca.' });
        continue;
      }
      const plans = planCards(profile, photos);
      let draft = initDraft(plans, manual ? 'manual' : 'pending');
      patch(id, { photos, draft });
      if (!manual) {
        const res = await readPlansWithAI(profile, it.unitLabel.trim(), plans, {
          onProgress: text => { if (!isCancelled()) setProgress(`Laporan ${i + 1} dari ${toGenerate.length}: ${text}`); },
          onBatch: (results, failed) => {
            draft = applyExtraction(draft, profile, results, failed);
            patch(id, { draft });
          },
          isCancelled,
        });
        if (isCancelled()) return;
        if (res.failedBatches) patch(id, { error: `Sebagian foto gagal dibaca AI: ${res.lastError || 'error'}` });
      }
      patch(id, { read: 'done' });
      readOk.push(id);
    }
    setActiveId(readOk[0] || null);
    setStep('confirm');
  };

  const retryFailed = async (id: string, indexes: Set<number>) => {
    const it = itemsRef.current[id];
    if (!profile || !it) return;
    const run = runRef.current;
    let draft = markDraftPending(it.draft, indexes);
    patch(id, { draft, read: 'running', error: undefined });
    const res = await readPlansWithAI(profile, it.unitLabel.trim(), planCards(profile, it.photos).filter(p => indexes.has(p.photo.index)), {
      onBatch: (results, failed) => {
        draft = applyExtraction(draft, profile, results, failed);
        patch(id, { draft });
      },
      isCancelled: () => run !== runRef.current,
    });
    patch(id, { read: 'done', ...(res.failedBatches ? { error: `Sebagian foto gagal dibaca AI: ${res.lastError || 'error'}` } : {}) });
  };

  // ─── Analisis semua laporan, urut tanggal PM ─────────────────────────────
  const readyToAnalyze = profile ? generated.every(it => {
    const s = draftStats(profile, it.draft);
    return it.confirmed && s.invalidInputs === 0 && s.included.length > 0;
  }) : false;

  const runAnalysisAll = async () => {
    if (!profile || !user) return;
    const run = ++runRef.current;
    const isCancelled = () => run !== runRef.current;
    setStep('analyzing');
    const targets = generated.map(it => itemsRef.current[it.doc.id]).sort((a, b) => a.date.localeCompare(b.date));
    const regeneratedIds = targets.filter(it => it.existing).map(it => it.doc.id);
    const done: PmPredictiveReport[] = [];
    for (let i = 0; i < targets.length; i++) {
      const it = targets[i];
      const id = it.doc.id;
      const unitLabel = it.unitLabel.trim();
      const unitKey = unitKeyOf(account, unitLabel);
      patch(id, { analyze: 'running', error: undefined });
      setProgress(`Laporan ${i + 1} dari ${targets.length} (${unitLabel}): menghitung status dan tren...`);
      const db = await findPreviousPmPredictive(unitKey, it.date, id, regeneratedIds).catch(() => ({ previous: null }));
      if (isCancelled()) return;
      const previous = latestEarlier([db.previous, ...done.filter(r => r.unitKey === unitKey)], it.date);
      const analysis = composeAnalysis(profile, it.draft, previous, it.date, id);
      if ('error' in analysis) {
        patch(id, { analyze: 'failed', error: analysis.error });
        continue;
      }
      const narrated = await narrateSections(
        { unitType: profile.unitType, unitLabel, maintenanceName: it.doc.maintenanceName, date: it.date, nameplate: analysis.nameplate },
        analysis.sections,
        { onProgress: text => { if (!isCancelled()) setProgress(`Laporan ${i + 1} dari ${targets.length} (${unitLabel}): ${text}`); } },
      );
      if (isCancelled()) return;
      const report = buildPmReport({
        profile, src: it.doc, unitLabel, maintenanceDate: it.date, analysis,
        sections: narrated.sections, summary: narrated.summary, previous, existing: it.existing, generatedBy: user.email || '',
      });
      done.push(report);
      patch(id, { analyze: 'done', report, dirty: true });
    }
    const doneIds = new Set(done.map(r => r.id));
    setActiveId(included.find(it => doneIds.has(it.doc.id) || (!it.regenerate && it.existing))?.doc.id || null);
    setStep('result');
  };

  // ─── Simpan & ekspor gabungan ────────────────────────────────────────────
  const saveAll = async (): Promise<boolean> => {
    if (readOnly) return true;
    const dirtyItems = Object.values(itemsRef.current).filter(it => it.dirty && reportOf(it));
    if (!dirtyItems.length) return true;
    setBusy('save');
    let failed = 0;
    for (const it of dirtyItems) {
      const report = reportOf(it)!;
      try {
        await savePmPredictive(report, !it.existing);
        patch(it.doc.id, { existing: report, report: null, regenerate: false, dirty: false });
        onSaved?.(it.doc.id, markerOf(report));
      } catch (err: any) {
        console.error('Simpan predictive gagal:', err);
        failed++;
        patch(it.doc.id, { error: `Gagal menyimpan: ${err?.message || 'error'}` });
      }
    }
    setBusy(null);
    if (failed) {
      toast.error(`${failed} predictive gagal disimpan; coba lagi.`);
      return false;
    }
    toast.success(`${dirtyItems.length} Predictive Report tersimpan`);
    return true;
  };

  const exportBundle = async (kind: 'pdf' | 'docx') => {
    if (!period || busy) return;
    if (anyDirty && !(await saveAll())) return;
    const entries = included
      .map(it => itemsRef.current[it.doc.id])
      .filter(it => it && reportOf(it))
      .map(it => ({ report: reportOf(it)!, photos: it.photos }));
    if (!entries.length) {
      toast.error('Belum ada Predictive Report untuk diunduh pada quarter ini.');
      return;
    }
    setBusy(kind);
    try {
      if (kind === 'pdf') await exportPmPredictiveBundleToPdf(entries, period);
      else await exportPmPredictiveBundleToDocx(entries, period);
    } finally {
      setBusy(null);
    }
  };

  const setPreparedByAll = (preparedBy: PmSignatory) => {
    for (const it of included) {
      const r = reportOf(it);
      if (!r) continue;
      patch(it.doc.id, { report: { ...r, signatures: { ...r.signatures, preparedBy } }, dirty: true });
    }
  };

  const close = () => {
    if (anyDirty && !readOnly && !window.confirm('Ada Predictive Report yang belum disimpan. Tutup dan buang perubahan?')) return;
    runRef.current++;
    onClose();
  };

  if (!isOpen) return null;

  // ─── Render ──────────────────────────────────────────────────────────────
  const stepIndex = { pick: 0, reading: 1, confirm: 1, analyzing: 2, result: 3 }[step];
  const steps = ['Pilih Laporan', 'Konfirmasi Angka', 'Analisis', 'Hasil'];
  const active = activeId ? items[activeId] : null;
  const allExisting = included.length > 0 && included.every(it => !it.regenerate && it.existing);
  const resultItems = included.filter(it => reportOf(it));

  const renderPick = () => (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs text-slate-600 leading-relaxed">
          Semua laporan PM dalam quarter yang dipilih dibuatkan Predictive Report dengan alur yang sama seperti satu laporan:
          AI membaca angka dari foto, Anda memeriksa angka setiap laporan, lalu sistem menyusun status, tren, dan analisis.
          Hasilnya diunduh sebagai <strong>satu dokumen gabungan</strong> untuk quarter tersebut.
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {accounts.length > 1 && (
            <select value={account} onChange={e => setAccount(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white" aria-label="Akun unit">
              {accounts.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700">
            <CalendarRange className="w-4 h-4 text-indigo-600" />
            <select value={qKey} onChange={e => setQKey(e.target.value)} className="bg-transparent font-black text-slate-900 focus:outline-none cursor-pointer" aria-label="Quarter">
              {quarters.map(([key, q]) => <option key={key} value={key}>{quarterLabel(q)} · {q.count} laporan</option>)}
            </select>
          </label>
        </div>
      </div>

      {period && <p className="text-xs font-bold text-slate-500">Periode {period.label} ({period.months}) · {list.length} laporan PM</p>}

      <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {list.map(it => (
          <div key={it.doc.id} className={`p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${it.include ? '' : 'bg-slate-50/70'}`}>
            <label className="flex items-center gap-2 min-w-0 sm:w-64 cursor-pointer">
              <input type="checkbox" checked={it.include} disabled={readOnly && !it.existing} onChange={e => patch(it.doc.id, { include: e.target.checked })} className="w-4 h-4 accent-indigo-600 shrink-0" aria-label={`Masukkan ${it.doc.maintenanceName}`} />
              <span className="min-w-0">
                <span className="block text-xs font-black text-slate-800 truncate">{it.doc.maintenanceName}</span>
                <span className="block text-[10px] text-slate-500">PM {fmtDate(it.date)}</span>
              </span>
            </label>
            <input
              value={it.unitLabel}
              onChange={e => patch(it.doc.id, { unitLabel: e.target.value })}
              disabled={readOnly || !it.regenerate || !it.include}
              placeholder="Nama unit, mis. FCU-01 Lt.2"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              aria-label="Nama unit"
            />
            <div className="flex items-center gap-2 shrink-0">
              {it.existing ? (
                <>
                  <PmStatusBadge status={it.existing.overallStatus} small />
                  {!readOnly && (
                    <select
                      value={it.regenerate ? 'baru' : 'simpan'}
                      onChange={e => patch(it.doc.id, { regenerate: e.target.value === 'baru' })}
                      disabled={!it.include}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold bg-white"
                      aria-label="Predictive tersimpan"
                    >
                      <option value="simpan">Pakai yang tersimpan</option>
                      <option value="baru">Buat ulang dari foto</option>
                    </select>
                  )}
                </>
              ) : it.doc.pmPredictive && loadingExisting ? (
                <span className="text-[11px] text-slate-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> memuat</span>
              ) : (
                <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold">Belum ada predictive</span>
              )}
            </div>
          </div>
        ))}
        {!list.length && <p className="p-4 text-xs text-slate-500">Tidak ada laporan PM pada quarter ini.</p>}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        {allExisting && (
          <>
            <button type="button" onClick={() => exportBundle('pdf')} disabled={!!busy} className={`${btn} bg-emerald-600 text-white`}>
              {busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF gabungan
            </button>
            <button type="button" onClick={() => exportBundle('docx')} disabled={!!busy} className={`${btn} bg-blue-700 text-white`}>
              {busy === 'docx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Word gabungan
            </button>
          </>
        )}
        {!readOnly && toGenerate.length > 0 && (
          <>
            <button type="button" onClick={() => startReading(true)} disabled={loadingExisting} className={`${btn} border border-slate-200 text-slate-700 font-bold`}>
              Isi angka manual tanpa AI
            </button>
            <button type="button" onClick={() => startReading(false)} disabled={loadingExisting} className={`${btn} bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md`}>
              <Bot className="w-4 h-4" /> Baca angka dari foto (AI) · {toGenerate.length} laporan <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
        {!readOnly && toGenerate.length === 0 && included.length > 0 && !allExisting && (
          <p className="text-[11px] text-slate-500">Memuat predictive tersimpan...</p>
        )}
      </div>
    </div>
  );

  const renderProgress = (phaseOf: (it: Item) => Phase, targets: Item[]) => (
    <div className="py-6 flex flex-col items-center gap-4">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      <p className="text-sm font-bold text-slate-700 text-center">{progress || 'Memproses...'}</p>
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {targets.map(it => (
          <div key={it.doc.id} className="px-3 py-2 flex items-center gap-2 text-xs">
            <PhaseIcon phase={phaseOf(it)} />
            <span className="font-bold text-slate-800 truncate flex-1">{it.unitLabel || it.doc.maintenanceName}</span>
            <span className="text-[10px] text-slate-500 shrink-0">PM {fmtDate(it.date)}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 max-w-md text-center">Layanan AI gratis dibatasi per menit, jadi laporan diproses satu per satu. Biarkan jendela ini tetap terbuka.</p>
    </div>
  );

  const renderDocChips = (targets: Item[], badge: (it: Item) => ReactNode) => (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {targets.map((it, i) => (
        <button
          key={it.doc.id}
          type="button"
          onClick={() => setActiveId(it.doc.id)}
          className={`shrink-0 px-3 py-2 rounded-xl border text-left cursor-pointer ${it.doc.id === activeId ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
        >
          <span className="flex items-center gap-1.5 text-[11px] font-black text-slate-800">{badge(it)} {i + 1}. {it.unitLabel || it.doc.maintenanceName}</span>
          <span className="block text-[10px] text-slate-500">PM {fmtDate(it.date)}</span>
        </button>
      ))}
    </div>
  );

  const renderConfirm = () => {
    if (!profile) return null;
    const failedRead = toGenerate.filter(it => it.read === 'failed');
    const activeStats = active ? draftStats(profile, active.draft) : null;
    const pos = generated.findIndex(it => it.doc.id === activeId);
    return (
      <div className="space-y-4">
        <p className="text-[11px] text-slate-500">Periksa angka setiap laporan dengan fotonya, centang konfirmasi, lalu lanjut ke laporan berikutnya. Analisis dimulai setelah semua laporan dikonfirmasi.</p>
        {renderDocChips(generated, it => (it.confirmed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Circle className="w-3.5 h-3.5 text-amber-500" />))}
        {failedRead.length > 0 && (
          <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            Dilewati: {failedRead.map(it => `${it.unitLabel} (${it.error || 'gagal'})`).join(', ')}.
          </p>
        )}
        {active && activeStats && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-900">{active.unitLabel} <span className="text-xs font-semibold text-slate-500">· {active.doc.maintenanceName} · PM {fmtDate(active.date)}</span></p>
              {active.read === 'running' && <span className="text-[11px] text-indigo-700 flex items-center gap-1"><RotateCw className="w-3 h-3 animate-spin" /> membaca ulang...</span>}
            </div>
            {active.error && <p className="text-[11px] font-semibold text-amber-700">{active.error}</p>}
            <PmReadingsEditor
              profile={profile}
              draft={active.draft}
              onChange={fn => patch(active.doc.id, it => ({ draft: fn(it.draft), confirmed: false }))}
              photoByIndex={new Map(active.photos.map(p => [p.index, p]))}
              onZoom={setZoom}
              previousNameplate={active.existing?.nameplate}
              onRetryFailed={indexes => retryFailed(active.doc.id, indexes)}
            />
            <label className="flex items-start gap-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 cursor-pointer">
              <input type="checkbox" checked={active.confirmed} onChange={e => patch(active.doc.id, { confirmed: e.target.checked })} className="mt-0.5 w-4 h-4 accent-emerald-600" />
              Saya sudah mencocokkan setiap angka laporan ini dengan fotonya. Angka di atas benar dan siap masuk riwayat unit.
            </label>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button type="button" onClick={() => { runRef.current++; setStep('pick'); }} className={`${btn} border border-slate-200 text-slate-700 font-bold`}>Kembali</button>
          {pos >= 0 && pos < generated.length - 1 && (
            <button type="button" onClick={() => setActiveId(generated[pos + 1].doc.id)} className={`${btn} border border-indigo-200 text-indigo-700`}>
              Laporan berikutnya <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={runAnalysisAll} disabled={!readyToAnalyze || !generated.length} className={`${btn} bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md`}>
            <Bot className="w-4 h-4" /> Analisis prediktif · {generated.length} laporan <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {!readyToAnalyze && generated.length > 0 && (
          <p className="text-[11px] text-slate-500 text-right">{generated.filter(it => it.confirmed).length} dari {generated.length} laporan sudah dikonfirmasi.</p>
        )}
      </div>
    );
  };

  const renderResult = () => {
    const activeReport = active ? reportOf(active) : null;
    const failed = toGenerate.filter(it => it.analyze === 'failed');
    const firstReport = resultItems.map(reportOf).find(Boolean);
    return (
      <div className="space-y-4">
        {renderDocChips(resultItems, it => <PmStatusBadge status={reportOf(it)!.overallStatus} small />)}
        {failed.length > 0 && (
          <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            Tidak dianalisis: {failed.map(it => `${it.unitLabel} (${it.error || 'gagal'})`).join(', ')}.
          </p>
        )}
        {!readOnly && firstReport && (
          <PmPreparedByInput value={firstReport.signatures.preparedBy} onChange={setPreparedByAll} hint="Penanda tangan berlaku untuk seluruh laporan quarter ini." />
        )}
        {active && activeReport && (
          <PmPredictiveResultView
            report={activeReport}
            profile={profile}
            readOnly={readOnly}
            showSignatures={false}
            onChange={fn => patch(active.doc.id, it => ({ report: applyReportChange(reportOf(it)!, fn), dirty: true }))}
          />
        )}
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Predictive Report per Quarter">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col text-slate-800 overflow-hidden"
      >
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-indigo-700 via-blue-700 to-sky-600 text-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-sky-100">Predictive Report · per Quarter</p>
              <h2 className="text-base sm:text-lg font-black truncate">{period ? `${profile?.unitType || 'Unit'} · ${period.label}` : 'Pilih quarter'}</h2>
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
          {!profile && <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">Tidak ada laporan PM yang mendukung Predictive Report.</div>}
          {profile && step === 'pick' && renderPick()}
          {profile && step === 'reading' && renderProgress(it => it.read, toGenerate)}
          {profile && step === 'confirm' && renderConfirm()}
          {profile && step === 'analyzing' && renderProgress(it => it.analyze, generated)}
          {profile && step === 'result' && renderResult()}
        </div>

        {step === 'result' && (
          <div className="px-3 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between shrink-0">
            <p className="text-[11px] text-slate-500">
              {resultItems.length} laporan · {readOnly ? 'mode lihat saja' : anyDirty ? 'ada yang belum disimpan' : 'semua tersimpan'}
            </p>
            <div className="grid grid-cols-2 sm:flex gap-2">
              {!readOnly && (
                <button type="button" onClick={saveAll} disabled={!!busy || !anyDirty} className="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
                  {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan semua
                </button>
              )}
              <button type="button" onClick={() => exportBundle('pdf')} disabled={!!busy || !resultItems.length} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
                {busy === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} {anyDirty && !readOnly ? 'Simpan & PDF gabungan' : 'PDF gabungan'}
              </button>
              <button type="button" onClick={() => exportBundle('docx')} disabled={!!busy || !resultItems.length} className="px-3 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-blue-800 disabled:opacity-50 cursor-pointer">
                {busy === 'docx' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} {anyDirty && !readOnly ? 'Simpan & Word gabungan' : 'Word gabungan'}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <PmPhotoZoom zoom={zoom} onClose={() => setZoom(null)} />
    </div>,
    document.body,
  );
}
