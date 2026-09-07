// ============================================================================
// FILE: frontend/utils/excelSrParser.ts
// Deskripsi: Parser Cerdas Spreadsheet Service Report (.xlsx/.xls)
//            Mengekstrak Customer Info, Checklist, Measurements, Operation Status,
//            dan Time Spent dari spreadsheet resmi untuk diubah ke ServiceReportPayload.
// ============================================================================

import ExcelJS from 'exceljs';
import {
  ServiceReportPayload,
  UniversalCustomerInfo,
  UniversalTimeSpent,
  UniversalOperationStatus,
  VisualCheckItem
} from '@/types/serviceReportTypes';
import {
  SERVICE_REPORT_MASTER_REGISTRY,
  getServiceReportConfigByEmail
} from '@/config/serviceReportRegistry';

export interface ParseExcelSRResult {
  success: boolean;
  payload: ServiceReportPayload;
  parsedSummary: {
    sheetName: string;
    equipmentName: string;
    mopNo: string;
    quarter: string;
    date: string;
    totalChecklist: number;
    goodCount: number;
    notGoodCount: number;
    isNormal: boolean;
    extractedFields: string[];
  };
  rawFileName: string;
  errorMessage?: string;
}

/**
 * Membersihkan nilai sel Excel menjadi string bersih.
 */
function getCellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    // Menangani formula, rich text, atau date object
    if ('text' in cell.value && typeof (cell.value as any).text === 'string') {
      return (cell.value as any).text.trim();
    }
    if ('result' in cell.value && cell.value.result !== undefined && cell.value.result !== null) {
      return String(cell.value.result).trim();
    }
    if (cell.value instanceof Date) {
      return cell.value.toISOString().split('T')[0];
    }
    return JSON.stringify(cell.value);
  }
  return String(cell.value).trim();
}

/**
 * Cek apakah string mengandung indikator checklist centang/positif.
 */
function isCheckMark(val: string): boolean {
  const v = val.toLowerCase().trim();
  return v === '✓' || v === 'v' || v === 'x' || v === '1' || v === 'yes' || v === 'ya' || v === 'true' || v === 'good' || v === 'ok';
}

/**
 * Parse file buffer Excel (.xlsx) menjadi ServiceReportPayload.
 */
