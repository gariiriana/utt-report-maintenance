import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, Download, Trash2, Calendar, Search, Filter, Clock, User, FileDown, FileType, Pencil, Box } from 'lucide-react';
import { collection, query, getDocs, deleteDoc, doc, where } from 'firebase/firestore'; // ✅ Removed "orderBy" - not needed anymore
import { db } from '@/lib/firebase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/005ac597864c02a96c9add5c6e054d23b8cfafbe.png';
import logoBRI from '@/assets/bri_logo.png';
import logoBRILeft from '@/assets/bri_left_logo.png';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { compressBase64Image } from '@/lib/imageCompression';
import { generateHSEPdf } from './HSEPdfExport';
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
  specificDetail?: string; // ✅ NEW: Optional karena dokumen lama mungkin tidak punya
  createdAt: Date;
  createdBy: string;
  fileSize: number;
  totalPhotos: number;
  photosWithImage: number;
  photosData: PhotoData[];
  documentType: 'excel' | 'pdf' | 'hse'; // ✅ UPDATED: Added hse
}

interface DocumentListProps {
  onEdit?: (doc: ExcelDocument) => void;
}

export function DocumentList({ onEdit }: DocumentListProps) {
  const { user, userRole, companyType } = useAuth();
  const isAdmin = userRole === 'admin';
  const [documents, setDocuments] = useState<ExcelDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [filterType, setFilterType] = useState<'all' | 'excel' | 'pdf' | 'hse'>('all'); // ✅ UPDATED: Filter by document type

  // ✅ NEW: State untuk delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<ExcelDocument | null>(null);

  // ✅ FIX: Wrap fetchDocuments with useCallback to avoid missing dependency warning
  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch Excel documents
      const excelQuery = isAdmin
        ? query(collection(db, 'excel_documents'))
        : query(
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
      const pdfQuery = isAdmin
        ? query(collection(db, 'pdf_documents'))
        : query(
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

      // Fetch HSE documents (Only for Admin or HSE Officer)
      const hseDocs: ExcelDocument[] = [];
      if (isAdmin || userRole === 'hse') {
        const hseQuery = isAdmin
          ? query(collection(db, 'hse'))
          : query(
            collection(db, 'hse'),
            where('authorEmail', '==', user.email)
          );
        const hseSnapshot = await getDocs(hseQuery);
        hseSnapshot.forEach((doc) => {
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
          });
        });
      }

      // Combine all arrays
      const allDocs = [...excelDocs, ...pdfDocs, ...hseDocs];

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
  }, [user, sortBy, userRole]); // ✅ UPDATED: Added userRole as dependency

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
      const collectionName = documentToDelete.documentType === 'hse' ? 'hse' : documentToDelete.documentType + '_documents';
      await deleteDoc(doc(db, collectionName, documentToDelete.id));

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
        // Select left logo based on company type
        const leftLogo = companyType === 'bri' ? logoBRILeft : logoDwimitra;
        const logoLeftResponse = await fetch(leftLogo);
        const logoLeftBlob = await logoLeftResponse.blob();
        const logoLeftArrayBuffer = await logoLeftBlob.arrayBuffer();
        const logoLeftBase64 = btoa(
          new Uint8Array(logoLeftArrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte), ''
          )
        );

        // Select right logo based on company type
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
          tl: { col: 0.1, row: 0.15 }, // ✅ Better positioning
          ext: { width: 130, height: 50 } // ✅ LARGER size for better visibility
        });

        // ✅ Logo NeutraDC - LARGER size, positioned with proper spacing
        worksheet.addImage(neutraDCImageId, {
          tl: { col: 4.4, row: 0.15 }, // ✅ Better positioning
          ext: { width: 130, height: 50 } // ✅ LARGER size for better visibility
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
      let finalPhotosData = docData.photosData || [];

      // ✅ Support subcollection pattern: fetch photos if photosData is empty
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

      // Margins
      const marginTop = 15;
      const marginLeft = 10;
      const marginRight = 10;
      const usableWidth = pageWidth - marginLeft - marginRight;

      let currentY = marginTop;

      // Load logos
      try {
        // ✅ NEW: Load logos with canvas to ensure compression and JPEG format (matching ReportForm)
        const processLogo = (url: string) => {
          return new Promise<string>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width; canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
              }
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => resolve('');
            img.src = url;
          });
        };

        const processedLogoLeft = await processLogo(companyType === 'bri' ? logoBRILeft : logoDwimitra);
        const processedLogoRight = await processLogo(companyType === 'bri' ? logoBRI : logoNeutraDC);

        // ✅ Helper function to add page header (logos + title + info)
        const addPageHeader = () => {
          const isPDU = user?.email === 'pdu@gmail.com' || docData.createdBy === 'pdu@gmail.com';
          const isDwimitra = companyType !== 'bri';

          let headerY = 8; // Matching ReportForm.tsx anchor

          // Normal sizing matches ReportForm
          const leftW = isPDU ? 22 : (isDwimitra ? 28 : 36);
          const leftH = isPDU ? 9 : (isDwimitra ? 18 : 14);
          const rightW = isPDU ? 22 : (isDwimitra ? 36 : 35);
          const rightH = isPDU ? 9 : (isDwimitra ? 14 : 14);

          // Logo Left
          if (processedLogoLeft) {
            doc.addImage(processedLogoLeft, 'JPEG', marginLeft, headerY, leftW, leftH, 'logo_left', 'FAST');
          }

          // Logo Right (Vertically centered relative to left logo height)
          if (processedLogoRight) {
            const rightY = headerY + (leftH - rightH) / 2;
            doc.addImage(processedLogoRight, 'JPEG', pageWidth - marginRight - rightW, rightY, rightW, rightH, 'logo_right', 'FAST');
          }

          headerY += Math.max(leftH, rightH) + (isPDU ? 4 : 5);

          // Title
          doc.setFontSize(isPDU ? 10 : 14);
          doc.setFont('helvetica', 'bold');
          const titleText = `Dokumentasi PM ${docData.maintenanceName} (${formattedDate})`;
          const titleWidth = doc.getTextWidth(titleText);
          doc.text(titleText, (pageWidth - titleWidth) / 2, headerY);

          headerY += (isPDU ? 6 : 8);

          // Specific Detail / Equipment Name
          if (docData.specificDetail) {
            doc.setFontSize(isPDU ? 9 : 12);
            doc.setFont('helvetica', 'bold');
            const equipmentText = docData.specificDetail;
            const equipmentWidth = doc.getTextWidth(equipmentText);
            doc.text(equipmentText, (pageWidth - equipmentWidth) / 2, headerY);
            headerY += (isPDU ? 8 : 10);
          } else {
            headerY += (isPDU ? 3 : 5);
          }

          return headerY; // Return Y position after header
        };

        // ✅ Add header for first page
        currentY = addPageHeader();

        // Add photos in grid
        const isPDU = user?.email === 'pdu@gmail.com' || docData.createdBy === 'pdu@gmail.com';
        const columns = isPDU ? 4 : 3;
        const photosPerPage = isPDU ? 20 : 9;
        const spacing = isPDU ? 3 : 4;

        const photoWidth = (usableWidth - (columns - 1) * spacing) / columns;
        const photoHeight = isPDU ? 38 : 55;
        const captionHeight = isPDU ? 10 : 12;

        let finalPhotosData = docData.photosData || [];

        // ✅ Support subcollection pattern
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

        const photosData = finalPhotosData;
        let photoCount = 0;

        for (let i = 0; i < photosData.length; i += columns) {
          // ✅ Check if we need a new page
          if (photoCount > 0 && photoCount % photosPerPage === 0) {
            doc.addPage();
            currentY = addPageHeader(); // ✅ Repeat header on new pages!
          }

          const rowCards = photosData.slice(i, i + columns);

          for (let j = 0; j < rowCards.length; j++) {
            const card = rowCards[j];
            const xPos = marginLeft + j * (photoWidth + spacing);

            // Draw photo border/box
            doc.setDrawColor(0);
            doc.setLineWidth(0.3); // Thinner line for PDU
            doc.rect(xPos, currentY, photoWidth, photoHeight);

            // Add photo if exists
            if (card.photoBase64) {
              try {
                let b64 = card.photoBase64;
                const sizeKB = (b64.length * 3) / 4 / 1024;

                // Extra safety: compress on the fly if still huge
                if (sizeKB > 800) {
                  try {
                    b64 = await compressBase64Image(b64, { maxWidth: 800, quality: 0.5 });
                  } catch (e) {
                    console.error("Archive export compression failed", e);
                  }
                }

                doc.addImage(
                  b64,
                  'JPEG',
                  xPos + 0.5,
                  currentY + 0.5,
                  photoWidth - 1,
                  photoHeight - 1,
                  `p_${photoCount}`,
                  'FAST'
                );
              } catch (imgError) {
                console.error('Failed to add image:', imgError);
              }
            }

            // Add caption box
            doc.rect(xPos, currentY + photoHeight, photoWidth, captionHeight);

            // Add caption text
            if (card.description) {
              doc.setFontSize(isPDU ? 7 : 8);
              doc.setFont('helvetica', 'normal');
              const lines = doc.splitTextToSize(card.description, photoWidth - 4);
              const textY = currentY + photoHeight + 5;
              doc.text(lines, xPos + photoWidth / 2, textY, { align: 'center', maxWidth: photoWidth - 4 });
            }

            photoCount++;
          }

          currentY += photoHeight + captionHeight + (isPDU ? 3 : 5);
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
      toast.loading('Loading HSE report data...', { id: 'download-hse' });
      const hseDoc = await getDoc(doc(db, 'hse', docData.id));

      if (!hseDoc.exists()) {
        throw new Error('HSE document not found');
      }

      const hseData = hseDoc.data();

      // Fetch photos from subcollection
      const photosSnap = await getDocs(collection(db, `hse/${docData.id}/photos`));
      const photos = photosSnap.docs
        .map(d => {
          const data = d.data();
          return {
            base64: data.dataUrl,
            description: data.description || ''
          };
        });

      // Map to HSEFormData structure
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
        reportType: hseData.reportType
      };

      await generateHSEPdf(formData);
      toast.success('HSE PDF downloaded!', { id: 'download-hse' });
    } catch (error) {
      console.error('Download HSE error:', error);
      toast.error('Failed to download HSE PDF', { id: 'download-hse' });
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

  const handleEditClick = async (doc: ExcelDocument) => {
    if (!onEdit) return;

    try {
      toast.loading('Preparing data for editing...', { id: 'edit-prep' });

      // Fetch photos from subcollection for backward compatibility or completeness
      let photosData = doc.photosData || [];
      if (photosData.length === 0) {
        const colName = doc.documentType === 'excel' ? 'excel_documents' : 'pdf_documents';
        const photosSnap = await getDocs(
          collection(db, `${colName}/${doc.id}/photos`)
        );
        if (!photosSnap.empty) {
          photosData = photosSnap.docs
            .map(d => d.data() as any)
            .sort((a, b) => a.index - b.index);
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
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${document.documentType === 'pdf'
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
                      {document.specificDetail && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 text-blue-400" />
                          <span className="truncate text-blue-300 font-medium">{document.specificDetail}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 hidden sm:block">
                      Dibuat: {document.createdAt.toLocaleString('id-ID')}
                    </p>
                  </div>

                  {/* Actions */}
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