// ============================================================================
// FILE: FileManagement.tsx
// Deskripsi: Modul Manajemen Berkas Dokumen (Cloud Storage & Firestore Repository).
//            Mengelola pengunggahan berkas PDF/Excel berukuran besar dengan fitur chunking otomatis
//            ke Firestore (menghindari batas batas ukuran dokumen 1MB Firestore),
//            penyaringan kategori per divisi (PMO, Sales, Presales, Purchasing, HSE),
//            serta sistem pengunduhan aman dan konfirmasi hapus data.
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Upload,
    Search,
    Filter,
    Download,
    Trash2,
    X,
    Loader2,
    ChevronLeft,
    FileText,
    FolderDown,
    Sparkles,
    AlertTriangle,
    RotateCcw,
    CheckCircle2,
    Send,
    Check,
    Ban
} from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { db } from '@/api/firebase';
import {
    collection,
    addDoc,
    setDoc,
    query,
    orderBy,
    onSnapshot,
    updateDoc,
    doc,
    deleteDoc,
    serverTimestamp,
    getDocs,
    writeBatch,
    deleteField
} from 'firebase/firestore';
import { exportSLAReportToExcel } from '@/utils/excelExport';
import { generateCMReportPDF } from '@/utils/CMReportPdfExport';
import { generatePIRReportPDF } from '@/utils/PIRReportPdfExport';
import { exportCMReportToDocx, exportSLAReportToDocx, exportPIRReportToDocx, exportSLAMonthlyRecapToDocx } from '@/utils/docxReportExport';
import { sendFileNotification } from '@/utils/notificationService';
import { useAuth } from './AuthContext';

const YellowFolderIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.5 7C2.5 5.61929 3.61929 4.5 5 4.5H9.17157C9.83464 4.5 10.4705 4.76339 10.9393 5.23223L12.4142 6.70711C12.5549 6.84776 12.7456 6.92678 12.9445 6.92678H19C20.3807 6.92678 21.5 8.04607 21.5 9.42678V17C21.5 18.3807 20.3807 19.5 19 19.5H5C3.61929 19.5 2.5 18.3807 2.5 17V7Z" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
        <path d="M2.5 9.5H21.5V17C21.5 18.3807 20.3807 19.5 19 19.5H5C3.61929 19.5 2.5 18.3807 2.5 17V9.5Z" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
    </svg>
);

const FILE_CATEGORIES = [
    'Laporan Harian',
    'Laporan Bulanan',
    'Checklist Alat',
    'Checklist APD',
    'JSEA',
    'MOP',
    'Risk Register',
    'D-DAY',
    'Report CM',
    'Form SLA/SLG',
    'Report PIR',
    'SLA/SLG',
    'SLD',
    'Layout',
    'Service Report',
    'Service Report Approved',
    'Predictive Report',
    'Custom',
    'Monthly'
];

const ENGINEER_CATEGORIES = ['MOP', 'Risk Register', 'D-DAY'];

const MAINTENANCE_TYPES = [
    'Water Leak Detector',
    'Cooling Tower Water Treatment',
    'Cooling Tower',
    'FCU',
    'Lift Units',
    'Dock Leveler',
    'Door',
    'Rolling Door',
    'Lobby Door',
    'Fuel Leak',
    'Fuel System',
    'Fuel Tank',
    'PJU',
    'Hydrant System',
    'Gate',
    'STP & Plumbing',
    'Exhaust Fan',
    'Capacitor Bank',
    'AHU',
    'UPS',
    'CRAC Data Hall & Supporting Room',
    'Chiller',
    'ATS',
    'Cooling pump',
    'Transformer / Trafo',
    'Generator',
    'MV Panel',
    'RMU Panel',
    'LV Panel',
    'PDU Panel',
    'FSS',
    'Pre-Action System',
    'Lighting Point',
    'Grounding System',
    'Lightning Protection System',
    'VRV',
    'AC Splits',
    'Panel LDB & RDB (Distribution)',
    'Road Blocker',
    'X-Ray',
    'Pressurization & Degassing',
    'Pumps',
    'Water Softener',
    'Busduct',
    'Physical Cooling Automation',
    'Load Bank'
];

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'];
const ALLOWED_EXTENSIONS = [
    '.pdf',
    '.xlsx',
    '.xls',
    '.docx',
    '.doc',
    '.pptx',
    '.ppt',
    '.dwg',
    '.dxf',
    '.vsd',
    '.vsdx',
    '.csv',
    '.zip',
    '.rar',
    '.7z',
    '.txt',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.svg',
    '.bmp',
];

const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/vnd.dwg',
    'application/acad',
    'application/x-dwg',
    'application/dxf',
    'application/vnd.visio',
    'application/x-visio',
    'application/vnd.ms-visio.drawing',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
];

export const isAllowedFile = (file: File): boolean => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) return true;
    if (file.type && ALLOWED_FILE_TYPES.includes(file.type)) return true;
    if (file.type && (file.type.startsWith('image/') || file.type.startsWith('text/') || file.type.includes('presentation') || file.type.includes('drawing') || file.type.includes('dwg'))) return true;
    return false;
};

export const getFileMime = (file: File): string => {
    if (file.type && file.type !== 'application/octet-stream') return file.type;
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    switch (ext) {
        case '.pdf': return 'application/pdf';
        case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case '.xls': return 'application/vnd.ms-excel';
        case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case '.doc': return 'application/msword';
        case '.pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        case '.ppt': return 'application/vnd.ms-powerpoint';
        case '.dwg': return 'image/vnd.dwg';
        case '.dxf': return 'application/dxf';
        case '.vsd':
        case '.vsdx': return 'application/vnd.visio';
        case '.csv': return 'text/csv';
        case '.txt': return 'text/plain';
        case '.zip': return 'application/zip';
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.webp': return 'image/webp';
        case '.svg': return 'image/svg+xml';
        default: return file.type || 'application/pdf';
    }
};

