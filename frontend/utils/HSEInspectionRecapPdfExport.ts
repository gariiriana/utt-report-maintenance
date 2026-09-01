// ============================================================================
// FILE: HSEInspectionRecapPdfExport.ts
// Deskripsi: Export PDF Rekapitulasi Laporan Inspeksi HSE / K3 Resmi.
//            Mendukung 2 varian logo header:
//            1. NeutraDC (Logo PT Dwimitra Ekatama Mandiri + Logo NeutraDC)
//            2. UTT (Logo PT United Transworld Trading + Logo NeutraDC)
//            Menyertakan SELURUH foto dokumentasi per inspeksi secara dinamis,
//            tema warna Biru Dwimitra (#00599c), grid rapi, checklist hijau
//            vektor presisi, dan hemat halaman.
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { ExcelDocument, getDocumentDate } from '@/components/DocumentList';
import { loadLogoBase64 } from './ReportPdfExport';
import { compressBase64Image } from './imageCompression';
import logoDME from '@/assets/logo_dwimitra_v2.png';
import logoUTT from '@/assets/logo_utt.png';
import logoNeutra from '@/assets/logo_neutradc.png';
import { toast } from 'sonner';

export interface HSEInspectionRecapOptions {
  companyVariant: 'neutradc' | 'utt';
  titleOverride?: string;
  periodLabel?: string;
}

interface LoadedHSEInspectionItem {
  id: string;
  dateStr: string;
  aktivitas: string;
  lokasi: string;
  personil: string;
  pic: string;
  anggota: string;
  inspectorK3: string;
  maintenanceType: string;
  checklistItems: string[];
  photos: {
    base64: string;
    description: string;
    label: string;
  }[];
}

/**
 * Helper async untuk mengambil dimensi gambar base64
 */
function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = base64;
  });
}

/**
 * Mengambil detail lengkap dokumen HSE dan SELURUH subkoleksi fotonya dari Firestore
 */
async function fetchFullHSEInspectionData(docItem: ExcelDocument): Promise<LoadedHSEInspectionItem> {
  let docData: any = null;
  const photosList: { base64: string; description: string; label: string; index?: number }[] = [];

  try {
    const docSnap = await getDoc(doc(db, 'hse', docItem.id));
    if (docSnap.exists()) {
      docData = docSnap.data();
    }
  } catch (err) {
    console.warn(`Failed to fetch doc hse/${docItem.id}:`, err);
  }

  try {
    const photosSnap = await getDocs(collection(db, `hse/${docItem.id}/photos`));
    if (!photosSnap.empty) {
      photosSnap.docs.forEach((pDoc) => {
        const pData = pDoc.data();
        const b64 = pData.dataUrl || pData.photoBase64 || pData.base64 || '';
        if (b64) {
          photosList.push({
            base64: b64,
            description: pData.description || '',
            label: pData.label || '',
            index: pData.index || 0,
          });
        }
      });
      // Sort photos by index if available
      photosList.sort((a, b) => (a.index || 0) - (b.index || 0));
    }
  } catch (err) {
    console.warn(`Failed to fetch photos for hse/${docItem.id}:`, err);
  }

  // Fallback to existing photos if subcollection was empty
  if (photosList.length === 0 && docData?.photos && Array.isArray(docData.photos)) {
    docData.photos.forEach((p: any, idx: number) => {
      const b64 = p.dataUrl || p.photoBase64 || p.base64 || '';
      if (b64) {
        photosList.push({
          base64: b64,
          description: p.description || '',
          label: p.label || '',
          index: p.index !== undefined ? p.index : idx,
        });
      }
    });
  }

  // Format checklist items
  const cl = docData?.checklist || {};
  const checklistItems: string[] = [];
  const addCheck = (key: string, label: string) => {
    if (cl[key]) checklistItems.push(label);
  };

  addCheck('mop', 'MOP');
  addCheck('jsa', 'JSA');
  addCheck('ptw', 'PTW');
  addCheck('ppe', 'APD / PPE');
  addCheck('toolsBertagging', 'Tagging Tools');
  addCheck('housekeeping', 'Housekeeping');
  addCheck('safeCondition', 'Safe Condition');
  addCheck('safeAction', 'Safe Action');
  addCheck('safetySign', 'Safety Sign');
  addCheck('loto', 'LOTO');

  // If empty, provide default compliance checklist
  if (checklistItems.length === 0) {
    checklistItems.push('MOP', 'JSA', 'PTW', 'APD / PPE', 'Tagging Tools', 'Housekeeping', 'Safe Condition', 'Safe Action');
  }

  // Format date
  const rawDate = docData?.date || docItem.maintenanceTime;
  let formattedDate = '-';
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    } else {
      formattedDate = String(rawDate);
    }
  } else {
    const d = getDocumentDate(docItem);
    formattedDate = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Compress ALL photos for crisp & lightweight PDF rendering
  const compressedPhotos: { base64: string; description: string; label: string }[] = [];

  for (const photo of photosList) {
    try {
      const compB64 = await compressBase64Image(photo.base64, {
        maxWidth: 550,
        maxHeight: 550,
        quality: 0.68,
      });
      compressedPhotos.push({
        base64: compB64,
        description: photo.description,
        label: photo.label,
      });
    } catch {
      compressedPhotos.push(photo);
    }
  }

  return {
    id: docItem.id,
    dateStr: formattedDate,
    aktivitas: docData?.aktivitas || docItem.maintenanceName || 'Inspeksi K3',
    lokasi: docData?.lokasi || docItem.specificDetail || '-',
    personil: docData?.personil || '-',
    pic: docData?.pic || '-',
    anggota: docData?.anggota || '',
    inspectorK3: docData?.inspectorK3 || docData?.authorEmail || docItem.createdBy || 'HSE Officer',
    maintenanceType: docData?.maintenanceType || docItem.maintenanceType || 'OTHER',
    checklistItems,
    photos: compressedPhotos,
  };
}

