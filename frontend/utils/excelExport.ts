// ============================================================================
// FILE: excelExport.ts
// Deskripsi: Utility Ekspor Laporan SLA / SLG ke format Microsoft Excel (.xlsx).
//            Menggunakan library ExcelJS untuk menyusun workbook multi-sheet:
//            - Sheet 1: Pencapaian Response Time (<5 Menit)
//            - Sheet 2: Pencapaian Resolution Time (Level Prioritas SLA Perangkat)
//            - Sheet 3: Laporan D-Day / SLG Penalty & Deductions
//            Dilengkapi dengan styling cell border, header background, dan otomatisasi rumus.
// ============================================================================

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Utility helper untuk memformat tanggal ke tampilan standar Excel (contoh: "3/7/2026 16:12:00")
const formatExcelDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const MM = d.getMonth() + 1;
  const DD = d.getDate();
  const YYYY = d.getFullYear();

  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  return `${MM}/${DD}/${YYYY} ${hh}:${mm}:${ss}`;
};

/**
 * Memunculkan unduhan file Excel (.xlsx) dari objek Laporan SLA/SLG
 */
export async function exportSLAReportToExcel(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PT Dwimitra Ekatama Mandiri';
  workbook.lastModifiedBy = 'Data Center Maintenance System';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Color Palette
  const headerGray = 'F2F2F2';
  const textDark = '000000';
  const borderGray = 'BFBFBF';

  // Common styles
  const thinBorder = {
    top: { style: 'thin' as const, color: { argb: borderGray } },
    left: { style: 'thin' as const, color: { argb: borderGray } },
    bottom: { style: 'thin' as const, color: { argb: borderGray } },
    right: { style: 'thin' as const, color: { argb: borderGray } },
  };

  const headerFont = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  const dataFont = { name: 'Calibri', size: 10, color: { argb: textDark } };
  const titleFontLarge = { name: 'Calibri', size: 14, bold: true, color: { argb: textDark } };
  const titleFontSub = { name: 'Calibri', size: 11, bold: true, color: { argb: textDark } };

  // ==========================================
  // SHEET 1: RESPONSE TIME
  // ==========================================
  const wsResponse = workbook.addWorksheet('1. Response Time');
  wsResponse.views = [{ showGridLines: true }];

  // Titles
  wsResponse.getCell('A2').value = '1 PENCAPAIAN RESPONSE TIME';
  wsResponse.getCell('A2').font = titleFontLarge;
  wsResponse.getCell('A3').value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
  wsResponse.getCell('A3').font = titleFontSub;
  wsResponse.getCell('A4').value = `Periode: ${new Date(report.timeOrder).getFullYear()}`;
  wsResponse.getCell('A4').font = titleFontSub;

  // Table Headers
  const r6 = wsResponse.getRow(6);
  const r7 = wsResponse.getRow(7);
  r6.height = 20;
  r7.height = 20;

  wsResponse.mergeCells('A6:A7');
  wsResponse.getCell('A6').value = 'NO';

  wsResponse.mergeCells('B6:C7');
  wsResponse.getCell('B6').value = 'ORDER/TIKET';

  wsResponse.mergeCells('D6:D7');
  wsResponse.getCell('D6').value = 'LOKASI';

  wsResponse.mergeCells('E6:F6');
  wsResponse.getCell('E6').value = 'PIC';
  wsResponse.getCell('E7').value = 'DME';
  wsResponse.getCell('F7').value = 'TDE';

  wsResponse.mergeCells('G6:G7');
  wsResponse.getCell('G6').value = 'WAKTU ORDER\n(TANGGAL : JAM)';
  wsResponse.getCell('G6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

  wsResponse.mergeCells('H6:H7');
  wsResponse.getCell('H6').value = 'WAKTU RESPON AKTUAL\n(TARGET: 10 MENIT)\nTANGGAL : JAM';
  wsResponse.getCell('H6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

  wsResponse.mergeCells('I6:I7');
  wsResponse.getCell('I6').value = 'WAKTU RESPON\nAKTUAL';
  wsResponse.getCell('I6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

  wsResponse.mergeCells('J6:J7');
  wsResponse.getCell('J6').value = 'TARGET\n(MENIT)';
  wsResponse.getCell('J6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

  wsResponse.mergeCells('K6:K7');
  wsResponse.getCell('K6').value = 'COMPLY\nM/TM';
  wsResponse.getCell('K6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

  wsResponse.mergeCells('L6:L7');
  wsResponse.getCell('L6').value = 'KETERANGAN';

  // Apply styles to headers
  const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  headerCols.forEach(col => {
    const c6 = wsResponse.getCell(`${col}6`);
    const c7 = wsResponse.getCell(`${col}7`);
    c6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    c6.font = headerFont;
    c6.alignment = c6.alignment || { horizontal: 'center', vertical: 'middle' };
    c6.border = thinBorder;

    c7.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    c7.font = headerFont;
    c7.alignment = c7.alignment || { horizontal: 'center', vertical: 'middle' };
    c7.border = thinBorder;
  });

  // Table Data (1 Row)
  const r8 = wsResponse.getRow(8);
  r8.height = 25;
  wsResponse.getCell('A8').value = 1;
  wsResponse.mergeCells('B8:C8');
  wsResponse.getCell('B8').value = report.ticketName;
  wsResponse.getCell('D8').value = report.location;
  wsResponse.getCell('E8').value = report.picDME;
  wsResponse.getCell('F8').value = report.picTDE;
  wsResponse.getCell('G8').value = formatExcelDate(report.timeOrder);
  wsResponse.getCell('H8').value = formatExcelDate(report.actualTimeResponse);
  wsResponse.getCell('I8').value = report.actualResponseTimeMin;
  wsResponse.getCell('J8').value = report.targetResponseMin;
  wsResponse.getCell('K8').value = report.responseComply ? 'M' : 'TM';
  wsResponse.getCell('L8').value = 'Via WhatsApp / Tiket';

  headerCols.forEach(col => {
    const cell = wsResponse.getCell(`${col}8`);
    cell.font = dataFont;
    cell.border = thinBorder;
    if (['A', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].includes(col)) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  });

  // Summary Row
  wsResponse.mergeCells('A9:H9');
  wsResponse.getCell('A9').value = 'TOTAL';
  wsResponse.getCell('A9').font = headerFont;
  wsResponse.getCell('A9').alignment = { horizontal: 'right', vertical: 'middle' };
  wsResponse.getCell('A9').border = thinBorder;

  wsResponse.getCell('I9').value = `${report.actualResponseTimeMin} menit`;
  wsResponse.getCell('I9').font = headerFont;
  wsResponse.getCell('I9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsResponse.getCell('I9').border = thinBorder;

  wsResponse.getCell('J9').value = `${report.targetResponseMin} menit`;
  wsResponse.getCell('J9').font = headerFont;
  wsResponse.getCell('J9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsResponse.getCell('J9').border = thinBorder;

  wsResponse.getCell('K9').value = report.responseComply ? 1 : 0;
  wsResponse.getCell('K9').font = headerFont;
  wsResponse.getCell('K9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsResponse.getCell('K9').border = thinBorder;

  wsResponse.getCell('L9').border = thinBorder;

  // Adjust Column Widths
  wsResponse.getColumn('A').width = 6;
  wsResponse.getColumn('B').width = 18;
  wsResponse.getColumn('C').width = 18;
  wsResponse.getColumn('D').width = 15;
  wsResponse.getColumn('E').width = 14;
  wsResponse.getColumn('F').width = 14;
  wsResponse.getColumn('G').width = 22;
  wsResponse.getColumn('H').width = 25;
  wsResponse.getColumn('I').width = 16;
  wsResponse.getColumn('J').width = 14;
  wsResponse.getColumn('K').width = 12;
  wsResponse.getColumn('L').width = 25;


  // ==========================================
  // SHEET 2: ONSITE PRINCIPLE ENGINEER (OPE)
  // ==========================================
  const wsOnsite = workbook.addWorksheet('2. Onsite Support');
  wsOnsite.views = [{ showGridLines: true }];

  wsOnsite.getCell('A2').value = '2 PENCAPAIAN ONSITE PRICIPLE ENGINEER (OPE)';
  wsOnsite.getCell('A2').font = titleFontLarge;
  wsOnsite.getCell('A3').value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
  wsOnsite.getCell('A3').font = titleFontSub;
  wsOnsite.getCell('A4').value = `Periode: ${new Date(report.timeOrder).getFullYear()}`;
  wsOnsite.getCell('A4').font = titleFontSub;

  wsOnsite.mergeCells('A6:A7');
  wsOnsite.getCell('A6').value = 'NO';
  wsOnsite.mergeCells('B6:C7');
  wsOnsite.getCell('B6').value = 'ORDER/TIKET';
  wsOnsite.mergeCells('D6:D7');
  wsOnsite.getCell('D6').value = 'LOKASI';
  wsOnsite.mergeCells('E6:F6');
  wsOnsite.getCell('E6').value = 'PIC';
  wsOnsite.getCell('E7').value = 'DME';
  wsOnsite.getCell('F7').value = 'TDE';
  wsOnsite.mergeCells('G6:G7');
  wsOnsite.getCell('G6').value = 'WAKTU ORDER\n(TANGGAL : JAM)';
  wsOnsite.getCell('G6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsOnsite.mergeCells('H6:H7');
  wsOnsite.getCell('H6').value = 'WAKTU ONSITE AKTUAL\n(TARGET: 2 JAM)\nTANGGAL : JAM';
  wsOnsite.getCell('H6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsOnsite.mergeCells('I6:I7');
  wsOnsite.getCell('I6').value = 'WAKTU ONSITE AKTUAL\n(MENIT)';
  wsOnsite.getCell('I6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsOnsite.mergeCells('J6:J7');
  wsOnsite.getCell('J6').value = 'TARGET\n(MENIT)';
  wsOnsite.getCell('J6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsOnsite.mergeCells('K6:K7');
  wsOnsite.getCell('K6').value = 'COMPLY\nM/TM';
  wsOnsite.getCell('K6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsOnsite.mergeCells('L6:L7');
  wsOnsite.getCell('L6').value = 'KETERANGAN';

  headerCols.forEach(col => {
    const c6 = wsOnsite.getCell(`${col}6`);
    const c7 = wsOnsite.getCell(`${col}7`);
    c6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    c6.font = headerFont;
    c6.alignment = c6.alignment || { horizontal: 'center', vertical: 'middle' };
    c6.border = thinBorder;
    c7.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    c7.font = headerFont;
    c7.alignment = c7.alignment || { horizontal: 'center', vertical: 'middle' };
    c7.border = thinBorder;
  });

  // Table Data (1 Row)
  const r8On = wsOnsite.getRow(8);
  r8On.height = 25;
  wsOnsite.getCell('A8').value = 1;
  wsOnsite.mergeCells('B8:C8');
  wsOnsite.getCell('B8').value = report.ticketName;
  wsOnsite.getCell('D8').value = report.location;
  wsOnsite.getCell('E8').value = report.picDME;
  wsOnsite.getCell('F8').value = report.picTDE;
  wsOnsite.getCell('G8').value = formatExcelDate(report.timeOrder);
  wsOnsite.getCell('H8').value = formatExcelDate(report.actualTimeOnsite);
  wsOnsite.getCell('I8').value = report.actualOnsiteTimeMin;
  wsOnsite.getCell('J8').value = report.targetOnsiteMin;
  wsOnsite.getCell('K8').value = report.onsiteComply ? 'M' : 'TM';
  wsOnsite.getCell('L8').value = 'Via WhatsApp / Tiket';

  headerCols.forEach(col => {
    const cell = wsOnsite.getCell(`${col}8`);
    cell.font = dataFont;
    cell.border = thinBorder;
    if (['A', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].includes(col)) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  });

  // Summary Row
  wsOnsite.mergeCells('A9:H9');
  wsOnsite.getCell('A9').value = 'TOTAL';
  wsOnsite.getCell('A9').font = headerFont;
  wsOnsite.getCell('A9').alignment = { horizontal: 'right', vertical: 'middle' };
  wsOnsite.getCell('A9').border = thinBorder;

  wsOnsite.getCell('I9').value = `${report.actualOnsiteTimeMin} menit`;
  wsOnsite.getCell('I9').font = headerFont;
  wsOnsite.getCell('I9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsOnsite.getCell('I9').border = thinBorder;

  wsOnsite.getCell('J9').value = `${report.targetOnsiteMin} menit`;
  wsOnsite.getCell('J9').font = headerFont;
  wsOnsite.getCell('J9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsOnsite.getCell('J9').border = thinBorder;

  wsOnsite.getCell('K9').value = report.onsiteComply ? 1 : 0;
  wsOnsite.getCell('K9').font = headerFont;
  wsOnsite.getCell('K9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsOnsite.getCell('K9').border = thinBorder;
  wsOnsite.getCell('L9').border = thinBorder;

  // Widths
  wsOnsite.getColumn('A').width = 6;
  wsOnsite.getColumn('B').width = 18;
  wsOnsite.getColumn('C').width = 18;
  wsOnsite.getColumn('D').width = 15;
  wsOnsite.getColumn('E').width = 14;
  wsOnsite.getColumn('F').width = 14;
  wsOnsite.getColumn('G').width = 22;
  wsOnsite.getColumn('H').width = 25;
  wsOnsite.getColumn('I').width = 20;
  wsOnsite.getColumn('J').width = 14;
  wsOnsite.getColumn('K').width = 12;
  wsOnsite.getColumn('L').width = 25;


  // ==========================================
  // SHEET 3: RESTORE SERVICE TIME (RST)
  // ==========================================
  const wsRestore = workbook.addWorksheet('3. Restore Service Time');
  wsRestore.views = [{ showGridLines: true }];

  wsRestore.getCell('A2').value = '3 PENCAPAIAN RESTORE SERVICE TIME (RST)';
  wsRestore.getCell('A2').font = titleFontLarge;
  wsRestore.getCell('A3').value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
  wsRestore.getCell('A3').font = titleFontSub;
  wsRestore.getCell('A4').value = `Periode: ${new Date(report.timeOrder).getFullYear()}`;
  wsRestore.getCell('A4').font = titleFontSub;

  wsRestore.mergeCells('A6:A7');
  wsRestore.getCell('A6').value = 'NO';
  wsRestore.mergeCells('B6:C7');
  wsRestore.getCell('B6').value = 'ORDER/TIKET';
  wsRestore.mergeCells('D6:D7');
  wsRestore.getCell('D6').value = 'LOKASI';
  wsRestore.mergeCells('E6:E7');
  wsRestore.getCell('E6').value = 'MULAI ORDER\n(TANGGAL : JAM)';
  wsRestore.getCell('E6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsRestore.mergeCells('F6:F7');
  wsRestore.getCell('F6').value = 'SELESAI ORDER\nTANGGAL : JAM : MENIT';
  wsRestore.getCell('F6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsRestore.mergeCells('G6:G7');
  wsRestore.getCell('G6').value = 'WAKTU PEMULIHAN AKTUAL\n(JAM : MENIT)';
  wsRestore.getCell('G6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsRestore.mergeCells('H6:H7');
  wsRestore.getCell('H6').value = 'TARGET\n(JAM : MENIT)';
  wsRestore.getCell('H6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsRestore.mergeCells('I6:I7');
  wsRestore.getCell('I6').value = 'COMPLY\nM/TM';
  wsRestore.getCell('I6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsRestore.mergeCells('J6:J7');
  wsRestore.getCell('J6').value = 'KETERANGAN';

  const restoreCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  restoreCols.forEach(col => {
    const c6 = wsRestore.getCell(`${col}6`);
    const c7 = wsRestore.getCell(`${col}7`);
    c6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    c6.font = headerFont;
    c6.alignment = c6.alignment || { horizontal: 'center', vertical: 'middle' };
    c6.border = thinBorder;
    c7.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    c7.font = headerFont;
    c7.alignment = c7.alignment || { horizontal: 'center', vertical: 'middle' };
    c7.border = thinBorder;
  });

  const getTargetByPriority = (prio?: string) => {
    if (prio === 'Critical') return 120;
    if (prio === 'High') return 240;
    if (prio === 'Low') return 2880;
    return 360;
  };
  const targetRST = report.targetRestoreMin || getTargetByPriority(report.priority);

  // Table Data (1 Row)
  const r8R = wsRestore.getRow(8);
  r8R.height = 25;
  wsRestore.getCell('A8').value = 1;
  wsRestore.mergeCells('B8:C8');
  wsRestore.getCell('B8').value = report.ticketName;
  wsRestore.getCell('D8').value = report.location;
  wsRestore.getCell('E8').value = formatExcelDate(report.startOrder || report.timeOrder);
  wsRestore.getCell('F8').value = formatExcelDate(report.finishOrder);
  wsRestore.getCell('G8').value = report.actualRestoreTimeMin;
  wsRestore.getCell('H8').value = targetRST;
  wsRestore.getCell('I8').value = report.restoreComply ? 'M' : 'TM';
  wsRestore.getCell('J8').value = report.remark || 'Team melaksanakan perbaikan corrective.';

  restoreCols.forEach(col => {
    const cell = wsRestore.getCell(`${col}8`);
    cell.font = dataFont;
    cell.border = thinBorder;
    if (['A', 'D', 'E', 'F', 'G', 'H', 'I'].includes(col)) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  });

  // Summary Row
  wsRestore.mergeCells('A9:F9');
  wsRestore.getCell('A9').value = 'TOTAL';
  wsRestore.getCell('A9').font = headerFont;
  wsRestore.getCell('A9').alignment = { horizontal: 'right', vertical: 'middle' };
  wsRestore.getCell('A9').border = thinBorder;

  wsRestore.getCell('G9').value = `${report.actualRestoreTimeMin} menit`;
  wsRestore.getCell('G9').font = headerFont;
  wsRestore.getCell('G9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsRestore.getCell('G9').border = thinBorder;

  wsRestore.getCell('H9').value = `${targetRST} menit`;
  wsRestore.getCell('H9').font = headerFont;
  wsRestore.getCell('H9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsRestore.getCell('H9').border = thinBorder;

  wsRestore.getCell('I9').value = report.restoreComply ? 1 : 0;
  wsRestore.getCell('I9').font = headerFont;
  wsRestore.getCell('I9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsRestore.getCell('I9').border = thinBorder;
  wsRestore.getCell('J9').border = thinBorder;

  // Widths
  wsRestore.getColumn('A').width = 6;
  wsRestore.getColumn('B').width = 18;
  wsRestore.getColumn('C').width = 18;
  wsRestore.getColumn('D').width = 15;
  wsRestore.getColumn('E').width = 22;
  wsRestore.getColumn('F').width = 25;
  wsRestore.getColumn('G').width = 22;
  wsRestore.getColumn('H').width = 18;
  wsRestore.getColumn('I').width = 12;
  wsRestore.getColumn('J').width = 35;


  // ==========================================
  // SHEET 4: RESOLUTION TIME (RT)
  // ==========================================
  const wsRes = workbook.addWorksheet('4. Resolution Time');
  wsRes.views = [{ showGridLines: true }];

  wsRes.getCell('A2').value = '4 PENCAPAIAN RESOLUTION TIME (RT)';
  wsRes.getCell('A2').font = titleFontLarge;
  wsRes.getCell('A3').value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
  wsRes.getCell('A3').font = titleFontSub;
  wsRes.getCell('A4').value = `Periode: ${new Date(report.timeOrder).getFullYear()}`;
  wsRes.getCell('A4').font = titleFontSub;

  wsRes.mergeCells('A6:A7');
  wsRes.getCell('A6').value = 'NO';
  wsRes.mergeCells('B6:C7');
  wsRes.getCell('B6').value = 'NO ORDER/TIKET';
  wsRes.mergeCells('D6:D7');
  wsRes.getCell('D6').value = 'PRIORITAS';
  wsRes.mergeCells('E6:E7');
  wsRes.getCell('E6').value = 'LOKASI';
  wsRes.mergeCells('F6:F7');
  wsRes.getCell('F6').value = 'MULAI ORDER\n(TANGGAL : JAM)';
  wsRes.getCell('F6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsRes.mergeCells('G6:G7');
  wsRes.getCell('G6').value = 'SELESAI ORDER\nTANGGAL : JAM : MENIT';
  wsRes.getCell('G6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsRes.mergeCells('H6:H7');
  wsRes.getCell('H6').value = 'WAKTU RESOLUSI AKTUAL\n(MENIT)';
  wsRes.getCell('H6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsRes.mergeCells('I6:I7');
  wsRes.getCell('I6').value = 'TARGET\n(MENIT)';
  wsRes.getCell('I6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsRes.mergeCells('J6:J7');
  wsRes.getCell('J6').value = 'COMPLY\nM/TM';
  wsRes.getCell('J6').alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  wsRes.mergeCells('K6:K7');
  wsRes.getCell('K6').value = 'KETERANGAN';

  const resCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
  resCols.forEach(col => {
    const c6 = wsRes.getCell(`${col}6`);
    const c7 = wsRes.getCell(`${col}7`);
    c6.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    c6.font = headerFont;
    c6.alignment = c6.alignment || { horizontal: 'center', vertical: 'middle' };
    c6.border = thinBorder;
    c7.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    c7.font = headerFont;
    c7.alignment = c7.alignment || { horizontal: 'center', vertical: 'middle' };
    c7.border = thinBorder;
  });

  const targetRSP = report.targetResolutionMin || getTargetByPriority(report.priority);

  // Table Data (1 Row)
  const r8Res = wsRes.getRow(8);
  r8Res.height = 25;
  wsRes.getCell('A8').value = 1;
  wsRes.mergeCells('B8:C8');
  wsRes.getCell('B8').value = report.ticketName;
  wsRes.getCell('D8').value = report.priority;
  wsRes.getCell('E8').value = report.location;
  wsRes.getCell('F8').value = formatExcelDate(report.startOrder || report.timeOrder);
  wsRes.getCell('G8').value = formatExcelDate(report.finishOrder);
  wsRes.getCell('H8').value = report.actualResolutionTimeMin;
  wsRes.getCell('I8').value = targetRSP;
  wsRes.getCell('J8').value = report.resolutionComply ? 'M' : 'TM';
  wsRes.getCell('K8').value = report.remark || 'Team melaksanakan perbaikan corrective.';

  resCols.forEach(col => {
    const cell = wsRes.getCell(`${col}8`);
    cell.font = dataFont;
    cell.border = thinBorder;
    if (['A', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].includes(col)) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  });

  // Summary Row
  wsRes.mergeCells('A9:G9');
  wsRes.getCell('A9').value = 'TOTAL';
  wsRes.getCell('A9').font = headerFont;
  wsRes.getCell('A9').alignment = { horizontal: 'right', vertical: 'middle' };
  wsRes.getCell('A9').border = thinBorder;

  wsRes.getCell('H9').value = `${report.actualResolutionTimeMin} menit`;
  wsRes.getCell('H9').font = headerFont;
  wsRes.getCell('H9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsRes.getCell('H9').border = thinBorder;

  wsRes.getCell('I9').value = `${report.targetResolutionMin} menit`;
  wsRes.getCell('I9').font = headerFont;
  wsRes.getCell('I9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsRes.getCell('I9').border = thinBorder;

  wsRes.getCell('J9').value = report.resolutionComply ? 1 : 0;
  wsRes.getCell('J9').font = headerFont;
  wsRes.getCell('J9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsRes.getCell('J9').border = thinBorder;
  wsRes.getCell('K9').border = thinBorder;

  // Widths
  wsRes.getColumn('A').width = 6;
  wsRes.getColumn('B').width = 18;
  wsRes.getColumn('C').width = 18;
  wsRes.getColumn('D').width = 12;
  wsRes.getColumn('E').width = 15;
  wsRes.getColumn('F').width = 22;
  wsRes.getColumn('G').width = 25;
  wsRes.getColumn('H').width = 24;
  wsRes.getColumn('I').width = 18;
  wsRes.getColumn('J').width = 12;
  wsRes.getColumn('K').width = 35;


  // ==========================================
  // SHEET 5: EVIDANCE (EMBED PHOTOS!)
  // ==========================================
  const wsEv = workbook.addWorksheet('Bukti');
  wsEv.views = [{ showGridLines: true }];

  // Column Headers
  const evCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  wsEv.getRow(6).height = 25;

  wsEv.getCell('A6').value = 'ORDER / TIKET';
  wsEv.getCell('B6').value = 'WAKTU RESPON';
  wsEv.getCell('C6').value = 'DUKUNGAN TEKNISI ONSITE';
  wsEv.getCell('D6').value = 'ONSITE PRINCIPLE ENGINEER';
  wsEv.getCell('E6').value = 'WAKTU PEMULIHAN LAYANAN';
  wsEv.getCell('F6').value = 'WAKTU RESOLUSI';

  evCols.slice(0, 6).forEach(col => {
    const cell = wsEv.getCell(`${col}6`);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerGray } };
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  // Ticket Name
  wsEv.getCell('A7').value = report.ticketName;
  wsEv.getCell('A7').font = titleFontSub;
  wsEv.getCell('A7').alignment = { horizontal: 'center', vertical: 'middle' };
  wsEv.getCell('A7').border = thinBorder;

  // Embed Images helper
  const addExcelImage = (base64Data: string, cellRange: string) => {
    if (!base64Data) return;
    // Skip HTTP URLs — only embed actual base64 data
    if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
      console.warn(`Skipping non-base64 image for ${cellRange}: URL detected`);
      return;
    }
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const imgId = workbook.addImage({
        base64: cleanBase64,
        extension: 'jpeg',
      });
      wsEv.addImage(imgId, cellRange);
    } catch (err) {
      console.error(`Failed to embed image for range ${cellRange}:`, err);
    }
  };

  // Add the 5 images in columns B, C, D, E, F
  addExcelImage(report.photoResponse, 'B7:B12');
  addExcelImage(report.photoEngineerOnsite, 'C7:C12');
  addExcelImage(report.photoOnsite, 'D7:D12');
  addExcelImage(report.photoRestore, 'E7:E12');
  addExcelImage(report.photoResolution, 'F7:F12');

  // Set Row Heights for Images display area
  for (let r = 7; r <= 12; r++) {
    wsEv.getRow(r).height = 35;
    evCols.slice(0, 6).forEach(col => {
      wsEv.getCell(`${col}${r}`).border = thinBorder;
    });
  }

  // Column widths for Evidence
  wsEv.getColumn('A').width = 20;
  wsEv.getColumn('B').width = 25;
  wsEv.getColumn('C').width = 18;
  wsEv.getColumn('D').width = 18;
  wsEv.getColumn('E').width = 25;
  wsEv.getColumn('F').width = 25;

  // Save and download the workbook
  const buffer = await workbook.xlsx.writeBuffer();
  const fileBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(fileBlob, `SLA_Report_${report.ticketName.replace(/\s+/g, '_')}_2026.xlsx`);
}

/**
 * Ekspor Rekapitulasi Multi-Laporan SLA/SLG Bulanan ke Format Excel Resmi (.xlsx)
 */
export async function exportSLAMonthlyRecapToExcel(rawReports: any[], periodTitle: string = 'Bulanan'): Promise<void> {
  const reports = (rawReports || []).filter(r => !r.deleteRequested && !(r.originalReport && r.originalReport.deleteRequested));
  if (reports.length === 0) {
    throw new Error('Tidak ada data laporan SLA yang valid untuk diekspor ke Excel.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PT Dwimitra Ekatama Mandiri';
  workbook.lastModifiedBy = 'Data Center Maintenance System - DC Cikarang';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Color Palette & Fonts
  const headerNavy = '002060';
  const textDark = '0F172A';
  const borderGray = 'CBD5E1';

  const thinBorder = {
    top: { style: 'thin' as const, color: { argb: borderGray } },
    left: { style: 'thin' as const, color: { argb: borderGray } },
    bottom: { style: 'thin' as const, color: { argb: borderGray } },
    right: { style: 'thin' as const, color: { argb: borderGray } },
  };

  const headerFontWhite = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
  const headerFontDark = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  const dataFont = { name: 'Calibri', size: 10, color: { argb: textDark } };
  const titleFontLarge = { name: 'Calibri', size: 14, bold: true, color: { argb: textDark } };
  const titleFontSub = { name: 'Calibri', size: 11, bold: true, color: { argb: '475569' } };

  const getTargetByPriority = (prio?: string) => {
    if (prio === 'Critical') return 120;
    if (prio === 'High') return 240;
    if (prio === 'Low') return 2880;
    return 360;
  };

  // Helper to extract photos
  const getPhotos = (report: any, arrayKey: string, legacyKey: string): string[] => {
    if (Array.isArray(report[arrayKey]) && report[arrayKey].length > 0) {
      return report[arrayKey].map((p: any) => typeof p === 'string' ? p : p.photo).filter(Boolean);
    }
    if (report[legacyKey]) return [report[legacyKey]];
    return [];
  };

  // Embed image helper for multi-row
  const addExcelImageSafe = (base64Data: string, cellRange: string, sheet: ExcelJS.Worksheet) => {
    if (!base64Data || base64Data.startsWith('http://') || base64Data.startsWith('https://')) return;
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const imgId = workbook.addImage({
        base64: cleanBase64,
        extension: 'jpeg',
      });
      sheet.addImage(imgId, cellRange);
    } catch (err) {
      console.warn(`Failed to embed image for range ${cellRange}:`, err);
    }
  };

  // Pre-calculate compliance numbers
  const totalCount = reports.length;
  const respMCount = reports.filter(r => r.responseComply !== false && (r.actualResponseTimeMin !== undefined ? r.actualResponseTimeMin <= (r.targetResponseMin || 5) : true)).length;
  const onsiteMCount = reports.filter(r => r.onsiteComply !== false && (r.actualOnsiteTimeMin !== undefined ? r.actualOnsiteTimeMin <= (r.targetOnsiteMin || 120) : true)).length;
  const restoreMCount = reports.filter(r => {
    const t = r.targetRestoreMin || getTargetByPriority(r.priority);
    return r.restoreComply !== false && (r.actualRestoreTimeMin !== undefined ? r.actualRestoreTimeMin <= t : true);
  }).length;
  const resolutionMCount = reports.filter(r => {
    const t = r.targetResolutionMin || getTargetByPriority(r.priority);
    return r.resolutionComply !== false && (r.actualResolutionTimeMin !== undefined ? r.actualResolutionTimeMin <= t : true);
  }).length;

  const respPct = totalCount > 0 ? (respMCount / totalCount) * 100 : 100;
  const onsitePct = totalCount > 0 ? (onsiteMCount / totalCount) * 100 : 100;
  const restorePct = totalCount > 0 ? (restoreMCount / totalCount) * 100 : 100;
  const resolutionPct = totalCount > 0 ? (resolutionMCount / totalCount) * 100 : 100;

  const respScore = (respPct / 100) * 5;
  const onsiteScore = (onsitePct / 100) * 5;
  const restoreScore = (restorePct / 100) * 15;
  const resolutionScore = (resolutionPct / 100) * 15;
  const totalSlgScore = respScore + onsiteScore + restoreScore + resolutionScore;

  // =========================================================================
  // SHEET 1: REKAPITULASI PENCAPAIAN KINERJA SLA & SLG
  // =========================================================================
  const wsSummary = workbook.addWorksheet('Rekap Kinerja SLG');
  wsSummary.views = [{ showGridLines: true }];

  wsSummary.getCell('A2').value = 'REKAPITULASI PENCAPAIAN KINERJA SLA & SLG';
  wsSummary.getCell('A2').font = titleFontLarge;
  wsSummary.getCell('A3').value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
  wsSummary.getCell('A3').font = titleFontSub;
  wsSummary.getCell('A4').value = `Periode: ${periodTitle}`;
  wsSummary.getCell('A4').font = titleFontSub;

  const sumHeaders = ['NO', 'INDIKATOR KINERJA SLA / SLG', 'SATUAN', 'JUMLAH ORDER', 'PENCAPAIAN (M)', '% COMPLY', 'BOBOT', 'HASIL AKHIR SLG'];
  const sumCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  const r6Sum = wsSummary.getRow(6);
  r6Sum.height = 24;
  sumHeaders.forEach((h, i) => {
    const cell = wsSummary.getCell(`${sumCols[i]}6`);
    cell.value = h;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
    cell.font = headerFontWhite;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  const summaryRowsData = [
    { no: 1, title: 'Response Time', unit: 'Order', count: totalCount, comply: respMCount, pct: `${respPct.toFixed(0)}%`, bobot: '5%', score: `${respScore.toFixed(2)}%` },
    { no: 2, title: 'Onsite Time (Principle Onsite)', unit: 'Order', count: totalCount, comply: onsiteMCount, pct: `${onsitePct.toFixed(0)}%`, bobot: '5%', score: `${onsiteScore.toFixed(2)}%` },
    { no: 3, title: 'Restore Time (Service Restore)', unit: 'Order', count: totalCount, comply: restoreMCount, pct: `${restorePct.toFixed(0)}%`, bobot: '15%', score: `${restoreScore.toFixed(2)}%` },
    { no: 4, title: 'Resolution Time (Problem Resolution)', unit: 'Order', count: totalCount, comply: resolutionMCount, pct: `${resolutionPct.toFixed(0)}%`, bobot: '15%', score: `${resolutionScore.toFixed(2)}%` },
  ];

  summaryRowsData.forEach((row, idx) => {
    const rowNum = 7 + idx;
    const r = wsSummary.getRow(rowNum);
    r.height = 20;

    wsSummary.getCell(`A${rowNum}`).value = row.no;
    wsSummary.getCell(`B${rowNum}`).value = row.title;
    wsSummary.getCell(`C${rowNum}`).value = row.unit;
    wsSummary.getCell(`D${rowNum}`).value = row.count;
    wsSummary.getCell(`E${rowNum}`).value = row.comply;
    wsSummary.getCell(`F${rowNum}`).value = row.pct;
    wsSummary.getCell(`G${rowNum}`).value = row.bobot;
    wsSummary.getCell(`H${rowNum}`).value = row.score;

    sumCols.forEach(col => {
      const cell = wsSummary.getCell(`${col}${rowNum}`);
      cell.font = dataFont;
      cell.border = thinBorder;
      cell.alignment = col === 'B' ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
      if (col === 'H') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '166534' } };
      }
    });
  });

  // Total SLG Row
  const totalRowNum = 11;
  const rTotal = wsSummary.getRow(totalRowNum);
  rTotal.height = 24;
  wsSummary.mergeCells(`A${totalRowNum}:F${totalRowNum}`);
  const totalLabel = wsSummary.getCell(`A${totalRowNum}`);
  totalLabel.value = 'TOTAL HASIL AKHIR PENCAPAIAN SLG (MAX 40%):';
  totalLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: textDark } };
  totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };
  totalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
  totalLabel.border = thinBorder;

  wsSummary.mergeCells(`G${totalRowNum}:H${totalRowNum}`);
  const totalVal = wsSummary.getCell(`G${totalRowNum}`);
  totalVal.value = `${totalSlgScore.toFixed(2)}% / 40.00%`;
  totalVal.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '854D0E' } };
  totalVal.alignment = { horizontal: 'center', vertical: 'middle' };
  totalVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF08A' } };
  totalVal.border = thinBorder;

  wsSummary.getColumn('A').width = 6;
  wsSummary.getColumn('B').width = 36;
  wsSummary.getColumn('C').width = 12;
  wsSummary.getColumn('D').width = 14;
  wsSummary.getColumn('E').width = 16;
  wsSummary.getColumn('F').width = 12;
  wsSummary.getColumn('G').width = 10;
  wsSummary.getColumn('H').width = 18;

  // =========================================================================
  // SHEET 2: 1. RESPONSE TIME
  // =========================================================================
  const wsResp = workbook.addWorksheet('1. Response Time');
  wsResp.views = [{ showGridLines: true }];

  wsResp.getCell('A2').value = '1. PENCAPAIAN RESPONSE TIME';
  wsResp.getCell('A2').font = titleFontLarge;
  wsResp.getCell('A3').value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
  wsResp.getCell('A3').font = titleFontSub;
  wsResp.getCell('A4').value = `Periode: ${periodTitle}`;
  wsResp.getCell('A4').font = titleFontSub;

  const respHeaders = ['NO', 'ORDER/TIKET', 'LOKASI', 'PIC DME', 'PIC TDE', 'WAKTU ORDER', 'WAKTU RESPON AKTUAL', 'AKTUAL (MNT)', 'TARGET (MNT)', 'COMPLY', 'KETERANGAN'];
  const respCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

  const r6Resp = wsResp.getRow(6);
  r6Resp.height = 22;
  respHeaders.forEach((h, i) => {
    const cell = wsResp.getCell(`${respCols[i]}6`);
    cell.value = h;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
    cell.font = headerFontWhite;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  reports.forEach((r, idx) => {
    const rowNum = 7 + idx;
    const row = wsResp.getRow(rowNum);
    row.height = 20;

    const comply = r.responseComply !== undefined ? r.responseComply : (r.actualResponseTimeMin ? r.actualResponseTimeMin <= (r.targetResponseMin || 5) : true);

    wsResp.getCell(`A${rowNum}`).value = idx + 1;
    wsResp.getCell(`B${rowNum}`).value = r.ticketName || r.issue || 'WO';
    wsResp.getCell(`C${rowNum}`).value = r.location || '-';
    wsResp.getCell(`D${rowNum}`).value = r.picDME || 'On Duty DME';
    wsResp.getCell(`E${rowNum}`).value = (!r.picTDE || r.picTDE === 'FMA - CBRE' || r.picTDE === '-') ? 'FMA - OCS' : r.picTDE;
    wsResp.getCell(`F${rowNum}`).value = formatExcelDate(r.timeOrder);
    wsResp.getCell(`G${rowNum}`).value = formatExcelDate(r.actualTimeResponse);
    wsResp.getCell(`H${rowNum}`).value = r.actualResponseTimeMin ?? 0;
    wsResp.getCell(`I${rowNum}`).value = r.targetResponseMin || 5;
    wsResp.getCell(`J${rowNum}`).value = comply ? 'M' : 'TM';
    wsResp.getCell(`K${rowNum}`).value = r.remark || 'Via WhatsApp';

    respCols.forEach(col => {
      const cell = wsResp.getCell(`${col}${rowNum}`);
      cell.font = dataFont;
      cell.border = thinBorder;
      cell.alignment = ['B', 'C', 'K'].includes(col) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
      if (col === 'J') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: comply ? '166534' : '991B1B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: comply ? 'DCFCE7' : 'FEE2E2' } };
      }
    });
  });

  wsResp.getColumn('A').width = 6;
  wsResp.getColumn('B').width = 24;
  wsResp.getColumn('C').width = 16;
  wsResp.getColumn('D').width = 14;
  wsResp.getColumn('E').width = 14;
  wsResp.getColumn('F').width = 20;
  wsResp.getColumn('G').width = 20;
  wsResp.getColumn('H').width = 14;
  wsResp.getColumn('I').width = 14;
  wsResp.getColumn('J').width = 10;
  wsResp.getColumn('K').width = 20;

  // =========================================================================
  // SHEET 3: 2. ONSITE SUPPORT
  // =========================================================================
  const wsOnsite = workbook.addWorksheet('2. Onsite Support');
  wsOnsite.views = [{ showGridLines: true }];

  wsOnsite.getCell('A2').value = '2. PENCAPAIAN ONSITE PRINCIPLE ENGINEER (OPE)';
  wsOnsite.getCell('A2').font = titleFontLarge;
  wsOnsite.getCell('A3').value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
  wsOnsite.getCell('A3').font = titleFontSub;
  wsOnsite.getCell('A4').value = `Periode: ${periodTitle}`;
  wsOnsite.getCell('A4').font = titleFontSub;

  const onsiteHeaders = ['NO', 'ORDER/TIKET', 'LOKASI', 'PIC DME', 'PIC TDE', 'WAKTU ORDER', 'WAKTU ONSITE AKTUAL', 'AKTUAL (MNT)', 'TARGET (MNT)', 'COMPLY', 'KETERANGAN'];
  const onsiteCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

  const r6On = wsOnsite.getRow(6);
  r6On.height = 22;
  onsiteHeaders.forEach((h, i) => {
    const cell = wsOnsite.getCell(`${onsiteCols[i]}6`);
    cell.value = h;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
    cell.font = headerFontWhite;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  reports.forEach((r, idx) => {
    const rowNum = 7 + idx;
    const row = wsOnsite.getRow(rowNum);
    row.height = 20;

    const comply = r.onsiteComply !== undefined ? r.onsiteComply : (r.actualOnsiteTimeMin ? r.actualOnsiteTimeMin <= (r.targetOnsiteMin || 120) : true);

    wsOnsite.getCell(`A${rowNum}`).value = idx + 1;
    wsOnsite.getCell(`B${rowNum}`).value = r.ticketName || r.issue || 'WO';
    wsOnsite.getCell(`C${rowNum}`).value = r.location || '-';
    wsOnsite.getCell(`D${rowNum}`).value = r.picDME || 'On Duty DME';
    wsOnsite.getCell(`E${rowNum}`).value = (!r.picTDE || r.picTDE === 'FMA - CBRE' || r.picTDE === '-') ? 'FMA - OCS' : r.picTDE;
    wsOnsite.getCell(`F${rowNum}`).value = formatExcelDate(r.timeOrder);
    wsOnsite.getCell(`G${rowNum}`).value = formatExcelDate(r.actualTimeOnsite);
    wsOnsite.getCell(`H${rowNum}`).value = r.actualOnsiteTimeMin ?? 0;
    wsOnsite.getCell(`I${rowNum}`).value = r.targetOnsiteMin || 120;
    wsOnsite.getCell(`J${rowNum}`).value = comply ? 'M' : 'TM';
    wsOnsite.getCell(`K${rowNum}`).value = r.remark || 'Via WhatsApp / Tiket';

    onsiteCols.forEach(col => {
      const cell = wsOnsite.getCell(`${col}${rowNum}`);
      cell.font = dataFont;
      cell.border = thinBorder;
      cell.alignment = ['B', 'C', 'K'].includes(col) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
      if (col === 'J') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: comply ? '166534' : '991B1B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: comply ? 'DCFCE7' : 'FEE2E2' } };
      }
    });
  });

  wsOnsite.getColumn('A').width = 6;
  wsOnsite.getColumn('B').width = 24;
  wsOnsite.getColumn('C').width = 16;
  wsOnsite.getColumn('D').width = 14;
  wsOnsite.getColumn('E').width = 14;
  wsOnsite.getColumn('F').width = 20;
  wsOnsite.getColumn('G').width = 20;
  wsOnsite.getColumn('H').width = 14;
  wsOnsite.getColumn('I').width = 14;
  wsOnsite.getColumn('J').width = 10;
  wsOnsite.getColumn('K').width = 20;

  // =========================================================================
  // SHEET 4: 3. RESTORE TIME
  // =========================================================================
  const wsRestore = workbook.addWorksheet('3. Restore Time');
  wsRestore.views = [{ showGridLines: true }];

  wsRestore.getCell('A2').value = '3. PENCAPAIAN RESTORE SERVICE TIME (RST)';
  wsRestore.getCell('A2').font = titleFontLarge;
  wsRestore.getCell('A3').value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
  wsRestore.getCell('A3').font = titleFontSub;
  wsRestore.getCell('A4').value = `Periode: ${periodTitle}`;
  wsRestore.getCell('A4').font = titleFontSub;

  const restHeaders = ['NO', 'ORDER/TIKET', 'LOKASI', 'MULAI ORDER', 'SELESAI ORDER', 'WAKTU PEMULIHAN AKTUAL (MNT)', 'TARGET (MNT)', 'COMPLY', 'KETERANGAN'];
  const restCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

  const r6Rest = wsRestore.getRow(6);
  r6Rest.height = 22;
  restHeaders.forEach((h, i) => {
    const cell = wsRestore.getCell(`${restCols[i]}6`);
    cell.value = h;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
    cell.font = headerFontWhite;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  reports.forEach((r, idx) => {
    const rowNum = 7 + idx;
    const row = wsRestore.getRow(rowNum);
    row.height = 20;

    const targetRST = r.targetRestoreMin || getTargetByPriority(r.priority);
    const comply = r.restoreComply !== undefined ? r.restoreComply : (r.actualRestoreTimeMin ? r.actualRestoreTimeMin <= targetRST : true);

    wsRestore.getCell(`A${rowNum}`).value = idx + 1;
    wsRestore.getCell(`B${rowNum}`).value = r.ticketName || r.issue || 'WO';
    wsRestore.getCell(`C${rowNum}`).value = r.location || '-';
    wsRestore.getCell(`D${rowNum}`).value = formatExcelDate(r.startOrder || r.timeOrder);
    wsRestore.getCell(`E${rowNum}`).value = formatExcelDate(r.finishOrder);
    wsRestore.getCell(`F${rowNum}`).value = r.actualRestoreTimeMin ?? 0;
    wsRestore.getCell(`G${rowNum}`).value = targetRST;
    wsRestore.getCell(`H${rowNum}`).value = comply ? 'M' : 'TM';
    wsRestore.getCell(`I${rowNum}`).value = r.remark || 'Perbaikan corrective restore service';

    restCols.forEach(col => {
      const cell = wsRestore.getCell(`${col}${rowNum}`);
      cell.font = dataFont;
      cell.border = thinBorder;
      cell.alignment = ['B', 'C', 'I'].includes(col) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
      if (col === 'H') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: comply ? '166534' : '991B1B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: comply ? 'DCFCE7' : 'FEE2E2' } };
      }
    });
  });

  wsRestore.getColumn('A').width = 6;
  wsRestore.getColumn('B').width = 24;
  wsRestore.getColumn('C').width = 16;
  wsRestore.getColumn('D').width = 20;
  wsRestore.getColumn('E').width = 20;
  wsRestore.getColumn('F').width = 26;
  wsRestore.getColumn('G').width = 14;
  wsRestore.getColumn('H').width = 10;
  wsRestore.getColumn('I').width = 28;

  // =========================================================================
  // SHEET 5: 4. RESOLUTION TIME
  // =========================================================================
  const wsReso = workbook.addWorksheet('4. Resolution Time');
  wsReso.views = [{ showGridLines: true }];

  wsReso.getCell('A2').value = '4. PENCAPAIAN RESOLUTION TIME (RT)';
  wsReso.getCell('A2').font = titleFontLarge;
  wsReso.getCell('A3').value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
  wsReso.getCell('A3').font = titleFontSub;
  wsReso.getCell('A4').value = `Periode: ${periodTitle}`;
  wsReso.getCell('A4').font = titleFontSub;

  const resoHeaders = ['NO', 'NO ORDER/TIKET', 'PRIORITAS', 'LOKASI', 'MULAI ORDER', 'SELESAI ORDER', 'WAKTU RESOLUSI AKTUAL (MNT)', 'TARGET (MNT)', 'COMPLY', 'KETERANGAN'];
  const resoCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  const r6Reso = wsReso.getRow(6);
  r6Reso.height = 22;
  resoHeaders.forEach((h, i) => {
    const cell = wsReso.getCell(`${resoCols[i]}6`);
    cell.value = h;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
    cell.font = headerFontWhite;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  reports.forEach((r, idx) => {
    const rowNum = 7 + idx;
    const row = wsReso.getRow(rowNum);
    row.height = 20;

    const targetRSP = r.targetResolutionMin || getTargetByPriority(r.priority);
    const comply = r.resolutionComply !== undefined ? r.resolutionComply : (r.actualResolutionTimeMin ? r.actualResolutionTimeMin <= targetRSP : true);

    wsReso.getCell(`A${rowNum}`).value = idx + 1;
    wsReso.getCell(`B${rowNum}`).value = r.ticketName || r.issue || 'WO';
    wsReso.getCell(`C${rowNum}`).value = r.priority || 'Medium';
    wsReso.getCell(`D${rowNum}`).value = r.location || '-';
    wsReso.getCell(`E${rowNum}`).value = formatExcelDate(r.startOrder || r.timeOrder);
    wsReso.getCell(`F${rowNum}`).value = formatExcelDate(r.finishOrder);
    wsReso.getCell(`G${rowNum}`).value = r.actualResolutionTimeMin ?? 0;
    wsReso.getCell(`H${rowNum}`).value = targetRSP;
    wsReso.getCell(`I${rowNum}`).value = comply ? 'M' : 'TM';
    wsReso.getCell(`J${rowNum}`).value = r.resolutionRemark || r.remark || 'Troubleshooting terselesaikan penuh';

    resoCols.forEach(col => {
      const cell = wsReso.getCell(`${col}${rowNum}`);
      cell.font = dataFont;
      cell.border = thinBorder;
      cell.alignment = ['B', 'D', 'J'].includes(col) ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
      if (col === 'I') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: comply ? '166534' : '991B1B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: comply ? 'DCFCE7' : 'FEE2E2' } };
      }
    });
  });

  wsReso.getColumn('A').width = 6;
  wsReso.getColumn('B').width = 24;
  wsReso.getColumn('C').width = 12;
  wsReso.getColumn('D').width = 16;
  wsReso.getColumn('E').width = 20;
  wsReso.getColumn('F').width = 20;
  wsReso.getColumn('G').width = 26;
  wsReso.getColumn('H').width = 14;
  wsReso.getColumn('I').width = 10;
  wsReso.getColumn('J').width = 28;

  // =========================================================================
  // SHEET 6: 5. EVIDENCE BUKTI FOTO
  // =========================================================================
  const wsEvidence = workbook.addWorksheet('5. Evidence Foto');
  wsEvidence.views = [{ showGridLines: true }];

  wsEvidence.getCell('A2').value = '5. EVIDENCE FOTO DOKUMENTASI (4-STEP SLA / SLG)';
  wsEvidence.getCell('A2').font = titleFontLarge;
  wsEvidence.getCell('A3').value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
  wsEvidence.getCell('A3').font = titleFontSub;
  wsEvidence.getCell('A4').value = `Periode: ${periodTitle}`;
  wsEvidence.getCell('A4').font = titleFontSub;

  const evHeaders = ['NO', 'ORDER / TIKET', 'BUKTI RESPONSE TIME', 'BUKTI ONSITE SUPPORT', 'BUKTI RESTORE TIME', 'BUKTI RESOLUTION TIME'];
  const evCols = ['A', 'B', 'C', 'D', 'E', 'F'];

  const r6Ev = wsEvidence.getRow(6);
  r6Ev.height = 24;
  evHeaders.forEach((h, i) => {
    const cell = wsEvidence.getCell(`${evCols[i]}6`);
    cell.value = h;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
    cell.font = headerFontWhite;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  let currentEvRow = 7;
  reports.forEach((r, idx) => {
    const startRow = currentEvRow;
    const endRow = currentEvRow + 4; // 5 Excel rows per ticket for image height

    // Set row heights
    for (let rIdx = startRow; rIdx <= endRow; rIdx++) {
      wsEvidence.getRow(rIdx).height = 28;
    }

    // Merge NO and Ticket Name
    wsEvidence.mergeCells(`A${startRow}:A${endRow}`);
    const cellNo = wsEvidence.getCell(`A${startRow}`);
    cellNo.value = idx + 1;
    cellNo.font = headerFontDark;
    cellNo.alignment = { horizontal: 'center', vertical: 'middle' };
    cellNo.border = thinBorder;

    wsEvidence.mergeCells(`B${startRow}:B${endRow}`);
    const cellTicket = wsEvidence.getCell(`B${startRow}`);
    cellTicket.value = `${r.ticketName || r.issue || 'WO'}\n(${r.priority || 'Medium'})\n${r.location || '-'}`;
    cellTicket.font = headerFontDark;
    cellTicket.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellTicket.border = thinBorder;

    // Photos
    const respPhotos = getPhotos(r, 'photosResponse', 'photoResponse');
    const onsitePhotos = getPhotos(r, 'photosOnsite', 'photoOnsite');
    const restPhotos = getPhotos(r, 'photosRestore', 'photoRestore');
    const resoPhotos = getPhotos(r, 'photosResolution', 'photoResolution');

    if (respPhotos[0]) addExcelImageSafe(respPhotos[0], `C${startRow}:C${endRow}`, wsEvidence);
    if (onsitePhotos[0]) addExcelImageSafe(onsitePhotos[0], `D${startRow}:D${endRow}`, wsEvidence);
    if (restPhotos[0]) addExcelImageSafe(restPhotos[0], `E${startRow}:E${endRow}`, wsEvidence);
    if (resoPhotos[0]) addExcelImageSafe(resoPhotos[0], `F${startRow}:F${endRow}`, wsEvidence);

    for (let rIdx = startRow; rIdx <= endRow; rIdx++) {
      evCols.forEach(col => {
        wsEvidence.getCell(`${col}${rIdx}`).border = thinBorder;
      });
    }

    currentEvRow = endRow + 1;
  });

  wsEvidence.getColumn('A').width = 6;
  wsEvidence.getColumn('B').width = 24;
  wsEvidence.getColumn('C').width = 26;
  wsEvidence.getColumn('D').width = 26;
  wsEvidence.getColumn('E').width = 26;
  wsEvidence.getColumn('F').width = 26;

  // Save workbook
  const buffer = await workbook.xlsx.writeBuffer();
  const fileBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const cleanPeriod = periodTitle.replace(/[^a-zA-Z0-9_\-]/g, '_');
  saveAs(fileBlob, `Rekap_SLA_SLG_DC_Cikarang_${cleanPeriod}.xlsx`);
}
