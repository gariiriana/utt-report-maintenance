import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DigitizedPaperReportResult } from '@/utils/aiAgentPipeline';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { toast } from 'sonner';

/** Helper to convert image URL to base64 */
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
 * Generate a professional SINGLE PAGE A4 Service Report PDF for Digitized Paper Report.
 * Strict 1-page layout without paper photos attachment.
 */
export async function generateDigitizedPaperPDF(
  scanResult: DigitizedPaperReportResult,
  _photos?: string[] // unused intentionally per user request
): Promise<jsPDF> {
  const toastId = toast.loading('Membuat dokumen PDF Laporan Service Report (1 Lembar)...');

  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageW = doc.internal.pageSize.getWidth(); // 210mm
    const pageH = doc.internal.pageSize.getHeight(); // 297mm
    const margin = 8;
    const contentW = pageW - 2 * margin; // 194mm
    let y = margin;

    // DME Signature Blue Top Stripe
    doc.setFillColor(2, 132, 199); // #0284c7 (DME Logo Blue)
    doc.rect(0, 0, pageW, 2.5, 'F');

    // Load Logos
    let logoLeft: string | null = null;
    let logoRight: string | null = null;
    try { logoLeft = await loadImageBase64(logoDwimitra); } catch { /* fallback */ }
    try { logoRight = await loadImageBase64(logoNeutraDC); } catch { /* fallback */ }

    // ─── 1. HEADER BANNER ──────────────────────────────────────────
    const headerH = 16;
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.3);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentW, headerH, 'FD');

    if (logoLeft) {
      doc.addImage(logoLeft, 'PNG', margin + 2.5, y + 2.5, 28, 11);
    }
    if (logoRight) {
      doc.addImage(logoRight, 'PNG', pageW - margin - 31, y + 2.5, 28, 11);
    }

    const centerX = pageW / 2;
    doc.setFont('helvetica', 'bold').setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('SERVICE REPORT MAINTENANCE (DIGITAL)', centerX, y + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal').setFontSize(8);
    doc.setTextColor(2, 132, 199);
    doc.text('PT. DWIMITRA EKATAMA MANDIRI', centerX, y + 10, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Data Center Maintenance & Field Operations System', centerX, y + 13.5, { align: 'center' });

    y += headerH + 3;

    // ─── 2. CUSTOMER & EQUIPMENT INFO BOX ─────────────────────────
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.setTextColor(2, 132, 199);
    doc.text('INFORMASI UMUM & PERALATAN (HASIL DIGITALISASI)', margin, y);
    y += 2;

    const info = scanResult.equipment_info || {};
    const infoRows: string[][] = [
      [
        'Pelanggan / Customer', info['Pelanggan'] || info['Customer'] || 'Neutra DC / PT UTT',
        'Lokasi / Area', info['Lokasi'] || info['Location'] || '-'
      ],
      [
        'Peralatan / Equipment', info['Peralatan'] || info['Equipment'] || scanResult.title || '-',
        'ID / No. Serial', info['ID'] || info['Serial No'] || info['No Seri'] || '-'
      ],
      [
        'Merk / Brand', info['Merk'] || info['Brand'] || '-',
        'Spesifikasi / Rating', info['Spesifikasi'] || info['Spec'] || '-'
      ],
      [
        'Tanggal Maintenance', info['Tanggal'] || info['Date'] || new Date().toLocaleDateString('id-ID'),
        'Teknisi / Engineer', info['Teknisi'] || info['Engineer'] || 'PT DEM Team'
      ]
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: infoRows,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.2,
        lineColor: [224, 242, 254],
        lineWidth: 0.2,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [240, 249, 255], textColor: [3, 105, 161], cellWidth: 38 },
        1: { cellWidth: 59 },
        2: { fontStyle: 'bold', fillColor: [240, 249, 255], textColor: [3, 105, 161], cellWidth: 38 },
        3: { cellWidth: 59 }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 4;

    // Calculate maximum available space for tables (Signature block starts at pageH - margin - 22)
    const sigHeight = 22;
    const maxTableY = pageH - margin - sigHeight - 4; // ~263mm

    // ─── 3. DIGITIZED TABLES (DME SIGNATURE BLUE) ─────────────────
    if (scanResult.tables && scanResult.tables.length > 0) {
      // Calculate total rows across tables to dynamically adjust padding if needed
      const totalRows = scanResult.tables.reduce((acc, t) => acc + (t.rows?.length || 0), 0);
      const isTight = totalRows > 18;
      const cellPadding = isTight ? 0.9 : 1.3;
      const fontSize = isTight ? 6.5 : 7;

      for (let idx = 0; idx < scanResult.tables.length; idx++) {
        const tbl = scanResult.tables[idx];

        // Table Section Title
        if (y + 10 < maxTableY) {
          doc.setFont('helvetica', 'bold').setFontSize(8);
          doc.setTextColor(3, 105, 161);
          doc.text(`TABEL ${idx + 1}: ${tbl.table_name || 'HASIL SCAN CHECKLIST & PENGUKURAN'}`, margin, y);
          y += 2;

          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [tbl.headers || ['No', 'Uraian Pekerjaan / Parameter', 'Kondisi / Nilai', 'Catatan']],
            body: tbl.rows || [],
            theme: 'grid',
            headStyles: {
              fillColor: [2, 132, 199], // DME Logo Blue
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: fontSize + 0.5,
              halign: 'left',
              valign: 'middle'
            },
            bodyStyles: {
              fontSize: fontSize,
              textColor: [30, 41, 59],
              cellPadding: cellPadding,
              lineColor: [226, 232, 240],
              lineWidth: 0.2
            },
            alternateRowStyles: {
              fillColor: [248, 250, 252]
            }
          });

          y = (doc as any).lastAutoTable.finalY + 4;
        }
      }
    }

    // ─── 4. SIGNATURE BLOCK ANCHORED AT BOTTOM OF PAGE 1 ────────────
    const sigY = pageH - margin - sigHeight; // Always at bottom of single A4 page
    const sigW = contentW / 3;

    doc.setFont('helvetica', 'bold').setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);

    // Box 1: Performed By
    doc.rect(margin, sigY, sigW - 1, sigHeight);
    doc.setFillColor(240, 249, 255);
    doc.rect(margin, sigY, sigW - 1, 4.5, 'F');
    doc.setTextColor(3, 105, 161);
    doc.text('PERFORMED BY (ENGINEER)', margin + (sigW / 2), sigY + 3, { align: 'center' });
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.5);
    doc.text('PT. Dwimitra Ekatama Mandiri', margin + (sigW / 2), sigY + sigHeight - 2, { align: 'center' });

    // Box 2: Checked By
    doc.rect(margin + sigW, sigY, sigW - 1, sigHeight);
    doc.setFillColor(240, 249, 255);
    doc.rect(margin + sigW, sigY, sigW - 1, 4.5, 'F');
    doc.setFontSize(7);
    doc.setTextColor(3, 105, 161);
    doc.text('CHECKED BY (SITE MANAGER)', margin + sigW + (sigW / 2), sigY + 3, { align: 'center' });
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.5);
    doc.text('Neutra DC / PT UTT', margin + sigW + (sigW / 2), sigY + sigHeight - 2, { align: 'center' });

    // Box 3: Approved By
    doc.rect(margin + (2 * sigW), sigY, sigW - 1, sigHeight);
    doc.setFillColor(240, 249, 255);
    doc.rect(margin + (2 * sigW), sigY, sigW - 1, 4.5, 'F');
    doc.setFontSize(7);
    doc.setTextColor(3, 105, 161);
    doc.text('APPROVED BY (CUSTOMER)', margin + (2 * sigW) + (sigW / 2), sigY + 3, { align: 'center' });
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.5);
    doc.text('Operational Representative', margin + (2 * sigW) + (sigW / 2), sigY + sigHeight - 2, { align: 'center' });

    toast.success('PDF Laporan Service Report (1 Lembar) berhasil dibuat!', { id: toastId });
    return doc;
  } catch (err: any) {
    console.error(err);
    toast.error(`Gagal membuat PDF: ${err?.message}`, { id: toastId });
    throw err;
  }
}
