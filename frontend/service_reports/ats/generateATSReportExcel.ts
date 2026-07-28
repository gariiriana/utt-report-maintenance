import { ATSCustomerInfo, ATSReportData, ATSTimeSpent } from '@/types/atsReportTypes';
import { generateServiceReportExcel, writeMeasurementTable } from '@/service_reports/common/serviceReportExcel';

export async function generateATSReportExcel(
  customerInfo: ATSCustomerInfo,
  reportData: ATSReportData,
  timeSpent: ATSTimeSpent,
  photos?: Array<{ photoBase64?: string; description: string }>
) {
  await generateServiceReportExcel({
    title: 'Service Report Automatic Transfer Switch (ATS)',
    equipmentLabel: 'ATS Panel',
    customerInfo: {
      companyName: customerInfo.companyName, equipmentName: customerInfo.equipmentName,
      ciDescription: customerInfo.ciDescription, ciName: customerInfo.ciName,
      type: customerInfo.type, serialNo: customerInfo.serialNo,
      productName: customerInfo.productName, productYears: customerInfo.productYears,
      specification: customerInfo.specification, location: customerInfo.location,
      area: customerInfo.area, mopNo: customerInfo.mapNo,
      quarter: customerInfo.quarter, date: customerInfo.date, engineer: customerInfo.engineer,
    },
    timeSpent,
    visualInspection: (reportData.visual_inspection || []).map(i => ({
      no: i.no, activity: i.activity, parameter: i.parameter,
      condition: i.condition, remarks: i.remarks,
    })),
    operationStatus: {
      is_normal: reportData.operation_status?.is_normal ?? true,
      remark: reportData.operation_status?.remark || '',
      fault_symptom: reportData.operation_status?.fault_symptom || '',
      fault_analysis: reportData.operation_status?.fault_analysis || '',
      work_done: reportData.operation_status?.work_done || '',
      fault_part_sn: reportData.operation_status?.fault_part_sn || '',
    },
    photos,
    fileName: `Service_Report_ATS_${customerInfo.serialNo || 'Draft'}`,
    writeMeasurements: (ws, startRow) => {
      let row = startRow;
      const vc = reportData.voltage_current || {};
      row = writeMeasurementTable(ws, row, 'PENGUKURAN TEGANGAN & ARUS',
        ['Parameter', 'Hasil'],
        [
          ['V R-S', vc.voltage_rs], ['V S-T', vc.voltage_st], ['V T-R', vc.voltage_tr],
          ['V R-N', vc.voltage_rn], ['V S-N', vc.voltage_sn], ['V T-N', vc.voltage_tn], ['V N-G', vc.voltage_ng],
          ['I R', vc.ampere_r], ['I S', vc.ampere_s], ['I T', vc.ampere_t],
        ]
      );
      row++;
      const gr = reportData.grounding_resistance || {};
      const tm = reportData.thermal_measurement || {};
      row = writeMeasurementTable(ws, row, 'GROUNDING & THERMAL',
        ['Parameter', 'Hasil', 'Standar', 'Keterangan'],
        [
          ['Grounding Resistance (Ω)', gr.result_ohm, gr.standard, gr.remarks],
          ['Thermal Measurement (°C)', tm.result_temperature, tm.standard, tm.remarks],
        ]
      );
      row++;
      return row;
    },
  });
}
