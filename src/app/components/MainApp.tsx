import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, FolderOpen, LogOut, Menu, X, Shield, Files, PenTool, CheckCircle } from 'lucide-react';
import { useAuth } from './AuthContext';
import { ReportForm } from './ReportForm';
import { DocumentList } from './DocumentList';
import { AdminDashboard } from './AdminDashboard';
import { FileManagement } from './FileManagement';
import { CorrectiveMaintenance } from './CorrectiveMaintenance';
import { ServiceReport } from './ServiceReport';
import { NotificationCenter } from './NotificationCenter';
import { Footer } from './Footer';
import { LogoutConfirmModal } from './LogoutConfirmModal'; // ✅ NEW: Import logout modal
import { DataCenterBackground } from './DataCenterBackground'; // ✅ NEW: Import data center animations
import logoUTT from '@/assets/232afb9a46e8d280b1d1b9dca62e90c6882e64e6.png';

type Tab = 'report' | 'documents' | 'admin' | 'files' | 'corrective' | 'service';

export function MainApp() {
  const { user, userRole, logout } = useAuth();

  // ✅ Check if user is admin based on role from Firestore
  const isAdmin = userRole === 'admin';
  const isTDEorCBRE = userRole === 'tde' || userRole === 'cbre';

  const [activeTab, setActiveTab] = useState<Tab>(isAdmin ? 'admin' : isTDEorCBRE ? 'service' : 'report');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ✅ NEW: State untuk logout confirmation modal
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  // ✅ NEW: State untuk navigasi otomatis dari notifikasi
  const [notificationNav, setNotificationNav] = useState<{ type: string; quarter: string; year: string } | null>(null);

  const handleNotificationClick = (type: string, quarter: string, year: string) => {
    setNotificationNav({ type, quarter, year });
    setActiveTab('service');
    setMobileMenuOpen(false);
  };

  // ✅ NEW: Force correct initial tab when role is loaded
  useEffect(() => {
    if (isAdmin && activeTab === 'report') {
      setActiveTab('admin');
    } else if (isTDEorCBRE && (activeTab === 'report' || activeTab === 'admin')) {
      setActiveTab('service');
    }
  }, [isAdmin, isTDEorCBRE, userRole]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* ✅ NEW: Data Center Background dengan animasi lengkap */}
      <DataCenterBackground />

      {/* Header - Navbar Atas */}
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
                <p className="text-xs text-slate-400 hidden sm:block">Data Center Maintenance System</p>
              </div>
            </div>

            {/* Desktop User Info & Logout */}
            <div className="hidden md:flex items-center gap-4">
              {isTDEorCBRE && <NotificationCenter onNotificationClick={handleNotificationClick} />}
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
                <span>Logout</span>
              </motion.button>
            </div>

            {/* Mobile Notification + Menu Button */}
            <div className="md:hidden flex items-center gap-2">
              {isTDEorCBRE && <NotificationCenter onNotificationClick={handleNotificationClick} />}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 bg-slate-800/50 text-slate-300 rounded-lg border border-slate-700/50"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </motion.button>
            </div>
          </div>

          {/* Mobile Dropdown Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden overflow-hidden"
              >
                <div className="pt-4 pb-2 space-y-4 border-t border-slate-700/50 mt-3">
                  <div className="flex items-center px-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500">Logged as</p>
                        <p className="text-sm font-medium text-slate-300 truncate max-w-[150px]">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setLogoutModalOpen(true)} // ✅ NEW: Open logout modal
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg border border-red-500/20 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation Tabs - Di Bawah Navbar Atas */}
      <div className="bg-slate-900/40 backdrop-blur-xl border-b border-slate-700/30 sticky top-[65px] sm:top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex gap-2 overflow-x-auto">
            {/* ✅ Admin Dashboard - HANYA untuk admin */}
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('admin')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'admin'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                  }`}
              >
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Admin Dashboard</span>
                <span className="sm:hidden">Admin</span>
              </motion.button>
            )}

            {/* ✅ Service Report - Admin, TDE, CBRE */}
            {(isAdmin || isTDEorCBRE) && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('service')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'service'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                  }`}
              >
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Service Report</span>
                <span className="sm:hidden">Service</span>
              </motion.button>
            )}

            {/* ✅ File Management - Everyone */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('files')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'files'
                ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg shadow-orange-500/25'
                : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
            >
              <Files className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">File Management</span>
              <span className="sm:hidden">Files</span>
            </motion.button>

            {/* ✅ Corrective Maintenance - Everyone */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('corrective')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'corrective'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/25'
                : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
            >
              <PenTool className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Corrective Maint.</span>
              <span className="sm:hidden">CM</span>
            </motion.button>

            {/* ✅ Create Report - HANYA untuk non-admin (Engineers) */}
            {(!isAdmin && !isTDEorCBRE) && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('report')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'report'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                  }`}
              >
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Create Report</span>
                <span className="sm:hidden">Create</span>
              </motion.button>
            )}

            {/* ✅ Document Archive - HANYA untuk non-admin (Engineers) */}
            {(!isAdmin && !isTDEorCBRE) && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('documents')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base whitespace-nowrap ${activeTab === 'documents'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                  }`}
              >
                <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Document Archive</span>
                <span className="sm:hidden">Docs</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Content area that grows to push footer down */}
      <div className="relative z-10 flex-1">
        {activeTab === 'admin' ? (
          <AdminDashboard />
        ) : activeTab === 'files' ? (
          <FileManagement />
        ) : activeTab === 'report' ? (
          <ReportForm />
        ) : activeTab === 'corrective' ? (
          <CorrectiveMaintenance />
        ) : activeTab === 'service' ? (
          <ServiceReport
            initialNav={notificationNav}
            onNavConsumed={() => setNotificationNav(null)}
          />
        ) : (
          <DocumentList />
        )}
      </div>

      {/* Footer */}
      <Footer />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={logout}
        userEmail={user?.email || ''}
      />
    </div>
  );
}