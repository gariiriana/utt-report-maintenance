// ============================================================================
// FILE: DocumentList.tsx
// Deskripsi: Modul Arsip Dokumen Laporan Pemeliharaan Terpusat (Arsip Dokumen ISO / UTT).
//            Menyediakan antarmuka pencarian, penyaringan tanggal, pengurutan,
//            preview isi laporan (Viewer modal), sunting data, hapus laporan,
//            serta ekspor langsung ke format PDF & Excel (.xlsx) resmi.
//            Mendukung 14 jenis Service Report Perangkat M/E & Laporan Inspeksi HSE.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, Download, Trash2, Calendar, Search, Filter, Clock, FileDown, FileType, Pencil, Box, Folder, ChevronLeft, ChevronRight, ClipboardList, FileCheck, Camera, FolderArchive, Shield, X, AlertTriangle, FolderDown, FolderOpen } from 'lucide-react';
import { collection, query, getDocs, deleteDoc, doc, where, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { generateReportPDF, loadLogoBase64 } from '@/utils/ReportPdfExport';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import logoK2 from '@/assets/logo_k2.png';
import logoBRI from '@/assets/bri_logo.png';
import logoBRILeft from '@/assets/bri_left_logo.png';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { FileManagement } from './FileManagement';
import { FindingArchive } from './FindingArchive';
import { generateHSEPdf, generateHSEPdfBlob } from '@/utils/HSEPdfExport';
import {
  generateATSServiceReportPDF,
  generateFCUServiceReportPDF,
  generatePJUServiceReportPDF,
  generatePDUServiceReportPDF,
  generateCTReportPDF,
  generateGeneratorReportPDF,
  generateACSplitReportPDF,
  generateTrafoReportPDF,
  generateCapacitorbankReportPDF,
  generateBusductReportPDF,
  generateDocklevelerReportPDF,
  generateDoorReportPDF,
  generateLdbrdbReportPDF,
} from '@/service_reports';
import { getDoc } from 'firebase/firestore';
import { safeStorage } from '@/utils/safeStorage';

interface PhotoData {
  index: number;
  description: string;
  photoBase64: string;
  hasPhoto: boolean;
}

export interface ExcelDocument {
  id: string;
  fileName: string;
  maintenanceName: string;
  maintenanceTime: string;
  specificDetail?: string;
  createdAt: Date;
  createdBy: string;
  fileSize: number;
  totalPhotos: number;
  photosWithImage: number;
  photosData: PhotoData[];
  documentType: 'excel' | 'pdf' | 'hse';
  companyType?: 'neutra' | 'bri' | 'k2';
  hasAbnormal?: boolean;
  hseType?: 'inspection' | 'sio' | 'silo';
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
  deleteRequested?: boolean;
  deleteRequestedBy?: string;
  deleteReason?: string;
}

interface DocumentListProps {
  onEdit?: (doc: ExcelDocument) => void;
  filterOverride?: 'hse_utt';
  initialSearchQuery?: string;
}

export function DocumentList({ onEdit, filterOverride, initialSearchQuery }: DocumentListProps) {
  const { user, userRole, companyType } = useAuth();
  const isDME = userRole === 'DME' || userRole === 'site_manager_dme' || Boolean(user?.email && (user.email.toLowerCase().includes('dwimitra') || user.email.toLowerCase().includes('dme')));
  const isAdmin = userRole === 'admin';
  const isPrivileged = isAdmin || userRole === 'manager' || userRole === 'site_manager' || userRole === 'hse' ||
    userRole === 'dirut' || userRole === 'direksiSDM' || userRole === 'DireksiKeuangan';
  const isEngineer = userRole === 'engineer' || userRole === 'Engineer_K2' || userRole === 'engineer_k2' || userRole === 'standby_engineer' || userRole === 'tde' || userRole === 'cbre';
  const canDelete = isPrivileged || isEngineer;

  const [documents, setDocuments] = useState<ExcelDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');

  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [filterType, setFilterType] = useState<'all' | 'excel' | 'pdf' | 'hse'>('all');
  const [srStatusFilter, setSrStatusFilter] = useState<'all' | 'photos_only' | 'with_sr'>('all');
  const [adminDeleteFilter, setAdminDeleteFilter] = useState<'all' | 'pending_delete'>('all');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<ExcelDocument | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [currentLevel, setCurrentLevel] = useState<'root' | 'category' | 'maintenance' | 'month' | 'week'>('root');
  const [selectedCategory, setSelectedCategory] = useState<'inspection' | 'sio' | 'silo' | null>(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState<string | null>(null);
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

  const getMonthYearString = (date: Date) => {
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  const getWeekOfMonth = (date: Date) => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    return Math.ceil((dayOfMonth + firstDayOfMonth.getDay()) / 7);
  };

  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setFetchError(null);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 30000)
      );

      const fetchAll = async () => {
        const fetchPromises: Promise<any>[] = [];
        const userEmailClean = (user?.email || '').toLowerCase().trim();

        if (filterOverride !== 'hse_utt') {
          const isPrivilegedOrDME = isPrivileged || isDME;

          if (!isDME) {
            const excelQuery = isPrivilegedOrDME
              ? query(collection(db, 'excel_documents'))
              : query(collection(db, 'excel_documents'), where('createdBy', '==', userEmailClean));
            fetchPromises.push(getDocs(excelQuery));
          } else {
            fetchPromises.push(Promise.resolve(null));
          }

          const pdfQuery = isPrivilegedOrDME
            ? query(collection(db, 'pdf_documents'))
            : query(collection(db, 'pdf_documents'), where('createdBy', '==', userEmailClean));
          fetchPromises.push(getDocs(pdfQuery));
        } else {
          fetchPromises.push(Promise.resolve(null));
          fetchPromises.push(Promise.resolve(null));
        }

        const showHSE = (isAdmin || userRole === 'hse' || filterOverride === 'hse_utt') && !isDME;
        if (showHSE) {
          let hseQuery;
          if (filterOverride === 'hse_utt') {
            hseQuery = query(collection(db, 'hse'), where('reportType', '==', 'utt'));
          } else if (isAdmin) {
            hseQuery = query(collection(db, 'hse'));
          } else {
            hseQuery = query(collection(db, 'hse'), where('authorEmail', '==', (user.email || '').toLowerCase()));
          }
          fetchPromises.push(getDocs(hseQuery));
        } else {
          fetchPromises.push(Promise.resolve(null));
        }

        const [excelSnapshot, pdfSnapshot, hseSnapshot] = await Promise.all(fetchPromises);

        const excelDocs: ExcelDocument[] = [];
        const pdfDocs: ExcelDocument[] = [];
        const hseDocs: ExcelDocument[] = [];

        if (excelSnapshot) {
          excelSnapshot.forEach((doc: any) => {
            const data = doc.data();
            excelDocs.push({
              id: doc.id,
              fileName: data.fileName,
              maintenanceName: data.maintenanceName,
              maintenanceTime: data.maintenanceTime,
              specificDetail: data.specificDetail,
              createdAt: data.createdAt.toDate(),
              createdBy: data.createdBy,
              fileSize: data.fileSize || 0,
              totalPhotos: data.totalPhotos || 0,
              photosWithImage: data.photosWithImage || 0,
              photosData: [], // Optimized: photosData is lazily loaded on edit
              documentType: 'excel',
              atsCustomerInfo: data.atsCustomerInfo,
              atsReportData: data.atsReportData,
              atsTimeSpent: data.atsTimeSpent,
              fcuCustomerInfo: data.fcuCustomerInfo,
              fcuReportData: data.fcuReportData,
              fcuTimeSpent: data.fcuTimeSpent,
              deleteRequested: data.deleteRequested || false,
              deleteRequestedBy: data.deleteRequestedBy || '',
              deleteReason: data.deleteReason || '',
            });
          });
        }

        if (pdfSnapshot) {
          pdfSnapshot.forEach((doc: any) => {
            const data = doc.data();
            pdfDocs.push({
              id: doc.id,
              fileName: data.fileName,
              maintenanceName: data.maintenanceName,
              maintenanceTime: data.maintenanceTime,
              specificDetail: data.specificDetail,
              createdAt: data.createdAt.toDate(),
              createdBy: data.createdBy,
              fileSize: data.fileSize || 0,
              totalPhotos: data.totalPhotos || 0,
              photosWithImage: data.photosWithImage || 0,
              photosData: [], // Optimized: photosData is lazily loaded on edit
              documentType: 'pdf',
              hasAbnormal: data.hasAbnormal || false,
              atsCustomerInfo: data.atsCustomerInfo,
              atsReportData: data.atsReportData,
              atsTimeSpent: data.atsTimeSpent,
              fcuCustomerInfo: data.fcuCustomerInfo,
              fcuReportData: data.fcuReportData,
              fcuTimeSpent: data.fcuTimeSpent,
              deleteRequested: data.deleteRequested || false,
              deleteRequestedBy: data.deleteRequestedBy || '',
              deleteReason: data.deleteReason || '',
            });
          });
        }

        if (hseSnapshot) {
          hseSnapshot.forEach((doc: any) => {
            const data = doc.data();
            hseDocs.push({
              id: doc.id,
              fileName: `HSE_${data.aktivitas}_${data.date}.pdf`,
              maintenanceName: data.aktivitas,
              maintenanceTime: data.date,
              specificDetail: data.lokasi,
              createdAt: data.createdAt?.toDate() || new Date(),
              createdBy: data.authorEmail,
              fileSize: 0,
              totalPhotos: data.photos?.length || 0,
              photosWithImage: data.photos?.length || 0,
              photosData: [],
              documentType: 'hse',
              hseType: data.hseType || 'inspection',
              maintenanceType: data.maintenanceType || 'OTHER',
              deleteRequested: data.deleteRequested || false,
              deleteRequestedBy: data.deleteRequestedBy || '',
              deleteReason: data.deleteReason || '',
            });
          });
        }

        const allDocs = filterOverride === 'hse_utt'
          ? hseDocs
          : [...excelDocs, ...pdfDocs, ...hseDocs];

        allDocs.sort((a, b) => {
          const timeA = a.createdAt.getTime();
          const timeB = b.createdAt.getTime();
          return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
        });

        setDocuments(allDocs);

        if (isDME) {
          try {
            const [filesSnap, correctiveSnap] = await Promise.all([
              getDocs(query(collection(db, 'files'))),
              getDocs(query(collection(db, 'corrective_reports')))
            ]);
            let fSize = 0;
            filesSnap.forEach(d => { fSize += (d.data().fileSize || 0); });
            fSize += correctiveSnap.size * 1024;
            setManagementFilesCount(filesSnap.size + correctiveSnap.size);
            setManagementFilesSize(fSize);
          } catch (err) {
            console.error('Error fetching management files count:', err);
          }
        }
      };

      await Promise.race([fetchAll(), timeoutPromise]);
    } catch (error: any) {
      console.error('Error fetching documents:', error);

      if (error?.message === 'TIMEOUT') {
        setFetchError('Koneksi ke server terlalu lama. Pastikan internet stabil dan tidak ada VPN/firewall yang memblokir.');
        toast.error('Timeout: gagal memuat dokumen', { duration: 5000 });
      } else if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
        setFetchError('Database index diperlukan. Klik link di console browser untuk buat index.');
        toast.error('Database index diperlukan. Klik link di console browser untuk buat index.', {
          duration: 8000,
        });
      } else {
        setFetchError('Gagal memuat dokumen. Periksa koneksi internet Anda.');
        toast.error('Gagal memuat dokumen');
      }
    } finally {
      setLoading(false);
    }
  }, [user, sortBy, userRole, filterOverride]);

  useEffect(() => {
    fetchDocuments();
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

      if (isAdmin) {
        // Admins approve delete and delete the document permanently
        const toastId = toast.loading('Menghapus dokumen secara permanen...');
        await deleteDoc(doc(db, collectionName, documentToDelete.id));
        toast.success('Dokumen berhasil dihapus permanen', { id: toastId });
      } else {
        // Non-admins request delete
        const toastId = toast.loading('Mengajukan permohonan hapus...');
        const docRef = doc(db, collectionName, documentToDelete.id);
        await updateDoc(docRef, {
          deleteRequested: true,
          deleteRequestedBy: user?.email || '',
          deleteReason: reason || '',
        });
        toast.success('Pengajuan hapus dikirim ke admin', { id: toastId });
      }

      setDeleteModalOpen(false);
      setDocumentToDelete(null);
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Gagal memproses penghapusan');
    } finally {
      setBulkDeleting(false);
    }
  };

  const rejectDeleteRequest = async () => {
    if (!documentToDelete) return;

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
      fetchDocuments();
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

  const buildPDFBlob = async (docData: ExcelDocument, saveToFile: boolean = false): Promise<{ blob: Blob; fileName: string }[]> => {
    let finalPhotosData = docData.photosData || [];

    if (finalPhotosData.length === 0) {
      try {
        const photosSnap = await getDocs(
          collection(db, `pdf_documents/${docData.id}/photos`)
        );
        if (!photosSnap.empty) {
          finalPhotosData = photosSnap.docs
            .map(d => d.data() as PhotoData)
            .sort((a, b) => a.index - b.index);
        }
      } catch (err) {
        console.error('Failed to fetch subcollection photos (PDF):', err);
      }
    }

    const cards = finalPhotosData.map((p, i) => ({
      id: `archive_${i}`,
      photo: null as File | null,
      photoBase64: p.photoBase64 || '',
      description: p.description || '',
    }));

    if (docData.createdBy === 'ats@gmail.com' && docData.atsCustomerInfo && docData.atsReportData && docData.atsTimeSpent) {
      const res = await generateATSServiceReportPDF(
        docData.atsCustomerInfo,
        docData.atsReportData,
        docData.atsTimeSpent,
        cards,
        saveToFile
      );
      return [{ fileName: res.filename, blob: res.blob }];
    }

    if (docData.createdBy === 'fcu@gmail.com' && docData.fcuCustomerInfo && docData.fcuReportData && docData.fcuTimeSpent) {
      const res = await generateFCUServiceReportPDF(
        docData.fcuCustomerInfo,
        docData.fcuReportData,
        docData.fcuTimeSpent,
        cards,
        saveToFile
      );
      return [{ fileName: res.fileName, blob: res.blob }];
    }

    if (docData.createdBy === 'pju@gmail.com' && docData.pjuCustomerInfo && docData.pjuReportData && docData.pjuTimeSpent) {
      const res = await generatePJUServiceReportPDF(
        docData.pjuCustomerInfo,
        docData.pjuReportData,
        docData.pjuTimeSpent,
        cards,
        saveToFile
      );
      return [{ fileName: res.filename, blob: res.blob }];
    }

    if (docData.createdBy === 'pdu@gmail.com' && docData.pduCustomerInfo && docData.pduReportData && docData.pduTimeSpent) {
      const res = await generatePDUServiceReportPDF(
        docData.pduCustomerInfo,
        docData.pduReportData,
        docData.pduTimeSpent,
        cards,
        saveToFile
      );
      return [{ fileName: res.fileName, blob: res.blob }];
    }

    if (docData.createdBy === 'coolingtower@gmail.com' && docData.ctCustomerInfo && docData.ctReportData && docData.ctTimeSpent) {
      const res = await generateCTReportPDF(
        docData.ctCustomerInfo,
        docData.ctReportData,
        docData.ctTimeSpent,
        cards
      );
      const blob = res.doc.output('blob');
      if (saveToFile) {
        res.doc.save(res.fileName);
      }
      return [{ fileName: res.fileName, blob }];
    }

    if (docData.createdBy === 'generator@gmail.com' && docData.generatorCustomerInfo && docData.generatorReportData && docData.generatorTimeSpent) {
      const res = await generateGeneratorReportPDF(
        docData.generatorCustomerInfo,
        docData.generatorReportData,
        docData.generatorTimeSpent,
        cards,
        saveToFile
      );
      return [{ fileName: res.filename, blob: res.blob }];
    }

    if (docData.createdBy === 'acsplit@gmail.com' && docData.acSplitCustomerInfo && docData.acSplitReportData && docData.acSplitTimeSpent) {
      const res = await generateACSplitReportPDF(
        docData.acSplitCustomerInfo,
        docData.acSplitReportData,
        docData.acSplitTimeSpent,
        cards,
        saveToFile
      );
      return [{ fileName: res.filename, blob: res.blob }];
    }

    if (docData.createdBy === 'trafo@gmail.com' && docData.trafoCustomerInfo && docData.trafoReportData && docData.trafoTimeSpent) {
      const resList = await generateTrafoReportPDF(
        docData.trafoCustomerInfo,
        docData.trafoReportData,
        docData.trafoTimeSpent,
        cards,
        saveToFile
      );
      return resList.map(r => ({ fileName: r.filename, blob: r.blob }));
    }

    if (docData.createdBy === 'capacitorbank@gmail.com' && docData.capacitorbankCustomerInfo && docData.capacitorbankReportData && docData.capacitorbankTimeSpent) {
      const res = await generateCapacitorbankReportPDF(
        docData.capacitorbankCustomerInfo,
        docData.capacitorbankReportData,
        docData.capacitorbankTimeSpent,
        cards,
        saveToFile
      );
      return [{ fileName: res.filename, blob: res.blob }];
    }

    if (docData.createdBy === 'busduct@gmail.com' && (docData as any).busductCustomerInfo) {
      const res = await generateBusductReportPDF(
        (docData as any).busductCustomerInfo,
        (docData as any).busductReportData,
        (docData as any).busductTimeSpent,
        cards,
        saveToFile
      );
      return [{ fileName: res.filename, blob: res.blob }];
    }

    if (docData.createdBy === 'door@gmail.com' && (docData as any).doorCustomerInfo) {
      const res = await generateDoorReportPDF(
        (docData as any).doorCustomerInfo,
        (docData as any).doorReportData,
        (docData as any).doorTimeSpent,
        cards,
        saveToFile
      );
      return [{ fileName: res.filename, blob: res.blob }];
    }

    if (docData.createdBy === 'dockleveler@gmail.com' && (docData as any).docklevelerCustomerInfo) {
      const res = await generateDocklevelerReportPDF(
        (docData as any).docklevelerCustomerInfo,
        (docData as any).docklevelerReportData,
        (docData as any).docklevelerTimeSpent,
        cards,
        saveToFile
      );
      return [{ fileName: res.filename, blob: res.blob }];
    }

    if (docData.createdBy === 'ldb/rdb@gmail.com' && (docData as any).ldbrdbCustomerInfo) {
      const res = await generateLdbrdbReportPDF(
        (docData as any).ldbrdbCustomerInfo,
        (docData as any).ldbrdbReportData,
        (docData as any).ldbrdbTimeSpent,
        cards,
        saveToFile
      );
      return [{ fileName: res.filename, blob: res.blob }];
    }

    const effectiveCompanyType = docData.companyType || companyType || 'neutra';
    const leftLogo = effectiveCompanyType === 'bri' ? logoBRILeft : logoDwimitra;
    const rightLogo = effectiveCompanyType === 'bri' ? logoBRI : effectiveCompanyType === 'k2' ? logoK2 : logoNeutraDC;
    const [logoLeftB64, logoRightB64] = await Promise.all([
      loadLogoBase64(leftLogo),
      loadLogoBase64(rightLogo),
    ]);

    const result = await generateReportPDF({
      maintenanceName: docData.maintenanceName,
      maintenanceTime: docData.maintenanceTime,
      specificDetail: docData.specificDetail || '',
      vrvUnitDetail: '',
      cards,
      companyType: effectiveCompanyType as 'neutra' | 'bri' | 'k2',
      userEmail: docData.createdBy,
      logos: { left: logoLeftB64, right: logoRightB64 },
    });

    if (!result) {
      throw new Error('Gagal membuat PDF');
    }

    const pdfBlob = result.doc.output('blob');
    const fileName = docData.fileName.endsWith('.pdf') ? docData.fileName : `${docData.fileName}.pdf`;
    if (saveToFile) {
      result.doc.save(fileName);
    }
    return [{ fileName, blob: pdfBlob }];
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
          base64: data.dataUrl,
          description: data.description || '',
          label: data.label || ''
        };
      });
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
      maintenanceType: hseData.maintenanceType || 'OTHER'
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
      const files = await buildPDFBlob(docData, true);
      if (files.length === 1 && !docData.createdBy?.startsWith('trafo')) {
        toast.success('PDF berhasil diunduh!', { id: 'download-pdf' });
      }
    } catch (error) {
      console.error('Download PDF error:', error);
      toast.error('Gagal mengunduh PDF', { id: 'download-pdf' });
    }
  };

  const handleDownloadHSE = async (docData: ExcelDocument) => {
    try {
      toast.loading('Memuat data laporan HSE...', { id: 'download-hse' });
      await buildHSEBlob(docData, true);
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

  const filteredDocuments = documents.filter(doc => {
    // Non-privileged accounts can ONLY see documents created by their own email
    const isPrivilegedOrDME = isPrivileged || isDME;
    if (!isPrivilegedOrDME) {
      const userEmailClean = (user?.email || '').toLowerCase().trim();
      if ((doc.createdBy || '').toLowerCase().trim() !== userEmailClean) {
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

      const targetStr = `${doc.maintenanceName} ${doc.specificDetail || ''} ${doc.fileName} ${doc.createdBy || ''}`.toLowerCase();

      const directMatch = targetStr.includes(lowerQuery);
      const cleanMatch = cleanQuery ? targetStr.includes(cleanQuery) : false;
      const tokenMatch = cleanQuery ? cleanQuery.split(/\s+/).some(t => t.length >= 2 && targetStr.includes(t)) : false;

      if (!directMatch && !cleanMatch && !tokenMatch) {
        return false;
      }
    }

    if (startDate || endDate) {
      const timeStr = doc.maintenanceTime || '';
      const firstDateStr = timeStr.includes(' - ') ? timeStr.split(' - ')[0] : timeStr;
      const d = new Date(firstDateStr);
      const docDate = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
      if (docDate) {
        if (startDate && docDate < startDate) {
          return false;
        }
        if (endDate && docDate > endDate) {
          return false;
        }
      }
    }

    if (filterType !== 'all' && doc.documentType !== filterType) {
      return false;
    }

    const hasSR = Boolean(doc.atsCustomerInfo || doc.fcuCustomerInfo);
    if (srStatusFilter === 'photos_only' && hasSR) {
      return false;
    }
    if (srStatusFilter === 'with_sr' && !hasSR) {
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

  const renderDmeContent = () => {
    if (searchQuery.trim() !== '') {
      return (
        <div className="space-y-4 w-full max-w-6xl">
          <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl border border-slate-200 shadow-xl flex items-center justify-between flex-wrap gap-3">
            <button
              onClick={() => {
                setSearchQuery('');
                setDmeSelectedFolder(null);
                setDmeLevel('root');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 rounded-xl transition-all text-xs font-bold cursor-pointer border border-slate-200 shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali ke Folder Utama
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

    const managementFolders = [
      { name: 'D-DAY', desc: 'Dokumen D-DAY & Prosedur Operational' },
      { name: 'Laporan Harian', desc: 'Laporan Harian Maintenance Data Center' },
      { name: 'MOP', desc: 'Method of Procedure (MOP) Standar' },
      { name: 'Monthly', desc: 'Laporan Rekap Bulanan Project' },
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

    if (dmeLevel === 'root') {
      return (
        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 shadow-xl w-full max-w-6xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                <Folder className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Arsip Dokumen</h3>
                <p className="text-xs text-slate-500 font-medium">Pilih folder utama untuk melihat arsip laporan & dokumentasi maintenance</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* PM Folder Card */}
            <motion.button
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setDmeLevel('account')}
              className="flex items-center gap-3.5 p-3.5 bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 rounded-xl transition-all text-left group shadow-xs hover:shadow-md cursor-pointer"
            >
              <div className="p-2.5 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors shrink-0">
                <Folder className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold text-slate-900 group-hover:text-amber-900 transition-colors truncate block">
                  Folder PM (Preventive Maintenance)
                </span>
                <span className="text-xs font-medium text-slate-500 block mt-0.5">
                  {uniqueAccounts.length} Akun Maintenance
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors shrink-0" />
            </motion.button>

            {/* Management File Folders */}
            {managementFolders.map((folder) => (
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
          </div>
        </div>
      );
    }

    if (dmeLevel === 'management_files') {
      if (dmeSelectedFolder === 'Laporan Temuan') {
        return (
          <div className="space-y-4 w-full max-w-6xl">
            <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl border border-slate-200 shadow-xl flex items-center justify-between">
              <button
                onClick={() => { setDmeSelectedFolder(null); setDmeLevel('root'); }}
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
          <FileManagement allowUpload={false} initialFolder={dmeSelectedFolder} onBackToRoot={() => { setDmeSelectedFolder(null); setDmeLevel('root'); }} />
        </div>
      );
    }

    if (dmeLevel === 'account') {
      return (
        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 shadow-xl w-full max-w-6xl">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 flex-wrap gap-3">
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

          {uniqueAccounts.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">Tidak ada dokumen ditemukan</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {uniqueAccounts.map((account) => {
                const count = filteredDocuments.filter(d => d.createdBy === account).length;
                const accountItemDocs = filteredDocuments.filter(d => d.createdBy === account);
                return (
                  <motion.div
                    key={account}
                    whileHover={{ y: -2 }}
                    className="flex flex-col justify-between bg-white border border-slate-200/90 hover:border-amber-400/90 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all group"
                  >
                    {/* Top Info Area - Clickable to open folder */}
                    <div
                      onClick={() => {
                        setDmeSelectedAccount(account);
                        setDmeLevel('month');
                      }}
                      className="flex items-start gap-3.5 cursor-pointer pb-3"
                    >
                      <div className="p-2.5 bg-gradient-to-br from-amber-50 to-amber-100/80 rounded-xl text-amber-600 border border-amber-200/60 shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-900 transition-colors truncate">
                          {account}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                            {count} Laporan
                          </span>
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
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
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
      const uniqueMonths = Array.from(new Set(accountDocs.map(d => getMonthYearString(d.createdAt))));
      const sortedMonths = uniqueMonths.sort((a, b) => {
        const docA = accountDocs.find(d => getMonthYearString(d.createdAt) === a);
        const docB = accountDocs.find(d => getMonthYearString(d.createdAt) === b);
        return (docB?.createdAt.getTime() || 0) - (docA?.createdAt.getTime() || 0);
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

          {sortedMonths.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">Tidak ada folder bulan</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {sortedMonths.map((month) => {
                const monthItemDocs = accountDocs.filter(d => getMonthYearString(d.createdAt) === month);
                const count = monthItemDocs.length;
                return (
                  <motion.div
                    key={month}
                    whileHover={{ y: -2 }}
                    className="flex flex-col justify-between bg-white border border-slate-200/90 hover:border-amber-400/90 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all group"
                  >
                    {/* Top Info Area - Clickable to open folder */}
                    <div
                      onClick={() => {
                        setDmeSelectedMonth(month);
                        setDmeLevel('date');
                      }}
                      className="flex items-start gap-3.5 cursor-pointer pb-3"
                    >
                      <div className="p-2.5 bg-gradient-to-br from-amber-50 to-amber-100/80 rounded-xl text-amber-600 border border-amber-200/60 shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-900 transition-colors truncate">
                          {month}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                            {count} Laporan
                          </span>
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
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
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
      const monthDocs = accountDocs.filter(d => getMonthYearString(d.createdAt) === dmeSelectedMonth);
      const getFullDateString = (date: Date) => {
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      };
      const uniqueDates = Array.from(new Set(monthDocs.map(d => getFullDateString(d.createdAt))));
      const sortedDates = uniqueDates.sort((a, b) => {
        const docA = monthDocs.find(d => getFullDateString(d.createdAt) === a);
        const docB = monthDocs.find(d => getFullDateString(d.createdAt) === b);
        return (docB?.createdAt.getTime() || 0) - (docA?.createdAt.getTime() || 0);
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

          {sortedDates.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">Tidak ada folder tanggal</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {sortedDates.map((dateStr) => {
                const dateItemDocs = monthDocs.filter(d => getFullDateString(d.createdAt) === dateStr);
                const count = dateItemDocs.length;
                return (
                  <motion.div
                    key={dateStr}
                    whileHover={{ y: -2 }}
                    className="flex flex-col justify-between bg-white border border-slate-200/90 hover:border-amber-400/90 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all group"
                  >
                    {/* Top Info Area - Clickable to open folder */}
                    <div
                      onClick={() => {
                        setDmeSelectedDate(dateStr);
                        setDmeLevel('documents');
                      }}
                      className="flex items-start gap-3.5 cursor-pointer pb-3"
                    >
                      <div className="p-2.5 bg-gradient-to-br from-amber-50 to-amber-100/80 rounded-xl text-amber-600 border border-amber-200/60 shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-900 transition-colors truncate">
                          {dateStr}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                            {count} Laporan
                          </span>
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
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
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
    const monthDocs = accountDocs.filter(d => getMonthYearString(d.createdAt) === dmeSelectedMonth);
    const getFullDateString = (date: Date) => {
      return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    };
    const dateDocs = monthDocs.filter(d => getFullDateString(d.createdAt) === dmeSelectedDate);

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
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {dateDocs.map((document, index) => renderDocumentCard(document, index))}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (isDME) {
      return renderDmeContent();
    }

    if (filterOverride !== 'hse_utt') {
      return filteredDocuments.map((document, index) => renderDocumentCard(document, index));
    }

    if (currentLevel === 'root') {
      const categories = [
        { id: 'inspection', name: 'HSE Inspection Report', icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
      ];

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const count = filteredDocuments.filter(d => d.hseType === cat.id).length;
            return (
              <motion.button
                key={cat.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedCategory(cat.id as any);
                  setCurrentLevel('category');
                }}
                className="flex items-center gap-4 p-6 bg-white border border-slate-200 rounded-2xl hover:border-blue-400 hover:shadow-md transition-all group text-left shadow-sm cursor-pointer"
              >
                <div className={`p-3 ${cat.bg} rounded-xl border group-hover:scale-110 transition-transform`}>
                  <cat.icon className={`w-8 h-8 ${cat.color}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{cat.name}</h3>
                  <p className="text-sm font-medium text-slate-500">{count} Dokumen</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      );
    }

    if (currentLevel === 'category') {
      const backBtn = (
        <button
          onClick={() => setCurrentLevel('root')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors text-sm font-semibold mb-4 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Kembali ke Root HSE
        </button>
      );

      if (selectedCategory === 'inspection') {
        const monthGroups = new Set<string>();
        filteredDocuments
          .filter(d => d.hseType === 'inspection')
          .forEach(doc => monthGroups.add(getMonthYearString(doc.createdAt)));

        const sortedMonths = Array.from(monthGroups).sort((a, b) => {
          const [, yearA] = a.split(' ');
          const [, yearB] = b.split(' ');
          if (yearA !== yearB) return parseInt(yearB) - parseInt(yearA);
          return 0;
        });

        return (
          <div className="space-y-4">
            {backBtn}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedMonths.map((month) => (
                <motion.button
                  key={month}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedMonth(month);
                    setCurrentLevel('month');
                  }}
                  className="flex items-center gap-4 p-6 bg-white border border-slate-200 rounded-2xl hover:border-blue-400 hover:shadow-md transition-all group text-left shadow-sm cursor-pointer"
                >
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <Folder className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{month}</h3>
                    <p className="text-sm font-medium text-slate-500">
                      {filteredDocuments.filter(d => d.hseType === 'inspection' && getMonthYearString(d.createdAt) === month).length} Laporan
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        );
      } else {
        const maintenanceTypes = new Set<string>();
        filteredDocuments
          .filter(d => d.hseType === selectedCategory)
          .forEach(doc => maintenanceTypes.add(doc.maintenanceType || 'OTHER'));

        return (
          <div className="space-y-4">
            {backBtn}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from(maintenanceTypes).map((type) => (
                <motion.button
                  key={type}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedMaintenance(type);
                    setCurrentLevel('maintenance');
                  }}
                  className="flex items-center gap-4 p-6 bg-white border border-slate-200 rounded-2xl hover:border-indigo-400 hover:shadow-md transition-all group text-left shadow-sm cursor-pointer"
                >
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <Folder className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 uppercase">{type}</h3>
                    <p className="text-sm font-medium text-slate-500">
                      {filteredDocuments.filter(d => d.hseType === selectedCategory && d.maintenanceType === type).length} Dokumen
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        );
      }
    }

    if (currentLevel === 'month') {
      const monthDocs = filteredDocuments.filter(d => d.hseType === 'inspection' && getMonthYearString(d.createdAt) === selectedMonth);
      const weeks = new Set<number>();
      monthDocs.forEach(doc => weeks.add(getWeekOfMonth(doc.createdAt)));

      return (
        <div className="space-y-4">
          <button
            onClick={() => setCurrentLevel('category')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors text-sm font-semibold mb-2 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar Bulan
          </button>
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
                    {monthDocs.filter(d => getWeekOfMonth(d.createdAt) === week).length} Laporan
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      );
    }

    const displayDocs = currentLevel === 'week'
      ? filteredDocuments.filter(d => d.hseType === 'inspection' && getMonthYearString(d.createdAt) === selectedMonth && getWeekOfMonth(d.createdAt) === selectedWeek)
      : filteredDocuments.filter(d => d.hseType === selectedCategory && d.maintenanceType === selectedMaintenance);

    return (
      <div className="space-y-4">
        <button
          onClick={() => setCurrentLevel(selectedCategory === 'inspection' ? 'month' : 'category')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors text-sm font-semibold mb-2 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Kembali
        </button>
        <div className="grid grid-cols-1 gap-4">
          {displayDocs.map((document, index) => renderDocumentCard(document, index))}
        </div>
      </div>
    );
  };

  const renderDocumentCard = (document: ExcelDocument, index: number) => (
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
        <div className="p-2 sm:p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex-shrink-0">
          {document.documentType === 'pdf' ? (
            <FileType className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
          ) : (
            <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
          )}
        </div>

        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h3 className="text-sm sm:text-lg font-black text-slate-900 truncate">
              {document.maintenanceName}
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${document.documentType === 'pdf'
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
            {(document.createdBy === 'ats@gmail.com' || document.createdBy === 'fcu@gmail.com' || document.atsCustomerInfo || document.fcuCustomerInfo) && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${(document.atsCustomerInfo || document.fcuCustomerInfo)
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                {(document.atsCustomerInfo || document.fcuCustomerInfo) ? 'FOTO + SR' : 'FOTO SAJA'}
              </span>
            )}
            {document.hseType && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                {document.hseType}
              </span>
            )}
            {document.deleteRequested && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse uppercase">
                Menunggu Hapus
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1.5 text-xs text-slate-500">
            <div className="flex items-center gap-1 shrink-0">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {(() => {
                  const d = new Date(document.maintenanceTime);
                  return isNaN(d.getTime())
                    ? document.maintenanceTime
                    : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                })()}
              </span>
            </div>
            {document.documentType !== 'hse' && (
              <div className="flex items-center gap-1 shrink-0">
                <FileDown className="w-3.5 h-3.5 text-slate-400" />
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
                <FileType className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-orange-600 font-bold">{document.maintenanceType}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
          {onEdit && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleEditClick(document)}
              className="flex-1 sm:flex-initial py-2 sm:py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition border border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              title={isDME ? "View Report" : "Edit Report"}
            >
              {isDME ? (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span className="sm:hidden font-bold">Lihat</span>
                </>
              ) : (
                <>
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="sm:hidden font-bold">Edit</span>
                </>
              )}
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (document.documentType === 'pdf') handleDownloadPDF(document);
              else if (document.documentType === 'hse') handleDownloadHSE(document);
              else handleDownload(document);
            }}
            className="flex-1 sm:flex-initial py-2 sm:py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            title={`Download ${document.documentType === 'pdf' ? 'PDF' : 'Excel'}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="sm:hidden font-bold">Download</span>
          </motion.button>
          {canDelete && (
            <motion.button
              whileHover={{ scale: document.deleteRequested && !isAdmin ? 1 : 1.02 }}
              whileTap={{ scale: document.deleteRequested && !isAdmin ? 1 : 0.98 }}
              onClick={() => {
                if (document.deleteRequested && !isAdmin) return;
                openDeleteModal(document);
              }}
              disabled={document.deleteRequested && !isAdmin}
              className={`flex-1 sm:flex-initial py-2 sm:py-2.5 px-3 rounded-xl transition border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${document.deleteRequested
                  ? isAdmin
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300'
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                }`}
              title={document.deleteRequested ? isAdmin ? "Tinjau Pengajuan Hapus" : "Menunggu Persetujuan Hapus" : "Delete"}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="sm:hidden font-bold">{document.deleteRequested ? 'Tinjau' : 'Hapus'}</span>
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );

  const handleEditClick = async (doc: ExcelDocument) => {
    if (!onEdit) return;

    try {
      toast.loading('Preparing data for editing...', { id: 'edit-prep' });
      let photosData = doc.photosData || [];
      if (photosData.length === 0) {
        let colName = '';
        if (doc.documentType === 'excel') colName = 'excel_documents';
        else if (doc.documentType === 'pdf') colName = 'pdf_documents';
        else if (doc.documentType === 'hse') colName = 'hse';

        if (colName) {
          const photosSnap = await getDocs(
            collection(db, `${colName}/${doc.id}/photos`)
          );
          if (!photosSnap.empty) {
            photosData = photosSnap.docs
              .map(d => d.data() as any)
              .sort((a, b) => a.index - b.index);
          }
        }
      }

      onEdit({ ...doc, photosData });
      toast.dismiss('edit-prep');
    } catch (err) {
      console.error('Failed to prepare data for edit:', err);
      toast.error('Failed to prepare data for editing', { id: 'edit-prep' });
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 lg:py-8 relative z-10 pb-32 sm:pb-16 min-w-0 overflow-x-hidden">
      { }
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-3 sm:p-6 mb-3.5 sm:mb-6 border border-sky-100/90 shadow-xl shadow-sky-900/5 text-slate-800 w-full max-w-full overflow-hidden">
        <div className="mb-3 sm:mb-6">
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">Arsip Dokumen & Laporan</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mt-0.5">Semua dokumen Excel, PDF & Service Report maintenance yang telah diekspor</p>
        </div>


        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${isAdmin ? 'xl:grid-cols-5' : !isDME ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-2 sm:gap-4 items-center w-full min-w-0`}>

          <div className="relative min-w-0 w-full">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isDME ? "Cari dokumen / file..." : "Cari nama maintenance..."}
              className="w-full pl-9 sm:pl-12 pr-10 py-2 sm:py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDmeLevel('root');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
                title="Bersihkan pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 items-center w-full min-w-0">
            <div className="relative min-w-0 w-full">
              <div className="flex items-center gap-1.5 bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-1.5 sm:py-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-transparent outline-none text-slate-900 text-xs font-semibold min-w-0"
                  title="Dari tanggal"
                />
              </div>
            </div>
            <div className="relative min-w-0 w-full">
              <div className="flex items-center gap-1.5 bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-1.5 sm:py-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Sampai:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-transparent outline-none text-slate-900 text-xs font-semibold min-w-0"
                  title="Sampai tanggal"
                />
              </div>
            </div>
          </div>


          <div className="relative min-w-0 w-full">
            <Filter className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
              className="w-full pl-9 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-900 appearance-none cursor-pointer text-xs sm:text-sm font-medium"
              title="Urutkan dokumen"
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
            </select>
          </div>

          {!isDME && (
            <div className="relative min-w-0 w-full">
              <FileType className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full pl-9 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-900 appearance-none cursor-pointer text-xs sm:text-sm font-medium"
                title="Filter tipe dokumen"
              >
                <option value="all">Semua Tipe</option>
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
                <option value="hse">HSE</option>
              </select>
            </div>
          )}

          {isAdmin && (
            <div className="relative min-w-0 w-full">
              <Shield className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={adminDeleteFilter}
                onChange={(e) => setAdminDeleteFilter(e.target.value as any)}
                className="w-full pl-9 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-900 appearance-none cursor-pointer text-xs sm:text-sm font-medium truncate"
                title="Filter pengajuan admin"
              >
                <option value="all">Semua Dokumen ({documents.length})</option>
                <option value="pending_delete">Menunggu Hapus ({documents.filter(d => d.deleteRequested).length})</option>
              </select>
            </div>
          )}
        </div>

        {/* Status Filter Tabs (Foto Saja vs Foto + Service Report) - Hidden in HSE Role & DME Role */}
        {filterOverride !== 'hse_utt' && !isDME && (
          <div className="mt-3 pt-3 border-t border-slate-200/80 w-full overflow-hidden">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 w-full">
              <button
                onClick={() => setSrStatusFilter('all')}
                className={`px-3 py-1.5 sm:py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap text-xs shrink-0 cursor-pointer ${srStatusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-sm font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-semibold'
                  }`}
              >
                <FolderArchive className={`w-3.5 h-3.5 ${srStatusFilter === 'all' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>Semua Dokumen</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${srStatusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                  {documents.length}
                </span>
              </button>

              <button
                onClick={() => setSrStatusFilter('photos_only')}
                className={`px-3 py-1.5 sm:py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap text-xs shrink-0 cursor-pointer ${srStatusFilter === 'photos_only'
                    ? 'bg-slate-900 text-white shadow-sm font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-semibold'
                  }`}
              >
                <Camera className={`w-3.5 h-3.5 ${srStatusFilter === 'photos_only' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>Foto Saja</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${srStatusFilter === 'photos_only' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                  {documents.filter(d => !(d.atsCustomerInfo || d.fcuCustomerInfo || d.pjuCustomerInfo || d.pduCustomerInfo)).length}
                </span>
              </button>

              <button
                onClick={() => setSrStatusFilter('with_sr')}
                className={`px-3 py-1.5 sm:py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap text-xs shrink-0 cursor-pointer ${srStatusFilter === 'with_sr'
                    ? 'bg-slate-900 text-white shadow-sm font-bold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-semibold'
                  }`}
              >
                <FileCheck className={`w-3.5 h-3.5 ${srStatusFilter === 'with_sr' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>Foto + SR Lengkap</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${srStatusFilter === 'with_sr' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                  {documents.filter(d => Boolean(d.atsCustomerInfo || d.fcuCustomerInfo || d.pjuCustomerInfo || d.pduCustomerInfo)).length}
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3.5 mt-3 w-full">
          <div className="bg-slate-50/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-slate-200/80 shadow-2xs min-w-0 overflow-hidden">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Total Dokumen</p>
            <p className="text-base sm:text-xl font-bold text-slate-900 mt-0.5 truncate">
              {isDME ? documents.length + managementFilesCount : documents.length}
            </p>
          </div>
          <div className="bg-slate-50/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-slate-200/80 shadow-2xs min-w-0 overflow-hidden">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Hasil Filter</p>
            <p className="text-base sm:text-xl font-bold text-slate-900 mt-0.5 truncate">
              {isDME && !(searchQuery || startDate || endDate) ? filteredDocuments.length + managementFilesCount : filteredDocuments.length}
            </p>
          </div>
          <div className="bg-slate-50/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-slate-200/80 shadow-2xs min-w-0 overflow-hidden">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Total Ukuran</p>
            <p className="text-base sm:text-xl font-bold text-slate-900 mt-0.5 truncate">
              {((documents.reduce((sum, doc) => sum + doc.fileSize, 0) + (isDME ? managementFilesSize : 0)) / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
          <div className="bg-slate-50/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-slate-200/80 shadow-2xs min-w-0 overflow-hidden">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Status Filter</p>
            <p className="text-xs sm:text-sm font-bold text-slate-700 mt-1 flex items-center gap-1.5 truncate">
              <span className={`w-2 h-2 rounded-full shrink-0 ${(searchQuery || startDate || endDate || (filterType !== 'all' && !isDME) || (srStatusFilter !== 'all' && !isDME)) ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'
                }`} />
              <span className="truncate">{(searchQuery || startDate || endDate || (filterType !== 'all' && !isDME) || (srStatusFilter !== 'all' && !isDME)) ? 'Filter Aktif' : 'Tidak Ada'}</span>
            </p>
          </div>
        </div>


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
      ) : filteredDocuments.length === 0 ? (
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

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => !bulkDeleting && setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        onRejectRequest={rejectDeleteRequest}
        documentName={documentToDelete?.fileName || ''}
        loading={bulkDeleting}
        isRequested={documentToDelete?.deleteRequested || false}
        requestedBy={documentToDelete?.deleteRequestedBy || ''}
        isAdmin={isAdmin}
        deleteReason={documentToDelete?.deleteReason || ''}
      />
    </div>
  );
}
