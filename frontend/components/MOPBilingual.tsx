// ============================================================================
// FILE: frontend/components/MOPBilingual.tsx
// Deskripsi: Menu Bilingual MOP (khusus akun Dwimitra & QC DME).
//            Alur: upload 1 file Word MOP -> AI (tier gratis) menerjemahkan seluruh
//            dokumen dan memeriksa tiap baris -> review & edit EN | ID -> simpan
//            DOCX bilingual (baris Indonesia di bawah baris Inggris, layout asli
//            utuh) ke Arsip MOP.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, doc, onSnapshot, query, orderBy, getDocs, setDoc, writeBatch,
  serverTimestamp, Bytes, Timestamp
} from 'firebase/firestore';
import {
  FileUp, Languages, Loader2, Download, Trash2, Search, CheckCircle2,
  AlertTriangle, RotateCcw, X, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import { useAuth } from './AuthContext';
import { parseMOPDocx, buildBilingualMOPDocx, bilingualFileName, MOPSegment } from '@/utils/mopBilingualDocx';
import { translateMOPSegments } from '@/utils/mopTranslateApi';
import { isHybridOrEnglish } from '@/utils/sopEopBilingualAI';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const CHUNK_BYTES = 900 * 1024;

type Step = 'upload' | 'translating' | 'review' | 'saving';
type RowStatus = 'ok' | 'check' | 'skip' | 'failed';
type ReviewFilter = 'all' | 'attention' | 'skip';

interface ArchiveDoc {
  id: string;
  title: string;
  documentNumber?: string;
  originalFileName: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  translatedParagraphs: number;
  createdBy: string;
  createdAt?: Timestamp;
}

const STATUS_STYLE: Record<RowStatus, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  check: { label: 'Perlu dicek', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  skip: { label: 'Tanpa baris ID', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  failed: { label: 'Gagal', className: 'bg-red-50 text-red-700 border-red-200' },
};

const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

export function MOPBilingual() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Proses bilingual ──────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [meta, setMeta] = useState({ title: '', documentNumber: '' });
  const [segments, setSegments] = useState<MOPSegment[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [retrying, setRetrying] = useState(false);

  // ─── Arsip ─────────────────────────────────────────────────────────────────
  const [archive, setArchive] = useState<ArchiveDoc[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'mop_bilingual'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setArchive(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ArchiveDoc[]);
      setArchiveError(null);
      setArchiveLoading(false);
    }, (error) => {
      setArchiveLoading(false);
      setArchiveError(error.code === 'permission-denied'
        ? 'Akses ditolak. Pastikan rules Firestore terbaru (mop_bilingual) sudah di-deploy.'
        : 'Gagal memuat Arsip MOP.');
    });
    return () => unsubscribe();
  }, [user]);

  // Cegah tab tertutup saat terjemahan / penyimpanan berjalan
  useEffect(() => {
    if (step !== 'translating' && step !== 'saving') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [step]);

  const rowStatus = (text: string): RowStatus => {
    const id = (translations[text] || '').trim();
    if (!id) return failed.has(text) ? 'failed' : 'skip';
    return warnings[text] || isHybridOrEnglish(id, text) ? 'check' : 'ok';
  };

  const counts = useMemo(() => {
    const c: Record<RowStatus, number> = { ok: 0, check: 0, skip: 0, failed: 0 };
    segments.forEach(s => { c[rowStatus(s.text)]++; });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, translations, warnings, failed]);

  const visibleRows = segments.map((s, i) => ({ ...s, no: i + 1, status: rowStatus(s.text) })).filter(r =>
    reviewFilter === 'all' ? true
      : reviewFilter === 'attention' ? (r.status === 'check' || r.status === 'failed')
        : r.status === 'skip');

  const resetProcess = () => {
    setStep('upload');
    setFile(null);
    setBuffer(null);
    setSegments([]);
    setTranslations({});
    setWarnings({});
    setFailed(new Set());
    setProgress({ done: 0, total: 0 });
    setReviewFilter('all');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runTranslation = async (allSegments: MOPSegment[], targets: string[], title: string) => {
    const result = await translateMOPSegments(
      title,
      allSegments.map(s => s.text),
      targets,
      (done, total) => setProgress({ done, total })
    );
    setTranslations(prev => ({ ...prev, ...result.translations }));
    setWarnings(prev => {
      const next = { ...prev };
      targets.forEach(t => { delete next[t]; });
      return { ...next, ...result.warnings };
    });
    setFailed(prev => {
      const next = new Set(prev);
      targets.forEach(t => next.delete(t));
      result.failed.forEach(t => next.add(t));
      return next;
    });
    return result;
  };

  const handleFile = async (selected: File) => {
    if (!selected.name.toLowerCase().endsWith('.docx')) {
      toast.error('Hanya file Word (.docx) yang didukung. File PDF/.doc lama perlu disimpan ulang sebagai .docx.');
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error('File terlalu besar. Maksimal 15 MB.');
      return;
    }

    try {
      const buf = await selected.arrayBuffer();
      const parsed = await parseMOPDocx(buf);
      if (parsed.segments.length === 0) {
        toast.error('Tidak ada teks bahasa Inggris yang bisa diterjemahkan di file ini.');
        return;
      }
      const title = parsed.title || selected.name.replace(/\.docx$/i, '');
      setFile(selected);
      setBuffer(buf);
      setMeta({ title, documentNumber: parsed.documentNumber });
      setSegments(parsed.segments);
      setTranslations({});
      setWarnings({});
      setFailed(new Set());
      setProgress({ done: 0, total: parsed.segments.length });
      setStep('translating');

      const result = await runTranslation(parsed.segments, parsed.segments.map(s => s.text), title);
      setStep('review');
      if (result.failed.length > 0) {
        toast.warning(`${result.failed.length} baris gagal diterjemahkan${result.lastError ? ` (${result.lastError})` : ''}. Coba ulang atau isi manual di layar review.`);
      } else {
        toast.success('Terjemahan selesai. Silakan cek sebelum disimpan.');
      }
    } catch (err) {
      console.error('MOP bilingual error:', err);
      toast.error(err instanceof Error ? err.message : 'Gagal memproses file MOP.');
      resetProcess();
    }
  };

  const handleRetryFailed = async () => {
    const targets = segments.map(s => s.text).filter(t => failed.has(t));
    if (targets.length === 0) return;
    setRetrying(true);
    try {
      const result = await runTranslation(segments, targets, meta.title);
      if (result.failed.length > 0) toast.warning(`${result.failed.length} baris masih gagal. Isi manual bila perlu.`);
      else toast.success('Semua baris berhasil diterjemahkan.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menerjemahkan ulang.');
    } finally {
      setRetrying(false);
    }
  };

  const buildOutput = async () => {
    if (!buffer) throw new Error('File asli tidak tersedia.');
    return buildBilingualMOPDocx(buffer, translations);
  };

  const handleDownloadPreview = async () => {
    if (!file) return;
    try {
      const { blob } = await buildOutput();
      downloadBlob(blob, bilingualFileName(file.name));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat file.');
    }
  };

  const handleSave = async () => {
    if (!file || !user) return;
    setStep('saving');
    try {
      const { blob, translatedParagraphs } = await buildOutput();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const totalChunks = Math.ceil(bytes.length / CHUNK_BYTES);
      const ref = doc(collection(db, 'mop_bilingual'));

      // Potongan file dulu, dokumen utama terakhir: arsip hanya menampilkan file yang lengkap.
      for (let i = 0; i < totalChunks; i++) {
        await setDoc(doc(db, 'mop_bilingual', ref.id, 'chunks', String(i).padStart(5, '0')), {
          index: i,
          data: Bytes.fromUint8Array(bytes.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES)),
        });
      }
      await setDoc(ref, {
        title: meta.title.slice(0, 500),
        documentNumber: meta.documentNumber.slice(0, 300),
        originalFileName: file.name.slice(0, 300),
        fileName: bilingualFileName(file.name).slice(0, 300),
        fileSize: bytes.length,
        totalChunks,
        translatedParagraphs,
        createdBy: user.email || '',
        createdAt: serverTimestamp(),
      });

      toast.success('MOP bilingual tersimpan di Arsip MOP.');
      resetProcess();
    } catch (err) {
      console.error('Save MOP bilingual error:', err);
      toast.error('Gagal menyimpan ke Arsip MOP.');
      setStep('review');
    }
  };

  const handleArchiveDownload = async (item: ArchiveDoc) => {
    setBusyId(item.id);
    try {
      const snap = await getDocs(collection(db, 'mop_bilingual', item.id, 'chunks'));
      const parts = snap.docs
        .map(d => d.data() as { index: number; data: Bytes })
        .sort((a, b) => a.index - b.index)
        .map(p => new Uint8Array(p.data.toUint8Array()));
      if (parts.length !== item.totalChunks) throw new Error('File di arsip tidak lengkap.');
      downloadBlob(new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), item.fileName);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunduh file.');
    } finally {
      setBusyId(null);
    }
  };

  const handleArchiveDelete = async (item: ArchiveDoc) => {
    setBusyId(item.id);
    try {
      const snap = await getDocs(collection(db, 'mop_bilingual', item.id, 'chunks'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'mop_bilingual', item.id));
      await batch.commit();
      toast.success('MOP bilingual dihapus dari arsip.');
    } catch (err) {
      toast.error('Gagal menghapus file.');
    } finally {
      setBusyId(null);
      setPendingDeleteId(null);
    }
  };

  const filteredArchive = archive.filter(a => {
    const term = archiveSearch.trim().toLowerCase();
    return !term || [a.title, a.documentNumber, a.originalFileName].some(v => (v || '').toLowerCase().includes(term));
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 border border-sky-100/90 shadow-md">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
            <Languages className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bilingual MOP</h1>
            <p className="text-slate-500 text-sm font-medium">
              Upload satu file Word MOP. AI menerjemahkan seluruh dokumen dengan glosarium istilah MOP dan memeriksa
              tiap baris, Anda cek hasilnya, lalu file bilingual (baris Indonesia di bawah baris Inggris, layout asli
              tetap) tersimpan di Arsip MOP.
            </p>
          </div>
        </div>
      </div>

      {/* Langkah 1: Upload */}
      {step === 'upload' && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) handleFile(dropped);
          }}
          className="bg-white/90 rounded-2xl border-2 border-dashed border-teal-200 hover:border-teal-400 hover:bg-teal-50/40 transition p-10 text-center cursor-pointer shadow-sm"
        >
          <FileUp className="w-10 h-10 text-teal-600 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-800">Klik atau seret satu file MOP (.docx) ke sini</p>
          <p className="text-xs text-slate-500 mt-1">Maksimal 15 MB. Proses terjemahan sekitar 1–2 menit.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) handleFile(selected);
            }}
          />
        </div>
      )}

      {/* Langkah 2: Menerjemahkan */}
      {step === 'translating' && (
        <div className="bg-white/90 rounded-2xl border border-sky-100 p-8 shadow-md text-center">
          <Loader2 className="w-9 h-9 text-teal-600 animate-spin mx-auto mb-3" />
          <p className="font-bold text-slate-900">AI sedang menerjemahkan {file?.name}</p>
          <p className="text-sm text-slate-500 mt-1">{progress.done} dari {progress.total} baris selesai. Jangan tutup halaman ini.</p>
          <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden max-w-md mx-auto">
            <div
              className="h-full bg-teal-500 transition-all duration-500"
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Langkah 3: Review */}
      {(step === 'review' || step === 'saving') && (
        <div className="bg-white/90 rounded-2xl border border-sky-100 shadow-md overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Review terjemahan</p>
              <h2 className="text-lg font-black text-slate-900 truncate">{meta.title}</h2>
              <p className="text-xs text-slate-500 truncate">
                {file?.name}{meta.documentNumber ? ` · ${meta.documentNumber}` : ''} · {segments.length} baris unik
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={resetProcess}
                disabled={step === 'saving'}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold border border-slate-200 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" /> Batal
              </button>
              <button
                onClick={handleDownloadPreview}
                disabled={step === 'saving'}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-teal-700 rounded-xl text-sm font-bold border border-teal-200 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Download untuk dicek
              </button>
              <button
                onClick={handleSave}
                disabled={step === 'saving'}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-600/20 cursor-pointer"
              >
                {step === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Simpan ke Arsip MOP
              </button>
            </div>
          </div>

          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
            {(['all', 'attention', 'skip'] as ReviewFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setReviewFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                  reviewFilter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f === 'all' ? `Semua (${segments.length})`
                  : f === 'attention' ? `Perlu perhatian (${counts.check + counts.failed})`
                    : `Tanpa baris ID (${counts.skip})`}
              </button>
            ))}
            {counts.failed > 0 && (
              <button
                onClick={handleRetryFailed}
                disabled={retrying || step === 'saving'}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 cursor-pointer disabled:opacity-50"
              >
                {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Terjemahkan ulang yang gagal ({counts.failed})
              </button>
            )}
          </div>

          <p className="px-5 pt-3 text-[11px] text-slate-500">
            Kolom Indonesia yang dikosongkan tidak akan diberi baris terjemahan (cocok untuk nama orang, merek, atau kode).
            Teks yang muncul berkali-kali cukup diedit sekali.
          </p>
          {counts.check > 0 && (
            <p className="px-5 pt-1.5 flex items-center gap-1.5 text-[11px] text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              "Perlu dicek" = pemeriksaan otomatis menemukan kemungkinan masalah (alasannya tertulis di bawah kolom Indonesia)
              atau terjemahan masih memuat banyak kata Inggris yang sering kali memang istilah teknis.
            </p>
          )}

          <div className="p-5 space-y-2.5 max-h-[65vh] overflow-y-auto">
            {visibleRows.length === 0 && (
              <p className="text-center text-sm text-slate-500 py-8">Tidak ada baris pada filter ini.</p>
            )}
            {visibleRows.map(row => (
              <div key={row.text} className="grid grid-cols-1 md:grid-cols-[2.5rem_1fr_1fr_7rem] gap-2 md:gap-3 items-start p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                <span className="text-xs font-bold text-slate-400 md:pt-2">#{row.no}</span>
                <p className="text-sm text-slate-800 md:pt-1.5 break-words">
                  {row.text}
                  {row.occurrences > 1 && <span className="ml-1.5 text-[10px] font-bold text-slate-500">×{row.occurrences}</span>}
                </p>
                <div className="min-w-0">
                  <textarea
                    value={translations[row.text] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTranslations(prev => ({ ...prev, [row.text]: value }));
                      // Setelah diedit manusia, peringatan otomatis tidak berlaku lagi.
                      setWarnings(prev => {
                        if (!(row.text in prev)) return prev;
                        const next = { ...prev };
                        delete next[row.text];
                        return next;
                      });
                    }}
                    rows={Math.min(6, Math.max(1, Math.ceil(row.text.length / 60)))}
                    placeholder="(tidak diberi baris ID)"
                    disabled={step === 'saving'}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm italic text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y"
                  />
                  {warnings[row.text] && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      {warnings[row.text]}
                    </p>
                  )}
                </div>
                <span className={`justify-self-start md:justify-self-center text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${STATUS_STYLE[row.status].className}`}>
                  {STATUS_STYLE[row.status].label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arsip MOP */}
      <div className="bg-white/90 rounded-2xl border border-sky-100 shadow-md overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">Arsip MOP</h2>
            <p className="text-xs text-slate-500 font-medium">{archive.length} file MOP bilingual</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={archiveSearch}
              onChange={(e) => setArchiveSearch(e.target.value)}
              placeholder="Cari judul, nomor dokumen..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>

        {archiveError ? (
          <p className="p-10 text-center text-sm font-semibold text-red-600">{archiveError}</p>
        ) : archiveLoading ? (
          <div className="p-10 text-center">
            <Loader2 className="w-7 h-7 text-teal-600 animate-spin mx-auto" />
          </div>
        ) : filteredArchive.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">
            {archive.length === 0 ? 'Belum ada MOP bilingual yang disimpan.' : 'Tidak ada file yang cocok.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredArchive.map(item => (
              <div key={item.id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <FileText className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 break-words">{item.title}</p>
                    <p className="text-xs text-slate-500 break-words">
                      {item.documentNumber ? `${item.documentNumber} · ` : ''}{item.originalFileName}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {item.translatedParagraphs} paragraf diterjemahkan · {formatSize(item.fileSize)} · {item.createdBy}
                      {item.createdAt ? ` · ${item.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {pendingDeleteId === item.id ? (
                    <>
                      <button
                        onClick={() => handleArchiveDelete(item)}
                        disabled={busyId === item.id}
                        className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        {busyId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ya, hapus'}
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleArchiveDownload(item)}
                        disabled={busyId === item.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 text-teal-700 hover:bg-teal-600 hover:text-white rounded-lg text-xs font-bold border border-teal-200 cursor-pointer disabled:opacity-50"
                      >
                        {busyId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Download
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(item.id)}
                        className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg border border-red-200 cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
