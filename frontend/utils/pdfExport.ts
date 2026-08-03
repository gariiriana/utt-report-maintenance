import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadLogoBase64 } from './ReportPdfExport';
import logoNeutra from '@/assets/logo_neutradc.png';
import logoDME from '@/assets/logo_dwimitra_v2.png';

export interface CorrectiveReport {
  id: string;
  issue: string;
  actionTaken: string;
  spareParts: string;
  status: 'Open' | 'InProgress' | 'Resolved';
  location: string;
  photoBase64: string;
  photoDescription: string;
  quarter: string;
  year: string;
  category: string;
  reportedBy: string;
  reportedByEmail: string;
  reportedAt: any;

  // SLA/PIR/CM_PDF fields
  reportType?: 'SLA' | 'CM_PDF' | 'PIR' | string;
  ticketName?: string;
  priority?: 'Low' | 'Medium' | 'High';
  picDME?: string;
  picTDE?: string;
  remark?: string;
  actualResponseTimeMin?: number;
  targetResponseMin?: number;
  responseComply?: boolean;
  photoResponse?: string;
  photoEngineerOnsite?: string;
  actualOnsiteTimeMin?: number;
  targetOnsiteMin?: number;
  onsiteComply?: boolean;
  photoOnsite?: string;
  actualRestoreTimeMin?: number;
  targetRestoreMin?: number;
  restoreComply?: boolean;
  photoRestore?: string;
  actualResolutionTimeMin?: number;
  targetResolutionMin?: number;
  resolutionComply?: boolean;
  photoResolution?: string;
  timeOrder?: string;
  actualTimeResponse?: string;
  actualTimeOnsite?: string;
  startOrder?: string;
  finishOrder?: string;
}

function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = base64;
  });
}

