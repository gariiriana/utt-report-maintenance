// ============================================================================
// FILE: backend/wagateway.js
// Deskripsi: WhatsApp Gateway Service menggunakan Baileys library (Node.js/Express).
//            Layanan ini mengontrol sesi WhatsApp otomatis untuk pengiriman pengingat
//            jadwal PM (Preventive Maintenance), pesan broadcast, notifikasi darurat,
//            dan scanner QR Code pairing WhatsApp Web.
// Port: 5001
//
// Features:
//   - Cron job every Monday 08:00 WIB (Asia/Jakarta)
//   - Retry mechanism: 3 attempts with 5-min interval if WA disconnected
//   - Startup catch-up: if service starts on Monday after 08:00, auto-send if not yet sent today
//   - File-based audit logging (wa_reminder.log)
//   - Health check endpoint
// ============================================================================

import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5001;
const AUTH_DIR = path.join(__dirname, 'wa_session');
const CONFIG_FILE = path.join(__dirname, 'wa_config.json');
const LOG_FILE = path.join(__dirname, 'wa_reminder.log');

// ── Audit Logger ──────────────────────────────────────────────────────────────
function logAudit(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  };
  const line = JSON.stringify(entry) + '\n';
  console.log(`[WA-Gateway][${level}] ${message}`, data.error ? `| Error: ${data.error}` : '');
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
  } catch (err) {
    console.error('[WA-Gateway] Failed to write audit log:', err);
  }
}

// ── State ─────────────────────────────────────────────────────────────────────
let waSock = null;
let connectionStatus = 'DISCONNECTED'; // DISCONNECTED | QR_READY | CONNECTING | CONNECTED
let currentQrCodeUrl = '';
let connectedUserNumber = '';
const SERVICE_START_TIME = new Date();

// ── Config ────────────────────────────────────────────────────────────────────
let waConfig = {
  targetPhone: '',
  targetGroup: '',
  autoRemindEnabled: true,
  reminderSchedule: 'weekly_monday', // 'weekly_monday' = every Monday 08:00 WIB
  lastCheckDate: ''
};

// ── PM Schedule 2026 Data (mirrored from frontend PMSchedule.tsx) ──
const PM_SCHEDULE_DATA = [
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

// ── Load Config ───────────────────────────────────────────────────────────────
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const loaded = JSON.parse(raw);
    // Normalize legacy field names
    if (loaded.checkIntervalHours !== undefined) {
      delete loaded.checkIntervalHours;
    }
    waConfig = { ...waConfig, ...loaded };
  } catch (err) {
    logAudit('ERROR', 'Failed to read config file', { error: err.message });
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(waConfig, null, 2), 'utf-8');
  } catch (err) {
    logAudit('ERROR', 'Failed to save config file', { error: err.message });
  }
}

// ── WhatsApp Connection ───────────────────────────────────────────────────────
async function connectToWhatsApp() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  connectionStatus = 'CONNECTING';
  logAudit('INFO', 'Connecting to WhatsApp...', { version: version.join('.') });

  waSock = makeWASocket({
    version,
    auth: state,
    // NOTE: printQRInTerminal removed — deprecated in Baileys v7.
    // QR is handled via connection.update event below.
    browser: ['DwimitraSystem', 'Chrome', '1.0.0']
  });

  waSock.ev.on('creds.update', saveCreds);

  waSock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      connectionStatus = 'QR_READY';
      try {
        currentQrCodeUrl = await QRCode.toDataURL(qr);
        logAudit('INFO', 'QR Code generated — awaiting scan from Admin Panel');
      } catch (err) {
        logAudit('ERROR', 'Error converting QR to DataURL', { error: err.message });
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logAudit('WARN', 'Connection closed', {
        statusCode,
        reason: lastDisconnect?.error?.message || 'unknown',
        reconnecting: shouldReconnect
      });

      connectionStatus = 'DISCONNECTED';
      currentQrCodeUrl = '';
      connectedUserNumber = '';

      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 5000);
      } else {
        logAudit('WARN', 'Session logged out — clean session directory to rescan');
        if (fs.existsSync(AUTH_DIR)) {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
      }
    } else if (connection === 'open') {
      connectionStatus = 'CONNECTED';
      currentQrCodeUrl = '';
      connectedUserNumber = waSock.user?.id?.split(':')[0] || 'Terhubung';
      logAudit('INFO', `WhatsApp Gateway CONNECTED as ${connectedUserNumber}`);

      // Trigger startup catch-up check after connection is established
      checkStartupCatchUp();
    }
  });
}

