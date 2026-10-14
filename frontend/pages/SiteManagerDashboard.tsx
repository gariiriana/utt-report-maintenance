// ============================================================================
// FILE: SiteManagerDashboard.tsx
// Deskripsi: Dasbor Utama Site Manager (PT UTT / PT Dwimitra Ekatama Mandiri).
//            Menyajikan visualisasi statistik grafik (Donut Chart capai pemeliharaan),
//            pemantauan real-time progress PM (Preventive Maintenance),
//            input data aktivitas harian, serta kontrol ekspor ringkasan laporan.
//            Navigasi lewat sidebar kiri (AppSidebar) yang sama dengan role lain.
// ============================================================================

import { useMenuNavigation } from '@/hooks/useAppNavigation';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  Save,
  Loader2,
  LayoutDashboard,
  Search,
  Database,
  Plus,
  Trash2,
  Download,
  LogOut,
  Menu,
  ShieldCheck,
  FolderOpen,
  CalendarDays
} from 'lucide-react';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import { useAuth } from '@/components/AuthContext';
import { AppSidebar, MenuSection, NavItemDef } from '@/components/AppSidebar';
import { DocumentList } from '@/components/DocumentList';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import { Footer } from '@/components/Footer';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { addDocQueued, toastWriteSuccess, deleteDocQueued, commitBatchQueued, updateDocQueued } from '@/utils/offlineWrite';
import { toast } from 'sonner';
import {
  calculateMaintenanceSummary,
  type MaintenanceProgress,
  type MaintenanceSummary
} from '@/utils/MaintenanceLogic';

type SiteManagerTab = 'summary' | 'input' | 'documents';

const SITE_MANAGER_NAV_ITEMS: readonly NavItemDef[] = [
  { id: 'summary', label: 'Ringkasan Progres', icon: LayoutDashboard, color: 'from-blue-600 to-indigo-600', show: true },
  { id: 'input', label: 'Input Data Progres', icon: Database, color: 'from-indigo-600 to-violet-600', show: true },
  { id: 'documents', label: 'Management File', icon: FolderOpen, color: 'from-amber-500 to-orange-600', show: true },
];

const SITE_MANAGER_MENU_SECTIONS: readonly MenuSection[] = [
  { title: 'Progres Pemeliharaan', itemIds: ['summary', 'input'] },
  { title: 'Dokumentasi & Laporan', itemIds: ['documents'] },
];

// Input terang yang dipakai di modal tambah perangkat
const MODAL_INPUT_CLASS = 'w-full bg-white border border-slate-200 rounded-xl p-3 md:p-3.5 text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all';

/**
 * Komponen grafik lingkaran (Donut Chart) statistik capaian pemeliharaan.
 * Menggunakan animasi SVG lingkaran bertingkat dengan gradient warna.
 */
