import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, FolderOpen, LogOut, Menu, X, Shield, Files, PenTool, Search, Clipboard, Calendar, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
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
import { PTWManagement } from '@/components/PTWManagement';
import { AbsenTBM } from '@/components/AbsenTBM';
import { AbsenInduction } from '@/components/AbsenInduction';
import { PMSchedule } from '@/components/PMSchedule';
import { NotificationCenter, AppNotificationItem } from '@/components/NotificationCenter';
import { NotificationPage } from '@/components/NotificationPage';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';

type Tab = 'notifications' | 'report' | 'documents' | 'admin' | 'files' | 'corrective' | 'findings' | 'finding_archive' | 'ptw' | 'corrective_archive' | 'absen_tbm' | 'absen_induction' | 'pm_schedule';

export function MainApp() {
  const { user, userRole, logout } = useAuth();

  const isAdmin = userRole === 'admin';
  const isTDEorCBRE = userRole === 'tde' || userRole === 'cbre';
  const isStandby = userRole === 'standby_engineer';

  const [editingData, setEditingData] = useState<ExcelDocument | null>(null);

  const navItems = [
    { id: 'admin', label: 'Dashboard', icon: Shield, color: 'from-purple-600 to-pink-600', show: isAdmin },
    { id: 'absen_tbm', label: 'Absen TBM', icon: Calendar, color: 'from-pink-500 to-rose-600', show: isAdmin },
    { id: 'absen_induction', label: 'Absen Induction', icon: Calendar, color: 'from-blue-500 to-blue-600', show: isAdmin },
    { id: 'ptw', label: 'PTW', icon: Clipboard, color: 'from-indigo-600 to-blue-600', show: (isAdmin || userRole === 'engineer') && !isStandby },
    { id: 'files', label: 'Manajemen File', icon: Files, color: 'from-orange-600 to-orange-700', show: !isStandby && userRole !== 'DME' },
    { id: 'corrective', label: 'Corrective Maint.', icon: PenTool, color: 'from-red-600 to-red-700', show: userRole !== 'DME' && !isAdmin && userRole !== 'engineer' },
    { id: 'corrective_archive', label: 'Arsip Standby', icon: FolderOpen, color: 'from-rose-600 to-rose-700', show: userRole !== 'DME' },
    { id: 'findings', label: 'Temuan', icon: Search, color: 'from-amber-500 to-orange-600', show: userRole === 'engineer' || isStandby || isAdmin },
    { id: 'finding_archive', label: 'Arsip Temuan', icon: FolderOpen, color: 'from-teal-600 to-teal-700', show: userRole !== 'DME' },
    { id: 'report', label: userRole === 'DME' ? 'Detail Laporan' : 'Buat Laporan', icon: FileText, color: 'from-blue-600 to-blue-700', show: !isStandby && (userRole !== 'DME' || !!editingData) },
    { id: 'documents', label: 'Arsip Dokumen', icon: FolderOpen, color: 'from-emerald-600 to-emerald-700', show: !isStandby },
    { id: 'pm_schedule', label: 'PM Schedule', icon: CalendarDays, color: 'from-indigo-500 to-purple-600', show: userRole === 'DME' || isAdmin },
  ] as const;

  const getDefaultTab = (): Tab => {
    if (isAdmin) return 'admin';
    if (isStandby) return 'corrective';
    if (userRole === 'DME') return 'documents';
    return 'report';
  };

  const [activeTab, setActiveTab] = useState<Tab>(getDefaultTab());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState('');

  const handleSelectNotification = (item: AppNotificationItem) => {
    if (item.targetTab) {
      setActiveTab(item.targetTab as Tab);
    }
    const rawQuery = item.fileName || item.searchQuery || item.title || '';
    const queryToUse = rawQuery
      .replace(/\.pdf$/i, '')
      .replace(/\.xlsx$/i, '')
      .replace(/^dokumentasi maintenance\s*/i, '')
      .replace(/^laporan service:\s*/i, '')
      .trim();

    setNavSearchQuery(queryToUse);
    toast.info(`Membuka: ${item.fileName || item.title}`);
  };

  // JARVIS Autonomous Voice Command Listener
  useEffect(() => {
    const handleVoiceCommand = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { action, page, report_id } = customEvent.detail || {};

      if (action === 'navigate' && page) {
        setActiveTab(page as Tab);
      } else if (action === 'create_report') {
        setEditingData(null);
        setActiveTab('report');
      } else if (action === 'open_report' && report_id) {
        setActiveTab('documents');
      }
    };

    window.addEventListener('voice-agent-command', handleVoiceCommand);
    return () => window.removeEventListener('voice-agent-command', handleVoiceCommand);
  }, []);

  const handleEditReport = (doc: ExcelDocument) => {
    setEditingData(doc);
    setActiveTab('report');
  };

  const clearEditingData = () => {
    setEditingData(null);
    if (userRole === 'DME') {
      setActiveTab('documents');
    }
  };


  return (
    <div className="min-h-screen flex flex-col">
      {}
      <div className="bg-white/80 backdrop-blur-xl border-b border-sky-100/80 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={logoDwimitra}
                alt="PT Dwimitra Ekatama Mandiri"
                className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 object-contain"
              />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold text-slate-900 truncate">
                  PT Dwimitra Ekatama Mandiri
                </h1>
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Sistem Pemeliharaan Data Center</p>
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              <NotificationCenter 
                onSelectNotification={handleSelectNotification} 
                onOpenNotificationPage={() => setActiveTab('notifications')}
              />
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Masuk sebagai</p>
                <p className="text-sm font-semibold text-slate-700 truncate max-w-[260px]">{user?.email}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLogoutModalOpen(true)}
                className="p-2.5 bg-slate-100 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-all shadow-sm cursor-pointer"
                title="Keluar Sesi"
              >
                <LogOut className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <NotificationCenter 
                onSelectNotification={handleSelectNotification} 
                onOpenNotificationPage={() => setActiveTab('notifications')}
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setMobileMenuOpen(true)}
                className="p-2.5 bg-slate-100 text-slate-700 rounded-xl border border-slate-200 shadow-sm cursor-pointer"
              >
                <Menu className="w-6 h-6" />
              </motion.button>
            </div>
          </div>
        </div>
        {/* Desktop Secondary Navigation (Tabs) */}
      <div className="hidden md:block bg-sky-50/60 backdrop-blur-md border-t border-sky-100/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-center gap-1 xl:gap-1.5">
            {navItems.filter(i => i.show).map((item) => (
              <motion.button
                key={item.id}
                whileHover={{ y: -1, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(item.id as Tab)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] xl:text-xs font-bold transition-all whitespace-nowrap border rounded-xl cursor-pointer ${activeTab === item.id
                  ? `bg-gradient-to-r ${item.color} text-white border-transparent shadow-md shadow-blue-500/20`
                  : 'bg-white/80 text-slate-600 border-slate-200/80 hover:bg-white hover:text-slate-900 shadow-sm'
                  }`}
              >
                <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{item.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[280px] bg-white/95 backdrop-blur-xl border-l border-sky-100 z-[70] md:hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-200">
                <span className="font-bold text-slate-900">Menu Navigasi</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-500 hover:text-slate-900" title="Tutup Menu">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="mb-6 p-4 bg-sky-50/80 rounded-2xl border border-sky-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Terhubung sebagai</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{user?.email}</p>
                </div>

                {navItems.filter(i => i.show).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as Tab);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-bold transition-all border ${activeTab === item.id
                      ? `bg-gradient-to-r ${item.color} text-white border-transparent shadow-md shadow-blue-500/20`
                      : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-white hover:text-slate-900'
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
            {activeTab === 'notifications' ? (
              <NotificationPage onSelectNotification={handleSelectNotification} />
            ) : activeTab === 'admin' ? (
              <AdminDashboard onEdit={handleEditReport} />
            ) : activeTab === 'absen_tbm' ? (
              <AbsenTBM />
            ) : activeTab === 'absen_induction' ? (
              <AbsenInduction />
            ) : activeTab === 'ptw' ? (
              <PTWManagement initialSearchQuery={navSearchQuery} />
            ) : activeTab === 'files' ? (
              <FileManagement initialSearchQuery={navSearchQuery} />
            ) : activeTab === 'report' ? (
              <ReportForm 
                editingData={editingData} 
                onClearEdit={clearEditingData} 
              />
            ) : activeTab === 'corrective' ? (
              <CorrectiveMaintenance readOnly={isTDEorCBRE} initialSearchQuery={navSearchQuery} />
            ) : activeTab === 'corrective_archive' ? (
              <CorrectiveMaintenance readOnly={true} initialSearchQuery={navSearchQuery} />
            ) : activeTab === 'findings' ? (
              <FindingManagement />
            ) : activeTab === 'finding_archive' ? (
              <FindingArchive />
            ) : activeTab === 'pm_schedule' ? (
              <PMSchedule />
            ) : (
              <DocumentList onEdit={handleEditReport} initialSearchQuery={navSearchQuery} />
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