// ── REST Endpoints ────────────────────────────────────────────────────────────
app.get('/api/wa/status', (req, res) => {
  res.json({
    status: connectionStatus,
    qrCodeUrl: currentQrCodeUrl,
    connectedUser: connectedUserNumber,
    config: waConfig
  });
});

app.get('/api/wa/health', (req, res) => {
  const uptimeMs = Date.now() - SERVICE_START_TIME.getTime();
  const uptimeHours = (uptimeMs / 1000 / 60 / 60).toFixed(2);
  res.json({
    service: 'wa-gateway',
    status: 'running',
    waConnection: connectionStatus,
    connectedUser: connectedUserNumber,
    uptime: `${uptimeHours}h`,
    startedAt: SERVICE_START_TIME.toISOString(),
    cronActive: cronJob !== null,
    autoRemindEnabled: waConfig.autoRemindEnabled,
    lastCheckDate: waConfig.lastCheckDate || 'never',
    targetPhone: waConfig.targetPhone ? `****${waConfig.targetPhone.slice(-4)}` : 'not set'
  });
});

app.post('/api/wa/config', (req, res) => {
  const { targetPhone, targetGroup, autoRemindEnabled } = req.body;
  if (targetPhone !== undefined) waConfig.targetPhone = targetPhone;
  if (targetGroup !== undefined) waConfig.targetGroup = targetGroup;
  if (autoRemindEnabled !== undefined) waConfig.autoRemindEnabled = autoRemindEnabled;

  saveConfig();
  logAudit('INFO', 'Config updated', { targetPhone: waConfig.targetPhone, autoRemindEnabled: waConfig.autoRemindEnabled });
  res.json({ success: true, config: waConfig });
});

app.post('/api/wa/send', async (req, res) => {
  const { to, message } = req.body;

  if (connectionStatus !== 'CONNECTED' || !waSock) {
    return res.status(400).json({ success: false, error: 'WhatsApp Gateway belum terhubung. Silakan scan QR Code terlebih dahulu.' });
  }

  if (!to || !message) {
    return res.status(400).json({ success: false, error: 'Nomor tujuan (to) dan pesan (message) wajib diisi.' });
  }

  try {
    let recipientJid = to.trim();
    if (!recipientJid.includes('@')) {
      recipientJid = recipientJid.replace(/[^0-9]/g, '');
      if (recipientJid.startsWith('08')) {
        recipientJid = '628' + recipientJid.slice(2);
      }
      recipientJid = recipientJid + '@s.whatsapp.net';
    }

    await waSock.sendMessage(recipientJid, { text: message });
    logAudit('INFO', `Message sent to ${recipientJid}`);
    res.json({ success: true, recipient: recipientJid });
  } catch (err) {
    logAudit('ERROR', 'Failed to send message', { error: err.message });
    res.status(500).json({ success: false, error: err.message || 'Gagal mengirim pesan WhatsApp' });
  }
});

app.post('/api/wa/logout', async (req, res) => {
  try {
    if (waSock) {
      await waSock.logout();
    }
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
    connectionStatus = 'DISCONNECTED';
    currentQrCodeUrl = '';
    connectedUserNumber = '';

    logAudit('INFO', 'Session logged out, rescanning required');
    setTimeout(connectToWhatsApp, 2000);
    res.json({ success: true, message: 'Session logged out. Rescanning required.' });
  } catch (err) {
    logAudit('ERROR', 'Logout error', { error: err.message });
    res.status(500).json({ success: false, error: 'Gagal mereset sesi WhatsApp' });
  }
});

// ── Auto Reminder H-60: Build and send the PM notification message ────────────
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Get today's date string in WIB timezone (YYYY-MM-DD).
 * Used to check if reminder was already sent today.
 */
function getTodayWIB() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

/**
 * Check if lastCheckDate is from today (WIB).
 */
