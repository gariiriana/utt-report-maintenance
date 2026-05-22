import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, FolderOpen, LogOut, Menu, X, Shield, Files, PenTool, Search, Clipboard } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { ReportForm } from '@/components/ReportForm';
import { DocumentList } from '@/components/DocumentList';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { ExcelDocument } from '@/components/DocumentList';
import { FileManagement } from '@/components/FileManagement';
import { CorrectiveMaintenance } from '@/components/CorrectiveMaintenance';
import { FindingManagement } from '../components/FindingManagement';
import { FindingArchive } from '../components/FindingArchive';
import { Footer } from '@/components/Footer';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import { InventoryBorrowing } from '@/components/InventoryBorrowing';
import { PTWManagement } from '@/components/PTWManagement';
import logoUTT from '@/assets/logo_utt.png';

type Tab = 'report' | 'documents' | 'admin' | 'files' | 'corrective' | 'inventory' | 'findings' | 'finding_archive' | 'ptw';

export function MainApp() {
  const { user, userRole, logout } = useAuth();

  const isAdmin = userRole === 'admin';
  const isTDEorCBRE = userRole === 'tde' || userRole === 'cbre';

  const navItems = [
    { id: 'admin', label: 'Dashboard Admin', icon: Shield, color: 'from-purple-600 to-pink-600', show: isAdmin },
    { id: 'ptw', label: 'PTW', icon: Clipboard, color: 'from-indigo-600 to-blue-600', show: isAdmin || userRole === 'engineer' || userRole === 'standby_engineer' },
    { id: 'files', label: 'Manajemen File', icon: Files, color: 'from-orange-600 to-orange-700', show: true },
    { id: 'corrective', label: 'Corrective Maint.', icon: PenTool, color: 'from-red-600 to-red-700', show: true },
    { id: 'inventory', label: 'Peminjaman Alat', icon: Shield, color: 'from-indigo-600 to-indigo-700', show: true },
    { id: 'findings', label: 'Temuan', icon: Search, color: 'from-amber-500 to-orange-600', show: userRole === 'engineer' || userRole === 'standby_engineer' || isAdmin },
    { id: 'finding_archive', label: 'Arsip Temuan', icon: FolderOpen, color: 'from-teal-600 to-teal-700', show: true },
    { id: 'report', label: 'Buat Laporan', icon: FileText, color: 'from-blue-600 to-blue-700', show: true },
    { id: 'documents', label: 'Arsip Dokumen', icon: FolderOpen, color: 'from-emerald-600 to-emerald-700', show: !isAdmin },
  ] as const;

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
      {}
      <div className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={logoUTT}
                alt="PT UTT"
                className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 object-contain"
              />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold text-white truncate">
                  PT United Transworld Trading
                </h1>
                <p className="text-[10px] sm:text-xs text-slate-400">Sistem Pemeliharaan Data Center</p>
              </div>
            </div>

            {}
            <div className="hidden md:flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Logged as</p>
                <p className="text-sm font-medium text-slate-300 truncate max-w-[180px]">{user?.email}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLogoutModalOpen(true)}
                className="p-2.5 bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl border border-slate-700/50 transition-all"
              >
                <LogOut className="w-5 h-5" />
              </motion.button>
            </div>

            {}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2.5 bg-slate-800 text-slate-300 rounded-xl border border-slate-700/50"
            >
              <Menu className="w-6 h-6" />
            </motion.button>
          </div>
        </div>
        {/* Desktop Secondary Navigation (Tabs) */}
      <div className="hidden md:block bg-slate-900/30 backdrop-blur-md border-b border-slate-800/50 sticky top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {navItems.filter(i => i.show).map((item) => (
              <motion.button
                key={item.id}
                whileHover={{ y: -1, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(item.id as Tab)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs lg:text-sm font-bold transition-all whitespace-nowrap border ${activeTab === item.id
                  ? `bg-gradient-to-r ${item.color} text-white border-transparent shadow-lg shadow-black/20`
                  : 'bg-slate-800/40 text-slate-400 border-slate-700/30 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
      </div>

      {}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[280px] bg-slate-900 border-l border-slate-800 z-[70] md:hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-800">
                <span className="font-bold text-white">Menu Navigasi</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white" title="Tutup Menu">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="mb-6 p-4 bg-slate-800/30 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Terhubung sebagai</p>
                  <p className="text-sm font-medium text-slate-300 truncate">{user?.email}</p>
                </div>

                {navItems.filter(i => i.show).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as Tab);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-bold transition-all border ${activeTab === item.id
                      ? `bg-gradient-to-r ${item.color} text-white border-transparent shadow-lg shadow-black/20`
                      : 'bg-slate-800/30 text-slate-400 border-slate-800/50 hover:bg-slate-800/60'
                      }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="p-4 border-t border-slate-800">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLogoutModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl border border-red-500/20 font-bold transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Keluar Sesi</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {}
      <main className="flex-1 relative w-full min-w-0 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'admin' ? (
              <AdminDashboard onEdit={handleEditReport} />
            ) : activeTab === 'ptw' ? (
              <PTWManagement />
            ) : activeTab === 'files' ? (
              <FileManagement />
            ) : activeTab === 'report' ? (
              <ReportForm editingData={editingData} onClearEdit={clearEditingData} />
            ) : activeTab === 'corrective' ? (
              <CorrectiveMaintenance readOnly={isTDEorCBRE} />
            ) : activeTab === 'inventory' ? (
              <InventoryBorrowing />
            ) : activeTab === 'findings' ? (
              <FindingManagement />
            ) : activeTab === 'finding_archive' ? (
              <FindingArchive />
            ) : (
              <DocumentList onEdit={handleEditReport} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

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
