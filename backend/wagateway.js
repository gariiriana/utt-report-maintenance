import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
  checkIntervalHours: 24,
  lastCheckDate: ''
};

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

// Start Server & Connect WA
app.listen(PORT, () => {
  console.log(`[WA-Gateway] Service running on http://localhost:${PORT}`);
  connectToWhatsApp();
});
