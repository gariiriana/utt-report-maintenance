import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DoorCustomerInfo,
  DoorReportData,
  DoorTimeSpent,
} from '@/types/doorReportTypes';
import { loadLogoBase64 } from '@/utils/ReportPdfExport';
import logoDwimitraUrl from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDCUrl from '@/assets/logo_neutradc.png';

interface ReportPhoto {
  photoBase64?: string;
  description?: string;
}

export async function generateDoorReportPDF(
  customerInfo: DoorCustomerInfo,
  reportData: DoorReportData,
  timeSpent: DoorTimeSpent,
  photos: ReportPhoto[] = []
): Promise<void> {
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
  doc.text('SERVICE REPORT DOOR', pageWidth / 2, currentY + 4, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
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

  // Customer Info Table Grid
  const custTableData = [
    [
      { content: 'Company name :', styles: { fontStyle: 'bold' as const } },
      customerInfo.companyName || 'NeutraDC Cikarang',
      { content: 'Type :', styles: { fontStyle: 'bold' as const } },
      customerInfo.type || '-',
      { content: 'Specification :', styles: { fontStyle: 'bold' as const } },
      customerInfo.specification || '-',
      { content: 'MOP No. :', styles: { fontStyle: 'bold' as const } },
      customerInfo.mopNo || '-',
    ],
    [
      { content: 'Equipment Name :', styles: { fontStyle: 'bold' as const } },
      customerInfo.equipmentName || 'DOOR',
      { content: 'Serial No. :', styles: { fontStyle: 'bold' as const } },
      customerInfo.serialNo || '-',
      { content: 'Quarter :', styles: { fontStyle: 'bold' as const } },
      customerInfo.quarter || '-',
      '',
      '',
    ],
    [
      { content: 'CI Description :', styles: { fontStyle: 'bold' as const } },
      customerInfo.ciDescription || 'ROLLING DOOR',
      { content: 'Product Name :', styles: { fontStyle: 'bold' as const } },
      customerInfo.productName || '-',
      { content: 'Location :', styles: { fontStyle: 'bold' as const } },
      customerInfo.location || '-',
      { content: 'Date :', styles: { fontStyle: 'bold' as const } },
      customerInfo.date || timeSpent.date || '-',
    ],
    [
      { content: 'CI Name :', styles: { fontStyle: 'bold' as const } },
      customerInfo.ciName || 'Lobby Door Office',
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

  // Section: Visual Inspection & Maintenance (10 Items)
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
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Activity', 'Parameter', 'Condition']],
    body: visualBody,
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 6 },
    styles: { fontSize: 5.5, cellPadding: 1, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 95 },
      2: { cellWidth: 65 },
      3: { cellWidth: 20, halign: 'center' },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 2;

  // Section: Cleaning & Maintenance (5 Items)
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, currentY, contentWidth, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Cleaning & Maintenance   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 3.2);
  currentY += 4.5;

  const cleaningBody = reportData.cleaning.map((c) => [
    c.no,
    c.activity,
    c.parameter,
    c.isGood ? '√ Good' : c.isNotGood ? '× Not Good' : 'N/A',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Activity', 'Parameter', 'Condition']],
    body: cleaningBody,
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 6 },
    styles: { fontSize: 5.5, cellPadding: 1, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 95 },
      2: { cellWidth: 65 },
      3: { cellWidth: 20, halign: 'center' },
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
    ],
    [
      `S-T: ${reportData.voltageAmpere.voltageST || '-'} V`,
      `S-N: ${reportData.voltageAmpere.voltageSN || '-'} V`,
      `S: ${reportData.voltageAmpere.ampereS || '-'} A`,
      '',
    ],
    [
      `T-R: ${reportData.voltageAmpere.voltageTR || '-'} V`,
      `T-N: ${reportData.voltageAmpere.voltageTN || '-'} V`,
      `T: ${reportData.voltageAmpere.ampereT || '-'} A`,
      '',
    ],
    [
      '',
      `N-G: ${reportData.voltageAmpere.voltageNG || '-'} V`,
      `N: ${reportData.voltageAmpere.ampereN || '-'} A`,
      '',
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Wire Result (Voltage)', 'Wire Result (Voltage)', 'Wire Result (Ampere)', 'Standard']],
    body: vaData,
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 6 },
    styles: { fontSize: 5.5, cellPadding: 1, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 45 },
      2: { cellWidth: 45 },
      3: { cellWidth: 55 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 2;

  // Section: Noise/Sound Level Measurement
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, currentY, contentWidth, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Noise/Sound Level Measurement   Please mark OK ( √ ), not OK ( × ), not applicable (N/A) in the box', margin + 2, currentY + 3.2);
  currentY += 4.5;

  autoTable(doc, {
    startY: currentY,
    head: [['Wire', 'Result dB(A)', 'Standard', 'Remarks']],
    body: [['Unit', reportData.noise.unitResult || '-', reportData.noise.standard, reportData.noise.remarks || '-']],
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
    head: [['Wire', 'Result (Ω)', 'Standard', 'Remarks']],
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
    ['Normal operation', `Remark : ${reportData.analysis.remark || 'Pintu Rolling Door beroperasi normal dan dalam kondisi baik.'}`],
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
    doc.text('DOCUMENTATION PHOTOS — DOOR', margin, photoY + 4);
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
        doc.text(p.description || 'Dokumentasi Door', xPos, photoY + imgH + 3.5, { maxWidth: colW });
      } catch (err) {
        console.error('Error adding photo to Door PDF', err);
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
  const filename = `Service_Report_Door_${customerInfo.companyName.replace(/\s+/g, '_')}_${timeSpent.date || 'draft'}.pdf`;
  doc.save(filename);
}
