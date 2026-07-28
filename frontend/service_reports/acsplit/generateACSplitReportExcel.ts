import { ACSplitCustomerInfo, ACSplitReportData, ACSplitTimeSpent } from '@/types/acSplitReportTypes';
import { generateServiceReportExcel, writeMeasurementTable } from '@/service_reports/common/serviceReportExcel';

export async function generateACSplitReportExcel(
  customerInfo: ACSplitCustomerInfo,
  reportData: ACSplitReportData,
  timeSpent: ACSplitTimeSpent,
  photos?: Array<{ photoBase64?: string; description: string }>
) {
  const allInspection = [...reportData.indoorInspection, ...reportData.outdoorInspection];
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
