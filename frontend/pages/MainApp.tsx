// ============================================================================
// FILE: MainApp.tsx
// Deskripsi: Aplikasi Utama DwimitraSystem (Main Application Shell).
//            Menyediakan navigasi tab utama untuk Admin, Engineer, Standby Engineer,
//            dan User DME. Mengontrol routing internal antar modul:
//            - Dashboard Admin & Statistik
//            - Absensi TBM & Safety Induction
//            - Permit to Work (PTW) Management
//            - Manajemen File & Dokumen Laporan
//            - Corrective Maintenance (CM, SLA/SLG, PIR)
//            - Finding Management (Temuan & Arsip)
//            - Preventive Maintenance (PM) Schedule
//            - Pusat Notifikasi & Perintah Suara JARVIS AI
// ============================================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, FolderOpen, LogOut, Menu, Shield, Files, PenTool, Search, Clipboard, Calendar, CalendarDays, AlertTriangle, Database, FileSignature, ScanFace, Trash2, BookOpen, HardHat } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthContext';
import { ReportForm } from '@/components/ReportForm';
import { DocumentList } from '@/components/DocumentList';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { ExcelDocument } from '@/components/DocumentList';
import { CorrectiveMaintenance } from '@/components/CorrectiveMaintenance';
import { PIRManagement } from '@/components/PIRManagement';
import { FindingManagement } from '../components/FindingManagement';
import { FindingArchive } from '../components/FindingArchive';
import { Footer } from '@/components/Footer';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import { PTWManagement } from '@/components/PTWManagement';
import { AbsenTBM } from '@/components/AbsenTBM';
import { AbsenInduction } from '@/components/AbsenInduction';
import { PMSchedule } from '@/components/PMSchedule';
import { BOQMasterAsset } from '@/components/BOQMasterAsset';
import { MonthlyReportGenerator } from '@/components/MonthlyReportGenerator';
import { BeritaAcaraReport } from '@/components/BeritaAcaraReport';
import { NotificationCenter, AppNotificationItem } from '@/components/NotificationCenter';
import { NotificationPage } from '@/components/NotificationPage';
import { FaceRegistrationManagement } from '@/components/FaceRegistrationManagement';
import { DeleteRequestsManager } from '@/components/DeleteRequestsManager';
import { AbnormalFindingsCenter } from '@/components/AbnormalFindingsCenter';
import { SOPEOPManagement } from '@/components/SOPEOPManagement';
import { HSEArchiveHub } from '@/components/HSEArchiveHub';
import { AppSidebar } from '@/components/AppSidebar';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/api/firebase';

// Tipe Tab Navigasi yang Tersedia dalam Aplikasi
type Tab = 'notifications' | 'report' | 'documents' | 'arsip_dokumen' | 'pir' | 'admin' | 'files' | 'corrective' | 'findings' | 'finding_archive' | 'ptw' | 'corrective_archive' | 'absen_tbm' | 'absen_induction' | 'pm_schedule' | 'boq' | 'monthly_report' | 'berita_acara' | 'face_registration' | 'delete_requests' | 'abnormal_findings' | 'sop_eop' | 'hse_archive';

