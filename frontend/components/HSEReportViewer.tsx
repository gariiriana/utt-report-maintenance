import { useState, useEffect } from 'react';
import { db } from '@/api/firebase';
import { doc, getDocFromServer, collection, getDocsFromServer } from 'firebase/firestore';
import { generateHSEPdf, type HSEFormData } from '@/utils/HSEPdfExport';
import {
    ShieldCheck, Loader2, AlertTriangle, XCircle,
    HardHat, Calendar, Download, User, Users, ExternalLink
} from 'lucide-react';
import logoUTT from '@/assets/logo_utt.png';
import logoDME from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';

const CHECKLIST_LABELS = [
    { key: 'mop', label: 'MOP' },
    { key: 'jsa', label: 'JSA' },
    { key: 'ptw', label: 'PTW' },
    { key: 'ppe', label: 'PPE Mandatory' },
    { key: 'toolsBertagging', label: 'Tools Bertagging & sdh di-checklist' },
    { key: 'logMaintenance', label: 'Log Maintenance' },
    { key: 'housekeeping', label: 'Housekeeping Area Kerja' },
    { key: 'safetySign', label: 'Safety Sign' },
    { key: 'fullBodyHarness', label: 'Full Body Harness (Optional)' },
    { key: 'coverShoes', label: 'Cover Shoes (Optional)' },
    { key: 'kedokLas', label: 'Kedok Las (Optional)' },
    { key: 'safeCondition', label: 'Safe Condition' },
    { key: 'safeAction', label: 'Safe Action' },
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
    inspectorK3?: string;
    checklist: Record<string, boolean>;
    createdAt?: any;
    date?: string;
    reportType?: 'utt' | 'neutradc';
    photos?: { id: string; dataUrl: string; description: string; index: number }[];
}

