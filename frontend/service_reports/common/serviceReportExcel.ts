/**
 * Shared Excel export utility for all Service Reports.
 * Uses ExcelJS to generate Excel files matching the PDF layout.
 */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { InspectionItem, CommonCustomerInfo, CommonTimeSpent, OperationStatus, PhotoCard } from '@/components/ServiceReportPreviewShell';

// ─── Helpers ──────────────────────────────────────────────────────────────

function applyHeaderStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = thinBorder();
}

function applySubHeaderStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 9, color: { argb: 'FF1F2937' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = thinBorder();
}

function applyLabelStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 9 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
  cell.alignment = { vertical: 'middle', wrapText: true };
  cell.border = thinBorder();
}

function applyValueStyle(cell: ExcelJS.Cell, center = false) {
  cell.font = { size: 9 };
  cell.alignment = { vertical: 'middle', horizontal: center ? 'center' : 'left', wrapText: true };
  cell.border = thinBorder();
}

function thinBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  };
}

// ─── Main Export Function ──────────────────────────────────────────────────

export interface ServiceReportExcelOptions {
  /** Title for the report, e.g. "Service Report Fan Coil Unit (FCU)" */
  title: string;
  /** Equipment label, e.g. "FCU" */
  equipmentLabel: string;
  /** Customer info */
  customerInfo: CommonCustomerInfo;
  /** Time spent */
  timeSpent: CommonTimeSpent;
  /** Visual inspection items */
  visualInspection: InspectionItem[];
  /** Cleaning items (optional) */
  cleaning?: InspectionItem[];
  /** Operation status */
  operationStatus?: OperationStatus;
  /** Photos for documentation */
  photos?: PhotoCard[];
  /** 
   * Custom measurement section writer. 
   * Receives the worksheet and current row number, returns the next row number.
   */
  writeMeasurements?: (ws: ExcelJS.Worksheet, startRow: number) => number;
  /** Output filename without extension */
  fileName: string;
}

