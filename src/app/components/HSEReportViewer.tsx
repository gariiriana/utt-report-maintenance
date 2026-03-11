import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { generateHSEPdf, type HSEFormData } from './HSEPdfExport';
import {
    ShieldCheck, MapPin, User, Users, Briefcase,
    CheckSquare, Square, FileDown, Loader2, AlertTriangle,
    HardHat, Calendar, Download
} from 'lucide-react';
import logoUTT from '@/assets/232afb9a46e8d280b1d1b9dca62e90c6882e64e6.png';

const CHECKLIST_LABELS = [
    { key: 'mop', label: 'MOP' },
    { key: 'jsa', label: 'JSA' },
    { key: 'ptw', label: 'PTW' },
    { key: 'ppe', label: 'PPE' },
    { key: 'toolsBertagging', label: 'Tools Bertagging & sdh di-checklist' },
    { key: 'logMaintenance', label: 'Log Maintenance' },
    { key: 'housekeeping', label: 'Housekeeping Area Project' },
    { key: 'safeCondition', label: 'Safe Condition' },
    { key: 'safeAction', label: 'Safe Action' },
    { key: 'safetySign', label: 'Safety Sign' },
    { key: 'fullBodyHarness', label: 'Full Body Harness (Optional)' },
];

interface HSEReportViewerProps {
    reportId: string;
}

interface ReportData {
    aktivitas: string;
    lokasi: string;
    personil: string;
    pic: string;
    anggota: string;
    checklist: Record<string, boolean>;
    createdAt?: any;
    date?: string;
    photos?: { id: string; dataUrl: string; description: string; index: number }[];
}

