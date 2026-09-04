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
  HeadingLevel,
  VerticalMergeType,
  VerticalAlign,
  PageNumber
} from 'docx';
import { saveAs } from 'file-saver';
import { FullMonthlyReportData } from './monthlyReportData';
import { ARIF_BUDIMAN_SIGNATURE_BASE64 } from './engineerSignatures';
import logoNeutraDC from '@/assets/logo_neutradc.png';

/** Helper to convert base64 or URL to Uint8Array for docx ImageRun */
function base64ToUint8Array(base64?: string): Uint8Array {
  if (!base64 || typeof base64 !== 'string') return new Uint8Array();
  try {
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return new Uint8Array();
  }
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

// Styling Constants (Official Corporate Palette from NeutraDC PDF)
const COLOR_HEADER_BLUE = "0066B3"; // Official NeutraDC Corporate Blue
const COLOR_SUBHEADER_BLUE = "92B8DE"; // Light Blue Category Accent
const COLOR_BORDER = "000000"; // Solid Black Thin Border

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

  // Authentic Telkom Data Ekosistem Footer (Centered Page Number + Circuit Graphic & Address)
  const commonFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: "Times New Roman",
            bold: true,
            size: 20,
            color: "000000"
          })
        ]
      }),
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
                        font: "Times New Roman",
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
                        font: "Times New Roman",
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
                        font: "Times New Roman",
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
                        font: "Times New Roman",
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

  const coverChildren: any[] = [];
  const bodyChildren: any[] = [];

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1: COVER PAGE (100% CENTERED & BILINGUAL)
  // ══════════════════════════════════════════════════════════════════════════
  coverChildren.push(
    new Paragraph({ spacing: { before: 2400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: (() => {
        const rawCoverTitle = data.coverTitle || "PREVENTIVE MAINTENANCE REPORT\nLAPORAN PEMELIHARAAN PREVENTIF";
        const titleParts = rawCoverTitle.split('\n');
        const runs: TextRun[] = [];
        if (titleParts.length > 1) {
          runs.push(
            new TextRun({
              text: titleParts[0].trim(),
              bold: true,
              size: 48,
              font: "Times New Roman",
              color: "000000"
            }),
            new TextRun({
              text: "\n" + titleParts.slice(1).join(' ').trim() + "\n",
              bold: true,
              italics: true,
              size: 40,
              font: "Times New Roman",
              color: "4B5563"
            })
          );
        } else {
          runs.push(
            new TextRun({
              text: rawCoverTitle + "\n",
              bold: true,
              size: 48,
              font: "Times New Roman",
              color: "000000"
            })
          );
        }
        runs.push(
          new TextRun({
            text: (data.coverSubtitle || `${data.quarter}-${data.monthNameEn.toUpperCase()} ${data.year}`) + "\n\n",
            bold: true,
            size: 44,
            font: "Times New Roman",
            color: "000000"
          }),
          new TextRun({
            text: data.docCode.startsWith("Ref No:") ? data.docCode : `Ref No: ${data.docCode}`,
            bold: true,
            size: 24,
            font: "Times New Roman",
            color: "000000"
          })
        );
        return runs;
      })()
    }),
    new Paragraph({ spacing: { before: 4800 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${data.projectName || "Hyperscale Data Center (HDC) Cikarang"}\n`,
          bold: true,
          size: 36,
          font: "Times New Roman",
          color: "000000"
        }),
        new TextRun({
          text: data.clientName || "PT Telkom Data Ekosistem (NeutraDC)",
          bold: true,
          size: 36,
          font: "Times New Roman",
          color: "000000"
        })
      ]
    })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2: APPROVAL SHEET (6-PERSON AUTHENTIC GRID)
  const monthEn = data.monthNameEn || 'July';
  const monthId = data.monthName || 'Juli';
  const year = data.year || 2026;
  const rawApprovalStatement = data.approvalSheetStatement || `This Monthly Report for ${monthEn} ${year} has been duly prepared, reviewed, and approved by the respective authorized parties as evidence of acknowledgment and acceptance of the activities and documentation presented herein.\nDemikian Monthly Report ${monthId} ${year} ini telah disusun, diperiksa, dan disetujui oleh pihak-pihak yang berwenang sebagai bentuk pengesahan dan persetujuan atas seluruh kegiatan serta dokumentasi yang tercantum di dalam laporan ini.`;
  const approvalStatementLines = rawApprovalStatement.split('\n');
  const approvalStatementEn = approvalStatementLines[0]?.trim() || '';
  const approvalStatementId = approvalStatementLines.slice(1).join(' ').trim() || '';

  bodyChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 60 },
      children: [
        new TextRun({
          text: "APPROVAL SHEET\n",
          bold: true,
          size: 38,
          font: "Times New Roman",
          color: "000000"
        }),
        new TextRun({
          text: "LEMBAR PENGESAHAN",
          italics: true,
          size: 26,
          font: "Times New Roman",
          color: "4B5563"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 60 },
      children: [
        new TextRun({
          text: approvalStatementEn,
          size: 19,
          font: "Times New Roman",
          color: "000000"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 500 },
      children: [
        new TextRun({
          text: approvalStatementId,
          italics: true,
          size: 18,
          font: "Times New Roman",
          color: "4B5563"
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
  const tocItems = data.tableOfContents || [
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

  bodyChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 600 },
      children: [
        new TextRun({ text: "Table of Contents", bold: true, size: 36, color: "1E40AF" })
      ]
    }),
    ...tocItems.map(item => {
      const parts = (item.title || '').split('\n');
      const titleEn = parts[0] || '';
      const titleId = parts[1] || '';
      const dotsCount = Math.max(5, 65 - titleEn.length);

      const children = [
        new TextRun({ text: titleEn, bold: true, size: 22 }),
        new TextRun({ text: ` ${".".repeat(dotsCount)} `, color: "9CA3AF" }),
        new TextRun({ text: item.page, bold: true, size: 22 })
      ];

      if (titleId) {
        children.push(
          new TextRun({ break: 1 }),
          new TextRun({ text: `   ${titleId}`, italics: true, size: 18, color: "4B5563" })
        );
      }

      return new Paragraph({
        spacing: { before: 120, after: 120 },
        children
      });
    }),
    new Paragraph({ pageBreakBefore: true })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 4: LIST OF TABLES
  // ══════════════════════════════════════════════════════════════════════════
  const lotItems = data.listOfTables || [
    { title: `Table 1. Schedule Maintenance – ${data.monthNameEn} ${data.year}`, page: "5" },
    { title: "Table 2. Task Performance – Chiller System", page: "6" },
    { title: "Table 3. Task Performance – Cooling Tower & Piping", page: "8" },
    { title: "Table 4. Task Performance – Cooling Pump", page: "10" },
    { title: "Table 5. Task Performance – Transformer", page: "12" },
    { title: "Table 6. Task Performance – Generator & Fuel System", page: "14" },
    { title: "Table 7. Task Performance – MV & RMU Panel", page: "16" },
    { title: "Table 8. Task Performance – LV Panel", page: "18" },
    { title: "Table 9. Task Performance – UPS & Battery Bank", page: "20" },
    { title: "Table 10. Task Performance – Power Distribution Unit (PDU)", page: "22" },
    { title: "Table 11. Task Performance – PAC / CRAC Precision Cooling", page: "24" },
    { title: "Table 12. Task Performance – Fire Alarm & Suppression", page: "26" },
    { title: "Table 13. Task Performance – VESDA Early Warning", page: "28" },
    { title: "Table 14. Task Performance – Access Control & CCTV", page: "30" },
    { title: "Table 15. Task Performance – Lightning Protection & Grounding", page: "32" },
    { title: "Table 16. Task Performance – Building Automation System (BAS)", page: "34" },
    { title: "Table 17. Task Performance – Water Treatment Plant", page: "36" },
    { title: "Table 18. Team Composition", page: "218" },
    { title: "Table 19. KPI Metric", page: "218" },
    { title: "Table 20. Equipment and System Details", page: "220" },
    { title: "Table 21. System Overview", page: "236" },
    { title: "Table 22. Scope of Work", page: "238" },
    { title: "Table 23. Observation & Finding", page: "252" },
    { title: "Table 24. Root Cause Analysis – Electrical System", page: "253" },
    { title: "Table 25. Root Cause Analysis – Cooling System", page: "254" },
    { title: "Table 26. Root Cause Analysis – Fire & Safety System", page: "254" },
    { title: "Table 27. Root Cause Analysis – Civil & Architectural", page: "255" },
    { title: "Table 28. Finding Severity Matrix", page: "255" },
    { title: "Table 29. Repair, Replacement & Services", page: "256" },
    { title: "Table 30. Calibration and Adjustments Performed", page: "258" },
    { title: "Table 31. Validation Methods", page: "258" },
    { title: "Table 32. Challenges Faced", page: "259" },
    { title: "Table 33. Mitigation Steps", page: "261" },
    { title: "Table 34. Lessons Learned", page: "263" },
    { title: "Table 35. Recommendations and Future Action", page: "264" },
    { title: "Table 36. Photo and Documentation Log", page: "265" }
  ];

  bodyChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 600 },
      children: [
        new TextRun({ text: "List of Tables", bold: true, size: 36, color: "1E40AF" })
      ]
    }),
    ...lotItems.map(item => {
      const parts = (item.title || '').split('\n');
      const titleEn = parts[0] || '';
      const titleId = parts[1] || '';
      const dotsCount = Math.max(5, 75 - titleEn.length);

      const children = [
        new TextRun({ text: titleEn, bold: true, size: 20 }),
        new TextRun({ text: ` ${".".repeat(dotsCount)} `, color: "9CA3AF" }),
        new TextRun({ text: item.page, bold: true, size: 20 })
      ];

      if (titleId) {
        children.push(
          new TextRun({ break: 1 }),
          new TextRun({ text: `   ${titleId}`, italics: true, size: 16, color: "4B5563" })
        );
      }

      return new Paragraph({
        spacing: { before: 100, after: 100 },
        children
      });
    }),
    new Paragraph({ pageBreakBefore: true })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 1: EXECUTIVE SUMMARY & BAB 2: KEY HIGHLIGHT
  // ══════════════════════════════════════════════════════════════════════════
  bodyChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
      children: [new TextRun({ text: "1. Executive Summary", bold: true, size: 28, color: "1E40AF" })]
    }),
    ...(() => {
      const summaryText = data.executiveSummaryText || "Maintenance is a series of activities to maintain facilities and equipment so that they are always ready to use to carry out production effectively and efficiently according to the schedule that has been set and based on standards (functional and quality). The term maintenance comes from the Greek word tera which means to care for, maintain, and maintain. Maintenance is a system consisting of several elements in the form of facilities (machines), replacement of components or spare parts (materials), maintenance costs (money), maintenance activity planning (method) and maintenance executors (man).";
      const parts = summaryText.split('\n');
      if (parts.length > 1) {
        return [
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: parts[0], size: 20 })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: parts.slice(1).join('\n'), size: 19, italics: true, color: "4B5563" })]
          })
        ];
      }
      return [
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: summaryText, size: 20 })]
        })
      ];
    })(),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 150 },
      children: (() => {
        const title = data.purposeOfReportTitle || "Purpose of Report";
        const parts = title.split('\n');
        if (parts.length > 1) {
          return [
            new TextRun({ text: parts[0], bold: true, size: 24 }),
            new TextRun({ break: 1 }),
            new TextRun({ text: `   ${parts[1]}`, bold: true, italics: true, size: 20, color: "4B5563" })
          ];
        }
        return [new TextRun({ text: title, bold: true, size: 24 })];
      })()
    }),
    ...(() => {
      const intro = data.purposeOfReportIntro || "To document, evaluate, and ensure that maintenance activities run according to plans and operational standards such as:";
      const parts = intro.split('\n');
      if (parts.length > 1) {
        return [
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: parts[0], size: 20 })]
          }),
          new Paragraph({
            spacing: { after: 150 },
            children: [new TextRun({ text: parts.slice(1).join('\n'), size: 18, italics: true, color: "4B5563" })]
          })
        ];
      }
      return [
        new Paragraph({
          spacing: { after: 150 },
          children: [new TextRun({ text: intro, size: 20 })]
        })
      ];
    })(),
    ...(data.purposePoints ? data.purposePoints.map((pt, idx) => {
      const titleParts = (pt.title || '').split('\n');
      const titleEn = titleParts[0] || '';
      const titleId = titleParts[1] || '';

      const descParts = (pt.desc || '').split('\n');
      const descEn = descParts[0] || '';
      const descId = descParts[1] || '';

      const runs = [
        new TextRun({ text: `${idx + 1}. `, bold: true, size: 20 }),
        new TextRun({ text: `${titleEn} `, bold: true, size: 20 }),
        new TextRun({ text: descEn, size: 20 })
      ];

      if (titleId || descId) {
        runs.push(
          new TextRun({ break: 1 }),
          new TextRun({ text: `    ${titleId ? titleId + ' ' : ''}${descId || ''}`, italics: true, size: 18, color: "4B5563" })
        );
      }

      return new Paragraph({
        spacing: { after: 120 },
        children: runs
      });
    }) : [
      new Paragraph({
        children: [
          new TextRun({
            text: "1. Documentation of Preventive Maintenance Activities: Records all PM activities that have been carried out for one month.\n2. Equipment and System Performance Evaluation: Assess the condition of equipment based on inspection and maintenance results.\n3. Reporting to Management: Provides management with a comprehensive overview of the condition of the facility.\n4. Ensure Compliance with Procedures and Standards: Prove that PM activities are carried out in accordance with applicable Procedures.",
            size: 20
          })
        ]
      })
    ]),
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

  // Helper to format bilingual text (English on top, Indonesian in italic below)
  const formatBilingualCell = (text: string, defaultText = "-", isCentered = false) => {
    const val = text && text.trim() ? text.trim() : defaultText;
    const lines = val.split('\n');
    const hasBullets = lines.some(l => /^[•\-\*]/.test(l.trim()));

    return lines.map((line, idx) => {
      const trimmed = line.trim();
      let isItalic = false;
      if (hasBullets) {
        // Bullet line is English (regular); non-bullet line below it is Indonesian (italic)
        isItalic = !/^[•\-\*]/.test(trimmed) && trimmed.length > 0;
      } else {
        // Standard 2-line dual-language: line 0 is English, line 1+ is Indonesian
        isItalic = idx >= 1 || /^(periksa|melakukan|sistem|tidak|lanjutkan|kondisi|terdapat|ganti|sesuaikan|lakukan|teramat|inspeksi|pengujian|saat ini|pemeliharaan)/i.test(trimmed);
      }

      return new Paragraph({
        alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: hasBullets ? 20 : 30 },
        children: [
          new TextRun({
            text: line,
            italics: isItalic,
            size: 14,
            font: "Times New Roman",
            color: isItalic ? "4B5563" : "000000"
          })
        ]
      });
    });
  };

  // Table 1: Schedule Maintenance (Two-tier header matching PDF Page 5 & Screenshot 2)
  const scheduleRows = [
    // Header Row 1
    new TableRow({
      children: [
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { fill: COLOR_HEADER_BLUE },
          borders: borderThin,
          verticalMerge: VerticalMergeType.RESTART,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Device", bold: true, color: "FFFFFF", size: 19, font: "Times New Roman" })] })]
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { fill: COLOR_HEADER_BLUE },
          borders: borderThin,
          verticalMerge: VerticalMergeType.RESTART,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Location", bold: true, color: "FFFFFF", size: 19, font: "Times New Roman" })] })]
        }),
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          shading: { fill: COLOR_HEADER_BLUE },
          borders: borderThin,
          verticalMerge: VerticalMergeType.RESTART,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Maintenance Partner", bold: true, color: "FFFFFF", size: 19, font: "Times New Roman" })] })]
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          columnSpan: 2,
          shading: { fill: COLOR_HEADER_BLUE },
          borders: borderThin,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.monthNameEn, bold: true, color: "FFFFFF", size: 19, font: "Times New Roman" })] })]
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { fill: COLOR_HEADER_BLUE },
          borders: borderThin,
          verticalMerge: VerticalMergeType.RESTART,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Status", bold: true, color: "FFFFFF", size: 19, font: "Times New Roman" })] })]
        }),
      ]
    }),
    // Header Row 2
    new TableRow({
      children: [
        new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalMerge: VerticalMergeType.CONTINUE, children: [] }),
        new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalMerge: VerticalMergeType.CONTINUE, children: [] }),
        new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalMerge: VerticalMergeType.CONTINUE, children: [] }),
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Plan", bold: true, color: "FFFFFF", size: 19, font: "Times New Roman" })] })] }),
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Actual", bold: true, color: "FFFFFF", size: 19, font: "Times New Roman" })] })] }),
        new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalMerge: VerticalMergeType.CONTINUE, children: [] }),
      ]
    }),
    // Data Rows
    ...data.scheduleTable1.map(item => new TableRow({
      children: [
        new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.device, size: 18, font: "Times New Roman" })] })] }),
        new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.location, size: 18, font: "Times New Roman" })] })] }),
        new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.maintenancePartner, size: 18, font: "Times New Roman" })] })] }),
        new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.plan, size: 18, font: "Times New Roman" })] })] }),
        new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.actual || item.plan, size: 18, font: "Times New Roman" })] })] }),
        new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: formatBilingualCell(item.status || "On Schedule", "On Schedule", true) }),
      ]
    }))
  ];

  bodyChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: scheduleRows
    }),
    new Paragraph({ spacing: { after: 400 } })
  );


  // Tables 2 - 17: Task Performance per Scope (Authentic 10 Columns matching PDF 237 pages)
  if (data.taskPerformanceTables && data.taskPerformanceTables.length > 0) {
    data.taskPerformanceTables.forEach(t => {
      bodyChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 300, after: 150 },
          children: [new TextRun({ text: t.title, bold: true, size: 20, font: "Times New Roman", color: "000000" })]
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ width: { size: 4, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ width: { size: 9, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Class Name", bold: true, color: "FFFFFF", size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ width: { size: 7, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Capacity", bold: true, color: "FFFFFF", size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Location", bold: true, color: "FFFFFF", size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ width: { size: 7, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Product Name", bold: true, color: "FFFFFF", size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ width: { size: 19, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Task Preventif Maintenance", bold: true, color: "FFFFFF", size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Critical Repairs", bold: true, color: "FFFFFF", size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Operational Status", bold: true, color: "FFFFFF", size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Issues", bold: true, color: "FFFFFF", size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Recommendations", bold: true, color: "FFFFFF", size: 15, font: "Times New Roman" })] })] }),
              ]
            }),
            ...t.items.map(item => new TableRow({
              children: [
                new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.no}.`, size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.className, bold: true, size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.capacity || "-", size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.location || "-", size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.productName || "N/A", size: 15, font: "Times New Roman" })] })] }),
                new TableCell({ borders: borderThin, children: formatBilingualCell(item.taskPM, "Inspect, clean, and test equipment to ensure reliable operation.\nInspeksi, bersihkan, dan uji peralatan untuk memastikan pengoperasian yang andal.") }),
                new TableCell({ borders: borderThin, children: formatBilingualCell(item.criticalRepairs, "No critical repair is required.\nSaat ini tidak diperlukan perbaikan mendesak.") }),
                new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: formatBilingualCell(item.operationalStatus, "Good Condition / Normal Operation\nKondisi Baik / Beroperasi Normal", true) }),
                new TableCell({ borders: borderThin, children: formatBilingualCell(item.issues, "No abnormality was observed during normal operation.\nTidak ditemukan adanya kelainan selama pengoperasian normal.") }),
                new TableCell({ borders: borderThin, children: formatBilingualCell(item.recommendations, "Continue routine monitoring and preventive maintenance to ensure reliable operation.\nLanjutkan pemantauan rutin dan pemeliharaan preventif untuk memastikan pengoperasian yang andal.") }),
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
  bodyChildren.push(
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

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: teamRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 4: KPI METRICS (TABLE 19)
  // ══════════════════════════════════════════════════════════════════════════
  bodyChildren.push(
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

  // 1. Table Progress Preventive Maintenance (Foto 1 Atas)
  const pmItems = data.progressPmTable19 || [];
  const progressPmDocxRows: TableRow[] = [
    // Header Row 1: Title Banner
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 10,
          shading: { fill: COLOR_HEADER_BLUE },
          borders: borderThin,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `Progress Preventive Maintenance ${data.monthNameEn || 'July'} ${data.year || 2026}`,
                  bold: true,
                  color: "FFFFFF",
                  size: 20
                })
              ]
            })
          ]
        })
      ]
    }),
    // Header Row 2 & 3: Columns with Sub-headers Plan & Actual
    new TableRow({
      children: [
        new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, rowSpan: 2, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 22, type: WidthType.PERCENTAGE }, rowSpan: 2, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Activity", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 6, type: WidthType.PERCENTAGE }, rowSpan: 2, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Unit", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 16, type: WidthType.PERCENTAGE }, columnSpan: 2, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Plan", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 22, type: WidthType.PERCENTAGE }, columnSpan: 3, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Actual", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, rowSpan: 2, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "%Finish", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 21, type: WidthType.PERCENTAGE }, rowSpan: 2, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Remark", bold: true, color: "FFFFFF", size: 17 })] })] }),
      ]
    }),
    new TableRow({
      children: [
        new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Start", bold: true, color: "FFFFFF", size: 16 })] })] }),
        new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Finish", bold: true, color: "FFFFFF", size: 16 })] })] }),
        new TableCell({ width: { size: 7, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Start", bold: true, color: "FFFFFF", size: 16 })] })] }),
        new TableCell({ width: { size: 7, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Finish", bold: true, color: "FFFFFF", size: 16 })] })] }),
        new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Unit", bold: true, color: "FFFFFF", size: 16 })] })] }),
      ]
    }),
    ...pmItems.map(row => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(row.no), size: 16 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: row.activity, bold: true, size: 16 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(row.unit), size: 16 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.planStart, size: 15 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.planFinish, size: 15 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.actualStart, size: 15 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.actualFinish, size: 15 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(row.actualUnit), size: 16 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.pctFinish, bold: true, size: 16 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: row.remark || "", size: 14 })] })] }),
      ]
    })),
    // Summary Row: Avarage
    new TableRow({
      children: [
        new TableCell({ columnSpan: 8, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Avarage", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.progressPmAverage || data.kpiSummary?.progressPmAverage || "97,44%", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ children: [] })] }),
      ]
    })
  ];

  // 2. Table SLA Tiket / Order (Foto 1 Bawah)
  const slaItems = data.slaOrdersTable19 || [
    { no: '1.', activity: 'Response Time', unit: 'Order', actual: 18, finish: 15, pctFinish: '83,33%', comply: 'TM', pctComply: '83%' },
    { no: '2.', activity: 'Onsite Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
    { no: '3.', activity: 'Restore Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' },
    { no: '4.', activity: 'Resolution Time', unit: 'Order', actual: 18, finish: 18, pctFinish: '100%', comply: 'M', pctComply: '100%' }
  ];

  const slaDocxRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 6, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 26, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Activity", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Unit", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Actual", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Finish", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "%Finish", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Comply", bold: true, color: "FFFFFF", size: 17 })] })] }),
        new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "%Comply", bold: true, color: "FFFFFF", size: 17 })] })] }),
      ]
    }),
    ...slaItems.map(row => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(row.no), size: 16 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: row.activity, bold: true, size: 16 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.unit, size: 16 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(row.actual), size: 16 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(row.finish), size: 16 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.pctFinish, size: 16 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.comply, bold: true, size: 16 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.pctComply, bold: true, size: 16 })] })] }),
      ]
    })),
    // Summary Row: Total Fulfillment
    new TableRow({
      children: [
        new TableCell({ columnSpan: 7, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Total Percentage Of Performance Fulfillment Period 1", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.slaOrdersPeriodTotal || "%", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    })
  ];

  // 3. Table Matriks Service Credit (Foto 2)
  const matrixItems = data.serviceCreditMatrix || [
    { range: '98% - 100%', credit: '0%', highlighted: false, isTermination: false },
    { range: '95% - <98%', credit: '5%', highlighted: false, isTermination: false },
    { range: '90% - <95%', credit: '10%', highlighted: false, isTermination: false },
    { range: '85% - <90%', credit: '15%', highlighted: false, isTermination: false },
    { range: '80% - <85%', credit: '20%', highlighted: false, isTermination: false },
    { range: '<80%', credit: 'Contract can be terminated', highlighted: true, isTermination: true }
  ];

  const serviceCreditRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Nilai Total  Kinerja %", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Percentage of Service Credit", bold: true, color: "FFFFFF", size: 18 })] })] })
      ]
    }),
    ...matrixItems.map(m => {
      const isTerm = m.isTermination || m.range.includes('<80') || m.credit?.toLowerCase().includes('terminated');
      const isHighlighted = m.highlighted && !isTerm;
      return new TableRow({
        children: [
          new TableCell({ shading: isTerm ? { fill: "FFFF00" } : isHighlighted ? { fill: "FEF08A" } : undefined, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.range, bold: isTerm || isHighlighted, color: "000000", size: 18 })] })] }),
          new TableCell({ shading: isTerm ? { fill: "FFFF00" } : isHighlighted ? { fill: "FEF08A" } : undefined, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.credit, bold: isTerm || isHighlighted, color: "000000", size: 18 })] })] })
        ]
      });
    })
  ];

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: progressPmDocxRows }),
    new Paragraph({ spacing: { after: 300 } }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: slaDocxRows }),
    new Paragraph({ spacing: { after: 300 } }),
    new Table({ width: { size: 60, type: WidthType.PERCENTAGE }, rows: serviceCreditRows, alignment: AlignmentType.CENTER }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 5: EQUIPMENT AND SYSTEM DETAILS (TABLE 20 & 21)
  // ══════════════════════════════════════════════════════════════════════════
  bodyChildren.push(
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
        new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: formatBilingualCell(eq.statusBeforeMaintenance, "-", true) }),
      ]
    }))
  ];

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: eqRows }),
    new Paragraph({ spacing: { after: 300 } })
  );

  // Table 21: System Overview (AI Agent Overview)
  bodyChildren.push(
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
        new TableCell({ borders: borderThin, children: formatBilingualCell(item.functionDesc) }),
      ]
    }))
  ];

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: sysOverviewRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 6: SCOPE OF WORK (TABLE 22)
  // ══════════════════════════════════════════════════════════════════════════
  bodyChildren.push(
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
          new TableCell({
            shading: { fill: COLOR_HEADER_BLUE },
            borders: borderThin,
            children: [
              new Paragraph({
                spacing: { before: 100, after: 100 },
                children: [new TextRun({ text: sow.category, bold: true, color: "FFFFFF", size: 19 })]
              })
            ]
          })
        ]
      }),
      ...sow.items.map(step => {
        const stepParts = (step.step || '').split('\n');
        const stepEn = stepParts[0] || '';
        const stepId = stepParts[1] || '';

        const stepParagraphs: Paragraph[] = [];
        
        if (stepId) {
          stepParagraphs.push(
            new Paragraph({
              spacing: { before: 120, after: 40 },
              children: [
                new TextRun({ text: stepEn, bold: true, size: 18, color: "1E40AF" }),
                new TextRun({ break: 1 }),
                new TextRun({ text: `   ${stepId}`, italics: true, size: 16, color: "4B5563" })
              ]
            })
          );
        } else {
          stepParagraphs.push(
            new Paragraph({
              spacing: { before: 120, after: 60 },
              children: [new TextRun({ text: stepEn, bold: true, size: 18, color: "1E40AF" })]
            })
          );
        }

        step.tasks.forEach(t => {
          const parts = (t || '').split('\n');
          const enText = parts[0]?.trim() || '';
          const idText = parts.slice(1).join('\n').trim();

          if (idText) {
            stepParagraphs.push(
              new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { before: 60, after: 40 },
                indent: { left: 240 },
                children: [
                  new TextRun({ text: `• ${enText}`, size: 17, color: "1F2937" }),
                  new TextRun({ break: 1 }),
                  new TextRun({ text: `  ${idText}`, size: 15, italics: true, color: "4B5563" })
                ]
              })
            );
          } else {
            stepParagraphs.push(
              new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { before: 60, after: 60 },
                indent: { left: 240 },
                children: [new TextRun({ text: `• ${enText}`, size: 17, color: "1F2937" })]
              })
            );
          }
        });

        return new TableRow({
          children: [
            new TableCell({
              borders: borderThin,
              children: stepParagraphs
            })
          ]
        });
      })
    ];

    bodyChildren.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: sowRows }),
      new Paragraph({ spacing: { after: 250 } })
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 7: OBSERVATION & FINDINGS (TABLE 23)
  // ══════════════════════════════════════════════════════════════════════════
  bodyChildren.push(
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
            new TableCell({ borders: borderThin, children: formatBilingualCell(item.conditionBefore) }),
            new TableCell({ borders: borderThin, children: formatBilingualCell(item.inspectionNotes) }),
          ]
        })
      );
    });
  });

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: obsRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 8: REPAIRS, REPLACEMENT & SERVICES (TABLE 29)
  // ══════════════════════════════════════════════════════════════════════════
  bodyChildren.push(
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
    ...(data.repairsTable29.length > 0
      ? data.repairsTable29.map(r => new TableRow({
          children: [
            new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: r.equipment, bold: true, size: 18 })] })] }),
            new TableCell({ borders: borderThin, children: formatBilingualCell(r.partName) }),
            new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: r.partNumber, size: 18 })] })] }),
            new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.quantity, size: 18 })] })] }),
            new TableCell({ borders: borderThin, verticalAlign: VerticalAlign.CENTER, children: formatBilingualCell(r.replacedStatus, "-", true) }),
          ]
        }))
      : [
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 5,
                borders: borderThin,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: "Tidak ada pergantian suku cadang (spare parts) pada periode bulan ini.",
                        italics: true,
                        size: 18
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
    )
  ];

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: repairRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 9: TESTING & VALIDATION (TABLE 30 & 31)
  // ══════════════════════════════════════════════════════════════════════════
  bodyChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "9. Testing & Validation", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 30. Calibration and Adjustments Performed", bold: true, size: 22 })]
    })
  );

  const calRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Component Maintenance", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Calibration Performed", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    }),
    ...data.calibrationTable30.map(item => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.no), size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.component, bold: true, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: formatBilingualCell(item.calibrationDetail) }),
      ]
    }))
  ];

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: calRows }),
    new Paragraph({ spacing: { after: 300 } })
  );

  bodyChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 31. Validation Methods", bold: true, size: 22 })]
    })
  );

  const valRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Component Maintenance", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Validation Methods", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    }),
    ...data.validationMethodsTable31.map(item => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.no), size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.component, bold: true, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: formatBilingualCell(item.validationMethod) }),
      ]
    }))
  ];

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: valRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 10: CHALLENGES, MITIGATION AND LESSON LEARNED (TABLE 32 - 34)
  // ══════════════════════════════════════════════════════════════════════════
  bodyChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "10. Challenges, Mitigation and Lesson Learned", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 32. Challenges Faced", bold: true, size: 22 })]
    })
  );

  const chalRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Component Maintenance", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Challenges Faced", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    }),
    ...data.challengesTable32.map(item => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.no), size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.component, bold: true, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: formatBilingualCell(item.challenge) }),
      ]
    }))
  ];

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: chalRows }),
    new Paragraph({ spacing: { after: 300 } })
  );

  bodyChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 33. Mitigation Steps", bold: true, size: 22 })]
    })
  );

  const mitRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Component Maintenance", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mitigation", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    }),
    ...data.mitigationTable33.map(item => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.no), size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.component, bold: true, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: formatBilingualCell(item.mitigation) }),
      ]
    }))
  ];

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: mitRows }),
    new Paragraph({ spacing: { after: 300 } })
  );

  bodyChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 34. Lessons Learned", bold: true, size: 22 })]
    })
  );

  const lesRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Component Maintenance", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Lesson Learned", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    }),
    ...data.lessonsLearnedTable34.map(item => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.no), size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.component, bold: true, size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: formatBilingualCell(item.lessonLearned) }),
      ]
    }))
  ];

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: lesRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 11: RECOMMENDATIONS (TABLE 35)
  // ══════════════════════════════════════════════════════════════════════════
  bodyChildren.push(
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
            new TableCell({ borders: borderThin, children: formatBilingualCell(item.shortTerm) }),
            new TableCell({ borders: borderThin, children: formatBilingualCell(item.longTerm) }),
          ]
        })
      );
    });
  });

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: recRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 12: PHOTO AND DOCUMENTATION LOG (TABLE 36)
  // ══════════════════════════════════════════════════════════════════════════
  bodyChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "12. Photo and Documentation Log", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: "Table 36. Photo and Documentation Log", bold: true, size: 22 })]
    })
  );

  const photoLogRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 6, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 24, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Component Maintenance", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 23, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Pre-Maintenance", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 24, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Activities", bold: true, color: "FFFFFF", size: 18 })] })] }),
        new TableCell({ width: { size: 23, type: WidthType.PERCENTAGE }, shading: { fill: COLOR_HEADER_BLUE }, borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Post-Maintenance", bold: true, color: "FFFFFF", size: 18 })] })] }),
      ]
    }),
    ...data.photoLogsTable36.map(item => new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.no), size: 18 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: item.component, bold: true, size: 18 }), ...(item.caption ? [new TextRun({ text: `\n${item.caption}`, size: 14, color: "6B7280" })] : [])] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.prePhoto ? "[ Foto Terlampir ]" : "[ Visual Normal ]", size: 16, italics: true })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.duringPhoto ? "[ Foto Aktivitas ]" : "[ Pelaksanaan PM ]", size: 16, italics: true })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.postPhoto ? "[ Foto Hasil ]" : "[ Verifikasi Normal ]", size: 16, italics: true })] })] }),
      ]
    }))
  ];

  bodyChildren.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: photoLogRows }),
    new Paragraph({ spacing: { after: 400 } })
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BAB 13: APPENDICES
  // ══════════════════════════════════════════════════════════════════════════
  bodyChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "13. Appendices", bold: true, size: 28, color: "1E40AF" })]
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: data.appendicesNote || "Attach the original service report & supporting documents for certification, test results, etc.",
          size: 20,
          italics: true
        })
      ]
    })
  );

  // Assemble the docx Document with 2 sections (Cover Page clean, Body starts at page 2)
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            color: "000000"
          },
          paragraph: {
            spacing: { line: 276 } // 1.15 line spacing
          }
        }
      }
    },
    sections: [
      // SECTION 1: COVER PAGE (100% CLEAN, NO HEADER, NO FOOTER)
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        children: coverChildren
      },
      // SECTION 2: REPORT BODY (NEUTRADCI LOGO HEADER + FOOTER WITH CENTERED PAGE NUMBER)
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440
            },
            pageNumbers: {
              start: 2
            }
          }
        },
        headers: {
          default: commonHeader
        },
        footers: {
          default: commonFooter
        },
        children: bodyChildren
      }
    ]
  });

  // Pack & Download file
  const blob = await Packer.toBlob(doc);
  const fileName = `Monthly_Report_${data.monthNameEn}_${data.year}_NeutraDC.docx`;
  saveAs(blob, fileName);
}
