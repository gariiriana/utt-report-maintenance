import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FindingRecord } from '../types/finding';
import { loadLogoBase64 } from './ReportPdfExport';
import logoNeutra from '@/assets/logo_neutradc.png';
import logoDME from '@/assets/logo_dwimitra_v2.png';


function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = base64;
  });
}


export async function exportFindingsToPDF(findings: FindingRecord[]): Promise<void> {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageWidth - 2 * margin;

  const THEME_BLUE = '#00599c';
  const DARK = '#1e293b';
  const GRAY = '#64748b';
  const SLATE_200 = '#e2e8f0';
  const AMBER = '#f59e0b';

  const [leftLogo, rightLogo] = await Promise.all([
    loadLogoBase64(logoNeutra),
    loadLogoBase64(logoDME),
  ]);

  const drawHeader = (currentDoc: jsPDF): number => {
    currentDoc.setFillColor(THEME_BLUE);
    currentDoc.rect(0, 0, pageWidth, 2.5, 'F');

    const headerH = 24;
    const headerY = 6;

    currentDoc.setDrawColor(SLATE_200);
    currentDoc.setLineWidth(0.15);
    currentDoc.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');

    const col1W = 35;
    const col3W = 35;
    currentDoc.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
    currentDoc.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);

    if (leftLogo) {
      currentDoc.addImage(leftLogo, 'JPEG', margin + 3, headerY + 4, col1W - 6, 16, 'logo_neutra', 'FAST');
    }

    if (rightLogo) {
      currentDoc.addImage(rightLogo, 'JPEG', pageWidth - margin - col3W + 5, headerY + 5, col3W - 10, 14, 'logo_dme', 'FAST');
    }

    const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
    currentDoc.setFontSize(12).setFont('helvetica', 'bold').setTextColor(THEME_BLUE);
    currentDoc.text('LAPORAN TEMUAN MAINTENANCE', centerX, headerY + 8, { align: 'center' });

    currentDoc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(DARK);
    currentDoc.text('MAINTENANCE FINDING REPORT', centerX, headerY + 13, { align: 'center' });

    const now = new Date().toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    currentDoc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(GRAY);
    currentDoc.text(`Generated: ${now}`, centerX, headerY + 17.5, { align: 'center' });

    currentDoc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(AMBER);
    currentDoc.text(`Total Temuan: ${findings.length} item`, centerX, headerY + 21.5, { align: 'center' });

    return headerY + headerH + 6;
  };

  const drawFooter = (currentDoc: jsPDF, pg: number, totalPages: number) => {
    currentDoc.setFillColor(THEME_BLUE);
    currentDoc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');

    currentDoc.setFontSize(7).setTextColor(GRAY);
    currentDoc.text('PT DWIMITRA EKATAMA MANDIRI — Maintenance Finding Report', margin, pageHeight - 6);
    currentDoc.text(`Halaman ${pg} dari ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  };

  let curY = drawHeader(doc);

  const tableData = findings.map((f, idx) => [
    String(idx + 1),
    f.partName || '-',
    f.partNumber || '-',
    f.brandName || '-',
    String(f.quantity || 0),
    f.remark || '-',
    f.createdAt?.toDate?.()?.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
    }) || '-',
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['No.', 'Nama Part', 'No. Part', 'Brand', 'Qty', 'Remark', 'Tanggal']],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [0, 89, 156],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { halign: 'center', cellWidth: 12 },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 22, halign: 'center' },
    },
    didDrawPage: (data: any) => {
      if (data.pageNumber > 1) {
        drawHeader(doc);
      }
    },
  });

  const findingsWithPhotos = findings.filter((f) => f.photos && f.photos.length > 0);

  if (findingsWithPhotos.length > 0) {
    doc.addPage();
    curY = drawHeader(doc);

    doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(THEME_BLUE);
    doc.text('DOKUMENTASI FOTO TEMUAN', pageWidth / 2, curY, { align: 'center' });
    curY += 6;

    for (let fIdx = 0; fIdx < findingsWithPhotos.length; fIdx++) {
      const finding = findingsWithPhotos[fIdx];

      if (curY > pageHeight - 80) {
        doc.addPage();
        curY = drawHeader(doc);
      }

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(SLATE_200);
      doc.setLineWidth(0.15);
      doc.roundedRect(margin, curY, contentW, 10, 1, 1, 'FD');

      doc.setFillColor(THEME_BLUE);
      doc.rect(margin, curY, 3, 10, 'F');

      doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(DARK);
      doc.text(`${fIdx + 1}. ${finding.partName}`, margin + 6, curY + 4);
      doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(GRAY);
      doc.text(`P/N: ${finding.partNumber} | Brand: ${finding.brandName || '-'} | Qty: ${finding.quantity}`, margin + 6, curY + 8);
      curY += 14;

      const photoCols = 2;
      const photoW = (contentW - 4) / photoCols;
      const photoH = 60; 
      const captionH = 8;

      for (let pIdx = 0; pIdx < finding.photos.length; pIdx += photoCols) {
        if (curY + photoH + captionH + 4 > pageHeight - 15) {
          doc.addPage();
          curY = drawHeader(doc);
        }

        const row = finding.photos.slice(pIdx, pIdx + photoCols);
        for (let j = 0; j < row.length; j++) {
          const photo = row[j];
          const x = margin + j * (photoW + 4);

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(SLATE_200);
          doc.setLineWidth(0.2);
          doc.roundedRect(x, curY, photoW, photoH + captionH, 1, 1, 'FD');

          if (photo.base64) {
            try {
              const dims = await getImageDimensions(photo.base64);
              let drawW = photoW - 2;
              let drawH = photoH - 2;

              if (dims.width > 0 && dims.height > 0) {
                const containerRatio = drawW / drawH;
                const imgRatio = dims.width / dims.height;

                if (imgRatio > containerRatio) {
                  drawH = drawW / imgRatio;
                } else {
                  drawW = drawH * imgRatio;
                }
              }

              const offsetX = (photoW - drawW) / 2;
              const offsetY = (photoH - drawH) / 2;

              doc.addImage(
                photo.base64,
                'JPEG',
                x + offsetX,
                curY + offsetY,
                drawW,
                drawH,
                `fp_${fIdx}_${pIdx + j}`,
                'FAST'
              );
            } catch (err) {
              console.error('Error adding image to PDF:', err);
              doc.setFontSize(7).setTextColor(GRAY);
              doc.text('Image Error', x + photoW / 2, curY + photoH / 2, { align: 'center' });
            }
          }

          doc.setDrawColor(SLATE_200);
          doc.line(x, curY + photoH, x + photoW, curY + photoH);

          if (photo.description) {
            doc.setFillColor(THEME_BLUE);
            doc.rect(x + 2, curY + photoH + 2, 0.4, 4, 'F');

            doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(DARK);
            const lines = doc.splitTextToSize(photo.description, photoW - 8);
            doc.text(lines.slice(0, 2), x + 4, curY + photoH + 4.5);
          }
        }

        curY += photoH + captionH + 4;
      }

      curY += 2;
    }
  }

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    drawFooter(doc, pg, totalPages);
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  doc.save(`Laporan_Temuan_Maintenance_${dateStr}.pdf`);
}

