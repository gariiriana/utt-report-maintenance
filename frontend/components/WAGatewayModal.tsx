import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  LogOut,
  X,
  Phone,
  ShieldAlert,
  CalendarCheck2,
  Clock,
  CalendarClock
} from 'lucide-react';
import { toast } from 'sonner';
import { User } from 'firebase/auth';

interface WAGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  pmScheduleData?: Array<{
    device: string;
    location: string;
    months: (string | null)[];
    remarks: string;
    category: string;
  }>;
}

interface WAStatusResponse {
  status: 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED';
  qrCodeUrl?: string;
  connectedUser?: string;
  config?: {
    targetPhone: string;
    targetGroup: string;
    autoRemindEnabled: boolean;
    lastCheckDate: string;
  };
}

export const WAGatewayModal: React.FC<WAGatewayModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  pmScheduleData = []
}) => {
  const isAuthorizedEmail = currentUser?.email?.toLowerCase() === 'dwimitra@co.id';

  const WA_API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001'
    : (import.meta.env.VITE_WA_GATEWAY_URL || 'http://localhost:5001');

  const [status, setStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED'>('DISCONNECTED');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [connectedUser, setConnectedUser] = useState<string>('');
  const [targetPhone, setTargetPhone] = useState<string>('');
  const [targetGroup, setTargetGroup] = useState<string>('');
  const [autoRemindEnabled, setAutoRemindEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [testMessage, setTestMessage] = useState<string>('');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [lastCheckDate, setLastCheckDate] = useState<string>('');

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${WA_API_BASE_URL}/api/wa/status`);
      if (!res.ok) throw new Error('WA Gateway offline');
      const data: WAStatusResponse = await res.json();
      
      setStatus(data.status);
      if (data.qrCodeUrl) setQrCodeUrl(data.qrCodeUrl);
      if (data.connectedUser) setConnectedUser(data.connectedUser);
      if (data.config) {
        const cfg = data.config;
        setTargetPhone(prev => prev || cfg.targetPhone || '');
        setTargetGroup(prev => prev || cfg.targetGroup || '');
        setAutoRemindEnabled(cfg.autoRemindEnabled);
        if (cfg.lastCheckDate) setLastCheckDate(cfg.lastCheckDate);
      }
    } catch (err) {
      console.warn('WA Gateway service unreachable:', err);
      setStatus('DISCONNECTED');
    }
  };

  useEffect(() => {
    if (isOpen && isAuthorizedEmail) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isAuthorizedEmail]);

  const handleSaveConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${WA_API_BASE_URL}/api/wa/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPhone, targetGroup, autoRemindEnabled })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Pengaturan nomor tujuan WhatsApp berhasil disimpan!');
      } else {
        toast.error('Gagal menyimpan konfigurasi WA.');
      }
    } catch (err) {
      toast.error('Gagal terhubung ke service WA Gateway local.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!targetPhone) {
      toast.error('Masukkan nomor WhatsApp tujuan terlebih dahulu.');
      return;
    }
    try {
      setIsSendingTest(true);
      const msg = testMessage || '🔔 [TEST] Notifikasi WhatsApp Gateway DwimitraSystem berhasil terhubung!';
      const res = await fetch(`${WA_API_BASE_URL}/api/wa/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: targetPhone, message: msg })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Pesan WhatsApp berhasil terkirim ke ${targetPhone}!`);
        setTestMessage('');
      } else {
        toast.error(data.error || 'Gagal mengirim pesan WhatsApp.');
      }
    } catch (err) {
      toast.error('Service WA Gateway tidak merespon.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleLogoutWA = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${WA_API_BASE_URL}/api/wa/logout`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Sesi WhatsApp berhasil direset. Silakan scan QR Code baru.');
        fetchStatus();
      }
    } catch (err) {
      toast.error('Gagal mereset sesi WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerAutoCheckH60 = async () => {
    if (!targetPhone) {
      toast.error('Mohon isi Nomor WhatsApp Tujuan terlebih dahulu.');
      return;
    }

    if (status !== 'CONNECTED') {
      toast.error('WhatsApp Gateway belum terhubung! Silakan scan QR Code terlebih dahulu.');
      return;
    }

    const toastId = toast.loading('Memeriksa jadwal PM H-60 dan dokumen readiness...');
    try {
      // Current date info
      const now = new Date();
      const currentMonthIndex = now.getMonth(); // 0-11
      const targetMonthIndex = (currentMonthIndex + 2) % 12; // 2 months ahead (H-60)
      
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const targetMonthName = monthNames[targetMonthIndex];

      // Find scheduled PMs in target month
      const upcomingPMs = pmScheduleData.filter(item => item.months[targetMonthIndex] !== null);

      if (upcomingPMs.length === 0) {
        toast.dismiss(toastId);
        toast.info(`Tidak ada jadwal PM di bulan ${targetMonthName} (2 Bulan ke depan).`);
        return;
      }

      // Build message payload
      let alertMessage = `🔔 *[REMINDER H-60] PERSIAPAN PREVENTIVE MAINTENANCE (PM)*\n\n`;
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
      alertMessage += `*DwimitraSystem Automated PM Schedule Notification*`;

      // Send via Gateway
      const res = await fetch(`${WA_API_BASE_URL}/api/wa/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: targetPhone, message: alertMessage })
      });

      const data = await res.json();
      toast.dismiss(toastId);

      if (data.success) {
        toast.success(`🔥 Reminder H-60 (${upcomingPMs.length} Perangkat PM) berhasil dikirim ke WA ${targetPhone}!`);
      } else {
        toast.error(data.error || 'Gagal mengirim notifikasi WA H-60.');
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('Gagal mengeksekusi pemeriksaan H-60 PM.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto text-slate-900 z-10"
        >
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight">WhatsApp Gateway &amp; H-60 Reminders</h3>
                <p className="text-emerald-100 text-xs font-medium">Integrasi Otomatis Reminder MOP, D-DAY, &amp; Risk Register</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Access Control Check */}
          {!isAuthorizedEmail ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">Akses Terbatas (Khusus Administrator)</h4>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Fitur konfigurasi WhatsApp Gateway dan Reminder H-60 ini hanya dapat diakses oleh akun resmi <strong>Dwimitra@co.id</strong>.
              </p>
              <p className="text-xs text-slate-400">Akun Anda saat ini: {currentUser?.email || 'Guest'}</p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Tutup Modul
              </button>
            </div>
          ) : (
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

              {/* Connection Status Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                    status === 'CONNECTED'
                      ? 'bg-emerald-100 border-emerald-200 text-emerald-600'
                      : status === 'QR_READY'
                      ? 'bg-amber-100 border-amber-200 text-amber-600'
                      : 'bg-red-100 border-red-200 text-red-600'
                  }`}>
                    {status === 'CONNECTED' ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : status === 'QR_READY' ? (
                      <QrCode className="w-6 h-6" />
                    ) : (
                      <AlertCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Koneksi WA:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                        status === 'CONNECTED'
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          : status === 'QR_READY'
                          ? 'bg-amber-100 text-amber-700 border border-amber-300 animate-pulse'
                          : 'bg-red-100 text-red-700 border border-red-300'
                      }`}>
                        {status === 'CONNECTED' ? 'TERHUBUNG' : status === 'QR_READY' ? 'SCAN QR CODE' : 'TERPUTUS'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 font-semibold">
                      {status === 'CONNECTED'
                        ? `Terhubung sebagai: ${connectedUser}`
                        : status === 'QR_READY'
                        ? 'Arahkan kamera WhatsApp (Perangkat Tertaut) ke QR Code di bawah'
                        : 'Service WA Gateway offline atau membutuhkan scan QR.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchStatus}
                    className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Refresh status"
                  >
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                    Refresh
                  </button>

                  {status === 'CONNECTED' && (
                    <button
                      onClick={handleLogoutWA}
                      disabled={loading}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Reset Sesi WA"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      Reset Sesi
                    </button>
                  )}
                </div>
              </div>

              {/* QR Code Display (If QR_READY) */}
              {status === 'QR_READY' && qrCodeUrl && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
                  <div className="inline-block p-4 bg-white rounded-2xl border border-amber-300 shadow-md">
                    <img src={qrCodeUrl} alt="WhatsApp Gateway QR Code" className="w-56 h-56 mx-auto rounded-lg" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 flex items-center justify-center gap-2">
                      <QrCode className="w-5 h-5 text-amber-600" />
                      Scan QR Code Sekali untuk Mengaktifkan
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                      Buka WhatsApp HP Standby Operasional $\rightarrow$ <strong>Perangkat Tertaut (Linked Devices)</strong> $\rightarrow$ Arahkan kamera ke QR Code di atas.
                    </p>
                  </div>
                </div>
              )}

              {/* Target Configuration Form */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  Pengaturan Nomor Tujuan Notification
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor WA Tujuan PIC / Group (Contoh: 081234567890 / 6281234567890)
                    </label>
                    <input
                      type="text"
                      value={targetPhone}
                      onChange={(e) => setTargetPhone(e.target.value)}
                      placeholder="Masukkan nomor WA penerima..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Target Group WA ID (Opsional)
                    </label>
                    <input
                      type="text"
                      value={targetGroup}
                      onChange={(e) => setTargetGroup(e.target.value)}
                      placeholder="Contoh: 120363xxxxxx@g.us"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-semibold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRemindEnabled}
                      onChange={(e) => setAutoRemindEnabled(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-slate-700">Aktifkan Auto-Reminder H-60 (Setiap Senin 08:00 WIB)</span>
                  </label>

                  <button
                    onClick={handleSaveConfig}
                    disabled={loading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
                  >
                    Simpan Pengaturan
                  </button>
                </div>
              </div>

              {/* Action Box: H-60 Reminder Trigger & Test Message */}
              <div className="bg-gradient-to-br from-indigo-50/50 to-slate-50 border border-indigo-100 rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <CalendarCheck2 className="w-4 h-4 text-indigo-600" />
                  Eksekusi Reminder H-60 Dokumen Maintenance (MOP, D-DAY, Risk Register)
                </h4>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Sistem akan secara otomatis menyaring agenda <strong>Preventive Maintenance (PM) 2 Bulan ke depan</strong> dari jadwal resmi PM Schedule 2026, lalu mengirimkan daftar tagihan dokumen yang belum siap langsung ke nomor WhatsApp yang dikonfigurasi di atas.
                </p>

                {/* Schedule Info Badge */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-full text-xs font-bold">
                    <CalendarClock className="w-3.5 h-3.5" />
                    Jadwal Otomatis: Setiap Hari Senin, 08:00 WIB
                  </span>
                  {lastCheckDate && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      Terakhir dikirim: {new Date(lastCheckDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleTriggerAutoCheckH60}
                    disabled={status !== 'CONNECTED'}
                    className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <Clock className="w-4 h-4" />
                    Kirim Broadcast WA Reminder H-60 PM Sekarang
                  </button>

                  <button
                    onClick={handleSendTestMessage}
                    disabled={isSendingTest || status !== 'CONNECTED'}
                    className="px-5 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-emerald-600" />
                    Kirim Test WA
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* Modal Footer */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center text-xs text-slate-500">
            <span>Powered by Self-Hosted Baileys WA Gateway (Rp 0)</span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