export async function generateServiceReportExcel(options: ServiceReportExcelOptions) {
  const {
    title, equipmentLabel, customerInfo, timeSpent,
    visualInspection, cleaning, operationStatus,
    photos, writeMeasurements, fileName,
  } = options;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DwimitraSystem';
  wb.created = new Date();

  // ─── Sheet 1: Service Report ──────────────────────────────────
  const ws = wb.addWorksheet('Service Report', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
    properties: { defaultColWidth: 14 },
  });

  // Column widths (8 columns to match PDF layout)
  ws.columns = [
    { width: 5 },   // A: No
    { width: 28 },  // B: Activity
    { width: 16 },  // C: Parameter
    { width: 8 },   // D: Good
    { width: 10 },  // E: Not Good
    { width: 18 },  // F: Remarks
    { width: 14 },  // G: Extra
    { width: 14 },  // H: Extra
  ];

  let row = 1;

  // ── Header ──────────────────────────────────────────────
  ws.mergeCells(`A${row}:H${row}`);
  const headerCell = ws.getCell(`A${row}`);
  headerCell.value = title.toUpperCase();
  headerCell.font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
  headerCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(row).height = 30;
  row++;

  ws.mergeCells(`A${row}:H${row}`);
  const subHeaderCell = ws.getCell(`A${row}`);
  subHeaderCell.value = 'PT. Dwi Mitra Ekatama Mandiri — Neutra DC Cikarang';
  subHeaderCell.font = { size: 10, color: { argb: 'FF6B7280' } };
  subHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
  row += 2;

  // ── Customer Info ──────────────────────────────────────────
  ws.mergeCells(`A${row}:H${row}`);
  const ciHeader = ws.getCell(`A${row}`);
  ciHeader.value = 'INFORMASI PELANGGAN';
  applyHeaderStyle(ciHeader);
  ws.getRow(row).height = 22;
  row++;

  const formattedDate = customerInfo.date
    ? new Date(customerInfo.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  const ciRows = [
    ['Nama Perusahaan', customerInfo.companyName, 'Tipe', customerInfo.type, 'Spesifikasi', customerInfo.specification, 'No Peta', customerInfo.mapNo || customerInfo.mopNo || ''],
    ['Nama Perangkat', customerInfo.equipmentName, 'No Seri', customerInfo.serialNo, 'Lokasi', customerInfo.location, 'Kuartal', customerInfo.quarter],
    ['Deskripsi CI', customerInfo.ciDescription || '', 'Nama Produk', customerInfo.productName, 'Area', customerInfo.area, 'Tanggal', formattedDate],
    ['Nama CI', customerInfo.ciName || '', 'Tahun Produk', customerInfo.productYears, 'Teknisi', customerInfo.engineer, '', ''],
  ];

  ciRows.forEach(fields => {
    const r = ws.getRow(row);
    for (let i = 0; i < 8; i++) {
      const c = r.getCell(i + 1);
      c.value = fields[i] || '';
      if (i % 2 === 0) applyLabelStyle(c);
      else applyValueStyle(c);
    }
    r.height = 18;
    row++;
  });

  row++; // Blank row

  // ── Visual Inspection ──────────────────────────────────────────
  row = writeChecklistSection(ws, row, 'INSPEKSI & PEMERIKSAAN VISUAL', visualInspection);
  row++;

  // ── Cleaning ──────────────────────────────────────────
  if (cleaning && cleaning.length > 0) {
    row = writeChecklistSection(ws, row, 'PEMBERSIHAN', cleaning);
    row++;
  }

  // ── Custom Measurements ──────────────────────────────────────────
  if (writeMeasurements) {
    row = writeMeasurements(ws, row);
    row++;
  }

  // ── Operation Status ──────────────────────────────────────────
  if (operationStatus) {
    ws.mergeCells(`A${row}:H${row}`);
    const osHeader = ws.getCell(`A${row}`);
    osHeader.value = 'STATUS OPERASI';
    applyHeaderStyle(osHeader);
    ws.getRow(row).height = 22;
    row++;

    const statusLabel = operationStatus.is_normal ? '☑ Operasi Normal' : '☐ Operasi Normal';
    ws.mergeCells(`A${row}:B${row}`);
    const slc = ws.getCell(`A${row}`);
    slc.value = statusLabel;
    applyLabelStyle(slc);

    ws.getCell(`C${row}`).value = 'Keterangan';
    applyLabelStyle(ws.getCell(`C${row}`));

    ws.mergeCells(`D${row}:H${row}`);
    const svc = ws.getCell(`D${row}`);
    svc.value = operationStatus.remark;
    applyValueStyle(svc);
    row++;

    if (!operationStatus.is_normal) {
      const abnormalRows = [
        ['☑ Operasi Abnormal', 'Gejala kerusakan', operationStatus.fault_symptom || ''],
        ['', 'Analisis kerusakan', operationStatus.fault_analysis || ''],
        ['', 'Pekerjaan yang dilakukan', operationStatus.work_done || ''],
        ['', 'No. Seri Komponen Rusak', operationStatus.fault_part_sn || ''],
      ];
      abnormalRows.forEach(([col1, col2, col3]) => {
        ws.mergeCells(`A${row}:B${row}`);
        const c1 = ws.getCell(`A${row}`);
        c1.value = col1;
        applyLabelStyle(c1);

        ws.getCell(`C${row}`).value = col2;
        applyLabelStyle(ws.getCell(`C${row}`));

        ws.mergeCells(`D${row}:H${row}`);
        const c3 = ws.getCell(`D${row}`);
        c3.value = col3;
        applyValueStyle(c3);
        row++;
      });
    }
    row++;
  }

  // ── Time Spent ──────────────────────────────────────────
  ws.mergeCells(`A${row}:H${row}`);
  const tsHeader = ws.getCell(`A${row}`);
  tsHeader.value = 'WAKTU PENGERJAAN';
  tsHeader.font = { bold: true, italic: true, size: 10, color: { argb: 'FF1F2937' } };
  tsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
  tsHeader.alignment = { vertical: 'middle', horizontal: 'left' };
  tsHeader.border = thinBorder();
  ws.getRow(row).height = 22;
  row++;

  // Labels & values
  ws.mergeCells(`A${row}:B${row}`);
  ws.mergeCells(`C${row}:D${row}`);
  ws.mergeCells(`E${row}:F${row}`);
  ws.mergeCells(`G${row}:H${row}`);
  ['Tanggal', 'Keberangkatan', 'Mulai', 'Selesai'].forEach((label, i) => {
    const c = ws.getCell(`${String.fromCharCode(65 + i * 2)}${row}`);
    c.value = label;
    applySubHeaderStyle(c);
  });
  row++;

  // Values row
  ws.mergeCells(`A${row}:B${row}`);
  ws.mergeCells(`C${row}:D${row}`);
  ws.mergeCells(`E${row}:F${row}`);
  ws.mergeCells(`G${row}:H${row}`);
  [timeSpent.date, timeSpent.departure, timeSpent.start, timeSpent.finish].forEach((val, i) => {
    const c = ws.getCell(`${String.fromCharCode(65 + i * 2)}${row}`);
    c.value = val;
    applyValueStyle(c, true);
  });
  row += 2;

  // ── Signatures ──────────────────────────────────────────
  ws.mergeCells(`A${row}:H${row}`);
  ws.getCell(`A${row}`).value = 'CUSTOMER ACKNOWLEDGEMENT';
  ws.getCell(`A${row}`).font = { bold: true, size: 10 };
  ws.getCell(`A${row}`).alignment = { horizontal: 'center' };
  row++;

  ws.mergeCells(`A${row}:B${row}`);
  ws.mergeCells(`D${row}:E${row}`);
  ws.mergeCells(`G${row}:H${row}`);
  ['Dibuat', '', '', 'Diperiksa', '', '', 'Disetujui'].forEach((label, i) => {
    if (label) {
      const col = i < 3 ? 'A' : i < 6 ? 'D' : 'G';
      const c = ws.getCell(`${col}${row}`);
      c.value = label;
      c.font = { bold: true, size: 9, color: { argb: 'FF6B7280' } };
      c.alignment = { horizontal: 'center' };
    }
  });
  row += 4; // Space for signature

  ws.mergeCells(`A${row}:B${row}`);
  ws.mergeCells(`D${row}:E${row}`);
  ws.mergeCells(`G${row}:H${row}`);
  ['Teknisi', '', '', 'SM/PM', '', '', 'Klien / Pemilik'].forEach((label, i) => {
    if (label) {
      const col = i < 3 ? 'A' : i < 6 ? 'D' : 'G';
      const c = ws.getCell(`${col}${row}`);
      c.value = label;
      c.font = { bold: true, size: 9 };
      c.alignment = { horizontal: 'center' };
      c.border = { top: { style: 'thin', color: { argb: 'FF9CA3AF' } } };
    }
  });

  // ─── Sheet 2: Dokumentasi (if photos exist) ──────────────────
  if (photos && photos.length > 0) {
    const wsDoc = wb.addWorksheet('Dokumentasi', {
      pageSetup: { paperSize: 9, orientation: 'portrait' },
    });
    wsDoc.columns = [
      { width: 5 }, { width: 30 }, { width: 30 }, { width: 30 },
    ];

    let dRow = 1;
    wsDoc.mergeCells(`A${dRow}:D${dRow}`);
    const docHeader = wsDoc.getCell(`A${dRow}`);
    docHeader.value = `DOKUMENTASI PM: ${equipmentLabel}`;
    docHeader.font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
    docHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    wsDoc.getRow(dRow).height = 30;
    dRow++;

    wsDoc.mergeCells(`A${dRow}:D${dRow}`);
    wsDoc.getCell(`A${dRow}`).value = `${customerInfo.specification || equipmentLabel} — ${formattedDate}`;
    wsDoc.getCell(`A${dRow}`).font = { size: 10, color: { argb: 'FF6B7280' } };
    wsDoc.getCell(`A${dRow}`).alignment = { horizontal: 'center' };
    dRow += 2;

    // Photo list as table
    wsDoc.mergeCells(`A${dRow}:D${dRow}`);
    const photoHeader = wsDoc.getCell(`A${dRow}`);
    photoHeader.value = 'DAFTAR FOTO DOKUMENTASI';
    applyHeaderStyle(photoHeader);
    dRow++;

    ['No', 'Deskripsi', 'Status Foto', 'Catatan'].forEach((label, i) => {
      const c = wsDoc.getCell(dRow, i + 1);
      c.value = label;
      applySubHeaderStyle(c);
    });
    dRow++;

    photos.forEach((photo, idx) => {
      const r = wsDoc.getRow(dRow);
      r.getCell(1).value = idx + 1;
      applyValueStyle(r.getCell(1), true);
      r.getCell(2).value = photo.description || 'N/A';
      applyValueStyle(r.getCell(2));
      r.getCell(3).value = photo.photoBase64 ? '✅ Ada Foto' : '❌ Tidak Ada Foto';
      applyValueStyle(r.getCell(3), true);
      r.getCell(4).value = '';
      applyValueStyle(r.getCell(4));
      dRow++;
    });
  }

  // ─── Save ──────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${fileName}.xlsx`);
}

