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
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

export async function generateCMReportPDF(data: CMReportData) {
  const toastId = toast.loading('Memproses PDF Corrective Maintenance...');

  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentW = pageW - 2 * margin;

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
            return { base64: compressed, description: p.description || '' };
          } catch {
            return { base64: p.photoBase64, description: p.description || '' };
          }
        })
      );
    }

    const HEADER_FILL: [number, number, number] = [220, 230, 241]; // Light blue fill matching screenshot
    const BORDER_COLOR: [number, number, number] = [160, 160, 160];

    // Helper: Draw Header Logos
    const drawHeaderLogos = () => {
      if (logoLeft) {
        doc.addImage(logoLeft, 'JPEG', margin, 8, 30, 12);
      }
      if (logoRight) {
        doc.addImage(logoRight, 'JPEG', pageW - margin - 32, 8, 32, 12);
      }
    };

    // ==========================================
    // PAGE 1: INCIDENT, EQUIPMENT & ANALYSIS
    // ==========================================
    drawHeaderLogos();

    let y = 28;

    // Document Title
    doc.setFont('helvetica', 'bold');
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
        data.incidentName || 'N/A',
        data.location || 'N/A',
        data.incidentDate || 'N/A',
        data.incidentId || 'N/A'
      ]],
      theme: 'grid',
      headStyles: {
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
        data.equipmentName || 'N/A',
        data.brand || 'N/A',
        data.serialNumber || 'N/A',
        data.installationDate || 'N/A'
      ]],
      theme: 'grid',
      headStyles: {
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
    const formattedAction = (data.correctiveAction || '-')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.startsWith('⚫') || line.startsWith('•') ? line : `⚫  ${line}`)
      .join('\n');

    const repairTimeStr = `Start  : ${data.repairTimeStart || '-'}\nEnd   : ${data.repairTimeEnd || '-'}`;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['CORRECTIVE ACTION', 'REPAIR TIME', 'RESULT']],
      body: [[
        formattedAction,
        repairTimeStr,
        data.result || '-'
      ]],
      theme: 'grid',
      headStyles: {
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
    const drawSectionBox = (title: string, contentText: string, minBoxHeight: number) => {
      // Header bar
      doc.setFillColor(...HEADER_FILL);
      doc.setDrawColor(...BORDER_COLOR);
      doc.setLineWidth(0.2);
      doc.rect(margin, y, contentW, 6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(title, margin + 2, y + 4.2);

      y += 6;

      // Text box
      doc.setFont('helvetica', 'normal');
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
      data.visualInspectionChecking || 'N/A',
      18
    );

    // SECTION: CLEANING & PREVENTIVE METHOD
    drawSectionBox(
      'CLEANING & PREVENTIVE METHOD',
      data.cleaningPreventiveMethod || 'N/A',
      18
    );

    // SECTION: SUMMARY CORRECTIVE REPORT (PROBLEM ANALYSIS)
    drawSectionBox(
      'SUMMARY CORRECTIVE REPORT (PROBLEM ANALYSIS)',
      data.summaryProblemAnalysis || 'N/A',
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
          sp.name || '-',
          sp.brand || '-',
          sp.qty || '-'
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
      headStyles: {
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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text('SUPPORTING DOCUMENTATION', margin, y);

    y += 5;

    // Outer Box: VISUAL INSPECTION & CHECKING PHOTOS
    doc.setFillColor(...HEADER_FILL);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('VISUAL INSPECTION & CHECKING', margin + 2, y + 4.2);

    y += 6;

    const photoBoxH = 155;
    doc.rect(margin, y, contentW, photoBoxH, 'D');

    // Draw photos inside photo box (up to 10 photos in grid across pages if >6)
    const validPhotos = processedPhotos.filter(p => p.base64).slice(0, 10);
    let currentPageIndex = 2;

    if (validPhotos.length > 0) {
      const page1Photos = validPhotos.slice(0, Math.min(validPhotos.length, 6));
      const page2Photos = validPhotos.length > 6 ? validPhotos.slice(6, 10) : [];

      // Helper function to draw a grid of photos on current page
      const renderPhotoGrid = (photos: { base64: string; description: string }[], boxY: number) => {
        const numPhotos = photos.length;
        if (numPhotos === 1) {
          const imgW = 120;
          const imgH = 125;
          const imgX = margin + (contentW - imgW) / 2;
          const imgY = boxY + 8;
          doc.addImage(photos[0].base64, 'JPEG', imgX, imgY, imgW, imgH);
          if (photos[0].description) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(50, 50, 50);
            doc.text(`Ket: ${photos[0].description}`, pageW / 2, imgY + imgH + 5, { align: 'center', maxWidth: imgW });
          }
        } else if (numPhotos === 2) {
          const gap = 4;
          const availW = contentW - 10;
          const singleW = (availW - gap) / 2;
          const singleH = 125;
          const imgY = boxY + 8;

          photos.forEach((item, idx) => {
            const imgX = margin + 5 + idx * (singleW + gap);
            doc.addImage(item.base64, 'JPEG', imgX, imgY, singleW, singleH);
            if (item.description) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(50, 50, 50);
              doc.text(`Ket: ${item.description}`, imgX + singleW / 2, imgY + singleH + 5, { align: 'center', maxWidth: singleW });
            }
          });
        } else if (numPhotos <= 4) {
          const gap = 4;
          const availW = contentW - 10;
          const singleW = (availW - gap) / 2;
          const singleH = 58;

          photos.forEach((item, idx) => {
            const row = Math.floor(idx / 2);
            const col = idx % 2;
            const imgX = margin + 5 + col * (singleW + gap);
            const imgY = boxY + 6 + row * (singleH + 12);
            doc.addImage(item.base64, 'JPEG', imgX, imgY, singleW, singleH);
            if (item.description) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7.5);
              doc.setTextColor(50, 50, 50);
              doc.text(`Ket: ${item.description}`, imgX + singleW / 2, imgY + singleH + 4, { align: 'center', maxWidth: singleW });
            }
          });
        } else {
          // 5 to 6 photos in 2x3 grid
          const gap = 4;
          const availW = contentW - 10;
          const singleW = (availW - gap) / 2;
          const singleH = 38;

          photos.forEach((item, idx) => {
            const row = Math.floor(idx / 2);
            const col = idx % 2;
            const imgX = margin + 5 + col * (singleW + gap);
            const imgY = boxY + 5 + row * (singleH + 10);
            doc.addImage(item.base64, 'JPEG', imgX, imgY, singleW, singleH);
            if (item.description) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7);
              doc.setTextColor(50, 50, 50);
              doc.text(`Ket: ${item.description}`, imgX + singleW / 2, imgY + singleH + 3.5, { align: 'center', maxWidth: singleW });
            }
          });
        }
      };

      // Draw first page of photos (Page 2)
      renderPhotoGrid(page1Photos, y);

      // Page 2 Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(currentPageIndex.toString(), pageW / 2, pageH - 8, { align: 'center' });

      // If photos 7-10 exist, add continuation page
      if (page2Photos.length > 0) {
        currentPageIndex++;
        doc.addPage();
        drawHeaderLogos();
        let contY = 28;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        doc.text('SUPPORTING DOCUMENTATION (LANJUTAN)', margin, contY);

        contY += 5;

        doc.setFillColor(...HEADER_FILL);
        doc.setDrawColor(...BORDER_COLOR);
        doc.setLineWidth(0.2);
        doc.rect(margin, contY, contentW, 6, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text('VISUAL INSPECTION & CHECKING (SAMBUNGAN FOTO 7-10)', margin + 2, contY + 4.2);

        contY += 6;
        doc.rect(margin, contY, contentW, photoBoxH, 'D');

        renderPhotoGrid(page2Photos, contY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(currentPageIndex.toString(), pageW / 2, pageH - 8, { align: 'center' });
      }
    } else {
      // Page 2 Footer if no photos
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(currentPageIndex.toString(), pageW / 2, pageH - 8, { align: 'center' });
    }


    // ==========================================
    // PAGE 3: SIGNATURES & AUTHOR
    // ==========================================
    doc.addPage();
    drawHeaderLogos();

    y = 28;

    // Author Text Line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`AUTHOR BY, ${data.authorName || 'Rizki Novri Yanda – Data Center Operation'}`, margin, y);

    y += 8;

    // Signature Table Grid (Matching Screenshot)
    const sigCellW = contentW / 2;
    const sigBoxH = 42;

    // Row 1: PREPARED BY & REVIEWED BY
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);

    // Box PREPARED BY
    doc.rect(margin, y, sigCellW, sigBoxH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('PREPARED BY,', margin + sigCellW / 2, y + 5, { align: 'center' });
    doc.text(data.preparedByName || 'Salman', margin + sigCellW / 2, y + sigBoxH - 7, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(data.preparedByTitle || '(Electrical Engineer)', margin + sigCellW / 2, y + sigBoxH - 2.5, { align: 'center' });

    // Box REVIEWED BY
    doc.rect(margin + sigCellW, y, sigCellW, sigBoxH);
    doc.setFont('helvetica', 'bold');
    doc.text('REVIEWED BY,', margin + sigCellW + sigCellW / 2, y + 5, { align: 'center' });
    doc.text(data.reviewedByName || 'Arif Budiman', margin + sigCellW + sigCellW / 2, y + sigBoxH - 7, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(data.reviewedByTitle || '(Technical Manager)', margin + sigCellW + sigCellW / 2, y + sigBoxH - 2.5, { align: 'center' });

    y += sigBoxH;

    // Row 2: ACKNOWLEDGED BY (Header bar + 2 split cells)
    doc.rect(margin, y, contentW, sigBoxH);
    doc.setFont('helvetica', 'bold');
    doc.text('ACKNOWLEDGED BY,', pageW / 2, y + 5, { align: 'center' });

    // Acknowledged 1 (Left)
    doc.text(data.acknowledgedBy1Name || 'Andrean Bima Pratama', margin + sigCellW / 2, y + sigBoxH - 7, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(data.acknowledgedBy1Title || '(Chief Engineer)', margin + sigCellW / 2, y + sigBoxH - 2.5, { align: 'center' });

    // Acknowledged 2 (Right)
    doc.setFont('helvetica', 'bold');
    doc.text(data.acknowledgedBy2Name || 'Supriyatno', margin + sigCellW + sigCellW / 2, y + sigBoxH - 7, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(data.acknowledgedBy2Title || '(Facility manager)', margin + sigCellW + sigCellW / 2, y + sigBoxH - 2.5, { align: 'center' });

    y += sigBoxH;

    // Row 3: APPROVED BY (Center box matching screenshot)
    const appW = contentW * 0.6;
    const appX = margin + (contentW - appW) / 2;

    doc.rect(appX, y, appW, sigBoxH);
    doc.setFont('helvetica', 'bold');
    doc.text('APPROVED BY,', appX + appW / 2, y + 5, { align: 'center' });
    doc.text(data.approvedByName || 'Budi Susanto', appX + appW / 2, y + sigBoxH - 7, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(data.approvedByTitle || '(Assistant manager HDC Facility Management)', appX + appW / 2, y + sigBoxH - 2.5, { align: 'center' });

    // Page 3 Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('3', pageW / 2, pageH - 8, { align: 'center' });

    // File Name
    const cleanFileName = `CM_Report_${(data.incidentName || 'Corrective').replace(/[^a-zA-Z0-9_\-]/g, '_')}_${data.incidentDate || '2026'}.pdf`;

    doc.save(cleanFileName);
    toast.success('PDF Laporan Corrective Maintenance berhasil dibuat!', { id: toastId });
  } catch (error: any) {
    console.error('Error generating CM PDF:', error);
    toast.error(`Gagal membuat PDF: ${error?.message || error}`, { id: toastId });
  }
}
