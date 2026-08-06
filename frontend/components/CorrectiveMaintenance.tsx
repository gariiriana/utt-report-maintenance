import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    MapPin,
    PenTool,
    AlertCircle,
    CheckCircle2,
    Trash2,
    Loader2,
    FileText,
    Calendar,
    User,
    Clock,
    FolderOpen,
    AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    deleteDoc,
    doc,
    addDoc,
    serverTimestamp
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { SLAForm } from './SLAForm';
import { CMReportFormModal } from './CMReportFormModal';
import { PIRReportFormModal } from './PIRReportFormModal';
import { exportSLAReportToExcel } from '../utils/excelExport';
import { exportCMReportToDocx, exportSLAReportToDocx, exportSLAMonthlyRecapToDocx } from '@/utils/docxReportExport';

interface CorrectiveReport {
    id: string;
    issue: string;
    actionTaken: string;
    spareParts: string;
    status: 'Open' | 'InProgress' | 'Resolved';
    location: string;
    photoBase64: string;
    photoDescription: string;
    quarter: string;
    year: string;
    category: string;
    reportedBy: string;
    reportedByEmail: string;
    reportedAt: any;

    // Report Type discriminator
    reportType?: 'SLA' | 'CM_PDF' | 'PIR';

    // SLA fields
    ticketName?: string;
    priority?: 'Low' | 'Medium' | 'High';
    picDME?: string;
    picTDE?: string;
    remark?: string;
    actualResponseTimeMin?: number;
    targetResponseMin?: number;
    responseComply?: boolean;
    photoResponse?: string;
    photoEngineerOnsite?: string;
    actualOnsiteTimeMin?: number;
    targetOnsiteMin?: number;
    onsiteComply?: boolean;
    photoOnsite?: string;
    actualRestoreTimeMin?: number;
    targetRestoreMin?: number;
    restoreComply?: boolean;
    photoRestore?: string;
    actualResolutionTimeMin?: number;
    targetResolutionMin?: number;
    resolutionComply?: boolean;
    photoResolution?: string;

    // PIR fields
    incidentName?: string;
    incidentDate?: string;
    incidentId?: string;
    postmortemOwner?: string;
    severityLevel?: string;
    summary?: string;
}

interface CorrectiveMaintenanceProps {
    readOnly?: boolean;
    initialSearchQuery?: string;
}

const INDO_MONTHS = [
    { value: '0', label: 'Januari' },
    { value: '1', label: 'Februari' },
    { value: '2', label: 'Maret' },
    { value: '3', label: 'April' },
    { value: '4', label: 'Mei' },
    { value: '5', label: 'Juni' },
    { value: '6', label: 'Juli' },
    { value: '7', label: 'Agustus' },
    { value: '8', label: 'September' },
    { value: '9', label: 'Oktober' },
    { value: '10', label: 'November' },
    { value: '11', label: 'Desember' }
];

