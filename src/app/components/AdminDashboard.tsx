import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, FileText, FileSpreadsheet, Download, Search, Filter, Calendar, User, Database, Activity, TrendingUp } from 'lucide-react';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';

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

export function AdminDashboard() {
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

  useEffect(() => {
    loadAllDocuments();
  }, []);

  const loadAllDocuments = async () => {
    try {
      setLoading(true);

      // ✅ FIX: Add error handling for BloomFilter errors
      // Fetch Excel documents
      const excelQuery = query(
        collection(db, 'excel_documents'),
        orderBy('createdAt', 'desc')
      );
      const excelSnapshot = await getDocs(excelQuery);
      const excelDocs = excelSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'excel' as const
      })) as DocumentData[];

      // Fetch PDF documents
      const pdfQuery = query(
        collection(db, 'pdf_documents'),
        orderBy('createdAt', 'desc')
      );
      const pdfSnapshot = await getDocs(pdfQuery);
      const pdfDocs = pdfSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'pdf' as const
      })) as DocumentData[];

      // Combine and sort by date
      const allDocs = [...excelDocs, ...pdfDocs].sort((a, b) => {
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });

      setDocuments(allDocs);

      // Calculate stats
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
      
      // ✅ FIX: Handle BloomFilter error specifically
      if (error?.message?.includes('BloomFilter')) {
        console.warn('BloomFilter error detected. This usually happens when user document is not yet created.');
        toast.error('Please wait a moment and refresh the page.', { duration: 5000 });
      } else {
        toast.error('Failed to load documents');
      }
      
      setLoading(false);
    }
  };

  const handleRegenerate = async (doc: DocumentData) => {
    try {
      toast.loading(`Regenerating ${doc.type.toUpperCase()}...`, { id: 'regen' });

      const formattedDate = new Date(doc.maintenanceTime).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      if (doc.type === 'excel') {
        // Regenerate Excel
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

        // Create placeholder logos (gray rectangles)
        const placeholderBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8//8/AwAI/AL+O63IsAAAAABJRU5ErkJggg==';
        
        const logoDwimitraId = workbook.addImage({
          base64: placeholderBase64,
          extension: 'png',
        });

        const logoNeutraDCId = workbook.addImage({
          base64: placeholderBase64,
          extension: 'png',
        });

        let currentRow = addExcelHeader(1, logoDwimitraId, logoNeutraDCId);
        const photosPerPage = 9;
        let photoIndex = 0;

        for (let i = 0; i < doc.photosData.length; i += 3) {
          if (photoIndex > 0 && photoIndex % photosPerPage === 0) {
            currentRow++;
            worksheet.getRow(currentRow).height = 20;
            currentRow++;
            currentRow = addExcelHeader(currentRow, logoDwimitraId, logoNeutraDCId);
          }

          const rowCards = doc.photosData.slice(i, i + 3);
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
        // Regenerate PDF
        const pdfDoc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdfDoc.internal.pageSize.getWidth();
        const marginTop = 15;
        const marginLeft = 10;
        const marginRight = 10;
        const usableWidth = pageWidth - marginLeft - marginRight;

        let currentY = marginTop;

        // Use placeholder logos
        const placeholderBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8//8/AwAI/AL+O63IsAAAAABJRU5ErkJggg==';
        const logoDwimitraBase64 = placeholderBase64;
        const logoNeutraDCBase64 = placeholderBase64;

        const addPageHeader = () => {
          let headerY = marginTop;
          const logoWidth = 35;
          const logoHeight = 14;

          pdfDoc.addImage(
            `data:image/png;base64,${logoDwimitraBase64}`,
            'PNG',
            marginLeft,
            headerY,
            logoWidth,
            logoHeight
          );

          pdfDoc.addImage(
            `data:image/png;base64,${logoNeutraDCBase64}`,
            'PNG',
            pageWidth - marginRight - logoWidth,
            headerY,
            logoWidth,
            logoHeight
          );

          headerY += logoHeight + 5;

          pdfDoc.setFontSize(14);
          pdfDoc.setFont('helvetica', 'bold');
          const titleText = `Dokumentasi PM ${doc.maintenanceName} (${formattedDate})`;
          const titleWidth = pdfDoc.getTextWidth(titleText);
          pdfDoc.text(titleText, (pageWidth - titleWidth) / 2, headerY);

          headerY += 8;

          if (doc.specificDetail) {
            pdfDoc.setFontSize(12);
            pdfDoc.setFont('helvetica', 'bold');
            const equipmentText = doc.specificDetail;
            const equipmentWidth = pdfDoc.getTextWidth(equipmentText);
            pdfDoc.text(equipmentText, (pageWidth - equipmentWidth) / 2, headerY);
            headerY += 10;
          } else {
            headerY += 5;
          }

          return headerY;
        };

        currentY = addPageHeader();

        const photoWidth = (usableWidth - 8) / 3;
        const photoHeight = 55;
        const captionHeight = 12;
        const spacing = 4;
        const photosPerPage = 9;
        let photoCount = 0;

        for (let i = 0; i < doc.photosData.length; i += 3) {
          if (photoCount > 0 && photoCount % photosPerPage === 0) {
            pdfDoc.addPage();
            currentY = addPageHeader();
          }

          const rowCards = doc.photosData.slice(i, i + 3);

          for (let j = 0; j < rowCards.length; j++) {
            const card = rowCards[j];
            const xPos = marginLeft + j * (photoWidth + spacing);

            pdfDoc.setDrawColor(0);
            pdfDoc.setLineWidth(0.5);
            pdfDoc.rect(xPos, currentY, photoWidth, photoHeight);

            if (card.photoBase64) {
              try {
                pdfDoc.addImage(
                  card.photoBase64,
                  'JPEG',
                  xPos + 0.5,
                  currentY + 0.5,
                  photoWidth - 1,
                  photoHeight - 1
                );
              } catch (imgError) {
                console.error('Failed to add image:', imgError);
              }
            }

            pdfDoc.rect(xPos, currentY + photoHeight, photoWidth, captionHeight);

            if (card.description) {
              pdfDoc.setFontSize(8);
              pdfDoc.setFont('helvetica', 'normal');
              const lines = pdfDoc.splitTextToSize(card.description, photoWidth - 4);
              const textY = currentY + photoHeight + 6;
              pdfDoc.text(lines, xPos + photoWidth / 2, textY, { align: 'center', maxWidth: photoWidth - 4 });
            }

            photoCount++;
          }

          currentY += photoHeight + captionHeight + 8;
        }

        const pdfBlob = pdfDoc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.fileName;
        link.click();
        URL.revokeObjectURL(url);
      }

      toast.success(`${doc.type.toUpperCase()} regenerated successfully!`, { id: 'regen' });
    } catch (error) {
      console.error('Regenerate error:', error);
      toast.error('Failed to regenerate document', { id: 'regen' });
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.maintenanceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.createdBy.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || doc.type === filterType;
    
    // ✅ Date filter logic
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

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 relative z-10">
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 backdrop-blur-xl rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border border-purple-500/30">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-xs sm:text-sm text-purple-300">Manage all documents and monitor system activity</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-slate-700/50"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <Database className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            <p className="text-[10px] sm:text-xs text-slate-400">Total Documents</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalDocuments}</p>
          <div className="flex items-center gap-1 mt-0.5 sm:mt-1">
            <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
            <p className="text-[10px] sm:text-xs text-emerald-400">All time</p>
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
            <p className="text-[10px] sm:text-xs text-slate-400">Excel Files</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalExcel}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Documents</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-slate-700/50"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
            <p className="text-[10px] sm:text-xs text-slate-400">PDF Files</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalPDF}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Documents</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-slate-700/50"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            <p className="text-[10px] sm:text-xs text-slate-400">Active Users</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalUsers}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Contributors</p>
        </motion.div>
      </div>

      {/* Search and Filter */}
      <div className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border border-slate-700/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white placeholder-slate-500 text-sm"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'excel' | 'pdf')}
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white appearance-none cursor-pointer text-sm"
            >
              <option value="all">All Documents</option>
              <option value="excel">Excel Only</option>
              <option value="pdf">PDF Only</option>
            </select>
          </div>

          {/* Date Filter */}
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
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition text-white appearance-none cursor-pointer text-sm"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range - Show only when 'custom' is selected */}
        {dateFilter === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-700/30">
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition text-white text-sm"
                placeholder="Start Date"
              />
            </div>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition text-white text-sm"
                placeholder="End Date"
              />
            </div>
          </div>
        )}
      </div>

      {/* Documents Table */}
      <div className="bg-slate-900/40 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Mobile Card View */}
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
                      <p className="text-slate-500">Created By</p>
                      <p className="text-slate-300 truncate">{doc.createdBy}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Date</p>
                      <p className="text-slate-300">{doc.createdAt.toDate().toLocaleDateString('id-ID')}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Photos</p>
                      <p className="text-slate-300">{doc.photosWithImage}/{doc.totalPhotos}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Detail</p>
                      <p className="text-slate-300 truncate">{doc.specificDetail || '-'}</p>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleRegenerate(doc)}
                    className="w-full flex items-center justify-center gap-2 p-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition border border-blue-500/30 text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download {doc.type.toUpperCase()}
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
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
            <table className="w-full">
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
                      <p className="text-sm text-white font-medium truncate max-w-xs">{doc.fileName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-300 truncate max-w-xs">{doc.maintenanceName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-400 truncate max-w-xs">{doc.specificDetail || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-slate-500" />
                        <p className="text-sm text-slate-400 truncate max-w-xs">{doc.createdBy}</p>
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

      {/* Footer Info */}
      <div className="mt-6 text-center">
        <p className="text-sm text-slate-500">
          Showing {filteredDocuments.length} of {documents.length} documents
        </p>
      </div>
    </div>
  );
}