// ============================================================================
// FILE: frontend/components/WAGatewayModal.tsx
// Deskripsi: Modal Antarmuka WhatsApp Gateway & Auto-Reminder H-60 PM.
//            Mendukung Dual-Mode:
//            1. CLOUD GATEWAY (Primary / Always-On 24/7 via Fonnte API & Scheduled Cloud Functions)
//               -> Berjalan otomatis setiap Senin 08:00 WIB meskipun laptop/PC lokal mati.
//            2. LOCAL BAILEYS GATEWAY (Secondary / Backup lokal opsional via Node.js port 5001)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
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
  CalendarClock,
  Cloud,
  Key,
  Eye,
  EyeOff,
  Server,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { User } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/api/firebase';

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

interface FirestoreWAReminderConfig {
  targetPhone?: string;
  targetGroup?: string;
  autoRemindEnabled?: boolean;
  fonnte_token?: string;
  lastSentDate?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const WAGatewayModal: React.FC<WAGatewayModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  pmScheduleData = []
}) => {
  const isAuthorizedEmail = currentUser?.email?.toLowerCase() === 'dwimitra@co.id' || currentUser?.email?.toLowerCase().includes('admin');

  // Cloud Config State (Firestore)
  const [targetPhone, setTargetPhone] = useState<string>('');
  const [targetGroup, setTargetGroup] = useState<string>('');
  const [fonnteToken, setFonnteToken] = useState<string>('');
  const [showFonnteToken, setShowFonnteToken] = useState<boolean>(false);
  const [autoRemindEnabled, setAutoRemindEnabled] = useState<boolean>(true);
  const [lastSentDate, setLastSentDate] = useState<string>('');
  const [savingCloud, setSavingCloud] = useState<boolean>(false);

  // Cloud Execution State
  const [isSendingCloudH60, setIsSendingCloudH60] = useState<boolean>(false);
  const [isSendingCloudTest, setIsSendingCloudTest] = useState<boolean>(false);
  const [testMessage, setTestMessage] = useState<string>('');

  // Local Gateway State (Baileys Port 5001)
  const [showLocalGateway, setShowLocalGateway] = useState<boolean>(false);
  const [localStatus, setLocalStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED'>('DISCONNECTED');
  const [localQrCodeUrl, setLocalQrCodeUrl] = useState<string>('');
  const [localConnectedUser, setLocalConnectedUser] = useState<string>('');
  const [localLoading, setLocalLoading] = useState<boolean>(false);

  const WA_API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001'
    : (import.meta.env.VITE_WA_GATEWAY_URL || 'http://localhost:5001');

  // 1. Subscribe ke konfigurasi Firestore `system_status/wa_reminder_config`
  useEffect(() => {
    if (!isOpen || !isAuthorizedEmail) return;

    const docRef = doc(db, 'system_status', 'wa_reminder_config');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as FirestoreWAReminderConfig;
        if (data.targetPhone !== undefined) setTargetPhone(data.targetPhone);
        if (data.targetGroup !== undefined) setTargetGroup(data.targetGroup);
        if (data.fonnte_token !== undefined) setFonnteToken(data.fonnte_token);
        if (data.autoRemindEnabled !== undefined) setAutoRemindEnabled(data.autoRemindEnabled);
        if (data.lastSentDate) setLastSentDate(data.lastSentDate);
      }
    }, (error) => {
      console.warn('Gagal membaca config WA dari Firestore:', error);
    });

    return () => unsubscribe();
  }, [isOpen, isAuthorizedEmail]);

  // 2. Polling status Local Gateway (Baileys) hanya jika dibuka
  const fetchLocalStatus = async () => {
    try {
      const res = await fetch(`${WA_API_BASE_URL}/api/wa/status`);
      if (!res.ok) throw new Error('Local WA Gateway offline');
      const data: WAStatusResponse = await res.json();
      
      setLocalStatus(data.status);
      if (data.qrCodeUrl) setLocalQrCodeUrl(data.qrCodeUrl);
      if (data.connectedUser) setLocalConnectedUser(data.connectedUser);
    } catch {
      setLocalStatus('DISCONNECTED');
    }
  };

  useEffect(() => {
    if (isOpen && isAuthorizedEmail && showLocalGateway) {
      fetchLocalStatus();
      const interval = setInterval(fetchLocalStatus, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isAuthorizedEmail, showLocalGateway]);

  // 3. Simpan Pengaturan Cloud ke Firestore
  const handleSaveConfig = async () => {
    if (!targetPhone.trim()) {
      toast.error('Nomor WhatsApp tujuan wajib diisi.');
      return;
    }

    try {
      setSavingCloud(true);
      const docRef = doc(db, 'system_status', 'wa_reminder_config');
      await setDoc(docRef, {
        targetPhone: targetPhone.trim(),
        targetGroup: targetGroup.trim(),
        fonnte_token: fonnteToken.trim(),
        autoRemindEnabled,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.email || 'admin'
      }, { merge: true });

      // Optional: sync to local gateway if online
      fetch(`${WA_API_BASE_URL}/api/wa/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPhone, targetGroup, autoRemindEnabled })
      }).catch(() => {});

      toast.success('Pengaturan WhatsApp Cloud & Auto-Reminder berhasil disimpan!');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan konfigurasi ke Cloud Firestore.');
    } finally {
      setSavingCloud(false);
    }
  };

  // Helper untuk mengirim pesan via Cloud (Backend API Proxy / Direct Fonnte)
  const sendViaCloudGateway = async (target: string, msg: string, group?: string) => {
    // 1. Coba lewat backend serverless / Go backend proxy (/api/wa/send)
    try {
      const apiRes = await fetch('/api/wa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: fonnteToken.trim(),
          targetPhone: target.trim(),
          targetGroup: group?.trim() || '',
          message: msg
        })
      });

      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json.status === 'success') {
          return { success: true, data: json };
        }
      }
    } catch {
      // Backend proxy fallback ke direct call
    }

    // 2. Direct Fonnte API call
    let finalTarget = target.trim();
    if (group && group.trim()) {
      finalTarget = `${finalTarget},${group.trim()}`;
    }

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': fonnteToken.trim(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target: finalTarget,
        message: msg,
        countryCode: '62'
      })
    });

    const resJson = await response.json();
    if (resJson.status === true) {
      return { success: true, data: resJson };
    }
    throw new Error(resJson.reason || resJson.message || 'Gagal mengirim pesan WhatsApp via Fonnte.');
  };

  // 4. Eksekusi Kirim Test WA via Cloud
  const handleSendCloudTest = async () => {
    if (!targetPhone.trim()) {
      toast.error('Masukkan nomor WhatsApp tujuan terlebih dahulu.');
      return;
    }
    if (!fonnteToken.trim()) {
      toast.error('Masukkan Fonnte API Token terlebih dahulu.');
      return;
    }

    const toastId = toast.loading('Mengirim pesan WhatsApp test via Cloud Gateway...');
    try {
      setIsSendingCloudTest(true);
      const msg = testMessage.trim() ||
        `🔔 *[TEST CLOUD WA GATEWAY]*\n\nIntegrasi WhatsApp Cloud DwimitraSystem (Fonnte API) berhasil terhubung dan siap digunakan!\n\n_Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB_`;

      await sendViaCloudGateway(targetPhone, msg);
      toast.dismiss(toastId);
      toast.success(`Pesan test WhatsApp Cloud berhasil dikirim ke ${targetPhone}!`);
      setTestMessage('');
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || 'Gagal mengirim pesan test WhatsApp.');
    } finally {
      setIsSendingCloudTest(false);
    }
  };

  // 5. Eksekusi Broadcast Reminder H-60 Sekarang via Cloud
  const handleTriggerCloudH60 = async () => {
    if (!targetPhone.trim()) {
      toast.error('Masukkan nomor WhatsApp tujuan terlebih dahulu.');
      return;
    }
    if (!fonnteToken.trim()) {
      toast.error('Fonnte API Token belum diatur. Harap masukkan token API Fonnte.');
      return;
    }

    const toastId = toast.loading('Menganalisis jadwal PM H-60 & mengirim notifikasi via Cloud...');
    try {
      setIsSendingCloudH60(true);

      // Hitung target 2 bulan ke depan (H-60)
      const now = new Date();
      const currentMonthIndex = now.getMonth();
      const targetMonthIndex = (currentMonthIndex + 2) % 12;
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const targetMonthName = monthNames[targetMonthIndex];

      const upcomingPMs = pmScheduleData.filter(item => item.months[targetMonthIndex] !== null);

      if (upcomingPMs.length === 0) {
        toast.dismiss(toastId);
        toast.info(`Tidak ada jadwal PM di bulan ${targetMonthName} (2 Bulan ke depan).`);
        return;
      }

      let alertMessage = `🔔 *[AUTO REMINDER — H-60] PERSIAPAN PREVENTIVE MAINTENANCE (PM)*\n\n`;
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
      alertMessage += `_Notifikasi otomatis dijadwalkan via DwimitraSystem Cloud Gateway_`;

      await sendViaCloudGateway(targetPhone, alertMessage, targetGroup);

      const sentIso = new Date().toISOString();
      setLastSentDate(sentIso);

      // Update lastSentDate di Firestore
      const docRef = doc(db, 'system_status', 'wa_reminder_config');
      setDoc(docRef, { lastSentDate: sentIso }, { merge: true }).catch(() => {});

      toast.dismiss(toastId);
      toast.success(`🔥 Reminder H-60 (${upcomingPMs.length} agenda PM di ${targetMonthName}) berhasil dikirim!`);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || 'Gagal mengeksekusi reminder H-60 via Cloud.');
    } finally {
      setIsSendingCloudH60(false);
    }
  };

  // 6. Reset Sesi Local Baileys
  const handleLogoutLocalWA = async () => {
    try {
      setLocalLoading(true);
      const res = await fetch(`${WA_API_BASE_URL}/api/wa/logout`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Sesi WhatsApp lokal berhasil direset. Silakan scan QR Code baru.');
        fetchLocalStatus();
      }
    } catch {
      toast.error('Gagal mereset sesi WhatsApp lokal.');
    } finally {
      setLocalLoading(false);
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
          className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto text-slate-900 z-10 flex flex-col max-h-[90vh]"
        >
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-sky-700 p-6 text-white flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
                <Cloud className="w-6 h-6 text-emerald-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold tracking-tight">WhatsApp Cloud Gateway</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-100 text-[10px] font-black uppercase tracking-wider border border-emerald-300/30">
                    Always-On 24/7
                  </span>
                </div>
                <p className="text-emerald-100 text-xs font-medium mt-0.5">
                  Pengingat Otomatis H-60 Dokumen Maintenance (MOP, D-DAY, Risk Register)
                </p>
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

          {/* Modal Body */}
          {!isAuthorizedEmail ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">Akses Terbatas (Khusus Administrator)</h4>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Fitur konfigurasi WhatsApp Gateway dan Reminder H-60 ini hanya dapat diakses oleh akun resmi <strong>dwimitra@co.id</strong>.
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
            <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">

              {/* Status Banner: Cloud Service Always-On */}
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border border-emerald-200/80 rounded-2xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-inner ${
                    fonnteToken && targetPhone
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                      : 'bg-amber-100 border-amber-300 text-amber-700'
                  }`}>
                    {fonnteToken && targetPhone ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <AlertCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Cloud Gateway:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                        fonnteToken && targetPhone
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                      }`}>
                        {fonnteToken && targetPhone ? 'CLOUD READY (24/7)' : 'PERLU TOKEN API'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 font-medium">
                      {fonnteToken && targetPhone
                        ? 'Scheduler Cloud aktif. Notifikasi dikirim otomatis setiap Senin 08:00 WIB meskipun PC mati.'
                        : 'Masukkan Fonnte API Token & Nomor Tujuan agar pengiriman cloud otomatis berjalan.'}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <a
                    href="https://fonnte.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-[11px] font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    <span>Buka Fonnte.com</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                </div>
              </div>

              {/* Form Konfigurasi WhatsApp Cloud */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    Pengaturan Pengiriman WhatsApp
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-400">Tersimpan di Cloud Firestore</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nomor WhatsApp PIC */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor WA Tujuan PIC (Contoh: 085723375324 / 6285723375324) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={targetPhone}
                      onChange={(e) => setTargetPhone(e.target.value)}
                      placeholder="Contoh: 085723375324"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-semibold"
                    />
                  </div>

                  {/* Target Group WA ID */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Target Group WA ID (Opsional)
                    </label>
                    <input
                      type="text"
                      value={targetGroup}
                      onChange={(e) => setTargetGroup(e.target.value)}
                      placeholder="Contoh: 6281299422789 atau ID@g.us"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-semibold"
                    />
                  </div>
                </div>

                {/* Fonnte API Token */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-600" />
                      Fonnte.com API Token <span className="text-rose-500">*</span>
                    </label>
                    <a
                      href="https://fonnte.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                    >
                      Dapatkan Token di Fonnte Dashboard &rarr;
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showFonnteToken ? 'text' : 'password'}
                      value={fonnteToken}
                      onChange={(e) => setFonnteToken(e.target.value)}
                      placeholder="Masukkan Token Device dari Fonnte (e.g. abc123XYZ456...)"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFonnteToken(!showFonnteToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      {showFonnteToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Toggle Auto-Reminder & Save Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRemindEnabled}
                      onChange={(e) => setAutoRemindEnabled(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700">
                      Aktifkan Auto-Reminder H-60 Cloud (Setiap Senin 08:00 WIB)
                    </span>
                  </label>

                  <button
                    onClick={handleSaveConfig}
                    disabled={savingCloud}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {savingCloud ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Simpan Pengaturan Cloud
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Eksekusi Action Box */}
              <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-white border border-indigo-100 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <CalendarCheck2 className="w-4 h-4 text-indigo-600" />
                    Eksekusi Pengingat H-60 Dokumen Maintenance
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                    PM 2 Bulan Ke Depan
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Sistem menyaring agenda <strong>Preventive Maintenance (PM) 2 Bulan ke depan</strong> dari jadwal PM Schedule 2026 dan menyusun checklist tagihan dokumen (MOP, D-DAY, Risk Register) untuk dikirim langsung ke WhatsApp.
                </p>

                {/* Schedule Info Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-full text-xs font-bold shadow-xs">
                    <CalendarClock className="w-3.5 h-3.5" />
                    Jadwal Otomatis: Setiap Hari Senin, 08:00 WIB
                  </span>
                  {lastSentDate && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Terakhir Terkirim: {new Date(lastSentDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleTriggerCloudH60}
                    disabled={isSendingCloudH60 || !fonnteToken || !targetPhone}
                    className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSendingCloudH60 ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Mengirim Reminder H-60 via Cloud...
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4" />
                        Kirim Broadcast WA Reminder H-60 Sekarang (Cloud)
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSendCloudTest}
                    disabled={isSendingCloudTest || !fonnteToken || !targetPhone}
                    className="px-5 py-3 bg-white hover:bg-slate-50 disabled:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSendingCloudTest ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                        Mengirim...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-emerald-600" />
                        Kirim Test WA via Cloud
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible: Backup / Local Baileys Gateway */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/70 transition">
                <button
                  type="button"
                  onClick={() => setShowLocalGateway(!showLocalGateway)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left text-xs font-bold text-slate-700 hover:bg-slate-100/80 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-slate-500" />
                    <span>Layanan Cadangan: Local Baileys Gateway (localhost:5001)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      localStatus === 'CONNECTED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {localStatus === 'CONNECTED' ? 'TERHUBUNG' : 'OPSIONAL'}
                    </span>
                  </div>
                  {showLocalGateway ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {showLocalGateway && (
                  <div className="p-5 border-t border-slate-200 bg-white space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">
                          Status Node.js WA Gateway: <strong className="uppercase">{localStatus}</strong>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {localStatus === 'CONNECTED'
                            ? `Terhubung sebagai: ${localConnectedUser}`
                            : 'Gunakan mode ini hanya untuk pengetesan offline via port 5001.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={fetchLocalStatus}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-xs font-bold transition flex items-center gap-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Cek Lokal
                        </button>
                        {localStatus === 'CONNECTED' && (
                          <button
                            onClick={handleLogoutLocalWA}
                            disabled={localLoading}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {localStatus === 'QR_READY' && localQrCodeUrl && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-2">
                        <img src={localQrCodeUrl} alt="Local QR Code" className="w-44 h-44 mx-auto rounded-lg shadow-sm" />
                        <p className="text-xs text-amber-800 font-semibold">
                          Scan QR Code di atas dengan WhatsApp HP untuk menghubungkan gateway lokal.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Modal Footer */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center text-xs text-slate-500 shrink-0">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Powered by Cloud Functions &amp; Fonnte WhatsApp API
            </span>
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
