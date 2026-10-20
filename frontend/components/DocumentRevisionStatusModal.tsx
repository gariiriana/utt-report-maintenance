// ============================================================================
// FILE: frontend/components/DocumentRevisionStatusModal.tsx
// Deskripsi: Modal status dokumen (Final / Approved vs Revisi) untuk Laporan CM & PIR
//            di Arsip Standby dan menu Report PIR, lengkap dengan riwayat revisi.
//            Role tanpa wewenang (lihat canChangeRevisionStatus) melihatnya dalam mode baca saja.
// ============================================================================

import type { Dispatch, SetStateAction } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, FileText, History, Loader2, X } from 'lucide-react';
import { getNumberedRevisionHistory, getRevisionCount, isRevisionActive, type RevisionHistoryEntry, type RevisionStatus } from '@/utils/documentRevision';

export interface RevisionForm {
    status: RevisionStatus;
    note: string;
}

interface DocumentRevisionStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: any | null;
    form: RevisionForm;
    setForm: Dispatch<SetStateAction<RevisionForm>>;
    onSave: () => void;
    loading: boolean;
    readOnly?: boolean;
}

const REVISION_NOTE_PRESETS = [
    'Perbaiki foto dokumentasi sebelum / sesudah pengerjaan',
    'Lengkapi nomor tiket SLA / tiket insiden',
    'Koreksi nama perangkat / lokasi lantai',
    'Perjelas rincian analisis akar masalah (RCA)',
    'Lengkapi daftar suku cadang / sparepart yang diganti',
    'Koreksi jam operasional / waktu mulai & selesai perbaikan'
];

