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
        maxWidth: 650,
        maxHeight: 650,
        quality: 0.72,
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
 * Format: 1 Tanggal per Halaman (Bebas foto kecil, rapi, terstruktur dan berestetika tinggi)
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
        `[${i + 1}/${hseDocs.length}] Memuat semua data & foto: ${docItem.maintenanceName || docItem.fileName}...`,
        { id: toastId }
      );
      const item = await fetchFullHSEInspectionData(docItem);
      loadedItems.push(item);
    }

    toast.loading('Menyusun lembar Rekapitulasi PDF...', { id: toastId });

    // 2. Initialize Landscape A4 jsPDF
    const pdfDoc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const pageHeight = pdfDoc.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageWidth - 2 * margin; // 277 mm

    const BLUE_RGB: [number, number, number] = [0, 89, 156]; // #00599c
    const EMERALD_RGB: [number, number, number] = [16, 185, 129]; // #10b981
    const DARK_RGB: [number, number, number] = [30, 41, 59];
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

    // Header dimensions
    const headerTopY = 4.5;
    const headerH = 21;

    // ======================== Helper: Draw Header ========================
    const drawHeader = (d: jsPDF) => {
      // Top accent strip
      d.setFillColor(...BLUE_RGB);
      d.rect(0, 0, pageWidth, 2.5, 'F');

      // Header box
      d.setFillColor(255, 255, 255);
      d.setDrawColor(SLATE_200);
      d.setLineWidth(0.2);
      d.roundedRect(margin, headerTopY, contentW, headerH, 1.5, 1.5, 'FD');

      const col1W = 34;
      const col3W = 34;
      d.setDrawColor(SLATE_200);
      d.setLineWidth(0.2);
      d.line(margin + col1W, headerTopY, margin + col1W, headerTopY + headerH);
      d.line(pageWidth - margin - col3W, headerTopY, pageWidth - margin - col3W, headerTopY + headerH);

      // Left Logo
      if (leftLogo) {
        d.addImage(leftLogo, 'PNG', margin + 2.5, headerTopY + 3.2, col1W - 5, 14.5, isNeutra ? 'logo_dme' : 'logo_utt', 'FAST');
      }
      // Right Logo
      if (rightLogo) {
        d.addImage(rightLogo, 'PNG', pageWidth - margin - col3W + 2.5, headerTopY + 3.5, col3W - 5, 13.8, 'logo_neutra', 'FAST');
      }

      // Title & Meta
      const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
      d.setFontSize(10.5).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      d.text(options.titleOverride || headerReportTitle, centerX, headerTopY + 6.2, { align: 'center' });

      d.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...DARK_RGB);
      d.text(companyTitle, centerX, headerTopY + 11.0, { align: 'center' });

      const printDateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      d.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY);
      d.text(
        `Total Laporan: ${loadedItems.length} Dokumen  |  Tanggal Cetak: ${printDateStr}${options.periodLabel ? `  |  Periode: ${options.periodLabel}` : ''}`,
        centerX,
        headerTopY + 16.0,
        { align: 'center' }
      );
    };

    // ======================== Helper: Draw Footer ========================
    const drawFooter = (d: jsPDF, pg: number, total: number) => {
      d.setFillColor(...BLUE_RGB);
      d.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');
      d.setFontSize(6.5).setTextColor(GRAY);
      d.text(`${companyTitle} — HSE Inspection Recap Report`, margin, pageHeight - 4.5);
      d.text(`Halaman ${pg} dari ${total}`, pageWidth - margin, pageHeight - 4.5, { align: 'right' });
    };

    // ======================== Helper: Draw Photo Card ========================
    const drawPhotoCard = (
      d: jsPDF,
      photo: { base64: string; description: string; label: string },
      x: number,
      y: number,
      w: number,
      h: number,
      pIndex: number,
      totalPhotos: number,
      alias: string
    ) => {
      // Outer Card Box
      d.setFillColor(255, 255, 255);
      d.setDrawColor(203, 213, 225);
      d.setLineWidth(0.2);
      d.roundedRect(x, y, w, h, 1.2, 1.2, 'FD');

      // Card Header Strip
      const labelBarH = 5.2;
      d.setFillColor(241, 245, 249);
      d.roundedRect(x, y, w, labelBarH, 1.2, 1.2, 'F');
      d.rect(x, y + labelBarH - 1.2, w, 1.2, 'F'); // square bottom corners
      d.setDrawColor(226, 232, 240);
      d.line(x, y + labelBarH, x + w, y + labelBarH);

      // Photo Number & Title Tag
      d.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      const photoTag = `Foto #${pIndex + 1}${photo.label ? ` — ${photo.label}` : ''}`;
      d.text(photoTag, x + 2.5, y + 3.6);

      d.setFontSize(6.2).setFont('helvetica', 'normal').setTextColor(GRAY);
      d.text(`[${pIndex + 1}/${totalPhotos}]`, x + w - 2.5, y + 3.6, { align: 'right' });

      // Embed Image inside Card
      if (photo.base64) {
        try {
          const imgDim = imageInfoCache[photo.base64] || { width: 4, height: 3 };
          const imgAspect = imgDim.width > 0 && imgDim.height > 0 ? imgDim.width / imgDim.height : 4 / 3;

          const pad = 1.8;
          const boxW = w - pad * 2;
          const boxH = h - labelBarH - pad * 2;
          const boxAspect = boxW / boxH;

          let drawW = boxW;
          let drawH = boxH;

          if (imgAspect > boxAspect) {
            drawH = drawW / imgAspect;
          } else {
            drawW = drawH * imgAspect;
          }

          const imgX = x + pad + (boxW - drawW) / 2;
          const imgY = y + labelBarH + pad + (boxH - drawH) / 2;

          d.addImage(photo.base64, 'JPEG', imgX, imgY, drawW, drawH, alias, 'FAST');
        } catch (e) {
          console.error('Error embedding photo:', e);
        }
      }
    };

    // ======================== MAIN RENDER LOOP ========================
    const bottomMargin = 10;

    for (let itemIdx = 0; itemIdx < loadedItems.length; itemIdx++) {
      const item = loadedItems[itemIdx];

      // Add page for subsequent inspections
      if (itemIdx > 0) {
        pdfDoc.addPage();
      }

      // Draw Top Corporate Header
      drawHeader(pdfDoc);

      const tableStartY = headerTopY + headerH + 2.5;

      // 1. Structured Info Card Table (autoTable)
      const maintenanceTypeTag = item.maintenanceType && item.maintenanceType !== 'OTHER'
        ? ` [${item.maintenanceType}]`
        : '';
      const headerTitle = `DOKUMEN #${itemIdx + 1}  —  TANGGAL: ${item.dateStr.toUpperCase()}  |  AKTIVITAS: ${item.aktivitas.toUpperCase()}${maintenanceTypeTag}`;

      const timPelaksanaText = `PIC: ${item.pic}  |  Personil: ${item.personil}${item.anggota ? `\nAnggota: ${item.anggota}` : ''}`;

      autoTable(pdfDoc, {
        startY: tableStartY,
        theme: 'grid',
        head: [[
          {
            content: headerTitle,
            colSpan: 4,
            styles: {
              fillColor: BLUE_RGB,
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 7.8,
              halign: 'left',
              cellPadding: 2,
            },
          },
        ]],
        body: [
          [
            { content: 'Lokasi Pekerjaan', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 32 } },
            { content: item.lokasi, styles: { cellWidth: 106.5 } },
            { content: 'Petugas K3', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 32 } },
            { content: `${item.inspectorK3} (HSE Officer)`, styles: { cellWidth: 106.5 } },
          ],
          [
            { content: 'Tim Pelaksana', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            { content: timPelaksanaText },
            { content: 'Status K3', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
            {
              content: 'SESUAI STANDAR K3 (COMPLIANT)\nKondisi Kerja Aman & Tertib',
              styles: {
                fillColor: [240, 253, 244], // subtle emerald tint
                textColor: [21, 128, 61], // green-700
                fontStyle: 'bold',
              },
            },
          ],
          [
            { content: 'Checklist K3', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], valign: 'middle' } },
            { content: '', colSpan: 3, styles: { minCellHeight: 12.5 } },
          ],
        ],
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 7,
          cellPadding: 1.8,
          lineColor: [203, 213, 225],
          lineWidth: 0.18,
          textColor: [30, 41, 59],
          font: 'helvetica',
          valign: 'middle',
        },
        didDrawCell: (data: any) => {
          // Custom draw the Checklist K3 vector checkmarks in row 2, col 1 (spanning colSpan 3)
          if (data.section === 'body' && data.row.index === 2 && data.column.index === 1) {
            const cell = data.cell;
            const items = item.checklistItems;
            if (!items || items.length === 0) return;

            const numCols = 5;
            const colW = (cell.width - 4) / numCols;
            const rowH = 4.8;
            const numRows = Math.ceil(items.length / numCols);
            const totalH = numRows * rowH;
            const startY = cell.y + Math.max(1.8, (cell.height - totalH) / 2) + 2.4;

            items.forEach((chk, cIdx) => {
              const c = cIdx % numCols;
              const r = Math.floor(cIdx / numCols);
              const ix = cell.x + 2.5 + c * colW;
              const iy = startY + r * rowH;

              // Emerald green badge circle
              pdfDoc.setFillColor(...EMERALD_RGB);
              pdfDoc.circle(ix + 1.2, iy, 1.1, 'F');

              // White checkmark tick
              pdfDoc.setDrawColor(255, 255, 255);
              pdfDoc.setLineWidth(0.35);
              pdfDoc.line(ix + 0.65, iy, ix + 1.05, iy + 0.4);
              pdfDoc.line(ix + 1.05, iy + 0.4, ix + 1.8, iy - 0.45);

              // Label
              pdfDoc.setFontSize(6.8).setFont('helvetica', 'bold').setTextColor(...DARK_RGB);
              const truncatedLabel = pdfDoc.splitTextToSize(chk, colW - 4.5)[0] || chk;
              pdfDoc.text(truncatedLabel, ix + 3.2, iy + 0.75);
            });
          }
        },
      });

      const tableFinalY = (pdfDoc as any).lastAutoTable.finalY + 2.5;

      // 2. Photo Section Header Bar
      const photoSectionY = tableFinalY;
      pdfDoc.setFillColor(241, 245, 249);
      pdfDoc.setDrawColor(203, 213, 225);
      pdfDoc.setLineWidth(0.18);
      pdfDoc.roundedRect(margin, photoSectionY, contentW, 5.2, 1, 1, 'FD');

      pdfDoc.setFontSize(7.2).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      pdfDoc.text(
        `DOKUMENTASI FOTO INSPEKSI VISUAL (${item.photos.length} Foto Dilampirkan)`,
        margin + 3,
        photoSectionY + 3.6
      );

      const photosStartY = photoSectionY + 6.8;
      const totalPhotos = item.photos.length;

      if (totalPhotos === 0) {
        // Notice box if no photos
        pdfDoc.setFillColor(255, 255, 255);
        pdfDoc.setDrawColor(226, 232, 240);
        pdfDoc.roundedRect(margin, photosStartY, contentW, 20, 1, 1, 'FD');
        pdfDoc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(GRAY);
        pdfDoc.text('(Tidak ada foto dokumentasi inspeksi visual yang dilampirkan)', pageWidth / 2, photosStartY + 11, { align: 'center' });
        continue;
      }

      // Available vertical space for photos on Page 1
      const availHPage1 = (pageHeight - bottomMargin) - photosStartY; // ~130mm

      // Smart Grid Decision for Page 1:
      // - <= 2 photos: 2 cols x 1 row (Large height: ~115mm)
      // - 3-4 photos: 2 cols x 2 rows (Large height: ~60mm)
      // - 5-6 photos: 3 cols x 2 rows (Height: ~60mm)
      // - > 6 photos: 6 photos on Page 1 (3 cols x 2 rows), remaining on continuation pages!
      const maxPhotosPage1 = totalPhotos <= 4 ? totalPhotos : 6;
      const colsPage1 = totalPhotos <= 4 ? 2 : 3;
      const gapX = 3.5;
      const gapY = 3.5;

      const cardWPage1 = (contentW - (colsPage1 - 1) * gapX) / colsPage1;
      const rowsPage1 = Math.ceil(Math.min(totalPhotos, maxPhotosPage1) / colsPage1);
      const cardHPage1 = rowsPage1 === 1 ? Math.min(availHPage1 - 4, 115) : (availHPage1 - (rowsPage1 - 1) * gapY) / rowsPage1;

      // Render Page 1 Photos
      for (let pIdx = 0; pIdx < Math.min(totalPhotos, maxPhotosPage1); pIdx++) {
        const col = pIdx % colsPage1;
        const row = Math.floor(pIdx / colsPage1);
        const px = margin + col * (cardWPage1 + gapX);
        const py = photosStartY + row * (cardHPage1 + gapY);

        drawPhotoCard(
          pdfDoc,
          item.photos[pIdx],
          px,
          py,
          cardWPage1,
          cardHPage1,
          pIdx,
          totalPhotos,
          `hse_insp_${item.id}_${pIdx}`
        );
      }

      // Handle Continuation Pages if > 6 photos
      let remainingPhotos = totalPhotos - maxPhotosPage1;
      let photoOffset = maxPhotosPage1;

      while (remainingPhotos > 0) {
        pdfDoc.addPage();
        drawHeader(pdfDoc);

        const contHeaderY = headerTopY + headerH + 2.5;

        // Continuation Banner
        pdfDoc.setFillColor(241, 245, 249);
        pdfDoc.setDrawColor(203, 213, 225);
        pdfDoc.setLineWidth(0.18);
        pdfDoc.roundedRect(margin, contHeaderY, contentW, 6.5, 1, 1, 'FD');

        pdfDoc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
        pdfDoc.text(
          `DOKUMEN #${itemIdx + 1} (FOTO LANJUTAN)  —  TANGGAL: ${item.dateStr.toUpperCase()}  |  AKTIVITAS: ${item.aktivitas.toUpperCase()}`,
          margin + 3,
          contHeaderY + 4.4
        );

        const contPhotosStartY = contHeaderY + 8.5;
        const availHCont = (pageHeight - bottomMargin) - contPhotosStartY; // ~155mm

        const photosOnThisPage = Math.min(remainingPhotos, 6);
        const colsCont = photosOnThisPage <= 4 ? 2 : 3;
        const cardWCont = (contentW - (colsCont - 1) * gapX) / colsCont;
        const rowsCont = Math.ceil(photosOnThisPage / colsCont);
        const cardHCont = rowsCont === 1 ? Math.min(availHCont - 4, 120) : (availHCont - (rowsCont - 1) * gapY) / rowsCont;

        for (let cpIdx = 0; cpIdx < photosOnThisPage; cpIdx++) {
          const globalPIdx = photoOffset + cpIdx;
          const col = cpIdx % colsCont;
          const row = Math.floor(cpIdx / colsCont);
          const px = margin + col * (cardWCont + gapX);
          const py = contPhotosStartY + row * (cardHCont + gapY);

          drawPhotoCard(
            pdfDoc,
            item.photos[globalPIdx],
            px,
            py,
            cardWCont,
            cardHCont,
            globalPIdx,
            totalPhotos,
            `hse_insp_${item.id}_${globalPIdx}`
          );
        }

        photoOffset += photosOnThisPage;
        remainingPhotos -= photosOnThisPage;
      }
    }

    // Add page numbers & footers to all pages
    const totalPages = pdfDoc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdfDoc.setPage(i);
      drawFooter(pdfDoc, i, totalPages);
    }

    const safeVariant = isNeutra ? 'NeutraDC' : 'UTT';
    const dateStamp = new Date().toISOString().split('T')[0];
    const fileName = `Rekap_Inspeksi_HSE_${safeVariant}_${dateStamp}.pdf`;

    pdfDoc.save(fileName);
    toast.success(`Rekapitulasi PDF HSE (${safeVariant}) berhasil diekspor!`, { id: toastId });
  } catch (err: any) {
    console.error('Failed to export HSE inspection recap PDF:', err);
    toast.error('Gagal mengekspor Rekapitulasi PDF HSE', { id: toastId });
  }
}

