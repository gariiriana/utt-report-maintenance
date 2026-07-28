import { PDUCustomerInfo, PDUReportData, PDUTimeSpent } from '@/types/pduReportTypes';
import { generateServiceReportExcel, writeMeasurementTable } from '@/service_reports/common/serviceReportExcel';

export async function generatePDUReportExcel(
  customerInfo: PDUCustomerInfo,
  reportData: PDUReportData,
  timeSpent: PDUTimeSpent,
  photos?: Array<{ photoBase64?: string; description: string }>
) {
  await generateServiceReportExcel({
    title: 'Service Report Panel PDU',
    equipmentLabel: 'PDU',
    customerInfo: {
      companyName: customerInfo.companyName, equipmentName: customerInfo.equipmentName,
      ciDescription: customerInfo.ciDescription, ciName: customerInfo.ciName,
      type: customerInfo.type, serialNo: customerInfo.serialNo,
      productName: customerInfo.productName, productYears: customerInfo.prodYear,
      specification: customerInfo.specification, location: customerInfo.location,
      area: customerInfo.area, mopNo: customerInfo.mopNo,
      quarter: customerInfo.quarter, date: customerInfo.date, engineer: customerInfo.engineerTechnician,
    },
    timeSpent,
    visualInspection: reportData.inspection_checking.map(i => ({
      no: String(i.no), activity: i.activity, parameter: i.parameter, condition: i.condition, remarks: i.remarks,
    })),
    cleaning: reportData.cleaning.map(c => ({
      no: String(c.no), activity: c.activity, parameter: c.parameter, condition: c.condition, remarks: c.remarks,
    })),
    operationStatus: {
      is_normal: reportData.analysis_remark.isNormal,
      remark: reportData.analysis_remark.remarkText,
      fault_symptom: reportData.analysis_remark.faultSymptom,
      fault_analysis: reportData.analysis_remark.faultAnalysis,
      work_done: reportData.analysis_remark.workDone,
      fault_part_sn: reportData.analysis_remark.faultPartSN,
    },
    photos,
    fileName: `Service_Report_PDU_${customerInfo.serialNo || 'Draft'}`,
    writeMeasurements: (ws, startRow) => {
      let row = startRow;
      const d = reportData.dpm_recording;
      row = writeMeasurementTable(ws, row, 'PENCATATAN DIGITAL POWER METER',
        ['Parameter', 'Nilai'],
        [
          ['Voltage R-S', d.voltage_rs], ['Voltage S-T', d.voltage_st], ['Voltage T-R', d.voltage_tr],
          ['Voltage R-N', d.voltage_rn], ['Voltage S-N', d.voltage_sn], ['Voltage T-N', d.voltage_tn],
          ['Voltage N-G', d.voltage_ng],
          ['Current R', d.r_ampere], ['Current S', d.s_ampere], ['Current T', d.t_ampere], ['Current N', d.n_ampere],
          ['KW', d.kw], ['KVA', d.kva], ['KVAR', d.kvar], ['Cos P', d.cos_p],
        ]
      );
      row++;
      const va = reportData.voltage_ampere;
      row = writeMeasurementTable(ws, row, 'PENGUKURAN TEGANGAN & ARUS',
        ['Parameter', 'Nilai'],
        [
          ['V R-S', va.voltage_rs], ['V S-T', va.voltage_st], ['V T-R', va.voltage_tr],
          ['V R-N', va.voltage_rn], ['V S-N', va.voltage_sn], ['V T-N', va.voltage_tn],
          ['V N-G', va.voltage_ng],
          ['I R', va.current_r], ['I S', va.current_s], ['I T', va.current_t], ['I N', va.current_n],
        ]
      );
      row++;
      const th = reportData.thermal_measurement;
      row = writeMeasurementTable(ws, row, 'PENGUKURAN TERMAL',
        ['Breaker', 'Suhu (°C)', 'Standar', 'Keterangan'],
        [[th.breaker, th.result_temp, th.standard, th.remarks]]
      );
      row++;
      const gr = reportData.grounding_resistance;
      row = writeMeasurementTable(ws, row, 'RESISTANSI GROUNDING',
        ['Kabel', 'Hasil (Ω)', 'Standar', 'Keterangan'],
        [[gr.wire, gr.result, gr.standard, gr.remarks]]
      );
      row++;
      const no = reportData.noise_measurement;
      row = writeMeasurementTable(ws, row, 'PENGUKURAN NOISE',
        ['Pengukuran', 'Hasil', 'Standar', 'Keterangan'],
        [[no.measurement, no.result, no.standard, no.remarks]]
      );
      row++;
      return row;
    },
  });
}
