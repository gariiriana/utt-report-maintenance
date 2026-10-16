// ============================================================================
// FILE: HSEWeeklyReport.tsx
// Deskripsi: Halaman HSE Weekly Report (khusus role HSE). Merekap satu minggu
//            (Senin–Minggu) data Inspeksi HSE, Absen TBM, Safety Induction dan
//            Temuan K3, menampilkan preview ringkas, lalu mengekspor ke Excel
//            satu worksheet (lihat utils/HSEWeeklyExcelExport.ts).
//            Query Firestore dibatasi per rentang tanggal agar hemat kuota read.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle, AlertTriangle, CalendarRange, ChevronLeft, ChevronRight, Clock,
  FileSpreadsheet, HardHat, Loader2, RefreshCw, UserCheck, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import { collection, getDocs, query, where, type QuerySnapshot } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from '@/components/AuthContext';
import { useAppUpdateBlocker, useAppUpdateDraft } from '@/hooks/useAppUpdateDraft';
import { loadLogoBase64 } from '@/utils/ReportPdfExport';
import {
  addDays, buildHSEWeeklyReport, formatDate, formatDayLabel, formatWeekLabel, getWeekRange, todayYmd,
  type HSEWeekRange, type HSEWeeklyReport as WeeklyReportData, type RawDoc,
} from '@/utils/hseWeeklyReport';
import {
  buildHSEWeeklyWorkbook, findingPhotoKey, hseWeeklyFileName, type WeeklyImage, type WeeklyPhotoMap,
} from '@/utils/HSEWeeklyExcelExport';
import logoDME from '@/assets/logo_dwimitra_v2.png';
import logoUTT from '@/assets/logo_utt.png';
import logoNeutra from '@/assets/logo_neutradc.png';

type KopVariant = 'utt' | 'dme';

const KOP: Record<KopVariant, { label: string; company: string; logo: string }> = {
  utt: { label: 'UTT', company: 'PT United Transworld Trading', logo: logoUTT },
  dme: { label: 'Dwimitra', company: 'PT Dwimitra Ekatama Mandiri', logo: logoDME },
};
const SITE_NAME = 'Data Center NeutraDC Cikarang';
const PREFS_KEY = 'hse_weekly_report_prefs';

interface WeekDocs {
  hse: RawDoc[];
  findings: RawDoc[];
  open: RawDoc[];
}

const toRaw = (snap: QuerySnapshot): RawDoc[] => snap.docs.map(d => ({ id: d.id, ...d.data() }));

