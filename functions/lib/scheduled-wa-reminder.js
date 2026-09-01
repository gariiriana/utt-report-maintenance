"use strict";
// ============================================================================
// FILE: functions/src/scheduled-wa-reminder.ts
// Deskripsi: Scheduled Cloud Function (v2) yang berjalan secara otomatis setiap
//            hari Senin pukul 08:00 WIB (Asia/Jakarta) untuk mengirimkan reminder
//            H-60 jadwal Preventive Maintenance ke nomor WhatsApp target tanpa
//            bergantung pada laptop atau server lokal.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledWAReminderH60 = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const wa_service_1 = require("./wa-service");
/**
 * Scheduled Cloud Function yang dieksekusi setiap hari Senin jam 08:00 WIB.
 */
exports.scheduledWAReminderH60 = (0, scheduler_1.onSchedule)({
    schedule: '0 8 * * 1', // Setiap hari Senin pukul 08:00 WIB
    timeZone: 'Asia/Jakarta',
    region: 'asia-southeast1',
    timeoutSeconds: 120,
    memory: '256MiB'
}, async () => {
    console.log('[Scheduled WA Reminder] Memulai eksekusi jadwal otomatis Senin 08:00 WIB...');
    const config = await (0, wa_service_1.getWAReminderConfig)();
    if (!config.autoRemindEnabled) {
        console.log('[Scheduled WA Reminder] Auto-reminder dimatikan pada konfigurasi. Dilewati.');
        await (0, wa_service_1.logWAReminderAudit)({
            status: 'SKIPPED',
            source: 'cron',
            target: config.targetPhone || '-',
            message: 'Auto-reminder dimatikan di konfigurasi Firestore.'
        });
        return;
    }
    if (!config.targetPhone) {
        console.warn('[Scheduled WA Reminder] Nomor WhatsApp tujuan belum dikonfigurasi. Dilewati.');
        await (0, wa_service_1.logWAReminderAudit)({
            status: 'SKIPPED',
            source: 'cron',
            target: '-',
            message: 'Nomor WhatsApp tujuan kosong.'
        });
        return;
    }
    if (!config.fonnte_token) {
        console.error('[Scheduled WA Reminder] Fonnte API Token belum diatur.');
        await (0, wa_service_1.logWAReminderAudit)({
            status: 'FAILED',
            source: 'cron',
            target: config.targetPhone,
            error: 'Fonnte API Token belum dikonfigurasi di system_status/wa_reminder_config.'
        });
        return;
    }
    // Hitung bulan target H-60 (2 bulan ke depan)
    const now = new Date();
    // Konversi ke WIB date untuk kalkulasi bulan yang presisi
    const wibStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    const wibDate = new Date(wibStr);
    const currentMonthIndex = wibDate.getMonth(); // 0-11
    const targetMonthIndex = (currentMonthIndex + 2) % 12;
    const { message, pmCount, monthName } = (0, wa_service_1.buildH60Message)(targetMonthIndex);
    if (pmCount === 0 || !message) {
        console.log(`[Scheduled WA Reminder] Tidak ada agenda PM untuk bulan ${monthName}.`);
        await (0, wa_service_1.logWAReminderAudit)({
            status: 'SKIPPED',
            source: 'cron',
            target: config.targetPhone,
            monthTarget: monthName,
            pmCount: 0,
            message: `Tidak ada agenda PM pada bulan ${monthName} 2026.`
        });
        return;
    }
    // Gabungkan nomor target PIC dan Group jika ada
    let finalTarget = config.targetPhone.trim();
    if (config.targetGroup && config.targetGroup.trim()) {
        finalTarget = `${finalTarget},${config.targetGroup.trim()}`;
    }
    try {
        const fonnteRes = await (0, wa_service_1.sendWhatsAppFonnte)({
            token: config.fonnte_token,
            target: finalTarget,
            message: message
        });
        const sentIsoDate = new Date().toISOString();
        await (0, wa_service_1.saveWAReminderConfig)({ lastSentDate: sentIsoDate }, 'system_scheduler');
        await (0, wa_service_1.logWAReminderAudit)({
            status: 'SUCCESS',
            source: 'cron',
            target: finalTarget,
            monthTarget: monthName,
            pmCount: pmCount,
            message: message,
            detail: fonnteRes
        });
        console.log(`[Scheduled WA Reminder] Berhasil mengirim reminder H-60 (${pmCount} PM di ${monthName}) ke ${finalTarget}`);
    }
    catch (err) {
        console.error('[Scheduled WA Reminder] Gagal mengirim pesan:', err);
        await (0, wa_service_1.logWAReminderAudit)({
            status: 'FAILED',
            source: 'cron',
            target: finalTarget,
            monthTarget: monthName,
            pmCount: pmCount,
            error: err.message || 'Unknown error'
        });
    }
});
//# sourceMappingURL=scheduled-wa-reminder.js.map