export function HSEReportViewer({ reportId }: HSEReportViewerProps) {
    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'hse', reportId));
                if (!docSnap.exists()) {
                    setError('Laporan tidak ditemukan.');
                    return;
                }
                const data = docSnap.data() as ReportData;

                // Fetch photos from subcollection
                const photosSnap = await getDocs(collection(db, `hse/${reportId}/photos`));
                const photos = photosSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as any))
                    .sort((a, b) => (a.index || 0) - (b.index || 0));

                setReport({ ...data, photos });
            } catch (err) {
                console.error(err);
                setError('Gagal memuat laporan.');
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [reportId]);

    const handleDownloadPDF = async () => {
        if (!report) return;
        setIsDownloading(true);
        try {
            const formData: HSEFormData = {
                aktivitas: report.aktivitas,
                lokasi: report.lokasi,
                personil: report.personil,
                pic: report.pic,
                anggota: report.anggota,
                checklist: report.checklist as any,
                photos: (report.photos || []).map(p => ({ base64: p.dataUrl, description: p.description || '' })),
                date: report.date,
            };
            await generateHSEPdf(formData);
        } catch (err) {
            console.error(err);
        } finally {
            setIsDownloading(false);
        }
    };

    // ── Loading state ───────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full border-4 border-green-500/30 border-t-green-500 animate-spin mx-auto" />
                    <p className="text-slate-400 text-sm font-medium">Memuat laporan HSE...</p>
                </div>
            </div>
        );
    }

    // ── Error state ─────────────────────────────────────────
    if (error || !report) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
                <div className="text-center space-y-4 max-w-sm">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Laporan Tidak Ditemukan</h2>
                    <p className="text-slate-400 text-sm">{error || 'Link laporan mungkin sudah tidak valid.'}</p>
                </div>
            </div>
        );
    }

    const safeCount = Object.values(report.checklist || {}).filter(Boolean).length;
    const totalChecklist = CHECKLIST_LABELS.length;
    const dateStr = report.createdAt?.toDate
        ? report.createdAt.toDate().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : (report.date || new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 font-sans text-slate-200">

            {/* Header */}
            <div className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={logoUTT} alt="UTT" className="w-10 h-10 object-contain" />
                        <div>
                            <p className="text-xs text-slate-400">PT United Transworld Trading</p>
                            <div className="flex items-center gap-1 mt-0.5">
                                <ShieldCheck className="w-3 h-3 text-green-400" />
                                <span className="text-[10px] text-green-400 font-bold tracking-wide uppercase">HSE Report</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition shadow-lg shadow-green-600/20"
                    >
                        {isDownloading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                        ) : (
                            <><Download className="w-4 h-4" /> Download PDF</>
                        )}
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

                {/* Hero Card */}
                <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-500/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-green-500/5 rounded-full -mr-24 -mt-24 blur-3xl" />
                    <div className="relative z-10">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-green-500/15 rounded-2xl border border-green-500/25 flex-shrink-0">
                                <HardHat className="w-7 h-7 text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-green-400/80 uppercase tracking-widest mb-1">HSE Inspection Report</p>
                                <h1 className="text-xl sm:text-2xl font-black text-white leading-tight break-words">
                                    {report.aktivitas}
                                </h1>
                                <div className="flex items-center gap-2 mt-2 text-slate-400">
                                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="text-xs">{dateStr}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Section */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800/60 flex items-center gap-3">
                        <div className="p-1.5 bg-blue-500/15 rounded-lg">
                            <Briefcase className="w-4 h-4 text-blue-400" />
                        </div>
                        <h2 className="text-sm font-bold text-white">Informasi Pekerjaan</h2>
                    </div>
                    <div className="p-5 space-y-4">
                        {[
                            { icon: MapPin, label: 'Lokasi', value: report.lokasi },
                            { icon: User, label: 'PIC', value: report.pic },
                            { icon: Users, label: 'Personil', value: report.personil },
                            { icon: Users, label: 'Anggota Tim', value: report.anggota },
                        ].map(({ icon: Icon, label, value }) => value && (
                            <div key={label} className="flex gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                                    <Icon className="w-4 h-4 text-slate-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
                                    <p className="text-sm text-white font-medium break-words">{value || '-'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Checklist Section */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-emerald-500/15 rounded-lg">
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                            </div>
                            <h2 className="text-sm font-bold text-white">Checklist Keselamatan Kerja</h2>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${safeCount === totalChecklist
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            }`}>
                            {safeCount}/{totalChecklist} Terpenuhi
                        </span>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {CHECKLIST_LABELS.map(({ key, label }) => {
                            const checked = !!(report.checklist?.[key]);
                            return (
                                <div key={key} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${checked
                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                    : 'bg-slate-800/40 border-slate-700/40'
                                    }`}>
                                    <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${checked ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                                        {checked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                    </div>
                                    <span className={`text-sm font-medium ${checked ? 'text-emerald-300' : 'text-slate-400'}`}>{label}</span>
                                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${checked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/10 text-red-400/60'}`}>
                                        {checked ? '✓' : '✗'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Photos Section */}
                {report.photos && report.photos.length > 0 && (
                    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center gap-3">
                            <div className="p-1.5 bg-blue-500/15 rounded-lg">
                                <ShieldCheck className="w-4 h-4 text-blue-400" />
                            </div>
                            <h2 className="text-sm font-bold text-white">Foto Dokumentasi</h2>
                            <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full font-medium">
                                {report.photos.length} foto
                            </span>
                        </div>
                        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {report.photos.map((photo, idx) => (
                                <div key={photo.id} className="flex flex-col gap-2">
                                    <div className="relative rounded-xl overflow-hidden border border-slate-700/40 aspect-[4/3] bg-slate-950">
                                        <img src={photo.dataUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                                        <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-slate-700/50">
                                            {idx + 1}
                                        </div>
                                    </div>
                                    {photo.description && (
                                        <p className="text-[11px] text-slate-400 px-1 leading-relaxed">{photo.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Download CTA */}
                <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/20 border border-green-500/20 rounded-2xl p-6 text-center space-y-4">
                    <FileDown className="w-10 h-10 text-green-400 mx-auto" />
                    <div>
                        <h3 className="text-white font-bold">Download Laporan PDF</h3>
                        <p className="text-slate-400 text-sm mt-1">Dapatkan laporan lengkap dalam format PDF</p>
                    </div>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className="w-full sm:w-auto px-8 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white rounded-xl font-bold transition shadow-xl shadow-green-600/20 flex items-center justify-center gap-2 mx-auto"
                    >
                        {isDownloading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF...</>
                        ) : (
                            <><Download className="w-4 h-4" /> Download PDF Laporan</>
                        )}
                    </button>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-600 pb-4">
                    PT Dwimitra Ekatama Mandiri — HSE Inspection Report System<br />
                    Safety first "Yes" Accident "No" 🤙✊
                </p>
            </div>
        </div>
    );
}
