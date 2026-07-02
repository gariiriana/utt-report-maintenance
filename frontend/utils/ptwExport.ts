import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadLogoBase64 } from './ReportPdfExport';
import logoNeutra from '@/assets/logo_neutradc.png';
import logoDME from '@/assets/logo_dwimitra_v2.png';
import { toast } from 'sonner';

export interface PTWExportRecord {
  id: string;
  ptwNumber: string;
  sequenceNumber: number;
  equipmentCode: string;
  quarter: string;
  startDate: string;
  endDate: string;
  notes?: string;
  fileName?: string;
  closingFileName?: string;
}

export interface WeeklyExportData {
  weekNum: number;
  dateRange: string;
  openCount: number;
  closedCount: number;
  totalCount: number;
  records: PTWExportRecord[];
}

// Utility to format date to Indonesian display format (e.g., "05 Jun 2026")
const formatIndoDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  
  return `${day} ${month} ${year}`;
};

// Colors and styling constants
const COLOR_BLUE = '00599C'; // Main Theme Blue
const COLOR_GRAY_BG = 'F8FAFC';
const COLOR_CLOSED_TEXT = 'EF4444'; // Red for closed
const COLOR_ACTIVE_TEXT = '10B981'; // Green for active

const thinBorder = {
  top: { style: 'thin' as const, color: { argb: 'BFBFBF' } },
  left: { style: 'thin' as const, color: { argb: 'BFBFBF' } },
  bottom: { style: 'thin' as const, color: { argb: 'BFBFBF' } },
  right: { style: 'thin' as const, color: { argb: 'BFBFBF' } },
};

// ==========================================
// 1. EXPORT GENERAL PTW LIST TO EXCEL
// ==========================================
export async function exportPTWListToExcel(records: PTWExportRecord[]) {
  const toastId = toast.loading('Sedang membuat berkas Excel...');
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT United Transworld Trading';
    workbook.lastModifiedBy = 'Data Center Maintenance System';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Daftar PTW');
    ws.views = [{ showGridLines: true }];

    // Load logos: DME on Left, Neutra on Right
    const [dmeLogo, neutraLogo] = await Promise.all([
      loadLogoBase64(logoDME),
      loadLogoBase64(logoNeutra),
    ]);

    // Row heights for header
    ws.getRow(1).height = 10;
    ws.getRow(2).height = 24;
    ws.getRow(3).height = 20;
    ws.getRow(4).height = 15;

    // Title Block
    ws.mergeCells('C2:E2');
    const titleCell = ws.getCell('C2');
    titleCell.value = 'DAFTAR DOKUMEN PERMIT TO WORK (PTW)';
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: '00599C' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells('C3:E3');
    const subtitleCell = ws.getCell('C3');
    subtitleCell.value = 'PT United Transworld Trading — Sistem Pemeliharaan Data Center';
    subtitleCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '555555' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add logos
    if (dmeLogo) {
      try {
        const dmeLogoId = workbook.addImage({
          base64: dmeLogo.split(',')[1],
          extension: 'png',
        });
        ws.addImage(dmeLogoId, {
          tl: { col: 0.1, row: 1.1 }, // Col A, Row 2 (Left)
          ext: { width: 85, height: 35 }
        });
      } catch (e) {
        console.error('Failed to add DME logo to Excel', e);
      }
    }

    if (neutraLogo) {
      try {
        const neutraLogoId = workbook.addImage({
          base64: neutraLogo.split(',')[1],
          extension: 'png',
        });
        ws.addImage(neutraLogoId, {
          tl: { col: 5.9, row: 1.1 }, // Col G, Row 2 (Right)
          ext: { width: 85, height: 35 }
        });
      } catch (e) {
        console.error('Failed to add Neutra logo to Excel', e);
      }
    }

    // Headers
    const headers = ['NO', 'NOMOR PTW', 'QUARTER', 'ALAT (EQUIPMENT CODE)', 'MASA BERLAKU', 'NAMA MAINTENANCE / CATATAN', 'STATUS'];
    const headerRow = ws.getRow(5);
    headerRow.height = 24;

    headers.forEach((header, index) => {
      const colLetter = String.fromCharCode(65 + index); // A, B, C...
      const cell = ws.getCell(`${colLetter}5`);
      cell.value = header;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_BLUE },
      };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });

    // Data rows
    records.forEach((rec, idx) => {
      const rowIdx = 6 + idx;
      const row = ws.getRow(rowIdx);
      row.height = 20;

      const isClosed = !!rec.closingFileName;
      const statusText = isClosed ? 'CLOSED' : 'AKTIF';
      const rangeText = `${formatIndoDate(rec.startDate)} s.d. ${formatIndoDate(rec.endDate)}`;

      ws.getCell(`A${rowIdx}`).value = idx + 1;
      ws.getCell(`B${rowIdx}`).value = rec.ptwNumber;
      ws.getCell(`C${rowIdx}`).value = `Q${rec.quarter}`;
      ws.getCell(`D${rowIdx}`).value = rec.equipmentCode;
      ws.getCell(`E${rowIdx}`).value = rangeText;
      ws.getCell(`F${rowIdx}`).value = rec.notes || '-';
      ws.getCell(`G${rowIdx}`).value = statusText;

      // Styling data cells
      const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      cols.forEach(col => {
        const cell = ws.getCell(`${col}${rowIdx}`);
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = thinBorder;
        
        // Zebra striping
        if (rowIdx % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLOR_GRAY_BG },
          };
        }

        // Alignments
        if (col === 'A' || col === 'C' || col === 'D' || col === 'G') {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }

        // Status text color
        if (col === 'G') {
          cell.font = {
            name: 'Calibri',
            size: 10,
            bold: true,
            color: { argb: isClosed ? COLOR_CLOSED_TEXT : COLOR_ACTIVE_TEXT }
          };
        }
      });
    });

    // Column widths
    ws.getColumn('A').width = 6;
    ws.getColumn('B').width = 20;
    ws.getColumn('C').width = 10;
    ws.getColumn('D').width = 28;
    ws.getColumn('E').width = 30;
    ws.getColumn('F').width = 40;
    ws.getColumn('G').width = 12;

    // Save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Daftar_PTW_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Daftar PTW berhasil diekspor ke Excel', { id: toastId });
  } catch (error) {
    console.error(error);
    toast.error('Gagal mengekspor data PTW ke Excel', { id: toastId });
  }
}

