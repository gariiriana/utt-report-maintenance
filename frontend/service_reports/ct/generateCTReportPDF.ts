import { jsPDF } from 'jspdf';
import { CTCustomerInfo, CTReportData, CTTimeSpent } from '@/types/ctReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';

const HEADER_DARK: [number, number, number] = [0, 51, 102];
const BORDER_GRAY: [number, number, number] = [180, 180, 180];
const HEADER_BG: [number, number, number] = [218, 230, 242]; // Light blue fill for section headers
const SECTION_SUBHEADER_BG: [number, number, number] = [255, 255, 0]; // Yellow fill for sub-headers (Visual & Inspection of Cooling Tower Devices)

async function loadLogoBase64(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

export async function generateCTReportPDF(
  customerInfo: CTCustomerInfo,
  reportData: CTReportData,
  timeSpent: CTTimeSpent,
  _photosData: Array<{ id: string; photoBase64?: string; description?: string }> = []
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth(); // 210
  const margin = 8;
  const contentW = pageW - margin * 2; // 194
  let y = margin;

  const [logoLeftB64, logoRightB64] = await Promise.all([
    loadLogoBase64(logoDwimitra),
    loadLogoBase64(logoNeutraDC),
  ]);

  // Helper to draw section header bar
  const drawSectionHeader = (title: string, subtext?: string) => {
    doc.setFillColor(...HEADER_BG);
    doc.rect(margin, y, contentW, subtext ? 7 : 5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(0, 0, 0);
    doc.text(title, margin + 2, y + 3.5);
    if (subtext) {
      doc.setFont('helvetica', 'normal').setFontSize(6.5);
      doc.text(subtext, margin + 45, y + 3.5);
    }
    doc.setDrawColor(...BORDER_GRAY).rect(margin, y, contentW, subtext ? 7 : 5);
    y += subtext ? 7 : 5;
  };

  const drawSubHeader = (numberStr: string, title: string) => {
    doc.setFillColor(...SECTION_SUBHEADER_BG);
    doc.rect(margin, y, contentW, 4.5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(0, 0, 0);
    doc.text(`${numberStr}`, margin + 3, y + 3.2);
    doc.text(title, margin + 12, y + 3.2);
    doc.setDrawColor(...BORDER_GRAY).rect(margin, y, contentW, 4.5);
    y += 4.5;
  };

  // ─── PAGE 1 ────────────────────────────────────────────────────────

  // Header Logos & Title
  if (logoLeftB64) {
    try { doc.addImage(logoLeftB64, 'PNG', margin, y, 30, 14); } catch (e) { console.error(e); }
  }
  if (logoRightB64) {
    try { doc.addImage(logoRightB64, 'PNG', pageW - margin - 26, y, 26, 12); } catch (e) { console.error(e); }
  }

  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...HEADER_DARK);
  doc.text('SERVICE REPORT COOLING TOWER (CT)', pageW / 2, y + 5, { align: 'center' });
  doc.setFontSize(9).setTextColor(200, 30, 30);
  doc.text('Neutra DC Cikarang', pageW / 2, y + 10, { align: 'center' });

  y += 16;

  // Customer Info Box
  drawSectionHeader('Customer');
  
  const custRowH = 4;
  const colW1 = 28;
  const colW2 = 38;
  const colW3 = 28;
  const colW4 = 38;
  const colW5 = 26;
  const colW6 = contentW - (colW1 + colW2 + colW3 + colW4 + colW5);

  const drawCustRow = (label1: string, val1: string, label2: string, val2: string, label3: string, val3: string) => {
    doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(0, 0, 0);
    doc.setDrawColor(...BORDER_GRAY);

    let x = margin;
    doc.rect(x, y, colW1, custRowH); doc.text(label1, x + 1.5, y + 2.8); x += colW1;
    doc.rect(x, y, colW2, custRowH); doc.text(val1 || '-', x + 1.5, y + 2.8); x += colW2;
    doc.rect(x, y, colW3, custRowH); doc.text(label2, x + 1.5, y + 2.8); x += colW3;
    doc.rect(x, y, colW4, custRowH); doc.text(val2 || '-', x + 1.5, y + 2.8); x += colW4;
    doc.rect(x, y, colW5, custRowH); doc.text(label3, x + 1.5, y + 2.8); x += colW5;
    doc.rect(x, y, colW6, custRowH); doc.text(val3 || '-', x + 1.5, y + 2.8);
    y += custRowH;
  };

  drawCustRow('Company name', customerInfo.companyName, 'Type', customerInfo.type, 'Mop No:', customerInfo.mopNo);
  drawCustRow('Equpment name', customerInfo.equipmentName, 'Serial No:', customerInfo.serialNo, 'Quarter', customerInfo.quarter);
  drawCustRow('CI Description', customerInfo.ciDescription, 'Product Name', customerInfo.productName, 'Location', customerInfo.location);
  drawCustRow('CI Name', customerInfo.ciName, 'Product Years', customerInfo.productYears, 'Date', customerInfo.date);
  
  // Last row with Engineer
  doc.setFont('helvetica', 'normal').setFontSize(6.5);
  doc.rect(margin, y, colW1, custRowH); doc.text('Spesification', margin + 1.5, y + 2.8);
  doc.rect(margin + colW1, y, colW2 + colW3 + colW4, custRowH); doc.text(customerInfo.spesification || '-', margin + colW1 + 1.5, y + 2.8);
  doc.rect(margin + colW1 + colW2 + colW3 + colW4, y, colW5, custRowH); doc.text('Engginer', margin + colW1 + colW2 + colW3 + colW4 + 1.5, y + 2.8);
  doc.rect(margin + colW1 + colW2 + colW3 + colW4 + colW5, y, colW6, custRowH); doc.text(customerInfo.engineer || '-', margin + colW1 + colW2 + colW3 + colW4 + colW5 + 1.5, y + 2.8);
  y += custRowH + 1;

  // Table Columns Widths
  const noW = 10;
  const paramW = 32;
  const condW = 32;
  const remW = 32;
  const actW = contentW - (noW + paramW + condW + remW);

  const drawTableHeader = () => {
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, contentW, 4, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(0, 0, 0);
    let x = margin;
    doc.rect(x, y, noW, 4); doc.text('No', x + noW / 2, y + 2.8, { align: 'center' }); x += noW;
    doc.rect(x, y, actW, 4); doc.text('Activity', x + actW / 2, y + 2.8, { align: 'center' }); x += actW;
    doc.rect(x, y, paramW, 4); doc.text('Parameter', x + paramW / 2, y + 2.8, { align: 'center' }); x += paramW;
    doc.rect(x, y, condW, 4); doc.text('Condition', x + condW / 2, y + 2.8, { align: 'center' }); x += condW;
    doc.rect(x, y, remW, 4); doc.text('Remarks', x + remW / 2, y + 2.8, { align: 'center' });
    y += 4;
  };

  const drawTableRow = (no: string, act: string, param: string, cond: string, rem: string) => {
    const actLines = doc.splitTextToSize(act, actW - 3);
    const rowH = Math.max(3.8, actLines.length * 3.2);

    doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(0, 0, 0);
    doc.setDrawColor(...BORDER_GRAY);

    let x = margin;
    doc.rect(x, y, noW, rowH); doc.text(no, x + noW / 2, y + 2.6, { align: 'center' }); x += noW;
    doc.rect(x, y, actW, rowH); doc.text(actLines, x + 1.5, y + 2.6); x += actW;
    doc.rect(x, y, paramW, rowH); doc.text(param || '-', x + 1.5, y + 2.6); x += paramW;

    // Condition Good / Not good checkmarks
    doc.rect(x, y, condW, rowH);
    const isGood = cond === 'Good';
    const isNotGood = cond === 'Not good';
    doc.text(isGood ? '[√] Good  [ ] Not good' : isNotGood ? '[ ] Good  [√] Not good' : '[ ] Good  [ ] Not good', x + 1.5, y + 2.6);
    x += condW;

    doc.rect(x, y, remW, rowH); doc.text(rem || '', x + 1.5, y + 2.6);
    y += rowH;
  };

  // Section 1: Visual Inspection & Maintenance
  drawSectionHeader('Visual inspection & Maintenance', 'Please fill in the parameters according to the conditions of the device in the field.');
  drawTableHeader();

  drawSubHeader('1', 'Visual and Inspection of Cooling Tower Devices');
  reportData.visualInspectionCT.forEach(item => {
    drawTableRow(item.no, item.activity, item.parameter, item.condition, item.remarks);
  });

  drawSubHeader('2', 'Visual and Inspection of Panel Control Devices');
  reportData.visualInspectionPanel.forEach(item => {
    drawTableRow(item.no, item.activity, item.parameter, item.condition, item.remarks);
  });

  y += 1;

  // Section 2: Cleaning
  drawSectionHeader('Cleaning', 'Please fill in the parameters according to the conditions of the device in the field.');
  drawTableHeader();

  drawSubHeader('1', 'Cleaning of Cooling Tower Devices');
  reportData.cleaningCT.forEach(item => {
    drawTableRow(item.no, item.activity, item.parameter, item.condition, item.remarks);
  });

  drawSubHeader('2', 'Cleaning of Panel Control');
  reportData.cleaningPanel.forEach(item => {
    drawTableRow(item.no, item.activity, item.parameter, item.condition, item.remarks);
  });

  // ─── PAGE 2 ────────────────────────────────────────────────────────
  doc.addPage();
  y = margin;

  drawSectionHeader('Meassurement', 'Please mark OK (√), not OK (×), not applicable (N/A) in the box');
  drawTableHeader();

  // Voltage & Current Row
  const voltRowH = 14;
  doc.setFont('helvetica', 'normal').setFontSize(6);
  doc.rect(margin, y, noW, voltRowH); doc.text('a.', margin + noW / 2, y + 3, { align: 'center' });
  doc.rect(margin + noW, y, actW, voltRowH); doc.text('Measurement input/output voltage, current', margin + noW + 1.5, y + 3);

  // Sub-grid for Voltage & Current inside parameter column
  let subX = margin + noW + actW;
  doc.rect(subX, y, paramW, voltRowH);
  doc.text(`R-N: ${reportData.measurement.rnVoltage || '-'} V`, subX + 1.5, y + 3);
  doc.text(`S-N: ${reportData.measurement.snVoltage || '-'} V`, subX + 1.5, y + 6);
  doc.text(`T-N: ${reportData.measurement.tnVoltage || '-'} V`, subX + 1.5, y + 9);
  doc.text(`R-S: ${reportData.measurement.rsVoltage || '-'} V`, subX + 16, y + 3);
  doc.text(`S-T: ${reportData.measurement.stVoltage || '-'} V`, subX + 16, y + 6);
  doc.text(`T-R: ${reportData.measurement.trVoltage || '-'} V`, subX + 16, y + 9);

  subX += paramW;
  doc.rect(subX, y, condW, voltRowH);
  const isVCGood = reportData.measurement.voltageCurrentCondition === 'Good';
  doc.text(isVCGood ? '[√] Good  [ ] Not good' : '[ ] Good  [√] Not good', subX + 1.5, y + 6);

  subX += condW;
  doc.rect(subX, y, remW, voltRowH);
  doc.text(reportData.measurement.voltageCurrentRemarks || '', subX + 1.5, y + 6);
  y += voltRowH;

  // Other Measurements
  drawTableRow('b.', 'Verify temperature measurements', `${reportData.measurement.tempMeasurements || '-'} °C`, reportData.measurement.tempCondition, reportData.measurement.tempRemarks);
  drawTableRow('c.', 'Measurement of suction and discharge pipes', `Suction: ${reportData.measurement.suctionPressure || '-'} bar | Discharge: ${reportData.measurement.dischargePressure || '-'} bar`, reportData.measurement.suctionDischargeCondition, reportData.measurement.suctionDischargeRemarks);
  drawTableRow('d.', 'Measurement of output air flow', reportData.measurement.outputAirFlow || '-', reportData.measurement.outputAirFlowCondition, reportData.measurement.outputAirFlowRemarks);
  drawTableRow('e.', 'Temperature measurement on fan motor', `${reportData.measurement.motorTemp || '-'} °C`, reportData.measurement.motorTempCondition, reportData.measurement.motorTempRemarks);
  drawTableRow('f.', 'Rotation speed measurement fan outdoor', `${reportData.measurement.fanOutdoorRpm || '-'} RPM`, reportData.measurement.fanOutdoorRpmCondition, reportData.measurement.fanOutdoorRpmRemarks);

  y += 2;

  // Section 4: Analysis / Remark
  drawSectionHeader('Analysis/Remark');
  const analRowH = 12;

  doc.setFont('helvetica', 'normal').setFontSize(6.5);
  doc.rect(margin, y, 45, analRowH);
  doc.text(reportData.analysis.isNormal ? '[√] Normal operation' : '[ ] Normal operation', margin + 2, y + 4);

  doc.rect(margin + 45, y, contentW - 45, analRowH);
  doc.text(`Remark: ${reportData.analysis.remark || 'N/A'}`, margin + 47, y + 4);
  y += analRowH;

  // Abnormal operation details
  doc.rect(margin, y, 45, 16);
  doc.text(reportData.analysis.isAbnormal ? '[√] Abnormal operation' : '[ ] Abnormal operation', margin + 2, y + 4);
  doc.text('(Please fill the items if the service is repair)', margin + 2, y + 8, { maxWidth: 40 });

  const abRowW1 = 35;
  const abRowW2 = contentW - (45 + abRowW1);
  let abY = y;

  doc.rect(margin + 45, abY, abRowW1, 4); doc.text('Fault symptom', margin + 47, abY + 2.8);
  doc.rect(margin + 45 + abRowW1, abY, abRowW2, 4); doc.text(reportData.analysis.faultSymptom || '-', margin + 45 + abRowW1 + 2, abY + 2.8);
  abY += 4;

  doc.rect(margin + 45, abY, abRowW1, 4); doc.text('Fault analysis', margin + 47, abY + 2.8);
  doc.rect(margin + 45 + abRowW1, abY, abRowW2, 4); doc.text(reportData.analysis.faultAnalysis || '-', margin + 45 + abRowW1 + 2, abY + 2.8);
  abY += 4;

  doc.rect(margin + 45, abY, abRowW1, 4); doc.text('Work done / action taken', margin + 47, abY + 2.8);
  doc.rect(margin + 45 + abRowW1, abY, abRowW2, 4); doc.text(reportData.analysis.workDone || '-', margin + 45 + abRowW1 + 2, abY + 2.8);
  abY += 4;

  doc.rect(margin + 45, abY, abRowW1, 4); doc.text('Fault Part SN', margin + 47, abY + 2.8);
  doc.rect(margin + 45 + abRowW1, abY, abRowW2, 4); doc.text(`SN: ${reportData.analysis.faultPartSN || '-'} | Name: ${reportData.analysis.faultPartName || '-'}`, margin + 45 + abRowW1 + 2, abY + 2.8);
  
  y += 17;

  // Section 5: TIME SPENT
  drawSectionHeader('TIME SPENT');
  const timeW = contentW / 4;
  doc.setFont('helvetica', 'bold').setFontSize(6.5);
  doc.rect(margin, y, timeW, 4); doc.text('Date', margin + timeW / 2, y + 2.8, { align: 'center' });
  doc.rect(margin + timeW, y, timeW, 4); doc.text('Departure', margin + timeW + timeW / 2, y + 2.8, { align: 'center' });
  doc.rect(margin + timeW * 2, y, timeW, 4); doc.text('Start', margin + timeW * 2 + timeW / 2, y + 2.8, { align: 'center' });
  doc.rect(margin + timeW * 3, y, timeW, 4); doc.text('Finish', margin + timeW * 3 + timeW / 2, y + 2.8, { align: 'center' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.rect(margin, y, timeW, 4.5); doc.text(timeSpent.date || '-', margin + timeW / 2, y + 3, { align: 'center' });
  doc.rect(margin + timeW, y, timeW, 4.5); doc.text(timeSpent.departure || '-', margin + timeW + timeW / 2, y + 3, { align: 'center' });
  doc.rect(margin + timeW * 2, y, timeW, 4.5); doc.text(timeSpent.start || '-', margin + timeW * 2 + timeW / 2, y + 3, { align: 'center' });
  doc.rect(margin + timeW * 3, y, timeW, 4.5); doc.text(timeSpent.finish || '-', margin + timeW * 3 + timeW / 2, y + 3, { align: 'center' });
  y += 6;

  // Section 6: CUSTOMER ACKNOWLEDGEMENT & SIGNATURES
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(0, 0, 0);
  doc.text('CUSTOMER ACKNOWLEDGEMENT:', pageW / 2, y + 3, { align: 'center' });
  y += 7;

  const sigW = contentW / 3;
  doc.setFont('helvetica', 'bold').setFontSize(7);
  doc.text('Prepared', margin + sigW / 2, y, { align: 'center' });
  doc.text('Checked', margin + sigW + sigW / 2, y, { align: 'center' });
  doc.text('Approved', margin + sigW * 2 + sigW / 2, y, { align: 'center' });

  y += 18;

  doc.setFont('helvetica', 'normal').setFontSize(7);
  doc.text('Engineer', margin + sigW / 2, y, { align: 'center' });
  doc.text('SM / PM', margin + sigW + sigW / 2, y, { align: 'center' });
  doc.text('Client / Owner', margin + sigW * 2 + sigW / 2, y, { align: 'center' });

  return {
    doc,
    fileName: `Service_Report_CT_${(customerInfo.location || 'NeutraDC').replace(/[^a-z0-9]/gi, '_')}_${(customerInfo.date || '').replace(/[^a-z0-9]/gi, '_')}.pdf`,
  };
}
