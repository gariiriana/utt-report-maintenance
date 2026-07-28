import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/components/AuthContext';
import { toast } from 'sonner';
import { Lock, Mail, Eye, EyeOff, LogIn } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';

import logoDwimitra from '@/assets/logo_dwimitra_v2.png';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Mohon isi semua field');
      return;
    }

    if (!turnstileToken) {
      toast.error('Mohon selesaikan verifikasi keamanan Turnstile terlebih dahulu');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success('Login berhasil!');
    } catch (error: any) {
      console.error('Login error:', error);

      let errorMessage = 'Login gagal. Silakan coba lagi.';

      if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Koneksi gagal. Jika kamu pakai VPN atau Adblocker, coba matikan dulu ya bray!';
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Email atau password salah';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Terlalu banyak percobaan login. Coba lagi nanti.';
      }

      toast.error(errorMessage);
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 h-screen h-[100dvh] w-screen font-geist text-slate-800 flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden touch-none select-none z-50">
      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-[92%] sm:w-full max-w-sm md:max-w-lg lg:max-w-xl relative z-10 mx-auto my-auto"
      >
        <div className="bg-white/70 backdrop-blur-2xl rounded-3xl md:rounded-[2rem] shadow-2xl shadow-sky-900/15 border border-white/90 overflow-hidden">
          <div className="h-1.5 md:h-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500" />

          <div className="p-5 sm:p-7 md:p-10">
            <div className="text-center mb-5 sm:mb-7 md:mb-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className="inline-flex items-center justify-center mb-2 md:mb-3"
              >
                <img
                  src={logoDwimitra}
                  alt="PT Dwimitra Ekatama Mandiri"
                  className="h-16 sm:h-24 md:h-32 w-auto object-contain drop-shadow-sm transition-all"
                />
              </motion.div>

              <h1 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                PT Dwimitra Ekatama Mandiri
              </h1>
              <p className="text-[11px] sm:text-xs md:text-sm text-slate-600 font-semibold mt-1">
                Data Center Maintenance System
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6">
              <div>
                <label htmlFor="email" className="block text-[11px] sm:text-xs md:text-sm font-bold text-slate-700 mb-1.5">
                  Alamat Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-500 group-focus-within:text-blue-600 transition z-10 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 sm:pl-11 md:pl-12 pr-4 py-2.5 sm:py-3 md:py-3.5 bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 focus:bg-white outline-none transition text-slate-900 placeholder-slate-400 text-xs sm:text-sm md:text-base font-medium shadow-sm"
                    placeholder="user@perusahaan.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-[11px] sm:text-xs md:text-sm font-bold text-slate-700 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-500 group-focus-within:text-blue-600 transition z-10 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 sm:pl-11 md:pl-12 pr-10 sm:pr-11 md:pr-12 py-2.5 sm:py-3 md:py-3.5 bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 focus:bg-white outline-none transition text-slate-900 placeholder-slate-400 text-xs sm:text-sm md:text-base font-medium shadow-sm"
                    placeholder="Masukkan kata sandi Anda"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition cursor-pointer p-1 z-10"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 md:w-5 md:h-5" />
                    ) : (
                      <Eye className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-1 pb-1 flex justify-center items-center cf-turnstile" data-action="turnstile-spin-v2">
                <Turnstile
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAD_fWrDH129FQ_Rm'}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken(null)}
                  onError={() => setTurnstileToken(null)}
                  options={{ action: 'turnstile-spin-v2', theme: 'light', size: 'normal' }}
                />
              </div>

              <motion.button
                whileHover={{ scale: turnstileToken && !loading ? 1.01 : 1 }}
                whileTap={{ scale: turnstileToken && !loading ? 0.98 : 1 }}
                type="submit"
                disabled={loading || !turnstileToken}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-2.5 sm:py-3 md:py-3.5 rounded-xl md:rounded-2xl font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 sm:mt-3 text-xs sm:text-sm md:text-base cursor-pointer"
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
