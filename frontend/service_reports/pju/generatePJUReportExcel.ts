import { PJUCustomerInfo, PJUReportData, PJUTimeSpent } from '@/types/pjuReportTypes';
import { generateServiceReportExcel, writeMeasurementTable } from '@/service_reports/common/serviceReportExcel';

export async function generatePJUReportExcel(
  customerInfo: PJUCustomerInfo,
  reportData: PJUReportData,
  timeSpent: PJUTimeSpent,
  photos?: Array<{ photoBase64?: string; description: string }>
) {
  await generateServiceReportExcel({
    title: 'Service Report Street Lighting & Garden Lighting (PJU)',
    equipmentLabel: 'PJU',
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
    visualInspection: reportData.visual_inspection,
    cleaning: reportData.cleaning,
    operationStatus: reportData.operation_status,
    photos,
    fileName: `Service_Report_PJU_${customerInfo.serialNo || 'Draft'}`,
    writeMeasurements: (ws, startRow) => {
      let row = startRow;
      row = writeMeasurementTable(ws, row, 'PENGUKURAN',
        ['No', 'Aktivitas', 'Parameter', 'Kondisi', 'Keterangan'],
        reportData.measurement.map(m => [m.no, m.activity, m.parameter, m.condition, m.remarks])
      );
      row++;
      row = writeMeasurementTable(ws, row, 'PENGETESAN',
        ['No', 'Aktivitas', 'Parameter', 'Kondisi', 'Keterangan'],
        reportData.test.map(t => [t.no, t.activity, t.parameter, t.condition, t.remarks])
      );
      row++;
      return row;
    },
  });
}