const formatRevisionTime = (iso: string) => {
    const date = iso ? new Date(iso) : null;
    if (!date || isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const HISTORY_STYLE: Record<RevisionHistoryEntry['action'], { dot: string; text: string }> = {
    revisi: { dot: 'bg-amber-500', text: 'text-amber-900' },
    catatan: { dot: 'bg-slate-400', text: 'text-slate-700' },
    final: { dot: 'bg-emerald-500', text: 'text-emerald-800' },
};

const historyLabel = (entry: RevisionHistoryEntry, round: number) => {
    if (entry.action === 'revisi') return `Ditandai Revisi ke-${round}`;
    if (entry.action === 'catatan') return `Catatan revisi ke-${round} diperbarui`;
    return round > 0 ? `Ditandai FINAL (setelah revisi ke-${round})` : 'Ditandai FINAL';
};

export function DocumentRevisionStatusModal({
    isOpen,
    onClose,
    report,
    form,
    setForm,
    onSave,
    loading,
    readOnly = false
}: DocumentRevisionStatusModalProps) {
    if (!isOpen || !report) return null;

    const isRevisi = form.status === 'revisi';
    const isPIR = report.reportType === 'PIR';
    const history = getNumberedRevisionHistory(report);
    const revisionCount = getRevisionCount(report);

    const handleAddPreset = (presetText: string) => {
        const current = form.note.trim();
        if (!current) {
            setForm(prev => ({ ...prev, note: presetText }));
        } else if (!current.includes(presetText)) {
            setForm(prev => ({ ...prev, note: `${current}, ${presetText}` }));
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-auto"
            >
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                            isPIR ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                                Status Dokumen {isPIR ? 'PIR (Post Incident)' : 'Corrective Maintenance (CM)'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Dokumen berstatus <strong>Revisi</strong> otomatis <em>dikecualikan</em> dari hasil rekapitulasi.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                        title="Tutup"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Ringkasan Laporan Target */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                        <div className="font-bold text-slate-800 line-clamp-1">
                            {report.incidentName || report.ticketName || report.issue || 'Laporan Dokumen'}
                        </div>
                        <div className="text-slate-500 flex items-center gap-2 flex-wrap">
                            <span>{report.equipmentName || report.equipment || 'Perangkat'}</span>
                            <span>•</span>
                            <span>{report.location || report.area || 'Lokasi'}</span>
                            {report.ticketNumber && (
                                <>
                                    <span>•</span>
                                    <span className="font-mono">{report.ticketNumber}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Radio Choice: Final vs Revisi */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-2">
                            {readOnly ? 'Status Dokumen Saat Ini:' : 'Pilih Status Dokumen:'}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Option Final / Approved */}
                            <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => setForm(prev => ({ ...prev, status: 'final' }))}
                                className={`p-3.5 rounded-xl border-2 text-left transition flex flex-col gap-1 cursor-pointer disabled:cursor-default ${
                                    !isRevisi
                                        ? 'border-emerald-500 bg-emerald-50/70 shadow-sm'
                                        : `border-slate-200 bg-white ${readOnly ? 'opacity-50' : 'hover:border-slate-300'}`
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        FINAL / APPROVED
                                    </span>
                                    {!isRevisi && <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />}
                                </div>
                                <p className="text-[11px] text-slate-600 leading-snug mt-1">
                                    Dokumen sudah lengkap &amp; valid. <strong>Masuk dalam rekapitulasi</strong>.
                                </p>
                            </button>

                            {/* Option Revisi */}
                            <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => setForm(prev => ({ ...prev, status: 'revisi' }))}
                                className={`p-3.5 rounded-xl border-2 text-left transition flex flex-col gap-1 cursor-pointer disabled:cursor-default ${
                                    isRevisi
                                        ? 'border-amber-500 bg-amber-50/70 shadow-sm'
                                        : `border-slate-200 bg-white ${readOnly ? 'opacity-50' : 'hover:border-slate-300'}`
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-amber-800 flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                        DALAM REVISI
                                    </span>
                                    {isRevisi && <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-ping" />}
                                </div>
                                <p className="text-[11px] text-slate-600 leading-snug mt-1">
                                    Masih ada perbaikan. <strong>Otomatis dikecualikan dari rekap</strong>.
                                </p>
                            </button>
                        </div>
                    </div>

                    {/* Note input (Wajib jika revisi, opsional jika final) */}
                    {readOnly ? null : isRevisi ? (
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-amber-900 flex items-center justify-between">
                                <span>Catatan / Bagian yang Harus Direvisi: <span className="text-red-500">*</span></span>
                                <span className="text-[10px] text-slate-400 font-normal">Wajib diisi</span>
                            </label>
                            <textarea
                                value={form.note}
                                onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
                                placeholder="Contoh: Lampirkan foto penggantian part, perbaiki serial number pada halaman 2..."
                                rows={3}
                                className="w-full p-2.5 text-xs sm:text-sm border border-amber-300 rounded-xl bg-amber-50/30 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                            />

                            {/* Quick Presets for Revision */}
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 block mb-1.5">
                                    Pilih template catatan cepat:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {REVISION_NOTE_PRESETS.map((p, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleAddPreset(p)}
                                            className="text-[10px] px-2 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 transition cursor-pointer"
                                        >
                                            + {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        isRevisionActive(report) && report.revisionNote ? (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                                <span className="font-bold text-slate-700 block mb-0.5">Catatan Revisi Sebelumnya:</span>
                                <p className="italic text-slate-500">{report.revisionNote}</p>
                                <span className="text-[10px] text-emerald-700 font-semibold block mt-1">
                                    ✓ Catatan tetap tersimpan di Riwayat Revisi.
                                </span>
                            </div>
                        ) : null
                    )}

                    {/* Riwayat Revisi */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <History className="w-4 h-4 text-slate-500" />
                                Riwayat Revisi
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                revisionCount > 0
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}>
                                Revisi {revisionCount}x
                            </span>
                        </div>
                        {history.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">Laporan ini belum pernah ditandai revisi.</p>
                        ) : (
                            <ol className="ml-1.5 pl-3 border-l-2 border-slate-200 space-y-2.5">
                                {history.map((entry, idx) => (
                                    <li key={`${entry.at}-${idx}`} className="relative text-xs">
                                        <span className={`absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-white ${HISTORY_STYLE[entry.action].dot}`} />
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <span className={`font-bold ${HISTORY_STYLE[entry.action].text}`}>
                                                {historyLabel(entry, entry.round)}
                                            </span>
                                            <span className="text-[10px] text-slate-400">{formatRevisionTime(entry.at)}</span>
                                        </div>
                                        {entry.note && (
                                            <p className="mt-0.5 text-slate-600 italic">"{entry.note}"</p>
                                        )}
                                        <span className="text-[10px] text-slate-400 block">oleh {entry.by}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2">
                    {readOnly ? (
                        <>
                            <span className="text-[11px] text-slate-500 mr-auto">
                                Hanya Standby Engineer &amp; QC yang dapat mengubah status revisi.
                            </span>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer"
                            >
                                Tutup
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={onSave}
                                disabled={loading}
                                className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 shadow-md cursor-pointer ${
                                    isRevisi
                                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                                }`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Simpan Status {isRevisi ? 'Revisi' : 'Final'}</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
