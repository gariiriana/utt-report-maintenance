// ============================================================================
// FILE: frontend/utils/sopEopPdfExport.ts
// Deskripsi: Engine Ekspor Dokumen SOP & EOP ke PDF Resmi
//            Standar Presisi 100% Identik dengan Hasil Ekspor DOCX & Master Dokumen
//            NeutraDC & PT Dwimitra Ekatama Mandiri
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  SOPDocumentData,
  EOPDocumentData,
  SOPCIEquipmentItem,
} from '@/types/sopEopTypes';
import { ensureBilingualTranslation } from '@/utils/sopEopBilingualAI';
import logoDMEOriginal from '@/assets/sop_eop_logo2.jpeg';
import logoNDCOriginal from '@/assets/sop_eop_logo1.jpeg';

// ----------------------------------------------------------------------------
// CONSTANTS & COLORS (Matching DOCX 100%)
// ----------------------------------------------------------------------------
const COLOR_BANNER_SOP: [number, number, number] = [238, 0, 0]; // #EE0000 Pure Red
const COLOR_BANNER_EOP: [number, number, number] = [255, 0, 255]; // #FF00FF Pure Magenta
const COLOR_SUBTITLE_BANNER: [number, number, number] = [224, 224, 224]; // #E0E0E0
const COLOR_BLACK: [number, number, number] = [0, 0, 0];
const COLOR_GREY_ID: [number, number, number] = [89, 89, 89]; // #595959 Corporate translation grey
// Word master uses black table rules. The old light-grey rules were one of
// the most visible differences between DOCX and PDF exports.
const COLOR_DIVIDER: [number, number, number] = [0, 0, 0];
const COLOR_BOX_BORDER: [number, number, number] = [0, 0, 0];

// Margins & dimensions mirror the DOCX section properties exactly.
// The DOCX uses 1 inch (1440 dxa) side margins.  Its printable width is
// 9016 dxa = 15.9 cm, so PDF must not use jsPDF's much wider default canvas.
// Keeping this as the single source of PDF geometry prevents the two exports
// from drifting apart again when table columns are adjusted.
const PAGE_MARGIN = 25.4;
const CONTENT_WIDTH = 159;
const TOP_CONTENT_Y_SOP = 25.4;
const TOP_CONTENT_Y_EOP = 30;
// Kept as the common autoTable fallback. EOP overrides its first-page and
// forced-break position below to retain the slightly deeper master margin.
const TOP_CONTENT_Y = TOP_CONTENT_Y_SOP;
const BOTTOM_SAFE_Y = 272;
const PDF_REFERENCE_WIDTH = 182;
const scaledWidth = (width: number) => (width / PDF_REFERENCE_WIDTH) * CONTENT_WIDTH;
const docxWidth = (widthDxa: number) => (widthDxa / 9016) * CONTENT_WIDTH;

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------
function safeStr(val?: string | null): string {
  return String(val || '-').trim() || '-';
}

function getBilingualPair(en?: string | null, id?: string | null): { en: string; id: string } {
  const cleanEn = safeStr(en);
  const cleanId = cleanEn !== '-' ? ensureBilingualTranslation(cleanEn, id || undefined) : safeStr(id);
  return { en: cleanEn, id: cleanId };
}

function formatBilingualCell(en?: string | null, id?: string | null): string {
  const { en: cleanEn, id: cleanId } = getBilingualPair(en, id);
  if (!cleanId || cleanId === cleanEn || cleanId === '-') return cleanEn;
  return `${cleanEn}\n${cleanId}`;
}

async function loadImgDataUrl(src: string): Promise<string> {
  if (!src) return '';
  if (src.startsWith('data:image')) return src;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
          return;
        }
      } catch {
        // ignore
      }
      resolve('');
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

/**
 * Creates Section Banner rectangle matching DOCX Section Banner 100%
 */
function renderSectionBanner(
  doc: jsPDF,
  curY: number,
  titleEn: string,
  titleId: string,
  isEOP: boolean,
  topContentY = isEOP ? TOP_CONTENT_Y_EOP : TOP_CONTENT_Y_SOP
): number {
  if (curY + 12 > BOTTOM_SAFE_Y) {
    doc.addPage();
    curY = topContentY;
  }

  const bannerColor = isEOP ? COLOR_BANNER_EOP : COLOR_BANNER_SOP;

  doc.setFillColor(...bannerColor);
  doc.rect(PAGE_MARGIN, curY, CONTENT_WIDTH, 10.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(titleEn, PAGE_MARGIN + CONTENT_WIDTH / 2, curY + 4.4, { align: 'center' });

  if (titleId) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_SUBTITLE_BANNER);
    doc.text(titleId, PAGE_MARGIN + CONTENT_WIDTH / 2, curY + 8.1, { align: 'center' });
  }

  return curY + 12.5;
}

/**
 * Draws the master header and footer on EVERY page
 */
