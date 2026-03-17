import { jsPDF } from 'jspdf';
import { compressBase64Image } from '@/utils/imageCompression';
import logoDme from '@/assets/logo_dwimitra_v2.png';
import logoUtt from '@/assets/logo_utt.png';
import logoNeutradc from '@/assets/logo_neutradc.png';

export interface HSEChecklist {
    mop: boolean;
    jsa: boolean;
    ptw: boolean;
    ppe: boolean;
    toolsBertagging: boolean;
    logMaintenance: boolean;
    housekeeping: boolean;
    statusCheck?: boolean;
    safeCondition: boolean;
    safeAction: boolean;
    safetySign: boolean;
    ppeKhusus?: boolean;
    bodyHarness?: boolean;
    sarungTanganKulit?: boolean;
    apron?: boolean;
    kedokLas?: boolean;
    coverShoes?: boolean;
    respirator?: boolean;
    pitaBaricade?: boolean;
    safetyCone?: boolean;
    stikBariket?: boolean;
    fullBodyHarness?: boolean;
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
    inspectorK3: string;
    checklist: HSEChecklist;
    photos: HSEPhoto[];
    date?: string;
    reportType?: 'utt' | 'neutradc';
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

function createHSEDpdDoc(data: HSEFormData, logoDmeB64: string, logoNeutradcB64: string): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginL = 14;
    const marginR = 14;
    const contentW = pageW - marginL - marginR;

    const GREEN = '#16a34a';
    const DARK = '#0f172a';
    const GRAY = '#64748b';
    const LIGHT_GRAY = '#f1f5f9';

    const HEADER_H = 30;
    let headerDrawCount = 0;
    const drawPageHeader = () => {
        headerDrawCount++;
        const pg = headerDrawCount;

        doc.setFillColor(22, 163, 74);
        doc.rect(0, 0, pageW, 3, 'F');

        const leftW = 28;
        const leftH = 18;
        const headerTopY = 8;

        if (logoDmeB64) {
            doc.addImage(logoDmeB64, 'JPEG', marginL, headerTopY, leftW, leftH, `logo_left_${pg}`, 'FAST');
        } else {
            doc.setFontSize(10);
            doc.setTextColor(DARK);
            doc.setFont('helvetica', 'bold');
            doc.text('DME', marginL, headerTopY + 6);
        }

        const rightW = 32;
        const rightH = 12;
        const isUTT = data.reportType === 'utt';
        
        if (logoNeutradcB64) {
            const rightY = headerTopY + (leftH - rightH) / 2;
            doc.addImage(logoNeutradcB64, 'JPEG', pageW - marginR - rightW, rightY, rightW, rightH, `logo_right_${pg}`, 'FAST');
        } else {
            doc.setFontSize(9);
            doc.setTextColor(DARK);
            doc.setFont('helvetica', 'bold');
            doc.text(isUTT ? 'UTT' : 'neutraDC', pageW - marginR - 20, headerTopY + 6);
        }

        const titleY = headerTopY + 4;
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(DARK);
        doc.text('HSE INSPECTION REPORT', pageW / 2, titleY, { align: 'center' });

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(GRAY);
        doc.text('Health, Safety & Environment — Documentation', pageW / 2, titleY + 5, { align: 'center' });

        const dateStr = data.date || new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        doc.setFontSize(8);
        doc.text(`Tanggal: ${dateStr}`, pageW / 2, titleY + 9.5, { align: 'center' });

        doc.setDrawColor(22, 163, 74);
        doc.setLineWidth(0.6);
        doc.line(marginL, 26, pageW - marginR, 26);
    };

    drawPageHeader();
    let curY = HEADER_H;

    doc.setFillColor(LIGHT_GRAY);
    doc.roundedRect(marginL, curY, contentW, 53, 3, 3, 'F');

    const infoRows = [
        { label: 'Inspector K3', value: data.inspectorK3 || '-' },
        { label: 'Aktivitas', value: data.aktivitas || '-' },
        { label: 'Lokasi', value: data.lokasi || '-' },
        { label: 'Personil', value: data.personil || '-' },
        { label: 'PIC', value: data.pic || '-' },
        { label: 'Anggota', value: data.anggota || '-' },
    ];