async function fetchWeekDocs(week: HSEWeekRange, includeCarryOver: boolean): Promise<WeekDocs> {
  const [hseSnap, findingSnap, openSnap] = await Promise.all([
    // Inspeksi menyimpan tanggal ISO UTC, jadi batas bawah dimundurkan 1 hari lalu disaring ulang per tanggal lokal
    getDocs(query(collection(db, 'hse'), where('date', '>=', addDays(week.start, -1)), where('date', '<=', `${week.end}`))),
    getDocs(query(collection(db, 'hse_findings'), where('findingDate', '>=', week.start), where('findingDate', '<=', week.end))),
    includeCarryOver ? getDocs(query(collection(db, 'hse_findings'), where('status', '==', 'open'))) : Promise.resolve(null),
  ]);
  return { hse: toRaw(hseSnap), findings: toRaw(findingSnap), open: openSnap ? toRaw(openSnap) : [] };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img.naturalWidth ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadLogo(src: string): Promise<WeeklyImage | null> {
  const base64 = await loadLogoBase64(src);
  return base64 ? resizeImage(base64, 360, 'image/png') : null;
}

// Foto diperkecil ke ±640 px (JPEG) — tampil sebagai thumbnail di sel, tetap cukup tajam bila diperbesar di Excel
const PHOTO_MAX_PX = 640;
const toExcelPhoto = (src: string) => resizeImage(src, PHOTO_MAX_PX, 'image/jpeg');

async function resizeImage(src: string, maxPx: number, type: 'image/jpeg' | 'image/png'): Promise<WeeklyImage | null> {
  const img = await loadImage(src);
  if (!img) return null;
  const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  try {
    return { base64: canvas.toDataURL(type, 0.72), width, height };
  } catch {
    return null; // URL tanpa izin CORS membuat canvas "tainted"
  }
}

async function runLimited<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

const photoSrc = (p: any): string => (typeof p === 'string' ? p : p?.dataUrl || p?.photoBase64 || p?.base64 || p?.url || '');
const uniqueSrc = (list: unknown[]) => Array.from(new Set(list.map(photoSrc).filter(Boolean)));

/** Kumpulkan sumber foto tiap laporan: subkoleksi `hse/{id}/photos` (fallback format lama di dokumen utama) & foto temuan */
async function collectPhotoSources(report: WeeklyReportData, docs: WeekDocs): Promise<Record<string, string[]>> {
  const hseById = new Map(docs.hse.map(d => [d.id, d]));
  const sources: Record<string, string[]> = {};
  const ids = [...report.inspections, ...report.tbm, ...report.inductions].map(item => item.id);

  await runLimited(ids, 6, async id => {
    let list: string[] = [];
    try {
      const snap = await getDocs(collection(db, `hse/${id}/photos`));
      list = uniqueSrc(snap.docs.map(d => d.data()).sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0)));
    } catch (err) {
      console.warn(`Gagal memuat foto hse/${id}:`, err);
    }
    if (list.length === 0) {
      const raw = hseById.get(id);
      list = uniqueSrc([...(Array.isArray(raw?.photos) ? raw.photos : []), raw?.fotoInduction, raw?.fotoSuratSehat, raw?.fotoSertifikatK3]);
    }
    sources[id] = list;
  });

  const findingById = new Map([...docs.findings, ...docs.open].map(d => [d.id, d]));
  for (const f of [...report.findings, ...report.carryOverFindings]) {
    const raw = findingById.get(f.id);
    if (!raw) continue;
    sources[findingPhotoKey(f.id, 'before')] = uniqueSrc(raw.beforePhotos?.length ? raw.beforePhotos : [raw.beforePhoto]);
    sources[findingPhotoKey(f.id, 'after')] = uniqueSrc(raw.afterPhotos?.length ? raw.afterPhotos : [raw.afterPhoto]);
  }
  return sources;
}

async function preparePhotos(sources: Record<string, string[]>, onProgress: (done: number, total: number) => void): Promise<WeeklyPhotoMap> {
  const jobs = Object.entries(sources).flatMap(([key, list]) => list.map((src, index) => ({ key, index, src })));
  const result: Record<string, (WeeklyImage | null)[]> = {};
  let done = 0;
  await runLimited(jobs, 4, async job => {
    (result[job.key] ??= [])[job.index] = await toExcelPhoto(job.src);
    onProgress(++done, jobs.length);
  });
  return Object.fromEntries(Object.entries(result).map(([key, list]) => [key, list.filter((p): p is WeeklyImage => !!p)]));
}

