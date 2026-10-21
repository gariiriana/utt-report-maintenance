// ============================================================================
// FILE: frontend/components/PmPredictiveModal.tsx
// Deskripsi: Generate Predictive Report dari satu laporan Preventive Maintenance
//            (dibuka dari kartu dokumen di Arsip Dokumen).
//            Alur: 1) siapkan unit & riwayat  2) AI membaca angka dari foto
//            3) engineer memeriksa & mengonfirmasi angka  4) status & tren dihitung
//            sistem lalu AI menulis analisis per equipment  5) edit, simpan,
//            unduh PDF/DOCX (dengan foto). Engineer memilih equipment yang dianalisis
//            dan bisa mengedit ulang angka predictive yang sudah tersimpan.
//            Riwayat tren dibaca dari predictive sebelumnya unit yang sama.
//            Langkah & komponennya dipakai bersama generate per quarter
//            (PmPredictiveQuarterModal) lewat pmPredictiveWorkflow & PmPredictiveParts.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { X, Bot, Camera, CheckCircle2, AlertTriangle, Loader2, FileDown, FileText, Save, History, ChevronRight, PencilLine } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useModalScrollLock } from '@/utils/modalScrollLock';
import { resolvePmProfile, type PmProfile } from '@/config/pmPredictiveProfiles';
import { unitKeyOf, fmtDate } from '@/utils/pmPredictiveEngine';
import {
  loadPmSourcePhotos, getPmPredictive, findPreviousPmPredictive, savePmPredictive, readPlansWithAI, narrateSections,
  type PmSourcePhoto, type PmNarrativeState,
} from '@/utils/pmPredictiveService';
import {
  EMPTY_DRAFT, planCards, initDraft, markDraftPending, applyExtraction, draftFromReport, draftStats,
  composeAnalysis, buildPmReport, maintenanceDateOf, type PmPredictiveSourceDoc, type PmReadingDraft,
} from '@/utils/pmPredictiveWorkflow';
import { exportPmPredictiveToPdf } from '@/utils/PmPredictivePdfExport';
import { exportPmPredictiveToDocx } from '@/utils/PmPredictiveWordExport';
import { PmReadingsEditor, PmPredictiveResultView, PmPhotoZoom, applyReportChange, type PmZoom } from './PmPredictiveParts';
import type { PmPredictiveReport, PmStatus } from '@/types/pmPredictiveTypes';

export { STATUS_BADGE } from './PmPredictiveParts';
export type { PmPredictiveSourceDoc } from '@/utils/pmPredictiveWorkflow';

export interface PmPredictiveMarker {
  reportNumber: string;
  overallStatus: PmStatus;
  updatedAt: string;
}

export const markerOf = (report: PmPredictiveReport): PmPredictiveMarker =>
  ({ reportNumber: report.reportNumber, overallStatus: report.overallStatus, updatedAt: new Date().toISOString() });

interface PmPredictiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: PmPredictiveSourceDoc | null;
  readOnly?: boolean;
  onSaved?: (marker: PmPredictiveMarker) => void;
}

type Step = 'loading' | 'setup' | 'reading' | 'confirm' | 'analyzing' | 'result' | 'error';

interface HistoryLookup {
  unitKey: string;
  previous: PmPredictiveReport | null;
  total: number;
  newerExists: boolean;
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
  const [draft, setDraft] = useState<PmReadingDraft>(EMPTY_DRAFT);
  const [confirmed, setConfirmed] = useState(false);
  const [sectionProgress, setSectionProgress] = useState<Record<string, PmNarrativeState>>({});
  const [report, setReport] = useState<PmPredictiveReport | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState<PmZoom | null>(null);
  /** Sedang mengedit angka predictive yang sudah ada (dari langkah Hasil). */
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const runRef = useRef(0);

  const unitKey = useMemo(() => unitKeyOf(account, unitLabel), [account, unitLabel]);
  const photoByIndex = useMemo(() => new Map(photos.map(p => [p.index, p])), [photos]);
  const plans = useMemo(() => (profile ? planCards(profile, photos) : []), [photos, profile]);

