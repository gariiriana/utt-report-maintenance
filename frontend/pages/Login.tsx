import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/components/AuthContext';
import { toast } from 'sonner';
import { Lock, Mail, Eye, EyeOff, LogIn } from 'lucide-react';

import logoUTT from '@/assets/logo_utt.png';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Mohon isi semua field');
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-geist text-slate-200 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-slate-900/5 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-white/5">
          <div className="h-1 bg-gradient-to-r from-indigo-600/50 via-indigo-500/50 to-purple-500/50" />

          <div className="p-6 sm:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="inline-flex items-center justify-center mb-2 sm:mb-3"
              >
                <img
                  src={logoUTT}
                  alt="PT United Transworld Trading"
                  className="w-40 h-40 sm:w-56 sm:h-56 object-contain"
                  fetchPriority="high"
                />
              </motion.div>

              <h1 className="text-lg sm:text-2xl font-semibold text-white sm:mb-2 tracking-tight">
                PT United Transworld Trading
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-light">Data Center Maintenance System</p>

            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Alamat Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] sm:w-5 sm:h-5 text-slate-500 group-focus-within:text-indigo-400 transition" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-slate-800/20 border border-slate-700/30 rounded-lg focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 outline-none transition text-white placeholder-slate-500 text-[15px] sm:text-base"
                    placeholder="user@perusahaan.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Kata Sandi
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] sm:w-5 sm:h-5 text-slate-500 group-focus-within:text-indigo-400 transition" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 sm:pl-12 pr-11 sm:pr-12 py-3 sm:py-3.5 bg-slate-800/20 border border-slate-700/30 rounded-lg focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 outline-none transition text-white placeholder-slate-500 text-[15px] sm:text-base"
                    placeholder="Masukkan kata sandi Anda"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                    ) : (
                      <Eye className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                    )}
                  </button>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3 sm:py-3.5 rounded-lg font-medium shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 text-[15px] sm:text-base"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sedang Masuk...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn className="w-[18px] h-[18px]" />
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