export function CorrectiveMaintenance({ readOnly = false, initialSearchQuery }: CorrectiveMaintenanceProps) {
    const { user, userRole } = useAuth();
    const isAuthorizedRole = userRole === 'admin' || userRole === 'engineer' || userRole === 'standby_engineer';

    const [reports, setReports] = useState<CorrectiveReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [reportFormType, setReportFormType] = useState<'standard' | 'sla' | 'cm_pdf' | 'pir' | null>(null);
    const [formKey, setFormKey] = useState(0);

    const [editingReportId, setEditingReportId] = useState<string | null>(null);

    // Filters State
    const [archiveFolder, setArchiveFolder] = useState<'cm_pdf' | 'sla' | 'pir'>('cm_pdf');
    const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery || '');

    useEffect(() => {
        if (initialSearchQuery !== undefined) {
            setSearchQuery(initialSearchQuery);
        }
    }, [initialSearchQuery]);
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<string>('all');

    useEffect(() => {
        if (!user) {
            setReports([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = query(collection(db, 'corrective_reports'), orderBy('reportedAt', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as CorrectiveReport[];
                setReports(data);
                setLoading(false);
            },
            (error) => {
                console.error('Error loading CM reports:', error);
                toast.error('Failed to load reports');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    const [deleteId, setDeleteId] = useState<string | null>(null);

    const handleDeleteClick = (id: string) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteDoc(doc(db, 'corrective_reports', deleteId));
            toast.success('Report deleted');
        } catch (error) {
            toast.error('Failed to delete report');
        } finally {
            setDeleteId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Resolved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'InProgress': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            default: return 'bg-red-500/20 text-red-400 border-red-500/30';
        }
    };

    // Filter Logic
    const filteredReports = reports.filter((report) => {
        // Folder filter in Arsip Standby
        if (readOnly) {
            if (archiveFolder === 'cm_pdf' && (report.reportType === 'SLA' || report.reportType === 'PIR')) {
                return false;
            }
            if (archiveFolder === 'sla' && report.reportType !== 'SLA') {
                return false;
            }
            if (archiveFolder === 'pir' && report.reportType !== 'PIR') {
                return false;
            }
        }

        // Date check
        if (report.reportedAt) {
            const reportDate = report.reportedAt.toDate?.();
            if (reportDate) {
                if (selectedMonth !== 'all') {
                    if (reportDate.getMonth().toString() !== selectedMonth) {
                        return false;
                    }
                }
                if (selectedYear !== 'all') {
                    if (reportDate.getFullYear().toString() !== selectedYear) {
                        return false;
                    }
                }
            }
        }

        // Query check
        if (searchQuery.trim() !== '') {
            const queryText = searchQuery.toLowerCase();
            const locationMatch = report.location?.toLowerCase().includes(queryText);
            const issueMatch = report.issue?.toLowerCase().includes(queryText);
            const actionMatch = report.actionTaken?.toLowerCase().includes(queryText);
            const ticketMatch = report.ticketName?.toLowerCase().includes(queryText);
            const remarkMatch = report.remark?.toLowerCase().includes(queryText);
            const incidentMatch = report.incidentName?.toLowerCase().includes(queryText);

            return locationMatch || issueMatch || actionMatch || ticketMatch || remarkMatch || incidentMatch;
        }

        return true;
    });


    const [activeFormTab, setActiveFormTab] = useState<'cm_pdf' | 'sla' | 'pir'>('cm_pdf');

    const buildCMDataFromReport = (report: any) => {
        const dateFormatted = report.incidentDate ||
            (report.reportedAt?.toDate ? report.reportedAt.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) :
                (report.reportedAt ? new Date(report.reportedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'));

        const incName = report.incidentName || report.ticketName || report.issue || 'Corrective Maintenance Report';
        const eqName = report.equipmentName || report.ticketName || report.issue || report.location || 'Equipment';
        const actTaken = report.correctiveAction || report.actionTaken || '-';
        const resText = report.result || report.remark || 'Status perbaikan telah selesai dilaksanakan dengan baik.';
        const visInsp = report.visualInspectionChecking || report.issue || 'Pengecekan kondisi fisik dan fungsi operasional peralatan.';
        const probAnal = report.summaryProblemAnalysis || report.issue || report.remark || report.actionTaken || 'Analisis dan pemulihan sistem operasional peralatan.';

        const spareList = report.spareparts && report.spareparts.length > 0
            ? report.spareparts
            : (report.spareParts
                ? [{ name: report.spareParts, brand: '-', qty: '1' }]
                : [
                    { name: '-', brand: '-', qty: '-' },
                    { name: '-', brand: '-', qty: '-' }
                ]);

        let photoList: any[] = [];
        if (report.photos && report.photos.length > 0) {
            photoList = report.photos;
        } else if (report.photoBase64) {
            photoList.push({ photoBase64: report.photoBase64, description: report.photoDescription || 'Dokumentasi Kejadian' });
        } else if (report.photoResponse) {
            photoList.push({ photoBase64: report.photoResponse, description: 'Bukti Response Time SLA' });
            if (report.photoEngineerOnsite) photoList.push({ photoBase64: report.photoEngineerOnsite, description: 'Bukti Engineer Onsite SLA' });
            if (report.photoOnsite) photoList.push({ photoBase64: report.photoOnsite, description: 'Bukti Principle Onsite SLA' });
            if (report.photoRestore) photoList.push({ photoBase64: report.photoRestore, description: 'Bukti Restore Service SLA' });
            if (report.photoResolution) photoList.push({ photoBase64: report.photoResolution, description: 'Bukti Resolution Time SLA' });
        }

        return {
            incidentName: incName,
            location: report.location || '-',
            incidentDate: dateFormatted,
            incidentId: report.incidentId || (report.id ? report.id.slice(0, 8) : 'N/A'),

            equipmentName: eqName,
            brand: report.brand || '-',
            serialNumber: report.serialNumber || 'N/A',
            installationDate: report.installationDate || 'N/A',

            correctiveAction: actTaken,
            repairTimeStart: report.repairTimeStart || report.timeOrder || report.startOrder || '-',
            repairTimeEnd: report.repairTimeEnd || report.actualTimeResponse || report.finishOrder || '-',
            result: resText,

            visualInspectionChecking: visInsp,
            cleaningPreventiveMethod: report.cleaningPreventiveMethod || 'Pembersihan area kerja dan komponen pendukung.',
            summaryProblemAnalysis: probAnal,

            spareparts: spareList,
            photos: photoList,

            authorName: report.authorName || report.reportedByEmail || 'Standby Engineer',
            preparedByName: report.preparedByName || 'Salman',
            preparedByTitle: report.preparedByTitle || '(Electrical Engineer)',
            reviewedByName: report.reviewedByName || 'Arif Budiman',
            reviewedByTitle: report.reviewedByTitle || '(Technical Manager)',
            acknowledgedBy1Name: report.acknowledgedBy1Name || 'Andrean Bima Pratama',
            acknowledgedBy1Title: report.acknowledgedBy1Title || '(Chief Engineer)',
            acknowledgedBy2Name: report.acknowledgedBy2Name || 'Supriyatno',
            acknowledgedBy2Title: report.acknowledgedBy2Title || '(Facility manager)',
            approvedByName: report.approvedByName || 'Budi Susanto',
            approvedByTitle: report.approvedByTitle || '(Assistant manager HDC Facility Management)'
        };
    };

    const handleExportSingleCMDocx = async (report: any) => {
        const cmData = buildCMDataFromReport(report);
        await exportCMReportToDocx(cmData);
    };

    if (!readOnly) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 border-b border-slate-200 pb-5 gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <PenTool className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 shrink-0" />
                            Corrective Maintenance (CM)
                        </h1>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1">Pembuatan Laporan Pemeliharaan Corrective Standby Engineer</p>
                    </div>

                    {/* 3 Navbar Tabs for Standby Engineer */}
                    <div className="grid grid-cols-3 sm:flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-stretch sm:self-auto gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveFormTab('cm_pdf')}
                            className={`px-2.5 sm:px-4 py-2 sm:py-2 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${activeFormTab === 'cm_pdf'
                                    ? 'bg-red-600 text-white shadow-md'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            <span className="truncate">Report CM (3-Hal)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveFormTab('sla')}
                        className={`px-2.5 sm:px-4 py-2 sm:py-2 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${activeFormTab === 'sla'
                                ? 'bg-red-600 text-white shadow-md'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">Form SLA / SLG (5-Step)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveFormTab('pir')}
                        className={`px-2.5 sm:px-4 py-2 sm:py-2 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${activeFormTab === 'pir'
                                ? 'bg-red-600 text-white shadow-md'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">Report PIR (Postmortem)</span>
                    </button>
                </div>
            </div>

                {
            activeFormTab === 'cm_pdf' ? (
                <CMReportFormModal
                    key={`cm_${formKey}`}
                    onSuccess={() => {
                        setFormKey(prev => prev + 1);
                    }}
                    onCancel={() => {
                        setFormKey(prev => prev + 1);
                    }}
                />
            ) : activeFormTab === 'sla' ? (
                <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl p-6 shadow-lg">
                    <SLAForm
                        key={`sla_${formKey}`}
                        onSuccess={() => {
                            setFormKey(prev => prev + 1);
                        }}
                        onCancel={() => {
                            setFormKey(prev => prev + 1);
                        }}
                    />
                </div>
            ) : (
            <PIRReportFormModal
                key={`pir_${formKey}`}
                onSuccess={() => {
                    setFormKey(prev => prev + 1);
                }}
                onCancel={() => {
                    setFormKey(prev => prev + 1);
                }}
            />
        )
        }
            </div >
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
            <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <FolderOpen className="w-6 h-6 text-red-600" />
                        Arsip Standby
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Daftar laporan pemeliharaan Standby Engineer (Report CM, SLA/SLG, & Report PIR)</p>
                </div>
            </div>

            {/* Folder Switcher Tabs in Arsip Standby */}
            <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-4 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setArchiveFolder('cm_pdf')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition cursor-pointer border ${archiveFolder === 'cm_pdf'
                            ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-500/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs'
                        }`}
                >
                    <FileText className="w-4 h-4" />
                    Folder Report CM ({reports.filter(r => r.reportType !== 'SLA' && r.reportType !== 'PIR').length})
                </button>
                <button
                    type="button"
                    onClick={() => setArchiveFolder('sla')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition cursor-pointer border ${archiveFolder === 'sla'
                            ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-500/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs'
                        }`}
                >
                    <Clock className="w-4 h-4" />
                    Folder Form SLA / SLG ({reports.filter(r => r.reportType === 'SLA').length})
                </button>
                <button
                    type="button"
                    onClick={() => setArchiveFolder('pir')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition cursor-pointer border ${archiveFolder === 'pir'
                            ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-500/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs'
                        }`}
                >
                    <AlertTriangle className="w-4 h-4" />
                    Folder Report PIR ({reports.filter(r => r.reportType === 'PIR').length})
                </button>
            </div>

            <AnimatePresence>
                {showForm && (
                    <div className="mb-8">
                        {reportFormType === 'sla' ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <SLAForm
                                    editId={editingReportId || undefined}
                                    onSuccess={() => {
                                        setShowForm(false);
                                        setReportFormType(null);
                                        setEditingReportId(null);
                                    }}
                                    onCancel={() => {
                                        setShowForm(false);
                                        setReportFormType(null);
                                        setEditingReportId(null);
                                    }}
                                />
                            </motion.div>
                        ) : reportFormType === 'pir' ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <PIRReportFormModal
                                    editId={editingReportId || undefined}
                                    onSuccess={() => {
                                        setShowForm(false);
                                        setReportFormType(null);
                                        setEditingReportId(null);
                                    }}
                                    onCancel={() => {
                                        setShowForm(false);
                                        setReportFormType(null);
                                        setEditingReportId(null);
                                    }}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <CMReportFormModal
                                    editId={editingReportId || undefined}
                                    onSuccess={() => {
                                        setShowForm(false);
                                        setReportFormType(null);
                                        setEditingReportId(null);
                                    }}
                                    onCancel={() => {
                                        setShowForm(false);
                                        setReportFormType(null);
                                        setEditingReportId(null);
                                    }}
                                />
                            </motion.div>
                        )}
                    </div>
                )}
            </AnimatePresence>

            {!showForm && (
                <>
                    {!loading && (
                        <div className="mb-6 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                            <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
                                <div className="relative w-full sm:w-auto sm:min-w-[240px]">
                                    <input
                                        type="text"
                                        placeholder="Cari lokasi, masalah, PIC..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        title="Cari Laporan"
                                        className="w-full pl-4 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition placeholder-slate-400 shadow-sm"
                                    />
                                </div>

                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    title="Filter Bulan"
                                    aria-label="Filter Bulan"
                                    className="w-full sm:w-auto px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition cursor-pointer shadow-sm"
                                >
                                    <option value="all">Semua Bulan</option>
                                    {INDO_MONTHS.map((m) => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>

                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    title="Filter Tahun"
                                    aria-label="Filter Tahun"
                                    className="w-full sm:w-auto px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-500 outline-none transition cursor-pointer shadow-sm"
                                >
                                    <option value="all">Semua Tahun</option>
                                    <option value="2025">2025</option>
                                    <option value="2026">2026</option>
                                    <option value="2027">2027</option>
                                    <option value="2028">2028</option>
                                    <option value="2029">2029</option>
                                    <option value="2030">2030</option>
                                </select>
                            </div>

                            {archiveFolder === 'sla' && (
                                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const samplePhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAB5CAYAAAD9T9FvAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABTSURBVHhe7cExAQAAAMKg9U9tDC8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA0wAaAAABr/w3XQAAAABJRU5ErkJggg==';
                                            const toastId = toast.loading('Membuat data dummy SLA (5 tiket)...');
                                            try {
                                                const dummyItems = [
                                                    {
                                                        reportType: 'SLA',
                                                        ticketName: 'WO-2025-07-001 / VRV Problem',
                                                        issue: '[SLA / SLG] WO-2025-07-001 / VRV Problem (Medium)',
                                                        location: 'SCC Room',
                                                        priority: 'Medium',
                                                        picDME: 'Afdhol',
                                                        picTDE: 'Henru',
                                                        remark: 'Pengecekan refrigerant dan reset error code',
                                                        resolutionRemark: 'Pembersihan filter indoor, perbaikan sensor suhu, dan reset sistem VRV. Kondisi akhir: AC dingin normal.',
                                                        actionTaken: 'Pembersihan filter indoor, perbaikan sensor suhu, dan reset sistem VRV. Kondisi akhir: AC dingin normal.',
                                                        status: 'Resolved',
                                                        spareParts: 'Freon R410a',
                                                        quarter: 'Q3',
                                                        year: '2025',
                                                        timeOrder: '2025-07-01T10:47',
                                                        actualTimeResponse: '2025-07-01T10:48',
                                                        actualResponseTimeMin: 1,
                                                        targetResponseMin: 5,
                                                        responseComply: true,
                                                        photosResponse: [{ photo: samplePhoto, description: 'Bukti screenshot order masuk via WA' }],
                                                        photoResponse: samplePhoto,
                                                        actualTimeOnsite: '2025-07-01T11:15',
                                                        actualOnsiteTimeMin: 28,
                                                        targetOnsiteMin: 120,
                                                        onsiteComply: true,
                                                        photosOnsite: [{ photo: samplePhoto, description: 'Bukti kehadiran principle di SCC Room' }],
                                                        photoOnsite: samplePhoto,
                                                        startOrder: '2025-07-01T11:15',
                                                        finishOrder: '2025-07-01T12:30',
                                                        actualRestoreTimeMin: 75,
                                                        targetRestoreMin: 120,
                                                        restoreComply: true,
                                                        photosRestore: [{ photo: samplePhoto, description: 'Sistem VRV running temporary' }],
                                                        photoRestore: samplePhoto,
                                                        actualResolutionTimeMin: 103,
                                                        targetResolutionMin: 360,
                                                        resolutionComply: true,
                                                        photosResolution: [{ photo: samplePhoto, description: 'Tiket closed di system' }],
                                                        photoResolution: samplePhoto,
                                                        slgScoreRT: 5.0, slgScoreOTP: 5.0, slgScoreRST: 15.0, slgScoreRSP: 10.0, totalIncidentSlgScore: 35.0,
                                                        reportedAt: serverTimestamp(),
                                                        reportedBy: user?.uid || 'dummy_seed',
                                                        reportedByEmail: user?.email || 'standby.engineer@dwimitra.co.id'
                                                    },
                                                    {
                                                        reportType: 'SLA',
                                                        ticketName: 'WO-2025-07-002 / Alarm Chiller 2, Status Off',
                                                        issue: '[SLA / SLG] WO-2025-07-002 / Alarm Chiller 2 (High)',
                                                        location: 'Chiller Plant Room',
                                                        priority: 'High',
                                                        picDME: 'Ifriadi',
                                                        picTDE: 'Indra Setiady',
                                                        remark: 'Pengecekan alur flow kondensor dan pompa',
                                                        resolutionRemark: 'Pengecekan terminasi sensor pressure, pembukaan valve bypass, dan restart panel Chiller 2. Kondisi normal.',
                                                        actionTaken: 'Pengecekan terminasi sensor pressure, pembukaan valve bypass, dan restart panel Chiller 2. Kondisi normal.',
                                                        status: 'Resolved',
                                                        spareParts: '-',
                                                        quarter: 'Q3',
                                                        year: '2025',
                                                        timeOrder: '2025-07-09T10:08',
                                                        actualTimeResponse: '2025-07-09T10:10',
                                                        actualResponseTimeMin: 2,
                                                        targetResponseMin: 5,
                                                        responseComply: true,
                                                        photosResponse: [{ photo: samplePhoto, description: 'Notifikasi alarm Chiller 2 di BMS' }],
                                                        photoResponse: samplePhoto,
                                                        actualTimeOnsite: '2025-07-09T10:40',
                                                        actualOnsiteTimeMin: 32,
                                                        targetOnsiteMin: 120,
                                                        onsiteComply: true,
                                                        photosOnsite: [{ photo: samplePhoto, description: 'Inspeksi fisik di Chiller Plant' }],
                                                        photoOnsite: samplePhoto,
                                                        startOrder: '2025-07-09T10:40',
                                                        finishOrder: '2025-07-09T11:53',
                                                        actualRestoreTimeMin: 73,
                                                        targetRestoreMin: 120,
                                                        restoreComply: true,
                                                        photosRestore: [{ photo: samplePhoto, description: 'Water flow kondensor kembali normal' }],
                                                        photoRestore: samplePhoto,
                                                        actualResolutionTimeMin: 105,
                                                        targetResolutionMin: 240,
                                                        resolutionComply: true,
                                                        photosResolution: [{ photo: samplePhoto, description: 'Status alarm cleared' }],
                                                        photoResolution: samplePhoto,
                                                        slgScoreRT: 5.0, slgScoreOTP: 5.0, slgScoreRST: 15.0, slgScoreRSP: 10.0, totalIncidentSlgScore: 35.0,
                                                        reportedAt: serverTimestamp(),
                                                        reportedBy: user?.uid || 'dummy_seed',
                                                        reportedByEmail: user?.email || 'standby.engineer@dwimitra.co.id'
                                                    },
                                                    {
                                                        reportType: 'SLA',
                                                        ticketName: 'WO-2025-07-003 / Alarm Over Voltage UPS IT Load B',
                                                        issue: '[SLA / SLG] WO-2025-07-003 / Over Voltage UPS (Critical)',
                                                        location: 'IT Load B Room',
                                                        priority: 'Critical',
                                                        picDME: 'Ifriadi',
                                                        picTDE: 'Budi Susanto',
                                                        remark: 'Reset tegangan input dan kalibrasi modul UPS',
                                                        resolutionRemark: 'Reset tegangan input pada Frame 6 UPS IT Load B & penggantian kartu komunikasi. Kondisi tegangan stabil 380V.',
                                                        actionTaken: 'Reset tegangan input pada Frame 6 UPS IT Load B & penggantian kartu komunikasi. Kondisi tegangan stabil 380V.',
                                                        status: 'Resolved',
                                                        spareParts: 'Card Comm UPS',
                                                        quarter: 'Q3',
                                                        year: '2025',
                                                        timeOrder: '2025-07-19T08:19',
                                                        actualTimeResponse: '2025-07-19T08:20',
                                                        actualResponseTimeMin: 1,
                                                        targetResponseMin: 5,
                                                        responseComply: true,
                                                        photosResponse: [{ photo: samplePhoto, description: 'Alert Over Voltage UPS' }],
                                                        photoResponse: samplePhoto,
                                                        actualTimeOnsite: '2025-07-19T08:35',
                                                        actualOnsiteTimeMin: 16,
                                                        targetOnsiteMin: 120,
                                                        onsiteComply: true,
                                                        photosOnsite: [{ photo: samplePhoto, description: 'Tim engineer di depan panel UPS IT Load B' }],
                                                        photoOnsite: samplePhoto,
                                                        startOrder: '2025-07-19T08:35',
                                                        finishOrder: '2025-07-19T09:45',
                                                        actualRestoreTimeMin: 70,
                                                        targetRestoreMin: 120,
                                                        restoreComply: true,
                                                        photosRestore: [{ photo: samplePhoto, description: 'Load bypass ke inverter UPS normal' }],
                                                        photoRestore: samplePhoto,
                                                        actualResolutionTimeMin: 86,
                                                        targetResolutionMin: 120,
                                                        resolutionComply: true,
                                                        photosResolution: [{ photo: samplePhoto, description: 'Modul UPS 100% online' }],
                                                        photoResolution: samplePhoto,
                                                        slgScoreRT: 5.0, slgScoreOTP: 5.0, slgScoreRST: 15.0, slgScoreRSP: 10.0, totalIncidentSlgScore: 35.0,
                                                        reportedAt: serverTimestamp(),
                                                        reportedBy: user?.uid || 'dummy_seed',
                                                        reportedByEmail: user?.email || 'standby.engineer@dwimitra.co.id'
                                                    },
                                                    {
                                                        reportType: 'SLA',
                                                        ticketName: 'WO-2025-07-004 / WLD Ruang Crac Room 3',
                                                        issue: '[SLA / SLG] WO-2025-07-004 / WLD Alarm (Medium)',
                                                        location: 'Crac Room 3',
                                                        priority: 'Medium',
                                                        picDME: 'Ardian',
                                                        picTDE: 'FMA - CBRE',
                                                        remark: 'Pembersihan jalur drain dan pengeringan kabel sensing',
                                                        resolutionRemark: 'Pembersihan kondensat pada baki drain CRAC 3 dan penggantian pita sensor WLD yang lembab. Kondisi area kering.',
                                                        actionTaken: 'Pembersihan kondensat pada baki drain CRAC 3 dan penggantian pita sensor WLD yang lembab. Kondisi area kering.',
                                                        status: 'Resolved',
                                                        spareParts: 'Pita Sensor WLD 2m',
                                                        quarter: 'Q3',
                                                        year: '2025',
                                                        timeOrder: '2025-07-21T16:12',
                                                        actualTimeResponse: '2025-07-21T16:13',
                                                        actualResponseTimeMin: 1,
                                                        targetResponseMin: 5,
                                                        responseComply: true,
                                                        photosResponse: [{ photo: samplePhoto, description: 'Indikasi alarm WLD pada panel' }],
                                                        photoResponse: samplePhoto,
                                                        actualTimeOnsite: '2025-07-21T16:30',
                                                        actualOnsiteTimeMin: 18,
                                                        targetOnsiteMin: 120,
                                                        onsiteComply: true,
                                                        photosOnsite: [{ photo: samplePhoto, description: 'Pengecekan Raised Floor Crac Room 3' }],
                                                        photoOnsite: samplePhoto,
                                                        startOrder: '2025-07-21T16:30',
                                                        finishOrder: '2025-07-21T17:11',
                                                        actualRestoreTimeMin: 41,
                                                        targetRestoreMin: 120,
                                                        restoreComply: true,
                                                        photosRestore: [{ photo: samplePhoto, description: 'Area bebas genangan air' }],
                                                        photoRestore: samplePhoto,
                                                        actualResolutionTimeMin: 59,
                                                        targetResolutionMin: 360,
                                                        resolutionComply: true,
                                                        photosResolution: [{ photo: samplePhoto, description: 'Sistem WLD normal (Standby)' }],
                                                        photoResolution: samplePhoto,
                                                        slgScoreRT: 5.0, slgScoreOTP: 5.0, slgScoreRST: 15.0, slgScoreRSP: 10.0, totalIncidentSlgScore: 35.0,
                                                        reportedAt: serverTimestamp(),
                                                        reportedBy: user?.uid || 'dummy_seed',
                                                        reportedByEmail: user?.email || 'standby.engineer@dwimitra.co.id'
                                                    },
                                                    {
                                                        reportType: 'SLA',
                                                        ticketName: 'WO-2025-07-005 / Terdapat Noise pada Pompa STP',
                                                        issue: '[SLA / SLG] WO-2025-07-005 / Noise Pompa STP (Low)',
                                                        location: 'Pump Room Office',
                                                        priority: 'Low',
                                                        picDME: 'Afdhol',
                                                        picTDE: 'Indra Setiady',
                                                        remark: 'Pelumasan bearing dan pengencangan baut fondasi pompa',
                                                        resolutionRemark: 'Pelumasan ulang bearing mekanis, perbaikan klem baut fondasi, dan alignment impeller. Suara noise hilang.',
                                                        actionTaken: 'Pelumasan ulang bearing mekanis, perbaikan klem baut fondasi, dan alignment impeller. Suara noise hilang.',
                                                        status: 'Resolved',
                                                        spareParts: 'Grease Bearing SKF',
                                                        quarter: 'Q3',
                                                        year: '2025',
                                                        timeOrder: '2025-07-30T09:57',
                                                        actualTimeResponse: '2025-07-30T09:58',
                                                        actualResponseTimeMin: 1,
                                                        targetResponseMin: 5,
                                                        responseComply: true,
                                                        photosResponse: [{ photo: samplePhoto, description: 'Laporan keluhan noise dari user' }],
                                                        photoResponse: samplePhoto,
                                                        actualTimeOnsite: '2025-07-30T10:15',
                                                        actualOnsiteTimeMin: 18,
                                                        targetOnsiteMin: 120,
                                                        onsiteComply: true,
                                                        photosOnsite: [{ photo: samplePhoto, description: 'Tim di Pump Room Office' }],
                                                        photoOnsite: samplePhoto,
                                                        startOrder: '2025-07-30T10:15',
                                                        finishOrder: '2025-07-30T12:34',
                                                        actualRestoreTimeMin: 139,
                                                        targetRestoreMin: 120,
                                                        restoreComply: false,
                                                        photosRestore: [{ photo: samplePhoto, description: 'Pompa beroperasi sementara' }],
                                                        photoRestore: samplePhoto,
                                                        actualResolutionTimeMin: 157,
                                                        targetResolutionMin: 2880,
                                                        resolutionComply: true,
                                                        photosResolution: [{ photo: samplePhoto, description: 'Hasil uji getaran & noise normal' }],
                                                        photoResolution: samplePhoto,
                                                        slgScoreRT: 5.0, slgScoreOTP: 5.0, slgScoreRST: 12.95, slgScoreRSP: 10.0, totalIncidentSlgScore: 32.95,
                                                        reportedAt: serverTimestamp(),
                                                        reportedBy: user?.uid || 'dummy_seed',
                                                        reportedByEmail: user?.email || 'standby.engineer@dwimitra.co.id'
                                                    }
                                                ];

                                                for (const item of dummyItems) {
                                                    await addDoc(collection(db, 'corrective_reports'), item);
                                                }
                                                toast.success('Berhasil menambahkan 5 data dummy SLA (Juli 2025)!', { id: toastId });
                                            } catch (err: any) {
                                                console.error('Error generating dummy SLA:', err);
                                                toast.error('Gagal membuat data dummy SLA: ' + (err.message || err), { id: toastId });
                                            }
                                        }}
                                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer text-xs shrink-0"
                                        title="Generate 5 data dummy SLA untuk pengujian export"
                                    >
                                        + Data Dummy SLA
                                    </button>

                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const slaReports = filteredReports.filter(r => r.reportType === 'SLA');
                                            if (slaReports.length === 0) {
                                                toast.error('Tidak ada laporan SLA yang sesuai filter untuk direkap.');
                                                return;
                                            }
                                            const toastId = toast.loading('Memproses Rekap SLA (DOCX)...');
                                            try {
                                                const monthName = selectedMonth !== 'all' ? (INDO_MONTHS.find(m => m.value === selectedMonth)?.label || selectedMonth) : 'Semua Bulan';
                                                const yearName = selectedYear !== 'all' ? selectedYear : new Date().getFullYear().toString();
                                                const periodTitle = `${monthName} ${yearName}`;
                                                await exportSLAMonthlyRecapToDocx(slaReports, periodTitle);
                                                toast.success('Berhasil mengekspor Rekap SLA Word (DOCX)!', { id: toastId });
                                            } catch (err: any) {
                                                console.error('Failed to export SLA monthly recap:', err);
                                                toast.error('Gagal mengekspor Rekap SLA Word', { id: toastId });
                                            }
                                        }}
                                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 cursor-pointer text-xs shrink-0"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Export Rekap SLA (DOCX)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
                        </div>
                    ) : filteredReports.length === 0 ? (
                        <div className="text-center py-16 bg-white/90 rounded-2xl border border-slate-200 shadow-sm">
                            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-xl font-medium text-slate-900">Laporan Tidak Ditemukan</h3>
                            <p className="text-slate-500 mt-2">Tidak ada data laporan corrective yang cocok dengan kriteria filter pencarian Anda.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredReports.map((report) => (
                                <motion.div
                                    key={report.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`bg-white/90 backdrop-blur-sm rounded-2xl border overflow-hidden hover:border-blue-300 transition shadow-lg relative ${report.reportType === 'PIR'
                                            ? 'border-red-400'
                                            : report.reportType === 'SLA'
                                                ? 'border-red-300'
                                                : 'border-slate-200'
                                        }`}
                                >
                                    {report.reportType === 'PIR' ? (
                                        /* PIR REPORT CARD LAYOUT */
                                        <div className="p-5 sm:p-6">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4 mb-4">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="px-3 py-1 bg-red-100 border border-red-300 rounded-lg text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                                        REPORT PIR (POSTMORTEM)
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>{report.reportedAt?.toDate?.()?.toLocaleDateString() || report.incidentDate}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>Owner: {report.postmortemOwner || report.reportedBy}</span>
                                                    </div>
                                                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-slate-600 font-semibold">
                                                        {report.reportedByEmail || '-'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">

                                                    {isAuthorizedRole && (
                                                        <button
                                                            onClick={() => {
                                                                setEditingReportId(report.id);
                                                                setReportFormType('pir');
                                                                setShowForm(true);
                                                            }}
                                                            className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                                                            title="Edit Laporan PIR"
                                                        >
                                                            <PenTool className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {isAuthorizedRole && (report.reportedBy === user?.uid || userRole === 'admin') && (
                                                        <button
                                                            onClick={() => handleDeleteClick(report.id)}
                                                            className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 border border-red-200 transition cursor-pointer"
                                                            title="Hapus Laporan"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">{report.incidentName || report.issue}</h3>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Incident ID: <span className="font-bold text-slate-700">{report.incidentId || report.id?.slice(0, 8)}</span> • Severity Level: <span className="font-bold text-red-600">{report.severityLevel || 'LOW'}</span>
                                                    </p>
                                                </div>

                                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Ringkasan (Summary)</span>
                                                    <p className="text-slate-700 text-xs sm:text-sm leading-relaxed line-clamp-3">
                                                        {report.summary || report.actionTaken}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : report.reportType === 'SLA' ? (
                                        /* SLA REPORT CARD LAYOUT */
                                        <div className="p-5 sm:p-6">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700/50 pb-4 mb-4">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="px-2.5 py-1 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-bold text-red-400 uppercase tracking-wider">
                                                        SLA / SLG
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                                        <span>{report.reportedAt?.toDate?.()?.toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <User className="w-3.5 h-3.5 text-slate-500" />
                                                        <span>PIC: {report.picDME || 'On Duty DME'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <span className="text-[10px] px-2 py-0.5 bg-slate-700/40 border border-slate-600/30 rounded-md text-slate-300 font-semibold">
                                                            Dibuat: {report.reportedByEmail || '-'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                                                    <button
                                                        onClick={async () => {
                                                            const toastId = toast.loading('Mengunduh Laporan Excel...');
                                                            try {
                                                                await exportSLAReportToExcel(report);
                                                                toast.success('Berhasil mengunduh Laporan Excel!', { id: toastId });
                                                            } catch (err: any) {
                                                                console.error('Failed to export Excel:', err);
                                                                toast.error(`Gagal mengunduh Excel: ${err.message || err}`, { id: toastId });
                                                            }
                                                        }}
                                                        className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center gap-1.5 text-xs font-bold transition shadow-lg shadow-emerald-500/5 cursor-pointer"
                                                        title="Export to Excel"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        Excel
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            const toastId = toast.loading('Mengunduh Laporan SLA Word...');
                                                            try {
                                                                await exportSLAReportToDocx(report);
                                                                toast.success('Berhasil mengunduh Laporan SLA Word!', { id: toastId });
                                                            } catch (err: any) {
                                                                console.error('Failed to export Word:', err);
                                                                toast.error(`Gagal mengunduh Word: ${err.message || err}`, { id: toastId });
                                                            }
                                                        }}
                                                        className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl flex items-center gap-1.5 text-xs font-bold transition shadow-lg shadow-blue-500/5 cursor-pointer"
                                                        title="Export to Word (DOCX)"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        Word SLA
                                                    </button>

                                                    {isAuthorizedRole && (
                                                        <button
                                                            onClick={() => {
                                                                setEditingReportId(report.id);
                                                                setReportFormType('sla');
                                                                setShowForm(true);
                                                            }}
                                                            className="p-2 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 border border-blue-500/20 transition cursor-pointer"
                                                            title="Edit Laporan SLA"
                                                        >
                                                            <PenTool className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {isAuthorizedRole && (report.reportedBy === user?.uid || userRole === 'admin') && (
                                                        <button
                                                            onClick={() => handleDeleteClick(report.id)}
                                                            className="p-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 border border-red-500/20 transition cursor-pointer"
                                                            title="Hapus Laporan"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                                <div className="lg:col-span-2 space-y-4">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-900 mb-1">{report.ticketName}</h3>
                                                        <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                                                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                                            <span>{report.location}</span>
                                                            <span className="text-slate-600">•</span>
                                                            <span className="text-slate-500">Prioritas:</span>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${report.priority === 'High' ? 'bg-rose-500/20 text-rose-400' :
                                                                    report.priority === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/30 text-slate-400'
                                                                }`}>{report.priority}</span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                                        <div>
                                                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Tindakan Perbaikan (Action)</span>
                                                            <p className="text-slate-700 text-sm leading-relaxed">{report.actionTaken}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Keterangan / Remarks</span>
                                                            <p className="text-slate-700 text-sm leading-relaxed">{report.remark || '-'}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2 mb-3">SLA Metrics Summary</h4>

                                                    <div className="space-y-2.5 flex-1 flex flex-col justify-center">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-400">1. Response Time</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-700">{report.actualResponseTimeMin} Min</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${report.responseComply ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                                    }`}>{report.responseComply ? 'Comply' : 'No Comply'}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-400">2. Engineer Onsite</span>
                                                            <span className="font-bold text-slate-300">Evidence Ok</span>
                                                        </div>

                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-400">3. Principle Onsite</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-300">{report.actualOnsiteTimeMin} Min</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${report.onsiteComply ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                                    }`}>{report.onsiteComply ? 'Comply' : 'No Comply'}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-400">4. Restore Service</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-300">{report.actualRestoreTimeMin} Min</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${report.restoreComply ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                                    }`}>{report.restoreComply ? 'Comply' : 'No Comply'}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-400">5. Resolution Time</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-300">{report.actualResolutionTimeMin} Min</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${report.resolutionComply ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                                    }`}>{report.resolutionComply ? 'Comply' : 'No Comply'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Bukti Dokumentasi SLA (5-Step)</span>
                                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                                    {report.photoResponse && (
                                                        <div className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                                            <img src={report.photoResponse} alt="Response Time Evidence" className="w-full h-24 object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                                <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">1. Response</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {report.photoEngineerOnsite && (
                                                        <div className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                                            <img src={report.photoEngineerOnsite} alt="Engineer Onsite Evidence" className="w-full h-24 object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                                <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">2. Eng Onsite</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {report.photoOnsite && (
                                                        <div className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                                            <img src={report.photoOnsite} alt="Principle Onsite Evidence" className="w-full h-24 object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                                <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">3. Princ Onsite</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {report.photoRestore && (
                                                        <div className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                                            <img src={report.photoRestore} alt="Restore Time Evidence" className="w-full h-24 object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                                <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">4. Restore</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {report.photoResolution && (
                                                        <div className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                                            <img src={report.photoResolution} alt="Resolution Time Evidence" className="w-full h-24 object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                                <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">5. Resolusi</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* STANDARD CM REPORT CARD LAYOUT */
                                        <div className="p-4 sm:p-6 flex flex-col md:flex-row gap-6">
                                            {report.photoBase64 && (
                                                <div className="w-full md:w-64 flex-shrink-0">
                                                    <img
                                                        src={report.photoBase64}
                                                        alt={report.photoDescription || 'Issue evidence'}
                                                        className="w-full h-48 object-cover rounded-lg border border-slate-700"
                                                    />
                                                    {report.photoDescription && (
                                                        <p className="text-xs text-slate-500 mt-2 text-center italic">{report.photoDescription}</p>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                                                    <div>
                                                        <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(report.status)} mb-2`}>
                                                            {report.status}
                                                        </div>
                                                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                            <MapPin className="w-4 h-4 text-slate-400" />
                                                            {report.location}
                                                        </h3>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            Reported by <span className="text-slate-700">{report.reportedByEmail}</span> • {report.reportedAt?.toDate?.()?.toLocaleDateString()}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                                                        <button
                                                            onClick={() => handleExportSingleCMDocx(report)}
                                                            className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 rounded-xl flex items-center gap-1.5 text-xs font-bold transition shadow-lg shadow-blue-500/5 cursor-pointer"
                                                            title="Export to Word (DOCX)"
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                            Word CM
                                                        </button>

                                                        {isAuthorizedRole && (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingReportId(report.id);
                                                                    setReportFormType('cm_pdf');
                                                                    setShowForm(true);
                                                                }}
                                                                className="p-2 bg-blue-500/10 text-blue-600 rounded-xl hover:bg-blue-500/20 border border-blue-500/20 transition cursor-pointer"
                                                                title="Edit Laporan CM"
                                                            >
                                                                <PenTool className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {isAuthorizedRole && (report.reportedBy === user?.uid || userRole === 'admin') && (
                                                            <button
                                                                onClick={() => handleDeleteClick(report.id)}
                                                                className="p-2 bg-red-500/10 text-red-600 rounded-lg hover:bg-red-500/20 border border-red-500/20 transition cursor-pointer"
                                                                title="Hapus Laporan"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-orange-600 mb-1 flex items-center gap-2">
                                                            <AlertCircle className="w-3 h-3" /> Issue
                                                        </h4>
                                                        <p className="text-slate-700 text-sm leading-relaxed">{report.issue}</p>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-emerald-600 mb-1 flex items-center gap-2">
                                                            <CheckCircle2 className="w-3 h-3" /> Action Taken
                                                        </h4>
                                                        <p className="text-slate-700 text-sm leading-relaxed">{report.actionTaken}</p>
                                                    </div>
                                                </div>

                                                {report.spareParts && (
                                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spare Parts Used:</span>
                                                        <span className="ml-2 text-sm text-slate-700">{report.spareParts}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    )}
                </>
            )}

            <AnimatePresence>
                {deleteId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                                    <Trash2 className="w-6 h-6 text-red-500" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Report?</h3>
                                <p className="text-slate-500 mb-6">
                                    Are you sure you want to delete this maintenance report? This action cannot be undone.
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setDeleteId(null)}
                                        className="flex-1 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium transition cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition cursor-pointer"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