export async function exportMonthlyPDF(
  reports: CorrectiveReport[],
  monthName: string,
  yearStr: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageWidth - 2 * margin;

  const THEME_BLUE = '#00599c';
  const THEME_NAVY = '#0f172a';
  const DARK = '#1e293b';
  const GRAY = '#64748b';
  const SLATE_200 = '#e2e8f0';
  const EMERALD = '#10b981';
  const AMBER = '#f59e0b';
  const ROSE = '#f43f5e';

  // Load logos
  const [leftLogo, rightLogo] = await Promise.all([
    loadLogoBase64(logoDME),
    loadLogoBase64(logoNeutra),
  ]);

  // Filter reports by type (used for appendix sections)
  const standardReports = reports.filter((r) => r.reportType !== 'SLA');
  const slaReports = reports.filter((r) => r.reportType === 'SLA');

  // Header Draw helper
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
      currentDoc.addImage(leftLogo, 'PNG', margin + 3, headerY + 4, col1W - 6, 16, 'logo_neutra_monthly', 'FAST');
    }

    if (rightLogo) {
      currentDoc.addImage(rightLogo, 'PNG', pageWidth - margin - col3W + 5, headerY + 5, col3W - 10, 14, 'logo_dme_monthly', 'FAST');
    }

    const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
    currentDoc.setFontSize(11).setFont('helvetica', 'bold').setTextColor(THEME_BLUE);
    currentDoc.text('LAPORAN BULANAN CORRECTIVE MAINTENANCE', centerX, headerY + 8, { align: 'center' });

    currentDoc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(DARK);
    currentDoc.text(`PERIODE: ${monthName.toUpperCase()} ${yearStr}`, centerX, headerY + 13.5, { align: 'center' });

    const nowStr = new Date().toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    currentDoc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(GRAY);
    currentDoc.text(`Dibuat: ${nowStr} WIB`, centerX, headerY + 18.5, { align: 'center' });

    return headerY + headerH + 6;
  };

  // Footer Draw helper
  const drawFooter = (currentDoc: jsPDF, pg: number, totalPages: number) => {
    currentDoc.setFillColor(THEME_BLUE);
    currentDoc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');

    currentDoc.setFontSize(7).setTextColor(GRAY);
    currentDoc.text('PT DWIMITRA EKATAMA MANDIRI — Laporan Bulanan Corrective Maintenance', margin, pageHeight - 6);
    currentDoc.text(`Halaman ${pg} dari ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  };

  // --- PAGE 1: COVER & TABLE ---
  let curY = drawHeader(doc);

  // Section: Master Table List
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(THEME_NAVY);
  doc.text('DAFTAR INDEKS GANGGUAN', margin, curY);
  curY += 5;

  const tableData = reports.map((r, idx) => {
    let typeLabel = 'STANDAR';
    let statusLabel: string = r.status;
    let title = r.issue || '-';
    let action = r.actionTaken || '-';

    if (r.reportType === 'SLA') {
      typeLabel = 'SLA/SLG CM';
      title = r.ticketName || '-';
      action = r.remark || '-';
      
      // Calculate SLA compliance: Memenuhi / Tidak Memenuhi
      let complies = 0;
      let total = 0;
      if (r.actualResponseTimeMin !== undefined) { total++; if (r.responseComply) complies++; }
      if (r.actualOnsiteTimeMin !== undefined) { total++; if (r.onsiteComply) complies++; }
      if (r.actualRestoreTimeMin !== undefined) { total++; if (r.restoreComply) complies++; }
      if (r.actualResolutionTimeMin !== undefined) { total++; if (r.resolutionComply) complies++; }
      
      statusLabel = (total > 0 && complies === total) ? 'Memenuhi' : 'Tidak Memenuhi';
    }

    let dateVal = '';
    if (r.reportType === 'SLA' && r.timeOrder) {
      const d = new Date(r.timeOrder);
      dateVal = isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } else {
      dateVal = r.reportedAt?.toDate?.()?.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric'
      }) || new Date().toLocaleDateString('id-ID');
    }

    return [
      String(idx + 1),
      dateVal,
      r.location || '-',
      title,
      action,
      typeLabel,
      statusLabel,
    ];
  });

  autoTable(doc, {
    startY: curY,
    head: [['No.', 'Tanggal', 'Lokasi', 'Jenis Corrective Maintenance', 'Remark / Tindakan Penanganan', 'Jenis', 'Status SLA/SLG']],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7,
      cellPadding: 2,
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
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 20 },
      2: { cellWidth: 25 },
      3: { cellWidth: 40 },
      4: { cellWidth: 'auto' },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'center', cellWidth: 18 },
    },
    didDrawPage: (data: any) => {
      if (data.pageNumber > 1) {
        drawHeader(doc);
      }
    },
  });

  // --- APPENDIX SECTION: DETAILED SHEETS WITH SCREENSHOT GALLERY ---
  // We separate standard reports (2 per page) and SLA reports (1 per page)
  
  // A. Detailed SLA Reports (1 per page)
  for (let sIdx = 0; sIdx < slaReports.length; sIdx++) {
    const report = slaReports[sIdx];
    doc.addPage();
    curY = drawHeader(doc);

    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(SLATE_200);
    doc.roundedRect(margin, curY, contentW, 10, 1, 1, 'FD');
    doc.setFillColor(ROSE).rect(margin, curY, 3, 10, 'F');
    doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text(`LAMPIRAN SLA ${sIdx + 1}: ${report.ticketName}`, margin + 5, curY + 6.5);
    curY += 14;

    // Detailed Info Rows (4 columns)
    doc.setFillColor(250, 250, 250).setDrawColor(SLATE_200).roundedRect(margin, curY, contentW, 16, 1, 1, 'FD');
    
    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY);
    doc.text('LOKASI GANGGUAN', margin + 5, curY + 5);
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text(report.location || '-', margin + 5, curY + 11);

    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY);
    doc.text('PIC DME MAINTENANCE', margin + 48, curY + 5);
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text(report.picDME || '-', margin + 48, curY + 11);

    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY);
    doc.text('PIC TDE TECHNICAL', margin + 92, curY + 5);
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text(report.picTDE || '-', margin + 92, curY + 11);

    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY);
    doc.text('WAKTU ORDER (TIME ORDER)', margin + 135, curY + 5);
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(DARK);
    const timeOrderFormatted = report.timeOrder ? new Date(report.timeOrder).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) + ' WIB' : '-';
    doc.text(timeOrderFormatted, margin + 135, curY + 11);

    curY += 16 + 4; // Move below the metadata box

    // Separate full-width box for TINDAKAN / REMARK
    const maxRemarkW = contentW - 10;
    const remarkLines = doc.splitTextToSize(report.remark || '-', maxRemarkW);
    const remarkLinesCount = remarkLines.length;
    // Calculate box height dynamically (each line ~4mm, plus padding)
    const remarkBoxH = Math.max(16, remarkLinesCount * 4 + 8);

    doc.setFillColor(250, 250, 250).setDrawColor(SLATE_200).roundedRect(margin, curY, contentW, remarkBoxH, 1, 1, 'FD');
    
    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY);
    doc.text('TINDAKAN PERBAIKAN (ACTION TAKEN) / REMARK', margin + 5, curY + 5.5);
    
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(DARK);
    // Draw all lines of the remark cleanly
    doc.text(remarkLines, margin + 5, curY + 11);

    curY += remarkBoxH + 6;

    // SLA Duration Matrix
    doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(THEME_BLUE);
    doc.text('MATRIKS DURASI PENCAPAIAN SLA', margin, curY);
    curY += 4;

    const cellW = (contentW - 9) / 4;
    const cellH = 14;

    const drawSLACell = (x: number, title: string, duration: string, complies: boolean) => {
      doc.setFillColor(255, 255, 255).setDrawColor(SLATE_200).roundedRect(x, curY, cellW, cellH, 1, 1, 'FD');
      doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(GRAY).text(title, x + 3, curY + 4);
      doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(DARK).text(duration, x + 3, curY + 10);
      doc.setFontSize(6.5).setFont('helvetica', 'bold')
        .setTextColor(complies ? EMERALD : ROSE)
        .text(complies ? 'MEMENUHI' : 'TIDAK MEMENUHI', x + cellW - 18, curY + 10);
    };

    drawSLACell(margin, '1. RESPONSE TIME', `${report.actualResponseTimeMin} Min`, !!report.responseComply);
    drawSLACell(margin + cellW + 3, '2. ONSITE SUPPORT', `${report.actualOnsiteTimeMin} Min`, !!report.onsiteComply);
    drawSLACell(margin + (cellW + 3) * 2, '3. SERVICE RESTORE (RST)', `${report.actualRestoreTimeMin} Min`, !!report.restoreComply);
    drawSLACell(margin + (cellW + 3) * 3, '4. TOTAL RESOLUTION (RT)', `${report.actualResolutionTimeMin} Min`, !!report.resolutionComply);

    curY += cellH + 7;

    // SLA Screenshots Gallery (2x2 Grid)
    doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(THEME_BLUE);
    doc.text('DOKUMENTASI FOTO BUKTI SLA / SLG', margin, curY);
    curY += 4;

    const gridColW = (contentW - 4) / 2;
    const gridRowH = 32;
    const gridCapH = 5;

    const photosSla = [
      { base64: report.photoResponse, label: '1. Bukti Response Time' },
      { base64: report.photoEngineerOnsite, label: '2. Bukti Engineer Onsite Support' },
      { base64: report.photoOnsite, label: '3. Bukti Onsite Principle Engineer' },
      { base64: report.photoRestore, label: '4. Bukti Layanan Pulih (RST)' },
      { base64: report.photoResolution, label: '5. Bukti Tiket Closed (RT)' },
    ];

    for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
      for (let colIdx = 0; colIdx < 2; colIdx++) {
        const photoIdx = rowIdx * 2 + colIdx;
        if (photoIdx >= photosSla.length) break;
        const photo = photosSla[photoIdx];
        const x = margin + colIdx * (gridColW + 4);
        const y = curY + rowIdx * (gridRowH + gridCapH + 3);

        doc.setFillColor(255, 255, 255).setDrawColor(SLATE_200).roundedRect(x, y, gridColW, gridRowH + gridCapH, 1, 1, 'FD');
        
        if (photo.base64) {
          try {
            const dims = await getImageDimensions(photo.base64);
            let drawW = gridColW - 2;
            let drawH = gridRowH - 2;
            if (dims.width > 0 && dims.height > 0) {
              const contRatio = drawW / drawH;
              const imgRatio = dims.width / dims.height;
              if (imgRatio > contRatio) {
                drawH = drawW / imgRatio;
              } else {
                drawW = drawH * imgRatio;
              }
            }
            const offX = (gridColW - drawW) / 2;
            const offY = (gridRowH - drawH) / 2;
            
            doc.addImage(photo.base64, 'JPEG', x + offX, y + offY, drawW, drawH, `sla_${sIdx}_img_${rowIdx}_${colIdx}`, 'FAST');
          } catch (e) {
            doc.setFontSize(7).setTextColor(GRAY).text('Gagal Memuat Gambar', x + gridColW / 2, y + gridRowH / 2, { align: 'center' });
          }
        } else {
          doc.setFillColor(245, 245, 245).rect(x + 0.5, y + 0.5, gridColW - 1, gridRowH - 1, 'F');
          doc.setFontSize(7).setTextColor(GRAY).text('Tidak Ada Foto Bukti', x + gridColW / 2, y + gridRowH / 2, { align: 'center' });
        }

        doc.line(x, y + gridRowH, x + gridColW, y + gridRowH);
        doc.setFillColor(THEME_BLUE).rect(x + 2, y + gridRowH + 1.5, 0.4, 3, 'F');
        doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(DARK).text(photo.label, x + 3.5, y + gridRowH + 4);
      }
    }
  }

  // B. Detailed Standard Reports (2 per page)
  let stdPageCount = 0;
  for (let stdIdx = 0; stdIdx < standardReports.length; stdIdx++) {
    const report = standardReports[stdIdx];

    // Determine if we need a new page
    if (stdPageCount % 2 === 0) {
      doc.addPage();
      curY = drawHeader(doc);
    } else {
      curY = pageHeight / 2 + 5;
      doc.setDrawColor(SLATE_200).setLineWidth(0.2);
      doc.line(margin, pageHeight / 2, pageWidth - margin, pageHeight / 2);
    }

    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(SLATE_200);
    doc.roundedRect(margin, curY, contentW, 8, 1, 1, 'FD');
    doc.setFillColor(AMBER).rect(margin, curY, 3, 8, 'F');
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(DARK);
    doc.text(`LAMPIRAN STANDARD ${stdIdx + 1}: INCIDENT DI ${report.location?.toUpperCase()}`, margin + 5, curY + 5.5);
    curY += 12;

    const colWidth = (contentW - 4) / 2;

    // Text logs column
    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY).text('DESKRIPSI KERUSAKAN / GANGGUAN', margin, curY + 3);
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(DARK);
    const issueLines = doc.splitTextToSize(report.issue || '-', colWidth - 2);
    doc.text(issueLines.slice(0, 5), margin, curY + 7.5);

    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY).text('TINDAKAN PERBAIKAN (ACTION TAKEN)', margin, curY + 34);
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(DARK);
    const actionLines = doc.splitTextToSize(report.actionTaken || '-', colWidth - 2);
    doc.text(actionLines.slice(0, 5), margin, curY + 38.5);

    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(GRAY).text('SUKU CADANG (SPARE PARTS) / STATUS', margin, curY + 65);
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(DARK);
    doc.text(`Suku Cadang: ${report.spareParts || 'Tidak Ada'}`, margin, curY + 69.5);
    doc.text(`Status Laporan: ${report.status}`, margin, curY + 73.5);

    // Photo evidence column
    const photoX = margin + colWidth + 4;
    const photoH = 58;
    const photoW = colWidth;

    doc.setFillColor(255, 255, 255).setDrawColor(SLATE_200).roundedRect(photoX, curY, photoW, photoH + 12, 1, 1, 'FD');

    if (report.photoBase64) {
      try {
        const dims = await getImageDimensions(report.photoBase64);
        let drawW = photoW - 2;
        let drawH = photoH - 2;
        if (dims.width > 0 && dims.height > 0) {
          const contRatio = drawW / drawH;
          const imgRatio = dims.width / dims.height;
          if (imgRatio > contRatio) {
            drawH = drawW / imgRatio;
          } else {
            drawW = drawH * imgRatio;
          }
        }
        const offX = (photoW - drawW) / 2;
        const offY = (photoH - drawH) / 2;

        doc.addImage(report.photoBase64, 'JPEG', photoX + offX, curY + offY, drawW, drawH, `std_${stdIdx}_photo`, 'FAST');
      } catch (e) {
        doc.setFontSize(7).setTextColor(GRAY).text('Gagal Memuat Gambar', photoX + photoW / 2, curY + photoH / 2, { align: 'center' });
      }
    } else {
      doc.setFillColor(245, 245, 245).rect(photoX + 0.5, curY + 0.5, photoW - 1, photoH - 1, 'F');
      doc.setFontSize(7).setTextColor(GRAY).text('Tidak Ada Foto Bukti', photoX + photoW / 2, curY + photoH / 2, { align: 'center' });
    }

    doc.line(photoX, curY + photoH, photoX + photoW, curY + photoH);
    doc.setFillColor(THEME_BLUE).rect(photoX + 2, curY + photoH + 2.5, 0.4, 4, 'F');
    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(DARK).text('Foto Dokumentasi Lapangan', photoX + 3.5, curY + photoH + 5.5);
    
    const descText = report.photoDescription || 'Dokumentasi kerusakan/tindakan unit.';
    doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(GRAY);
    const descLines = doc.splitTextToSize(descText, photoW - 6);
    doc.text(descLines.slice(0, 1), photoX + 3.5, curY + photoH + 9.5);

    stdPageCount++;
  }

  // Render Footer on all pages
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    drawFooter(doc, pg, totalPages);
  }

  // Save the final professional PDF file
  const formattedMonth = monthName.replace(/[/\\?%*:|"<>]/g, ' ').trim();
  const formattedYear = yearStr.replace(/[/\\?%*:|"<>]/g, ' ').trim();
  doc.save(`Laporan_CM_Bulanan_${formattedMonth}_${formattedYear}.pdf`);
}
