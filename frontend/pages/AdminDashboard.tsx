import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { FileText, FileSpreadsheet, Download, Search, Filter, Calendar, User, Database, Activity, TrendingUp, Pencil, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { ExcelDocument } from '@/components/DocumentList';
import { db } from '@/api/firebase';
import { useAuth } from '@/components/AuthContext';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { generateReportPDF, loadLogoBase64 } from '@/utils/ReportPdfExport';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import logoBRI from '@/assets/bri_logo.png';
import logoBRILeft from '@/assets/bri_left_logo.png';
import { usePresence } from '@/hooks/usePresence';

interface DocumentData {
  id: string;
  fileName: string;
  maintenanceName: string;
  maintenanceTime: string;
  specificDetail?: string;
  createdAt: Timestamp;
  createdBy: string;
  fileSize: number;
  totalPhotos: number;
  photosWithImage: number;
  photosData: Array<{
    index: number;
    description: string;
    photoBase64: string;
    hasPhoto: boolean;
  }>;
  type: 'excel' | 'pdf';
}

interface AdminDashboardProps {
  onEdit?: (doc: ExcelDocument) => void;
}

export function AdminDashboard({ onEdit }: AdminDashboardProps) {
  const { companyType } = useAuth();
  const onlineUsers = usePresence();
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'excel' | 'pdf'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalExcel: 0,
    totalPDF: 0,
    totalUsers: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
      setShowLeftScroll(scrollLeft > 10);
      setShowRightScroll(scrollWidth - scrollLeft - clientWidth > 10);
    }
  };

  const scrollTable = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const amount = containerRef.current.clientWidth * 0.6;
      containerRef.current.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    loadAllDocuments();
  }, []);

  const handleEditClick = async (doc: DocumentData) => {
    if (!onEdit) return;

    try {
      toast.loading('Menyiapkan data untuk pengeditan...', { id: 'edit-prep' });

      let photosData = doc.photosData || [];
      if (photosData.length === 0) {
        const colName = doc.type === 'excel' ? 'excel_documents' : 'pdf_documents';
        const photosSnap = await getDocs(
          collection(db, `${colName}/${doc.id}/photos`)
        );
        if (!photosSnap.empty) {
          photosData = photosSnap.docs
            .map(d => d.data() as any)
            .sort((a, b) => a.index - b.index);
        }
      }

      const excelDoc: ExcelDocument = {
        ...doc,
        createdAt: doc.createdAt.toDate(),
        photosData: photosData,
        documentType: doc.type,
        fileSize: 0
      };

      onEdit(excelDoc);
      toast.dismiss('edit-prep');
    } catch (err) {
      console.error('Failed to prepare data for edit:', err);
      toast.error('Gagal menyiapkan data untuk pengeditan', { id: 'edit-prep' });
    }
  };

  const loadAllDocuments = async () => {
    try {
      setLoading(true);
      const excelQuery = query(
        collection(db, 'excel_documents'),
        orderBy('createdAt', 'desc')
      );
      const pdfQuery = query(
        collection(db, 'pdf_documents'),
        orderBy('createdAt', 'desc')
      );

      const [excelSnapshot, pdfSnapshot] = await Promise.all([
        getDocs(excelQuery),
        getDocs(pdfQuery)
      ]);

      const excelDocs = excelSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          fileName: data.fileName,
          maintenanceName: data.maintenanceName,
          maintenanceTime: data.maintenanceTime,
          specificDetail: data.specificDetail,
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          fileSize: data.fileSize || 0,
          totalPhotos: data.totalPhotos || 0,
          photosWithImage: data.photosWithImage || 0,
          photosData: [], // Optimized: photosData is lazily loaded on edit/regen
          type: 'excel' as const
        };
      }) as DocumentData[];

      const pdfDocs = pdfSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          fileName: data.fileName,
          maintenanceName: data.maintenanceName,
          maintenanceTime: data.maintenanceTime,
          specificDetail: data.specificDetail,
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          fileSize: data.fileSize || 0,
          totalPhotos: data.totalPhotos || 0,
          photosWithImage: data.photosWithImage || 0,
          photosData: [], // Optimized: photosData is lazily loaded on edit/regen
          type: 'pdf' as const
        };
      }) as DocumentData[];

      const allDocs = [...excelDocs, ...pdfDocs].sort((a, b) => {
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });

      setDocuments(allDocs);

      const uniqueUsers = new Set(allDocs.map(doc => doc.createdBy));
      setStats({
        totalDocuments: allDocs.length,
        totalExcel: excelDocs.length,
        totalPDF: pdfDocs.length,
        totalUsers: uniqueUsers.size,
      });

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading documents:', error);

      if (error?.message?.includes('BloomFilter')) {
        console.warn('BloomFilter error detected. This usually happens when user document is not yet created.');
        toast.error('Tunggu sebentar dan muat ulang halaman.', { duration: 5000 });
      } else {
        toast.error('Gagal memuat dokumen');
      }

      setLoading(false);
    }
  };

  const handleRegenerate = async (doc: DocumentData) => {
    try {
      toast.loading(`Memperbarui ${doc.type.toUpperCase()}...`, { id: 'regen' });

      let photosData = doc.photosData || [];
      if (photosData.length === 0) {
        try {
          const colName = doc.type === 'excel' ? 'excel_documents' : 'pdf_documents';
          const photosSnap = await getDocs(
            collection(db, `${colName}/${doc.id}/photos`)
          );
          if (!photosSnap.empty) {
            photosData = photosSnap.docs
              .map(d => d.data() as any)
              .sort((a, b) => a.index - b.index);
          }
        } catch (err) {
          console.error(`Failed to fetch photos for regeneration:`, err);
        }
      }

      const formattedDate = new Date(doc.maintenanceTime).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      if (doc.type === 'excel') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Maintenance Report');

        worksheet.columns = [
          { width: 26 },
          { width: 2 },
          { width: 26 },
          { width: 2 },
          { width: 26 },
        ];

        const addExcelHeader = (startRow: number, logoDwimitraId: number, logoNeutraDCId: number) => {
          worksheet.addImage(logoDwimitraId, {
            tl: { col: 0.15, row: startRow - 1 + 0.25 },
            ext: { width: 110, height: 45 }
          });

          worksheet.addImage(logoNeutraDCId, {
            tl: { col: 4.55, row: startRow - 1 + 0.25 },
            ext: { width: 110, height: 45 }
          });

          worksheet.getRow(startRow).height = 50;
          worksheet.mergeCells(`A${startRow}:E${startRow}`);
          const titleCell = worksheet.getCell(`A${startRow}`);
          titleCell.value = `Dokumentasi PM ${doc.maintenanceName} (${formattedDate})`;
          titleCell.font = { size: 11, bold: true };
          titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
          titleCell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };

          worksheet.mergeCells(`A${startRow + 1}:E${startRow + 1}`);
          const equipmentCell = worksheet.getCell(`A${startRow + 1}`);
          equipmentCell.value = doc.specificDetail || doc.maintenanceName;
          equipmentCell.font = { size: 10, bold: true };
          equipmentCell.alignment = { horizontal: 'center', vertical: 'middle' };
          equipmentCell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
          worksheet.getRow(startRow + 1).height = 30;
          worksheet.getRow(startRow + 2).height = 8;

          return startRow + 3;
        };
        let logoLeftId: number;
        let logoNeutraDCId: number;

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

          logoLeftId = workbook.addImage({
            base64: logoLeftBase64,
            extension: 'png',
          });

          logoNeutraDCId = workbook.addImage({
            base64: logoRightBase64,
            extension: 'png',
          });
        } catch (error) {
          console.error('Failed to load logos:', error);
          toast.error('Failed to load logos', { id: 'regen' });
          return;
        }

        let currentRow = addExcelHeader(1, logoLeftId, logoNeutraDCId);
        const photosPerPage = 9;
        let photoIndex = 0;

        for (let i = 0; i < photosData.length; i += 3) {
          if (photoIndex > 0 && photoIndex % photosPerPage === 0) {
            currentRow++;
            worksheet.getRow(currentRow).height = 20;
            currentRow++;
            currentRow = addExcelHeader(currentRow, logoLeftId, logoNeutraDCId);
          }

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
              const base64Data = card.photoBase64.split(',')[1];
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
          photoIndex += 3;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.fileName;
        link.click();
        URL.revokeObjectURL(url);

      } else {
        const leftLogo = companyType === 'bri' ? logoBRILeft : logoDwimitra;
        const rightLogo = companyType === 'bri' ? logoBRI : logoNeutraDC;
        const [logoLeftB64, logoRightB64] = await Promise.all([
          loadLogoBase64(leftLogo),
          loadLogoBase64(rightLogo),
        ]);

        const cards = photosData.map((p: any, i: number) => ({
          id: `admin_${i}`,
          photo: null as File | null,
          photoBase64: p.photoBase64 || '',
          description: p.description || '',
        }));

        const result = await generateReportPDF({
          maintenanceName: doc.maintenanceName,
          maintenanceTime: doc.maintenanceTime,
          specificDetail: doc.specificDetail || '',
          vrvUnitDetail: '',
          cards,
          companyType: companyType as 'neutra' | 'bri',
          userEmail: doc.createdBy,
          logos: { left: logoLeftB64, right: logoRightB64 },
        });

        if (!result) {
          toast.error('Gagal membuat PDF', { id: 'regen' });
          return;
        }

        const pdfBlob = result.doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.fileName;
        link.click();
        URL.revokeObjectURL(url);
      }

      toast.success(`${doc.type.toUpperCase()} berhasil diperbarui!`, { id: 'regen' });
    } catch (error) {
      console.error('Regenerate error:', error);
      toast.error('Gagal memperbarui dokumen', { id: 'regen' });
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch =
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.maintenanceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.createdBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.specificDetail || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterType === 'all' || doc.type === filterType;

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const docDate = doc.createdAt.toDate();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateFilter === 'today') {
        const docDay = new Date(docDate);
        docDay.setHours(0, 0, 0, 0);
        matchesDate = docDay.getTime() === today.getTime();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        matchesDate = docDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        matchesDate = docDate >= monthAgo;
      } else if (dateFilter === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = docDate >= start && docDate <= end;
      }
    }

    return matchesSearch && matchesFilter && matchesDate;
  });

  useEffect(() => {
    const timer = setTimeout(checkScroll, 100);
    window.addEventListener('resize', checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScroll);
    };
  }, [filteredDocuments]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 relative z-10">


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-slate-700/50"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <Database className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            <p className="text-[10px] sm:text-xs text-slate-400">Total Dokumen</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalDocuments}</p>
          <div className="flex items-center gap-1 mt-0.5 sm:mt-1">
            <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
            <p className="text-[10px] sm:text-xs text-emerald-400">Sepanjang waktu</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-slate-700/50"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            <p className="text-[10px] sm:text-xs text-slate-400">File Excel</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalExcel}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Dokumen</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-slate-700/50"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
            <p className="text-[10px] sm:text-xs text-slate-400">File PDF</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalPDF}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Dokumen</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-slate-700/50"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            <p className="text-[10px] sm:text-xs text-slate-400">Pengguna Aktif</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalUsers}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Kontributor</p>
        </motion.div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border border-slate-700/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari dokumen..."
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white placeholder-slate-500 text-sm"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'excel' | 'pdf')}
              title="Filter Tipe Dokumen"
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white appearance-none cursor-pointer text-sm"
            >
              <option value="all">Semua Dokumen</option>
              <option value="excel">Excel Saja</option>
              <option value="pdf">PDF Saja</option>
            </select>
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            <select
              value={dateFilter}
              onChange={(e) => {
                const value = e.target.value as 'all' | 'today' | 'week' | 'month' | 'custom';
                setDateFilter(value);
                if (value !== 'custom') {
                  setStartDate('');
                  setEndDate('');
                }
              }}
              title="Filter Rentang Waktu"
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition text-white appearance-none cursor-pointer text-sm"
            >
              <option value="all">Semua Waktu</option>
              <option value="today">Hari Ini</option>
              <option value="week">7 Hari Terakhir</option>
              <option value="month">30 Hari Terakhir</option>
              <option value="custom">Rentang Kustom</option>
            </select>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-700/30">
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition text-white text-sm"
                placeholder="Tanggal Mulai"
              />
            </div>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition text-white text-sm"
                placeholder="Tanggal Selesai"
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900/40 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="block md:hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Activity className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No documents found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {filteredDocuments.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 hover:bg-slate-800/30 transition"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {doc.type === 'excel' ? (
                        <FileSpreadsheet className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <FileText className="w-5 h-5 text-red-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{doc.fileName}</p>
                        <p className="text-xs text-slate-400 truncate">{doc.maintenanceName}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 uppercase flex-shrink-0">
                      {doc.type}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <p className="text-slate-500">Dibuat Oleh</p>
                      <p className="text-slate-300 truncate">{doc.createdBy}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Tanggal</p>
                      <p className="text-slate-300">{doc.createdAt.toDate().toLocaleDateString('id-ID')}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Foto</p>
                      <p className="text-slate-300">{doc.photosWithImage}/{doc.totalPhotos}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Detail</p>
                      <p className="text-slate-300 truncate">{doc.specificDetail || '-'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleRegenerate(doc)}
                      className="flex-1 flex items-center justify-center gap-2 p-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition border border-blue-500/30 text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Download {doc.type.toUpperCase()}
                    </motion.button>
                    {onEdit && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleEditClick(doc)}
                        className="p-2.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-blue-400 rounded-lg border border-slate-700/50 transition"
                        title="Edit Report"
                      >
                        <Pencil className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:block">
          {!loading && filteredDocuments.length > 0 && showRightScroll && (
            <div className="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold tracking-[0.12em] uppercase animate-pulse mb-3 px-4 pt-4">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-lg shadow-blue-500" />
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Geser horizontal untuk detail kolom lainnya</span>
            </div>
          )}

          <div className="relative group">
            {/* Left scroll chevron and overlay */}
            <div 
              className={`absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-slate-950 via-slate-950/40 to-transparent pointer-events-none transition-all duration-300 flex items-center justify-start pl-3 z-10 ${
                showLeftScroll ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
              }`}
            >
              <button 
                onClick={() => scrollTable('left')}
                className="pointer-events-auto bg-slate-900/90 border border-slate-700/50 p-2 rounded-full shadow-2xl hover:bg-slate-800 hover:border-slate-500 transition-all cursor-pointer backdrop-blur-md"
                title="Scroll left"
              >
                <ChevronLeft className="w-4 h-4 text-blue-400" />
              </button>
            </div>

            {/* Right scroll chevron and overlay */}
            <div 
              className={`absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-950 via-slate-950/40 to-transparent pointer-events-none transition-all duration-300 flex items-center justify-end pr-3 z-10 ${
                showRightScroll ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
              }`}
            >
              <button 
                onClick={() => scrollTable('right')}
                className="pointer-events-auto bg-slate-900/90 border border-slate-700/50 p-2 rounded-full shadow-2xl hover:bg-slate-800 hover:border-slate-500 transition-all cursor-pointer backdrop-blur-md"
                title="Scroll right"
              >
                <ChevronRight className="w-4 h-4 text-blue-400" />
              </button>
            </div>

            <div 
              ref={containerRef}
              onScroll={checkScroll}
              className="overflow-x-auto scrollbar-thin w-full"
            >
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Activity className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-12">
                  <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No documents found</p>
                </div>
              ) : (
                <table className="w-full min-w-[1000px]">
                  <thead className="bg-slate-800/50 border-b border-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">File Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Maintenance</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Detail</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Created By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Photos</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {filteredDocuments.map((doc) => (
                      <motion.tr
                        key={doc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-slate-800/30 transition"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {doc.type === 'excel' ? (
                              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <FileText className="w-4 h-4 text-red-400" />
                            )}
                            <span className="text-xs font-medium text-slate-300 uppercase">{doc.type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-white font-medium truncate max-w-[200px]" title={doc.fileName}>{doc.fileName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-300 truncate max-w-[150px]" title={doc.maintenanceName}>{doc.maintenanceName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-400 truncate max-w-[150px]" title={doc.specificDetail || '-'}>{doc.specificDetail || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-slate-500" />
                            <p className="text-sm text-slate-400 truncate max-w-[130px]" title={doc.createdBy}>{doc.createdBy}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <p className="text-sm text-slate-400">
                              {doc.createdAt.toDate().toLocaleDateString('id-ID')}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-300">
                            {doc.photosWithImage}/{doc.totalPhotos}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleRegenerate(doc)}
                              className="p-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition border border-blue-500/30"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="mt-6 text-center">
        <p className="text-sm text-slate-500">
          Showing {filteredDocuments.length} of {documents.length} documents
        </p>
      </div>
    </div>
  );
}
