import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  GensetCustomerInfo,
  GensetReportData,
  GensetTimeSpent,
} from '@/types/generatorReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';

async function loadImageAsBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Canvas context is null'));
      }
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export async function generateGeneratorReportPDF(
  customerInfo: GensetCustomerInfo,
  reportData: GensetReportData,
  timeSpent: GensetTimeSpent,
  _photos?: any[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const [dwiBase64, neutraBase64] = await Promise.all([
    loadImageAsBase64(logoDwimitra),
    loadImageAsBase64(logoNeutraDC),
  ]);

  const drawHeader = (_pageNo: number) => {
    // Left & Right Logos
    try {
      doc.addImage(dwiBase64, 'PNG', 10, 5, 24, 10);
      doc.addImage(neutraBase64, 'PNG', 175, 5, 24, 10);
    } catch (e) {
      console.warn('Failed to draw logos', e);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SERVICE REPORT GENSET', 105, 9, { align: 'center' });
    doc.setFontSize(8);
    doc.text('NeutraDC Cikarang', 105, 13, { align: 'center' });
    doc.setLineWidth(0.3);
    doc.line(10, 16, 200, 16);
  };

  // PAGE 1
  drawHeader(1);

  // Customer Metadata Table
  autoTable(doc, {
    startY: 18,
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1, lineWidth: 0 },
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 25 },
      1: { cellWidth: 38 },
      2: { fontStyle: 'bold', cellWidth: 25 },
      3: { cellWidth: 38 },
      4: { fontStyle: 'bold', cellWidth: 22 },
      5: { cellWidth: 42 },
    },
    body: [
      ['Company name', customerInfo.companyName || 'NeutraDC Cikarang', 'Type', customerInfo.type || '', 'MOP No.', customerInfo.mopNo || 'DME-TDE/MOP/Generator/03 2406/26'],
      ['Equipment Name', customerInfo.equipmentName || 'GENSET', 'Serial No.', customerInfo.serialNo || '', 'Quarter', customerInfo.quarter || ''],
      ['CI Description', customerInfo.ciDescription || '', 'Product Name', customerInfo.productName || 'KOHLER', 'Location', customerInfo.location || ''],
      ['CI Name', customerInfo.ciName || '', 'Prod.Year', customerInfo.prodYear || '', 'Area / Engineer', `${customerInfo.area || ''} / ${customerInfo.engineer || ''}`],
    ],
  });

  // Section: Visual Inspection
  let currentY = (doc as any).lastAutoTable.finalY + 3;
  doc.setFillColor(0, 102, 204);
  doc.rect(10, currentY, 190, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Visual inspection', 12, currentY + 3);

  const inspectionRows = reportData.inspection.map(item => [
    item.no,
    item.activity,
    item.parameter,
    item.isGood ? '[ X ] Good   [   ] Not Good' : item.isNotGood ? '[   ] Good   [ X ] Not Good' : '[   ] Good   [   ] Not Good',
    item.remarks || '',
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    theme: 'grid',
    styles: { fontSize: 5.8, cellPadding: 0.8 },
    headStyles: { fillColor: [220, 230, 242], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 85 },
      2: { cellWidth: 52 },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 20 },
    },
    head: [['No', 'Activity', 'Parameter', 'Condition', 'Remarks']],
    body: inspectionRows,
  });

  // Section: Cleaning Generator
  currentY = (doc as any).lastAutoTable.finalY + 3;
  doc.setFillColor(0, 102, 204);
  doc.rect(10, currentY, 190, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Cleaning Generator', 12, currentY + 3);

  const cleaningRows = reportData.cleaning.map(item => [
    item.no,
    item.activity,
    item.parameter,
    item.isGood ? '[ X ] Good   [   ] Not Good' : item.isNotGood ? '[   ] Good   [ X ] Not Good' : '[   ] Good   [   ] Not Good',
    item.remarks || '',
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    theme: 'grid',
    styles: { fontSize: 5.8, cellPadding: 0.8 },
    headStyles: { fillColor: [220, 230, 242], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 85 },
      2: { cellWidth: 52 },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 20 },
    },
    head: [['No', 'Activity', 'Parameter', 'Condition', 'Remarks']],
    body: cleaningRows,
  });

  // PAGE 2
  doc.addPage();
  drawHeader(2);

  // Section: Measurements
  currentY = 18;
  doc.setFillColor(0, 102, 204);
  doc.rect(10, currentY, 190, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Measurements & Testing', 12, currentY + 3);

  autoTable(doc, {
    startY: currentY + 4,
    theme: 'grid',
    styles: { fontSize: 5.8, cellPadding: 0.8 },
    headStyles: { fillColor: [220, 230, 242], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 85 },
      2: { cellWidth: 52 },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 20 },
    },
    head: [['No', 'Activity', 'Parameter', 'Condition', 'Remarks']],
    body: [
      ['a.', 'Measuring Output Voltage, Output Current, Power Consumption', 'Voltage phase 380V, +5% -10%, Current ±10%', reportData.measurement.outputVC.isGood ? '[ X ] Good  [   ] Not Good' : '[   ] Good  [   ] Not Good', reportData.measurement.outputVC.remarks || ''],
      ['b.', 'Measuring voltage DC battery (>12 VDC)', '> 12 VDC', reportData.measurement.dcBattery.isGood ? '[ X ] Good  [   ] Not Good' : '[   ] Good  [   ] Not Good', reportData.measurement.dcBattery.remarks || ''],
      ['c.', 'Measuring torque nut connection', 'Following torque table guidance', reportData.measurement.torqueNut.isGood ? '[ X ] Good  [   ] Not Good' : '[   ] Good  [   ] Not Good', reportData.measurement.torqueNut.remarks || ''],
      ['d.', 'Measuring voltage DC alternator', 'Output voltage range +5% -10% (12V DC)', reportData.measurement.dcAlternator.isGood ? '[ X ] Good  [   ] Not Good' : '[   ] Good  [   ] Not Good', reportData.measurement.dcAlternator.remarks || ''],
      ['e.', 'Measuring Grounding Resistance', 'Grounding resistance < 5 Ω', reportData.measurement.grounding.isGood ? '[ X ] Good  [   ] Not Good' : '[   ] Good  [   ] Not Good', reportData.measurement.grounding.remarks || ''],
      ['f.', 'Measuring battery impedance using battery tester', 'VRLA 3-6 mΩ per cell (2V)', reportData.measurement.batteryImpedance.isGood ? '[ X ] Good  [   ] Not Good' : '[   ] Good  [   ] Not Good', reportData.measurement.batteryImpedance.remarks || ''],
      ['g.', 'Noise / Sound Level Measurement', '85 - 100 dBA', reportData.measurement.noise.isGood ? '[ X ] Good  [   ] Not Good' : '[   ] Good  [   ] Not Good', reportData.measurement.noise.remarks || ''],
      ['h.', 'Measuring Vibration', '1500-3000 rpm. Normal limit <= 7.1 mm/s', reportData.measurement.vibration.isGood ? '[ X ] Good  [   ] Not Good' : '[   ] Good  [   ] Not Good', reportData.measurement.vibration.remarks || ''],
      ['i.', 'Measuring Coolant contaminant', 'pH Level: 7.5 - 11', reportData.measurement.coolant.isGood ? '[ X ] Good  [   ] Not Good' : '[   ] Good  [   ] Not Good', reportData.measurement.coolant.remarks || ''],
    ],
  });

  // Section: Testing
  currentY = (doc as any).lastAutoTable.finalY + 3;
  doc.setFillColor(0, 102, 204);
  doc.rect(10, currentY, 190, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Testing', 12, currentY + 3);

  autoTable(doc, {
    startY: currentY + 4,
    theme: 'grid',
    styles: { fontSize: 5.8, cellPadding: 0.8 },
    headStyles: { fillColor: [220, 230, 242], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 85 },
      2: { cellWidth: 52 },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 20 },
    },
    head: [['No', 'Activity', 'Parameter', 'Condition', 'Remarks']],
    body: [
      ['a.', 'Check function emergency button', 'Emergency button able to stop generator operation', reportData.testing.emergencyButton.isGood ? '[ X ] Good  [   ] Not Good' : '[   ] Good  [   ] Not Good', reportData.testing.emergencyButton.remarks || ''],
      ['b.', 'Record parameter value in APM / AMF engine generator', 'All parameters in APM recorded and acceptable value', reportData.testing.apmAmf.isGood ? '[ X ] Good  [   ] Not Good' : '[   ] Good  [   ] Not Good', reportData.testing.apmAmf.remarks || ''],
      ['c.', 'Checking engine temperature, exhaust gas color, phase rotation', 'Engine Temp 75-85°C, Exhaust Colorless, Phase ABC', reportData.testing.engineCheck.isGood ? '[ X ] Good  [   ] Not Good' : '[   ] Good  [   ] Not Good', reportData.testing.engineCheck.remarks || ''],
    ],
  });

  // Section: Analysis & Remark
  currentY = (doc as any).lastAutoTable.finalY + 3;
  doc.setFillColor(0, 102, 204);
  doc.rect(10, currentY, 190, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Analysis / Remark', 12, currentY + 3);

  autoTable(doc, {
    startY: currentY + 4,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1 },
    body: [
      [`${reportData.analysis.isNormal ? '[ X ]' : '[   ]'} Normal operation`, `Remark:\n${reportData.analysis.remarkText || 'Genset beroperasi normal.'}`],
      ['Fault symptom', reportData.analysis.faultSymptom || '-'],
      ['Fault analysis', reportData.analysis.faultAnalysis || '-'],
      ['Work done / action taken', reportData.analysis.workDone || '-'],
      [`Fault Part SN: ${reportData.analysis.faultPartSN || '-'}`, `Fault Part Name: ${reportData.analysis.faultPartName || '-'}`],
    ],
  });

  // Section: Time Spent
  currentY = (doc as any).lastAutoTable.finalY + 3;
  doc.setFillColor(0, 102, 204);
  doc.rect(10, currentY, 190, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TIME SPENT', 12, currentY + 3);

  autoTable(doc, {
    startY: currentY + 4,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1, halign: 'center' },
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
    head: [['Date', 'Departure', 'Start', 'Finish']],
    body: [[timeSpent.date || '-', timeSpent.departure || '-', timeSpent.start || '-', timeSpent.finish || '-']],
  });

  // Signature Block
  currentY = (doc as any).lastAutoTable.finalY + 4;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('CUSTOMER ACKNOWLEDGEMENT:', 105, currentY, { align: 'center' });

  autoTable(doc, {
    startY: currentY + 2,
    theme: 'plain',
    styles: { fontSize: 6.5, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 63 },
      1: { cellWidth: 64 },
      2: { cellWidth: 63 },
    },
    body: [
      ['Prepared', 'Checked', 'Approved'],
      ['\n\n\n', '\n\n\n', '\n\n\n'],
      ['Engineer', 'SM / PM', 'Client / Owner'],
    ],
  });

  // Save PDF
  doc.save(`Service_Report_GENSET_${customerInfo.companyName.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
}
