// ============================================================================
// FILE: frontend/pages/DMEDashboard.tsx
// Deskripsi: Halaman Dashboard utama untuk role Site Manager DME.
//            Navigasi lewat sidebar kiri (AppSidebar) yang sama dengan role lain:
//            MOP Workflow (Kanban Board), Monitoring, Arsip Standby, dsb.
// ============================================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LogOut, ShieldCheck, FileText, BarChart3,
  FolderOpen, Sparkles, BookOpen, Languages, Menu
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { AppSidebar, NavItemDef } from '@/components/AppSidebar';
import { MOPWorkflow } from '@/components/MOPWorkflow';
import { MOPMonitoringDashboard } from '@/components/MOPMonitoringDashboard';
import { DocumentList, ExcelDocument } from '@/components/DocumentList';
import { ReportForm } from '@/components/ReportForm';
import { MonthlyReportGenerator } from '@/components/MonthlyReportGenerator';
import { CorrectiveMaintenance } from '@/components/CorrectiveMaintenance';
import { SOPEOPManagement } from '@/components/SOPEOPManagement';
import { MOPBilingual } from '@/components/MOPBilingual';
import { canUseMOPBilingual } from '@/utils/mopBilingualAccess';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import { NotificationCenter } from '@/components/NotificationCenter';
import { Footer } from '@/components/Footer';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import { toast } from 'sonner';
import {
  collection, onSnapshot, query, orderBy
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import type { MOPWorkflowDoc } from '@/types/mopTypes';

// ─── TAB DEFINITIONS ──────────────────────────────────────────────────────────

type DMETab = 'workflow' | 'monitoring' | 'monthly_report' | 'corrective_archive' | 'documents' | 'sop_eop' | 'mop_bilingual';

// Urutan di sini menentukan urutan menu di dalam tiap kelompok sidebar (MENU_SECTIONS di AppSidebar).
const TAB_ITEMS: { id: DMETab; label: string; icon: typeof FileText; color: string }[] = [
  { id: 'monitoring', label: 'Monitoring', icon: BarChart3, color: 'from-emerald-500 to-teal-500' },
  { id: 'corrective_archive', label: 'Arsip Standby', icon: FolderOpen, color: 'from-rose-600 to-rose-700' },
  { id: 'monthly_report', label: 'Monthly Report (1-Klik)', icon: Sparkles, color: 'from-blue-600 to-indigo-600' },
  { id: 'documents', label: 'Management File', icon: FolderOpen, color: 'from-amber-500 to-orange-500' },
  { id: 'workflow', label: 'MOP Workflow', icon: FileText, color: 'from-blue-500 to-sky-500' },
  { id: 'sop_eop', label: 'SOP & EOP', icon: BookOpen, color: 'from-amber-600 to-orange-700' },
  { id: 'mop_bilingual', label: 'Bilingual MOP', icon: Languages, color: 'from-teal-600 to-cyan-700' },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function DMEDashboard() {
  const { user, isQcDme, logout } = useAuth();
  const userEmailLower = (user?.email || '').toLowerCase();
  const isDwimitra = userEmailLower === 'dwimitra@co.id' || userEmailLower === 'qcdme@dme.com' || isQcDme;
  const canViewMOPBilingual = canUseMOPBilingual(userEmailLower, isQcDme);
  const navItems: NavItemDef[] = TAB_ITEMS.map(tab => ({
    ...tab,
    show: (tab.id !== 'sop_eop' || isDwimitra) && (tab.id !== 'mop_bilingual' || canViewMOPBilingual),
  }));
  const [activeTab, setActiveTab] = useState<DMETab>('workflow');
  const [editingData, setEditingData] = useState<ExcelDocument | null>(null);
  const [highlightedDocId, setHighlightedDocId] = useState<string | null>(null);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const currentNavItem = navItems.find(item => item.id === activeTab);
  const [mopList, setMopList] = useState<MOPWorkflowDoc[]>([]);

  // Global MOP listener for monitoring dashboard
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'mop_workflows'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: MOPWorkflowDoc[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        remarks: doc.data().remarks || [],
      })) as MOPWorkflowDoc[];
      setMopList(docs);
    }, (err) => {
      console.warn('MOP listener note:', err);
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Berhasil logout');
    } catch {
      toast.error('Gagal logout');
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen">
      {/* ─── Sidebar Kiri (Desktop) & Drawer (Mobile), sama dengan role lain ──── */}
      <AppSidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={(tab: DMETab) => {
          setActiveTab(tab);
          setEditingData(null);
        }}
        navItems={navItems}
        pendingDeleteCount={0}
        totalAbnormalCount={0}
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogoutClick={() => setLogoutModalOpen(true)}
      />

      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-80'
        }`}
      >
        {/* ─── Top Bar ─────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-sky-100/80 shadow-xs px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile: Logo + Nama Perusahaan */}
            <div className="md:hidden flex items-center gap-2 min-w-0">
              <img
                src={logoDwimitra}
                alt="PT Dwimitra Ekatama Mandiri"
                className="w-7 h-7 object-contain shrink-0"
              />
              <div className="min-w-0">
                <h2 className="text-[11.5px] font-bold text-slate-900 leading-tight whitespace-nowrap overflow-hidden text-ellipsis tracking-tight">
                  PT Dwimitra Ekatama Mandiri
                </h2>
                <p className="text-[9.5px] text-slate-500 font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis mt-0.5">
                  Sistem Pemeliharaan Data Center
                </p>
              </div>
            </div>

            {/* Desktop: Judul Halaman + Badge Role */}
            <div className="hidden md:flex items-center gap-2.5 min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate">
                {currentNavItem?.label || 'Dashboard'}
              </h1>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded-full border border-blue-200 shrink-0">
                <ShieldCheck className="w-3 h-3 text-blue-600" />
                <span className="text-[10px] font-bold text-blue-700 uppercase">Site Manager DME</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <NotificationCenter onSelectNotification={() => { }} />

            <div className="hidden md:block text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Masuk sebagai</p>
              <p className="text-sm font-semibold text-slate-700 truncate max-w-[260px]">{user?.email}</p>
            </div>

            {/* Logout desktop (di mobile ada di dalam drawer sidebar) */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setLogoutModalOpen(true)}
              className="hidden md:flex p-2.5 bg-slate-100 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-all shadow-sm cursor-pointer"
              title="Keluar Sesi"
            >
              <LogOut className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 md:hidden bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-xl border border-slate-200 shadow-sm cursor-pointer"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </motion.button>
          </div>
        </header>

        {/* ─── Main Content ────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col relative w-full min-w-0 overflow-x-hidden">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <AnimatePresence mode="wait">
              {activeTab === 'monthly_report' && (
                <motion.div
                  key="monthly_report"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <MonthlyReportGenerator />
                </motion.div>
              )}

              {activeTab === 'sop_eop' && isDwimitra && (
                <motion.div
                  key="sop_eop"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <SOPEOPManagement />
                </motion.div>
              )}

              {activeTab === 'mop_bilingual' && canViewMOPBilingual && (
                <motion.div
                  key="mop_bilingual"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <MOPBilingual />
                </motion.div>
              )}


              {activeTab === 'corrective_archive' && (
                <motion.div
                  key="corrective_archive"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <CorrectiveMaintenance readOnly={true} />
                </motion.div>
              )}

              {activeTab === 'workflow' && (
                <motion.div
                  key="workflow"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <MOPWorkflow />
                </motion.div>
              )}

              {activeTab === 'monitoring' && (
                <motion.div
                  key="monitoring"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <MOPMonitoringDashboard mops={mopList} />
                </motion.div>
              )}

              {activeTab === 'documents' && (
                <motion.div
                  key={editingData ? 'report-detail' : 'documents'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {editingData ? (
                    <ReportForm
                      editingData={editingData}
                      onClearEdit={(savedDocId) => {
                        if (savedDocId) setHighlightedDocId(savedDocId);
                        setEditingData(null);
                      }}
                    />
                  ) : (
                    <DocumentList
                      onEdit={(doc) => setEditingData(doc)}
                      highlightedDocId={highlightedDocId}
                      onClearHighlight={() => setHighlightedDocId(null)}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* ─── Footer ──────────────────────────────────────────────────────────── */}
        <Footer />
      </div>

      {/* ─── Logout Modal ────────────────────────────────────────────────────── */}
      <LogoutConfirmModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
        userEmail={user?.email || ''}
      />
    </div>
  );
}

export default DMEDashboard;
