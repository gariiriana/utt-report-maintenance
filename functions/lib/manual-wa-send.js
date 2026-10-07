"use strict";
// ============================================================================
// FILE: functions/src/manual-wa-send.ts
// Deskripsi: Firebase HTTPS Callable Functions (v2) untuk interaksi UI dashboard:
//            1. Mengirim Broadcast Pengingat H-60 secara manual langsung dari Cloud
//            2. Mengirim Pesan Test WhatsApp via Cloud (Fonnte API)
//            3. Pengambilan & Penyimpanan Konfigurasi WhatsApp Cloud di Firestore
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWAReminderConfigCloud = exports.triggerWAReminderH60Cloud = exports.sendTestWhatsAppCloud = void 0;
const https_1 = require("firebase-functions/v2/https");
const wa_service_1 = require("./wa-service");
/**
 * Validasi otentikasi user (khusus dwimitra@co.id atau admin)
 */
function assertAuthorizedUser(request) {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Permintaan harus diautentikasi.');
    }
    const email = request.auth.token.email?.toLowerCase() || '';
    if (email !== 'dwimitra@co.id' && !email.includes('admin')) {
        throw new https_1.HttpsError('permission-denied', 'Hanya akun administrator dwimitra@co.id yang memiliki izin.');
    }
    return email;
}
/**
 * Callable Function: Mengirim pesan test WhatsApp via Cloud (Fonnte)
 */
exports.sendTestWhatsAppCloud = (0, https_1.onCall)({ region: 'asia-southeast1', cors: true, timeoutSeconds: 60 }, async (request) => {
    const userEmail = assertAuthorizedUser(request);
    const config = await (0, wa_service_1.getWAReminderConfig)();
    const target = request.data?.targetPhone?.trim() || config.targetPhone?.trim();
    if (!target) {
        throw new https_1.HttpsError('invalid-argument', 'Nomor WhatsApp tujuan wajib diisi.');
    }
    const token = config.fonnte_token || process.env.FONNTE_TOKEN || '';
    if (!token) {
        throw new https_1.HttpsError('failed-precondition', 'Fonnte API Token belum diatur di pengaturan.');
    }
    const testMsg = request.data?.message?.trim() ||
        `🔔 *[TEST CLOUD WA GATEWAY]*\n\nIntegrasi WhatsApp Cloud (DwimitraSystem) berhasil terhubung!\n\n_Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB_\n_Pengirim: ${userEmail}_`;
    try {
        const res = await (0, wa_service_1.sendWhatsAppFonnte)({
            token,
            target,
            message: testMsg
        });
        await (0, wa_service_1.logWAReminderAudit)({
            status: 'SUCCESS',
            source: 'test',
            target,
            message: testMsg,
            detail: res
        });
        return {
            success: true,
            message: `Pesan test WhatsApp berhasil terkirim ke ${target}`,
            detail: res
        };
    }
    catch (err) {
        await (0, wa_service_1.logWAReminderAudit)({
            status: 'FAILED',
            source: 'test',
            target,
            error: err.message || 'Unknown error'
        });
        throw new https_1.HttpsError('internal', err.message || 'Gagal mengirim pesan test WhatsApp');
    }
});
/**
 * Callable Function: Memicu pengiriman reminder H-60 sekarang langsung dari Cloud
 */
exports.triggerWAReminderH60Cloud = (0, https_1.onCall)({ region: 'asia-southeast1', cors: true, timeoutSeconds: 60 }, async (request) => {
    const userEmail = assertAuthorizedUser(request);
    const config = await (0, wa_service_1.getWAReminderConfig)();
    if (!config.targetPhone) {
        throw new https_1.HttpsError('failed-precondition', 'Nomor WhatsApp tujuan belum diisi.');
    }
    const token = config.fonnte_token || process.env.FONNTE_TOKEN || '';
    if (!token) {
        throw new https_1.HttpsError('failed-precondition', 'Fonnte API Token belum dikonfigurasi.');
    }
    // Hitung target 2 bulan ke depan (H-60)
    const now = new Date();
    const wibStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const wibDate = new Date(wibStr);
    const currentMonthIndex = wibDate.getMonth();
    const targetMonthIndex = (currentMonthIndex + 2) % 12;
    const { message, pmCount, monthName } = (0, wa_service_1.buildH60Message)(targetMonthIndex);
    if (pmCount === 0 || !message) {
        return {
            success: true,
            skipped: true,
            message: `Tidak ada jadwal Preventive Maintenance di bulan ${monthName} 2026.`
        };
    }
    let finalTarget = config.targetPhone.trim();
    if (config.targetGroup && config.targetGroup.trim()) {
        finalTarget = `${finalTarget},${config.targetGroup.trim()}`;
    }
    try {
        const res = await (0, wa_service_1.sendWhatsAppFonnte)({
            token,
            target: finalTarget,
            message
        });
        const sentIsoDate = new Date().toISOString();
        await (0, wa_service_1.saveWAReminderConfig)({ lastSentDate: sentIsoDate }, userEmail);
        await (0, wa_service_1.logWAReminderAudit)({
            status: 'SUCCESS',
            source: 'manual',
            target: finalTarget,
            monthTarget: monthName,
            pmCount,
            message,
            detail: res
        });
        return {
            success: true,
            pmCount,
            targetMonth: monthName,
            recipient: finalTarget,
            message: `Reminder H-60 (${pmCount} agenda PM di bulan ${monthName}) berhasil dikirim ke ${finalTarget}`
        };
    }
    catch (err) {
        await (0, wa_service_1.logWAReminderAudit)({
            status: 'FAILED',
            source: 'manual',
            target: finalTarget,
            monthTarget: monthName,
            pmCount,
            error: err.message || 'Unknown error'
        });
        throw new https_1.HttpsError('internal', err.message || 'Gagal mengeksekusi reminder H-60 via Cloud');
    }
});
/**
 * Callable Function: Menyimpan pengaturan WhatsApp Reminder ke Firestore
 */
exports.updateWAReminderConfigCloud = (0, https_1.onCall)({ region: 'asia-southeast1', cors: true, timeoutSeconds: 30 }, async (request) => {
    const userEmail = assertAuthorizedUser(request);
    const data = request.data || {};
    await (0, wa_service_1.saveWAReminderConfig)({
        targetPhone: data.targetPhone,
        targetGroup: data.targetGroup,
        autoRemindEnabled: data.autoRemindEnabled,
        fonnte_token: data.fonnte_token
    }, userEmail);
    const updated = await (0, wa_service_1.getWAReminderConfig)();
    return {
        success: true,
        message: 'Pengaturan WhatsApp Reminder berhasil diperbarui di Cloud Firestore.',
        config: {
            ...updated,
            fonnte_token_masked: updated.fonnte_token ? `••••••••${updated.fonnte_token.slice(-4)}` : ''
        }
    };
});
//# sourceMappingURL=manual-wa-send.js.map