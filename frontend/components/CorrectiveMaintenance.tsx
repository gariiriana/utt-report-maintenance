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
    Wrench
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
import { exportCMReportToDocx, exportSLAReportToDocx, exportSLAMonthlyRecapToDocx } from '@/utils/docxReportExport';
import { normalizeEngineerName } from '@/utils/engineerSignatures';

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
    const isAdmin = userRole === 'admin';
    const isAuthorizedRole = userRole === 'admin' || userRole === 'engineer' || userRole === 'standby_engineer';

    const [reports, setReports] = useState<CorrectiveReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [reportFormType, setReportFormType] = useState<'standard' | 'sla' | 'cm_pdf' | 'pir' | null>(null);
    const [formKey, setFormKey] = useState(0);

    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [prefillSlaData, setPrefillSlaData] = useState<SLAPrefillData | null>(null);
    const [isPendingSlaExpanded, setIsPendingSlaExpanded] = useState<boolean>(true);

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
    const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery || '');
    const [adminDeleteFilter, setAdminDeleteFilter] = useState<'all' | 'pending_delete'>('all');

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
            if (isAdmin) {
                // Admins approve delete and delete the document permanently
                const toastId = toast.loading('Menghapus dokumen secara permanen...');
                await deleteDoc(doc(db, 'corrective_reports', selectedReportForDelete.id));
                toast.success('Laporan berhasil dihapus secara permanen', { id: toastId });
            } else {
                // Non-admins (Standby Engineers) request deletion with mandatory remark
                if (!reason || !reason.trim()) {
                    toast.error('Wajib menyertakan remark/alasan sebelum mengajukan hapus dokumen!');
                    setDeleteLoading(false);
                    return;
                }
                const toastId = toast.loading('Mengajukan permohonan hapus ke Admin...');
                const docRef = doc(db, 'corrective_reports', selectedReportForDelete.id);
                await updateDoc(docRef, {
                    deleteRequested: true,
                    deleteRequestedBy: user?.email || 'Standby Engineer',
                    deleteReason: reason.trim(),
                    deleteRequestedAt: serverTimestamp()
                });

                // Send real-time notification to Admin
                const docLabel = selectedReportForDelete.incidentName || selectedReportForDelete.ticketName || selectedReportForDelete.equipmentName || selectedReportForDelete.issue || 'Laporan Standby';
                await sendFileNotification({
                    title: 'Pengajuan Hapus Dokumen Standby',
                    fileName: docLabel,
                    category: 'Arsip Standby',
                    fileId: selectedReportForDelete.id,
                    uploadedBy: user?.email || 'Standby Engineer',
                    targetTab: 'corrective_archive',
                    searchQuery: docLabel
                });

                toast.success('Pengajuan hapus dokumen telah dikirim ke Admin. Menunggu persetujuan Admin.', { id: toastId });
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
        if (!selectedReportForDelete) return;
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

    const parseDateToTimestamp = (dateVal: any): number => {
        if (!dateVal) return 0;
        if (typeof dateVal === 'number') return dateVal;
        if (typeof dateVal.toDate === 'function') return dateVal.toDate().getTime();
        if (dateVal instanceof Date) return dateVal.getTime();
        if (typeof dateVal === 'string') {
            const trimmed = dateVal.trim();
            if (!trimmed) return 0;

            // Standard ISO format (YYYY-MM-DD...)
            if (/^\d{4}-\d{1,2}-\d{1,2}/.test(trimmed)) {
                const parsed = new Date(trimmed);
                if (!isNaN(parsed.getTime())) return parsed.getTime();
            }

            // Split date part
            const clean = trimmed.split(/[,T\s]+/)[0];
            const parts = clean.split(/[-/]/);
            if (parts.length === 3) {
                let day = parseInt(parts[0], 10);
                let month = parseInt(parts[1], 10) - 1;
                let year = parseInt(parts[2], 10);

                if (parts[0].length === 4) {
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    day = parseInt(parts[2], 10);
                } else if (isNaN(month)) {
                    const mIndex = INDO_MONTHS.findIndex(m => m.label.toLowerCase() === parts[1].toLowerCase());
                    if (mIndex !== -1) month = mIndex;
                }

                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    const parsed = new Date(year, month, day);
                    if (!isNaN(parsed.getTime())) return parsed.getTime();
                }
            }

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

        // Incident Date Filter (Month / Year)
        const reportTimestamp = getReportIncidentTime(report);
        if (reportTimestamp > 0) {
            const reportDate = new Date(reportTimestamp);
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
        return getReportIncidentTime(b) - getReportIncidentTime(a);
    });

    // Helper: Algoritma Matching CM vs SLA (4-Layer: Direct ID -> Incident ID -> Incident Date -> Title Match)
    const cleanStringForMatch = (s?: string) => {
        if (!s) return '';
        return s
            .toLowerCase()
            .replace(/\[sla\s*\/?\s*slg\]/gi, '')
            .replace(/laporan\s+corrective\s+maintenance/gi, '')
            .replace(/laporan\s+cm/gi, '')
            .replace(/corrective\s+maintenance/gi, '')
            .replace(/pemeliharaan\s+corrective/gi, '')
            .replace(/wo[-_:\s]*/gi, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    };

    // Normalize tanggal ke format YYYY-MM-DD agar bisa dicocokkan (abaikan jam/menit)
    const getDateKey = (r: CorrectiveReport): string => {
        const ts = getReportIncidentTime(r);
        if (ts > 0) {
            const d = new Date(ts);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        return '';
    };

    const getCMTitles = (cm: CorrectiveReport): string[] => {
        const candidates = [cm.incidentName, cm.equipmentName, cm.issue];
        return candidates
            .map(c => cleanStringForMatch(c))
            .filter(c => c.length >= 5);
    };

    const getSLATitles = (sla: CorrectiveReport): string[] => {
        const candidates = [sla.ticketName, sla.issue];
        return candidates
            .map(c => cleanStringForMatch(c))
            .filter(c => c.length >= 5);
    };

    // Helper: Ekstrak kata-kata penting (tokens >= 4 chars) untuk fuzzy token matching
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

        const stopWords = new Set(['laporan', 'report', 'pada', 'unit', 'dan', 'atau', 'yang', 'room', 'area', 'gedung', 'office', 'lantai', 'kondisi', 'terdapat', 'mengalami', 'sudah', 'telah']);
        return clean.split(/\s+/)
            .filter(w => w.length >= 4 && !stopWords.has(w));
    };

    // ===== Global 1-to-1 CM↔SLA Matching (each SLA can only be claimed once) =====
    const buildCMSLAMapping = (cmList: CorrectiveReport[], slaList: CorrectiveReport[]): Set<string> => {
        const claimedSLAIds = new Set<string>();  // SLA IDs yang sudah dipasangkan
        const matchedCMIds = new Set<string>();    // CM IDs yang sudah punya SLA

        // Helper: try to claim an SLA for a CM
        const tryClaim = (cmId: string, sla: CorrectiveReport): boolean => {
            if (!sla.id || claimedSLAIds.has(sla.id)) return false;
            claimedSLAIds.add(sla.id);
            matchedCMIds.add(cmId);
            return true;
        };

        // Pass 1: Direct cmReportId matching (Exact 100%)
        for (const cm of cmList) {
            if (!cm.id || matchedCMIds.has(cm.id)) continue;
            const match = slaList.find(s => s.id && !claimedSLAIds.has(s.id) && (s as any).cmReportId === cm.id);
            if (match) tryClaim(cm.id, match);
        }

        // Pass 2: Incident ID / Ticket ID matching
        for (const cm of cmList) {
            if (!cm.id || matchedCMIds.has(cm.id)) continue;
            if (!cm.incidentId || cm.incidentId === 'N/A' || cm.incidentId.trim() === '') continue;
            const match = slaList.find(s => s.id && !claimedSLAIds.has(s.id) && (s.incidentId === cm.incidentId || (s as any).ticketId === cm.incidentId));
            if (match) tryClaim(cm.id, match);
        }

        // Pass 3: Specific Title / Equipment Substring Matching (±60 hari)
        for (const cm of cmList) {
            if (!cm.id || matchedCMIds.has(cm.id)) continue;
            const cmTitles = getCMTitles(cm);
            if (cmTitles.length === 0) continue;
            const cmTime = getReportIncidentTime(cm);

            const match = slaList.find(s => {
                if (!s.id || claimedSLAIds.has(s.id)) return false;
                const slaTitles = getSLATitles(s);
                if (slaTitles.length === 0) return false;

                const slaTime = getReportIncidentTime(s);
                const isDateClose = (cmTime > 0 && slaTime > 0)
                    ? Math.abs(cmTime - slaTime) <= 60 * 24 * 60 * 60 * 1000
                    : true;
                if (!isDateClose) return false;

                for (const cmTitle of cmTitles) {
                    for (const slaTitle of slaTitles) {
                        if (cmTitle === slaTitle) return true;
                        if (cmTitle.length >= 5 && slaTitle.includes(cmTitle)) return true;
                        if (slaTitle.length >= 5 && cmTitle.includes(slaTitle)) return true;
                    }
                }
                return false;
            });
            if (match) tryClaim(cm.id, match);
        }

        // Pass 4: Multi-Token Keyword Overlap Match (±45 hari, minimal 2 kata kunci cocok)
        for (const cm of cmList) {
            if (!cm.id || matchedCMIds.has(cm.id)) continue;
            const cmTokens = extractSignificantTokens(`${cm.incidentName || ''} ${cm.equipmentName || ''} ${cm.issue || ''}`);
            if (cmTokens.length === 0) continue;
            const cmTime = getReportIncidentTime(cm);

            const match = slaList.find(s => {
                if (!s.id || claimedSLAIds.has(s.id)) return false;
                const slaTokens = extractSignificantTokens(`${s.ticketName || ''} ${s.issue || ''} ${s.remark || ''}`);
                if (slaTokens.length === 0) return false;

                const slaTime = getReportIncidentTime(s);
                const isDateClose = (cmTime > 0 && slaTime > 0)
                    ? Math.abs(cmTime - slaTime) <= 45 * 24 * 60 * 60 * 1000
                    : true;
                if (!isDateClose) return false;

                // Hitung berapa token yang sama
                const sharedTokens = cmTokens.filter(t => slaTokens.some(st => st === t || (st.length >= 5 && st.includes(t)) || (t.length >= 5 && t.includes(st))));
                return sharedTokens.length >= 2 || (cmTokens.length === 1 && sharedTokens.length === 1);
            });
            if (match) tryClaim(cm.id, match);
        }

        // Pass 5: Fallback Tanggal Sama (Date-based 1-to-1)
        for (const cm of cmList) {
            if (!cm.id || matchedCMIds.has(cm.id)) continue;
            const cmDate = getDateKey(cm);
            if (!cmDate) continue;
            const match = slaList.find(s => s.id && !claimedSLAIds.has(s.id) && getDateKey(s) === cmDate);
            if (match) tryClaim(cm.id, match);
        }

        return matchedCMIds;
    };

    const allCMReports = reports.filter(r => r.reportType !== 'SLA' && r.reportType !== 'PIR');
    const allSLAReports = reports.filter(r => r.reportType === 'SLA' && !r.deleteRequested);
    const allPIRReports = reports.filter(r => r.reportType === 'PIR');

    // Helper: Menentukan apakah Laporan CM memerlukan SLA/SLG
    // Jika jenis penanganan adalah Pergantian Sparepart -> TIDAK DIBUATKAN SLA/SLG
    // Jika bukan pergantian sparepart (Troubleshoot Gangguan) -> WAJIB DIBUATKAN SLA/SLG
    const isCMRequiringSLA = (cm: CorrectiveReport): boolean => {
        // 1. Cek field eksplisit dari Form CM
        if (cm.troubleshootType === 'sparepart_replacement' || cm.isSparepartReplacement === true) {
            return false;
        }
        if (cm.troubleshootType === 'non_sparepart' || cm.isSparepartReplacement === false) {
            return true;
        }
        // 2. Fallback untuk data lama: Cek apakah ada daftar sparepart yang diisi (bukan '-')
        if (cm.spareparts && Array.isArray(cm.spareparts)) {
            const hasRealSpareparts = cm.spareparts.some((s: any) => s && s.name && s.name !== '-' && s.name.trim() !== '');
            if (hasRealSpareparts) return false;
        }
        // 3. Fallback kata kunci pada judul / tindakan
        const textCheck = `${cm.incidentName || ''} ${cm.equipmentName || ''} ${cm.issue || ''} ${cm.correctiveAction || ''}`.toLowerCase();
        if (textCheck.includes('pergantian sparepart') || textCheck.includes('penggantian sparepart') || textCheck.includes('ganti sparepart')) {
            return false;
        }
        return true;
    };

    const matchedCMIds = buildCMSLAMapping(
        allCMReports.filter(cm => !cm.deleteRequested),
        allSLAReports
    );

    // Hanya CM yang WAJIB SLA (bukan pergantian sparepart) dan belum punya SLA yang masuk antrean
    const cmRequiringSLAReports = allCMReports.filter(cm => !cm.deleteRequested && isCMRequiringSLA(cm));
    const unlinkedCMReports = cmRequiringSLAReports.filter(cm => cm.id && !matchedCMIds.has(cm.id));

    // ===== DEBUG: Temporary logging =====
    if (allCMReports.length > 0 && allSLAReports.length > 0) {
        console.group('🔍 DEBUG: CM vs SLA Matching (1-to-1)');
        console.log(`Total CM: ${allCMReports.filter(c => !c.deleteRequested).length}, Total SLA: ${allSLAReports.length}, Matched: ${matchedCMIds.size}, Wajib SLA: ${cmRequiringSLAReports.length}, Unlinked (Belum Ada SLA): ${unlinkedCMReports.length}`);
        console.log('--- UNLINKED CMs (Belum Ada SLA) ---');
        unlinkedCMReports.forEach(cm => {
            console.log(`CM [${cm.id?.slice(0, 8)}]: date=${getDateKey(cm)} | "${cm.incidentName || cm.equipmentName || ''}"`);
        });
        console.groupEnd();
    }
    // ===== END DEBUG =====

    // Period-filtered pending CMs (based on active Month & Year filter)
    const periodFilteredUnlinkedCMReports = unlinkedCMReports.filter((cm) => {
        if (selectedMonth === 'all' && selectedYear === 'all') return true;
        const reportTimestamp = getReportIncidentTime(cm);
        if (reportTimestamp > 0) {
            const reportDate = new Date(reportTimestamp);
            if (selectedMonth !== 'all' && reportDate.getMonth().toString() !== selectedMonth) {
                return false;
            }
            if (selectedYear !== 'all' && reportDate.getFullYear().toString() !== selectedYear) {
                return false;
            }
        }
        return true;
    });

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
                ? [{ name: rawRequestSpareparts.trim(), brand: '-', qty: '1 Pcs' }]
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

            spareparts: spareList,
            requestSpareparts: requestSpareList,
            photos: photoList,

            authorName: report.authorName || report.reportedByEmail || 'Standby Engineer',
            preparedByName: normalizeEngineerName(report.preparedByName),
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
                                                {selectedMonth !== 'all' || selectedYear !== 'all' ? (
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
                                    className="w-full sm:w-auto px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition shadow-sm cursor-pointer"
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
                                    className="w-full sm:w-auto px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition shadow-sm cursor-pointer"
                                >
                                    <option value="all">Semua Tahun</option>
                                    {['2024', '2025', '2026', '2027', '2028', '2029', '2030'].map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>

                                <select
                                    value={adminDeleteFilter}
                                    onChange={(e) => setAdminDeleteFilter(e.target.value as 'all' | 'pending_delete')}
                                    title="Filter Status Approval"
                                    aria-label="Filter Status Approval"
                                    className={`w-full sm:w-auto px-3.5 py-2.5 rounded-xl text-sm font-semibold outline-none transition cursor-pointer shadow-sm border ${adminDeleteFilter === 'pending_delete'
                                            ? 'bg-amber-50 border-amber-300 text-amber-900 focus:ring-2 focus:ring-amber-500'
                                            : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-red-500'
                                        }`}
                                >
                                    <option value="all">Semua Status</option>
                                    <option value="pending_delete">Menunggu Approval Hapus ({reports.filter(r => r.deleteRequested).length})</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
                                {isAuthorizedRole && (
                                    <button
                                        type="button"
                                        onClick={() => handleOpenForm(archiveFolder)}
                                        className="w-full md:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-md shadow-red-500/10 cursor-pointer text-xs shrink-0"
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
                                        onClick={async () => {
                                            const slaReports = filteredReports.filter(r => r.reportType === 'SLA' && !r.deleteRequested);
                                            if (slaReports.length === 0) {
                                                toast.error('Tidak ada laporan SLA valid (non-pengajuan hapus) yang sesuai filter untuk direkap.');
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
                                        className="w-full md:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 cursor-pointer text-xs shrink-0"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Export Rekap SLA (DOCX)
                                    </button>
                                )}
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

                                                <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                                                    {isAuthorizedRole && (
                                                        <button
                                                            onClick={() => handleOpenForm('pir', report.id)}
                                                            className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                                                            title="Edit Laporan PIR"
                                                        >
                                                            <PenTool className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {isAuthorizedRole && (
                                                        <button
                                                            onClick={() => handleDeleteClick(report)}
                                                            className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 border text-xs font-semibold ${report.deleteRequested
                                                                    ? isAdmin
                                                                        ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 shadow-sm animate-pulse'
                                                                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                                    : 'bg-red-50 text-red-600 rounded-xl hover:bg-red-100 border border-red-200'
                                                                }`}
                                                            title={
                                                                report.deleteRequested
                                                                    ? isAdmin
                                                                        ? 'Tinjau Pengajuan Hapus Dokumen'
                                                                        : 'Menunggu Persetujuan Hapus Admin (Klik untuk batalkan pengajuan)'
                                                                    : isAdmin
                                                                        ? 'Hapus Laporan Permanen'
                                                                        : 'Ajukan Hapus Laporan ke Admin'
                                                            }
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            {report.deleteRequested && (
                                                                <span className="text-[11px] font-bold">
                                                                    {isAdmin ? 'Tinjau Hapus' : 'Menunggu Approval'}
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
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700/50 pb-4 mb-4">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-black shadow-xs">
                                                        #{filteredReports.length - index}
                                                    </span>
                                                    <div className="px-2.5 py-1 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-bold text-red-600 uppercase tracking-wider">
                                                        SLA / SLG
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                                        <span>{(report as any).timeOrder ? new Date((report as any).timeOrder).toLocaleDateString() : (report.reportedAt?.toDate?.()?.toLocaleDateString() || '-')}</span>
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
                                                        className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 rounded-xl flex items-center gap-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
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
                                                        className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 rounded-xl flex items-center gap-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
                                                        title="Export to Word (DOCX)"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        Word SLA
                                                    </button>

                                                    {isAuthorizedRole && (
                                                        <button
                                                            onClick={() => handleOpenForm('sla', report.id)}
                                                            className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                                                            title="Edit Laporan SLA"
                                                        >
                                                            <PenTool className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {isAuthorizedRole && (
                                                        <button
                                                            onClick={() => handleDeleteClick(report)}
                                                            className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 border text-xs font-semibold ${report.deleteRequested
                                                                    ? isAdmin
                                                                        ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 shadow-sm animate-pulse'
                                                                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                                    : 'bg-red-50 text-red-600 rounded-xl hover:bg-red-100 border border-red-200'
                                                                }`}
                                                            title={
                                                                report.deleteRequested
                                                                    ? isAdmin
                                                                        ? 'Tinjau Pengajuan Hapus Dokumen'
                                                                        : 'Menunggu Persetujuan Hapus Admin (Klik untuk batalkan pengajuan)'
                                                                    : isAdmin
                                                                        ? 'Hapus Laporan Permanen'
                                                                        : 'Ajukan Hapus Laporan ke Admin'
                                                            }
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            {report.deleteRequested && (
                                                                <span className="text-[11px] font-bold">
                                                                    {isAdmin ? 'Tinjau Hapus' : 'Menunggu Approval'}
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
                                                                const requiresSLA = isCMRequiringSLA(report);
                                                                if (!requiresSLA) {
                                                                    return (
                                                                        <span
                                                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                                                                            title="Jenis penanganan: Pergantian Sparepart (Tidak dibuatkan form SLA/SLG)"
                                                                        >
                                                                            <Wrench className="w-3 h-3 text-blue-600" />
                                                                            Pergantian Sparepart (Tanpa SLA)
                                                                        </span>
                                                                    );
                                                                }

                                                                const hasSLA = report.id ? matchedCMIds.has(report.id) : false;
                                                                if (hasSLA) {
                                                                    return (
                                                                        <span
                                                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                            title="SLA sudah terbit"
                                                                        >
                                                                            <Check className="w-3 h-3 text-emerald-600" />
                                                                            SLA Terbit
                                                                        </span>
                                                                    );
                                                                }
                                                                return (
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

                                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                                                        <button
                                                            onClick={() => handleExportSingleCMDocx(report)}
                                                            className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 rounded-xl flex items-center gap-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
                                                            title="Export to Word (DOCX)"
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                            Word CM
                                                        </button>

                                                        {isAuthorizedRole && (
                                                            <button
                                                                onClick={() => handleOpenForm('cm_pdf', report.id)}
                                                                className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                                                                title="Edit Laporan CM"
                                                            >
                                                                <PenTool className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {isAuthorizedRole && (
                                                            <button
                                                                onClick={() => handleDeleteClick(report)}
                                                                className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 border text-xs font-semibold ${report.deleteRequested
                                                                        ? isAdmin
                                                                            ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 shadow-sm animate-pulse'
                                                                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                                        : 'bg-red-50 text-red-600 rounded-xl hover:bg-red-100 border border-red-200'
                                                                    }`}
                                                                title={
                                                                    report.deleteRequested
                                                                        ? isAdmin
                                                                            ? 'Tinjau Pengajuan Hapus Dokumen'
                                                                            : 'Menunggu Persetujuan Hapus Admin (Klik untuk batalkan pengajuan)'
                                                                        : isAdmin
                                                                            ? 'Hapus Laporan Permanen'
                                                                            : 'Ajukan Hapus Laporan ke Admin'
                                                                }
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                                {report.deleteRequested && (
                                                                    <span className="text-[11px] font-bold">
                                                                        {isAdmin ? 'Tinjau Hapus' : 'Menunggu Approval'}
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
                onRejectRequest={isAdmin ? rejectDeleteRequest : () => cancelDeleteRequest()}
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
                isAdmin={isAdmin}
                requireReason={!isAdmin}
            />
        </div>
    );
}
