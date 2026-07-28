import { DocklevelerCustomerInfo, DocklevelerReportData, DocklevelerTimeSpent } from '@/types/docklevelerReportTypes';
import { generateServiceReportExcel, writeMeasurementTable } from '@/service_reports/common/serviceReportExcel';

export async function generateDocklevelerReportExcel(
  customerInfo: DocklevelerCustomerInfo,
  reportData: DocklevelerReportData,
  timeSpent: DocklevelerTimeSpent,
  photos?: Array<{ photoBase64?: string; description: string }>
) {
  await generateServiceReportExcel({
    title: 'Service Report Dock Leveler',
    equipmentLabel: 'Dock Leveler',
    customerInfo: {
      companyName: customerInfo.companyName, equipmentName: customerInfo.equipmentName,
      ciDescription: customerInfo.ciDescription, ciName: customerInfo.ciName,
      type: customerInfo.type, serialNo: customerInfo.serialNo,
      productName: customerInfo.productName, productYears: customerInfo.productYears,
      specification: customerInfo.specification, location: customerInfo.location,
      area: customerInfo.area, mopNo: customerInfo.mopNo,
      quarter: customerInfo.quarter, date: customerInfo.date, engineer: customerInfo.engineer,
    },
    timeSpent,
    visualInspection: reportData.visualInspection.map(i => ({
      no: i.no, activity: i.activity, parameter: i.parameter,
      condition: i.isGood ? 'Good' : (i.isNotGood ? 'Not Good' : ''), remarks: i.remarks,
    })),
    cleaning: reportData.cleaning.map(c => ({
      no: c.no, activity: c.activity, parameter: c.parameter,
      condition: c.isGood ? 'Good' : (c.isNotGood ? 'Not Good' : ''), remarks: c.remarks,
    })),
    operationStatus: {
      is_normal: !reportData.analysis.faultSymptom,
      remark: reportData.analysis.remark,
      fault_symptom: reportData.analysis.faultSymptom,
      fault_analysis: reportData.analysis.faultAnalysis,
      work_done: reportData.analysis.workDone,
      fault_part_sn: reportData.analysis.faultPartSN,
    },
    photos,
    fileName: `Service_Report_Dockleveler_${customerInfo.serialNo || 'Draft'}`,
    writeMeasurements: (ws, startRow) => {
      let row = startRow;
      const va = reportData.voltageAmpere;
      row = writeMeasurementTable(ws, row, 'PENGUKURAN TEGANGAN & ARUS',
        ['Parameter', 'Hasil'],
        [
          ['V R-S', va.voltageRS], ['V S-T', va.voltageST], ['V T-R', va.voltageTR],
          ['V R-N', va.voltageRN], ['V S-N', va.voltageSN], ['V T-N', va.voltageTN], ['V N-G', va.voltageNG],
          ['I R', va.ampereR], ['I S', va.ampereS], ['I T', va.ampereT], ['I N', va.ampereN],
        ]
      );
      row++;
      row = writeMeasurementTable(ws, row, 'NOISE & GROUNDING',
        ['Parameter', 'Hasil', 'Standar', 'Keterangan'],
        [
          ['Noise Motor', reportData.noise.motorResult, reportData.noise.standard, reportData.noise.remarks],
          ['Grounding', reportData.grounding.breakerResult, reportData.grounding.standard, reportData.grounding.remarks],
        ]
      );
      row++;
      return row;
    },
  });
}
