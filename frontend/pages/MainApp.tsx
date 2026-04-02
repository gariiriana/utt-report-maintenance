import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, FolderOpen, LogOut, Menu, X, Shield, Files, PenTool } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { ReportForm } from '@/components/ReportForm';
import { DocumentList } from '@/components/DocumentList';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { ExcelDocument } from '@/components/DocumentList'; 
import { FileManagement } from '@/components/FileManagement';
import { CorrectiveMaintenance } from '@/components/CorrectiveMaintenance';
import { Footer } from '@/components/Footer';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal'; 
import { InventoryBorrowing } from '@/components/InventoryBorrowing'; 
import logoUTT from '@/assets/logo_utt.png';

type Tab = 'report' | 'documents' | 'admin' | 'files' | 'corrective' | 'inventory';

export function MainApp() {
  const { user, userRole, logout } = useAuth();

  const isAdmin = userRole === 'admin';
  const isTDEorCBRE = userRole === 'tde' || userRole === 'cbre';

  const getDefaultTab = (): Tab => {
    if (isAdmin) return 'admin';
    return 'report'; 
  };

  const [activeTab, setActiveTab] = useState<Tab>(getDefaultTab());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const [editingData, setEditingData] = useState<ExcelDocument | null>(null);

  const handleEditReport = (doc: ExcelDocument) => {
    setEditingData(doc);
    setActiveTab('report');
  };

  const clearEditingData = () => {
    setEditingData(null);
  };


  return (
    <div className="min-h-screen flex flex-col">

      <div className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <img
                src={logoUTT}
                alt="PT United Transworld Trading"
                className="w-14 h-14 sm:w-20 sm:h-20 flex-shrink-0 object-contain"
              />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-semibold text-white truncate">
                  PT United Transworld Trading
                </h1>
                <p className="text-xs text-slate-400 hidden sm:block">Sistem Pemeliharaan Data Center</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-slate-500">Logged as</p>
                <p className="text-sm font-medium text-slate-300 truncate max-w-[200px]">{user?.email}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setLogoutModalOpen(true)} // ✅ NEW: Open logout modal
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg border border-slate-700/50 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </motion.button>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 bg-slate-800/50 text-slate-300 rounded-lg border border-slate-700/50"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.button>
          </div>

          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden overflow-hidden"
              >
                <div className="pt-4 pb-2 space-y-3 border-t border-slate-700/50 mt-3">
                  <div className="px-3 py-2 bg-slate-800/30 rounded-lg">
                    <p className="text-xs text-slate-500">Logged as</p>
                    <p className="text-sm font-medium text-slate-300 truncate">{user?.email}</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setLogoutModalOpen(true)} 
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg border border-red-500/20 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar</span>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-xl border-b border-slate-700/30 sticky top-[65px] sm:top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex gap-2 overflow-x-auto">
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('admin')}
                className={`flex-initial flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'admin'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                  }`}
              >
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Dashboard Admin</span>
                <span className="sm:hidden">Admin</span>
              </motion.button>
            )}



            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('files')}
              className={`flex-initial flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'files'
                ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg shadow-orange-500/25'
                : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
            >
              <Files className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Manajemen File</span>
              <span className="sm:hidden">File</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('corrective')}
              className={`flex-initial flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'corrective'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/25'
                : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
            >
              <PenTool className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Corrective Maint.</span>
              <span className="sm:hidden">CM</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('inventory')}
              className={`flex-initial flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'inventory'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
            >
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Peminjaman Alat</span>
              <span className="sm:hidden">Pinjam</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('report')}
              className={`flex-initial flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'report'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
                : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
            >
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Buat Laporan</span>
              <span className="sm:hidden">Buat</span>
            </motion.button>

            {!isAdmin && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('documents')}
                className={`flex-initial flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'documents'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                  }`}
              >
                <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Arsip Dokumen</span>
                <span className="sm:hidden">Arsip</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10">
        {activeTab === 'admin' ? (
          <AdminDashboard onEdit={handleEditReport} />
        ) : activeTab === 'files' ? (
          <FileManagement />
        ) : activeTab === 'report' ? (
          <ReportForm editingData={editingData} onClearEdit={clearEditingData} />
        ) : activeTab === 'corrective' ? (
          <CorrectiveMaintenance readOnly={isTDEorCBRE} />
        ) : activeTab === 'inventory' ? (
          <InventoryBorrowing />
        ) : (
          <DocumentList onEdit={handleEditReport} />
        )}
      </div>

      <Footer />

      <LogoutConfirmModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={logout}
        userEmail={user?.email || ''}
      />
    </div>
  );
}