    infoRows.forEach((row, i) => {
        const rowY = curY + 6 + i * 7.5;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(DARK);
        doc.text(`${row.label}`, marginL + 4, rowY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(GRAY);
        doc.text(':', marginL + 28, rowY);

        doc.setTextColor(DARK);
        const lines = doc.splitTextToSize(row.value, contentW - 35);
        doc.text(lines[0], marginL + 32, rowY);
    });

    curY += 49;

    doc.setFillColor(GREEN);
    doc.roundedRect(marginL, curY, contentW, 8, 2, 2, 'F');
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#ffffff');
    doc.text('CHECKLIST KESELAMATAN KERJA', marginL + 4, curY + 5.5);

    curY += 11;

    const checklistDefinition = [
        { key: 'mop', label: 'MOP' },
        { key: 'jsa', label: 'JSA' },
        { key: 'ptw', label: 'PTW' },
        { key: 'ppe', label: 'PPE Mandatory' },
        { 
            key: 'ppeKhusus', 
            label: 'PPE Khusus',
            subItems: [
                { key: 'bodyHarness', label: 'Body Harness' },
                { key: 'sarungTanganKulit', label: 'Sarung Tangan Kulit' },
                { key: 'apron', label: 'Apron' },
                { key: 'kedokLas', label: 'Kedok Las' },
                { key: 'coverShoes', label: 'Cover Shoes' },
                { key: 'respirator', label: 'Respirator' },
            ]
        },
        { key: 'toolsBertagging', label: 'Tools Bertagging & sdh di-checklist' },
        { key: 'logMaintenance', label: 'Log Maintenance' },
        { key: 'housekeeping', label: 'Housekeeping Area Kerja' },
        { 
            key: 'safetySign', 
            label: 'Safety Sign',
            subItems: [
                { key: 'pitaBaricade', label: 'Pita Baricade' },
                { key: 'safetyCone', label: 'Safety Cone' },
                { key: 'stikBariket', label: 'Stik Bariket' },
            ]
        },
    ];

    const regularItems: { label: string; value: boolean; isSub?: boolean }[] = [];
    checklistDefinition.forEach(item => {
        const val = !!(data.checklist as any)[item.key];
        regularItems.push({ label: item.label, value: val });
        
        if (val && item.subItems) {
            item.subItems.forEach(sub => {
                const subVal = !!(data.checklist as any)[sub.key];
                if (subVal) {
                    regularItems.push({ label: sub.label, value: true, isSub: true });
                }
            });
        }
    });

    const conclusionItems = [
        { label: 'Safe Condition', value: data.checklist.safeCondition },
        { label: 'Safe Action', value: data.checklist.safeAction },
    ];

    const colW = (contentW - 6) / 2;
    const rowH = 7.5;
    const itemsPerCol = Math.ceil(regularItems.length / 2);
    const col1Items = regularItems.slice(0, itemsPerCol);
    const col2Items = regularItems.slice(itemsPerCol);

    const drawChecklistItem = (item: { label: string, value: boolean, isSub?: boolean }, x: number, y: number, width: number, isConclusion = false) => {
        const bgColor = isConclusion ? '#f0f9ff' : (Math.floor(y / rowH) % 2 === 0 ? '#f8fafc' : '#ffffff');
        doc.setFillColor(bgColor);
        doc.rect(x, y, width, rowH, 'F');

        const indent = item.isSub ? 6 : 0;
        const centerX = x + 5 + indent;
        const centerY = y + rowH / 2;
        const checked = item.value;

        if (checked) {
            if (item.isSub) {
                doc.setDrawColor(22, 163, 74);
                doc.setLineWidth(0.5);
                doc.line(centerX - 1.2, centerY, centerX - 0.3, centerY + 0.9);
                doc.line(centerX - 0.3, centerY + 0.9, centerX + 1.2, centerY - 1.0);
            } else {
                doc.setFillColor(isConclusion ? '#3b82f6' : '#16a34a');
                doc.circle(centerX, centerY, 2.7, 'F');
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.4);
                doc.line(centerX - 1.1, centerY, centerX - 0.2, centerY + 0.8);
                doc.line(centerX - 0.2, centerY + 0.8, centerX + 1.1, centerY - 0.9);
            }
        }
 else {
            doc.setFillColor(239, 68, 68);
            doc.circle(centerX, centerY, 2.7, 'F');
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.4);
            doc.line(centerX - 0.9, centerY - 0.9, centerX + 0.9, centerY + 0.9);
            doc.line(centerX + 0.9, centerY - 0.9, centerX - 0.9, centerY + 0.9);
        }

