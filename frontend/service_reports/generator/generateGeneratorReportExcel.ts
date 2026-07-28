import { GensetCustomerInfo, GensetReportData, GensetTimeSpent } from '@/types/generatorReportTypes';
import { generateServiceReportExcel, writeMeasurementTable } from '@/service_reports/common/serviceReportExcel';

export async function generateGeneratorReportExcel(
  customerInfo: GensetCustomerInfo,
  reportData: GensetReportData,
  timeSpent: GensetTimeSpent,
  photos?: Array<{ photoBase64?: string; description: string }>
) {
  await generateServiceReportExcel({
    title: 'Service Report Genset (Generator)',
    equipmentLabel: 'Generator',
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
    visualInspection: reportData.inspection.map(i => ({
      no: i.no, activity: i.activity, parameter: i.parameter,
      condition: i.isGood ? 'Good' : (i.isNotGood ? 'Not Good' : ''), remarks: i.remarks,
    })),
    cleaning: reportData.cleaning.map(c => ({
      no: c.no, activity: c.activity, parameter: c.parameter,
      condition: c.isGood ? 'Good' : (c.isNotGood ? 'Not Good' : ''), remarks: c.remarks,
    })),
    operationStatus: {
      is_normal: reportData.analysis.isNormal,
      remark: reportData.analysis.remarkText,
      fault_symptom: reportData.analysis.faultSymptom,
      fault_analysis: reportData.analysis.faultAnalysis,
      work_done: reportData.analysis.workDone,
      fault_part_sn: reportData.analysis.faultPartSN,
    },
    photos,
    fileName: `Service_Report_Generator_${customerInfo.serialNo || 'Draft'}`,
    writeMeasurements: (ws, startRow) => {
      let row = startRow;
      const o = reportData.measurement.outputVC;
      row = writeMeasurementTable(ws, row, 'OUTPUT VOLTAGE & CURRENT',
        ['Parameter', 'Hasil'],
        [
          ['V R-S', o.rs], ['V S-T', o.st], ['V T-R', o.tr],
          ['V R-N', o.rn], ['V S-N', o.sn], ['V T-N', o.tn], ['V N-G', o.ng],
          ['I R', o.r], ['I S', o.s], ['I T', o.t], ['I N', o.n],
          ['KW', o.kw], ['KVA', o.kva], ['KVAR', o.kvar],
        ]
      );
      row++;
      row = writeMeasurementTable(ws, row, 'MEASUREMENT ITEMS',
        ['Item', 'Status', 'Keterangan'],
        [
          ['DC Battery', reportData.measurement.dcBattery.isGood ? 'Baik' : 'Tidak Baik', reportData.measurement.dcBattery.remarks],
          ['Torque Nut', reportData.measurement.torqueNut.isGood ? 'Baik' : 'Tidak Baik', reportData.measurement.torqueNut.remarks],
          ['DC Alternator', reportData.measurement.dcAlternator.isGood ? 'Baik' : 'Tidak Baik', reportData.measurement.dcAlternator.remarks],
          ['Grounding', reportData.measurement.grounding.isGood ? 'Baik' : 'Tidak Baik', reportData.measurement.grounding.remarks],
          ['Noise', reportData.measurement.noise.isGood ? 'Baik' : 'Tidak Baik', reportData.measurement.noise.remarks],
          ['Vibration', reportData.measurement.vibration.isGood ? 'Baik' : 'Tidak Baik', reportData.measurement.vibration.remarks],
          ['Coolant', reportData.measurement.coolant.isGood ? 'Baik' : 'Tidak Baik', reportData.measurement.coolant.remarks],
          ['Thermal Scan', reportData.measurement.thermalScan.isGood ? 'Baik' : 'Tidak Baik', reportData.measurement.thermalScan.remarks],
          ['Heating Current', reportData.measurement.heatingCurrent.isGood ? 'Baik' : 'Tidak Baik', reportData.measurement.heatingCurrent.remarks],
        ]
      );
      row++;
      return row;
    },
  });
}
