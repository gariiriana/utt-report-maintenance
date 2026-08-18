// ============================================================================
// FILE: frontend/utils/generateMonthlyReportDOCX.ts
// Deskripsi: Generator Dokumen Microsoft Word (.docx) Resmi untuk Monthly Report.
//            Mengikuti standar dokumen resmi NeutraDC Cikarang:
//            - Cover Page (PREVENTIVE MAINTENANCE REPORT Q1- FEBRUARY, HDC Cikarang)
//            - Lembar Pengesahan 6 Orang (Approval Sheet: Dwi Tasmiyadi, Arif Budiman + TTD, OCS, TDE)
//            - Table of Contents & List of Tables
//            - Bab 1 - Bab 13 (Tabel 1 - Tabel 36) dengan styling warna Biru Resmi (#1E64B4 & #92B8DE)
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
  Header,
  Footer,
  PageNumber,
  HeadingLevel
} from 'docx';
import { saveAs } from 'file-saver';
import { FullMonthlyReportData } from './monthlyReportData';
import { ARIF_BUDIMAN_SIGNATURE_BASE64 } from './engineerSignatures';
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
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 600;
      canvas.height = img.naturalHeight || 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        resolve(base64ToUint8Array(dataUrl));
      } else {
        resolve(new Uint8Array());
      }
    };
    img.onerror = () => resolve(new Uint8Array());
    img.src = src;
  });
}

// Styling Constants (Blue Palette from Official PDF)
const COLOR_HEADER_BLUE = "1E64B4"; // Deep Blue Header
const COLOR_SUBHEADER_BLUE = "92B8DE"; // Light Blue Category Accent
const COLOR_BORDER = "9CA3AF"; // Gray border

const borderThin = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER }
};

const borderNone = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE }
};

/**
 * Generates the authentic Telkom Data Ekosistem colorful circuit graphic as PNG bytes
 */
