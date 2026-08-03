import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BusductCustomerInfo, BusductReportData, BusductTimeSpent } from '@/types/busductReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { compressBase64Image } from '@/utils/imageCompression';
import { toast } from 'sonner';

const HEADER_BLUE: [number, number, number] = [0, 89, 156];

async function loadImageBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Generate PDF Service Report Panel Busduct (NeutraDC Cikarang)
 */
export async function generateBusductReportPDF(
  customerInfo: BusductCustomerInfo,
  reportData: BusductReportData,
  timeSpent: BusductTimeSpent,
  originalReportCards?: Array<{ photoBase64?: string; description: string }>
) {
  let optimizedCards = originalReportCards || [];
  if (originalReportCards && originalReportCards.length > 0) {
    toast.loading('Compressing documentation photos...', { id: 'pdf-busduct-compress' });
    optimizedCards = await Promise.all(
      originalReportCards.map(async (c) => {
        if (!c.photoBase64) return c;
        try {
          const compressed = await compressBase64Image(c.photoBase64, { maxWidth: 800, quality: 0.5 });
          return { ...c, photoBase64: compressed };
        } catch (err) {
          console.error('Failed to compress Busduct photo for PDF', err);
          return c;
        }
      })
    );
    toast.dismiss('pdf-busduct-compress');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 8;
  const contentW = pageW - 2 * margin;
  let y = margin;

  // Header Logos
  try {
    const dwiLogo = await loadImageBase64(logoDwimitra);
    const ndcLogo = await loadImageBase64(logoNeutraDC);
    doc.addImage(dwiLogo, 'PNG', margin, y, 32, 12);
    doc.addImage(ndcLogo, 'PNG', pageW - margin - 22, y, 22, 12);
  } catch (e) {
    console.warn('Could not load company logos for Busduct PDF', e);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SERVICE REPORT PANEL BUSDUCT', pageW / 2, y + 4, { align: 'center' });
  doc.setFontSize(8);
  doc.text('PT. DWI MITRA EKATAMA MANDIRI', pageW / 2, y + 8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('JL. Alaydrus, 45-45-B, Jakarta, 10130 (021) 6332316', pageW / 2, y + 11.5, { align: 'center' });

  y += 14;

  // Customer Info Section
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    theme: 'plain',
    styles: { fontSize: 6.5, cellPadding: 0.8, font: 'helvetica' },
    head: [[{ content: 'Customer', colSpan: 6, styles: { fillColor: HEADER_BLUE, textColor: 255, fontStyle: 'bold' } }]],
    body: [
      ['Company name', `: ${customerInfo.companyName}`, 'Type', `: ${customerInfo.type}`, 'MOP No.', `: ${customerInfo.mopNo}`],
      ['Equipment Name', `: ${customerInfo.equipmentName}`, 'Serial No.', `: ${customerInfo.serialNo}`, 'Quarter', `: ${customerInfo.quarter}`],
      ['CI Description', `: ${customerInfo.ciDescription}`, 'Product Name', `: ${customerInfo.productName}`, 'Location', `: ${customerInfo.location}`],
      ['CI Name', `: ${customerInfo.ciName}`, 'Prod.Year', `: ${customerInfo.prodYear}`, 'Date', `: ${customerInfo.date}`],
      ['Area', `: ${customerInfo.area}`, 'Engineer', `: ${customerInfo.engineer}`, '', ''],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 2;

  // Visual Inspection Table
  const visualRows = (reportData.visualInspection || []).map((item) => [
    item.no,
    item.activity,
    item.parameter,
    item.isGood ? '✓' : '',
    item.isNotGood ? '✗' : '',
    item.remarks || '',
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.8, font: 'helvetica' },
    headStyles: { fillColor: HEADER_BLUE, textColor: 255, fontStyle: 'bold', halign: 'center' },
    head: [
      [{ content: 'Visual inspection & Maintenance  Please mark OK (✓), not OK (✗), not applicable (N/A) in the box', colSpan: 6, styles: { halign: 'left' } }],
      ['No', 'Activity', 'Parameter', 'Good', 'Not Good', 'Remarks'],
    ],
    body: visualRows,
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 65 },
      2: { cellWidth: 60 },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 'auto' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 2;

  // Cleaning Table
  const cleaningRows = (reportData.cleaning || []).map((item) => [
    item.no,
    item.activity,
    item.parameter,
    item.isGood ? '✓' : '',
    item.isNotGood ? '✗' : '',
    item.remarks || '',
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.8, font: 'helvetica' },
    headStyles: { fillColor: HEADER_BLUE, textColor: 255, fontStyle: 'bold', halign: 'center' },
    head: [
      [{ content: 'Cleaning & Maintenance  Please mark OK (✓), not OK (✗), not applicable (N/A) in the box', colSpan: 6, styles: { halign: 'left' } }],
      ['No', 'Activity', 'Parameter', 'Good', 'Not Good', 'Remarks'],
    ],
    body: cleaningRows,
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 65 },
      2: { cellWidth: 60 },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 'auto' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 2;

  // Thermal Measurement Table
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.8, font: 'helvetica' },
    headStyles: { fillColor: HEADER_BLUE, textColor: 255, fontStyle: 'bold', halign: 'center' },
    head: [
      [{ content: 'Thermal Measurement  Please mark OK (✓), not OK (✗), not applicable (N/A) in the box', colSpan: 4, styles: { halign: 'left' } }],
      ['Breaker / Joint', 'Result Temperature Joint (°C)', 'Standard', 'Remarks'],
    ],
    body: [
      [reportData.thermal?.breaker || 'Joint Busduct', reportData.thermal?.resultTemp || '32.5', reportData.thermal?.standard || '<40°C', reportData.thermal?.remarks || 'Suhu normal'],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 2;

  // Analysis / Remark Table
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 1, font: 'helvetica' },
    headStyles: { fillColor: HEADER_BLUE, textColor: 255, fontStyle: 'bold' },
    head: [[{ content: 'Analysis / Remark', colSpan: 3 }]],
    body: [
      ['Normal operation', 'Remark :', reportData.analysis?.remark || 'Operasi normal'],
      ['Abnormal operation', 'Fault symptom', reportData.analysis?.faultSymptom || 'N/A'],
      ['', 'Fault analysis', reportData.analysis?.faultAnalysis || 'N/A'],
      ['', 'Work done / action taken', reportData.analysis?.workDone || 'N/A'],
      ['', 'Fault Part SN', reportData.analysis?.faultPartSN || 'N/A'],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 2;

  // Time Spent Table
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6, cellPadding: 0.8, font: 'helvetica', halign: 'center' },
    headStyles: { fillColor: HEADER_BLUE, textColor: 255, fontStyle: 'bold' },
    head: [
      [{ content: 'Time Spent', colSpan: 4, styles: { halign: 'left' } }],
      ['Date', 'Departure', 'Start', 'Finish'],
    ],
    body: [[timeSpent.date, timeSpent.departure, timeSpent.start, timeSpent.finish]],
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Signatures Section
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: { fontSize: 6.5, cellPadding: 1, font: 'helvetica', halign: 'center' },
    head: [[{ content: 'CUSTOMER ACKNOWLEDGEMENT:', colSpan: 3, styles: { fontStyle: 'bold', halign: 'center' } }]],
    body: [
      ['Prepared', 'Checked', 'Approved'],
      ['\n\n\n___________________\nEngineer', '\n\n\n___________________\nSM/PM', '\n\n\n___________________\nClient / Owner'],
    ],
  });

  // Documentation Photo Page if available
  if (optimizedCards.length > 0) {
    doc.addPage();
    let photoY = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DOCUMENTATION PHOTOS — PANEL BUSDUCT', margin, photoY + 4);
    photoY += 8;

    let col = 0;
    const colW = (contentW - 6) / 2;
    const imgH = 45;

    for (const card of optimizedCards) {
      if (!card.photoBase64) continue;
      const xPos = margin + col * (colW + 6);
      try {
        doc.addImage(card.photoBase64, 'JPEG', xPos, photoY, colW, imgH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text(card.description || 'Busduct documentation', xPos, photoY + imgH + 3, { maxWidth: colW });
      } catch (err) {
        console.error('Error adding photo card to PDF', err);
      }

      col++;
      if (col > 1) {
        col = 0;
        photoY += imgH + 10;
        if (photoY + imgH > 280) {
          doc.addPage();
          photoY = margin;
        }
      }
    }
  }

  doc.save(`Service_Report_BUSDUCT_${customerInfo.serialNo}_${customerInfo.date}.pdf`);
}
