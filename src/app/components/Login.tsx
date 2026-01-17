import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { DataCenterBackground } from './DataCenterBackground';
import { Lock, Mail, Eye, EyeOff, LogIn, X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import logoUTT from '@/assets/232afb9a46e8d280b1d1b9dca62e90c6882e64e6.png';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);
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
      toast.error(error.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast.error('Mohon isi email');
      return;
    }

    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success('Email reset password telah dikirim! Cek inbox Anda.');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error: any) {
      toast.error(error.message || 'Gagal mengirim email reset password');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-4 sm:p-6 relative overflow-hidden">
      <DataCenterBackground />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-slate-900/40 backdrop-blur-2xl rounded-xl sm:rounded-2xl shadow-2xl border border-indigo-500/20 overflow-hidden">
          {/* Header with accent bar */}
          <div className="h-1 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500" />
          
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
                />
              </motion.div>
              
              <h1 className="text-lg sm:text-2xl font-semibold text-white sm:mb-2 tracking-tight">
                PT United Transworld Trading
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-light">Data Center Maintenance System</p>
              
              {/* Status Indicator */}
              <div className="flex items-center justify-center gap-2 mt-3 sm:mt-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium">System Online</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] sm:w-5 sm:h-5 text-slate-500 group-focus-within:text-indigo-400 transition" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition text-white placeholder-slate-500 text-[15px] sm:text-base"
                    placeholder="user@company.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] sm:w-5 sm:h-5 text-slate-500 group-focus-within:text-indigo-400 transition" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 sm:pl-12 pr-11 sm:pr-12 py-3 sm:py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition text-white placeholder-slate-500 text-[15px] sm:text-base"
                    placeholder="Enter your password"
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
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs sm:text-sm text-indigo-400 hover:text-indigo-300 transition font-medium"
                  >
                    Forgot Password?
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
                    Signing In...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn className="w-[18px] h-[18px]" />
                    Sign In
                  </span>
                )}
              </motion.button>
            </form>
          </div>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl rounded-xl border border-indigo-500/30 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="h-1 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500" />
            
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Reset Password</h2>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail('');
                  }}
                  className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-slate-400 mb-6">
                Masukkan email Anda dan kami akan mengirimkan link untuk reset password ke inbox email Anda.
              </p>

              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label htmlFor="resetEmail" className="block text-sm font-medium text-slate-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition" />
                    <input
                      id="resetEmail"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition text-white placeholder-slate-500"
                      placeholder="user@company.com"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmail('');
                    }}
                    className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingReset}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingReset ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </span>
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}