export function MainApp() {
  // State autentikasi & peranan user dari AuthContext
  const { user, userRole, isQcDme, logout } = useAuth();

  // Flag evaluasi hak akses peranan user
  const userEmailLower = (user?.email || '').toLowerCase();
  const isTargetQcDme = userEmailLower === 'qcdme@dme.com';
  const isDwimitra = userEmailLower === 'dwimitra@co.id' || isTargetQcDme || isQcDme;
  const canViewAbnormal = isQcDme || isDwimitra;
  const isAdmin = userRole === 'admin' || isQcDme;
  const isTDEorCBRE = userRole === 'tde' || userRole === 'cbre';
  const isStandby = userRole === 'standby_engineer';
  const isK2Engineer = userRole === 'Engineer_K2' || userRole === 'engineer_k2';

  // Badge jumlah pengajuan delete & temuan abnormal (khusus akun QC DME & Dwimitra)
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);
  const [totalAbnormalCount, setTotalAbnormalCount] = useState(0);

  useEffect(() => {
    if (!isQcDme && !isDwimitra) return;

    let isMounted = true;

    // Gunakan getCountFromServer (1 read per query) bukan onSnapshot yang men-download seluruh isi dokumen
    const fetchBadgeCounts = async () => {
      try {
        const [filesSnap, cmSnap, pdfSnap, excelSnap, hseSnap] = await Promise.allSettled([
          getCountFromServer(query(collection(db, 'files'), where('deleteRequested', '==', true))),
          getCountFromServer(query(collection(db, 'corrective_reports'), where('deleteRequested', '==', true))),
          getCountFromServer(query(collection(db, 'pdf_documents'), where('hasAbnormal', '==', true))),
          getCountFromServer(query(collection(db, 'excel_documents'), where('hasAbnormal', '==', true))),
          getCountFromServer(query(collection(db, 'hse'), where('hasAbnormal', '==', true))),
        ]);

        if (!isMounted) return;

        const cFiles = filesSnap.status === 'fulfilled' ? filesSnap.value.data().count : 0;
        const cCM = cmSnap.status === 'fulfilled' ? cmSnap.value.data().count : 0;
        const cPdf = pdfSnap.status === 'fulfilled' ? pdfSnap.value.data().count : 0;
        const cExcel = excelSnap.status === 'fulfilled' ? excelSnap.value.data().count : 0;
        const cHse = hseSnap.status === 'fulfilled' ? hseSnap.value.data().count : 0;

        setPendingDeleteCount(cFiles + cCM);
        setTotalAbnormalCount(cPdf + cExcel + cHse);
      } catch (err) {
        console.warn('[MainApp] Error fetching badge counts (quota/offline):', err);
      }
    };

    fetchBadgeCounts();

    // Refresh berkala setiap 5 menit (bukan listener realtime yang memboroskan kuota harian)
    const interval = setInterval(fetchBadgeCounts, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isQcDme, isDwimitra]);

  // State data laporan yang sedang disunting (edit mode)
  const [editingData, setEditingData] = useState<ExcelDocument | null>(null);

  // Daftar item navigasi aplikasi beserta batasan hak akses (fitur show)
  const navItems = [
    { id: 'admin', label: 'Dashboard', icon: Shield, color: 'from-purple-600 to-pink-600', show: isAdmin },
    { id: 'delete_requests', label: 'Pengajuan Hapus', icon: Trash2, color: 'from-rose-600 to-red-600', show: isQcDme },
    { id: 'abnormal_findings', label: 'Temuan Abnormal', icon: AlertTriangle, color: 'from-red-600 to-amber-600', show: canViewAbnormal },
    { id: 'face_registration', label: 'Registrasi Wajah', icon: ScanFace, color: 'from-blue-600 to-indigo-600', show: false },
    { id: 'absen_tbm', label: 'Absen TBM', icon: Calendar, color: 'from-pink-500 to-rose-600', show: isAdmin },
    { id: 'absen_induction', label: 'Absen Induction', icon: Calendar, color: 'from-blue-500 to-blue-600', show: isAdmin },
    { id: 'ptw', label: 'PTW', icon: Clipboard, color: 'from-indigo-600 to-blue-600', show: (isAdmin || userRole === 'engineer') && !isStandby && !isK2Engineer },
    { id: 'files', label: 'Manajemen File', icon: Files, color: 'from-orange-600 to-orange-700', show: false },
    { id: 'corrective', label: 'Corrective Maint.', icon: PenTool, color: 'from-red-600 to-red-700', show: userRole !== 'DME' && !isAdmin && userRole !== 'engineer' && !isK2Engineer },
    { id: 'corrective_archive', label: 'Arsip Standby', icon: FolderOpen, color: 'from-rose-600 to-rose-700', show: (userRole !== 'DME' && userRole !== 'engineer' && !isK2Engineer) || isDwimitra || userEmailLower === 'dwimitra@co.id' },
    { id: 'hse_archive', label: 'Arsip K3 & HSE', icon: HardHat, color: 'from-emerald-600 to-teal-600', show: isDwimitra || userRole === 'admin' || userRole === 'hse' },
    { id: 'findings', label: 'Temuan', icon: Search, color: 'from-amber-500 to-orange-600', show: !isAdmin && userRole !== 'DME' && !isK2Engineer && !isStandby },
    { id: 'finding_archive', label: 'Arsip Temuan', icon: FolderOpen, color: 'from-teal-600 to-teal-700', show: !isAdmin && userRole !== 'DME' && !isK2Engineer },
    { id: 'report', label: userRole === 'DME' ? 'Detail Laporan' : 'Buat Laporan', icon: FileText, color: 'from-blue-600 to-blue-700', show: !isAdmin && !isStandby && (userRole !== 'DME' || !!editingData) },
    { id: 'arsip_dokumen', label: 'Arsip Dokumen', icon: FolderOpen, color: 'from-emerald-600 to-emerald-700', show: !isAdmin && !isStandby && userRole !== 'DME' && userRole !== 'site_manager_dme' },
    { id: 'documents', label: 'Management File', icon: FolderOpen, color: 'from-emerald-600 to-emerald-700', show: true },
    { id: 'pir', label: 'Report PIR', icon: AlertTriangle, color: 'from-amber-600 to-red-600', show: !isAdmin && isK2Engineer && !isStandby },
    { id: 'pm_schedule', label: 'PM Schedule', icon: CalendarDays, color: 'from-blue-600 to-indigo-700', show: !isAdmin && userRole === 'DME' && !isK2Engineer },
    { id: 'monthly_report', label: 'Monthly Report (1-Klik)', icon: FileText, color: 'from-blue-600 to-indigo-700', show: !isAdmin && (userRole === 'DME' || userRole === 'site_manager_dme' || user?.email?.toLowerCase() === 'dwimitra@co.id') && !isStandby && !isK2Engineer },
    { id: 'sop_eop', label: 'SOP & EOP', icon: BookOpen, color: 'from-amber-600 to-orange-700', show: isDwimitra },
    { id: 'boq', label: 'Master Asset & BOQ', icon: Database, color: 'from-cyan-600 to-blue-700', show: (userRole === 'DME' || userRole === 'site_manager_dme' || isAdmin || isDwimitra || !!user?.email?.toLowerCase().includes('dme')) && !isK2Engineer },
    { id: 'berita_acara', label: 'BA Report', icon: FileSignature, color: 'from-violet-600 to-purple-700', show: isAdmin || userRole === 'DME' || userRole === 'site_manager_dme' || user?.email?.toLowerCase() === 'dwimitra@co.id' },
  ] as const;

  // Menentukan tab awal default berdasarkan peranan user saat pertama kali dibuka
  const getDefaultTab = (): Tab => {
    if (isAdmin) return 'admin';
    if (isStandby) return 'corrective';
    if (userRole === 'DME') return 'documents';
    return 'report';
  };

  const [activeTab, setActiveTab] = useState<Tab>(getDefaultTab());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState('');
  const [navTargetFolder, setNavTargetFolder] = useState<string | null>(null);

  // Handler saat notifikasi diklik: Otomatis berpindah tab dan memicu pencarian dokumen
  const handleSelectNotification = (item: AppNotificationItem) => {
    const isBatch = /\d+\s+berkas\s+baru/i.test(item.fileName || '') ||
                    (item.fileName || '').toLowerCase().includes('berkas baru');
    const managementFoldersList = [
      'D-DAY', 'Laporan Harian', 'Layout', 'MOP', 'Monthly', 'Predictive Report',
      'Risk Register', 'JSEA', 'Report CM', 'Form SLA/SLG', 'Report PIR',
      'Laporan Temuan', 'SLD', 'Service Report', 'Service Report Approved'
    ];

    const isManagementFolder = Boolean(item.category && managementFoldersList.includes(item.category));

    if (item.targetTab === 'files' || isManagementFolder) {
      setActiveTab('documents');
      if (isManagementFolder) {
        setNavTargetFolder(item.category);
      } else {
        setNavTargetFolder(null);
      }
    } else if (item.targetTab) {
      setActiveTab(item.targetTab as Tab);
      setNavTargetFolder(null);
    }

    if (isBatch) {
      // Untuk unggah massal, jangan jadikan nama ringkasan "22 berkas baru (JSEA)" sebagai query pencarian file
      setNavSearchQuery('');
    } else {
      const rawQuery = item.searchQuery || item.fileName || item.title || '';
      const queryToUse = rawQuery
        .replace(/\.pdf$/i, '')
        .replace(/\.xlsx$/i, '')
        .replace(/^dokumentasi maintenance\s*/i, '')
        .replace(/^laporan service:\s*/i, '')
        .trim();

      if (isManagementFolder && queryToUse.toLowerCase() === item.category.toLowerCase()) {
        setNavSearchQuery('');
      } else {
        setNavSearchQuery(queryToUse);
      }
    }

    toast.info(`Membuka: ${item.fileName || item.title}`);
  };

  // Integration Event Listener: JARVIS Autonomous Voice Command Agent
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

  // Handler untuk mengedit laporan
  const handleEditReport = (doc: ExcelDocument) => {
    setEditingData(doc);
    setActiveTab('report');
  };

  // Handler untuk membersihkan data edit (kembali ke tab arsip dokumen)
  const clearEditingData = () => {
    setEditingData(null);
    // Engineer kembali ke Arsip Dokumen, role lain kembali ke Management File
    const isEngineerRole = !isAdmin && !isStandby && userRole !== 'DME' && userRole !== 'site_manager_dme';
    setActiveTab(isEngineerRole ? 'arsip_dokumen' : 'documents');
  };

  // Komponen pembantu untuk merender konten tab aktif
  const renderTabContent = () => (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="flex-1 flex flex-col w-full min-w-0 max-w-full"
      >
        {activeTab === 'notifications' && userRole !== 'admin' ? (
          <NotificationPage onSelectNotification={handleSelectNotification} />
        ) : activeTab === 'admin' ? (
          <AdminDashboard onEdit={handleEditReport} />
        ) : activeTab === 'delete_requests' ? (
          <DeleteRequestsManager />
        ) : activeTab === 'abnormal_findings' ? (
          <AbnormalFindingsCenter onNavigateToDocument={(query) => {
            setNavSearchQuery(query);
            setActiveTab('documents');
          }} />
        ) : activeTab === 'absen_tbm' ? (
          <AbsenTBM />
        ) : activeTab === 'absen_induction' ? (
          <AbsenInduction />
        ) : activeTab === 'ptw' ? (
          <PTWManagement initialSearchQuery={navSearchQuery} />
        ) : activeTab === 'files' ? (
          <DocumentList onEdit={handleEditReport} initialSearchQuery={navSearchQuery} initialFolder={navTargetFolder} />
        ) : activeTab === 'arsip_dokumen' ? (
          <DocumentList viewMode="flat" onEdit={handleEditReport} initialSearchQuery={navSearchQuery} />
        ) : activeTab === 'report' ? (
          <ReportForm
            editingData={editingData}
            onClearEdit={clearEditingData}
          />
        ) : activeTab === 'pir' ? (
          <PIRManagement />
        ) : activeTab === 'corrective' ? (
          <CorrectiveMaintenance readOnly={isTDEorCBRE} initialSearchQuery={navSearchQuery} />
        ) : activeTab === 'corrective_archive' ? (
          <CorrectiveMaintenance readOnly={true} initialSearchQuery={navSearchQuery} />
        ) : activeTab === 'hse_archive' ? (
          <HSEArchiveHub onEdit={handleEditReport} initialSearchQuery={navSearchQuery} />
        ) : activeTab === 'findings' ? (
          <FindingManagement />
        ) : activeTab === 'finding_archive' ? (
          <FindingArchive />
        ) : activeTab === 'boq' ? (
          <BOQMasterAsset />
        ) : activeTab === 'monthly_report' ? (
          <MonthlyReportGenerator />
        ) : activeTab === 'sop_eop' ? (
          isDwimitra ? (
            <SOPEOPManagement />
          ) : (
            <DocumentList onEdit={handleEditReport} initialSearchQuery={navSearchQuery} initialFolder={navTargetFolder} />
          )
        ) : activeTab === 'pm_schedule' ? (
          <PMSchedule />
        ) : activeTab === 'berita_acara' ? (
          <BeritaAcaraReport />
        ) : activeTab === 'face_registration' ? (
          <FaceRegistrationManagement />
        ) : (
          <DocumentList onEdit={handleEditReport} initialSearchQuery={navSearchQuery} initialFolder={navTargetFolder} />
        )}
      </motion.div>
    </AnimatePresence>
  );

  // ─── TAMPILAN UNIVERSAL SEMUA ROLE: SIDEBAR DI SAMPING KIRI + TOP BAR BERSIH ──
  const currentNavItem = navItems.find((i) => i.id === activeTab);

  return (
    <div className="flex flex-col w-full min-h-screen">
      {/* Sidebar Navigasi Kiri Pinned Fixed (Desktop) & Drawer (Mobile) */}
      <AppSidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        navItems={navItems as any}
        pendingDeleteCount={pendingDeleteCount}
        totalAbnormalCount={totalAbnormalCount}
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogoutClick={() => setLogoutModalOpen(true)}
      />

      {/* Area Konten Utama Kanan: Menyesuaikan padding-left dinamis sesuai lebar sidebar fixed */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-80'
        }`}
      >
        {/* Top Bar Bersih & Konsisten untuk Semua Role */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-sky-100/80 shadow-xs px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 md:hidden bg-slate-100 text-slate-700 rounded-xl border border-slate-200 shadow-sm cursor-pointer"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {currentNavItem?.label || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {userRole !== 'engineer' && !isStandby && userRole !== 'admin' && (
              <NotificationCenter
                onSelectNotification={handleSelectNotification}
                onOpenNotificationPage={() => setActiveTab('notifications')}
              />
            )}

            <div className="hidden sm:block text-right">
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
        </header>

        {/* Konten Utama Aplikasi (Render Dinamis Berdasarkan activeTab) */}
        <main className="flex-1 flex flex-col relative w-full min-w-0 overflow-x-hidden">
          {renderTabContent()}
        </main>

        {/* Footer Aplikasi */}
        <Footer />
      </div>

      {/* Modal Konfirmasi Log Out Sesi */}
      <LogoutConfirmModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={logout}
        userEmail={user?.email || ''}
      />
    </div>
  );
}