function drawAllHeadersAndFooters(
  doc: jsPDF,
  isEOP: boolean,
  dmeLogo: string,
  ndcLogo: string
) {
  const totalPages = doc.getNumberOfPages();
  const bannerColor = isEOP ? COLOR_BANNER_EOP : COLOR_BANNER_SOP;
  const titleText = isEOP ? 'EMERGENCY OPERATING PROCEDURE' : 'STANDARD OPERATING PROCEDURE  ';
  const subtitleText = 'NeutraDC – Cikarang';

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // 1. Left Title Badges
    doc.setFillColor(...bannerColor);
    // Word's text highlight is long enough for the complete document title.
    // Reserve the same visual title band so it never clips in the PDF viewer.
    doc.rect(PAGE_MARGIN, 7.5, isEOP ? 118 : 112, 6.6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(titleText, PAGE_MARGIN + 1.5, 12.35);

    doc.setFillColor(...bannerColor);
    doc.rect(PAGE_MARGIN, 14.7, 55, 6.2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(subtitleText, PAGE_MARGIN + 1.5, 19.4);

    // 2. Right Logos
    if (dmeLogo) {
      try {
        doc.addImage(dmeLogo, 'JPEG', 158, 7.5, 26.5, 11.1);
      } catch {
        // ignore
      }
    }
    if (ndcLogo) {
      try {
        doc.addImage(ndcLogo, 'JPEG', 189, 7.5, 20.6, 10.6);
      } catch {
        // ignore
      }
    }

    // Divider line under header
    doc.setDrawColor(...COLOR_DIVIDER);
    doc.setLineWidth(0.25);
    doc.line(PAGE_MARGIN, 22, PAGE_MARGIN + CONTENT_WIDTH, 22);

    // 3. Center Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_GREY_ID);
    doc.text(`Page ${p} of ${totalPages}`, 105, 284.5, { align: 'center' });
  }
}

// ============================================================================
// EXPORT SOP TO PDF (100% IDENTICAL TO DOCX EXPORT)
// ============================================================================
export async function exportSOPToPdf(data: SOPDocumentData): Promise<void> {
  const [dmeLogo, ndcLogo] = await Promise.all([
    loadImgDataUrl(logoDMEOriginal),
    loadImgDataUrl(logoNDCOriginal),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  let curY = TOP_CONTENT_Y;

  // --------------------------------------------------------------------------
  // SECTION 1: Document Overview
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 1 – Document Overview', 'Seksi 1 – Gambaran Umum Dokumen', false);

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    body: [
      [
        { content: 'Document Title\nJudul Dokumen', styles: { fontStyle: 'normal', textColor: COLOR_BLACK } },
        { content: `: ${data.documentTitle || '-'}\n: ${data.documentTitle || '-'}`, styles: { textColor: COLOR_BLACK } },
      ],
      [
        { content: 'Document Purpose\nTujuan Dokumen', styles: { fontStyle: 'normal', textColor: COLOR_BLACK } },
        { content: `: ${data.documentPurposeEn || '-'}\n: ${data.documentPurposeId || ensureBilingualTranslation(data.documentPurposeEn || '-')}`, styles: { textColor: COLOR_BLACK } },
      ],
      [
        { content: 'Work Location\nLokasi Kerja', styles: { fontStyle: 'normal', textColor: COLOR_BLACK } },
        { content: `: ${data.workLocationEn || 'Neutra DC Cikarang'}\n: ${data.workLocationId || 'Neutra DC Cikarang'}`, styles: { textColor: COLOR_BLACK } },
      ],
    ],
    // DOCX field values use 10pt English / 9pt Indonesian. A 9.5pt PDF
    // baseline preserves the same wrapping and page count in the browser.
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 1.2, bottom: 1.2, left: 0.5, right: 0.5 }, valign: 'top' },
    columnStyles: { 0: { cellWidth: docxWidth(2280) }, 1: { cellWidth: docxWidth(6736) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 2: Equipment Information
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 2 – Equipment Information', 'Seksi 2 – Informasi Peralatan', false);

  const eqList = data.equipmentList || [];
  const optionalKeys: (keyof SOPCIEquipmentItem)[] = [
    'ciDescription',
    'serialNumber',
    'room',
    'capacity',
    'mfd',
    'productName',
    'model',
  ];

  const hasDataForKey = (key: keyof SOPCIEquipmentItem) =>
    eqList.some((item) => {
      const val = item[key];
      return val && val !== '-' && String(val).trim() !== '';
    });

  const allEquipCols: { widthWeight: number; en: string; id: string; key: keyof SOPCIEquipmentItem }[] = [
    { widthWeight: 8, en: 'No', id: 'No', key: 'no' },
    { widthWeight: 14, en: 'Class id', id: 'ID Kelas', key: 'classId' },
    { widthWeight: 22, en: 'CI Name*', id: 'Nama CI*', key: 'ciName' },
    { widthWeight: 24, en: 'CI Description*', id: 'Deskripsi CI*', key: 'ciDescription' },
    { widthWeight: 16, en: 'Capacity', id: 'Kapasitas', key: 'capacity' },
    { widthWeight: 18, en: 'Serial Number', id: 'Nomor Seri', key: 'serialNumber' },
    { widthWeight: 14, en: 'MFD', id: 'Tahun (MFD)', key: 'mfd' },
    { widthWeight: 18, en: 'Product Name', id: 'Nama Produk', key: 'productName' },
    { widthWeight: 18, en: 'Model', id: 'Model', key: 'model' },
    { widthWeight: 12, en: 'Room', id: 'Ruangan', key: 'room' },
  ];

  const activeCols = allEquipCols.filter(
    (col) => !optionalKeys.includes(col.key) || hasDataForKey(col.key)
  );

  const totalWeight = activeCols.reduce((sum, c) => sum + c.widthWeight, 0);
  const equipColStyles: { [key: number]: { cellWidth: number } } = {};
  activeCols.forEach((col, idx) => {
    equipColStyles[idx] = { cellWidth: (col.widthWeight / totalWeight) * CONTENT_WIDTH };
  });

  const equipHeadRow = activeCols.map((c) => `${c.en}\n${c.id}`);
  const equipBodyRows = (eqList.length > 0 ? eqList : [{ no: '1', classId: '-', ciName: '-' } as any]).map(
    (item, idx) =>
      activeCols.map((c) => {
        if (c.key === 'no') return String(item.no || idx + 1);
        return safeStr(item[c.key]);
      })
  );

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    // Equipment is the master table that uses a full box grid.
    theme: 'grid',
    head: [equipHeadRow],
    body: equipBodyRows,
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontStyle: 'bold',
      fontSize: 9,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 9,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
      valign: 'middle',
    },
    columnStyles: equipColStyles,
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 3: Schedule / Work Information
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 3 – Schedule / Work Information', 'Seksi 3 – Informasi Jadwal / Pekerjaan', false);

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    body: [
      [
        {
          content: `SOP Execution Date: ${data.executionDate || '-'}\nTanggal Pelaksanaan SOP: ${data.executionDate || '-'}`,
          styles: { fontStyle: 'normal', textColor: COLOR_BLACK },
        },
        {
          content: `Reference Ticket Number: ${data.referenceTicketNumber || '-'}\nNomor Tiket Referensi: ${data.referenceTicketNumber || '-'}`,
          styles: { fontStyle: 'normal', textColor: COLOR_BLACK },
        },
      ],
    ],
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 1, bottom: 1.5, left: 0.5, right: 0.5 } },
    columnStyles: { 0: { cellWidth: docxWidth(4450) }, 1: { cellWidth: docxWidth(4566) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 1;

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    head: [
      [
        { content: 'Executed by (Name)\nDilaksanakan oleh (Nama)', styles: { fontStyle: 'normal' } },
        { content: 'Job title\nJabatan', styles: { fontStyle: 'normal' } },
      ],
    ],
    body: [[safeStr(data.executedByName), safeStr(data.executedByJobTitle)]],
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 10,
      lineWidth: { bottom: 0.25 },
      lineColor: COLOR_DIVIDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 9,
      lineWidth: { bottom: 0.25 },
      lineColor: COLOR_DIVIDER,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
    },
    columnStyles: { 0: { cellWidth: docxWidth(4395) }, 1: { cellWidth: docxWidth(4621) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 4: Affected Equipment / Systems
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 4 – Affected Equipment / Systems', 'Seksi 4 – Peralatan / Sistem yang Terdampak', false);

  const affSystems = data.affectedSystems || [];
  const affTableBody: any[] = [];
  for (let i = 0; i < affSystems.length; i += 3) {
    const rowItems = [affSystems[i], affSystems[i + 1], affSystems[i + 2]];
    affTableBody.push(
      rowItems.map((item) => {
        if (!item) return '';
        // jsPDF core fonts cannot encode the Word checkbox glyph reliably.
        const check = item.checked ? '[x]' : '[ ]';
        return `${check} ${item.labelEn}\n    ${item.labelId}`;
      })
    );
  }

  if (affTableBody.length > 0) {
    autoTable(doc, {
      startY: curY,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
      // Do not split a short checklist between two pages.  Splitting here was
      // the cause of the incomplete-looking table in archived SOP exports.
      pageBreak: 'avoid',
      // Word renders this as a visible three-column checklist table.
      theme: 'grid',
      body: affTableBody,
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: { top: 1.2, bottom: 1.2, left: 1, right: 1 },
        textColor: COLOR_BLACK,
        lineWidth: 0.2,
        lineColor: COLOR_BOX_BORDER,
      },
      // Exact DOCX column widths: [3005, 3227, 2784] dxa.  The former
      // three equal widths squeezed the middle column and broke its text.
      columnStyles: {
        0: { cellWidth: docxWidth(3005) },
        1: { cellWidth: docxWidth(3227) },
        2: { cellWidth: docxWidth(2784) },
      },
    });
    curY = (doc as any).lastAutoTable.finalY + 2;
  }

  // Details box
  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    body: [
      [
        {
          content: 'if any of the item above is checked, do provide details for each item respectively:\njika ada item di atas yang dicentang, berikan rincian untuk masing-masing item tersebut:',
          styles: { fontStyle: 'italic', fontSize: 7, textColor: COLOR_GREY_ID },
        },
      ],
      [
        {
          content: formatBilingualCell(data.affectedSystemsDetailsEn || data.affectedSystemsDetails, data.affectedSystemsDetailsId),
          styles: {
            fontSize: 7.8,
            textColor: COLOR_BLACK,
            lineWidth: 0.25,
            lineColor: COLOR_BOX_BORDER,
            cellPadding: 2,
          },
        },
      ],
    ],
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 5: Referenced Documents / Attachments
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 5 – Referenced Documents / Attachments', 'Seksi 5 – Dokumen Referensi / Lampiran', false);

  const refDocs = (data.referencedDocuments && data.referencedDocuments.length > 0)
    ? data.referencedDocuments
    : [{ name: '-', number: '-' }];

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    head: [
      [
        { content: 'Document Name\nNama Dokumen', styles: { fontStyle: 'normal' } },
        { content: 'Document Number\nNomor Dokumen', styles: { fontStyle: 'normal' } },
      ],
    ],
    body: refDocs.map((rd) => [safeStr(rd.name), safeStr(rd.number)]),
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 10,
      lineWidth: { bottom: 0.25 },
      lineColor: COLOR_DIVIDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 9,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
    },
    columnStyles: { 0: { cellWidth: docxWidth(6516) }, 1: { cellWidth: docxWidth(2500) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 6: Environmental, Health & Safety (EHS)
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 6 – Environmental, Health & Safety', 'Seksi 6 – Lingkungan, Kesehatan & Keselamatan Kerja', false);

  const ehs = data.ehsRequirements || {
    ppeEn: 'Wear Personal Protective Equipment (PPE) such as rubber gloves and footwear, protective eye wear, and protective helmet.',
    ppeId: 'Gunakan Alat Pelindung Diri (APD) seperti sarung tangan karet dan sepatu keselamatan, kacamata pelindung, serta helm pelindung.',
    jewelryEn: 'Remove rings and metal wrist watches, jewelry, or any metal objects kept in the clothes pocket.',
    jewelryId: 'Lepaskan cincin dan jam tangan logam, perhiasan, atau benda logam apa pun yang disimpan di dalam saku pakaian.',
    commsEn: 'Communication device such as handy-talkie (HT) is on hand.',
    commsId: 'Perangkat komunikasi seperti handy-talkie (HT) siap digunakan.',
    lotoEn: 'Lock-Out / Tag-Out devices and tools.',
    lotoId: 'Peralatan dan perlengkapan Lock-Out / Tag-Out.',
  };

  const ehsList = [
    [`1. ${ehs.ppeEn}`, `1. ${ensureBilingualTranslation(ehs.ppeEn, ehs.ppeId)}`],
    [`2. ${ehs.jewelryEn}`, `2. ${ensureBilingualTranslation(ehs.jewelryEn, ehs.jewelryId)}`],
    [`3. ${ehs.commsEn}`, `3. ${ensureBilingualTranslation(ehs.commsEn, ehs.commsId)}`],
    [`4. ${ehs.lotoEn}`, `4. ${ensureBilingualTranslation(ehs.lotoEn, ehs.lotoId)}`],
  ];

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    pageBreak: 'avoid',
    // Word displays the EHS requirements as a visible checklist table.
    theme: 'grid',
    head: [[{ content: 'Requirements\nPersyaratan', styles: { fontStyle: 'normal' } }]],
    body: ehsList.map(([en, id]) => [`${en}\n${id}`]),
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 10,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 9,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 7: Prerequisites
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 7 – Prerequisites', 'Seksi 7 – Prasyarat', false);

  const prereqs = (data.prerequisites && data.prerequisites.length > 0)
    ? data.prerequisites
    : [
        { requirementEn: '1. Check PTW is approved.', requirementId: '1. Periksa bahwa PTW telah disetujui.', time: '', initial: '' },
        { requirementEn: '2. Note down vendor arrival Date / Time :', requirementId: '2. Catat Tanggal / Waktu kedatangan vendor :', time: '', initial: '' },
        { requirementEn: '3. Check all tools and materials are available and in good condition.', requirementId: '3. Periksa semua peralatan dan material telah tersedia dan dalam kondisi baik.', time: '', initial: '' },
        { requirementEn: '4. Ensure necessary reference documents is attached to this SOP.', requirementId: '4. Pastikan dokumen referensi yang diperlukan telah dilampirkan pada SOP ini.', time: '', initial: '' },
        { requirementEn: '5. Ensure personnel involving in this work are trained and competent to perform this procedure.', requirementId: '5. Pastikan personel yang terlibat dalam pekerjaan ini telah terlatih dan kompeten untuk melaksanakan prosedur ini.', time: '', initial: '' },
      ];

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    // DOCX uses horizontal divider rules for procedure rows, not a boxed grid.
    theme: 'plain',
    head: [
      [
        { content: 'Requirements\nPersyaratan', styles: { fontStyle: 'normal' } },
        { content: 'Time\nWaktu', styles: { fontStyle: 'normal', halign: 'center' } },
        { content: 'Initial\nInisial', styles: { fontStyle: 'normal', halign: 'center' } },
      ],
    ],
    body: prereqs.map((pr) => [
      formatBilingualCell(pr.requirementEn, pr.requirementId),
      safeStr(pr.time).replace(/^-$/, ''),
      safeStr(pr.initial).replace(/^-$/, ''),
    ]),
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 7.8,
      lineWidth: { bottom: 0.25 },
      lineColor: COLOR_BOX_BORDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 7.5,
      lineWidth: { bottom: 0.25 },
      lineColor: COLOR_BOX_BORDER,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
    },
    columnStyles: { 0: { cellWidth: scaledWidth(124) }, 1: { cellWidth: scaledWidth(36), halign: 'center' }, 2: { cellWidth: scaledWidth(22), halign: 'center' } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 8: Dry Run
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 8 – Dry Run', 'Seksi 8 – Uji Coba (Dry Run)', false);

  const dryRun = data.dryRun;
  const hasDryRunValues = !!(dryRun && ((dryRun.name && dryRun.name !== '-' && dryRun.name.trim() !== '') || (dryRun.date && dryRun.date !== '-' && dryRun.date.trim() !== '')));

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    // Keep the same visible row boundaries as the DOCX EHS checklist.
    // Without a grid, this was the table that appeared to be missing in PDF.
    pageBreak: 'avoid',
    theme: 'grid',
    head: [
      [
        { content: 'Job Title:\nJabatan:', styles: { fontStyle: 'normal' } },
        { content: 'Name:\nNama:', styles: { fontStyle: 'normal' } },
        { content: 'Signature:\nTanda Tangan:', styles: { fontStyle: 'normal' } },
        { content: 'Date:\nTanggal:', styles: { fontStyle: 'normal' } },
      ],
    ],
    body: hasDryRunValues && dryRun ? [
      [
        safeStr(dryRun.jobTitle).replace(/^-$/, ''),
        safeStr(dryRun.name).replace(/^-$/, ''),
        '',
        safeStr(dryRun.date).replace(/^-$/, ''),
      ],
    ] : [
      ['\n', '\n', '\n', '\n'],
    ],
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 7.8,
      lineWidth: { bottom: 0.25 },
      lineColor: COLOR_DIVIDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 7.5,
      cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
    },
    columnStyles: { 0: { cellWidth: scaledWidth(45.5) }, 1: { cellWidth: scaledWidth(45.5) }, 2: { cellWidth: scaledWidth(45.5) }, 3: { cellWidth: scaledWidth(45.5) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 9: Maintenance Periode
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 9 – Maintenance Periode', 'Seksi 9 – Periode Pemeliharaan', false);

  const is6Months = data.maintenancePeriod === '6_months';
  const isAnnual = data.maintenancePeriod === 'annual';

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    body: [
      [
        `${isAnnual ? '☐' : '■'} 6 Months\n    6 Bulan`,
        `${is6Months ? '☐' : '■'} Annual\n    Tahunan`,
      ],
    ],
    styles: { font: 'helvetica', fontSize: 10, fontStyle: 'normal', cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, textColor: COLOR_BLACK },
    columnStyles: { 0: { cellWidth: scaledWidth(91) }, 1: { cellWidth: scaledWidth(91) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 10: Work Instruction / Procedures (NEW PAGE matching Master SOP)
  // --------------------------------------------------------------------------
  doc.addPage();
  curY = TOP_CONTENT_Y;

  curY = renderSectionBanner(doc, curY, 'Section 10 – Work Instruction / Procedures', 'Seksi 10 – Instruksi / Prosedur Kerja', false);

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    body: [
      [
        {
          content: 'Conditions / Equipment status prior to SOP Execution:\nKondisi / Status peralatan sebelum Pelaksanaan SOP:',
          styles: { fontStyle: 'normal', fontSize: 9, textColor: COLOR_BLACK },
        },
      ],
      ...(data.conditionsPriorToExecutionEn || data.conditionsPriorToExecutionId ? [
        [
          {
            content: formatBilingualCell(data.conditionsPriorToExecutionEn, data.conditionsPriorToExecutionId),
            styles: { fontSize: 9, textColor: COLOR_BLACK, cellPadding: { top: 0.5, bottom: 2, left: 0.5, right: 0.5 } },
          },
        ],
      ] : []),
    ],
  });

  curY = (doc as any).lastAutoTable.finalY + 2;

  const sopStepColWidths = { 0: docxWidth(4248), 1: docxWidth(1843), 2: docxWidth(1842), 3: docxWidth(1083) };
  const sopStepRows = (data.workSteps || []).map((st, i) => {
    const stepNo = st.no || i + 1;
    const cleanActionEn = (st.actionEn || '-').replace(/^\s*\d+[\.\)]\s*/, '').trim() || '-';
    const cleanActionId = ensureBilingualTranslation(cleanActionEn, st.actionId).replace(/^\s*\d+[\.\)]\s*/, '').trim();
    const cleanOutcomeEn = (st.expectedOutcomeEn || '-').replace(/^\s*\d+[\.\)]\s*/, '').trim() || '-';
    const cleanOutcomeId = ensureBilingualTranslation(cleanOutcomeEn, st.expectedOutcomeId).replace(/^\s*\d+[\.\)]\s*/, '').trim();

    return [
      `${stepNo}. ${cleanActionEn}\n${stepNo}. ${cleanActionId}`,
      `${cleanOutcomeEn}\n${cleanOutcomeId}`,
      safeStr(st.time).replace(/^-$/, ''),
      safeStr(st.initial).replace(/^-$/, ''),
    ];
  });

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    // The rendered Word master shows a full grid for its work-step table.
    theme: 'grid',
    head: [
      [
        { content: 'Action\nTindakan', styles: { fontStyle: 'normal' } },
        { content: 'Expected Outcome\nHasil yang Diharapkan', styles: { fontStyle: 'normal' } },
        { content: 'Time\nWaktu', styles: { fontStyle: 'normal', halign: 'center' } },
        { content: 'Initial\nInisial', styles: { fontStyle: 'normal', halign: 'center' } },
      ],
    ],
    body: sopStepRows.length > 0 ? sopStepRows : [['1. -\n1. -', '-\n-', '', '']],
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 10,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 9,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: sopStepColWidths[0] },
      1: { cellWidth: sopStepColWidths[1] },
      2: { cellWidth: sopStepColWidths[2], halign: 'center' },
      3: { cellWidth: sopStepColWidths[3], halign: 'center' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 11: Back Out Procedures
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 11 – Back Out Procedures', 'Seksi 11 – Prosedur Pemulihan (Back Out)', false);

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    head: [[{ content: 'Action\nTindakan', styles: { fontStyle: 'normal' } }]],
    body: [
      [formatBilingualCell(data.backOutProcedureEn || data.backOutProcedure || 'N/A', data.backOutProcedureId)],
    ],
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 7.8,
      lineWidth: { bottom: 0.25 },
      lineColor: COLOR_DIVIDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 7.5,
      lineWidth: { bottom: 0.25 },
      lineColor: COLOR_DIVIDER,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 12: Document Information
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 12 – Document Information', 'Seksi 12 – Informasi Dokumen', false);

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    body: [
      [
        { content: 'Author\nPenulis', styles: { fontStyle: 'normal' } },
        { content: `: ${data.author || 'Alif Darmawan'}\n: ${data.author || 'Alif Darmawan'}` },
        { content: 'Date of Creation\nTanggal Pembuatan', styles: { fontStyle: 'normal' } },
        { content: `: ${data.dateOfCreation || '07 Sep 2026'}\n: ${data.dateOfCreation || '07 Sep 2026'}` },
      ],
      [
        { content: 'Date Revision\nTanggal Revisi', styles: { fontStyle: 'normal' } },
        { content: `: ${data.dateRevision || 'N/A'}\n: ${data.dateRevision || 'T/A'}` },
        { content: 'Revision Number\nNomor Revisi', styles: { fontStyle: 'normal' } },
        { content: `: ${data.revisionNumber || '-'}\n: ${data.revisionNumber || '-'}` },
      ],
    ],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }, textColor: COLOR_BLACK },
    columnStyles: { 0: { cellWidth: docxWidth(2200) }, 1: { cellWidth: docxWidth(2308) }, 2: { cellWidth: docxWidth(2200) }, 3: { cellWidth: docxWidth(2308) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 13: Approval (NEW PAGE matching Master SOP)
  // --------------------------------------------------------------------------
  doc.addPage();
  curY = TOP_CONTENT_Y;

  curY = renderSectionBanner(doc, curY, 'Section 13 – Approval', 'Seksi 13 – Persetujuan', false);

  const defaultApprovals = [
    { roleEn: 'Project Manager', roleId: 'Manajer Proyek', name: 'Dwi Tasmiyadi' },
    { roleEn: 'Chief Engineering', roleId: 'Kepala Engineering', name: 'Habib Mulyana' },
    { roleEn: 'Facility Manager', roleId: 'Manajer Fasilitas', name: 'Supriyatno' },
    { roleEn: 'Assistant Manager HDC', roleId: 'Asisten Manajer HDC', name: 'Budi Susanto' },
  ];

  const approvalList = (data.approvals && data.approvals.length > 0) ? data.approvals : defaultApprovals;

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    // Approval is the one master table that remains fully boxed.
    theme: 'grid',
    head: [
      [
        { content: 'Job Title\nJabatan', styles: { fontStyle: 'bold' } },
        { content: 'Name\nNama', styles: { fontStyle: 'bold' } },
        { content: 'Signature\nTanda Tangan', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: 'Date\nTanggal', styles: { fontStyle: 'bold', halign: 'center' } },
      ],
    ],
    body: approvalList.map((app) => [
      formatBilingualCell(app.roleEn, app.roleId),
      safeStr(app.name),
      '\n\n\n',
      '',
    ]),
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 10,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 9,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
      cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
      valign: 'middle',
    },
    columnStyles: { 0: { cellWidth: scaledWidth(54) }, 1: { cellWidth: scaledWidth(54) }, 2: { cellWidth: scaledWidth(40) }, 3: { cellWidth: scaledWidth(34) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 14: Additional Information
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 14 – Additional Information', 'Seksi 14 – Informasi Tambahan', false);

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    body: [
      [
        {
          content: formatBilingualCell(data.additionalInformationEn || data.additionalInformation || '-', data.additionalInformationId),
          styles: {
            fontSize: 10,
            textColor: COLOR_BLACK,
            lineWidth: 0.25,
            lineColor: COLOR_BOX_BORDER,
            cellPadding: 3,
          },
        },
      ],
    ],
  });

  // --------------------------------------------------------------------------
  // FINALIZE: HEADERS, FOOTERS & SAVE
  // --------------------------------------------------------------------------
  drawAllHeadersAndFooters(doc, false, dmeLogo, ndcLogo);

  const cleanTitle = (data.documentTitle || 'DME_SOP').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanTitle}.pdf`);
}

// ============================================================================
// EXPORT EOP TO PDF (100% IDENTICAL TO DOCX EXPORT)
// ============================================================================
export async function exportEOPToPdf(data: EOPDocumentData): Promise<void> {
  const [dmeLogo, ndcLogo] = await Promise.all([
    loadImgDataUrl(logoDMEOriginal),
    loadImgDataUrl(logoNDCOriginal),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  let curY = TOP_CONTENT_Y_EOP;

  // --------------------------------------------------------------------------
  // SECTION 1: Document Overview
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 1 – Document Overview', 'Seksi 1 – Gambaran Umum Dokumen', true);

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    body: [
      [
        { content: 'Document Title\nJudul Dokumen', styles: { fontStyle: 'normal', textColor: COLOR_BLACK } },
        { content: `: ${data.documentTitle || '-'}\n: ${data.documentTitle || '-'}`, styles: { textColor: COLOR_BLACK } },
      ],
      [
        { content: 'Document Purpose\nTujuan Dokumen', styles: { fontStyle: 'normal', textColor: COLOR_BLACK } },
        { content: `: ${data.documentPurposeEn || '-'}\n: ${data.documentPurposeId || ensureBilingualTranslation(data.documentPurposeEn || '-')}`, styles: { textColor: COLOR_BLACK } },
      ],
      [
        { content: 'Work Location\nLokasi Kerja', styles: { fontStyle: 'normal', textColor: COLOR_BLACK } },
        { content: `: ${data.workLocationEn || 'Neutra DC Cikarang'}\n: ${data.workLocationId || 'Neutra DC Cikarang'}`, styles: { textColor: COLOR_BLACK } },
      ],
    ],
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 1.2, bottom: 1.2, left: 0.5, right: 0.5 }, valign: 'top' },
    columnStyles: { 0: { cellWidth: docxWidth(2280) }, 1: { cellWidth: docxWidth(6736) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 2: Referenced Document / Attachments
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 2 – Referenced Document / Attachments', 'Seksi 2 – Dokumen Referensi / Lampiran', true);

  const refDocs = (data.referencedDocuments && data.referencedDocuments.length > 0)
    ? data.referencedDocuments
    : [{ name: '-', number: '-' }];

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    head: [
      [
        { content: 'Document Name\nNama Dokumen', styles: { fontStyle: 'normal' } },
        { content: 'Document Number\nNomor Dokumen', styles: { fontStyle: 'normal' } },
      ],
    ],
    body: refDocs.map((rd) => [safeStr(rd.name), safeStr(rd.number)]),
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 10,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 9,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
    },
    columnStyles: { 0: { cellWidth: docxWidth(6516) }, 1: { cellWidth: docxWidth(2500) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 3: Environmental, Health & Safety
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 3 – Environmental, Health & Safety', 'Seksi 3 – Lingkungan, Kesehatan & Keselamatan Kerja', true);

  const eopEhs = data.ehsRequirements || {
    ppeEn: 'Wear Personal Protective Equipment (PPE) such as rubber gloves and footwear, protective eye wear, and protective helmet.',
    ppeId: 'Gunakan Alat Pelindung Diri (APD) seperti sarung tangan karet dan sepatu bot, kacamata pelindung, dan helm pelindung.',
    commsEn: 'Communication device such as handy-talkie (HT) is on hand.',
    commsId: 'Perangkat komunikasi seperti handy-talkie (HT) tersedia / siap digunakan.',
  };

  const orderedEhsItems = eopEhs.items && eopEhs.items.length > 0
    ? eopEhs.items
    : [
        { textEn: eopEhs.ppeEn, textId: eopEhs.ppeId },
        { textEn: eopEhs.commsEn, textId: eopEhs.commsId },
        ...(eopEhs.additionalItems || []),
      ];

  const eopEhsItems = orderedEhsItems.map((item, idx) => [
    `${idx + 1}. ${item.textEn || item.textId}`,
    `${idx + 1}. ${ensureBilingualTranslation(item.textEn, item.textId)}`,
  ]);

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    head: [[{ content: 'Requirements\nPersyaratan', styles: { fontStyle: 'normal' } }]],
    body: eopEhsItems.map(([en, id]) => [`${en}\n${id}`]),
    // Keep the same visible row boundaries as the DOCX EHS checklist.
    // Without a grid, this was the table that appeared to be missing in PDF.
    pageBreak: 'avoid',
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 10,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 9,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 4: Work Instruction / Procedure
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 4 – Work Instruction / Procedure', 'Seksi 4 – Instruksi / Prosedur Kerja', true);

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    body: [
      [
        {
          content: 'Expected Conditions / Equipment Status:\nKondisi yang Diharapkan / Status Peralatan:',
          styles: { fontStyle: 'normal', fontSize: 9, textColor: COLOR_BLACK },
        },
      ],
      ...(data.expectedConditionsEn || data.expectedConditionsId ? [
        [
          {
            content: formatBilingualCell(data.expectedConditionsEn, data.expectedConditionsId),
            styles: { fontSize: 9, textColor: COLOR_BLACK, cellPadding: { top: 0.5, bottom: 2, left: 0.5, right: 0.5 } },
          },
        ],
      ] : []),
    ],
  });

  curY = (doc as any).lastAutoTable.finalY + 2;

  // 5 columns matching DOCX: [No: 10, Action: 84, Expected Outcome: 48, Time: 20, Name: 20] = 182
  const eopStepRows = (data.workSteps || []).map((st, i) => {
    const stepNo = st.no || i + 1;
    const cleanActionEn = (st.actionEn || '-').replace(/^\s*\d+[\.\)]\s*/, '').trim() || '-';
    const cleanActionId = ensureBilingualTranslation(cleanActionEn, st.actionId).replace(/^\s*\d+[\.\)]\s*/, '').trim();
    const cleanOutcomeEn = (st.expectedOutcomeEn || '-').replace(/^\s*\d+[\.\)]\s*/, '').trim() || '-';
    const cleanOutcomeId = ensureBilingualTranslation(cleanOutcomeEn, st.expectedOutcomeId).replace(/^\s*\d+[\.\)]\s*/, '').trim();

    return [
      `${stepNo}.`,
      `${cleanActionEn}\n${cleanActionId}`,
      `${cleanOutcomeEn}\n${cleanOutcomeId}`,
      safeStr(st.time).replace(/^-$/, ''),
      safeStr(st.name).replace(/^-$/, ''),
    ];
  });

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    // Match the rendered DOCX work-step grid on every continued page.
    theme: 'grid',
    head: [
      [
        { content: 'No', styles: { fontStyle: 'normal', halign: 'center' } },
        { content: 'Action\nTindakan', styles: { fontStyle: 'normal' } },
        { content: 'Expected Outcome\nHasil yang Diharapkan', styles: { fontStyle: 'normal' } },
        { content: 'Time\nWaktu', styles: { fontStyle: 'normal', halign: 'center' } },
        { content: 'Name\nNama', styles: { fontStyle: 'normal', halign: 'center' } },
      ],
    ],
    body: eopStepRows.length > 0 ? eopStepRows : [['1.', '-\n-', '-\n-', '', '']],
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 10,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 9,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: docxWidth(455), halign: 'center' },
      1: { cellWidth: docxWidth(4785) },
      2: { cellWidth: docxWidth(2064) },
      3: { cellWidth: docxWidth(855), halign: 'center' },
      4: { cellWidth: docxWidth(857), halign: 'center' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 5: Document Information
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 5 – Document Information', 'Seksi 5 – Informasi Dokumen', true);

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    body: [
      [
        { content: 'Author\nPenulis', styles: { fontStyle: 'normal' } },
        { content: `: ${data.author || 'Alif Darmawan'}\n: ${data.author || 'Alif Darmawan'}` },
        { content: 'Date of Creation\nTanggal Pembuatan', styles: { fontStyle: 'normal' } },
        { content: `: ${data.dateOfCreation || '07 Sep 2026'}\n: ${data.dateOfCreation || '07 Sep 2026'}` },
      ],
      [
        { content: 'Next Date Revision\nTanggal Revisi Berikutnya', styles: { fontStyle: 'normal' } },
        { content: `: ${data.nextDateRevision || 'N/A'}\n: ${data.nextDateRevision === 'N/A' || !data.nextDateRevision ? 'T/A' : data.nextDateRevision}` },
        { content: 'Revision Number\nNomor Revisi', styles: { fontStyle: 'normal' } },
        { content: `: ${data.revisionNumber || '00'}\n: ${data.revisionNumber || '00'}` },
      ],
    ],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }, textColor: COLOR_BLACK },
    columnStyles: { 0: { cellWidth: docxWidth(2200) }, 1: { cellWidth: docxWidth(2308) }, 2: { cellWidth: docxWidth(2200) }, 3: { cellWidth: docxWidth(2308) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 6: Dry Run
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 6 – Dry Run', 'Seksi 6 – Uji Coba (Dry Run)', true);

  const eopDryRun = data.dryRun;
  const hasDryRunValues = !!(eopDryRun && ((eopDryRun.name && eopDryRun.name !== '-' && eopDryRun.name.trim() !== '') || (eopDryRun.date && eopDryRun.date !== '-' && eopDryRun.date.trim() !== '')));

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    head: [
      [
        { content: 'Job Title:\nJabatan:', styles: { fontStyle: 'normal' } },
        { content: 'Name:\nNama:', styles: { fontStyle: 'normal' } },
        { content: 'Signature:\nTanda Tangan:', styles: { fontStyle: 'normal' } },
        { content: 'Date:\nTanggal:', styles: { fontStyle: 'normal' } },
      ],
    ],
    body: hasDryRunValues && eopDryRun ? [
      [
        safeStr(eopDryRun.jobTitle).replace(/^-$/, ''),
        safeStr(eopDryRun.name).replace(/^-$/, ''),
        '',
        safeStr(eopDryRun.date).replace(/^-$/, ''),
      ],
    ] : [
      ['\n', '\n', '\n', '\n'],
    ],
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 10,
      lineWidth: { bottom: 0.25 },
      lineColor: COLOR_DIVIDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 9,
      cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
    },
    columnStyles: { 0: { cellWidth: docxWidth(2254) }, 1: { cellWidth: docxWidth(2254) }, 2: { cellWidth: docxWidth(2254) }, 3: { cellWidth: docxWidth(2254) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 7: Approval (NEW PAGE matching Master EOP)
  // --------------------------------------------------------------------------
  doc.addPage();
  curY = TOP_CONTENT_Y_EOP;

  curY = renderSectionBanner(doc, curY, 'Section 7 – Approval', 'Seksi 7 – Persetujuan', true);

  const eopDefaultApprovals = [
    { roleEn: 'Project Manager', roleId: 'Manajer Proyek', name: 'Dwi Tasmiyadi' },
    { roleEn: 'Chief Engineering', roleId: 'Kepala Engineering', name: 'Habib Mulyana' },
    { roleEn: 'Facility Manager', roleId: 'Manajer Fasilitas', name: 'Supriyatno' },
    { roleEn: 'Assistant Manager HDC', roleId: 'Asisten Manajer HDC', name: 'Budi Susanto' },
  ];

  const eopApprovalList = (data.approvals && data.approvals.length > 0) ? data.approvals : eopDefaultApprovals;

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'grid',
    head: [
      [
        { content: 'Job Title\nJabatan', styles: { fontStyle: 'bold' } },
        { content: 'Name\nNama', styles: { fontStyle: 'bold' } },
        { content: 'Signature\nTanda Tangan', styles: { fontStyle: 'bold', halign: 'center' } },
        { content: 'Date\nTanggal', styles: { fontStyle: 'bold', halign: 'center' } },
      ],
    ],
    body: eopApprovalList.map((app) => [
      formatBilingualCell(app.roleEn, app.roleId),
      safeStr(app.name),
      '\n\n\n',
      '',
    ]),
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLOR_BLACK,
      fontSize: 10,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
    },
    bodyStyles: {
      textColor: COLOR_BLACK,
      fontSize: 9,
      lineWidth: 0.2,
      lineColor: COLOR_BOX_BORDER,
      cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
      valign: 'middle',
    },
    columnStyles: { 0: { cellWidth: scaledWidth(54) }, 1: { cellWidth: scaledWidth(54) }, 2: { cellWidth: scaledWidth(40) }, 3: { cellWidth: scaledWidth(34) } },
  });

  curY = (doc as any).lastAutoTable.finalY + 4;

  // --------------------------------------------------------------------------
  // SECTION 8: Additional Information
  // --------------------------------------------------------------------------
  curY = renderSectionBanner(doc, curY, 'Section 8 – Additional Information', 'Seksi 8 – Informasi Tambahan', true);

  autoTable(doc, {
    startY: curY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: TOP_CONTENT_Y, bottom: 16 },
    theme: 'plain',
    body: [
      [
        {
          content: formatBilingualCell(data.additionalInformationEn || data.additionalInformation || '-', data.additionalInformationId),
          styles: {
            fontSize: 10,
            textColor: COLOR_BLACK,
            lineWidth: 0.25,
            lineColor: COLOR_BOX_BORDER,
            cellPadding: 3,
          },
        },
      ],
    ],
  });

  // --------------------------------------------------------------------------
  // FINALIZE: HEADERS, FOOTERS & SAVE
  // --------------------------------------------------------------------------
  drawAllHeadersAndFooters(doc, true, dmeLogo, ndcLogo);

  const cleanTitle = (data.documentTitle || 'DME_EOP').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanTitle}.pdf`);
}
