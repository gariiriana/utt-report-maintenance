import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, Download, Trash2, Calendar, Search, Filter, Clock, User, FileDown, FileType } from 'lucide-react';
import { collection, query, getDocs, deleteDoc, doc, where } from 'firebase/firestore'; // ✅ Removed "orderBy" - not needed anymore
import { db } from '@/lib/firebase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import logoDwimitra from '@/assets/a6129221f456afd6fd88d74c324473e495bdd7a8.png';
import logoNeutraDC from '@/assets/005ac597864c02a96c9add5c6e054d23b8cfafbe.png';
import { DeleteConfirmModal } from './DeleteConfirmModal'; // ✅ NEW: Import custom modal

interface PhotoData {
  index: number;
  description: string;
  photoBase64: string;
  hasPhoto: boolean;
}

interface ExcelDocument {
  id: string;
  fileName: string;
  maintenanceName: string;
  maintenanceTime: string;
  specificDetail?: string; // ✅ NEW: Optional karena dokumen lama mungkin tidak punya
  createdAt: Date;
  createdBy: string;
  fileSize: number;
  totalPhotos: number;
  photosWithImage: number;
  photosData: PhotoData[];
  documentType: 'excel' | 'pdf'; // ✅ NEW: Type of document
}

export function DocumentList() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ExcelDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [filterType, setFilterType] = useState<'all' | 'excel' | 'pdf'>('all'); // ✅ NEW: Filter by document type
  
  // ✅ NEW: State untuk delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<ExcelDocument | null>(null);

  // ✅ FIX: Wrap fetchDocuments with useCallback to avoid missing dependency warning
  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch Excel documents
      const excelQuery = query(
        collection(db, 'excel_documents'),
        where('createdBy', '==', user.email)
      );
      const excelSnapshot = await getDocs(excelQuery);
      const excelDocs: ExcelDocument[] = [];
      excelSnapshot.forEach((doc) => {
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
          photosData: data.photosData || [],
          documentType: 'excel',
        });
      });

      // Fetch PDF documents
      const pdfQuery = query(
        collection(db, 'pdf_documents'),
        where('createdBy', '==', user.email)
      );
      const pdfSnapshot = await getDocs(pdfQuery);
      const pdfDocs: ExcelDocument[] = [];
      pdfSnapshot.forEach((doc) => {
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
          photosData: data.photosData || [],
          documentType: 'pdf',
        });
      });

      // Combine both arrays
      const allDocs = [...excelDocs, ...pdfDocs];

      // ✅ Sort on client-side based on sortBy state
      allDocs.sort((a, b) => {
        const timeA = a.createdAt.getTime();
        const timeB = b.createdAt.getTime();
        return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
      });

      setDocuments(allDocs);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      
      // ✅ Check if error is about missing index
      if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
        toast.error('Database index diperlukan. Klik link di console browser untuk create index.', {
          duration: 8000,
        });
        console.error('🔍 CREATE INDEX: Buka link di atas untuk create Firestore composite index');
      } else {
        toast.error('Gagal memuat dokumen');
      }
    } finally {
      setLoading(false);
    }
  }, [user, sortBy]); // ✅ FIX: Add dependencies

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]); // ✅ FIX: Use fetchDocuments in dependency

  // ✅ NEW: Open delete modal
  const openDeleteModal = (document: ExcelDocument) => {
    setDocumentToDelete(document);
    setDeleteModalOpen(true);
  };

  // ✅ UPDATED: Confirm delete (called from modal)
  const confirmDelete = async () => {
    if (!documentToDelete) return;

    try {
      toast.loading('Menghapus dokumen...', { id: 'delete' });

      // Delete from Firestore
      await deleteDoc(doc(db, documentToDelete.documentType + '_documents', documentToDelete.id));

      toast.success('Dokumen berhasil dihapus', { id: 'delete' });
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Gagal menghapus dokumen', { id: 'delete' });
    }
  };

  const handleDownload = async (docData: ExcelDocument) => {
    try {
      toast.loading('Generating Excel from database...', { id: 'download' });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Maintenance Report');

      // Set column widths - 3 photo columns + 2 spacing columns = 5 total
      worksheet.columns = [
        { width: 26 },  // Column A - Photo 1
        { width: 2 },   // Column B - Spacing
        { width: 26 },  // Column C - Photo 2
        { width: 2 },   // Column D - Spacing
        { width: 26 },  // Column E - Photo 3
      ];

      // Format date
      const formattedDate = new Date(docData.maintenanceTime).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      // Load logos
      try {
        const logoDwimitraResponse = await fetch(logoDwimitra);
        const logoDwimitraBlob = await logoDwimitraResponse.blob();
        const logoDwimitraArrayBuffer = await logoDwimitraBlob.arrayBuffer();
        const logoDwimitraBase64 = btoa(
          new Uint8Array(logoDwimitraArrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte), ''
          )
        );

        const logoNeutraDCResponse = await fetch(logoNeutraDC);
        const logoNeutraDCBlob = await logoNeutraDCResponse.blob();
        const logoNeutraDCArrayBuffer = await logoNeutraDCBlob.arrayBuffer();
        const logoNeutraDCBase64 = btoa(
          new Uint8Array(logoNeutraDCArrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte), ''
          )
        );

        const dwimitraImageId = workbook.addImage({
          base64: logoDwimitraBase64,
          extension: 'png',
        });

        const neutraDCImageId = workbook.addImage({
          base64: logoNeutraDCBase64,
          extension: 'png',
        });

        // Row 1: Title with floating logos
        worksheet.getRow(1).height = 50;
        worksheet.mergeCells('A1:E1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `Dokumentasi PM ${docData.maintenanceName} (${formattedDate})`;
        titleCell.font = { size: 11, bold: true }; // ✅ Dikecilkan dari 14 → 11
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        // Add floating logos
        // ✅ Logo Dwimitra - LARGER size, positioned with proper spacing
        worksheet.addImage(dwimitraImageId, {
          tl: { col: 0.15, row: 0.25 }, // ✅ Shifted right untuk spacing (was 0.05)
          ext: { width: 110, height: 45 } // ✅ LARGER size
        });

        // ✅ Logo NeutraDC - LARGER size, positioned with proper spacing
        worksheet.addImage(neutraDCImageId, {
          tl: { col: 4.55, row: 0.25 }, // ✅ Shifted more right untuk spacing (was 4.4)
          ext: { width: 110, height: 45 } // ✅ LARGER size
        });

      } catch (error) {
        console.error('Logo error:', error);
      }

      // Row 2: Specific Detail (Unit/Ruangan) - menggantikan "FCU"
      worksheet.mergeCells('A2:E2');
      const equipmentCell = worksheet.getCell('A2');
      equipmentCell.value = docData.specificDetail || docData.maintenanceName; // ✅ Gunakan specificDetail jika ada
      equipmentCell.font = { size: 10, bold: true }; // ✅ Dikecilkan dari 12 → 10 (proporsional dengan Row 1)
      equipmentCell.alignment = { horizontal: 'center', vertical: 'middle' };
      equipmentCell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
      worksheet.getRow(2).height = 30;

      // Empty spacing row
      worksheet.getRow(3).height = 8;

      // Add photos in 3-column grid
      let currentRow = 4;
      const photosData = docData.photosData || [];

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

      // Generate and download
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

      toast.success('File downloaded successfully!', { id: 'download' });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file', { id: 'download' });
    }
  };

  const handleDownloadPDF = async (docData: ExcelDocument) => {
    try {
      toast.loading('Generating PDF from database...', { id: 'download-pdf' });

      // Format date
      const formattedDate = new Date(docData.maintenanceTime).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      // Create PDF (A4 portrait: 210mm x 297mm)
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Margins
      const marginTop = 15;
      const marginLeft = 10;
      const marginRight = 10;
      const usableWidth = pageWidth - marginLeft - marginRight;

      let currentY = marginTop;

      // Load logos
      try {
        const logoDwimitraResponse = await fetch(logoDwimitra);
        const logoDwimitraBlob = await logoDwimitraResponse.blob();
        const logoDwimitraArrayBuffer = await logoDwimitraBlob.arrayBuffer();
        const logoDwimitraBase64 = btoa(
          new Uint8Array(logoDwimitraArrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte), ''
          )
        );

        const logoNeutraDCResponse = await fetch(logoNeutraDC);
        const logoNeutraDCBlob = await logoNeutraDCResponse.blob();
        const logoNeutraDCArrayBuffer = await logoNeutraDCBlob.arrayBuffer();
        const logoNeutraDCBase64 = btoa(
          new Uint8Array(logoNeutraDCArrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte), ''
          )
        );

        // Add logos
        const logoWidth = 35;
        const logoHeight = 14;
        
        // Logo Dwimitra - Left
        doc.addImage(
          `data:image/png;base64,${logoDwimitraBase64}`,
          'PNG',
          marginLeft,
          currentY,
          logoWidth,
          logoHeight
        );

        // Logo NeutraDC - Right
        doc.addImage(
          `data:image/png;base64,${logoNeutraDCBase64}`,
          'PNG',
          pageWidth - marginRight - logoWidth,
          currentY,
          logoWidth,
          logoHeight
        );

        currentY += logoHeight + 5;

        // Title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const titleText = `Dokumentasi PM ${docData.maintenanceName} (${formattedDate})`;
        const titleWidth = doc.getTextWidth(titleText);
        doc.text(titleText, (pageWidth - titleWidth) / 2, currentY);
        
        currentY += 8;

        // Specific Detail / Equipment Name
        if (docData.specificDetail) {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          const equipmentText = docData.specificDetail;
          const equipmentWidth = doc.getTextWidth(equipmentText);
          doc.text(equipmentText, (pageWidth - equipmentWidth) / 2, currentY);
          currentY += 10;
        } else {
          currentY += 5;
        }

        // Add photos in 3-column grid
        const photoWidth = (usableWidth - 8) / 3; // 3 columns with 4mm spacing between
        const photoHeight = 55; // Fixed height for photos
        const captionHeight = 12; // Height for caption area
        const spacing = 4;

        const photosData = docData.photosData || [];

        for (let i = 0; i < photosData.length; i += 3) {
          // Check if we need a new page
          if (currentY + photoHeight + captionHeight + 10 > pageHeight - 15) {
            doc.addPage();
            currentY = marginTop;
          }

          const rowCards = photosData.slice(i, i + 3);

          for (let j = 0; j < rowCards.length; j++) {
            const card = rowCards[j];
            const xPos = marginLeft + j * (photoWidth + spacing);

            // Draw photo border/box
            doc.setDrawColor(0);
            doc.setLineWidth(0.5);
            doc.rect(xPos, currentY, photoWidth, photoHeight);

            // Add photo if exists
            if (card.photoBase64) {
              try {
                doc.addImage(
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

            // Add caption box
            doc.rect(xPos, currentY + photoHeight, photoWidth, captionHeight);
            
            // Add caption text
            if (card.description) {
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              const lines = doc.splitTextToSize(card.description, photoWidth - 4);
              const textY = currentY + photoHeight + 6;
              doc.text(lines, xPos + photoWidth / 2, textY, { align: 'center', maxWidth: photoWidth - 4 });
            }
          }

          currentY += photoHeight + captionHeight + 8; // Add spacing after each row
        }

      } catch (error) {
        console.error('Failed to load logos:', error);
      }

      // Generate PDF and download
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = docData.fileName;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('PDF downloaded successfully!', { id: 'download-pdf' });
    } catch (error) {
      console.error('Download PDF error:', error);
      toast.error('Failed to download PDF', { id: 'download-pdf' });
    }
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    // Filter by search query
    if (searchQuery && !doc.maintenanceName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Filter by date
    if (filterDate) {
      const docDate = new Date(doc.maintenanceTime).toISOString().split('T')[0];
      if (docDate !== filterDate) {
        return false;
      }
    }

    // Filter by document type
    if (filterType !== 'all' && doc.documentType !== filterType) {
      return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 relative z-10">
      {/* Header */}
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

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {/* Search */}
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

          {/* Date Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white text-sm sm:text-base"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <Filter className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white appearance-none cursor-pointer text-sm sm:text-base"
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
            </select>
          </div>

          {/* Document Type Filter */}
          <div className="relative">
            <FileType className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'excel' | 'pdf')}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition text-white appearance-none cursor-pointer text-sm sm:text-base"
            >
              <option value="all">Semua</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
        </div>

        {/* Stats */}
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
      </div>

      {/* Document List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm sm:text-base">Memuat dokumen...</p>
          </div>
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
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          <AnimatePresence mode="popLayout">
            {filteredDocuments.map((document, index) => (
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
                  {/* Icon */}
                  <div className="p-2.5 sm:p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex-shrink-0">
                    {document.documentType === 'pdf' ? (
                      <FileType className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                    ) : (
                      <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                        {document.maintenanceName}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        document.documentType === 'pdf' 
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {document.documentType.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-1 text-xs sm:text-sm text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>
                          {new Date(document.maintenanceTime).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate">{document.createdBy}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>{(document.fileSize / 1024).toFixed(0)} KB</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 hidden sm:block">
                      Dibuat: {document.createdAt.toLocaleString('id-ID')}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => document.documentType === 'pdf' ? handleDownloadPDF(document) : handleDownload(document)}
                      className="flex-1 sm:flex-initial p-2.5 sm:p-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg transition border border-blue-500/20"
                      title={`Download ${document.documentType === 'pdf' ? 'PDF' : 'Excel'}`}
                    >
                      <Download className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
                    </motion.button>
                    {/* Delete button - opens modal instead of browser confirm */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openDeleteModal(document)}
                      className="flex-1 sm:flex-initial p-2.5 sm:p-3 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg transition border border-red-500/20"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ✅ Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        documentName={documentToDelete?.fileName || ''}
      />
    </div>
  );
}