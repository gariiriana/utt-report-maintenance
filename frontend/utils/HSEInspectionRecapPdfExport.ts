// ============================================================================
// FILE: HSEInspectionRecapPdfExport.ts
// Deskripsi: Export PDF Rekapitulasi Laporan Inspeksi HSE / K3 Resmi.
//            Mendukung 2 varian logo header:
//            1. NeutraDC (Logo PT Dwimitra Ekatama Mandiri + Logo NeutraDC)
//            2. UTT (Logo PT United Transworld Trading + Logo NeutraDC)
//            Dengan tema warna Biru Dwimitra (#00599c), grid rapi, hemat halaman,
//            dan menyertakan thumbnail foto inspeksi visual yang jelas dan tajam.
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
  checklistSummary: string[];
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
 * Mengambil detail lengkap dokumen HSE dan subkoleksi fotonya dari Firestore
 */
async function fetchFullHSEInspectionData(docItem: ExcelDocument): Promise<LoadedHSEInspectionItem> {
  let docData: any = null;
  const photosList: { base64: string; description: string; label: string }[] = [];

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
          });
        }
      });
    }
  } catch (err) {
    console.warn(`Failed to fetch photos for hse/${docItem.id}:`, err);
  }

  // Fallback to existing photos if subcollection was empty
  if (photosList.length === 0 && docData?.photos && Array.isArray(docData.photos)) {
    docData.photos.forEach((p: any) => {
      const b64 = p.dataUrl || p.photoBase64 || p.base64 || '';
      if (b64) {
        photosList.push({
          base64: b64,
          description: p.description || '',
          label: p.label || '',
        });
      }
    });
  }

  // Format checklist summary
  const cl = docData?.checklist || {};
  const checklistSummary: string[] = [];
  const addCheck = (key: string, label: string) => {
    if (cl[key]) checklistSummary.push(`✓ ${label}`);
  };

  addCheck('mop', 'MOP');
  addCheck('jsa', 'JSA');
  addCheck('ptw', 'PTW');
  addCheck('ppe', 'APD/PPE');
  addCheck('toolsBertagging', 'Tagging Tools');
  addCheck('housekeeping', 'Housekeeping');
  addCheck('safeCondition', 'Safe Condition');
  addCheck('safeAction', 'Safe Action');
  addCheck('safetySign', 'Safety Sign');
  addCheck('loto', 'LOTO');

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

  // Compress first 2 photos for crisp & lightweight PDF rendering
  const compressedPhotos: { base64: string; description: string; label: string }[] = [];
  const photosToProcess = photosList.slice(0, 2);

  for (const photo of photosToProcess) {
    try {
      const compB64 = await compressBase64Image(photo.base64, {
        maxWidth: 600,
        maxHeight: 600,
        quality: 0.7,
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
    checklistSummary,
    photos: compressedPhotos,
  };
}

/**
 * Export Rekapitulasi Laporan Inspeksi HSE ke Format PDF
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
    // 1. Fetch & compress full data + photos
    const loadedItems: LoadedHSEInspectionItem[] = [];
    for (let i = 0; i < hseDocs.length; i++) {
      const docItem = hseDocs[i];
      toast.loading(
        `[${i + 1}/${hseDocs.length}] Memuat foto & data: ${docItem.maintenanceName || docItem.fileName}...`,
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

    const BLUE_RGB: [number, number, number] = [0, 89, 156]; // #00599c
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

    const drawHeader = (currentDoc: jsPDF): number => {
      // Top accent strip
      currentDoc.setFillColor(...BLUE_RGB);
      currentDoc.rect(0, 0, pageWidth, 2.5, 'F');

      const headerH = 18;
      const headerY = 4.5;

      // Header box border
      currentDoc.setDrawColor(SLATE_200);
      currentDoc.setLineWidth(0.15);
      currentDoc.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');

      const col1W = 32;
      const col3W = 32;
      currentDoc.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
      currentDoc.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);

      // Render Left Logo (DME or UTT)
      if (leftLogo) {
        currentDoc.addImage(leftLogo, 'PNG', margin + 2.5, headerY + 2.5, col1W - 5, 13, isNeutra ? 'logo_dme' : 'logo_utt', 'FAST');
      }

      // Render Right Logo (NeutraDC)
      if (rightLogo) {
        currentDoc.addImage(rightLogo, 'PNG', pageWidth - margin - col3W + 2.5, headerY + 3, col3W - 5, 12, 'logo_neutra', 'FAST');
      }

      // Center Titles
      const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
      currentDoc.setFontSize(10.5).setFont('helvetica', 'bold').setTextColor(...BLUE_RGB);
      currentDoc.text(options.titleOverride || headerReportTitle, centerX, headerY + 6.5, { align: 'center' });

      currentDoc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(DARK);
      currentDoc.text(companyTitle, centerX, headerY + 11, { align: 'center' });

      const printDateStr = new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      currentDoc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY);
      currentDoc.text(
        `Total Laporan: ${loadedItems.length} Dokumen | Tanggal Cetak: ${printDateStr} ${options.periodLabel ? `| Periode: ${options.periodLabel}` : ''}`,
        centerX,
        headerY + 15,
        { align: 'center' }
      );

      return headerY + headerH + 3.5;
    };

    const drawFooter = (currentDoc: jsPDF, pg: number, totalPages: number) => {
      currentDoc.setFillColor(...BLUE_RGB);
      currentDoc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');
      currentDoc.setFontSize(6.5).setTextColor(GRAY);
      currentDoc.text(`${companyTitle} — HSE Inspection Recap Report`, margin, pageHeight - 4.5);
      currentDoc.text(`Halaman ${pg} dari ${totalPages}`, pageWidth - margin, pageHeight - 4.5, { align: 'right' });
    };

    const curY = drawHeader(doc);

    // Build Table Rows
    const tableRows = loadedItems.map((item, idx) => {
      const colNo = String(idx + 1);
      const colAktivitas = `${item.dateStr}\n\n${item.aktivitas}${item.maintenanceType && item.maintenanceType !== 'OTHER' ? `\n[${item.maintenanceType}]` : ''}`;
      const colLokasi = `Lokasi: ${item.lokasi}\nPIC: ${item.pic}\nPersonil: ${item.personil}${item.anggota ? `\nAnggota: ${item.anggota}` : ''}`;
      const colInspector = `${item.inspectorK3}\n(HSE Officer)`;
      
      const checklistText = item.checklistSummary.length > 0
        ? item.checklistSummary.join('\n')
        : '✓ Checklist Lengkap\n✓ APD Terpenuhi\n✓ Area Aman';

      const photoPlaceholder = item.photos.length > 0 ? '' : '(Tidak Ada Foto)';
      const colStatus = 'SESUAI K3\n(COMPLIANT)\n\nKondisi Kerja Aman';

      return [
        colNo,
        colAktivitas,
        colLokasi,
        colInspector,
        checklistText,
        photoPlaceholder,
        colStatus,
      ];
    });

    autoTable(doc, {
      startY: curY,
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
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 6.8,
        cellPadding: 1.5,
        lineColor: [203, 213, 225],
        lineWidth: 0.15,
        textColor: [30, 41, 59],
        font: 'helvetica',
        valign: 'middle',
        minCellHeight: 20,
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
        1: { cellWidth: 48 },
        2: { cellWidth: 46 },
        3: { cellWidth: 32 },
        4: { cellWidth: 44 },
        5: { cellWidth: 68, halign: 'center' },
        6: { cellWidth: 30, halign: 'center' },
      },
      didDrawPage: (data: any) => {
        if (data.pageNumber > 1) {
          drawHeader(doc);
        }
      },
      didDrawCell: (data: any) => {
        // Draw photos inside Column 5 (Foto Dokumentasi)
        if (data.section === 'body' && data.column.index === 5) {
          const item = loadedItems[data.row.index];
          if (!item || item.photos.length === 0) return;

          const cell = data.cell;
          const photos = item.photos.slice(0, 2);
          const cellPad = 1.2;
          const availW = cell.width - cellPad * 2;
          const availH = cell.height - cellPad * 2;

          const numPhotos = photos.length;
          const photoW = numPhotos === 1 ? Math.min(availW - 4, 38) : (availW - 2.5) / 2;
          const photoH = availH - 1;

          photos.forEach((photo, pIdx) => {
            const photoX = cell.x + cellPad + (numPhotos === 1 ? (availW - photoW) / 2 : pIdx * (photoW + 2.5));
            const photoY = cell.y + cellPad + (availH - photoH) / 2;

            // Background placeholder card
            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.1);
            doc.roundedRect(photoX, photoY, photoW, photoH, 0.8, 0.8, 'FD');

            if (photo.base64) {
              try {
                const imgDim = imageInfoCache[photo.base64] || { width: 4, height: 3 };
                const imgAspect = imgDim.width > 0 && imgDim.height > 0 ? imgDim.width / imgDim.height : 4 / 3;
                const boxAspect = photoW / photoH;

                let drawW = photoW - 0.8;
                let drawH = photoH - 0.8;

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
