import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, X } from 'lucide-react';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userEmail: string;
}

export function LogoutConfirmModal({ isOpen, onClose, onConfirm, userEmail }: LogoutConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4"
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-orange-500/30 max-w-md w-full relative overflow-hidden shadow-2xl"
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Icon */}
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  {/* Pulsing background */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.2, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute inset-0 bg-orange-500/30 rounded-full blur-xl"
                  />
                  <div className="relative p-4 bg-orange-500/10 rounded-full border border-orange-500/30">
                    <LogOut className="w-8 h-8 text-orange-400" />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="text-center mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                  Keluar dari Akun?
                </h3>
                <p className="text-slate-400 text-sm sm:text-base mb-2">
                  Anda yakin ingin keluar dari akun ini?
                </p>
                <p className="text-white font-semibold text-sm sm:text-base bg-slate-800/50 rounded-lg px-4 py-2 mt-3 border border-slate-700/50 truncate">
                  {userEmail}
                </p>
                <p className="text-orange-400 text-xs sm:text-sm mt-3">
                  💡 Anda harus login kembali untuk mengakses aplikasi
                </p>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-lg font-semibold transition border border-slate-600/50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-lg font-semibold transition shadow-lg shadow-orange-500/20"
                >
                  Logout
                </motion.button>
              </div>

              {/* Decorative grid lines */}
              <div className="absolute inset-0 pointer-events-none opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: `
                    linear-gradient(rgba(251, 146, 60, 0.5) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(251, 146, 60, 0.5) 1px, transparent 1px)
                  `,
                  backgroundSize: '20px 20px'
                }} />
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
