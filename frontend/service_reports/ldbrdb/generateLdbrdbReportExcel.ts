import { LdbrdbCustomerInfo, LdbrdbReportData, LdbrdbTimeSpent } from '@/types/ldbrdbReportTypes';
import { generateServiceReportExcel, writeMeasurementTable } from '@/service_reports/common/serviceReportExcel';

export async function generateLdbrdbReportExcel(
  customerInfo: LdbrdbCustomerInfo,
  reportData: LdbrdbReportData,
  timeSpent: LdbrdbTimeSpent,
  photos?: Array<{ photoBase64?: string; description: string }>
) {
  await generateServiceReportExcel({
    title: 'Service Report Panel LDB & RDB',
    equipmentLabel: 'LDB/RDB',
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
    operationStatus: {
      is_normal: !reportData.analysis.faultSymptom,
      remark: reportData.analysis.remark,
      fault_symptom: reportData.analysis.faultSymptom,
      fault_analysis: reportData.analysis.faultAnalysis,
      work_done: reportData.analysis.workDone,
      fault_part_sn: reportData.analysis.faultPartSN,
    },
    photos,
    fileName: `Service_Report_LDBRDB_${customerInfo.serialNo || 'Draft'}`,
    writeMeasurements: (ws, startRow) => {
      let row = startRow;
      const dpm = reportData.dpmRecording;
      row = writeMeasurementTable(ws, row, 'PENCATATAN DIGITAL POWER METER',
        ['Parameter', 'Hasil'],
        [
          ['V R-S', dpm.voltageRS], ['V S-T', dpm.voltageST], ['V T-R', dpm.voltageTR],
          ['V R-N', dpm.voltageRN], ['V S-N', dpm.voltageSN], ['V T-N', dpm.voltageTN],
          ['KW', dpm.kw], ['KVAR', dpm.kvar], ['KVA', dpm.kva], ['Cos P', dpm.cosp],
          ['I R', dpm.ampereR], ['I S', dpm.ampereS], ['I T', dpm.ampereT],
        ]
      );
      row++;
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
      row = writeMeasurementTable(ws, row, 'THERMAL & GROUNDING',
        ['Parameter', 'Hasil', 'Standar', 'Keterangan'],
        [
          ['Thermal Breaker (°C)', reportData.thermal.breakerResult, reportData.thermal.standard, reportData.thermal.remarks],
          ['Grounding (Ω)', reportData.grounding.groundingResult, reportData.grounding.standard, reportData.grounding.remarks],
        ]
      );
      row++;
      return row;
    },
  });
}
