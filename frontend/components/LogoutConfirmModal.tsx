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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-sky-100 max-w-md w-full relative overflow-hidden shadow-2xl text-slate-800"
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center justify-center mb-6">
                <div className="relative">
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
                    className="absolute inset-0 bg-rose-500/20 rounded-full blur-xl"
                  />
                  <div className="relative p-4 bg-rose-50 rounded-full border border-rose-200">
                    <LogOut className="w-8 h-8 text-rose-600" />
                  </div>
                </div>
              </div>

              <div className="text-center mb-8">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                  Keluar dari Akun?
                </h3>
                <p className="text-slate-600 text-sm sm:text-base mb-2">
                  Anda yakin ingin keluar dari akun ini?
                </p>
                <p className="text-slate-900 font-bold text-sm sm:text-base bg-slate-50 rounded-xl px-4 py-2 mt-3 border border-slate-200 truncate">
                  {userEmail}
                </p>
                <p className="text-amber-700 font-medium text-xs sm:text-sm mt-3">
                  💡 Anda harus masuk kembali untuk mengakses aplikasi
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition border border-slate-200 shadow-sm"
                >
                  Batal
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl font-bold transition shadow-lg shadow-rose-500/25"
                >
                  Keluar
                </motion.button>
              </div>

              <div className="absolute inset-0 pointer-events-none opacity-5">
                <div className="absolute inset-0 orange-grid-bg" />
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

