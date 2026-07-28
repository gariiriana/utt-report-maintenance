import { CTCustomerInfo, CTReportData, CTTimeSpent } from '@/types/ctReportTypes';
import { generateServiceReportExcel, writeMeasurementTable } from '@/service_reports/common/serviceReportExcel';

export async function generateCTReportExcel(
  customerInfo: CTCustomerInfo,
  reportData: CTReportData,
  timeSpent: CTTimeSpent,
  photos?: Array<{ photoBase64?: string; description: string }>
) {
  // Merge inspection items
  const allVisual = [...reportData.visualInspectionCT, ...reportData.visualInspectionPanel];
  const allCleaning = [...reportData.cleaningCT, ...reportData.cleaningPanel];

  await generateServiceReportExcel({
    title: 'Service Report Cooling Tower (CT)',
    equipmentLabel: 'Cooling Tower',
    customerInfo: {
      companyName: customerInfo.companyName, equipmentName: customerInfo.equipmentName,
      ciDescription: customerInfo.ciDescription, ciName: customerInfo.ciName,
      type: customerInfo.type, serialNo: customerInfo.serialNo,
      productName: customerInfo.productName, productYears: customerInfo.productYears,
      specification: customerInfo.spesification, location: customerInfo.location,
      area: customerInfo.area, mopNo: customerInfo.mopNo,
      quarter: customerInfo.quarter, date: customerInfo.date, engineer: customerInfo.engineer,
    },
    timeSpent,
    visualInspection: allVisual,
    cleaning: allCleaning,
    operationStatus: {
      is_normal: reportData.analysis.isNormal,
      remark: reportData.analysis.remark,
      fault_symptom: reportData.analysis.faultSymptom,
      fault_analysis: reportData.analysis.faultAnalysis,
      work_done: reportData.analysis.workDone,
      fault_part_sn: reportData.analysis.faultPartSN,
    },
    photos,
    fileName: `Service_Report_CT_${customerInfo.serialNo || 'Draft'}`,
    writeMeasurements: (ws, startRow) => {
      let row = startRow;
      const m = reportData.measurement;
      row = writeMeasurementTable(ws, row, 'PENGUKURAN TEGANGAN & ARUS',
        ['Parameter', 'Hasil', 'Standar'],
        [
          ['V R-N', m.rnVoltage, '220V ±10%'], ['V S-N', m.snVoltage, '220V ±10%'], ['V T-N', m.tnVoltage, '220V ±10%'],
          ['V R-S', m.rsVoltage, '380V ±10%'], ['V S-T', m.stVoltage, '380V ±10%'], ['V T-R', m.trVoltage, '380V ±10%'],
          ['I R', m.rCurrent, ''], ['I S', m.sCurrent, ''], ['I T', m.tCurrent, ''],
        ]
      );
      row++;
      row = writeMeasurementTable(ws, row, 'PENGUKURAN LAINNYA',
        ['Parameter', 'Hasil', 'Keterangan'],
        [
          ['Temperature (°C)', m.tempMeasurements, m.tempRemarks],
          ['Suction Pressure', m.suctionPressure, m.suctionDischargeRemarks],
          ['Discharge Pressure', m.dischargePressure, ''],
          ['Output Air Flow', m.outputAirFlow, m.outputAirFlowRemarks],
          ['Motor Temp', m.motorTemp, m.motorTempRemarks],
          ['Fan Outdoor RPM', m.fanOutdoorRpm, m.fanOutdoorRpmRemarks],
        ]
      );
      row++;
      return row;
    },
  });
}