// ─── Checklist Section Writer ──────────────────────────────────────

function writeChecklistSection(ws: ExcelJS.Worksheet, startRow: number, title: string, items: InspectionItem[]): number {
  let row = startRow;

  // Section header
  ws.mergeCells(`A${row}:F${row}`);
  const header = ws.getCell(`A${row}`);
  header.value = title;
  applyHeaderStyle(header);
  ws.getRow(row).height = 22;
  row++;

  // Sub-headers
  const subHeaders = ['No', 'Aktivitas', 'Parameter', 'Baik', 'Tidak Baik', 'Keterangan'];
  subHeaders.forEach((label, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = label;
    applySubHeaderStyle(c);
  });
  row++;

  // Data rows
  items.forEach(item => {
    const r = ws.getRow(row);
    r.getCell(1).value = `${item.no}.`;
    applyValueStyle(r.getCell(1), true);
    r.getCell(2).value = item.activity;
    applyValueStyle(r.getCell(2));
    r.getCell(3).value = item.parameter;
    applyValueStyle(r.getCell(3), true);

    const isGood = item.condition === 'Good';
    const isNotGood = item.condition === 'Not Good' || item.condition === 'Not good';

    r.getCell(4).value = isGood ? '✓' : '';
    applyValueStyle(r.getCell(4), true);
    if (isGood) r.getCell(4).font = { bold: true, size: 10, color: { argb: 'FF16A34A' } };

    r.getCell(5).value = isNotGood ? '✗' : '';
    applyValueStyle(r.getCell(5), true);
    if (isNotGood) r.getCell(5).font = { bold: true, size: 10, color: { argb: 'FFDC2626' } };

    r.getCell(6).value = item.remarks;
    applyValueStyle(r.getCell(6));
    row++;
  });

  return row;
}

// ─── Measurement Section Helpers (reusable for each equipment type) ──────────

/**
 * Write a simple key-value measurement table section.
 * Each entry = [label, value, standard?, remarks?]
 */
export function writeMeasurementTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  headers: string[],
  rows: string[][],
): number {
  let row = startRow;

  const colSpan = headers.length;
  ws.mergeCells(`A${row}:${String.fromCharCode(64 + colSpan)}${row}`);
  const header = ws.getCell(`A${row}`);
  header.value = title;
  applyHeaderStyle(header);
  ws.getRow(row).height = 22;
  row++;

  headers.forEach((label, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = label;
    applySubHeaderStyle(c);
  });
  row++;

  rows.forEach(fields => {
    const r = ws.getRow(row);
    fields.forEach((val, i) => {
      r.getCell(i + 1).value = val;
      if (i === 0) applyLabelStyle(r.getCell(i + 1));
      else applyValueStyle(r.getCell(i + 1), true);
    });
    row++;
  });

  return row;
}
