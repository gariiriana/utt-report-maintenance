import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, Download, Trash2, Calendar, Search, Filter, Clock, FileDown, FileType, Pencil, Box, Folder, ChevronLeft, ChevronRight, ClipboardList, FileCheck, Camera, FolderArchive, Shield, X } from 'lucide-react';
import { collection, query, getDocs, deleteDoc, doc, where, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { generateReportPDF, loadLogoBase64 } from '@/utils/ReportPdfExport';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import logoBRI from '@/assets/bri_logo.png';
import logoBRILeft from '@/assets/bri_left_logo.png';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { FileManagement } from './FileManagement';
import { generateHSEPdf } from '@/utils/HSEPdfExport';
import { generateATSServiceReportPDF, generateFCUServiceReportPDF, generatePJUServiceReportPDF, generatePDUServiceReportPDF, generateCTReportPDF, generateGeneratorReportPDF, generateACSplitReportPDF, generateTrafoReportPDF, generateCapacitorbankReportPDF } from '@/service_reports';
import { getDoc } from 'firebase/firestore';

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
  const isAdmin = userRole === 'admin';
  const isPrivileged = isAdmin || userRole === 'manager' || userRole === 'site_manager' || userRole === 'hse' ||
    userRole === 'dirut' || userRole === 'direksiSDM' || userRole === 'DireksiKeuangan';
  const isEngineer = userRole === 'engineer' || userRole === 'standby_engineer' || userRole === 'tde' || userRole === 'cbre';
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

  const [dmeLevel, setDmeLevel] = useState<'root' | 'account' | 'month' | 'date' | 'documents' | 'management_files'>('root');
  const [dmeSelectedFolder, setDmeSelectedFolder] = useState<string | null>(null);
  const [dmeSelectedAccount, setDmeSelectedAccount] = useState<string | null>(null);
  const [dmeSelectedMonth, setDmeSelectedMonth] = useState<string | null>(null);
  const [dmeSelectedDate, setDmeSelectedDate] = useState<string | null>(null);
  const [managementFilesCount, setManagementFilesCount] = useState(0);
  const [managementFilesSize, setManagementFilesSize] = useState(0);

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

        if (filterOverride !== 'hse_utt') {
          if (userRole !== 'DME') {
            const excelQuery = isPrivileged
              ? query(collection(db, 'excel_documents'))
              : query(collection(db, 'excel_documents'), where('createdBy', '==', (user.email || '').toLowerCase()));
            fetchPromises.push(getDocs(excelQuery));
          } else {
            fetchPromises.push(Promise.resolve(null));
          }

          const pdfQuery = (isPrivileged || userRole === 'DME')
            ? query(collection(db, 'pdf_documents'))
            : query(collection(db, 'pdf_documents'), where('createdBy', '==', (user.email || '').toLowerCase()));
          fetchPromises.push(getDocs(pdfQuery));
        } else {
          fetchPromises.push(Promise.resolve(null));
          fetchPromises.push(Promise.resolve(null));
        }

        const showHSE = (isAdmin || userRole === 'hse' || filterOverride === 'hse_utt') && userRole !== 'DME';
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

        if (userRole === 'DME') {
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

  const handleDownload = async (docData: ExcelDocument) => {
    try {
      toast.loading('Generating Excel from database...', { id: 'download' });

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
        const leftLogo = companyType === 'bri' ? logoBRILeft : logoDwimitra;
        const logoLeftResponse = await fetch(leftLogo);
        const logoLeftBlob = await logoLeftResponse.blob();
        const logoLeftArrayBuffer = await logoLeftBlob.arrayBuffer();
        const logoLeftBase64 = btoa(
          new Uint8Array(logoLeftArrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte), ''
          )
        );
        const rightLogo = companyType === 'bri' ? logoBRI : logoNeutraDC;
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

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = docData.fileName;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('File berhasil diunduh!', { id: 'download' });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Gagal mengunduh file', { id: 'download' });
    }
  };

  const handleDownloadPDF = async (docData: ExcelDocument) => {
    try {
      toast.loading('Menghasilkan PDF dari database...', { id: 'download-pdf' });

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
        await generateATSServiceReportPDF(
          docData.atsCustomerInfo,
          docData.atsReportData,
          docData.atsTimeSpent,
          cards
        );
        toast.success('PDF Service Report ATS downloaded successfully!', { id: 'download-pdf' });
        return;
      }

      if (docData.createdBy === 'fcu@gmail.com' && docData.fcuCustomerInfo && docData.fcuReportData && docData.fcuTimeSpent) {
        await generateFCUServiceReportPDF(
          docData.fcuCustomerInfo,
          docData.fcuReportData,
          docData.fcuTimeSpent,
          cards
        );
        toast.success('PDF Service Report FCU downloaded successfully!', { id: 'download-pdf' });
        return;
      }

      if (docData.createdBy === 'pju@gmail.com' && docData.pjuCustomerInfo && docData.pjuReportData && docData.pjuTimeSpent) {
        await generatePJUServiceReportPDF(
          docData.pjuCustomerInfo,
          docData.pjuReportData,
          docData.pjuTimeSpent,
          cards
        );
        toast.success('PDF Service Report PJU downloaded successfully!', { id: 'download-pdf' });
        return;
      }

      if (docData.createdBy === 'pdu@gmail.com' && docData.pduCustomerInfo && docData.pduReportData && docData.pduTimeSpent) {
        await generatePDUServiceReportPDF(
          docData.pduCustomerInfo,
          docData.pduReportData,
          docData.pduTimeSpent,
          cards
        );
        toast.success('PDF Service Report PDU downloaded successfully!', { id: 'download-pdf' });
        return;
      }

      if (docData.createdBy === 'coolingtower@gmail.com' && docData.ctCustomerInfo && docData.ctReportData && docData.ctTimeSpent) {
        await generateCTReportPDF(
          docData.ctCustomerInfo,
          docData.ctReportData,
          docData.ctTimeSpent,
          cards
        );
        toast.success('PDF Service Report Cooling Tower downloaded successfully!', { id: 'download-pdf' });
        return;
      }

      if (docData.createdBy === 'generator@gmail.com' && docData.generatorCustomerInfo && docData.generatorReportData && docData.generatorTimeSpent) {
        await generateGeneratorReportPDF(
          docData.generatorCustomerInfo,
          docData.generatorReportData,
          docData.generatorTimeSpent,
          cards
        );
        toast.success('PDF Service Report Generator downloaded successfully!', { id: 'download-pdf' });
        return;
      }

      if (docData.createdBy === 'acsplit@gmail.com' && docData.acSplitCustomerInfo && docData.acSplitReportData && docData.acSplitTimeSpent) {
        await generateACSplitReportPDF(
          docData.acSplitCustomerInfo,
          docData.acSplitReportData,
          docData.acSplitTimeSpent,
          cards
        );
        toast.success('PDF Service Report Split Wall AC downloaded successfully!', { id: 'download-pdf' });
        return;
      }

      if (docData.createdBy === 'trafo@gmail.com' && docData.trafoCustomerInfo && docData.trafoReportData && docData.trafoTimeSpent) {
        await generateTrafoReportPDF(
          docData.trafoCustomerInfo,
          docData.trafoReportData,
          docData.trafoTimeSpent,
          cards
        );
        toast.success('2 File PDF Service Report Transformator downloaded successfully!', { id: 'download-pdf' });
        return;
      }

      if (docData.createdBy === 'capacitorbank@gmail.com' && docData.capacitorbankCustomerInfo && docData.capacitorbankReportData && docData.capacitorbankTimeSpent) {
        await generateCapacitorbankReportPDF(
          docData.capacitorbankCustomerInfo,
          docData.capacitorbankReportData,
          docData.capacitorbankTimeSpent,
          cards
        );
        toast.success('PDF Service Report Panel APFCR (Capacitor Bank) downloaded successfully!', { id: 'download-pdf' });
        return;
      }

      const leftLogo = companyType === 'bri' ? logoBRILeft : logoDwimitra;
      const rightLogo = companyType === 'bri' ? logoBRI : logoNeutraDC;
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
        companyType: companyType as 'neutra' | 'bri',
        userEmail: docData.createdBy,
        logos: { left: logoLeftB64, right: logoRightB64 },
      });

      if (!result) {
        toast.error('Gagal membuat PDF', { id: 'download-pdf' });
        return;
      }

      const pdfBlob = result.doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = docData.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('PDF downloaded successfully!', { id: 'download-pdf' });
    } catch (error) {
      console.error('Download PDF error:', error);
      toast.error('Failed to download PDF', { id: 'download-pdf' });
    }
  };

  const handleDownloadHSE = async (docData: ExcelDocument) => {
    try {
      toast.loading('Memuat data laporan HSE...', { id: 'download-hse' });
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

      const shouldAutoOpen = userRole === 'hse' && user?.email?.toLowerCase() !== 'hsemamik@gmail.com';
      await generateHSEPdf(formData, shouldAutoOpen, userRole || undefined);
      toast.success('PDF HSE berhasil diunduh!', { id: 'download-hse' });
    } catch (error) {
      console.error('Download HSE error:', error);
      toast.error('Gagal mengunduh PDF HSE', { id: 'download-hse' });
    }
  };

  const filteredDocuments = documents.filter(doc => {
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
      return (
        <div className="space-y-4 w-full max-w-6xl">
          <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl border border-slate-200 shadow-xl flex items-center justify-between">
            <button
              onClick={() => {
                setDmeSelectedFolder(null);
                setDmeLevel('root');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali ke Folder Utama
            </button>
            <div className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
              {dmeSelectedFolder ? `Folder: ${dmeSelectedFolder}` : 'Manajemen File & Dokumentasi'}
            </div>
          </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {uniqueAccounts.map((account) => {
                const count = filteredDocuments.filter(d => d.createdBy === account).length;
                return (
                  <motion.button
                    key={account}
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setDmeSelectedAccount(account);
                      setDmeLevel('month');
                    }}
                    className="flex items-center gap-3.5 p-3.5 bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 rounded-xl transition-all text-left group shadow-xs hover:shadow-md cursor-pointer"
                  >
                    <div className="p-2.5 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors shrink-0">
                      <Folder className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-amber-900 transition-colors truncate block">
                        {account}
                      </span>
                      <span className="text-xs font-medium text-slate-500 block mt-0.5">
                        {count} Laporan
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors shrink-0" />
                  </motion.button>
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
        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 shadow-xl w-full max-w-6xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
            <button
              onClick={() => {
                setDmeSelectedAccount(null);
                setDmeLevel('account');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar Akun
            </button>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Folder:</span>
              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md border border-amber-200">{dmeSelectedAccount}</span>
            </div>
          </div>

          {sortedMonths.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">Tidak ada folder bulan</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedMonths.map((month) => {
                const count = accountDocs.filter(d => getMonthYearString(d.createdAt) === month).length;
                return (
                  <motion.button
                    key={month}
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setDmeSelectedMonth(month);
                      setDmeLevel('date');
                    }}
                    className="flex items-center gap-3.5 p-3.5 bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 rounded-xl transition-all text-left group shadow-xs hover:shadow-md cursor-pointer"
                  >
                    <div className="p-2.5 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors shrink-0">
                      <Folder className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-amber-900 transition-colors truncate block">
                        {month}
                      </span>
                      <span className="text-xs font-medium text-slate-500 block mt-0.5">
                        {count} Laporan
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors shrink-0" />
                  </motion.button>
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
        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 shadow-xl w-full max-w-6xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
            <button
              onClick={() => {
                setDmeSelectedMonth(null);
                setDmeLevel('month');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar Bulan
            </button>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider flex-wrap">
              <span>Folder:</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">{dmeSelectedAccount}</span>
              <span>/</span>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200">{dmeSelectedMonth}</span>
            </div>
          </div>

          {sortedDates.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">Tidak ada folder tanggal</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedDates.map((dateStr) => {
                const count = monthDocs.filter(d => getFullDateString(d.createdAt) === dateStr).length;
                return (
                  <motion.button
                    key={dateStr}
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setDmeSelectedDate(dateStr);
                      setDmeLevel('documents');
                    }}
                    className="flex items-center gap-3.5 p-3.5 bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 rounded-xl transition-all text-left group shadow-xs hover:shadow-md cursor-pointer"
                  >
                    <div className="p-2.5 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors shrink-0">
                      <Folder className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-amber-900 transition-colors truncate block">
                        {dateStr}
                      </span>
                      <span className="text-xs font-medium text-slate-500 block mt-0.5">
                        {count} Laporan
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors shrink-0" />
                  </motion.button>
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
      <div className="space-y-4 w-full max-w-6xl bg-white/90 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
          <button
            onClick={() => {
              setDmeSelectedDate(null);
              setDmeLevel('date');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-colors text-xs font-bold cursor-pointer border border-slate-200"
          >
            <ChevronLeft className="w-4 h-4" /> Kembali ke Daftar Tanggal
          </button>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider flex-wrap">
            <span>Folder:</span>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">{dmeSelectedAccount}</span>
            <span>/</span>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">{dmeSelectedMonth}</span>
            <span>/</span>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200">{dmeSelectedDate}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {dateDocs.map((document, index) => renderDocumentCard(document, index))}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (userRole === 'DME') {
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
      className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-sky-100/90 hover:border-blue-300 shadow-md text-slate-800 transition group"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex-shrink-0">
          {document.documentType === 'pdf' ? (
            <FileType className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
          ) : (
            <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {document.maintenanceName}
            </h3>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${document.documentType === 'pdf'
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
              {document.documentType.toUpperCase()}
            </span>
            {(document.createdBy === 'ats@gmail.com' || document.createdBy === 'fcu@gmail.com' || document.atsCustomerInfo || document.fcuCustomerInfo) && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${(document.atsCustomerInfo || document.fcuCustomerInfo)
                  ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}>
                {(document.atsCustomerInfo || document.fcuCustomerInfo) ? 'FOTO + SR' : 'FOTO SAJA'}
              </span>
            )}
            {document.hseType && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                {document.hseType}
              </span>
            )}
            {document.deleteRequested && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse uppercase">
                Menunggu Persetujuan Hapus
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-1 text-xs sm:text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
              <div className="flex items-center gap-1.5">
                <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{(document.fileSize / 1024).toFixed(0)} KB</span>
              </div>
            )}
            {document.specificDetail && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-blue-400" />
                <span className="truncate text-blue-300 font-medium">{document.specificDetail}</span>
              </div>
            )}
            {document.maintenanceType && (
              <div className="flex items-center gap-1.5">
                <FileType className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-orange-300 font-bold">{document.maintenanceType}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 hidden sm:block">
            Dibuat: {document.createdAt.toLocaleString('id-ID')}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onEdit && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleEditClick(document)}
              className="flex-1 sm:flex-initial p-2.5 sm:p-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg transition border border-blue-500/20"
              title={userRole === 'DME' ? "View Report" : "Edit Report"}
            >
              {userRole === 'DME' ? (
                <Search className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
              ) : (
                <Pencil className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
              )}
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (document.documentType === 'pdf') handleDownloadPDF(document);
              else if (document.documentType === 'hse') handleDownloadHSE(document);
              else handleDownload(document);
            }}
            className="flex-1 sm:flex-initial p-2.5 sm:p-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg transition border border-blue-500/20"
            title={`Download ${document.documentType === 'pdf' ? 'PDF' : 'Excel'}`}
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
          </motion.button>
          {canDelete && (
            <motion.button
              whileHover={{ scale: document.deleteRequested && !isAdmin ? 1 : 1.05 }}
              whileTap={{ scale: document.deleteRequested && !isAdmin ? 1 : 0.95 }}
              onClick={() => {
                if (document.deleteRequested && !isAdmin) return;
                openDeleteModal(document);
              }}
              disabled={document.deleteRequested && !isAdmin}
              className={`flex-1 sm:flex-initial p-2.5 sm:p-3 rounded-lg transition border ${document.deleteRequested
                  ? isAdmin
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-slate-800 text-slate-500 border-slate-700/50 cursor-not-allowed opacity-50'
                  : 'bg-red-600/10 hover:bg-red-600/20 text-red-400 border-red-500/20'
                }`}
              title={document.deleteRequested ? isAdmin ? "Tinjau Pengajuan Hapus" : "Menunggu Persetujuan Hapus" : "Delete"}
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
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
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 relative z-10">
      { }
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-4 sm:p-6 mb-4 sm:mb-6 border border-sky-100/90 shadow-xl shadow-sky-900/5 text-slate-800">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-2xl font-black text-slate-900">Arsip Dokumen & Laporan</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Semua dokumen Excel, PDF & Service Report maintenance yang telah diekspor</p>
        </div>


        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${isAdmin ? 'xl:grid-cols-5' : userRole !== 'DME' ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-3 sm:gap-4 items-center`}>

          <div className="relative min-w-0">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={userRole === 'DME' ? "Cari dokumen / file..." : "Cari nama maintenance..."}
              className="w-full pl-10 sm:pl-12 pr-10 py-2.5 sm:py-3 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-900 placeholder-slate-400 text-sm font-medium"
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


          <div className="flex gap-1.5 items-center w-full min-w-0">
            <div className="relative flex-1 min-w-0">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none z-10" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-6 pr-1 py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-900 text-xs font-medium min-w-0"
                title="Dari tanggal"
              />
            </div>
            <span className="text-slate-500 text-xs font-semibold shrink-0 px-0.5">s/d</span>
            <div className="relative flex-1 min-w-0">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none z-10" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-6 pr-1 py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-900 text-xs font-medium min-w-0"
                title="Sampai tanggal"
              />
            </div>
          </div>


          <div className="relative min-w-0">
            <Filter className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-900 appearance-none cursor-pointer text-sm font-medium"
              title="Urutkan dokumen"
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
            </select>
          </div>

          {userRole !== 'DME' && (
            <div className="relative min-w-0">
              <FileType className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 pointer-events-none" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-900 appearance-none cursor-pointer text-sm font-medium"
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
            <div className="relative min-w-0">
              <Shield className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 pointer-events-none" />
              <select
                value={adminDeleteFilter}
                onChange={(e) => setAdminDeleteFilter(e.target.value as any)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-50/90 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-900 appearance-none cursor-pointer text-sm font-medium truncate"
                title="Filter pengajuan admin"
              >
                <option value="all">Semua Dokumen ({documents.length})</option>
                <option value="pending_delete">Menunggu Hapus ({documents.filter(d => d.deleteRequested).length})</option>
              </select>
            </div>
          )}
        </div>

        {/* Status Filter Tabs (Foto Saja vs Foto + Service Report) - Hidden in HSE Role & DME Role */}
        {filterOverride !== 'hse_utt' && userRole !== 'DME' && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200 text-xs font-semibold gap-1 overflow-x-auto max-w-full">
              <button
                onClick={() => setSrStatusFilter('all')}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap text-xs cursor-pointer ${srStatusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                  }`}
              >
                <FolderArchive className={`w-3.5 h-3.5 ${srStatusFilter === 'all' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>Semua Dokumen</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${srStatusFilter === 'all' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-200/70 text-slate-600'
                  }`}>
                  {documents.length}
                </span>
              </button>

              <button
                onClick={() => setSrStatusFilter('photos_only')}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap text-xs cursor-pointer ${srStatusFilter === 'photos_only'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                  }`}
              >
                <Camera className={`w-3.5 h-3.5 ${srStatusFilter === 'photos_only' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>Dokumentasi Foto Saja (Belum SR)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${srStatusFilter === 'photos_only' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-200/70 text-slate-600'
                  }`}>
                  {documents.filter(d => !(d.atsCustomerInfo || d.fcuCustomerInfo || d.pjuCustomerInfo || d.pduCustomerInfo)).length}
                </span>
              </button>

              <button
                onClick={() => setSrStatusFilter('with_sr')}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap text-xs cursor-pointer ${srStatusFilter === 'with_sr'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                  }`}
              >
                <FileCheck className={`w-3.5 h-3.5 ${srStatusFilter === 'with_sr' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>Dokumen Lengkap (Foto + SR)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${srStatusFilter === 'with_sr' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-200/70 text-slate-600'
                  }`}>
                  {documents.filter(d => Boolean(d.atsCustomerInfo || d.fcuCustomerInfo || d.pjuCustomerInfo || d.pduCustomerInfo)).length}
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-4">
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Dokumen</p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {userRole === 'DME' ? documents.length + managementFilesCount : documents.length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hasil Filter</p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {userRole === 'DME' && !(searchQuery || startDate || endDate) ? filteredDocuments.length + managementFilesCount : filteredDocuments.length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Ukuran</p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {((documents.reduce((sum, doc) => sum + doc.fileSize, 0) + (userRole === 'DME' ? managementFilesSize : 0)) / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status Filter</p>
            <p className="text-sm font-bold text-slate-700 mt-1.5 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${(searchQuery || startDate || endDate || (filterType !== 'all' && userRole !== 'DME') || (srStatusFilter !== 'all' && userRole !== 'DME')) ? 'bg-amber-500' : 'bg-slate-300'
                }`} />
              {(searchQuery || startDate || endDate || (filterType !== 'all' && userRole !== 'DME') || (srStatusFilter !== 'all' && userRole !== 'DME')) ? 'Filter Aktif' : 'Tidak Ada'}
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
        <div className={`${currentLevel !== 'week' && filterOverride === 'hse_utt' ? 'block' : 'grid grid-cols-1 gap-3 sm:gap-4'}`}>
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
