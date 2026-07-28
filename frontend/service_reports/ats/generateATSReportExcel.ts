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
      companyName: customerInfo.company_name, equipmentName: customerInfo.equipment_name,
      ciDescription: customerInfo.ci_description, ciName: customerInfo.ci_name,
      type: customerInfo.type, serialNo: customerInfo.serial_no,
      productName: customerInfo.product_name, productYears: customerInfo.product_years,
      specification: customerInfo.specification, location: customerInfo.location,
      area: customerInfo.area, mopNo: customerInfo.map_no,
      quarter: customerInfo.quarter, date: customerInfo.date, engineer: customerInfo.engineer,
    },
    timeSpent,
    visualInspection: (reportData.visual_inspection || []).map(i => ({
      no: i.no, activity: i.activity, parameter: i.parameter,
      condition: i.condition, remarks: i.remarks,
    })),
    operationStatus: {
      is_normal: reportData.operation_status.is_normal,
      remark: reportData.operation_status.remark,
      fault_symptom: reportData.operation_status.fault_symptom,
      fault_analysis: reportData.operation_status.fault_analysis,
      work_done: reportData.operation_status.work_done,
      fault_part_sn: reportData.operation_status.fault_part_sn,
    },
    photos,
    fileName: `Service_Report_ATS_${customerInfo.serial_no || 'Draft'}`,
    writeMeasurements: (ws, startRow) => {
      let row = startRow;
      const pm = reportData.power_meter_recording || {};
      row = writeMeasurementTable(ws, row, 'PENGUKURAN DIGITAL POWER METER & TEGANGAN/ARUS',
        ['Parameter', 'Hasil'],
        [
          ['V R-S', pm.voltage_rs], ['V S-T', pm.voltage_st], ['V T-R', pm.voltage_tr],
          ['V R-N', pm.voltage_rn], ['V S-N', pm.voltage_sn], ['V T-N', pm.voltage_tn], ['V N-G', pm.voltage_ng],
          ['I R', pm.current_r], ['I S', pm.current_s], ['I T', pm.current_t], ['I N', pm.current_n],
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