// ==========================================
// 2. EXPORT GENERAL PTW LIST TO PDF
// ==========================================
export async function exportPTWListToPDF(records: PTWExportRecord[]) {
  const toastId = toast.loading('Sedang menyiapkan dokumen PDF...');
  try {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageWidth - 2 * margin;

    // Load Logos: DME on Left, Neutra on Right
    const [dmeLogo, neutraLogo] = await Promise.all([
      loadLogoBase64(logoDME),
      loadLogoBase64(logoNeutra),
    ]);

    const drawHeader = (pdf: jsPDF) => {
      pdf.setFillColor('#00599c');
      pdf.rect(0, 0, pageWidth, 2.5, 'F');

      const headerH = 22;
      const headerY = 6;

      pdf.setDrawColor('#e2e8f0');
      pdf.setLineWidth(0.15);
      pdf.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');

      const col1W = 35;
      const col3W = 35;
      pdf.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
      pdf.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);

      if (dmeLogo) {
        pdf.addImage(dmeLogo, 'JPEG', margin + 3, headerY + 4, col1W - 6, 14, 'logo_dme_ptw', 'FAST');
      }

      if (neutraLogo) {
        pdf.addImage(neutraLogo, 'JPEG', pageWidth - margin - col3W + 5, headerY + 4, col3W - 10, 14, 'logo_neutra_ptw', 'FAST');
      }

      const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
      pdf.setFontSize(11).setFont('helvetica', 'bold').setTextColor('#00599c');
      pdf.text('DAFTAR DOKUMEN PERMIT TO WORK (PTW)', centerX, headerY + 7.5, { align: 'center' });

      pdf.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor('#1e293b');
      pdf.text('SISTEM PEMELIHARAAN INFRASTRUKTUR DATA CENTER', centerX, headerY + 12, { align: 'center' });

      const now = new Date().toLocaleDateString('id-ID', {
        day: '2-digit', month: 'long', year: 'numeric',
      });
      pdf.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor('#64748b');
      pdf.text(`Tanggal Unduh: ${now} | Total PTW: ${records.length} item`, centerX, headerY + 16.5, { align: 'center' });
    };

    const drawFooter = (pdf: jsPDF, pg: number, totalPages: number) => {
      pdf.setFillColor('#00599c');
      pdf.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');

      pdf.setFontSize(7).setTextColor('#64748b');
      pdf.text('PT United Transworld Trading — PTW Archives', margin, pageHeight - 5);
      pdf.text(`Halaman ${pg} dari ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
    };

    drawHeader(doc);

    const tableData = records.map((rec, idx) => [
      String(idx + 1),
      rec.ptwNumber,
      `Q${rec.quarter}`,
      rec.equipmentCode,
      `${formatIndoDate(rec.startDate)} - ${formatIndoDate(rec.endDate)}`,
      rec.notes || '-',
      rec.closingFileName ? 'CLOSED' : 'AKTIF'
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['No.', 'Nomor PTW', 'Q', 'Alat/Eq Code', 'Masa Berlaku', 'Nama Maintenance / Catatan', 'Status']],
      body: tableData,
      margin: { left: margin, right: margin, bottom: 15 },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        textColor: [30, 41, 59],
        font: 'helvetica',
        valign: 'middle'
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
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 8 },
        3: { cellWidth: 26 },
        4: { cellWidth: 38, halign: 'center' },
        5: { cellWidth: 'auto' },
        6: {
          halign: 'center',
          cellWidth: 16,
          fontStyle: 'bold'
        },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          if (data.cell.raw === 'CLOSED') {
            data.cell.styles.textColor = [239, 68, 68]; // Red
          } else {
            data.cell.styles.textColor = [16, 185, 129]; // Green
          }
        }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawHeader(doc);
        }
      }
    });

    // Add page numbers
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(doc, i, totalPages);
    }

    doc.save(`Daftar_PTW_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Daftar PTW berhasil diekspor ke PDF', { id: toastId });
  } catch (error) {
    console.error(error);
    toast.error('Gagal mengekspor data PTW ke PDF', { id: toastId });
  }
}

// ==========================================
// 3. EXPORT WEEKLY REPORT TO EXCEL
// ==========================================
export async function exportPTWWeeklyReportToExcel(monthYearLabel: string, weeklyData: WeeklyExportData[]) {
  const toastId = toast.loading('Sedang membuat laporan Excel...');
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT United Transworld Trading';
    workbook.lastModifiedBy = 'Data Center Maintenance System';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Laporan Mingguan');
    ws.views = [{ showGridLines: true }];

    // Load logos: DME on Left, Neutra on Right
    const [dmeLogo, neutraLogo] = await Promise.all([
      loadLogoBase64(logoDME),
      loadLogoBase64(logoNeutra),
    ]);

    // Row heights for header
    ws.getRow(1).height = 10;
    ws.getRow(2).height = 24;
    ws.getRow(3).height = 20;
    ws.getRow(4).height = 15;

    // Title Blocks
    ws.mergeCells('C2:E2');
    const titleCell = ws.getCell('C2');
    titleCell.value = 'LAPORAN MINGGUAN VALIDITAS PERMIT TO WORK (PTW)';
    titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '00599C' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells('C3:E3');
    const periodCell = ws.getCell('C3');
    periodCell.value = `Periode Laporan: ${monthYearLabel.toUpperCase()}`;
    periodCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '555555' } };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add logos
    if (dmeLogo) {
      try {
        const dmeLogoId = workbook.addImage({
          base64: dmeLogo.split(',')[1],
          extension: 'png',
        });
        ws.addImage(dmeLogoId, {
          tl: { col: 0.1, row: 1.1 }, // Col A, Row 2 (Left)
          ext: { width: 85, height: 35 }
        });
      } catch (e) {
        console.error('Failed to add DME logo to Excel', e);
      }
    }

    if (neutraLogo) {
      try {
        const neutraLogoId = workbook.addImage({
          base64: neutraLogo.split(',')[1],
          extension: 'png',
        });
        ws.addImage(neutraLogoId, {
          tl: { col: 5.15, row: 1.1 }, // Col F, Row 2 (Right)
          ext: { width: 85, height: 35 }
        });
      } catch (e) {
        console.error('Failed to add Neutra logo to Excel', e);
      }
    }

    // --- Section 1: Ringkasan Mingguan ---
    ws.getCell('A5').value = '1. RINGKASAN MINGGUAN';
    ws.getCell('A5').font = { name: 'Calibri', size: 11, bold: true, color: { argb: '000000' } };

    const sumHeaders = ['MINGGU', 'RENTANG TANGGAL', 'PTW TERBUKA (OPEN)', 'PTW SELESAI (CLOSED)', 'TOTAL PTW AKTIF'];
    const sumHeaderRow = ws.getRow(6);
    sumHeaderRow.height = 22;

    sumHeaders.forEach((sh, index) => {
      const colLetter = String.fromCharCode(65 + index);
      const cell = ws.getCell(`${colLetter}6`);
      cell.value = sh;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_BLUE }
      };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });

    let totalOpen = 0;
    let totalClosed = 0;
    let totalAll = 0;

    weeklyData.forEach((wd, idx) => {
      const rowIdx = 7 + idx;
      const row = ws.getRow(rowIdx);
      row.height = 20;

      ws.getCell(`A${rowIdx}`).value = `Minggu ${wd.weekNum}`;
      ws.getCell(`B${rowIdx}`).value = wd.dateRange;
      ws.getCell(`C${rowIdx}`).value = wd.openCount;
      ws.getCell(`D${rowIdx}`).value = wd.closedCount;
      ws.getCell(`E${rowIdx}`).value = wd.totalCount;

      totalOpen += wd.openCount;
      totalClosed += wd.closedCount;
      totalAll += wd.totalCount;

      const cols = ['A', 'B', 'C', 'D', 'E'];
      cols.forEach(col => {
        const cell = ws.getCell(`${col}${rowIdx}`);
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = thinBorder;
        if (col === 'B') {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
    });

    // Total Row for Summary
    const totalRowIdx = 11;
    ws.getCell(`A${totalRowIdx}`).value = 'TOTAL';
    ws.mergeCells(`A${totalRowIdx}:B${totalRowIdx}`);
    ws.getCell(`A${totalRowIdx}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(`C${totalRowIdx}`).value = totalOpen;
    ws.getCell(`D${totalRowIdx}`).value = totalClosed;
    ws.getCell(`E${totalRowIdx}`).value = totalAll;

    const colsSummary = ['A', 'B', 'C', 'D', 'E'];
    colsSummary.forEach(col => {
      const cell = ws.getCell(`${col}${totalRowIdx}`);
      cell.font = { name: 'Calibri', size: 10, bold: true };
      cell.border = thinBorder;
      if (col !== 'A' && col !== 'B') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    // --- Section 2: Rincian per Minggu ---
    let currentRowIdx = 14;

    weeklyData.forEach(wd => {
      // Week Title
      ws.mergeCells(`A${currentRowIdx}:F${currentRowIdx}`);
      const weekTitleCell = ws.getCell(`A${currentRowIdx}`);
      weekTitleCell.value = `RINCIAN DOKUMEN PTW - MINGGU ${wd.weekNum} (${wd.dateRange})`;
      weekTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E6F0FA' }
      };
      weekTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR_BLUE } };
      weekTitleCell.alignment = { horizontal: 'left', vertical: 'middle' };
      currentRowIdx++;

      // Headers of Detail Table
      const detailHeaders = ['NO', 'NOMOR PTW', 'NAMA MAINTENANCE / CATATAN', 'ALAT / EQ CODE', 'MASA BERLAKU', 'STATUS'];
      const detailHeaderRow = ws.getRow(currentRowIdx);
      detailHeaderRow.height = 20;

      detailHeaders.forEach((dh, index) => {
        const colLetter = String.fromCharCode(65 + index);
        const cell = ws.getCell(`${colLetter}${currentRowIdx}`);
        cell.value = dh;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '555555' } // Gray header for detail tables
        };
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });
      currentRowIdx++;

      // Data of Detail Table
      if (wd.records.length === 0) {
        ws.mergeCells(`A${currentRowIdx}:F${currentRowIdx}`);
        const emptyCell = ws.getCell(`A${currentRowIdx}`);
        emptyCell.value = 'Tidak ada PTW aktif pada minggu ini';
        emptyCell.font = { name: 'Calibri', size: 10, italic: true };
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
        emptyCell.border = thinBorder;
        ws.getRow(currentRowIdx).height = 20;
        currentRowIdx++;
      } else {
        wd.records.forEach((rec, idx) => {
          const r = ws.getRow(currentRowIdx);
          r.height = 20;

          const isClosed = !!rec.closingFileName;
          const statusText = isClosed ? 'CLOSED' : 'AKTIF';
          const rangeText = `${formatIndoDate(rec.startDate)} s.d. ${formatIndoDate(rec.endDate)}`;

          ws.getCell(`A${currentRowIdx}`).value = idx + 1;
          ws.getCell(`B${currentRowIdx}`).value = rec.ptwNumber;
          ws.getCell(`C${currentRowIdx}`).value = rec.notes || '-';
          ws.getCell(`D${currentRowIdx}`).value = rec.equipmentCode;
          ws.getCell(`E${currentRowIdx}`).value = rangeText;
          ws.getCell(`F${currentRowIdx}`).value = statusText;

          const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
          cols.forEach(col => {
            const cell = ws.getCell(`${col}${currentRowIdx}`);
            cell.font = { name: 'Calibri', size: 10 };
            cell.border = thinBorder;

            if (currentRowIdx % 2 === 1) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: COLOR_GRAY_BG }
              };
            }

            if (col === 'A' || col === 'B' || col === 'D' || col === 'F') {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }

            if (col === 'F') {
              cell.font = {
                name: 'Calibri',
                size: 10,
                bold: true,
                color: { argb: isClosed ? COLOR_CLOSED_TEXT : COLOR_ACTIVE_TEXT }
              };
            }
          });
          currentRowIdx++;
        });
      }

      // Empty row separator
      currentRowIdx += 2;
    });

    // Column widths
    ws.getColumn('A').width = 12;
    ws.getColumn('B').width = 24;
    ws.getColumn('C').width = 38;
    ws.getColumn('D').width = 24;
    ws.getColumn('E').width = 34;
    ws.getColumn('F').width = 14;

    // Save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Laporan_Mingguan_PTW_${monthYearLabel.replace(/\s+/g, '_')}.xlsx`);
    toast.success('Laporan Mingguan PTW berhasil diekspor ke Excel', { id: toastId });
  } catch (error) {
    console.error(error);
    toast.error('Gagal mengekspor laporan mingguan ke Excel', { id: toastId });
  }
}

// ==========================================
// 4. EXPORT WEEKLY REPORT TO PDF
// ==========================================
export async function exportPTWWeeklyReportToPDF(
  monthYearLabel: string, 
  weeklyData: WeeklyExportData[], 
  chartImageBase64?: string
) {
  const toastId = toast.loading('Sedang menyiapkan berkas laporan PDF...');
  try {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageWidth - 2 * margin;

    // Load Logos: DME on Left, Neutra on Right
    const [dmeLogo, neutraLogo] = await Promise.all([
      loadLogoBase64(logoDME),
      loadLogoBase64(logoNeutra),
    ]);

    const drawHeader = (pdf: jsPDF) => {
      pdf.setFillColor('#00599c');
      pdf.rect(0, 0, pageWidth, 2.5, 'F');

      const headerH = 22;
      const headerY = 6;

      pdf.setDrawColor('#e2e8f0');
      pdf.setLineWidth(0.15);
      pdf.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');

      const col1W = 35;
      const col3W = 35;
      pdf.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
      pdf.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);

      if (dmeLogo) {
        pdf.addImage(dmeLogo, 'JPEG', margin + 3, headerY + 4, col1W - 6, 14, 'logo_dme_weekly', 'FAST');
      }

      if (neutraLogo) {
        pdf.addImage(neutraLogo, 'JPEG', pageWidth - margin - col3W + 5, headerY + 4, col3W - 10, 14, 'logo_neutra_weekly', 'FAST');
      }

      const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
      pdf.setFontSize(10.5).setFont('helvetica', 'bold').setTextColor('#00599c');
      pdf.text('LAPORAN VALIDITAS PERMIT TO WORK (PTW)', centerX, headerY + 7.5, { align: 'center' });

      pdf.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor('#1e293b');
      pdf.text('BREAKDOWN MINGGUAN KEPATUHAN & VALIDITAS DOKUMEN', centerX, headerY + 12, { align: 'center' });

      pdf.setFontSize(7).setFont('helvetica', 'normal').setTextColor('#64748b');
      pdf.text(`Periode Laporan: ${monthYearLabel}`, centerX, headerY + 16.5, { align: 'center' });
    };

    const drawFooter = (pdf: jsPDF, pg: number, totalPages: number) => {
      pdf.setFillColor('#00599c');
      pdf.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F');

      pdf.setFontSize(7).setTextColor('#64748b');
      pdf.text(`PT United Transworld Trading — Laporan PTW ${monthYearLabel}`, margin, pageHeight - 5);
      pdf.text(`Halaman ${pg} dari ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
    };

    // PAGE 1: Summary Table + Recharts Chart Capture
    drawHeader(doc);
    
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor('#1e293b');
    doc.text('I. RINGKASAN DATA MINGGUAN', margin, 34);

    const sumTableData = weeklyData.map(wd => [
      `Minggu ${wd.weekNum}`,
      wd.dateRange,
      String(wd.openCount),
      String(wd.closedCount),
      String(wd.totalCount)
    ]);
    
    // Add Totals
    const totalOpen = weeklyData.reduce((a, b) => a + b.openCount, 0);
    const totalClosed = weeklyData.reduce((a, b) => a + b.closedCount, 0);
    const totalAll = weeklyData.reduce((a, b) => a + b.totalCount, 0);
    
    sumTableData.push([
      'TOTAL',
      '-',
      String(totalOpen),
      String(totalClosed),
      String(totalAll)
    ]);

    let finalYOnPage1 = 37;

    autoTable(doc, {
      startY: 37,
      head: [['Minggu', 'Rentang Tanggal', 'PTW Open (Aktif)', 'PTW Closed', 'Total PTW Aktif']],
      body: sumTableData,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        textColor: [30, 41, 59],
        font: 'helvetica',
        valign: 'middle',
        halign: 'center'
      },
      headStyles: {
        fillColor: [0, 89, 156],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center'
      },
      columnStyles: {
        1: { halign: 'left' }
      },
      didParseCell: (data) => {
        // Bold the last row (TOTAL row)
        if (data.row.index === sumTableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      },
      didDrawPage: (data) => {
        finalYOnPage1 = data.cursor ? data.cursor.y : 37;
      }
    });

    // Draw chart if provided
    if (chartImageBase64) {
      const chartWidth = contentW;
      const chartHeight = 85;
      const chartY = finalYOnPage1 + 8;
      
      doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor('#1e293b');
      doc.text('II. GRAFIK TREN VALIDITAS PTW', margin, chartY);

      doc.setDrawColor('#cbd5e1');
      doc.setLineWidth(0.2);
      doc.roundedRect(margin, chartY + 2.5, chartWidth, chartHeight + 4, 1.5, 1.5, 'D');

      doc.addImage(
        chartImageBase64, 
        'PNG', 
        margin + 2, 
        chartY + 4.5, 
        chartWidth - 4, 
        chartHeight, 
        'recharts_weekly_chart', 
        'FAST'
      );
    }

    // PAGE 2 onwards: Detail table for each week
    weeklyData.forEach(wd => {
      doc.addPage();
      drawHeader(doc);

      doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor('#00599c');
      doc.text(`RINCIAN PTW: MINGGU ${wd.weekNum} (${wd.dateRange})`, margin, 34);

      if (wd.records.length === 0) {
        doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor('#64748b');
        doc.text('Tidak ada dokumen PTW yang aktif pada minggu ini.', margin, 42);
      } else {
        const detailRows = wd.records.map((rec, idx) => [
          String(idx + 1),
          rec.ptwNumber,
          rec.notes || '-',
          rec.equipmentCode,
          `${formatIndoDate(rec.startDate)} - ${formatIndoDate(rec.endDate)}`,
          rec.closingFileName ? 'CLOSED' : 'AKTIF'
        ]);

        autoTable(doc, {
          startY: 38,
          head: [['No.', 'Nomor PTW', 'Nama Maintenance / Catatan', 'Alat / Eq Code', 'Masa Berlaku', 'Status']],
          body: detailRows,
          margin: { left: margin, right: margin },
          styles: {
            fontSize: 7.5,
            cellPadding: 2,
            lineColor: [226, 232, 240],
            lineWidth: 0.1,
            textColor: [30, 41, 59],
            font: 'helvetica',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [71, 85, 105], // Slate-600 for detail headers
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'center'
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { cellWidth: 26, fontStyle: 'bold' },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 24, halign: 'center' },
            4: { cellWidth: 38, halign: 'center' },
            5: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 5) {
              if (data.cell.raw === 'CLOSED') {
                data.cell.styles.textColor = [239, 68, 68]; // Red
              } else {
                data.cell.styles.textColor = [16, 185, 129]; // Green
              }
            }
          }
        });
      }
    });

    // Add page numbers
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(doc, i, totalPages);
    }

    doc.save(`Laporan_Mingguan_PTW_${monthYearLabel.replace(/\s+/g, '_')}.pdf`);
    toast.success('Laporan Mingguan PTW berhasil diekspor ke PDF', { id: toastId });
  } catch (error) {
    console.error(error);
    toast.error('Gagal mengekspor laporan mingguan ke PDF', { id: toastId });
  }
}
