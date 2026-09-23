// ============================================================================
// FILE: DocumentList.tsx
// Deskripsi: Modul Arsip Dokumen Laporan Pemeliharaan Terpusat (Arsip Dokumen ISO / UTT).
//            Menyediakan antarmuka pencarian, penyaringan tanggal, pengurutan,
//            preview isi laporan (Viewer modal), sunting data, hapus laporan,
//            serta ekspor langsung ke format PDF & Excel (.xlsx) resmi.
//            Mendukung 14 jenis Service Report Perangkat M/E & Laporan Inspeksi HSE.
// ============================================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, Download, Trash2, Search, Filter, Clock, FileDown, FileType, Pencil, Box, Folder, ChevronLeft, ChevronRight, ClipboardList, FileCheck, Camera, FolderArchive, Shield, X, AlertTriangle, FolderDown, FolderOpen, CheckCircle2, FileUp, Layers, Upload, RotateCw, Calendar, RefreshCw, UserCheck } from 'lucide-react';
import { collection, query, getDocs, getDocsFromCache, getCountFromServer, deleteDoc, doc, where, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { offlineReportStorage } from '@/utils/offlineReportStorage';
import { exportUniversalServiceReportExcel } from '@/service_reports/common/serviceReportExcel';
import { generateReportPDF, loadLogoBase64 } from '@/utils/ReportPdfExport';
import { PDFDocument } from 'pdf-lib';
import { renderExcelToPdfPage } from '@/utils/excelToPdfConverter';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import logoK2 from '@/assets/logo_k2.png';
import logoBRI from '@/assets/bri_logo.png';
import logoBRILeft from '@/assets/bri_left_logo.png';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { FileManagement } from './FileManagement';
import { FindingArchive } from './FindingArchive';
import { generateHSEPdf, generateHSEPdfBlob } from '@/utils/HSEPdfExport';
import { exportHSEInspectionRecapPDF } from '@/utils/HSEInspectionRecapPdfExport';
import { generateHSETbmPdfBlob, exportHSETbmPDF } from '@/utils/HSETbmPdfExport';
import { generateHSESafetyInductionPdfBlob, exportHSESafetyInductionPDF } from '@/utils/HSESafetyInductionPdfExport';
import { HSETbmRecord, HSESafetyInductionRecord } from '@/types/hseTbmInductionTypes';

import { generateUniversalServiceReportPDF } from '@/service_reports/universalServiceReportPDF';
import { downloadPDFBlob } from '@/utils/pdfDownload';
import { UploadSRModal } from './UploadSRModal';
import { AbnormalReportModal } from './AbnormalReportModal';
import { HSEReportViewer } from './HSEReportViewer';
import { isServiceReportSupported } from '@/config/serviceReportRegistry';
import { getDoc } from 'firebase/firestore';
import { safeStorage } from '@/utils/safeStorage';

interface PhotoData {
  index: number;
  description: string;
  photoBase64: string;
  hasPhoto: boolean;
}

export interface AbnormalFinding {
  unitName?: string;
  description: string;
  actionRecommendation?: string;
  recommendation?: string;
  photoBase64?: string;
  reportedBy?: string;
  reportedAt?: string | Date;
  partName?: string;
  partNumber?: string;
  brandName?: string;
  quantity?: string;
  findingDate?: string;
  remark?: string;
  photos?: { base64: string; description?: string }[];
}

export interface ExcelDocument {
  id: string;
  fileName: string;
  maintenanceName: string;
  maintenanceTime: string;
  specificDetail?: string;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
  fileSize: number;
  totalPhotos: number;
  photosWithImage: number;
  photosData: PhotoData[];
  documentType: 'excel' | 'pdf' | 'hse';
  collectionName?: 'pdf_documents' | 'excel_documents' | 'hse' | 'findings';
  companyType?: 'neutra' | 'bri' | 'k2';
  hasAbnormal?: boolean;
  abnormalFinding?: AbnormalFinding | null;
  hseType?: 'inspection' | 'sio' | 'silo' | 'tbm' | 'induction';
  totalSDM?: number;
  inductionPerson?: string;
  companyName?: string;
  maintenanceType?: string;
  atsCustomerInfo?: any;
  atsReportData?: any;
  atsTimeSpent?: any;
  fcuCustomerInfo?: any;
  fcuReportData?: any;
  fcuTimeSpent?: any;
  pjuCustomerInfo?: any;
  pjuReportData?: any;
  pjuTimeSpent?: any;
  pduCustomerInfo?: any;
  pduReportData?: any;
  pduTimeSpent?: any;
  ctCustomerInfo?: any;
  ctReportData?: any;
  ctTimeSpent?: any;
  generatorCustomerInfo?: any;
  generatorReportData?: any;
  generatorTimeSpent?: any;
  acSplitCustomerInfo?: any;
  acSplitReportData?: any;
  acSplitTimeSpent?: any;
  trafoCustomerInfo?: any;
  trafoReportData?: any;
  trafoTimeSpent?: any;
  capacitorbankCustomerInfo?: any;
  capacitorbankReportData?: any;
  capacitorbankTimeSpent?: any;
  busductCustomerInfo?: any;
  docklevelerCustomerInfo?: any;
  doorCustomerInfo?: any;
  ldbrdbCustomerInfo?: any;
  serviceReportPayload?: any;
  hasServiceReport?: boolean;
  deleteRequested?: boolean;
  deleteRequestedBy?: string;
  deleteReason?: string;
  [key: string]: any;
}

export const getDocumentDate = (doc?: { maintenanceTime?: string; createdAt?: Date | any } | null): Date => {
  if (!doc) return new Date();

  if (doc.maintenanceTime && typeof doc.maintenanceTime === 'string') {
    const raw = doc.maintenanceTime.trim();
    if (raw) {
      // Jika rentang tanggal (misal "2026-07-30 - 2026-07-31"), ambil tanggal pertama
      const firstPart = raw.includes(' - ') ? raw.split(' - ')[0].trim() : raw;

      // Cek format standar YYYY-MM-DD atau YYYY/MM/DD
      const ymdMatch = firstPart.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      if (ymdMatch) {
        const year = parseInt(ymdMatch[1], 10);
        const month = parseInt(ymdMatch[2], 10) - 1;
        const day = parseInt(ymdMatch[3], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }

      // Cek format DD/MM/YYYY atau DD-MM-YYYY
      const dmyMatch = firstPart.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10) - 1;
        const year = parseInt(dmyMatch[3], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }

      // Fallback ke Date parser bawaan
      const parsed = new Date(firstPart);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  if (doc.createdAt) {
    if (doc.createdAt instanceof Date && !isNaN(doc.createdAt.getTime())) {
      return doc.createdAt;
    }
    if (typeof (doc.createdAt as any).toDate === 'function') {
      return (doc.createdAt as any).toDate();
    }
    const d = new Date(doc.createdAt);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date();
};

/**
 * Mengambil timestamp waktu masuk atau aktivitas update terakhir (dalam milidetik).
 * Prioritas:
 * 1. doc.updatedAt (waktu diekspor ulang / di-update / upload SR)
 * 2. doc.createdAt (waktu file pertama kali dibuat / diekspor ke arsip)
 * 3. getDocumentDate(doc) (fallback tanggal maintenance jika tidak ada timestamp sistem)
 */
export const getDocumentActivityTime = (doc?: { updatedAt?: Date | any; createdAt?: Date | any; maintenanceTime?: string } | null): number => {
  if (!doc) return 0;

  if (doc.updatedAt) {
    if (doc.updatedAt instanceof Date && !isNaN(doc.updatedAt.getTime())) {
      return doc.updatedAt.getTime();
    }
    if (typeof doc.updatedAt.toDate === 'function') {
      const d = doc.updatedAt.toDate();
      if (!isNaN(d.getTime())) return d.getTime();
    }
    const d = new Date(doc.updatedAt);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  if (doc.createdAt) {
    if (doc.createdAt instanceof Date && !isNaN(doc.createdAt.getTime())) {
      return doc.createdAt.getTime();
    }
    if (typeof doc.createdAt.toDate === 'function') {
      const d = doc.createdAt.toDate();
      if (!isNaN(d.getTime())) return d.getTime();
    }
    const d = new Date(doc.createdAt);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  return getDocumentDate(doc).getTime();
};

export const getTimestampDate = (data: any, field: string): Date | null => {
  if (!data) return null;
  const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
  const val = data[field] !== undefined ? data[field] : data[snakeField];
  if (val === null || val === undefined) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val.toDate === 'function') {
    const d = val.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export type SortOption = 'newest_upload' | 'maintenance_newest' | 'maintenance_oldest' | 'newest' | 'oldest';

export const sortDocumentsList = (docs: ExcelDocument[], sortOption: SortOption): ExcelDocument[] => {
  return [...docs].sort((a, b) => {
    if (sortOption === 'newest_upload' || sortOption === 'newest') {
      const actA = getDocumentActivityTime(a);
      const actB = getDocumentActivityTime(b);
      if (actB !== actA) return actB - actA;
      // Tie-breaker: maintenance date desc
      const maintA = getDocumentDate(a).getTime();
      const maintB = getDocumentDate(b).getTime();
      if (maintB !== maintA) return maintB - maintA;
      return (b.id || '').localeCompare(a.id || '');
    }

    if (sortOption === 'maintenance_oldest' || sortOption === 'oldest') {
      const maintA = getDocumentDate(a).getTime();
      const maintB = getDocumentDate(b).getTime();
      if (maintA !== maintB) return maintA - maintB;
      // Tie-breaker: activity asc
      const actA = getDocumentActivityTime(a);
      const actB = getDocumentActivityTime(b);
      if (actA !== actB) return actA - actB;
      return (a.id || '').localeCompare(b.id || '');
    }

    // maintenance_newest
    const maintA = getDocumentDate(a).getTime();
    const maintB = getDocumentDate(b).getTime();
    if (maintB !== maintA) return maintB - maintA;
    // Tie-breaker: activity desc
    const actA = getDocumentActivityTime(a);
    const actB = getDocumentActivityTime(b);
    if (actB !== actA) return actB - actA;
    return (b.id || '').localeCompare(a.id || '');
  });
};

export const getMonthYearString = (date: Date) => {
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

export const getWeekOfMonth = (date: Date) => {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  return Math.ceil((dayOfMonth + firstDayOfMonth.getDay()) / 7);
};

// Helper: Format tanggal dokumen ke string YYYY-MM-DD
export const getDocDateString = (doc: ExcelDocument): string => {
  const d = getDocumentDate(doc);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Format tanggal Indonesia (e.g. 15 Sep 2026)
const formatIndonesianDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    return dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// Helper: Rentang tanggal preset (Bulan Ini, Bulan Lalu, Tahun Ini, dll)
const getPresetRange = (preset: 'this_month' | 'last_month' | 'this_year' | 'all') => {
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth(); // 0-indexed

  if (preset === 'this_month') {
    const start = `${curY}-${String(curM + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(curY, curM + 1, 0).getDate();
    const end = `${curY}-${String(curM + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }
  if (preset === 'last_month') {
    const prevDate = new Date(curY, curM - 1, 1);
    const prevY = prevDate.getFullYear();
    const prevM = prevDate.getMonth();
    const start = `${prevY}-${String(prevM + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(prevY, prevM + 1, 0).getDate();
    const end = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }
  if (preset === 'this_year') {
    return { start: `${curY}-01-01`, end: `${curY}-12-31` };
  }
  return { start: '', end: '' };
};

// ============================================================================
// MODULE-LEVEL IN-MEMORY CACHE (Mencegah lonjakan Firestore reads saat ganti tab)
// ============================================================================
const memoryCachedDocs: { [key: string]: { docs: ExcelDocument[]; timestamp: number } } = {};
const MEMORY_CACHE_TTL = 10 * 60 * 1000; // 10 menit TTL

export const invalidateDocumentsCache = () => {
  for (const key of Object.keys(memoryCachedDocs)) {
    delete memoryCachedDocs[key];
  }
};

interface DocumentListProps {
  onEdit?: (doc: ExcelDocument) => void;
  filterOverride?: 'hse_utt';
  initialSearchQuery?: string;
  initialFolder?: string | null;
  viewMode?: 'folder' | 'flat';
}

export function DocumentList({ onEdit, filterOverride, initialSearchQuery, initialFolder, viewMode = 'folder' }: DocumentListProps) {
  const { user, userRole, companyType, isQcDme } = useAuth();
  // Access mode must follow the assigned role, not the email domain.
  const isDME = userRole === 'DME' || userRole === 'site_manager_dme';
  const isAdmin = userRole === 'admin' || isQcDme;
  const isPrivileged = isAdmin || userRole === 'manager' || userRole === 'site_manager' || userRole === 'hse' ||
    userRole === 'dirut' || userRole === 'direksiSDM' || userRole === 'DireksiKeuangan';
  const isEngineer = userRole === 'engineer' || userRole === 'Engineer_K2' || userRole === 'engineer_k2' || userRole === 'standby_engineer' || userRole === 'tde' || userRole === 'cbre' || Boolean(user?.email && isServiceReportSupported(user.email));
  const canDelete = isPrivileged || isEngineer;

  const [documents, setDocuments] = useState<ExcelDocument[]>([]);
  const [uploadSrModalDoc, setUploadSrModalDoc] = useState<ExcelDocument | null>(null);
  const [abnormalModalDoc, setAbnormalModalDoc] = useState<ExcelDocument | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ src: string; title: string } | null>(null);
  const [downloadChoiceDoc, setDownloadChoiceDoc] = useState<ExcelDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');

  // HSE Inspection Export Recap Modal State (Filter tgl & opsi rekap PDF)
  const [isHseRecapModalOpen, setIsHseRecapModalOpen] = useState(false);
  const [hseRecapVariant, setHseRecapVariant] = useState<'neutradc' | 'utt'>('neutradc');
  const [hseRecapStartDate, setHseRecapStartDate] = useState('');
  const [hseRecapEndDate, setHseRecapEndDate] = useState('');
  const [isExportingHseRecap, setIsExportingHseRecap] = useState(false);
  const [isExportingHseZip, setIsExportingHseZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<{
    isOpen: boolean;
    current: number;
    total: number;
    percent: number;
    currentFileName: string;
    currentFolder: string;
    stage: 'preparing' | 'processing' | 'compressing' | 'completed';
  }>({
    isOpen: false,
    current: 0,
    total: 0,
    percent: 0,
    currentFileName: '',
    currentFolder: '',
    stage: 'preparing',
  });

  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);
  const [sortBy, setSortBy] = useState<SortOption>('newest_upload');
  const [filterType, setFilterType] = useState<'all' | 'excel' | 'pdf' | 'hse'>('all');
  const [srStatusFilter, setSrStatusFilter] = useState<'all' | 'photos_only' | 'with_sr' | 'abnormal_only'>('all');
  const [adminDeleteFilter, setAdminDeleteFilter] = useState<'all' | 'pending_delete'>('all');
  const [dmeAbnormalOnlyFilter, setDmeAbnormalOnlyFilter] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<ExcelDocument | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [previewHseDoc, setPreviewHseDoc] = useState<ExcelDocument | null>(null);

  const [currentLevel, setCurrentLevel] = useState<'root' | 'category' | 'maintenance' | 'month' | 'week'>('root');
  const [selectedCategory, setSelectedCategory] = useState<'inspection' | 'sio' | 'silo' | 'tbm' | 'induction' | null>(null);
  const [selectedMaintenance] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const [dmeLevel, setDmeLevel] = useState<'root' | 'account' | 'month' | 'date' | 'documents' | 'management_files'>(() => {
    return (safeStorage.getItem('dme_folder_level') as any) || 'root';
  });
  const [dmeSelectedFolder, setDmeSelectedFolder] = useState<string | null>(() => {
    return safeStorage.getItem('dme_folder_name') || null;
  });
  const [dmeSelectedAccount, setDmeSelectedAccount] = useState<string | null>(() => {
    return safeStorage.getItem('dme_folder_account') || null;
  });
  const [dmeSelectedMonth, setDmeSelectedMonth] = useState<string | null>(() => {
    return safeStorage.getItem('dme_folder_month') || null;
  });
  const [dmeSelectedDate, setDmeSelectedDate] = useState<string | null>(() => {
    return safeStorage.getItem('dme_folder_date') || null;
  });
  const [managementFilesCount, setManagementFilesCount] = useState(0);
  const [managementFilesSize, setManagementFilesSize] = useState(0);
  const [dmeSearchMode, setDmeSearchMode] = useState<'folder' | 'files'>(() => {
    return (initialSearchQuery && !initialFolder) ? 'files' : 'folder';
  });

  const prevInitialFolderRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (initialFolder !== undefined && initialFolder !== prevInitialFolderRef.current) {
      prevInitialFolderRef.current = initialFolder;
      if (initialFolder) {
        if (initialFolder === 'PM' || initialFolder === 'Folder PM') {
          setDmeLevel('account');
          setDmeSelectedFolder(null);
        } else {
          setDmeSelectedFolder(initialFolder);
          setDmeLevel('management_files');
          setDmeSearchMode('folder');
        }
      }
    }
  }, [initialFolder]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setDmeSearchMode('folder');
    }
  }, [searchQuery]);

  useEffect(() => {
    safeStorage.setItem('dme_folder_level', dmeLevel);
  }, [dmeLevel]);

  useEffect(() => {
    if (dmeSelectedFolder) safeStorage.setItem('dme_folder_name', dmeSelectedFolder);
    else safeStorage.removeItem('dme_folder_name');
  }, [dmeSelectedFolder]);

  useEffect(() => {
    if (dmeSelectedAccount) safeStorage.setItem('dme_folder_account', dmeSelectedAccount);
    else safeStorage.removeItem('dme_folder_account');
  }, [dmeSelectedAccount]);

  useEffect(() => {
    if (dmeSelectedMonth) safeStorage.setItem('dme_folder_month', dmeSelectedMonth);
    else safeStorage.removeItem('dme_folder_month');
  }, [dmeSelectedMonth]);

  useEffect(() => {
    if (dmeSelectedDate) safeStorage.setItem('dme_folder_date', dmeSelectedDate);
    else safeStorage.removeItem('dme_folder_date');
  }, [dmeSelectedDate]);

  const contentAreaRef = useRef<HTMLDivElement>(null);

  const scrollToContent = (isRoot = false) => {
    if (isRoot) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setTimeout(() => {
      if (contentAreaRef.current) {
        const navOffset = 80;
        const elementPosition = contentAreaRef.current.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - navOffset;
        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth',
        });
      }
    }, 50);
  };

  useEffect(() => {
    const isRoot = dmeLevel === 'root' && !dmeSelectedFolder;
    scrollToContent(isRoot);
  }, [dmeLevel, dmeSelectedFolder, dmeSelectedAccount, dmeSelectedMonth, dmeSelectedDate]);

  useEffect(() => {
    const isRoot = currentLevel === 'root' && !selectedCategory;
    scrollToContent(isRoot);
  }, [currentLevel, selectedCategory, selectedMonth, selectedWeek, selectedMaintenance]);

  // Ref for aborting stale fetchDocuments calls when auth/filter changes
  const fetchIdRef = useRef(0);

  /**
   * Parses a Firestore snapshot into ExcelDocument[] using a mapper function.
   * Pure helper — no side-effects.
   */
  const parseSnapshot = (
    snapshot: any,
    mapper: (docId: string, data: any) => ExcelDocument
  ): ExcelDocument[] => {
    const result: ExcelDocument[] = [];
    if (!snapshot) return result;
    snapshot.forEach((docSnap: any) => {
      const data = docSnap.data({ serverTimestamps: 'estimate' }) || docSnap.data();
      result.push(mapper(docSnap.id, data));
    });
    return result;
  };

  const fetchDocuments = useCallback(async (isForceRefresh = false) => {
    // Guard: wait until auth fully resolves role (prevents double-fetch on login)
    if (!user || userRole === undefined) return;

    const currentFetchId = ++fetchIdRef.current;

    try {
      setFetchError(null);

      const cacheKey = `${(user?.email || 'anon').toLowerCase().trim()}_${filterOverride || 'all'}`;

      // In-Memory Cache Check: Jangan query Firestore server jika baru di-fetch kurang dari 10 menit lalu
      if (!isForceRefresh && memoryCachedDocs[cacheKey] && (Date.now() - memoryCachedDocs[cacheKey].timestamp < MEMORY_CACHE_TTL)) {
        if (currentFetchId === fetchIdRef.current) {
          setDocuments(memoryCachedDocs[cacheKey].docs);
          setLoading(false);
          return;
        }
      }

      const userEmailClean = (user?.email || '').toLowerCase().trim();
      const isAHUUser = userEmailClean === 'ahu@gmail.com' || userEmailClean === 'ahhu@utt.com' || userEmailClean === 'ahu@utt.com' || userEmailClean === 'ahhu@gmail.com';
      const queryEmails = isAHUUser ? ['ahu@gmail.com', 'ahhu@utt.com', 'ahu@utt.com', 'ahhu@gmail.com'] : [userEmailClean];

      const normalizeCreatedBy = (email?: string | null): string => {
        if (!email) return 'Unknown';
        const clean = email.trim().toLowerCase();
        if (clean === 'ahhu@utt.com' || clean === 'ahhu@gmail.com' || clean === 'ahu@utt.com' || clean === 'ahu@gmail.com') {
          return 'ahu@gmail.com';
        }
        return clean;
      };

      // Build queries once (shared between cache pass and server pass)
      const buildQueries = () => {
        let excelQuery: any = null;
        let pdfQuery: any = null;
        let hseQuery: any = null;

        if (filterOverride !== 'hse_utt') {
          const isPrivilegedOrDME = isPrivileged || isDME;
          const shouldFetchExcel = !isDME || isQcDme;
          if (shouldFetchExcel) {
            excelQuery = isPrivilegedOrDME
              ? query(collection(db, 'excel_documents'))
              : (isAHUUser
                ? query(collection(db, 'excel_documents'), where('createdBy', 'in', queryEmails))
                : query(collection(db, 'excel_documents'), where('createdBy', '==', userEmailClean)));
          }
          pdfQuery = isPrivilegedOrDME
            ? query(collection(db, 'pdf_documents'))
            : (isAHUUser
              ? query(collection(db, 'pdf_documents'), where('createdBy', 'in', queryEmails))
              : query(collection(db, 'pdf_documents'), where('createdBy', '==', userEmailClean)));
        }

        const showHSE = (isAdmin || userRole === 'hse' || filterOverride === 'hse_utt') && (!isDME || filterOverride === 'hse_utt');
        if (showHSE) {
          if (filterOverride === 'hse_utt') {
            hseQuery = query(collection(db, 'hse'), where('reportType', '==', 'utt'));
          } else if (isAdmin) {
            hseQuery = query(collection(db, 'hse'));
          } else {
            hseQuery = query(collection(db, 'hse'), where('authorEmail', 'in', isAHUUser ? queryEmails : [(user.email || '').toLowerCase()]));
          }
        }

        return { excelQuery, pdfQuery, hseQuery };
      };

      const { excelQuery, pdfQuery, hseQuery } = buildQueries();

      // Shared doc mappers
      const mapExcel = (docId: string, data: any): ExcelDocument => {
        const createdAt = getTimestampDate(data, 'createdAt') || (data.maintenanceTime ? getDocumentDate(data) : new Date());
        const updatedAt = getTimestampDate(data, 'updatedAt') || createdAt;
        return {
          id: docId,
          fileName: data.fileName,
          maintenanceName: data.maintenanceName,
          maintenanceTime: data.maintenanceTime,
          specificDetail: data.specificDetail,
          createdAt,
          updatedAt,
          createdBy: normalizeCreatedBy(data.createdBy),
          fileSize: data.fileSize || 0,
          totalPhotos: data.totalPhotos || 0,
          photosWithImage: data.photosWithImage || 0,
          photosData: [], // Optimized: photosData is lazily loaded on edit
          documentType: 'excel',
          hasAbnormal: data.hasAbnormal || false,
          abnormalFinding: data.abnormalFinding || null,
          atsCustomerInfo: data.atsCustomerInfo,
          atsReportData: data.atsReportData,
          atsTimeSpent: data.atsTimeSpent,
          fcuCustomerInfo: data.fcuCustomerInfo,
          fcuReportData: data.fcuReportData,
          fcuTimeSpent: data.fcuTimeSpent,
          deleteRequested: data.deleteRequested || false,
          deleteRequestedBy: data.deleteRequestedBy || '',
          deleteReason: data.deleteReason || '',
        };
      };

      const mapPdf = (docId: string, data: any): ExcelDocument => {
        const createdAt = getTimestampDate(data, 'createdAt') || (data.maintenanceTime ? getDocumentDate(data) : new Date());
        const updatedAt = getTimestampDate(data, 'updatedAt') || createdAt;
        return {
          id: docId,
          fileName: data.fileName,
          maintenanceName: data.maintenanceName,
          maintenanceTime: data.maintenanceTime,
          specificDetail: data.specificDetail,
          createdAt,
          updatedAt,
          createdBy: normalizeCreatedBy(data.createdBy),
          fileSize: data.fileSize || 0,
          totalPhotos: data.totalPhotos || 0,
          photosWithImage: data.photosWithImage || 0,
          photosData: [], // Optimized: photosData is lazily loaded on edit
          documentType: 'pdf',
          hasAbnormal: data.hasAbnormal || false,
          abnormalFinding: data.abnormalFinding || null,
          atsCustomerInfo: data.atsCustomerInfo,
          atsReportData: data.atsReportData,
          atsTimeSpent: data.atsTimeSpent,
          fcuCustomerInfo: data.fcuCustomerInfo,
          fcuReportData: data.fcuReportData,
          fcuTimeSpent: data.fcuTimeSpent,
          serviceReportPayload: data.serviceReportPayload || null,
          hasServiceReport: Boolean(data.hasServiceReport || data.attachedSrFile || data.attachedSrBase64 || data.serviceReportPayload),
          attachedSrFile: data.attachedSrFile || null,
          attachedSrBase64: data.attachedSrBase64 || null,
          deleteRequested: data.deleteRequested || false,
          deleteRequestedBy: data.deleteRequestedBy || '',
          deleteReason: data.deleteReason || '',
        };
      };

      const mapHse = (docId: string, data: any): ExcelDocument => {
        const createdAt = getTimestampDate(data, 'createdAt') || (data.date ? getDocumentDate({ maintenanceTime: data.date }) : new Date());
        const updatedAt = getTimestampDate(data, 'updatedAt') || createdAt;
        
        let fileName = `HSE_${data.aktivitas || 'Report'}_${data.date || ''}.pdf`;
        let maintenanceName = data.aktivitas || 'Laporan HSE';
        let specificDetail = data.lokasi || '';
        const hseType = data.hseType || 'inspection';

        if (hseType === 'tbm') {
          fileName = data.fileName || `TBM_${data.date || ''}.pdf`;
          maintenanceName = data.aktivitas || `Absen TBM (${data.totalSDM || 0} Personel)`;
          specificDetail = `Total SDM: ${data.totalSDM || 0} Orang`;
        } else if (hseType === 'induction') {
          fileName = data.fileName || `Induction_${data.nama || 'Peserta'}_${data.perusahaan || 'PT'}.pdf`;
          maintenanceName = data.aktivitas || `Safety Induction - ${data.nama || 'Peserta'} (${data.perusahaan || 'PT'})`;
          specificDetail = `Perusahaan: ${data.perusahaan || '-'}`;
        }

        return {
          id: docId,
          fileName,
          maintenanceName,
          maintenanceTime: data.date || '',
          specificDetail,
          createdAt,
          updatedAt,
          createdBy: normalizeCreatedBy(data.authorEmail),
          fileSize: 0,
          totalPhotos: data.photos?.length || 0,
          photosWithImage: data.photos?.length || 0,
          photosData: [],
          documentType: 'hse',
          hasAbnormal: data.hasAbnormal || false,
          abnormalFinding: data.abnormalFinding || null,
          hseType,
          maintenanceType: data.maintenanceType || (hseType === 'tbm' ? 'TBM' : hseType === 'induction' ? 'INDUCTION' : 'OTHER'),
          totalSDM: data.totalSDM,
          inductionPerson: data.nama,
          companyName: data.perusahaan,
          deleteRequested: data.deleteRequested || false,
          deleteRequestedBy: data.deleteRequestedBy || '',
          deleteReason: data.deleteReason || '',
        };
      };

      /** Merges parsed docs + offline reports -> sorted ExcelDocument[] */
      const assembleAllDocs = async (
        excelDocs: ExcelDocument[],
        pdfDocs: ExcelDocument[],
        hseDocs: ExcelDocument[]
      ): Promise<ExcelDocument[]> => {
        // Gabungkan laporan offline dari IndexedDB lokal jika belum ada di Firestore
        try {
          const offlineReports = await offlineReportStorage.getAllReports(user?.email || undefined);
          const existingPdfIds = new Set(pdfDocs.map(d => d.id));
          offlineReports.forEach(offDoc => {
            if (!existingPdfIds.has(offDoc.id)) {
              const createdAt = offDoc.createdAt ? new Date(offDoc.createdAt) : new Date();
              const updatedAt = offDoc.updatedAt ? new Date(offDoc.updatedAt) : createdAt;
              pdfDocs.push({
                id: offDoc.id,
                fileName: offDoc.fileName,
                maintenanceName: offDoc.maintenanceName,
                maintenanceTime: offDoc.maintenanceTime,
                specificDetail: offDoc.specificDetail,
                createdAt,
                updatedAt,
                createdBy: normalizeCreatedBy(offDoc.createdBy),
                fileSize: offDoc.fileSize || 0,
                totalPhotos: offDoc.totalPhotos || 0,
                photosWithImage: offDoc.photosWithImage || 0,
                photosData: [],
                documentType: offDoc.documentType || 'pdf',
                hasAbnormal: offDoc.hasAbnormal || false,
                abnormalFinding: offDoc.abnormalFinding || null,
                serviceReportPayload: offDoc.serviceReportPayload || null,
                hasServiceReport: Boolean(offDoc.attachedSrFile || offDoc.attachedSrBase64),
                attachedSrFile: offDoc.attachedSrFile || null,
                attachedSrBase64: offDoc.attachedSrBase64 || null,
                deleteRequested: false,
                deleteRequestedBy: '',
                deleteReason: '',
              });
            }
          });
        } catch (offErr) {
          console.warn('Gagal memuat offline reports di DocumentList:', offErr);
        }

        const allDocs = filterOverride === 'hse_utt'
          ? hseDocs
          : [...excelDocs, ...pdfDocs, ...hseDocs];

        return sortDocumentsList(allDocs, sortBy);
      };

      // ============ PASS 1: Cache-First (instant) ============
      // Show cached data immediately so the user sees content without waiting for the network.
      let cacheHadData = false;
      try {
        const cacheResults = await Promise.allSettled([
          excelQuery ? getDocsFromCache(excelQuery).catch(() => null) : Promise.resolve(null),
          pdfQuery ? getDocsFromCache(pdfQuery).catch(() => null) : Promise.resolve(null),
          hseQuery ? getDocsFromCache(hseQuery).catch(() => null) : Promise.resolve(null),
        ]);

        const cachedExcel = cacheResults[0].status === 'fulfilled' ? cacheResults[0].value : null;
        const cachedPdf = cacheResults[1].status === 'fulfilled' ? cacheResults[1].value : null;
        const cachedHse = cacheResults[2].status === 'fulfilled' ? cacheResults[2].value : null;

        const excelDocs = parseSnapshot(cachedExcel, mapExcel);
        const pdfDocs = parseSnapshot(cachedPdf, mapPdf);
        const hseDocs = parseSnapshot(cachedHse, mapHse);

        if (excelDocs.length > 0 || pdfDocs.length > 0 || hseDocs.length > 0) {
          cacheHadData = true;
          if (currentFetchId === fetchIdRef.current) {
            const sortedCached = await assembleAllDocs(excelDocs, pdfDocs, hseDocs);
            setDocuments(sortedCached);
            setLoading(false); // Remove spinner immediately — user sees cached data
          }
        }
      } catch (cacheErr) {
        // Cache read failed (e.g. first visit, IndexedDB disabled) — that's fine, we'll fetch from network
        console.warn('[DocumentList] Cache pass skipped:', cacheErr);
      }

      // If cache pass yielded nothing, show loader
      if (!cacheHadData) {
        setLoading(true);
      }

      // Abort if a newer fetch was triggered
      if (currentFetchId !== fetchIdRef.current) return;

      // ============ PASS 2: Server sync (background) ============
      // Each collection gets its own 12-second timeout for resilience.
      const withTimeout = <T,>(promise: Promise<T>, ms = 12000, label = ''): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms)
          ),
        ]);
      };

      const safeFetchFromServer = async (q: any, label: string) => {
        if (!q) return null;
        if (!navigator.onLine) {
          try { return await getDocsFromCache(q); } catch { return null; }
        }
        try {
          return await withTimeout(getDocs(q), 12000, label);
        } catch (err: any) {
          const isQuota = err?.code === 'resource-exhausted' || err?.message?.toLowerCase().includes('quota');
          if (isQuota) {
            console.warn(`[DocumentList] Firestore quota reached for ${label}, fallback to local cache.`);
          } else {
            console.warn(`[DocumentList] Server fetch failed for ${label}, fallback to cache:`, err);
          }
          try { return await getDocsFromCache(q); } catch { return null; }
        }
      };

      // Use Promise.allSettled so one failing collection won't break others
      const serverResults = await Promise.allSettled([
        safeFetchFromServer(excelQuery, 'excel_documents'),
        safeFetchFromServer(pdfQuery, 'pdf_documents'),
        safeFetchFromServer(hseQuery, 'hse'),
      ]);

      // Abort if a newer fetch was triggered
      if (currentFetchId !== fetchIdRef.current) return;

      const serverExcel = serverResults[0].status === 'fulfilled' ? serverResults[0].value : null;
      const serverPdf = serverResults[1].status === 'fulfilled' ? serverResults[1].value : null;
      const serverHse = serverResults[2].status === 'fulfilled' ? serverResults[2].value : null;

      const excelDocs = parseSnapshot(serverExcel, mapExcel);
      const pdfDocs = parseSnapshot(serverPdf, mapPdf);
      const hseDocs = parseSnapshot(serverHse, mapHse);

      // Log partial failures but don't show error UI if cache data is on screen
      const failedCollections: string[] = [];
      if (serverResults[0].status === 'rejected') failedCollections.push('Excel');
      if (serverResults[1].status === 'rejected') failedCollections.push('PDF');
      if (serverResults[2].status === 'rejected') failedCollections.push('HSE');
      if (failedCollections.length > 0) {
        console.warn('[DocumentList] Partial fetch failures:', failedCollections);
      }

      const hasAnyServerData = excelDocs.length > 0 || pdfDocs.length > 0 || hseDocs.length > 0;

      if (hasAnyServerData || failedCollections.length < 3) {
        // At least some server data retrieved successfully — update UI
        const sortedServer = await assembleAllDocs(excelDocs, pdfDocs, hseDocs);
        if (currentFetchId === fetchIdRef.current) {
          setDocuments(sortedServer);
          memoryCachedDocs[cacheKey] = {
            docs: sortedServer,
            timestamp: Date.now(),
          };
          setFetchError(null);
          // Inform user about partial failures without blocking
          if (failedCollections.length > 0 && !cacheHadData) {
            toast.warning(`Sebagian data (${failedCollections.join(', ')}) gagal dimuat. Data yang tersedia tetap ditampilkan.`, { duration: 4000 });
          }
        }
      } else if (!cacheHadData) {
        // All 3 collections failed AND no cache data — attempt offline fallback
        try {
          const fallbackOffline = await offlineReportStorage.getAllReports(user?.email || undefined);
          if (fallbackOffline.length > 0) {
            const localDocs: ExcelDocument[] = fallbackOffline.map(offDoc => {
              const createdAt = offDoc.createdAt ? new Date(offDoc.createdAt) : new Date();
              const updatedAt = offDoc.updatedAt ? new Date(offDoc.updatedAt) : createdAt;
              return {
                id: offDoc.id,
                fileName: offDoc.fileName,
                maintenanceName: offDoc.maintenanceName,
                maintenanceTime: offDoc.maintenanceTime,
                specificDetail: offDoc.specificDetail,
                createdAt,
                updatedAt,
                createdBy: offDoc.createdBy || 'Teknisi DME',
                fileSize: offDoc.fileSize || 0,
                totalPhotos: offDoc.totalPhotos || 0,
                photosWithImage: offDoc.photosWithImage || 0,
                photosData: [],
                documentType: offDoc.documentType || 'pdf',
                hasAbnormal: offDoc.hasAbnormal || false,
                serviceReportPayload: offDoc.serviceReportPayload || null,
                hasServiceReport: Boolean(offDoc.attachedSrFile || offDoc.attachedSrBase64),
                attachedSrFile: offDoc.attachedSrFile || null,
                attachedSrBase64: offDoc.attachedSrBase64 || null,
                deleteRequested: false,
                deleteRequestedBy: '',
                deleteReason: '',
              };
            });
            if (currentFetchId === fetchIdRef.current) {
              setDocuments(sortDocumentsList(localDocs, sortBy));
              setFetchError(null);
              toast.info('Mode Offline: Memuat dokumen arsip dari memori lokal');
            }
          } else {
            if (currentFetchId === fetchIdRef.current) {
              setFetchError('Gagal memuat dokumen. Periksa koneksi internet Anda.');
              toast.error('Gagal memuat dokumen');
            }
          }
        } catch {
          if (currentFetchId === fetchIdRef.current) {
            setFetchError('Gagal memuat dokumen. Periksa koneksi internet Anda.');
            toast.error('Gagal memuat dokumen');
          }
        }
      }
      // else: cacheHadData is true and all server fetches failed → user keeps seeing cached data silently

      // ============ DME Badge Count: non-blocking background task ============
      if (isDME && currentFetchId === fetchIdRef.current) {
        // Fire-and-forget — never blocks UI
        (async () => {
          try {
            // Gunakan getCountFromServer (1 read per koleksi) bukan getDocs (ratusan reads)
            if (navigator.onLine) {
              const [filesCountSnap, correctiveCountSnap] = await Promise.allSettled([
                getCountFromServer(collection(db, 'files')),
                getCountFromServer(collection(db, 'corrective_reports')),
              ]);
              const fCount = filesCountSnap.status === 'fulfilled' ? filesCountSnap.value.data().count : 0;
              const cCount = correctiveCountSnap.status === 'fulfilled' ? correctiveCountSnap.value.data().count : 0;
              if (fCount > 0 || cCount > 0) {
                setManagementFilesCount(fCount + cCount);
                setManagementFilesSize((fCount + cCount) * 512 * 1024); // Estimasi rata-rata ukuran aman
              }
            }
          } catch (err) {
            console.warn('[DocumentList] DME badge count background error:', err);
          }
        })();
      }
    } catch (error: any) {
      console.error('Error in fetchDocuments outer:', error);
      if (currentFetchId === fetchIdRef.current) {
        if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
          setFetchError('Database index diperlukan. Klik link di console browser untuk buat index.');
          toast.error('Database index diperlukan. Klik link di console browser untuk buat index.', { duration: 8000 });
        } else {
          setFetchError('Gagal memuat dokumen. Periksa koneksi internet Anda.');
          toast.error('Gagal memuat dokumen');
        }
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [user, userRole, filterOverride]);

  useEffect(() => {
    // Only trigger fetch when userRole has been fully resolved (not undefined/null on initial auth)
    if (user && userRole !== undefined) {
      fetchDocuments();
    }
  }, [fetchDocuments]);

  const openDeleteModal = (document: ExcelDocument) => {
    setDocumentToDelete(document);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async (reason?: string) => {
    if (!documentToDelete) return;

    try {
      setBulkDeleting(true);
      const collectionName = documentToDelete.documentType === 'hse' ? 'hse' : documentToDelete.documentType + '_documents';

      if (isQcDme) {
        // QC DME approves delete and deletes the document permanently
        const toastId = toast.loading('Menghapus dokumen secara permanen...');
        await deleteDoc(doc(db, collectionName, documentToDelete.id));
        toast.success('Dokumen berhasil dihapus permanen', { id: toastId });
      } else {
        // Non-QC DME (including admin) requests delete
        const toastId = toast.loading('Mengajukan permohonan hapus ke QC DME...');
        const docRef = doc(db, collectionName, documentToDelete.id);
        await updateDoc(docRef, {
          deleteRequested: true,
          deleteRequestedBy: user?.email || (userRole === 'admin' ? 'Admin' : ''),
          deleteReason: reason || '',
          deleteRequestedAt: serverTimestamp(),
        });
        toast.success('Pengajuan hapus dikirim ke QC DME', { id: toastId });
      }

      setDeleteModalOpen(false);
      setDocumentToDelete(null);
      const cacheKey = `${(user?.email || 'anon').toLowerCase().trim()}_${filterOverride || 'all'}`;
      delete memoryCachedDocs[cacheKey];
      fetchDocuments(true);
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Gagal memproses penghapusan');
    } finally {
      setBulkDeleting(false);
    }
  };

  const rejectDeleteRequest = async () => {
    if (!documentToDelete || !isQcDme) return;

    try {
      setBulkDeleting(true);
      const toastId = toast.loading('Menolak pengajuan hapus...');
      const collectionName = documentToDelete.documentType === 'hse' ? 'hse' : documentToDelete.documentType + '_documents';

      const docRef = doc(db, collectionName, documentToDelete.id);
      await updateDoc(docRef, {
        deleteRequested: deleteField(),
        deleteRequestedBy: deleteField(),
        deleteReason: deleteField()
      });

      toast.success('Pengajuan hapus ditolak', { id: toastId });
      setDeleteModalOpen(false);
      setDocumentToDelete(null);
      const cacheKey = `${(user?.email || 'anon').toLowerCase().trim()}_${filterOverride || 'all'}`;
      delete memoryCachedDocs[cacheKey];
      fetchDocuments(true);
    } catch (error) {
      console.error('Error rejecting delete request:', error);
      toast.error('Gagal menolak pengajuan hapus');
    } finally {
      setBulkDeleting(false);
    }
  };

  const buildExcelBlob = async (docData: ExcelDocument): Promise<{ blob: Blob; fileName: string }> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Maintenance Report');
    worksheet.columns = [
      { width: 26 },
      { width: 2 },
      { width: 26 },
      { width: 2 },
      { width: 26 },
    ];
    const formatSingleDateDoc = (dStr: string) => {
      const d = new Date(dStr);
      return !isNaN(d.getTime())
        ? d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : dStr;
    };
    const formattedDate = docData.maintenanceTime?.includes(' - ')
      ? docData.maintenanceTime.split(' - ').map(formatSingleDateDoc).join(' - ')
      : formatSingleDateDoc(docData.maintenanceTime);
    try {
      const effectiveCompanyType = docData.companyType || companyType || 'neutra';
      const leftLogo = effectiveCompanyType === 'bri' ? logoBRILeft : logoDwimitra;
      const logoLeftResponse = await fetch(leftLogo);
      const logoLeftBlob = await logoLeftResponse.blob();
      const logoLeftArrayBuffer = await logoLeftBlob.arrayBuffer();
      const logoLeftBase64 = btoa(
        new Uint8Array(logoLeftArrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte), ''
        )
      );
      const rightLogo = effectiveCompanyType === 'bri' ? logoBRI : effectiveCompanyType === 'k2' ? logoK2 : logoNeutraDC;
      const logoRightResponse = await fetch(rightLogo);
      const logoRightBlob = await logoRightResponse.blob();
      const logoRightArrayBuffer = await logoRightBlob.arrayBuffer();
      const logoRightBase64 = btoa(
        new Uint8Array(logoRightArrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte), ''
        )
      );

      const dwimitraImageId = workbook.addImage({
        base64: logoLeftBase64,
        extension: 'png',
      });

      const neutraDCImageId = workbook.addImage({
        base64: logoRightBase64,
        extension: 'png',
      });
      worksheet.getRow(1).height = 50;
      worksheet.mergeCells('A1:E1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `Dokumentasi PM ${docData.maintenanceName} (${formattedDate})`;
      titleCell.font = { size: 11, bold: true };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
      worksheet.addImage(dwimitraImageId, {
        tl: { col: 0.1, row: 0.15 },
        ext: { width: 130, height: 50 }
      });
      worksheet.addImage(neutraDCImageId, {
        tl: { col: 4.4, row: 0.15 },
        ext: { width: 130, height: 50 }
      });

    } catch (error) {
      console.error('Logo error:', error);
    }
    worksheet.mergeCells('A2:E2');
    const equipmentCell = worksheet.getCell('A2');
    equipmentCell.value = docData.specificDetail || docData.maintenanceName;
    equipmentCell.font = { size: 10, bold: true };
    equipmentCell.alignment = { horizontal: 'center', vertical: 'middle' };
    equipmentCell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
    worksheet.getRow(2).height = 30;
    worksheet.getRow(3).height = 8;
    let currentRow = 4;
    let finalPhotosData = docData.photosData || [];

    if (finalPhotosData.length === 0) {
      try {
        const photosSnap = await getDocs(
          collection(db, `excel_documents/${docData.id}/photos`)
        );
        if (!photosSnap.empty) {
          finalPhotosData = photosSnap.docs
            .map(d => d.data() as PhotoData)
            .sort((a, b) => a.index - b.index);
        }
      } catch (err) {
        console.error('Failed to fetch subcollection photos (Excel):', err);
      }
    }

    const photosData = finalPhotosData;

    for (let i = 0; i < photosData.length; i += 3) {
      const rowCards = photosData.slice(i, i + 3);

      worksheet.getRow(currentRow).height = 160;
      worksheet.getRow(currentRow + 1).height = 35;

      const photoColumns = [0, 2, 4];

      for (let j = 0; j < 3; j++) {
        const card = rowCards[j];
        const colIndex = photoColumns[j];

        const photoCell = worksheet.getCell(currentRow, colIndex + 1);
        photoCell.border = {
          top: { style: 'thick', color: { argb: 'FF000000' } },
          left: { style: 'thick', color: { argb: 'FF000000' } },
          bottom: { style: 'thick', color: { argb: 'FF000000' } },
          right: { style: 'thick', color: { argb: 'FF000000' } }
        };
        photoCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' }
        };

        const captionCell = worksheet.getCell(currentRow + 1, colIndex + 1);
        captionCell.border = {
          top: { style: 'thick', color: { argb: 'FF000000' } },
          left: { style: 'thick', color: { argb: 'FF000000' } },
          bottom: { style: 'thick', color: { argb: 'FF000000' } },
          right: { style: 'thick', color: { argb: 'FF000000' } }
        };
        captionCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        captionCell.font = { size: 9 };

        if (card && card.photoBase64) {
          const base64Data = card.photoBase64.split(',')[1] || card.photoBase64;

          const imageId = workbook.addImage({
            base64: base64Data,
            extension: 'jpeg',
          });

          worksheet.addImage(imageId, {
            tl: { col: colIndex, row: currentRow - 1 },
            ext: { width: 120, height: 150 }
          });

          captionCell.value = card.description || `Photo ${i + j + 1}`;
        } else if (card) {
          photoCell.value = '';
          captionCell.value = card.description || '';
        }
      }

      currentRow += 2;
      worksheet.getRow(currentRow).height = 8;
      currentRow++;
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const fileName = docData.fileName.endsWith('.xlsx') ? docData.fileName : `${docData.fileName}.xlsx`;
    return { blob, fileName };
  };

  const buildPDFBlob = async (docData: ExcelDocument, saveToFile: boolean = false, photosOnly: boolean = false): Promise<{ blob: Blob; fileName: string }[]> => {
    let finalPhotosData = docData.photosData || [];

    if (finalPhotosData.length === 0 && Array.isArray((docData as any).photos) && (docData as any).photos.length > 0) {
      finalPhotosData = (docData as any).photos;
    }

    if (finalPhotosData.length === 0) {
      // 1. Prioritaskan pembacaan dari IndexedDB lokal (offlineReportStorage)
      try {
        const offlinePhotos = await offlineReportStorage.getPhotos(docData.id);
        if (offlinePhotos && offlinePhotos.length > 0) {
          finalPhotosData = offlinePhotos.map(p => ({
            index: p.index,
            description: p.description || '',
            photoBase64: p.photoBase64 || '',
            hasPhoto: p.hasPhoto
          }));
        }
      } catch (offErr) {
        console.warn('offlineReportStorage getPhotos error:', offErr);
      }
    }

    const colName = docData.collectionName || (docData.documentType === 'excel' ? 'excel_documents' : (docData.documentType === 'hse' ? 'hse' : 'pdf_documents'));

    if (finalPhotosData.length === 0) {
      // 2. Fallback ke Firestore subcollection (Online dengan timeout 3.5s atau Cache)
      try {
        const colPath = `${colName}/${docData.id}/photos`;
        let photosSnap: any = null;
        if (navigator.onLine) {
          try {
            const fetchPromise = getDocs(collection(db, colPath));
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500));
            photosSnap = await Promise.race([fetchPromise, timeoutPromise]);
          } catch {
            photosSnap = await getDocsFromCache(collection(db, colPath)).catch(() => null);
          }
        } else {
          photosSnap = await getDocsFromCache(collection(db, colPath)).catch(() => null);
        }

        if (photosSnap && !photosSnap.empty) {
          finalPhotosData = photosSnap.docs
            .map((d: any) => {
              const p = d.data();
              return {
                index: p.index ?? 0,
                description: p.description || p.caption || '',
                photoBase64: p.photoBase64 || p.base64 || p.url || '',
                hasPhoto: p.hasPhoto ?? Boolean(p.photoBase64 || p.base64 || p.url)
              };
            })
            .sort((a: any, b: any) => a.index - b.index);
        }
      } catch (err) {
        console.error('Failed to fetch subcollection photos (PDF):', err);
      }
    }

    // 3. Fallback: Cek jika foto tersimpan di dokumen utama Firestore
    if (finalPhotosData.length === 0) {
      try {
        const docSnap = await getDoc(doc(db, colName, docData.id));
        if (docSnap.exists()) {
          const d = docSnap.data();
          const rawPhotos = d.photos || d.photosData || d.cards;
          if (Array.isArray(rawPhotos) && rawPhotos.length > 0) {
            finalPhotosData = rawPhotos.map((p: any, i: number) => ({
              index: p.index ?? i + 1,
              description: p.description || p.caption || '',
              photoBase64: p.photoBase64 || p.base64 || p.url || '',
              hasPhoto: p.hasPhoto ?? Boolean(p.photoBase64 || p.base64 || p.url)
            }));
          }
        }
      } catch (docErr) {
        console.warn('Failed to check root doc photos:', docErr);
      }
    }

    const cards = finalPhotosData.map((p, i) => ({
      id: `archive_${i}`,
      photo: null as File | null,
      photoBase64: p.photoBase64 || '',
      description: p.description || '',
    }));

    const hasFilledPhotos = cards.some(c => c.photoBase64 || c.description);

    // Kasus A: User memilih HANYA Dokumentasi Foto
    if (photosOnly) {
      if (!hasFilledPhotos) {
        toast.error('Laporan ini tidak memiliki dokumentasi foto.', { id: 'download-photos' });
        return [];
      }

      const effectiveCompanyType = docData.companyType || companyType || 'neutra';
      const leftLogo = effectiveCompanyType === 'bri' ? logoBRILeft : logoDwimitra;
      const rightLogo = effectiveCompanyType === 'bri' ? logoBRI : effectiveCompanyType === 'k2' ? logoK2 : logoNeutraDC;
      const [logoLeftB64, logoRightB64] = await Promise.all([
        loadLogoBase64(leftLogo),
        loadLogoBase64(rightLogo),
      ]);

      const docResult = await generateReportPDF({
        maintenanceName: docData.maintenanceName,
        maintenanceTime: docData.maintenanceTime,
        specificDetail: docData.specificDetail || '',
        vrvUnitDetail: '',
        cards,
        companyType: effectiveCompanyType as 'neutra' | 'bri' | 'k2',
        userEmail: docData.createdBy,
        logos: { left: logoLeftB64, right: logoRightB64 },
        abnormalFinding: docData.hasAbnormal && docData.abnormalFinding ? {
          partName: (docData.abnormalFinding as any).partName || docData.abnormalFinding.unitName || docData.specificDetail || docData.maintenanceName,
          partNumber: (docData.abnormalFinding as any).partNumber || '-',
          brandName: (docData.abnormalFinding as any).brandName || '-',
          quantity: (docData.abnormalFinding as any).quantity ? `${(docData.abnormalFinding as any).quantity}` : '1 Unit',
          findingDate: (docData.abnormalFinding as any).findingDate || (docData.abnormalFinding.reportedAt
            ? (typeof docData.abnormalFinding.reportedAt === 'string'
                ? docData.abnormalFinding.reportedAt.split('T')[0]
                : new Date(docData.abnormalFinding.reportedAt).toLocaleDateString('id-ID'))
            : docData.maintenanceTime),
          remark: docData.abnormalFinding.description || 'Temuan abnormal tercatat pada dokumen ini.',
          actionRecommendation: docData.abnormalFinding.actionRecommendation || undefined,
          photos: ((docData.abnormalFinding as any).photos && (docData.abnormalFinding as any).photos.length > 0)
            ? (docData.abnormalFinding as any).photos
            : (docData.abnormalFinding.photoBase64 ? [{ base64: docData.abnormalFinding.photoBase64, description: 'Bukti Temuan Abnormal' }] : [])
        } : null,
      });

      if (!docResult) {
        toast.error('Gagal membuat PDF dokumentasi foto', { id: 'download-photos' });
        return [];
      }

      const pdfBlob = docResult.doc.output('blob');
      let fileName = docData.fileName.endsWith('.pdf') ? docData.fileName : `${docData.fileName}.pdf`;
      fileName = fileName.replace(/\.pdf$/i, '') + '_Dokumentasi_Foto.pdf';
      if (saveToFile) {
        docResult.doc.save(fileName);
      }
      return [{ fileName, blob: pdfBlob }];
    }

    // Kasus B: photosOnly === false ("Lengkap: Foto + Service Report" atau download default)
    // Siapkan Halaman 1 Service Report terlebih dahulu jika ada
    let srBase64 = docData.attachedSrBase64;
    let srFileName = docData.attachedSrFile?.name;

    if (!srBase64) {
      try {
        const offDoc = await offlineReportStorage.getReport(docData.id);
        if (offDoc?.attachedSrBase64) {
          srBase64 = offDoc.attachedSrBase64;
          srFileName = offDoc.attachedSrFile?.name || srFileName;
        }
      } catch (e) {
        console.warn('Could not read attachedSrBase64 from offline storage:', e);
      }
    }

    let servicePayload = docData.serviceReportPayload;
    if (!srBase64 && !servicePayload) {
      try {
        const docSnap = await getDoc(doc(db, colName, docData.id));
        if (docSnap.exists()) {
          const d = docSnap.data();
          if (d.attachedSrBase64) srBase64 = d.attachedSrBase64;
          if (d.attachedSrFile?.name && !srFileName) srFileName = d.attachedSrFile.name;
          if (d.serviceReportPayload) servicePayload = d.serviceReportPayload;
        }
      } catch (e) {
        console.warn('Could not fetch doc from Firestore for SR:', e);
      }
    }

    let srPdfBytes: ArrayBuffer | Uint8Array | null = null;

    // Prioritas 1: Render 1:1 dari file Excel (.xlsx / .xls) asli yang di-upload oleh user
    if (srBase64) {
      const isPdf =
        docData.attachedSrFile?.type === 'application/pdf' ||
        srFileName?.toLowerCase().endsWith('.pdf') ||
        srBase64.startsWith('data:application/pdf') ||
        srBase64.includes('JVBERi0');

      if (isPdf) {
        const cleanBase64 = srBase64.includes(',') ? srBase64.split(',')[1] : srBase64;
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        srPdfBytes = bytes;
      } else {
        try {
          // Konversi presisi 1:1 langsung dari lembar kerja Excel (.xlsx) ke A4 PDF
          srPdfBytes = await renderExcelToPdfPage(srBase64);
        } catch (excelErr) {
          console.error('Gagal merender lembar Excel ke PDF:', excelErr);
        }
      }
    }

    // Prioritas 2: Fallback render formulir Service Report dari serviceReportPayload
    if (!srPdfBytes && servicePayload && Object.keys(servicePayload).length > 0) {
      try {
        const srDoc = await generateUniversalServiceReportPDF(
          servicePayload,
          [], // KOSONG agar hanya membuat Halaman 1 formulir Service Report
          false
        );
        srPdfBytes = srDoc.output('arraybuffer');
      } catch (srErr) {
        console.error('Gagal membuat Halaman 1 Universal Service Report:', srErr);
      }
    }

    // Sekarang siapkan Dokumentasi Foto jika ada kartu foto terisi
    let docResult: any = null;
    if (hasFilledPhotos) {
      const effectiveCompanyType = docData.companyType || companyType || 'neutra';
      const leftLogo = effectiveCompanyType === 'bri' ? logoBRILeft : logoDwimitra;
      const rightLogo = effectiveCompanyType === 'bri' ? logoBRI : effectiveCompanyType === 'k2' ? logoK2 : logoNeutraDC;
      const [logoLeftB64, logoRightB64] = await Promise.all([
        loadLogoBase64(leftLogo),
        loadLogoBase64(rightLogo),
      ]);

      docResult = await generateReportPDF({
        maintenanceName: docData.maintenanceName,
        maintenanceTime: docData.maintenanceTime,
        specificDetail: docData.specificDetail || '',
        vrvUnitDetail: '',
        cards,
        companyType: effectiveCompanyType as 'neutra' | 'bri' | 'k2',
        userEmail: docData.createdBy,
        logos: { left: logoLeftB64, right: logoRightB64 },
        abnormalFinding: docData.hasAbnormal && docData.abnormalFinding ? {
          partName: (docData.abnormalFinding as any).partName || docData.abnormalFinding.unitName || docData.specificDetail || docData.maintenanceName,
          partNumber: (docData.abnormalFinding as any).partNumber || '-',
          brandName: (docData.abnormalFinding as any).brandName || '-',
          quantity: (docData.abnormalFinding as any).quantity ? `${(docData.abnormalFinding as any).quantity}` : '1 Unit',
          findingDate: (docData.abnormalFinding as any).findingDate || (docData.abnormalFinding.reportedAt
            ? (typeof docData.abnormalFinding.reportedAt === 'string'
                ? docData.abnormalFinding.reportedAt.split('T')[0]
                : new Date(docData.abnormalFinding.reportedAt).toLocaleDateString('id-ID'))
            : docData.maintenanceTime),
          remark: docData.abnormalFinding.description || 'Temuan abnormal tercatat pada dokumen ini.',
          actionRecommendation: docData.abnormalFinding.actionRecommendation || undefined,
          photos: ((docData.abnormalFinding as any).photos && (docData.abnormalFinding as any).photos.length > 0)
            ? (docData.abnormalFinding as any).photos
            : (docData.abnormalFinding.photoBase64 ? [{ base64: docData.abnormalFinding.photoBase64, description: 'Bukti Temuan Abnormal' }] : [])
        } : null,
      });
    }

    // Subkasus 1: Kedua-duanya ada (Service Report + Foto) -> Gabungkan 1:1
    if (srPdfBytes && docResult) {
      try {
        const mergedPdf = await PDFDocument.create();
        const srPdfDoc = await PDFDocument.load(srPdfBytes);
        const docPdfDoc = await PDFDocument.load(docResult.doc.output('arraybuffer'));

        // Salin halaman Service Report (Halaman 1)
        const srPages = await mergedPdf.copyPages(srPdfDoc, srPdfDoc.getPageIndices());
        for (const page of srPages) {
          mergedPdf.addPage(page);
        }

        // Salin seluruh halaman Dokumentasi Foto (Halaman 2 dst)
        const docPages = await mergedPdf.copyPages(docPdfDoc, docPdfDoc.getPageIndices());
        for (const page of docPages) {
          mergedPdf.addPage(page);
        }

        const mergedBytes = await mergedPdf.save();
        const mergedBlob = new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        const fileName = docData.fileName.endsWith('.pdf') ? docData.fileName : `${docData.fileName}.pdf`;
        if (saveToFile) {
          saveAs(mergedBlob, fileName);
        }
        return [{ fileName, blob: mergedBlob }];
      } catch (mergeErr) {
        console.error('Gagal menggabungkan PDF Service Report dan Dokumentasi Foto:', mergeErr);
      }
    }

    // Subkasus 2: Hanya ada Service Report (dokumen SR tanpa foto)
    if (srPdfBytes) {
      const srBlob = new Blob([srPdfBytes as any], { type: 'application/pdf' });
      const fileName = docData.fileName.endsWith('.pdf') ? docData.fileName : `${docData.fileName}.pdf`;
      if (saveToFile) {
        saveAs(srBlob, fileName);
      }
      return [{ fileName, blob: srBlob }];
    }

    // Subkasus 3: Hanya ada Dokumentasi Foto (tanpa Service Report)
    if (docResult) {
      const pdfBlob = docResult.doc.output('blob');
      let fileName = docData.fileName.endsWith('.pdf') ? docData.fileName : `${docData.fileName}.pdf`;
      if (saveToFile) {
        docResult.doc.save(fileName);
      }
      return [{ fileName, blob: pdfBlob }];
    }

    // Subkasus 4: Dokumen kosong (tidak ada foto terisi maupun Service Report)
    toast.error('Dokumen ini tidak memiliki dokumentasi foto maupun Service Report.', { id: 'download-pdf' });
    return [];
  };

  const buildHSEBlob = async (docData: ExcelDocument, saveToFile: boolean = false): Promise<{ blob: Blob; fileName: string }> => {
    const hseDoc = await getDoc(doc(db, 'hse', docData.id));
    if (!hseDoc.exists()) {
      throw new Error('HSE document not found');
    }

    const hseData = hseDoc.data();
    const photosSnap = await getDocs(collection(db, `hse/${docData.id}/photos`));
    const photos = photosSnap.docs
      .map(d => {
        const data = d.data();
        return {
          base64: data.dataUrl || data.base64,
          description: data.description || '',
          label: data.label || ''
        };
      });

    // 1. Dokumen TBM (Toolbox Meeting)
    if (hseData.hseType === 'tbm' || docData.hseType === 'tbm') {
      const tbmRecord: HSETbmRecord = {
        date: hseData.date || docData.maintenanceTime || '',
        time: hseData.time || '',
        totalSDM: hseData.totalSDM || docData.totalSDM || 0,
        lokasi: hseData.lokasi || 'Data Center NeutraDC Cikarang',
        keterangan: hseData.keterangan || '',
        inspectorK3: hseData.inspectorK3 || '',
        authorEmail: hseData.authorEmail || docData.createdBy || '',
        reportType: hseData.reportType || 'utt',
        hseType: 'tbm',
        photos: photos.length > 0 ? photos : (hseData.photos || []),
      };
      if (saveToFile) {
        await exportHSETbmPDF(tbmRecord, { companyVariant: 'neutradc' });
      }
      return await generateHSETbmPdfBlob(tbmRecord, { companyVariant: 'neutradc' });
    }

    // 2. Dokumen Safety Induction
    if (hseData.hseType === 'induction' || docData.hseType === 'induction') {
      let fInduction = hseData.fotoInduction || '';
      let fSurat = hseData.fotoSuratSehat || '';
      let fSertifikat = hseData.fotoSertifikatK3 || '';

      photos.forEach(p => {
        if (p.label === 'fotoInduction' && !fInduction) fInduction = p.base64;
        if (p.label === 'fotoSuratSehat' && !fSurat) fSurat = p.base64;
        if (p.label === 'fotoSertifikatK3' && !fSertifikat) fSertifikat = p.base64;
      });

      const inductionRecord: HSESafetyInductionRecord = {
        nama: hseData.nama || docData.inductionPerson || '',
        perusahaan: hseData.perusahaan || docData.companyName || '',
        date: hseData.date || docData.maintenanceTime || '',
        time: hseData.time || '',
        jabatan: hseData.jabatan || '',
        catatan: hseData.catatan || '',
        fotoInduction: fInduction,
        fotoSuratSehat: fSurat,
        fotoSertifikatK3: fSertifikat || undefined,
        inspectorK3: hseData.inspectorK3 || '',
        authorEmail: hseData.authorEmail || docData.createdBy || '',
        reportType: hseData.reportType || 'utt',
        hseType: 'induction',
      };
      if (saveToFile) {
        await exportHSESafetyInductionPDF(inductionRecord, { companyVariant: 'neutradc' });
      }
      return await generateHSESafetyInductionPdfBlob(inductionRecord, { companyVariant: 'neutradc' });
    }

    // 3. Default: HSE Inspection Report
    const formData = {
      aktivitas: hseData.aktivitas,
      lokasi: hseData.lokasi,
      personil: hseData.personil,
      pic: hseData.pic,
      anggota: hseData.anggota,
      inspectorK3: hseData.inspectorK3 || '',
      checklist: hseData.checklist,
      photos: photos,
      date: hseData.date,
      reportType: hseData.reportType,
      hseType: hseData.hseType || 'inspection',
      maintenanceType: hseData.maintenanceType || 'OTHER',
      msdsPdfUrl: hseData.msdsPdfUrl,
      siloPdfUrl: hseData.siloPdfUrl,
    };

    const blob = await generateHSEPdfBlob(formData, userRole || undefined);
    const fileName = docData.fileName.endsWith('.pdf') ? docData.fileName : `${docData.fileName}.pdf`;
    if (saveToFile) {
      const shouldAutoOpen = userRole === 'hse' && user?.email?.toLowerCase() !== 'hsemamik@gmail.com';
      await generateHSEPdf(formData, shouldAutoOpen, userRole || undefined);
    }
    return { blob, fileName };
  };

  const getDocumentExportFiles = async (
    docData: ExcelDocument
  ): Promise<{ name: string; blob: Blob }[]> => {
    if (docData.documentType === 'excel') {
      const res = await buildExcelBlob(docData);
      return [{ name: res.fileName, blob: res.blob }];
    } else if (docData.documentType === 'hse') {
      const res = await buildHSEBlob(docData, false);
      return [{ name: res.fileName, blob: res.blob }];
    } else {
      const resList = await buildPDFBlob(docData, false);
      return resList.map(r => ({ name: r.fileName, blob: r.blob }));
    }
  };

  const handleDownload = async (docData: ExcelDocument) => {
    try {
      toast.loading('Generating Excel from database...', { id: 'download' });
      const { blob, fileName } = await buildExcelBlob(docData);
      saveAs(blob, fileName);
      toast.success('File Excel berhasil diunduh!', { id: 'download' });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Gagal mengunduh file Excel', { id: 'download' });
    }
  };

  const handleDownloadPDF = async (docData: ExcelDocument) => {
    try {
      toast.loading('Menghasilkan PDF dari database...', { id: 'download-pdf' });
      const files = await buildPDFBlob(docData, false);
      if (files.length === 0) {
        toast.dismiss('download-pdf');
        return;
      }
      for (const file of files) {
        downloadPDFBlob(file.blob, file.fileName);
      }
      toast.success('PDF berhasil diunduh!', { id: 'download-pdf' });
    } catch (error) {
      console.error('Download PDF error:', error);
      toast.error('Gagal mengunduh PDF', { id: 'download-pdf' });
    }
  };

  const handleDownloadPhotosOnly = async (docData: ExcelDocument) => {
    try {
      toast.loading('Menghasilkan PDF Dokumentasi Foto...', { id: 'download-photos' });
      const files = await buildPDFBlob(docData, false, true);
      if (files.length === 0) {
        toast.dismiss('download-photos');
        return;
      }
      for (const file of files) {
        downloadPDFBlob(file.blob, file.fileName);
      }
      toast.success('Dokumentasi foto berhasil diunduh!', { id: 'download-photos' });
    } catch (error) {
      console.error('Download photos-only error:', error);
      toast.error('Gagal mengunduh dokumentasi foto', { id: 'download-photos' });
    }
  };

  const handleDownloadSROnly = async (docData: ExcelDocument) => {
    try {
      toast.loading('Menyiapkan file Excel Service Report...', { id: 'download-sr' });

      // 1. Cek apakah ada file mentah yang di-upload (di memory docData atau di IndexedDB lokal)
      let srBase64 = docData.attachedSrBase64;
      let srFileName = docData.attachedSrFile?.name;

      if (!srBase64) {
        try {
          const offDoc = await offlineReportStorage.getReport(docData.id);
          if (offDoc?.attachedSrBase64) {
            srBase64 = offDoc.attachedSrBase64;
            srFileName = offDoc.attachedSrFile?.name || srFileName;
          }
        } catch (e) {
          console.warn('Could not read attachedSrBase64 from offline storage:', e);
        }
      }

      if (srBase64) {
        const cleanBase64 = srBase64.includes(',') ? srBase64.split(',')[1] : srBase64;
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const mimeType = docData.attachedSrFile?.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const blob = new Blob([byteNumbers], { type: mimeType });
        const finalName = srFileName || `${docData.fileName.replace(/\.pdf$/i, '')}_Service_Report.xlsx`;
        saveAs(blob, finalName);
        toast.success('Berkas Service Report Excel berhasil diunduh!', { id: 'download-sr' });
        return;
      }

      // 2. Jika tidak ada file upload mentah, generate Excel dari serviceReportPayload terstruktur
      if (docData.serviceReportPayload && Object.keys(docData.serviceReportPayload).length > 0) {
        let photos = docData.photosData || [];
        if (photos.length === 0) {
          try {
            const offPhotos = await offlineReportStorage.getPhotos(docData.id);
            if (offPhotos && offPhotos.length > 0) {
              photos = offPhotos.map(p => ({
                index: p.index,
                description: p.description || '',
                photoBase64: p.photoBase64 || '',
                hasPhoto: p.hasPhoto
              }));
            }
          } catch (e) {
            // ignore
          }
        }
        const excelName = `${docData.fileName.replace(/\.pdf$/i, '')}_Service_Report.xlsx`;
        await exportUniversalServiceReportExcel(docData.serviceReportPayload, excelName, photos);
        toast.success('File Excel Service Report berhasil diunduh!', { id: 'download-sr' });
        return;
      }

      toast.error('Tidak ditemukan berkas Excel Service Report untuk dokumen ini', { id: 'download-sr' });
    } catch (error: any) {
      console.error('Download SR error:', error);
      toast.error(`Gagal mengunduh Service Report: ${error.message || 'Terjadi kesalahan'}`, { id: 'download-sr' });
    }
  };

  const handleDownloadHSE = async (docData: ExcelDocument) => {
    try {
      toast.loading('Memuat data laporan HSE...', { id: 'download-hse' });
      const res = await buildHSEBlob(docData, false);
      downloadPDFBlob(res.blob, res.fileName);
      toast.success('PDF HSE berhasil diunduh!', { id: 'download-hse' });
    } catch (error) {
      console.error('Download HSE error:', error);
      toast.error('Gagal mengunduh PDF HSE', { id: 'download-hse' });
    }
  };

  const handleDownloadZip = async (docs: ExcelDocument[], zipFileName: string, titleLabel: string) => {
    if (!docs || docs.length === 0) {
      toast.error('Tidak ada dokumen di folder ini untuk diunduh');
      return;
    }
    const toastId = toast.loading(`Menyiapkan ${docs.length} dokumen untuk di-download (${titleLabel})...`);
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();

      for (let i = 0; i < docs.length; i++) {
        const docItem = docs[i];
        toast.loading(`[${i + 1}/${docs.length}] Memproses file: ${docItem.maintenanceName || docItem.fileName}...`, { id: toastId });
        
        try {
          const files = await getDocumentExportFiles(docItem);
          for (const file of files) {
            let uniqueName = file.name;
            let counter = 1;
            while (usedNames.has(uniqueName)) {
              const dotIdx = file.name.lastIndexOf('.');
              if (dotIdx !== -1) {
                const base = file.name.substring(0, dotIdx);
                const ext = file.name.substring(dotIdx);
                uniqueName = `${base} (${counter})${ext}`;
              } else {
                uniqueName = `${file.name} (${counter})`;
              }
              counter++;
            }
            usedNames.add(uniqueName);
            zip.file(uniqueName, file.blob);
          }
        } catch (docErr) {
          console.error(`Gagal memproses dokumen ${docItem.id} untuk zip:`, docErr);
        }
      }

      toast.loading(`Mengompres ${usedNames.size} file menjadi arsip .ZIP...`, { id: toastId });
      const content = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      const finalZipName = zipFileName.endsWith('.zip') ? zipFileName : `${zipFileName}.zip`;
      saveAs(content, finalZipName);
      toast.success(`Berhasil mengunduh folder ${titleLabel} (${usedNames.size} file)!`, { id: toastId });
    } catch (err: any) {
      console.error('Failed to create ZIP:', err);
      toast.error('Gagal membuat file ZIP folder', { id: toastId });
    }
  };

  const sortedDocuments = useMemo(() => {
    return sortDocumentsList(documents, sortBy);
  }, [documents, sortBy]);

  const filteredDocuments = sortedDocuments.filter(doc => {
    // Non-privileged accounts can ONLY see documents created by their own email
    const isPrivilegedOrDME = isPrivileged || isDME;
    if (!isPrivilegedOrDME) {
      const userEmailClean = (user?.email || '').toLowerCase().trim();
      const isAHUUser = userEmailClean === 'ahu@gmail.com' || userEmailClean === 'ahhu@utt.com' || userEmailClean === 'ahu@utt.com' || userEmailClean === 'ahhu@gmail.com';
      const docCreator = (doc.createdBy || '').toLowerCase().trim();
      const isMatch = isAHUUser ? (docCreator === 'ahu@gmail.com') : (docCreator === userEmailClean);
      if (!isMatch) {
        return false;
      }
    }

    // If user is Admin and explicitly filtering pending delete requests
    if (isAdmin && adminDeleteFilter === 'pending_delete' && !doc.deleteRequested) {
      return false;
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.trim().toLowerCase();
      const cleanQuery = lowerQuery
        .replace(/\.pdf$/i, '')
        .replace(/\.xlsx$/i, '')
        .replace(/^dokumentasi maintenance\s*/i, '')
        .replace(/^laporan service:\s*/i, '')
        .trim();

      if (cleanQuery) {
        // Raw target string
        const targetStr = `${doc.maintenanceName || ''} ${doc.specificDetail || ''} ${doc.fileName || ''} ${doc.createdBy || ''} ${doc.maintenanceType || ''} ${doc.hseType || ''}`.toLowerCase();
        
        // Normalized string where dashes, slashes, underscores become spaces
        const targetNormalized = targetStr.replace(/[-_./]/g, ' ');
        const queryNormalized = cleanQuery.replace(/[-_./]/g, ' ');

        // Stripped alphanumeric string (e.g. "1fdh1pduhb")
        const targetStripped = targetStr.replace(/[^a-z0-9]/g, '');
        const queryStripped = cleanQuery.replace(/[^a-z0-9]/g, '');

        // 1. Direct exact or substring match
        const directMatch = targetStr.includes(lowerQuery) || targetStr.includes(cleanQuery);
        
        // 2. Normalized match (handles "1F DH1 PDU HB" matching "1F-DH1-PDU-HB")
        const normalizedMatch = targetNormalized.includes(queryNormalized);

        // 3. Stripped alphanumeric match (handles "1FDH1PDUHB" matching "1F-DH1-PDU-HB")
        const strippedMatch = queryStripped.length >= 2 && targetStripped.includes(queryStripped);

        // 4. Token ALL-match (every word in the query must be found in the target document)
        const tokens = queryNormalized.split(/\s+/).filter(t => t.length > 0);
        const allTokensMatch = tokens.length > 0 && tokens.every(token => 
          targetNormalized.includes(token) || targetStr.includes(token)
        );

        if (!directMatch && !normalizedMatch && !strippedMatch && !allTokensMatch) {
          return false;
        }
      }
    }

    if (startDate || endDate) {
      const d = getDocumentDate(doc);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const docDate = `${year}-${month}-${day}`;
      if (startDate && docDate < startDate) {
        return false;
      }
      if (endDate && docDate > endDate) {
        return false;
      }
    }

    if (filterType !== 'all' && doc.documentType !== filterType) {
      return false;
    }

    const hasSR = Boolean(doc.attachedSrFile || doc.attachedSrBase64);
    if (srStatusFilter === 'photos_only' && hasSR) {
      return false;
    }
    if (srStatusFilter === 'with_sr' && !hasSR) {
      return false;
    }
    if (srStatusFilter === 'abnormal_only' && !doc.hasAbnormal) {
      return false;
    }

    return true;
  });

  // JARVIS Autonomous Command Handler in DocumentList
  useEffect(() => {
    const handleAgentCommand = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { action, query, date_range } = customEvent.detail || {};

      if (action === 'search_reports' || action === 'filter_data') {
        const searchTerm = query || date_range || '';
        if (searchTerm) {
          setSearchQuery(searchTerm);
          toast.info(`JARVIS: Menyaring dokumen "${searchTerm}"...`);
        }
      } else if (action === 'export_pdf' || action === 'download_document') {
        const targetDoc = filteredDocuments[0] || documents[0];
        if (targetDoc) {
          toast.info(`JARVIS: Mengunduh file ${targetDoc.fileName}...`);
          if (targetDoc.documentType === 'excel') {
            handleDownload(targetDoc);
          } else if (targetDoc.documentType === 'hse') {
            handleDownloadHSE(targetDoc);
          } else {
            handleDownloadPDF(targetDoc);
          }
        } else {
          toast.error('JARVIS: Tidak ada dokumen yang dapat diunduh.');
        }
      }
    };

    window.addEventListener('voice-agent-command', handleAgentCommand);
    window.addEventListener('ai-agent-command', handleAgentCommand);
    return () => {
      window.removeEventListener('voice-agent-command', handleAgentCommand);
      window.removeEventListener('ai-agent-command', handleAgentCommand);
    };
  }, [documents, filteredDocuments]);

  // --------------------------------------------------------------------------
  // HSE Inspection Recap Computed & Handlers
  // --------------------------------------------------------------------------
  const hseInspectionDocs = useMemo(() => {
    return documents.filter(d => d.documentType === 'hse' || d.hseType === 'inspection');
  }, [documents]);

  const docsForHseRecap = useMemo(() => {
    let result = [...hseInspectionDocs];
    if (hseRecapStartDate) {
      result = result.filter(d => {
        const dStr = getDocDateString(d);
        return dStr >= hseRecapStartDate;
      });
    }
    if (hseRecapEndDate) {
      result = result.filter(d => {
        const dStr = getDocDateString(d);
        return dStr <= hseRecapEndDate;
      });
    }
    result.sort((a, b) => getDocumentDate(a).getTime() - getDocumentDate(b).getTime());
    return result;
  }, [hseInspectionDocs, hseRecapStartDate, hseRecapEndDate]);

  const computeHseRecapPeriodLabel = (): string => {
    if (hseRecapStartDate && hseRecapEndDate) {
      if (hseRecapStartDate === hseRecapEndDate) {
        return formatIndonesianDate(hseRecapStartDate);
      }
      return `${formatIndonesianDate(hseRecapStartDate)} s/d ${formatIndonesianDate(hseRecapEndDate)}`;
    } else if (hseRecapStartDate) {
      return `Sejak ${formatIndonesianDate(hseRecapStartDate)}`;
    } else if (hseRecapEndDate) {
      return `Sampai ${formatIndonesianDate(hseRecapEndDate)}`;
    }
    return 'Semua Periode';
  };

  const handleOpenHseRecapModal = (variant: 'neutradc' | 'utt') => {
    setHseRecapVariant(variant);
    if (startDate || endDate) {
      setHseRecapStartDate(startDate);
      setHseRecapEndDate(endDate);
    } else {
      const { start, end } = getPresetRange('this_month');
      setHseRecapStartDate(start);
      setHseRecapEndDate(end);
    }
    setIsHseRecapModalOpen(true);
  };

  const handleDownloadHseInspectionRecap = async () => {
    if (docsForHseRecap.length === 0) {
      toast.error('Tidak ada laporan inspeksi HSE pada rentang tanggal ini');
      return;
    }
    setIsExportingHseRecap(true);
    const variantLabel = hseRecapVariant === 'neutradc' ? 'NeutraDC' : 'UTT';
    const periodLabel = computeHseRecapPeriodLabel();
    try {
      toast.loading(`Menyiapkan Rekapitulasi PDF HSE (${variantLabel})...`, { id: 'export-hse-recap' });
      await exportHSEInspectionRecapPDF(docsForHseRecap, {
        companyVariant: hseRecapVariant,
        periodLabel: periodLabel
      });
      toast.success(`Rekapitulasi PDF HSE (${variantLabel}) berhasil diunduh!`, { id: 'export-hse-recap' });
      setIsHseRecapModalOpen(false);
    } catch (err) {
      console.error('Export HSE inspection recap PDF error:', err);
      toast.error('Gagal mengunduh Rekapitulasi PDF HSE.', { id: 'export-hse-recap' });
    } finally {
      setIsExportingHseRecap(false);
    }
  };

  const getHseCategoryLabel = (hseType?: string): string => {
    switch (hseType) {
      case 'tbm':
        return 'Presensi TBM';
      case 'induction':
        return 'Safety Induction';
      case 'sio':
        return 'Dokumen SIO';
      case 'silo':
        return 'Dokumen SILO';
      case 'inspection':
      default:
        return 'Laporan Inspeksi HSE';
    }
  };

  const exportHseDocumentsAsZip = async (
    targetDocs: ExcelDocument[],
    customZipName?: string
  ) => {
    if (targetDocs.length === 0) {
      toast.error('Tidak ada dokumen yang dipilih untuk diexport.');
      return;
    }

    setIsExportingHseZip(true);
    const totalDocs = targetDocs.length;
    setZipProgress({
      isOpen: true,
      current: 0,
      total: totalDocs,
      percent: 0,
      currentFileName: 'Mempersiapkan data dokumen...',
      currentFolder: '',
      stage: 'processing',
    });

    try {
      const zip = new JSZip();
      const dateStr = new Date().toISOString().split('T')[0];
      const mainFolderName = customZipName || `Arsip_HSE_${dateStr}`;
      const rootFolder = zip.folder(mainFolderName);

      // Cek apakah target dokumen berasal dari beberapa kategori berbeda
      const categoriesInDocs = new Set(targetDocs.map(d => d.hseType || 'inspection'));
      const hasMultipleCategories = categoriesInDocs.size > 1;

      const BATCH_SIZE = 4;
      let completedCount = 0;

      for (let i = 0; i < targetDocs.length; i += BATCH_SIZE) {
        const batch = targetDocs.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (docData) => {
            let fileName = '';
            let monthFolder = '';
            try {
              let blob: Blob | null = null;

              if (docData.documentType === 'hse') {
                const res = await buildHSEBlob(docData, false);
                blob = res.blob;
                fileName = res.fileName;
              } else {
                const files = await getDocumentExportFiles(docData);
                if (files.length > 0) {
                  blob = files[0].blob;
                  fileName = files[0].name;
                }
              }

              // Ambil nama bulan dokumen (contoh: "September 2026")
              const docDate = getDocumentDate(docData);
              monthFolder = getMonthYearString(docDate);
              const categoryLabel = getHseCategoryLabel(docData.hseType);

              // Bersihkan karakter ilegal dari nama file untuk file system ZIP
              const cleanFileName = (fileName || `Dokumen_${docData.id}.pdf`).replace(/[/\\?%*:|"<>]/g, '_');

              if (blob && rootFolder) {
                if (hasMultipleCategories) {
                  // Susun rapih: MainFolder -> Kategori (Laporan Inspeksi HSE) -> Bulan (September 2026) -> File.pdf
                  rootFolder
                    .folder(categoryLabel)
                    ?.folder(monthFolder)
                    ?.file(cleanFileName, blob);
                } else {
                  // Jika satu kategori: MainFolder -> Bulan (September 2026) -> File.pdf
                  rootFolder
                    .folder(monthFolder)
                    ?.file(cleanFileName, blob);
                }
              }
            } catch (docErr) {
              console.error(`Gagal menyusun PDF untuk ${docData.id}:`, docErr);
            } finally {
              completedCount++;
              const percent = Math.min(Math.round((completedCount / totalDocs) * 90), 90);
              setZipProgress(prev => ({
                ...prev,
                current: completedCount,
                percent,
                currentFileName: fileName || docData.fileName || `Dokumen #${completedCount}`,
                currentFolder: monthFolder,
                stage: 'processing',
              }));
            }
          })
        );
      }

      setZipProgress(prev => ({
        ...prev,
        stage: 'compressing',
        currentFileName: 'Mengompresi ke file ZIP...',
      }));

      const zipBlob = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        },
        (metadata) => {
          const totalPercent = Math.min(90 + Math.round((metadata.percent / 100) * 10), 100);
          setZipProgress(prev => ({
            ...prev,
            percent: totalPercent,
            currentFileName: `Kompresi ZIP (${Math.round(metadata.percent)}%)...`,
          }));
        }
      );

      saveAs(zipBlob, `${mainFolderName}.zip`);

      setZipProgress(prev => ({
        ...prev,
        stage: 'completed',
        percent: 100,
        currentFileName: 'File ZIP berhasil diunduh!',
      }));

      toast.success(`ZIP berhasil diunduh (${targetDocs.length} dokumen tersusun rapih dalam folder)!`);
      setIsHseRecapModalOpen(false);

      setTimeout(() => {
        setZipProgress(prev => ({ ...prev, isOpen: false }));
      }, 1500);
    } catch (err) {
      console.error('Export HSE ZIP error:', err);
      toast.error('Gagal mengunduh ZIP Arsip HSE.');
      setZipProgress(prev => ({ ...prev, isOpen: false }));
    } finally {
      setIsExportingHseZip(false);
    }
  };

  const handleDownloadHseZip = async () => {
    const variantLabel = hseRecapVariant === 'neutradc' ? 'NeutraDC' : 'UTT';
    const dateStr = new Date().toISOString().split('T')[0];
    await exportHseDocumentsAsZip(docsForHseRecap, `Arsip_HSE_${variantLabel}_${dateStr}`);
  };

  const renderDmeContent = () => {
    // 1. Jika sedang berada di folder Manajemen File (JSEA, MOP, Layout, dll), prioritaskan tampilkan FileManagement
    if (dmeLevel === 'management_files') {
      if (dmeSelectedFolder === 'Laporan Temuan') {
        return (
          <div className="space-y-4 w-full max-w-6xl">
            <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl border border-slate-200 shadow-xl flex items-center justify-between">
              <button
                onClick={() => { setDmeSelectedFolder(null); setDmeLevel('root'); prevInitialFolderRef.current = null; }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 rounded-xl transition-all text-xs font-bold cursor-pointer border border-slate-200"
              >
                <ChevronLeft className="w-4 h-4" /> Kembali ke Folder Utama
              </button>
              <div className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                Folder: Laporan Temuan Maintenance
              </div>
            </div>
            <FindingArchive />
          </div>
        );
      }
      return (
        <div className="space-y-4 w-full max-w-6xl">
          {searchQuery.trim() !== '' && filteredDocuments.length > 0 && (
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 border border-blue-200/90 rounded-2xl p-3 sm:p-4 shadow-xs flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-2xs shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                    Ditemukan {filteredDocuments.length} Laporan PM untuk "{searchQuery}"
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Laporan maintenance hasil ekspor engineer juga ditemukan untuk kata kunci ini
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDmeLevel('root');
                  setDmeSelectedFolder(null);
                  setDmeSearchMode('files');
                }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
              >
                <span>Lihat {filteredDocuments.length} Laporan PM</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <FileManagement 
            allowUpload={isAdmin || isQcDme} 
            initialFolder={dmeSelectedFolder} 
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onBackToRoot={() => { 
              setDmeSelectedFolder(null); 
              setDmeLevel('root'); 
              prevInitialFolderRef.current = null;
            }} 
          />
        </div>
      );
    }

    // Mode tampilan file langsung hanya saat user memilih melihat file secara eksplisit
    if (dmeSearchMode === 'files' && searchQuery.trim() !== '') {
      return (
        <div className="space-y-4 w-full max-w-6xl">
          <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl border border-slate-200 shadow-xl flex items-center justify-between flex-wrap gap-3">
            <button
              onClick={() => {
                setDmeSearchMode('folder');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 rounded-xl transition-all text-xs font-bold cursor-pointer border border-slate-200 shadow-xs"
            >
              <Folder className="w-4 h-4 text-amber-600" /> Kembali ke Tampilan Folder
            </button>
            <div className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
              Hasil Pencarian File: "{searchQuery}" ({filteredDocuments.length} dokumen)
            </div>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12 bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-xl">
              <Search className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600">Tidak ada dokumen yang sesuai dengan "{searchQuery}"</p>
            </div>
          ) : (
            filteredDocuments.map((document, index) => renderDocumentCard(document, index))
          )}
        </div>
      );
    }

    const uniqueAccounts = Array.from(new Set(filteredDocuments.map(d => d.createdBy))).sort();
    const pmTotalAbnormal = filteredDocuments.filter(d => d.hasAbnormal).length;
    const accountsWithAbnormal = uniqueAccounts.filter(acc =>
      filteredDocuments.some(d => d.createdBy === acc && d.hasAbnormal)
    );

    const managementFolders = [
      { name: 'D-DAY', desc: 'Dokumen D-DAY & Prosedur Operational' },
      { name: 'Laporan Harian', desc: 'Laporan Harian Maintenance Data Center' },
      { name: 'Layout', desc: 'Layout & Denah Fasilitas Data Center' },
      { name: 'MOP', desc: 'Method of Procedure (MOP) Standar' },
      { name: 'Monthly', desc: 'Laporan Rekap Bulanan Project' },
      { name: 'Predictive Report', desc: 'Laporan Predictive Maintenance Data Center' },
      { name: 'Risk Register', desc: 'Matriks & Analisa Risiko Operasional' },
      { name: 'JSEA', desc: 'Job Safety Environment Analysis' },
      { name: 'Report CM', desc: 'Laporan Corrective Maintenance (CM)' },
      { name: 'Form SLA/SLG', desc: 'Form Service Level Agreement / Guarantee' },
      { name: 'Report PIR', desc: 'Post Incident Report (PIR)' },
      { name: 'Laporan Temuan', desc: 'Data & Laporan Temuan Maintenance' },
      { name: 'SLD', desc: 'Single Line Diagram Data Center' },
      { name: 'Service Report', desc: 'Draft & Laporan Service Maintenance' },
      { name: 'Service Report Approved', desc: 'Laporan Service Maintenance (Approved)' },
    ];

    const query = searchQuery.trim().toLowerCase();
    const isPmMatch = !query ||
      'folder pm'.includes(query) ||
      'preventive maintenance'.includes(query) ||
      'pm'.includes(query) ||
      uniqueAccounts.length > 0;

    const filteredManagementFolders = managementFolders.filter(folder => {
      if (!query) return true;
      return folder.name.toLowerCase().includes(query) || folder.desc.toLowerCase().includes(query);
    });

    if (dmeLevel === 'root') {
      return (
        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 shadow-xl w-full max-w-6xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                <Folder className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Management File</h3>
                <p className="text-xs text-slate-500 font-medium">Pilih folder utama untuk melihat arsip laporan & dokumentasi maintenance</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => fetchDocuments(true)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 shadow-2xs"
                title="Segarkan data arsip & laporan terbaru dari server"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
                <span>Segarkan</span>
              </button>
              {(isAdmin || isQcDme) && (
                <button
                  type="button"
                  onClick={() => {
                    setDmeSelectedFolder('Laporan Harian');
                    setDmeLevel('management_files');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 cursor-pointer transition-all hover:scale-105"
                  title="Unggah berkas dokumen ke folder"
                >
                  <Upload className="w-4 h-4" />
                  <span>Unggah Berkas</span>
                </button>
              )}
              {query && (
                <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  Filter: "{searchQuery}"
                </span>
              )}
            </div>
          </div>

          {query && (
            <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                <Search className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Menyaring folder untuk kata kunci: <strong>"{searchQuery}"</strong></span>
              </div>
              <div className="flex items-center gap-2">
                {filteredDocuments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDmeSearchMode('files')}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                    <span>Lihat Semua File Langsung ({filteredDocuments.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs font-medium hover:underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* PM Folder Card */}
            {isPmMatch && (
              <motion.button
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setDmeLevel('account')}
                className={`flex items-center gap-3.5 p-3.5 bg-white hover:bg-amber-50/60 border ${
                  pmTotalAbnormal > 0 ? 'border-rose-300 hover:border-rose-500 shadow-rose-100/40' : 'border-slate-200 hover:border-amber-400'
                } rounded-xl transition-all text-left group shadow-xs hover:shadow-md cursor-pointer`}
              >
                <div className={`p-2.5 ${
                  pmTotalAbnormal > 0 ? 'bg-rose-50 group-hover:bg-rose-100 text-rose-600 border border-rose-200' : 'bg-amber-50 group-hover:bg-amber-100 text-amber-600'
                } rounded-xl transition-colors shrink-0`}>
                  <Folder className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-slate-900 group-hover:text-amber-900 transition-colors truncate block">
                    Folder PM (Preventive Maintenance)
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs font-medium text-slate-500">
                      {query ? `${uniqueAccounts.length} Akun Cocok` : `${uniqueAccounts.length} Akun Maintenance`}
                    </span>
                    {pmTotalAbnormal > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                        <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 animate-pulse" />
                        {pmTotalAbnormal} Abnormal ({accountsWithAbnormal.length} Akun)
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors shrink-0" />
              </motion.button>
            )}

            {/* Management File Folders */}
            {filteredManagementFolders.map((folder) => (
              <motion.button
                key={folder.name}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  setDmeSelectedFolder(folder.name);
                  setDmeLevel('management_files');
                }}
                className="flex items-center gap-3.5 p-3.5 bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 rounded-xl transition-all text-left group shadow-xs hover:shadow-md cursor-pointer"
              >
                <div className="p-2.5 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors shrink-0">
                  <Folder className="w-5 h-5 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-slate-900 group-hover:text-amber-900 transition-colors truncate block">
                    {folder.name}
                  </span>
                  <span className="text-xs font-medium text-slate-500 block mt-0.5 truncate">
                    {folder.desc}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors shrink-0" />
              </motion.button>
            ))}

            {!isPmMatch && filteredManagementFolders.length === 0 && (
              <div className="col-span-full text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Tidak ada folder yang sesuai dengan "{searchQuery}"</p>
                {filteredDocuments.length > 0 && (
                  <button
                    onClick={() => setDmeSearchMode('files')}
                    className="mt-3 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Lihat {filteredDocuments.length} File Terkait Langsung</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (dmeLevel === 'account') {
      const accountsWithAbnormal = uniqueAccounts.filter(acc =>
        filteredDocuments.some(d => d.createdBy === acc && d.hasAbnormal)
      );
      const displayedAccounts = dmeAbnormalOnlyFilter ? accountsWithAbnormal : uniqueAccounts;
      const totalAbnormalInPm = filteredDocuments.filter(d => d.hasAbnormal).length;

      return (
        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 shadow-xl w-full max-w-6xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 flex-wrap gap-3">
            <button
              onClick={() => setDmeLevel('root')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali ke Folder Utama
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Folder: Report PM</span>
              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                {uniqueAccounts.length} Akun
              </span>
            </div>
          </div>

          {/* Filter Bar: Semua Akun vs Hanya Akun yang Memiliki Temuan Abnormal */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setDmeAbnormalOnlyFilter(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  !dmeAbnormalOnlyFilter
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>Semua Akun ({uniqueAccounts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDmeAbnormalOnlyFilter(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  dmeAbnormalOnlyFilter
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Ada Temuan Abnormal ({accountsWithAbnormal.length})</span>
                {accountsWithAbnormal.length > 0 && !dmeAbnormalOnlyFilter && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping ml-0.5" />
                )}
              </button>
            </div>
            {totalAbnormalInPm > 0 && (
              <div className="text-[11px] font-bold text-rose-700 flex items-center gap-1 bg-rose-50/90 px-2.5 py-1 rounded-lg border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-pulse" />
                <span>{totalAbnormalInPm} temuan abnormal tercatat pada {accountsWithAbnormal.length} akun</span>
              </div>
            )}
          </div>

          {searchQuery.trim() !== '' && (
            <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200 rounded-xl p-3 mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                <Search className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Menyaring folder akun untuk: <strong>"{searchQuery}"</strong> ({displayedAccounts.length} akun cocok, {filteredDocuments.length} laporan)</span>
              </div>
              <div className="flex items-center gap-2">
                {filteredDocuments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDmeSearchMode('files')}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                    <span>Lihat Semua File Langsung ({filteredDocuments.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs font-medium hover:underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {displayedAccounts.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">
                {dmeAbnormalOnlyFilter
                  ? 'Tidak ada akun maintenance dengan temuan abnormal saat ini.'
                  : (searchQuery.trim() ? `Tidak ada folder akun yang sesuai dengan "${searchQuery}"` : 'Tidak ada dokumen ditemukan')}
              </p>
              {(searchQuery.trim() || dmeAbnormalOnlyFilter) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDmeAbnormalOnlyFilter(false);
                  }}
                  className="mt-3 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {displayedAccounts.map((account) => {
                const accountItemDocs = filteredDocuments.filter(d => d.createdBy === account);
                const count = accountItemDocs.length;
                const accountAbnormalDocs = accountItemDocs.filter(d => d.hasAbnormal);
                const abnormalCount = accountAbnormalDocs.length;
                return (
                  <motion.div
                    key={account}
                    whileHover={{ y: -2 }}
                    className={`flex flex-col justify-between bg-white border ${
                      abnormalCount > 0
                        ? 'border-rose-300 hover:border-rose-500 shadow-rose-100/40 bg-gradient-to-b from-white to-rose-50/15'
                        : 'border-slate-200/90 hover:border-amber-400/90'
                    } rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all group`}
                  >
                    {/* Top Info Area - Clickable to open folder */}
                    <div
                      onClick={() => {
                        setDmeSelectedAccount(account);
                        setDmeLevel('month');
                      }}
                      className="flex items-start gap-3.5 cursor-pointer pb-3"
                    >
                      <div className={`p-2.5 ${
                        abnormalCount > 0
                          ? 'bg-gradient-to-br from-rose-50 to-rose-100/80 text-rose-600 border-rose-200/80'
                          : 'bg-gradient-to-br from-amber-50 to-amber-100/80 text-amber-600 border-amber-200/60'
                      } rounded-xl border shrink-0 group-hover:scale-105 transition-transform shadow-2xs`}>
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-sm font-bold ${
                          abnormalCount > 0 ? 'text-slate-900 group-hover:text-rose-900' : 'text-slate-900 group-hover:text-amber-900'
                        } transition-colors truncate`}>
                          {account}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                            {count} Laporan
                          </span>
                          {abnormalCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 animate-pulse" />
                              {abnormalCount} Abnormal
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              Normal
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Buttons - Jelas & Terpisah */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setDmeSelectedAccount(account);
                          setDmeLevel('month');
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 ${
                          abnormalCount > 0 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-500 hover:bg-amber-600'
                        } text-white rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer`}
                        title={`Buka Folder ${account}`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Buka Folder</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadZip(
                            accountItemDocs,
                            `PM_${account.replace(/[^a-zA-Z0-9]/g, '_')}_Semua_Laporan.zip`,
                            `Akun ${account}`
                          );
                        }}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
                        title={`Download Semua Laporan (${account}) .ZIP`}
                      >
                        <FolderDown className="w-3.5 h-3.5" />
                        <span>Download .ZIP</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (dmeLevel === 'month') {
      const accountDocs = filteredDocuments.filter(d => d.createdBy === dmeSelectedAccount);
      const uniqueMonths = Array.from(new Set(accountDocs.map(d => getMonthYearString(getDocumentDate(d)))));
      const sortedMonths = uniqueMonths.sort((a, b) => {
        const docA = accountDocs.find(d => getMonthYearString(getDocumentDate(d)) === a);
        const docB = accountDocs.find(d => getMonthYearString(getDocumentDate(d)) === b);
        const timeA = docA ? getDocumentDate(docA).getTime() : 0;
        const timeB = docB ? getDocumentDate(docB).getTime() : 0;
        return timeB - timeA;
      });

      return (
        <div className="bg-white/90 backdrop-blur-xl p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xl w-full max-w-6xl space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <button
              onClick={() => {
                setDmeSelectedAccount(null);
                setDmeLevel('account');
              }}
              className="flex items-center justify-center sm:justify-start gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200 w-full sm:w-auto"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar Akun
            </button>
            <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Folder:</span>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md border border-amber-200 truncate max-w-[150px] sm:max-w-none inline-block align-middle">{dmeSelectedAccount}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadZip(
                  accountDocs,
                  `PM_${(dmeSelectedAccount || 'Akun').replace(/[^a-zA-Z0-9]/g, '_')}_Semua_Laporan.zip`,
                  `Akun ${dmeSelectedAccount}`
                )}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-xs text-xs font-bold transition-all cursor-pointer hover:shadow-md shrink-0"
                title="Download Semua Laporan Akun Ini (.ZIP)"
              >
                <FolderDown className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Download Semua Bulan (.ZIP)</span>
                <span className="xs:hidden">Download (.ZIP)</span>
                <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{accountDocs.length}</span>
              </button>
            </div>
          </div>

          {searchQuery.trim() !== '' && (
            <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                <Search className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Menyaring bulan untuk: <strong>"{searchQuery}"</strong> ({sortedMonths.length} bulan cocok, {accountDocs.length} laporan)</span>
              </div>
              <div className="flex items-center gap-2">
                {accountDocs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDmeSearchMode('files')}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                    <span>Lihat Semua File Akun Ini ({accountDocs.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs font-medium hover:underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {sortedMonths.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">
                {searchQuery.trim() ? `Tidak ada folder bulan yang sesuai dengan "${searchQuery}" di akun ini` : 'Tidak ada folder bulan'}
              </p>
              {searchQuery.trim() && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {sortedMonths.map((month) => {
                const monthItemDocs = accountDocs.filter(d => getMonthYearString(getDocumentDate(d)) === month);
                const count = monthItemDocs.length;
                const monthAbnormalDocs = monthItemDocs.filter(d => d.hasAbnormal);
                const monthAbnormalCount = monthAbnormalDocs.length;
                return (
                  <motion.div
                    key={month}
                    whileHover={{ y: -2 }}
                    className={`flex flex-col justify-between bg-white border ${
                      monthAbnormalCount > 0
                        ? 'border-rose-300 hover:border-rose-500 shadow-rose-100/40 bg-gradient-to-b from-white to-rose-50/15'
                        : 'border-slate-200/90 hover:border-amber-400/90'
                    } rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all group`}
                  >
                    {/* Top Info Area - Clickable to open folder */}
                    <div
                      onClick={() => {
                        setDmeSelectedMonth(month);
                        setDmeLevel('date');
                      }}
                      className="flex items-start gap-3.5 cursor-pointer pb-3"
                    >
                      <div className={`p-2.5 ${
                        monthAbnormalCount > 0
                          ? 'bg-gradient-to-br from-rose-50 to-rose-100/80 text-rose-600 border-rose-200/80'
                          : 'bg-gradient-to-br from-amber-50 to-amber-100/80 text-amber-600 border-amber-200/60'
                      } rounded-xl border shrink-0 group-hover:scale-105 transition-transform shadow-2xs`}>
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-sm font-bold ${
                          monthAbnormalCount > 0 ? 'text-slate-900 group-hover:text-rose-900' : 'text-slate-900 group-hover:text-amber-900'
                        } transition-colors truncate`}>
                          {month}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                            {count} Laporan
                          </span>
                          {monthAbnormalCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 animate-pulse" />
                              {monthAbnormalCount} Abnormal
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              Normal
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Buttons - Jelas & Terpisah */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setDmeSelectedMonth(month);
                          setDmeLevel('date');
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 ${
                          monthAbnormalCount > 0 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-500 hover:bg-amber-600'
                        } text-white rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer`}
                        title={`Buka Folder ${month}`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Buka Folder</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadZip(
                            monthItemDocs,
                            `PM_${(dmeSelectedAccount || 'Akun').replace(/[^a-zA-Z0-9]/g, '_')}_${month.replace(/[^a-zA-Z0-9]/g, '_')}.zip`,
                            `Bulan ${month}`
                          );
                        }}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
                        title={`Download Semua Laporan Bulan ${month} (.ZIP)`}
                      >
                        <FolderDown className="w-3.5 h-3.5" />
                        <span>Download .ZIP</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (dmeLevel === 'date') {
      const accountDocs = filteredDocuments.filter(d => d.createdBy === dmeSelectedAccount);
      const monthDocs = accountDocs.filter(d => getMonthYearString(getDocumentDate(d)) === dmeSelectedMonth);
      const getFullDateString = (date: Date) => {
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      };
      const uniqueDates = Array.from(new Set(monthDocs.map(d => getFullDateString(getDocumentDate(d)))));
      const sortedDates = uniqueDates.sort((a, b) => {
        const docA = monthDocs.find(d => getFullDateString(getDocumentDate(d)) === a);
        const docB = monthDocs.find(d => getFullDateString(getDocumentDate(d)) === b);
        const timeA = docA ? getDocumentDate(docA).getTime() : 0;
        const timeB = docB ? getDocumentDate(docB).getTime() : 0;
        return timeB - timeA;
      });

      return (
        <div className="bg-white/90 backdrop-blur-xl p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xl w-full max-w-6xl space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <button
              onClick={() => {
                setDmeSelectedMonth(null);
                setDmeLevel('month');
              }}
              className="flex items-center justify-center sm:justify-start gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200 w-full sm:w-auto"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar Bulan
            </button>
            <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider flex-wrap">
                <span>Folder:</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 truncate max-w-[120px] sm:max-w-none inline-block align-middle">{dmeSelectedAccount}</span>
                <span>/</span>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200">{dmeSelectedMonth}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadZip(
                  monthDocs,
                  `PM_${(dmeSelectedAccount || 'Akun').replace(/[^a-zA-Z0-9]/g, '_')}_${(dmeSelectedMonth || 'Bulan').replace(/[^a-zA-Z0-9]/g, '_')}.zip`,
                  `Bulan ${dmeSelectedMonth}`
                )}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-xs text-xs font-bold transition-all cursor-pointer hover:shadow-md shrink-0"
                title="Download Semua Laporan Bulan Ini (.ZIP)"
              >
                <FolderDown className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Download Semua Tanggal (.ZIP)</span>
                <span className="xs:hidden">Download (.ZIP)</span>
                <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{monthDocs.length}</span>
              </button>
            </div>
          </div>

          {searchQuery.trim() !== '' && (
            <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                <Search className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Menyaring tanggal untuk: <strong>"{searchQuery}"</strong> ({sortedDates.length} tanggal cocok, {monthDocs.length} laporan)</span>
              </div>
              <div className="flex items-center gap-2">
                {monthDocs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDmeSearchMode('files')}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                    <span>Lihat Semua File Bulan Ini ({monthDocs.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs font-medium hover:underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {sortedDates.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">
                {searchQuery.trim() ? `Tidak ada folder tanggal yang sesuai dengan "${searchQuery}" di bulan ini` : 'Tidak ada folder tanggal'}
              </p>
              {searchQuery.trim() && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {sortedDates.map((dateStr) => {
                const dateItemDocs = monthDocs.filter(d => getFullDateString(getDocumentDate(d)) === dateStr);
                const count = dateItemDocs.length;
                const dateAbnormalDocs = dateItemDocs.filter(d => d.hasAbnormal);
                const dateAbnormalCount = dateAbnormalDocs.length;
                return (
                  <motion.div
                    key={dateStr}
                    whileHover={{ y: -2 }}
                    className={`flex flex-col justify-between bg-white border ${
                      dateAbnormalCount > 0
                        ? 'border-rose-300 hover:border-rose-500 shadow-rose-100/40 bg-gradient-to-b from-white to-rose-50/15'
                        : 'border-slate-200/90 hover:border-amber-400/90'
                    } rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all group`}
                  >
                    {/* Top Info Area - Clickable to open folder */}
                    <div
                      onClick={() => {
                        setDmeSelectedDate(dateStr);
                        setDmeLevel('documents');
                      }}
                      className="flex items-start gap-3.5 cursor-pointer pb-3"
                    >
                      <div className={`p-2.5 ${
                        dateAbnormalCount > 0
                          ? 'bg-gradient-to-br from-rose-50 to-rose-100/80 text-rose-600 border-rose-200/80'
                          : 'bg-gradient-to-br from-amber-50 to-amber-100/80 text-amber-600 border-amber-200/60'
                      } rounded-xl border shrink-0 group-hover:scale-105 transition-transform shadow-2xs`}>
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-sm font-bold ${
                          dateAbnormalCount > 0 ? 'text-slate-900 group-hover:text-rose-900' : 'text-slate-900 group-hover:text-amber-900'
                        } transition-colors truncate`}>
                          {dateStr}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                            {count} Laporan
                          </span>
                          {dateAbnormalCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 animate-pulse" />
                              {dateAbnormalCount} Abnormal
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              Normal
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Buttons - Jelas & Terpisah */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setDmeSelectedDate(dateStr);
                          setDmeLevel('documents');
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 ${
                          dateAbnormalCount > 0 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-500 hover:bg-amber-600'
                        } text-white rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer`}
                        title={`Buka Folder ${dateStr}`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Buka Folder</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadZip(
                            dateItemDocs,
                            `PM_${(dmeSelectedAccount || 'Akun').replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/[^a-zA-Z0-9]/g, '_')}.zip`,
                            `${dateStr}`
                          );
                        }}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
                        title={`Download Semua Laporan Tanggal ${dateStr} (.ZIP)`}
                      >
                        <FolderDown className="w-3.5 h-3.5" />
                        <span>Download .ZIP</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // dmeLevel === 'documents'
    const accountDocs = filteredDocuments.filter(d => d.createdBy === dmeSelectedAccount);
    const monthDocs = accountDocs.filter(d => getMonthYearString(getDocumentDate(d)) === dmeSelectedMonth);
    const getFullDateString = (date: Date) => {
      return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    };
    const dateDocs = monthDocs.filter(d => getFullDateString(getDocumentDate(d)) === dmeSelectedDate);

    return (
      <div className="space-y-4 w-full max-w-6xl bg-white/90 backdrop-blur-xl p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <button
            onClick={() => {
              setDmeSelectedDate(null);
              setDmeLevel('date');
            }}
            className="flex items-center justify-center sm:justify-start gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200 w-full sm:w-auto"
          >
            <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar Tanggal
          </button>
          <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap w-full sm:w-auto">
            <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider flex-wrap">
              <span>Folder:</span>
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 truncate max-w-[90px] sm:max-w-none inline-block align-middle">{dmeSelectedAccount}</span>
              <span>/</span>
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">{dmeSelectedMonth}</span>
              <span>/</span>
              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200">{dmeSelectedDate}</span>
            </div>
            <button
              type="button"
              onClick={() => handleDownloadZip(
                dateDocs,
                `PM_${(dmeSelectedAccount || 'Akun').replace(/[^a-zA-Z0-9]/g, '_')}_${(dmeSelectedDate || 'Tanggal').replace(/[^a-zA-Z0-9]/g, '_')}.zip`,
                `${dmeSelectedDate}`
              )}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-xs text-xs font-bold transition-all cursor-pointer hover:shadow-md shrink-0"
              title="Download Semua File Tanggal Ini (.ZIP)"
            >
              <FolderDown className="w-4 h-4" />
              <span className="hidden xs:inline">Download Folder (.ZIP)</span>
              <span className="xs:hidden">Download (.ZIP)</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{dateDocs.length}</span>
            </button>
            {dateDocs.some(d => d.hasAbnormal) && (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl text-rose-700 text-xs font-bold shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-pulse" />
                <span>{dateDocs.filter(d => d.hasAbnormal).length} Abnormal</span>
              </div>
            )}
          </div>
        </div>

        {dateDocs.some(d => d.hasAbnormal) && (
          <div className="flex items-center justify-between bg-rose-50/80 border border-rose-200 rounded-xl p-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Ditemukan {dateDocs.filter(d => d.hasAbnormal).length} dokumen dengan catatan abnormal pada tanggal ini</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSrStatusFilter(srStatusFilter === 'abnormal_only' ? 'all' : 'abnormal_only')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  srStatusFilter === 'abnormal_only'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-rose-700 hover:bg-rose-100 border border-rose-300 shadow-2xs'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{srStatusFilter === 'abnormal_only' ? 'Tampilkan Semua File' : 'Hanya File Abnormal'}</span>
              </button>
            </div>
          </div>
        )}

        {searchQuery.trim() !== '' && (
          <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <Search className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Menyaring file tanggal {dmeSelectedDate} untuk: <strong>"{searchQuery}"</strong> ({dateDocs.length} file cocok)</span>
            </div>
            {filteredDocuments.length > dateDocs.length && (
              <button
                type="button"
                onClick={() => setDmeSearchMode('files')}
                className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                <span>Lihat Semua {filteredDocuments.length} File di Semua Folder</span>
              </button>
            )}
          </div>
        )}

        {dateDocs.length === 0 ? (
          <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">Tidak ada file di tanggal ini yang sesuai dengan "{searchQuery}"</p>
            {filteredDocuments.length > 0 && (
              <button
                type="button"
                onClick={() => setDmeSearchMode('files')}
                className="mt-3 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Lihat {filteredDocuments.length} File di Semua Folder</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {dateDocs.map((document, index) => renderDocumentCard(document, index))}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (filterOverride !== 'hse_utt') {
      // viewMode='flat': Tampilan Arsip Dokumen per-akun engineer (daftar langsung)
      // viewMode='folder': Tampilan Management File dengan struktur folder terpusat
      if (viewMode === 'flat') {
        return filteredDocuments.map((document, index) => renderDocumentCard(document, index));
      }
      return renderDmeContent();
    }

    if (searchQuery.trim() !== '') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200/90 rounded-2xl p-3 sm:p-3.5 flex-wrap gap-2.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-950">
              <Search className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Hasil pencarian untuk <strong>"{searchQuery}"</strong> ({filteredDocuments.length} laporan ditemukan)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-blue-600" />
              <span>Reset Pencarian</span>
            </button>
          </div>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 shadow-xs">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Tidak ada laporan HSE yang sesuai dengan kata kunci "{searchQuery}"</p>
              <p className="text-xs text-slate-500 mt-1">Coba gunakan kata kunci lain atau periksa rentang tanggal filter Anda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredDocuments.map((document, index) => renderDocumentCard(document, index))}
            </div>
          )}
        </div>
      );
    }

    if (currentLevel === 'root') {
      const categories = [
        {
          id: 'inspection',
          name: 'HSE Inspection Report',
          categoryTag: 'Inspeksi K3 & Lingkungan',
          desc: 'Koleksi berkas resmi laporan inspeksi keselamatan kerja K3 & HSE lingkungan data center NeutraDC Cikarang.',
          icon: ClipboardList,
          color: 'text-blue-600',
          bgIcon: 'bg-blue-50 text-blue-600 border-blue-200/80 group-hover:bg-blue-600 group-hover:text-white',
          hoverBorder: 'hover:border-blue-400 hover:shadow-blue-500/10',
          badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200/80',
          tagStyle: 'bg-blue-50 text-blue-700 border-blue-200',
          btnStyle: 'bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white border-blue-200 group-hover:border-blue-600',
          topAccent: 'from-blue-500 to-indigo-600',
        },
        {
          id: 'tbm',
          name: 'Absen TBM (Toolbox Meeting)',
          categoryTag: 'Presensi Harian',
          desc: 'Arsip berita acara presensi & dokumentasi foto kegiatan briefing Toolbox Meeting keselamatan kerja teknisi.',
          icon: Clock,
          color: 'text-indigo-600',
          bgIcon: 'bg-indigo-50 text-indigo-600 border-indigo-200/80 group-hover:bg-indigo-600 group-hover:text-white',
          hoverBorder: 'hover:border-indigo-400 hover:shadow-indigo-500/10',
          badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
          tagStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          btnStyle: 'bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white border-indigo-200 group-hover:border-indigo-600',
          topAccent: 'from-indigo-500 to-violet-600',
        },
        {
          id: 'induction',
          name: 'Safety Induction Report',
          categoryTag: 'Induction & Sertifikasi',
          desc: 'Arsip formulir safety induction K3 pekerja/vendor, berkas surat keterangan sehat, dan sertifikat K3 TDE.',
          icon: UserCheck,
          color: 'text-amber-600',
          bgIcon: 'bg-amber-50 text-amber-600 border-amber-200/80 group-hover:bg-amber-500 group-hover:text-white',
          hoverBorder: 'hover:border-amber-400 hover:shadow-amber-500/10',
          badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200/80',
          tagStyle: 'bg-amber-50 text-amber-700 border-amber-200',
          btnStyle: 'bg-amber-50 group-hover:bg-amber-500 text-amber-700 group-hover:text-white border-amber-200 group-hover:border-amber-500',
          topAccent: 'from-amber-400 to-orange-500',
        },
      ];

      return (
        <div className="space-y-6 w-full max-w-6xl">
          {/* Header Banner */}
          <div className="bg-white/95 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-md shadow-blue-500/20">
                <FolderArchive className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Kategori Arsip Dokumen HSE
                  </h3>
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                    {filteredDocuments.length} Dokumen Tersimpan
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                  Pilih folder di bawah untuk mengakses arsip berkas inspeksi K3, presensi TBM harian, dan verifikasi safety induction
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchDocuments(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 shadow-2xs"
              title="Segarkan data arsip & laporan terbaru"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
              <span>Segarkan</span>
            </button>
          </div>

          {/* 3 Modern Vertical Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((cat) => {
              const count = filteredDocuments.filter(d => d.hseType === cat.id).length;
              return (
                <motion.div
                  key={cat.id}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    setSelectedCategory(cat.id as any);
                    setCurrentLevel('category');
                  }}
                  className={`flex flex-col justify-between bg-white border border-slate-200/90 ${cat.hoverBorder} rounded-3xl p-6 transition-all duration-300 group shadow-xs hover:shadow-xl cursor-pointer relative overflow-hidden h-full min-h-[260px]`}
                >
                  {/* Top Color Accent Line */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${cat.topAccent}`} />

                  {/* Upper Section */}
                  <div>
                    {/* Top Row: Icon + Badge */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className={`p-3.5 rounded-2xl border transition-all duration-300 shadow-2xs group-hover:scale-105 ${cat.bgIcon}`}>
                        <cat.icon className="w-6 h-6" />
                      </div>
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${cat.tagStyle}`}>
                        {cat.categoryTag}
                      </span>
                    </div>

                    {/* Title & Description - Full text, NO truncation */}
                    <div className="mt-4">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                        {cat.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                        {cat.desc}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Action Row */}
                  <div className="pt-4 mt-6 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-3 py-1 rounded-full text-xs font-black border ${cat.badgeStyle}`}>
                        {count} Dokumen
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">Tersimpan</span>
                    </div>

                    <div className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 shadow-2xs ${cat.btnStyle}`}>
                      <span>Buka Folder</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      );
    }

    if (currentLevel === 'category') {
      const getCategoryInfo = () => {
        if (selectedCategory === 'inspection') {
          return {
            title: 'HSE Inspection Report',
            tag: 'Inspeksi K3 & Lingkungan',
            tagColor: 'text-blue-700 bg-blue-50 border-blue-200',
            folderColor: 'bg-blue-50 text-blue-600 border-blue-200',
            hoverBorder: 'hover:border-blue-400',
            unitLabel: 'Laporan',
            emptyIcon: ClipboardList,
            emptyTitle: 'Belum ada laporan HSE Inspection yang tersimpan',
            emptyHint: 'Laporan inspeksi K3 yang dibuat akan otomatis tersimpan di dalam folder ini.',
          };
        }
        if (selectedCategory === 'tbm') {
          return {
            title: 'Absen TBM (Toolbox Meeting)',
            tag: 'Presensi Harian',
            tagColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
            folderColor: 'bg-indigo-50 text-indigo-600 border-indigo-200',
            hoverBorder: 'hover:border-indigo-400',
            unitLabel: 'Laporan TBM',
            emptyIcon: Clock,
            emptyTitle: 'Belum ada dokumen Absen TBM yang tersimpan',
            emptyHint: 'Gunakan tab "Absen TBM" pada navigasi atas untuk menginput data briefing TBM baru.',
          };
        }
        return {
          title: 'Safety Induction Report',
          tag: 'Induction & Sertifikasi',
          tagColor: 'text-amber-700 bg-amber-50 border-amber-200',
          folderColor: 'bg-amber-50 text-amber-600 border-amber-200',
          hoverBorder: 'hover:border-amber-400',
          unitLabel: 'Peserta Induction',
          emptyIcon: UserCheck,
          emptyTitle: 'Belum ada dokumen Safety Induction yang tersimpan',
          emptyHint: 'Gunakan tab "Safety Induction" pada navigasi atas untuk mendaftarkan verifikasi induction baru.',
        };
      };

      const catInfo = getCategoryInfo();
      const monthGroups = new Set<string>();
      filteredDocuments
        .filter(d => d.hseType === selectedCategory)
        .forEach(doc => monthGroups.add(getMonthYearString(getDocumentDate(doc))));

      const sortedMonths = Array.from(monthGroups).sort((a, b) => {
        const docA = filteredDocuments.find(d => d.hseType === selectedCategory && getMonthYearString(getDocumentDate(d)) === a);
        const docB = filteredDocuments.find(d => d.hseType === selectedCategory && getMonthYearString(getDocumentDate(d)) === b);
        const timeA = docA ? getDocumentDate(docA).getTime() : 0;
        const timeB = docB ? getDocumentDate(docB).getTime() : 0;
        return timeB - timeA;
      });

      const EmptyIcon = catInfo.emptyIcon;

      return (
        <div className="space-y-5 w-full max-w-6xl">
          {/* Breadcrumb & Folder Header */}
          <div className="bg-white/95 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between flex-wrap gap-3">
            <button
              onClick={() => setCurrentLevel('root')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl transition-colors text-xs font-bold cursor-pointer border border-slate-200 shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali ke Kategori Utama
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Folder:</span>
              <span className={`px-3 py-1.5 text-xs font-black rounded-xl border shadow-2xs ${catInfo.tagColor}`}>
                {catInfo.title}
              </span>
              <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600 rounded-xl border border-slate-200">
                {filteredDocuments.filter(d => d.hseType === selectedCategory).length} Dokumen
              </span>
              <button
                type="button"
                onClick={() => {
                  const catDocs = filteredDocuments.filter(d => d.hseType === selectedCategory);
                  const catNameClean = selectedCategory === 'tbm' ? 'TBM' : selectedCategory === 'induction' ? 'Induction' : 'Inspeksi_HSE';
                  exportHseDocumentsAsZip(catDocs, `Arsip_${catNameClean}_Semua_Bulan_${new Date().toISOString().split('T')[0]}`);
                }}
                disabled={isExportingHseZip || filteredDocuments.filter(d => d.hseType === selectedCategory).length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-indigo-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title="Export seluruh dokumen di kategori ini ke file ZIP berstruktur folder per bulan"
              >
                {isExportingHseZip ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengekspor ({zipProgress.current}/{zipProgress.total || filteredDocuments.filter(d => d.hseType === selectedCategory).length})...</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-3.5 h-3.5" />
                    <span>Export ZIP ({filteredDocuments.filter(d => d.hseType === selectedCategory).length} Dokumen)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Month Folders Grid */}
          {sortedMonths.length === 0 ? (
            <div className="text-center py-16 bg-white/95 backdrop-blur-xl rounded-3xl border border-dashed border-slate-200 shadow-sm p-6">
              <div className="w-16 h-16 mx-auto mb-3 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-200">
                <EmptyIcon className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-base font-bold text-slate-800">{catInfo.emptyTitle}</p>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-md mx-auto">{catInfo.emptyHint}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedMonths.map((month) => {
                const count = filteredDocuments.filter(
                  d => d.hseType === selectedCategory && getMonthYearString(getDocumentDate(d)) === month
                ).length;

                return (
                  <motion.button
                    key={month}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setSelectedMonth(month);
                      setCurrentLevel('month');
                    }}
                    className={`flex items-center justify-between p-5 bg-white border border-slate-200/90 rounded-2xl ${catInfo.hoverBorder} hover:shadow-md transition-all group text-left shadow-2xs cursor-pointer`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`p-3 ${catInfo.folderColor} rounded-xl border group-hover:scale-105 transition-transform shrink-0`}>
                        <Folder className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {month}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          {count} {catInfo.unitLabel}
                        </p>
                      </div>
                    </div>
                    <div className="p-1.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (currentLevel === 'month') {
      // 1. Jika kategori TBM: Langsung tampilkan daftar dokumen TBM di bulan terpilih
      if (selectedCategory === 'tbm') {
        const tbmDocs = filteredDocuments.filter(
          d => d.hseType === 'tbm' && getMonthYearString(getDocumentDate(d)) === selectedMonth
        );

        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <button
                onClick={() => setCurrentLevel('category')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200 w-fit"
              >
                <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar Bulan TBM
              </button>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
                  Absen TBM Bulan {selectedMonth} ({tbmDocs.length} Dokumen)
                </span>
                <button
                  type="button"
                  onClick={() => exportHseDocumentsAsZip(tbmDocs, `Arsip_TBM_${selectedMonth.replace(/\s+/g, '_')}`)}
                  disabled={isExportingHseZip || tbmDocs.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-2xs disabled:opacity-50 cursor-pointer"
                  title={`Export seluruh file Absen TBM bulan ${selectedMonth} ke file ZIP`}
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>Export ZIP ({tbmDocs.length})</span>
                </button>
              </div>
            </div>

            {tbmDocs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 shadow-xs">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Tidak ada laporan Absen TBM pada bulan {selectedMonth}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {tbmDocs.map((document, index) => renderDocumentCard(document, index))}
              </div>
            )}
          </div>
        );
      }

      // 2. Jika kategori Induction: Langsung tampilkan daftar dokumen Safety Induction di bulan terpilih
      if (selectedCategory === 'induction') {
        const inductionDocs = filteredDocuments.filter(
          d => d.hseType === 'induction' && getMonthYearString(getDocumentDate(d)) === selectedMonth
        );

        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <button
                onClick={() => setCurrentLevel('category')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200 w-fit"
              >
                <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar Bulan Induction
              </button>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                  Safety Induction Bulan {selectedMonth} ({inductionDocs.length} Dokumen)
                </span>
                <button
                  type="button"
                  onClick={() => exportHseDocumentsAsZip(inductionDocs, `Arsip_Induction_${selectedMonth.replace(/\s+/g, '_')}`)}
                  disabled={isExportingHseZip || inductionDocs.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-2xs disabled:opacity-50 cursor-pointer"
                  title={`Export seluruh verifikasi Safety Induction bulan ${selectedMonth} ke file ZIP`}
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>Export ZIP ({inductionDocs.length})</span>
                </button>
              </div>
            </div>

            {inductionDocs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 shadow-xs">
                <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Tidak ada laporan Safety Induction pada bulan {selectedMonth}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {inductionDocs.map((document, index) => renderDocumentCard(document, index))}
              </div>
            )}
          </div>
        );
      }

      // 3. Jika kategori Inspection: Tampilkan minggu (Minggu ke-1, 2, 3...)
      const monthDocs = filteredDocuments.filter(d => d.hseType === 'inspection' && getMonthYearString(getDocumentDate(d)) === selectedMonth);
      const weeks = new Set<number>();
      monthDocs.forEach(doc => weeks.add(getWeekOfMonth(getDocumentDate(doc))));

      return (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <button
              onClick={() => setCurrentLevel('category')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200 w-fit"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar Bulan
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 mr-1">Bulan {selectedMonth}:</span>
              <button
                type="button"
                onClick={() => exportHSEInspectionRecapPDF(monthDocs, { companyVariant: 'neutradc', periodLabel: `Bulan ${selectedMonth}` })}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title={`Export PDF Rekapitulasi Bulan ${selectedMonth} (Logo Dwimitra & NeutraDC)`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF NeutraDC ({monthDocs.length})</span>
              </button>
              <button
                type="button"
                onClick={() => exportHSEInspectionRecapPDF(monthDocs, { companyVariant: 'utt', periodLabel: `Bulan ${selectedMonth}` })}
                className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title={`Export PDF Rekapitulasi Bulan ${selectedMonth} (Logo UTT & NeutraDC)`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF UTT ({monthDocs.length})</span>
              </button>
              <button
                type="button"
                onClick={() => exportHseDocumentsAsZip(monthDocs, `Arsip_Inspeksi_HSE_${selectedMonth.replace(/\s+/g, '_')}`)}
                disabled={isExportingHseZip || monthDocs.length === 0}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
                title={`Export seluruh file PDF bulan ${selectedMonth} ke dalam ZIP`}
              >
                <FolderArchive className="w-3.5 h-3.5" />
                <span>Export ZIP ({monthDocs.length})</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from(weeks).sort((a, b) => b - a).map((week) => (
              <motion.button
                key={week}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedWeek(week);
                  setCurrentLevel('week');
                }}
                className="flex items-center gap-4 p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-400 hover:shadow-md transition-all group text-left shadow-sm cursor-pointer"
              >
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <Folder className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Minggu ke-{week}</h3>
                  <p className="text-sm font-medium text-slate-500">
                    {monthDocs.filter(d => getWeekOfMonth(getDocumentDate(d)) === week).length} Laporan
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      );
    }

    const displayDocs = currentLevel === 'week'
      ? filteredDocuments.filter(d => d.hseType === 'inspection' && getMonthYearString(getDocumentDate(d)) === selectedMonth && getWeekOfMonth(getDocumentDate(d)) === selectedWeek)
      : filteredDocuments.filter(d => d.hseType === selectedCategory && d.maintenanceType === selectedMaintenance);

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <button
            onClick={() => setCurrentLevel(selectedCategory === 'inspection' ? 'month' : 'category')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200 w-fit"
          >
            <ChevronLeft className="w-4 h-4" /> Kembali
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 mr-1">
              {currentLevel === 'week' ? `Minggu ke-${selectedWeek}:` : 'Dokumen Terpilih:'}
            </span>
            <button
              type="button"
              onClick={() => exportHSEInspectionRecapPDF(displayDocs, {
                companyVariant: 'neutradc',
                periodLabel: currentLevel === 'week' ? `Minggu ke-${selectedWeek} ${selectedMonth}` : undefined
              })}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Export PDF Rekapitulasi (Logo Dwimitra & NeutraDC)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF NeutraDC ({displayDocs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => exportHSEInspectionRecapPDF(displayDocs, {
                companyVariant: 'utt',
                periodLabel: currentLevel === 'week' ? `Minggu ke-${selectedWeek} ${selectedMonth}` : undefined
              })}
              className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Export PDF Rekapitulasi (Logo UTT & NeutraDC)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF UTT ({displayDocs.length})</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {displayDocs.map((document, index) => renderDocumentCard(document, index))}
        </div>
      </div>
    );
  };

  const renderDocumentCard = (document: ExcelDocument, index: number) => {
    const showUploadSR = Boolean(
      (isEngineer || isPrivileged || isServiceReportSupported(document.createdBy)) &&
      document.documentType === 'pdf'
    );
    const hasSR = Boolean(document.attachedSrFile || document.attachedSrBase64);

    return (
      <motion.div
        key={document.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2, delay: index * 0.05 }}
        className="bg-white/90 backdrop-blur-xl rounded-2xl p-3.5 sm:p-5 border border-sky-100/90 hover:border-blue-300 shadow-md text-slate-800 transition group w-full max-w-full overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full min-w-0">
          <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
            <div className={`p-2.5 sm:p-3 rounded-xl border flex-shrink-0 mt-0.5 sm:mt-0 ${
              document.documentType === 'pdf'
                ? 'bg-red-50/80 border-red-200 text-red-600'
                : 'bg-emerald-50 border-emerald-200 text-emerald-600'
            }`}>
              {document.documentType === 'pdf' ? (
                <FileType className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-lg font-black text-slate-900 leading-snug break-words">
                  {document.maintenanceName}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  document.documentType === 'pdf'
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                }`}>
                  {document.documentType.toUpperCase()}
                </span>
                {document.hasAbnormal && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-600 text-white border border-red-700 shadow-xs flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="w-3 h-3 shrink-0" /> Abnormal
                  </span>
                )}
                {hasSR ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> FOTO + SERVICE REPORT
                  </span>
                ) : document.documentType === 'pdf' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    DOKUMENTASI FOTO
                  </span>
                ) : null}
                {document.hseType && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                    document.hseType === 'tbm'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : document.hseType === 'induction'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {document.hseType === 'tbm' ? 'ABSEN TBM' : document.hseType === 'induction' ? 'SAFETY INDUCTION' : document.hseType}
                  </span>
                )}
                {document.deleteRequested && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse uppercase">
                    Menunggu Hapus
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1.5 text-xs text-slate-500">
                <div className="flex items-center gap-1 shrink-0" title="Tanggal Pelaksanaan Pekerjaan">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {(() => {
                      if (document.maintenanceTime?.includes(' - ')) {
                        return document.maintenanceTime.split(' - ').map(part => {
                          const d = getDocumentDate({ maintenanceTime: part.trim() });
                          return isNaN(d.getTime()) ? part : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                        }).join(' - ');
                      }
                      const d = getDocumentDate(document);
                      return isNaN(d.getTime())
                        ? document.maintenanceTime
                        : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                    })()}
                  </span>
                </div>
                {(document.updatedAt || document.createdAt) && (
                  <div
                    className="flex items-center gap-1 shrink-0 text-slate-500 font-medium"
                    title={`Waktu Masuk / Export: ${(document.updatedAt || document.createdAt)?.toLocaleString('id-ID')}`}
                  >
                    <FileUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {document.updatedAt ? 'Update: ' : 'Masuk: '}
                      {(() => {
                        const actDate = document.updatedAt || document.createdAt;
                        if (!actDate) return '';
                        const now = new Date();
                        const diffMs = now.getTime() - actDate.getTime();
                        if (diffMs >= 0 && diffMs < 60000) return 'Baru saja';
                        if (diffMs >= 0 && diffMs < 3600000) return `${Math.floor(diffMs / 60000)} mnt lalu`;
                        const isToday = actDate.toDateString() === now.toDateString();
                        if (isToday) {
                          return `Hari ini, ${actDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
                        }
                        return actDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                      })()}
                    </span>
                  </div>
                )}
                {document.documentType !== 'hse' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <FileDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{(document.fileSize / 1024).toFixed(0)} KB</span>
                  </div>
                )}
                {document.specificDetail && (
                  <div className="flex items-center gap-1 min-w-0 max-w-full">
                    <Box className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
                    <span className="truncate text-blue-600 font-semibold">{document.specificDetail}</span>
                  </div>
                )}
                {document.maintenanceType && (
                  <div className="flex items-center gap-1 shrink-0">
                    <FileType className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="text-orange-600 font-bold">{document.maintenanceType}</span>
                  </div>
                )}
              </div>

              {/* Panel Rincian Temuan Abnormal */}
              {document.hasAbnormal && (
                <div className="mt-2.5 p-3 rounded-xl bg-rose-50/90 border border-rose-200 text-xs space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 font-black text-rose-800 tracking-tight">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Kondisi Abnormal: {document.abnormalFinding?.unitName || document.specificDetail || document.maintenanceName}</span>
                    </div>
                    {document.abnormalFinding?.reportedAt && (
                      <span className="text-[10px] font-semibold text-rose-600 shrink-0">
                        {new Date(document.abnormalFinding.reportedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>

                  <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                    {document.abnormalFinding?.description || (document.abnormalFinding as any)?.remark || 'Ditemukan kondisi kelainan / abnormal pada unit ini.'}
                  </p>

                  {Boolean(document.abnormalFinding?.actionRecommendation || (document.abnormalFinding as any)?.recommendation) && (
                    <div className="text-[11px] text-amber-900 bg-amber-50/90 p-2 rounded-lg border border-amber-200">
                      <strong className="text-amber-950 font-bold">Rekomendasi: </strong>
                      {document.abnormalFinding?.actionRecommendation || (document.abnormalFinding as any)?.recommendation}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-rose-100/80">
                    <span>Pelapor: <strong className="text-slate-700">{document.abnormalFinding?.reportedBy || 'Engineer'}</strong></span>
                    {Boolean(document.abnormalFinding?.photoBase64 || ((document.abnormalFinding as any)?.photos && (document.abnormalFinding as any)?.photos[0]?.base64)) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const photoSrc = document.abnormalFinding?.photoBase64 || ((document.abnormalFinding as any)?.photos && (document.abnormalFinding as any)?.photos[0]?.base64);
                          setPreviewPhoto({
                            src: photoSrc,
                            title: `Foto Bukti Abnormal: ${document.abnormalFinding?.unitName || document.maintenanceName}`
                          });
                        }}
                        className="flex items-center gap-1 font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-rose-600" />
                        <span>Lihat Foto Bukti</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Responsive 2-column grid on mobile, inline flex row on desktop */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2 w-full sm:w-auto mt-3 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
            {/* Tombol Catat / Kelola Abnormal (Khusus Role Engineer & Admin) */}
            {(isEngineer || isAdmin) && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setAbnormalModalDoc(document)}
                className={`w-full sm:w-auto py-2 sm:py-2.5 px-3 rounded-xl transition border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap ${
                  document.hasAbnormal
                    ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-300 ring-1 ring-rose-400'
                    : 'bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border-slate-200 hover:border-rose-200'
                }`}
                title={document.hasAbnormal ? "Kelola / Perbarui Temuan Abnormal" : "Catat Temuan Abnormal pada Unit Ini"}
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${document.hasAbnormal ? 'text-rose-600' : 'text-slate-500'}`} />
                <span className="font-bold">
                  {document.hasAbnormal ? 'Kelola Abnormal' : '+ Abnormal'}
                </span>
              </motion.button>
            )}

            {document.documentType === 'hse' && userRole !== 'hse' ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleEditClick(document)}
                className="w-full sm:w-auto py-2 sm:py-2.5 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl transition border border-sky-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
                title="Lihat Laporan HSE"
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span className="sm:hidden font-bold">Lihat</span>
              </motion.button>
            ) : onEdit && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleEditClick(document)}
                className="w-full sm:w-auto py-2 sm:py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition border border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
                title={document.documentType === 'hse' ? "Edit Laporan HSE" : isDME ? "View Report" : "Edit Report"}
              >
                {isDME && document.documentType !== 'hse' ? (
                  <>
                    <Search className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden font-bold">Lihat</span>
                  </>
                ) : (
                  <>
                    <Pencil className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden font-bold">Edit</span>
                  </>
                )}
              </motion.button>
            )}

            {/* Tombol Upload Service Report (Khusus Akun Engineer / Dokumen PDF) */}
            {showUploadSR && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setUploadSrModalDoc(document)}
                className={`w-full sm:w-auto py-2 sm:py-2.5 px-3 rounded-xl transition border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap ${
                  hasSR
                    ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                    : 'bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border-indigo-200'
                }`}
                title={hasSR ? "Update / Ganti Berkas Service Report" : "Upload Berkas Service Report (Excel / PDF)"}
              >
                <FileUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-bold">
                  {hasSR ? 'Update SR' : 'Upload SR'}
                </span>
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (document.documentType === 'pdf') {
                  if (hasSR) {
                    setDownloadChoiceDoc(document);
                  } else {
                    handleDownloadPDF(document);
                  }
                } else if (document.documentType === 'hse') {
                  handleDownloadHSE(document);
                } else {
                  handleDownload(document);
                }
              }}
              className="w-full sm:w-auto py-2 sm:py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
              title={`Download ${document.documentType === 'pdf' ? 'PDF' : 'Excel'}`}
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden font-bold">Download</span>
            </motion.button>

            {canDelete && (
              <motion.button
                whileHover={{ scale: document.deleteRequested && !isQcDme ? 1 : 1.02 }}
                whileTap={{ scale: document.deleteRequested && !isQcDme ? 1 : 0.98 }}
                onClick={() => {
                  if (document.deleteRequested && !isQcDme) return;
                  openDeleteModal(document);
                }}
                disabled={document.deleteRequested && !isQcDme}
                className={`w-full sm:w-auto py-2 sm:py-2.5 px-3 rounded-xl transition border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap ${
                  !showUploadSR && onEdit ? 'col-span-2 sm:col-span-1' : ''
                } ${
                  document.deleteRequested
                    ? isQcDme
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300'
                      : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                }`}
                title={document.deleteRequested ? isQcDme ? "Tinjau Pengajuan Hapus" : "Menunggu Persetujuan Hapus QC DME" : isQcDme ? "Hapus Permanen" : "Ajukan Hapus ke QC DME"}
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span className="sm:hidden font-bold">
                  {document.deleteRequested ? (isQcDme ? 'Tinjau' : 'Menunggu') : (isQcDme ? 'Hapus' : 'Ajukan Hapus')}
                </span>
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const handleEditClick = async (doc: ExcelDocument) => {
    if (doc.documentType !== 'hse' && !onEdit) return;

    try {
      toast.loading(doc.documentType === 'hse' ? 'Membuka arsip HSE...' : 'Preparing data for editing...', { id: 'edit-prep' });
      let photosData = doc.photosData || [];

      // 1. Prioritaskan pembacaan dari IndexedDB lokal
      if (photosData.length === 0) {
        try {
          const offPhotos = await offlineReportStorage.getPhotos(doc.id);
          if (offPhotos && offPhotos.length > 0) {
            photosData = offPhotos.map(p => ({
              index: p.index,
              description: p.description || '',
              photoBase64: p.photoBase64 || '',
              hasPhoto: p.hasPhoto
            }));
          }
        } catch (offErr) {
          console.warn('offlineReportStorage getPhotos on edit error:', offErr);
        }
      }

      // 2. Fallback ke Firestore subcollection (Online atau Cache)
      if (photosData.length === 0) {
        let colName = '';
        if (doc.documentType === 'excel') colName = 'excel_documents';
        else if (doc.documentType === 'pdf') colName = 'pdf_documents';
        else if (doc.documentType === 'hse') colName = 'hse';

        if (colName) {
          const colRef = collection(db, `${colName}/${doc.id}/photos`);
          let photosSnap: any = null;
          if (navigator.onLine) {
            try {
              photosSnap = await getDocs(colRef);
            } catch {
              photosSnap = await getDocsFromCache(colRef).catch(() => null);
            }
          } else {
            photosSnap = await getDocsFromCache(colRef).catch(() => null);
          }

          if (photosSnap && !photosSnap.empty) {
            photosData = photosSnap.docs
              .map((d: any) => d.data() as any)
              .sort((a: any, b: any) => a.index - b.index);
          }
        }
      }

      // Arsip HSE adalah read-only untuk role selain HSE Officer. HSE Officer
      // diarahkan ke form asli agar dapat mengubah laporan di dalam website.
      if (doc.documentType === 'hse' && userRole !== 'hse') {
        setPreviewHseDoc({ ...doc, photosData });
      } else if (onEdit) {
        onEdit({ ...doc, photosData });
      }
      toast.dismiss('edit-prep');
    } catch (err) {
      console.error('Failed to prepare data for edit:', err);
      toast.error('Failed to prepare data for editing', { id: 'edit-prep' });
    }
  };

  return (
    <div className={`w-full relative z-10 min-w-0 overflow-x-hidden ${filterOverride === 'hse_utt' ? 'py-1 pb-16' : 'max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 lg:py-8 pb-32 sm:pb-16'}`}>
      { }
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 mb-3.5 sm:mb-6 border border-sky-100/90 shadow-xl shadow-sky-900/5 text-slate-800 w-full max-w-full overflow-hidden">
        <div className="mb-3.5 sm:mb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
              {filterOverride === 'hse_utt'
                ? 'Arsip Laporan Inspeksi HSE'
                : viewMode === 'flat'
                  ? 'Arsip Dokumen'
                  : 'Management File & Arsip Dokumen'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mt-0.5">
              {filterOverride === 'hse_utt'
                ? 'Semua berkas laporan inspeksi keselamatan kerja K3 & HSE terpusat'
                : viewMode === 'flat'
                  ? 'Arsip laporan maintenance akun Anda — hasil export PDF tersimpan di sini'
                  : 'Semua berkas operasional, laporan preventive & corrective maintenance terpusat'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchDocuments(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 shadow-2xs"
            title="Segarkan data arsip & laporan terbaru dari server"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Tier 1: Search Bar & Control Dropdowns */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3 w-full min-w-0">
          {/* Input Pencarian */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari dokumen, nomor laporan, atau kegiatan..."
              className="w-full pl-10 sm:pl-11 pr-10 py-2 sm:py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDmeSearchMode('folder');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
                title="Bersihkan pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Control Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* Sort Dropdown */}
            <div className="relative flex-1 sm:flex-initial min-w-[200px]">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full pl-9 pr-7 py-2 sm:py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-800 cursor-pointer text-xs sm:text-sm font-semibold shadow-2xs"
                title="Urutkan dokumen"
              >
                <option value="newest_upload">Terbaru Masuk / Export</option>
                <option value="maintenance_newest">Tgl Pelaksanaan (Terbaru)</option>
                <option value="maintenance_oldest">Tgl Pelaksanaan (Terlama)</option>
              </select>
            </div>

            {/* File Type Dropdown (!isDME) */}
            {!isDME && (
              <div className="relative flex-1 sm:flex-initial min-w-[130px]">
                <FileType className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full pl-9 pr-6 py-2 sm:py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-800 cursor-pointer text-xs sm:text-sm font-semibold shadow-2xs"
                  title="Filter tipe dokumen"
                >
                  <option value="all">Semua Tipe</option>
                  <option value="excel">Excel</option>
                  <option value="pdf">PDF</option>
                  <option value="hse">HSE</option>
                </select>
              </div>
            )}

            {/* Admin Delete Filter */}
            {isAdmin && (
              <div className="relative flex-1 sm:flex-initial min-w-[190px]">
                <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <select
                  value={adminDeleteFilter}
                  onChange={(e) => setAdminDeleteFilter(e.target.value as any)}
                  className="w-full pl-9 pr-6 py-2 sm:py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-800 cursor-pointer text-xs sm:text-sm font-semibold shadow-2xs"
                  title="Filter pengajuan admin"
                >
                  <option value="all">Semua Dokumen ({documents.length})</option>
                  <option value="pending_delete">Menunggu Hapus ({documents.filter(d => d.deleteRequested).length})</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tier 2: Date Range Toolbar & Quick Presets */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-50/70 p-2.5 sm:p-3 rounded-2xl border border-slate-200/80">
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 text-slate-600 text-xs font-bold shrink-0">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Rentang Tanggal:</span>
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition shadow-2xs">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent outline-none text-slate-900 text-xs font-semibold cursor-pointer w-[125px] sm:w-[130px]"
                title="Dari tanggal"
              />
            </div>

            <span className="text-slate-400 font-bold text-xs select-none">s/d</span>

            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition shadow-2xs">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent outline-none text-slate-900 text-xs font-semibold cursor-pointer w-[125px] sm:w-[130px]"
                title="Sampai tanggal"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-semibold mr-1 hidden sm:inline">Pilihan Cepat:</span>
            {[
              { label: 'Bulan Ini', preset: 'this_month' as const },
              { label: 'Bulan Lalu', preset: 'last_month' as const },
              { label: 'Tahun Ini', preset: 'this_year' as const },
            ].map((p) => (
              <button
                key={p.preset}
                type="button"
                onClick={() => {
                  const { start, end } = getPresetRange(p.preset);
                  setStartDate(start);
                  setEndDate(end);
                }}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium transition cursor-pointer shadow-2xs"
              >
                {p.label}
              </button>
            ))}
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ml-1"
                title="Reset rentang tanggal"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs (Foto Saja vs Foto + Service Report vs Dokumen Abnormal) */}
        {filterOverride !== 'hse_utt' && (
          <div className="mt-3 pt-3 border-t border-slate-200/80 w-full">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 w-full">
              <button
                type="button"
                onClick={() => setSrStatusFilter('all')}
                className={`w-full py-1.5 sm:py-2 px-1 sm:px-3 rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 text-xs cursor-pointer min-w-0 ${
                  srStatusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-sm font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-semibold'
                }`}
              >
                <FolderArchive className={`w-3.5 h-3.5 shrink-0 ${srStatusFilter === 'all' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">Semua Dokumen</span>
                <span className="sm:hidden truncate">Semua</span>
                <span className={`px-1 sm:px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                  srStatusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {documents.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSrStatusFilter('photos_only')}
                className={`w-full py-1.5 sm:py-2 px-1 sm:px-3 rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 text-xs cursor-pointer min-w-0 ${
                  srStatusFilter === 'photos_only'
                    ? 'bg-slate-900 text-white shadow-sm font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-semibold'
                }`}
              >
                <Camera className={`w-3.5 h-3.5 shrink-0 ${srStatusFilter === 'photos_only' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="truncate">Foto Saja</span>
                <span className={`px-1 sm:px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                  srStatusFilter === 'photos_only' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {documents.filter(d => !(d.attachedSrFile || d.attachedSrBase64)).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSrStatusFilter('with_sr')}
                className={`w-full py-1.5 sm:py-2 px-1 sm:px-3 rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 text-xs cursor-pointer min-w-0 ${
                  srStatusFilter === 'with_sr'
                    ? 'bg-slate-900 text-white shadow-sm font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-semibold'
                }`}
              >
                <FileCheck className={`w-3.5 h-3.5 shrink-0 ${srStatusFilter === 'with_sr' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">Foto + SR Lengkap</span>
                <span className="sm:hidden truncate">Foto + SR</span>
                <span className={`px-1 sm:px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                  srStatusFilter === 'with_sr' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {documents.filter(d => Boolean(d.attachedSrFile || d.attachedSrBase64)).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSrStatusFilter('abnormal_only')}
                className={`w-full py-1.5 sm:py-2 px-1 sm:px-3 rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 text-xs cursor-pointer min-w-0 ${
                  srStatusFilter === 'abnormal_only'
                    ? 'bg-rose-700 text-white shadow-sm font-bold ring-2 ring-rose-500/50'
                    : 'bg-rose-50/90 text-rose-700 hover:text-rose-900 hover:bg-rose-100/90 border border-rose-200/80 font-semibold'
                }`}
              >
                <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${srStatusFilter === 'abnormal_only' ? 'text-amber-300' : 'text-rose-600'}`} />
                <span className="hidden sm:inline">Dokumen Abnormal</span>
                <span className="sm:hidden truncate">Abnormal</span>
                <span className={`px-1 sm:px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                  srStatusFilter === 'abnormal_only' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-800'
                }`}>
                  {documents.filter(d => Boolean(d.hasAbnormal)).length}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Kartu Statistik */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 mt-3.5 w-full">
          <div className="bg-slate-50/80 rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs min-w-0 overflow-hidden flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0 border border-blue-100">
              <FolderArchive className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Total Dokumen</p>
              <p className="text-base sm:text-xl font-black text-slate-900 mt-0.5 truncate">
                {isDME && filterOverride !== 'hse_utt' ? documents.length + managementFilesCount : documents.length}
              </p>
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs min-w-0 overflow-hidden flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 border border-indigo-100">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Hasil Filter</p>
              <p className="text-base sm:text-xl font-black text-slate-900 mt-0.5 truncate">
                {isDME && filterOverride !== 'hse_utt' && !(searchQuery || startDate || endDate) ? filteredDocuments.length + managementFilesCount : filteredDocuments.length}
              </p>
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs min-w-0 overflow-hidden flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl shrink-0 border border-teal-100">
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Total Ukuran</p>
              <p className="text-base sm:text-xl font-black text-slate-900 mt-0.5 truncate">
                {((documents.reduce((sum, doc) => sum + doc.fileSize, 0) + (isDME && filterOverride !== 'hse_utt' ? managementFilesSize : 0)) / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs min-w-0 overflow-hidden flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0 border border-amber-100">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Status Filter</p>
              <p className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5 flex items-center gap-1.5 truncate">
                <span className={`w-2 h-2 rounded-full shrink-0 ${(searchQuery || startDate || endDate || (filterType !== 'all' && !isDME) || (srStatusFilter !== 'all' && !isDME)) ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                  }`} />
                <span className="truncate">{(searchQuery || startDate || endDate || (filterType !== 'all' && !isDME) || (srStatusFilter !== 'all' && !isDME)) ? 'Filter Aktif' : 'Semua Data'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Toggle Mode Tampilan DME saat pencarian aktif (Struktur Folder vs File Langsung) */}
        {isDME && filterOverride !== 'hse_utt' && searchQuery.trim() !== '' && (
          <div className="mt-3.5 pt-3.5 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-2.5 bg-gradient-to-r from-amber-50/60 via-slate-50 to-blue-50/60 p-2.5 sm:p-3 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700 shrink-0">Tampilan Hasil:</span>
              <div className="inline-flex p-1 bg-white border border-slate-200/90 rounded-xl gap-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDmeSearchMode('folder')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    dmeSearchMode === 'folder'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Struktur Folder</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDmeSearchMode('files')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    dmeSearchMode === 'files'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Semua File Langsung ({filteredDocuments.length})</span>
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <span>Menyaring:</span>
              <span className="font-bold text-slate-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200/90">"{searchQuery}"</span>
            </div>
          </div>
        )}

        {/* Tombol Export Rekap PDF HSE (NeutraDC & UTT) - Khusus Role HSE / filterOverride 'hse_utt' */}
        {filterOverride === 'hse_utt' && (
          <div className="mt-4 pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 p-3 sm:p-4 rounded-2xl border border-blue-100 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight truncate">
                  Export Rekapitulasi Laporan Inspeksi (PDF)
                </h4>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                  Rekap seluruh data & foto inspeksi terpilih ke dokumen PDF resmi bergrid biru
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => handleOpenHseRecapModal('neutradc')}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 transition cursor-pointer shrink-0 whitespace-nowrap"
                title="Export PDF Rekapitulasi Inspeksi HSE (Header Logo Dwimitra & NeutraDC)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF NeutraDC</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenHseRecapModal('utt')}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-teal-500/20 transition cursor-pointer shrink-0 whitespace-nowrap"
                title="Export PDF Rekapitulasi Inspeksi HSE (Header Logo UTT & NeutraDC)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF UTT</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenHseRecapModal('neutradc')}
                disabled={isExportingHseZip}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-500/20 transition cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50"
                title="Export Kumpulan Laporan HSE ke format ZIP"
              >
                {isExportingHseZip ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengekspor ({zipProgress.current}/{zipProgress.total})...</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-3.5 h-3.5" />
                    <span>Export ZIP Semua Tipe</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm sm:text-base">Memuat dokumen...</p>
          </div>
        </div>
      ) : fetchError ? (
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-8 sm:p-12 border border-red-500/30 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
            <FileSpreadsheet className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-red-300 mb-2">Gagal Memuat Data</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">{fetchError}</p>
          <button
            onClick={() => fetchDocuments()}
            className="px-6 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl font-bold text-sm transition-all hover:scale-105"
          >
            Coba Lagi
          </button>
        </div>
      ) : (filterOverride === 'hse_utt' && filteredDocuments.length === 0) ? (
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-sky-100/90 shadow-md text-center">
          <FileSpreadsheet className="w-12 h-12 sm:w-16 sm:h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
            {documents.length === 0 ? 'Belum ada dokumen' : 'Tidak ada hasil'}
          </h3>
          <p className="text-sm sm:text-base text-slate-500 font-medium">
            {documents.length === 0
              ? 'Mulai ekspor report untuk membuat dokumen pertama Anda'
              : 'Coba ubah filter pencarian Anda'}
          </p>
        </div>
      ) : (
        <div ref={contentAreaRef} className={`scroll-mt-20 ${currentLevel !== 'week' && filterOverride === 'hse_utt' ? 'block' : 'grid grid-cols-1 gap-3 sm:gap-4'}`}>
          <AnimatePresence mode="popLayout">
            {renderContent()}
          </AnimatePresence>
        </div>
      )}

      {/* Modal Pilihan Download Dokumen (Foto Saja, Service Report Excel Saja, atau Lengkap Foto+SR) */}
      <AnimatePresence>
        {downloadChoiceDoc && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-2xl">
                    <Download className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Opsi Download Dokumen</h3>
                    <p className="text-xs text-blue-200/80 line-clamp-1 max-w-[280px] sm:max-w-xs">
                      {downloadChoiceDoc.maintenanceName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDownloadChoiceDoc(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body: Option Cards */}
              <div className="p-6 space-y-3.5 bg-slate-50/50">
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Laporan ini memiliki lembar <strong>Service Report (SR)</strong> dan <strong>Dokumentasi Foto</strong>. Silakan pilih format ekspor yang Anda perlukan:
                </p>

                {/* Option 1: Foto Saja */}
                <button
                  type="button"
                  onClick={() => {
                    const doc = downloadChoiceDoc;
                    setDownloadChoiceDoc(null);
                    handleDownloadPhotosOnly(doc);
                  }}
                  className="w-full flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-400 hover:shadow-md hover:bg-blue-50/30 transition-all text-left group cursor-pointer"
                >
                  <div className="p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 group-hover:scale-105 transition-transform shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition-colors">
                        Dokumentasi Foto Saja
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        .PDF
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Download hanya berkas foto-foto dokumentasi pekerjaan maintenance (tanpa lembar Service Report).
                    </p>
                  </div>
                </button>

                {/* Option 2: Service Report Saja (Excel) */}
                <button
                  type="button"
                  onClick={() => {
                    const doc = downloadChoiceDoc;
                    setDownloadChoiceDoc(null);
                    handleDownloadSROnly(doc);
                  }}
                  className="w-full flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500 hover:shadow-md hover:bg-emerald-50/30 transition-all text-left group cursor-pointer"
                >
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 group-hover:scale-105 transition-transform shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                        Service Report Saja (Excel)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        .XLSX
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Download file formulir Service Report format Excel (.xlsx) dari berkas yang di-upload atau format template resmi.
                    </p>
                  </div>
                </button>

                {/* Option 3: Lengkap Foto + Service Report */}
                <button
                  type="button"
                  onClick={() => {
                    const doc = downloadChoiceDoc;
                    setDownloadChoiceDoc(null);
                    handleDownloadPDF(doc);
                  }}
                  className="w-full flex items-start gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-blue-50/60 to-emerald-50/60 border border-blue-200/80 hover:border-blue-500 hover:shadow-md transition-all text-left group cursor-pointer"
                >
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-teal-600 text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-blue-800 transition-colors">
                        Lengkap: Foto + Service Report
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-teal-600 text-white font-mono">
                        .PDF
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Dokumen resmi komprehensif: lembar formulir Service Report + seluruh dokumentasi foto ber-layout ISO.
                    </p>
                  </div>
                </button>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-white border-t border-slate-200/80 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDownloadChoiceDoc(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => !bulkDeleting && setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        onRejectRequest={isQcDme ? rejectDeleteRequest : undefined}
        documentName={documentToDelete?.fileName || ''}
        loading={bulkDeleting}
        isRequested={documentToDelete?.deleteRequested || false}
        requestedBy={documentToDelete?.deleteRequestedBy || ''}
        isAdmin={isQcDme}
        deleteReason={documentToDelete?.deleteReason || ''}
        requireReason={!isQcDme}
      />

      <UploadSRModal
        isOpen={!!uploadSrModalDoc}
        onClose={() => setUploadSrModalDoc(null)}
        document={uploadSrModalDoc}
        onSuccess={(updatedFields) => {
          if (!uploadSrModalDoc) return;
          setDocuments(prev =>
            prev.map(d =>
              d.id === uploadSrModalDoc.id ? { ...d, ...updatedFields, updatedAt: new Date() } : d
            )
          );
          setUploadSrModalDoc(null);
        }}
      />

      <AbnormalReportModal
        isOpen={!!abnormalModalDoc}
        onClose={() => setAbnormalModalDoc(null)}
        document={abnormalModalDoc}
        onSuccess={(updatedFields) => {
          if (!abnormalModalDoc) return;
          setDocuments(prev =>
            prev.map(d =>
              d.id === abnormalModalDoc.id ? { ...d, ...updatedFields, updatedAt: new Date() } : d
            )
          );
          setAbnormalModalDoc(null);
        }}
      />

      {/* ===== Modal Export Rekapitulasi Laporan Inspeksi HSE ===== */}
      <AnimatePresence>
        {isHseRecapModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 sm:space-y-5 border border-slate-100 my-auto text-slate-800"
            >
              {/* Header Modal */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 sm:pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 sm:p-3 rounded-2xl ${hseRecapVariant === 'neutradc' ? 'bg-blue-50 text-blue-600' : 'bg-teal-50 text-teal-600'}`}>
                    <FileDown className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                      Export Rekapitulasi Laporan Inspeksi HSE
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pilih rentang tanggal pelaksanaan & format rekap PDF Landscape A4
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHseRecapModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Company Variant Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Format Kop & Logo Dokumen
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHseRecapVariant('neutradc')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      hseRecapVariant === 'neutradc'
                        ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-xs ring-1 ring-blue-400'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>PDF NeutraDC (DME)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHseRecapVariant('utt')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      hseRecapVariant === 'utt'
                        ? 'bg-teal-50 border-teal-400 text-teal-700 shadow-xs ring-1 ring-teal-400'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    <span>PDF UTT</span>
                  </button>
                </div>
              </div>

              {/* Date Range Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Rentang Tanggal Pelaksanaan</span>
                  </label>
                  {(hseRecapStartDate || hseRecapEndDate) && (
                    <button
                      type="button"
                      onClick={() => { setHseRecapStartDate(''); setHseRecapEndDate(''); }}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                    >
                      Reset Tanggal
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1 font-medium">Dari Tanggal (Mulai):</span>
                    <input
                      type="date"
                      value={hseRecapStartDate}
                      onChange={(e) => setHseRecapStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium cursor-pointer"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1 font-medium">Sampai Tanggal (Selesai):</span>
                    <input
                      type="date"
                      value={hseRecapEndDate}
                      onChange={(e) => setHseRecapEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium cursor-pointer"
                    />
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">Preset:</span>
                  {[
                    { label: 'Bulan Ini', preset: 'this_month' as const },
                    { label: 'Bulan Lalu', preset: 'last_month' as const },
                    { label: 'Tahun Ini', preset: 'this_year' as const },
                    { label: 'Semua Data', preset: 'all' as const },
                  ].map((chip) => (
                    <button
                      key={chip.preset}
                      type="button"
                      onClick={() => {
                        const { start, end } = getPresetRange(chip.preset);
                        setHseRecapStartDate(start);
                        setHseRecapEndDate(end);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg text-[11px] font-medium transition cursor-pointer border border-transparent hover:border-blue-200"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Summary Card */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>Laporan yang akan direkap:</span>
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {docsForHseRecap.length} Dokumen
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-1 border-t border-slate-200/60">
                  <span className="font-medium text-slate-700">Label Header PDF:</span>
                  <span className="truncate italic text-slate-600">
                    Periode: {computeHseRecapPeriodLabel()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsHseRecapModalOpen(false)}
                  disabled={isExportingHseRecap}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDownloadHseZip}
                  disabled={isExportingHseRecap || docsForHseRecap.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shadow-md shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FolderArchive className="w-4 h-4 shrink-0" />
                  <span>Unduh ZIP ({docsForHseRecap.length} File)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadHseInspectionRecap}
                  disabled={isExportingHseRecap || docsForHseRecap.length === 0}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                    hseRecapVariant === 'neutradc'
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                      : 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/25'
                  }`}
                >
                  {isExportingHseRecap ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 shrink-0" />
                      <span>Rekap PDF ({docsForHseRecap.length} Dokumen)</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox Modal Preview Foto Bukti Abnormal */}
      <AnimatePresence>
        {previewPhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-4xl w-full max-h-[92vh] bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-700"
            >
              {/* Tombol Tutup X Merah di Pojok Kanan Atas */}
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 z-20 w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center transition-all shadow-lg cursor-pointer hover:rotate-90 duration-200 border border-red-500"
                title="Tutup Preview"
                aria-label="Tutup Preview"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>

              <div className="p-3.5 pr-14 sm:pr-16 bg-slate-800 text-white flex items-center justify-between border-b border-slate-700">
                <div className="flex items-center gap-2 min-w-0 pr-4">
                  <Camera className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold truncate text-slate-200">{previewPhoto.title}</span>
                </div>
              </div>
              <div className="p-3 overflow-auto flex items-center justify-center bg-black/90 flex-1 min-h-[300px]">
                <img
                  src={previewPhoto.src}
                  alt={previewPhoto.title}
                  className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewHseDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-5xl w-full h-[95vh] bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-700"
            >
              <button
                type="button"
                onClick={() => setPreviewHseDoc(null)}
                className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 z-20 w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center transition-all shadow-lg cursor-pointer hover:rotate-90 duration-200 border border-red-500"
                title="Tutup Preview"
                aria-label="Tutup Preview"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
              
              <div className="flex-1 overflow-y-auto">
                <HSEReportViewer 
                  reportId={previewHseDoc.id} 
                  prefetchedPhotos={previewHseDoc.photosData}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modern Floating ZIP Export Progress Modal */}
      <AnimatePresence>
        {zipProgress.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 max-w-md w-full p-6 sm:p-7 relative overflow-hidden"
            >
              {/* Header Gradient Glow Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

              <div className="flex items-center gap-4 mb-5">
                <div className="w-13 h-13 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-xs relative">
                  {zipProgress.stage === 'completed' ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                  ) : (
                    <>
                      <FolderArchive className="w-6 h-6 text-indigo-600" />
                      <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[9px] font-black shadow-xs">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      </div>
                    </>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {zipProgress.stage === 'completed'
                      ? 'Export ZIP Selesai!'
                      : zipProgress.stage === 'compressing'
                      ? 'Mengompresi Berkas ZIP...'
                      : 'Memproses Export Dokumen'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                    {zipProgress.stage === 'completed'
                      ? 'Arsip siap digunakan di perangkat Anda'
                      : zipProgress.stage === 'compressing'
                      ? 'Membungkus file PDF ke dalam folder-folder...'
                      : `Menyusun dokumen ${zipProgress.current} dari ${zipProgress.total} file`}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-2xl font-black text-indigo-600 tracking-tight">
                    {zipProgress.percent}%
                  </span>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="space-y-2 mb-4">
                <div className="w-full bg-slate-100 rounded-full h-3.5 p-0.5 overflow-hidden border border-slate-200/80 shadow-inner">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-sm"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(zipProgress.percent, 3)}%` }}
                    transition={{ ease: "easeOut", duration: 0.15 }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-0.5">
                  <span className="text-slate-700">
                    {zipProgress.current} / {zipProgress.total} Dokumen Selesai
                  </span>
                  <span className="text-indigo-600 font-semibold">
                    {zipProgress.stage === 'compressing' ? 'Tahap Kompresi' : 'Tahap Render PDF'}
                  </span>
                </div>
              </div>

              {/* Current Active File Info */}
              <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/70 text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <FileSpreadsheet className="w-3 h-3 text-slate-400" />
                  <span>Berkas yang sedang diproses:</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 truncate" title={zipProgress.currentFileName}>
                  {zipProgress.currentFolder ? `📁 ${zipProgress.currentFolder} ➔ ` : ''}
                  {zipProgress.currentFileName || 'Menyiapkan berkas...'}
                </p>
              </div>

              {/* Safety note */}
              <p className="text-[11px] text-center text-slate-400 mt-4 font-medium">
                Mohon jangan menutup halaman ini sampai proses unduh selesai.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
