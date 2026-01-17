import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, FolderOpen, LogOut, Menu, X, Shield } from 'lucide-react';
import { useAuth } from './AuthContext';
import { ReportForm } from './ReportForm';
import { DocumentList } from './DocumentList';
import { AdminDashboard } from './AdminDashboard';
import { Footer } from './Footer';
import { LogoutConfirmModal } from './LogoutConfirmModal'; // ✅ NEW: Import logout modal
import { DataCenterBackground } from './DataCenterBackground'; // ✅ NEW: Import data center animations
import logoUTT from '@/assets/232afb9a46e8d280b1d1b9dca62e90c6882e64e6.png';

type Tab = 'report' | 'documents' | 'admin';

export function MainApp() {
  const { user, userRole, logout } = useAuth();
  
  // ✅ Check if user is admin based on role from Firestore
  const isAdmin = userRole === 'admin';
  
  const [activeTab, setActiveTab] = useState<Tab>(isAdmin ? 'admin' : 'report');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // ✅ NEW: State untuk logout confirmation modal
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  // ✅ REMOVED: useEffect yang force admin ke tab 'admin' - admin harus bisa switch tab!

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
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
                <span>Logout</span>
              </motion.button>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 bg-slate-800/50 text-slate-300 rounded-lg border border-slate-700/50"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.button>
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
                <div className="pt-4 pb-2 space-y-3 border-t border-slate-700/50 mt-3">
                  <div className="px-3 py-2 bg-slate-800/30 rounded-lg">
                    <p className="text-xs text-slate-500">Logged as</p>
                    <p className="text-sm font-medium text-slate-300 truncate">{user?.email}</p>
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
          <div className="flex gap-2">
            {/* ✅ Admin Dashboard - HANYA untuk admin */}
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('admin')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
              >
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Admin Dashboard</span>
                <span className="sm:hidden">Admin</span>
              </motion.button>
            )}
            
            {/* ✅ Create Report - SEMUA user bisa akses */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('report')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base ${
                activeTab === 'report'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
              }`}
            >
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Create Report</span>
              <span className="sm:hidden">Create</span>
            </motion.button>

            {/* ✅ Document Archive - SEMUA user bisa akses */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('documents')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-all text-xs sm:text-base ${
                activeTab === 'documents'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-800/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
              }`}
            >
              <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Document Archive</span>
              <span className="sm:hidden">Docs</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {activeTab === 'admin' ? (
          <AdminDashboard />
        ) : activeTab === 'report' ? (
          <ReportForm />
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