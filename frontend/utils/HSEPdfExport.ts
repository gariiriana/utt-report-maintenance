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
    sarungTanganCutResistance?: boolean;
    pitaBaricade?: boolean;
    safetyCone?: boolean;
    stikBariket?: boolean;
    underMaintenance?: boolean;
    fullBodyHarness?: boolean;
    dokumen?: boolean;
    msds?: boolean;
    pelindungMata?: boolean;
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

    const PRIMARY_BLUE = '#00599c';
    const DARK = '#1e293b';
    const GRAY = '#64748b';
    const LIGHT_GRAY = '#f8fafc';

    const HEADER_H = 34;
    let headerDrawCount = 0;
    const drawPageHeader = () => {
        headerDrawCount++;
        const pg = headerDrawCount;
        doc.setFillColor(PRIMARY_BLUE);
        doc.rect(0, 0, pageW, 2.5, 'F');
        doc.setFillColor(252, 252, 252);
        doc.rect(0, 2.5, pageW, HEADER_H - 2.5, 'F');

        const leftW = 26;
        const leftH = 16;
        const headerTopY = 8;

        if (logoDmeB64) {
            doc.addImage(logoDmeB64, 'JPEG', marginL, headerTopY, leftW, leftH, `logo_left_${pg}`, 'FAST');
        }

        const rightW = 30;
        const rightH = 11;
        if (logoNeutradcB64) {
            const rightY = headerTopY + (leftH - rightH) / 2;
            doc.addImage(logoNeutradcB64, 'JPEG', pageW - marginR - rightW, rightY, rightW, rightH, `logo_right_${pg}`, 'FAST');
        }

        const titleY = headerTopY + 3;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(DARK);
        doc.text('HSE INSPECTION REPORT', pageW / 2, titleY, { align: 'center' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(GRAY);
        doc.text('Safety, Health & Equipment Documentation System', pageW / 2, titleY + 5.5, { align: 'center' });

        const dateObj = data.date ? new Date(data.date) : new Date();
        const dateStr = isNaN(dateObj.getTime())
            ? (data.date || '-')
            : dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        doc.setFontSize(9);
        doc.setTextColor(PRIMARY_BLUE);
        doc.setFont('helvetica', 'bold');
        doc.text(`Tanggal: ${dateStr}`, pageW / 2, titleY + 10.5, { align: 'center' });
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(marginL, 30, pageW - marginR, 30);
    };

    drawPageHeader();
    let curY = HEADER_H;
    doc.setFillColor(LIGHT_GRAY);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginL, curY, contentW, 54, 2, 2, 'FD');

    const infoRows = [
        { label: 'Inspector K3', value: data.inspectorK3 || '-' },
        { label: 'Aktivitas', value: data.aktivitas || '-' },
        { label: 'Lokasi', value: data.lokasi || '-' },
        { label: 'Personil', value: data.personil || '-' },
        { label: 'PIC', value: data.pic || '-' },
        { label: 'Anggota', value: data.anggota || '-' },
    ];

    infoRows.forEach((row, i) => {
        const rowY = curY + 7 + i * 8;
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(GRAY);
        doc.text(row.label, marginL + 5, rowY);

        doc.setTextColor(DARK);
        const lines = doc.splitTextToSize(row.value, contentW - 40);
        doc.text(`:  ${lines[0]}`, marginL + 32, rowY);
    });

    curY += 51;
    doc.setFillColor(PRIMARY_BLUE);
    doc.rect(marginL, curY, contentW, 8.5, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#ffffff');
    doc.text('I. CHECKLIST KESELAMATAN KERJA (REQUIRED)', marginL + 4, curY + 5.5);

    curY += 12;

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
                { key: 'sarungTanganCutResistance', label: 'Sarung Tangan Cut Resistance' },
                { key: 'pelindungMata', label: 'Pelindung Mata' },
            ]
        },
        {
            key: 'dokumen',
            label: 'Dokumen',
            subItems: [
                { key: 'msds', label: 'MSDS' },
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
                { key: 'underMaintenance', label: 'Under Maintenance' },
            ]
        },
    ];

    const regularItems: { label: string; value: boolean; isSub?: boolean }[] = [];
    checklistDefinition.forEach(item => {
        const val = !!(data.checklist as any)[item.key];

        if (item.key === 'dokumen' && !val) return;

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
        const bgColor = isConclusion ? '#f0f7ff' : (Math.floor(y / rowH) % 2 === 0 ? '#f8fafc' : '#ffffff');
        doc.setFillColor(bgColor);
        doc.rect(x, y, width, rowH, 'F');

        const indent = item.isSub ? 6 : 0;
        const centerX = x + 5 + indent;
        const centerY = y + rowH / 2;
        const checked = item.value;

        if (checked) {
            doc.setFillColor('#10b981');
            doc.circle(centerX, centerY, 2.7, 'F');
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.4);
            doc.line(centerX - 1.1, centerY, centerX - 0.2, centerY + 0.8);
            doc.line(centerX - 0.2, centerY + 0.8, centerX + 1.1, centerY - 0.9);
        } else {
            doc.setFillColor('#ef4444');
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

    curY += itemsPerCol * rowH + 6;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginL, curY, marginL + contentW, curY);

    curY += 4;
    conclusionItems.forEach((item, i) => {
        const x = i === 0 ? marginL : marginL + colW + 6;
        drawChecklistItem(item, x, curY, colW, true);
    });

    curY += rowH + 8;

    if (data.photos && data.photos.length > 0) {
        doc.setFillColor(PRIMARY_BLUE);
        doc.rect(marginL, curY, contentW, 8.5, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#ffffff');
        doc.text('II. FOTO DOKUMENTASI & EVIDENCE', marginL + 4, curY + 5.5);
        curY += 12;

        const photosPerRow = 2;
        const photoGap = 5;
        const photoW = (contentW - photoGap) / photosPerRow;
        const photoH = photoW * 0.75;
        const descriptionH = 10;

        for (let i = 0; i < data.photos.length; i++) {
            const col = i % photosPerRow;
            const x = marginL + col * (photoW + photoGap);

            if (curY + photoH + descriptionH > pageH - 22) {
                doc.addPage();
                drawPageHeader();
                curY = HEADER_H;
            }

            const y = curY;
            const photo = data.photos[i];
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(x, y, photoW, photoH + descriptionH, 1, 1, 'FD');

            try {
                doc.addImage(photo.base64, 'JPEG', x + 1, y + 1, photoW - 2, photoH - 2, `photo_${i}`, 'FAST');
            } catch (_) {
                doc.setFillColor(241, 245, 249);
                doc.rect(x + 1, y + 1, photoW - 2, photoH - 2, 'F');
                doc.setFontSize(7).setTextColor(GRAY).text('Foto Error', x + photoW / 2, y + photoH / 2, { align: 'center' });
            }

            if (photo.description) {
                doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(DARK);
                const descLines = doc.splitTextToSize(photo.description, photoW - 6);
                doc.text(descLines, x + photoW / 2, y + photoH + 5, { align: 'center' });
            }

            if (col === photosPerRow - 1 || i === data.photos.length - 1) {
                curY += photoH + descriptionH + photoGap;
            }
        }
    }

    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);

        doc.setFillColor(PRIMARY_BLUE).rect(0, pageH - 2.5, pageW, 2.5, 'F');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(GRAY);
        const footerCompany = data.reportType === 'utt' ? 'PT United Transworld Trading' : 'PT Dwimitra Ekatama Mandiri';
        doc.text(`${footerCompany} — HSE Report`, marginL, pageH - 6);
        doc.text(`Halaman ${pg} dari ${totalPages}`, pageW - marginR, pageH - 6, { align: 'right' });
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
    const dateObj = data.date ? new Date(data.date) : new Date();
    const dateStr = isNaN(dateObj.getTime()) 
        ? new Date().toISOString().split('T')[0] 
        : dateObj.toISOString().split('T')[0];
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