export function HSEReportViewer({ reportId }: HSEReportViewerProps) {
    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchReport = async () => {
            let cleanId = reportId.trim().replace(/[.,!?;:]+$/, '');
            console.log('[HSE DEBUG] Fetching report with cleaned ID:', cleanId);

            try {
                const docSnap = await getDocFromServer(doc(db, 'hse', cleanId));
                if (!docSnap.exists()) {
                    console.warn('[HSE ERROR] Document not found in Firestore:', cleanId);
                    setError('Laporan tidak ditemukan. Pastikan ID laporan benar.');
                    setLoading(false);
                    return;
                }
                const data = docSnap.data() as ReportData;

                const photosSnap = await getDocsFromServer(collection(db, `hse/${cleanId}/photos`));
                const photos = photosSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as any))
                    .sort((a, b) => (a.index || 0) - (b.index || 0));

                const fullReport = { ...data, photos };
                setReport(fullReport);

                const { generateHSEPdfBlob } = await import('@/utils/HSEPdfExport');
                const formData: HSEFormData = {
                    aktivitas: fullReport.aktivitas,
                    lokasi: fullReport.lokasi,
                    personil: fullReport.personil,
                    pic: fullReport.pic,
                    anggota: fullReport.anggota,
                    inspectorK3: fullReport.inspectorK3 || '',
                    checklist: fullReport.checklist as any,
                    photos: (fullReport.photos || []).map(p => ({ base64: p.dataUrl, description: p.description || '' })),
                    date: fullReport.date,
                    reportType: fullReport.reportType,
                };
                const blob = await generateHSEPdfBlob(formData);
                const url = URL.createObjectURL(blob);
                setPdfUrl(url);
            } catch (err) {
                console.error(err);
                setError('Gagal memuat laporan.');
            } finally {
                setLoading(false);
            }
        };
        fetchReport();

        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
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
                inspectorK3: report.inspectorK3 || '',
                checklist: report.checklist as any,
                photos: (report.photos || []).map(p => ({ base64: p.dataUrl, description: p.description || '' })),
                date: report.date,
                reportType: report.reportType,
            };
            await generateHSEPdf(formData);
        } catch (err) {
            console.error(err);
        } finally {
            setIsDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full border-4 border-green-500/30 border-t-green-500 animate-spin mx-auto" />
                    <p className="text-slate-400 text-sm font-medium">Memuat laporan HSE...</p>
                </div>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
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

    const isUTT = report.reportType === 'utt';
    const companyName = isUTT ? 'PT United Transworld Trading' : 'PT Dwimitra Ekatama Mandiri';
    const secondaryLogo = isUTT ? logoUTT : logoNeutraDC;

    return (
        <div className="min-h-screen font-sans text-slate-200 flex flex-col relative overflow-hidden">
            <div className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={isUTT ? logoUTT : logoNeutraDC} alt="Logo" className="w-10 h-10 object-contain" />
                        <div className="hidden sm:block">
                            <p className="text-xs text-slate-400 font-medium">{companyName}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                                <ShieldCheck className="w-3 h-3 text-green-400" />
                                <span className="text-[10px] text-green-400 font-bold tracking-wide uppercase">HSE Report Viewer</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
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
            </div>

            <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-65px)] overflow-hidden">
                <div className="flex-1 bg-slate-800 relative group overflow-hidden border-r border-slate-700/50 flex flex-col">
                    <div className="flex-1 relative overflow-y-auto">
                        <div className="hidden lg:block w-full h-full">
                            {pdfUrl ? (
                                <iframe
                                    src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                                    className="w-full h-full border-none"
                                    title="HSE Report PDF"
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                                    <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
                                    <p className="text-slate-400 text-sm">Rendering PDF Preview...</p>
                                </div>
                            )}
                        </div>

                        <div className="lg:hidden w-full min-h-full bg-slate-900 p-4 pb-20">
                            <div className="max-w-2xl mx-auto bg-white text-slate-900 shadow-2xl rounded-sm overflow-hidden flex flex-col min-h-[1050px] p-6 sm:p-10 font-serif border border-slate-200 relative">
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#16a34a]" />
                                <div className="flex justify-between items-center border-b-[0.6mm] border-[#16a34a] pb-4 mb-6 pt-2">
                                    <img src={logoDME} alt="DME Logo" className="w-[28mm] h-[12mm] object-contain" />
                                    <div className="text-center flex-1 mx-2">
                                        <h1 className="text-[15px] font-bold uppercase text-[#0f172a] leading-tight">HSE Inspection Report</h1>
                                        <p className="text-[8.5px] text-[#64748b] font-sans">Health, Safety & Environment — Documentation</p>
                                        <p className="text-[8px] text-[#64748b] font-sans mt-0.5">Tanggal: {dateStr}</p>
                                    </div>
                                    <img src={secondaryLogo} alt="Secondary Logo" className="w-[32mm] h-[12mm] object-contain" />
                                </div>

                                <div className="grid grid-cols-1 gap-2 mb-6 text-[12px] font-sans">
                                    {[
                                        { label: 'Inspector K3', value: report.inspectorK3 },
                                        { label: 'Aktivitas', value: report.aktivitas },
                                        { label: 'Lokasi', value: report.lokasi },
                                        { label: 'Personil', value: report.personil },
                                        { label: 'PIC', value: report.pic },
                                        { label: 'Anggota', value: report.anggota },
                                    ].map(({ label, value }) => value && (
                                        <div key={label} className="flex border-b border-slate-100 py-1">
                                            <span className="w-24 font-bold text-slate-600">{label}</span>
                                            <span className="mr-2">:</span>
                                            <span className="flex-1 font-medium">{value}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mb-6 font-sans">
                                    <h2 className="bg-green-600 text-white text-[11px] font-bold uppercase py-1.5 px-3 mb-3 tracking-widest flex justify-between">
                                        Checklist Keselamatan Kerja
                                        <span>Status</span>
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                                        {CHECKLIST_LABELS.filter(item => !['safeCondition', 'safeAction'].includes(item.key))
                                            .filter(item => !item.label.includes('(Optional)') || !!(report.checklist?.[item.key]))
                                            .map(({ key, label }) => {
                                                const checked = !!(report.checklist?.[key]);
                                                return (
                                                    <div key={key} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-50">
                                                        <span className="text-slate-700">{label.replace(' (Optional)', '')}</span>
                                                        <div className={`p-0.5 rounded ${checked ? 'text-green-600' : 'text-red-500'}`}>
                                                            {checked ? <ShieldCheck className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8 font-sans">
                                    {['safeCondition', 'safeAction'].map(key => {
                                        const label = key === 'safeCondition' ? 'Safe Condition' : 'Safe Action';
                                        const checked = !!(report.checklist?.[key]);
                                        return (
                                            <div key={key} className={`border-2 p-2 rounded-md flex items-center justify-center gap-2 ${checked ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-slate-50 opacity-40'}`}>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${checked ? 'bg-green-500 border-green-600' : 'bg-white border-slate-300'}`}>
                                                    {checked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                </div>
                                                <span className={`text-[11px] font-bold ${checked ? 'text-green-700' : 'text-slate-400'}`}>{label}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {report.photos && report.photos.length > 0 && (
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        {report.photos.slice(0, 2).map((photo, idx) => (
                                            <div key={photo.id} className="flex flex-col gap-1.5 p-1 border border-slate-100 rounded bg-slate-50/50">
                                                <div className="aspect-[4/3] rounded-sm overflow-hidden border border-slate-200">
                                                    <img src={photo.dataUrl} alt="HSE Photo" className="w-full h-full object-cover" />
                                                </div>
                                                {photo.description && (
                                                    <p className="text-[8px] text-slate-600 leading-tight p-1 italic">{photo.description}</p>
                                                )}
                                                <span className="text-[7px] text-slate-400 font-bold ml-1 uppercase">Foto #1.{idx + 1}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-auto pt-6">
                                    <div className="flex justify-between items-end text-[7.5px] text-[#64748b] font-sans pb-1 px-1">
                                        <span className="font-medium">{companyName} — HSE Inspection Report</span>
                                        <span className="font-medium">Halaman 1 / 1</span>
                                    </div>
                                    <div className="h-[2px] bg-[#16a34a] w-full" />
                                </div>
                            </div>

                            {report.photos && report.photos.length > 2 && (
                                <div className="max-w-2xl mx-auto mt-6 bg-white p-6 rounded-sm shadow-xl border border-slate-200 font-sans mb-20">
                                    <h3 className="bg-green-600 text-white text-[11px] font-bold uppercase py-1.5 px-3 mb-4 tracking-widest">
                                        Lampiran Foto Lanjutan ({report.photos.length - 2})
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {report.photos.slice(2).map((photo, idx) => (
                                            <div key={photo.id} className="flex flex-col gap-1.5 p-1 border border-slate-100 rounded bg-slate-50/50">
                                                <div className="aspect-[4/3] rounded-sm overflow-hidden border border-slate-200">
                                                    <img src={photo.dataUrl} alt="HSE Photo" className="w-full h-full object-cover" />
                                                </div>
                                                {photo.description && (
                                                    <p className="text-[9px] text-slate-600 leading-tight p-1 italic">{photo.description}</p>
                                                )}
                                                <span className="text-[8px] text-slate-400 font-bold ml-1 uppercase">Lampiran #{idx + 3}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="hidden lg:flex p-3 bg-slate-900/90 border-t border-slate-700/50 items-center justify-between gap-3 text-xs">
                        <p className="text-slate-400 italic">Pratinjau PDF di atas (Fitur Laptop/PC).</p>
                        {pdfUrl && (
                            <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-blue-400 font-bold hover:text-blue-300 transition"
                            >
                                <ExternalLink className="w-3.5 h-3.5" /> Buka Full Berkas
                            </a>
                        )}
                    </div>
                </div>

                <div className="hidden lg:block w-[400px] h-full overflow-y-auto bg-slate-900/50 backdrop-blur-sm p-6 custom-scrollbar">
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/20 border border-green-500/20 rounded-2xl p-5 shadow-xl">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-green-500/10 rounded-xl border border-green-500/20">
                                    <HardHat className="w-6 h-6 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1">Inspection Detail</p>
                                    <h1 className="text-lg font-bold text-white leading-tight">{report.aktivitas}</h1>
                                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> {dateStr}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Lokasi</p>
                                <p className="text-xs text-white font-medium truncate" title={report.lokasi}>{report.lokasi || '-'}</p>
                            </div>
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Safety Score</p>
                                <p className="text-xs text-white font-medium">{safeCount}/{totalChecklist}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">Personnel</h3>
                            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 space-y-3">
                                {[
                                    { icon: ShieldCheck, label: 'Inspector K3', value: report.inspectorK3 },
                                    { icon: User, label: 'PIC', value: report.pic },
                                    { icon: Users, label: 'Personil', value: report.personil },
                                ].map(({ icon: Icon, label, value }) => value && (
                                    <div key={label} className="flex items-center gap-3">
                                        <div className="w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center">
                                            <Icon className="w-3.5 h-4 text-slate-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-slate-500 font-medium">{label}</p>
                                            <p className="text-xs text-white font-medium truncate">{value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                            <div className="flex gap-3">
                                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                <p className="text-[11px] text-amber-200/70 leading-relaxed italic">
                                    Ini adalah tampilan pratinjau digital. Gunakan tombol "Download PDF" di atas untuk mendapatkan berkas asli ber-stempel resmi.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}
