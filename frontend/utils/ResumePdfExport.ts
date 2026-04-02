import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoDme from '@/assets/logo_dwimitra_v2.png';
import logoUtt from '@/assets/logo_utt.png';

interface CategorySummary {
  category: string;
  plan_qty: number;
  weight_percent: number;
  yesterday_qty: number;
  yesterday_percent: number;
  today_qty: number;
  today_percent: number;
}

interface MaintenanceSummary {
  category_summaries: CategorySummary[];
  total_plan_qty: number;
  total_yesterday_qty: number;
  total_yesterday_percent: number;
  total_today_qty: number;
  total_today_percent: number;
  daily_progress: number;
}

function loadImageAsBase64(url: string): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            }
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve('');
        img.src = url;
    });
}

export async function generateResumePdf(summary: MaintenanceSummary) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentW = pageW - (margin * 2);

    // Load Logos
    let logoDmeB64 = '';
    let logoUttB64 = '';
    try {
        logoDmeB64 = await loadImageAsBase64(logoDme);
        logoUttB64 = await loadImageAsBase64(logoUtt);
    } catch (_) {}

    // 1. Header with Logos
    doc.setFillColor(0, 89, 156); // DME Blue
    doc.rect(0, 0, pageW, 2.5, 'F');

    if (logoDmeB64) {
        doc.addImage(logoDmeB64, 'JPEG', margin, 8, 25, 15);
    }
    if (logoUttB64) {
        doc.addImage(logoUttB64, 'JPEG', pageW - margin - 25, 8, 25, 12);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('MAINTENANCE PROGRESS RESUME', pageW / 2, 18, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Reporting & Monitoring System - Q1 2026', pageW / 2, 23, { align: 'center' });

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 30, pageW - margin, 30);

    // 2. Info Section (Date)
    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.setFontSize(10);
    doc.setTextColor(0, 89, 156);
    doc.setFont('helvetica', 'bold');
    doc.text(`Tanggal Laporan: ${dateStr}`, margin, 38);

    // 3. Overall Stats Cards
    const startY = 45;
    const cardW = (contentW - 10) / 3;
    const cardH = 22;

    // Card Backgrounds
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, startY, cardW, cardH, 2, 2, 'FD');
    doc.roundedRect(margin + cardW + 5, startY, cardW, cardH, 2, 2, 'FD');
    doc.roundedRect(margin + (cardW + 5) * 2, startY, cardW, cardH, 2, 2, 'FD');

    // Card Texts
    const drawCard = (idx: number, title: string, value: string, sub: string, color = [30, 41, 59]) => {
        const x = margin + (cardW + 5) * idx;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(title, x + 5, startY + 7);
        
        doc.setFontSize(14);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(value, x + 5, startY + 14);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(sub, x + 5, startY + 19);
    };

    drawCard(0, 'PROGRESS KEMARIN', `${summary.total_yesterday_percent.toFixed(2)}%`, `${summary.total_yesterday_qty.toFixed(2)} unit`);
    drawCard(1, 'TOTAL PROGRESS', `${summary.total_today_percent.toFixed(2)}%`, `${summary.total_today_qty.toFixed(2)} unit`, [0, 89, 156]);
    drawCard(2, 'DAILY GROWTH', `+${summary.daily_progress.toFixed(2)}%`, 'Peningkatan harian', [16, 185, 129]);

    // 4. Main Table
    const tableData = summary.category_summaries.map((cat, idx) => [
        `1.${idx + 1}`,
        cat.category,
        cat.plan_qty.toLocaleString(),
        `${cat.weight_percent.toFixed(2)}%`,
        cat.yesterday_qty.toLocaleString(),
        `${cat.yesterday_percent.toFixed(2)}%`,
        cat.today_qty.toLocaleString(),
        `${cat.today_percent.toFixed(2)}%`
    ]);

    autoTable(doc, {
        startY: startY + cardH + 10,
        head: [
            [
                { content: 'No', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } }, 
                { content: 'DESKRIPSI', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } }, 
                { content: 'PLAN', colSpan: 2, styles: { halign: 'center' } }, 
                { content: 'PROGRESS', colSpan: 4, styles: { halign: 'center' } }
            ],
            [
                { content: 'Qty', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }, 
                { content: 'Weight %', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }, 
                { content: 'Yesterday', colSpan: 2, styles: { halign: 'center' } }, 
                { content: 'Today', colSpan: 2, styles: { halign: 'center' } }
            ],
            [
                { content: 'Qty', styles: { halign: 'center' } }, 
                { content: 'Weight %', styles: { halign: 'center' } }, 
                { content: 'Qty', styles: { halign: 'center' } }, 
                { content: 'Weight %', styles: { halign: 'center' } }
            ]
        ],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [0, 89, 156],
            textColor: 255,
            fontSize: 7,
            fontStyle: 'bold',
            lineWidth: 0.1
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 'auto', halign: 'center' },
            2: { cellWidth: 15, halign: 'center' },
            3: { cellWidth: 15, halign: 'center' },
            4: { cellWidth: 15, halign: 'center' },
            5: { cellWidth: 15, halign: 'center' },
            6: { cellWidth: 15, halign: 'center' },
            7: { cellWidth: 15, halign: 'center' }
        },
        bodyStyles: {
            fontSize: 8.5,
            textColor: 51
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 5) {
                doc.setTextColor(16, 185, 129); // Emerald for Yesterday %
            }
            if (data.section === 'body' && data.column.index === 7) {
                doc.setTextColor(0, 89, 156); // Blue for Today %
            }
        }
    });

    // Footer
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
            `PT United Transworld Trading - Maintenance Management System`,
            margin,
            doc.internal.pageSize.getHeight() - 10
        );
        doc.text(
            `Halaman ${i} dari ${totalPages}`,
            pageW - margin,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'right' }
        );
    }

    doc.save(`Maintenance_Resume_${dateStr.replace(/ /g, '_')}.pdf`);
}