        doc.setFontSize(item.isSub ? 7.5 : 8.5);
        doc.setFont('helvetica', isConclusion ? 'bold' : 'normal');
        doc.setTextColor(item.isSub ? GRAY : DARK);
        doc.text(item.label, x + 10 + indent, y + rowH / 2 + 1.2);
    };

    col1Items.forEach((item, i) => drawChecklistItem(item, marginL, curY + i * rowH, colW));
    col2Items.forEach((item, i) => drawChecklistItem(item, marginL + colW + 6, curY + i * rowH, colW));

    curY += itemsPerCol * rowH + 4;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginL, curY, marginL + contentW, curY);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(GRAY);
    doc.text('KESIMPULAN / KONDISI AKHIR', marginL + contentW / 2, curY + 4, { align: 'center' });

    curY += 6;

    conclusionItems.forEach((item, i) => {
        const x = i === 0 ? marginL : marginL + colW + 6;
        drawChecklistItem(item, x, curY, colW, true);
    });

    curY += rowH + 10;

    curY += 4;
    curY += 2;

    if (data.photos && data.photos.length > 0) {
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
        const photoH = photoW * 0.75;
        const descriptionH = 8;

        for (let i = 0; i < data.photos.length; i++) {
            const col = i % photosPerRow;
            const x = marginL + col * (photoW + photoGap);

            if (curY + photoH + descriptionH > pageH - 20) {
                doc.addPage();
                drawPageHeader();
                curY = HEADER_H;
            }

            const y = curY;

            try {
                const photo = data.photos[i];
                const imgData = photo.base64;
                const imgType = 'JPEG';
                doc.addImage(imgData, imgType, x, y, photoW, photoH, `photo_${i}`, 'FAST');

                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.2);
                doc.rect(x, y, photoW, photoH);

                if (photo.description) {
                    doc.setFontSize(7.5);
                    doc.setFont('helvetica', 'italic');
                    doc.setTextColor(DARK);
                    const descLines = doc.splitTextToSize(photo.description, photoW);
                    doc.text(descLines, x, y + photoH + 3.5);
                }
            } catch (_) {
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

    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);

        doc.setFillColor(22, 163, 74);
        doc.rect(0, pageH - 2, pageW, 2, 'F');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(GRAY);
        const footerCompany = data.reportType === 'utt' ? 'PT United Transworld Trading' : 'PT Dwimitra Ekatama Mandiri';
        doc.text(`${footerCompany} — HSE Inspection Report`, marginL, pageH - 5);
        doc.text(`Halaman ${pg} / ${totalPages}`, pageW - marginR, pageH - 5, { align: 'right' });
    }

    return doc;
}

export async function generateHSEPdfBlob(data: HSEFormData): Promise<Blob> {
    const dmeImg = logoDme;
    const secondaryImg = data.reportType === 'utt' ? logoUtt : logoNeutradc;

    let logoDmeB64 = '';
    let logoSecondaryB64 = '';
    try {
        logoDmeB64 = await loadImageAsBase64(dmeImg);
        logoSecondaryB64 = await loadImageAsBase64(secondaryImg);
    } catch (_) { }

    // Compress photos...
    const processedData = { ...data, photos: [] as HSEPhoto[] };
    if (data.photos && data.photos.length > 0) {
        for (const photo of data.photos) {
            try {
                const imgData = await compressBase64Image(photo.base64, { maxWidth: 800, quality: 0.5 });
                processedData.photos.push({ ...photo, base64: imgData });
            } catch (e) {
                processedData.photos.push(photo);
            }
        }
    }

    const doc = createHSEDpdDoc(processedData, logoDmeB64, logoSecondaryB64);
    return doc.output('blob');
}

export async function generateHSEPdf(data: HSEFormData) {
    const dmeImg = logoDme;
    const secondaryImg = data.reportType === 'utt' ? logoUtt : logoNeutradc;

    let logoDmeB64 = '';
    let logoSecondaryB64 = '';
    try {
        logoDmeB64 = await loadImageAsBase64(dmeImg);
        logoSecondaryB64 = await loadImageAsBase64(secondaryImg);
    } catch (_) { }

    // Compress photos...
    const processedData = { ...data, photos: [] as HSEPhoto[] };
    if (data.photos && data.photos.length > 0) {
        for (const photo of data.photos) {
            try {
                const imgData = await compressBase64Image(photo.base64, { maxWidth: 800, quality: 0.5 });
                processedData.photos.push({ ...photo, base64: imgData });
            } catch (e) {
                processedData.photos.push(photo);
            }
        }
    }

    const doc = createHSEDpdDoc(processedData, logoDmeB64, logoSecondaryB64);
    const safeAktivitas = (data.aktivitas || 'Inspection').replace(/[/\\?%*:|"<>]/g, '-');
    const dateStr = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
    const fileName = `HSE_Report_${safeAktivitas}_${dateStr}.pdf`;

    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