function StatDonut({ label, percent, sublabel, color, delay = 0, glowColor }: {
  label: string;
  percent: number;
  sublabel?: string;
  color: string;
  glowColor: string;
  delay?: number;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  const uniqueId = label.toLowerCase().replace(/\s+/g, '-');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center p-3 md:p-6 rounded-3xl md:rounded-[2.5rem] bg-white/90 border border-sky-100/90 shadow-md backdrop-blur-xl hover:border-blue-300 transition-all duration-500 group relative overflow-hidden text-slate-800"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />

      <div className="relative w-20 h-20 md:w-32 md:h-32 flex items-center justify-center mb-3 md:mb-5">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          <defs>
            <linearGradient id={`gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={glowColor} stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-200"
            strokeWidth="5"
          />
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={`url(#gradient-${uniqueId})`}
            strokeWidth="6"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ delay: delay + 0.4, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            style={{
              strokeDasharray: circumference
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-baseline">
            <span className="text-sm md:text-3xl font-black text-slate-900 tracking-tighter">
              {label === 'Harian' && percent > 0 ? '+' : ''}{percent.toFixed(2)}
            </span>
            <span className="text-[8px] md:text-sm font-bold text-slate-500 ml-0.5">%</span>
          </div>
          {sublabel && (
            <span className="hidden md:block text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-widest leading-none">
              {sublabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-[9px] md:text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] md:tracking-[0.3em] group-hover:text-slate-900 transition-colors duration-300">
          {label}
        </p>
        <div className="h-0.5 w-4 rounded-full bg-slate-300 group-hover:w-8 group-hover:bg-blue-600 transition-all duration-500" />
      </div>
    </motion.div>
  );
}

export function SiteManagerDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useMenuNavigation<SiteManagerTab>('summary', SITE_MANAGER_NAV_ITEMS.map(item => item.id));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [summary, setSummary] = useState<MaintenanceSummary | null>(null);
  const [activities, setActivities] = useState<MaintenanceProgress[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProgress, setNewProgress] = useState({
    category: '',
    equipment_name: '',
    plan_qty: 0,
    plan_start: '',
    plan_finish: '',
    actual_qty: 0,
    remark: ''
  });
  const currentNavItem = SITE_MANAGER_NAV_ITEMS.find(item => item.id === activeTab);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'maintenance_progress'),
      where('year', '==', selectedYear),
      where('quarter', '==', selectedQuarter)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: MaintenanceProgress[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        data.push({
          id: doc.id,
          ...docData,
          remark: docData.remark || '',
          yesterday_qty: docData.yesterday_qty || 0
        } as MaintenanceProgress);
      });

      setActivities(data);
      const computedSummary = calculateMaintenanceSummary(data);
      setSummary(computedSummary);
      setLoading(false);
    }, (error) => {
      console.error('Firestore Error:', error);
      toast.error('Gagal mengambil data dari Firestore');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedYear, selectedQuarter]);

  // Catatan: dulu ada sinkronisasi otomatis "data Excel 31 Mar 2026" yang menghapus & menulis ulang
  // seluruh data Q1 setiap kali dasbor dibuka di HP/browser baru (penandanya hanya di localStorage).
  // Itu dihapus karena memasang aplikasi (PWA) di HP baru akan mereset data progres yang sudah diisi.

  const handleAddItem = async () => {
    if (!newProgress.category || !newProgress.equipment_name) {
      toast.error('Kategori dan Nama Perangkat wajib diisi!');
      return;
    }

    setLoading(true);
    try {
      await addDocQueued(collection(db, 'maintenance_progress'), {
        ...newProgress,
        year: selectedYear,
        quarter: selectedQuarter,
        yesterday_qty: 0,
        createdAt: serverTimestamp()
      });
      toastWriteSuccess('Perangkat baru berhasil ditambahkan!');
      setShowAddModal(false);
      setNewProgress({
        category: '',
        equipment_name: '',
        plan_qty: 0,
        plan_start: '',
        plan_finish: '',
        actual_qty: 0,
        remark: ''
      });
    } catch (err) {
      console.error(err);
      toast.error('Gagal menambahkan perangkat');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus perangkat ini?')) return;

    setLoading(true);
    try {
      await deleteDocQueued(doc(db, 'maintenance_progress', id));
      toastWriteSuccess('Perangkat berhasil dihapus');
    } finally {
      setLoading(false);
    }
  };

  const handleEndDay = async () => {
    if (!window.confirm('Yakin ingin membekukan (freeze) data hari ini sebagai data kemarin? Daily progress akan dihitung ulang berdasarkan sisa hari ini.')) {
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      activities.forEach((activity: MaintenanceProgress) => {
        const docRef = doc(db, 'maintenance_progress', activity.id);
        batch.update(docRef, { yesterday_qty: activity.actual_qty });
      });
      await commitBatchQueued(batch);
      toastWriteSuccess('Daily progress berhasil dibekukan!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal membekukan data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgress = async (id: string, actualQty: number, remark: string) => {
    setSaving(id);
    try {
      const docRef = doc(db, 'maintenance_progress', id);
      await updateDocQueued(docRef, {
        actual_qty: actualQty,
        remark: remark || ''
      });
      toastWriteSuccess('Progress berhasil diupdate');
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengupdate progress');
    } finally {
      setSaving(null);
    }
  };

  const filteredActivities = (activities || []).filter((a: MaintenanceProgress) =>
    a.equipment_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full min-h-screen text-slate-800 font-sans">
      {/* Sidebar Kiri (Desktop) & Drawer (Mobile), sama dengan role lain */}
      <AppSidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={(tab: SiteManagerTab) => setActiveTab(tab)}
        navItems={SITE_MANAGER_NAV_ITEMS}
        sections={SITE_MANAGER_MENU_SECTIONS}
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
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-sky-100/80 shadow-xs px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile: Logo + Nama Perusahaan */}
            <div className="md:hidden flex items-center gap-2 min-w-0">
              <img src={logoDwimitra} alt="PT Dwimitra Ekatama Mandiri" className="w-7 h-7 object-contain shrink-0" />
              <div className="min-w-0">
                <h2 className="text-[11.5px] font-bold text-slate-900 leading-tight whitespace-nowrap overflow-hidden text-ellipsis tracking-tight">
                  PT Dwimitra Ekatama Mandiri
                </h2>
                <p className="text-[9.5px] text-blue-700 font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis mt-0.5 uppercase tracking-wide">
                  Site Manager · Monitoring Progres
                </p>
              </div>
            </div>

            {/* Desktop: Judul Halaman + Badge Role */}
            <div className="hidden md:flex items-center gap-2.5 min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate">{currentNavItem?.label || 'Dashboard Progres'}</h1>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded-full border border-blue-200 shrink-0">
                <ShieldCheck className="w-3 h-3 text-blue-600" />
                <span className="text-[10px] font-bold text-blue-700 uppercase">Site Manager</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
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
              aria-label="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </motion.button>
          </div>
        </header>

        <main className="relative z-10 flex-1 w-full min-w-0 max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          {/* Pilihan Periode (Tahun & Kuartal) untuk Ringkasan & Input Data */}
          {activeTab !== 'documents' && (
            <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight uppercase">Dashboard Progres</h2>
                <p className="flex items-center gap-1.5 text-blue-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" /> Monitoring Real-time
                </p>
              </div>
              <div className="flex items-center gap-2 bg-white p-1 pl-3 rounded-xl border border-slate-200 shadow-sm">
                <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  title="Pilih Tahun"
                  className="bg-transparent text-slate-700 text-xs font-bold px-2 py-1.5 outline-none cursor-pointer uppercase"
                >
                  <option value={2026} className="bg-white">2026</option>
                  <option value={2025} className="bg-white">2025</option>
                </select>
                <div className="w-px h-4 bg-slate-200" />
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  title="Pilih Kuartal"
                  className="bg-transparent text-slate-700 text-xs font-bold px-2 py-1.5 outline-none cursor-pointer uppercase"
                >
                  <option value="Q1" className="bg-white">Q1</option>
                  <option value="Q2" className="bg-white">Q2</option>
                  <option value="Q3" className="bg-white">Q3</option>
                  <option value="Q4" className="bg-white">Q4</option>
                </select>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'documents' ? (
              <motion.div
                key="documents"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full"
              >
                <DocumentList />
              </motion.div>
            ) : loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-24 flex flex-col items-center gap-4"
              >
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500 animate-pulse">Memuat data progres pemeliharaan...</p>
              </motion.div>
            ) : activeTab === 'summary' ? (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {summary && (
                  <>
                    <div className="grid grid-cols-3 gap-2.5 sm:gap-4 md:gap-12 max-w-5xl mx-auto md:py-6">
                      <StatDonut
                        label="Kemarin"
                        percent={summary.total_yesterday_percent}
                        sublabel={`${summary.total_yesterday_qty.toFixed(0)} UNIT`}
                        color="#94a3b8"
                        glowColor="#cbd5e1"
                        delay={0.1}
                      />
                      <StatDonut
                        label="Total"
                        percent={summary.total_today_percent}
                        color="#6366f1"
                        glowColor="#818cf8"
                        delay={0.2}
                      />
                      <StatDonut
                        label="Harian"
                        percent={summary.daily_progress}
                        color="#10b981"
                        glowColor="#34d399"
                        delay={0.3}
                      />
                    </div>

                    <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl overflow-hidden shadow-lg">
                      <div className="p-4 md:p-6 border-b border-slate-200 flex items-center justify-between gap-3">
                        <h3 className="text-xs md:text-lg font-black uppercase tracking-widest text-slate-500">Ringkasan Progres</h3>
                        <button
                          onClick={() => import('@/utils/ResumePdfExport').then(m => m.generateResumePdf(summary, `RESUME MAINTENANCE ${selectedQuarter} ${selectedYear}`, `Reporting & Monitoring System - PT Dwimitra Ekatama Mandiri`))}
                          className="px-3 py-2 md:px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-2 text-[11px] md:text-sm font-bold uppercase tracking-wider shadow-md cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>PDF</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto scrollbar-thin">
                        <table className="w-full text-center border-collapse min-w-[700px]">
                          <thead>
                            <tr className="bg-slate-50 text-[8px] md:text-[11px] font-black tracking-[0.2em] text-slate-500 uppercase">
                              <th rowSpan={3} className="sticky left-0 z-30 bg-slate-100 p-3 md:px-4 border border-slate-200 w-10 md:w-16 shadow-[2px_0_10px_rgba(0,0,0,0.05)]">NO</th>
                              <th rowSpan={3} className="sticky left-10 md:left-16 z-30 bg-slate-100 p-3 md:px-6 border border-slate-200 min-w-[140px] md:min-w-[280px] text-center shadow-[4px_0_15px_rgba(0,0,0,0.05)]">KATEGORI</th>
                              <th colSpan={2} className="p-3 border border-slate-200 bg-indigo-50 text-indigo-600">RENCANA</th>
                              <th colSpan={4} className="p-3 border border-slate-200 bg-emerald-50 text-emerald-600">PROGRES</th>
                            </tr>
                            <tr className="bg-white text-[7px] md:text-[9px]">
                              <th rowSpan={2} className="p-1 md:p-3 border border-slate-200 bg-indigo-50/50">QTY</th>
                              <th rowSpan={2} className="p-1 md:p-3 border border-slate-200 bg-indigo-50/50">WEIGHT %</th>
                              <th colSpan={2} className="p-1 md:p-3 border border-slate-200 bg-emerald-50/50">KEMARIN</th>
                              <th colSpan={2} className="p-1 md:p-3 border border-slate-200 bg-purple-50 text-purple-600">HARI INI</th>
                            </tr>
                            <tr className="text-[6px] md:text-[8px] text-slate-500">
                              <th className="p-1 md:p-2 border border-slate-200">QTY</th>
                              <th className="p-1 md:p-2 border border-slate-200">%</th>
                              <th className="p-1 md:p-2 border border-slate-200">QTY</th>
                              <th className="p-1 md:p-2 border border-slate-200">%</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {summary.category_summaries.map((cat, idx) => (
                              <tr key={idx} className="hover:bg-blue-50/50 transition-all group">
                                <td className="sticky left-0 z-20 bg-white group-hover:bg-blue-50/50 p-2 md:px-4 border border-slate-200 text-slate-500 font-bold font-mono">
                                  1.{idx + 1}
                                </td>
                                <td className="sticky left-10 md:left-16 z-20 bg-white group-hover:bg-blue-50/50 p-2 md:px-6 border border-slate-200 text-center">
                                  <span className="font-bold text-slate-900 uppercase text-[9px] md:text-sm tracking-tight">{cat.category}</span>
                                </td>
                                <td className="p-2 md:p-4 border border-slate-200 text-slate-600">{cat.plan_qty.toLocaleString()}</td>
                                <td className="p-2 md:p-4 border border-slate-200 text-indigo-600 font-bold">{cat.weight_percent.toFixed(2)}%</td>
                                <td className="p-2 md:p-4 border border-slate-200 text-slate-500">{cat.yesterday_qty.toLocaleString()}</td>
                                <td className="p-2 md:p-4 border border-slate-200 text-emerald-600 font-black">{cat.yesterday_percent.toFixed(2)}%</td>
                                <td className="p-2 md:p-4 border border-slate-200 text-slate-500">{cat.today_qty.toLocaleString()}</td>
                                <td className="p-2 md:p-4 border border-slate-200 text-purple-600 font-black">{cat.today_percent.toFixed(2)}%</td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50 font-black text-[10px] md:text-base border-t-2 border-blue-200">
                              <td colSpan={2} className="sticky left-0 z-20 bg-slate-100 p-4 md:p-8 text-slate-900 uppercase tracking-[0.3em] text-right border border-slate-200">
                                TOTAL
                              </td>
                              <td className="p-2 border border-slate-200 text-slate-600">{summary.total_plan_qty.toLocaleString()}</td>
                              <td className="p-2 border border-slate-200 text-indigo-600">100.00%</td>
                              <td className="p-2 border border-slate-200 text-slate-500">{summary.total_yesterday_qty.toLocaleString()}</td>
                              <td className="p-2 border border-slate-200 text-emerald-600 tracking-tighter">{summary.total_yesterday_percent.toFixed(2)}%</td>
                              <td className="p-2 border border-slate-200 text-slate-500">{summary.total_today_qty.toLocaleString()}</td>
                              <td className="p-2 border border-slate-200 text-purple-600 tracking-tighter">{summary.total_today_percent.toFixed(2)}%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 sm:space-y-6"
              >
                <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari alat atau kategori..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl py-3 md:py-4 pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 md:flex gap-2 md:gap-3">
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Perangkat
                    </button>
                    <button
                      onClick={handleEndDay}
                      disabled={loading}
                      className="px-4 py-2.5 bg-white text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 border border-slate-200 shadow-sm cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      Akhiri Hari & Freeze
                    </button>
                  </div>
                </div>

                {filteredActivities.length === 0 ? (
                  <div className="py-16 text-center bg-white/80 border border-dashed border-slate-300 rounded-2xl">
                    <Database className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-600">Belum ada data perangkat untuk periode ini</p>
                    <p className="text-xs text-slate-500 mt-1">Tekan "Tambah Perangkat" untuk mulai mengisi.</p>
                  </div>
                ) : (
                  <div className="md:bg-white/90 md:backdrop-blur-xl md:border md:border-slate-200 md:rounded-2xl md:overflow-hidden md:shadow-lg">
                    <div className="md:overflow-x-auto">
                      <table className="block md:table w-full border-collapse">
                        <thead className="hidden md:table-header-group bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                          <tr>
                            <th className="px-6 py-4 text-left">Alat / Perangkat</th>
                            <th className="px-6 py-4 text-center">Rencana Qty</th>
                            <th className="px-6 py-4 text-center">Periode</th>
                            <th className="px-6 py-4 text-center w-32">Aktual</th>
                            <th className="px-6 py-4 text-center">Progres</th>
                            <th className="px-6 py-4 text-left">Keterangan</th>
                            <th className="px-6 py-4 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="block md:table-row-group space-y-3 md:space-y-0 md:divide-y md:divide-slate-100">
                          {filteredActivities.map((activity) => (
                            <ActivityRow
                              key={activity.id}
                              activity={activity}
                              onUpdate={handleUpdateProgress}
                              onDelete={handleDelete}
                              isSaving={saving === activity.id}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <Footer />
      </div>

      {/* Modal Tambah Perangkat */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Tambah Perangkat Baru"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white md:border md:border-slate-200 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="p-5 md:p-6 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-500" />
                  Tambah Perangkat Baru
                </h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer" title="Tutup Modal">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="p-5 md:p-8 space-y-5 md:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Kategori</label>
                    <input
                      type="text"
                      list="categories"
                      value={newProgress.category}
                      onChange={(e) => setNewProgress({ ...newProgress, category: e.target.value })}
                      placeholder="Contoh: A. ELECTRICAL SYSTEM"
                      className={MODAL_INPUT_CLASS}
                    />
                    <datalist id="categories">
                      <option value="A. ELECTRICAL SYSTEM" />
                      <option value="B. HVAC SYSTEM" />
                      <option value="C. PLUMBING SYSTEM" />
                      <option value="D. FIRE PROTECT. SYSTEM" />
                      <option value="E. LIFT & ESCALATOR" />
                      <option value="F. CIVIL & ARCHITECTURE" />
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Nama Perangkat</label>
                    <input
                      type="text"
                      value={newProgress.equipment_name}
                      onChange={(e) => setNewProgress({ ...newProgress, equipment_name: e.target.value })}
                      placeholder="Contoh: TRANSFORMATOR 01"
                      className={MODAL_INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Plan Qty</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={newProgress.plan_qty}
                      onChange={(e) => setNewProgress({ ...newProgress, plan_qty: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      title="Plan Qty"
                      className={MODAL_INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Actual Qty (Awal)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={newProgress.actual_qty}
                      onChange={(e) => setNewProgress({ ...newProgress, actual_qty: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      title="Actual Qty"
                      className={MODAL_INPUT_CLASS}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">Start</label>
                      <input
                        type="text"
                        placeholder="23-Feb"
                        value={newProgress.plan_start}
                        onChange={(e) => setNewProgress({ ...newProgress, plan_start: e.target.value })}
                        className={MODAL_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">Finish</label>
                      <input
                        type="text"
                        placeholder="27-Feb"
                        value={newProgress.plan_finish}
                        onChange={(e) => setNewProgress({ ...newProgress, plan_finish: e.target.value })}
                        className={MODAL_INPUT_CLASS}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Catatan (Remark)</label>
                  <textarea
                    value={newProgress.remark}
                    onChange={(e) => setNewProgress({ ...newProgress, remark: e.target.value })}
                    rows={3}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                    placeholder="Masukkan catatan jika ada..."
                  />
                </div>

                <div className="flex flex-col md:flex-row gap-3 md:gap-4 pt-2 md:pt-4">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="order-2 md:order-1 flex-1 px-6 py-3.5 md:py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleAddItem}
                    disabled={loading}
                    className="order-1 md:order-2 flex-1 px-6 py-3.5 md:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Simpan Perangkat
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi Log Out */}
      <LogoutConfirmModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={logout}
        userEmail={user?.email || ''}
      />
    </div>
  );
}

function ActivityRow({ activity, onUpdate, onDelete, isSaving }: {
  activity: MaintenanceProgress,
  onUpdate: (id: string, qty: number, remark: string) => Promise<void>,
  onDelete: (id: string) => Promise<void>,
  isSaving: boolean
}) {
  const [qty, setQty] = useState(activity.actual_qty.toString());
  const [remark, setRemark] = useState(activity.remark || '');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setQty(activity.actual_qty.toString());
    setRemark(activity.remark);
  }, [activity]);

  const progressPercent = activity.plan_qty > 0 ? (parseFloat(qty) || 0) / activity.plan_qty * 100 : 0;
  // HP: tiap baris tampil sebagai kartu 2 kolom; desktop: baris tabel biasa
  const cell = 'block md:table-cell px-4 py-2.5 md:px-6 md:py-4';
  const mobileLabel = 'md:hidden block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1';

  return (
    <tr className="grid grid-cols-2 md:table-row bg-white md:bg-transparent border border-slate-200 md:border-0 rounded-2xl overflow-hidden shadow-xs md:shadow-none hover:bg-blue-50/50 transition-colors">
      <td className={`${cell} col-span-2 bg-slate-50/80 md:bg-transparent border-b border-slate-100 md:border-0`}>
        <p className="font-semibold text-slate-900">{activity.equipment_name}</p>
        <p className="text-xs text-slate-500">{activity.category}</p>
      </td>
      <td className={`${cell} md:text-center`}>
        <span className={mobileLabel}>Rencana Qty</span>
        <span className="text-slate-600 font-mono">{activity.plan_qty}</span>
      </td>
      <td className={`${cell} md:text-center`}>
        <span className={mobileLabel}>Periode Rencana</span>
        <div className="flex items-center md:justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
          {activity.plan_start || activity.plan_finish ? (
            <>
              <span>{activity.plan_start || '-'}</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span>{activity.plan_finish || '-'}</span>
            </>
          ) : (
            <span>-</span>
          )}
        </div>
      </td>
      <td className={cell}>
        <span className={mobileLabel}>Qty Aktual</span>
        <input
          type="number"
          inputMode="decimal"
          value={qty}
          onChange={(e) => {
            setQty(e.target.value);
            setHasChanges(true);
          }}
          placeholder="0"
          title="Actual Qty"
          className="w-full md:w-28 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
        />
      </td>
      <td className={`${cell} md:text-center`}>
        <span className={mobileLabel}>Progres</span>
        <div className="flex flex-col md:items-center gap-1 pt-2 md:pt-0">
          <div className="w-full md:w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                progressPercent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              ref={(el) => {
                if (el) {
                  el.style.width = `${Math.min(100, progressPercent)}%`;
                }
              }}
            />
          </div>
          <span className={`text-xs font-mono font-bold ${
            progressPercent >= 100 ? 'text-emerald-600' : 'text-slate-500'
          }`}>
            {progressPercent.toFixed(1)}%
          </span>
        </div>
      </td>
      <td className={`${cell} col-span-2`}>
        <span className={mobileLabel}>Keterangan</span>
        <input
          type="text"
          value={remark}
          placeholder="Tambahkan catatan..."
          onChange={(e) => {
            setRemark(e.target.value);
            setHasChanges(true);
          }}
          className="w-full bg-white md:bg-transparent border border-slate-200 md:border-none rounded-xl px-3 py-2 md:p-0 outline-none text-slate-600 placeholder-slate-400 text-sm focus:text-slate-900 transition-all"
        />
      </td>
      <td className={`${cell} col-span-2 pb-4`}>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => {
              onUpdate(activity.id, parseFloat(qty) || 0, remark);
              setHasChanges(false);
            }}
            disabled={!hasChanges || isSaving}
            className={`flex-1 md:flex-none flex items-center justify-center h-11 md:h-12 w-full md:w-12 rounded-xl transition-all ${
              hasChanges
                ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
            title="Simpan Perubahan"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <Save className="w-5 h-5 md:mr-0 mr-2" />
                <span className="md:hidden text-sm font-semibold">Simpan</span>
              </>
            )}
          </button>
          <button
            onClick={() => onDelete(activity.id)}
            disabled={isSaving}
            className="flex-1 md:flex-none h-11 md:h-auto p-3 md:p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-all disabled:opacity-50 border border-rose-500/20 md:border-none flex items-center justify-center gap-2 cursor-pointer"
            title="Hapus Perangkat"
          >
            <Trash2 className="w-5 h-5" />
            <span className="md:hidden text-sm font-medium">Hapus</span>
          </button>
        </div>
      </td>
    </tr>
  );
}
