import { jsPDF } from 'jspdf';
import { PDUCustomerInfo, PDUReportData, PDUTimeSpent } from '@/types/pduReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { toEnglishText } from '@/utils/translator';

// Color Constants
const HEADER_DARK: [number, number, number] = [30, 40, 55];
const BORDER_GRAY: [number, number, number] = [200, 200, 200];
const DARK_TEXT: [number, number, number] = [30, 30, 30];
const GRAY_TEXT: [number, number, number] = [100, 100, 100];

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

export async function generatePDUServiceReportPDF(
  customerInfo: PDUCustomerInfo,
  reportData: PDUReportData,
  timeSpent: PDUTimeSpent,
  photosData: Array<{ id: string; photoBase64?: string; description?: string }> = []
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth(); // 210
  const margin = 10;
  const contentW = pageW - margin * 2; // 190
  let y = margin;

  // Load logos
  const [logoLeftB64, logoRightB64] = await Promise.all([
    loadLogoBase64(logoDwimitra),
    loadLogoBase64(logoNeutraDC),
  ]);

  // ─── HEADER ────────────────────────────────────────────────────────
  if (logoLeftB64) {
    try { doc.addImage(logoLeftB64, 'PNG', margin, y, 32, 16); } catch (e) { console.error(e); }
  }

  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...HEADER_DARK);
  doc.text('SERVICE REPORT PANEL PDU', pageW / 2, y + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(0, 0, 0);
  doc.text('PT. DWI MITRA EKATAMA MANDIRI', pageW / 2, y + 10, { align: 'center' });

  doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...GRAY_TEXT);
  doc.text('JL. Alaydrus, 45-45-B, Jakarta, 10130 (021) 6332316', pageW / 2, y + 14, { align: 'center' });

  if (logoRightB64) {
    try { doc.addImage(logoRightB64, 'PNG', pageW - margin - 32, y, 32, 16); } catch (e) { console.error(e); }
  }

  y += 18;

  // ─── CUSTOMER TABLE ────────────────────────────────────────────────
  doc.setFillColor(...HEADER_DARK);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(255, 255, 255);
  doc.text('Customer', margin + 3, y + 3.5);
  y += 5;

  const custRowH = 4.5;
  const colW = contentW / 4; // 47.5

  const drawCustRow = (label1: string, val1: string, label2: string, val2: string, label3: string, val3: string, label4: string, val4: string) => {
    doc.setDrawColor(...BORDER_GRAY).setLineWidth(0.2);
    doc.rect(margin, y, contentW, custRowH);

    // Col 1
    doc.line(margin + colW * 0.45, y, margin + colW * 0.45, y + custRowH);
    doc.line(margin + colW, y, margin + colW, y + custRowH);
    // Col 2
    doc.line(margin + colW * 1.45, y, margin + colW * 1.45, y + custRowH);
    doc.line(margin + colW * 2, y, margin + colW * 2, y + custRowH);
    // Col 3
    doc.line(margin + colW * 2.45, y, margin + colW * 2.45, y + custRowH);
    doc.line(margin + colW * 3, y, margin + colW * 3, y + custRowH);
    // Col 4
    doc.line(margin + colW * 3.45, y, margin + colW * 3.45, y + custRowH);

    doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...DARK_TEXT);
    doc.text(label1, margin + 1.5, y + 3);
    doc.text(val1 || '', margin + colW * 0.45 + 1.5, y + 3);

    doc.text(label2, margin + colW + 1.5, y + 3);
    doc.text(val2 || '', margin + colW * 1.45 + 1.5, y + 3);

    doc.text(label3, margin + colW * 2 + 1.5, y + 3);
    doc.text(val3 || '', margin + colW * 2.45 + 1.5, y + 3);

    doc.text(label4, margin + colW * 3 + 1.5, y + 3);
    doc.text(val4 || '', margin + colW * 3.45 + 1.5, y + 3);

    y += custRowH;
  };

  drawCustRow('Company name', customerInfo.companyName, 'Type', customerInfo.type, 'Specification', customerInfo.specification, 'MOP No.', customerInfo.mopNo);
  drawCustRow('Equipment Name', customerInfo.equipmentName, 'Serial No.', customerInfo.serialNo, 'Quarter', customerInfo.quarter, 'Date', customerInfo.date);
  drawCustRow('CI Description', customerInfo.ciDescription, 'Product Name', customerInfo.productName, 'Location', customerInfo.location, 'CI Name', customerInfo.ciName);
  drawCustRow('Prod.Year', customerInfo.prodYear, 'Area', customerInfo.area, 'Engineer', customerInfo.engineerTechnician, '', '');

  y += 2;

  // ─── SECTION 1: INSPECTION / CHECKING ──────────────────────────────
  doc.setFillColor(...HEADER_DARK);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(255, 255, 255);
  doc.text('Inspection / Checking', margin + 3, y + 3.5);
  y += 5;

  const inspHeadH = 5;
  doc.setFillColor(240, 243, 246);
  doc.rect(margin, y, contentW, inspHeadH, 'F');
  doc.setDrawColor(...BORDER_GRAY).setLineWidth(0.2);
  doc.rect(margin, y, contentW, inspHeadH);

  const cNo = 10;
  const cAct = 95;
  const cParam = 45;
  const cCond = 20;

  let xPos = margin;
  doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(...DARK_TEXT);
  doc.text('No', xPos + cNo / 2, y + 3.5, { align: 'center' }); xPos += cNo;
  doc.text('Activity', xPos + 2, y + 3.5); xPos += cAct;
  doc.text('Parameter', xPos + 2, y + 3.5); xPos += cParam;
  doc.text('Condition', xPos + cCond / 2, y + 3.5, { align: 'center' }); xPos += cCond;
  doc.text('Remarks', xPos + 2, y + 3.5);

  y += inspHeadH;

  (reportData.inspection_checking || []).forEach((item) => {
    const rowH = 5;
    doc.setDrawColor(...BORDER_GRAY).setLineWidth(0.2);
    doc.rect(margin, y, contentW, rowH);

    let x = margin;
    doc.line(x + cNo, y, x + cNo, y + rowH); x += cNo;
    doc.line(x + cAct, y, x + cAct, y + rowH); x += cAct;
    doc.line(x + cParam, y, x + cParam, y + rowH); x += cParam;
    doc.line(x + cCond, y, x + cCond, y + rowH);

    x = margin;
    doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(...DARK_TEXT);
    doc.text(String(item.no), x + cNo / 2, y + 3.5, { align: 'center' }); x += cNo;

    const actLines = doc.splitTextToSize(toEnglishText(item.activity), cAct - 3);
    doc.text(actLines[0] || '', x + 1.5, y + 3.5); x += cAct;

    const paramLines = doc.splitTextToSize(item.parameter || '', cParam - 3);
    doc.text(paramLines[0] || '', x + 1.5, y + 3.5); x += cParam;

    doc.setFont('helvetica', 'bold').setTextColor(item.condition === 'Good' ? 16 : 180, item.condition === 'Good' ? 120 : 0, 0);
    doc.text(item.condition || 'Good', x + cCond / 2, y + 3.5, { align: 'center' }); x += cCond;

    doc.setFont('helvetica', 'normal').setTextColor(...DARK_TEXT);
    doc.text(item.remarks || '', x + 1.5, y + 3.5);

    y += rowH;
  });

  y += 2;

  // ─── SECTION 2: CLEANING ───────────────────────────────────────────
  doc.setFillColor(...HEADER_DARK);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(255, 255, 255);
  doc.text('Cleaning', margin + 3, y + 3.5);
  y += 5;

  (reportData.cleaning || []).forEach((item) => {
    const rowH = 4.5;
    doc.setDrawColor(...BORDER_GRAY).setLineWidth(0.2);
    doc.rect(margin, y, contentW, rowH);

    let x = margin;
    doc.line(x + cNo, y, x + cNo, y + rowH); x += cNo;
    doc.line(x + cAct, y, x + cAct, y + rowH); x += cAct;
    doc.line(x + cParam, y, x + cParam, y + rowH); x += cParam;
    doc.line(x + cCond, y, x + cCond, y + rowH);

    x = margin;
    doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(...DARK_TEXT);
    doc.text(String(item.no), x + cNo / 2, y + 3, { align: 'center' }); x += cNo;

    doc.text(toEnglishText(item.activity), x + 1.5, y + 3); x += cAct;
    doc.text(item.parameter || 'Clean', x + 1.5, y + 3); x += cParam;
    doc.text(item.condition || 'Clean', x + cCond / 2, y + 3, { align: 'center' }); x += cCond;
    doc.text(item.remarks || '', x + 1.5, y + 3);

    y += rowH;
  });

  y += 2;

  // ─── SECTION 3: DIGITAL POWER METER RECORDING ─────────────────────
  doc.setFillColor(...HEADER_DARK);
  doc.rect(margin, y, contentW, 5, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(255, 255, 255);
  doc.text('Digital Power Meter Recording', margin + 3, y + 3.5);
  y += 5;

  const dpmH = 4;
  const dpmW = contentW / 4; // 47.5

  const drawDPMRow = (w1: string, v1: string, w2: string, v2: string, w3: string, v3: string, w4: string, v4: string) => {
    doc.setDrawColor(...BORDER_GRAY).setLineWidth(0.2);
    doc.rect(margin, y, contentW, dpmH);

    for (let i = 1; i <= 3; i++) {
      doc.line(margin + dpmW * i, y, margin + dpmW * i, y + dpmH);
    }

    doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(...DARK_TEXT);
    doc.text(w1, margin + 2, y + 2.8); doc.text(v1 || '', margin + 20, y + 2.8);
    doc.text(w2, margin + dpmW + 2, y + 2.8); doc.text(v2 || '', margin + dpmW + 20, y + 2.8);
    doc.text(w3, margin + dpmW * 2 + 2, y + 2.8); doc.text(v3 || '', margin + dpmW * 2 + 20, y + 2.8);
    doc.text(w4, margin + dpmW * 3 + 2, y + 2.8); doc.text(v4 || '', margin + dpmW * 3 + 20, y + 2.8);

    y += dpmH;
  };

  const dpm = reportData.dpm_recording || {} as any;
  drawDPMRow('R', dpm.r_ampere, 'KW', dpm.kw, 'R-S', dpm.voltage_rs, 'R-N', dpm.voltage_rn);
  drawDPMRow('S', dpm.s_ampere, 'KVA', dpm.kva, 'S-T', dpm.voltage_st, 'S-N', dpm.voltage_sn);
  drawDPMRow('T', dpm.t_ampere, 'KVAR', dpm.kvar, 'T-R', dpm.voltage_tr, 'T-N', dpm.voltage_tn);
  drawDPMRow('N', dpm.n_ampere, 'Cos p', dpm.cos_p, '', '', 'N-G', dpm.voltage_ng);

  y += 2;

  // ─── SECTION 4: ISO-TRANS TEMP & MEASUREMENTS ─────────────────────
  doc.setFillColor(...HEADER_DARK);
  doc.rect(margin, y, contentW, 4.5, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(255, 255, 255);
  doc.text('Temperature Monitoring ISO-Trans & Voltage / Ampere Measurement', margin + 3, y + 3);
  y += 4.5;

  const iso = reportData.iso_trans_temp || {} as any;
  const va = reportData.voltage_ampere || {} as any;
  const ground = reportData.grounding_resistance || {} as any;
  const noise = reportData.noise_measurement || {} as any;
  const thermal = reportData.thermal_measurement || {} as any;

  drawDPMRow('ISO R Temp', iso.r_temp || '', 'Voltage R-S', va.voltage_rs || '', 'Voltage R-N', va.voltage_rn || '', 'Current R', va.current_r || '');
  drawDPMRow('ISO S Temp', iso.s_temp || '', 'Voltage S-T', va.voltage_st || '', 'Voltage S-N', va.voltage_sn || '', 'Current S', va.current_s || '');
  drawDPMRow('ISO T Temp', iso.t_temp || '', 'Voltage T-R', va.voltage_tr || '', 'Voltage T-N', va.voltage_tn || '', 'Current T', va.current_t || '');

  y += 2;

  // ─── SECTION 5: THERMAL, GROUNDING & NOISE ────────────────────────
  doc.setFillColor(...HEADER_DARK);
  doc.rect(margin, y, contentW, 4.5, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(255, 255, 255);
  doc.text('Thermal Measurement, Grounding & Noise Resistance', margin + 3, y + 3);
  y += 4.5;

  drawDPMRow('Thermal Breaker', thermal.result_temp || '', 'Standard', '< 45 °C', 'Grounding', ground.result || '<5Ω', 'Noise Level', noise.result || '<75 dB');

  y += 2;

  // ─── SECTION 6: ANALYSIS / REMARK ─────────────────────────────────
  doc.setFillColor(...HEADER_DARK);
  doc.rect(margin, y, contentW, 4.5, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(255, 255, 255);
  doc.text('Analysis / Remark', margin + 3, y + 3);
  y += 4.5;

  const statusBoxH = 14;
  doc.setDrawColor(...BORDER_GRAY).setLineWidth(0.2);
  doc.rect(margin, y, contentW, statusBoxH);

  const ar = reportData.analysis_remark || {} as any;

  doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(ar.isNormal ? 16 : 100, ar.isNormal ? 120 : 100, 0);
  doc.text(`[${ar.isNormal ? 'X' : ' '}] Normal Operation`, margin + 3, y + 3.5);

  doc.setFont('helvetica', 'bold').setTextColor(ar.isAbnormal ? 180 : 100, 0, 0);
  doc.text(`[${ar.isAbnormal ? 'X' : ' '}] Abnormal Operation`, margin + 45, y + 3.5);

  doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(...DARK_TEXT);
  const remarkLines = doc.splitTextToSize(`Remark: ${ar.remarkText || 'Panel PDU beroperasi normal.'}`, contentW - 6);
  doc.text(remarkLines.slice(0, 2), margin + 3, y + 8);

  y += statusBoxH + 2;

  // ─── SECTION 7: TIME SPENT & SIGNATURES ──────────────────────────
  const sigH = 18;
  doc.setDrawColor(...BORDER_GRAY).setLineWidth(0.2);
  doc.rect(margin, y, contentW, sigH);

  doc.setFont('helvetica', 'bold').setFontSize(6.5).setTextColor(...DARK_TEXT);
  doc.text(`TIME SPENT: Date: ${timeSpent.date || ''}  |  Departure: ${timeSpent.departure || ''}  |  Start: ${timeSpent.start || ''}  |  Finish: ${timeSpent.finish || ''}`, margin + 3, y + 3.5);

  doc.setFont('helvetica', 'bold').setFontSize(6).setTextColor(...DARK_TEXT);
  doc.text('CUSTOMER ACKNOWLEDGEMENT:', margin + 3, y + 8);

  doc.text('Prepared', margin + 15, y + 15);
  doc.text('Checked', margin + contentW / 2 - 10, y + 15);
  doc.text('Approved', margin + contentW - 30, y + 15);

  // ─── PAGE 2: PHOTO DOCUMENTATION ATTACHMENT ────────────────────────
  if (photosData.length > 0) {
    doc.addPage();
    let yPhoto = margin;

    doc.setFillColor(...HEADER_DARK);
    doc.rect(margin, yPhoto, contentW, 6, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(255, 255, 255);
    doc.text('PDU SERVICE REPORT - PHOTO DOCUMENTATION ATTACHMENT', margin + 3, yPhoto + 4);
    yPhoto += 9;

    const cardsPerPage = 6;
    const photoH = 50;
    const capH = 10;
    const cardW = 88;

    photosData.forEach((card, idx) => {
      if (idx > 0 && idx % cardsPerPage === 0) {
        doc.addPage();
        yPhoto = margin;
        doc.setFillColor(...HEADER_DARK);
        doc.rect(margin, yPhoto, contentW, 6, 'F');
        doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(255, 255, 255);
        doc.text('PDU SERVICE REPORT - PHOTO DOCUMENTATION (Cont.)', margin + 3, yPhoto + 4);
        yPhoto += 9;
      }

      const col = idx % 2;
      const row = Math.floor((idx % cardsPerPage) / 2);
      const cardX = margin + col * (cardW + 14);
      const cardY = yPhoto + row * (photoH + capH + 6);

      doc.setDrawColor(200);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(cardX, cardY, cardW, photoH + capH, 2, 2, 'FD');

      if (card.photoBase64) {
        try {
          doc.addImage(card.photoBase64, 'JPEG', cardX + 1, cardY + 1, cardW - 2, photoH - 2);
        } catch (e) {
          console.error(e);
        }
      }

      doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(30, 30, 30);
      const titleLines = doc.splitTextToSize(toEnglishText(card.description || `Photo #${idx + 1}`), cardW - 4);
      doc.text(titleLines.slice(0, 2), cardX + 2, cardY + photoH + 4);
    });
  }

  // Save PDF file
  const fileName = `${customerInfo.companyName || 'PDU'}_Service_Report_${customerInfo.date || 'draft'}.pdf`.replace(/\s+/g, '_');
  doc.save(fileName);
}
