import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  documentName: string;
  loading?: boolean;
}

export function DeleteConfirmModal({ isOpen, onClose, onConfirm, documentName, loading }: DeleteConfirmModalProps) {
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-red-500/30 max-w-md w-full relative overflow-hidden shadow-2xl"
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition"
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
                    className="absolute inset-0 bg-red-500/30 rounded-full blur-xl"
                  />
                  <div className="relative p-4 bg-red-500/10 rounded-full border border-red-500/30">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                  </div>
                </div>
              </div>

              <div className="text-center mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                  Hapus Dokumen?
                </h3>
                <p className="text-slate-400 text-sm sm:text-base mb-2">
                  Anda yakin ingin menghapus dokumen ini?
                </p>
                <p className="text-white font-semibold text-sm sm:text-base bg-slate-800/50 rounded-lg px-4 py-2 mt-3 border border-slate-700/50">
                  {documentName}
                </p>
                <p className="text-red-400 text-xs sm:text-sm mt-3">
                  ⚠️ Tindakan ini tidak dapat dibatalkan
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  onClick={onClose}
                  disabled={loading}
                  className={`px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-lg font-semibold transition border border-slate-600/50 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  disabled={loading}
                  onClick={() => {
                    onConfirm();
                  }}
                  className={`px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-semibold transition shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {loading && (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  )}
                  {loading ? 'Deleting...' : 'Delete'}
                </motion.button>
              </div>

              <div className="absolute inset-0 pointer-events-none opacity-5">
                <div className="absolute inset-0 red-grid-bg" />
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