  // ─── Buka modal: predictive yang sudah ada langsung ditampilkan ───────────
  useEffect(() => {
    if (!isOpen || !srcDoc) return;
    const run = ++runRef.current;
    setStep('loading');
    setErrorMsg('');
    setExisting(null);
    setReport(null);
    setPhotos([]);
    setDraft(EMPTY_DRAFT);
    setConfirmed(false);
    setDirty(false);
    setLookup(null);
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
  const runExtraction = async (onlyIndexes?: Set<number>) => {
    if (!profile || !srcDoc) return;
    const run = runRef.current;
    if (onlyIndexes) {
      setDraft(d => markDraftPending(d, onlyIndexes));
    } else {
      setDraft(initDraft(plans, 'pending'));
      setEditing(false);
    }
    setStep('reading');
    const isCancelled = () => run !== runRef.current;
    const res = await readPlansWithAI(profile, unitLabel, plans.filter(p => !onlyIndexes || onlyIndexes.has(p.photo.index)), {
      onProgress: text => { if (!isCancelled()) setProgress(text); },
      onBatch: (results, failed) => setDraft(d => applyExtraction(d, profile, results, failed)),
      isCancelled,
    });
    if (isCancelled()) return;
    if (res.failedBatches) toast.error(`Sebagian foto gagal dibaca AI: ${res.lastError || 'error'}`);
    setConfirmed(false);
    setStep('confirm');
  };

  const startManual = () => {
    setDraft(initDraft(plans, 'manual'));
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
    setDraft(draftFromReport(report, profile, loaded));
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
    const run = runRef.current;
    setStep('analyzing');
    setProgress('Menghitung status dan tren...');

    let hist = lookup;
    if (!hist || hist.unitKey !== unitKey) {
      const res = await findPreviousPmPredictive(unitKey, maintenanceDate, srcDoc.id).catch(() => ({ previous: null, total: 0, newerExists: false }));
      hist = { unitKey, ...res };
      setLookup(hist);
    }
    const previous = hist.previous;
    const analysis = composeAnalysis(profile, draft, previous, maintenanceDate, srcDoc.id);
    if ('error' in analysis) {
      toast.error(analysis.error);
      setStep('confirm');
      return;
    }

    setSectionProgress(Object.fromEntries(analysis.sections.map(s => [s.id, 'pending' as const])));
    const narrated = await narrateSections(
      { unitType: profile.unitType, unitLabel: unitLabel.trim(), maintenanceName: srcDoc.maintenanceName, date: maintenanceDate, nameplate: analysis.nameplate },
      analysis.sections,
      {
        onSection: (id, state) => setSectionProgress(p => ({ ...p, [id]: state })),
        onProgress: text => { if (run === runRef.current) setProgress(text); },
      },
    );
    if (run !== runRef.current) return;

    setReport(buildPmReport({
      profile, src: srcDoc, unitLabel, maintenanceDate, analysis,
      sections: narrated.sections, summary: narrated.summary,
      previous, existing, current: report, generatedBy: user.email || '',
    }));
    setDirty(true);
    setEditing(false);
    setStep('result');
  };

  // ─── Simpan & ekspor ─────────────────────────────────────────────────────
  const updateReport = (fn: (r: PmPredictiveReport) => PmPredictiveReport) => {
    setReport(r => (r ? applyReportChange(r, fn) : r));
    setDirty(true);
  };

  const save = async (): Promise<boolean> => {
    if (!report || readOnly) return true;
    setSaving(true);
    try {
      await savePmPredictive(report, !existing);
      setExisting(report);
      setDirty(false);
      onSaved?.(markerOf(report));
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
  const stats = profile ? draftStats(profile, draft) : null;

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
                placeholder={`mis. ${profile?.unitExample || 'Unit-01'}`}
              />
            </label>
            <div className="flex items-start gap-1.5 text-slate-600">
              <History className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-500" />
              {lookupLoading || !lookup || lookup.unitKey !== unitKey ? (
                <span>Mencari predictive sebelumnya...</span>
              ) : lookup.previous ? (
                <span>Riwayat ditemukan: predictive PM <strong>{fmtDate(lookup.previous.maintenanceDate)}</strong> ({lookup.total} predictive untuk unit ini). Tren dihitung dari riwayat tersebut.</span>
              ) : (
                <span>Belum ada predictive sebelumnya untuk unit ini, jadi laporan ini menjadi <strong>pengukuran pertama</strong>. Pastikan penulisan nama unit sama dengan kuartal lalu.</span>
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

  const renderConfirm = () => {
    if (!profile || !stats) return null;
    return (
      <div className="space-y-4">
        {editing && (
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-900 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <span>Mengedit angka predictive yang sudah tersimpan. Setelah dianalisis ulang, status, tren, dan narasi disusun ulang dari angka terbaru.</span>
            <button type="button" onClick={cancelEdit} className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-white font-bold text-indigo-700 shrink-0 cursor-pointer">Batal edit</button>
          </div>
        )}
        <PmReadingsEditor
          profile={profile}
          draft={draft}
          onChange={setDraft}
          photoByIndex={photoByIndex}
          onZoom={setZoom}
          editing={editing}
          previousNameplate={lookup?.previous?.nameplate}
          onRetryFailed={indexes => runExtraction(indexes)}
        />

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
            disabled={!confirmed || stats.invalidInputs > 0 || stats.included.length === 0}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
          >
            <Bot className="w-4 h-4" /> Analisis prediktif <ChevronRight className="w-4 h-4" />
          </button>
        </div>
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
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">Jenis unit laporan PM ini belum dikenali (dari akun pembuat maupun nama maintenance), jadi Predictive Report belum tersedia.</div>
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
          {profile && step === 'result' && report && (
            <PmPredictiveResultView report={report} profile={profile} readOnly={readOnly} onChange={updateReport} />
          )}
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

      <PmPhotoZoom zoom={zoom} onClose={() => setZoom(null)} />
    </div>,
    document.body,
  );
}
