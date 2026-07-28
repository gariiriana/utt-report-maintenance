import { BusductCustomerInfo, BusductReportData, BusductTimeSpent } from '@/types/busductReportTypes';
import { generateServiceReportExcel, writeMeasurementTable } from '@/service_reports/common/serviceReportExcel';

export async function generateBusductReportExcel(
  customerInfo: BusductCustomerInfo,
  reportData: BusductReportData,
  timeSpent: BusductTimeSpent,
  photos?: Array<{ photoBase64?: string; description: string }>
) {
  await generateServiceReportExcel({
    title: 'Service Report Panel Busduct',
    equipmentLabel: 'Busduct',
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
      condition: i.isGood ? 'Good' : (i.isNotGood ? 'Not Good' : ''), remarks: i.remarks,
    })),
    cleaning: reportData.cleaning.map(c => ({
      no: c.no, activity: c.activity, parameter: c.parameter,
      condition: c.isGood ? 'Good' : (c.isNotGood ? 'Not Good' : ''), remarks: c.remarks,
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
    fileName: `Service_Report_Busduct_${customerInfo.serialNo || 'Draft'}`,
    writeMeasurements: (ws, startRow) => {
      let row = startRow;
      const th = reportData.thermal;
      row = writeMeasurementTable(ws, row, 'PENGUKURAN TERMAL',
        ['Breaker', 'Suhu (°C)', 'Standar', 'Keterangan'],
        [[th.breaker, th.resultTemp, th.standard, th.remarks]]
      );
      row++;
      return row;
    },
  });
}