function createTelkomCircuitFooterBytes(): Uint8Array {
  if (typeof document === 'undefined') return new Uint8Array();
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 90;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8Array();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const drawTrace = (
    points: [number, number][],
    color: string,
    width = 2.4,
    dotAtEnd = true,
    dotRadius = 3.8
  ) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.stroke();

    if (dotAtEnd) {
      const last = points[points.length - 1];
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(last[0], last[1], dotRadius, 0, Math.PI * 2);
      ctx.fill();

      // Hollow inner center circle
      ctx.beginPath();
      ctx.fillStyle = '#FFFFFF';
      ctx.arc(last[0], last[1], dotRadius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Red / Rose / Crimson Traces (Primary)
  drawTrace([[0, 68], [35, 68], [75, 28], [130, 28], [155, 53], [205, 53]], '#E11D48', 2.8, true, 4.2);
  drawTrace([[8, 85], [55, 38], [105, 38], [135, 8], [180, 8]], '#E11D48', 2.8, true, 4.2);
  drawTrace([[45, 85], [82, 48], [120, 48], [148, 20], [195, 20]], '#BE123C', 2.2, true, 3.8);

  // Amber / Gold Traces
  drawTrace([[0, 48], [28, 20], [65, 20], [92, 48], [140, 48], [168, 20], [215, 20]], '#F59E0B', 2.4, true, 3.8);
  drawTrace([[25, 85], [68, 42], [110, 42], [135, 67], [185, 67]], '#FBBF24', 2.2, true, 3.6);

  // Gray / Silver / Charcoal Traces
  drawTrace([[0, 28], [18, 10], [50, 10], [78, 38], [118, 38], [145, 65], [190, 65]], '#64748B', 2.2, true, 3.6);
  drawTrace([[15, 85], [45, 55], [88, 55], [112, 79], [155, 79]], '#94A3B8', 2.0, true, 3.4);

  const dataUrl = canvas.toDataURL('image/png');
  return base64ToUint8Array(dataUrl);
}

/**
 * Generate full Monthly Report DOCX file
 */
export async function generateMonthlyReportDOCX(data: FullMonthlyReportData): Promise<void> {
  const neutraLogoBytes = await loadImageAsUint8Array(logoNeutraDC);
  const arifSigBytes = base64ToUint8Array(ARIF_BUDIMAN_SIGNATURE_BASE64);
  const circuitFooterBytes = createTelkomCircuitFooterBytes();

  // Common Header with NeutraDC logo top right
  const commonHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          ...(neutraLogoBytes.length > 0 ? [
            new ImageRun({
              data: neutraLogoBytes,
              transformation: { width: 115, height: 35 },
              type: 'png'
            })
          ] : [
            new TextRun({ text: "NeutraDC by Telkom Indonesia", bold: true, color: "DC2626", size: 20 })
          ])
        ]
      })
    ]
  });

  // Authentic Telkom Data Ekosistem Footer (Circuit Graphic on Left + Full Address on Right)
  const commonFooter = new Footer({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: borderNone,
        rows: [
          new TableRow({
            children: [
              // Left: Circuit Graphic
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: borderNone,
                children: [
                  new Paragraph({
                    children: [
                      ...(circuitFooterBytes.length > 0 ? [
                        new ImageRun({
                          data: circuitFooterBytes,
                          transformation: { width: 155, height: 44 },
                          type: 'png'
                        })
                      ] : [])
                    ]
                  })
                ]
              }),
              // Right: Full Telkom Address
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: borderNone,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { after: 20 },
                    children: [
                      new TextRun({
                        text: "PT. Telkom Data Ekosistem",
                        bold: true,
                        size: 16,
                        color: "000000"
                      })
                    ]
                  }),
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { after: 20 },
                    children: [
                      new TextRun({
                        text: "Kawasan The Telkom Hub, Gedung Telkom Landmark Tower II, lantai.39,",
                        size: 13,
                        color: "4B5563"
                      })
                    ]
                  }),
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { after: 20 },
                    children: [
                      new TextRun({
                        text: "Jl. Jenderal Gatot Subroto Kav. 52, Kuningan Barat, Mampang Prapatan, Jakarta Selatan,",
                        size: 13,
                        color: "4B5563"
                      })
                    ]
                  }),
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: "Jakarta, Indonesia 12710, Indonesia.",
                        size: 13,
                        color: "4B5563"
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  const docChildren: any[] = [];

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1: COVER PAGE
  // ══════════════════════════════════════════════════════════════════════════
  docChildren.push(
    new Paragraph({ spacing: { before: 2400 } }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: "PREVENTIVE\n",
          bold: true,
          size: 52,
          font: "Times New Roman",
          color: "111827"
        }),
        new TextRun({
          text: "MAINTENANCE REPORT\n",
          bold: true,
          size: 52,
          font: "Times New Roman",
          color: "111827"
        }),
        new TextRun({
          text: `${data.quarter}– ${data.monthNameEn.toUpperCase()}`,
          bold: true,
          size: 48,
          font: "Times New Roman",
          color: "111827"
        })
      ]
    }),
    new Paragraph({
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: data.docCode,
          size: 22,
          font: "Times New Roman",
          color: "374151"
        })
      ]
    }),
    new Paragraph({ spacing: { before: 4500 } }),
    new Paragraph({
      children: [
        new TextRun({
          text: "HDC Cikarang\n",
          size: 42,
          font: "Times New Roman",
          color: "111827"
        }),
        new TextRun({
          text: "PT Telkom Data Ekosistem",
          size: 42,
          font: "Times New Roman",
          color: "111827"
        })
      ]
    }),
    new Paragraph({
      pageBreakBefore: true
    })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2: APPROVAL SHEET (6-PERSON AUTHENTIC GRID)
  // ══════════════════════════════════════════════════════════════════════════
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 600 },
      children: [
        new TextRun({
          text: "APPROVAL SHEET",
          bold: true,
          size: 40,
          font: "Times New Roman",
          color: "111827"
        })
      ]
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: borderNone,
      rows: [
        // Row 1: Prepared by Dwi Tasmiyadi vs Reviewed by Arif Budiman
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: borderNone,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Prepared By", size: 22, bold: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900, after: 300 }, children: [new TextRun({ text: "", size: 20 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvalSheet.preparedBy.name, bold: true, size: 22 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvalSheet.preparedBy.company, size: 20, color: "4B5563" })] }),
              ]
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: borderNone,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Reviewed By", size: 22, bold: true })] }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 200, after: 200 },
                  children: [
                    ...(arifSigBytes.length > 0 ? [
                      new ImageRun({
                        data: arifSigBytes,
                        transformation: { width: 110, height: 45 },
                        type: 'png'
                      })
                    ] : [
                      new TextRun({ text: "[ Signed ]", italics: true, size: 20 })
                    ])
                  ]
                }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvalSheet.reviewedBy1.name, bold: true, size: 22 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvalSheet.reviewedBy1.company, size: 20, color: "4B5563" })] }),
              ]
            })
          ]
        }),
        // Spacing Row
        new TableRow({ children: [new TableCell({ borders: borderNone, children: [new Paragraph({ spacing: { before: 600 } })] }), new TableCell({ borders: borderNone, children: [new Paragraph({ spacing: { before: 600 } })] })] }),
        // Row 2: Reviewed by Andrean Bima Pratama vs Supriyatno (OCS)
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: borderNone,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Reviewed By", size: 22, bold: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900, after: 300 }, children: [new TextRun({ text: "", size: 20 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvalSheet.reviewedBy2.name, bold: true, size: 22 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvalSheet.reviewedBy2.company, size: 20, color: "4B5563" })] }),
              ]
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: borderNone,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Reviewed By", size: 22, bold: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900, after: 300 }, children: [new TextRun({ text: "", size: 20 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvalSheet.reviewedBy3.name, bold: true, size: 22 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvalSheet.reviewedBy3.company, size: 20, color: "4B5563" })] }),
              ]
            })
          ]
        }),
        // Spacing Row
        new TableRow({ children: [new TableCell({ borders: borderNone, children: [new Paragraph({ spacing: { before: 600 } })] }), new TableCell({ borders: borderNone, children: [new Paragraph({ spacing: { before: 600 } })] })] }),
        // Row 3: Approved by Budi Susanto vs Rezki Rahman Daulay (TDE)
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: borderNone,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Approved By", size: 22, bold: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900, after: 300 }, children: [new TextRun({ text: "", size: 20 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvalSheet.approvedBy1.name, bold: true, size: 22 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvalSheet.approvedBy1.company, size: 20, color: "4B5563" })] }),
              ]
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: borderNone,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Approved By", size: 22, bold: true })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900, after: 300 }, children: [new TextRun({ text: "", size: 20 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvalSheet.approvedBy2.name, bold: true, size: 22 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.approvalSheet.approvedBy2.company, size: 20, color: "4B5563" })] }),
              ]
            })
          ]
        })
      ]
    }),
    new Paragraph({ pageBreakBefore: true })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3: TABLE OF CONTENTS
  // ══════════════════════════════════════════════════════════════════════════
  const tocItems = [
    { title: "1. Executive Summary", page: "5" },
    { title: "2. Key Highlight", page: "5" },
    { title: "3. General Information", page: "218" },
    { title: "4. Maintenance Objectives", page: "218" },
    { title: "5. Equipment and System Details", page: "220" },
    { title: "6. Scope of Work", page: "238" },
    { title: "7. Observation and Finding", page: "252" },
    { title: "8. Repairs, Replacement & Services", page: "256" },
    { title: "9. Testing & Validation", page: "258" },
    { title: "10. Challenges, Mitigation and Lesson Learned", page: "259" },
    { title: "11. Recommendations and Future Action", page: "264" },
    { title: "12. Photo and Documentation Log", page: "265" },
    { title: "13. Appendices", page: "268" }
  ];

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 600 },
      children: [
        new TextRun({ text: "Table of Contents", bold: true, size: 36, color: "1E40AF" })
      ]
    }),
    ...tocItems.map(item => new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [
        new TextRun({ text: item.title, bold: true, size: 22 }),
        new TextRun({ text: ` ${".".repeat(65 - item.title.length)} `, color: "9CA3AF" }),
        new TextRun({ text: item.page, bold: true, size: 22 })
      ]
    })),
    new Paragraph({ pageBreakBefore: true })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 1: EXECUTIVE SUMMARY & BAB 2: KEY HIGHLIGHT
  // ══════════════════════════════════════════════════════════════════════════
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
      children: [new TextRun({ text: "1. Executive Summary", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "Maintenance is a series of activities to maintain facilities and equipment so that they are always ready to use to carry out production effectively and efficiently according to the schedule that has been set and based on standards (functional and quality). The term maintenance comes from the Greek word tera which means to care for, maintain, and maintain. Maintenance is a system consisting of several elements in the form of facilities (machines), replacement of components or spare parts (materials), maintenance costs (money), maintenance activity planning (method) and maintenance executors (man).",
          size: 20
        })
      ]
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 150 },
      children: [new TextRun({ text: "Purpose of Report", bold: true, size: 24 })]
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "To document, evaluate, and ensure that maintenance activities run according to plans and operational standards such as:\n1. Documentation of Preventive Maintenance Activities\n2. Equipment and System Performance Evaluation\n3. Reporting to Management\n4. Ensure Compliance with Procedures and Standards",
          size: 20
        })
      ]
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "2. Key Highlight", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: `Table 1. Schedule Maintenance – ${data.monthNameEn} ${data.year}`, bold: true, size: 22 })]
    })
  );

  // Table 1: Schedule Maintenance
  const scheduleRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 6, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Device", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 24, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Location", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 24, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Maintenance Partner", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Plan", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Status", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    }),
    ...data.scheduleTable1.map(item => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.no), size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.device, bold: true, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.location, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.maintenancePartner, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.plan, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.status, bold: true, size: 18 })] })] }),
      ]
    }))
  ];

  docChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: scheduleRows
    }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // Tables 2 - 17: Task Performance per Scope
  if (data.taskPerformanceTables && data.taskPerformanceTables.length > 0) {
    data.taskPerformanceTables.forEach(t => {
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 300, after: 150 },
          children: [new TextRun({ text: t.title, bold: true, size: 20, color: "1E40AF" })]
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 16 })] })] }),
                new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Equipment / Class", bold: true, color: "FFFFFF", size: 16 })] })] }),
                new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Location", bold: true, color: "FFFFFF", size: 16 })] })] }),
                new TableCell({ width: { size: 38, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Task PM (Activities)", bold: true, color: "FFFFFF", size: 16 })] })] }),
                new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Operational Status", bold: true, color: "FFFFFF", size: 16 })] })] }),
                new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Recommendation", bold: true, color: "FFFFFF", size: 16 })] })] }),
              ]
            }),
            ...t.items.map(item => new TableRow({
              children: [
                new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.no), size: 16 })] })] }),
                new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.className, bold: true, size: 16 }), new TextRun({ text: `\n(${item.productName})`, size: 14, color: "6B7280" })] })] }),
                new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.location, size: 16 })] })] }),
                new TableCell({ borders: borderThin, children: item.taskPM.split('\n').map(line => new Paragraph({ children: [new TextRun({ text: line, size: 15 })] })) }),
                new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.operationalStatus, bold: true, size: 15 })] })] }),
                new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.recommendations, size: 15 })] })] }),
              ]
            }))
          ]
        }),
        new Paragraph({ spacing: { after: 250 } })
      );
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 3: GENERAL INFORMATION & TIM (TABLE 18)
  // ══════════════════════════════════════════════════════════════════════════
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "3. General Information", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Maintenance Type : ${data.generalInfo.maintenanceType}\n`, bold: true, size: 20 }),
        new TextRun({ text: `Contract Reference : ${data.generalInfo.contractReference}\n`, bold: true, size: 20 }),
        new TextRun({ text: `Timeline : ${data.generalInfo.timeline.startDate} - ${data.generalInfo.timeline.endDate} (${data.generalInfo.timeline.totalHoursWorked})\n`, size: 20 }),
        new TextRun({ text: `Standards Followed : ${data.generalInfo.timeline.standardsFollowed.join(", ")}\n`, size: 18, color: "4B5563" }),
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 18. Team Composition", bold: true, size: 22 })]
    })
  );

  // Team Table
  const teamRows = [
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 3,
          shading: { fill: COLOR_SUBHEADER_BLUE },
          borders: borderThin,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Team Leader\n", bold: true, size: 20 }),
                new TextRun({ text: `${data.generalInfo.teamLeader.name} / ${data.generalInfo.teamLeader.role} / ${data.generalInfo.teamLeader.phone}`, size: 18 })
              ]
            })
          ]
        })
      ]
    }),
    new TableRow({
      children: [
        new TableCell({ columnSpan: 3, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Team Member", bold: true, color: "FFFFFF", size: 20 })] })] })
      ]
    })
  ];

  for (let i = 0; i < data.generalInfo.teamMembers.length; i += 3) {
    teamRows.push(
      new TableRow({
        children: [
          new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.generalInfo.teamMembers[i] || "-", size: 18 })] })] }),
          new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.generalInfo.teamMembers[i + 1] || "-", size: 18 })] })] }),
          new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.generalInfo.teamMembers[i + 2] || "-", size: 18 })] })] }),
        ]
      })
    );
  }

  docChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: teamRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 4: KPI METRICS (TABLE 19)
  // ══════════════════════════════════════════════════════════════════════════
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "4. Maintenance Objectives & KPI Metrics", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 19. KPI Metric", bold: true, size: 22 })]
    })
  );

  const kpiRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NO", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ACTIVITY", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "UNIT", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ORDER", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "FINISH", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 11, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "%FINISH", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 11, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "%COMPLY", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    }),
    ...data.kpiMetricsTable19.map(k => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(k.no), size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: k.activity, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: k.unit, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(k.order), size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(k.finish), size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: k.pctFinish, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: k.pctComply, bold: true, size: 18 })] })] }),
      ]
    })),
    new TableRow({
      children: [
        new TableCell({ columnSpan: 6, shading: { fill: COLOR_SUBHEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "TOTAL PERSENTASE PEMENUHAN KINERJA QUARTER 1: ", bold: true, size: 18 })] })] }),
        new TableCell({ shading: { fill: "FEF08A" }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.kpiSummary.totalPerformance, bold: true, size: 20 })] })] })
      ]
    })
  ];

  docChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: kpiRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 5: EQUIPMENT AND SYSTEM DETAILS (TABLE 20 & 21)
  // ══════════════════════════════════════════════════════════════════════════
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "5. Equipment and System Details", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 20. Equipment and System Details", bold: true, size: 22 })]
    })
  );

  const eqRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 4, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 15 })] })] }),
        new TableCell({ width: { size: 16, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Class Name", bold: true, color: "FFFFFF", size: 15 })] })] }),
        new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Model/SN", bold: true, color: "FFFFFF", size: 15 })] })] }),
        new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Manufacture", bold: true, color: "FFFFFF", size: 15 })] })] }),
        new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Install", bold: true, color: "FFFFFF", size: 15 })] })] }),
        new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Location", bold: true, color: "FFFFFF", size: 15 })] })] }),
        new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Last Maint Date", bold: true, color: "FFFFFF", size: 15 })] })] }),
        new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Current Op Date", bold: true, color: "FFFFFF", size: 15 })] })] }),
        new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Status Before", bold: true, color: "FFFFFF", size: 15 })] })] }),
      ]
    }),
    ...data.equipmentDetailsTable20.map(eq => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(eq.no), size: 15 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: eq.className, bold: true, size: 15 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: eq.modelSN, size: 14 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: eq.manufacture, size: 15 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: eq.installDate, size: 15 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: eq.location, size: 15 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: eq.lastMaintenanceDate, bold: true, size: 15 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: eq.currentOperationalDate, size: 14 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: eq.statusBeforeMaintenance, size: 15 })] })] }),
      ]
    }))
  ];

  docChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: eqRows }),
    new Paragraph({ spacing: { after: 300 } })
  );

  // Table 21: System Overview (AI Agent Overview)
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 21. System Overview", bold: true, size: 22 })]
    })
  );

  const sysOverviewRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Component", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 67, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Function & Maintenance Importance", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    }),
    ...data.systemOverviewTable21.map(item => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.no), size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.component, bold: true, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.functionDesc, size: 18 })] })] }),
      ]
    }))
  ];

  docChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: sysOverviewRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 6: SCOPE OF WORK (TABLE 22)
  // ══════════════════════════════════════════════════════════════════════════
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "6. Scope of Work", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 22. Scope of Work", bold: true, size: 22 })]
    })
  );

  data.scopeOfWorkTable22.forEach(sow => {
    const sowRows = [
      new TableRow({
        children: [
          new TableCell({ shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: sow.category, bold: true, color: "FFFFFF", size: 18 })] })] })
        ]
      }),
      ...sow.items.map(step => new TableRow({
        children: [
          new TableCell({
            borders: borderThin,
            children: [
              new Paragraph({ children: [new TextRun({ text: step.step, bold: true, size: 18 })] }),
              ...step.tasks.map(t => new Paragraph({ children: [new TextRun({ text: `• ${t}`, size: 16 })] }))
            ]
          })
        ]
      }))
    ];

    docChildren.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: sowRows }),
      new Paragraph({ spacing: { after: 250 } })
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 7: OBSERVATION & FINDINGS (TABLE 23)
  // ══════════════════════════════════════════════════════════════════════════
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "7. Observation and Finding", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 23. Observation & Finding", bold: true, size: 22 })]
    })
  );

  const obsRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 6, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Component", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 32, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Condition Before", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 32, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Inspection Notes", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    })
  ];

  data.observationTable23.forEach(sec => {
    obsRows.push(
      new TableRow({
        children: [
          new TableCell({ columnSpan: 4, shading: { fill: COLOR_SUBHEADER_BLUE }, borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: sec.scope, bold: true, size: 18 })] })] })
        ]
      })
    );
    sec.items.forEach(item => {
      obsRows.push(
        new TableRow({
          children: [
            new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.no), size: 18 })] })] }),
            new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.component, bold: true, size: 18 })] })] }),
            new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.conditionBefore, size: 18 })] })] }),
            new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.inspectionNotes, size: 18 })] })] }),
          ]
        })
      );
    });
  });

  docChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: obsRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 8: REPAIRS, REPLACEMENT & SERVICES (TABLE 29)
  // ══════════════════════════════════════════════════════════════════════════
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "8. Repairs, Replacement & Services", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 29. Repair, Replacement & Services", bold: true, size: 22 })]
    })
  );

  const repairRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Equipment", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Part Name", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Part Number", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Quantity", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Status", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    }),
    ...data.repairsTable29.map(r => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: r.equipment, bold: true, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: r.partName, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: r.partNumber, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.quantity, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.replacedStatus, bold: true, size: 18 })] })] }),
      ]
    }))
  ];

  docChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: repairRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 11: RECOMMENDATIONS (TABLE 35)
  // ══════════════════════════════════════════════════════════════════════════
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "11. Recommendations and Future Action", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 35. Recommendations and Future Action", bold: true, size: 22 })]
    })
  );

  const recRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 6, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 24, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Component", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Short-Term Recommendations", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Long-Term Recommendations", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    })
  ];

  data.recommendationsTable35.forEach(recSec => {
    recRows.push(
      new TableRow({
        children: [
          new TableCell({ columnSpan: 4, shading: { fill: COLOR_SUBHEADER_BLUE }, borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: recSec.scope, bold: true, size: 18 })] })] })
        ]
      })
    );
    recSec.items.forEach(item => {
      recRows.push(
        new TableRow({
          children: [
            new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.no), size: 18 })] })] }),
            new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.component, bold: true, size: 18 })] })] }),
            new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.shortTerm, size: 18 })] })] }),
            new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.longTerm, size: 18 })] })] }),
          ]
        })
      );
    });
  });

  docChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: recRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 13: APPENDICES
  // ══════════════════════════════════════════════════════════════════════════
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "13. Appendices", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Attach the original service report & supporting documents for certification, test results, etc.",
          size: 20,
          italics: true
        })
      ]
    })
  );

  // Assemble the docx Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 2160, // 1.5 inch left margin for clean binding & clipping
              right: 1080 // 0.75 inch right margin
            }
          }
        },
        headers: {
          default: commonHeader
        },
        footers: {
          default: commonFooter
        },
        children: docChildren
      }
    ]
  });

  // Pack & Download file
  const blob = await Packer.toBlob(doc);
  const fileName = `Monthly_Report_${data.monthNameEn}_${data.year}_NeutraDC.docx`;
  saveAs(blob, fileName);
}
