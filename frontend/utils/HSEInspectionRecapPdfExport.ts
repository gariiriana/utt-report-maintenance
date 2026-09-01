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
 * Layout: 1 halaman per 1 tanggal inspeksi.
 * Info inspeksi di bagian atas, foto-foto besar grid 2 kolom di bawahnya.
 * Jika foto overflow, lanjut ke halaman baru (masih bagian inspeksi yang sama).
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
    const pdfDoc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const pageHeight = pdfDoc.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageWidth - 2 * margin;

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
    const headerH = 22;

    // ======================== Helper: Draw Header ========================
    const drawHeader = (d: jsPDF) => {
      d.setFillColor(...BLUE_RGB);
      d.rect(0, 0, pageWidth, 2.5, 'F');

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

      if (leftLogo) {
        d.addImage(leftLogo, 'PNG', margin + 2.5, headerTopY + 3.5, col1W - 5, 15, isNeutra ? 'logo_dme' : 'logo_utt', 'FAST');
      }
      if (rightLogo) {
        d.addImage(rightLogo, 'PNG', pageWidth - margin - col3W + 2.5, headerTopY + 4, col3W - 5, 14, 'logo_neutra', 'FAST');
      }

      const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
      d.setFontSize(10.5).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      d.text(options.titleOverride || headerReportTitle, centerX, headerTopY + 6.5, { align: 'center' });
      d.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...DARK_RGB);
      d.text(companyTitle, centerX, headerTopY + 11.5, { align: 'center' });
      const printDateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      d.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY);
      d.text(
        `Total Laporan: ${loadedItems.length} Dokumen  |  Tanggal Cetak: ${printDateStr}${options.periodLabel ? `  |  Periode: ${options.periodLabel}` : ''}`,
        centerX,
        headerTopY + 16.8,
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

    // ======================== Helper: Draw Info Card ========================
    // Draws the inspection details card at the top of each inspection's first page.
    // Returns the Y position after the card.
    const drawInfoCard = (d: jsPDF, item: LoadedHSEInspectionItem, itemIndex: number, startY: number): number => {
      const cardY = startY;
      const cardX = margin;
      const cardW = contentW;

      // Calculate card height based on checklist rows
      const checkCount = item.checklistItems.length;
      const checkRows = Math.ceil(checkCount / 5);
      const cardH = Math.max(36, 20 + checkRows * 5.5);

      // Card background
      d.setFillColor(248, 250, 252);
      d.setDrawColor(203, 213, 225);
      d.setLineWidth(0.2);
      d.roundedRect(cardX, cardY, cardW, cardH, 1.5, 1.5, 'FD');

      // Blue left accent bar
      d.setFillColor(...BLUE_RGB);
      d.roundedRect(cardX, cardY, 3, cardH, 1.5, 0, 'F');
      d.rect(cardX + 1.5, cardY, 1.5, cardH, 'F');

      // === LEFT SECTION: Info text ===
      const infoX = cardX + 7;
      let infoY = cardY + 5.5;

      // Number badge
      d.setFillColor(...BLUE_RGB);
      d.circle(infoX - 1.5, infoY - 0.5, 3.5, 'F');
      d.setFontSize(8).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
      d.text(String(itemIndex + 1), infoX - 1.5, infoY + 0.8, { align: 'center' });

      // Date & Aktivitas
      d.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      d.text(`${item.dateStr}  —  ${item.aktivitas}`, infoX + 5, infoY + 0.5);
      infoY += 6;

      // Info details in 3 columns
      const detailFontSize = 7;
      d.setFontSize(detailFontSize).setFont('helvetica', 'normal').setTextColor(...DARK_RGB);

      const col1X = infoX + 1;
      const col2X = infoX + 75;
      const col3X = infoX + 150;

      // Column 1: Lokasi, PIC
      d.setFont('helvetica', 'bold');
      d.text('Lokasi:', col1X, infoY);
      d.setFont('helvetica', 'normal');
      d.text(item.lokasi, col1X + 17, infoY);

      d.setFont('helvetica', 'bold');
      d.text('PIC:', col1X, infoY + 4.5);
      d.setFont('helvetica', 'normal');
      d.text(item.pic, col1X + 17, infoY + 4.5);

      // Column 2: Personil, Anggota
      d.setFont('helvetica', 'bold');
      d.text('Personil:', col2X, infoY);
      d.setFont('helvetica', 'normal');
      const personilLines = d.splitTextToSize(item.personil, 60);
      d.text(personilLines, col2X + 17, infoY);

      if (item.anggota) {
        d.setFont('helvetica', 'bold');
        d.text('Anggota:', col2X, infoY + 4.5);
        d.setFont('helvetica', 'normal');
        const anggotaLines = d.splitTextToSize(item.anggota, 60);
        d.text(anggotaLines, col2X + 17, infoY + 4.5);
      }

      // Column 3: Inspector, Status
      d.setFont('helvetica', 'bold');
      d.text('Inspektur K3:', col3X, infoY);
      d.setFont('helvetica', 'normal');
      d.text(item.inspectorK3, col3X + 25, infoY);

      // Status badge
      d.setFillColor(220, 252, 231); // green-100
      d.setDrawColor(34, 197, 94);
      d.setLineWidth(0.15);
      d.roundedRect(col3X, infoY + 3, 35, 6, 1, 1, 'FD');
      d.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(22, 163, 74);
      d.text('✓ SESUAI K3 (COMPLIANT)', col3X + 17.5, infoY + 7, { align: 'center' });

      // === Checklist Section (bottom of card) ===
      const checklistY = infoY + 13;
      d.setFontSize(7).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      d.text('Kepatuhan Checklist K3:', col1X, checklistY);

      const checkStartX = col1X;
      const checkStartY = checklistY + 4;
      const checkColW = 46;
      const checkCols = 5;
      const checkRowH = 5;

      item.checklistItems.forEach((chkName, cIdx) => {
        const colIdx = cIdx % checkCols;
        const rowIdx = Math.floor(cIdx / checkCols);
        const cx = checkStartX + colIdx * checkColW;
        const cy = checkStartY + rowIdx * checkRowH;

        // Emerald Green Circle Badge
        d.setFillColor(...EMERALD_RGB);
        d.circle(cx + 1.2, cy, 1.2, 'F');

        // White Checkmark Tick
        d.setDrawColor(255, 255, 255);
        d.setLineWidth(0.35);
        d.line(cx + 0.6, cy, cx + 1.0, cy + 0.4);
        d.line(cx + 1.0, cy + 0.4, cx + 1.85, cy - 0.5);

        // Label
        d.setFontSize(6.8).setFont('helvetica', 'bold').setTextColor(...DARK_RGB);
        d.text(chkName, cx + 3.5, cy + 0.8);
      });

      return cardY + cardH + 3;
    };

    // ======================== Helper: Draw Photo on Page ========================
    const drawPhoto = (d: jsPDF, photo: { base64: string; description: string; label: string }, x: number, y: number, w: number, h: number, alias: string) => {
      // Card background
      d.setFillColor(241, 245, 249);
      d.setDrawColor(203, 213, 225);
      d.setLineWidth(0.2);
      d.roundedRect(x, y, w, h, 1.2, 1.2, 'FD');

      if (photo.base64) {
        try {
          const imgDim = imageInfoCache[photo.base64] || { width: 4, height: 3 };
          const imgAspect = imgDim.width > 0 && imgDim.height > 0 ? imgDim.width / imgDim.height : 4 / 3;
          const pad = 1.5;
          const boxW = w - pad * 2;
          const boxH = h - pad * 2;
          const boxAspect = boxW / boxH;

          let drawW = boxW;
          let drawH = boxH;

          if (imgAspect > boxAspect) {
            drawH = drawW / imgAspect;
          } else {
            drawW = drawH * imgAspect;
          }

          const imgX = x + (w - drawW) / 2;
          const imgY = y + (h - drawH) / 2;

          d.addImage(photo.base64, 'JPEG', imgX, imgY, drawW, drawH, alias, 'FAST');
        } catch (e) {
          console.error('Error embedding photo:', e);
        }
      }
    };

    // ======================== MAIN RENDER LOOP ========================
    // Each item gets its own page(s). First page: header + info card + photos.
    // If photos overflow, add new page with header + continuation photos.

    const PHOTO_COLS = 2;
    const photoGapX = 4;
    const photoGapY = 4;
    const photoAreaX = margin;
    const photoAreaW = contentW;
    const photoCardW = (photoAreaW - (PHOTO_COLS - 1) * photoGapX) / PHOTO_COLS;
    const photoCardH = 65; // Large photo cards (~65mm tall)
    const bottomMargin = 10;

    for (let itemIdx = 0; itemIdx < loadedItems.length; itemIdx++) {
      const item = loadedItems[itemIdx];

      // Add new page for each item (except the first item uses page 1)
      if (itemIdx > 0) {
        pdfDoc.addPage();
      }

      // Draw header
      drawHeader(pdfDoc);

      // Draw info card
      const contentStartY = headerTopY + headerH + 3;
      let cursorY = drawInfoCard(pdfDoc, item, itemIdx, contentStartY);

      // Photo section title
      pdfDoc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      pdfDoc.text(`Foto Dokumentasi Inspeksi Visual (${item.photos.length} Foto)`, margin + 1, cursorY + 1.5);
      cursorY += 5;

      if (item.photos.length === 0) {
        pdfDoc.setFontSize(7.5).setFont('helvetica', 'italic').setTextColor(GRAY);
        pdfDoc.text('(Tidak ada foto dokumentasi)', margin + 5, cursorY + 4);
      } else {
        // Render photos in 2-column grid, page-breaking as needed
        for (let pIdx = 0; pIdx < item.photos.length; pIdx++) {
          const col = pIdx % PHOTO_COLS;

          // Check if we need a new page for this photo row
          if (col === 0 && cursorY + photoCardH > pageHeight - bottomMargin) {
            pdfDoc.addPage();
            drawHeader(pdfDoc);
            cursorY = headerTopY + headerH + 4;

            // Continuation label
            pdfDoc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
            pdfDoc.text(
              `${item.dateStr} — ${item.aktivitas} (Foto Lanjutan)`,
              margin + 1,
              cursorY + 1
            );
            cursorY += 5;
          }

          const photoX = photoAreaX + col * (photoCardW + photoGapX);
          const photoY = cursorY;

          drawPhoto(
            pdfDoc,
            item.photos[pIdx],
            photoX,
            photoY,
            photoCardW,
            photoCardH,
            `hse_insp_${item.id}_${pIdx}`
          );

          // Move cursor down after completing a row
          if (col === PHOTO_COLS - 1 || pIdx === item.photos.length - 1) {
            cursorY += photoCardH + photoGapY;
          }
        }
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