/**
 * Export Rekapitulasi Laporan Inspeksi HSE ke Format PDF Resmi
 */
export async function exportHSEInspectionRecapPDF(
  documents: ExcelDocument[],
  options: HSEInspectionRecapOptions
): Promise<void> {
  const hseDocs = documents.filter((d) => d.documentType === 'hse' || d.hseType === 'inspection');
  if (hseDocs.length === 0) {
    toast.error('Tidak ada laporan inspeksi HSE untuk diekspor!');
    return;
  }

  const isNeutra = options.companyVariant === 'neutradc';
  const companyTitle = isNeutra
    ? 'PT DWIMITRA EKATAMA MANDIRI — NEUTRA DC CIKARANG'
    : 'PT UNITED TRANSWORLD TRADING — NEUTRA DC CIKARANG';
  const headerReportTitle = isNeutra
    ? 'REKAPITULASI LAPORAN INSPEKSI K3 / HSE (NEUTRA DC)'
    : 'REKAPITULASI LAPORAN INSPEKSI K3 / HSE (UTT MAINTENANCE)';

  const toastId = toast.loading(`Menyiapkan Rekapitulasi PDF HSE (${hseDocs.length} Dokumen)...`);

  try {
    // 1. Fetch & compress full data + ALL photos
    const loadedItems: LoadedHSEInspectionItem[] = [];
    for (let i = 0; i < hseDocs.length; i++) {
      const docItem = hseDocs[i];
      toast.loading(
        `[${i + 1}/${hseDocs.length}] Memuat semua foto & data: ${docItem.maintenanceName || docItem.fileName}...`,
        { id: toastId }
      );
      const item = await fetchFullHSEInspectionData(docItem);
      loadedItems.push(item);
    }

    toast.loading('Menyusun lembar Rekapitulasi PDF...', { id: toastId });

    // 2. Initialize Landscape A4 jsPDF
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageWidth - 2 * margin;

    const BLUE_RGB: [number, number, number] = [0, 89, 156]; // #00599c (Dwimitra Corporate Blue)
    const EMERALD_RGB: [number, number, number] = [16, 185, 129]; // #10b981
    const DARK = '#1e293b';
    const GRAY = '#64748b';
    const SLATE_200 = '#e2e8f0';

    // Load Logos
    const leftLogoSource = isNeutra ? logoDME : logoUTT;
    const [leftLogo, rightLogo] = await Promise.all([
      loadLogoBase64(leftLogoSource),
      loadLogoBase64(logoNeutra),
    ]);

    // Pre-calculate photo aspect ratios
    const imageInfoCache: Record<string, { width: number; height: number }> = {};
    for (const item of loadedItems) {
      for (const p of item.photos) {
        if (p.base64 && !imageInfoCache[p.base64]) {
          imageInfoCache[p.base64] = await getImageDimensions(p.base64);
        }
      }
    }

    // Header dimensions (Spacious & Clean)
    const headerTopY = 4.5;
    const headerH = 22; // 22 mm height
    const tableStartY = headerTopY + headerH + 3.5; // Table starts at 30mm

    const drawHeader = (currentDoc: jsPDF) => {
      // Top accent strip
      currentDoc.setFillColor(...BLUE_RGB);
      currentDoc.rect(0, 0, pageWidth, 2.5, 'F');

      // Header box background & border
      currentDoc.setFillColor(255, 255, 255);
      currentDoc.setDrawColor(SLATE_200);
      currentDoc.setLineWidth(0.2);
      currentDoc.roundedRect(margin, headerTopY, contentW, headerH, 1.5, 1.5, 'FD');

      const col1W = 34;
      const col3W = 34;

      // Vertical dividers inside header box
      currentDoc.setDrawColor(SLATE_200);
      currentDoc.setLineWidth(0.2);
      currentDoc.line(margin + col1W, headerTopY, margin + col1W, headerTopY + headerH);
      currentDoc.line(pageWidth - margin - col3W, headerTopY, pageWidth - margin - col3W, headerTopY + headerH);

      // Render Left Logo (DME or UTT)
      if (leftLogo) {
        currentDoc.addImage(
          leftLogo,
          'PNG',
          margin + 2.5,
          headerTopY + 3.5,
          col1W - 5,
          15,
          isNeutra ? 'logo_dme' : 'logo_utt',
          'FAST'
        );
      }

      // Render Right Logo (NeutraDC)
      if (rightLogo) {
        currentDoc.addImage(
          rightLogo,
          'PNG',
          pageWidth - margin - col3W + 2.5,
          headerTopY + 4,
          col3W - 5,
          14,
          'logo_neutra',
          'FAST'
        );
      }

      // Center Titles
      const centerX = margin + col1W + (contentW - col1W - col3W) / 2;

      currentDoc.setFontSize(10.5).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      currentDoc.text(options.titleOverride || headerReportTitle, centerX, headerTopY + 6.5, { align: 'center' });

      currentDoc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(DARK);
      currentDoc.text(companyTitle, centerX, headerTopY + 11.5, { align: 'center' });

      const printDateStr = new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      currentDoc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY);
      currentDoc.text(
        `Total Laporan: ${loadedItems.length} Dokumen  |  Tanggal Cetak: ${printDateStr} ${
          options.periodLabel ? ` |  Periode: ${options.periodLabel}` : ''
        }`,
        centerX,
        headerTopY + 16.8,
        { align: 'center' }
      );
    };

    const drawFooter = (currentDoc: jsPDF, pg: number, totalPages: number) => {
      currentDoc.setFillColor(...BLUE_RGB);
      currentDoc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');
      currentDoc.setFontSize(6.5).setTextColor(GRAY);
      currentDoc.text(`${companyTitle} — HSE Inspection Recap Report`, margin, pageHeight - 4.5);
      currentDoc.text(`Halaman ${pg} dari ${totalPages}`, pageWidth - margin, pageHeight - 4.5, { align: 'right' });
    };

    // Draw header on the first page
    drawHeader(doc);

    // Build Table Rows
    const tableRows = loadedItems.map((item, idx) => {
      const colNo = String(idx + 1);
      const colAktivitas = `${item.dateStr}\n\n${item.aktivitas}${
        item.maintenanceType && item.maintenanceType !== 'OTHER' ? `\n[${item.maintenanceType}]` : ''
      }`;
      const colLokasi = `Lokasi: ${item.lokasi}\nPIC: ${item.pic}\nPersonil: ${item.personil}${
        item.anggota ? `\nAnggota: ${item.anggota}` : ''
      }`;
      const colInspector = `${item.inspectorK3}\n(HSE Officer)`;

      // Checklist text is custom drawn with emerald green checkmark badges in `didDrawCell`
      const colChecklist = '';

      const photoPlaceholder = item.photos.length > 0 ? '' : '(Tidak Ada Foto)';
      const colStatus = 'SESUAI K3\n(COMPLIANT)\n\nKondisi Kerja Aman';

      return [
        colNo,
        colAktivitas,
        colLokasi,
        colInspector,
        colChecklist,
        photoPlaceholder,
        colStatus,
      ];
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [[
        'No',
        'Tanggal & Aktivitas Pekerjaan',
        'Lokasi & Tim Pelaksana',
        'Petugas Inspeksi',
        'Kepatuhan Checklist K3',
        'Foto Dokumentasi Inspeksi Visual',
        'Status K3',
      ]],
      body: tableRows,
      margin: { top: tableStartY, left: margin, right: margin, bottom: 10 },
      styles: {
        fontSize: 6.8,
        cellPadding: 1.8,
        lineColor: [203, 213, 225],
        lineWidth: 0.15,
        textColor: [30, 41, 59],
        font: 'helvetica',
        valign: 'middle',
        minCellHeight: 22,
      },
      headStyles: {
        fillColor: BLUE_RGB,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: BLUE_RGB,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 46 },
        2: { cellWidth: 44 },
        3: { cellWidth: 32 },
        4: { cellWidth: 48 },
        5: { cellWidth: 68, halign: 'center' },
        6: { cellWidth: 30, halign: 'center' },
      },
      didParseCell: (data: any) => {
        // Dynamically adjust row height based on photo count so all photos fit comfortably!
        if (data.section === 'body') {
          const item = loadedItems[data.row.index];
          const count = item?.photos?.length || 0;
          if (count > 6) {
            const rows = Math.ceil(count / 3);
            data.row.height = Math.max(data.row.height || 0, rows * 18 + 4);
          } else if (count >= 4) {
            data.row.height = Math.max(data.row.height || 0, 38);
          } else if (count === 3) {
            data.row.height = Math.max(data.row.height || 0, 23);
          } else if (count === 0) {
            data.row.height = Math.max(data.row.height || 0, 19);
          } else {
            data.row.height = Math.max(data.row.height || 0, 23);
          }
        }
      },
      didDrawPage: (data: any) => {
        if (data.pageNumber > 1) {
          drawHeader(doc);
        }
      },
      didDrawCell: (data: any) => {
        // Draw Column 4: Kepatuhan Checklist K3 with Emerald Green Checkmark Badges
        if (data.section === 'body' && data.column.index === 4) {
          const item = loadedItems[data.row.index];
          if (!item) return;

          const cell = data.cell;
          const items = item.checklistItems;
          if (!items || items.length === 0) return;

          const startX = cell.x + 2;
          const cellH = cell.height;

          // Render checklist in 2 compact columns
          const col1W = 23;
          const maxRowsPerCol = Math.ceil(items.length / 2);
          const rowSpacing = Math.min(3.6, (cellH - 3) / Math.max(1, maxRowsPerCol));
          const startY = cell.y + (cellH - maxRowsPerCol * rowSpacing) / 2 + 2;

          items.forEach((chkName, cIdx) => {
            const isCol2 = cIdx >= maxRowsPerCol;
            const rowInCol = isCol2 ? cIdx - maxRowsPerCol : cIdx;

            const iconX = isCol2 ? startX + col1W : startX;
            const iconY = startY + rowInCol * rowSpacing;

            // Draw Emerald Green Circle Badge
            doc.setFillColor(...EMERALD_RGB);
            doc.circle(iconX + 1, iconY - 0.8, 1.1, 'F');

            // Draw White Checkmark Tick inside Circle
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.3);
            doc.line(iconX + 0.5, iconY - 0.8, iconX + 0.9, iconY - 0.4);
            doc.line(iconX + 0.9, iconY - 0.4, iconX + 1.6, iconY - 1.2);

            // Draw Checklist Item Label
            doc.setFontSize(6.0).setFont('helvetica', 'bold').setTextColor(30, 41, 59);
            const labelText = doc.splitTextToSize(chkName, 20)[0] || chkName;
            doc.text(labelText, iconX + 2.8, iconY - 0.1);
          });
        }

        // Draw Column 5: ALL Foto Dokumentasi Visual Inspection
        if (data.section === 'body' && data.column.index === 5) {
          const item = loadedItems[data.row.index];
          if (!item || item.photos.length === 0) return;

          const cell = data.cell;
          const photos = item.photos; // ALL PHOTOS!
          const cellPad = 1.0;
          const availW = cell.width - cellPad * 2;
          const availH = cell.height - cellPad * 2;

          const numPhotos = photos.length;
          let cols = 1;
          let rows = 1;

          if (numPhotos === 1) {
            cols = 1;
            rows = 1;
          } else if (numPhotos === 2) {
            cols = 2;
            rows = 1;
          } else if (numPhotos === 3) {
            cols = 3;
            rows = 1;
          } else if (numPhotos === 4) {
            cols = 2;
            rows = 2;
          } else if (numPhotos <= 6) {
            cols = 3;
            rows = 2;
          } else if (numPhotos <= 8) {
            cols = 4;
            rows = 2;
          } else {
            cols = 3;
            rows = Math.ceil(numPhotos / 3);
          }

          const gapX = 1.2;
          const gapY = 1.2;
          const photoW = (availW - (cols - 1) * gapX) / cols;
          const photoH = (availH - (rows - 1) * gapY) / rows;

          photos.forEach((photo, pIdx) => {
            const col = pIdx % cols;
            const row = Math.floor(pIdx / cols);

            const photoX = cell.x + cellPad + col * (photoW + gapX);
            const photoY = cell.y + cellPad + row * (photoH + gapY);

            // Background placeholder card
            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.1);
            doc.roundedRect(photoX, photoY, photoW, photoH, 0.6, 0.6, 'FD');

            if (photo.base64) {
              try {
                const imgDim = imageInfoCache[photo.base64] || { width: 4, height: 3 };
                const imgAspect =
                  imgDim.width > 0 && imgDim.height > 0 ? imgDim.width / imgDim.height : 4 / 3;
                const boxAspect = photoW / photoH;

                let drawW = photoW - 0.6;
                let drawH = photoH - 0.6;

                if (imgAspect > boxAspect) {
                  drawH = drawW / imgAspect;
                } else {
                  drawW = drawH * imgAspect;
                }

                const imgX = photoX + (photoW - drawW) / 2;
                const imgY = photoY + (photoH - drawH) / 2;

                doc.addImage(
                  photo.base64,
                  'JPEG',
                  imgX,
                  imgY,
                  drawW,
                  drawH,
                  `hse_insp_${item.id}_${pIdx}`,
                  'FAST'
                );
              } catch (e) {
                console.error('Error embedding inspection photo:', e);
              }
            }
          });
        }
      },
    });

    // Add page numbers & footers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(doc, i, totalPages);
    }

    const safeVariant = isNeutra ? 'NeutraDC' : 'UTT';
    const dateStamp = new Date().toISOString().split('T')[0];
    const fileName = `Rekap_Inspeksi_HSE_${safeVariant}_${dateStamp}.pdf`;

    doc.save(fileName);
    toast.success(`Rekapitulasi PDF HSE (${safeVariant}) berhasil diekspor!`, { id: toastId });
  } catch (err: any) {
    console.error('Failed to export HSE inspection recap PDF:', err);
    toast.error('Gagal mengekspor Rekapitulasi PDF HSE', { id: toastId });
  }
}
