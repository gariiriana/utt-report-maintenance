// ============================================================================
// FILE: frontend/utils/sopEopDocxExport.ts
// Deskripsi: Engine Ekspor Dokumen SOP & EOP ke Microsoft Word (.docx)
//            Sesuai Standar Format Korporat DME & NeutraDC Cikarang (1:1)
// ============================================================================

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
  ShadingType,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import { saveAs } from 'file-saver';
import { SOPDocumentData, EOPDocumentData } from '@/types/sopEopTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';

/** Helper to convert base64 or URL to Uint8Array for docx ImageRun */
function base64ToUint8Array(base64: string): Uint8Array {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function loadImageAsUint8Array(src: string): Promise<Uint8Array> {
  if (!src) return new Uint8Array();
  if (src.startsWith('data:image')) {
    return base64ToUint8Array(src);
  }
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
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/png');
          resolve(base64ToUint8Array(dataURL));
          return;
        }
      } catch (e) {
        console.warn('Canvas export failed:', e);
      }
      resolve(new Uint8Array());
    };
    img.onerror = () => resolve(new Uint8Array());
    img.src = src;
  });
}

// Border Styles
const THIN_BORDER = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: '999999',
};

const CELL_BORDERS_ALL = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
};

const CELL_NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};

/** Helper to build a colored Section Banner table */
function createSectionBanner(titleEn: string, titleId?: string, isEOP = false): Table {
  const bgColor = isEOP ? 'FF00FF' : 'EE0000'; // EOP: Magenta, SOP: Red
  const textChildren = [
    new TextRun({
      text: titleEn,
      bold: true,
      color: 'FFFFFF',
      size: 22, // 11pt
      font: 'Calibri',
    }),
  ];

  if (titleId) {
    textChildren.push(
      new TextRun({
        text: ` ${titleId}`,
        bold: true,
        color: 'FFFFFF',
        size: 22,
        font: 'Calibri',
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: bgColor, color: 'auto' },
            borders: CELL_NO_BORDER,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: textChildren,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Helper to create spaced paragraph */
function createSpacer(height = 100): Paragraph {
  return new Paragraph({
    spacing: { before: height, after: 0 },
    children: [],
  });
}

/**
 * ============================================================================
 * EXPORT SOP TO DOCX
 * ============================================================================
 */
export async function exportSOPToDocx(data: SOPDocumentData): Promise<void> {
  const [dmeLogoBytes, ndcLogoBytes] = await Promise.all([
    loadImageAsUint8Array(logoDwimitra),
    loadImageAsUint8Array(logoNeutraDC),
  ]);

  // Document Content Elements
  const children: (Paragraph | Table)[] = [];

  // --------------------------------------------------------------------------
  // SECTION 1: Document Overview
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 1 – Document Overview', 'Seksi 1 – Gambaran Umum Dokumen', false));
  children.push(createSpacer(60));

  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: 'Document Title : ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.documentTitle || '-', size: 20, font: 'Calibri' }),
        new TextRun({ text: '  Judul Dokumen : ', bold: true, italics: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.documentTitle || '-', italics: true, size: 20, font: 'Calibri' }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: 'Document Purpose : ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.documentPurposeEn || '-', size: 20, font: 'Calibri' }),
        new TextRun({ text: '\nTujuan Dokumen : ', bold: true, italics: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.documentPurposeId || '-', italics: true, size: 20, font: 'Calibri' }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: 'Work Location : ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.workLocationEn || 'Neutra DC Cikarang', size: 20, font: 'Calibri' }),
        new TextRun({ text: '  Lokasi Kerja : ', bold: true, italics: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.workLocationId || 'Neutra DC Cikarang', italics: true, size: 20, font: 'Calibri' }),
      ],
    })
  );

  // --------------------------------------------------------------------------
  // SECTION 2: Equipment Information
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 2 – Equipment Information', 'Seksi 2 – Informasi Peralatan', false));
  children.push(createSpacer(60));

  // Equipment Table Header
  const equipHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      'No\nNo',
      'Class id\nID Kelas',
      'CI Name*\nNama CI*',
      'CI Description*\nDeskripsi CI*',
      'Capacity\nKapasitas',
      'Serial Number\nNomor Seri',
      'MFD\nTahun MFD',
      'Product Name\nNama Produk',
      'Model\nModel',
      'Room\nRuangan',
    ].map(
      (h) =>
        new TableCell({
          borders: CELL_BORDERS_ALL,
          shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
          margins: { top: 60, bottom: 60, left: 60, right: 60 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: h, bold: true, size: 16, font: 'Calibri' })],
            }),
          ],
        })
    ),
  });

  const equipDataRows = (data.equipmentList || []).map((eq, i) => {
    return new TableRow({
      children: [
        String(eq.no || i + 1),
        eq.classId || 'TR',
        eq.ciName || '-',
        eq.ciDescription || '-',
        eq.capacity || '-',
        eq.serialNumber || '-',
        eq.mfd || '-',
        eq.productName || '-',
        eq.model || '-',
        eq.room || '-',
      ].map(
        (val, colIdx) =>
          new TableCell({
            borders: CELL_BORDERS_ALL,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: colIdx === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: [new TextRun({ text: val, size: 16, font: 'Calibri' })],
              }),
            ],
          })
      ),
    });
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [equipHeaderRow, ...equipDataRows],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 3: Schedule / Work Information
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 3 – Schedule / Work Information', 'Seksi 3 – Informasi Jadwal / Pekerjaan', false));
  children.push(createSpacer(60));

  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: 'SOP Execution Date: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.executionDate || '-', size: 20, font: 'Calibri' }),
        new TextRun({ text: '  Reference Ticket Number: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.referenceTicketNumber || '-', size: 20, font: 'Calibri' }),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F9FAFB', color: 'auto' },
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Executed by (Name):\n', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: data.executedByName || '-', size: 20, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F9FAFB', color: 'auto' },
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Job title:\n', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: data.executedByJobTitle || '-', size: 20, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 4: Affected Equipment / Systems
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 4 – Affected Equipment / Systems', 'Seksi 4 – Peralatan / Sistem yang Terdampak', false));
  children.push(createSpacer(60));

  // Grid 3 columns of affected systems checkboxes
  const systems = data.affectedSystems || [];
  const systemRows: TableRow[] = [];
  for (let i = 0; i < systems.length; i += 3) {
    const chunk = systems.slice(i, i + 3);
    const cells = chunk.map(
      (sys) =>
        new TableCell({
          width: { size: 33.33, type: WidthType.PERCENTAGE },
          borders: CELL_BORDERS_ALL,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: sys.checked ? '☒ ' : '☐ ', bold: true, size: 20, font: 'Calibri' }),
                new TextRun({ text: sys.labelEn, bold: true, size: 16, font: 'Calibri' }),
                new TextRun({ text: `\n${sys.labelId}`, italics: true, size: 15, font: 'Calibri', color: '555555' }),
              ],
            }),
          ],
        })
    );
    // Pad row if less than 3
    while (cells.length < 3) {
      cells.push(
        new TableCell({
          width: { size: 33.33, type: WidthType.PERCENTAGE },
          borders: CELL_BORDERS_ALL,
          children: [new Paragraph({})],
        })
      );
    }
    systemRows.push(new TableRow({ children: cells }));
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: systemRows,
    })
  );

  children.push(
    new Paragraph({
      spacing: { before: 60, after: 40 },
      children: [
        new TextRun({
          text: 'If any of the item above is checked, do provide details for each item respectively:\nJika ada item di atas yang dicentang, berikan rincian untuk masing-masing item tersebut:',
          italics: true,
          size: 16,
          font: 'Calibri',
          color: '555555',
        }),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: CELL_BORDERS_ALL,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: data.affectedSystemsDetails || '-', size: 18, font: 'Calibri' })],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 5: Referenced Documents / Attachments
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 5 – Referenced Documents / Attachments', 'Seksi 5 – Dokumen Referensi / Lampiran', false));
  children.push(createSpacer(60));

  const refDocs = data.referencedDocuments && data.referencedDocuments.length > 0
    ? data.referencedDocuments
    : [{ name: '-', number: '-' }];

  const refDocRows = refDocs.map(
    (docItem) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS_ALL,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [new Paragraph({ children: [new TextRun({ text: docItem.name || '-', size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS_ALL,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [new Paragraph({ children: [new TextRun({ text: docItem.number || '-', size: 18, font: 'Calibri' })] })],
          }),
        ],
      })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Document Name / Nama Dokumen', bold: true, size: 18, font: 'Calibri' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Document Number / Nomor Dokumen', bold: true, size: 18, font: 'Calibri' })],
                }),
              ],
            }),
          ],
        }),
        ...refDocRows,
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 6: Environmental, Health & Safety (EHS)
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 6 – Enviromental , Health & Safety', 'Seksi 6 – Lingkungan, Kesehatan & Keselamatan Kerja', false));
  children.push(createSpacer(60));

  const ehs = data.ehsRequirements || {
    ppeEn: '1. Wear Personal Protective Equipment (PPE) such as rubber gloves and footwear, protective eye wear, and protective helmet.',
    ppeId: '1. Gunakan Alat Pelindung Diri (APD) seperti sarung tangan karet dan sepatu keselamatan, kacamata pelindung, serta helm pelindung.',
    jewelryEn: '2. Remove rings and metal wrist watches, jewelry, or any metal objects kept in the clothes pocket.',
    jewelryId: '2. Lepaskan cincin dan jam tangan logam, perhiasan, atau benda logam apa pun yang disimpan di dalam saku pakaian.',
    commsEn: '3. Communication device such as handy-talkie (HT) is on hand.',
    commsId: '3. Perangkat komunikasi seperti handy-talkie (HT) siap digunakan.',
    lotoEn: '4. Lock-Out / Tag-Out devices and tools.',
    lotoId: '4. Peralatan dan perlengkapan Lock-Out / Tag-Out.'
  };

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        { en: ehs.ppeEn, id: ehs.ppeId },
        { en: ehs.jewelryEn, id: ehs.jewelryId },
        { en: ehs.commsEn, id: ehs.commsId },
        { en: ehs.lotoEn, id: ehs.lotoId },
      ].map(
        (item) =>
          new TableRow({
            children: [
              new TableCell({
                borders: CELL_BORDERS_ALL,
                margins: { top: 40, bottom: 40, left: 60, right: 60 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${item.en}\n`, size: 17, font: 'Calibri' }),
                      new TextRun({ text: item.id, italics: true, size: 16, font: 'Calibri', color: '444444' }),
                    ],
                  }),
                ],
              }),
            ],
          })
      ),
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 7: Prerequisites
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 7 – Prerequisites', 'Seksi 7 – Prasyarat', false));
  children.push(createSpacer(60));

  const prereqs = data.prerequisites && data.prerequisites.length > 0 ? data.prerequisites : [];
  const prereqRows = prereqs.map(
    (p) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS_ALL,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${p.requirementEn}\n`, size: 17, font: 'Calibri' }),
                  new TextRun({ text: p.requirementId, italics: true, size: 16, font: 'Calibri', color: '444444' }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS_ALL,
            margins: { top: 40, bottom: 40, left: 40, right: 40 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.time || '-', size: 17, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS_ALL,
            margins: { top: 40, bottom: 40, left: 40, right: 40 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.initial || '-', size: 17, font: 'Calibri' })] })],
          }),
        ],
      })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ children: [new TextRun({ text: 'Requirements / Persyaratan', bold: true, size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 40, right: 40 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Time / Waktu', bold: true, size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 40, right: 40 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Initial / Inisial', bold: true, size: 18, font: 'Calibri' })] })],
            }),
          ],
        }),
        ...prereqRows,
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 8: Dry Run
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 8 – Dry Run', 'Seksi 8 – Uji Coba (Dry Run)', false));
  children.push(createSpacer(60));

  const dry = data.dryRun || { jobTitle: 'Chief Engineering', name: 'Habib Mulyana', date: '07 Sep 2026' };
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: CELL_BORDERS_ALL,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Completed by:  ', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: 'Diselesaikan oleh:\n', italics: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: `Job Title / Jabatan: ${dry.jobTitle || '-'}\n`, size: 18, font: 'Calibri' }),
                    new TextRun({ text: `Name / Nama: ${dry.name || '-'}\n`, size: 18, font: 'Calibri' }),
                    new TextRun({ text: `Date / Tanggal: ${dry.date || '-'}\n`, size: 18, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 9: Maintenance Period
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 9 – Maintenance Periode', 'Seksi 9 – Periode Pemeliharaan', false));
  children.push(createSpacer(60));

  const is6Mo = data.maintenancePeriod === '6_months';
  const isAnnual = data.maintenancePeriod === 'annual';

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: is6Mo ? '☒ ' : '☐ ', bold: true, size: 22, font: 'Calibri' }),
                    new TextRun({ text: '6 Months ', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: '6 Bulan', italics: true, size: 18, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: isAnnual ? '☒ ' : '☐ ', bold: true, size: 22, font: 'Calibri' }),
                    new TextRun({ text: 'Annual ', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: 'Tahunan', italics: true, size: 18, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 10: Work Instruction / Procedures
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 10 – Work Instruction / Procedures', 'Seksi 10 – Instruksi / Prosedur Kerja', false));
  children.push(createSpacer(60));

  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: data.conditionsPriorToExecutionEn || 'Conditions / Equipment status prior to SOP Execution:', bold: true, size: 18, font: 'Calibri' }),
        new TextRun({ text: `\n${data.conditionsPriorToExecutionId || 'Kondisi / Status peralatan sebelum Pelaksanaan SOP:'}`, italics: true, size: 17, font: 'Calibri', color: '444444' }),
      ],
    })
  );

  const steps = data.workSteps || [];
  const stepRows = steps.map((s, idx) => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: CELL_BORDERS_ALL,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${s.actionEn || `${idx + 1}. -`}\n`, size: 17, font: 'Calibri' }),
                new TextRun({ text: s.actionId || '', italics: true, size: 16, font: 'Calibri', color: '444444' }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 34, type: WidthType.PERCENTAGE },
          borders: CELL_BORDERS_ALL,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${s.expectedOutcomeEn || '-'}\n`, size: 17, font: 'Calibri' }),
                new TextRun({ text: s.expectedOutcomeId || '', italics: true, size: 16, font: 'Calibri', color: '444444' }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          borders: CELL_BORDERS_ALL,
          margins: { top: 40, bottom: 40, left: 30, right: 30 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.time || '-', size: 16, font: 'Calibri' })] })],
        }),
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          borders: CELL_BORDERS_ALL,
          margins: { top: 40, bottom: 40, left: 30, right: 30 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.initial || '-', size: 16, font: 'Calibri' })] })],
        }),
      ],
    });
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ children: [new TextRun({ text: 'Action / Tindakan', bold: true, size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 34, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ children: [new TextRun({ text: 'Expected Outcome / Hasil yang Diharapkan', bold: true, size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 30, right: 30 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Time', bold: true, size: 16, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 30, right: 30 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Initial', bold: true, size: 16, font: 'Calibri' })] })],
            }),
          ],
        }),
        ...stepRows,
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 11: Back Out Procedures
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 11 – Back Out Procedures', 'Seksi 11 – Prosedur Pemulihan (Back Out)', false));
  children.push(createSpacer(60));

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: CELL_BORDERS_ALL,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: data.backOutProcedure || 'N/A (T/A)', size: 18, font: 'Calibri' })],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 12: Document Information
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 12 – Document Information', 'Seksi 12 – Informasi Dokumen', false));
  children.push(createSpacer(60));

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Author / Penulis: ', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: data.author || '-', size: 18, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Date of Creation / Tanggal Pembuatan: ', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: data.dateOfCreation || '-', size: 18, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Date Revision / Tanggal Revisi: ', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: data.dateRevision || 'N/A', size: 18, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Revision Number / Nomor Revisi: ', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: data.revisionNumber || '0', size: 18, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 13: Approval
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 13 – Approval', 'Seksi 13 – Persetujuan', false));
  children.push(createSpacer(60));

  const approvers = data.approvals || [
    { roleEn: 'Project Manager', roleId: 'Manajer Proyek', name: 'Dwi Tasmiyadi' },
    { roleEn: 'Chief Engineering', roleId: 'Kepala Engineering', name: 'Habib Mulyana' },
    { roleEn: 'Facility Manager', roleId: 'Manajer Fasilitas', name: 'Supriyatno' },
    { roleEn: 'Assistant Manager HDC', roleId: 'Asisten Manajer HDC', name: 'Budi Susanto' },
  ];

  const approvalCells = approvers.map(
    (app) =>
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: CELL_BORDERS_ALL,
        margins: { top: 60, bottom: 60, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: app.roleEn, bold: true, size: 16, font: 'Calibri' }),
              new TextRun({ text: `\n${app.roleId}`, italics: true, size: 15, font: 'Calibri', color: '555555' }),
              new TextRun({ text: '\n\n\n( Tanda Tangan )\n\n', size: 15, font: 'Calibri', color: '888888' }),
              new TextRun({ text: app.name || '-', bold: true, size: 17, font: 'Calibri' }),
            ],
          }),
        ],
      })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: approvalCells })],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 14: Additional Information
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 14 – Additional Information', 'Seksi 14 – Informasi Tambahan', false));
  children.push(createSpacer(60));

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: CELL_BORDERS_ALL,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: data.additionalInformation || '-', size: 18, font: 'Calibri' })],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // --------------------------------------------------------------------------
  // BUILD DOCUMENT
  // --------------------------------------------------------------------------
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        borders: CELL_NO_BORDER,
                        children: [
                          dmeLogoBytes.length > 0
                            ? new Paragraph({
                                children: [
                                  new ImageRun({
                                    data: dmeLogoBytes,
                                    transformation: { width: 110, height: 40 },
                                    type: 'png',
                                  }),
                                ],
                              })
                            : new Paragraph({ children: [new TextRun({ text: 'DME', bold: true })] }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: CELL_NO_BORDER,
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({
                                text: 'STANDARD OPERATING PROCEDURE\n',
                                bold: true,
                                size: 20,
                                font: 'Calibri',
                                color: 'CC0000',
                              }),
                              new TextRun({
                                text: 'NeutraDC – Cikarang',
                                bold: true,
                                size: 18,
                                font: 'Calibri',
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        borders: CELL_NO_BORDER,
                        children: [
                          ndcLogoBytes.length > 0
                            ? new Paragraph({
                                alignment: AlignmentType.RIGHT,
                                children: [
                                  new ImageRun({
                                    data: ndcLogoBytes,
                                    transformation: { width: 110, height: 38 },
                                    type: 'png',
                                  }),
                                ],
                              })
                            : new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'NeutraDC', bold: true })] }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new Paragraph({
                border: { bottom: { color: 'CC0000', size: 12, style: BorderStyle.SINGLE } },
                spacing: { after: 120 },
                children: [],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Page ', size: 18, font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Calibri' }),
                  new TextRun({ text: ' of ', size: 18, font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: 'Calibri' }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanTitle = (data.documentTitle || 'DME_SOP').replace(/[^a-zA-Z0-9_-]/g, '_');
  saveAs(blob, `${cleanTitle}.docx`);
}

/**
 * ============================================================================
 * EXPORT EOP TO DOCX
 * ============================================================================
 */
export async function exportEOPToDocx(data: EOPDocumentData): Promise<void> {
  const [dmeLogoBytes, ndcLogoBytes] = await Promise.all([
    loadImageAsUint8Array(logoDwimitra),
    loadImageAsUint8Array(logoNeutraDC),
  ]);

  const children: (Paragraph | Table)[] = [];

  // --------------------------------------------------------------------------
  // SECTION 1: Document Overview
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 1 – Document Overview', undefined, true));
  children.push(createSpacer(60));

  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: 'Document Title : ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.documentTitle || '-', size: 20, font: 'Calibri' }),
        new TextRun({ text: '  Judul Dokumen : ', bold: true, italics: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.documentTitle || '-', italics: true, size: 20, font: 'Calibri' }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: 'Document Purpose : ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.documentPurposeEn || '-', size: 20, font: 'Calibri' }),
        new TextRun({ text: '\nTujuan Dokumen : ', bold: true, italics: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.documentPurposeId || '-', italics: true, size: 20, font: 'Calibri' }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: 'Work Location : ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.workLocationEn || 'Neutra DC Cikarang', size: 20, font: 'Calibri' }),
        new TextRun({ text: '  Lokasi Kerja : ', bold: true, italics: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: data.workLocationId || 'Neutra DC Cikarang', italics: true, size: 20, font: 'Calibri' }),
      ],
    })
  );

  // --------------------------------------------------------------------------
  // SECTION 2: Referenced Document / Attachments
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 2 – Referenced Document / Attachments', undefined, true));
  children.push(createSpacer(60));

  const refDocs = data.referencedDocuments && data.referencedDocuments.length > 0
    ? data.referencedDocuments
    : [{ name: '-', number: '-' }];

  const refDocRows = refDocs.map(
    (docItem) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS_ALL,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [new Paragraph({ children: [new TextRun({ text: docItem.name || '-', size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS_ALL,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [new Paragraph({ children: [new TextRun({ text: docItem.number || '-', size: 18, font: 'Calibri' })] })],
          }),
        ],
      })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Document Name / Nama Dokumen', bold: true, size: 18, font: 'Calibri' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Document Number / Nomor Dokumen', bold: true, size: 18, font: 'Calibri' })],
                }),
              ],
            }),
          ],
        }),
        ...refDocRows,
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 3: Environmental, Health & Safety
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 3 – Enviromental , Health & Safety', undefined, true));
  children.push(createSpacer(60));

  const ehs = data.ehsRequirements || {
    ppeEn: '1. Wear Personal Protective Equipment (PPE) such as rubber gloves and footwear, protective eye wear, and protective helmet.',
    ppeId: '1. Gunakan Alat Pelindung Diri (APD) seperti sarung tangan karet dan sepatu bot, kacamata pelindung , dan helm pelindung .',
    commsEn: '2. Communication device such as handy-talkie (HT) is on hand.',
    commsId: '2. Perangkat komunikasi seperti handy-talkie (HT) tersedia / siap digunakan .',
  };

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        { en: ehs.ppeEn, id: ehs.ppeId },
        { en: ehs.commsEn, id: ehs.commsId },
      ].map(
        (item) =>
          new TableRow({
            children: [
              new TableCell({
                borders: CELL_BORDERS_ALL,
                margins: { top: 40, bottom: 40, left: 60, right: 60 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${item.en}\n`, size: 17, font: 'Calibri' }),
                      new TextRun({ text: item.id, italics: true, size: 16, font: 'Calibri', color: '444444' }),
                    ],
                  }),
                ],
              }),
            ],
          })
      ),
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 4: Work Instruction / Procedure
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 4 – Work Instruction / Procedure', undefined, true));
  children.push(createSpacer(60));

  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: data.expectedConditionsEn || 'Expected Conditions / Equipment Status:', bold: true, size: 18, font: 'Calibri' }),
        new TextRun({ text: `\n${data.expectedConditionsId || 'Kondisi yang Diharapkan / Status Peralatan:'}`, italics: true, size: 17, font: 'Calibri', color: '444444' }),
      ],
    })
  );

  const steps = data.workSteps || [];
  const stepRows = steps.map((s, idx) => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 6, type: WidthType.PERCENTAGE },
          borders: CELL_BORDERS_ALL,
          margins: { top: 40, bottom: 40, left: 30, right: 30 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${s.no || idx + 1}.`, size: 16, font: 'Calibri' })] })],
        }),
        new TableCell({
          width: { size: 44, type: WidthType.PERCENTAGE },
          borders: CELL_BORDERS_ALL,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${s.actionEn || '-'}\n`, size: 17, font: 'Calibri' }),
                new TextRun({ text: s.actionId || '', italics: true, size: 16, font: 'Calibri', color: '444444' }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 34, type: WidthType.PERCENTAGE },
          borders: CELL_BORDERS_ALL,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${s.expectedOutcomeEn || '-'}\n`, size: 17, font: 'Calibri' }),
                new TextRun({ text: s.expectedOutcomeId || '', italics: true, size: 16, font: 'Calibri', color: '444444' }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          borders: CELL_BORDERS_ALL,
          margins: { top: 40, bottom: 40, left: 30, right: 30 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.time || '-', size: 16, font: 'Calibri' })] })],
        }),
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          borders: CELL_BORDERS_ALL,
          margins: { top: 40, bottom: 40, left: 30, right: 30 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.name || '-', size: 16, font: 'Calibri' })] })],
        }),
      ],
    });
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 6, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 30, right: 30 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'No', bold: true, size: 16, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 44, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ children: [new TextRun({ text: 'Action / Tindakan', bold: true, size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 34, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ children: [new TextRun({ text: 'Expected Outcome / Hasil yang Diharapkan', bold: true, size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 30, right: 30 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Time', bold: true, size: 16, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 30, right: 30 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Name', bold: true, size: 16, font: 'Calibri' })] })],
            }),
          ],
        }),
        ...stepRows,
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 5: Document Information
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 5 – Document Information', undefined, true));
  children.push(createSpacer(60));

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Author / Penulis: ', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: data.author || '-', size: 18, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Date of Creation / Tanggal Pembuatan: ', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: data.dateOfCreation || '-', size: 18, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Next Date Revision / Tanggal Revisi Berikutnya: ', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: data.nextDateRevision || 'N/A', size: 18, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Revision Number / Nomor Revisi: ', bold: true, size: 18, font: 'Calibri' }),
                    new TextRun({ text: data.revisionNumber || '0', size: 18, font: 'Calibri' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 6: Dry Run
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 6 – Dry Run', undefined, true));
  children.push(createSpacer(60));

  const dry = data.dryRun || { jobTitle: 'Chief Engineering', name: 'Habib Mulyana', date: '07 Sep 2026' };
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ children: [new TextRun({ text: 'Job Title / Jabatan', bold: true, size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ children: [new TextRun({ text: 'Name / Nama', bold: true, size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Signature', bold: true, size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Date / Tanggal', bold: true, size: 18, font: 'Calibri' })] })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ children: [new TextRun({ text: dry.jobTitle || '-', size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ children: [new TextRun({ text: dry.name || '-', size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '( Tanda Tangan )', size: 16, font: 'Calibri', color: '888888' })] })],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS_ALL,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: dry.date || '-', size: 18, font: 'Calibri' })] })],
            }),
          ],
        }),
      ],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 7: Approval
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 7 – Approval', undefined, true));
  children.push(createSpacer(60));

  const approvers = data.approvals || [
    { roleEn: 'Project Manager', roleId: 'Manajer Proyek', name: 'Dwi Tasmiyadi' },
    { roleEn: 'Chief Engineering', roleId: 'Kepala Engineering', name: 'Habib Mulyana' },
    { roleEn: 'Facility Manager', roleId: 'Manajer Fasilitas', name: 'Supriyatno' },
    { roleEn: 'Assistant Manager HDC', roleId: 'Asisten Manajer HDC', name: 'Budi Susanto' },
  ];

  const approvalCells = approvers.map(
    (app) =>
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: CELL_BORDERS_ALL,
        margins: { top: 60, bottom: 60, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: app.roleEn, bold: true, size: 16, font: 'Calibri' }),
              new TextRun({ text: `\n${app.roleId}`, italics: true, size: 15, font: 'Calibri', color: '555555' }),
              new TextRun({ text: '\n\n\n( Tanda Tangan )\n\n', size: 15, font: 'Calibri', color: '888888' }),
              new TextRun({ text: app.name || '-', bold: true, size: 17, font: 'Calibri' }),
            ],
          }),
        ],
      })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: approvalCells })],
    })
  );
  children.push(createSpacer(120));

  // --------------------------------------------------------------------------
  // SECTION 8: Additional Information
  // --------------------------------------------------------------------------
  children.push(createSectionBanner('Section 8 – Additional Information', undefined, true));
  children.push(createSpacer(60));

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: CELL_BORDERS_ALL,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: data.additionalInformation || '-', size: 18, font: 'Calibri' })],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // --------------------------------------------------------------------------
  // BUILD DOCUMENT
  // --------------------------------------------------------------------------
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        borders: CELL_NO_BORDER,
                        children: [
                          dmeLogoBytes.length > 0
                            ? new Paragraph({
                                children: [
                                  new ImageRun({
                                    data: dmeLogoBytes,
                                    transformation: { width: 110, height: 40 },
                                    type: 'png',
                                  }),
                                ],
                              })
                            : new Paragraph({ children: [new TextRun({ text: 'DME', bold: true })] }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: CELL_NO_BORDER,
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({
                                text: 'EMERGENCY OPERATING PROCEDURE\n',
                                bold: true,
                                size: 20,
                                font: 'Calibri',
                                color: 'CC0099',
                              }),
                              new TextRun({
                                text: 'NeutraDC – Cikarang',
                                bold: true,
                                size: 18,
                                font: 'Calibri',
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        borders: CELL_NO_BORDER,
                        children: [
                          ndcLogoBytes.length > 0
                            ? new Paragraph({
                                alignment: AlignmentType.RIGHT,
                                children: [
                                  new ImageRun({
                                    data: ndcLogoBytes,
                                    transformation: { width: 110, height: 38 },
                                    type: 'png',
                                  }),
                                ],
                              })
                            : new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'NeutraDC', bold: true })] }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new Paragraph({
                border: { bottom: { color: 'CC0099', size: 12, style: BorderStyle.SINGLE } },
                spacing: { after: 120 },
                children: [],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Page ', size: 18, font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Calibri' }),
                  new TextRun({ text: ' of ', size: 18, font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: 'Calibri' }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanTitle = (data.documentTitle || 'DME_EOP').replace(/[^a-zA-Z0-9_-]/g, '_');
  saveAs(blob, `${cleanTitle}.docx`);
}