export const formatFileSize = (bytes: number) => {
    if (!bytes || bytes < 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

export const getFileIcon = (fileType: string) => {
    const ft = (fileType || '').toLowerCase();
    if (ft.includes('pdf')) return '📄';
    if (ft.includes('sheet') || ft.includes('excel') || ft.includes('csv')) return '📊';
    if (ft.includes('presentation') || ft.includes('powerpoint') || ft.includes('ppt')) return '📽️';
    if (ft.includes('word') || ft.includes('document') || ft.includes('doc')) return '📝';
    if (ft.includes('dwg') || ft.includes('cad') || ft.includes('drawing') || ft.includes('dxf') || ft.includes('visio')) return '📐';
    if (ft.includes('image') || ft.includes('png') || ft.includes('jpeg') || ft.includes('jpg') || ft.includes('webp') || ft.includes('svg')) return '🖼️';
    if (ft.includes('zip') || ft.includes('rar') || ft.includes('7z') || ft.includes('tar') || ft.includes('compressed')) return '📦';
    return '📁';
};

const MAX_FILE_SIZE = 60 * 1024 * 1024;
const CHUNK_SIZE = 450 * 1024; // 450KB binary (~600KB base64), strictly within Firestore 1MB document limit

export interface ParsedFileMetadata {
    category?: string;
    maintenanceType?: string;
    quarter?: string;
    year?: string;
}

/**
 * Otomatis mendeteksi Kategori, Tipe Maintenance/Peralatan, Quarter, dan Tahun
 * langsung dari nama berkas (misal: "JSEA - PM - AHU - Q3 - 2026.pdf").
 */
export function parseFilenameMetadata(filename: string): ParsedFileMetadata {
    const cleanName = filename.replace(/\.[^/.]+$/, '').trim();
    const result: ParsedFileMetadata = {};

    // 1. Deteksi Quarter (misal: Q1, Q2, Q3, Q4, Quarter 1, Q-3, Q_3)
    const quarterMatch = cleanName.match(/\b(?:Q|QUARTER)[\s_-]*([1-4])\b/i);
    if (quarterMatch) {
        result.quarter = `Q${quarterMatch[1]}`;
    }

    // 2. Deteksi Tahun (misal: 2024 s/d 2035)
    const yearMatch = cleanName.match(/\b(202[0-9]|203[0-9])\b/);
    if (yearMatch) {
        result.year = yearMatch[1];
    }

    // 3. Deteksi Kategori Dokumen
    if (/\b(?:LAYOUT|DENAH)\b/i.test(cleanName)) {
        result.category = 'Layout';
    } else if (/\b(?:PREDICTIVE[\s_-]*REPORT|PREDICTIVE)\b/i.test(cleanName)) {
        result.category = 'Predictive Report';
    } else if (/\b(?:JSEA|JSA)\b/i.test(cleanName)) {
        result.category = 'JSEA';
    } else if (/\b(?:MOP|SOP)\b/i.test(cleanName)) {
        result.category = 'MOP';
    } else if (/\bPTW\b/i.test(cleanName)) {
        result.category = 'PTW';
    } else if (/\bRISK[\s_-]*REGISTER\b/i.test(cleanName)) {
        result.category = 'Risk Register';
    } else if (/\bD[\s_-]*DAY\b/i.test(cleanName)) {
        result.category = 'D-DAY';
    } else if (/\bSERVICE[\s_-]*REPORT[\s_-]*APPROVED\b/i.test(cleanName)) {
        result.category = 'Service Report Approved';
    } else if (/\bSERVICE[\s_-]*REPORT\b/i.test(cleanName)) {
        result.category = 'Service Report';
    } else if (/\bREPORT[\s_-]*PIR\b|\bPIR\b/i.test(cleanName)) {
        result.category = 'Report PIR';
    } else if (/\bREPORT[\s_-]*CM\b/i.test(cleanName)) {
        result.category = 'Report CM';
    } else if (/\b(?:FORM[\s_-]*SLA|SLA[\s/_-]*SLG)\b/i.test(cleanName)) {
        result.category = 'Form SLA/SLG';
    } else if (/\bSLD\b/i.test(cleanName)) {
        result.category = 'SLD';
    } else if (/\bCHECKLIST[\s_-]*APD\b/i.test(cleanName)) {
        result.category = 'Checklist APD';
    } else if (/\bCHECKLIST[\s_-]*ALAT\b/i.test(cleanName)) {
        result.category = 'Checklist Alat';
    } else if (/\bLAPORAN[\s_-]*HARIAN\b/i.test(cleanName)) {
        result.category = 'Laporan Harian';
    } else if (/\bLAPORAN[\s_-]*BULANAN\b|\bMONTHLY\b/i.test(cleanName)) {
        result.category = 'Laporan Bulanan';
    }

    // 4. Deteksi Tipe Maintenance / Peralatan (AHU, Chiller, Trafo, dll)
    const sortedTypes = [...MAINTENANCE_TYPES].sort((a, b) => b.length - a.length);

    for (const mType of sortedTypes) {
        const pattern = mType
            .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
            .replace(/\\\s\+?|\\\/\+?|\\&/g, '[\\s/_&\\-]+');
        const regex = new RegExp(`\\b${pattern}\\b`, 'i');
        if (regex.test(cleanName)) {
            result.maintenanceType = mType;
            break;
        }
    }

    // Alias / Singkatan Nama Peralatan
    if (!result.maintenanceType) {
        if (/\b(?:TRAFO|TRANSFORMATOR)\b/i.test(cleanName)) {
            result.maintenanceType = 'Transformer / Trafo';
        } else if (/\b(?:GENSET|GEN[-_ ]?SET)\b/i.test(cleanName)) {
            result.maintenanceType = 'Generator';
        } else if (/\b(?:WLD|WATER[\s_-]*LEAK)\b/i.test(cleanName)) {
            result.maintenanceType = 'Water Leak Detector';
        } else if (/\b(?:CRAC|PAC)\b/i.test(cleanName)) {
            result.maintenanceType = 'CRAC Data Hall & Supporting Room';
        } else if (/\b(?:CAPACITOR)\b/i.test(cleanName)) {
            result.maintenanceType = 'Capacitor Bank';
        } else if (/\b(?:LIGHTNING|PENANGKAL[\s_-]*PETIR)\b/i.test(cleanName)) {
            result.maintenanceType = 'Lightning Protection System';
        } else if (/\b(?:GROUNDING)\b/i.test(cleanName)) {
            result.maintenanceType = 'Grounding System';
        } else if (/\b(?:PRE[\s_-]*ACTION)\b/i.test(cleanName)) {
            result.maintenanceType = 'Pre-Action System';
        } else if (/\b(?:PDU)\b/i.test(cleanName)) {
            result.maintenanceType = 'PDU Panel';
        } else if (/\b(?:LDB|RDB)\b/i.test(cleanName)) {
            result.maintenanceType = 'Panel LDB & RDB (Distribution)';
        } else if (/\b(?:MV[\s_-]*PANEL|MV)\b/i.test(cleanName) && !/\bRMU\b/i.test(cleanName)) {
            result.maintenanceType = 'MV Panel';
        } else if (/\b(?:LV[\s_-]*PANEL|LV)\b/i.test(cleanName)) {
            result.maintenanceType = 'LV Panel';
        } else if (/\b(?:RMU[\s_-]*PANEL|RMU)\b/i.test(cleanName)) {
            result.maintenanceType = 'RMU Panel';
        } else if (/\b(?:AC[\s_-]*SPLIT|SPLIT)\b/i.test(cleanName)) {
            result.maintenanceType = 'AC Splits';
        } else if (/\b(?:STP|PLUMBING)\b/i.test(cleanName)) {
            result.maintenanceType = 'STP & Plumbing';
        } else if (/\b(?:PJU)\b/i.test(cleanName)) {
            result.maintenanceType = 'PJU';
        }
    }

    return result;
}

interface FileData {
    id: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    category: string;
    quarter?: string;
    year?: string;
    customCategory?: string;
    uploadedBy: string;
    uploadedByEmail: string;
    uploadedAt: any;
    description?: string;
    totalChunks: number;
    maintenanceType?: string;
    isCorrectiveReport?: boolean;
    reportType?: string;
    originalReport?: any;
    deleteRequested?: boolean;
    deleteRequestedBy?: string;
    deleteRequestedTo?: string;
    deleteRequestedAt?: any;
    deleteReason?: string;
}

interface FileManagementProps {
    collectionName?: string;
    allowUpload?: boolean;
    divisionName?: string;
    simpleMode?: boolean;
    initialFolder?: string | null;
    onBackToRoot?: () => void;
    initialSearchQuery?: string;
    deleteRequestMode?: boolean;
}

export function FileManagement({
    collectionName = 'files',
    allowUpload: propAllowUpload,
    divisionName,
    simpleMode = false,
    initialFolder = null,
    onBackToRoot,
    initialSearchQuery = '',
    deleteRequestMode = false,
}: FileManagementProps = {}) {
    const { user, userRole } = useAuth();
    const userEmailLower = (user?.email || '').toLowerCase();
    const isQcDme = userRole === 'qc_dme' || userEmailLower.includes('qcdme') || userEmailLower.includes('qc_dme') || userEmailLower === 'qcdme@dme.com' || userEmailLower === 'qc@gmail.com';
    const isAdmin = userRole === 'admin' || isQcDme;
    const canUpload = propAllowUpload !== undefined
        ? propAllowUpload
        : (isAdmin || (collectionName !== 'files' && userRole === collectionName));
    // Semua role authenticated berhak mengajukan permohonan hapus berkas ke qcdme@dme.com (hanya QC DME yang berhak approve & hapus permanen)
    const canDeleteOrRequest = Boolean(user);
    const isEngineer = userRole === 'engineer' || userRole === 'standby_engineer';

    useEffect(() => {
        if (isEngineer && !simpleMode) {
            setSelectedCategory('MOP');
        }
    }, [isEngineer, simpleMode]);


    const [files, setFiles] = useState<FileData[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [selectedCategory, setSelectedCategory] = useState(simpleMode ? 'Dokumen' : 'Laporan Harian');
    const [selectedMaintenance, setSelectedMaintenance] = useState(MAINTENANCE_TYPES[0]);
    const [customCategory, setCustomCategory] = useState('');
    const [description, setDescription] = useState('');
    const [selectedUploadQuarter, setSelectedUploadQuarter] = useState('Q1');
    const [selectedUploadYear, setSelectedUploadYear] = useState(new Date().getFullYear().toString());
    const [forceSelectedMetadata, setForceSelectedMetadata] = useState(true);
    const [failedUploads, setFailedUploads] = useState<{ file: File; error: string }[]>([]);

    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const [filterCategory, setFilterCategory] = useState(deleteRequestMode ? 'PENDING_DELETE' : 'All');
    const [filterYear, setFilterYear] = useState('All');
    const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolder);
    const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
    const [selectedMType, setSelectedMType] = useState<string | null>(null);
    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

    useEffect(() => {
        if (deleteRequestMode) {
            setFilterCategory('PENDING_DELETE');
            setSelectedFolder(null);
            setSelectedQuarter(null);
            setSelectedMType(null);
        }
    }, [deleteRequestMode]);

    useEffect(() => {
        setSelectedFolder(initialFolder || null);
        setSelectedQuarter(null);
        setSelectedMType(null);
    }, [initialFolder]);

    // Sinkronisasi pilihan form upload saat membuka folder tertentu
    useEffect(() => {
        if (selectedFolder && FILE_CATEGORIES.includes(selectedFolder)) {
            setSelectedCategory(selectedFolder);
        }
        if (selectedQuarter && QUARTERS.includes(selectedQuarter)) {
            setSelectedUploadQuarter(selectedQuarter);
        }
        if (selectedMType && MAINTENANCE_TYPES.includes(selectedMType)) {
            setSelectedMaintenance(selectedMType);
        }
    }, [selectedFolder, selectedQuarter, selectedMType]);

    useEffect(() => {
        if (initialSearchQuery) {
            setSearchQuery(initialSearchQuery);
            setSelectedFolder(null);
            setSelectedQuarter(null);
            setSelectedMType(null);
        }
    }, [initialSearchQuery]);

    const folderCardRef = useRef<HTMLDivElement>(null);

    const scrollToFolder = (isRoot = false) => {
        if (isRoot && !initialFolder) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        setTimeout(() => {
            if (folderCardRef.current) {
                const navOffset = 80;
                const elementPosition = folderCardRef.current.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - navOffset;
                window.scrollTo({
                    top: Math.max(0, offsetPosition),
                    behavior: 'smooth',
                });
            }
        }, 50);
    };

    useEffect(() => {
        scrollToFolder(selectedFolder === null);
    }, [selectedFolder, selectedQuarter, selectedMType]);

    const matchCategory = (fCategory: string, targetFolder: string | null) => {
        if (!targetFolder) return true;
        if (!fCategory) return false;
        if (fCategory.trim().toLowerCase() === targetFolder.trim().toLowerCase()) return true;
        if (fCategory === targetFolder) return true;
        if ((targetFolder === 'Form SLA/SLG' || targetFolder === 'SLA/SLG') && (fCategory === 'Form SLA/SLG' || fCategory === 'SLA/SLG')) return true;
        if (targetFolder === 'Report CM, SLA & PIR' && (fCategory === 'Report CM' || fCategory === 'Form SLA/SLG' || fCategory === 'SLA/SLG' || fCategory === 'Report PIR')) return true;
        return false;
    };

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<FileData | null>(null);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteModalMode, setDeleteModalMode] = useState<'request_delete' | 'review_request' | 'direct_delete' | 'cancel_request'>('request_delete');
    const [showAllInFolder, setShowAllInFolder] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [uploadedFilesCount, setUploadedFilesCount] = useState(0);

    useEffect(() => {
        if (!user) {
            setFiles([]);
            setLoading(false);
            return;
        }

        let isoFiles: FileData[] = [];
        let correctiveFiles: FileData[] = [];

        const updateAllFiles = () => {
            setFiles([...isoFiles, ...correctiveFiles]);
            setLoading(false);
        };

        const qISO = query(collection(db, collectionName));
        const unsubscribeISO = onSnapshot(
            qISO,
            (snapshot) => {
                isoFiles = snapshot.docs
                    .map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }))
                    .filter((file: any) => file.status !== 'uploading')
                    .sort((a: any, b: any) => {
                        const getMillis = (val: any) => {
                            if (!val) return Date.now();
                            if (typeof val.toMillis === 'function') return val.toMillis();
                            if (val.seconds) return val.seconds * 1000;
                            if (val instanceof Date) return val.getTime();
                            return Date.now();
                        };
                        return getMillis(b.uploadedAt) - getMillis(a.uploadedAt);
                    }) as FileData[];
                updateAllFiles();
            },
            (error: any) => {
                console.error('Error loading files:', error);
                if (error?.code !== 'permission-denied') {
                    toast.error('Gagal memuat file');
                }
                setLoading(false);
            }
        );

        const qCorrective = query(collection(db, 'corrective_reports'), orderBy('reportedAt', 'desc'));
        const unsubscribeCorrective = onSnapshot(
            qCorrective,
            (snapshot) => {
                correctiveFiles = snapshot.docs.map((docSnap) => {
                    const report = docSnap.data();
                    const isSLA = report.reportType === 'SLA';
                    const isPIR = report.reportType === 'PIR';
                    const repDate = report.reportedAt?.toDate ? report.reportedAt.toDate() : (report.reportedAt ? new Date(report.reportedAt) : new Date());
                    const qtr = report.quarter || `Q${Math.floor(repDate.getMonth() / 3) + 1}`;
                    const yr = report.year || repDate.getFullYear().toString();

                    let catName = 'Report CM';
                    let fileNameStr = report.incidentName || report.issue || 'Report CM PDF';
                    let fType = 'application/pdf';

                    if (isSLA) {
                        catName = 'Form SLA/SLG';
                        fileNameStr = report.ticketName || report.issue || 'Form SLA/SLG';
                        fType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    } else if (isPIR) {
                        catName = 'Report PIR';
                        fileNameStr = report.incidentName ? `Report PIR (${report.incidentName})` : 'Report PIR PDF';
                        fType = 'application/pdf';
                    }

                    return {
                        id: `cm_${docSnap.id}`,
                        fileName: fileNameStr,
                        fileSize: 1024,
                        fileType: fType,
                        category: catName,
                        quarter: qtr,
                        year: yr,
                        uploadedBy: report.reportedBy || '',
                        uploadedByEmail: report.reportedByEmail || 'Standby Engineer',
                        uploadedAt: report.reportedAt || report.createdAt,
                        totalChunks: 1,
                        isCorrectiveReport: true,
                        reportType: report.reportType || 'CM_PDF',
                        originalReport: { id: docSnap.id, ...report },
                        deleteRequested: report.deleteRequested || false,
                        deleteRequestedBy: report.deleteRequestedBy || '',
                        deleteRequestedTo: report.deleteRequestedTo || '',
                        deleteRequestedAt: report.deleteRequestedAt || null,
                        deleteReason: report.deleteReason || ''
                    } as FileData;
                });
                updateAllFiles();
            },
            (error: any) => {
                console.error('Error loading corrective reports for file manager:', error);
            }
        );

        return () => {
            unsubscribeISO();
            unsubscribeCorrective();
        };
    }, [user, collectionName]);

    const chunkToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.includes(',') ? result.split(',')[1] : result;
                resolve(base64);
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(blob);
        });
    };

    const retryOperation = async <T,>(
        operation: () => Promise<T>,
        maxRetries = 3,
        delayMs = 1200
    ): Promise<T> => {
        let lastError: any;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (err: any) {
                lastError = err;
                if (attempt < maxRetries - 1) {
                    const waitTime = delayMs * Math.pow(1.8, attempt);
                    console.warn(`[FileManagement] Retry ${attempt + 1}/${maxRetries} after error:`, err?.message || err, `Waiting ${waitTime}ms...`);
                    await new Promise(res => setTimeout(res, waitTime));
                }
            }
        }
        throw lastError;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const validFiles: File[] = [];
            let skippedOversized = 0;
            let skippedUnsupported = 0;

            newFiles.forEach(file => {
                if (file.size > MAX_FILE_SIZE) {
                    skippedOversized++;
                    return;
                }
                if (!isAllowedFile(file)) {
                    skippedUnsupported++;
                    return;
                }
                validFiles.push(file);
            });

            if (skippedOversized > 0 || skippedUnsupported > 0) {
                const reasons: string[] = [];
                if (skippedOversized > 0) reasons.push(`${skippedOversized} file > 60MB`);
                if (skippedUnsupported > 0) reasons.push(`${skippedUnsupported} format tidak didukung`);
                toast.warning(`${skippedOversized + skippedUnsupported} berkas dilewati (${reasons.join(', ')})`);
            }

            if (validFiles.length > 0) {
                // Auto-detect metadata dari berkas pertama untuk otomatis mengisi pilihan form
                const firstParsed = parseFilenameMetadata(validFiles[0].name);
                const detectedParts: string[] = [];

                if (firstParsed.category && !simpleMode) {
                    setSelectedCategory(firstParsed.category);
                    detectedParts.push(`Kategori: ${firstParsed.category}`);
                }
                if (firstParsed.maintenanceType) {
                    setSelectedMaintenance(firstParsed.maintenanceType);
                    detectedParts.push(`Tipe: ${firstParsed.maintenanceType}`);
                }
                if (firstParsed.quarter) {
                    setSelectedUploadQuarter(firstParsed.quarter);
                    detectedParts.push(`Quarter: ${firstParsed.quarter}`);
                }
                if (firstParsed.year) {
                    setSelectedUploadYear(firstParsed.year);
                    detectedParts.push(`Tahun: ${firstParsed.year}`);
                }

                if (detectedParts.length > 0) {
                    toast.success(`✨ Otomatis terdeteksi dari nama berkas: ${detectedParts.join(' | ')}`);
                }
            }

            setSelectedFiles(prev => [...prev, ...validFiles]);
            e.target.value = '';
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleRetryFailed = () => {
        const filesToRetry = failedUploads.map(f => f.file);
        setSelectedFiles(filesToRetry);
        setFailedUploads([]);
        setShowSuccessModal(false);
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0 || !user) return;

        const finalCategory =
            simpleMode ? 'Dokumen' : (selectedCategory === 'Custom' ? customCategory : selectedCategory);

        if (!finalCategory.trim()) {
            toast.error('Harap masukkan nama kategori');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            const totalOverallBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
            let uploadedOverallBytes = 0;
            let successCount = 0;
            const failedList: { file: File; error: string }[] = [];

            // Concurrency pool (memproses 3 file secara paralel untuk kecepatan & stabilitas)
            const CONCURRENT_FILES = 3;
            let fileIndex = 0;

            const uploadSingleFile = async (file: File) => {
                const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
                let fileDocRef: any = null;

                try {
                    // Ekstraksi metadata: prioritaskan pilihan form jika forceSelectedMetadata aktif
                    const parsed = parseFilenameMetadata(file.name);
                    const fileCategory = forceSelectedMetadata ? finalCategory : (parsed.category || finalCategory);
                    const fileMaintenance = (['MOP', 'JSEA', 'PTW', 'Risk Register', 'D-DAY', 'Service Report', 'Service Report Approved'].includes(fileCategory))
                        ? (forceSelectedMetadata ? selectedMaintenance : (parsed.maintenanceType || selectedMaintenance))
                        : null;
                    const fileQuarter = (fileCategory === 'SLD' || fileCategory === 'Layout')
                        ? 'N/A'
                        : (forceSelectedMetadata ? selectedUploadQuarter : (parsed.quarter || selectedUploadQuarter));
                    const fileYear = forceSelectedMetadata ? selectedUploadYear : (parsed.year || selectedUploadYear);
                    const resolvedMime = getFileMime(file);

                    // Step 1: Buat dokumen utama di Firestore dengan mekanisme retry
                    fileDocRef = await retryOperation(async () => {
                        return await addDoc(collection(db, collectionName), {
                            fileName: file.name,
                            fileSize: file.size,
                            fileType: resolvedMime,
                            category: fileCategory,
                            maintenanceType: fileMaintenance,
                            quarter: fileQuarter,
                            year: fileYear,
                            customCategory: (selectedCategory === 'Custom' && !parsed.category) ? customCategory : null,
                            uploadedBy: user.uid,
                            uploadedByEmail: (user.email || '').toLowerCase(),
                            uploadedAt: serverTimestamp(),
                            description: description || null,
                            totalChunks: totalChunks,
                            status: 'uploading'
                        });
                    }, 3, 1000);

                    // Step 2: Upload chunks paralel (2 chunk konkuen per file) dengan retry
                    const CHUNK_CONCURRENCY = 2;
                    for (let i = 0; i < totalChunks; i += CHUNK_CONCURRENCY) {
                        const batchPromises = [];
                        for (let c = i; c < Math.min(i + CHUNK_CONCURRENCY, totalChunks); c++) {
                            const start = c * CHUNK_SIZE;
                            const end = Math.min(start + CHUNK_SIZE, file.size);
                            const chunkBlob = file.slice(start, end);

                            batchPromises.push((async () => {
                                let chunkBase64 = await chunkToBase64(chunkBlob);
                                if (c === 0) {
                                    chunkBase64 = `data:${resolvedMime};base64,${chunkBase64}`;
                                }

                                const chunkRef = doc(db, collectionName, fileDocRef.id, 'chunks', `chunk_${String(c).padStart(4, '0')}`);
                                await retryOperation(async () => {
                                    await setDoc(chunkRef, {
                                        index: c,
                                        data: chunkBase64
                                    });
                                }, 3, 1200);

                                uploadedOverallBytes += (end - start);
                                setUploadProgress(Math.min(99, Math.round((uploadedOverallBytes / (totalOverallBytes || 1)) * 100)));
                            })());
                        }
                        await Promise.all(batchPromises);
                    }

                    // Step 3: Tandai dokumen sebagai selesai (completed) dengan retry
                    await retryOperation(async () => {
                        await updateDoc(doc(db, collectionName, fileDocRef.id), { status: 'completed' });
                    }, 3, 1000);

                    successCount++;
                } catch (fileErr: any) {
                    console.error(`Gagal upload file "${file.name}":`, fileErr);
                    // Bersihkan dokumen mangkrak 'uploading' dari Firestore jika sempat dibuat
                    if (fileDocRef?.id) {
                        try {
                            await deleteDoc(doc(db, collectionName, fileDocRef.id));
                        } catch (cleanErr) {
                            console.warn('Gagal membersihkan dokumen gagal:', cleanErr);
                        }
                    }
                    failedList.push({ file, error: fileErr?.message || 'Gagal menyimpan ke server' });
                }
            };

            // Jalankan worker pool
            const activeWorkers = Math.min(CONCURRENT_FILES, selectedFiles.length);
            const workers = Array.from({ length: activeWorkers }, async () => {
                while (fileIndex < selectedFiles.length) {
                    const currentFile = selectedFiles[fileIndex++];
                    await uploadSingleFile(currentFile);
                }
            });

            await Promise.all(workers);

            // Step 4: Kirim 1 notifikasi rangkuman batch (tidak membanjiri Firestore dengan 150 kali write)
            if (successCount > 0) {
                try {
                    await sendFileNotification({
                        title: `${successCount} Berkas Baru: ${finalCategory}`,
                        fileName: successCount === 1 ? selectedFiles[0].name : `${successCount} berkas baru (${finalCategory})`,
                        category: finalCategory,
                        uploadedBy: user?.email || 'User DME',
                        targetTab: 'files',
                        searchQuery: successCount === 1 ? selectedFiles[0].name : finalCategory
                    });
                } catch (notifErr) {
                    console.warn('Gagal mengirim ringkasan notifikasi:', notifErr);
                }
            }

            setUploadProgress(100);
            setUploadedFilesCount(successCount);
            setFailedUploads(failedList);
            setShowSuccessModal(true);

            if (failedList.length === 0) {
                setSelectedFiles([]);
                setSelectedCategory(simpleMode ? 'Dokumen' : 'Laporan Harian');
                setCustomCategory('');
                setDescription('');
                toast.success(`Seluruh ${successCount} file berhasil diunggah!`);
            } else {
                toast.warning(`${successCount} file berhasil, ${failedList.length} file gagal diunggah.`);
            }
            setUploading(false);
        } catch (error) {
            console.error('Error uploading files batch:', error);
            toast.error('Gagal mengunggah berkas');
            setUploading(false);
        }
    };

    // Dialog & Action Handlers untuk Pengajuan / Persetujuan Hapus Berkas
    const targetFileIds = fileToDelete ? [fileToDelete.id] : selectedFileIds;
    const targetFiles = files.filter(f => targetFileIds.includes(f.id));

    const openDeleteDialog = (file: FileData | null) => {
        setFileToDelete(file);
        setDeleteReason(file?.deleteReason || '');

        if (file) {
            if (file.deleteRequested) {
                if (isQcDme) {
                    setDeleteModalMode('review_request');
                } else {
                    setDeleteModalMode('cancel_request');
                }
            } else {
                if (isQcDme) {
                    setDeleteModalMode('direct_delete');
                } else {
                    setDeleteModalMode('request_delete');
                }
            }
        } else {
            // Aksi massal (bulk) berdasarkan file terpilih
            const selectedFilesData = files.filter(f => selectedFileIds.includes(f.id));
            const hasRequested = selectedFilesData.some(f => f.deleteRequested);

            if (isQcDme) {
                if (hasRequested) {
                    setDeleteModalMode('review_request');
                } else {
                    setDeleteModalMode('direct_delete');
                }
            } else {
                if (hasRequested && selectedFilesData.every(f => f.deleteRequested)) {
                    setDeleteModalMode('cancel_request');
                } else {
                    setDeleteModalMode('request_delete');
                }
            }
        }

        setDeleteModalOpen(true);
    };

    // 1. Eksekusi pengajuan hapus dari Admin ke qcdme@dme.com
    const handleRequestDelete = async () => {
        if (!canDeleteOrRequest) return;
        if (targetFileIds.length === 0) return;

        if (!deleteReason.trim()) {
            toast.error('Wajib mengisi alasan/remark pengajuan hapus ke QC DME!');
            return;
        }

        setIsBulkDeleting(true);
        const toastId = toast.loading(`Mengirim permohonan hapus ${targetFileIds.length} berkas ke QC DME (qcdme@dme.com)...`);

        try {
            for (const fileId of targetFileIds) {
                const updatePayload = {
                    deleteRequested: true,
                    deleteRequestedBy: user?.email || (userRole ? `${userRole}` : 'User'),
                    deleteRequestedRole: userRole || 'User',
                    deleteRequestedTo: 'qcdme@dme.com',
                    deleteReason: deleteReason.trim(),
                    deleteRequestedAt: serverTimestamp(),
                };

                if (fileId.startsWith('cm_')) {
                    const realDocId = fileId.replace('cm_', '');
                    await updateDoc(doc(db, 'corrective_reports', realDocId), updatePayload);
                } else {
                    await updateDoc(doc(db, collectionName, fileId), updatePayload);
                }
            }

            // Kirim notifikasi resmi ke koleksi notifications untuk QC DME
            const firstFile = targetFiles[0];
            const summaryName = targetFileIds.length === 1
                ? (firstFile?.fileName || 'Dokumen')
                : `${targetFileIds.length} Berkas (${targetFiles.map(f => f.fileName).slice(0, 3).join(', ')}${targetFileIds.length > 3 ? '...' : ''})`;

            await addDoc(collection(db, 'notifications'), {
                title: 'Pengajuan Hapus Berkas ke QC DME',
                fileName: summaryName,
                category: firstFile?.category || selectedFolder || 'Manajemen File',
                fileId: firstFile?.id || '',
                uploadedBy: user?.email || (userRole === 'admin' ? 'Admin' : 'User'),
                targetEmail: 'qcdme@dme.com',
                targetTab: 'files',
                searchQuery: firstFile?.fileName || '',
                reason: deleteReason.trim(),
                createdAt: serverTimestamp()
            });

            toast.success(`Pengajuan hapus ${targetFileIds.length} berkas berhasil dikirim ke QC DME (qcdme@dme.com). Menunggu persetujuan!`, { id: toastId });
            setDeleteModalOpen(false);
            setFileToDelete(null);
            setSelectedFileIds([]);
            setDeleteReason('');
        } catch (error: any) {
            console.error('Error submitting delete request:', error);
            toast.error('Gagal mengirim pengajuan hapus: ' + (error?.message || 'Terjadi kesalahan'), { id: toastId });
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // 2. Eksekusi penolakan pengajuan (oleh QC DME) atau pembatalan pengajuan (oleh Admin)
    const handleRejectOrCancelRequest = async () => {
        if (targetFileIds.length === 0) return;

        setIsBulkDeleting(true);
        const actionLabel = isQcDme ? 'Menolak pengajuan hapus...' : 'Membatalkan pengajuan hapus...';
        const toastId = toast.loading(actionLabel);

        try {
            for (const fileId of targetFileIds) {
                const updatePayload = {
                    deleteRequested: deleteField(),
                    deleteRequestedBy: deleteField(),
                    deleteRequestedTo: deleteField(),
                    deleteRequestedRole: deleteField(),
                    deleteReason: deleteField(),
                    deleteRequestedAt: deleteField(),
                };

                if (fileId.startsWith('cm_')) {
                    const realDocId = fileId.replace('cm_', '');
                    await updateDoc(doc(db, 'corrective_reports', realDocId), updatePayload);
                } else {
                    await updateDoc(doc(db, collectionName, fileId), updatePayload);
                }
            }

            if (isQcDme) {
                toast.success(`Pengajuan hapus ditolak. Berkas tetap tersimpan dengan aman di arsip.`, { id: toastId });
            } else {
                toast.success(`Pengajuan hapus berhasil dibatalkan. Berkas kembali ke status normal.`, { id: toastId });
            }

            setDeleteModalOpen(false);
            setFileToDelete(null);
            setSelectedFileIds([]);
            setDeleteReason('');
        } catch (error: any) {
            console.error('Error rejecting/cancelling delete request:', error);
            toast.error('Gagal memproses pembatalan: ' + (error?.message || 'Terjadi kesalahan'), { id: toastId });
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // 3. Eksekusi penghapusan permanen (oleh QC DME)
    const handlePermanentDelete = async () => {
        if (!isQcDme) {
            toast.error('Hanya akun QC DME (qcdme@dme.com) yang berwenang menghapus berkas secara permanen.');
            return;
        }
        if (targetFileIds.length === 0) return;

        setIsBulkDeleting(true);
        const toastId = toast.loading(`Menghapus ${targetFileIds.length} berkas secara permanen...`);

        try {
            for (const fileId of targetFileIds) {
                if (fileId.startsWith('cm_')) {
                    const realDocId = fileId.replace('cm_', '');
                    await deleteDoc(doc(db, 'corrective_reports', realDocId));
                } else {
                    const batch = writeBatch(db);
                    const chunksSnapshot = await getDocs(collection(db, collectionName, fileId, 'chunks'));
                    chunksSnapshot.docs.forEach((chunkDoc) => {
                        batch.delete(chunkDoc.ref);
                    });
                    batch.delete(doc(db, collectionName, fileId));
                    await batch.commit();
                }
            }

            toast.success(`Berhasil menghapus ${targetFileIds.length} berkas secara permanen!`, { id: toastId });
            setSelectedFileIds([]);
            setFileToDelete(null);
            setDeleteModalOpen(false);
            setDeleteReason('');
        } catch (error: any) {
            console.error('Error in permanent delete:', error);
            toast.error('Gagal menghapus berkas permanen: ' + (error?.message || 'Terjadi kesalahan'), { id: toastId });
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleDownload = async (file: FileData) => {
        if (file.isCorrectiveReport) {
            const toastId = toast.loading('Menyiapkan unduhan...');
            try {
                if (file.reportType === 'SLA') {
                    await exportSLAReportToExcel(file.originalReport);
                    toast.success('Berhasil mengunduh Laporan SLA Excel!', { id: toastId });
                } else if (file.reportType === 'PIR') {
                    await generatePIRReportPDF(file.originalReport);
                    toast.success('Berhasil mengunduh Report PIR PDF!', { id: toastId });
                } else {
                    await generateCMReportPDF(file.originalReport);
                    toast.success('Berhasil mengunduh Report CM PDF!', { id: toastId });
                }
            } catch (err: any) {
                console.error('Failed to export corrective report:', err);
                toast.error('Gagal mengunduh laporan', { id: toastId });
            }
            return;
        }

        try {
            const toastId = toast.loading('Menyiapkan unduhan...');

            const chunksSnapshot = await getDocs(query(collection(db, collectionName, file.id, 'chunks'), orderBy('index')));

            if (chunksSnapshot.empty) {
                toast.error('Data file tidak ditemukan', { id: toastId });
                return;
            }

            const byteArrays: Uint8Array[] = [];
            let mimeString = file.fileType || 'application/octet-stream';

            chunksSnapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.data) {
                    let base64Part = data.data;
                    if (base64Part.includes(';base64,')) {
                        const parts = base64Part.split(';base64,');
                        if (parts[0].startsWith('data:')) {
                            const extractedMime = parts[0].replace('data:', '').trim();
                            if (extractedMime) mimeString = extractedMime;
                        }
                        base64Part = parts[1];
                    } else if (base64Part.includes(',')) {
                        base64Part = base64Part.split(',')[1];
                    }
                    base64Part = base64Part.replace(/[\r\n\s]/g, '');

                    const byteCharacters = atob(base64Part);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    byteArrays.push(new Uint8Array(byteNumbers));
                }
            });

            const blob = new Blob(byteArrays as any[], { type: mimeString });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = file.fileName;
            link.click();
            URL.revokeObjectURL(link.href);

            toast.success('File berhasil diunduh!', { id: toastId });
        } catch (error) {
            console.error('Error downloading file:', error);
            toast.error('Gagal mengunduh file');
        }
    };

    const handleDownloadDocx = async (file: FileData) => {
        if (file.isCorrectiveReport) {
            const toastId = toast.loading('Menyiapkan unduhan Word (DOCX)...');
            try {
                if (file.reportType === 'SLA') {
                    await exportSLAReportToDocx(file.originalReport);
                    toast.success('Berhasil mengunduh Laporan SLA Word!', { id: toastId });
                } else if (file.reportType === 'PIR') {
                    await exportPIRReportToDocx(file.originalReport);
                    toast.success('Berhasil mengunduh Report PIR Word!', { id: toastId });
                } else {
                    await exportCMReportToDocx(file.originalReport);
                    toast.success('Berhasil mengunduh Report CM Word!', { id: toastId });
                }
            } catch (err: any) {
                console.error('Failed to export docx report:', err);
                toast.error('Gagal mengunduh laporan Word', { id: toastId });
            }
        }
    };

    const handleDownloadFolderZip = async () => {
        if (displayFiles.length === 0) {
            toast.error('Tidak ada file di folder ini untuk diunduh');
            return;
        }

        const currentFolderName = selectedMType || selectedQuarter || selectedFolder || initialFolder || 'Folder';
        const toastId = toast.loading(`Menyiapkan ${displayFiles.length} file untuk di-download (${currentFolderName})...`);
        try {
            const zip = new JSZip();
            const usedNames = new Set<string>();

            for (let i = 0; i < displayFiles.length; i++) {
                const file = displayFiles[i];
                toast.loading(`[${i + 1}/${displayFiles.length}] Mengambil file: ${file.fileName}...`, { id: toastId });

                try {
                    if (file.isCorrectiveReport) {
                        continue;
                    }
                    const chunksSnapshot = await getDocs(query(collection(db, collectionName, file.id, 'chunks'), orderBy('index')));
                    if (!chunksSnapshot.empty) {
                        const byteArrays: Uint8Array[] = [];
                        let mimeString = file.fileType || 'application/octet-stream';

                        chunksSnapshot.forEach(docSnap => {
                            const data = docSnap.data();
                            if (data.data) {
                                let base64Part = data.data;
                                if (base64Part.includes(';base64,')) {
                                    const parts = base64Part.split(';base64,');
                                    if (parts[0].startsWith('data:')) {
                                        const extractedMime = parts[0].replace('data:', '').trim();
                                        if (extractedMime) mimeString = extractedMime;
                                    }
                                    base64Part = parts[1];
                                } else if (base64Part.includes(',')) {
                                    base64Part = base64Part.split(',')[1];
                                }
                                base64Part = base64Part.replace(/[\r\n\s]/g, '');

                                const byteCharacters = atob(base64Part);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let k = 0; k < byteCharacters.length; k++) {
                                    byteNumbers[k] = byteCharacters.charCodeAt(k);
                                }
                                byteArrays.push(new Uint8Array(byteNumbers));
                            }
                        });

                        const blob = new Blob(byteArrays as any[], { type: mimeString });
                        let uniqueName = file.fileName;
                        let counter = 1;
                        while (usedNames.has(uniqueName)) {
                            const dotIdx = file.fileName.lastIndexOf('.');
                            if (dotIdx !== -1) {
                                const base = file.fileName.substring(0, dotIdx);
                                const ext = file.fileName.substring(dotIdx);
                                uniqueName = `${base} (${counter})${ext}`;
                            } else {
                                uniqueName = `${file.fileName} (${counter})`;
                            }
                            counter++;
                        }
                        usedNames.add(uniqueName);
                        zip.file(uniqueName, blob);
                    }
                } catch (fileErr) {
                    console.error(`Gagal memproses berkas ${file.fileName} untuk zip:`, fileErr);
                }
            }

            if (usedNames.size === 0) {
                toast.error('Tidak ada berkas yang dapat dikompres.', { id: toastId });
                return;
            }

            toast.loading(`Mengompres ${usedNames.size} file menjadi .ZIP...`, { id: toastId });
            const content = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });
            const zipName = `Berkas_${currentFolderName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
            saveAs(content, zipName);
            toast.success(`Berhasil mengunduh folder ${currentFolderName} (${usedNames.size} file)!`, { id: toastId });
        } catch (err: any) {
            console.error('Failed to create ZIP:', err);
            toast.error('Gagal membuat file ZIP folder', { id: toastId });
        }
    };

    const isTypeMatch = (fMType?: string, targetType?: string | null) => {
        if (!targetType) return true;
        if (!fMType) return false;
        const normF = fMType.trim().toLowerCase();
        const normT = targetType.trim().toLowerCase();
        if (normF === normT) return true;
        if ((normT.includes('transformer') || normT.includes('trafo')) && (normF.includes('transformer') || normF.includes('trafo'))) return true;
        if (normT.includes('generator') && (normF.includes('generator') || normF.includes('genset'))) return true;
        if (normT.includes('water leak') && normF.includes('water leak')) return true;
        if (normT.includes('fuel leak') && normF.includes('fuel leak')) return true;
        if (normT.includes('fuel system') && normF.includes('fuel system')) return true;
        if (normT.includes('fuel tank') && normF.includes('fuel tank')) return true;
        if (normT.includes('mv')) {
            if (normF.includes('mv')) return true;
        }
        if (normT.includes('rmu')) {
            if (normF.includes('rmu') && !normF.includes('mv')) return true;
        }
        return false;
    };

    const filteredFiles = files.filter((file) => {
        if (isEngineer && !ENGINEER_CATEGORIES.some(cat => matchCategory(file.category, cat))) {
            return false;
        }

        const q = searchQuery.trim().toLowerCase();
        const matchesSearch = !q || [
            file.fileName,
            file.category,
            file.maintenanceType,
            file.description,
            file.uploadedBy,
            file.uploadedByEmail
        ].filter(Boolean).some(val => String(val).toLowerCase().includes(q));

        const matchesCategory =
            filterCategory === 'All' ||
            (filterCategory === 'PENDING_DELETE' ? file.deleteRequested : matchCategory(file.category, filterCategory));
        const matchesYear =
            filterYear === 'All' || file.year === filterYear;
        return matchesSearch && matchesCategory && matchesYear;
    });

    const displayFiles = filteredFiles.filter((file) => {
        if (filterCategory === 'PENDING_DELETE') return true;

        if (selectedFolder && !matchCategory(file.category, selectedFolder)) {
            return false;
        }
        if (!showAllInFolder) {
            if (selectedQuarter && selectedFolder !== 'SLD' && selectedFolder !== 'Layout') {
                if (selectedQuarter === 'Tanpa Quarter') {
                    if (file.quarter && QUARTERS.includes(file.quarter)) return false;
                } else if (file.quarter !== selectedQuarter) {
                    return false;
                }
            }
            if (selectedMType && ['MOP', 'JSEA', 'PTW', 'Risk Register', 'D-DAY', 'Service Report', 'Service Report Approved'].includes(selectedFolder || '')) {
                if (selectedMType === 'Lainnya') {
                    if (file.maintenanceType && MAINTENANCE_TYPES.some(type => isTypeMatch(file.maintenanceType, type))) {
                        return false;
                    }
                } else if (!isTypeMatch(file.maintenanceType, selectedMType)) {
                    return false;
                }
            }
        }
        return true;
    });



    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className={initialFolder ? "w-full" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
            {divisionName && (
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                        Divisi: {divisionName}
                    </h1>
                    <p className="text-slate-400">
                        Kelola dan akses dokumentasi ISO untuk divisi {divisionName}.
                    </p>
                </div>
            )}

            {canUpload && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 border border-sky-100/90 shadow-lg mb-8 text-slate-800"
                >
                    <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-blue-600" />
                        Unggah File
                    </h2>

                    <div className="space-y-4">
                        <div className="relative border-2 border-dashed border-sky-200 rounded-2xl p-6 hover:border-blue-500 transition-colors bg-slate-50/90 text-center">
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.dwg,.dxf,.vsd,.vsdx,.csv,.zip,.rar,.7z,.txt,.png,.jpg,.jpeg,.webp,.svg,.bmp"
                                onChange={handleFileSelect}
                                disabled={uploading}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-800 font-bold">Klik atau seret file untuk mengunggah</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">PDF, Excel, Word, PPT, CAD (.dwg), Visio, Gambar, ZIP - Maks 60MB per file</p>
                        </div>

                        {selectedFiles.length > 0 && (
                            <div className="flex items-center justify-between bg-blue-50/80 px-3.5 py-2.5 rounded-xl border border-blue-200">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                                    <span className="text-xs sm:text-sm font-bold text-blue-900">
                                        {selectedFiles.length} berkas siap diunggah
                                    </span>
                                    <span className="text-xs text-blue-600 font-medium">
                                        ({formatFileSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))})
                                    </span>
                                </div>
                                <button
                                    onClick={() => setSelectedFiles([])}
                                    disabled={uploading}
                                    className="text-xs text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer disabled:opacity-50"
                                >
                                    Kosongkan Antrean
                                </button>
                            </div>
                        )}

                        {selectedFiles.length > 0 && (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-none">
                                {selectedFiles.map((file, idx) => {
                                    const parsed = parseFilenameMetadata(file.name);
                                    const hasAnyParsed = parsed.category || parsed.maintenanceType || parsed.quarter || parsed.year;
                                    return (
                                        <div key={idx} className="flex items-center justify-between bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-all">
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <span className="text-lg flex-shrink-0">{getFileIcon(file.type)}</span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs text-slate-900 font-bold truncate max-w-[280px] sm:max-w-md">{file.name}</span>
                                                        <span className="text-[10px] text-slate-500 font-medium">({formatFileSize(file.size)})</span>
                                                    </div>
                                                    {hasAnyParsed && (
                                                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                                <Sparkles className="w-3 h-3 text-amber-500 inline" /> Auto:
                                                            </span>
                                                            {parsed.category && (
                                                                <span className="px-1.5 py-0.5 bg-blue-100/80 text-blue-800 border border-blue-200/60 rounded-md text-[10px] font-bold">
                                                                    {parsed.category}
                                                                </span>
                                                            )}
                                                            {parsed.maintenanceType && (
                                                                <span className="px-1.5 py-0.5 bg-indigo-100/80 text-indigo-800 border border-indigo-200/60 rounded-md text-[10px] font-bold">
                                                                    {parsed.maintenanceType}
                                                                </span>
                                                            )}
                                                            {parsed.quarter && (
                                                                <span className="px-1.5 py-0.5 bg-emerald-100/80 text-emerald-800 border border-emerald-200/60 rounded-md text-[10px] font-bold">
                                                                    {parsed.quarter}
                                                                </span>
                                                            )}
                                                            {parsed.year && (
                                                                <span className="px-1.5 py-0.5 bg-amber-100/80 text-amber-800 border border-amber-200/60 rounded-md text-[10px] font-bold">
                                                                    {parsed.year}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeFile(idx)}
                                                className="p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-lg transition-colors ml-2 cursor-pointer flex-shrink-0"
                                                title="Hapus file dari antrean"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!simpleMode && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Kategori
                                    </label>
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        disabled={uploading}
                                        className="w-full px-4 py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    >
                                        {(isEngineer ? ENGINEER_CATEGORIES : FILE_CATEGORIES).map((cat) => (
                                            <option key={cat} value={cat}>
                                                {cat}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {selectedCategory !== 'SLD' && selectedCategory !== 'Layout' && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">
                                            Quarter
                                        </label>
                                        <select
                                            value={selectedUploadQuarter}
                                            onChange={(e) => setSelectedUploadQuarter(e.target.value)}
                                            disabled={uploading}
                                            className="w-full px-4 py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        >
                                            {QUARTERS.map((q) => (
                                                <option key={q} value={q}>
                                                    {q}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {['MOP', 'JSEA', 'PTW', 'Risk Register', 'D-DAY', 'Service Report', 'Service Report Approved'].includes(selectedCategory) && (
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-slate-700 mb-2">
                                            Tipe Maintenance
                                        </label>
                                        <select
                                            value={selectedMaintenance}
                                            onChange={(e) => setSelectedMaintenance(e.target.value)}
                                            disabled={uploading}
                                            className="w-full px-4 py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        >
                                            {MAINTENANCE_TYPES.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Tahun
                                    </label>
                                    <select
                                        value={selectedUploadYear}
                                        onChange={(e) => setSelectedUploadYear(e.target.value)}
                                        disabled={uploading}
                                        className="w-full px-4 py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    >
                                        {YEARS.map((y) => (
                                            <option key={y} value={y}>
                                                {y}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {!simpleMode && selectedCategory === 'Custom' && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Nama Kategori Kustom
                                </label>
                                <input
                                    type="text"
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                    disabled={uploading}
                                    placeholder="Masukkan nama kategori..."
                                    className="w-full px-4 py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                        )}

                        {!simpleMode && (
                            <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl">
                                <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={forceSelectedMetadata}
                                        onChange={(e) => setForceSelectedMetadata(e.target.checked)}
                                        disabled={uploading}
                                        className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                    />
                                    <div className="text-xs text-slate-700">
                                        <span className="font-bold text-slate-900 block">
                                            Kunci Kategori & Quarter di atas ke seluruh berkas ({selectedFiles.length > 0 ? `${selectedFiles.length} file` : 'file'} dalam antrean)
                                        </span>
                                        <span className="text-slate-500 block text-[11px] mt-0.5">
                                            Mencegah file terpencar otomatis ke folder lain berdasarkan kata kunci nama file. Sangat dianjurkan saat upload massal (seperti 150 file).
                                        </span>
                                    </div>
                                </label>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Description (Optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={uploading}
                                placeholder="Tambah deskripsi..."
                                rows={3}
                                className="w-full px-4 py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                            />
                        </div>

                        {uploading && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm text-slate-400">
                                    <span>Mengunggah... (Mengenkripsi & Membagi)</span>
                                    <span>{uploadProgress.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleUpload}
                                disabled={selectedFiles.length === 0 || uploading}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Memproses {selectedFiles.length} berkas... ({uploadProgress}%)
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5" />
                                        Unggah {selectedFiles.length > 0 ? `${selectedFiles.length} File` : 'File'}
                                    </>
                                )}
                            </motion.button>
                        </div>

                    </div>
                </motion.div>
            )}

            {!initialFolder && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-sky-100/90 shadow-md mb-6 text-slate-800"
                >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
                        <div className="md:col-span-6 lg:col-span-7">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cari file..."
                                    className="w-full pl-9 sm:pl-10 pr-10 py-2 sm:py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl text-slate-900 text-sm sm:text-base placeholder-slate-400 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
                                        title="Bersihkan pencarian"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="md:col-span-3 lg:col-span-3">
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 sm:py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl text-slate-900 text-sm sm:text-base font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer outline-none transition"
                                >
                                    <option value="All">Semua Kategori</option>
                                    {canDeleteOrRequest && files.some(f => f.deleteRequested) && (
                                        <option value="PENDING_DELETE" className="font-bold text-amber-700 bg-amber-50">
                                            ⚠️ Menunggu Approval Hapus ({files.filter(f => f.deleteRequested).length})
                                        </option>
                                    )}
                                    {((isEngineer ? ENGINEER_CATEGORIES : FILE_CATEGORIES).filter((cat) => cat !== 'Custom')).map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="md:col-span-3 lg:col-span-2">
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    value={filterYear}
                                    onChange={(e) => setFilterYear(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 sm:py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl text-slate-900 text-sm sm:text-base font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer outline-none transition"
                                >
                                    <option value="All">Semua Tahun</option>
                                    {YEARS.map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            <motion.div
                ref={folderCardRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-sky-100/90 shadow-lg text-slate-800 scroll-mt-20"
            >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-sm sm:text-base font-semibold text-slate-800 flex-wrap min-w-0">
                        <YellowFolderIcon className="w-5 h-5 flex-shrink-0" />
                        <span
                            onClick={() => {
                                setSelectedFolder(null);
                                setSelectedQuarter(null);
                                setSelectedMType(null);
                                setShowAllInFolder(false);
                                if (onBackToRoot) onBackToRoot();
                            }}
                            className={`hover:text-amber-600 transition-colors ${selectedFolder ? 'cursor-pointer text-slate-500 hover:underline' : 'text-slate-900 font-bold'}`}
                        >
                            Folder Utama
                        </span>
                        {selectedFolder && (
                            <>
                                <span className="text-slate-300 font-normal">/</span>
                                <span
                                    onClick={() => { setSelectedQuarter(null); setSelectedMType(null); }}
                                    className={`hover:text-amber-600 transition-colors ${selectedQuarter ? 'cursor-pointer text-slate-500 hover:underline' : 'text-slate-900 font-bold'}`}
                                >
                                    {selectedFolder}
                                </span>
                            </>
                        )}
                        {selectedQuarter && (
                            <>
                                <span className="text-slate-300 font-normal">/</span>
                                <span
                                    onClick={() => setSelectedMType(null)}
                                    className={`hover:text-amber-600 transition-colors ${selectedMType ? 'cursor-pointer text-slate-500 hover:underline' : 'text-slate-900 font-bold'}`}
                                >
                                    {selectedQuarter}
                                </span>
                            </>
                        )}
                        {selectedMType && (
                            <>
                                <span className="text-slate-300 font-normal">/</span>
                                <span className="text-amber-700 font-bold">{selectedMType}</span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {selectedFolder && (
                            <button
                                type="button"
                                onClick={() => setShowAllInFolder(prev => !prev)}
                                className={`text-xs sm:text-sm font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shadow-2xs cursor-pointer shrink-0 border ${
                                    showAllInFolder 
                                        ? 'bg-amber-500 text-white border-amber-600 shadow-amber-500/20' 
                                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'
                                }`}
                                title={showAllInFolder ? 'Kembali ke penjelajahan kategori/quarter' : `Tampilkan seluruh berkas di folder ${selectedFolder} secara langsung`}
                            >
                                <FileText className="w-4 h-4" />
                                {showAllInFolder ? 'Mode Kategori / Quarter' : `Lihat Semua Berkas (${filteredFiles.filter(f => matchCategory(f.category, selectedFolder)).length})`}
                            </button>
                        )}
                        {(selectedFolder === 'Form SLA/SLG' || selectedFolder === 'SLA/SLG' || selectedFolder === 'Report CM, SLA & PIR') && (
                            <button
                                type="button"
                                onClick={async () => {
                                    const slaFiles = displayFiles.filter(f => f.isCorrectiveReport && f.reportType === 'SLA').map(f => f.originalReport).filter(Boolean);
                                    if (slaFiles.length === 0) {
                                        toast.error('Tidak ada data laporan SLA di folder ini untuk direkap.');
                                        return;
                                    }
                                    const toastId = toast.loading('Memproses Rekap SLA (DOCX)...');
                                    try {
                                        const folderName = selectedQuarter ? `${selectedFolder} (${selectedQuarter})` : selectedFolder;
                                        await exportSLAMonthlyRecapToDocx(slaFiles, folderName);
                                        toast.success('Berhasil mengekspor Rekap SLA Word (DOCX)!', { id: toastId });
                                    } catch (err: any) {
                                        console.error('Failed to export SLA recap:', err);
                                        toast.error('Gagal mengekspor Rekap SLA Word', { id: toastId });
                                    }
                                }}
                                className="text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 font-bold flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer shrink-0"
                            >
                                <FileText className="w-4 h-4" />
                                Export Rekap SLA (DOCX)
                            </button>
                        )}

                        {((selectedFolder || selectedQuarter || selectedMType || initialFolder) && displayFiles.length > 0) && (
                            <button
                                type="button"
                                onClick={handleDownloadFolderZip}
                                className="text-xs sm:text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-bold flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all shadow-xs cursor-pointer shrink-0"
                                title="Download Semua File di Folder Ini (.ZIP)"
                            >
                                <FolderDown className="w-4 h-4" />
                                <span>Download Folder (.ZIP)</span>
                                <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{displayFiles.length}</span>
                            </button>
                        )}

                        {(selectedFolder || selectedQuarter || selectedMType || searchQuery) && (
                            <button
                                onClick={() => {
                                    if (selectedMType) {
                                        setSelectedMType(null);
                                    } else if (selectedQuarter) {
                                        setSelectedQuarter(null);
                                    } else if (selectedFolder) {
                                        setSelectedFolder(null);
                                        setSearchQuery('');
                                        if (onBackToRoot) onBackToRoot();
                                    } else if (searchQuery) {
                                        setSearchQuery('');
                                    }
                                }}
                                className="text-xs sm:text-sm text-slate-600 hover:text-amber-700 font-semibold flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-amber-50 border border-slate-200 rounded-lg transition-all shadow-2xs cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                {selectedMType
                                    ? `Kembali ke ${selectedQuarter}`
                                    : selectedQuarter
                                    ? `Kembali ke ${selectedFolder}`
                                    : 'Kembali ke Folder Utama'}
                            </button>
                        )}
                    </div>
                </div>

                {!selectedFolder ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {[...new Set(isEngineer ? ENGINEER_CATEGORIES : filteredFiles.map(f => f.category))]
                            .filter(category => category && !MAINTENANCE_TYPES.includes(category))
                            .filter(category => {
                                if (!searchQuery.trim()) return true;
                                const q = searchQuery.trim().toLowerCase();
                                const catMatches = category.toLowerCase().includes(q);
                                const hasMatchingFiles = filteredFiles.some(f => matchCategory(f.category, category));
                                return catMatches || hasMatchingFiles;
                            })
                            .sort()
                            .map((category) => {
                                const fileCount = filteredFiles.filter(f => matchCategory(f.category, category)).length;
                                return (
                                    <motion.div
                                        key={category}
                                        whileHover={{ x: 2, scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => setSelectedFolder(category)}
                                        className="flex items-center gap-3.5 px-4 py-3 bg-white hover:bg-amber-50/60 border border-slate-200/90 hover:border-amber-400/80 rounded-xl cursor-pointer transition-all group shadow-2xs hover:shadow-xs"
                                    >
                                        <YellowFolderIcon className="w-7 h-7 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-slate-900 font-bold text-sm truncate group-hover:text-amber-900 transition-colors">
                                                {category}
                                            </h3>
                                            <span className="text-[11px] text-slate-500 font-medium block">
                                                {fileCount} {fileCount === 1 ? 'file' : 'files'}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        {filteredFiles.length === 0 && (
                            <div className="col-span-full text-center py-12">
                                <YellowFolderIcon className="w-12 h-12 mx-auto opacity-40 mb-3" />
                                <p className="text-slate-500 font-medium">Tidak ada folder ditemukan</p>
                            </div>
                        )}
                    </div>
                ) : !showAllInFolder && selectedFolder && !selectedQuarter && selectedFolder !== 'SLD' && selectedFolder !== 'Layout' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {QUARTERS
                            .filter(quarter => {
                                if (!searchQuery.trim()) return true;
                                const q = searchQuery.trim().toLowerCase();
                                const qMatches = quarter.toLowerCase().includes(q);
                                const hasMatchingFiles = filteredFiles.some(f => matchCategory(f.category, selectedFolder) && f.quarter === quarter);
                                return qMatches || hasMatchingFiles;
                            })
                            .map((quarter) => {
                                const fileCount = filteredFiles.filter(f => matchCategory(f.category, selectedFolder) && f.quarter === quarter).length;
                                return (
                                    <motion.div
                                        key={quarter}
                                        whileHover={{ x: 2, scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => setSelectedQuarter(quarter)}
                                        className="flex items-center gap-3.5 px-4 py-3 bg-white hover:bg-amber-50/60 border border-slate-200/90 hover:border-amber-400/80 rounded-xl cursor-pointer transition-all group shadow-2xs hover:shadow-xs"
                                    >
                                        <YellowFolderIcon className="w-7 h-7 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-slate-900 font-bold text-sm group-hover:text-amber-900 transition-colors">
                                                {quarter}
                                            </h3>
                                            <span className="text-[11px] text-slate-500 font-medium block">
                                                {fileCount} {fileCount === 1 ? 'file' : 'files'}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        {(() => {
                            const noQCount = filteredFiles.filter(f => matchCategory(f.category, selectedFolder) && (!f.quarter || !QUARTERS.includes(f.quarter))).length;
                            if (noQCount === 0) return null;
                            return (
                                <motion.div
                                    key="Tanpa Quarter"
                                    whileHover={{ x: 2, scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => setSelectedQuarter('Tanpa Quarter')}
                                    className="flex items-center gap-3.5 px-4 py-3 bg-amber-50/70 hover:bg-amber-100/80 border border-amber-300/80 rounded-xl cursor-pointer transition-all group shadow-2xs hover:shadow-xs"
                                >
                                    <YellowFolderIcon className="w-7 h-7 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-amber-900 font-bold text-sm group-hover:text-amber-950 transition-colors">
                                            Tanpa Quarter
                                        </h3>
                                        <span className="text-[11px] text-slate-600 font-medium block">
                                            {noQCount} {noQCount === 1 ? 'file' : 'files'}
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })()}
                    </div>
                ) : !showAllInFolder && selectedFolder && selectedQuarter && !selectedMType && ['MOP', 'JSEA', 'PTW', 'Risk Register', 'D-DAY', 'Service Report', 'Service Report Approved'].includes(selectedFolder) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {MAINTENANCE_TYPES
                            .filter(type => {
                                if (!searchQuery.trim()) return true;
                                const q = searchQuery.trim().toLowerCase();
                                const typeMatches = type.toLowerCase().includes(q);
                                const hasMatchingFiles = filteredFiles.some(f => matchCategory(f.category, selectedFolder) && (selectedQuarter === 'Tanpa Quarter' ? (!f.quarter || !QUARTERS.includes(f.quarter)) : f.quarter === selectedQuarter) && isTypeMatch(f.maintenanceType, type));
                                return typeMatches || hasMatchingFiles;
                            })
                            .map((type) => {
                                const typeFiles = filteredFiles.filter(f => matchCategory(f.category, selectedFolder) && (selectedQuarter === 'Tanpa Quarter' ? (!f.quarter || !QUARTERS.includes(f.quarter)) : f.quarter === selectedQuarter) && isTypeMatch(f.maintenanceType, type));
                                const fileCount = typeFiles.length;

                                return (
                                    <motion.div
                                        key={type}
                                        whileHover={{ x: 2, scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => setSelectedMType(type)}
                                        className="flex items-center gap-3.5 px-4 py-3 bg-white hover:bg-amber-50/60 border border-slate-200/90 hover:border-amber-400/80 rounded-xl cursor-pointer transition-all group shadow-2xs hover:shadow-xs"
                                    >
                                        <YellowFolderIcon className="w-7 h-7 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-slate-900 font-bold text-xs truncate group-hover:text-amber-900 transition-colors">
                                                {type}
                                            </h3>
                                            <span className="text-[10px] text-slate-500 font-medium block">
                                                {fileCount} {fileCount === 1 ? 'file' : 'files'}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        {(() => {
                            const unassignedCount = filteredFiles.filter(f => matchCategory(f.category, selectedFolder) && (selectedQuarter === 'Tanpa Quarter' ? (!f.quarter || !QUARTERS.includes(f.quarter)) : f.quarter === selectedQuarter) && (!f.maintenanceType || !MAINTENANCE_TYPES.some(t => isTypeMatch(f.maintenanceType, t)))).length;
                            if (unassignedCount === 0) return null;
                            return (
                                <motion.div
                                    key="Lainnya"
                                    whileHover={{ x: 2, scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => setSelectedMType('Lainnya')}
                                    className="flex items-center gap-3.5 px-4 py-3 bg-amber-50/70 hover:bg-amber-100/80 border border-amber-300/80 rounded-xl cursor-pointer transition-all group shadow-2xs hover:shadow-xs"
                                >
                                    <YellowFolderIcon className="w-7 h-7 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-amber-900 font-bold text-xs truncate group-hover:text-amber-950 transition-colors">
                                            Lainnya / Uncategorized
                                        </h3>
                                        <span className="text-[10px] text-slate-600 font-medium block">
                                            {unassignedCount} {unassignedCount === 1 ? 'file' : 'files'}
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })()}
                        {MAINTENANCE_TYPES.filter(type => {
                            if (!searchQuery.trim()) return true;
                            const q = searchQuery.trim().toLowerCase();
                            const typeMatches = type.toLowerCase().includes(q);
                            const hasMatchingFiles = filteredFiles.some(f => matchCategory(f.category, selectedFolder) && (selectedQuarter === 'Tanpa Quarter' ? (!f.quarter || !QUARTERS.includes(f.quarter)) : f.quarter === selectedQuarter) && isTypeMatch(f.maintenanceType, type));
                            return typeMatches || hasMatchingFiles;
                        }).length === 0 && (
                            <div className="col-span-full text-center py-12">
                                <YellowFolderIcon className="w-12 h-12 mx-auto opacity-40 mb-3" />
                                <p className="text-slate-500 font-medium">Tidak ada folder peralatan ditemukan</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {displayFiles.length === 0 ? (
                            <div className="text-center py-12">
                                <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400 font-medium">Tidak ada file yang sesuai</p>
                            </div>
                        ) : (
                            <>
                                {canDeleteOrRequest && (
                                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 flex-wrap gap-3">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    displayFiles.length > 0 &&
                                                    displayFiles.every(f => selectedFileIds.includes(f.id))
                                                }
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        const allIds = displayFiles.map(f => f.id);
                                                        setSelectedFileIds(prev => [...new Set([...prev, ...allIds])]);
                                                    } else {
                                                        const currentIds = displayFiles.map(f => f.id);
                                                        setSelectedFileIds(prev => prev.filter(id => !currentIds.includes(id)));
                                                    }
                                                }}
                                                className="w-4 h-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <span className="text-sm font-bold text-slate-700">
                                                Pilih Semua File ({displayFiles.length})
                                            </span>
                                        </div>

                                        {selectedFileIds.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedFileIds([])}
                                                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 cursor-pointer"
                                                >
                                                    Batalkan Pilihan
                                                </button>
                                                <motion.button
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    onClick={() => openDeleteDialog(null)}
                                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition text-xs sm:text-sm font-bold shadow-xs cursor-pointer ${
                                                        isQcDme
                                                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'
                                                            : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                                                    }`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    {isQcDme ? (
                                                        <span>Hapus Terpilih ({selectedFileIds.length})</span>
                                                    ) : (
                                                        <span>Ajukan Hapus Terpilih ({selectedFileIds.length})</span>
                                                    )}
                                                </motion.button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {displayFiles.map((file) => (
                                    <motion.div
                                        key={file.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className={`bg-slate-50/80 hover:bg-slate-100/90 rounded-xl p-3.5 sm:p-4 border transition-all duration-200 shadow-xs flex items-start sm:items-center gap-3 sm:gap-4 ${
                                            file.deleteRequested
                                                ? 'border-amber-300 bg-amber-50/30'
                                                : selectedFileIds.includes(file.id)
                                                    ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                                                    : 'border-slate-200/80 hover:border-slate-300'
                                        }`}
                                    >
                                        {canDeleteOrRequest && (
                                            <div className="mt-1 sm:mt-0">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFileIds.includes(file.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedFileIds(prev => [...prev, file.id]);
                                                        } else {
                                                            setSelectedFileIds(prev => prev.filter(id => id !== file.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </div>
                                        )}

                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 flex-1 min-w-0">
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                <div className="text-2xl sm:text-3xl flex-shrink-0 mt-0.5 sm:mt-0">
                                                    {getFileIcon(file.fileType)}
                                                </div>
                                                <div className="flex-1 min-w-0 overflow-hidden">
                                                    <h3
                                                        onClick={() => handleDownload(file)}
                                                        className="text-slate-900 font-extrabold text-sm sm:text-base truncate break-words hover:text-blue-600 cursor-pointer transition-colors"
                                                        title="Klik untuk membuka / mengunduh file"
                                                    >
                                                        {file.fileName}
                                                    </h3>
                                                    <div className="mt-2 space-y-2">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200/80 text-[11px] sm:text-xs font-bold">
                                                                {file.category}
                                                            </span>
                                                            {file.quarter && (
                                                                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200/80 text-[11px] sm:text-xs font-bold">
                                                                    {file.quarter}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-slate-500 font-medium">
                                                            <span className="font-bold text-slate-700">{formatFileSize(file.fileSize)}</span>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="text-slate-600 font-semibold">
                                                                {file.uploadedAt?.toDate?.()?.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {file.description && (
                                                        <p className="text-xs text-red-600 mt-2.5 italic line-clamp-1 border-l-2 border-red-400 pl-2.5 bg-red-50/40 py-1 rounded-r">
                                                            "{file.description}"
                                                        </p>
                                                    )}

                                                    {/* Badge Status Pengajuan Hapus ke QC DME */}
                                                    {file.deleteRequested && (
                                                        <div className="mt-2.5 p-2.5 bg-amber-50/90 border border-amber-200/90 rounded-xl flex items-start gap-2 text-xs">
                                                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-bold text-amber-900">
                                                                        Menunggu Persetujuan Hapus QC DME (qcdme@dme.com)
                                                                    </span>
                                                                    {file.deleteRequestedBy && (
                                                                        <span className="px-1.5 py-0.2 bg-amber-200/60 text-amber-800 rounded font-semibold text-[10px]">
                                                                            Diajukan oleh: {file.deleteRequestedBy}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {file.deleteReason && (
                                                                    <p className="text-[11px] text-amber-800 italic mt-0.5">
                                                                        Alasan: "{file.deleteReason}"
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-end sm:self-auto ml-auto sm:ml-0">
                                                {file.isCorrectiveReport && (
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => handleDownloadDocx(file)}
                                                        className="p-2 sm:p-2.5 bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white rounded-lg transition-all border border-sky-200/80 shadow-xs cursor-pointer"
                                                        title="Download Word (DOCX)"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </motion.button>
                                                )}
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleDownload(file)}
                                                    className="p-2 sm:p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all border border-blue-200/80 shadow-xs cursor-pointer"
                                                    title={file.isCorrectiveReport ? "Download PDF / Excel" : "Download"}
                                                >
                                                    <Download className="w-4 h-4" />
                                                </motion.button>

                                                {canDeleteOrRequest && (
                                                    file.deleteRequested ? (
                                                        isQcDme ? (
                                                            <motion.button
                                                                whileHover={{ scale: 1.05 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={() => openDeleteDialog(file)}
                                                                className="px-2.5 py-2 bg-amber-100 text-amber-900 hover:bg-amber-600 hover:text-white rounded-lg transition-all border border-amber-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                                                title="Tinjau Pengajuan Hapus Berkas Ini"
                                                            >
                                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                                <span className="hidden sm:inline">Tinjau</span>
                                                            </motion.button>
                                                        ) : (
                                                            <motion.button
                                                                whileHover={{ scale: 1.05 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={() => openDeleteDialog(file)}
                                                                className="px-2.5 py-2 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white rounded-lg transition-all border border-amber-200 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                                                title="Batalkan Pengajuan Hapus Berkas Ini"
                                                            >
                                                                <RotateCcw className="w-3.5 h-3.5" />
                                                                <span className="hidden sm:inline">Batalkan</span>
                                                            </motion.button>
                                                        )
                                                    ) : (
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => openDeleteDialog(file)}
                                                            className="p-2 sm:p-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all border border-red-200/80 shadow-xs cursor-pointer"
                                                            title={isQcDme ? "Hapus Berkas Permanen" : "Ajukan Hapus ke QC DME (qcdme@dme.com)"}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </motion.button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </motion.div>

            {/* Modal Dialog Multi-Mode: Pengajuan Hapus ke QC DME / Persetujuan / Pembatalan / Hapus Permanen */}
            <AnimatePresence>
                {deleteModalOpen && (fileToDelete || selectedFileIds.length > 0) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4"
                        onClick={() => {
                            if (!isBulkDeleting) {
                                setDeleteModalOpen(false);
                                setFileToDelete(null);
                            }
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-slate-200 shadow-2xl relative overflow-hidden text-slate-800"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => {
                                    setDeleteModalOpen(false);
                                    setFileToDelete(null);
                                }}
                                disabled={isBulkDeleting}
                                className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer disabled:opacity-50"
                                title="Tutup"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            {/* MODE 1: Pengajuan Hapus Berkas oleh Admin ke QC DME */}
                            {deleteModalMode === 'request_delete' && (
                                <div>
                                    <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-600 shadow-xs">
                                        <Send className="w-7 h-7" />
                                    </div>

                                    <h3 className="text-xl font-black text-slate-900 text-center mb-1">
                                        Pengajuan Hapus Berkas
                                    </h3>
                                    <p className="text-xs text-slate-500 text-center mb-4">
                                        Pengajuan ini akan diteruskan ke akun QC DME (<strong className="text-slate-800">qcdme@dme.com</strong>) untuk ditinjau dan disetujui.
                                    </p>

                                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-4 text-left space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500 font-medium">Tujuan Penerima:</span>
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded-md text-[11px]">
                                                qcdme@dme.com (QC DME)
                                            </span>
                                        </div>

                                        <div className="border-t border-slate-200 pt-2">
                                            <span className="text-[11px] font-bold text-slate-700 block mb-1">
                                                Berkas yang diajukan ({targetFileIds.length}):
                                            </span>
                                            <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                                                {targetFiles.map(f => (
                                                    <div key={f.id} className="text-xs font-semibold text-slate-800 flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                                                        <span className="truncate">{f.fileName}</span>
                                                        <span className="text-[10px] text-slate-400 shrink-0 font-normal">({formatFileSize(f.fileSize)})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-4 text-left">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Alasan / Remark Pengajuan Hapus <span className="text-rose-600 lowercase font-bold">* (wajib diisi)</span>
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={deleteReason}
                                            onChange={(e) => setDeleteReason(e.target.value)}
                                            placeholder="Contoh: Dokumen salah revisi, berkas duplikat, dokumen sudah diperbarui oleh teknisi..."
                                            className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 rounded-xl p-3 text-slate-900 text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 resize-none transition-all placeholder:text-slate-400"
                                        />
                                    </div>

                                    <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 mb-5 leading-relaxed text-left flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                        <span>
                                            Berkas <strong>tidak akan langsung terhapus</strong>. Berkas akan ditandai berstatus <em>"Menunggu Persetujuan"</em> hingga disetujui oleh QC DME.
                                        </span>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDeleteModalOpen(false);
                                                setFileToDelete(null);
                                            }}
                                            disabled={isBulkDeleting}
                                            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition cursor-pointer disabled:opacity-50"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRequestDelete}
                                            disabled={isBulkDeleting || !deleteReason.trim()}
                                            className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            {isBulkDeleting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Mengirimkan...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4" />
                                                    <span>Kirim Pengajuan</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* MODE 2: Peninjauan Pengajuan Hapus oleh QC DME */}
                            {deleteModalMode === 'review_request' && (
                                <div>
                                    <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-600 shadow-xs">
                                        <AlertTriangle className="w-7 h-7" />
                                    </div>

                                    <h3 className="text-xl font-black text-slate-900 text-center mb-1">
                                        Tinjau Pengajuan Hapus (QC DME)
                                    </h3>
                                    <p className="text-xs text-slate-500 text-center mb-4">
                                        Tentukan apakah berkas ini disetujui untuk dihapus permanen atau ditolak.
                                    </p>

                                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-5 text-left space-y-2.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500 font-medium">Diajukan Oleh:</span>
                                            <span className="font-bold text-slate-900">
                                                {targetFiles[0]?.deleteRequestedBy || 'Admin'}
                                            </span>
                                        </div>

                                        {targetFiles[0]?.deleteReason && (
                                            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-900">
                                                <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-700 mb-0.5">
                                                    Alasan / Remark:
                                                </span>
                                                <p className="italic font-medium">"{targetFiles[0]?.deleteReason}"</p>
                                            </div>
                                        )}

                                        <div className="border-t border-slate-200 pt-2">
                                            <span className="text-[11px] font-bold text-slate-700 block mb-1">
                                                Berkas terkait ({targetFileIds.length}):
                                            </span>
                                            <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                                                {targetFiles.map(f => (
                                                    <div key={f.id} className="text-xs font-semibold text-slate-800 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70 truncate">
                                                        {f.fileName}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2.5">
                                        <button
                                            type="button"
                                            onClick={handlePermanentDelete}
                                            disabled={isBulkDeleting}
                                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-red-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            {isBulkDeleting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Memproses Hapus...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="w-4 h-4" />
                                                    <span>Setujui Hapus (Hapus Permanen)</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleRejectOrCancelRequest}
                                            disabled={isBulkDeleting}
                                            className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            <Ban className="w-4 h-4" />
                                            <span>Tolak Pengajuan (Batal Hapus)</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDeleteModalOpen(false);
                                                setFileToDelete(null);
                                            }}
                                            disabled={isBulkDeleting}
                                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer disabled:opacity-50"
                                        >
                                            Tutup
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* MODE 3: Hapus Berkas Permanen Langsung oleh QC DME */}
                            {deleteModalMode === 'direct_delete' && (
                                <div>
                                    <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600 shadow-xs">
                                        <Trash2 className="w-7 h-7" />
                                    </div>

                                    <h3 className="text-xl font-black text-slate-900 text-center mb-1">
                                        {targetFileIds.length > 1 ? `Hapus ${targetFileIds.length} Berkas?` : 'Hapus Berkas Permanen?'}
                                    </h3>
                                    <p className="text-xs text-slate-500 text-center mb-4 leading-relaxed">
                                        Apakah Anda yakin ingin menghapus berkas ini secara permanen dari Cloud Storage & Firestore?
                                    </p>

                                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-5 text-left">
                                        <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                                            {targetFiles.map(f => (
                                                <div key={f.id} className="text-xs font-semibold text-slate-800 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70 truncate">
                                                    {f.fileName}
                                                </div>
                                            ))}
                                        </div>
                                        <span className="text-[11px] text-red-600 font-semibold block mt-2">
                                            ⚠️ Tindakan ini permanen dan tidak dapat dibatalkan.
                                        </span>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDeleteModalOpen(false);
                                                setFileToDelete(null);
                                            }}
                                            disabled={isBulkDeleting}
                                            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition cursor-pointer disabled:opacity-50"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handlePermanentDelete}
                                            disabled={isBulkDeleting}
                                            className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-red-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            {isBulkDeleting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Menghapus...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Trash2 className="w-4 h-4" />
                                                    <span>Ya, Hapus Permanen</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* MODE 4: Pembatalan Pengajuan Hapus oleh Admin */}
                            {deleteModalMode === 'cancel_request' && (
                                <div>
                                    <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-600 shadow-xs">
                                        <RotateCcw className="w-7 h-7" />
                                    </div>

                                    <h3 className="text-xl font-black text-slate-900 text-center mb-1">
                                        Batalkan Pengajuan Hapus?
                                    </h3>
                                    <p className="text-xs text-slate-500 text-center mb-4 leading-relaxed">
                                        Pengajuan permohonan hapus berkas ini akan dibatalkan dan status berkas akan dikembalikan menjadi normal.
                                    </p>

                                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-5 text-left">
                                        <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                                            {targetFiles.map(f => (
                                                <div key={f.id} className="text-xs font-semibold text-slate-800 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/70 truncate">
                                                    {f.fileName}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDeleteModalOpen(false);
                                                setFileToDelete(null);
                                            }}
                                            disabled={isBulkDeleting}
                                            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition cursor-pointer disabled:opacity-50"
                                        >
                                            Tutup
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRejectOrCancelRequest}
                                            disabled={isBulkDeleting}
                                            className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            {isBulkDeleting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Membatalkan...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <RotateCcw className="w-4 h-4" />
                                                    <span>Ya, Batalkan Pengajuan</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showSuccessModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
                        onClick={() => setShowSuccessModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full border border-slate-200 text-center shadow-2xl relative overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
                            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl" />

                            <div className="relative z-10">
                                {failedUploads.length === 0 ? (
                                    <>
                                        <div className="w-20 h-20 bg-blue-50 border border-blue-200/80 rounded-full flex items-center justify-center mx-auto mb-5 shadow-xs">
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.2 }}
                                            >
                                                <CheckCircle2 className="w-10 h-10 text-blue-600" />
                                            </motion.div>
                                        </div>

                                        <h3 className="text-2xl font-black text-slate-900 mb-2">Upload Berhasil!</h3>
                                        <p className="text-slate-600 text-sm mb-6 px-2 font-medium">
                                            Seluruh <span className="text-blue-600 font-bold">{uploadedFilesCount} berkas</span> telah berhasil disimpan ke sistem dan siap diakses.
                                        </p>

                                        <button
                                            onClick={() => setShowSuccessModal(false)}
                                            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.98] cursor-pointer"
                                        >
                                            Selesai
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-20 h-20 bg-amber-50 border border-amber-200/80 rounded-full flex items-center justify-center mx-auto mb-5 shadow-xs">
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.2 }}
                                            >
                                                <AlertTriangle className="w-10 h-10 text-amber-600" />
                                            </motion.div>
                                        </div>

                                        <h3 className="text-xl font-black text-slate-900 mb-2">Upload Sebagian Selesai</h3>
                                        <p className="text-slate-600 text-xs sm:text-sm mb-4 px-2">
                                            <span className="text-emerald-600 font-bold">{uploadedFilesCount} berkas berhasil</span> disimpan, tetapi ada <span className="text-red-600 font-bold">{failedUploads.length} berkas gagal</span> karena kendala jaringan atau rate limit.
                                        </p>

                                        <div className="mb-6 max-h-36 overflow-y-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-left space-y-1.5 scrollbar-none">
                                            {failedUploads.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-200/60 last:border-b-0">
                                                    <span className="text-slate-800 font-bold truncate flex-1">{item.file.name}</span>
                                                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">Gagal</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2.5">
                                            <button
                                                onClick={handleRetryFailed}
                                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer text-sm"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                Coba Lagi ({failedUploads.length})
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setFailedUploads([]);
                                                    setShowSuccessModal(false);
                                                }}
                                                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all active:scale-[0.98] cursor-pointer text-sm"
                                            >
                                                Tutup
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

