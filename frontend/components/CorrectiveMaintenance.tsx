// ============================================================================
// FILE: CorrectiveMaintenance.tsx
// Deskripsi: Modul Utama Pengelolaan Corrective Maintenance (CM).
//            Menyediakan antarmuka Tab terpadu untuk Standby Engineer:
//            - Tab 1: Form / List Laporan CM Standar (3-Halaman)
//            - Tab 2: Audit Pencapaian SLA / SLG Waktu Respon & Resolution Time
//            - Tab 3: Laporan PIR (Post Incident Report / Root Cause Analysis)
//            Dilengkapi filter pencarian cepat, ekspor DOCX/Excel, serta konfirmasi hapus data.
// ============================================================================

import { useState, useEffect, useRef } from 'react';
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
    AlertTriangle,
    Plus,
    X,
    Zap,
    ChevronDown,
    ChevronUp,
    ArrowRight,
    Check,
    Wrench,
    Activity,
    Copy,
    ExternalLink,
    Package,
    Search
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
    updateDoc,
    deleteField,
    serverTimestamp
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { SLAForm, SLAPrefillData } from './SLAForm';
import { CMReportFormModal } from './CMReportFormModal';
import { PIRReportFormModal } from './PIRReportFormModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { sendFileNotification } from '@/utils/notificationService';
import { exportSLAReportToExcel } from '../utils/excelExport';
import { exportCMReportToDocx, exportSLAReportToDocx } from '@/utils/docxReportExport';
import { normalizeEngineerName } from '@/utils/engineerSignatures';
import { SLAMonthlyRecapModal } from './SLAMonthlyRecapModal';

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

    // Linked CM relation
    cmReportId?: string;

    // Deletion Request fields
    deleteRequested?: boolean;
    deleteRequestedBy?: string;
    deleteReason?: string;
    deleteRequestedAt?: any;

    // Report Type discriminator
    reportType?: 'SLA' | 'CM_PDF' | 'PIR';

    // Troubleshoot classification
    troubleshootType?: 'non_sparepart' | 'sparepart_replacement';
    sparepartType?: 'sparepart_dme' | 'consumable';
    isSparepartReplacement?: boolean;

    // SLA fields
    ticketName?: string;
    priority?: 'Critical' | 'High' | 'Medium' | 'Low';
    picDME?: string;
    picTDE?: string;
    remark?: string;
    actualResponseTimeMin?: number;
    targetResponseMin?: number;
    responseComply?: boolean;
    photoResponse?: string;
    photosResponse?: Array<{ photo: string; description?: string }>;
    photoEngineerOnsite?: string;
    actualOnsiteTimeMin?: number;
    targetOnsiteMin?: number;
    onsiteComply?: boolean;
    photoOnsite?: string;
    photosOnsite?: Array<{ photo: string; description?: string }>;
    actualRestoreTimeMin?: number;
    targetRestoreMin?: number;
    restoreComply?: boolean;
    photoRestore?: string;
    photosRestore?: Array<{ photo: string; description?: string }>;
    actualResolutionTimeMin?: number;
    targetResolutionMin?: number;
    resolutionComply?: boolean;
    photoResolution?: string;
    photosResolution?: Array<{ photo: string; description?: string }>;
    slgScoreRT?: number;
    slgScoreOTP?: number;
    slgScoreRST?: number;
    slgScoreRSP?: number;
    totalIncidentSlgScore?: number;

    // PIR fields
    incidentName?: string;
    incidentDate?: string;
    incidentId?: string;
    postmortemOwner?: string;
    severityLevel?: string;
    summary?: string;

    // CM fields
    equipmentName?: string;
    summaryProblemAnalysis?: string;
    visualInspectionChecking?: string;
    correctiveAction?: string;
    cleaningPreventiveMethod?: string;
    recommendation?: string;
    spareparts?: any[];
    photos?: any[];
    authorName?: string;
    preparedByName?: string;
    preparedByTitle?: string;
    preparedBySign?: string;
    reviewedByName?: string;
    reviewedByTitle?: string;
    reviewedBySign?: string;
    acknowledgedBy1Name?: string;
    acknowledgedBy1Title?: string;
    acknowledgedBy1Sign?: string;
    acknowledgedBy2Name?: string;
    acknowledgedBy2Title?: string;
    acknowledgedBy2Sign?: string;
    approvedByName?: string;
    approvedByTitle?: string;
    approvedBySign?: string;
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
    const isQcDme = userRole === 'qc_dme';
    const isAdmin = userRole === 'admin' || isQcDme;
    const isAuthorizedRole = isAdmin || userRole === 'engineer' || userRole === 'standby_engineer';

    const [reports, setReports] = useState<CorrectiveReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [reportFormType, setReportFormType] = useState<'standard' | 'sla' | 'cm_pdf' | 'pir' | null>(null);
    const [formKey, setFormKey] = useState(0);

    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [prefillSlaData, setPrefillSlaData] = useState<SLAPrefillData | null>(null);
    const [isPendingSlaExpanded, setIsPendingSlaExpanded] = useState<boolean>(true);
    const [isRecapModalOpen, setIsRecapModalOpen] = useState<boolean>(false);
    const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState<boolean>(false);

    // Scroll & Card Position Memory Refs
    const lastInteractedReportIdRef = useRef<string | null>(null);
    const savedScrollYRef = useRef<number>(0);
    const formContainerRef = useRef<HTMLDivElement | null>(null);

    const handleOpenForm = (type: 'standard' | 'sla' | 'cm_pdf' | 'pir', reportId?: string) => {
        lastInteractedReportIdRef.current = reportId || null;
        if (reportId) {
            const el = document.getElementById(`cm-report-card-${reportId}`);
            if (el) {
                const rect = el.getBoundingClientRect();
                savedScrollYRef.current = Math.max(0, rect.top + window.scrollY - 80);
            } else {
                savedScrollYRef.current = window.scrollY;
            }
        } else {
            savedScrollYRef.current = window.scrollY;
        }

        setEditingReportId(reportId || null);
        setReportFormType(type);
        setShowForm(true);

        // Smooth scroll langsung ke bagian atas form agar user tidak melihat footer
        setTimeout(() => {
            if (formContainerRef.current) {
                formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 50);
    };

    const handleCloseForm = () => {
        const targetId = lastInteractedReportIdRef.current;
        const targetScrollY = savedScrollYRef.current;

        setShowForm(false);
        setReportFormType(null);
        setEditingReportId(null);
        setPrefillSlaData(null);

        // Kembalikan posisi scroll tepat ke kartu laporan yang bersangkutan di bagian atas viewport
        const restoreScroll = () => {
            if (targetId) {
                const el = document.getElementById(`cm-report-card-${targetId}`);
                if (el) {
                    const y = el.getBoundingClientRect().top + window.scrollY - 80;
                    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });

                    // Visual highlight indicator
                    el.classList.add('ring-4', 'ring-red-500/70', 'shadow-2xl', 'transition-all', 'duration-500');
                    setTimeout(() => {
                        el.classList.remove('ring-4', 'ring-red-500/70', 'shadow-2xl');
                    }, 2500);
                    return true;
                }
            }
            if (targetScrollY > 0) {
                window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
                return true;
            }
            return false;
        };

        // Multiple staggered attempts to handle DOM re-mounting and image/layout reflows
        setTimeout(restoreScroll, 50);
        setTimeout(restoreScroll, 150);
        setTimeout(restoreScroll, 350);
    };

    // Filters State
    const [archiveFolder, setArchiveFolder] = useState<'cm_pdf' | 'sla' | 'pir'>('cm_pdf');
    const [selectedCMType, setSelectedCMType] = useState<'all' | 'non_sparepart' | 'sparepart_dme' | 'consumable'>('all');
    const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery || '');
    const [adminDeleteFilter, setAdminDeleteFilter] = useState<'all' | 'pending_delete'>('all');

    useEffect(() => {
        if (initialSearchQuery !== undefined) {
            setSearchQuery(initialSearchQuery);
        }
    }, [initialSearchQuery]);
    const [selectedDay, setSelectedDay] = useState<string>('all');
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

    // Helper: compute accurate SLA compliance dynamically based on priority targets
    const getSLACompliance = (r: CorrectiveReport) => {
        const getTargetByPrio = (prio?: string) => {
            if (prio === 'Critical') return 120;
            if (prio === 'High') return 240;
            if (prio === 'Low') return 2880;
            return 360;
        };
        const targetRST = r.targetRestoreMin && r.targetRestoreMin !== 120 ? r.targetRestoreMin : getTargetByPrio(r.priority);
        const targetRSP = r.targetResolutionMin && r.targetResolutionMin !== 360 ? r.targetResolutionMin : getTargetByPrio(r.priority);

        const restoreComply = (r.actualRestoreTimeMin !== undefined && r.actualRestoreTimeMin > 0)
            ? r.actualRestoreTimeMin <= targetRST
            : (r.restoreComply ?? true);

        const resolutionComply = (r.actualResolutionTimeMin !== undefined && r.actualResolutionTimeMin > 0)
            ? r.actualResolutionTimeMin <= targetRSP
            : (r.resolutionComply ?? true);

        return { targetRST, targetRSP, restoreComply, resolutionComply };
    };

    // SLA calculations & engineer name formatting are normalized dynamically in memory
    const [selectedReportForDelete, setSelectedReportForDelete] = useState<CorrectiveReport | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const handleDeleteClick = (report: CorrectiveReport) => {
        setSelectedReportForDelete(report);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async (reason?: string) => {
        if (!selectedReportForDelete) return;
        try {
            setDeleteLoading(true);
            if (isQcDme) {
                // QC DME approves delete and deletes the document permanently
                const toastId = toast.loading('Menghapus dokumen secara permanen...');
                await deleteDoc(doc(db, 'corrective_reports', selectedReportForDelete.id));
                toast.success('Laporan berhasil dihapus secara permanen', { id: toastId });
            } else {
                // Non-QC DME (including Admin & Standby Engineers) request deletion with mandatory remark
                if (!reason || !reason.trim()) {
                    toast.error('Wajib menyertakan remark/alasan sebelum mengajukan hapus dokumen!');
                    setDeleteLoading(false);
                    return;
                }
                const toastId = toast.loading('Mengajukan permohonan hapus ke QC DME...');
                const docRef = doc(db, 'corrective_reports', selectedReportForDelete.id);
                await updateDoc(docRef, {
                    deleteRequested: true,
                    deleteRequestedBy: user?.email || (userRole === 'admin' ? 'Admin' : 'Standby Engineer'),
                    deleteReason: reason.trim(),
                    deleteRequestedAt: serverTimestamp()
                });

                // Send real-time notification to QC DME
                const docLabel = selectedReportForDelete.incidentName || selectedReportForDelete.ticketName || selectedReportForDelete.equipmentName || selectedReportForDelete.issue || 'Laporan Standby';
                await sendFileNotification({
                    title: 'Pengajuan Hapus Dokumen Standby',
                    fileName: docLabel,
                    category: 'Arsip Standby',
                    fileId: selectedReportForDelete.id,
                    uploadedBy: user?.email || (userRole === 'admin' ? 'Admin' : 'Standby Engineer'),
                    targetTab: 'corrective_archive',
                    searchQuery: docLabel
                });

                toast.success('Pengajuan hapus dokumen telah dikirim ke QC DME. Menunggu persetujuan QC DME.', { id: toastId });
            }
            setDeleteModalOpen(false);
            setSelectedReportForDelete(null);
        } catch (error) {
            console.error('Gagal memproses penghapusan:', error);
            toast.error('Gagal memproses penghapusan laporan');
        } finally {
            setDeleteLoading(false);
        }
    };

    const rejectDeleteRequest = async () => {
        if (!selectedReportForDelete || !isQcDme) return;
        try {
            setDeleteLoading(true);
            const toastId = toast.loading('Menolak pengajuan hapus...');
            const docRef = doc(db, 'corrective_reports', selectedReportForDelete.id);
            await updateDoc(docRef, {
                deleteRequested: deleteField(),
                deleteRequestedBy: deleteField(),
                deleteReason: deleteField(),
                deleteRequestedAt: deleteField()
            });
            toast.success('Pengajuan hapus ditolak. Dokumen tetap tersimpan di arsip.', { id: toastId });
            setDeleteModalOpen(false);
            setSelectedReportForDelete(null);
        } catch (error) {
            console.error('Gagal menolak pengajuan:', error);
            toast.error('Gagal menolak pengajuan');
        } finally {
            setDeleteLoading(false);
        }
    };

    const cancelDeleteRequest = async (reportId?: string) => {
        const targetId = reportId || selectedReportForDelete?.id;
        if (!targetId) return;
        try {
            setDeleteLoading(true);
            const toastId = toast.loading('Membatalkan pengajuan hapus...');
            const docRef = doc(db, 'corrective_reports', targetId);
            await updateDoc(docRef, {
                deleteRequested: deleteField(),
                deleteRequestedBy: deleteField(),
                deleteReason: deleteField(),
                deleteRequestedAt: deleteField()
            });
            toast.success('Pengajuan hapus berhasil dibatalkan. Dokumen kembali normal.', { id: toastId });
            setDeleteModalOpen(false);
            setSelectedReportForDelete(null);
        } catch (error) {
            console.error('Gagal membatalkan pengajuan:', error);
            toast.error('Gagal membatalkan pengajuan');
        } finally {
            setDeleteLoading(false);
        }
    };

    const INDO_MONTHS_MAP: Record<string, number> = {
        'januari': 0, 'jan': 0, 'january': 0,
        'februari': 1, 'feb': 1, 'february': 1,
        'maret': 2, 'mar': 2, 'march': 2,
        'april': 3, 'apr': 3,
        'mei': 4, 'may': 4,
        'juni': 5, 'jun': 5, 'june': 5,
        'juli': 6, 'jul': 6, 'july': 6,
        'agustus': 7, 'agu': 7, 'ags': 7, 'aug': 7, 'august': 7,
        'september': 8, 'sep': 8,
        'oktober': 9, 'okt': 9, 'oct': 9, 'october': 9,
        'november': 10, 'nov': 10,
        'desember': 11, 'des': 11, 'dec': 11, 'december': 11
    };

    const parseDateToTimestamp = (dateVal: any): number => {
        if (!dateVal) return 0;
        if (typeof dateVal === 'number') return dateVal;
        if (typeof dateVal.toDate === 'function') return dateVal.toDate().getTime();
        if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? 0 : dateVal.getTime();
        if (typeof dateVal === 'string') {
            const trimmed = dateVal.trim();
            if (!trimmed) return 0;

            // 1. Format ISO standar YYYY-MM-DD / YYYY/MM/DD
            const isoMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
            if (isoMatch) {
                const year = parseInt(isoMatch[1], 10);
                const month = parseInt(isoMatch[2], 10) - 1;
                const day = parseInt(isoMatch[3], 10);
                const d = new Date(year, month, day);
                if (!isNaN(d.getTime())) return d.getTime();
            }

            // 2. Format numerik DD-MM-YYYY / DD/MM/YYYY
            const dmyNumMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
            if (dmyNumMatch) {
                const day = parseInt(dmyNumMatch[1], 10);
                const month = parseInt(dmyNumMatch[2], 10) - 1;
                const year = parseInt(dmyNumMatch[3], 10);
                const d = new Date(year, month, day);
                if (!isNaN(d.getTime())) return d.getTime();
            }

            // 3. Format teks bahasa Indonesia: "04 Agustus 2026", "4-Agustus-2026", "5 Agustus 2026", "23-Agt-2026"
            const indoMatch = trimmed.match(/^(\d{1,2})[\s\-_/]+([a-zA-Z]+)[\s\-_/]+(\d{4})/);
            if (indoMatch) {
                const day = parseInt(indoMatch[1], 10);
                const monthKey = indoMatch[2].toLowerCase();
                const year = parseInt(indoMatch[3], 10);
                if (monthKey in INDO_MONTHS_MAP) {
                    const month = INDO_MONTHS_MAP[monthKey];
                    const d = new Date(year, month, day);
                    if (!isNaN(d.getTime())) return d.getTime();
                }
            }

            // 4. Format teks terbalik: "Agustus 04, 2026"
            const revIndoMatch = trimmed.match(/^([a-zA-Z]+)[\s\-_/]+(\d{1,2}),?[\s\-_/]+(\d{4})/);
            if (revIndoMatch) {
                const monthKey = revIndoMatch[1].toLowerCase();
                const day = parseInt(revIndoMatch[2], 10);
                const year = parseInt(revIndoMatch[3], 10);
                if (monthKey in INDO_MONTHS_MAP) {
                    const month = INDO_MONTHS_MAP[monthKey];
                    const d = new Date(year, month, day);
                    if (!isNaN(d.getTime())) return d.getTime();
                }
            }

            // 5. Fallback Date parser bawaan JavaScript
            const fallback = new Date(trimmed);
            if (!isNaN(fallback.getTime())) return fallback.getTime();
        }
        return 0;
    };

    const getReportIncidentTime = (r: CorrectiveReport): number => {
        // 1. Incident Date (PIR & CM reports)
        if (r.incidentDate) {
            const t = parseDateToTimestamp(r.incidentDate);
            if (t > 0) return t;
        }
        // 2. SLA timeOrder or startOrder
        if ((r as any).timeOrder) {
            const t = parseDateToTimestamp((r as any).timeOrder);
            if (t > 0) return t;
        }
        if ((r as any).startOrder) {
            const t = parseDateToTimestamp((r as any).startOrder);
            if (t > 0) return t;
        }
        // 3. Fallback to reportedAt or createdAt
        if (r.reportedAt) {
            const t = parseDateToTimestamp(r.reportedAt);
            if (t > 0) return t;
        }
        if ((r as any).createdAt) {
            const t = parseDateToTimestamp((r as any).createdAt);
            if (t > 0) return t;
        }
        return 0;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Resolved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'InProgress': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            default: return 'bg-red-500/20 text-red-400 border-red-500/30';
        }
    };

    // Filter Logic and Sorting by Incident Date (Newest First)
    const filteredReports = reports.filter((report) => {
        // Admin pending delete filter
        if (adminDeleteFilter === 'pending_delete' && !report.deleteRequested) {
            return false;
        }

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

        // Filter Jenis Penanganan CM (hanya berlaku saat menampilkan folder CM)
        if (archiveFolder === 'cm_pdf' && selectedCMType !== 'all') {
            const isSp = report.troubleshootType === 'sparepart_replacement' || report.isSparepartReplacement === true;
            if (selectedCMType === 'non_sparepart') {
                if (isSp) return false;
            } else if (selectedCMType === 'sparepart_dme') {
                if (!isSp || report.sparepartType === 'consumable') return false;
            } else if (selectedCMType === 'consumable') {
                if (!isSp || report.sparepartType !== 'consumable') return false;
            }
        }

        // Incident Date Filter (Day / Month / Year)
        const reportTimestamp = getReportIncidentTime(report);
        if (reportTimestamp > 0) {
            const reportDate = new Date(reportTimestamp);
            if (selectedDay !== 'all') {
                if (reportDate.getDate().toString() !== selectedDay) {
                    return false;
                }
            }
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
        } else if (report.reportedAt) {
            const reportDate = report.reportedAt.toDate?.();
            if (reportDate) {
                if (selectedDay !== 'all') {
                    if (reportDate.getDate().toString() !== selectedDay) {
                        return false;
                    }
                }
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
            const reasonMatch = report.deleteReason?.toLowerCase().includes(queryText);
            const requestedByMatch = report.deleteRequestedBy?.toLowerCase().includes(queryText);

            return locationMatch || issueMatch || actionMatch || ticketMatch || remarkMatch || incidentMatch || reasonMatch || requestedByMatch;
        }

        return true;
    }).sort((a, b) => {
        // Primary sort: Incident Date (tanggal insiden) descending — newest first
        // Clamp future-year typos (e.g. 2028 entered instead of 2026) to avoid wrong ordering
        const now = Date.now();
        const clamp = (ts: number) => ts > 0 && ts > now + 365 * 24 * 3600 * 1000 ? 0 : ts;
        const timeB = clamp(getReportIncidentTime(b));
        const timeA = clamp(getReportIncidentTime(a));
        if (timeB !== timeA) {
            return timeB - timeA;
        }
        // Secondary sort fallback: reportedAt / createdAt
        const createdB = parseDateToTimestamp((b as any).createdAt || b.reportedAt);
        const createdA = parseDateToTimestamp((a as any).createdAt || a.reportedAt);
        return createdB - createdA;
    });

    // Helper: Ekstrak kata-kata penting (tokens >= 3 chars) untuk fuzzy token matching
    const extractSignificantTokens = (s?: string): string[] => {
        if (!s) return [];
        const clean = s.toLowerCase()
            .replace(/\[sla\s*\/?\s*slg\]/gi, ' ')
            .replace(/laporan\s+corrective\s+maintenance/gi, ' ')
            .replace(/laporan\s+cm/gi, ' ')
            .replace(/corrective\s+maintenance/gi, ' ')
            .replace(/pemeliharaan\s+corrective/gi, ' ')
            .replace(/neutra\s+dc\s+cikarang/gi, ' ')
            .replace(/[^a-z0-9]/g, ' ');

        // STOP WORDS LENGKAP: Filter kata umum insiden / status agar tidak terjadi salah jodoh
        const stopWords = new Set([
            'laporan', 'report', 'pada', 'unit', 'dan', 'atau', 'yang', 'room', 'area',
            'gedung', 'office', 'lantai', 'kondisi', 'terdapat', 'mengalami', 'sudah', 'telah',
            'alarm', 'indikasi', 'masalah', 'issue', 'problem', 'troubleshoot', 'gangguan',
            'pengecekan', 'perbaikan', 'temuan', 'maintenance', 'corrective', 'rusak', 'error',
            'failure', 'normal', 'status', 'hasil', 'pekerjaan', 'tindakan', 'action', 'taken',
            'summary', 'analisis', 'analysis', 'sistem', 'system', 'device', 'perangkat', 'alat',
            'order', 'tiket', 'ticket', 'work', 'form', 'data', 'center', 'cikarang', 'neutra'
        ]);

        return clean.split(/\s+/)
            .filter(w => w.length >= 3 && !stopWords.has(w));
    };

    interface CMSLAMappingResult {
        matchedCMIds: Set<string>;
        cmToSLAMap: Map<string, CorrectiveReport>;
        slaToCMMap: Map<string, CorrectiveReport>;
        claimedSLAIds: Set<string>;
    }

    // ===== Global 1-to-1 CM↔SLA Matching (each SLA can only be claimed once) =====
    const buildCMSLAMapping = (cmList: CorrectiveReport[], slaList: CorrectiveReport[]): CMSLAMappingResult => {
        const claimedSLAIds = new Set<string>();  // SLA IDs yang sudah dipasangkan
        const matchedCMIds = new Set<string>();    // CM IDs yang sudah punya SLA
        const cmToSLAMap = new Map<string, CorrectiveReport>();
        const slaToCMMap = new Map<string, CorrectiveReport>();

        // Helper: try to claim an SLA for a CM
        const tryClaim = (cm: CorrectiveReport, sla: CorrectiveReport): boolean => {
            if (!cm.id || !sla.id || claimedSLAIds.has(sla.id) || matchedCMIds.has(cm.id)) return false;
            claimedSLAIds.add(sla.id);
            matchedCMIds.add(cm.id);
            cmToSLAMap.set(cm.id, sla);
            slaToCMMap.set(sla.id, cm);
            return true;
        };

        // Pass 1: Direct cmReportId / slaReportId matching (Exact 100% ID Link)
        for (const cm of cmList) {
            if (!cm.id || matchedCMIds.has(cm.id)) continue;
            const match = slaList.find(s => s.id && !claimedSLAIds.has(s.id) && (
                (s as any).cmReportId === cm.id || (cm as any).slaReportId === s.id
            ));
            if (match) tryClaim(cm, match);
        }

        // Pass 2: Incident ID / Ticket ID matching (Explicit identical identifier)
        for (const cm of cmList) {
            if (!cm.id || matchedCMIds.has(cm.id)) continue;
            if (!cm.incidentId || cm.incidentId === 'N/A' || cm.incidentId.trim() === '') continue;
            const cleanIncId = cm.incidentId.trim().toLowerCase();
            const match = slaList.find(s => {
                if (!s.id || claimedSLAIds.has(s.id)) return false;
                const sInc = (s.incidentId || '').trim().toLowerCase();
                const sTick = ((s as any).ticketId || '').trim().toLowerCase();
                return (sInc !== '' && sInc !== 'n/a' && sInc === cleanIncId) ||
                       (sTick !== '' && sTick !== 'n/a' && sTick === cleanIncId);
            });
            if (match) tryClaim(cm, match);
        }

        // Pass 3: Strict Specific Equipment & Token Overlap (Window waktu KETAT: maksimal 3 hari!)
        for (const cm of cmList) {
            if (!cm.id || matchedCMIds.has(cm.id)) continue;
            const cmTokens = extractSignificantTokens(`${cm.incidentName || ''} ${cm.equipmentName || ''} ${cm.issue || ''}`);
            if (cmTokens.length === 0) continue;
            const cmTime = getReportIncidentTime(cm);

            const match = slaList.find(s => {
                if (!s.id || claimedSLAIds.has(s.id)) return false;

                const slaTime = getReportIncidentTime(s);
                // Toleransi waktu ketat: maksimal 3 hari (259200000 ms)
                // Jika kedua timestamp valid, selisih hari tidak boleh lebih dari 3 hari
                if (cmTime > 0 && slaTime > 0) {
                    const diffDays = Math.abs(cmTime - slaTime) / (1000 * 60 * 60 * 24);
                    if (diffDays > 3) return false;
                }

                const slaTokens = extractSignificantTokens(`${s.ticketName || ''} ${s.issue || ''} ${s.remark || ''} ${(s as any).equipmentName || ''}`);
                if (slaTokens.length === 0) return false;

                // Hitung berapa token non-stopword spesifik yang cocok
                const sharedTokens = cmTokens.filter(t => slaTokens.some(st => st === t || (st.length >= 6 && st.includes(t)) || (t.length >= 6 && t.includes(st))));

                // Minimal 2 token spesifik cocok (misal: 'genset' & '1f-dg-c', atau 'water' & 'softener')
                // Atau jika ada 1 token khusus yang sangat spesifik (panjang >= 6 atau mengandung angka unik)
                const hasStrongSpecificToken = sharedTokens.some(t => t.length >= 6 || /^[0-9]+[a-z0-9\-_]+$/i.test(t));
                if (sharedTokens.length >= 2 || (sharedTokens.length >= 1 && hasStrongSpecificToken)) {
                    return true;
                }
                return false;
            });
            if (match) tryClaim(cm, match);
        }

        // Catatan: Pass 5 (Date-only matching tanpa cek nama alat) sengaja DIHAPUS 100%
        // karena menyebabkan CM baru mencaplok SLA dari perangkat lain yang berbeda.

        return { matchedCMIds, cmToSLAMap, slaToCMMap, claimedSLAIds };
    };

    const allCMReports = reports.filter(r => r.reportType !== 'SLA' && r.reportType !== 'PIR');
    const allSLAReports = reports.filter(r => r.reportType === 'SLA' && !r.deleteRequested);
    const allPIRReports = reports.filter(r => r.reportType === 'PIR');

    // Helper: Menentukan apakah Laporan CM memerlukan SLA/SLG
    // Jika jenis penanganan adalah Pergantian Sparepart:
    //   - Consumable Part -> WAJIB DIBUATKAN SLA/SLG
    //   - Sparepart DME / Baut -> TIDAK DIBUATKAN SLA/SLG
    // Jika bukan pergantian sparepart (Troubleshoot Gangguan) -> WAJIB DIBUATKAN SLA/SLG
    const isCMRequiringSLA = (cm: CorrectiveReport): boolean => {
        // 0. Prioritas field spesifik jenis sparepart
        if (cm.sparepartType === 'consumable') {
            return true;
        }
        if (cm.sparepartType === 'sparepart_dme') {
            return false;
        }

        // 1. Cek field eksplisit dari Form CM
        if (cm.troubleshootType === 'sparepart_replacement' || cm.isSparepartReplacement === true) {
            return false;
        }
        if (cm.troubleshootType === 'non_sparepart' || cm.isSparepartReplacement === false) {
            return true;
        }

        // 2. Cek kata kunci umum pergantian / penggantian / instalasi modul / part
        const textCheck = `${cm.incidentName || ''} ${cm.equipmentName || ''} ${cm.issue || ''} ${cm.correctiveAction || ''}`.toLowerCase();
        const sparepartKeywords = [
            'replacement', 'pergantian', 'penggantian', 'ganti sparepart', 'ganti part',
            'ganti v-belt', 'ganti baterai', 'ganti battery', 'install modul', 'instalasi modul',
            'door shoe', 'chain lock', 'chain connector', 'pengunci rantai'
        ];
        if (sparepartKeywords.some(kw => textCheck.includes(kw))) {
            return false;
        }

        // 3. Cek apakah ada daftar sparepart yang diisi di form CM
        if (cm.spareparts && Array.isArray(cm.spareparts)) {
            const hasRealSpareparts = cm.spareparts.some((s: any) => s && s.name && s.name !== '-' && s.name.trim() !== '');
            if (hasRealSpareparts) {
                return false;
            }
        }

        // Default untuk CM umum adalah Troubleshoot Gangguan (Wajib SLA)
        return true;
    };

    // Hanya CM yang WAJIB SLA (bukan pergantian sparepart) yang boleh ikut matching
    const cmRequiringSLAReports = allCMReports.filter(cm => !cm.deleteRequested && isCMRequiringSLA(cm));

    // BUG FIX: Hanya CM yang require SLA yang dimasukkan ke mapping algorithm.
    // Sebelumnya SEMUA CM (termasuk pergantian sparepart) ikut matching,
    // sehingga SLA bisa "tercaplok" oleh CM yang seharusnya tidak punya SLA.
    const { matchedCMIds, cmToSLAMap, slaToCMMap } = buildCMSLAMapping(
        cmRequiringSLAReports,
        allSLAReports
    );
    const unlinkedCMReports = cmRequiringSLAReports
        .filter(cm => cm.id && !matchedCMIds.has(cm.id))
        .sort((a, b) => getReportIncidentTime(b) - getReportIncidentTime(a));

    // ===== DIAGNOSTIC DATA (Untuk Modal Investigasi & Console) =====
    const sparepartCMs = allCMReports.filter(cm => !cm.deleteRequested && !isCMRequiringSLA(cm));
    const nonSparepartCMs = cmRequiringSLAReports;
    const orphanSLAs = allSLAReports.filter(sla => {
        const cmId = (sla as any).cmReportId;
        return !cmId || cmId === '';
    });
    const slaLinkedToSparepart = allSLAReports.filter(sla => {
        const cmId = (sla as any).cmReportId;
        if (!cmId) return false;
        return sparepartCMs.some(cm => cm.id === cmId);
    });
    const allCMIdSet = new Set(allCMReports.map(cm => cm.id));
    const slaLinkedToGhostCM = allSLAReports.filter(sla => {
        const cmId = (sla as any).cmReportId;
        return cmId && !allCMIdSet.has(cmId);
    });
    const cmToSLAListMap: Record<string, CorrectiveReport[]> = {};
    allSLAReports.forEach(sla => {
        const cmId = (sla as any).cmReportId;
        if (cmId) {
            if (!cmToSLAListMap[cmId]) cmToSLAListMap[cmId] = [];
            cmToSLAListMap[cmId].push(sla);
        }
    });
    const duplicateSLACMs: [string, CorrectiveReport[]][] = Object.entries(cmToSLAListMap).filter(([_, slas]) => slas.length > 1);

    // Matching khusus untuk mendeteksi Form SLA yang terkait dengan CM sparepart:
    // PENTING: HANYA jika CM tersebut secara eksplisit bertipe 'sparepart_replacement'
    // DAN SLA secara eksplisit memiliki cmReportId yang menunjuk ke CM tersebut.
    // Tidak menggunakan fuzzy matching agar SLA sah dari CM troubleshoot tidak terancam terhapus.
    const explicitSparepartCMIds = new Set(
        allCMReports
            .filter(cm => ((cm as any).troubleshootType === 'sparepart_replacement' || cm.isSparepartReplacement === true) && !isCMRequiringSLA(cm))
            .map(cm => cm.id)
    );
    const detectedSparepartSLAs: Array<{ cmId: string; cm?: CorrectiveReport; sla: CorrectiveReport }> = allSLAReports
        .filter(sla => {
            const cmId = (sla as any).cmReportId;
            return cmId && explicitSparepartCMIds.has(cmId);
        })
        .map(sla => {
            const cmId = (sla as any).cmReportId;
            const cm = allCMReports.find(c => c.id === cmId);
            return {
                cmId,
                cm,
                sla
            };
        });

    // Unconditional warning log agar muncul di tab Warning DevTools (pasti terbaca!)
    if (allCMReports.length > 0) {
        console.warn('🔍 [DIAGNOSTIK CM/SLA] Ringkasan Data:', {
            totalCM: allCMReports.length,
            cmSparepart_tanpaSLA: sparepartCMs.length,
            cmNonSparepart_wajibSLA: nonSparepartCMs.length,
            totalSLA: allSLAReports.length,
            expectedMaxSLA: nonSparepartCMs.length,
            selisihSLA_berlebih: allSLAReports.length - nonSparepartCMs.length,
            slaLinkedToSparepart: slaLinkedToSparepart.length,
            slaOrphan_tanpaCMId: orphanSLAs.length,
            slaLinkedToGhostCM: slaLinkedToGhostCM.length,
            cmDenganMultipleSLA: duplicateSLACMs.length
        });
    }
    // ===== END DIAGNOSTIC LOGGING =====

    // Period-filtered pending CMs (based on active Day, Month & Year filter)
    const periodFilteredUnlinkedCMReports = unlinkedCMReports.filter((cm) => {
        if (selectedDay === 'all' && selectedMonth === 'all' && selectedYear === 'all') return true;
        const reportTimestamp = getReportIncidentTime(cm);
        if (reportTimestamp > 0) {
            const reportDate = new Date(reportTimestamp);
            if (selectedDay !== 'all' && reportDate.getDate().toString() !== selectedDay) {
                return false;
            }
            if (selectedMonth !== 'all' && reportDate.getMonth().toString() !== selectedMonth) {
                return false;
            }
            if (selectedYear !== 'all' && reportDate.getFullYear().toString() !== selectedYear) {
                return false;
            }
        }
        return true;
    }).sort((a, b) => getReportIncidentTime(b) - getReportIncidentTime(a));

    const handleCreateSLAFromCM = (cm: CorrectiveReport) => {
        lastInteractedReportIdRef.current = cm.id || null;
        if (cm.id) {
            const el = document.getElementById(`cm-report-card-${cm.id}`);
            if (el) {
                const rect = el.getBoundingClientRect();
                savedScrollYRef.current = Math.max(0, rect.top + window.scrollY - 80);
            } else {
                savedScrollYRef.current = window.scrollY;
            }
        } else {
            savedScrollYRef.current = window.scrollY;
        }

        setEditingReportId(null);
        setPrefillSlaData({
            ticketName: cm.incidentName || cm.equipmentName || cm.issue || 'Corrective Maintenance',
            location: cm.location || 'Neutra DC Cikarang',
            timeOrder: cm.incidentDate || (cm.reportedAt?.toDate ? cm.reportedAt.toDate().toLocaleDateString('id-ID') : ''),
            cmReportId: cm.id,
            remark: cm.actionTaken || cm.summaryProblemAnalysis || '',
            equipmentName: cm.equipmentName || '',
        });
        setReportFormType('sla');
        setShowForm(true);

        setTimeout(() => {
            if (formContainerRef.current) {
                formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 50);
    };

    // Navigasi langsung dari Report CM ke Form SLA yang sesuai
    const handleNavigateToSLA = (sla: CorrectiveReport) => {
        if (!sla.id) return;
        setArchiveFolder('sla');
        setShowForm(false);
        setEditingReportId(null);
        setReportFormType(null);
        setPrefillSlaData(null);

        // Jika pencarian aktif tidak mencakup nama SLA, reset filter pencarian teks agar dokumen tampil
        if (searchQuery && !(sla.ticketName || sla.issue || sla.incidentName || '').toLowerCase().includes(searchQuery.toLowerCase())) {
            setSearchQuery('');
        }

        setTimeout(() => {
            const el = document.getElementById(`cm-report-card-${sla.id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-4', 'ring-emerald-500', 'shadow-2xl');
                setTimeout(() => {
                    el.classList.remove('ring-4', 'ring-emerald-500', 'shadow-2xl');
                }, 3000);
            }
        }, 150);

        toast.success(`Membuka Form SLA: ${sla.ticketName || sla.issue || 'Form SLA/SLG'}`);
    };

    // Navigasi langsung dari Form SLA kembali ke Report CM yang sesuai
    const handleNavigateToCM = (cm: CorrectiveReport) => {
        if (!cm.id) return;
        setArchiveFolder('cm_pdf');
        setShowForm(false);
        setEditingReportId(null);
        setReportFormType(null);
        setPrefillSlaData(null);

        if (searchQuery && !(cm.incidentName || cm.equipmentName || cm.issue || '').toLowerCase().includes(searchQuery.toLowerCase())) {
            setSearchQuery('');
        }

        setTimeout(() => {
            const el = document.getElementById(`cm-report-card-${cm.id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-4', 'ring-blue-500', 'shadow-2xl');
                setTimeout(() => {
                    el.classList.remove('ring-4', 'ring-blue-500', 'shadow-2xl');
                }, 3000);
            }
        }, 150);

        toast.success(`Membuka Laporan CM: ${cm.incidentName || cm.equipmentName || cm.issue || 'Report CM'}`);
    };

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

        const rawSpareparts = report.spareparts || report.replacedSpareparts || report.replaced_spareparts || report.spareParts || report.spare_parts;
        const spareList = Array.isArray(rawSpareparts)
            ? rawSpareparts
            : (typeof rawSpareparts === 'string' && rawSpareparts.trim() !== '' && rawSpareparts.trim() !== '-'
                ? [{ name: rawSpareparts.trim(), brand: '-', qty: '1 Pcs' }]
                : []);

        const rawRequestSpareparts = report.requestSpareparts || report.request_spareparts || report.requestedSpareparts || report.sparepartsRequest || report.sparepartRequest;
        const requestSpareList = Array.isArray(rawRequestSpareparts)
            ? rawRequestSpareparts
            : (typeof rawRequestSpareparts === 'string' && rawRequestSpareparts.trim() !== '' && rawRequestSpareparts.trim() !== '-'
                ? [{ name: rawRequestSpareparts.trim(), brand: '-', specification: '-', qty: '1 Pcs' }]
                : []);

        let photoList: any[] = [];
        if (report.photos && report.photos.length > 0) {
            photoList = report.photos;
        } else if (report.photoBase64) {
            photoList.push({ photoBase64: report.photoBase64, description: report.photoDescription || 'Dokumentasi Kejadian' });
        } else if (report.photosResponse || report.photosOnsite || report.photosRestore || report.photosResolution) {
            (report.photosResponse || []).forEach((p: any) => photoList.push({ photoBase64: p.photo, description: p.description || 'Bukti Response Time SLA' }));
            (report.photosOnsite || []).forEach((p: any) => photoList.push({ photoBase64: p.photo, description: p.description || 'Bukti Principle Onsite SLA' }));
            (report.photosRestore || []).forEach((p: any) => photoList.push({ photoBase64: p.photo, description: p.description || 'Bukti Restore Service SLA' }));
            (report.photosResolution || []).forEach((p: any) => photoList.push({ photoBase64: p.photo, description: p.description || 'Bukti Resolution Time SLA' }));
        } else if (report.photoResponse || report.photoOnsite || report.photoRestore || report.photoResolution) {
            if (report.photoResponse) photoList.push({ photoBase64: report.photoResponse, description: 'Bukti Response Time SLA' });
            if (report.photoOnsite) photoList.push({ photoBase64: report.photoOnsite, description: 'Bukti Principle Onsite SLA' });
            if (report.photoRestore) photoList.push({ photoBase64: report.photoRestore, description: 'Bukti Restore Service SLA' });
            if (report.photoResolution) photoList.push({ photoBase64: report.photoResolution, description: 'Bukti Resolution Time SLA' });
        }

        return {
            ...report,
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
            recommendation: report.recommendation || '',

            spareparts: spareList,
            requestSpareparts: requestSpareList,
            photos: photoList,

            authorName: report.authorName || report.reportedByEmail || 'Standby Engineer',
            preparedByName: normalizeEngineerName(report.preparedByName),
            preparedByTitle: report.preparedByTitle || '(Electrical Engineer)',
            reviewedByName: report.reviewedByName || 'Arif Budiman',
            reviewedByTitle: report.reviewedByTitle || '(Technical Manager)',
            acknowledgedBy1Name: report.acknowledgedBy1Name || 'Habib Mulyana',
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
            <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-4 sm:py-8 relative w-full min-w-0 overflow-x-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 border-b border-slate-200 pb-4 sm:pb-5 gap-3 sm:gap-4">
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <PenTool className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 shrink-0" />
                            Corrective Maintenance (CM)
                        </h1>
                        <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Pembuatan Laporan Pemeliharaan Corrective Standby Engineer</p>
                    </div>

                    {/* 3 Navbar Tabs for Standby Engineer */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="grid grid-cols-3 sm:flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto gap-1">
                            <button
                                type="button"
                                onClick={() => setActiveFormTab('cm_pdf')}
                                className={`min-w-0 px-2 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 sm:gap-2 ${activeFormTab === 'cm_pdf'
                                    ? 'bg-red-600 text-white shadow-md'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                <span className="truncate hidden sm:inline">Report CM (3-Hal)</span>
                                <span className="truncate inline sm:hidden">Report CM</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFormTab('sla')}
                                className={`min-w-0 px-2 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 sm:gap-2 ${activeFormTab === 'sla'
                                    ? 'bg-red-600 text-white shadow-md'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                <span className="truncate hidden sm:inline">Form SLA / SLG (4-Step)</span>
                                <span className="truncate inline sm:hidden">Form SLA</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFormTab('pir')}
                                className={`min-w-0 px-2 sm:px-4 py-2 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 sm:gap-2 ${activeFormTab === 'pir'
                                    ? 'bg-red-600 text-white shadow-md'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                <span className="truncate hidden sm:inline">Report PIR (Postmortem)</span>
                                <span className="truncate inline sm:hidden">Report PIR</span>
                            </button>
                        </div>

                        {activeFormTab === 'sla' && (
                            <button
                                type="button"
                                onClick={() => setIsRecapModalOpen(true)}
                                className="w-full sm:w-auto px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer shrink-0"
                            >
                                <FileText className="w-4 h-4" />
                                <span>Rekap SLA Bulanan</span>
                            </button>
                        )}
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

                {/* Modal Rekap SLA Bulanan */}
                <SLAMonthlyRecapModal
                    isOpen={isRecapModalOpen}
                    onClose={() => setIsRecapModalOpen(false)}
                    reports={allSLAReports}
                    initialMonth={selectedMonth}
                    initialYear={selectedYear}
                />
            </div >
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-200 pb-5 gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <FolderOpen className="w-6 h-6 text-red-600" />
                        Arsip Standby
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Daftar laporan pemeliharaan Standby Engineer (Report CM, SLA/SLG, & Report PIR)</p>
                </div>
            </div>

            {/* Folder Switcher Tabs in Arsip Standby */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-3 mb-6 border-b border-slate-200 pb-4 w-full">
                <button
                    type="button"
                    onClick={() => {
                        setArchiveFolder('cm_pdf');
                        setShowForm(false);
                        setEditingReportId(null);
                        setReportFormType(null);
                        setPrefillSlaData(null);
                    }}
                    className={`px-1.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 sm:gap-2 transition cursor-pointer border text-center ${archiveFolder === 'cm_pdf'
                        ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs'
                        }`}
                >
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="sm:hidden">CM ({allCMReports.length})</span>
                    <span className="hidden sm:inline">Report CM ({allCMReports.length})</span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setArchiveFolder('sla');
                        setShowForm(false);
                        setEditingReportId(null);
                        setReportFormType(null);
                        setPrefillSlaData(null);
                    }}
                    className={`px-1.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 sm:gap-2 transition cursor-pointer border text-center ${archiveFolder === 'sla'
                        ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs'
                        }`}
                >
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="sm:hidden flex items-center gap-1">
                        SLA ({allSLAReports.length})
                        {unlinkedCMReports.length > 0 && (
                            <span className="px-1.5 py-0.2 text-[9px] font-black bg-amber-500 text-white rounded-full">
                                {unlinkedCMReports.length}
                            </span>
                        )}
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1.5">
                        Form SLA / SLG ({allSLAReports.length})
                        {unlinkedCMReports.length > 0 && (
                            <span className={`px-2 py-0.5 text-[10px] font-black rounded-full shadow-xs transition ${archiveFolder === 'sla' ? 'bg-amber-400 text-slate-950 animate-pulse' : 'bg-amber-500 text-white'
                                }`}>
                                {unlinkedCMReports.length} Belum Ada SLA ⚠️
                            </span>
                        )}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setArchiveFolder('pir');
                        setShowForm(false);
                        setEditingReportId(null);
                        setReportFormType(null);
                        setPrefillSlaData(null);
                    }}
                    className={`px-1.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1 sm:gap-2 transition cursor-pointer border text-center ${archiveFolder === 'pir'
                        ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs'
                        }`}
                >
                    <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="sm:hidden">PIR ({allPIRReports.length})</span>
                    <span className="hidden sm:inline">Report PIR ({allPIRReports.length})</span>
                </button>
            </div>

            <AnimatePresence>
                {showForm && (
                    <div className="mb-8" ref={formContainerRef}>
                        {reportFormType === 'sla' ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <SLAForm
                                    editId={editingReportId || undefined}
                                    prefillData={prefillSlaData || undefined}
                                    availableCMReports={cmRequiringSLAReports}
                                    onSuccess={handleCloseForm}
                                    onCancel={handleCloseForm}
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
                                    onSuccess={handleCloseForm}
                                    onCancel={handleCloseForm}
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
                                    onSuccess={handleCloseForm}
                                    onCancel={handleCloseForm}
                                />
                            </motion.div>
                        )}
                    </div>
                )}
            </AnimatePresence>

            {!showForm && (
                <>
                    {/* Banner Interaktif: CM yang Belum Memiliki SLA / SLG */}
                    {archiveFolder === 'sla' && unlinkedCMReports.length > 0 && (
                        <div className="mb-6 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-white border border-amber-300 rounded-2xl p-4 sm:p-5 shadow-sm transition">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-start sm:items-center gap-3">
                                    <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/20 shrink-0">
                                        <Zap className="w-5 h-5 fill-current" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm sm:text-base font-bold text-slate-900">
                                                {selectedDay !== 'all' || selectedMonth !== 'all' || selectedYear !== 'all' ? (
                                                    <span>{periodFilteredUnlinkedCMReports.length} CM Belum Dibuatkan SLA pada Periode Ini <span className="text-xs font-normal text-slate-500">(Total: {unlinkedCMReports.length})</span></span>
                                                ) : (
                                                    <span>{unlinkedCMReports.length} Laporan CM Belum Dibuatkan SLA / SLG</span>
                                                )}
                                            </h3>
                                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase border border-amber-300 shadow-2xs">
                                                Perlu Tindakan
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 mt-0.5">
                                            Daftar insiden corrective yang belum dilengkapi audit waktu respon & pemulihan target SLA.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsPendingSlaExpanded(prev => !prev)}
                                    className="self-start sm:self-auto px-3.5 py-2 bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                                >
                                    <span>{isPendingSlaExpanded ? 'Sembunyikan Daftar' : `Tinjau ${periodFilteredUnlinkedCMReports.length || unlinkedCMReports.length} CM`}</span>
                                    {isPendingSlaExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                            </div>

                            {isPendingSlaExpanded && (
                                <div className="mt-4 pt-4 border-t border-amber-200/80">
                                    {(periodFilteredUnlinkedCMReports.length > 0 ? periodFilteredUnlinkedCMReports : unlinkedCMReports).length === 0 ? (
                                        <p className="text-xs text-slate-500 italic py-2">Semua CM pada filter periode ini sudah memiliki SLA.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {(periodFilteredUnlinkedCMReports.length > 0 ? periodFilteredUnlinkedCMReports : unlinkedCMReports).map((cm, idx) => (
                                                <div
                                                    key={cm.id}
                                                    className="bg-white rounded-xl border border-amber-200/90 p-4 shadow-xs hover:border-amber-400 hover:shadow-md transition flex flex-col justify-between"
                                                >
                                                    <div>
                                                        <div className="flex items-center justify-between gap-2 mb-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="px-2 py-0.5 bg-slate-900 text-white rounded-md text-[10px] font-black shadow-2xs">
                                                                    #{(periodFilteredUnlinkedCMReports.length > 0 ? periodFilteredUnlinkedCMReports : unlinkedCMReports).length - idx}
                                                                </span>
                                                                <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 uppercase tracking-wider">
                                                                    Belum Ada SLA
                                                                </span>
                                                                {cm.troubleshootType === 'sparepart_replacement' && cm.sparepartType === 'consumable' && (
                                                                    <span className="text-[9px] font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-200 uppercase tracking-wider">
                                                                        Consumable Part
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                                                                <Calendar className="w-3 h-3 text-slate-400" />
                                                                {cm.incidentDate || (cm.reportedAt?.toDate ? cm.reportedAt.toDate().toLocaleDateString('id-ID') : '-')}
                                                            </span>
                                                        </div>

                                                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 mb-1" title={cm.incidentName || cm.equipmentName || cm.issue}>
                                                            {cm.incidentName || cm.equipmentName || cm.issue || 'Corrective Maintenance'}
                                                        </h4>

                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                                                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                            <span className="truncate">{cm.location || 'Neutra DC Cikarang'}</span>
                                                        </div>

                                                        {cm.actionTaken && (
                                                            <p className="text-[11px] text-slate-600 line-clamp-2 italic bg-slate-50 p-2 rounded-lg border border-slate-100 mb-3 leading-relaxed">
                                                                "{cm.actionTaken}"
                                                            </p>
                                                        )}
                                                    </div>

                                                    {isAuthorizedRole && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCreateSLAFromCM(cm)}
                                                            className="w-full mt-2 py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                                                        >
                                                            <Zap className="w-3.5 h-3.5 fill-current" />
                                                            <span>+ Buat Form SLA</span>
                                                            <ArrowRight className="w-3 h-3 ml-0.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && (
                        <div className="mb-6 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col gap-3">
                            {/* Baris 1: Pencarian Cepat + Tombol Aksi Utama */}
                            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Cari lokasi, masalah, PIC, serial..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        title="Cari Laporan"
                                        className="w-full pl-9 pr-8 py-2 bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition placeholder-slate-400 shadow-2xs"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60 transition cursor-pointer"
                                            title="Hapus pencarian"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 justify-end shrink-0">
                                    {isAuthorizedRole && (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenForm(archiveFolder)}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-md shadow-red-500/10 cursor-pointer text-xs shrink-0"
                                        >
                                            <Plus className="w-4 h-4" />
                                            {archiveFolder === 'sla'
                                                ? '+ Buat Form SLA Baru'
                                                : archiveFolder === 'pir'
                                                    ? '+ Buat Report PIR Baru'
                                                    : '+ Buat Report CM Baru'}
                                        </button>
                                    )}

                                    {archiveFolder === 'sla' && (
                                        <button
                                            type="button"
                                            onClick={() => setIsRecapModalOpen(true)}
                                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 cursor-pointer text-xs shrink-0"
                                        >
                                            <FileText className="w-4 h-4" />
                                            Rekap SLA Bulanan
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Baris 2: Toolbar Filter Terpadu */}
                            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap overflow-x-auto pb-0.5 scrollbar-thin">
                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                    {/* Segmented Periode: Tanggal, Picker, Bulan, Tahun */}
                                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5 shadow-2xs divide-x divide-slate-200 shrink-0">
                                        <select
                                            value={selectedDay}
                                            onChange={(e) => setSelectedDay(e.target.value)}
                                            title="Filter Tanggal"
                                            aria-label="Filter Tanggal"
                                            className="px-2 py-1.5 bg-transparent text-slate-800 text-xs font-semibold outline-none cursor-pointer"
                                        >
                                            <option value="all">Semua Tgl</option>
                                            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                                <option key={d} value={d.toString()}>
                                                    Tgl {d < 10 ? `0${d}` : d}
                                                </option>
                                            ))}
                                        </select>

                                        <div className="relative inline-flex items-center px-1.5 py-1 text-slate-400 hover:text-orange-600 transition cursor-pointer" title="Pilih langsung dari kalender">
                                            <input
                                                type="date"
                                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                                title="Pilih langsung dari kalender"
                                                aria-label="Pilih langsung dari kalender"
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        const [y, m, d] = e.target.value.split('-');
                                                        setSelectedDay(parseInt(d, 10).toString());
                                                        setSelectedMonth((parseInt(m, 10) - 1).toString());
                                                        setSelectedYear(y);
                                                    }
                                                }}
                                            />
                                            <Calendar className="w-3.5 h-3.5 pointer-events-none" />
                                        </div>

                                        <select
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(e.target.value)}
                                            title="Filter Bulan"
                                            aria-label="Filter Bulan"
                                            className="px-2 py-1.5 bg-transparent text-slate-800 text-xs font-semibold outline-none cursor-pointer"
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
                                            className="px-2 py-1.5 bg-transparent text-slate-800 text-xs font-semibold outline-none cursor-pointer"
                                        >
                                            <option value="all">Semua Tahun</option>
                                            {['2024', '2025', '2026', '2027', '2028', '2029', '2030'].map((y) => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Filter Jenis CM (Khusus tab CM) */}
                                    {archiveFolder === 'cm_pdf' && (
                                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5 shadow-2xs shrink-0">
                                            <select
                                                value={selectedCMType}
                                                onChange={(e) => setSelectedCMType(e.target.value as any)}
                                                title="Filter Jenis Penanganan CM"
                                                aria-label="Filter Jenis Penanganan CM"
                                                className="px-2.5 py-1.5 bg-transparent text-slate-800 text-xs font-semibold outline-none cursor-pointer"
                                            >
                                                <option value="all">Semua Jenis CM</option>
                                                <option value="non_sparepart">⚡ Troubleshoot Gangguan</option>
                                                <option value="sparepart_dme">🔧 Sparepart DME / Baut</option>
                                                <option value="consumable">📦 Consumable Part</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Filter Status Approval */}
                                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5 shadow-2xs shrink-0">
                                        <select
                                            value={adminDeleteFilter}
                                            onChange={(e) => setAdminDeleteFilter(e.target.value as 'all' | 'pending_delete')}
                                            title="Filter Status Approval"
                                            aria-label="Filter Status Approval"
                                            className={`px-2.5 py-1.5 bg-transparent text-xs font-semibold outline-none cursor-pointer ${adminDeleteFilter === 'pending_delete'
                                                    ? 'text-amber-800 font-bold'
                                                    : 'text-slate-800'
                                                }`}
                                        >
                                            <option value="all">Semua Status</option>
                                            <option value="pending_delete">Menunggu Hapus ({reports.filter(r => r.deleteRequested).length})</option>
                                        </select>
                                    </div>

                                    {/* Reset Filter Button */}
                                    {(selectedDay !== 'all' || selectedMonth !== 'all' || selectedYear !== 'all' || searchQuery.trim() !== '' || adminDeleteFilter !== 'all' || selectedCMType !== 'all') && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedDay('all');
                                                setSelectedMonth('all');
                                                setSelectedYear('all');
                                                setSelectedCMType('all');
                                                setSearchQuery('');
                                                setAdminDeleteFilter('all');
                                            }}
                                            className="px-2.5 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
                                            title="Reset semua filter"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                            <span>Reset</span>
                                        </button>
                                    )}
                                </div>

                                {/* Total Counter Badge */}
                                <div className="hidden lg:flex items-center text-[11px] font-semibold text-slate-500 shrink-0 ml-auto">
                                    Total: <span className="ml-1.5 px-2 py-0.5 bg-slate-100 rounded-md font-bold text-slate-700">{filteredReports.length} laporan</span>
                                </div>
                            </div>
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
                            {filteredReports.map((report, index) => (
                                <motion.div
                                    key={report.id}
                                    id={`cm-report-card-${report.id}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`scroll-mt-24 bg-white/90 backdrop-blur-sm rounded-2xl border overflow-hidden hover:border-blue-300 transition shadow-lg relative ${report.deleteRequested
                                        ? 'border-amber-400 ring-2 ring-amber-400/20'
                                        : report.reportType === 'PIR'
                                            ? 'border-red-400'
                                            : report.reportType === 'SLA'
                                                ? 'border-red-300'
                                                : 'border-slate-200'
                                        }`}
                                >
                                    {/* Amber Banner when Deletion is Requested */}
                                    {report.deleteRequested && (
                                        <div className="bg-amber-500/10 border-b border-amber-500/30 px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 text-amber-700 font-bold text-xs">
                                                <span className="flex h-2 w-2 relative">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                                </span>
                                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                                <span>MENUNGGU PERSETUJUAN HAPUS DARI ADMIN</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                                                <span>Diajukan oleh: <strong className="text-amber-800 font-semibold">{report.deleteRequestedBy || 'Standby Engineer'}</strong></span>
                                                {report.deleteReason && (
                                                    <>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="italic bg-white/90 px-2.5 py-0.5 rounded-lg border border-amber-200 text-amber-900 font-medium shadow-xs">
                                                            Remark: "{report.deleteReason}"
                                                        </span>
                                                    </>
                                                )}
                                                {isAuthorizedRole && (
                                                    <button
                                                        type="button"
                                                        onClick={() => cancelDeleteRequest(report.id)}
                                                        className="ml-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold border border-amber-300 transition cursor-pointer flex items-center gap-1 text-[10px]"
                                                        title="Batalkan Pengajuan Hapus Dokumen Ini"
                                                    >
                                                        <X className="w-3 h-3" />
                                                        <span>Batalkan Pengajuan</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {report.reportType === 'PIR' ? (
                                        /* PIR REPORT CARD LAYOUT */
                                        <div className="p-5 sm:p-6">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4 mb-4">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-black shadow-xs">
                                                        #{filteredReports.length - index}
                                                    </span>
                                                    <div className="px-3 py-1 bg-red-100 border border-red-300 rounded-lg text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                                        REPORT PIR (POSTMORTEM)
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>{report.incidentDate || (report.reportedAt?.toDate ? report.reportedAt.toDate().toLocaleDateString() : '-')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>Owner: {report.postmortemOwner || report.reportedBy}</span>
                                                    </div>
                                                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-slate-600 font-semibold">
                                                        {report.reportedByEmail || '-'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                                    {isAuthorizedRole && (
                                                        <button
                                                            onClick={() => handleOpenForm('pir', report.id)}
                                                            className="w-8 h-8 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg inline-flex items-center justify-center shrink-0 transition shadow-2xs cursor-pointer"
                                                            title="Edit Laporan PIR"
                                                        >
                                                            <PenTool className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {isAuthorizedRole && (
                                                        <button
                                                            onClick={() => handleDeleteClick(report)}
                                                            className={`rounded-lg transition cursor-pointer inline-flex items-center justify-center gap-1.5 border text-xs font-semibold shrink-0 shadow-2xs ${report.deleteRequested
                                                                    ? isQcDme
                                                                        ? 'h-8 px-2.5 bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 shadow-sm animate-pulse'
                                                                        : 'h-8 px-2.5 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                                    : 'w-8 h-8 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                                                                }`}
                                                            title={
                                                                report.deleteRequested
                                                                    ? isQcDme
                                                                        ? 'Tinjau Pengajuan Hapus Dokumen'
                                                                        : 'Menunggu Persetujuan Hapus QC DME (Klik untuk batalkan pengajuan)'
                                                                    : isQcDme
                                                                        ? 'Hapus Laporan Permanen'
                                                                        : 'Ajukan Hapus Laporan ke QC DME'
                                                            }
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            {report.deleteRequested && (
                                                                <span className="text-[11px] font-bold whitespace-nowrap">
                                                                    {isQcDme ? 'Tinjau Hapus' : 'Menunggu Approval'}
                                                                </span>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <span className="text-[10px] font-extrabold text-red-600 uppercase tracking-wider block mb-0.5">NAMA ISSUE / INSIDEN</span>
                                                    <h3 className="text-lg font-bold text-slate-900">{report.incidentName || report.issue || 'Laporan Insiden PIR'}</h3>
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
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4 mb-4">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-black shadow-xs">
                                                        #{filteredReports.length - index}
                                                    </span>
                                                    <div className="px-2.5 py-1 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-bold text-red-600 uppercase tracking-wider">
                                                        SLA / SLG
                                                    </div>
                                                    {(() => {
                                                        const linkedCM = report.id ? slaToCMMap.get(report.id) : null;
                                                        if (linkedCM) {
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleNavigateToCM(linkedCM);
                                                                    }}
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border border-blue-200 shadow-2xs transition cursor-pointer group" 
                                                                    title={`Klik untuk langsung menuju Laporan CM: ${linkedCM.incidentName || linkedCM.equipmentName || linkedCM.issue}`}
                                                                >
                                                                    <FileText className="w-3 h-3 text-blue-600" />
                                                                    <span>CM: {linkedCM.incidentName ? (linkedCM.incidentName.length > 24 ? linkedCM.incidentName.slice(0, 24) + '...' : linkedCM.incidentName) : (linkedCM.equipmentName || 'Terkait CM')}</span>
                                                                    <ExternalLink className="w-3 h-3 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
                                                                </button>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                                        <span>{(report as any).timeOrder ? new Date((report as any).timeOrder).toLocaleDateString() : (report.reportedAt?.toDate?.()?.toLocaleDateString() || '-')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <User className="w-3.5 h-3.5 text-slate-500" />
                                                        <span>PIC: {report.picDME || 'On Duty DME'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-slate-600 font-semibold">
                                                            Dibuat: {report.reportedByEmail || '-'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                                    {(() => {
                                                        const linkedCM = report.id ? slaToCMMap.get(report.id) : null;
                                                        if (linkedCM) {
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleNavigateToCM(linkedCM)}
                                                                    className="h-8 px-2.5 sm:px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition shadow-2xs cursor-pointer"
                                                                    title={`Buka Laporan CM terkait: ${linkedCM.incidentName || linkedCM.equipmentName || linkedCM.issue}`}
                                                                >
                                                                    <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                                    <span>Buka CM</span>
                                                                    <ArrowRight className="w-3 h-3 text-blue-500 shrink-0" />
                                                                </button>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
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
                                                        className="h-8 px-2.5 sm:px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition shadow-2xs cursor-pointer"
                                                        title="Export to Excel"
                                                    >
                                                        <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                        <span>Excel</span>
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
                                                        className="h-8 px-2.5 sm:px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition shadow-2xs cursor-pointer"
                                                        title="Export to Word (DOCX)"
                                                    >
                                                        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                        <span>Word SLA</span>
                                                    </button>

                                                    {isAuthorizedRole && (
                                                        <button
                                                            onClick={() => handleOpenForm('sla', report.id)}
                                                            className="w-8 h-8 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg inline-flex items-center justify-center shrink-0 transition shadow-2xs cursor-pointer"
                                                            title="Edit Laporan SLA"
                                                        >
                                                            <PenTool className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {isAuthorizedRole && (
                                                        <button
                                                            onClick={() => handleDeleteClick(report)}
                                                            className={`rounded-lg transition cursor-pointer inline-flex items-center justify-center gap-1.5 border text-xs font-semibold shrink-0 shadow-2xs ${report.deleteRequested
                                                                    ? isQcDme
                                                                        ? 'h-8 px-2.5 bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 shadow-sm animate-pulse'
                                                                        : 'h-8 px-2.5 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                                    : 'w-8 h-8 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                                                                }`}
                                                            title={
                                                                report.deleteRequested
                                                                    ? isQcDme
                                                                        ? 'Tinjau Pengajuan Hapus Dokumen'
                                                                        : 'Menunggu Persetujuan Hapus QC DME (Klik untuk batalkan pengajuan)'
                                                                    : isQcDme
                                                                        ? 'Hapus Laporan Permanen'
                                                                        : 'Ajukan Hapus Laporan ke QC DME'
                                                            }
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            {report.deleteRequested && (
                                                                <span className="text-[11px] font-bold whitespace-nowrap">
                                                                    {isQcDme ? 'Tinjau Hapus' : 'Menunggu Approval'}
                                                                </span>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                                <div className="lg:col-span-2 space-y-4">
                                                    <div>
                                                        <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block mb-0.5">NAMA ISSUE / ORDER TIKET</span>
                                                        <h3 className="text-lg font-bold text-slate-900 mb-1">{report.ticketName || report.issue || 'Laporan Gangguan SLA'}</h3>
                                                        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                                                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                                            <span>{report.location}</span>
                                                            <span className="text-slate-400">•</span>
                                                            <span className="text-slate-500">Prioritas:</span>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${report.priority === 'High' ? 'bg-rose-500/20 text-rose-600' :
                                                                report.priority === 'Medium' ? 'bg-amber-500/20 text-amber-700' : 'bg-slate-200 text-slate-700'
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
                                                            <span className="text-slate-600 font-medium">1. Response Time</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-800">{report.actualResponseTimeMin ?? 0} Min</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${report.responseComply ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                                                    }`}>{report.responseComply ? 'Comply' : 'No Comply'}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-600 font-medium">2. Principle Onsite</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-800">{report.actualOnsiteTimeMin ?? 0} Min</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${report.onsiteComply ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                                                    }`}>{report.onsiteComply ? 'Comply' : 'No Comply'}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-600 font-medium">3. Restore Service</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-800">{report.actualRestoreTimeMin ?? 0} Min</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getSLACompliance(report).restoreComply ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                                                    }`}>{getSLACompliance(report).restoreComply ? 'Comply' : 'No Comply'}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-600 font-medium">4. Resolution Time</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-800">{report.actualResolutionTimeMin ?? 0} Min</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getSLACompliance(report).resolutionComply ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                                                    }`}>{getSLACompliance(report).resolutionComply ? 'Comply' : 'No Comply'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Bukti Dokumentasi SLA (4-Step)</span>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {/* Step 1: Response */}
                                                    <div className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                                        {report.photoResponse || report.photosResponse?.[0]?.photo ? (
                                                            <img src={report.photoResponse || report.photosResponse?.[0]?.photo} alt="Response Time Evidence" className="w-full h-24 object-cover" />
                                                        ) : (
                                                            <div className="w-full h-24 flex items-center justify-center text-slate-400 text-xs italic">Tidak ada foto</div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                            <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">1. Response</span>
                                                        </div>
                                                    </div>

                                                    {/* Step 2: Principle Onsite */}
                                                    <div className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                                        {report.photoOnsite || report.photosOnsite?.[0]?.photo ? (
                                                            <img src={report.photoOnsite || report.photosOnsite?.[0]?.photo} alt="Principle Onsite Evidence" className="w-full h-24 object-cover" />
                                                        ) : (
                                                            <div className="w-full h-24 flex items-center justify-center text-slate-400 text-xs italic">Tidak ada foto</div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                            <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">2. Princ Onsite</span>
                                                        </div>
                                                    </div>

                                                    {/* Step 3: Restore Service */}
                                                    <div className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                                        {report.photoRestore || report.photosRestore?.[0]?.photo ? (
                                                            <img src={report.photoRestore || report.photosRestore?.[0]?.photo} alt="Restore Time Evidence" className="w-full h-24 object-cover" />
                                                        ) : (
                                                            <div className="w-full h-24 flex items-center justify-center text-slate-400 text-xs italic">Tidak ada foto</div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                            <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">3. Restore</span>
                                                        </div>
                                                    </div>

                                                    {/* Step 4: Resolution */}
                                                    <div className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                                        {report.photoResolution || report.photosResolution?.[0]?.photo ? (
                                                            <img src={report.photoResolution || report.photosResolution?.[0]?.photo} alt="Resolution Time Evidence" className="w-full h-24 object-cover" />
                                                        ) : (
                                                            <div className="w-full h-24 flex items-center justify-center text-slate-400 text-xs italic">Tidak ada foto</div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all">
                                                            <span className="text-[9px] font-extrabold text-white uppercase tracking-wider">4. Resolusi</span>
                                                        </div>
                                                    </div>
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
                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-black shadow-xs">
                                                                #{filteredReports.length - index}
                                                            </span>
                                                            <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(report.status)}`}>
                                                                {report.status}
                                                            </div>
                                                            {(() => {
                                                                const isSparepart = report.troubleshootType === 'sparepart_replacement' || report.isSparepartReplacement === true;
                                                                const isConsumable = isSparepart && report.sparepartType === 'consumable';
                                                                const requiresSLA = isCMRequiringSLA(report);

                                                                const linkedSLA = report.id ? cmToSLAMap.get(report.id) : null;
                                                                const hasSLA = Boolean(linkedSLA);

                                                                return (
                                                                    <div className="inline-flex items-center gap-1.5 flex-wrap">
                                                                        {/* 1. BADGE LABEL TIPE PENANGANAN / SPAREPART */}
                                                                        {isSparepart ? (
                                                                            isConsumable ? (
                                                                                <span
                                                                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-300 shadow-2xs"
                                                                                    title="Jenis penanganan: Pergantian Sparepart (Consumable Part - Wajib Dibuatkan SLA/SLG)"
                                                                                >
                                                                                    <Package className="w-3 h-3 text-purple-600" />
                                                                                    Consumable Part (Wajib SLA)
                                                                                </span>
                                                                            ) : (
                                                                                <span
                                                                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                                                                                    title="Jenis penanganan: Pergantian Sparepart (Sparepart DME / Baut - Tidak dibuatkan form SLA/SLG)"
                                                                                >
                                                                                    <Wrench className="w-3 h-3 text-blue-600" />
                                                                                    Sparepart DME (Tanpa SLA)
                                                                                </span>
                                                                            )
                                                                        ) : (
                                                                            <span
                                                                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs"
                                                                                title="Jenis penanganan: Troubleshoot Gangguan / Bukan Pergantian Sparepart (Wajib Dibuatkan SLA/SLG)"
                                                                            >
                                                                                <Zap className="w-3 h-3 text-amber-600" />
                                                                                Troubleshoot Gangguan
                                                                            </span>
                                                                        )}

                                                                        {/* 2. BADGE STATUS SLA (Hanya jika wajib SLA) */}
                                                                        {requiresSLA && (
                                                                            hasSLA ? (
                                                                                <div className="inline-flex items-center gap-1.5 flex-wrap">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            if (linkedSLA) handleNavigateToSLA(linkedSLA);
                                                                                        }}
                                                                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-300 shadow-2xs transition cursor-pointer group"
                                                                                        title={`Klik untuk langsung membuka Form SLA: ${linkedSLA?.ticketName || 'Form SLA/SLG'}`}
                                                                                    >
                                                                                        <Check className="w-3 h-3 text-emerald-600" />
                                                                                        <span>SLA Terbit {linkedSLA?.ticketName ? `(${linkedSLA.ticketName.length > 22 ? linkedSLA.ticketName.slice(0, 22) + '...' : linkedSLA.ticketName})` : ''}</span>
                                                                                        <ExternalLink className="w-3 h-3 text-emerald-600 group-hover:translate-x-0.5 transition-transform ml-0.5" />
                                                                                    </button>
                                                                                    {isAuthorizedRole && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleCreateSLAFromCM(report)}
                                                                                            className="px-2 py-0.5 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 text-[10px] font-bold rounded-md transition border border-slate-300 hover:border-amber-300 flex items-center gap-1 cursor-pointer"
                                                                                            title="Buat Form SLA tambahan atau buat baru jika SLA terkait tidak cocok"
                                                                                        >
                                                                                            <Zap className="w-2.5 h-2.5 text-amber-600 fill-current" />
                                                                                            <span>+ Buat SLA Baru</span>
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="inline-flex items-center gap-1.5">
                                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                                                                        <AlertCircle className="w-3 h-3 text-amber-600" />
                                                                                        SLA Belum Ada
                                                                                    </span>
                                                                                    {isAuthorizedRole && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleCreateSLAFromCM(report)}
                                                                                            className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-[10px] font-bold rounded-md transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                                                                            title="Buat Form SLA otomatis dari CM ini"
                                                                                        >
                                                                                            <Zap className="w-2.5 h-2.5 fill-current" />
                                                                                            <span>+ Buat SLA</span>
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                        <span className="text-[10px] font-extrabold text-red-600 uppercase tracking-wider block mb-0.5">NAMA ISSUE / PERALATAN</span>
                                                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                            <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                                                            <span>{report.incidentName || report.issue || report.equipmentName || 'Laporan Insiden / Issue'}</span>
                                                        </h3>
                                                        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mt-1">
                                                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                            <span>Area / Lokasi: <strong className="text-slate-800">{report.location}</strong></span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            Reported by <span className="text-slate-700">{report.reportedByEmail}</span> • {report.incidentDate || (report.reportedAt?.toDate ? report.reportedAt.toDate().toLocaleDateString() : 'Baru Saja')}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                                        {(() => {
                                                            const linkedSLA = report.id ? cmToSLAMap.get(report.id) : null;
                                                            if (linkedSLA) {
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleNavigateToSLA(linkedSLA)}
                                                                        className="h-8 px-2.5 sm:px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition shadow-2xs cursor-pointer"
                                                                        title={`Buka Form SLA terkait: ${linkedSLA.ticketName || 'Form SLA/SLG'}`}
                                                                    >
                                                                        <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                                        <span>Buka SLA</span>
                                                                        <ArrowRight className="w-3 h-3 text-emerald-500 shrink-0" />
                                                                    </button>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                        <button
                                                            onClick={() => handleExportSingleCMDocx(report)}
                                                            className="h-8 px-2.5 sm:px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition shadow-2xs cursor-pointer"
                                                            title="Export to Word (DOCX)"
                                                        >
                                                            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                            <span>Word CM</span>
                                                        </button>

                                                        {isAuthorizedRole && (
                                                            <button
                                                                onClick={() => handleOpenForm('cm_pdf', report.id)}
                                                                className="w-8 h-8 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg inline-flex items-center justify-center shrink-0 transition shadow-2xs cursor-pointer"
                                                                title="Edit Laporan CM"
                                                            >
                                                                <PenTool className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {isAuthorizedRole && (
                                                            <button
                                                                onClick={() => handleDeleteClick(report)}
                                                                className={`rounded-lg transition cursor-pointer inline-flex items-center justify-center gap-1.5 border text-xs font-semibold shrink-0 shadow-2xs ${report.deleteRequested
                                                                        ? isQcDme
                                                                            ? 'h-8 px-2.5 bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 shadow-sm animate-pulse'
                                                                            : 'h-8 px-2.5 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                                        : 'w-8 h-8 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                                                                    }`}
                                                                title={
                                                                    report.deleteRequested
                                                                        ? isQcDme
                                                                            ? 'Tinjau Pengajuan Hapus Dokumen'
                                                                            : 'Menunggu Persetujuan Hapus QC DME (Klik untuk batalkan pengajuan)'
                                                                        : isQcDme
                                                                            ? 'Hapus Laporan Permanen'
                                                                            : 'Ajukan Hapus Laporan ke QC DME'
                                                                }
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                {report.deleteRequested && (
                                                                    <span className="text-[11px] font-bold whitespace-nowrap">
                                                                        {isQcDme ? 'Tinjau Hapus' : 'Menunggu Approval'}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-orange-600 mb-1 flex items-center gap-2">
                                                            <AlertCircle className="w-3 h-3" /> Issue / Akar Masalah
                                                        </h4>
                                                        <p className="text-slate-700 text-sm leading-relaxed">
                                                            {report.issue || report.summaryProblemAnalysis || report.visualInspectionChecking || report.incidentName || '-'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-emerald-600 mb-1 flex items-center gap-2">
                                                            <CheckCircle2 className="w-3 h-3" /> Action Taken (Tindakan)
                                                        </h4>
                                                        <p className="text-slate-700 text-sm leading-relaxed">{report.actionTaken || report.correctiveAction || '-'}</p>
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

            {/* Standardized Delete / Approval Modal */}
            <DeleteConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setSelectedReportForDelete(null);
                }}
                onConfirm={confirmDelete}
                onRejectRequest={isQcDme ? rejectDeleteRequest : () => cancelDeleteRequest()}
                documentName={
                    selectedReportForDelete?.incidentName ||
                    selectedReportForDelete?.ticketName ||
                    selectedReportForDelete?.equipmentName ||
                    selectedReportForDelete?.issue ||
                    'Laporan Standby'
                }
                loading={deleteLoading}
                isRequested={selectedReportForDelete?.deleteRequested || false}
                requestedBy={selectedReportForDelete?.deleteRequestedBy || ''}
                deleteReason={selectedReportForDelete?.deleteReason || ''}
                isAdmin={isQcDme}
                requireReason={!isQcDme}
            />

            {/* Modal Rekap SLA Bulanan */}
            <SLAMonthlyRecapModal
                isOpen={isRecapModalOpen}
                onClose={() => setIsRecapModalOpen(false)}
                reports={allSLAReports}
                initialMonth={selectedMonth}
                initialYear={selectedYear}
            />

            {/* Modal Diagnostik CM vs SLA */}
            <CMDiagnosticModal
                isOpen={isDiagnosticModalOpen}
                onClose={() => setIsDiagnosticModalOpen(false)}
                allCMReports={allCMReports}
                totalCM={allCMReports.length}
                totalSLA={allSLAReports.length}
                sparepartCMs={sparepartCMs}
                nonSparepartCMs={nonSparepartCMs}
                orphanSLAs={orphanSLAs}
                slaLinkedToSparepart={slaLinkedToSparepart}
                slaLinkedToGhostCM={slaLinkedToGhostCM}
                duplicateSLACMs={duplicateSLACMs}
                detectedSparepartSLAs={detectedSparepartSLAs}
                isQcDme={isQcDme}
                userEmail={user?.email || undefined}
            />
        </div>
    );
}

// ============================================================================
// KOMPONEN: CMDiagnosticModal
// Modal investigasi anomali data CM vs Form SLA/SLG di Firestore
// Dilengkapi fitur Pembersihan Opsi A (Hapus SLA Sparepart)
// ============================================================================
interface CMDiagnosticModalProps {
    isOpen: boolean;
    onClose: () => void;
    allCMReports: CorrectiveReport[];
    totalCM: number;
    totalSLA: number;
    sparepartCMs: CorrectiveReport[];
    nonSparepartCMs: CorrectiveReport[];
    orphanSLAs: CorrectiveReport[];
    slaLinkedToSparepart: CorrectiveReport[];
    slaLinkedToGhostCM: CorrectiveReport[];
    duplicateSLACMs: [string, CorrectiveReport[]][];
    detectedSparepartSLAs: Array<{ cmId: string; cm?: CorrectiveReport; sla: CorrectiveReport }>;
    isQcDme: boolean;
    userEmail?: string;
}

function CMDiagnosticModal({
    isOpen,
    onClose,
    allCMReports,
    totalCM,
    totalSLA,
    sparepartCMs,
    nonSparepartCMs,
    orphanSLAs,
    slaLinkedToSparepart,
    slaLinkedToGhostCM,
    duplicateSLACMs,
    detectedSparepartSLAs,
    isQcDme,
    userEmail
}: CMDiagnosticModalProps) {
    const [activeTab, setActiveTab] = useState<'cleanup' | 'summary' | 'sparepart_sla' | 'orphan_sla' | 'duplicate_sla' | 'sparepart_list'>('cleanup');
    const [selectedSlaIds, setSelectedSlaIds] = useState<string[]>([]);
    const [isCleaning, setIsCleaning] = useState<boolean>(false);

    useEffect(() => {
        if (detectedSparepartSLAs.length > 0) {
            setSelectedSlaIds(detectedSparepartSLAs.map(d => d.sla.id).filter(Boolean));
        }
    }, [detectedSparepartSLAs]);

    if (!isOpen) return null;

    const expectedMaxSLA = nonSparepartCMs.length;
    const excessSLA = totalSLA - expectedMaxSLA;

    const handleToggleSelect = (slaId: string) => {
        setSelectedSlaIds(prev =>
            prev.includes(slaId) ? prev.filter(id => id !== slaId) : [...prev, slaId]
        );
    };

    const handleSelectAll = () => {
        if (selectedSlaIds.length === detectedSparepartSLAs.length) {
            setSelectedSlaIds([]);
        } else {
            setSelectedSlaIds(detectedSparepartSLAs.map(d => d.sla.id).filter(Boolean));
        }
    };

    const handleExecuteCleanup = async () => {
        if (selectedSlaIds.length === 0) {
            toast.error('Pilih minimal 1 Form SLA untuk dibersihkan');
            return;
        }

        const confirmMsg = `Yakin ingin membersihkan ${selectedSlaIds.length} Form SLA yang terkait dengan CM pergantian sparepart?\n\nDokumen-dokumen SLA ini akan dihapus dari arsip SLA sehingga angka SLA di database kembali sinkron.`;
        if (!window.confirm(confirmMsg)) return;

        setIsCleaning(true);
        const toastId = toast.loading(`Sedang membersihkan ${selectedSlaIds.length} SLA sparepart...`);
        let successCount = 0;
        let failCount = 0;

        for (const slaId of selectedSlaIds) {
            try {
                const docRef = doc(db, 'corrective_reports', slaId);
                let deleted = false;
                if (isQcDme) {
                    try {
                        await deleteDoc(docRef);
                        deleted = true;
                    } catch {
                        deleted = false;
                    }
                }
                if (!deleted) {
                    // Fallback jika bukan QC DME atau deleteDoc ditolak: tandai deleteRequested agar langsung keluar dari arsip
                    await updateDoc(docRef, {
                        deleteRequested: true,
                        deleteRequestedBy: userEmail || 'Standby Engineer',
                        deleteReason: 'Pembersihan otomatis Opsi A: CM bertipe pergantian sparepart tidak memerlukan Form SLA',
                        deleteRequestedAt: serverTimestamp()
                    });
                    deleted = true;
                }
                if (deleted) successCount++;
            } catch (err) {
                console.error('Gagal membersihkan SLA:', slaId, err);
                failCount++;
            }
        }

        if (successCount > 0) {
            toast.success(`Berhasil membersihkan ${successCount} Form SLA! Angka SLA di Arsip Standby telah sinkron.`, { id: toastId });
            setSelectedSlaIds([]);
        } else {
            toast.error(`Gagal membersihkan SLA (${failCount} gagal)`, { id: toastId });
        }
        setIsCleaning(false);
    };

    const handleCopySummary = () => {
        const text = `
=== DIAGNOSTIK DATA CM & SLA/SLG ===
Total Report CM: ${totalCM}
- CM Pergantian Sparepart (Tanpa SLA): ${sparepartCMs.length}
- CM Troubleshoot / Non-Sparepart (Wajib SLA): ${nonSparepartCMs.length}

Total Form SLA/SLG di Database: ${totalSLA}
Target Maksimal SLA: ${expectedMaxSLA}
Selisih SLA Berlebih: ${excessSLA > 0 ? `+${excessSLA} SLA` : 'Normal'}

--- DETAIL ANOMALI ---
1. SLA Terhubung ke CM Sparepart: ${detectedSparepartSLAs.length} item
${detectedSparepartSLAs.map(d => `   - [SLA: ${d.sla.id}] Ticket: ${(d.sla as any).ticketName || d.sla.issue || '-'} -> Terhubung ke CM: ${d.cmId} (${d.cm?.incidentName || d.cm?.equipmentName || '-'})`).join('\n')}

2. SLA Orphan (Tanpa cmReportId): ${orphanSLAs.length} item
${orphanSLAs.map(s => `   - [SLA: ${s.id}] Ticket: ${(s as any).ticketName || s.issue || '-'} (${s.incidentDate || '-'})`).join('\n')}

3. SLA Terhubung ke CM Hantu / Tidak Ditemukan: ${slaLinkedToGhostCM.length} item
${slaLinkedToGhostCM.map(s => `   - [SLA: ${s.id}] Ticket: ${(s as any).ticketName || s.issue || '-'} -> ID CM Tidak Ada: ${(s as any).cmReportId}`).join('\n')}

4. CM yang Memiliki Duplikat SLA: ${duplicateSLACMs.length} CM
${duplicateSLACMs.map(([cmId, slas]) => `   - [CM: ${cmId}] Punya ${slas.length} SLA: ${slas.map(s => s.id).join(', ')}`).join('\n')}

5. Daftar ${sparepartCMs.length} CM Pergantian Sparepart:
${sparepartCMs.map(cm => `   - [CM: ${cm.id}] ${cm.incidentName || cm.equipmentName || cm.issue || '-'} (${(cm as any).troubleshootType || 'keyword match'})`).join('\n')}
`.trim();

        navigator.clipboard.writeText(text);
        toast.success('Ringkasan diagnostik berhasil disalin ke clipboard!');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                                Diagnostik & Pembersihan Data CM / SLA
                            </h2>
                            <p className="text-xs text-slate-500">
                                Investigasi & Sinkronisasi jumlah data di Firestore (Opsi A)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-xl transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Report CM</span>
                            <span className="text-2xl font-black text-slate-900 mt-1 block">{totalCM}</span>
                            <span className="text-[11px] text-slate-500 mt-0.5 block">{sparepartCMs.length} Sparepart / {nonSparepartCMs.length} Wajib SLA</span>
                        </div>
                        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Total SLA Tersimpan</span>
                            <span className="text-2xl font-black text-blue-700 mt-1 block">{totalSLA}</span>
                            <span className="text-[11px] text-blue-600 mt-0.5 block">Di koleksi Firestore</span>
                        </div>
                        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Target SLA Maksimal</span>
                            <span className="text-2xl font-black text-emerald-700 mt-1 block">{expectedMaxSLA}</span>
                            <span className="text-[11px] text-emerald-600 mt-0.5 block">CM non-sparepart</span>
                        </div>
                        <div className={`p-3.5 rounded-xl border ${excessSLA > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                            <span className={`text-[11px] font-bold uppercase tracking-wider block ${excessSLA > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                Selisih SLA Berlebih
                            </span>
                            <span className={`text-2xl font-black mt-1 block ${excessSLA > 0 ? 'text-red-700' : 'text-slate-700'}`}>
                                {excessSLA > 0 ? `+${excessSLA}` : '0'}
                            </span>
                            <span className={`text-[11px] mt-0.5 block ${excessSLA > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                {excessSLA > 0 ? 'Perlu dibersihkan/dianalisis' : 'Sinkron'}
                            </span>
                        </div>
                    </div>

                    {/* Sub-Tabs */}
                    <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('cleanup')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'cleanup' ? 'bg-red-600 text-white shadow-xs' : 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
                            }`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>⚡ Eksekusi Opsi A (Bersihkan SLA)</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                activeTab === 'cleanup' ? 'bg-white text-red-600' : 'bg-red-600 text-white'
                            }`}>
                                {detectedSparepartSLAs.length}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('summary')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                activeTab === 'summary' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            Ringkasan Anomali
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('orphan_sla')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'orphan_sla' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <span>SLA Orphan ({orphanSLAs.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('duplicate_sla')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'duplicate_sla' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <span>CM Duplikat SLA ({duplicateSLACMs.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('sparepart_list')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'sparepart_list' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <span>{sparepartCMs.length} CM Sparepart</span>
                        </button>
                    </div>

                    {/* Tab Content: Cleanup (Opsi A) */}
                    {activeTab === 'cleanup' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
                                        <Trash2 className="w-4 h-4 text-red-600" />
                                        <span>Pembersihan SLA Sparepart (Opsi A)</span>
                                    </div>
                                    <span className="text-xs bg-red-100 text-red-800 font-extrabold px-2 py-0.5 rounded-md">
                                        {detectedSparepartSLAs.length} SLA Terdeteksi
                                    </span>
                                </div>
                                <p className="text-xs text-red-800/90 leading-relaxed">
                                    Sistem mendeteksi <strong>{detectedSparepartSLAs.length} Form SLA</strong> yang dibuat untuk CM bertipe <em>Pergantian Sparepart</em>. 
                                    SLA-SLA ini menyebabkan jumlah SLA di database membengkak (+{excessSLA} SLA).
                                    Centang SLA yang ingin dibersihkan, lalu klik tombol merah di bawah untuk mengeksekusi pembersihan.
                                </p>
                            </div>

                            {detectedSparepartSLAs.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-800">Database Sudah Bersih!</p>
                                    <p className="text-xs text-slate-500 mt-1">Tidak ada lagi Form SLA yang terkait dengan CM pergantian sparepart.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1">
                                        <button
                                            type="button"
                                            onClick={handleSelectAll}
                                            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedSlaIds.length === detectedSparepartSLAs.length && detectedSparepartSLAs.length > 0}
                                                onChange={handleSelectAll}
                                                className="w-4 h-4 text-red-600 rounded cursor-pointer"
                                            />
                                            <span>{selectedSlaIds.length === detectedSparepartSLAs.length ? 'Batalkan Semua' : 'Pilih Semua'} ({selectedSlaIds.length}/{detectedSparepartSLAs.length} Terpilih)</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleExecuteCleanup}
                                            disabled={selectedSlaIds.length === 0 || isCleaning}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
                                        >
                                            {isCleaning ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Memproses Pembersihan...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Trash2 className="w-4 h-4" />
                                                    <span>Bersihkan {selectedSlaIds.length} SLA Terpilih</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                                        {detectedSparepartSLAs.map(({ cmId, cm, sla }) => {
                                            const isChecked = selectedSlaIds.includes(sla.id);
                                            return (
                                                <div
                                                    key={sla.id}
                                                    onClick={() => handleToggleSelect(sla.id)}
                                                    className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                                                        isChecked
                                                            ? 'bg-red-50/70 border-red-300 shadow-2xs'
                                                            : 'bg-white border-slate-200 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => handleToggleSelect(sla.id)}
                                                        className="mt-1 w-4 h-4 text-red-600 rounded cursor-pointer"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <div className="flex-1 min-w-0 space-y-1">
                                                        <div className="flex flex-wrap items-center justify-between gap-1">
                                                            <div className="font-bold text-xs text-slate-900 truncate">
                                                                {(sla as any).ticketName || sla.issue || 'Form SLA'}
                                                            </div>
                                                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                SLA ID: {sla.id}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2">
                                                            <span>📅 {(sla as any).incidentDate || '-'}</span>
                                                            <span>•</span>
                                                            <span className="text-red-700 font-medium">
                                                                Terkait CM: {cm?.incidentName || cm?.equipmentName || cmId}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 line-clamp-1 italic">
                                                            Pekerjaan CM: {cm?.issue || cm?.correctiveAction || '-'}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Tab Content: Summary */}
                    {activeTab === 'summary' && (
                        <div className="space-y-3">
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Temuan Detail</h4>
                                <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                                    <li>
                                        <strong>SLA terhubung ke CM Sparepart (Pencocokan):</strong> <span className={detectedSparepartSLAs.length > 0 ? 'text-red-600 font-bold' : 'text-emerald-600'}>{detectedSparepartSLAs.length} dokumen</span>
                                        {detectedSparepartSLAs.length > 0 && ' (SLA ini seharusnya tidak dibuat / dibersihkan)'}
                                    </li>
                                    <li>
                                        <strong>SLA terhubung langsung via field cmReportId:</strong> <span className="text-slate-600">{slaLinkedToSparepart.length} dokumen</span>
                                    </li>
                                    <li>
                                        <strong>SLA Orphan (tanpa field cmReportId):</strong> <span className={orphanSLAs.length > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600'}>{orphanSLAs.length} dokumen</span>
                                        {orphanSLAs.length > 0 && ' (SLA dibuat mandiri / field cmReportId kosong)'}
                                    </li>
                                    <li>
                                        <strong>SLA terhubung ke ID CM yang tidak ditemukan:</strong> <span className={slaLinkedToGhostCM.length > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600'}>{slaLinkedToGhostCM.length} dokumen</span>
                                    </li>
                                    <li>
                                        <strong>CM yang memiliki lebih dari 1 SLA (Duplikat):</strong> <span className={duplicateSLACMs.length > 0 ? 'text-purple-600 font-bold' : 'text-emerald-600'}>{duplicateSLACMs.length} CM</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Tab Content: Orphan SLA */}
                    {activeTab === 'orphan_sla' && (
                        <div className="space-y-2">
                            {orphanSLAs.length === 0 ? (
                                <p className="text-xs text-slate-500 py-6 text-center">Tidak ada SLA orphan (semua SLA memiliki cmReportId).</p>
                            ) : (
                                <div className="space-y-2">
                                    {orphanSLAs.map(sla => (
                                        <div key={sla.id} className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs space-y-1">
                                            <div className="flex justify-between items-start font-mono text-[11px] text-amber-800">
                                                <span>SLA ID: <strong>{sla.id}</strong></span>
                                                <span>{(sla as any).incidentDate || '-'}</span>
                                            </div>
                                            <div className="font-semibold text-slate-900">
                                                {(sla as any).ticketName || sla.issue || 'Form SLA Tanpa Tiket'}
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                PIC: {(sla as any).picName || sla.authorName || '-'} | Status: {(sla as any).status || 'Selesai'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab Content: Duplicate SLA */}
                    {activeTab === 'duplicate_sla' && (
                        <div className="space-y-2">
                            {duplicateSLACMs.length === 0 ? (
                                <p className="text-xs text-slate-500 py-6 text-center">Tidak ada CM yang memiliki lebih dari 1 SLA.</p>
                            ) : (
                                <div className="space-y-2">
                                    {duplicateSLACMs.map(([cmId, slas]) => {
                                        const cm = allCMReports.find(c => c.id === cmId);
                                        return (
                                            <div key={cmId} className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl text-xs space-y-1.5">
                                                <div className="font-mono text-[11px] text-purple-800">
                                                    CM ID: <strong>{cmId}</strong> ({cm?.incidentName || cm?.equipmentName || 'Laporan CM'})
                                                </div>
                                                <div className="text-[11px] text-purple-900 font-bold">
                                                    Memiliki {slas.length} Form SLA terhubung:
                                                </div>
                                                <div className="space-y-1">
                                                    {slas.map(s => (
                                                        <div key={s.id} className="p-1.5 bg-white rounded border border-purple-100 font-mono text-[11px] text-slate-700 flex justify-between">
                                                            <span>ID: {s.id} ({(s as any).ticketName || s.issue || '-'})</span>
                                                            <span className="text-slate-400">{(s as any).incidentDate || '-'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab Content: 13 CM Sparepart */}
                    {activeTab === 'sparepart_list' && (
                        <div className="space-y-2">
                            {sparepartCMs.map((cm, idx) => (
                                <div key={cm.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                                    <div className="flex justify-between items-start font-mono text-[11px] text-slate-600">
                                        <span>CM #{idx + 1} | ID: <strong>{cm.id}</strong></span>
                                        <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">
                                            {(cm as any).troubleshootType === 'sparepart_replacement' ? 'Field Explicit' : 'Keyword Match'}
                                        </span>
                                    </div>
                                    <div className="font-bold text-slate-900">
                                        {cm.incidentName || cm.equipmentName || 'Pergantian Sparepart'}
                                    </div>
                                    <div className="text-[11px] text-slate-600 line-clamp-2">
                                        {cm.issue || cm.correctiveAction || cm.summaryProblemAnalysis || '-'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                    <button
                        type="button"
                        onClick={handleCopySummary}
                        className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                        <Copy className="w-4 h-4 text-slate-500" />
                        Salin Ringkasan Diagnostik
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}
