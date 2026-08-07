// ============================================================================
// FILE: frontend/service_reports/acsplit/generateACSplitReportExcel.ts
// Deskripsi: Generator Cetak Excel (.xlsx) Laporan Pemeliharaan Perangkat AC Split.
//            Memetakan data inspeksi unit indoor/outdoor, hasil pengukuran freon & arus,
//            serta status operasional perangkat ke bentuk spreadsheet ExcelJS.
// ============================================================================

import { ACSplitCustomerInfo, ACSplitReportData, ACSplitTimeSpent } from '@/types/acSplitReportTypes';
import { generateServiceReportExcel, writeMeasurementTable } from '@/service_reports/common/serviceReportExcel';

/** Main Function: Generate File Excel Laporan Maintenance AC Split */
export async function generateACSplitReportExcel(
  customerInfo: ACSplitCustomerInfo,
  reportData: ACSplitReportData,
  timeSpent: ACSplitTimeSpent,
  photos?: Array<{ photoBase64?: string; description: string }>
) {
  // 1. Gabungkan inspeksi visual unit indoor & outdoor
  const allInspection = [...reportData.indoorInspection, ...reportData.outdoorInspection];

  // 2. Eksekusi builder terpusat ExcelJS
  await generateServiceReportExcel({
    title: 'Service Report Split Wall AC',
    equipmentLabel: 'AC Split',
    customerInfo: {
      companyName: customerInfo.companyName, equipmentName: customerInfo.equipmentName,
      ciDescription: customerInfo.ciDescription, ciName: customerInfo.ciName,
      type: customerInfo.type, serialNo: customerInfo.serialNo,
      productName: customerInfo.productName, productYears: customerInfo.prodYear,
      specification: customerInfo.specification, location: customerInfo.location,
      area: customerInfo.area, mopNo: customerInfo.mopNo,
      quarter: customerInfo.quarter, date: customerInfo.date, engineer: customerInfo.engineer,
    },
    timeSpent,
    visualInspection: allInspection.map(i => ({
      no: i.no, activity: i.activity, parameter: i.parameter,
      condition: i.isGood ? 'Good' : (i.isNotGood ? 'Not Good' : ''), remarks: i.remarks,
    })),
    operationStatus: {
      is_normal: reportData.analysis.isNormal,
      remark: reportData.analysis.remark,
      fault_symptom: reportData.analysis.faultSymptom,
      fault_analysis: reportData.analysis.faultAnalysis,
      work_done: reportData.analysis.workDone,
      fault_part_sn: reportData.analysis.faultPartSN,
    },
    photos,
    fileName: `Service_Report_ACSplit_${customerInfo.serialNo || 'Draft'}`,
    writeMeasurements: (ws, startRow) => {
      let row = startRow;
      row = writeMeasurementTable(ws, row, 'PENGETESAN & PENGUKURAN',
        ['No', 'Aktivitas', 'Parameter', 'Keterangan'],
        reportData.testMeasuring.map(t => [t.no, t.activity, t.parameter, t.remarks])
      );
      row++;
      return row;
    },
  });
}
