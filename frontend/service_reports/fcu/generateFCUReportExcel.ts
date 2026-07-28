import { FCUCustomerInfo, FCUReportData, FCUTimeSpent } from '@/types/fcuReportTypes';
import { generateServiceReportExcel, writeMeasurementTable } from '@/service_reports/common/serviceReportExcel';

export async function generateFCUReportExcel(
  customerInfo: FCUCustomerInfo,
  reportData: FCUReportData,
  timeSpent: FCUTimeSpent,
  photos?: Array<{ photoBase64?: string; description: string }>
) {
  await generateServiceReportExcel({
    title: 'Service Report Fan Coil Unit (FCU)',
    equipmentLabel: 'FCU',
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
    fileName: `Service_Report_FCU_${customerInfo.serialNo || 'Draft'}`,
    writeMeasurements: (ws, startRow) => {
      let row = startRow;
      row = writeMeasurementTable(ws, row, 'PENGUKURAN TEGANGAN & ARUS',
        ['Parameter', 'Hasil', 'Standar'],
        [
          ['Voltage R-N', reportData.voltage_current.voltage_rn, '220V ±10%'],
          ['Voltage S-N', reportData.voltage_current.voltage_sn, '220V ±10%'],
          ['Voltage T-N', reportData.voltage_current.voltage_tn, '220V ±10%'],
          ['Voltage R-S', reportData.voltage_current.voltage_rs, '380V ±10%'],
          ['Voltage S-T', reportData.voltage_current.voltage_st, '380V ±10%'],
          ['Voltage T-R', reportData.voltage_current.voltage_tr, '380V ±10%'],
          ['Current R', reportData.voltage_current.current_r, ''],
          ['Current S', reportData.voltage_current.current_s, ''],
          ['Current T', reportData.voltage_current.current_t, ''],
        ]
      );
      row++;
      row = writeMeasurementTable(ws, row, 'VIBRASI & NOISE',
        ['Parameter', 'Hasil', 'Standar', 'Keterangan'],
        [
          ['Vibration', reportData.vibration_noise.vibration, '≤ 2.5', reportData.vibration_noise.remarks],
          ['Noise (dB)', reportData.vibration_noise.noise, '≤ 65 dB', ''],
        ]
      );
      row++;
      row = writeMeasurementTable(ws, row, 'TEMPERATUR & KELEMBABAN',
        ['Parameter', 'Hasil', 'Standar', 'Keterangan'],
        [
          ['Temperature (°C)', reportData.temp_humidity.temp, '≤ ±25°C', reportData.temp_humidity.remarks],
          ['RH (%)', reportData.temp_humidity.rh, '≤ ±60%', ''],
        ]
      );
      row++;
      row = writeMeasurementTable(ws, row, 'TEKANAN PIPA SUPPLY & RETURN',
        ['Parameter', 'Hasil', 'Standar', 'Keterangan'],
        [
          ['Supply (Bar)', reportData.pipe_pressure.supply, '2.5 - 4 Bar', reportData.pipe_pressure.remarks],
          ['Return (Bar)', reportData.pipe_pressure.return_val, '2.5 - 4 Bar', ''],
        ]
      );
      row++;
      row = writeMeasurementTable(ws, row, 'AIR FLOW OUTPUT',
        ['Parameter', 'Hasil', 'Standar', 'Keterangan'],
        [['Air Flow (m/s)', reportData.air_flow.air_flow, '2.0 - 8.0 m/s', reportData.air_flow.remarks]]
      );
      row++;
      return row;
    },
  });
}
