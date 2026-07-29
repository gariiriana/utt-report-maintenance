import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { compressBase64Image } from '@/utils/imageCompression';
import logoDme from '@/assets/logo_dwimitra_v2.png';
import logoUtt from '@/assets/logo_utt.png';
import logoNeutradc from '@/assets/logo_neutradc.png';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const paragraphs = text.split('\n');
    const lines: string[] = [];

    paragraphs.forEach(paragraph => {
        const words = paragraph.split(' ');
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        } else if (paragraph === '') {
            lines.push('');
        }
    });

    return lines;
}

interface RenderTextResult {
    base64: string;
    heightMm: number;
}

function renderTextWithEmojisToImage(
    text: string,
    widthMm: number,
    fontSizePt: number,
    textColor: string = '#1e293b',
    fontStyle: string = 'normal'
): RenderTextResult {
    const pxPerMm = 96 / 25.4;
    const widthPx = widthMm * pxPerMm;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
        return { base64: '', heightMm: 0 };
    }

    const fontSizePx = fontSizePt * (96 / 72);
    const fontStr = `${fontStyle} ${fontSizePx}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`;
    tempCtx.font = fontStr;

    const lines = wrapText(tempCtx, text, widthPx);
    const lineHeightPx = fontSizePx * 1.35;
    const paddingPx = 1;
    const heightPx = lines.length * lineHeightPx + paddingPx * 2;
    const heightMm = heightPx / pxPerMm;

    const scale = 4;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(widthPx * scale);
    canvas.height = Math.ceil(heightPx * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return { base64: '', heightMm: heightMm };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(scale, scale);

    ctx.clearRect(0, 0, widthPx, heightPx);
    ctx.font = fontStr;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'top';

    lines.forEach((line, index) => {
        ctx.fillText(line, 0, paddingPx + index * lineHeightPx);
    });

    return {
        base64: canvas.toDataURL('image/png'),
        heightMm
    };
}

export interface HSEChecklist {
    mop: boolean;
    jsa: boolean;
    ptw: boolean;
    loto?: boolean;
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
    sarungTanganKaretHighVoltage?: boolean;
    sarungTanganKaretChemical?: boolean;
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
    label?: string;
}

