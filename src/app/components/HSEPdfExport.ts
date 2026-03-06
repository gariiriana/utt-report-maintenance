import { jsPDF } from 'jspdf';
import { compressBase64Image } from '@/lib/imageCompression';

export interface HSEChecklist {
    mop: boolean;
    jsa: boolean;
    ptw: boolean;
    ppe: boolean;
    toolsBertagging: boolean;
    logMaintenance: boolean;
    housekeeping: boolean;
    safeCondition: boolean;
    safeAction: boolean;
}

export interface HSEFormData {
    aktivitas: string;
    lokasi: string;
    personil: string;
    pic: string;
    anggota: string;
    checklist: HSEChecklist;
    photos: string[]; // base64 dataURLs
    date?: string;
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
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve('');
        img.src = url;
    });
}

export async function generateHSEPdf(data: HSEFormData) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginL = 14;
    const marginR = 14;
    const contentW = pageW - marginL - marginR;

    // ── Colors ──────────────────────────────────────────────────────────
    const GREEN = '#16a34a';
    const DARK = '#0f172a';
    const GRAY = '#64748b';
    const LIGHT_GRAY = '#f1f5f9';

    // ── Load logos ───────────────────────────────────────────────────────
    // Dynamically import logo paths
    const logoDmeModule = await import('@/assets/logo_dwimitra.png');
    const logoNeutradcModule = await import('@/assets/logo_neutradc.png');

    let logoDmeB64 = '';
    let logoNeutradcB64 = '';
    try {
        logoDmeB64 = await loadImageAsBase64(logoDmeModule.default);
        logoNeutradcB64 = await loadImageAsBase64(logoNeutradcModule.default);
    } catch (_) {
        // logos not loaded, continue without them
    }

    // ── HEADER ───────────────────────────────────────────────────────────
    // Green gradient top bar
    doc.setFillColor(22, 163, 74); // green-600
    doc.rect(0, 0, pageW, 3, 'F');

    // Logo DME (kiri)
    const logoH = 18;
    const logoW = 35;
    if (logoDmeB64) {
        doc.addImage(logoDmeB64, 'JPEG', marginL, 5, logoW, logoH, 'logo_dme', 'FAST');
    } else {
        doc.setFontSize(10);
        doc.setTextColor(DARK);
        doc.setFont('helvetica', 'bold');
        doc.text('DME', marginL, 14);
    }

    // Logo neutraDC (kanan)
    if (logoNeutradcB64) {
        doc.addImage(logoNeutradcB64, 'JPEG', pageW - marginR - logoW, 5, logoW, logoH, 'logo_neutra', 'FAST');
    } else {
        doc.setFontSize(10);
        doc.setTextColor(DARK);
        doc.setFont('helvetica', 'bold');
        doc.text('neutraDC', pageW - marginR - 20, 14);
    }

    // Center Title
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(DARK);
    doc.text('HSE INSPECTION REPORT', pageW / 2, 12, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GRAY);
    doc.text('Health, Safety & Environment — Maintenance Checklist', pageW / 2, 17, { align: 'center' });

    // Date
    const dateStr = data.date || new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.setFontSize(8);
    doc.text(`Tanggal: ${dateStr}`, pageW / 2, 21.5, { align: 'center' });

    // Separator line
    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.6);
    doc.line(marginL, 26, pageW - marginR, 26);

    let curY = 30;

    // ── INFO SECTION ─────────────────────────────────────────────────────
    doc.setFillColor(LIGHT_GRAY);
    doc.roundedRect(marginL, curY, contentW, 44, 3, 3, 'F');

    const infoRows = [
        { label: 'Aktivitas', value: data.aktivitas || '-' },
        { label: 'Lokasi', value: data.lokasi || '-' },
        { label: 'Personil', value: data.personil || '-' },
        { label: 'PIC', value: data.pic || '-' },
        { label: 'Anggota', value: data.anggota || '-' },
    ];

    infoRows.forEach((row, i) => {
        const rowY = curY + 5 + i * 7.5;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(DARK);
        doc.text(`${row.label}`, marginL + 4, rowY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(GRAY);
        doc.text(':', marginL + 26, rowY);

        doc.setTextColor(DARK);
        const lines = doc.splitTextToSize(row.value, contentW - 35);
        doc.text(lines[0], marginL + 30, rowY);
    });

    curY += 48;

    // ── CHECKLIST SECTION ─────────────────────────────────────────────────
    // Section header
    doc.setFillColor(GREEN);
    doc.roundedRect(marginL, curY, contentW, 8, 2, 2, 'F');
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#ffffff');
    doc.text('CHECKLIST KESELAMATAN KERJA', marginL + 4, curY + 5.5);

    curY += 11;

    // Checklist items - 2 column layout
    const checklistItems = [
        { label: 'MOP', value: data.checklist.mop },
        { label: 'JSA', value: data.checklist.jsa },
        { label: 'PTW', value: data.checklist.ptw },
        { label: 'PPE', value: data.checklist.ppe },
        { label: 'Tools Bertagging & sdh di-checklist', value: data.checklist.toolsBertagging },
        { label: 'Log Maintenance', value: data.checklist.logMaintenance },
        { label: 'Housekeeping Area Project', value: data.checklist.housekeeping },
        { label: 'Safe Condition', value: data.checklist.safeCondition },
        { label: 'Safe Action', value: data.checklist.safeAction },
    ];

    const col1Items = checklistItems.slice(0, 5);
    const col2Items = checklistItems.slice(5);
    const colW = (contentW - 6) / 2;
    const rowH = 8;

    const drawChecklistCol = (items: typeof checklistItems, startX: number, startY: number) => {
        items.forEach((item, i) => {
            const y = startY + i * rowH;
            const bgColor = i % 2 === 0 ? '#f8fafc' : '#ffffff';

            doc.setFillColor(bgColor);
            doc.rect(startX, y, colW, rowH, 'F');

            // Check icon
            const checked = item.value;
            if (checked) {
                doc.setFillColor(22, 163, 74);
                doc.circle(startX + 5, y + rowH / 2, 3, 'F');
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor('#ffffff');
                doc.text('✓', startX + 3.5, y + rowH / 2 + 2.5);
            } else {
                doc.setFillColor(220, 38, 38);
                doc.circle(startX + 5, y + rowH / 2, 3, 'F');
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor('#ffffff');
                doc.text('✗', startX + 3.5, y + rowH / 2 + 2.5);
            }

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(DARK);
            doc.text(item.label, startX + 11, y + rowH / 2 + 1.5);
        });
    };

    drawChecklistCol(col1Items, marginL, curY);
    drawChecklistCol(col2Items, marginL + colW + 6, curY);

    // Outline box
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(marginL, curY, colW, col1Items.length * rowH);
    doc.rect(marginL + colW + 6, curY, colW, col2Items.length * rowH);

    curY += Math.max(col1Items.length, col2Items.length) * rowH + 8;

    // ── NOTES LINE ───────────────────────────────────────────────────────
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(GRAY);
    doc.text(
        'Demikian untuk menjadi rujukan terima kasih. Safety first "Yes" Accident "No".',
        marginL,
        curY
    );
    curY += 8;

    // ── FOTO DOKUMENTASI ─────────────────────────────────────────────────
    if (data.photos && data.photos.length > 0) {
        // Section header
        doc.setFillColor(GREEN);
        doc.roundedRect(marginL, curY, contentW, 8, 2, 2, 'F');
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#ffffff');
        doc.text('FOTO DOKUMENTASI', marginL + 4, curY + 5.5);
        curY += 12;

        const photosPerRow = 3;
        const photoGap = 4;
        const photoW = (contentW - photoGap * (photosPerRow - 1)) / photosPerRow;
        const photoH = photoW * 0.75; // 4:3 aspect

        for (let i = 0; i < data.photos.length; i++) {
            const col = i % photosPerRow;
            const x = marginL + col * (photoW + photoGap);

            // New page if needed
            if (curY + photoH > pageH - 20) {
                doc.addPage();
                curY = 15;

                // Page header
                doc.setFillColor(22, 163, 74);
                doc.rect(0, 0, pageW, 2, 'F');
            }

            const y = curY;

            try {
                // Determine image type and compress
                const rawImgData = data.photos[i];
                const imgData = await compressBase64Image(rawImgData, { maxWidth: 800, quality: 0.5 });
                const imgType = 'JPEG';
                doc.addImage(imgData, imgType, x, y, photoW, photoH, `photo_${i}`, 'FAST');
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.2);
                doc.rect(x, y, photoW, photoH);
            } catch (_) {
                // Draw placeholder
                doc.setFillColor(220, 220, 220);
                doc.rect(x, y, photoW, photoH, 'F');
                doc.setFontSize(7);
                doc.setTextColor(150, 150, 150);
                doc.text('Foto', x + photoW / 2, y + photoH / 2, { align: 'center' });
            }

            // Photo number label
            doc.setFillColor(0, 0, 0, 0.5);
            doc.setFontSize(7);
            doc.setTextColor('#ffffff');
            doc.setFillColor(0, 0, 0);
            doc.rect(x, y + photoH - 5, 14, 5, 'F');
            doc.text(`Foto ${i + 1}`, x + 1, y + photoH - 1.5);

            // Move to next row after filling a row
            if (col === photosPerRow - 1 || i === data.photos.length - 1) {
                curY += photoH + photoGap;
            }
        }
    }

    // ── FOOTER ────────────────────────────────────────────────────────────
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);

        doc.setFillColor(22, 163, 74);
        doc.rect(0, pageH - 2, pageW, 2, 'F');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(GRAY);
        doc.text('PT United Transworld Trading — HSE Inspection Report', marginL, pageH - 5);
        doc.text(`Halaman ${pg} / ${totalPages}`, pageW - marginR, pageH - 5, { align: 'right' });
    }

    // Save
    const fileName = `HSE_Report_${data.aktivitas || 'Inspection'}_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.pdf`;
    doc.save(fileName);
}
