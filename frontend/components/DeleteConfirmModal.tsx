import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, Check, Ban } from 'lucide-react';
import { toast } from 'sonner';

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
  requireReason?: boolean;
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
  requireReason = false,
}: DeleteConfirmModalProps) {
  
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
    }
  }, [isOpen]);

  const isPendingApproval = isRequested && isAdmin;
  const isRequesterReviewing = isRequested && !isAdmin;

  // Determine Modal Title
  const getModalTitle = () => {
    if (isPendingApproval) return 'Persetujuan Hapus Dokumen';
    if (isRequesterReviewing) return 'Batalkan Pengajuan Hapus?';
    if (isAdmin) return 'Hapus Dokumen Permanen?';
    return 'Ajukan Hapus Dokumen?';
  };

  // Determine Modal Description
  const getModalDescription = () => {
    if (isPendingApproval) {
      return (
        <div className="space-y-1 mb-2">
          <p className="text-slate-600 text-sm">Dokumen ini diajukan untuk dihapus oleh:</p>
          <p className="text-amber-800 font-bold text-xs bg-amber-50 border border-amber-200 py-1 px-3 rounded-lg inline-block">{requestedBy || 'Standby Engineer'}</p>
        </div>
      );
    }
    if (isRequesterReviewing) {
      return (
        <div className="space-y-1 mb-2">
          <p className="text-slate-600 text-sm">Dokumen ini sedang menunggu persetujuan hapus oleh QC DME.</p>
          <p className="text-amber-800 font-bold text-xs bg-amber-50 border border-amber-200 py-1 px-3 rounded-lg inline-block">Diajukan oleh: {requestedBy || 'Standby Engineer'}</p>
          <p className="text-slate-500 text-xs mt-1">Anda dapat membatalkan pengajuan hapus ini jika dokumen masih dibutuhkan.</p>
        </div>
      );
    }
    if (isAdmin) return 'Anda yakin ingin menghapus dokumen ini secara permanen?';
    return 'Dokumen ini akan diajukan ke QC DME untuk proses penghapusan. Lanjutkan?';
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
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className={`bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border ${isRequested ? 'border-amber-200' : 'border-rose-200'} max-w-md w-full relative overflow-hidden shadow-2xl text-slate-800`}
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
                    className={`absolute inset-0 ${isRequested ? 'bg-amber-500/20' : 'bg-rose-500/20'} rounded-full blur-xl`}
                  />
                  <div className={`relative p-4 ${isRequested ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'} rounded-full border`}>
                    <AlertTriangle className={`w-8 h-8 ${isRequested ? 'text-amber-600' : 'text-rose-600'}`} />
                  </div>
                </div>
              </div>

              <div className="text-center mb-6">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                  {getModalTitle()}
                </h3>
                <div className="text-slate-600 text-sm sm:text-base mb-2">
                  {getModalDescription()}
                </div>
                <p className="text-slate-900 font-bold text-sm sm:text-base bg-slate-50 rounded-xl px-4 py-2 mt-3 border border-slate-200 truncate">
                  {documentName}
                </p>

                {/* Show reason description if document is requested for deletion */}
                {isRequested && deleteReason && (
                  <div className="mt-4 text-left bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">Alasan / Remark Penghapusan:</p>
                    <p className="text-slate-700 text-sm font-medium italic">"{deleteReason}"</p>
                  </div>
                )}

                {/* Show reason input for engineer requesting delete (initial request only) */}
                {!isAdmin && !isRequested && (
                  <div className="mt-4 text-left">
                    <label htmlFor="delete-reason" className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                      <span>Alasan / Remark Hapus</span>
                      {requireReason ? (
                        <span className="text-rose-600 font-bold lowercase text-[11px]">* (wajib diisi)</span>
                      ) : (
                        <span className="text-slate-400 font-normal lowercase text-[11px]">(opsional)</span>
                      )}
                    </label>
                    <textarea
                      id="delete-reason"
                      className={`w-full bg-slate-50 border ${requireReason && !reason.trim() ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-amber-500'} rounded-xl p-2.5 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 text-sm h-20 resize-none placeholder-slate-400 transition-all`}
                      placeholder={requireReason ? "Wajib menyertakan remark/alasan penghapusan (misal: Data report duplikat, salah tanggal, dll)..." : "Contoh: Salah upload unit, data report duplikat, dll..."}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                )}

                <p className="text-rose-600 font-medium text-xs sm:text-sm mt-4">
                  {isPendingApproval 
                    ? '⚠️ Menyetujui tindakan ini akan menghapus dokumen secara permanen' 
                    : isRequesterReviewing
                      ? 'ℹ️ Klik "Batalkan Pengajuan" untuk mengembalikan status dokumen menjadi normal'
                      : '⚠️ Tindakan ini akan mengirim permohonan ke Admin'}
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
                    className="w-full py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl font-bold transition shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 cursor-pointer"
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
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 border border-amber-200 cursor-pointer"
                  >
                    <Ban className="w-4 h-4" />
                    Tolak Pengajuan (Batal Hapus)
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    onClick={onClose}
                    disabled={loading}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition border border-slate-200 shadow-sm cursor-pointer"
                  >
                    Tutup
                  </motion.button>
                </div>
              ) : isRequesterReviewing ? (
                // 2 Button Layout for Standby Engineer reviewing requested document (Can cancel request)
                <div className="flex flex-col sm:flex-row gap-3">
                  <motion.button
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition border border-slate-200 shadow-sm cursor-pointer"
                  >
                    Tutup
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    disabled={loading}
                    onClick={onRejectRequest}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading && (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    )}
                    <Ban className="w-4 h-4" />
                    Batalkan Pengajuan
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
                    className={`px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition border border-slate-200 shadow-sm cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Batal
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    disabled={loading}
                    onClick={() => {
                      if (!isAdmin && requireReason && !reason.trim()) {
                        toast.error('Wajib menyertakan remark/alasan sebelum mengajukan hapus dokumen!');
                        return;
                      }
                      onConfirm(reason);
                    }}
                    className={`px-6 py-3 bg-gradient-to-r ${isAdmin ? 'from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-rose-500/25' : 'from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20'} text-white rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 cursor-pointer ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {loading && (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    )}
                    {loading 
                      ? isAdmin 
                        ? 'Menghapus...' 
                        : 'Mengajukan...' 
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