export interface SIOData {
    operatorName: string;
    sioNumber: string;
    expiryDate: string;
    photos?: HSEPhoto[];
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
    hseType?: 'inspection' | 'sio' | 'silo';
    maintenanceType?: string;
    sioData?: SIOData;
    siloPdfUrl?: string;
    siloFile?: File | Blob | ArrayBuffer; 
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

function createHSEDpdDoc(data: HSEFormData, logoDmeB64: string, logoNeutradcB64: string, _userRole?: string): jsPDF {
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
    
    const getReportTitle = () => {
        switch (data.hseType) {
            case 'sio': return 'SURAT IZIN OPERATOR (SIO)';
            case 'silo': return 'SURAT IZIN LAYAK OPERASI (SILO)';
            default: return 'LAPORAN INSPEKSI HSE';
        }
    };

    const drawPageHeader = (titleOverride?: string) => {
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
        doc.text(titleOverride || getReportTitle(), pageW / 2, titleY, { align: 'center' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(GRAY);
        doc.text('Sistem Dokumentasi Keselamatan, Kesehatan Kerja & Alat', pageW / 2, titleY + 5.5, { align: 'center' });

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
    const infoH = data.hseType === 'inspection' ? 54 : 38;
    doc.roundedRect(marginL, curY, contentW, infoH, 2, 2, 'FD');

    const infoRows = data.hseType === 'inspection' ? [
        { label: 'Inspector K3', value: data.inspectorK3 || '-' },
        { label: 'Aktivitas', value: data.aktivitas || '-' },
        { label: 'Lokasi', value: data.lokasi || '-' },
        { label: 'Personil', value: data.personil || '-' },
        { label: 'PIC', value: data.pic || '-' },
        { label: 'Anggota', value: data.anggota || '-' },
    ] : [
        { label: 'Inspector HSE', value: data.inspectorK3 || '-' },
        { label: 'Jenis Maintenance', value: data.maintenanceType || '-' },
        { label: 'Nama Unit/Alat', value: data.aktivitas || '-' },
        { label: 'Lokasi', value: data.lokasi || '-' },
    ];

    infoRows.forEach((row, i) => {
        const rowY = curY + 7 + i * 8;
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(GRAY);
        doc.text(row.label, marginL + 5, rowY);

        doc.setTextColor(DARK);
        const lines = doc.splitTextToSize(row.value, contentW - 45);
        doc.text(`:  ${lines[0]}`, marginL + 36, rowY);
    });

    curY += infoH - 3;

    if (data.hseType === 'inspection') {
        curY += 6;
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
            { key: 'loto', label: 'LOTO' },
            { key: 'ppe', label: 'PPE Mandatory' },
            {
                key: 'ppeKhusus',
                label: 'PPE Khusus',
                subItems: [
                    { key: 'bodyHarness', label: 'Body Harness' },
                    { key: 'sarungTanganKaretHighVoltage', label: 'Sarung Tangan Karet High Voltage Resistance' },
                    { key: 'sarungTanganKaretChemical', label: 'Sarung Tangan Karet Chemical Resistance' },
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
                    if (subVal) regularItems.push({ label: sub.label, value: true, isSub: true });
                });
            }
        });

        const conclusionItems = [
            { label: 'Kondisi Aman (Safe Condition)', value: data.checklist.safeCondition },
            { label: 'Tindakan Aman (Safe Action)', value: data.checklist.safeAction },
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
    } else {
        curY += 12;
    }

    if (data.photos && data.photos.length > 0) {
        doc.setFillColor(PRIMARY_BLUE);
        doc.rect(marginL, curY, contentW, 8.5, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#ffffff');
        const sectionTitle = data.hseType === 'inspection' ? 'II. DOKUMENTASI FOTO & BUKTI' : 'DOKUMEN BUKTI';
        doc.text(sectionTitle, marginL + 4, curY + 5.5);
        curY += 12;

        const photosPerRow = 2;
        const photoGap = 5;
        const photoW = (contentW - photoGap) / photosPerRow;
        const photoH = photoW * 0.75;
        const DESC_FONT_SIZE = 7;
        const DESC_PAD_TOP = 2;
        const DESC_PAD_BOTTOM = 2;
        const MIN_DESC_H = 8; // minimum description area height

        // Pre-calculate description images and heights using Canvas for emoji support
        const descImages = data.photos.map((photo) => {
            const cleanDesc = (photo.description || '').trim();
            if (!cleanDesc) return null;
            const maxW = photoW - 6;
            return renderTextWithEmojisToImage(cleanDesc, maxW, DESC_FONT_SIZE, DARK);
        });

        const descHeights: number[] = data.photos.map((_, idx) => {
            const imgInfo = descImages[idx];
            if (!imgInfo) return MIN_DESC_H;
            const textH = imgInfo.heightMm + DESC_PAD_TOP + DESC_PAD_BOTTOM;
            return Math.max(MIN_DESC_H, textH);
        });

        for (let i = 0; i < data.photos.length; i += photosPerRow) {
            // Determine the max description height for this row so both cards align
            let rowDescH = MIN_DESC_H;
            for (let c = 0; c < photosPerRow && i + c < data.photos.length; c++) {
                rowDescH = Math.max(rowDescH, descHeights[i + c]);
            }

            const totalCardH = photoH + rowDescH;

            // Page break check — if row doesn't fit, start a new page
            if (curY + totalCardH > pageH - 22) {
                doc.addPage();
                drawPageHeader();
                curY = HEADER_H;
            }

            const y = curY;

            for (let c = 0; c < photosPerRow && i + c < data.photos.length; c++) {
                const idx = i + c;
                const photo = data.photos[idx];
                const x = marginL + c * (photoW + photoGap);

                // Draw card background
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(226, 232, 240);
                doc.roundedRect(x, y, photoW, totalCardH, 1, 1, 'FD');

                // Draw photo
                try {
                    doc.addImage(photo.base64, 'JPEG', x + 1, y + 1, photoW - 2, photoH - 2, `photo_${idx}`, 'FAST');
                } catch (_) {
                    doc.setFillColor(241, 245, 249);
                    doc.rect(x + 1, y + 1, photoW - 2, photoH - 2, 'F');
                    doc.setFontSize(7).setTextColor(GRAY).text('Gagal Memuat Foto', x + photoW / 2, y + photoH / 2, { align: 'center' });
                }

                // Draw label badge
                if (photo.label) {
                    doc.setFillColor(PRIMARY_BLUE);
                    doc.rect(x + 1, y + 1, 35, 5, 'F');
                    doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor('#ffffff');
                    doc.text(photo.label, x + 2.5, y + 4.2);
                }

                // Draw description text/image containing emojis
                const imgInfo = descImages[idx];
                if (imgInfo && imgInfo.base64) {
                    const imgW = photoW - 6;
                    const imgH = imgInfo.heightMm;
                    const imgX = x + 3;
                    const imgY = y + photoH + DESC_PAD_TOP;
                    doc.addImage(imgInfo.base64, 'PNG', imgX, imgY, imgW, imgH, `desc_img_${idx}`, 'FAST');
                }
            }

            curY += totalCardH + photoGap;
        }
    }

    if (data.sioData && (data.sioData.operatorName?.trim() || (data.sioData.photos && data.sioData.photos.length > 0))) {
        doc.addPage();
        drawPageHeader('DATA SURAT IZIN OPERATOR (SIO)');
        curY = HEADER_H + 5;

        doc.setFillColor(LIGHT_GRAY);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginL, curY, contentW, 30, 2, 2, 'FD');

        const sioRows = [
            { label: 'Nama Operator', value: data.sioData.operatorName || '-' },
            { label: 'No SIO / Lisensi', value: data.sioData.sioNumber || '-' },
            { label: 'Masa Berlaku', value: data.sioData.expiryDate || '-' },
        ];

        sioRows.forEach((row, i) => {
            const rowY = curY + 8 + i * 8;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(GRAY);
            doc.text(row.label, marginL + 5, rowY);
            doc.setTextColor(DARK);
            doc.text(`:  ${row.value}`, marginL + 40, rowY);
        });

        curY += 40;

        if (data.sioData.photos && data.sioData.photos.length > 0) {
            doc.setFillColor(PRIMARY_BLUE);
            doc.rect(marginL, curY, contentW, 8.5, 'F');
            doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor('#ffffff');
            doc.text('DOKUMEN PENDUKUNG SIO', marginL + 4, curY + 5.5);
            curY += 12;

            const photoW = (contentW - 5) / 2;
            const photoH = photoW * 0.65;

            data.sioData.photos.forEach((photo, i) => {
                const col = i % 2;
                const x = marginL + col * (photoW + 5);
                if (curY + photoH > pageH - 20) {
                    doc.addPage();
                    drawPageHeader('DATA SURAT IZIN OPERATOR (SIO)');
                    curY = HEADER_H + 5;
                }
                const y = curY;
                doc.setDrawColor(226, 232, 240);
                doc.roundedRect(x, y, photoW, photoH + 8, 1, 1, 'D');
                try {
                    doc.addImage(photo.base64, 'JPEG', x + 1, y + 1, photoW - 2, photoH - 2, `sio_photo_${i}`, 'FAST');
                } catch (_) {}
                doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(PRIMARY_BLUE);
                doc.text(photo.label || 'Lampiran', x + photoW / 2, y + photoH + 5, { align: 'center' });
                
                if (col === 1 || i === data.sioData!.photos!.length - 1) {
                    curY += photoH + 12;
                }
            });
        }
    }

    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);
        doc.setFillColor(PRIMARY_BLUE).rect(0, pageH - 2.5, pageW, 2.5, 'F');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(GRAY);
        const footerCompany = 'PT Dwimitra Ekatama Mandiri';
        doc.text(`${footerCompany} — HSE PORTAL`, marginL, pageH - 6);
        doc.text(`Halaman ${pg} dari ${totalPages}`, pageW - marginR, pageH - 6, { align: 'right' });
    }

