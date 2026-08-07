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

// Memory State
let waSock = null;
let connectionStatus = 'DISCONNECTED'; // DISCONNECTED | QR_READY | CONNECTING | CONNECTED
let currentQrCodeUrl = '';
let connectedUserNumber = '';

// Load initial config
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

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    waConfig = { ...waConfig, ...JSON.parse(raw) };
  } catch (err) {
    console.error('[WA-Gateway] Failed to read config file:', err);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(waConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('[WA-Gateway] Failed to save config file:', err);
  }
}

async function connectToWhatsApp() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  connectionStatus = 'CONNECTING';

  waSock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    browser: ['DwimitraSystem', 'Chrome', '1.0.0']
  });

  waSock.ev.on('creds.update', saveCreds);

  waSock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      connectionStatus = 'QR_READY';
      try {
        currentQrCodeUrl = await QRCode.toDataURL(qr);
        console.log('[WA-Gateway] 📲 QR Code generated! Available in Admin Panel.');
      } catch (err) {
        console.error('[WA-Gateway] Error converting QR to DataURL:', err);
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[WA-Gateway] Connection closed due to:`, lastDisconnect?.error, `, reconnecting: ${shouldReconnect}`);

      connectionStatus = 'DISCONNECTED';
      currentQrCodeUrl = '';
      connectedUserNumber = '';

      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 5000);
      } else {
        console.log('[WA-Gateway] Session logged out. Clean session directory to rescan.');
        if (fs.existsSync(AUTH_DIR)) {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
      }
    } else if (connection === 'open') {
      connectionStatus = 'CONNECTED';
      currentQrCodeUrl = '';
      connectedUserNumber = waSock.user?.id?.split(':')[0] || 'Terhubung';
      console.log(`[WA-Gateway] ✅ WhatsApp Gateway CONNECTED as ${connectedUserNumber}`);
    }
  });
}

// REST Endpoints
app.get('/api/wa/status', (req, res) => {
  res.json({
    status: connectionStatus,
    qrCodeUrl: currentQrCodeUrl,
    connectedUser: connectedUserNumber,
    config: waConfig
  });
});

app.post('/api/wa/config', (req, res) => {
  const { targetPhone, targetGroup, autoRemindEnabled } = req.body;
  if (targetPhone !== undefined) waConfig.targetPhone = targetPhone;
  if (targetGroup !== undefined) waConfig.targetGroup = targetGroup;
  if (autoRemindEnabled !== undefined) waConfig.autoRemindEnabled = autoRemindEnabled;
  
  saveConfig();
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
      // Clean phone number
      recipientJid = recipientJid.replace(/[^0-9]/g, '');
      if (recipientJid.startsWith('08')) {
        recipientJid = '628' + recipientJid.slice(2);
      }
      recipientJid = recipientJid + '@s.whatsapp.net';
    }

    await waSock.sendMessage(recipientJid, { text: message });
    console.log(`[WA-Gateway] 📩 Message sent to ${recipientJid}`);
    res.json({ success: true, recipient: recipientJid });
  } catch (err) {
    console.error('[WA-Gateway] Error sending message:', err);
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
    
    setTimeout(connectToWhatsApp, 2000);
    res.json({ success: true, message: 'Session logged out. Rescanning required.' });
  } catch (err) {
    console.error('[WA-Gateway] Logout error:', err);
    res.status(500).json({ success: false, error: 'Gagal mereset sesi WhatsApp' });
  }
});

// ── Auto Reminder H-60: Build and send the PM notification message ──
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

async function sendAutoReminderH60() {
  if (!waConfig.autoRemindEnabled) {
    console.log('[WA-Cron] Auto-reminder disabled in config. Skipping.');
    return { skipped: true, reason: 'disabled' };
  }
  if (!waConfig.targetPhone) {
    console.log('[WA-Cron] No target phone configured. Skipping.');
    return { skipped: true, reason: 'no_target_phone' };
  }
  if (connectionStatus !== 'CONNECTED' || !waSock) {
    console.log('[WA-Cron] WhatsApp not connected. Skipping auto-reminder.');
    return { skipped: true, reason: 'not_connected' };
  }

  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const targetMonthIndex = (currentMonthIndex + 2) % 12; // H-60 = 2 months ahead
  const targetMonthName = MONTH_NAMES[targetMonthIndex];

  const upcomingPMs = PM_SCHEDULE_DATA.filter(item => item.months[targetMonthIndex] !== null);

  if (upcomingPMs.length === 0) {
    console.log(`[WA-Cron] No PM scheduled for ${targetMonthName}. No reminder sent.`);
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

    console.log(`[WA-Cron] ✅ Auto Reminder H-60 sent successfully to ${recipientJid} (${upcomingPMs.length} perangkat PM for ${targetMonthName})`);
    return { success: true, sent: upcomingPMs.length, month: targetMonthName };
  } catch (err) {
    console.error('[WA-Cron] ❌ Failed to send auto-reminder:', err);
    return { success: false, error: err.message };
  }
}

// ── Cron Job: Every Monday at 08:00 WIB ──
// Cron format: minute hour dayOfMonth month dayOfWeek
// '0 8 * * 1' = At 08:00 on Monday
let cronJob = null;

function startWeeklyMondayCron() {
  if (cronJob) {
    cronJob.stop();
  }
  cronJob = cron.schedule('0 8 * * 1', async () => {
    console.log(`[WA-Cron] ⏰ Weekly Monday reminder triggered at ${new Date().toISOString()}`);
    await sendAutoReminderH60();
  }, {
    timezone: 'Asia/Jakarta'
  });
  console.log('[WA-Cron] 📅 Cron scheduled: Every Monday at 08:00 WIB');
}

// REST Endpoint: Manually trigger auto-reminder (from frontend)
app.post('/api/wa/auto-remind', async (req, res) => {
  try {
    const result = await sendAutoReminderH60();
    res.json({ success: !result.skipped, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// REST Endpoint: Get cron schedule info
app.get('/api/wa/schedule-info', (req, res) => {
  res.json({
    schedule: 'weekly_monday',
    description: 'Setiap hari Senin pukul 08:00 WIB',
    autoRemindEnabled: waConfig.autoRemindEnabled,
    lastCheckDate: waConfig.lastCheckDate,
    cronActive: cronJob !== null
  });
});

// Start Server & Connect WA
app.listen(PORT, () => {
  console.log(`[WA-Gateway] Service running on http://localhost:${PORT}`);
  connectToWhatsApp();
  startWeeklyMondayCron();
});
