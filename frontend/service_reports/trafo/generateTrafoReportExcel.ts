import { TrafoCustomerInfo, TrafoReportData, TrafoTimeSpent } from '@/types/trafoReportTypes';
import { generateServiceReportExcel, writeMeasurementTable } from '@/service_reports/common/serviceReportExcel';

export async function generateTrafoReportExcel(
  customerInfo: TrafoCustomerInfo,
  reportData: TrafoReportData,
  timeSpent: TrafoTimeSpent,
  photos?: Array<{ photoBase64?: string; description: string }>
) {
  await generateServiceReportExcel({
    title: 'Service Report Transformator',
    equipmentLabel: 'Trafo',
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
    visualInspection: reportData.visualInspection.map(i => ({
      no: i.no, activity: i.activity, parameter: i.parameter,
      condition: i.statusOK ? 'Good' : (i.statusNOK ? 'Not Good' : ''), remarks: i.remarks,
    })),
    cleaning: reportData.cleaning.map(c => ({
      no: c.no, activity: c.activity, parameter: c.parameter,
      condition: c.statusOK ? 'Good' : (c.statusNOK ? 'Not Good' : ''), remarks: c.remarks,
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
    fileName: `Service_Report_Trafo_${customerInfo.serialNo || 'Draft'}`,
    writeMeasurements: (ws, startRow) => {
      let row = startRow;
      row = writeMeasurementTable(ws, row, 'PENGUKURAN',
        ['No', 'Aktivitas', 'Parameter', 'Hasil', 'Keterangan'],
        reportData.measurement.map(m => [m.no, m.activity, m.parameter, m.result, m.remarks])
      );
      row++;
      row = writeMeasurementTable(ws, row, 'PENGETESAN',
        ['No', 'Aktivitas', 'Parameter', 'Hasil', 'Keterangan'],
        reportData.testing.map(t => [t.no, t.activity, t.parameter, t.result, t.remarks])
      );
      row++;
      const vc = reportData.voltageCurrent;
      row = writeMeasurementTable(ws, row, 'TEGANGAN & ARUS (FORMAT 2)',
        ['Parameter', 'Hasil'],
        [
          ['V R-S', vc.rsVolt], ['V S-T', vc.stVolt], ['V T-R', vc.trVolt],
          ['V R-N', vc.rnVolt], ['V S-N', vc.snVolt], ['V T-N', vc.tnVolt], ['V N-G', vc.ngVolt],
          ['I R', vc.rAmp], ['I S', vc.sAmp], ['I T', vc.tAmp], ['I N', vc.nAmp],
        ]
      );
      row++;
      row = writeMeasurementTable(ws, row, 'GROUNDING, NOISE & THERMAL',
        ['Parameter', 'Hasil', 'Keterangan'],
        [
          ['Grounding (Ω)', reportData.groundingOhm, reportData.groundingRemarks],
          ['Noise (dB)', reportData.noiseMeasurement.resultDb, reportData.noiseMeasurement.remarks],
          ['Thermal (°C)', reportData.thermalImager.resultTemp, reportData.thermalImager.remarks],
        ]
      );
      row++;
      return row;
    },
  });
}
