"use strict";
// ============================================================================
// FILE: functions/src/wa-service.ts
// Deskripsi: Layanan Pengiriman WhatsApp Cloud Gateway menggunakan Fonnte API & Firestore.
//            Mengelola format pesan pengingat H-60 Preventive Maintenance (PM) 2026,
//            integrasi REST API Fonnte, dan pencatatan audit log ke Firestore.
// ============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PM_SCHEDULE_DATA = exports.MONTH_NAMES = void 0;
exports.getWAReminderConfig = getWAReminderConfig;
exports.saveWAReminderConfig = saveWAReminderConfig;
exports.logWAReminderAudit = logWAReminderAudit;
exports.buildH60Message = buildH60Message;
exports.sendWhatsAppFonnte = sendWhatsAppFonnte;
const admin = __importStar(require("firebase-admin"));
exports.MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
exports.PM_SCHEDULE_DATA = [
    { device: 'UPS', location: 'Elecroom and Power Room', months: [null, null, '02 - 06', null, null, '02 - 08', null, null, '01 - 07', null, null, '07 - 11'], category: 'electrical' },
    { device: 'CRAC Data Hall & Supporting Room', location: 'CRAC Room 3 & 4', months: [null, null, '25 - 31', null, null, '22 - 26', null, null, '21 - 25', null, null, '07 - 11'], category: 'hvac' },
    { device: 'Chiller', location: '1F Power House', months: [null, '18 - 24', null, null, '18 - 22', null, null, '18 - 24', null, null, '16 - 20', null], category: 'hvac' },
    { device: 'Cooling Tower', location: '4F Power House', months: [null, '18 - 24', null, null, '18 - 22', null, null, '18 - 24', null, null, '16 - 20', null], category: 'hvac' },
    { device: 'Cooling Pump', location: '1F Power House', months: [null, null, '09 - 13', null, null, '08 - 12', null, null, '07 - 11', null, null, '07 - 11'], category: 'mechanical' },
    { device: 'ATS', location: 'Power Room and Elec Room', months: [null, null, '02 - 06', null, null, '02 - 08', null, null, '01 - 07', null, null, '07 - 11'], category: 'electrical' },
    { device: 'Transformer', location: 'Power Room and Trafo Room', months: [null, '23 - 27', null, null, '22 - 29', null, null, '24 - 31', null, null, '16 - 20', null], category: 'electrical' },
    { device: 'Generator & Fuel System', location: '2F Power House', months: [null, '16 - 23', null, null, '18 - 22', null, null, '18 - 31', null, null, '16 - 20', null], category: 'electrical' },
    { device: 'MV and RMU Panel', location: 'MV Room', months: [null, null, '23 - 27', null, null, '15 - 22', null, null, '14 - 18', null, null, '14 - 18'], category: 'electrical' },
    { device: 'LV Panel', location: 'Power Room', months: [null, '23 - 27', null, null, '04 - 08', null, null, '03 - 07', null, null, '02 - 06', null], category: 'electrical' },
    { device: 'PDU Panel', location: 'CRAC Room 1-4', months: [null, '13 - 20', null, null, '18 - 22', null, null, '18 - 24', null, null, '16 - 20', null], category: 'electrical' },
    { device: 'FSS', location: 'ALL Area Campus', months: [null, '16 - 27', null, null, '18 - 29', null, null, '17 - 28', null, null, '16 - 30', null], category: 'safety' },
    { device: 'Hydrant System', location: 'ALL Area Campus', months: ['19 - 23', null, null, '20 - 24', null, null, '20 - 24', null, null, '19 - 23', null, null], category: 'safety' },
    { device: 'Pre-Action System', location: 'ALL Area Campus', months: [null, '02 - 06', null, null, '04 - 08', null, null, '03 - 07', null, null, '02 - 06', null], category: 'safety' },
    { device: 'Lighting Point', location: 'ALL Area Campus', months: [null, null, '16 - 27', null, null, '15 - 26', null, null, '14 - 25', null, null, '07 - 18'], category: 'electrical' },
    { device: 'Grounding System', location: 'ALL Area Campus', months: [null, null, '16 - 27', null, null, '15 - 26', null, null, '14 - 25', null, null, '07 - 18'], category: 'electrical' },
    { device: 'Lightning Protection System', location: 'ALL Area Campus', months: [null, '09 - 13', null, null, '11 - 18', null, null, '10 - 14', null, null, '09 - 13', null], category: 'electrical' },
    { device: 'Water Leak', location: 'ALL Area Campus', months: ['05 - 08', null, null, '06 - 10', null, null, '06 - 10', null, null, '05 - 09', null, null], category: 'safety' },
    { device: 'Fuel Leak', location: 'Ground Tank', months: ['12 - 19', null, null, '13 - 17', null, null, '13 - 17', null, null, '12 - 16', null, null], category: 'safety' },
    { device: 'FCU', location: 'ALL Area Campus', months: ['05 - 14', null, null, '06 - 15', null, null, '06 - 15', null, null, '05 - 14', null, null], category: 'hvac' },
    { device: 'AHU', location: 'ALL Area Campus', months: ['27 - 30', null, null, '27 - 30', null, null, '27 - 30', null, null, '26 - 29', null, null], category: 'hvac' },
    { device: 'VRV', location: 'Office', months: [null, '16 - 27', null, null, '18 - 29', null, null, '18 - 31', null, null, '09 - 20', null], category: 'hvac' },
    { device: 'AC Splits', location: 'Office and Campus', months: [null, '24 - 27', null, null, '25 - 29', null, null, '24 - 28', null, null, '23 - 27', null], category: 'hvac' },
    { device: 'Cooling Tower Water Treatment', location: '4F Power House', months: ['05 - 09', '02 - 06', '02 - 06', '06 - 10', '04 - 08', '02 - 05', '06 - 10', '03 - 07', '01 - 04', '05 - 09', '02 - 06', '07 - 11'], category: 'hvac' },
    { device: 'Lift Units', location: 'Office and Campus', months: ['08 - 15', '09 - 13', '09 - 13', '13 - 17', '11 - 19', '08 - 15', '06 - 10', '10 - 14', '07 - 11', '05 - 09', '09 - 13', '07 - 11'], category: 'mechanical' },
    { device: 'Panel LDB & RDB (Distribution)', location: 'All Area', months: [null, null, '04 - 13', null, null, '16 - 26', null, null, '16 - 25', null, null, '09 - 18'], category: 'electrical' },
    { device: 'PJU', location: 'Outdoor Area', months: ['19 - 30', null, null, null, '18 - 29', null, null, '18 - 31', null, null, '16 - 27', null], category: 'electrical' },
    { device: 'Gate', location: 'Outdoor Area', months: ['26 - 30', null, null, '24 - 30', null, null, '27 - 31', null, null, '26 - 30', null, null], category: 'mechanical' },
    { device: 'Road Blocker', location: 'Outdoor Area', months: [null, null, null, null, '04 - 05', null, null, null, null, null, '05 - 06', null], category: 'mechanical' },
    { device: 'Dock Leveler', location: 'CAMPUS 1', months: ['12 - 15', null, null, '13 - 17', null, null, '13 - 17', null, null, '12 - 16', null, null], category: 'mechanical' },
    { device: 'X-Ray', location: 'Post Bravo', months: [null, '12 - 13', null, '13 - 14', null, '11 - 12', null, '10 - 11', null, '12 - 13', null, '14 - 15'], category: 'safety' },
    { device: 'Pressurization & Degassing', location: '1F Power House', months: [null, null, '25 - 27', null, null, '24 - 26', null, null, '22 - 24', null, null, '16 - 18'], category: 'safety' },
    { device: 'Pumps', location: 'All Area', months: [null, null, '10 - 14', null, null, '09 - 13', null, null, '08 - 12', null, null, '01 - 05'], category: 'mechanical' },
    { device: 'STP & Plumbing', location: 'All Area', months: ['26 - 30', null, null, '23 - 30', null, null, '27 - 31', null, null, '26 - 30', null, null], category: 'civil' },
    { device: 'Door', location: 'All Area', months: ['12 - 15', null, null, '13 - 17', null, null, '13 - 17', null, null, '12 - 16', null, null], category: 'civil' },
    { device: 'Water Softener', location: 'Water Softener Room', months: [null, '23 - 25', null, null, '25 - 28', null, null, '26 - 28', null, null, '23 - 25', null], category: 'mechanical' },
    { device: 'Exhaust Fan', location: 'PH and Campus', months: ['26 - 30', null, null, '24 - 30', null, null, '27 - 31', null, null, '26 - 30', null, null], category: 'hvac' },
    { device: 'Busduct', location: 'PH and Campus', months: [null, null, '09 - 13', null, null, '08 - 12', null, null, '07 - 11', null, null, '07 - 11'], category: 'electrical' },
    { device: 'Capacitor Bank', location: 'Campus and PH Office', months: ['26 - 30', null, null, '27 - 30', null, null, '27 - 31', null, null, '26 - 30', null, null], category: 'electrical' },
    { device: 'Physical Cooling Automation', location: 'All Area', months: [null, null, '16 - 31', null, null, '15 - 30', null, null, '17 - 30', null, null, '07 - 18'], category: 'hvac' },
];
/**
 * Mendapatkan konfigurasi WA Reminder dari Firestore doc: system_status/wa_reminder_config
 */
