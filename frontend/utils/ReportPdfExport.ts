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

  const formattedDate = new Date(maintenanceTime).toLocaleDateString('id-ID', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });

  const optimizedCards: PhotoCard[] = [];
  for (let i = 0; i < filled.length; i++) {
    const c = filled[i];
    if (c.photoBase64) {
      toast.loading(`Optimizing photo ${i + 1}/${filled.length}...`, { id: 'export' });
      try {
        const compressed = await compressBase64Image(c.photoBase64, { maxWidth: 800, quality: 0.5 });
        optimizedCards.push({ ...c, photoBase64: compressed });
      } catch (err) {
        console.error(`Fail at photo ${i}`, err);
        optimizedCards.push(c);
      }
    } else {
      optimizedCards.push(c);
    }
  }
  
  toast.dismiss('export');

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const usableWidth = pageWidth - 2 * margin;

  const isATS = userEmail === 'ats@gmail.com';
  const isPDU = userEmail === 'pdu@gmail.com';
  const isLV = userEmail === 'lv@gmail.com';
  const isLDBRDB = userEmail === 'ldb/rdb@gmail.com';
  const isVRV = userEmail === 'vrv@gmail.com';
  const isLightingSystem = userEmail?.toLowerCase() === 'lightingsystem@gmail.com';
  const isSmallGrid = isPDU || isLV || isLDBRDB || isVRV || isATS || isLightingSystem;
  const isLVlike = isLV || isLDBRDB || isLightingSystem;

  const cols = (isVRV || isATS) ? 3 : isSmallGrid ? 4 : 3;
  const perPage = isATS ? 12 : isPDU ? 20 : isLVlike ? 12 : isVRV ? 15 : 9;
  const photoH = isATS ? 45 : isVRV ? 40 : isSmallGrid ? 38 : 55;
  const capH = isATS ? 10 : isVRV ? 8 : isSmallGrid ? 10 : 12;
  const rowGap = (isVRV || isATS) ? 3 : 5;

  const finalSpecificDetail = (userEmail === 'vrv@gmail.com' && vrvUnitDetail) 
    ? `${specificDetail.toUpperCase()} - ${vrvUnitDetail.toUpperCase()}`
    : specificDetail;

  const drawHeader = (doc: any) => {
    const isDwimitra = companyType !== 'bri';
    const isCompact = isPDU || isLVlike || isVRV;

    const leftW = isCompact ? 22 : (isDwimitra ? 28 : 36);
    const leftH = isCompact ? 9 : (isDwimitra ? 18 : 14);
    const rightW = isCompact ? 22 : (isDwimitra ? 36 : 35);
    const rightH = isCompact ? 9 : (isDwimitra ? 14 : 14);

    const headerTopY = 8;

    if (logos.left) {
      doc.addImage(logos.left, 'JPEG', margin, headerTopY, leftW, leftH, 'logo_left', 'FAST');
    }
    if (logos.right) {
      const rightY = headerTopY + (leftH - rightH) / 2;
      doc.addImage(logos.right, 'JPEG', pageWidth - margin - rightW, rightY, rightW, rightH, 'logo_right', 'FAST');
    }

    const textAreaPadding = 3;
    const textAreaWidth = pageWidth - (2 * margin) - leftW - rightW - (2 * textAreaPadding);
    const textCenterX = margin + leftW + textAreaPadding + (textAreaWidth / 2);

    const tallLogoH = Math.max(leftH, rightH);
    const textStartY = headerTopY + tallLogoH / 2 - (isCompact ? 4 : 8);

    doc.setFontSize(isCompact ? 9 : 13).setFont('helvetica', 'bold');
    const titleText = `DOKUMENTASI PM ${maintenanceName.toUpperCase()}`;
    const splitTitle = doc.splitTextToSize(titleText, textAreaWidth);
    doc.text(splitTitle, textCenterX, textStartY, { align: 'center' });

    const titleLineH = isCompact ? 5 : 6;
    let nextY = textStartY + splitTitle.length * titleLineH;

    const longDate = new Date(maintenanceTime).toLocaleDateString('id-ID', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
    doc.setFontSize(isCompact ? 8 : 11).setFont('helvetica', 'normal');
    doc.text(`(${longDate})`, textCenterX, nextY + 2, { align: 'center' });
    nextY += isCompact ? 6 : 8;

    if (finalSpecificDetail) {
      doc.setFontSize(isCompact ? 7 : 10).setFont('helvetica', 'bold');
      const splitDetail = doc.splitTextToSize(finalSpecificDetail.toUpperCase(), textAreaWidth);
      doc.text(splitDetail, textCenterX, nextY + 2, { align: 'center' });
      nextY += splitDetail.length * (isCompact ? 4 : 5) + 2;
    }

    return Math.max(nextY + 6, isCompact ? 30 : 42);
  };

  let curY = drawHeader(doc);
  let count = 0;

  if (isLVlike) {
    const pageHeightMM = doc.internal.pageSize.getHeight();
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

      const usablePageHeight = pageHeightMM - curY - margin;
      const photoHLV = isFirstPage
        ? Math.floor(usablePageHeight / rows - capHLV - gapLV)
        : normalPhotoH;

      for (let i = 0; i < pageCards.length; i += cols) {
        const row = pageCards.slice(i, i + cols);
        for (let j = 0; j < row.length; j++) {
          const x = margin + j * (usableWidth / cols);
          doc.rect(x, curY, usableWidth / cols - 2, photoHLV);
          const b64 = row[j].photoBase64;
          if (b64) {
            doc.addImage(b64, 'JPEG', x + 1, curY + 1, usableWidth / cols - 4, photoHLV - 2, `p_${pageStart + i + j}`, 'FAST');
          }
          doc.rect(x, curY + photoHLV, usableWidth / cols - 2, capHLV);
          doc.setFontSize(7).setFont('helvetica', 'normal');
          doc.text(doc.splitTextToSize(row[j].description || '', usableWidth / cols - 6), x + (usableWidth / cols) / 2 - 1, curY + photoHLV + 5, { align: 'center' });
        }
        curY += photoHLV + capHLV + gapLV;
      }

      pageStart += perPage;
      isFirstPage = false;
    }
  } else {
    for (let i = 0; i < optimizedCards.length; i += cols) {
      if (count > 0 && count % perPage === 0) { 
        doc.addPage(); 
        curY = drawHeader(doc); 
      }
      const row = optimizedCards.slice(i, i + cols);
      for (let j = 0; j < row.length; j++) {
        const x = margin + j * (usableWidth / cols);
        doc.rect(x, curY, usableWidth / cols - 2, photoH);
        const b64 = row[j].photoBase64;
        if (b64) {
          doc.addImage(b64, 'JPEG', x + 1, curY + 1, usableWidth / cols - 4, photoH - 2, `p_${i + j}`, 'FAST');
        }
        doc.rect(x, curY + photoH, usableWidth / cols - 2, capH);
        doc.setFontSize(isVRV || isPDU ? 7 : 8).setFont('helvetica', 'normal');
        doc.text(doc.splitTextToSize(row[j].description || '', usableWidth / cols - 6), x + (usableWidth / cols) / 2 - 1, curY + photoH + 5, { align: 'center' });
        count++;
      }
      curY += photoH + capH + rowGap;
    }
  }

  const safeName = maintenanceName.replace(/[/\\?%*:|"<>]/g, '-');
  const safeDate = formattedDate.replace(/\//g, '-');
  const safeDetail = finalSpecificDetail 
    ? `_${finalSpecificDetail.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_')}` 
    : '';

  return { 
    doc, 
    fileName: `Report_${safeName}_${safeDate}${safeDetail}.pdf`, 
    filled: optimizedCards 
  };
};
