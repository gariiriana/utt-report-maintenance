// ============================================================================
// FILE: frontend/pages/DMEDashboard.tsx
// Deskripsi: Halaman Dashboard utama untuk role Site Manager DME.
//            Menyediakan navigasi tab antara: MOP Workflow (Kanban Board),
//            Monitoring Dashboard (Charts & Stats), dan Arsip Dokumen.
// ============================================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LogOut, ShieldCheck, UserCircle, FileText, BarChart3,
  FolderOpen
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { MOPWorkflow } from '@/components/MOPWorkflow';
import { MOPMonitoringDashboard } from '@/components/MOPMonitoringDashboard';
import { DocumentList } from '@/components/DocumentList';
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

type DMETab = 'workflow' | 'monitoring' | 'documents';

const TAB_ITEMS: { id: DMETab; label: string; icon: typeof FileText; color: string }[] = [
  { id: 'workflow', label: 'MOP Workflow', icon: FileText, color: 'from-blue-500 to-sky-500' },
  { id: 'monitoring', label: 'Monitoring', icon: BarChart3, color: 'from-emerald-500 to-teal-500' },
  { id: 'documents', label: 'Arsip Dokumen', icon: FolderOpen, color: 'from-amber-500 to-orange-500' },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function DMEDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<DMETab>('workflow');
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [mopList, setMopList] = useState<MOPWorkflowDoc[]>([]);

  // Global MOP listener for monitoring dashboard
  useEffect(() => {
    const q = query(collection(db, 'mop_workflows'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: MOPWorkflowDoc[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        remarks: doc.data().remarks || [],
      })) as MOPWorkflowDoc[];
      setMopList(docs);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Berhasil logout');
    } catch {
      toast.error('Gagal logout');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Navbar ──────────────────────────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-sky-100/80 sticky top-0 z-50 shadow-sm text-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Role Badge */}
            <div className="flex items-center gap-3">
              <img
                src={logoDwimitra}
                alt="PT Dwimitra Ekatama Mandiri"
                className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 object-contain"
              />
              <div>
                <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                  PT Dwimitra Ekatama Mandiri
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded-full border border-blue-200">
                    <ShieldCheck className="w-3 h-3 text-blue-600" />
                    <span className="text-[10px] font-bold text-blue-700 uppercase">Site Manager DME</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <NotificationCenter onSelectNotification={() => {}} />

              {/* User Info */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                <UserCircle className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-600 max-w-[120px] truncate">{user?.email}</span>
              </div>

              {/* Logout */}
              <button
                onClick={() => setLogoutModalOpen(true)}
                className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ─── Tab Navigation ────────────────────────────────────────────── */}
          <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
            {TAB_ITEMS.map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-lg shadow-blue-500/10`
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Main Content ────────────────────────────────────────────────────── */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <AnimatePresence mode="wait">
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
                key="documents"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <DocumentList />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Footer ──────────────────────────────────────────────────────────── */}
      <Footer />

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