async function getWAReminderConfig() {
    const db = admin.firestore();
    const docRef = db.collection('system_status').doc('wa_reminder_config');
    const snap = await docRef.get();
    if (!snap.exists) {
        return {
            targetPhone: '',
            targetGroup: '',
            autoRemindEnabled: true,
            fonnte_token: process.env.FONNTE_TOKEN || '',
            lastSentDate: ''
        };
    }
    const data = snap.data();
    return {
        ...data,
        fonnte_token: data.fonnte_token || process.env.FONNTE_TOKEN || ''
    };
}
/**
 * Simpan atau perbarui konfigurasi WA Reminder di Firestore
 */
async function saveWAReminderConfig(config, updatedBy) {
    const db = admin.firestore();
    const docRef = db.collection('system_status').doc('wa_reminder_config');
    await docRef.set({
        ...config,
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy || 'system'
    }, { merge: true });
}
/**
 * Mencatat audit log pengiriman notifikasi ke Firestore
 */
async function logWAReminderAudit(log) {
    try {
        const db = admin.firestore();
        const logRef = db.collection('system_status').doc('wa_reminder_config').collection('logs').doc();
        await logRef.set({
            id: logRef.id,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            isoDate: new Date().toISOString(),
            ...log
        });
    }
    catch (err) {
        console.error('[WA Service] Gagal mencatat log audit ke Firestore:', err);
    }
}
/**
 * Membentuk teks pesan pengingat H-60 berdasarkan bulan target PM
 */
