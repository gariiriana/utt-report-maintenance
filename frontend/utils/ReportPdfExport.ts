import { jsPDF } from 'jspdf';
import { PhotoCard } from '@/components/ReportForm';
import { compressBase64Image } from '@/utils/imageCompression';
import { toast } from 'sonner';

export interface PDFExportResult {
  doc: jsPDF;
  fileName: string;
  filled: PhotoCard[];
}

interface ExportOptions {
  maintenanceName: string;
  maintenanceTime: string;
  specificDetail: string;
  vrvUnitDetail: string;
  cards: PhotoCard[];
  companyType: 'neutra' | 'bri';
  userEmail?: string;
  logos: {
    left: string;
    right: string;
  };
}

export const loadLogoBase64 = (pathOrObj: string | { src: string }): Promise<string> => {
  return new Promise<string>((resolve) => {
    const url = typeof pathOrObj === 'string' ? pathOrObj : pathOrObj.src;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
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

export const generateReportPDF = async (options: ExportOptions): Promise<PDFExportResult | null> => {
  const {
    maintenanceName,
    maintenanceTime,
    specificDetail,
    vrvUnitDetail,
    cards,
    companyType,
    userEmail,
    logos
  } = options;

  if (!maintenanceName || !maintenanceTime) {
    toast.error('Isi nama & waktu');
    return null;
  }

  const filled = cards.filter(c => c.photoBase64 || c.description);
  if (!filled.length) {
    toast.error('Minimal 1 card filled');
    return null;
  }

  const optimizedCards: PhotoCard[] = [];
  const SKIP_THRESHOLD = 200 * 1024; 
  const BATCH_SIZE = 4;

  for (let batchStart = 0; batchStart < filled.length; batchStart += BATCH_SIZE) {
    const batch = filled.slice(batchStart, batchStart + BATCH_SIZE);
    toast.loading(`Optimizing photo ${batchStart + 1}-${Math.min(batchStart + BATCH_SIZE, filled.length)}/${filled.length}...`, { id: 'export' });

    const batchResults = await Promise.all(batch.map(async (c) => {
      if (!c.photoBase64) return c;

      const sizeInBytes = (c.photoBase64.length * 3) / 4;
      if (sizeInBytes <= SKIP_THRESHOLD) return c;

      try {
        const compressed = await compressBase64Image(c.photoBase64, { maxWidth: 800, quality: 0.5 });
        return { ...c, photoBase64: compressed };
      } catch (err) {
        console.error('Compression failed, using original', err);
        return c;
      }
    }));

    optimizedCards.push(...batchResults);
  }

  toast.dismiss('export');

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageWidth - 2 * margin;

  const THEME_BLUE = '#00599c';
  const DARK = '#1e293b';
  const GRAY = '#64748b';
  const SLATE_200 = '#e2e8f0';

  const isATS = userEmail === 'ats@gmail.com';
  const isPDU = userEmail === 'pdu@gmail.com';
  const isLV = userEmail === 'lv@gmail.com';
  const isLDBRDB = userEmail === 'ldb/rdb@gmail.com';
  const isVRV = userEmail === 'vrv@gmail.com';
  const isLightingSystem = userEmail?.toLowerCase() === 'lightingsystem@gmail.com';
  const isACSplit = userEmail === 'acsplit@gmail.com';
  const isCRAC = userEmail === 'crac@gmail.com';
  const isWLD = userEmail === 'wld@gmail.com';
  const isFLD = userEmail === 'fld@gmail.com';
  const isPJU = userEmail === 'pju@gmail.com';
  const isPump = userEmail === 'pump@gmail.com';
  const isMV = userEmail === 'mv@gmail.com';
  const isSmallGrid = isPDU || isLV || isLDBRDB || isVRV || isATS || isLightingSystem || isACSplit || isCRAC || isWLD || isFLD || isPJU || isPump || isMV;
  const isLVlike = isLV || isLDBRDB || isLightingSystem;

  const cols = (isVRV || isATS || isACSplit || isCRAC || isWLD || isFLD || isPJU || isPump || isMV) ? 3 : isSmallGrid ? 4 : 3;
  const perPage = (isATS || isACSplit || isCRAC || isPJU || isPump || isMV) ? 12 : isPDU ? 20 : isLVlike ? 12 : isVRV ? 15 : 9;
  const photoH = (isATS || isACSplit || isCRAC || isPJU || isPump || isMV) ? 45 : isVRV ? 40 : (isWLD || isFLD) ? 56 : isSmallGrid ? 38 : 55;
  const capH = (isATS || isACSplit || isCRAC || isPJU || isPump || isMV) ? 7.5 : isVRV ? 6.5 : (isWLD || isFLD) ? 10 : isSmallGrid ? 8 : 10;
  const rowGap = (isVRV || isATS || isACSplit || isCRAC || isWLD || isFLD || isPJU || isPump || isMV) ? ((isWLD || isFLD) ? 8 : 2.5) : 4;

  const finalSpecificDetail = (userEmail === 'vrv@gmail.com' && vrvUnitDetail)
    ? `${specificDetail.toUpperCase()} - ${vrvUnitDetail.toUpperCase()}`
    : specificDetail;

  const drawHeader = (doc: any) => {
    doc.setFillColor(THEME_BLUE);
    doc.rect(0, 0, pageWidth, 2.5, 'F');
    const headerH = 22;
    const headerY = 6;
    doc.setDrawColor(SLATE_200);
    doc.setLineWidth(0.1);
    doc.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');
    const col1W = 35;
    const col3W = 35;
    doc.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
    doc.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);
    if (logos.left) {
      doc.addImage(logos.left, 'JPEG', margin + 3, headerY + 4, col1W - 6, 14, 'logo_l', 'FAST');
    }
    if (logos.right) {
      doc.addImage(logos.right, 'JPEG', pageWidth - margin - col3W + 5, headerY + 5.5, col3W - 10, 11, 'logo_r', 'FAST');
    }
    const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
    doc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(THEME_BLUE);
    doc.text('LAPORAN MAINTENANCE', centerX, headerY + 6.5, { align: 'center' });

    doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text(`DOKUMENTASI PM: ${maintenanceName.toUpperCase()}`, centerX, headerY + 11.5, { align: 'center' });

    if (finalSpecificDetail) {
      doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(THEME_BLUE);
      doc.text(`${finalSpecificDetail.toUpperCase()}`, centerX, headerY + 16, { align: 'center' });
    }

    const longDate = new Date(maintenanceTime).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(GRAY);
    doc.text(`Tanggal Maintenance: ${longDate}`, centerX, headerY + 20, { align: 'center' });

    return 31;
  };

  const drawPhotoCard = (doc: any, x: number, y: number, w: number, h: number, capH: number, photo: PhotoCard, index: number) => {
    const cardW = w - 2;
    const cardX = x;
    const cardY = y;

    doc.setFillColor(255, 255, 255).setDrawColor(SLATE_200).setLineWidth(0.2);
    doc.roundedRect(cardX, cardY, cardW, h + capH, 1, 1, 'FD');

    if (photo.photoBase64) {
      doc.setFillColor(DARK).rect(cardX + 0.5, cardY + 0.5, cardW - 1, h - 1, 'F');
      doc.addImage(photo.photoBase64, 'JPEG', cardX + 1, cardY + 1, cardW - 2, h - 2, `p_${index}`, 'FAST');
    } else {
      doc.setFillColor(241, 245, 249).rect(cardX + 0.5, cardY + 0.5, cardW - 1, h - 1, 'F');
      doc.setFontSize(7).setTextColor(GRAY).text('No Photo', cardX + cardW / 2, cardY + h / 2, { align: 'center' });
    }

    doc.setDrawColor(SLATE_200).setLineWidth(0.3);
    doc.line(cardX, cardY + h, cardX + cardW, cardY + h);

    const captionText = photo.description || '';
    const fontSize = 7.0; 
    doc.setFontSize(fontSize).setFont('helvetica', 'normal').setTextColor(DARK);

    const leftPadding = 2.0;
    const maxWidth = cardW - (leftPadding + 3);
    const spacingFactor = 1.05;
    const lineHeight = (fontSize * 0.3528) * spacingFactor;
    const splitCaption = doc.splitTextToSize(captionText, maxWidth);

    const availableH = capH - 2;
    const maxLines = Math.max(1, Math.floor(availableH / lineHeight));
    const displayLines = splitCaption.slice(0, maxLines);

    const totalTextH = displayLines.length * lineHeight;
    const textStartY = cardY + h + (capH - totalTextH) / 2 + (lineHeight * 0.7);

    doc.setFillColor(THEME_BLUE);
    const lineThickness = 0.35;
    const lineH = Math.max(2, totalTextH);
    doc.rect(cardX + 1.2, cardY + h + (capH - lineH) / 2, lineThickness, lineH, 'F');

    doc.text(displayLines, cardX + leftPadding + 1.2, textStartY, { 
      align: 'left', 
      lineHeightFactor: spacingFactor 
    });
  };

  let curY = drawHeader(doc);
  let count = 0;

  if (isLVlike) {
    const capHLV = 10;
    const gapLV = 5;
    const normalPhotoH = 55;
    let pageStart = 0;
    let isFirstPage = true;

    while (pageStart < optimizedCards.length) {
      const pageCards = optimizedCards.slice(pageStart, pageStart + perPage);
      const rows = Math.ceil(pageCards.length / cols);
      if (!isFirstPage) {
        doc.addPage();
        curY = drawHeader(doc);
      }
      const usablePageHeight = pageHeight - curY - margin - 12;
      const photoHLV = isFirstPage ? Math.min(Math.floor(usablePageHeight / rows - capHLV - gapLV), normalPhotoH) : normalPhotoH;
      for (let i = 0; i < pageCards.length; i += cols) {
        const row = pageCards.slice(i, i + cols);
        for (let j = 0; j < row.length; j++) {
          const x = margin + j * (contentW / cols);
          drawPhotoCard(doc, x, curY, contentW / cols, photoHLV, capHLV, row[j], pageStart + i + j);
        }
        curY += photoHLV + capHLV + gapLV;
      }
      pageStart += perPage;
      isFirstPage = false;
    }
  } else {
    for (let i = 0; i < optimizedCards.length; i += cols) {
      if (count > 0 && count % perPage === 0) { doc.addPage(); curY = drawHeader(doc); }
      const row = optimizedCards.slice(i, i + cols);
      for (let j = 0; j < row.length; j++) {
        const x = margin + j * (contentW / cols);
        drawPhotoCard(doc, x, curY, contentW / cols, photoH, capH, row[j], i + j);
        count++;
      }
      curY += photoH + capH + rowGap;
    }
  }
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFillColor(THEME_BLUE).rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');
    doc.setFontSize(7.5).setTextColor(GRAY);
    const footerCompany = companyType === 'bri' ? 'BANK RAKYAT INDONESIA' : 'PT DWIMITRA EKATAMA MANDIRI';
    doc.text(`${footerCompany} — Maintenance Document`, margin, pageHeight - 6);
    doc.text(`Page ${pg} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  const safeName = maintenanceName.replace(/[/\\?%*:|"<>]/g, ' ').trim();
  const safeDetail = finalSpecificDetail ? ` (${finalSpecificDetail.replace(/[/\\?%*:|"<>]/g, ' ').trim()})` : '';

  return { doc, fileName: `${safeName}${safeDetail}.pdf`, filled: optimizedCards };
};

