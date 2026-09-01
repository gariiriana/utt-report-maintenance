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
    writeBatch
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
const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 60 * 1024 * 1024;
const CHUNK_SIZE = 750 * 1024;

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
    if (/\b(?:PREDICTIVE[\s_-]*REPORT|PREDICTIVE)\b/i.test(cleanName)) {
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
}

interface FileManagementProps {
    collectionName?: string;
    allowUpload?: boolean;
    divisionName?: string;
    simpleMode?: boolean;
    initialFolder?: string | null;
    onBackToRoot?: () => void;
    initialSearchQuery?: string;
}

export function FileManagement({
    collectionName = 'files',
    allowUpload: propAllowUpload,
    divisionName,
    simpleMode = false,
    initialFolder = null,
    onBackToRoot,
    initialSearchQuery = '',
}: FileManagementProps = {}) {
    const { user, userRole } = useAuth();
    const isAdmin = userRole === 'admin';
    const isTDEorCBRE = userRole === 'tde' || userRole === 'cbre';
    const isHSE = userRole === 'hse';
    const canUpload = propAllowUpload !== undefined
        ? propAllowUpload
        : (userRole === 'admin' || (collectionName !== 'files' && userRole === collectionName));
    const canDelete = isAdmin || isTDEorCBRE || isHSE;
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

    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterYear, setFilterYear] = useState('All');
    const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolder);
    const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
    const [selectedMType, setSelectedMType] = useState<string | null>(null);
    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

    useEffect(() => {
        setSelectedFolder(initialFolder || null);
        setSelectedQuarter(null);
        setSelectedMType(null);
    }, [initialFolder]);

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
                        originalReport: { id: docSnap.id, ...report }
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const validFiles: File[] = [];

            newFiles.forEach(file => {
                if (file.size > MAX_FILE_SIZE) {
                    toast.error(`File "${file.name}" terlalu besar (Maks 60MB)`);
                    return;
                }
                if (!ALLOWED_FILE_TYPES.includes(file.type)) {
                    toast.error(`Tipe file "${file.name}" tidak didukung`);
                    return;
                }
                validFiles.push(file);
            });

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
                    toast.success(`✨ Otomatis terdeteksi: ${detectedParts.join(' | ')}`);
                }
            }

            setSelectedFiles(prev => [...prev, ...validFiles]);
            e.target.value = '';
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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

            for (let f = 0; f < selectedFiles.length; f++) {
                const file = selectedFiles[f];
                const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

                // Ekstraksi metadata pintar per-berkas (misal: "JSEA - PM - AHU - Q3 - 2026.pdf")
                const parsed = parseFilenameMetadata(file.name);
                const fileCategory = parsed.category || finalCategory;
                const fileMaintenance = (['MOP', 'JSEA', 'PTW', 'Risk Register', 'D-DAY', 'Service Report', 'Service Report Approved'].includes(fileCategory))
                    ? (parsed.maintenanceType || selectedMaintenance)
                    : null;
                const fileQuarter = fileCategory === 'SLD' ? 'N/A' : (parsed.quarter || selectedUploadQuarter);
                const fileYear = parsed.year || selectedUploadYear;

                const fileDocRef = await addDoc(collection(db, collectionName), {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type || 'application/pdf',
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

                // Controlled parallel batch chunk upload (5 concurrent writes) for ultra-fast storage
                const CONCURRENCY = 5;
                for (let i = 0; i < totalChunks; i += CONCURRENCY) {
                    const batchPromises = [];
                    for (let c = i; c < Math.min(i + CONCURRENCY, totalChunks); c++) {
                        const start = c * CHUNK_SIZE;
                        const end = Math.min(start + CHUNK_SIZE, file.size);
                        const chunkBlob = file.slice(start, end);

                        batchPromises.push((async () => {
                            let chunkBase64 = await chunkToBase64(chunkBlob);
                            if (c === 0) {
                                chunkBase64 = `data:${file.type};base64,${chunkBase64}`;
                            }

                            const chunkRef = doc(db, collectionName, fileDocRef.id, 'chunks', `chunk_${String(c).padStart(4, '0')}`);
                            await setDoc(chunkRef, {
                                index: c,
                                data: chunkBase64
                            });

                            uploadedOverallBytes += (end - start);
                            setUploadProgress(Math.min(99, Math.round((uploadedOverallBytes / totalOverallBytes) * 100)));
                        })());
                    }
                    await Promise.all(batchPromises);
                }

                await updateDoc(doc(db, collectionName, fileDocRef.id), { status: 'completed' });

                await sendFileNotification({
                    title: `File Baru: ${file.name}`,
                    fileName: file.name,
                    category: fileCategory,
                    uploadedBy: user?.email || 'User DME',
                    targetTab: 'files',
                    searchQuery: file.name
                });
            }

            setUploadProgress(100);

            setUploadedFilesCount(selectedFiles.length);
            setShowSuccessModal(true);

            setSelectedFiles([]);
            setSelectedCategory(simpleMode ? 'Dokumen' : 'Laporan Harian');
            setCustomCategory('');
            setDescription('');
            setUploading(false);

            toast.success(`${selectedFiles.length} file berhasil diunggah!`);
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Gagal mengunggah beberapa file');
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!canDelete) return;

        if (selectedFileIds.length > 0 && !fileToDelete) {
            await performBulkDelete(selectedFileIds, `Deleting ${selectedFileIds.length} files...`);
            return;
        }

        if (!fileToDelete) return;

        setIsBulkDeleting(true);
        try {
            if (fileToDelete.isCorrectiveReport) {
                const reportDocId = fileToDelete.originalReport?.id || fileToDelete.id.replace('cm_', '');
                await deleteDoc(doc(db, 'corrective_reports', reportDocId));
                toast.success('Laporan berhasil dihapus!');
            } else {
                const batch = writeBatch(db);

                const chunksSnapshot = await getDocs(collection(db, collectionName, fileToDelete.id, 'chunks'));

                chunksSnapshot.docs.forEach((chunkDoc) => {
                    batch.delete(chunkDoc.ref);
                });

                const fileRef = doc(db, collectionName, fileToDelete.id);
                batch.delete(fileRef);

                await batch.commit();

                toast.success('File berhasil dihapus!');
            }
            setDeleteModalOpen(false);
            setFileToDelete(null);
        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error('Gagal menghapus file');
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const performBulkDelete = async (ids: string[], loadingMessage: string) => {
        if (ids.length === 0 || !canDelete) return;

        setIsBulkDeleting(true);
        const toastId = toast.loading(loadingMessage);

        try {
            for (const fileId of ids) {
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

            toast.success(`Tindakan berhasil diselesaikan!`, { id: toastId });
            setSelectedFileIds([]);
            setFileToDelete(null);
            setDeleteModalOpen(false);
        } catch (error) {
            console.error('Error in bulk delete:', error);
            toast.error('Gagal menyelesaikan beberapa operasi', { id: toastId });
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
            filterCategory === 'All' || matchCategory(file.category, filterCategory);
        const matchesYear =
            filterYear === 'All' || file.year === filterYear;
        return matchesSearch && matchesCategory && matchesYear;
    });

    const displayFiles = filteredFiles.filter((file) => {
        if (selectedFolder && !matchCategory(file.category, selectedFolder)) {
            return false;
        }
        if (selectedQuarter && selectedFolder !== 'SLD') {
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
        return true;
    });

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const getFileIcon = (fileType: string) => {
        if (fileType.includes('pdf')) return '📄';
        if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
        if (fileType.includes('word') || fileType.includes('document')) return '📝';
        return '📁';
    };

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
                                accept=".pdf,.xlsx,.xls,.docx,.doc"
                                onChange={handleFileSelect}
                                disabled={uploading}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-800 font-bold">Klik atau seret file untuk mengunggah</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">PDF, Excel, Word - Maks 60MB per file</p>
                        </div>

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

                                {selectedCategory !== 'SLD' && (
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
                                        Memproses...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5" />
                                        Unggah File
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
                ) : selectedFolder && !selectedQuarter && selectedFolder !== 'SLD' ? (
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
                ) : selectedFolder && selectedQuarter && !selectedMType && ['MOP', 'JSEA', 'PTW', 'Risk Register', 'D-DAY', 'Service Report', 'Service Report Approved'].includes(selectedFolder) ? (
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
                                {canDelete && (
                                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
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
                                            <span className="text-sm font-medium text-slate-700">
                                                Pilih Semua File ({displayFiles.length})
                                            </span>
                                        </div>

                                        {selectedFileIds.length > 0 && (
                                            <motion.button
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                onClick={() => {
                                                    setFileToDelete(null);
                                                    setDeleteModalOpen(true);
                                                }}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg border border-red-200 transition text-sm font-bold shadow-xs cursor-pointer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete Selected ({selectedFileIds.length})
                                            </motion.button>
                                        )}
                                    </div>
                                )}

                                {displayFiles.map((file) => (
                                    <motion.div
                                        key={file.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className={`bg-slate-50/80 hover:bg-slate-100/90 rounded-xl p-3.5 sm:p-4 border transition-all duration-200 shadow-xs flex items-start sm:items-center gap-3 sm:gap-4 ${selectedFileIds.includes(file.id) ? 'border-blue-500 bg-blue-50/60 shadow-sm' : 'border-slate-200/80 hover:border-slate-300'
                                            }`}
                                    >
                                        {canDelete && (
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

                                                {canDelete && (
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => {
                                                            setFileToDelete(file);
                                                            setSelectedFileIds([]);
                                                            setDeleteModalOpen(true);
                                                        }}
                                                        className="p-2 sm:p-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all border border-red-200/80 shadow-xs cursor-pointer"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </motion.button>
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

            <AnimatePresence>
                {deleteModalOpen && (fileToDelete || selectedFileIds.length > 0) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => {
                            if (!isBulkDeleting) setDeleteModalOpen(false);
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-slate-900">
                                    {selectedFileIds.length > 0 ? 'Delete Multiple Files' : 'Delete File'}
                                </h3>
                                <button
                                    onClick={() => {
                                        setDeleteModalOpen(false);
                                    }}
                                    disabled={isBulkDeleting}
                                    className="p-1 hover:bg-slate-700 rounded-lg transition disabled:opacity-50"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            <p className="text-slate-600 mb-6">
                                {selectedFileIds.length > 0 ? (
                                    <>Are you sure you want to delete <span className="font-medium text-slate-900">{selectedFileIds.length} selected files</span>?</>
                                ) : (
                                    <>Are you sure you want to delete <span className="font-medium text-slate-900">{fileToDelete?.fileName}</span>?</>
                                )}
                                {' This action cannot be undone and will remove all file data.'}
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setDeleteModalOpen(false);
                                    }}
                                    disabled={isBulkDeleting}
                                    className="flex-1 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium transition disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isBulkDeleting}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isBulkDeleting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        'Delete'
                                    )}
                                </button>
                            </div>
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
                            className="bg-white rounded-2xl p-8 max-w-sm w-full border border-slate-200 text-center shadow-2xl relative overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
                            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl" />

                            <div className="relative z-10">
                                <div className="w-20 h-20 bg-blue-50 border border-blue-200/80 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xs">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.2 }}
                                    >
                                        <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </motion.div>
                                </div>

                                <h3 className="text-2xl font-black text-slate-900 mb-2">Upload Berhasil!</h3>
                                <p className="text-slate-600 text-sm mb-6 px-2 font-medium">
                                    <span className="text-blue-600 font-bold">{uploadedFilesCount} file(s)</span> telah berhasil disimpan ke sistem.
                                </p>

                                <button
                                    onClick={() => setShowSuccessModal(false)}
                                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.98]"
                                >
                                    Selesai
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

