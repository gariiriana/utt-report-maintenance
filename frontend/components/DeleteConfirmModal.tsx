import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, Check, Ban } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  onRejectRequest?: () => void;
  documentName: string;
  loading?: boolean;
  isRequested?: boolean;
  requestedBy?: string;
  isAdmin?: boolean;
  deleteReason?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  onRejectRequest,
  documentName,
  loading,
  isRequested = false,
  requestedBy = '',
  isAdmin = false,
  deleteReason = '',
}: DeleteConfirmModalProps) {
  
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
    }
  }, [isOpen]);

  const isPendingApproval = isRequested && isAdmin;

  // Determine Modal Title
  const getModalTitle = () => {
    if (isPendingApproval) return 'Persetujuan Hapus Dokumen';
    if (isAdmin) return 'Hapus Dokumen Permanen?';
    return 'Ajukan Hapus Dokumen?';
  };

  // Determine Modal Description
  const getModalDescription = () => {
    if (isPendingApproval) {
      return (
        <div className="space-y-1 mb-2">
          <p className="text-slate-400 text-sm">Dokumen ini diajukan untuk dihapus oleh:</p>
          <p className="text-amber-400 font-bold text-sm bg-amber-500/10 border border-amber-500/20 py-1 px-3 rounded-lg inline-block">{requestedBy}</p>
        </div>
      );
    }
    if (isAdmin) return 'Anda yakin ingin menghapus dokumen ini secara permanen?';
    return 'Dokumen ini akan diajukan ke admin untuk proses penghapusan. Lanjutkan?';
  };

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
              className={`bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border ${isPendingApproval ? 'border-amber-500/30' : 'border-red-500/30'} max-w-md w-full relative overflow-hidden shadow-2xl`}
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
                    className={`absolute inset-0 ${isPendingApproval ? 'bg-amber-500/30' : 'bg-red-500/30'} rounded-full blur-xl`}
                  />
                  <div className={`relative p-4 ${isPendingApproval ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'} rounded-full border`}>
                    <AlertTriangle className={`w-8 h-8 ${isPendingApproval ? 'text-amber-400' : 'text-red-400'}`} />
                  </div>
                </div>
              </div>

              <div className="text-center mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                  {getModalTitle()}
                </h3>
                <div className="text-slate-400 text-sm sm:text-base mb-2">
                  {getModalDescription()}
                </div>
                <p className="text-white font-semibold text-sm sm:text-base bg-slate-800/50 rounded-lg px-4 py-2 mt-3 border border-slate-700/50 truncate">
                  {documentName}
                </p>

                {/* Show reason description if admin is reviewing request */}
                {isPendingApproval && deleteReason && (
                  <div className="mt-4 text-left bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Alasan Penghapusan:</p>
                    <p className="text-slate-300 text-sm font-medium italic">"{deleteReason}"</p>
                  </div>
                )}

                {/* Show reason input for engineer requesting delete */}
                {!isAdmin && (
                  <div className="mt-4 text-left">
                    <label htmlFor="delete-reason" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Alasan Hapus (Opsional)
                    </label>
                    <textarea
                      id="delete-reason"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-amber-500 text-sm h-20 resize-none placeholder-slate-600 focus:border-amber-500 transition-all"
                      placeholder="Contoh: Salah upload unit, data report duplikat, dll..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                )}

                <p className="text-red-400 text-xs sm:text-sm mt-4">
                  {isPendingApproval ? '⚠️ Menyetujui tindakan ini tidak dapat dibatalkan' : '⚠️ Tindakan ini tidak dapat dibatalkan'}
                </p>
              </div>

              {isPendingApproval ? (
                // 3 Button Layout for Admin approving pending request
                <div className="flex flex-col gap-2.5">
                  <motion.button
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    disabled={loading}
                    onClick={() => onConfirm()}
                    className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-semibold transition shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                  >
                    {loading && (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    )}
                    <Check className="w-4 h-4" />
                    Setujui Hapus (Hapus Permanen)
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    disabled={loading}
                    onClick={onRejectRequest}
                    className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-lg font-semibold transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 border border-amber-500/30"
                  >
                    <Ban className="w-4 h-4" />
                    Tolak Pengajuan (Batal Hapus)
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    onClick={onClose}
                    disabled={loading}
                    className="w-full py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-lg font-semibold transition border border-slate-600/50"
                  >
                    Batal
                  </motion.button>
                </div>
              ) : (
                // 2 Button Layout for Standard Confirm/Cancel (Admin or Request)
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
                    onClick={() => onConfirm(reason)}
                    className={`px-6 py-3 bg-gradient-to-r ${isAdmin ? 'from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-red-500/20' : 'from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-amber-500/20'} text-white rounded-lg font-semibold transition shadow-lg flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {loading && (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    )}
                    {loading 
                      ? isAdmin 
                        ? 'Deleting...' 
                        : 'Requesting...' 
                      : isAdmin 
                        ? 'Hapus Permanen' 
                        : 'Ajukan Hapus'
                    }
                  </motion.button>
                </div>
              )}

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