    return doc;
}

export async function generateHSEPdf(data: HSEFormData, _autoOpen = false, userRole?: string) {
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
            const sizeInBytes = (photo.base64.length * 3) / 4;
            if (sizeInBytes > 500 * 1024) {
                try {
                    const imgData = await compressBase64Image(photo.base64, { maxWidth: 800, quality: 0.5 });
                    processedData.photos.push({ ...photo, base64: imgData });
                } catch (e) {
                    processedData.photos.push(photo);
                }
            } else {
                processedData.photos.push(photo);
            }
        }
    }

    if (processedData.sioData && processedData.sioData.photos) {
        const compressedSioPhotos = [];
        for (const photo of processedData.sioData.photos) {
            const sizeInBytes = (photo.base64.length * 3) / 4;
            if (sizeInBytes > 500 * 1024) {
                try {
                    const imgData = await compressBase64Image(photo.base64, { maxWidth: 800, quality: 0.5 });
                    compressedSioPhotos.push({ ...photo, base64: imgData });
                } catch (e) {
                    compressedSioPhotos.push(photo);
                }
            } else {
                compressedSioPhotos.push(photo);
            }
        }
        processedData.sioData.photos = compressedSioPhotos;
    }

    const jspdfDoc = createHSEDpdDoc(processedData, logoDmeB64, logoSecondaryB64, userRole);
    
    let finalPdfBytes: Uint8Array;
    
    try {
        const jspdfBlob = jspdfDoc.output('blob');
        const jspdfBuffer = await jspdfBlob.arrayBuffer();
        const mainPdfDoc = await PDFDocument.load(jspdfBuffer);

        let siloBuffer: ArrayBuffer | null = null;
        if (data.siloFile) {
            if (data.siloFile instanceof ArrayBuffer) {
                siloBuffer = data.siloFile;
            } else {
                siloBuffer = await (data.siloFile as Blob).arrayBuffer();
            }
        } else if (data.siloPdfUrl) {
            try {
                const resp = await fetch(data.siloPdfUrl);
                siloBuffer = await resp.arrayBuffer();
            } catch (e) {
                console.error("Failed to fetch SILO PDF from URL:", e);
            }
        }

        if (siloBuffer) {
            const siloPdfDoc = await PDFDocument.load(siloBuffer);
            const copiedPages = await mainPdfDoc.copyPages(siloPdfDoc, siloPdfDoc.getPageIndices());
            copiedPages.forEach((page) => mainPdfDoc.addPage(page));
        }

        // Set Metadata Title so browser tab shows the filename instead of blob ID
        const safeAktivitas = (data.aktivitas || 'Inspection').replace(/[/\\?%*:|"<>]/g, '-');
        const dateObj = data.date ? new Date(data.date) : new Date();
        const dateStr = isNaN(dateObj.getTime()) 
            ? new Date().toISOString().split('T')[0] 
            : dateObj.toISOString().split('T')[0];
        const fileNameMeta = `HSE_Integrated_${safeAktivitas}_${dateStr}.pdf`;
        
        mainPdfDoc.setTitle(fileNameMeta);

        finalPdfBytes = await mainPdfDoc.save();
    } catch (err) {
        console.error("PDF Merging failed, falling back to original:", err);
        const safeAktivitas = (data.aktivitas || 'Inspection').replace(/[/\\?%*:|"<>]/g, '-');
        const dateObj = data.date ? new Date(data.date) : new Date();
        const dateStr = isNaN(dateObj.getTime()) 
            ? new Date().toISOString().split('T')[0] 
            : dateObj.toISOString().split('T')[0];
        const fileNameMeta = `HSE_Integrated_${safeAktivitas}_${dateStr}.pdf`;
        jspdfDoc.setProperties({ title: fileNameMeta });
        finalPdfBytes = new Uint8Array(await jspdfDoc.output('arraybuffer'));
    }

    const safeAktivitas = (data.aktivitas || 'Inspection').replace(/[/\\?%*:|"<>]/g, '-');
    const dateObj = data.date ? new Date(data.date) : new Date();
    const dateStr = isNaN(dateObj.getTime()) 
        ? new Date().toISOString().split('T')[0] 
        : dateObj.toISOString().split('T')[0];
    const fileName = `HSE_Integrated_${safeAktivitas}_${dateStr}.pdf`;

    const finalBlob = new Blob([finalPdfBytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(finalBlob);

    // Always trigger download with the correct filename
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // NOTE: window.open(url) was removed because blob URLs generate UUID filenames
    // (e.g. 04cba595-9c22-4250-b32e-d62402832d7c.pdf) when shared from the new tab.
    // The download via link.download already provides the correct filename.

    // Delay revocation to ensure the browser has time to handle the download
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function generateHSEPdfBlob(data: HSEFormData, userRole?: string): Promise<Blob> {
    const secondaryImg = data.reportType === 'neutradc' ? logoNeutradc : logoUtt;
    let logoDmeB64 = '';
    let logoSecondaryB64 = '';
    try {
        logoDmeB64 = await loadImageAsBase64(logoDme);
        logoSecondaryB64 = await loadImageAsBase64(secondaryImg);
    } catch (_) { }

    const processedData = { ...data, photos: [] as HSEPhoto[] };
    if (data.photos && data.photos.length > 0) {
        for (const photo of data.photos) {
            const sizeInBytes = (photo.base64.length * 3) / 4;
            if (sizeInBytes > 500 * 1024) {
                try {
                    const imgData = await compressBase64Image(photo.base64, { maxWidth: 800, quality: 0.5 });
                    processedData.photos.push({ ...photo, base64: imgData });
                } catch (e) {
                    processedData.photos.push(photo);
                }
            } else {
                processedData.photos.push(photo);
            }
        }
    }

    const jspdfDoc = createHSEDpdDoc(processedData, logoDmeB64, logoSecondaryB64, userRole);

    let finalPdfBytes: Uint8Array;
    try {
        const jspdfBlob = jspdfDoc.output('blob');
        const jspdfBuffer = await jspdfBlob.arrayBuffer();
        const mainPdfDoc = await PDFDocument.load(jspdfBuffer);

        let siloBuffer: ArrayBuffer | null = null;
        if (data.siloFile) {
            siloBuffer = data.siloFile instanceof ArrayBuffer
                ? data.siloFile
                : await (data.siloFile as Blob).arrayBuffer();
        } else if (data.siloPdfUrl) {
            try {
                const resp = await fetch(data.siloPdfUrl);
                siloBuffer = await resp.arrayBuffer();
            } catch (e) {
                console.error("Failed to fetch SILO PDF from URL:", e);
            }
        }

        if (siloBuffer) {
            const siloPdfDoc = await PDFDocument.load(siloBuffer);
            const copiedPages = await mainPdfDoc.copyPages(siloPdfDoc, siloPdfDoc.getPageIndices());
            copiedPages.forEach((page) => mainPdfDoc.addPage(page));
        }

        const safeAktivitas = (data.aktivitas || 'Inspection').replace(/[/\\?%*:|"<>]/g, '-');
        const dateObj = data.date ? new Date(data.date) : new Date();
        const dateStr = isNaN(dateObj.getTime()) 
            ? new Date().toISOString().split('T')[0] 
            : dateObj.toISOString().split('T')[0];
        const fileNameMeta = `HSE_Integrated_${safeAktivitas}_${dateStr}.pdf`;
        mainPdfDoc.setTitle(fileNameMeta);

        finalPdfBytes = await mainPdfDoc.save();
    } catch (err) {
        console.error("PDF Merging failed, falling back to original:", err);
        const safeAktivitas = (data.aktivitas || 'Inspection').replace(/[/\\?%*:|"<>]/g, '-');
        const dateObj = data.date ? new Date(data.date) : new Date();
        const dateStr = isNaN(dateObj.getTime()) 
            ? new Date().toISOString().split('T')[0] 
            : dateObj.toISOString().split('T')[0];
        const fileNameMeta = `HSE_Integrated_${safeAktivitas}_${dateStr}.pdf`;
        jspdfDoc.setProperties({ title: fileNameMeta });
        finalPdfBytes = new Uint8Array(await jspdfDoc.output('arraybuffer'));
    }

    return new Blob([finalPdfBytes as any], { type: 'application/pdf' });
}

