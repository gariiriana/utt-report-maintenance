import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PIRReportData } from '@/types/pirReportTypes';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { compressBase64Image } from '@/utils/imageCompression';
import { toast } from 'sonner';

/** Helper to convert image URL to base64 */
async function loadImageBase64(src: string): Promise<string> {
  return new Promise((resolve) => {
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
    img.onerror = () => resolve('');
    img.src = src;
  });
}

export async function generatePIRReportPDF(data: PIRReportData) {
  const toastId = toast.loading('Memproses PDF Postmortem Incident Report (PIR)...');

  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentW = pageW - 2 * margin;

    // Load Logos
    let logoLeft = '';
    let logoRight = '';
    try { logoLeft = await loadImageBase64(logoDwimitra); } catch { /* ignore */ }
    try { logoRight = await loadImageBase64(logoNeutraDC); } catch { /* ignore */ }

    // Compress photos if any
    let processedPhotos: { base64: string; caption: string }[] = [];
    if (data.photos && data.photos.length > 0) {
      processedPhotos = await Promise.all(
        data.photos.map(async (p) => {
          if (!p.photoBase64) return { base64: '', caption: '' };
          try {
            const compressed = await compressBase64Image(p.photoBase64, { maxWidth: 900, quality: 0.7 });
            return { base64: compressed, caption: p.caption || '' };
          } catch {
            return { base64: p.photoBase64, caption: p.caption || '' };
          }
        })
      );
    }

    const HEADER_FILL: [number, number, number] = [225, 232, 240];
    const SUBHEADER_FILL: [number, number, number] = [240, 243, 246];
    const TABLE_BORDER: [number, number, number] = [180, 180, 180];

    const drawHeaderLogos = () => {
      if (logoLeft) {
        doc.addImage(logoLeft, 'PNG', margin, 6, 22, 16);
      }
      if (logoRight) {
        doc.addImage(logoRight, 'PNG', pageW - margin - 32, 8, 32, 11);
      }
    };

    const drawPageFooter = (pageNum: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(String(pageNum), pageW / 2, pageH - 8, { align: 'center' });
    };

    // ==========================================
    // PAGE 1: BASIC INFO & INCIDENT SEVERITY
    // ==========================================
    drawHeaderLogos();

    let y = 28;

    // Document Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('POSTMORTEM INCIDENT REPORT', margin, y);

    y += 5;

    const resolvedIncidentName = data.incidentName || (data as any).issue || (data as any).ticketName || 'Postmortem Incident Report';
    const resolvedOwner = data.postmortemOwner || (data as any).reportedByEmail || (data as any).reportedBy || 'Standby Engineer';

    // Table 1: INCIDENT NAME | INCIDENT DATE | INCIDENT ID
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['INCIDENT NAME', 'INCIDENT DATE', 'INCIDENT ID']],
      body: [[
        resolvedIncidentName || 'N/A',
        data.incidentDate || 'N/A',
        data.incidentId || (data.id ? data.id.slice(0, 8) : 'N/A')
      ]],
      headStyles: { fillColor: HEADER_FILL, textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      bodyStyles: { textColor: [30, 30, 30], fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 45 }, 2: { cellWidth: 41 } }
    });

    y = (doc as any).lastAutoTable.finalY;

    // Table 2: POSTMORTEM OWNER NAME AND TITLE | DATE COMPLETED
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['POSTMORTEM OWNER NAME AND TITLE', 'DATE COMPLETED']],
      body: [[
        resolvedOwner || 'N/A',
        data.dateCompleted || 'N/A'
      ]],
      headStyles: { fillColor: HEADER_FILL, textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      bodyStyles: { textColor: [30, 30, 30], fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      columnStyles: { 0: { cellWidth: 145 }, 1: { cellWidth: 41 } }
    });

    y = (doc as any).lastAutoTable.finalY;

    // Table 3: REPORT AUTHORS | REPORT ID
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['REPORT AUTHORS', 'REPORT ID']],
      body: [[
        data.reportAuthors || 'N/A',
        data.reportId || 'N/A'
      ]],
      headStyles: { fillColor: HEADER_FILL, textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      bodyStyles: { textColor: [30, 30, 30], fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      columnStyles: { 0: { cellWidth: 145 }, 1: { cellWidth: 41 } }
    });

    y = (doc as any).lastAutoTable.finalY;

    // Table 4: LINK TO INCIDENT RECORDING | POSTMORTEM MEETING DATE
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['LINK TO INCIDENT RECORDING', 'POSTMORTEM MEETING DATE']],
      body: [[
        data.linkToIncidentRecording || 'N/A',
        data.postmortemMeetingDate || 'N/A'
      ]],
      headStyles: { fillColor: HEADER_FILL, textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      bodyStyles: { textColor: [30, 30, 30], fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 76 } }
    });

    y = (doc as any).lastAutoTable.finalY;

    // Table 5: MEETING ATTENDEES (TDE vs DME)
    const tdeText = (data.attendeesTDE || []).map(n => `-  ${n}`).join('\n');
    const dmeText = (data.attendeesDME || []).map(n => `-  ${n}`).join('\n');

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[{ content: 'MEETING ATTENDEES', colSpan: 2 }]],
      body: [
        ['TDE', 'DME'],
        [tdeText || 'N/A', dmeText || 'N/A']
      ],
      headStyles: { fillColor: HEADER_FILL, textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      bodyStyles: { textColor: [30, 30, 30], fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 93 }, 1: { cellWidth: 93 } },
      didParseCell: (cellData) => {
        if (cellData.section === 'body' && cellData.row.index === 0) {
          cellData.cell.styles.fillColor = SUBHEADER_FILL;
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    });

    y = (doc as any).lastAutoTable.finalY;

    // Table 6: INCIDENT SEVERITY
    const isHigh = data.severityLevel === 'HIGH';
    const isMed = data.severityLevel === 'MEDIUM';
    const isLow = data.severityLevel === 'LOW';
    const isOther = data.severityLevel === 'OTHER';

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [
        [{ content: 'INCIDENT SEVERITY', colSpan: 3 }],
        ['X', 'LEVEL', 'ADDITIONAL COMMENTS REGARDING INCIDENT SEVERTIY']
      ],
      body: [
        [isHigh ? 'X' : '', 'HIGH', data.severityComments || 'N/A'],
        [isMed ? 'X' : '', 'MEDIUM', ''],
        [isLow ? 'X' : '', 'LOW', ''],
        [isOther ? 'X' : '', 'OTHER', '']
      ],
      headStyles: { fillColor: HEADER_FILL, textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      bodyStyles: { textColor: [30, 30, 30], fontSize: 8.5, lineWidth: 0.2, lineColor: TABLE_BORDER },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 30, fontStyle: 'bold' }, 2: { cellWidth: contentW - 40 } },
      didParseCell: (cellData) => {
        if (cellData.section === 'head' && cellData.row.index === 1) {
          cellData.cell.styles.fillColor = SUBHEADER_FILL;
          cellData.cell.styles.textColor = [40, 40, 40];
          cellData.cell.styles.fontStyle = 'bold';
        }
        if (cellData.section === 'body' && cellData.row.index === 0 && cellData.column.index === 2) {
          cellData.cell.rowSpan = 4;
          cellData.cell.styles.valign = 'top';
        }
      }
    });

    drawPageFooter(1);

    // ==========================================
    // PAGE 2: SUMMARY
    // ==========================================
    doc.addPage();
    drawHeaderLogos();

    y = 28;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text('SUMMARY', margin, y);

    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: [[data.summary || 'N/A']],
      bodyStyles: { textColor: [30, 30, 30], fontSize: 9.5, lineWidth: 0.2, lineColor: TABLE_BORDER, cellPadding: 6 },
      columnStyles: { 0: { cellWidth: contentW } }
    });

    drawPageFooter(2);

    // ==========================================
    // PAGE 3: INCIDENT OVERVIEW
    // ==========================================
    doc.addPage();
    drawHeaderLogos();

    y = 28;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text('INCIDENT OVERVIEW', margin, y);

    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: [
        ['IMPACT', data.impact || 'N/A'],
        ['TRIGGER', data.trigger || 'N/A'],
        ['ROOT CAUSE', data.rootCause || 'N/A'],
        ['DETECTION', data.detection || 'N/A'],
        ['RESPONSE', data.response || 'N/A'],
        ['RESOLUTION', data.resolution || 'N/A']
      ],
      bodyStyles: { textColor: [30, 30, 30], fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold', fillColor: [248, 249, 250] },
        1: { cellWidth: contentW - 35 }
      }
    });

    drawPageFooter(3);

    // ==========================================
    // PAGE 4: CONTRIBUTING FACTORS & LESSONS LEARNED
    // ==========================================
    doc.addPage();
    drawHeaderLogos();

    y = 28;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text('CONTRIBUTING FACTORS', margin, y);

    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: [[data.contributingFactors || 'N/A']],
      bodyStyles: { textColor: [30, 30, 30], fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER, cellPadding: 6 },
      columnStyles: { 0: { cellWidth: contentW } }
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text('LESSONS LEARNED', margin, y);

    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: [
        ['What went well?', data.whatWentWell || 'N/A'],
        ['What went poorly?', data.whatWentPoorly || 'N/A'],
        ['Where were we lucky?', data.whereWereWeLucky || 'N/A']
      ],
      bodyStyles: { textColor: [30, 30, 30], fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER, cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 38, fontStyle: 'bold', fillColor: [248, 249, 250] },
        1: { cellWidth: contentW - 38 }
      }
    });

    drawPageFooter(4);

    // ==========================================
    // PAGE 5 & 6: CORRECTIVE ACTIONS
    // ==========================================
    doc.addPage();
    drawHeaderLogos();

    y = 28;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text('CORRECTIVE ACTIONS', margin, y);

    y += 4;

    const actionRows = (data.correctiveActions || []).map((ca) => [
      ca.actionItem || 'N/A',
      ca.typeOfAction || 'N/A',
      ca.assignedTo || 'N/A',
      ca.bug || 'N/A',
      `Start :\n${ca.startDate || 'N/A'}\n\nEnd :\n${ca.endDate || 'N/A'}`
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, bottom: 15 },
      head: [['ACTION ITEM', 'TYPE OF ACTION', 'ASSIGNED TO', 'BUG', 'DATE']],
      body: actionRows.length > 0 ? actionRows : [['-', '-', '-', '-', '-']],
      headStyles: { fillColor: HEADER_FILL, textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      bodyStyles: { textColor: [30, 30, 30], fontSize: 8.5, lineWidth: 0.2, lineColor: TABLE_BORDER, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 62 },
        1: { cellWidth: 36 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 28 }
      },
      didDrawPage: (pageData) => {
        if (pageData.pageNumber >= 5) {
          drawHeaderLogos();
          drawPageFooter(pageData.pageNumber);
        }
      }
    });

    let lastPageNum = (doc as any).internal.getNumberOfPages();

    // ==========================================
    // PAGE 7 & 8: SUPPORTING DOCUMENTATION
    // ==========================================
    doc.addPage();
    lastPageNum++;
    drawHeaderLogos();

    y = 28;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text('SUPPORTING DOCUMENTATION', margin, y);

    y += 6;

    if (processedPhotos.length > 0) {
      const boxW = (contentW - 6) / 2;
      const boxH = 95;

      for (let i = 0; i < processedPhotos.length; i++) {
        if (i > 0 && i % 2 === 0) {
          doc.addPage();
          lastPageNum++;
          drawHeaderLogos();
          y = 28;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(50, 50, 50);
          doc.text('SUPPORTING DOCUMENTATION (Lanjutan)', margin, y);
          y += 6;
        }

        const col = i % 2;
        const xPos = margin + col * (boxW + 6);

        // Draw photo container box
        doc.setDrawColor(TABLE_BORDER[0], TABLE_BORDER[1], TABLE_BORDER[2]);
        doc.rect(xPos, y, boxW, boxH);

        const photo = processedPhotos[i];
        if (photo.base64) {
          try {
            doc.addImage(photo.base64, 'JPEG', xPos + 2, y + 2, boxW - 4, boxH - 12);
          } catch { /* ignore */ }
        }

        // Caption bar at bottom of box
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        doc.text(photo.caption || `Foto ${i + 1}`, xPos + boxW / 2, y + boxH - 4, { align: 'center' });

        if (col === 1 || i === processedPhotos.length - 1) {
          y += boxH + 8;
        }
      }
    } else {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        body: [['Tidak ada foto dokumentasi']],
        bodyStyles: { textColor: [120, 120, 120], fontSize: 9.5, halign: 'center', cellPadding: 15 }
      });
    }

    drawPageFooter(lastPageNum);

    // ==========================================
    // PAGE 9: SIGNATURES & APPROVALS
    // ==========================================
    doc.addPage();
    lastPageNum++;
    drawHeaderLogos();

    y = 28;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [
        [
          { content: 'PREPARED BY,', colSpan: 1 },
          { content: 'REVIEWED BY,', colSpan: 2 }
        ]
      ],
      body: [
        ['\n\n\n', '\n\n\n', '\n\n\n'],
        [
          `${data.preparedByName || 'Agil Zakia Rahman'}\n(${data.preparedByTitle || 'Shift Engineer'})`,
          `${data.reviewedBy1Name || 'Arif Budiman'}\n(${data.reviewedBy1Title || 'Technical Manager'})`,
          `${data.reviewedBy2Name || 'Dwi Tasmiyadi'}\n(${data.reviewedBy2Title || 'Project manager'})`
        ]
      ],
      headStyles: { fillColor: HEADER_FILL, textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      bodyStyles: { textColor: [30, 30, 30], fontSize: 8.5, halign: 'center', lineWidth: 0.2, lineColor: TABLE_BORDER },
      columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 62 }, 2: { cellWidth: 62 } }
    });

    y = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[{ content: 'ACKNOWLEDGED BY,', colSpan: 2 }]],
      body: [
        ['\n\n\n', '\n\n\n'],
        [
          `${data.acknowledgedBy1Name || 'Andrean Bima Pratama'}\n(${data.acknowledgedBy1Title || 'Chief Engineer'})`,
          `${data.acknowledgedBy2Name || 'Supriyatno'}\n(${data.acknowledgedBy2Title || 'Facility manager'})`
        ]
      ],
      headStyles: { fillColor: HEADER_FILL, textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      bodyStyles: { textColor: [30, 30, 30], fontSize: 8.5, halign: 'center', lineWidth: 0.2, lineColor: TABLE_BORDER },
      columnStyles: { 0: { cellWidth: 93 }, 1: { cellWidth: 93 } }
    });

    y = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[{ content: 'APPROVED BY,', colSpan: 2 }]],
      body: [
        ['\n\n\n', '\n\n\n'],
        [
          `${data.approvedBy1Name || 'Budi Susanto'}\n(${data.approvedBy1Title || 'Assistant manager HDC Facility Management'})`,
          `${data.approvedBy2Name || 'Rezki Rahman Daulay'}\n(${data.approvedBy2Title || 'Manager HDC Operation'})`
        ]
      ],
      headStyles: { fillColor: HEADER_FILL, textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      bodyStyles: { textColor: [30, 30, 30], fontSize: 8.5, halign: 'center', lineWidth: 0.2, lineColor: TABLE_BORDER },
      columnStyles: { 0: { cellWidth: 93 }, 1: { cellWidth: 93 } }
    });

    y = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[{ content: 'APPROVED BY,', colSpan: 1 }]],
      body: [
        ['\n\n\n'],
        [`${data.approvedBy3Name || 'Muryani'}\n(${data.approvedBy3Title || 'EGM DC Operation'})`]
      ],
      headStyles: { fillColor: HEADER_FILL, textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 9, lineWidth: 0.2, lineColor: TABLE_BORDER },
      bodyStyles: { textColor: [30, 30, 30], fontSize: 8.5, halign: 'center', lineWidth: 0.2, lineColor: TABLE_BORDER },
      columnStyles: { 0: { cellWidth: contentW } }
    });

    drawPageFooter(lastPageNum);

    // Save PDF
    const cleanFileName = `PIR_Report_${(data.incidentName || 'Incident').replace(/[^a-zA-Z0-9]/g, '_')}_${(data.incidentDate || 'Date').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    doc.save(cleanFileName);

    toast.success('PDF Postmortem Incident Report (PIR) berhasil diunduh!', { id: toastId });
  } catch (error) {
    console.error('Failed to export PIR PDF:', error);
    toast.error('Gagal mengekspor PDF Postmortem Incident Report', { id: toastId });
  }
}
