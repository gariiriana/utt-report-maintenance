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

// Utility helper untuk memformat tanggal ke tampilan standar Excel (format: DD/MM/YYYY HH:mm:ss -> Tanggal, Bulan, Tahun, Jam)
const formatExcelDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const DD = String(d.getDate()).padStart(2, '0');
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const YYYY = d.getFullYear();

  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  return `${DD}/${MM}/${YYYY} ${hh}:${mm}:${ss}`;
};

// Helper untuk memasang aturan Conditional Formatting Excel agar warna otomatis berubah (M = Hijau, TM = Merah) saat angka diubah di Excel
const addComplyConditionalFormatting = (
  ws: ExcelJS.Worksheet,
  complyRef: string,
  ketRef?: string
) => {
  try {
    ws.addConditionalFormatting({
      ref: complyRef,
      rules: [
        {
          priority: 1,
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"M"'],
          style: {
            font: { color: { argb: 'FF166534' }, bold: true },
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } }
          }
        },
        {
          priority: 2,
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"TM"'],
          style: {
            font: { color: { argb: 'FF991B1B' }, bold: true },
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEE2E2' } }
          }
        }
      ]
    });

    if (ketRef) {
      ws.addConditionalFormatting({
        ref: ketRef,
        rules: [
          {
            priority: 3,
            type: 'cellIs',
            operator: 'equal',
            formulae: ['"Memenuhi"'],
            style: {
              font: { color: { argb: 'FF166534' }, bold: true },
              fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } }
            }
          },
          {
            priority: 4,
            type: 'cellIs',
            operator: 'equal',
            formulae: ['"Tidak Memenuhi"'],
            style: {
              font: { color: { argb: 'FF991B1B' }, bold: true },
              fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEE2E2' } }
            }
          }
        ]
      });
    }
  } catch (err) {
    console.warn('Failed to add conditional formatting:', err);
  }
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
  wsResponse.getCell('H6').value = 'WAKTU RESPON AKTUAL\n(TARGET: 5 MENIT)\nTANGGAL : JAM';
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

  const actualResp = report.actualResponseTimeMin ?? 0;
  const targetResp = report.targetResponseMin || 5;
  const isRespComply = (report.responseComply !== false) && (report.actualResponseTimeMin !== undefined ? report.actualResponseTimeMin <= targetResp : true);

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
  wsResponse.getCell('I8').value = actualResp;
  wsResponse.getCell('J8').value = targetResp;
  wsResponse.getCell('K8').value = { formula: 'IF(I8<=J8,"M","TM")', result: isRespComply ? 'M' : 'TM' };
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

  wsResponse.getCell('I9').value = { formula: 'I8', result: actualResp };
  wsResponse.getCell('I9').font = headerFont;
  wsResponse.getCell('I9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsResponse.getCell('I9').border = thinBorder;

  wsResponse.getCell('J9').value = { formula: 'J8', result: targetResp };
  wsResponse.getCell('J9').font = headerFont;
  wsResponse.getCell('J9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsResponse.getCell('J9').border = thinBorder;

  wsResponse.getCell('K9').value = { formula: 'IF(K8="M",1,0)', result: isRespComply ? 1 : 0 };
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

  addComplyConditionalFormatting(wsResponse, 'K8:K9');


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

  const actualOn = report.actualOnsiteTimeMin ?? 0;
  const targetOn = report.targetOnsiteMin || 120;
  const isOnComply = (report.onsiteComply !== false) && (report.actualOnsiteTimeMin !== undefined ? report.actualOnsiteTimeMin <= targetOn : true);

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
  wsOnsite.getCell('I8').value = actualOn;
  wsOnsite.getCell('J8').value = targetOn;
  wsOnsite.getCell('K8').value = { formula: 'IF(I8<=J8,"M","TM")', result: isOnComply ? 'M' : 'TM' };
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

  wsOnsite.getCell('I9').value = { formula: 'I8', result: actualOn };
  wsOnsite.getCell('I9').font = headerFont;
  wsOnsite.getCell('I9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsOnsite.getCell('I9').border = thinBorder;

  wsOnsite.getCell('J9').value = { formula: 'J8', result: targetOn };
  wsOnsite.getCell('J9').font = headerFont;
  wsOnsite.getCell('J9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsOnsite.getCell('J9').border = thinBorder;

  wsOnsite.getCell('K9').value = { formula: 'IF(K8="M",1,0)', result: isOnComply ? 1 : 0 };
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

  addComplyConditionalFormatting(wsOnsite, 'K8:K9');


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
  const targetRST = 180; // Target Komitmen Restore Time selalu 3 Jam (180 Menit)
  const actualRestore = report.actualRestoreTimeMin ?? 0;
  const isRestoreComply = (report.restoreComply !== false) && (report.actualRestoreTimeMin !== undefined ? report.actualRestoreTimeMin <= targetRST : true);

  // Table Data (1 Row)
  const r8R = wsRestore.getRow(8);
  r8R.height = 25;
  wsRestore.getCell('A8').value = 1;
  wsRestore.mergeCells('B8:C8');
  wsRestore.getCell('B8').value = report.ticketName;
  wsRestore.getCell('D8').value = report.location;
  wsRestore.getCell('E8').value = formatExcelDate(report.startOrder || report.timeOrder);
  wsRestore.getCell('F8').value = formatExcelDate(report.finishOrder);
  wsRestore.getCell('G8').value = actualRestore;
  wsRestore.getCell('H8').value = targetRST;
  wsRestore.getCell('I8').value = { formula: 'IF(G8<=H8,"M","TM")', result: isRestoreComply ? 'M' : 'TM' };
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

  wsRestore.getCell('G9').value = { formula: 'G8', result: actualRestore };
  wsRestore.getCell('G9').font = headerFont;
  wsRestore.getCell('G9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsRestore.getCell('G9').border = thinBorder;

  wsRestore.getCell('H9').value = { formula: 'H8', result: targetRST };
  wsRestore.getCell('H9').font = headerFont;
  wsRestore.getCell('H9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsRestore.getCell('H9').border = thinBorder;

  wsRestore.getCell('I9').value = { formula: 'IF(I8="M",1,0)', result: isRestoreComply ? 1 : 0 };
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

  addComplyConditionalFormatting(wsRestore, 'I8:I9');


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
  const actualReso = report.actualResolutionTimeMin ?? 0;
  const isResoComply = (report.resolutionComply !== false) && (report.actualResolutionTimeMin !== undefined ? report.actualResolutionTimeMin <= targetRSP : true);

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
  wsRes.getCell('H8').value = actualReso;
  wsRes.getCell('I8').value = targetRSP;
  wsRes.getCell('J8').value = { formula: 'IF(H8<=I8,"M","TM")', result: isResoComply ? 'M' : 'TM' };
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

  wsRes.getCell('H9').value = { formula: 'H8', result: actualReso };
  wsRes.getCell('H9').font = headerFont;
  wsRes.getCell('H9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsRes.getCell('H9').border = thinBorder;

  wsRes.getCell('I9').value = { formula: 'I8', result: targetRSP };
  wsRes.getCell('I9').font = headerFont;
  wsRes.getCell('I9').alignment = { horizontal: 'center', vertical: 'middle' };
  wsRes.getCell('I9').border = thinBorder;

  wsRes.getCell('J9').value = { formula: 'IF(J8="M",1,0)', result: isResoComply ? 1 : 0 };
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

  addComplyConditionalFormatting(wsRes, 'J8:J9');


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
  const parseReportTime = (r: any): number => {
    const rawCandidates = [
      r.timeOrder,
      r.startOrder,
      r.actualTimeResponse,
      r.actualTimeOnsite,
      r.incidentDate,
      r.reportedAt,
      r.createdAt,
    ];
    for (const raw of rawCandidates) {
      if (!raw) continue;
      if (typeof raw === 'number') return raw;
      if (typeof raw.toDate === 'function') {
        const t = raw.toDate().getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (raw instanceof Date) {
        const t = raw.getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (typeof raw === 'string') {
        const t = new Date(raw.trim()).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
    }
    return 0;
  };

  // Urutkan kronologis ASCENDING (dari awal bulan ke akhir bulan, data pertama diinput ada di paling atas)
  const reports = (rawReports || [])
    .filter(r => !r.deleteRequested && !(r.originalReport && r.originalReport.deleteRequested))
    .sort((a, b) => parseReportTime(a) - parseReportTime(b));

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

  // -------------------------------------------------------------
  // GROUPING PER BULAN (Untuk pemisahan multi-bulan + grand total kumulatif)
  // -------------------------------------------------------------
  const INDO_MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  interface MonthGroup {
    monthKey: string;
    monthLabel: string;
    reports: any[];
    startIndex: number;
    respMCount: number;
    onsiteMCount: number;
    restoreMCount: number;
    resolutionMCount: number;
    respScore: number;
    onsiteScore: number;
    restoreScore: number;
    resolutionScore: number;
    totalScore: number;
  }

  const monthGroups: MonthGroup[] = [];
  reports.forEach((r, idx) => {
    const ts = parseReportTime(r);
    const d = ts > 0 ? new Date(ts) : new Date();
    const yyyy = d.getFullYear();
    const mm = d.getMonth();
    const monthKey = `${yyyy}-${String(mm + 1).padStart(2, '0')}`;
    const monthLabel = `${INDO_MONTH_NAMES[mm]} ${yyyy}`;

    let grp = monthGroups.find(g => g.monthKey === monthKey);
    if (!grp) {
      grp = {
        monthKey,
        monthLabel,
        reports: [],
        startIndex: idx,
        respMCount: 0,
        onsiteMCount: 0,
        restoreMCount: 0,
        resolutionMCount: 0,
        respScore: 0,
        onsiteScore: 0,
        restoreScore: 0,
        resolutionScore: 0,
        totalScore: 0,
      };
      monthGroups.push(grp);
    }
    grp.reports.push(r);
  });

  monthGroups.forEach((grp) => {
    const count = grp.reports.length;
    grp.respMCount = grp.reports.filter(r => r.responseComply !== false && (r.actualResponseTimeMin !== undefined ? r.actualResponseTimeMin <= (r.targetResponseMin || 5) : true)).length;
    grp.onsiteMCount = grp.reports.filter(r => r.onsiteComply !== false && (r.actualOnsiteTimeMin !== undefined ? r.actualOnsiteTimeMin <= (r.targetOnsiteMin || 120) : true)).length;
    grp.restoreMCount = grp.reports.filter(r => {
      const t = 180;
      return r.restoreComply !== false && (r.actualRestoreTimeMin !== undefined ? r.actualRestoreTimeMin <= t : true);
    }).length;
    grp.resolutionMCount = grp.reports.filter(r => {
      const t = r.targetResolutionMin || getTargetByPriority(r.priority);
      return r.resolutionComply !== false && (r.actualResolutionTimeMin !== undefined ? r.actualResolutionTimeMin <= t : true);
    }).length;

    grp.respScore = count > 0 ? Number(((grp.respMCount / count) * 5).toFixed(2)) : 5.00;
    grp.onsiteScore = count > 0 ? Number(((grp.onsiteMCount / count) * 5).toFixed(2)) : 5.00;
    grp.restoreScore = count > 0 ? Number(((grp.restoreMCount / count) * 15).toFixed(2)) : 15.00;
    grp.resolutionScore = count > 0 ? Number(((grp.resolutionMCount / count) * 15).toFixed(2)) : 15.00;
    grp.totalScore = Number((grp.respScore + grp.onsiteScore + grp.restoreScore + grp.resolutionScore).toFixed(2));
  });

  // Pre-calculate cumulative compliance numbers
  const totalCount = reports.length;
  const respMCount = reports.filter(r => r.responseComply !== false && (r.actualResponseTimeMin !== undefined ? r.actualResponseTimeMin <= (r.targetResponseMin || 5) : true)).length;
  const onsiteMCount = reports.filter(r => r.onsiteComply !== false && (r.actualOnsiteTimeMin !== undefined ? r.actualOnsiteTimeMin <= (r.targetOnsiteMin || 120) : true)).length;
  const restoreMCount = reports.filter(r => {
    const t = 180; // Target Komitmen Restore Time selalu 3 Jam (180 Menit)
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

  wsSummary.getCell('A2').value = 'REKAPITULASI PENCAPAIAN KINERJA SLA & SLG' + (monthGroups.length > 1 ? ' (KUMULATIF)' : '');
  wsSummary.getCell('A2').font = titleFontLarge;
  wsSummary.getCell('A3').value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
  wsSummary.getCell('A3').font = titleFontSub;
  wsSummary.getCell('A4').value = `Periode: ${periodTitle}` + (monthGroups.length > 1 ? ` (Total ${monthGroups.length} Bulan)` : '');
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
    { no: 1, title: 'Response Time', unit: 'Order', bobot: 0.05, count: totalCount, comply: respMCount, pct: respPct / 100, score: respScore / 100 },
    { no: 2, title: 'Onsite Time (Principle Onsite)', unit: 'Order', bobot: 0.05, count: totalCount, comply: onsiteMCount, pct: onsitePct / 100, score: onsiteScore / 100 },
    { no: 3, title: 'Restore Time (Service Restore)', unit: 'Order', bobot: 0.15, count: totalCount, comply: restoreMCount, pct: restorePct / 100, score: restoreScore / 100 },
    { no: 4, title: 'Resolution Time (Problem Resolution)', unit: 'Order', bobot: 0.15, count: totalCount, comply: resolutionMCount, pct: resolutionPct / 100, score: resolutionScore / 100 },
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
    wsSummary.getCell(`F${rowNum}`).value = { formula: `IF(D${rowNum}>0,E${rowNum}/D${rowNum},1)`, result: row.pct };
    wsSummary.getCell(`F${rowNum}`).numFmt = '0.00%';
    wsSummary.getCell(`G${rowNum}`).value = row.bobot;
    wsSummary.getCell(`G${rowNum}`).numFmt = '0%';
    wsSummary.getCell(`H${rowNum}`).value = { formula: `F${rowNum}*G${rowNum}`, result: row.score };
    wsSummary.getCell(`H${rowNum}`).numFmt = '0.00%';

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
  totalLabel.value = monthGroups.length > 1
    ? 'TOTAL HASIL AKHIR PENCAPAIAN SLG KUMULATIF (MAX 40%):'
    : 'TOTAL HASIL AKHIR PENCAPAIAN SLG (MAX 40%):';
  totalLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: textDark } };
  totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };
  totalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
  totalLabel.border = thinBorder;

  wsSummary.mergeCells(`G${totalRowNum}:H${totalRowNum}`);
  const totalVal = wsSummary.getCell(`G${totalRowNum}`);
  totalVal.value = { formula: `SUM(H7:H10)`, result: totalSlgScore / 100 };
  totalVal.numFmt = '0.00%';
  totalVal.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '854D0E' } };
  totalVal.alignment = { horizontal: 'center', vertical: 'middle' };
  totalVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF08A' } };
  totalVal.border = thinBorder;

  // TABEL KOMPARASI SKOR SLG PER BULAN (Jika Multi-Bulan)
  if (monthGroups.length > 1) {
    wsSummary.getRow(13).height = 14;

    wsSummary.getCell('A14').value = 'RINCIAN EVALUASI SKOR SLG PER BULAN';
    wsSummary.getCell('A14').font = { name: 'Calibri', size: 12, bold: true, color: { argb: textDark } };

    wsSummary.getCell('A15').value = `Perbandingan Pencapaian SLA/SLG Setiap Bulan Periode ${periodTitle}`;
    wsSummary.getCell('A15').font = { name: 'Calibri', size: 10, italic: true, color: { argb: '475569' } };

    const mbHeaders = ['NO', 'PERIODE BULAN', 'JUMLAH ORDER', 'RESPONSE TIME (5%)', 'ONSITE SUPPORT (5%)', 'RESTORE TIME (15%)', 'RESOLUTION TIME (15%)', 'TOTAL SKOR SLG (40%)'];
    const r16Mb = wsSummary.getRow(16);
    r16Mb.height = 24;
    mbHeaders.forEach((h, i) => {
      const cell = wsSummary.getCell(`${sumCols[i]}16`);
      cell.value = h;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
      cell.font = headerFontWhite;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });

    monthGroups.forEach((grp, idx) => {
      const rIdx = 17 + idx;
      const r = wsSummary.getRow(rIdx);
      r.height = 20;

      wsSummary.getCell(`A${rIdx}`).value = idx + 1;
      wsSummary.getCell(`B${rIdx}`).value = grp.monthLabel;
      wsSummary.getCell(`C${rIdx}`).value = `${grp.reports.length} Order`;
      wsSummary.getCell(`D${rIdx}`).value = grp.respScore / 100;
      wsSummary.getCell(`D${rIdx}`).numFmt = '0.00%';
      wsSummary.getCell(`E${rIdx}`).value = grp.onsiteScore / 100;
      wsSummary.getCell(`E${rIdx}`).numFmt = '0.00%';
      wsSummary.getCell(`F${rIdx}`).value = grp.restoreScore / 100;
      wsSummary.getCell(`F${rIdx}`).numFmt = '0.00%';
      wsSummary.getCell(`G${rIdx}`).value = grp.resolutionScore / 100;
      wsSummary.getCell(`G${rIdx}`).numFmt = '0.00%';
      wsSummary.getCell(`H${rIdx}`).value = grp.totalScore / 100;
      wsSummary.getCell(`H${rIdx}`).numFmt = '0.00%';

      sumCols.forEach(col => {
        const cell = wsSummary.getCell(`${col}${rIdx}`);
        cell.font = dataFont;
        cell.border = thinBorder;
        cell.alignment = col === 'B' ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
        if (col === 'H') {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDF4' } };
        }
      });
    });

    // Grand total row for breakdown
    const totalMbRow = 17 + monthGroups.length;
    const rTotMb = wsSummary.getRow(totalMbRow);
    rTotMb.height = 24;

    wsSummary.mergeCells(`A${totalMbRow}:B${totalMbRow}`);
    const lblTotMb = wsSummary.getCell(`A${totalMbRow}`);
    lblTotMb.value = `TOTAL KUMULATIF (${monthGroups.length} BULAN):`;
    lblTotMb.font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
    lblTotMb.alignment = { horizontal: 'right', vertical: 'middle' };
    lblTotMb.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    lblTotMb.border = thinBorder;

    wsSummary.getCell(`C${totalMbRow}`).value = `${reports.length} Order`;
    wsSummary.getCell(`C${totalMbRow}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
    wsSummary.getCell(`C${totalMbRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getCell(`C${totalMbRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    wsSummary.getCell(`C${totalMbRow}`).border = thinBorder;

    wsSummary.getCell(`D${totalMbRow}`).value = respScore / 100;
    wsSummary.getCell(`D${totalMbRow}`).numFmt = '0.00%';
    wsSummary.getCell(`D${totalMbRow}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
    wsSummary.getCell(`D${totalMbRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getCell(`D${totalMbRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    wsSummary.getCell(`D${totalMbRow}`).border = thinBorder;

    wsSummary.getCell(`E${totalMbRow}`).value = onsiteScore / 100;
    wsSummary.getCell(`E${totalMbRow}`).numFmt = '0.00%';
    wsSummary.getCell(`E${totalMbRow}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
    wsSummary.getCell(`E${totalMbRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getCell(`E${totalMbRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    wsSummary.getCell(`E${totalMbRow}`).border = thinBorder;

    wsSummary.getCell(`F${totalMbRow}`).value = restoreScore / 100;
    wsSummary.getCell(`F${totalMbRow}`).numFmt = '0.00%';
    wsSummary.getCell(`F${totalMbRow}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
    wsSummary.getCell(`F${totalMbRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getCell(`F${totalMbRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    wsSummary.getCell(`F${totalMbRow}`).border = thinBorder;

    wsSummary.getCell(`G${totalMbRow}`).value = resolutionScore / 100;
    wsSummary.getCell(`G${totalMbRow}`).numFmt = '0.00%';
    wsSummary.getCell(`G${totalMbRow}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
    wsSummary.getCell(`G${totalMbRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getCell(`G${totalMbRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    wsSummary.getCell(`G${totalMbRow}`).border = thinBorder;

    wsSummary.getCell(`H${totalMbRow}`).value = totalSlgScore / 100;
    wsSummary.getCell(`H${totalMbRow}`).numFmt = '0.00%';
    wsSummary.getCell(`H${totalMbRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: '854D0E' } };
    wsSummary.getCell(`H${totalMbRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getCell(`H${totalMbRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF08A' } };
    wsSummary.getCell(`H${totalMbRow}`).border = thinBorder;

    // TABEL REKAPITULASI PENCAPAIAN KINERJA SLA & SLG MASING-MASING BULAN
    let currentMonthRecapRow = totalMbRow + 2;

    monthGroups.forEach((grp) => {
      wsSummary.getRow(currentMonthRecapRow).height = 14;
      currentMonthRecapRow++;

      const titleCell = wsSummary.getCell(`A${currentMonthRecapRow}`);
      titleCell.value = `REKAPITULASI PENCAPAIAN KINERJA SLA & SLG — BULAN ${grp.monthLabel.toUpperCase()}`;
      titleCell.font = titleFontLarge;

      const sub1Cell = wsSummary.getCell(`A${currentMonthRecapRow + 1}`);
      sub1Cell.value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
      sub1Cell.font = titleFontSub;

      const sub2Cell = wsSummary.getCell(`A${currentMonthRecapRow + 2}`);
      sub2Cell.value = `Periode: Bulan ${grp.monthLabel} (${grp.reports.length} Order Tiket)`;
      sub2Cell.font = titleFontSub;

      const headerRowIndex = currentMonthRecapRow + 4;
      const rHeader = wsSummary.getRow(headerRowIndex);
      rHeader.height = 24;
      sumHeaders.forEach((h, i) => {
        const cell = wsSummary.getCell(`${sumCols[i]}${headerRowIndex}`);
        cell.value = h;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
        cell.font = headerFontWhite;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });

      const mCount = grp.reports.length;
      const mRespPct = mCount > 0 ? grp.respMCount / mCount : 1;
      const mOnsitePct = mCount > 0 ? grp.onsiteMCount / mCount : 1;
      const mRestorePct = mCount > 0 ? grp.restoreMCount / mCount : 1;
      const mResoPct = mCount > 0 ? grp.resolutionMCount / mCount : 1;

      const mRowsData = [
        { no: 1, title: 'Response Time', unit: 'Order', bobot: 0.05, count: mCount, comply: grp.respMCount, pct: mRespPct, score: grp.respScore / 100 },
        { no: 2, title: 'Onsite Time (Principle Onsite)', unit: 'Order', bobot: 0.05, count: mCount, comply: grp.onsiteMCount, pct: mOnsitePct, score: grp.onsiteScore / 100 },
        { no: 3, title: 'Restore Time (Service Restore)', unit: 'Order', bobot: 0.15, count: mCount, comply: grp.restoreMCount, pct: mRestorePct, score: grp.restoreScore / 100 },
        { no: 4, title: 'Resolution Time (Problem Resolution)', unit: 'Order', bobot: 0.15, count: mCount, comply: grp.resolutionMCount, pct: mResoPct, score: grp.resolutionScore / 100 },
      ];

      const startDataRow = headerRowIndex + 1;
      mRowsData.forEach((row, rIdx) => {
        const rowNum = startDataRow + rIdx;
        const r = wsSummary.getRow(rowNum);
        r.height = 20;

        wsSummary.getCell(`A${rowNum}`).value = row.no;
        wsSummary.getCell(`B${rowNum}`).value = row.title;
        wsSummary.getCell(`C${rowNum}`).value = row.unit;
        wsSummary.getCell(`D${rowNum}`).value = row.count;
        wsSummary.getCell(`E${rowNum}`).value = row.comply;
        wsSummary.getCell(`F${rowNum}`).value = { formula: `IF(D${rowNum}>0,E${rowNum}/D${rowNum},1)`, result: row.pct };
        wsSummary.getCell(`F${rowNum}`).numFmt = '0.00%';
        wsSummary.getCell(`G${rowNum}`).value = row.bobot;
        wsSummary.getCell(`G${rowNum}`).numFmt = '0%';
        wsSummary.getCell(`H${rowNum}`).value = { formula: `F${rowNum}*G${rowNum}`, result: row.score };
        wsSummary.getCell(`H${rowNum}`).numFmt = '0.00%';

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

      const endDataRow = startDataRow + 3;
      const mTotalRowNum = endDataRow + 1;
      const rMTotal = wsSummary.getRow(mTotalRowNum);
      rMTotal.height = 24;

      wsSummary.mergeCells(`A${mTotalRowNum}:F${mTotalRowNum}`);
      const lblMTotal = wsSummary.getCell(`A${mTotalRowNum}`);
      lblMTotal.value = `TOTAL HASIL AKHIR PENCAPAIAN SLG BULAN ${grp.monthLabel.toUpperCase()} (MAX 40%):`;
      lblMTotal.font = { name: 'Calibri', size: 11, bold: true, color: { argb: textDark } };
      lblMTotal.alignment = { horizontal: 'right', vertical: 'middle' };
      lblMTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
      lblMTotal.border = thinBorder;

      wsSummary.mergeCells(`G${mTotalRowNum}:H${mTotalRowNum}`);
      const mTotalVal = wsSummary.getCell(`G${mTotalRowNum}`);
      mTotalVal.value = { formula: `SUM(H${startDataRow}:H${endDataRow})`, result: grp.totalScore / 100 };
      mTotalVal.numFmt = '0.00%';
      mTotalVal.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '854D0E' } };
      mTotalVal.alignment = { horizontal: 'center', vertical: 'middle' };
      mTotalVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF08A' } };
      mTotalVal.border = thinBorder;

      currentMonthRecapRow = mTotalRowNum + 1;
    });
  }

  wsSummary.getColumn('A').width = 6;
  wsSummary.getColumn('B').width = 36;
  wsSummary.getColumn('C').width = 14;
  wsSummary.getColumn('D').width = 18;
  wsSummary.getColumn('E').width = 18;
  wsSummary.getColumn('F').width = 18;
  wsSummary.getColumn('G').width = 18;
  wsSummary.getColumn('H').width = 20;

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

  let currentRespRow = 7;
  const respSubtotalRows: number[] = [];

  monthGroups.forEach((grp) => {
    if (monthGroups.length > 1) {
      wsResp.mergeCells(`A${currentRespRow}:K${currentRespRow}`);
      const bCell = wsResp.getCell(`A${currentRespRow}`);
      bCell.value = `BULAN: ${grp.monthLabel.toUpperCase()} (${grp.reports.length} Order Tiket)`;
      bCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
      bCell.font = headerFontWhite;
      bCell.alignment = { horizontal: 'left', vertical: 'middle' };
      wsResp.getRow(currentRespRow).height = 22;
      currentRespRow++;
    }

    const monthStartDataRow = currentRespRow;
    grp.reports.forEach((r, lIdx) => {
      const globalIdx = grp.startIndex + lIdx;
      const rowNum = currentRespRow;
      const row = wsResp.getRow(rowNum);
      row.height = 20;

      const comply = (r.responseComply !== false) && (r.actualResponseTimeMin !== undefined ? r.actualResponseTimeMin <= (r.targetResponseMin || 5) : true);

      wsResp.getCell(`A${rowNum}`).value = globalIdx + 1;
      wsResp.getCell(`B${rowNum}`).value = r.ticketName || r.issue || 'WO';
      wsResp.getCell(`C${rowNum}`).value = r.location || '-';
      wsResp.getCell(`D${rowNum}`).value = r.picDME || 'On Duty DME';
      wsResp.getCell(`E${rowNum}`).value = (!r.picTDE || r.picTDE === 'FMA - CBRE' || r.picTDE === '-') ? 'FMA - OCS' : r.picTDE;
      wsResp.getCell(`F${rowNum}`).value = formatExcelDate(r.timeOrder);
      wsResp.getCell(`G${rowNum}`).value = formatExcelDate(r.actualTimeResponse);
      wsResp.getCell(`H${rowNum}`).value = r.actualResponseTimeMin ?? 0;
      wsResp.getCell(`I${rowNum}`).value = r.targetResponseMin || 5;
      wsResp.getCell(`J${rowNum}`).value = { formula: `IF(H${rowNum}<=I${rowNum},"M","TM")`, result: comply ? 'M' : 'TM' };
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
      currentRespRow++;
    });

    if (monthGroups.length > 1) {
      const subRowNum = currentRespRow;
      respSubtotalRows.push(subRowNum);
      const row = wsResp.getRow(subRowNum);
      row.height = 22;

      const mActual = grp.reports.reduce((sum, r) => sum + (r.actualResponseTimeMin ?? 0), 0);
      const mTarget = grp.reports.reduce((sum, r) => sum + (r.targetResponseMin || 5), 0);
      const mComply = mActual <= mTarget;
      const monthEndDataRow = subRowNum - 1;

      wsResp.mergeCells(`A${subRowNum}:G${subRowNum}`);
      const lblSub = wsResp.getCell(`A${subRowNum}`);
      lblSub.value = `Subtotal ${grp.monthLabel} (${grp.reports.length} Order):`;
      lblSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '334155' } };
      lblSub.alignment = { horizontal: 'right', vertical: 'middle' };
      lblSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

      wsResp.getCell(`H${subRowNum}`).value = { formula: `SUM(H${monthStartDataRow}:H${monthEndDataRow})`, result: mActual };
      wsResp.getCell(`H${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
      wsResp.getCell(`H${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsResp.getCell(`H${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };

      wsResp.getCell(`I${subRowNum}`).value = { formula: `SUM(I${monthStartDataRow}:I${monthEndDataRow})`, result: mTarget };
      wsResp.getCell(`I${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
      wsResp.getCell(`I${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsResp.getCell(`I${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };

      wsResp.getCell(`J${subRowNum}`).value = { formula: `IF(H${subRowNum}<=I${subRowNum},"M","TM")`, result: mComply ? 'M' : 'TM' };
      wsResp.getCell(`J${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: mComply ? '166534' : '991B1B' } };
      wsResp.getCell(`J${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsResp.getCell(`J${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mComply ? 'DCFCE7' : 'FEE2E2' } };

      wsResp.getCell(`K${subRowNum}`).value = { formula: `IF(J${subRowNum}="M","Memenuhi","Tidak Memenuhi")`, result: mComply ? 'Memenuhi' : 'Tidak Memenuhi' };
      wsResp.getCell(`K${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: mComply ? '166534' : '991B1B' } };
      wsResp.getCell(`K${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsResp.getCell(`K${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mComply ? 'DCFCE7' : 'FEE2E2' } };

      respCols.forEach(col => {
        wsResp.getCell(`${col}${subRowNum}`).border = thinBorder;
      });

      currentRespRow++;
    }
  });

  // TOTAL ROW: Response Time
  const totalRespRowNum = currentRespRow;
  const rTotalResp = wsResp.getRow(totalRespRowNum);
  rTotalResp.height = 24;

  const totalRespActualMin = reports.reduce((sum, r) => sum + (r.actualResponseTimeMin ?? 0), 0);
  const totalRespTargetMin = reports.reduce((sum, r) => sum + (r.targetResponseMin || 5), 0);
  const isRespTotalComply = totalRespActualMin <= totalRespTargetMin;

  wsResp.mergeCells(`A${totalRespRowNum}:G${totalRespRowNum}`);
  const lblResp = wsResp.getCell(`A${totalRespRowNum}`);
  lblResp.value = monthGroups.length > 1
    ? `GRAND TOTAL KUMULATIF (${reports.length} Order Tiket - ${monthGroups.length} Bulan):`
    : `TOTAL (${reports.length} Order Tiket):`;
  lblResp.font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  lblResp.alignment = { horizontal: 'right', vertical: 'middle' };
  lblResp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CBD5E1' } };

  const formulaRespH = monthGroups.length > 1
    ? `SUM(${respSubtotalRows.map(r => `H${r}`).join(',')})`
    : `SUM(H7:H${totalRespRowNum - 1})`;
  const formulaRespI = monthGroups.length > 1
    ? `SUM(${respSubtotalRows.map(r => `I${r}`).join(',')})`
    : `SUM(I7:I${totalRespRowNum - 1})`;

  wsResp.getCell(`H${totalRespRowNum}`).value = { formula: formulaRespH, result: totalRespActualMin };
  wsResp.getCell(`H${totalRespRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  wsResp.getCell(`H${totalRespRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsResp.getCell(`H${totalRespRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

  wsResp.getCell(`I${totalRespRowNum}`).value = { formula: formulaRespI, result: totalRespTargetMin };
  wsResp.getCell(`I${totalRespRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  wsResp.getCell(`I${totalRespRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsResp.getCell(`I${totalRespRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

  wsResp.getCell(`J${totalRespRowNum}`).value = { formula: `IF(H${totalRespRowNum}<=I${totalRespRowNum},"M","TM")`, result: isRespTotalComply ? 'M' : 'TM' };
  wsResp.getCell(`J${totalRespRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: isRespTotalComply ? '166534' : '991B1B' } };
  wsResp.getCell(`J${totalRespRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsResp.getCell(`J${totalRespRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isRespTotalComply ? 'DCFCE7' : 'FEE2E2' } };

  wsResp.getCell(`K${totalRespRowNum}`).value = { formula: `IF(J${totalRespRowNum}="M","Memenuhi","Tidak Memenuhi")`, result: isRespTotalComply ? 'Memenuhi' : 'Tidak Memenuhi' };
  wsResp.getCell(`K${totalRespRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: isRespTotalComply ? '166534' : '991B1B' } };
  wsResp.getCell(`K${totalRespRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsResp.getCell(`K${totalRespRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isRespTotalComply ? 'DCFCE7' : 'FEE2E2' } };

  respCols.forEach(col => {
    wsResp.getCell(`${col}${totalRespRowNum}`).border = thinBorder;
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

  addComplyConditionalFormatting(wsResp, `J7:J${totalRespRowNum}`, `K${totalRespRowNum}:K${totalRespRowNum}`);

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

  let currentOnsiteRow = 7;
  const onsiteSubtotalRows: number[] = [];

  monthGroups.forEach((grp) => {
    if (monthGroups.length > 1) {
      wsOnsite.mergeCells(`A${currentOnsiteRow}:K${currentOnsiteRow}`);
      const bCell = wsOnsite.getCell(`A${currentOnsiteRow}`);
      bCell.value = `BULAN: ${grp.monthLabel.toUpperCase()} (${grp.reports.length} Order Tiket)`;
      bCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
      bCell.font = headerFontWhite;
      bCell.alignment = { horizontal: 'left', vertical: 'middle' };
      wsOnsite.getRow(currentOnsiteRow).height = 22;
      currentOnsiteRow++;
    }

    const monthStartDataRow = currentOnsiteRow;
    grp.reports.forEach((r, lIdx) => {
      const globalIdx = grp.startIndex + lIdx;
      const rowNum = currentOnsiteRow;
      const row = wsOnsite.getRow(rowNum);
      row.height = 20;

      const comply = (r.onsiteComply !== false) && (r.actualOnsiteTimeMin !== undefined ? r.actualOnsiteTimeMin <= (r.targetOnsiteMin || 120) : true);

      wsOnsite.getCell(`A${rowNum}`).value = globalIdx + 1;
      wsOnsite.getCell(`B${rowNum}`).value = r.ticketName || r.issue || 'WO';
      wsOnsite.getCell(`C${rowNum}`).value = r.location || '-';
      wsOnsite.getCell(`D${rowNum}`).value = r.picDME || 'On Duty DME';
      wsOnsite.getCell(`E${rowNum}`).value = (!r.picTDE || r.picTDE === 'FMA - CBRE' || r.picTDE === '-') ? 'FMA - OCS' : r.picTDE;
      wsOnsite.getCell(`F${rowNum}`).value = formatExcelDate(r.timeOrder);
      wsOnsite.getCell(`G${rowNum}`).value = formatExcelDate(r.actualTimeOnsite);
      wsOnsite.getCell(`H${rowNum}`).value = r.actualOnsiteTimeMin ?? 0;
      wsOnsite.getCell(`I${rowNum}`).value = r.targetOnsiteMin || 120;
      wsOnsite.getCell(`J${rowNum}`).value = { formula: `IF(H${rowNum}<=I${rowNum},"M","TM")`, result: comply ? 'M' : 'TM' };
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
      currentOnsiteRow++;
    });

    if (monthGroups.length > 1) {
      const subRowNum = currentOnsiteRow;
      onsiteSubtotalRows.push(subRowNum);
      const row = wsOnsite.getRow(subRowNum);
      row.height = 22;

      const mActual = grp.reports.reduce((sum, r) => sum + (r.actualOnsiteTimeMin ?? 0), 0);
      const mTarget = grp.reports.reduce((sum, r) => sum + (r.targetOnsiteMin || 120), 0);
      const mComply = mActual <= mTarget;
      const monthEndDataRow = subRowNum - 1;

      wsOnsite.mergeCells(`A${subRowNum}:G${subRowNum}`);
      const lblSub = wsOnsite.getCell(`A${subRowNum}`);
      lblSub.value = `Subtotal ${grp.monthLabel} (${grp.reports.length} Order):`;
      lblSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '334155' } };
      lblSub.alignment = { horizontal: 'right', vertical: 'middle' };
      lblSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

      wsOnsite.getCell(`H${subRowNum}`).value = { formula: `SUM(H${monthStartDataRow}:H${monthEndDataRow})`, result: mActual };
      wsOnsite.getCell(`H${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
      wsOnsite.getCell(`H${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsOnsite.getCell(`H${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };

      wsOnsite.getCell(`I${subRowNum}`).value = { formula: `SUM(I${monthStartDataRow}:I${monthEndDataRow})`, result: mTarget };
      wsOnsite.getCell(`I${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
      wsOnsite.getCell(`I${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsOnsite.getCell(`I${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };

      wsOnsite.getCell(`J${subRowNum}`).value = { formula: `IF(H${subRowNum}<=I${subRowNum},"M","TM")`, result: mComply ? 'M' : 'TM' };
      wsOnsite.getCell(`J${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: mComply ? '166534' : '991B1B' } };
      wsOnsite.getCell(`J${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsOnsite.getCell(`J${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mComply ? 'DCFCE7' : 'FEE2E2' } };

      wsOnsite.getCell(`K${subRowNum}`).value = { formula: `IF(J${subRowNum}="M","Memenuhi","Tidak Memenuhi")`, result: mComply ? 'Memenuhi' : 'Tidak Memenuhi' };
      wsOnsite.getCell(`K${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: mComply ? '166534' : '991B1B' } };
      wsOnsite.getCell(`K${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsOnsite.getCell(`K${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mComply ? 'DCFCE7' : 'FEE2E2' } };

      onsiteCols.forEach(col => {
        wsOnsite.getCell(`${col}${subRowNum}`).border = thinBorder;
      });

      currentOnsiteRow++;
    }
  });

  // TOTAL ROW: Onsite Support
  const totalOnsiteRowNum = currentOnsiteRow;
  const rTotalOnsite = wsOnsite.getRow(totalOnsiteRowNum);
  rTotalOnsite.height = 24;

  const totalOnsiteActualMin = reports.reduce((sum, r) => sum + (r.actualOnsiteTimeMin ?? 0), 0);
  const totalOnsiteTargetMin = reports.reduce((sum, r) => sum + (r.targetOnsiteMin || 120), 0);
  const isOnsiteTotalComply = totalOnsiteActualMin <= totalOnsiteTargetMin;

  wsOnsite.mergeCells(`A${totalOnsiteRowNum}:G${totalOnsiteRowNum}`);
  const lblOnsite = wsOnsite.getCell(`A${totalOnsiteRowNum}`);
  lblOnsite.value = monthGroups.length > 1
    ? `GRAND TOTAL KUMULATIF (${reports.length} Order Tiket - ${monthGroups.length} Bulan):`
    : `TOTAL (${reports.length} Order Tiket):`;
  lblOnsite.font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  lblOnsite.alignment = { horizontal: 'right', vertical: 'middle' };
  lblOnsite.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CBD5E1' } };

  const formulaOnsiteH = monthGroups.length > 1
    ? `SUM(${onsiteSubtotalRows.map(r => `H${r}`).join(',')})`
    : `SUM(H7:H${totalOnsiteRowNum - 1})`;
  const formulaOnsiteI = monthGroups.length > 1
    ? `SUM(${onsiteSubtotalRows.map(r => `I${r}`).join(',')})`
    : `SUM(I7:I${totalOnsiteRowNum - 1})`;

  wsOnsite.getCell(`H${totalOnsiteRowNum}`).value = { formula: formulaOnsiteH, result: totalOnsiteActualMin };
  wsOnsite.getCell(`H${totalOnsiteRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  wsOnsite.getCell(`H${totalOnsiteRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsOnsite.getCell(`H${totalOnsiteRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

  wsOnsite.getCell(`I${totalOnsiteRowNum}`).value = { formula: formulaOnsiteI, result: totalOnsiteTargetMin };
  wsOnsite.getCell(`I${totalOnsiteRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  wsOnsite.getCell(`I${totalOnsiteRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsOnsite.getCell(`I${totalOnsiteRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

  wsOnsite.getCell(`J${totalOnsiteRowNum}`).value = { formula: `IF(H${totalOnsiteRowNum}<=I${totalOnsiteRowNum},"M","TM")`, result: isOnsiteTotalComply ? 'M' : 'TM' };
  wsOnsite.getCell(`J${totalOnsiteRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: isOnsiteTotalComply ? '166534' : '991B1B' } };
  wsOnsite.getCell(`J${totalOnsiteRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsOnsite.getCell(`J${totalOnsiteRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isOnsiteTotalComply ? 'DCFCE7' : 'FEE2E2' } };

  wsOnsite.getCell(`K${totalOnsiteRowNum}`).value = { formula: `IF(J${totalOnsiteRowNum}="M","Memenuhi","Tidak Memenuhi")`, result: isOnsiteTotalComply ? 'Memenuhi' : 'Tidak Memenuhi' };
  wsOnsite.getCell(`K${totalOnsiteRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: isOnsiteTotalComply ? '166534' : '991B1B' } };
  wsOnsite.getCell(`K${totalOnsiteRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsOnsite.getCell(`K${totalOnsiteRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isOnsiteTotalComply ? 'DCFCE7' : 'FEE2E2' } };

  onsiteCols.forEach(col => {
    wsOnsite.getCell(`${col}${totalOnsiteRowNum}`).border = thinBorder;
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

  addComplyConditionalFormatting(wsOnsite, `J7:J${totalOnsiteRowNum}`, `K${totalOnsiteRowNum}:K${totalOnsiteRowNum}`);

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

  let currentRestoreRow = 7;
  const restoreSubtotalRows: number[] = [];

  monthGroups.forEach((grp) => {
    if (monthGroups.length > 1) {
      wsRestore.mergeCells(`A${currentRestoreRow}:I${currentRestoreRow}`);
      const bCell = wsRestore.getCell(`A${currentRestoreRow}`);
      bCell.value = `BULAN: ${grp.monthLabel.toUpperCase()} (${grp.reports.length} Order Tiket)`;
      bCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
      bCell.font = headerFontWhite;
      bCell.alignment = { horizontal: 'left', vertical: 'middle' };
      wsRestore.getRow(currentRestoreRow).height = 22;
      currentRestoreRow++;
    }

    const monthStartDataRow = currentRestoreRow;
    grp.reports.forEach((r, lIdx) => {
      const globalIdx = grp.startIndex + lIdx;
      const rowNum = currentRestoreRow;
      const row = wsRestore.getRow(rowNum);
      row.height = 20;

      const targetRST = 180;
      const comply = (r.restoreComply !== false) && (r.actualRestoreTimeMin !== undefined ? r.actualRestoreTimeMin <= targetRST : true);

      wsRestore.getCell(`A${rowNum}`).value = globalIdx + 1;
      wsRestore.getCell(`B${rowNum}`).value = r.ticketName || r.issue || 'WO';
      wsRestore.getCell(`C${rowNum}`).value = r.location || '-';
      wsRestore.getCell(`D${rowNum}`).value = formatExcelDate(r.startOrder || r.timeOrder);
      wsRestore.getCell(`E${rowNum}`).value = formatExcelDate(r.finishOrder);
      wsRestore.getCell(`F${rowNum}`).value = r.actualRestoreTimeMin ?? 0;
      wsRestore.getCell(`G${rowNum}`).value = targetRST;
      wsRestore.getCell(`H${rowNum}`).value = { formula: `IF(F${rowNum}<=G${rowNum},"M","TM")`, result: comply ? 'M' : 'TM' };
      wsRestore.getCell(`I${rowNum}`).value = r.actionTaken || r.remark || 'Perbaikan corrective restore service';

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
      currentRestoreRow++;
    });

    if (monthGroups.length > 1) {
      const subRowNum = currentRestoreRow;
      restoreSubtotalRows.push(subRowNum);
      const row = wsRestore.getRow(subRowNum);
      row.height = 22;

      const mActual = grp.reports.reduce((sum, r) => sum + (r.actualRestoreTimeMin ?? 0), 0);
      const mTarget = grp.reports.reduce((sum) => sum + 180, 0);
      const mComply = mActual <= mTarget;
      const monthEndDataRow = subRowNum - 1;

      wsRestore.mergeCells(`A${subRowNum}:E${subRowNum}`);
      const lblSub = wsRestore.getCell(`A${subRowNum}`);
      lblSub.value = `Subtotal ${grp.monthLabel} (${grp.reports.length} Order):`;
      lblSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '334155' } };
      lblSub.alignment = { horizontal: 'right', vertical: 'middle' };
      lblSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

      wsRestore.getCell(`F${subRowNum}`).value = { formula: `SUM(F${monthStartDataRow}:F${monthEndDataRow})`, result: mActual };
      wsRestore.getCell(`F${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
      wsRestore.getCell(`F${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsRestore.getCell(`F${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };

      wsRestore.getCell(`G${subRowNum}`).value = { formula: `SUM(G${monthStartDataRow}:G${monthEndDataRow})`, result: mTarget };
      wsRestore.getCell(`G${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
      wsRestore.getCell(`G${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsRestore.getCell(`G${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };

      wsRestore.getCell(`H${subRowNum}`).value = { formula: `IF(F${subRowNum}<=G${subRowNum},"M","TM")`, result: mComply ? 'M' : 'TM' };
      wsRestore.getCell(`H${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: mComply ? '166534' : '991B1B' } };
      wsRestore.getCell(`H${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsRestore.getCell(`H${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mComply ? 'DCFCE7' : 'FEE2E2' } };

      wsRestore.getCell(`I${subRowNum}`).value = { formula: `IF(H${subRowNum}="M","Memenuhi","Tidak Memenuhi")`, result: mComply ? 'Memenuhi' : 'Tidak Memenuhi' };
      wsRestore.getCell(`I${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: mComply ? '166534' : '991B1B' } };
      wsRestore.getCell(`I${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsRestore.getCell(`I${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mComply ? 'DCFCE7' : 'FEE2E2' } };

      restCols.forEach(col => {
        wsRestore.getCell(`${col}${subRowNum}`).border = thinBorder;
      });

      currentRestoreRow++;
    }
  });

  // TOTAL ROW: Restore Time
  const totalRestoreRowNum = currentRestoreRow;
  const rTotalRestore = wsRestore.getRow(totalRestoreRowNum);
  rTotalRestore.height = 24;

  const totalRestoreActualMin = reports.reduce((sum, r) => sum + (r.actualRestoreTimeMin ?? 0), 0);
  const totalRestoreTargetMin = reports.reduce((sum) => sum + 180, 0);
  const isRestoreTotalComply = totalRestoreActualMin <= totalRestoreTargetMin;

  wsRestore.mergeCells(`A${totalRestoreRowNum}:E${totalRestoreRowNum}`);
  const lblRestore = wsRestore.getCell(`A${totalRestoreRowNum}`);
  lblRestore.value = monthGroups.length > 1
    ? `GRAND TOTAL KUMULATIF (${reports.length} Order Tiket - ${monthGroups.length} Bulan):`
    : `TOTAL (${reports.length} Order Tiket):`;
  lblRestore.font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  lblRestore.alignment = { horizontal: 'right', vertical: 'middle' };
  lblRestore.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CBD5E1' } };

  const formulaRestoreF = monthGroups.length > 1
    ? `SUM(${restoreSubtotalRows.map(r => `F${r}`).join(',')})`
    : `SUM(F7:F${totalRestoreRowNum - 1})`;
  const formulaRestoreG = monthGroups.length > 1
    ? `SUM(${restoreSubtotalRows.map(r => `G${r}`).join(',')})`
    : `SUM(G7:G${totalRestoreRowNum - 1})`;

  wsRestore.getCell(`F${totalRestoreRowNum}`).value = { formula: formulaRestoreF, result: totalRestoreActualMin };
  wsRestore.getCell(`F${totalRestoreRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  wsRestore.getCell(`F${totalRestoreRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsRestore.getCell(`F${totalRestoreRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

  wsRestore.getCell(`G${totalRestoreRowNum}`).value = { formula: formulaRestoreG, result: totalRestoreTargetMin };
  wsRestore.getCell(`G${totalRestoreRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  wsRestore.getCell(`G${totalRestoreRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsRestore.getCell(`G${totalRestoreRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

  wsRestore.getCell(`H${totalRestoreRowNum}`).value = { formula: `IF(F${totalRestoreRowNum}<=G${totalRestoreRowNum},"M","TM")`, result: isRestoreTotalComply ? 'M' : 'TM' };
  wsRestore.getCell(`H${totalRestoreRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: isRestoreTotalComply ? '166534' : '991B1B' } };
  wsRestore.getCell(`H${totalRestoreRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsRestore.getCell(`H${totalRestoreRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isRestoreTotalComply ? 'DCFCE7' : 'FEE2E2' } };

  wsRestore.getCell(`I${totalRestoreRowNum}`).value = { formula: `IF(H${totalRestoreRowNum}="M","Memenuhi","Tidak Memenuhi")`, result: isRestoreTotalComply ? 'Memenuhi' : 'Tidak Memenuhi' };
  wsRestore.getCell(`I${totalRestoreRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: isRestoreTotalComply ? '166534' : '991B1B' } };
  wsRestore.getCell(`I${totalRestoreRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsRestore.getCell(`I${totalRestoreRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isRestoreTotalComply ? 'DCFCE7' : 'FEE2E2' } };

  restCols.forEach(col => {
    wsRestore.getCell(`${col}${totalRestoreRowNum}`).border = thinBorder;
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

  addComplyConditionalFormatting(wsRestore, `H7:H${totalRestoreRowNum}`, `I${totalRestoreRowNum}:I${totalRestoreRowNum}`);

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

  let currentResoRow = 7;
  const resoSubtotalRows: number[] = [];

  monthGroups.forEach((grp) => {
    if (monthGroups.length > 1) {
      wsReso.mergeCells(`A${currentResoRow}:J${currentResoRow}`);
      const bCell = wsReso.getCell(`A${currentResoRow}`);
      bCell.value = `BULAN: ${grp.monthLabel.toUpperCase()} (${grp.reports.length} Order Tiket)`;
      bCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
      bCell.font = headerFontWhite;
      bCell.alignment = { horizontal: 'left', vertical: 'middle' };
      wsReso.getRow(currentResoRow).height = 22;
      currentResoRow++;
    }

    const monthStartDataRow = currentResoRow;
    grp.reports.forEach((r, lIdx) => {
      const globalIdx = grp.startIndex + lIdx;
      const rowNum = currentResoRow;
      const row = wsReso.getRow(rowNum);
      row.height = 20;

      const targetRSP = r.targetResolutionMin || getTargetByPriority(r.priority);
      const comply = (r.resolutionComply !== false) && (r.actualResolutionTimeMin !== undefined ? r.actualResolutionTimeMin <= targetRSP : true);

      wsReso.getCell(`A${rowNum}`).value = globalIdx + 1;
      wsReso.getCell(`B${rowNum}`).value = r.ticketName || r.issue || 'WO';
      wsReso.getCell(`C${rowNum}`).value = r.priority || 'Medium';
      wsReso.getCell(`D${rowNum}`).value = r.location || '-';
      wsReso.getCell(`E${rowNum}`).value = formatExcelDate(r.startOrder || r.timeOrder);
      wsReso.getCell(`F${rowNum}`).value = formatExcelDate(r.finishOrder);
      wsReso.getCell(`G${rowNum}`).value = r.actualResolutionTimeMin ?? 0;
      wsReso.getCell(`H${rowNum}`).value = targetRSP;
      wsReso.getCell(`I${rowNum}`).value = { formula: `IF(G${rowNum}<=H${rowNum},"M","TM")`, result: comply ? 'M' : 'TM' };
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
      currentResoRow++;
    });

    if (monthGroups.length > 1) {
      const subRowNum = currentResoRow;
      resoSubtotalRows.push(subRowNum);
      const row = wsReso.getRow(subRowNum);
      row.height = 22;

      const mActual = grp.reports.reduce((sum, r) => sum + (r.actualResolutionTimeMin ?? 0), 0);
      const mTarget = grp.reports.reduce((sum, r) => sum + (r.targetResolutionMin || getTargetByPriority(r.priority)), 0);
      const mComply = mActual <= mTarget;
      const monthEndDataRow = subRowNum - 1;

      wsReso.mergeCells(`A${subRowNum}:F${subRowNum}`);
      const lblSub = wsReso.getCell(`A${subRowNum}`);
      lblSub.value = `Subtotal ${grp.monthLabel} (${grp.reports.length} Order):`;
      lblSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '334155' } };
      lblSub.alignment = { horizontal: 'right', vertical: 'middle' };
      lblSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

      wsReso.getCell(`G${subRowNum}`).value = { formula: `SUM(G${monthStartDataRow}:G${monthEndDataRow})`, result: mActual };
      wsReso.getCell(`G${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
      wsReso.getCell(`G${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsReso.getCell(`G${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };

      wsReso.getCell(`H${subRowNum}`).value = { formula: `SUM(H${monthStartDataRow}:H${monthEndDataRow})`, result: mTarget };
      wsReso.getCell(`H${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
      wsReso.getCell(`H${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsReso.getCell(`H${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };

      wsReso.getCell(`I${subRowNum}`).value = { formula: `IF(G${subRowNum}<=H${subRowNum},"M","TM")`, result: mComply ? 'M' : 'TM' };
      wsReso.getCell(`I${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: mComply ? '166534' : '991B1B' } };
      wsReso.getCell(`I${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsReso.getCell(`I${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mComply ? 'DCFCE7' : 'FEE2E2' } };

      wsReso.getCell(`J${subRowNum}`).value = { formula: `IF(I${subRowNum}="M","Memenuhi","Tidak Memenuhi")`, result: mComply ? 'Memenuhi' : 'Tidak Memenuhi' };
      wsReso.getCell(`J${subRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: mComply ? '166534' : '991B1B' } };
      wsReso.getCell(`J${subRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
      wsReso.getCell(`J${subRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mComply ? 'DCFCE7' : 'FEE2E2' } };

      resoCols.forEach(col => {
        wsReso.getCell(`${col}${subRowNum}`).border = thinBorder;
      });

      currentResoRow++;
    }
  });

  // TOTAL ROW: Resolution Time
  const totalResoRowNum = currentResoRow;
  const rTotalReso = wsReso.getRow(totalResoRowNum);
  rTotalReso.height = 24;

  const totalResoActualMin = reports.reduce((sum, r) => sum + (r.actualResolutionTimeMin ?? 0), 0);
  const totalResoTargetMin = reports.reduce((sum, r) => sum + (r.targetResolutionMin || getTargetByPriority(r.priority)), 0);
  const isResoTotalComply = totalResoActualMin <= totalResoTargetMin;

  wsReso.mergeCells(`A${totalResoRowNum}:F${totalResoRowNum}`);
  const lblReso = wsReso.getCell(`A${totalResoRowNum}`);
  lblReso.value = monthGroups.length > 1
    ? `GRAND TOTAL KUMULATIF (${reports.length} Order Tiket - ${monthGroups.length} Bulan):`
    : `TOTAL (${reports.length} Order Tiket):`;
  lblReso.font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  lblReso.alignment = { horizontal: 'right', vertical: 'middle' };
  lblReso.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CBD5E1' } };

  const formulaResoG = monthGroups.length > 1
    ? `SUM(${resoSubtotalRows.map(r => `G${r}`).join(',')})`
    : `SUM(G7:G${totalResoRowNum - 1})`;
  const formulaResoH = monthGroups.length > 1
    ? `SUM(${resoSubtotalRows.map(r => `H${r}`).join(',')})`
    : `SUM(H7:H${totalResoRowNum - 1})`;

  wsReso.getCell(`G${totalResoRowNum}`).value = { formula: formulaResoG, result: totalResoActualMin };
  wsReso.getCell(`G${totalResoRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  wsReso.getCell(`G${totalResoRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsReso.getCell(`G${totalResoRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

  wsReso.getCell(`H${totalResoRowNum}`).value = { formula: formulaResoH, result: totalResoTargetMin };
  wsReso.getCell(`H${totalResoRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: textDark } };
  wsReso.getCell(`H${totalResoRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsReso.getCell(`H${totalResoRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

  wsReso.getCell(`I${totalResoRowNum}`).value = { formula: `IF(G${totalResoRowNum}<=H${totalResoRowNum},"M","TM")`, result: isResoTotalComply ? 'M' : 'TM' };
  wsReso.getCell(`I${totalResoRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: isResoTotalComply ? '166534' : '991B1B' } };
  wsReso.getCell(`I${totalResoRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsReso.getCell(`I${totalResoRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isResoTotalComply ? 'DCFCE7' : 'FEE2E2' } };

  wsReso.getCell(`J${totalResoRowNum}`).value = { formula: `IF(I${totalResoRowNum}="M","Memenuhi","Tidak Memenuhi")`, result: isResoTotalComply ? 'Memenuhi' : 'Tidak Memenuhi' };
  wsReso.getCell(`J${totalResoRowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: isResoTotalComply ? '166534' : '991B1B' } };
  wsReso.getCell(`J${totalResoRowNum}`).alignment = { horizontal: 'center', vertical: 'middle' };
  wsReso.getCell(`J${totalResoRowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isRespTotalComply ? 'DCFCE7' : 'FEE2E2' } };

  resoCols.forEach(col => {
    wsReso.getCell(`${col}${totalResoRowNum}`).border = thinBorder;
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

  addComplyConditionalFormatting(wsReso, `I7:I${totalResoRowNum}`, `J${totalResoRowNum}:J${totalResoRowNum}`);

  // =========================================================================
  // SHEET 5 / EVIDENCE: BUKTI FOTO (Dipisahkan Per Bulan Jika Multi-Bulan)
  // =========================================================================
  const evHeaders = ['NO', 'ORDER / TIKET', 'BUKTI RESPONSE TIME', 'BUKTI ONSITE SUPPORT', 'BUKTI RESTORE TIME', 'BUKTI RESOLUTION TIME'];
  const evCols = ['A', 'B', 'C', 'D', 'E', 'F'];

  const createEvidenceWorksheet = (
    sheetName: string,
    titleHeader: string,
    subHeader: string,
    reportList: any[]
  ) => {
    const ws = workbook.addWorksheet(sheetName);
    ws.views = [{ showGridLines: true }];

    ws.getCell('A2').value = titleHeader;
    ws.getCell('A2').font = titleFontLarge;
    ws.getCell('A3').value = 'MAINTENANCE FACILITY INFRASTRUCTURE DC CIKARANG';
    ws.getCell('A3').font = titleFontSub;
    ws.getCell('A4').value = subHeader;
    ws.getCell('A4').font = titleFontSub;

    const r6 = ws.getRow(6);
    r6.height = 24;
    evHeaders.forEach((h, i) => {
      const cell = ws.getCell(`${evCols[i]}6`);
      cell.value = h;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerNavy } };
      cell.font = headerFontWhite;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });

    let currentEvRow = 7;
    reportList.forEach((r, lIdx) => {
      const displayNo = lIdx + 1;
      const startRow = currentEvRow;
      const endRow = currentEvRow + 4; // 5 Excel rows per ticket for image height

      for (let rIdx = startRow; rIdx <= endRow; rIdx++) {
        ws.getRow(rIdx).height = 28;
      }

      ws.mergeCells(`A${startRow}:A${endRow}`);
      const cellNo = ws.getCell(`A${startRow}`);
      cellNo.value = displayNo;
      cellNo.font = headerFontDark;
      cellNo.alignment = { horizontal: 'center', vertical: 'middle' };
      cellNo.border = thinBorder;

      ws.mergeCells(`B${startRow}:B${endRow}`);
      const cellTicket = ws.getCell(`B${startRow}`);
      cellTicket.value = `${r.ticketName || r.issue || 'WO'}\n(${r.priority || 'Medium'})\n${r.location || '-'}`;
      cellTicket.font = headerFontDark;
      cellTicket.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cellTicket.border = thinBorder;

      const respPhotos = getPhotos(r, 'photosResponse', 'photoResponse');
      const onsitePhotos = getPhotos(r, 'photosOnsite', 'photoOnsite');
      const restPhotos = getPhotos(r, 'photosRestore', 'photoRestore');
      const resoPhotos = getPhotos(r, 'photosResolution', 'photoResolution');

      if (respPhotos[0]) addExcelImageSafe(respPhotos[0], `C${startRow}:C${endRow}`, ws);
      if (onsitePhotos[0]) addExcelImageSafe(onsitePhotos[0], `D${startRow}:D${endRow}`, ws);
      if (restPhotos[0]) addExcelImageSafe(restPhotos[0], `E${startRow}:E${endRow}`, ws);
      if (resoPhotos[0]) addExcelImageSafe(resoPhotos[0], `F${startRow}:F${endRow}`, ws);

      for (let rIdx = startRow; rIdx <= endRow; rIdx++) {
        evCols.forEach(col => {
          ws.getCell(`${col}${rIdx}`).border = thinBorder;
        });
      }

      currentEvRow = endRow + 1;
    });

    ws.getColumn('A').width = 6;
    ws.getColumn('B').width = 24;
    ws.getColumn('C').width = 26;
    ws.getColumn('D').width = 26;
    ws.getColumn('E').width = 26;
    ws.getColumn('F').width = 26;
  };

  if (monthGroups.length > 1) {
    monthGroups.forEach((grp, gIdx) => {
      const cleanMonth = grp.monthLabel.replace(/[\\/?*[\]:]/g, '');
      const sheetName = `5.${gIdx + 1} Ev ${cleanMonth}`.slice(0, 31);
      const titleHeader = `5.${gIdx + 1}. EVIDENCE FOTO DOKUMENTASI — BULAN ${grp.monthLabel.toUpperCase()}`;
      const subHeader = `Bulan: ${grp.monthLabel} (${grp.reports.length} Order Tiket)`;
      createEvidenceWorksheet(sheetName, titleHeader, subHeader, grp.reports);
    });
  } else {
    createEvidenceWorksheet(
      '5. Evidence Foto',
      '5. EVIDENCE FOTO DOKUMENTASI (4-STEP SLA / SLG)',
      `Periode: ${periodTitle} (${reports.length} Order Tiket)`,
      reports
    );
  }

  // Save workbook
  const buffer = await workbook.xlsx.writeBuffer();
  const fileBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const cleanPeriod = periodTitle.replace(/[^a-zA-Z0-9_\-]/g, '_');
  saveAs(fileBlob, `Rekap_SLA_SLG_DC_Cikarang_${cleanPeriod}.xlsx`);
}