export async function parseExcelServiceReport(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  accountEmail: string = 'pump@gmail.com'
): Promise<ParseExcelSRResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // Ambil worksheet pertama atau yang aktif
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Berkas Excel tidak memiliki lembar kerja (worksheet) yang valid.');
  }

  // Dapatkan konfigurasi default berdasarkan akun email
  const defaultConfig = getServiceReportConfigByEmail(accountEmail) || SERVICE_REPORT_MASTER_REGISTRY['pump@gmail.com'];
  const extractedFields: string[] = [];

  // Salin template dasar
  const customerInfo: UniversalCustomerInfo = {
    ...defaultConfig.defaultCustomerInfo,
    companyName: 'Neutra DC Cikarang',
  };
  const timeSpent: UniversalTimeSpent = { ...defaultConfig.defaultTimeSpent };
  const operationStatus: UniversalOperationStatus = { ...defaultConfig.defaultOperationStatus };
  const measurements: Record<string, any> = {};
  const extractedChecklist: VisualCheckItem[] = [];

  // 1. SCAN SELURUH BARIS & KOLOM UNTUK MENDETEKSI METADATA & FIELD
  const maxRows = Math.min(worksheet.rowCount || 100, 150);
  let checklistHeaderRow = -1;
  let colNo = 1;
  let colActivity = 2;
  let colParam = 3;
  let colGood = 4;
  let colNotGood = 5;
  let colRemarks = 6;

  for (let r = 1; r <= maxRows; r++) {
    const row = worksheet.getRow(r);
    const rowValues: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      rowValues[colNumber] = getCellText(cell);
    });

    const fullRowText = rowValues.filter(Boolean).join(' ').toLowerCase();

    // Deteksi Customer Info
    for (let c = 1; c <= (row.cellCount || 20); c++) {
      const val = (rowValues[c] || '').toLowerCase().trim();
      const nextVal = (rowValues[c + 1] || rowValues[c + 2] || '').trim();

      if (val.includes('mop no') || val === 'mop:' || val === 'mop') {
        if (nextVal && nextVal.length > 3) {
          customerInfo.mopNo = nextVal;
          extractedFields.push('MOP No');
        }
      } else if (val.includes('equipment name') || val.includes('nama alat') || val.includes('unit:')) {
        if (nextVal) {
          customerInfo.equipmentName = nextVal;
          extractedFields.push('Equipment Name');
        }
      } else if (val.includes('serial no') || val === 's/n' || val.includes('no seri') || val === 'sn') {
        if (nextVal) {
          customerInfo.serialNo = nextVal;
          extractedFields.push('Serial No');
        }
      } else if (val === 'quarter' || val === 'quarter:' || val === 'periode') {
        if (nextVal) {
          customerInfo.quarter = nextVal;
          extractedFields.push('Quarter');
        }
      } else if (val === 'location' || val === 'lokasi' || val.includes('location:')) {
        if (nextVal) {
          customerInfo.location = nextVal;
          extractedFields.push('Location');
        }
      } else if (val === 'engineer' || val === 'teknisi' || val.includes('engineer:')) {
        if (nextVal) {
          customerInfo.engineer = nextVal;
          extractedFields.push('Engineer');
        }
      } else if (val === 'date' || val === 'tanggal' || val.includes('date:')) {
        if (nextVal) {
          customerInfo.date = nextVal;
          timeSpent.date = nextVal;
          extractedFields.push('Date');
        }
      } else if (val.includes('specification') || val.includes('spesifikasi')) {
        if (nextVal) {
          customerInfo.specification = nextVal;
          extractedFields.push('Specification');
        }
      } else if (val.includes('departure') || val.includes('berangkat')) {
        if (nextVal) timeSpent.departure = nextVal;
      } else if (val.includes('arrival') || val.includes('tiba')) {
        if (nextVal) timeSpent.arrival = nextVal;
      } else if (val.includes('start') || val.includes('mulai')) {
        if (nextVal) timeSpent.start = nextVal;
      } else if (val.includes('finish') || val.includes('selesai')) {
        if (nextVal) timeSpent.finish = nextVal;
      }
    }

    // Deteksi Header Checklist
    if (
      (fullRowText.includes('activity') || fullRowText.includes('item') || fullRowText.includes('kegiatan')) &&
      (fullRowText.includes('good') || fullRowText.includes('kondisi') || fullRowText.includes('condition'))
    ) {
      checklistHeaderRow = r;
      // Petakan kolom
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const h = getCellText(cell).toLowerCase();
        if (h === 'no' || h === 'no.' || h === '#') colNo = colNumber;
        else if (h.includes('activity') || h.includes('item') || h.includes('pemeriksaan') || h.includes('kegiatan')) colActivity = colNumber;
        else if (h.includes('param') || h.includes('standard') || h.includes('standar')) colParam = colNumber;
        else if (h === 'good' || h.includes('baik') || h.includes('normal')) colGood = colNumber;
        else if (h.includes('not good') || h.includes('abnormal') || h.includes('rusak')) colNotGood = colNumber;
        else if (h.includes('remark') || h.includes('keterangan') || h.includes('catatan')) colRemarks = colNumber;
      });
    }

    // Deteksi Status Operasi (Normal / Abnormal)
    if (fullRowText.includes('normal operation') || fullRowText.includes('operasi normal')) {
      const isMarkedNormal = isCheckMark(rowValues[1] || '') || isCheckMark(rowValues[2] || '') || fullRowText.includes('[v]') || fullRowText.includes('[x]');
      operationStatus.isNormal = isMarkedNormal;
      extractedFields.push('Operation Status');
    }
    if (fullRowText.includes('abnormal operation') || fullRowText.includes('operasi abnormal')) {
      const isMarkedAbnormal = isCheckMark(rowValues[1] || '') || isCheckMark(rowValues[2] || '') || fullRowText.includes('[v]') || fullRowText.includes('[x]');
      if (isMarkedAbnormal) {
        operationStatus.isNormal = false;
      }
    }
    if (fullRowText.includes('remark:') || fullRowText.includes('catatan:')) {
      const remarkVal = rowValues.slice(2).filter(Boolean).join(' ').trim();
      if (remarkVal && remarkVal.length > 3) {
        operationStatus.remark = remarkVal;
      }
    }
    if (fullRowText.includes('fault symptom') || fullRowText.includes('gejala kerusakan')) {
      operationStatus.faultSymptom = rowValues.slice(2).filter(Boolean).join(' ').trim();
    }
    if (fullRowText.includes('fault analysis') || fullRowText.includes('analisa kerusakan')) {
      operationStatus.faultAnalysis = rowValues.slice(2).filter(Boolean).join(' ').trim();
    }
    if (fullRowText.includes('work done') || fullRowText.includes('tindakan yang dilakukan')) {
      operationStatus.workDone = rowValues.slice(2).filter(Boolean).join(' ').trim();
    }

    // Deteksi Pengukuran (Thermal, Voltage, Ampere, dll)
    if (fullRowText.includes('voltage') || fullRowText.includes('tegangan') || fullRowText.includes('ampere') || fullRowText.includes('arus')) {
      row.eachCell(cell => {
        const text = getCellText(cell);
        const numMatch = text.match(/(\d+[.,]?\d*)/);
        if (numMatch) {
          const num = numMatch[1].replace(',', '.');
          if (fullRowText.includes('r-s') || fullRowText.includes('rs')) measurements.vc_voltage_rs = num;
          else if (fullRowText.includes('s-t') || fullRowText.includes('st')) measurements.vc_voltage_st = num;
          else if (fullRowText.includes('t-r') || fullRowText.includes('tr')) measurements.vc_voltage_tr = num;
          else if (fullRowText.includes('r-n') || fullRowText.includes('rn')) measurements.vc_voltage_rn = num;
          else if (fullRowText.includes('s-n') || fullRowText.includes('sn')) measurements.vc_voltage_sn = num;
          else if (fullRowText.includes('t-n') || fullRowText.includes('tn')) measurements.vc_voltage_tn = num;
        }
      });
    }
    if (fullRowText.includes('thermal') || fullRowText.includes('suhu') || fullRowText.includes('temp')) {
      const tempMatch = fullRowText.match(/(\d+[.,]?\d*)\s*(?:°c|c|deg)?/i);
      if (tempMatch) {
        measurements.thermal_pump_temp = tempMatch[1].replace(',', '.');
        measurements.thermal_breaker_temp = tempMatch[1].replace(',', '.');
        measurements.thermal_joint_temp = tempMatch[1].replace(',', '.');
      }
    }
    if (fullRowText.includes('vibration') || fullRowText.includes('vibrasi')) {
      const vibMatch = fullRowText.match(/(\d+[.,]?\d*)\s*(?:mm\/s)?/i);
      if (vibMatch) {
        measurements.vibration_pump_val = vibMatch[1].replace(',', '.');
      }
    }
    if (fullRowText.includes('pressure') || fullRowText.includes('tekanan')) {
      const pressMatch = fullRowText.match(/(\d+[.,]?\d*)\s*(?:bar|psi)?/i);
      if (pressMatch) {
        measurements.pressure_pump_val = pressMatch[1].replace(',', '.');
      }
    }
    if (fullRowText.includes('grounding') || fullRowText.includes('pentanahan') || fullRowText.includes('ohm')) {
      const ohmMatch = fullRowText.match(/(\d+[.,]?\d*)\s*(?:ohm|ω)?/i);
      if (ohmMatch) {
        measurements.grounding_ohm = ohmMatch[1].replace(',', '.');
      }
    }
  }

  // 2. PARSE ISI TABEL CHECKLIST JIKA HEADER DITEMUKAN
  if (checklistHeaderRow !== -1) {
    for (let r = checklistHeaderRow + 1; r <= maxRows; r++) {
      const row = worksheet.getRow(r);
      const noVal = getCellText(row.getCell(colNo));
      const actVal = getCellText(row.getCell(colActivity));
      const paramVal = getCellText(row.getCell(colParam));
      const goodVal = getCellText(row.getCell(colGood));
      const notGoodVal = getCellText(row.getCell(colNotGood));
      const remarksVal = getCellText(row.getCell(colRemarks));

      // Hentikan jika mencapai baris footer atau batas tabel
      const combined = (noVal + ' ' + actVal).toLowerCase();
      if (
        combined.includes('measurement') ||
        combined.includes('pengukuran') ||
        combined.includes('operation status') ||
        combined.includes('status operasi') ||
        combined.includes('time spent') ||
        combined.includes('catatan waktu') ||
        combined.includes('signature') ||
        combined.includes('tanda tangan')
      ) {
        break;
      }

      // Validasi baris checklist
      if (actVal && actVal.length > 2) {
        let cond: 'Good' | 'Not Good' | 'N/A' = 'Good';
        if (isCheckMark(notGoodVal)) {
          cond = 'Not Good';
        } else if (isCheckMark(goodVal)) {
          cond = 'Good';
        }

        extractedChecklist.push({
          no: noVal || `${extractedChecklist.length + 1}.`,
          activity: actVal,
          parameter: paramVal || 'Good Condition',
          condition: cond,
          remarks: remarksVal || ''
        });
      }
    }
  }

  // 3. JIKA CHECKLIST DARI EXCEL KOSONG, GUNAKAN TEMPLATE DEFAULT REGISTRY
  const finalChecklist = extractedChecklist.length > 0 ? extractedChecklist : defaultConfig.checklistTemplate;

  // Bangun Payload Lengkap
  const finalPayload: ServiceReportPayload = {
    equipmentKey: defaultConfig.key,
    equipmentName: customerInfo.equipmentName || defaultConfig.name,
    accountEmail: accountEmail,
    customerInfo: customerInfo,
    timeSpent: timeSpent,
    operationStatus: operationStatus,
    visualChecklist: finalChecklist,
    measurements: {
      ...measurements,
      ...defaultConfig.defaultOperationStatus
    }
  };

  const goodCount = finalChecklist.filter(c => c.condition === 'Good').length;
  const notGoodCount = finalChecklist.filter(c => c.condition === 'Not Good').length;

  return {
    success: true,
    payload: finalPayload,
    parsedSummary: {
      sheetName: worksheet.name || 'Sheet1',
      equipmentName: finalPayload.equipmentName,
      mopNo: customerInfo.mopNo || '-',
      quarter: customerInfo.quarter || 'Q3',
      date: customerInfo.date || new Date().toISOString().split('T')[0],
      totalChecklist: finalChecklist.length,
      goodCount: goodCount,
      notGoodCount: notGoodCount,
      isNormal: operationStatus.isNormal,
      extractedFields: Array.from(new Set(extractedFields))
    },
    rawFileName: fileName
  };
}