function readPrefs(): { kop?: KopVariant; preparedBy?: string } {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function HSEWeeklyReport() {
  const { user } = useAuth();
  const prefs = useMemo(readPrefs, []);

  const [anchorDate, setAnchorDate] = useState(() => todayYmd());
  const [kop, setKop] = useState<KopVariant>(prefs.kop === 'dme' ? 'dme' : 'utt');
  const [preparedBy, setPreparedBy] = useState(prefs.preparedBy || user?.displayName || user?.email?.split('@')[0] || '');
  const [includeCarryOver, setIncludeCarryOver] = useState(true);
  const [notes, setNotes] = useState('');

  const [docs, setDocs] = useState<WeekDocs | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  useAppUpdateDraft('HSEWeeklyReport', { anchorDate, kop, preparedBy, includeCarryOver, notes }, saved => {
    setAnchorDate(saved.anchorDate);
    setKop(saved.kop);
    setPreparedBy(saved.preparedBy);
    setIncludeCarryOver(saved.includeCarryOver);
    setNotes(saved.notes);
  });
  useAppUpdateBlocker(isExporting);

  const week = useMemo(() => getWeekRange(anchorDate), [anchorDate]);
  const today = todayYmd();
  const isCurrentWeek = today >= week.start && today <= week.end;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchWeekDocs(week, includeCarryOver)
      .then(result => { if (!cancelled) setDocs(result); })
      .catch(err => {
        console.error('Gagal memuat data HSE Weekly Report:', err);
        if (!cancelled) {
          setDocs(null);
          setLoadError('Gagal memuat data minggu ini. Periksa koneksi internet lalu coba lagi.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [week, includeCarryOver, reloadKey]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ kop, preparedBy }));
    } catch { /* preferensi opsional */ }
  }, [kop, preparedBy]);

  const report = useMemo(
    () => (docs ? buildHSEWeeklyReport(week, docs.hse, docs.findings, docs.open) : null),
    [docs, week],
  );
  const s = report?.summary;
  const isEmpty = !!report && report.daily.every(r => r.total === 0) && report.carryOverFindings.length === 0;

  const handleDownload = async () => {
    if (!report || !docs) return;
    setIsExporting(true);
    const toastId = toast.loading('Memuat foto dokumentasi...');
    try {
      const sources = await collectPhotoSources(report, docs);
      const photos = await preparePhotos(sources, (done, total) => {
        toast.loading(`Menyiapkan foto ${done}/${total}...`, { id: toastId });
      });
      toast.loading('Menyusun file Excel...', { id: toastId });
      const [left, right] = await Promise.all([loadLogo(KOP[kop].logo), loadLogo(logoNeutra)]);
      const workbook = buildHSEWeeklyWorkbook(report, {
        companyName: KOP[kop].company,
        siteName: SITE_NAME,
        preparedBy: preparedBy.trim() || user?.email || 'HSE Officer',
        notes,
        generatedAt: new Date(),
        logos: { left, right },
        photos,
      });
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        hseWeeklyFileName(week),
      );
      toast.success('HSE Weekly Report berhasil diunduh', { id: toastId });
    } catch (err) {
      console.error('Gagal membuat HSE Weekly Report:', err);
      toast.error('Gagal membuat file Excel', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const kpis = s ? [
    { label: 'Inspeksi HSE', value: s.inspections, caption: `${s.inspectedLocations} lokasi`, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    { label: 'Sesi TBM', value: s.tbmSessions, caption: `TBM di ${s.tbmDays} dari 7 hari`, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
    { label: 'Kehadiran TBM', value: s.tbmAttendance, caption: `rata-rata ${s.tbmAverage.toLocaleString('id-ID')} org/sesi`, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
    { label: 'Peserta Induction', value: s.inductionParticipants, caption: `${s.inductionCompanies} perusahaan`, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    { label: 'Temuan Negatif', value: s.negative, caption: `UA ${s.unsafeAction} · UC ${s.unsafeCondition}`, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
    { label: 'Temuan Positif', value: s.positive, caption: 'safe behavior', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
    { label: 'Temuan Open', value: s.totalOpen, caption: s.carryOverOpen ? `${s.carryOverOpen} dari minggu lalu` : 'outstanding', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
    { label: 'Close Rate', value: s.closeRate === null ? '–' : `${s.closeRate}%`, caption: s.negative ? `${s.negativeClosed}/${s.negative} ditutup` : 'tidak ada temuan negatif', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Card 1: Periode & Pengaturan */}
      <div className="bg-white/95 backdrop-blur-xl border border-sky-100 rounded-3xl p-5 sm:p-7 shadow-xl shadow-sky-900/5 text-slate-800 space-y-5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100 shrink-0">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-900">Periode Laporan Mingguan</h3>
              <p className="text-xs text-slate-500">Rekap Senin–Minggu: Inspeksi HSE, Absen TBM, Safety Induction & Temuan K3</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex px-3 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-xs font-bold uppercase tracking-wider shrink-0">
            Minggu ke-{week.isoWeek}
          </span>
        </div>

        {/* Navigasi minggu */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchorDate(addDays(week.start, -7))}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer shrink-0"
            title="Minggu sebelumnya"
            aria-label="Minggu sebelumnya"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-2.5 text-center">
            <p className="text-sm sm:text-base font-black text-slate-900 truncate">{formatWeekLabel(week)}</p>
            <p className="text-[11px] font-semibold text-sky-700">
              Minggu ke-{week.isoWeek} · {formatDayLabel(week.start)} s/d {formatDayLabel(week.end)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAnchorDate(addDays(week.start, 7))}
            disabled={addDays(week.start, 7) > today}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            title="Minggu berikutnya"
            aria-label="Minggu berikutnya"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="hseWeeklyDate" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Lompat ke Tanggal
            </label>
            <div className="flex gap-2">
              <input
                id="hseWeeklyDate"
                type="date"
                value={anchorDate}
                max={today}
                onChange={e => e.target.value && setAnchorDate(e.target.value)}
                className="w-full min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-sm font-semibold transition bg-slate-50/50"
              />
              {!isCurrentWeek && (
                <button
                  type="button"
                  onClick={() => setAnchorDate(today)}
                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition cursor-pointer shrink-0"
                >
                  Minggu ini
                </button>
              )}
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Kop Laporan</span>
            <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-xl border border-slate-200">
              {(Object.keys(KOP) as KopVariant[]).map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setKop(key)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    kop === key ? 'bg-white text-sky-700 shadow-xs border border-sky-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {KOP[key].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="hseWeeklyPreparedBy" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Disusun Oleh
            </label>
            <input
              id="hseWeeklyPreparedBy"
              type="text"
              value={preparedBy}
              onChange={e => setPreparedBy(e.target.value)}
              placeholder="Nama HSE Officer"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-sm font-semibold transition bg-slate-50/50"
            />
          </div>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-2xl border border-orange-200 bg-orange-50/60 cursor-pointer">
          <input
            type="checkbox"
            checked={includeCarryOver}
            onChange={e => setIncludeCarryOver(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-orange-600 cursor-pointer"
          />
          <span className="text-xs text-orange-900">
            <span className="font-bold">Sertakan temuan negatif yang masih OPEN dari minggu-minggu sebelumnya</span>
            <span className="block text-orange-700 mt-0.5">Ditampilkan terpisah di tabel Temuan K3 sebagai item yang perlu tindak lanjut.</span>
          </span>
        </label>

        <div>
          <label htmlFor="hseWeeklyNotes" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Catatan / Highlight Minggu Ini <span className="normal-case font-medium text-slate-400">(opsional)</span>
          </label>
          <textarea
            id="hseWeeklyNotes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder={'Contoh:\n• 2 temuan masih open, target close Rabu.\n• Rencana minggu depan: refresh training LOTO vendor.'}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-sm transition bg-slate-50/50 resize-y"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={handleDownload}
            disabled={!report || loading || isExporting}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {isExporting ? 'Menyusun Excel...' : 'Download Weekly Report (Excel)'}
          </motion.button>
          <p className="text-[11px] text-slate-500">
            1 worksheet lengkap dengan foto dokumentasi tiap laporan (foto bisa diperbesar di Excel).
          </p>
        </div>
      </div>

      {/* Card 2: Preview Ringkasan */}
      <div className="bg-white/95 backdrop-blur-xl border border-sky-100 rounded-3xl p-5 sm:p-7 shadow-xl shadow-sky-900/5 text-slate-800 space-y-5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <h3 className="text-base font-black text-slate-900">Preview Ringkasan</h3>
            <p className="text-xs text-slate-500">Data yang akan masuk ke file Excel minggu ini</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey(k => k + 1)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
        </div>

        {loading && !report ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm font-semibold text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-sky-600" /> Memuat data minggu ini...
          </div>
        ) : loadError ? (
          <div className="flex items-start gap-3 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{loadError}</span>
          </div>
        ) : report && s ? (
          <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {isEmpty && (
              <div className="flex items-start gap-3 p-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                Belum ada data Inspeksi, TBM, Induction maupun Temuan pada minggu ini.
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              {kpis.map(k => (
                <div key={k.label} className={`rounded-2xl border p-3 ${k.bg}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{k.label}</p>
                  <p className={`text-2xl font-black leading-tight ${k.color}`}>{k.value}</p>
                  <p className="text-[11px] text-slate-500 truncate">{k.caption}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[560px] text-xs">
                <thead className="bg-sky-50 text-sky-900">
                  <tr>
                    <th className="text-left font-bold px-3 py-2">Kegiatan</th>
                    {week.days.map(d => (
                      <th key={d} className="font-bold px-2 py-2 text-center whitespace-nowrap">{formatDayLabel(d).replace(', ', ' ')}</th>
                    ))}
                    <th className="font-bold px-3 py-2 text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.daily.map(row => (
                    <tr key={row.key} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-semibold text-slate-700 whitespace-nowrap">{row.label}</td>
                      {row.perDay.map((n, i) => (
                        <td key={i} className={`px-2 py-1.5 text-center ${n ? 'font-bold text-sky-800 bg-sky-50/70' : 'text-slate-300'}`}>
                          {n || '–'}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-center font-black text-slate-900 bg-slate-50">{row.total || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <PreviewList
                icon={HardHat}
                title="HSE Inspection"
                count={`${report.inspections.length} laporan`}
                accent="text-emerald-700 bg-emerald-50 border-emerald-200"
                empty="Tidak ada inspeksi"
                items={report.inspections.map(i => ({ key: i.id, date: formatDayLabel(i.date), main: i.aktivitas, sub: `${i.lokasi} · PIC ${i.pic}` }))}
              />
              <PreviewList
                icon={Clock}
                title="Absen TBM"
                count={`${report.tbm.length} sesi`}
                accent="text-indigo-700 bg-indigo-50 border-indigo-200"
                empty="Tidak ada sesi TBM"
                items={report.tbm.map(t => ({ key: t.id, date: formatDayLabel(t.date), main: `${t.totalSDM} orang · ${t.time || '-'}`, sub: t.keterangan }))}
              />
              <PreviewList
                icon={UserCheck}
                title="Safety Induction"
                count={`${s.inductionParticipants} peserta`}
                accent="text-amber-700 bg-amber-50 border-amber-200"
                empty="Tidak ada safety induction"
                items={report.inductions.flatMap(ind => ind.participants.map((p, i) => ({
                  key: `${ind.id}-${i}`, date: formatDayLabel(ind.date), main: p.nama, sub: `${p.perusahaan} · ${p.jabatan}`,
                })))}
              />
              <PreviewList
                icon={AlertTriangle}
                title="Temuan K3"
                count={`${report.findings.length} baru${report.carryOverFindings.length ? ` + ${report.carryOverFindings.length} open lama` : ''}`}
                accent="text-rose-700 bg-rose-50 border-rose-200"
                empty="Tidak ada temuan"
                items={[...report.findings, ...report.carryOverFindings].map(f => ({
                  key: f.id,
                  date: f.date < week.start ? formatDate(f.date) : formatDayLabel(f.date),
                  main: f.title,
                  sub: `${f.classification} · ${f.location}`,
                  badge: f.status === 'open' ? 'OPEN' : 'CLOSE',
                  positive: f.type === 'positive',
                }))}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface PreviewItem {
  key: string;
  date: string;
  main: string;
  sub: string;
  badge?: 'OPEN' | 'CLOSE';
  positive?: boolean;
}

function PreviewList({ icon: Icon, title, count, accent, empty, items }: {
  icon: LucideIcon;
  title: string;
  count: string;
  accent: string;
  empty: string;
  items: PreviewItem[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`p-1.5 rounded-lg border ${accent}`}><Icon className="w-3.5 h-3.5" /></span>
          <span className="text-sm font-bold text-slate-800 truncate">{title}</span>
        </div>
        <span className="text-[11px] font-bold text-slate-500 shrink-0">{count}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-3.5 py-4 text-xs italic text-slate-400 text-center">{empty}</p>
      ) : (
        <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100">
          {items.map(it => (
            <li key={it.key} className="flex items-start gap-3 px-3.5 py-2">
              <span className="w-20 shrink-0 text-[11px] font-semibold text-slate-500 pt-0.5">{it.date}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold truncate ${it.positive ? 'text-teal-700' : 'text-slate-800'}`}>{it.main}</p>
                <p className="text-[11px] text-slate-500 truncate">{it.sub}</p>
              </div>
              {it.badge && (
                <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-black border ${
                  it.badge === 'OPEN' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {it.badge}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
