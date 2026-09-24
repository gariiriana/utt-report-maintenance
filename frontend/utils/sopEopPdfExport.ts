// ============================================================================
// SOP / EOP PDF Export
// Produces a compact, readable bilingual PDF from the same live data used by
// the SOP/EOP editor and Cloud archive.
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EOPDocumentData, SOPDocumentData } from '@/types/sopEopTypes';

type SopEopData = SOPDocumentData | EOPDocumentData;

const BLUE: [number, number, number] = [15, 91, 152];
const LIGHT_BLUE: [number, number, number] = [234, 243, 251];
const GREY: [number, number, number] = [71, 85, 105];

const safeText = (value?: string | null) => String(value || '-').trim() || '-';
const bilingualText = (english?: string | null, indonesian?: string | null) => {
  const en = safeText(english);
  const id = String(indonesian || '').trim();
  return id && id !== en ? `${en}\n${id}` : en;
};

const safeFileName = (title: string, type: 'SOP' | 'EOP') =>
  `${type}_${(title || `${type}_Document`).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

function drawPageChrome(doc: jsPDF, type: 'SOP' | 'EOP', title: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  doc.setFillColor(...BLUE);
  doc.rect(0, 0, pageWidth, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`PT DWIMITRA EKATAMA MANDIRI - ${type}`, margin, 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Official Maintenance Procedure Document', margin, 13);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(safeText(title), margin, 28, { maxWidth: pageWidth - margin * 2 });

  doc.setDrawColor(203, 213, 225);
  doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
  doc.setTextColor(...GREY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Dokumen resmi - PT Dwimitra Ekatama Mandiri / NeutraDC Cikarang', margin, pageHeight - 6);
  doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
}

function redrawAllFooters(doc: jsPDF, type: 'SOP' | 'EOP', title: string) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    if (page > 1) {
      doc.setFillColor(...BLUE);
      doc.rect(0, 0, pageWidth, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(`${type} - ${safeText(title)}`, margin, 6.5, { maxWidth: pageWidth - margin * 2 });
    }
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.setTextColor(...GREY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Dokumen resmi - PT Dwimitra Ekatama Mandiri / NeutraDC Cikarang', margin, pageHeight - 6);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }
}

function sectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFillColor(...LIGHT_BLUE);
  doc.roundedRect(12, y, doc.internal.pageSize.getWidth() - 24, 7, 1, 1, 'F');
  doc.setTextColor(...BLUE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(title, 14, y + 4.7);
  return y + 10;
}

function paragraphBlock(doc: jsPDF, label: string, content: string, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const lines = doc.splitTextToSize(content, pageWidth - margin * 2 - 4);
  const required = 7 + lines.length * 3.6;
  if (y + required > pageHeight - 16) {
    doc.addPage();
    y = 16;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(label, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text(lines, margin, y + 4.5);
  return y + required;
}

function tableY(doc: jsPDF, fallback: number) {
  const lastTable = (doc as any).lastAutoTable;
  return lastTable?.finalY ? lastTable.finalY + 7 : fallback;
}

function addApprovals(doc: jsPDF, approvals: SopEopData['approvals'], y: number) {
  y = sectionTitle(doc, 'Approval / Persetujuan', y);
  autoTable(doc, {
    startY: y,
    head: [['Role / Jabatan', 'Name / Nama', 'Date / Tanggal']],
    body: (approvals || []).map(item => [bilingualText(item.roleEn, item.roleId), safeText(item.name), safeText(item.date)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 2, valign: 'middle' },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
    margin: { left: 12, right: 12, bottom: 14 }
  });
  return tableY(doc, y);
}

export async function exportSOPToPdf(data: SOPDocumentData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  drawPageChrome(doc, 'SOP', data.documentTitle);
  let y = 37;

  y = sectionTitle(doc, '1. Document Overview / Gambaran Dokumen', y);
  autoTable(doc, {
    startY: y,
    body: [
      ['Purpose / Tujuan', bilingualText(data.documentPurposeEn, data.documentPurposeId)],
      ['Location / Lokasi', bilingualText(data.workLocationEn, data.workLocationId)],
      ['Execution Date / Tanggal Pelaksanaan', safeText(data.executionDate)],
      ['Reference Ticket / Nomor Tiket Referensi', safeText(data.referenceTicketNumber)],
      ['Executed By / Pelaksana', `${safeText(data.executedByName)}\n${safeText(data.executedByJobTitle)}`]
    ],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 2, valign: 'middle' },
    columnStyles: { 0: { cellWidth: 53, fontStyle: 'bold', fillColor: LIGHT_BLUE }, 1: { cellWidth: 122 } },
    margin: { left: 12, right: 12, bottom: 14 }
  });
  y = tableY(doc, y);

  y = sectionTitle(doc, '2. Equipment Information / Informasi Peralatan', y);
  autoTable(doc, {
    startY: y,
    head: [['No', 'CI Name', 'Description', 'Capacity', 'Room / Location']],
    body: (data.equipmentList || []).map((item, index) => [
      String(item.no || index + 1), safeText(item.ciName), safeText(item.ciDescription), safeText(item.capacity), safeText(item.room)
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.6, cellPadding: 1.7, valign: 'middle' },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
    margin: { left: 12, right: 12, bottom: 14 }
  });
  y = tableY(doc, y);

  y = sectionTitle(doc, '3. Affected Systems / Sistem Terdampak', y);
  const affected = (data.affectedSystems || []).filter(item => item.checked).map(item => bilingualText(item.labelEn, item.labelId)).join('\n') || '-';
  y = paragraphBlock(doc, 'Affected Systems:', `${affected}\n\n${bilingualText(data.affectedSystemsDetailsEn || data.affectedSystemsDetails, data.affectedSystemsDetailsId)}`, y);

  y = sectionTitle(doc, '4. Referenced Documents & EHS / Referensi Dokumen & K3', y);
  autoTable(doc, {
    startY: y,
    head: [['Referenced Document', 'Document Number']],
    body: (data.referencedDocuments || []).map(item => [safeText(item.name), safeText(item.number)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
    margin: { left: 12, right: 12, bottom: 14 }
  });
  y = tableY(doc, y);
  const ehs = data.ehsRequirements;
  y = paragraphBlock(doc, 'EHS Requirements / Persyaratan K3:', [
    bilingualText(ehs.ppeEn, ehs.ppeId),
    bilingualText(ehs.jewelryEn, ehs.jewelryId),
    bilingualText(ehs.commsEn, ehs.commsId),
    bilingualText(ehs.lotoEn, ehs.lotoId)
  ].join('\n\n'), y);

  y = sectionTitle(doc, '5. Prerequisites / Prasyarat', y);
  autoTable(doc, {
    startY: y,
    head: [['No', 'Requirement / Persyaratan', 'Time', 'Initial']],
    body: (data.prerequisites || []).map((item, index) => [String(index + 1), bilingualText(item.requirementEn, item.requirementId), safeText(item.time), safeText(item.initial)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.7, cellPadding: 1.7, valign: 'middle' },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
    margin: { left: 12, right: 12, bottom: 14 }
  });
  y = tableY(doc, y);

  y = sectionTitle(doc, '6. Work Instruction / Instruksi Kerja', y);
  y = paragraphBlock(doc, 'Conditions Prior to Execution / Kondisi Sebelum Pelaksanaan:', bilingualText(data.conditionsPriorToExecutionEn, data.conditionsPriorToExecutionId), y);
  autoTable(doc, {
    startY: y,
    head: [['No', 'Action / Tindakan', 'Expected Outcome / Hasil Diharapkan', 'Time', 'Initial']],
    body: (data.workSteps || []).map((item, index) => [String(item.no || index + 1), bilingualText(item.actionEn, item.actionId), bilingualText(item.expectedOutcomeEn, item.expectedOutcomeId), safeText(item.time), safeText(item.initial)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.4, cellPadding: 1.6, valign: 'middle' },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
    margin: { left: 12, right: 12, bottom: 14 }
  });
  y = tableY(doc, y);

  y = sectionTitle(doc, '7. Back-Out & Document Information', y);
  y = paragraphBlock(doc, 'Back-Out Procedure / Prosedur Pengembalian:', bilingualText(data.backOutProcedureEn || data.backOutProcedure, data.backOutProcedureId), y);
  y = paragraphBlock(doc, 'Document Information:', `Author: ${safeText(data.author)}\nCreated: ${safeText(data.dateOfCreation)}\nRevision Date: ${safeText(data.dateRevision)}\nRevision Number: ${safeText(data.revisionNumber)}\nMaintenance Period: ${safeText(data.maintenancePeriod === 'custom' ? data.customPeriodLabel : data.maintenancePeriod)}`, y);
  y = addApprovals(doc, data.approvals, y);
  y = sectionTitle(doc, '8. Additional Information / Informasi Tambahan', y);
  paragraphBlock(doc, 'Additional Information:', bilingualText(data.additionalInformationEn || data.additionalInformation, data.additionalInformationId), y);

  redrawAllFooters(doc, 'SOP', data.documentTitle);
  doc.save(safeFileName(data.documentTitle, 'SOP'));
}

export async function exportEOPToPdf(data: EOPDocumentData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  drawPageChrome(doc, 'EOP', data.documentTitle);
  let y = 37;

  y = sectionTitle(doc, '1. Document Overview / Gambaran Dokumen', y);
  autoTable(doc, {
    startY: y,
    body: [
      ['Purpose / Tujuan', bilingualText(data.documentPurposeEn, data.documentPurposeId)],
      ['Location / Lokasi', bilingualText(data.workLocationEn, data.workLocationId)],
      ['Author / Penyusun', safeText(data.author)],
      ['Creation Date / Tanggal Dibuat', safeText(data.dateOfCreation)],
      ['Next Revision / Revisi Berikutnya', safeText(data.nextDateRevision)],
      ['Revision Number / Nomor Revisi', safeText(data.revisionNumber)]
    ],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 2, valign: 'middle' },
    columnStyles: { 0: { cellWidth: 53, fontStyle: 'bold', fillColor: LIGHT_BLUE }, 1: { cellWidth: 122 } },
    margin: { left: 12, right: 12, bottom: 14 }
  });
  y = tableY(doc, y);

  y = sectionTitle(doc, '2. Referenced Documents / Dokumen Referensi', y);
  autoTable(doc, {
    startY: y,
    head: [['Referenced Document', 'Document Number']],
    body: (data.referencedDocuments || []).map(item => [safeText(item.name), safeText(item.number)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
    margin: { left: 12, right: 12, bottom: 14 }
  });
  y = tableY(doc, y);

  y = sectionTitle(doc, '3. EHS Requirements / Persyaratan K3', y);
  const ehsItems = data.ehsRequirements.items || [
    { textEn: data.ehsRequirements.ppeEn, textId: data.ehsRequirements.ppeId },
    { textEn: data.ehsRequirements.commsEn, textId: data.ehsRequirements.commsId },
    ...(data.ehsRequirements.additionalItems || [])
  ];
  y = paragraphBlock(doc, 'EHS Requirements:', ehsItems.map(item => bilingualText(item.textEn, item.textId)).join('\n\n'), y);

  y = sectionTitle(doc, '4. Emergency Work Instruction / Instruksi Kerja Darurat', y);
  y = paragraphBlock(doc, 'Expected Conditions / Kondisi yang Diharapkan:', bilingualText(data.expectedConditionsEn, data.expectedConditionsId), y);
  autoTable(doc, {
    startY: y,
    head: [['No', 'Action / Tindakan', 'Expected Outcome / Hasil Diharapkan', 'Time', 'Name']],
    body: (data.workSteps || []).map((item, index) => [String(item.no || index + 1), bilingualText(item.actionEn, item.actionId), bilingualText(item.expectedOutcomeEn, item.expectedOutcomeId), safeText(item.time), safeText(item.name)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.4, cellPadding: 1.6, valign: 'middle' },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
    margin: { left: 12, right: 12, bottom: 14 }
  });
  y = tableY(doc, y);

  y = sectionTitle(doc, '5. Dry Run, Approval & Additional Information', y);
  y = paragraphBlock(doc, 'Dry Run / Simulasi:', `Job Title: ${safeText(data.dryRun.jobTitle)}\nName: ${safeText(data.dryRun.name)}\nDate: ${safeText(data.dryRun.date)}`, y);
  y = addApprovals(doc, data.approvals, y);
  y = sectionTitle(doc, '6. Additional Information / Informasi Tambahan', y);
  paragraphBlock(doc, 'Additional Information:', bilingualText(data.additionalInformationEn || data.additionalInformation, data.additionalInformationId), y);

  redrawAllFooters(doc, 'EOP', data.documentTitle);
  doc.save(safeFileName(data.documentTitle, 'EOP'));
}
