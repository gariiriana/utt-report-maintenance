// ============================================================================
// FILE: frontend/utils/excelToPdfConverter.ts
// Deskripsi: Mengonversi lembar kerja Excel (.xlsx / .xls) menjadi halaman PDF A4
//            presisi 1:1 Spreadsheet menggunakan ExcelJS & safeHtml2Canvas.
//            Menghormati merged cells, background color sel, font bold, borders,
//            proporsi kolom, logo/gambar, format tanggal Excel, dan spasi antar-kata.
// ============================================================================

import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { safeHtml2Canvas } from '@/utils/ReportPdfExport';

/**
 * Mengubah string base64 / data URL menjadi ArrayBuffer
 */
function base64ToArrayBuffer(base64OrDataUrl: string): ArrayBuffer {
  const cleanBase64 = base64OrDataUrl.includes(',')
    ? base64OrDataUrl.split(',')[1]
    : base64OrDataUrl;
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Konversi warna ARGB Excel ke format CSS rgb / rgba
 */
function argbToCss(argb?: string): string | null {
  if (!argb || typeof argb !== 'string') return null;
  const clean = argb.trim().toUpperCase();
  if (clean.length === 8) {
    // AARRGGBB
    const a = parseInt(clean.slice(0, 2), 16) / 255;
    const r = parseInt(clean.slice(2, 4), 16);
    const g = parseInt(clean.slice(4, 6), 16);
    const b = parseInt(clean.slice(6, 8), 16);
    if (a >= 0.98) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return null;
}

/**
 * Format teks sel Excel (termasuk tanggal serial Excel seperti 46272, rich text, dan formula)
 */
function formatExcelCellValue(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return '';

  // 1. Tanggal berupa JavaScript Date
  if (cell.value instanceof Date) {
    return cell.value.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  // 2. Nilai numerik (termasuk serial date Excel seperti 46272 -> 07 Sep 2026)
  if (typeof cell.value === 'number') {
    const val = cell.value;
    const numFmt = String(cell.numFmt || '').toLowerCase();

    // Serial tanggal Excel: antara 35000 s/d 55000 (tahun 1995 s/d 2050)
    const isDateFmt = numFmt.includes('yy') || numFmt.includes('dd') || numFmt.includes('mm') || numFmt.includes('m/d') || numFmt.includes('d-m');
    const isLikelyDateSerial = val >= 35000 && val <= 55000;

    if (isDateFmt || isLikelyDateSerial) {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2040) {
        return date.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
    }

    if (Number.isInteger(val)) {
      return String(val);
    }
    return Number(val.toFixed(3)).toString();
  }

  // 3. Nilai Object (Rich text, formula result, text object)
  if (typeof cell.value === 'object') {
    if ('richText' in cell.value && Array.isArray((cell.value as any).richText)) {
      return (cell.value as any).richText.map((t: any) => t.text || '').join('');
    }
    if ('result' in cell.value && cell.value.result !== undefined && cell.value.result !== null) {
      const resVal = cell.value.result;
      if (typeof resVal === 'number' && resVal >= 35000 && resVal <= 55000) {
        const date = new Date(Math.round((resVal - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2040) {
          return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
        }
      }
      return String(resVal).trim();
    }
    if ('text' in cell.value && typeof (cell.value as any).text === 'string') {
      return (cell.value as any).text.trim();
    }
    return '';
  }

  return String(cell.value).trim();
}

/**
 * Render lembar kerja pertama dari berkas Excel ke dalam 1 halaman PDF A4 presisi.
 * Menghasilkan ArrayBuffer dari jsPDF untuk digabungkan dengan pdf-lib.
 */
export async function renderExcelToPdfPage(
  excelData: ArrayBuffer | string
): Promise<ArrayBuffer> {
  const arrayBuffer = typeof excelData === 'string'
    ? base64ToArrayBuffer(excelData)
    : excelData;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Berkas Excel tidak memiliki sheet yang valid');
  }

  // 1. Petakan Merged Cells
  const mergeMap: Record<number, Record<number, { colSpan: number; rowSpan: number }>> = {};
  const skipMap: Record<number, Record<number, boolean>> = {};

  const merges = worksheet.model?.merges || [];
  for (const rangeStr of merges) {
    const [startRef, endRef] = rangeStr.split(':');
    if (!startRef || !endRef) continue;

    const startCell = worksheet.getCell(startRef);
    const endCell = worksheet.getCell(endRef);

    const startRow = Number(startCell.row);
    const startCol = Number(startCell.col);
    const endRow = Number(endCell.row);
    const endCol = Number(endCell.col);

    const rowSpan = endRow - startRow + 1;
    const colSpan = endCol - startCol + 1;

    if (!mergeMap[startRow]) mergeMap[startRow] = {};
    mergeMap[startRow][startCol] = { colSpan, rowSpan };

    for (let r = startRow; r <= endRow; r++) {
      if (!skipMap[r]) skipMap[r] = {};
      for (let c = startCol; c <= endCol; c++) {
        if (r === startRow && c === startCol) continue;
        skipMap[r][c] = true;
      }
    }
  }

  // 2. Petakan Gambar yang Tertanam di Lembar Kerja (e.g. Logo Dwimitra / NeutraDC)
  const imageMap: Record<number, Record<number, string>> = {};
  try {
    const images = (worksheet as any).getImages ? (worksheet as any).getImages() : [];
    if (Array.isArray(images)) {
      for (const img of images) {
        const imgObj = workbook.getImage(img.imageId);
        if (imgObj && imgObj.buffer) {
          const u8 = new Uint8Array(imgObj.buffer);
          let binary = '';
          for (let i = 0; i < u8.length; i++) {
            binary += String.fromCharCode(u8[i]);
          }
          const b64 = btoa(binary);
          const dataUri = `data:image/${imgObj.extension || 'png'};base64,${b64}`;

          const r = typeof img.range?.tl?.row === 'number'
            ? Math.floor(img.range.tl.row) + 1
            : ((img.range?.tl as any)?.nativeRow || 0) + 1;
          const c = typeof img.range?.tl?.col === 'number'
            ? Math.floor(img.range.tl.col) + 1
            : ((img.range?.tl as any)?.nativeCol || 0) + 1;

          if (!imageMap[r]) imageMap[r] = {};
          imageMap[r][c] = dataUri;
        }
      }
    }
  } catch (imgErr) {
    console.warn('Could not extract images from Excel sheet:', imgErr);
  }

  // 3. Tentukan batas baris dan kolom yang memiliki konten
  let maxCol = 1;
  let lastDataRow = 1;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > lastDataRow) {
      lastDataRow = rowNumber;
    }
    row.eachCell({ includeEmpty: true }, (_, colNumber) => {
      if (colNumber > maxCol) {
        maxCol = colNumber;
      }
    });
  });

  for (const rangeStr of merges) {
    const [, endRef] = rangeStr.split(':');
    if (endRef) {
      try {
        const endCell = worksheet.getCell(endRef);
        if (Number(endCell.col) > maxCol) maxCol = Number(endCell.col);
        if (Number(endCell.row) > lastDataRow) lastDataRow = Number(endCell.row);
      } catch {
        // ignore
      }
    }
  }

  maxCol = Math.min(Math.max(maxCol, 6), 18);
  const rowCount = Math.min(Math.max(lastDataRow, 25), 85);

  // 4. Bangun Elemen Kontainer HTML A4 Presisi
  // Posisikan di dalam viewport (top: 0, left: 0) dengan z-index sangat rendah agar layout font metrics akurat
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0px';
  container.style.top = '0px';
  container.style.zIndex = '-99999';
  container.style.width = '880px'; // Lebar proporsional A4 96 DPI
  container.style.padding = '18px 22px';
  container.style.backgroundColor = '#ffffff';
  container.style.boxSizing = 'border-box';
  container.style.fontFamily = "'Arial', 'Helvetica Neue', Helvetica, sans-serif";
  container.style.letterSpacing = '0px';
  container.style.wordSpacing = '0.2em';
  container.style.color = '#0f172a';

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.tableLayout = 'fixed';
  table.style.fontSize = '9px';
  table.style.lineHeight = '1.35';
  table.style.letterSpacing = '0px';

  // 5. Tambahkan ColGroup untuk Proporsi Lebar Kolom Sesuai Excel
  const colgroup = document.createElement('colgroup');
  let totalColWidth = 0;
  const colWidths: number[] = [];
  for (let c = 1; c <= maxCol; c++) {
    const col = worksheet.getColumn(c);
    const w = col.width && col.width > 2 ? col.width : 10;
    colWidths.push(w);
    totalColWidth += w;
  }
  for (let c = 0; c < maxCol; c++) {
    const colEl = document.createElement('col');
    const percent = ((colWidths[c] / totalColWidth) * 100).toFixed(2);
    colEl.style.width = `${percent}%`;
    colgroup.appendChild(colEl);
  }
  table.appendChild(colgroup);

  // 6. Render Baris dan Sel
  for (let r = 1; r <= rowCount; r++) {
    const row = worksheet.getRow(r);
    let hasAnyData = Boolean(imageMap[r]);
    if (!hasAnyData) {
      for (let c = 1; c <= maxCol; c++) {
        if (getCellTextQuick(row.getCell(c))) {
          hasAnyData = true;
          break;
        }
      }
    }
    if (!hasAnyData && r > lastDataRow) continue;

    const tr = document.createElement('tr');
    if (row.height) {
      tr.style.height = `${Math.round(row.height * 1.55)}px`;
    } else {
      tr.style.height = '23px';
    }

    for (let c = 1; c <= maxCol; c++) {
      if (skipMap[r]?.[c]) {
        continue;
      }

      const cell = row.getCell(c);
      const td = document.createElement('td');

      // Terapkan ColSpan / RowSpan jika ini master cell
      const merge = mergeMap[r]?.[c];
      if (merge) {
        if (merge.colSpan > 1) td.colSpan = merge.colSpan;
        if (merge.rowSpan > 1) td.rowSpan = merge.rowSpan;
      }

      // Border Standar Spreadsheet
      td.style.border = '1px solid #cbd5e1';
      td.style.padding = '3.5px 5px';
      td.style.wordBreak = 'break-word';
      td.style.overflowWrap = 'anywhere';
      td.style.verticalAlign = 'middle';
      td.style.letterSpacing = '0px';

      // Gambar Tertanam (Logo / Image)
      if (imageMap[r]?.[c]) {
        const imgEl = document.createElement('img');
        imgEl.src = imageMap[r][c];
        imgEl.style.maxHeight = '44px';
        imgEl.style.maxWidth = '120px';
        imgEl.style.objectFit = 'contain';
        imgEl.style.display = 'block';
        imgEl.style.margin = '0 auto';
        td.appendChild(imgEl);
      }

      // Warna Latar Sel (Background Color)
      if (cell.fill && cell.fill.type === 'pattern' && (cell.fill as any).fgColor) {
        const fg = (cell.fill as any).fgColor;
        const colorCss = argbToCss(fg.argb || fg.theme);
        if (colorCss) {
          td.style.backgroundColor = colorCss;
        }
      }

      // Tipografi (Font Weight, Size, Color)
      if (cell.font) {
        if (cell.font.bold) td.style.fontWeight = 'bold';
        if (cell.font.italic) td.style.fontStyle = 'italic';
        if (cell.font.size) {
          td.style.fontSize = `${Math.max(7.5, Math.min(cell.font.size * 0.92, 14))}px`;
        }
        if (cell.font.color && (cell.font.color as any).argb) {
          const fontColor = argbToCss((cell.font.color as any).argb);
          if (fontColor) td.style.color = fontColor;
        }
      }

      // Perataan Teks (Alignment)
      if (cell.alignment) {
        if (cell.alignment.horizontal) {
          td.style.textAlign = cell.alignment.horizontal;
        }
        if (cell.alignment.vertical) {
          td.style.verticalAlign = cell.alignment.vertical;
        }
      }

      // Nilai Teks Sel (Mempertahankan spasi dengan \u00A0 agar html2canvas tidak menggabungkan kata)
      const textVal = formatExcelCellValue(cell);
      if (textVal) {
        const lines = textVal.split(/\r?\n/);
        lines.forEach((line, lineIdx) => {
          if (lineIdx > 0) {
            td.appendChild(document.createElement('br'));
          }
          // Ganti spasi biasa menjadi non-breaking space agar html2canvas mempertahankan spasi
          const nonBreakingText = line.replace(/ /g, '\u00A0');
          const span = document.createElement('span');
          span.textContent = nonBreakingText;
          span.style.letterSpacing = '0px';
          span.style.wordSpacing = '0.2em';
          td.appendChild(span);
        });
      }

      tr.appendChild(td);
    }

    table.appendChild(tr);
  }

  container.appendChild(table);
  document.body.appendChild(container);

  try {
    // 7. Capture Visual Spreadsheet Menggunakan safeHtml2Canvas
    const canvas = await safeHtml2Canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // 8. Masukkan ke Dokumen jsPDF A4 (Portrait)
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    // Proporsikan gambar agar pas 1 halaman penuh A4 (Fit to Page)
    const margin = 6;
    const availW = pdfW - 2 * margin;
    const availH = pdfH - 2 * margin;

    const imgRatio = canvas.width / canvas.height;
    let renderW = availW;
    let renderH = availW / imgRatio;

    if (renderH > availH) {
      renderH = availH;
      renderW = availH * imgRatio;
    }

    const renderX = margin + (availW - renderW) / 2;
    const renderY = margin + Math.max(0, (availH - renderH) / 6);

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    pdf.addImage(imgData, 'JPEG', renderX, renderY, renderW, renderH, undefined, 'FAST');

    return pdf.output('arraybuffer');
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

function getCellTextQuick(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  return String(cell.value).trim();
}