function wasReminderSentToday() {
  if (!waConfig.lastCheckDate) return false;
  const lastDate = new Date(waConfig.lastCheckDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  return lastDate === getTodayWIB();
}

async function sendAutoReminderH60(source = 'cron') {
  logAudit('INFO', `Auto-reminder triggered`, { source });

  if (!waConfig.autoRemindEnabled) {
    logAudit('INFO', 'Auto-reminder disabled in config — skipping', { source });
    return { skipped: true, reason: 'disabled' };
  }
  if (!waConfig.targetPhone) {
    logAudit('WARN', 'No target phone configured — skipping', { source });
    return { skipped: true, reason: 'no_target_phone' };
  }
  if (connectionStatus !== 'CONNECTED' || !waSock) {
    logAudit('WARN', 'WhatsApp not connected — skipping', { source, connectionStatus });
    return { skipped: true, reason: 'not_connected' };
  }

  // Check if already sent today to prevent duplicate sends
  if (wasReminderSentToday()) {
    logAudit('INFO', 'Reminder already sent today — skipping duplicate', { source, lastCheckDate: waConfig.lastCheckDate });
    return { skipped: true, reason: 'already_sent_today' };
  }

  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const targetMonthIndex = (currentMonthIndex + 2) % 12; // H-60 = 2 months ahead
  const targetMonthName = MONTH_NAMES[targetMonthIndex];

  const upcomingPMs = PM_SCHEDULE_DATA.filter(item => item.months[targetMonthIndex] !== null);

  if (upcomingPMs.length === 0) {
    logAudit('INFO', `No PM scheduled for ${targetMonthName} — no reminder sent`, { source });
    return { skipped: true, reason: 'no_pm_scheduled', month: targetMonthName };
  }

  let alertMessage = `🔔 *[AUTO REMINDER SENIN — H-60] PERSIAPAN PREVENTIVE MAINTENANCE (PM)*\n\n`;
  alertMessage += `Halo Tim Standby Engineer & Operation,\n\n`;
  alertMessage += `Berikut adalah agenda Preventive Maintenance yang akan dilaksanakan *2 BULAN LAGI* (${targetMonthName} 2026):\n\n`;

  upcomingPMs.forEach((pm, idx) => {
    const dates = pm.months[targetMonthIndex];
    alertMessage += `📌 *${idx + 1}. ${pm.device}*\n`;
    alertMessage += `   📍 Lokasi: ${pm.location}\n`;
    alertMessage += `   📅 Tanggal: ${dates} ${targetMonthName} 2026\n`;
    alertMessage += `   ⚠️ Wajib disiapkan: MOP, D-DAY, & Risk Register (JSA)\n\n`;
  });

  alertMessage += `Mohon segera mengunggah / menyelesaikan kelengkapan dokumen di dashboard:\n`;
  alertMessage += `🌐 https://dwimitrasystem.com/\n\n`;
  alertMessage += `_Dikirim otomatis setiap hari Senin oleh DwimitraSystem Auto-Reminder_`;

  try {
    let recipientJid = waConfig.targetPhone.trim().replace(/[^0-9]/g, '');
    if (recipientJid.startsWith('08')) {
      recipientJid = '628' + recipientJid.slice(2);
    }
    recipientJid += '@s.whatsapp.net';

    await waSock.sendMessage(recipientJid, { text: alertMessage });

    waConfig.lastCheckDate = now.toISOString();
    saveConfig();

    logAudit('SUCCESS', `Auto Reminder H-60 sent successfully`, {
      source,
      recipient: recipientJid,
      pmCount: upcomingPMs.length,
      targetMonth: targetMonthName
    });
    return { success: true, sent: upcomingPMs.length, month: targetMonthName };
  } catch (err) {
    logAudit('ERROR', 'Failed to send auto-reminder', { source, error: err.message });
    return { success: false, error: err.message };
  }
}

// ── Retry Wrapper: try up to 3 times with 5-min delay ─────────────────────────
async function sendReminderWithRetry(source = 'cron') {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    logAudit('INFO', `Reminder attempt ${attempt}/${MAX_RETRIES}`, { source });

    const result = await sendAutoReminderH60(source);

    // If sent successfully, already sent today, or disabled/no target — stop retrying
    if (result.success || result.reason === 'already_sent_today' || result.reason === 'disabled' || result.reason === 'no_target_phone' || result.reason === 'no_pm_scheduled') {
      return result;
    }

    // If not connected and we have more retries, wait and try again
    if (result.reason === 'not_connected' && attempt < MAX_RETRIES) {
      logAudit('WARN', `WA not connected — waiting ${RETRY_DELAY_MS / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}`, { source });
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      continue;
    }

    // If send failed (connected but error), wait and retry
    if (!result.success && !result.skipped && attempt < MAX_RETRIES) {
      logAudit('WARN', `Send failed — waiting ${RETRY_DELAY_MS / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}`, { source, error: result.error });
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      continue;
    }
  }

  logAudit('ERROR', `All ${MAX_RETRIES} reminder attempts exhausted`, { source });
  return { success: false, error: `All ${MAX_RETRIES} attempts failed` };
}

