// ============================================================================
// FILE: Login.tsx
// Deskripsi: Halaman Login autentikasi utama DwimitraSystem.
//            Dilengkapi dengan integrasi Cloudflare Turnstile CAPTCHA untuk
//            mencegah bot / brute-force attack, serta animasi Framer Motion
//            dan penanganan error terisolasi dalam Bahasa Indonesia.
// ============================================================================

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/components/AuthContext';
import { toast } from 'sonner';
import { Lock, Mail, Eye, EyeOff, LogIn } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';

import logoDwimitra from '@/assets/logo_dwimitra_v2.png';

export function Login() {
  // State form login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Toggle lihat/sembunyi password
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null); // Token CAPTCHA Turnstile

  // Ambil fungsi login dari AuthContext
  const { login } = useAuth();

  /**
   * Handler submit form login
   * 1. Validasi field kosong & token Turnstile CAPTCHA
   * 2. Panggil fungsi login Firebase Auth
   * 3. Menampilkan pesan error spesifik jika terjadi kegagalan (koneksi, password salah, dll.)
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi field terisi
    if (!email || !password) {
      toast.error('Mohon isi semua field');
      return;
    }

    // Validasi verifikasi bot Turnstile
    if (!turnstileToken) {
      toast.error('Mohon selesaikan verifikasi keamanan Turnstile terlebih dahulu');
      return;
    }

    setLoading(true);
    try {
      // Proses login Firebase Auth
      await login(email, password);
      toast.success('Login berhasil!');
    } catch (error: any) {
      console.error('Login error:', error);

      let errorMessage = 'Login gagal. Silakan coba lagi.';

      // Penanganan error jaringan / kredensial terpisah
      if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Koneksi jaringan ke server gagal. Pastikan internet Anda lancar dan tidak terhalang AdBlocker/Firewall/DNS lokal.';
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Email atau password salah';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Terlalu banyak percobaan login. Coba lagi nanti.';
      }

      toast.error(errorMessage);
      setTurnstileToken(null); // Reset token Turnstile jika login gagal
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full font-geist text-slate-800 flex items-center justify-center p-4 sm:p-6 md:p-8 select-none z-50">
      {/* Container Card Login dengan animasi fade-in & scale */}
      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-[92%] sm:w-full max-w-[360px] sm:max-w-[420px] relative z-10 mx-auto my-auto"
      >
        <div className="bg-white/80 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-xl shadow-sky-900/10 border border-white/90 overflow-hidden">
          {/* Garis Aksen Dekorasi Top Bar */}
          <div className="h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500" />

          <div className="p-4 sm:p-6 md:p-7">
            {/* Header Logo & Judul Perusahaan */}
            <div className="text-center mb-4 sm:mb-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className="inline-flex items-center justify-center mb-1.5 md:mb-2"
              >
                <img
                  src={logoDwimitra}
                  alt="PT Dwimitra Ekatama Mandiri"
                  className="h-12 sm:h-16 md:h-20 w-auto object-contain drop-shadow-sm transition-all"
                />
              </motion.div>

              <h1 className="text-sm sm:text-lg md:text-xl font-black text-slate-900 tracking-tight leading-snug">
                PT Dwimitra Ekatama Mandiri
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-600 font-semibold mt-0.5">
                Data Center Maintenance System
              </p>
            </div>

            {/* Form Input Email, Password, & CAPTCHA */}
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              {/* Input Email */}
              <div>
                <label htmlFor="email" className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">
                  Alamat Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-600 transition z-10 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-2.5 bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-xl focus:ring-3 focus:ring-blue-500/15 focus:border-blue-500 focus:bg-white outline-none transition text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium shadow-sm"
                    placeholder="user@perusahaan.com"
                  />
                </div>
              </div>

              {/* Input Kata Sandi */}
              <div>
                <label htmlFor="password" className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-600 transition z-10 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 sm:pl-10 pr-9 sm:pr-10 py-2 sm:py-2.5 bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-xl focus:ring-3 focus:ring-blue-500/15 focus:border-blue-500 focus:bg-white outline-none transition text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium shadow-sm"
                    placeholder="Masukkan kata sandi Anda"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition cursor-pointer p-1 z-10"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Cloudflare Turnstile Anti-Bot Security */}
              <div className="pt-0.5 pb-0.5 flex justify-center items-center cf-turnstile" data-action="turnstile-spin-v2">
                <Turnstile
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAD_fWrDH129FQ_Rm'}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken(null)}
                  onError={() => setTurnstileToken(null)}
                  options={{ action: 'turnstile-spin-v2', theme: 'light', size: 'normal' }}
                />
              </div>

              {/* Tombol Submit Login */}
              <motion.button
                whileHover={{ scale: turnstileToken && !loading ? 1.01 : 1 }}
                whileTap={{ scale: turnstileToken && !loading ? 0.98 : 1 }}
                type="submit"
                disabled={loading || !turnstileToken}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-2.5 sm:py-3 rounded-xl font-bold shadow-md shadow-blue-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 text-xs sm:text-sm cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sedang Masuk...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn className="w-4 h-4 md:w-5 md:h-5" />
                    Masuk
                  </span>
                )}
              </motion.button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