function buildH60Message(targetMonthIndex) {
    const targetMonthName = exports.MONTH_NAMES[targetMonthIndex];
    const upcomingPMs = exports.PM_SCHEDULE_DATA.filter(item => item.months[targetMonthIndex] !== null);
    if (upcomingPMs.length === 0) {
        return { message: '', pmCount: 0, monthName: targetMonthName };
    }
    let alertMessage = `🔔 *[AUTO REMINDER SENIN — H-60] PERSIAPAN PREVENTIVE MAINTENANCE (PM)*\n\n`;
    alertMessage += `Halo Tim Standby Engineer & Operation PT Dwimitra / UTT,\n\n`;
    alertMessage += `Berikut adalah agenda Preventive Maintenance yang akan dilaksanakan *2 BULAN LAGI* (${targetMonthName} 2026):\n\n`;
    upcomingPMs.forEach((pm, idx) => {
        const dates = pm.months[targetMonthIndex];
        alertMessage += `📌 *${idx + 1}. ${pm.device}*\n`;
        alertMessage += `   📍 Lokasi: ${pm.location}\n`;
        alertMessage += `   📅 Estimasi Tanggal: ${dates} ${targetMonthName} 2026\n`;
        alertMessage += `   ⚠️ Dokumen Wajib: MOP, D-DAY, & Risk Register (JSA)\n\n`;
    });
    alertMessage += `Mohon segera periksa & lengkapi dokumen kesiapan maintenance pada portal:\n`;
    alertMessage += `🌐 https://dwimitrasystem.com/\n\n`;
    alertMessage += `_Notifikasi otomatis dijadwalkan setiap hari Senin 08:00 WIB via DwimitraSystem Cloud Gateway_`;
    return {
        message: alertMessage,
        pmCount: upcomingPMs.length,
        monthName: targetMonthName
    };
}
/**
 * Mengirim pesan WhatsApp via REST API Fonnte.com
 */
async function sendWhatsAppFonnte(params) {
    const { token, target, message } = params;
    if (!token) {
        throw new Error('Fonnte API Token belum dikonfigurasi. Silakan simpan token di modal WA Gateway.');
    }
    if (!target) {
        throw new Error('Nomor WhatsApp tujuan wajib diisi.');
    }
    // Format nomor (pisahkan koma jika ada nomor ganda / group)
    const cleanTarget = target
        .split(',')
        .map(t => t.trim().replace(/[^0-9@.-]/g, ''))
        .filter(Boolean)
        .join(',');
    const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            target: cleanTarget,
            message: message,
            countryCode: '62'
        })
    });
    const resJson = await response.json();
    if (!response.ok || resJson.status === false) {
        const errMsg = resJson.reason || resJson.message || `Fonnte HTTP ${response.status}`;
        throw new Error(`Gagal mengirim WhatsApp via Fonnte: ${errMsg}`);
    }
    return resJson;
}
//# sourceMappingURL=wa-service.js.map