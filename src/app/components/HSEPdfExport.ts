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
    safetySign: boolean;
    fullBodyHarness: boolean;
}

export interface HSEPhoto {
    base64: string;
    description: string;
}

export interface HSEFormData {
    aktivitas: string;
    lokasi: string;
    personil: string;
    pic: string;
    anggota: string;
    checklist: HSEChecklist;
    photos: HSEPhoto[];
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
    const logoDmeModule = await import('@/assets/logo_dwimitra_v2.png');
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

    // Logo DME (kiri) - Matching ReportForm.tsx (isDwimitra ? 28 : 18)
    const leftW = 28;
    const leftH = 18;
    const headerTopY = 8;

    if (logoDmeB64) {
        doc.addImage(logoDmeB64, 'JPEG', marginL, headerTopY, leftW, leftH, 'logo_left', 'FAST');
    } else {
        doc.setFontSize(10);
        doc.setTextColor(DARK);
        doc.setFont('helvetica', 'bold');
        doc.text('DME', marginL, headerTopY + 6);
    }

    // Logo neutraDC (kanan) - Matching ReportForm.tsx (isDwimitra ? 36 : 14)
    const rightW = 36;
    const rightH = 14;
    if (logoNeutradcB64) {
        // Vertically center right logo relative to left logo height (matching logic)
        const rightY = headerTopY + (leftH - rightH) / 2;
        doc.addImage(logoNeutradcB64, 'JPEG', pageW - marginR - rightW, rightY, rightW, rightH, 'logo_right', 'FAST');
    } else {
        doc.setFontSize(10);
        doc.setTextColor(DARK);
        doc.setFont('helvetica', 'bold');
        doc.text('neutraDC', pageW - marginR - 20, headerTopY + 6);
    }

    // Center Title
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(DARK);
    const titleY = headerTopY + 4;
    doc.text('HSE INSPECTION REPORT', pageW / 2, titleY, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GRAY);
    doc.text('Health, Safety & Environment — Maintenance Checklist', pageW / 2, titleY + 5, { align: 'center' });

    // Date
    const dateStr = data.date || new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.setFontSize(8);
    doc.text(`Tanggal: ${dateStr}`, pageW / 2, titleY + 9.5, { align: 'center' });

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
        { label: 'Safety Sign', value: data.checklist.safetySign },
        { label: 'Full Body Harness (Optional)', value: data.checklist.fullBodyHarness },
    ].filter(item => {
        // Filter out optional items if they are false (not selected)
        if (item.label.includes('(Optional)')) {
            return item.value === true;
        }
        return true;
    });

    const colW = (contentW - 6) / 2;
    const rowH = 8;
    const itemsPerCol = Math.ceil(checklistItems.length / 2);
    const col1Items = checklistItems.slice(0, itemsPerCol);
    const col2Items = checklistItems.slice(itemsPerCol);

    const drawChecklistCol = (items: typeof checklistItems, startX: number, startY: number) => {
        items.forEach((item, i) => {
            const y = startY + i * rowH;
            const bgColor = i % 2 === 0 ? '#f8fafc' : '#ffffff';

            doc.setFillColor(bgColor);
            doc.rect(startX, y, colW, rowH, 'F');

            // Check icon using vector lines for maximum precision
            const checked = item.value;
            const centerX = startX + 5;
            const centerY = y + rowH / 2;

            if (checked) {
                // Green Circle
                doc.setFillColor(22, 163, 74);
                doc.circle(centerX, centerY, 2.8, 'F');
                // White Checkmark Draw
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.45);
                doc.line(centerX - 1.2, centerY, centerX - 0.3, centerY + 0.9);
                doc.line(centerX - 0.3, centerY + 0.9, centerX + 1.2, centerY - 1);
            } else {
                // Red Circle
                doc.setFillColor(220, 38, 38);
                doc.circle(centerX, centerY, 2.8, 'F');
                // White X Draw
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.45);
                doc.line(centerX - 1, centerY - 1, centerX + 1, centerY + 1);
                doc.line(centerX + 1, centerY - 1, centerX - 1, centerY + 1);
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
        const descriptionH = 8; // Extra height for description line

        for (let i = 0; i < data.photos.length; i++) {
            const col = i % photosPerRow;
            const x = marginL + col * (photoW + photoGap);

            // New page if needed - checking photo + description height
            if (curY + photoH + descriptionH > pageH - 20) {
                doc.addPage();
                curY = 15;

                // Page header
                doc.setFillColor(22, 163, 74);
                doc.rect(0, 0, pageW, 2, 'F');
            }

            const y = curY;

            try {
                // Determine image type and compress
                const photo = data.photos[i];
                const rawImgData = photo.base64;
                const imgData = await compressBase64Image(rawImgData, { maxWidth: 800, quality: 0.5 });
                const imgType = 'JPEG';
                doc.addImage(imgData, imgType, x, y, photoW, photoH, `photo_${i}`, 'FAST');

                // Photo Border
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.2);
                doc.rect(x, y, photoW, photoH);

                // Photo description text
                if (photo.description) {
                    doc.setFontSize(7.5);
                    doc.setFont('helvetica', 'italic');
                    doc.setTextColor(DARK);
                    const descLines = doc.splitTextToSize(photo.description, photoW);
                    doc.text(descLines, x, y + photoH + 3.5);
                }
            } catch (_) {
                // Draw placeholder
                doc.setFillColor(220, 220, 220);
                doc.rect(x, y, photoW, photoH, 'F');
                doc.setFontSize(7);
                doc.setTextColor(150, 150, 150);
                doc.text('Foto Error', x + photoW / 2, y + photoH / 2, { align: 'center' });
            }

            // Photo number label badge
            doc.setFillColor(0, 0, 0, 0.7);
            doc.rect(x, y + photoH - 6, 12, 6, 'F');
            doc.setFontSize(7);
            doc.setTextColor('#ffffff');
            doc.setFont('helvetica', 'bold');
            doc.text(`${i + 1}`, x + 6, y + photoH - 1.8, { align: 'center' });

            // Move to next row after filling a row
            if (col === photosPerRow - 1 || i === data.photos.length - 1) {
                curY += photoH + descriptionH + photoGap;
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
