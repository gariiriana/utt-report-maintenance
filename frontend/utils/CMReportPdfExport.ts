import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CMReportData } from '@/types/correctiveReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { compressBase64Image } from '@/utils/imageCompression';
import { toast } from 'sonner';

/** Helper to convert image URL to base64 */
async function loadImageBase64(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

/** Helper to sanitize text strings and prevent font mangling or character spacing bugs in jsPDF */
function sanitizePdfText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    // Replace mangled bullet combinations (&«) or unicode symbols with standard bullet •
    .replace(/(?:&«|[\u26AB\u25AA\u25BA\u25B6\u2043\u25CF\u25C6])/g, '•')
    // Replace smart quotes and dashes with standard ASCII equivalents
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-');
}

/** Helper to format text lines into neat bullet point lists (using •) */
function formatAsBulletList(text: string | null | undefined): string {
  if (!text) return '•  -';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '•  -';
  return lines.map(line => {
    const clean = line.replace(/^(?:[•\u2022\u26AB\u25AA\u25BA\u25B6\u2043\u25CF\u25C6]|-|\*|\d+\.\s*)\s*/, '').trim();
    return `•  ${clean}`;
  }).join('\n');
}

let cachedCenturyGothicFont = '';

async function loadCenturyGothicFont(): Promise<string> {
  if (cachedCenturyGothicFont) return cachedCenturyGothicFont;
  const fontUrls = [
    'https://raw.githubusercontent.com/mojs/mojs-website/master/app/css/fonts/CenturyGothic.ttf',
    'https://cdn.jsdelivr.net/gh/mojs/mojs-website@master/app/css/fonts/CenturyGothic.ttf',
    'https://raw.githubusercontent.com/ThatZiv/ziv-loadscreen/master/assets/fonts/CenturyGothic.ttf'
  ];
  for (const url of fontUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || '');
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
        if (base64 && base64.length > 1000) {
          cachedCenturyGothicFont = base64;
          return cachedCenturyGothicFont;
        }
      }
    } catch {
      /* try next */
    }
  }
  return '';
}

