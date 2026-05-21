import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, Download, Trash2, Calendar, Search, Filter, Clock, User, FileDown, FileType, Pencil, Box, Folder, ChevronLeft, ClipboardList } from 'lucide-react';
import { collection, query, getDocs, deleteDoc, doc, where } from 'firebase/firestore';
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
import { generateHSEPdf } from '@/utils/HSEPdfExport';
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
}

interface DocumentListProps {
  onEdit?: (doc: ExcelDocument) => void;
  filterOverride?: 'hse_utt';
}

export function DocumentList({ onEdit, filterOverride }: DocumentListProps) {
  const { user, userRole, companyType } = useAuth();
  const isAdmin = userRole === 'admin';
  const isPrivileged = isAdmin || userRole === 'manager' || userRole === 'site_manager' || userRole === 'hse' || 
    userRole === 'dirut' || userRole === 'direksiSDM' || userRole === 'DireksiKeuangan';
  const isEngineer = userRole === 'engineer' || userRole === 'standby_engineer' || userRole === 'tde' || userRole === 'cbre';
  const canDelete = isPrivileged || isEngineer;

  const [documents, setDocuments] = useState<ExcelDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [filterType, setFilterType] = useState<'all' | 'excel' | 'pdf' | 'hse'>('all');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<ExcelDocument | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  const [currentLevel, setCurrentLevel] = useState<'root' | 'category' | 'maintenance' | 'month' | 'week'>('root');
  const [selectedCategory, setSelectedCategory] = useState<'inspection' | 'sio' | 'silo' | null>(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

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
          const excelQuery = isPrivileged
            ? query(collection(db, 'excel_documents'))
            : query(collection(db, 'excel_documents'), where('createdBy', '==', user.email));
          fetchPromises.push(getDocs(excelQuery));

          const pdfQuery = isPrivileged
            ? query(collection(db, 'pdf_documents'))
            : query(collection(db, 'pdf_documents'), where('createdBy', '==', user.email));
          fetchPromises.push(getDocs(pdfQuery));
        } else {
          fetchPromises.push(Promise.resolve(null));
          fetchPromises.push(Promise.resolve(null));
        }

        const showHSE = isAdmin || userRole === 'hse' || filterOverride === 'hse_utt';
        if (showHSE) {
          let hseQuery;
          if (filterOverride === 'hse_utt') {
            hseQuery = query(collection(db, 'hse'), where('reportType', '==', 'utt'));
          } else if (isAdmin) {
            hseQuery = query(collection(db, 'hse'));
          } else {
            hseQuery = query(collection(db, 'hse'), where('authorEmail', '==', user.email));
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
              maintenanceType: data.maintenanceType || 'OTHER'
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

  const confirmDelete = async () => {
    if (!documentToDelete && selectedIds.length === 0) return;

    try {
      setBulkDeleting(true);
      const toastId = toast.loading(selectedIds.length > 0 ? `Menghapus ${selectedIds.length} dokumen...` : 'Menghapus dokumen...');

      if (selectedIds.length > 0) {
        for (const id of selectedIds) {
          const docData = documents.find(d => d.id === id);
          if (docData) {
            const collectionName = docData.documentType === 'hse' ? 'hse' : docData.documentType + '_documents';
            await deleteDoc(doc(db, collectionName, id));
          }
        }
        toast.success(`${selectedIds.length} dokumen berhasil dihapus`, { id: toastId });
        setSelectedIds([]);
      } else if (documentToDelete) {
        const collectionName = documentToDelete.documentType === 'hse' ? 'hse' : documentToDelete.documentType + '_documents';
        await deleteDoc(doc(db, collectionName, documentToDelete.id));
        toast.success('Dokumen berhasil dihapus', { id: toastId });
      }

      setDeleteModalOpen(false);
      setDocumentToDelete(null);
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Gagal menghapus dokumen');
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
      const formattedDate = new Date(docData.maintenanceTime).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
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
      await generateHSEPdf(formData, shouldAutoOpen);
      toast.success('PDF HSE berhasil diunduh!', { id: 'download-hse' });
    } catch (error) {
      console.error('Download HSE error:', error);
      toast.error('Gagal mengunduh PDF HSE', { id: 'download-hse' });
    }
  };

  const filteredDocuments = documents.filter(doc => {
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      const inMaintenanceName = doc.maintenanceName.toLowerCase().includes(lowerQuery);
      const inSpecificDetail = (doc.specificDetail || '').toLowerCase().includes(lowerQuery);
      const inFileName = doc.fileName.toLowerCase().includes(lowerQuery);

      if (!inMaintenanceName && !inSpecificDetail && !inFileName) {
        return false;
      }
    }

    if (filterDate) {
      const docDate = new Date(doc.maintenanceTime).toISOString().split('T')[0];
      if (docDate !== filterDate) {
        return false;
      }
    }

    if (filterType !== 'all' && doc.documentType !== filterType) {
      return false;
    }

    return true;
  });

  const docsInView = (() => {
    if (filterOverride !== 'hse_utt') return filteredDocuments;
    if (currentLevel === 'week') {
      return filteredDocuments.filter(d =>
        d.hseType === 'inspection' &&
        getMonthYearString(d.createdAt) === selectedMonth &&
        getWeekOfMonth(d.createdAt) === selectedWeek
      );
    }
    if (currentLevel === 'maintenance') {
      return filteredDocuments.filter(d =>
        d.hseType === selectedCategory &&
        d.maintenanceType === selectedMaintenance
      );
    }
    return [];
  })();

  const renderContent = () => {
    if (filterOverride !== 'hse_utt') {
      return filteredDocuments.map((document, index) => renderDocumentCard(document, index));
    }

    if (currentLevel === 'root') {
      const categories = [
        { id: 'inspection', name: 'HSE Inspection Report', icon: ClipboardList, color: 'text-blue-400', bg: 'bg-blue-500/10' },
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
                className="flex items-center gap-4 p-6 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl hover:border-blue-500/30 transition-all group text-left"
              >
                <div className={`p-3 ${cat.bg} rounded-xl border border-blue-500/20 group-hover:scale-110 transition-transform`}>
                  <cat.icon className={`w-8 h-8 ${cat.color}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{cat.name}</h3>
                  <p className="text-sm text-slate-400">{count} Dokumen</p>
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
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium mb-4"
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
                  className="flex items-center gap-4 p-6 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl hover:border-blue-500/30 transition-all group text-left"
                >
                  <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <Folder className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{month}</h3>
                    <p className="text-sm text-slate-400">
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
                  className="flex items-center gap-4 p-6 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl hover:border-blue-500/30 transition-all group text-left"
                >
                  <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                    <Folder className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white uppercase">{type}</h3>
                    <p className="text-sm text-slate-400">
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
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium mb-2"
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
                className="flex items-center gap-4 p-6 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl hover:border-blue-500/30 transition-all group text-left"
              >
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <Folder className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Minggu ke-{week}</h3>
                  <p className="text-sm text-slate-400">
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
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium mb-2"
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
      className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-4 sm:p-5 border border-slate-700/50 hover:border-blue-500/30 transition group"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        {canDelete && (
          <div className="flex-shrink-0 mr-1">
            <input
              type="checkbox"
              checked={selectedIds.includes(document.id)}
              onChange={(e) => {
                if (e.target.checked) setSelectedIds(prev => [...prev, document.id]);
                else setSelectedIds(prev => prev.filter(id => id !== document.id));
              }}
              className="w-4 h-4 sm:w-5 sm:h-5 rounded border-slate-700 bg-slate-800/50 text-blue-500 focus:ring-blue-500/20 transition-all cursor-pointer"
              title="Pilih dokumen ini"
            />
          </div>
        )}

        <div className="p-2.5 sm:p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex-shrink-0">
          {document.documentType === 'pdf' ? (
            <FileType className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
          ) : (
            <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-white truncate">
              {document.maintenanceName}
            </h3>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${document.documentType === 'pdf'
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
              {document.documentType.toUpperCase()}
            </span>
            {document.hseType && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                {document.hseType}
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
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate">{document.createdBy}</span>
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
              title="Edit Report"
            >
              <Pencil className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
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
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => openDeleteModal(document)}
              className="flex-1 sm:flex-initial p-2.5 sm:p-3 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg transition border border-red-500/20"
              title="Delete"
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
      {}
      <div className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border border-slate-700/50">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-white">Document Archive</h1>
            <p className="text-xs sm:text-sm text-slate-400">Semua dokumen Excel & PDF maintenance yang telah diekspor</p>
          </div>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
  
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama maintenance..."
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white placeholder-slate-500 text-sm sm:text-base"
            />
          </div>

  
          <div className="relative">
            <Calendar className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white text-sm sm:text-base"
              title="Filter berdasarkan tanggal"
              placeholder="Pilih tanggal"
            />
          </div>

  
          <div className="relative">
            <Filter className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white appearance-none cursor-pointer text-sm sm:text-base"
              title="Urutkan dokumen"
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
            </select>
          </div>

  
          <div className="relative">
            <FileType className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'excel' | 'pdf')}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white appearance-none cursor-pointer text-sm sm:text-base"
              title="Filter tipe dokumen"
            >
              <option value="all">Semua</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
        </div>


        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4">
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
            <p className="text-xs text-slate-500">Total Dokumen</p>
            <p className="text-lg sm:text-xl font-bold text-white">{documents.length}</p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
            <p className="text-xs text-slate-500">Hasil Filter</p>
            <p className="text-lg sm:text-xl font-bold text-blue-400">{filteredDocuments.length}</p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
            <p className="text-xs text-slate-500">Total Size</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-400">
              {(documents.reduce((sum, doc) => sum + doc.fileSize, 0) / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
            <p className="text-xs text-slate-500">Filter Aktif</p>
            <p className="text-lg sm:text-xl font-bold text-purple-400">
              {(searchQuery || filterDate || filterType !== 'all') ? 'Yes' : 'No'}
            </p>
          </div>
        </div>


        {canDelete && docsInView.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={docsInView.length > 0 && docsInView.every(d => selectedIds.includes(d.id))}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(docsInView.map(d => d.id));
                  } else {
                    setSelectedIds([]);
                  }
                }}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded border-slate-700 bg-slate-800/50 text-blue-500 focus:ring-blue-500/20 transition-all cursor-pointer"
                title="Pilih semua dokumen"
              />
              <span className="text-sm font-medium text-slate-300">Pilih Semua Dokumen</span>
            </div>

            <AnimatePresence>
              {selectedIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <button
                    onClick={() => {
                      setDocumentToDelete(null);
                      setDeleteModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all text-sm font-bold shadow-lg shadow-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                    Hapus Terpilih ({selectedIds.length})
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
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
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-8 sm:p-12 border border-slate-700/50 text-center">
          <FileSpreadsheet className="w-12 h-12 sm:w-16 sm:h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-slate-300 mb-2">
            {documents.length === 0 ? 'Belum ada dokumen' : 'Tidak ada hasil'}
          </h3>
          <p className="text-sm sm:text-base text-slate-500">
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
        documentName={selectedIds.length > 0 ? `${selectedIds.length} dokumen terpilih` : (documentToDelete?.fileName || '')}
        loading={bulkDeleting}
      />
    </div>
  );
}
