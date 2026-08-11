import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  LdbrdbCustomerInfo,
  LdbrdbReportData,
  LdbrdbTimeSpent,
} from '@/types/ldbrdbReportTypes';
import { loadLogoBase64 } from '@/utils/ReportPdfExport';
import logoDwimitraUrl from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDCUrl from '@/assets/logo_neutradc.png';

interface ReportPhoto {
  photoBase64?: string;
  description?: string;
}

export async function generateLdbrdbReportPDF(
  customerInfo: LdbrdbCustomerInfo,
  reportData: LdbrdbReportData,
  timeSpent: LdbrdbTimeSpent,
  photos: ReportPhoto[] = [],
  saveToFile: boolean = true
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190
  let currentY = margin;

  // Header Logos
  try {
    const dwimitraLogo = await loadLogoBase64(logoDwimitraUrl);
    const neutradcLogo = await loadLogoBase64(logoNeutraDCUrl);
    if (dwimitraLogo) {
      doc.addImage(dwimitraLogo, 'PNG', margin, currentY, 32, 12);
    }
    if (neutradcLogo) {
      doc.addImage(neutradcLogo, 'PNG', pageWidth - margin - 28, currentY, 28, 12);
    }
  } catch (e) {
    console.warn('Logo loading warning:', e);
  }

  // Title Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('SERVICE REPORT PANEL LDB & RDB', pageWidth / 2, currentY + 4, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('PT. DWI MITRA EKATAMA MANDIRI', pageWidth / 2, currentY + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('JL. Alaydrus, 45-45-B, Jakarta, 10130 (021) 6332316', pageWidth / 2, currentY + 11.5, { align: 'center' });

  currentY += 15;

  // Section Header: Customer Info
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, currentY, contentWidth, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Customer', margin + 2, currentY + 3.2);
  currentY += 4.5;

  // Customer Info Grid Table
  const custTableData = [
    [
      { content: 'Company name :', styles: { fontStyle: 'bold' as const } },
      customerInfo.companyName || 'NeutraDC Cikarang',
      { content: 'Type :', styles: { fontStyle: 'bold' as const } },
      customerInfo.type || '-',
      { content: 'Specification :', styles: { fontStyle: 'bold' as const } },
      customerInfo.specification || '-',
      { content: 'MOP No. :', styles: { fontStyle: 'bold' as const } },
      customerInfo.mopNo || 'DME-TDE/MOP/BDT/02 0806/26',
    ],
    [
      { content: 'Equipment Name :', styles: { fontStyle: 'bold' as const } },
      customerInfo.equipmentName || 'Panel LDB & RDB',
      { content: 'Serial No. :', styles: { fontStyle: 'bold' as const } },
      customerInfo.serialNo || '-',
      { content: 'Quarter :', styles: { fontStyle: 'bold' as const } },
      customerInfo.quarter || 'Q2',
      '',
      '',
    ],
    [
      { content: 'CI Description :', styles: { fontStyle: 'bold' as const } },
      customerInfo.ciDescription || 'Panel Utility',
      { content: 'Product Name :', styles: { fontStyle: 'bold' as const } },
      customerInfo.productName || '-',
      { content: 'Location :', styles: { fontStyle: 'bold' as const } },
      customerInfo.location || '-',
      { content: 'Date :', styles: { fontStyle: 'bold' as const } },
      customerInfo.date || timeSpent.date || '-',
    ],
    [
      { content: 'CI Name :', styles: { fontStyle: 'bold' as const } },
      customerInfo.ciName || '-',
      { content: 'Prod.Year :', styles: { fontStyle: 'bold' as const } },
      customerInfo.productYears || '-',
      { content: 'Area :', styles: { fontStyle: 'bold' as const } },
      customerInfo.area || '-',
      { content: 'Engineer :', styles: { fontStyle: 'bold' as const } },
      customerInfo.engineer || '-',
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    body: custTableData,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 28 },
      2: { cellWidth: 18 },
      3: { cellWidth: 22 },
      4: { cellWidth: 20 },
      5: { cellWidth: 26 },
      6: { cellWidth: 18 },
      7: { cellWidth: 32 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 2;

  // Section: Visual Inspection & Maintenance (11 Items)
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, currentY, contentWidth, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Visual inspection & Maintenance   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 3.2);
  currentY += 4.5;

  const visualBody = reportData.visualInspection.map((v) => [
    v.no,
    v.activity,
    v.parameter,
    v.isGood ? '√ Good' : v.isNotGood ? '× Not Good' : 'N/A',
    v.remarks || '',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Activity', 'Parameter', 'Condition', 'Remarks']],
    body: visualBody,
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 6 },
    styles: { fontSize: 5.5, cellPadding: 1, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 55 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 2;

  // Section: Digital Power Meter Recording
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, currentY, contentWidth, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Digital Power Meter Recording   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 3.2);
  currentY += 4.5;

  const dpmData = [
    [
      `R-S: ${reportData.dpmRecording.voltageRS || '-'} V`,
      `R-N: ${reportData.dpmRecording.voltageRN || '-'} V`,
      `KW: ${reportData.dpmRecording.kw || '-'}`,
      `R: ${reportData.dpmRecording.ampereR || '-'} A`,
      reportData.dpmRecording.remarks || '-',
    ],
    [
      `S-T: ${reportData.dpmRecording.voltageST || '-'} V`,
      `S-N: ${reportData.dpmRecording.voltageSN || '-'} V`,
      `KVAR: ${reportData.dpmRecording.kvar || '-'}`,
      `S: ${reportData.dpmRecording.ampereS || '-'} A`,
      '',
    ],
    [
      `T-R: ${reportData.dpmRecording.voltageTR || '-'} V`,
      `T-N: ${reportData.dpmRecording.voltageTN || '-'} V`,
      `KVA: ${reportData.dpmRecording.kva || '-'}`,
      `T: ${reportData.dpmRecording.ampereT || '-'} A`,
      '',
    ],
    [
      '',
      '',
      `Cos p: ${reportData.dpmRecording.cosp || '-'}`,
      '',
      '',
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Wire Result (Voltage)', 'Wire Result (Voltage)', 'Wire Result', 'Wire Result (Ampere)', 'Remarks']],
    body: dpmData,
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 6 },
    styles: { fontSize: 5.5, cellPadding: 1, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 45 },
      4: { cellWidth: 40 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 2;

  // Section: Voltage & Ampere Measurement
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, currentY, contentWidth, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Voltage & Ampere Measurement   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 3.2);
  currentY += 4.5;

  const vaData = [
    [
      `R-S: ${reportData.voltageAmpere.voltageRS || '-'} V`,
      `R-N: ${reportData.voltageAmpere.voltageRN || '-'} V`,
      `R: ${reportData.voltageAmpere.ampereR || '-'} A`,
      reportData.voltageAmpere.standard,
      reportData.voltageAmpere.remarks || '-',
    ],
    [
      `S-T: ${reportData.voltageAmpere.voltageST || '-'} V`,
      `S-N: ${reportData.voltageAmpere.voltageSN || '-'} V`,
      `S: ${reportData.voltageAmpere.ampereS || '-'} A`,
      '',
      '',
    ],
    [
      `T-R: ${reportData.voltageAmpere.voltageTR || '-'} V`,
      `T-N: ${reportData.voltageAmpere.voltageTN || '-'} V`,
      `T: ${reportData.voltageAmpere.ampereT || '-'} A`,
      '',
      '',
    ],
    [
      '',
      `N-G: ${reportData.voltageAmpere.voltageNG || '-'} V`,
      `N: ${reportData.voltageAmpere.ampereN || '-'} A`,
      '',
      '',
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Wire Result (Voltage)', 'Wire Result (Voltage)', 'Wire Result (Ampere)', 'Standard', 'Remarks']],
    body: vaData,
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 6 },
    styles: { fontSize: 5.5, cellPadding: 1, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 45 },
      4: { cellWidth: 40 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 2;

  // Section: Thermal Measurement
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, currentY, contentWidth, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Thermal Measurement   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 3.2);
  currentY += 4.5;

  autoTable(doc, {
    startY: currentY,
    head: [['Breaker', 'Result Temperature (°C)', 'Standard', 'Remarks']],
    body: [['Breaker', reportData.thermal.breakerResult || '-', reportData.thermal.standard, reportData.thermal.remarks || '-']],
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 6 },
    styles: { fontSize: 5.5, cellPadding: 1, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold' },
      1: { cellWidth: 45 },
      2: { cellWidth: 55 },
      3: { cellWidth: 55 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 2;

  // Section: Grounding Resistance Measurement
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, currentY, contentWidth, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Grounding Resistance Measurement   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 3.2);
  currentY += 4.5;

  autoTable(doc, {
    startY: currentY,
    head: [['Wire', 'Result (Ω)', 'Standard', 'Remarks']],
    body: [['Grounding', reportData.grounding.groundingResult || '-', reportData.grounding.standard, reportData.grounding.remarks || '-']],
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 6 },
    styles: { fontSize: 5.5, cellPadding: 1, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold' },
      1: { cellWidth: 45 },
      2: { cellWidth: 55 },
      3: { cellWidth: 55 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 2;

  // Section: Analysis / Remark
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, currentY, contentWidth, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Analysis / Remark', margin + 2, currentY + 3.2);
  currentY += 4.5;

  const analysisBody = [
    ['Normal operation', `Remark : ${reportData.analysis.remark || 'Panel LDB & RDB beroperasi normal.'}`],
    ['Abnormal operation', `Fault symptom: ${reportData.analysis.faultSymptom || '-'}\nFault analysis: ${reportData.analysis.faultAnalysis || '-'}\nWork done/action taken: ${reportData.analysis.workDone || '-'}\nFault Part SN: ${reportData.analysis.faultPartSN || '-'}`],
  ];

  autoTable(doc, {
    startY: currentY,
    body: analysisBody,
    theme: 'grid',
    styles: { fontSize: 5.5, cellPadding: 1.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 150 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 2;

  // Section: Time Spent
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, currentY, contentWidth, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Time Spent', margin + 2, currentY + 3.2);
  currentY += 4.5;

  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Departure', 'Start', 'Finish']],
    body: [[timeSpent.date || '-', timeSpent.departure || '-', timeSpent.start || '-', timeSpent.finish || '-']],
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 6, halign: 'center' },
    styles: { fontSize: 6, cellPadding: 1.5, halign: 'center', textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 47.5 },
      1: { cellWidth: 47.5 },
      2: { cellWidth: 47.5 },
      3: { cellWidth: 47.5 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Signatures / Customer Acknowledgement
  if (currentY + 25 > pageHeight) {
    doc.addPage();
    currentY = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text('CUSTOMER ACKNOWLEDGEMENT:', margin, currentY);

  currentY += 4;
  const sigBoxW = contentWidth / 3;
  autoTable(doc, {
    startY: currentY,
    head: [['Prepared', 'Checked', 'Approved']],
    body: [
      ['\n\n\n________________________\nEngineer', '\n\n\n________________________\nSM / PM', '\n\n\n________________________\nClient / Owner'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 6, halign: 'center' },
    styles: { fontSize: 5.5, cellPadding: 2, halign: 'center', textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: sigBoxW },
      1: { cellWidth: sigBoxW },
      2: { cellWidth: sigBoxW },
    },
    margin: { left: margin, right: margin },
  });

  // Documentation Photo Pages
  const validPhotos = photos.filter((p) => p.photoBase64);
  if (validPhotos.length > 0) {
    doc.addPage();
    let photoY = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('DOCUMENTATION PHOTOS — PANEL LDB & RDB', margin, photoY + 4);
    photoY += 8;

    let col = 0;
    const colW = (contentWidth - 6) / 2;
    const imgH = 48;

    for (const p of validPhotos) {
      if (!p.photoBase64) continue;
      const xPos = margin + col * (colW + 6);
      try {
        const format = p.photoBase64.includes('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(p.photoBase64, format, xPos, photoY, colW, imgH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(30, 41, 59);
        doc.text(p.description || 'Dokumentasi Panel LDB & RDB', xPos, photoY + imgH + 3.5, { maxWidth: colW });
      } catch (err) {
        console.error('Error adding photo to LDB/RDB PDF', err);
      }

      col++;
      if (col > 1) {
        col = 0;
        photoY += imgH + 12;
        if (photoY + imgH + 10 > pageHeight - margin) {
          doc.addPage();
          photoY = margin;
        }
      }
    }
  }

  // Save PDF
  const filename = `Service_Report_Panel_LDB_RDB_${customerInfo.companyName.replace(/\s+/g, '_')}_${timeSpent.date || 'draft'}.pdf`;
  if (saveToFile) {
    doc.save(filename);
  }
  return { doc, filename, blob: doc.output('blob') };
}