export async function generateCMReportPDF(data: CMReportData) {
  const toastId = toast.loading('Memproses PDF Corrective Maintenance...');

  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentW = pageW - 2 * margin;

    // Load Century Gothic Font
    const centuryFontBase64 = await loadCenturyGothicFont();
    let fontName = 'helvetica';
    if (centuryFontBase64) {
      try {
        doc.addFileToVFS('CenturyGothic.ttf', centuryFontBase64);
        doc.addFont('CenturyGothic.ttf', 'CenturyGothic', 'normal');
        doc.addFont('CenturyGothic.ttf', 'CenturyGothic', 'bold');
        fontName = 'CenturyGothic';
      } catch (e) {
        console.error('Failed to register Century Gothic font in jsPDF:', e);
      }
    }

    // Load Logos
    let logoLeft = '';
    let logoRight = '';
    try { logoLeft = await loadImageBase64(logoDwimitra); } catch { /* ignore */ }
    try { logoRight = await loadImageBase64(logoNeutraDC); } catch { /* ignore */ }

    // Compress photos if any
    let processedPhotos: { base64: string; description: string }[] = [];
    if (data.photos && data.photos.length > 0) {
      processedPhotos = await Promise.all(
        data.photos.map(async (p) => {
          if (!p.photoBase64) return { base64: '', description: '' };
          try {
            const compressed = await compressBase64Image(p.photoBase64, { maxWidth: 900, quality: 0.7 });
            return { base64: compressed, description: sanitizePdfText(p.description) };
          } catch {
            return { base64: p.photoBase64, description: sanitizePdfText(p.description) };
          }
        })
      );
    }

    const HEADER_FILL: [number, number, number] = [220, 230, 241]; // Light blue fill matching screenshot
    const BORDER_COLOR: [number, number, number] = [160, 160, 160];

    // Helper: Draw Header Logos
    const drawHeaderLogos = () => {
      if (logoLeft) {
        doc.addImage(logoLeft, 'PNG', margin, 6, 22, 16);
      }
      if (logoRight) {
        doc.addImage(logoRight, 'PNG', pageW - margin - 32, 8, 32, 11);
      }
    };

    // Resolve Aliases & Fallbacks
    const resolvedIncidentName = data.incidentName || (data as any).ticketName || (data as any).issue || 'Corrective Maintenance Report';
    const resolvedEquipmentName = data.equipmentName || (data as any).ticketName || (data as any).issue || (data as any).location || 'Equipment';
    const resolvedAction = data.correctiveAction || (data as any).actionTaken || '-';
    const resolvedResult = data.result || (data as any).remark || 'Status perbaikan telah selesai dilaksanakan dengan baik.';
    const resolvedVisualInsp = data.visualInspectionChecking || (data as any).issue || 'Pengecekan kondisi fisik dan fungsi operasional peralatan.';
    const resolvedCleaningMethod = data.cleaningPreventiveMethod || 'Pembersihan area kerja dan komponen pendukung.';
    const resolvedProblemAnalysis = data.summaryProblemAnalysis || (data as any).issue || (data as any).summary || (data as any).actionTaken || 'Analisis masalah dan perbaikan unit.';

    // ==========================================
    // PAGE 1: INCIDENT, EQUIPMENT & ANALYSIS
    // ==========================================
    drawHeaderLogos();

    let y = 28;

    // Document Title
    doc.setFont(fontName, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('REPORT CORRECTIVE MAINTENANCE', pageW / 2, y, { align: 'center' });

    y += 6;

    // TABLE 1: INCIDENT INFO
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['INCIDENT NAME', 'LOCATION', 'INCIDENT DATE', 'INCIDENT ID']],
      body: [[
        sanitizePdfText(resolvedIncidentName) || 'N/A',
        sanitizePdfText(data.location) || 'N/A',
        sanitizePdfText(data.incidentDate) || 'N/A',
        sanitizePdfText(data.incidentId) || 'N/A'
      ]],
      theme: 'grid',
      styles: { font: fontName },
      headStyles: {
        font: fontName,
        fillColor: HEADER_FILL,
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: BORDER_COLOR,
      },
      bodyStyles: {
        font: fontName,
        textColor: [20, 20, 20],
        fontSize: 8.5,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: BORDER_COLOR,
      },
      columnStyles: {
        0: { cellWidth: contentW * 0.35 },
        1: { cellWidth: contentW * 0.25 },
        2: { cellWidth: contentW * 0.20 },
        3: { cellWidth: contentW * 0.20 },
      }
    });

    y = (doc as any).lastAutoTable.finalY + 3;

    // TABLE 2: EQUIPMENT INFO
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['EQUIPMENT NAME', 'BRAND', 'SERIAL NUMBER', 'INSTALATION DATE']],
      body: [[
        sanitizePdfText(resolvedEquipmentName) || 'N/A',
        sanitizePdfText(data.brand) || 'N/A',
        sanitizePdfText(data.serialNumber) || 'N/A',
        sanitizePdfText(data.installationDate) || 'N/A'
      ]],
      theme: 'grid',
      styles: { font: fontName },
      headStyles: {
        font: fontName,
        fillColor: HEADER_FILL,
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: BORDER_COLOR,
      },
      bodyStyles: {
        font: fontName,
        textColor: [20, 20, 20],
        fontSize: 8.5,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: BORDER_COLOR,
      },
      columnStyles: {
        0: { cellWidth: contentW * 0.35 },
        1: { cellWidth: contentW * 0.25 },
        2: { cellWidth: contentW * 0.20 },
        3: { cellWidth: contentW * 0.20 },
      }
    });

    y = (doc as any).lastAutoTable.finalY + 3;

    // TABLE 3: CORRECTIVE ACTION, REPAIR TIME & RESULT
    const formattedAction = formatAsBulletList(resolvedAction);
    const repairTimeStr = `Start  : ${sanitizePdfText(data.repairTimeStart) || '-'}\nEnd   : ${sanitizePdfText(data.repairTimeEnd) || '-'}`;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['CORRECTIVE ACTION', 'REPAIR TIME', 'RESULT']],
      body: [[
        formattedAction,
        repairTimeStr,
        sanitizePdfText(resolvedResult) || '-'
      ]],
      theme: 'grid',
      styles: { font: fontName },
      headStyles: {
        font: fontName,
        fillColor: HEADER_FILL,
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: BORDER_COLOR,
      },
      bodyStyles: {
        font: fontName,
        textColor: [20, 20, 20],
        fontSize: 8.5,
        valign: 'top',
        lineWidth: 0.2,
        lineColor: BORDER_COLOR,
      },
      columnStyles: {
        0: { cellWidth: contentW * 0.50, halign: 'left' },
        1: { cellWidth: contentW * 0.20, halign: 'left' },
        2: { cellWidth: contentW * 0.30, halign: 'left' },
      }
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    // Helper: Draw Section with Header Bar & Text Box
    const drawSectionBox = (title: string, rawContentText: string, minBoxHeight: number) => {
      const contentText = sanitizePdfText(rawContentText);

      // Header bar
      doc.setFillColor(...HEADER_FILL);
      doc.setDrawColor(...BORDER_COLOR);
      doc.setLineWidth(0.2);
      doc.rect(margin, y, contentW, 6, 'FD');

      doc.setFont(fontName, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(title, margin + 2, y + 4.2);

      y += 6;

      // Text box
      doc.setFont(fontName, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 30, 30);

      const splitText = doc.splitTextToSize(contentText || 'N/A', contentW - 6);
      const textHeight = splitText.length * 4.2 + 4;
      const boxH = Math.max(minBoxHeight, textHeight);

      doc.rect(margin, y, contentW, boxH, 'D');
      doc.text(splitText, margin + 3, y + 4.5);

      y += boxH + 4;
    };

    // SECTION: VISUAL INSPECTION & CHECKING
    drawSectionBox(
      'VISUAL INSPECTION & CHECKING',
      formatAsBulletList(resolvedVisualInsp),
      18
    );

    // SECTION: CLEANING & PREVENTIVE METHOD
    drawSectionBox(
      'CLEANING & PREVENTIVE METHOD',
      formatAsBulletList(resolvedCleaningMethod),
      18
    );

    // SECTION: SUMMARY CORRECTIVE REPORT (PROBLEM ANALYSIS)
    drawSectionBox(
      'SUMMARY CORRECTIVE REPORT (PROBLEM ANALYSIS)',
      formatAsBulletList(resolvedProblemAnalysis),
      35
    );


    // ==========================================
    // PAGE 2: SPAREPART & DOCUMENTATION
    // ==========================================
    doc.addPage();
    drawHeaderLogos();

    y = 28;

    // SPAREPARTS TABLE
    const sparepartRows = (data.spareparts && data.spareparts.length > 0)
      ? data.spareparts.map((sp, idx) => [
          (idx + 1).toString(),
          sanitizePdfText(sp.name) || '-',
          sanitizePdfText(sp.brand) || '-',
          sanitizePdfText(sp.qty) || '-'
        ])
      : [
          ['-', '-', '-', '-'],
          ['-', '-', '-', '-']
        ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['No', 'LIST OF REQUIRED SPAREPART', 'BRAND', 'QTY']],
      body: sparepartRows,
      theme: 'grid',
      styles: { font: fontName },
      headStyles: {
        font: fontName,
        fillColor: HEADER_FILL,
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: BORDER_COLOR,
      },
      bodyStyles: {
        font: fontName,
        textColor: [20, 20, 20],
        fontSize: 8.5,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: BORDER_COLOR,
      },
      columnStyles: {
        0: { cellWidth: contentW * 0.10 },
        1: { cellWidth: contentW * 0.50, halign: 'left' },
        2: { cellWidth: contentW * 0.25 },
        3: { cellWidth: contentW * 0.15 },
      }
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // Section Header: SUPPORTING DOCUMENTATION
    doc.setFont(fontName, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text('SUPPORTING DOCUMENTATION', margin, y);

    y += 5;

    // Outer Box: VISUAL INSPECTION & CHECKING PHOTOS
    doc.setFillColor(...HEADER_FILL);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW, 6, 'FD');

    doc.setFont(fontName, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('VISUAL INSPECTION & CHECKING', margin + 2, y + 4.2);

    y += 6;

    const photoBoxH = 155;
    doc.rect(margin, y, contentW, photoBoxH, 'D');

    // Draw photos inside photo box (up to 12 photos in grid across pages if >4)
    const validPhotos = processedPhotos.filter(p => p.base64).slice(0, 12);
    let currentPageIndex = 2;

    if (validPhotos.length > 0) {
      // Chunk photos by 4 photos per page (2 rows x 2 cols) to preserve clear, large photo dimensions
      const photoPages: { base64: string; description: string }[][] = [];
      for (let i = 0; i < validPhotos.length; i += 4) {
        photoPages.push(validPhotos.slice(i, i + 4));
      }

      const renderPhotoGrid = (photos: { base64: string; description: string }[], boxY: number, globalOffset = 0) => {
        const gapX = 6;
        const gapY = 4;
        const cardW = (contentW - 10 - gapX) / 2; // 88mm wide
        const headH = 6; // Header table bar
        const imgH = 55; // Image area height (clear & legible)
        const descH = 10; // Caption table row height
        const cardH = headH + imgH + descH; // 71mm total height per card

        photos.forEach((item, idx) => {
          const photoNum = globalOffset + idx + 1;
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const cardX = margin + 5 + col * (cardW + gapX);
          const cardY = boxY + 5 + row * (cardH + gapY);

          // 1. Table Outer Box
          doc.setDrawColor(...BORDER_COLOR);
          doc.setLineWidth(0.2);
          doc.rect(cardX, cardY, cardW, cardH, 'D');

          // 2. Table Header Bar (FOTO DOKUMENTASI #X)
          doc.setFillColor(...HEADER_FILL);
          doc.rect(cardX, cardY, cardW, headH, 'FD');
          doc.setFont(fontName, 'bold');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          doc.text(`FOTO DOKUMENTASI #${photoNum}`, cardX + 3, cardY + 4.2);

          // 3. Image Area
          const imgY = cardY + headH;
          if (item.base64) {
            try {
              doc.addImage(item.base64, 'JPEG', cardX + 0.5, imgY + 0.5, cardW - 1, imgH - 1);
            } catch (e) {
              console.error('Error adding CM photo to PDF', e);
            }
          }

          // 4. Bottom Description Table Row
          const descY = imgY + imgH;
          doc.setFillColor(248, 250, 252);
          doc.rect(cardX, descY, cardW, descH, 'FD');
          doc.setDrawColor(...BORDER_COLOR);
          doc.line(cardX, descY, cardX + cardW, descY); // Top divider line

          doc.setFont(fontName, 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(51, 65, 85);
          const descText = item.description ? `Ket: ${item.description}` : `Ket: Dokumentasi Foto #${photoNum}`;
          const splitDesc = doc.splitTextToSize(descText, cardW - 4);
          doc.text(splitDesc, cardX + 2, descY + 4.2);
        });
      };

      photoPages.forEach((pagePhotos, pageIdx) => {
        let currentY = y;
        if (pageIdx > 0) {
          currentPageIndex++;
          doc.addPage();
          drawHeaderLogos();
          currentY = 28;

          doc.setFont(fontName, 'bold');
          doc.setFontSize(10);
          doc.setTextColor(50, 50, 50);
          doc.text('SUPPORTING DOCUMENTATION (LANJUTAN)', margin, currentY);

          currentY += 5;

          doc.setFillColor(...HEADER_FILL);
          doc.setDrawColor(...BORDER_COLOR);
          doc.setLineWidth(0.2);
          doc.rect(margin, currentY, contentW, 6, 'FD');

          doc.setFont(fontName, 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(0, 0, 0);
          doc.text(`VISUAL INSPECTION & CHECKING (FOTO ${pageIdx * 4 + 1}-${pageIdx * 4 + pagePhotos.length})`, margin + 2, currentY + 4.2);

          currentY += 6;
          doc.rect(margin, currentY, contentW, photoBoxH, 'D');
        }

        renderPhotoGrid(pagePhotos, currentY, pageIdx * 4);

        doc.setFont(fontName, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(currentPageIndex.toString(), pageW / 2, pageH - 8, { align: 'center' });
      });
    } else {
      // Page 2 Footer if no photos
      doc.setFont(fontName, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(currentPageIndex.toString(), pageW / 2, pageH - 8, { align: 'center' });
    }


    // ==========================================
    // PAGE SIGNATURES & AUTHOR
    // ==========================================
    currentPageIndex++;
    doc.addPage();
    drawHeaderLogos();

    y = 28;

    // Author Text Line
    doc.setFont(fontName, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`AUTHOR BY, ${sanitizePdfText(data.authorName) || 'Rizki Novri Yanda - Data Center Operation'}`, margin, y);

    y += 7;

    const sigCellW = contentW / 2;
    const headerBarH = 6.5;
    const sigImageH = 28;
    const nameBoxH = 11;
    const totalBoxH = headerBarH + sigImageH + nameBoxH; // 45.5mm total box height

    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);

    // ------------------------------------------
    // ROW 1: PREPARED BY & REVIEWED BY
    // ------------------------------------------
    // PREPARED BY Box
    doc.rect(margin, y, sigCellW, totalBoxH, 'D');
    doc.setFillColor(...HEADER_FILL);
    doc.rect(margin, y, sigCellW, headerBarH, 'FD');
    doc.setFont(fontName, 'bold').setFontSize(8.5).setTextColor(0, 0, 0);
    doc.text('PREPARED BY,', margin + sigCellW / 2, y + 4.5, { align: 'center' });

    // Draw Prepared Signature if available
    if ((data as any).preparedBySign) {
      try {
        doc.addImage((data as any).preparedBySign, 'PNG', margin + (sigCellW - 35) / 2, y + headerBarH + 2, 35, sigImageH - 4);
      } catch { /* ignore */ }
    }

    // Prepared Name & Title Divider Line
    const row1NameY = y + headerBarH + sigImageH;
    doc.line(margin, row1NameY, margin + sigCellW, row1NameY);
    doc.setFont(fontName, 'bold').setFontSize(8.5).setTextColor(0, 0, 0);
    doc.text(sanitizePdfText(data.preparedByName) || 'Salman', margin + sigCellW / 2, row1NameY + 4.2, { align: 'center' });
    doc.setFont(fontName, 'normal').setFontSize(7.5).setTextColor(50, 50, 50);
    doc.text(sanitizePdfText(data.preparedByTitle) || '(Electrical Engineer)', margin + sigCellW / 2, row1NameY + 8.5, { align: 'center' });

    // REVIEWED BY Box
    const revX = margin + sigCellW;
    doc.rect(revX, y, sigCellW, totalBoxH, 'D');
    doc.setFillColor(...HEADER_FILL);
    doc.rect(revX, y, sigCellW, headerBarH, 'FD');
    doc.setFont(fontName, 'bold').setFontSize(8.5).setTextColor(0, 0, 0);
    doc.text('REVIEWED BY,', revX + sigCellW / 2, y + 4.5, { align: 'center' });

    // Draw Reviewed Signature if available
    if ((data as any).reviewedBySign) {
      try {
        doc.addImage((data as any).reviewedBySign, 'PNG', revX + (sigCellW - 35) / 2, y + headerBarH + 2, 35, sigImageH - 4);
      } catch { /* ignore */ }
    }

    // Reviewed Name & Title Divider Line
    doc.line(revX, row1NameY, revX + sigCellW, row1NameY);
    doc.setFont(fontName, 'bold').setFontSize(8.5).setTextColor(0, 0, 0);
    doc.text(sanitizePdfText(data.reviewedByName) || 'Arif Budiman', revX + sigCellW / 2, row1NameY + 4.2, { align: 'center' });
    doc.setFont(fontName, 'normal').setFontSize(7.5).setTextColor(50, 50, 50);
    doc.text(sanitizePdfText(data.reviewedByTitle) || '(Technical Manager)', revX + sigCellW / 2, row1NameY + 8.5, { align: 'center' });

    y += totalBoxH + 4;

    // ------------------------------------------
    // ROW 2: ACKNOWLEDGED BY (Full Header + 2 Columns)
    // ------------------------------------------
    doc.rect(margin, y, contentW, totalBoxH, 'D');
    // Header bar spanning full content width
    doc.setFillColor(...HEADER_FILL);
    doc.rect(margin, y, contentW, headerBarH, 'FD');
    doc.setFont(fontName, 'bold').setFontSize(8.5).setTextColor(0, 0, 0);
    doc.text('ACKNOWLEDGED BY,', pageW / 2, y + 4.5, { align: 'center' });

    // Vertical middle divider line between Acknowledged 1 and Acknowledged 2
    doc.line(margin + sigCellW, y + headerBarH, margin + sigCellW, y + totalBoxH);

    // Acknowledged 1 (Left) Signature
    if ((data as any).acknowledgedBy1Sign) {
      try {
        doc.addImage((data as any).acknowledgedBy1Sign, 'PNG', margin + (sigCellW - 35) / 2, y + headerBarH + 2, 35, sigImageH - 4);
      } catch { /* ignore */ }
    }

    // Acknowledged 2 (Right) Signature
    if ((data as any).acknowledgedBy2Sign) {
      try {
        doc.addImage((data as any).acknowledgedBy2Sign, 'PNG', revX + (sigCellW - 35) / 2, y + headerBarH + 2, 35, sigImageH - 4);
      } catch { /* ignore */ }
    }

    // Name & Title Divider Line
    const row2NameY = y + headerBarH + sigImageH;
    doc.line(margin, row2NameY, margin + contentW, row2NameY);

    // Acknowledged 1 Text
    doc.setFont(fontName, 'bold').setFontSize(8.5).setTextColor(0, 0, 0);
    doc.text(sanitizePdfText(data.acknowledgedBy1Name) || 'Andrean Bima Pratama', margin + sigCellW / 2, row2NameY + 4.2, { align: 'center' });
    doc.setFont(fontName, 'normal').setFontSize(7.5).setTextColor(50, 50, 50);
    doc.text(sanitizePdfText(data.acknowledgedBy1Title) || '(Chief Engineer)', margin + sigCellW / 2, row2NameY + 8.5, { align: 'center' });

    // Acknowledged 2 Text
    doc.setFont(fontName, 'bold').setFontSize(8.5).setTextColor(0, 0, 0);
    doc.text(sanitizePdfText(data.acknowledgedBy2Name) || 'Supriyatno', revX + sigCellW / 2, row2NameY + 4.2, { align: 'center' });
    doc.setFont(fontName, 'normal').setFontSize(7.5).setTextColor(50, 50, 50);
    doc.text(sanitizePdfText(data.acknowledgedBy2Title) || '(Facility manager)', revX + sigCellW / 2, row2NameY + 8.5, { align: 'center' });

    y += totalBoxH + 4;

    // ------------------------------------------
    // ROW 3: APPROVED BY (Centered Box)
    // ------------------------------------------
    const appW = contentW * 0.6; // 60% width centered
    const appX = margin + (contentW - appW) / 2;

    doc.rect(appX, y, appW, totalBoxH, 'D');
    doc.setFillColor(...HEADER_FILL);
    doc.rect(appX, y, appW, headerBarH, 'FD');
    doc.setFont(fontName, 'bold').setFontSize(8.5).setTextColor(0, 0, 0);
    doc.text('APPROVED BY,', appX + appW / 2, y + 4.5, { align: 'center' });

    if ((data as any).approvedBySign) {
      try {
        doc.addImage((data as any).approvedBySign, 'PNG', appX + (appW - 35) / 2, y + headerBarH + 2, 35, sigImageH - 4);
      } catch { /* ignore */ }
    }

    // Approved Name & Title Divider Line
    const row3NameY = y + headerBarH + sigImageH;
    doc.line(appX, row3NameY, appX + appW, row3NameY);

    doc.setFont(fontName, 'bold').setFontSize(8.5).setTextColor(0, 0, 0);
    doc.text(sanitizePdfText(data.approvedByName) || 'Budi Susanto', appX + appW / 2, row3NameY + 4.2, { align: 'center' });
    doc.setFont(fontName, 'normal').setFontSize(7.5).setTextColor(50, 50, 50);
    doc.text(sanitizePdfText(data.approvedByTitle) || '(Assistant manager HDC Facility Management)', appX + appW / 2, row3NameY + 8.5, { align: 'center' });

    // Page Footer
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(currentPageIndex.toString(), pageW / 2, pageH - 8, { align: 'center' });

    // File Name
    const cleanFileName = `CM_Report_${(data.incidentName || 'Corrective').replace(/[^a-zA-Z0-9_\-]/g, '_')}_${data.incidentDate || '2026'}.pdf`;

    doc.save(cleanFileName);
    toast.success('PDF Laporan Corrective Maintenance berhasil dibuat!', { id: toastId });
  } catch (error: any) {
    console.error('Error generating CM PDF:', error);
    toast.error(`Gagal membuat PDF: ${error?.message || error}`, { id: toastId });
  }
}