// ── Startup Catch-Up Logic ────────────────────────────────────────────────────
// If the service starts on a Monday after 08:00 WIB and no reminder was sent
// today, immediately attempt to send the reminder (with retry).
let catchUpDone = false;

function checkStartupCatchUp() {
  if (catchUpDone) return;
  catchUpDone = true;

  const now = new Date();
  // Get current day and hour in WIB
  const wibString = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour12: false });
  const wibDate = new Date(wibString);
  const dayOfWeek = wibDate.getDay(); // 0=Sun, 1=Mon, ...
  const hour = wibDate.getHours();

  if (dayOfWeek === 1 && hour >= 8 && !wasReminderSentToday()) {
    logAudit('INFO', 'Startup catch-up: Today is Monday after 08:00 WIB and no reminder sent yet — triggering now');
    // Small delay to ensure connection is fully stable
    setTimeout(async () => {
      await sendReminderWithRetry('startup-catchup');
    }, 10000); // Wait 10 seconds after connection
  } else {
    if (dayOfWeek === 1) {
      logAudit('INFO', `Startup catch-up: Monday but ${hour < 8 ? 'before 08:00' : 'already sent today'} — cron will handle`);
    } else {
      logAudit('INFO', `Startup catch-up: Not Monday (day=${dayOfWeek}) — no action needed`);
    }
  }
}

// ── Cron Job: Every Monday at 08:00 WIB ───────────────────────────────────────
// Cron format: minute hour dayOfMonth month dayOfWeek
// '0 8 * * 1' = At 08:00 on Monday
let cronJob = null;

function startWeeklyMondayCron() {
  if (cronJob) {
    cronJob.stop();
  }
  cronJob = cron.schedule('0 8 * * 1', async () => {
    logAudit('INFO', `⏰ Weekly Monday cron triggered at ${new Date().toISOString()}`);
    await sendReminderWithRetry('cron');
  }, {
    timezone: 'Asia/Jakarta'
  });
  logAudit('INFO', '📅 Cron scheduled: Every Monday at 08:00 WIB');
}

// ── REST Endpoint: Manual Trigger ─────────────────────────────────────────────
app.post('/api/wa/auto-remind', async (req, res) => {
  try {
    const result = await sendAutoReminderH60('manual');
    res.json({ success: !result.skipped && result.success !== false, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── REST Endpoint: Schedule Info ──────────────────────────────────────────────
app.get('/api/wa/schedule-info', (req, res) => {
  res.json({
    schedule: 'weekly_monday',
    description: 'Setiap hari Senin pukul 08:00 WIB',
    autoRemindEnabled: waConfig.autoRemindEnabled,
    lastCheckDate: waConfig.lastCheckDate,
    cronActive: cronJob !== null
  });
});

// ── REST Endpoint: View Audit Log (last 50 lines) ────────────────────────────
app.get('/api/wa/logs', (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return res.json({ logs: [] });
    }
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    const last50 = lines.slice(-50).map(line => {
      try { return JSON.parse(line); } catch { return { raw: line }; }
    });
    res.json({ logs: last50, total: lines.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start Server & Connect WA ─────────────────────────────────────────────────
app.listen(PORT, () => {
  logAudit('INFO', `WA Gateway Service started on http://localhost:${PORT}`);
  connectToWhatsApp();
  startWeeklyMondayCron();
  // Save config with normalized fields on startup
  saveConfig();
});
