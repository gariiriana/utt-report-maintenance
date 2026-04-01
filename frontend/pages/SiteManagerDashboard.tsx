import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DataCenterBackground } from '@/components/DataCenterBackground';
import { 
  BarChart3, 
  ClipboardList, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  ArrowRight,
  Save,
  Loader2,
  RefreshCw,
  LayoutDashboard,
  Search,
  Database,
  Plus,
  Trash2,
  FileText,
  Download,
  LogOut,
  UserCircle
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { toast } from 'sonner';
import { 
  calculateMaintenanceSummary, 
  type MaintenanceProgress, 
  type MaintenanceSummary 
} from '@/utils/MaintenanceLogic';

export function SiteManagerDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'summary' | 'input'>('summary');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [summary, setSummary] = useState<MaintenanceSummary | null>(null);
  const [activities, setActivities] = useState<MaintenanceProgress[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
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

  const handleAddItem = async () => {
    if (!newProgress.category || !newProgress.equipment_name) {
      toast.error('Kategori dan Nama Perangkat wajib diisi!');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'maintenance_progress'), {
        ...newProgress,
        year: selectedYear,
        quarter: selectedQuarter,
        yesterday_qty: 0,
        createdAt: serverTimestamp()
      });
      toast.success('Perangkat baru berhasil ditambahkan!');
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
      await deleteDoc(doc(db, 'maintenance_progress', id));
      toast.success('Perangkat berhasil dihapus');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus perangkat');
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
      await batch.commit();
      toast.success('Daily progress berhasil dibekukan!');
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
      await updateDoc(docRef, { 
        actual_qty: actualQty, 
        remark: remark || ''
      });
      toast.success('Progress berhasil diupdate');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
          <p className="text-slate-400 animate-pulse">Memuat dashboard Manajer Situs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 sm:p-8 relative overflow-hidden">
      <DataCenterBackground />
      
      {/* Header Container */}
      <div className="max-w-7xl mx-auto mb-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <LayoutDashboard className="w-6 h-6 md:w-8 md:h-8 text-indigo-500" />
              Dashboard Progres Maintenance
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value={2026}>Tahun 2026</option>
                <option value={2025}>Tahun 2025</option>
              </select>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value="Q1">Kuartal 1 (Jan-Mar)</option>
                <option value="Q2">Kuartal 2 (Apr-Jun)</option>
                <option value="Q3">Kuartal 3 (Jul-Sep)</option>
                <option value="Q4">Kuartal 4 (Okt-Des)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:flex items-center gap-2 bg-slate-900/50 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 md:px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm md:text-base ${
                activeTab === 'summary' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden xs:inline">Resume</span>
              <span className="xs:hidden">Resume</span>
            </button>
            <button
              onClick={() => setActiveTab('input')}
              className={`px-3 md:px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm md:text-base ${
                activeTab === 'input' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span className="hidden xs:inline">Perbarui Progres</span>
              <span className="xs:hidden">Perbarui</span>
            </button>

            <div className="hidden md:block w-px h-6 bg-slate-800 mx-1" />

            <button
              onClick={handleEndDay}
              disabled={loading}
              className="col-span-2 md:col-span-1 px-4 py-2 rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2 group text-sm md:text-base"
              title="Freeze data hari ini sebagai data kemarin"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4 group-hover:scale-110 transition-transform" />}
              Akhiri Hari
            </button>

            <button
              onClick={() => setShowLogoutModal(true)}
              className="px-4 py-2 rounded-lg bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2 group text-sm md:text-base"
              title={`Logout dari ${user?.email}`}
            >
              <UserCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Profil</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'summary' && (
            summary ? (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm relative overflow-hidden group hover:border-indigo-500/50 transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-slate-500/5 blur-[80px] -mr-8 -mt-8" />
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <p className="text-slate-400 font-medium">Progress Kemarin</p>
                      <div className="p-2 bg-slate-800 rounded-lg">
                        <Calendar className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>
                    <div className="flex items-end gap-2 relative z-10">
                      <h2 className="text-4xl font-bold text-white">{summary.total_yesterday_percent.toFixed(2)}%</h2>
                      <p className="text-slate-500 mb-1">{summary.total_yesterday_qty.toFixed(2)} unit</p>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm relative overflow-hidden group hover:border-indigo-500/50 transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-[80px] -mr-8 -mt-8" />
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <p className="text-slate-400 font-medium">Total Progres</p>
                      <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                      </div>
                    </div>
                    <div className="flex items-end gap-2 relative z-10">
                      <h2 className="text-4xl font-bold text-white">{summary.total_today_percent.toFixed(2)}%</h2>
                      <p className="text-slate-500 mb-1">{summary.total_today_qty.toFixed(2)} unit</p>
                    </div>
                    <div className="mt-6 h-2 bg-slate-800 rounded-full overflow-hidden relative z-10">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${summary.total_today_percent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full shadow-[0_0_12px_rgba(79,70,229,0.4)]"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-slate-400 font-medium">Progres Harian</p>
                      <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <h2 className="text-4xl font-bold text-emerald-400">+{summary.daily_progress}%</h2>
                      <p className="text-slate-500 mb-1">Pertumbuhan hari ini</p>
                    </div>
                  </div>
                </div>

                {/* Category Table */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
                  <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <FileText className="w-6 h-6 text-indigo-500" />
                      Ringkasan Per Kategori
                    </h3>
                    <div className="flex items-center gap-2">
                       <button
                        onClick={() => {
                            import('@/utils/ResumePdfExport').then(m => m.generateResumePdf(summary!));
                        }}
                        className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 font-bold"
                      >
                        <Download className="w-4 h-4" />
                        Ekspor ke PDF
                      </button>
                      <button onClick={() => toast.info('Data diperbarui secara real-time dari Firestore')} className="p-2 text-slate-400 hover:text-white transition-colors" title="Refresh Data">
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="hidden md:table-header-group text-slate-300 text-[10px] uppercase tracking-wider font-bold">
                        <tr className="bg-slate-950/80">
                          <th rowSpan={3} className="px-4 py-3 border border-slate-800 text-center bg-blue-600/20">No</th>
                          <th rowSpan={3} className="px-4 py-3 border border-slate-800 text-center bg-blue-600/20">DESKRIPSI</th>
                          <th colSpan={2} className="px-4 py-3 border border-slate-800 text-center bg-blue-600/20">PLAN</th>
                          <th colSpan={4} className="px-4 py-3 border border-slate-800 text-center bg-blue-600/20 text-blue-400">PROGRESS</th>
                        </tr>
                        <tr className="bg-slate-950/80">
                          <th rowSpan={2} className="px-4 py-2 border border-slate-800 text-center bg-blue-600/10">Qty</th>
                          <th rowSpan={2} className="px-4 py-2 border border-slate-800 text-center bg-blue-600/10">Weight %</th>
                          <th colSpan={2} className="px-4 py-2 border border-slate-800 text-center bg-emerald-900/30 text-emerald-400">Yesterday</th>
                          <th colSpan={2} className="px-4 py-2 border border-slate-800 text-center bg-purple-900/30 text-purple-400">Today</th>
                        </tr>
                        <tr className="bg-slate-950/80 text-[9px]">
                          <th className="px-4 py-2 border border-slate-800 text-center bg-emerald-900/20">Qty</th>
                          <th className="px-4 py-2 border border-slate-800 text-center bg-emerald-900/20">Weight %</th>
                          <th className="px-4 py-2 border border-slate-800 text-center bg-purple-900/20">Qty</th>
                          <th className="px-4 py-2 border border-slate-800 text-center bg-purple-900/20">Weight %</th>
                        </tr>
                      </thead>
                      <tbody className="block md:table-row-group divide-y divide-slate-800/50 md:divide-slate-800">
                        {(summary.category_summaries || []).map((cat, idx) => (
                          <tr key={idx} className="block md:table-row bg-slate-900/20 md:bg-transparent border border-slate-800 md:border-none rounded-2xl mb-4 md:mb-0 overflow-hidden hover:bg-white/[0.02] transition-colors group">
                            <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-slate-800 text-center bg-slate-950/40 font-bold text-indigo-400">
                              <div className="flex justify-between items-center md:justify-center">
                                <span className="md:hidden text-[10px] font-bold text-slate-500 uppercase">No</span>
                                <span>1.{idx + 1}</span>
                              </div>
                            </td>
                            <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-slate-800 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <span className="md:hidden text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Kategori</span>
                                <span className="font-bold text-slate-200 tracking-wide text-xs">{cat.category}</span>
                              </div>
                            </td>
                            <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-slate-800">
                              <div className="flex justify-between items-center md:justify-center">
                                <span className="md:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan Qty</span>
                                <span className="text-slate-400 font-mono text-xs">{cat.plan_qty.toLocaleString()}</span>
                              </div>
                            </td>
                            <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-slate-800">
                              <div className="flex justify-between items-center md:justify-center">
                                <span className="md:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan Weight</span>
                                <span className="text-slate-400 font-mono text-xs">{cat.weight_percent.toFixed(2)}%</span>
                              </div>
                            </td>
                            {/* Yesterday Columns */}
                            <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-slate-800 bg-emerald-900/5">
                              <div className="flex justify-between items-center md:justify-center">
                                <span className="md:hidden text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider">Yesterday Qty</span>
                                <span className="text-emerald-400/80 font-mono text-xs">{cat.yesterday_qty.toLocaleString()}</span>
                              </div>
                            </td>
                            <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-slate-800 bg-emerald-900/10">
                              <div className="flex justify-between items-center md:justify-center">
                                <span className="md:hidden text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Yesterday %</span>
                                <span className="text-emerald-400 font-mono font-bold text-xs">{cat.yesterday_percent.toFixed(2)}%</span>
                              </div>
                            </td>
                            {/* Today Columns */}
                            <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-slate-800 bg-purple-900/5">
                              <div className="flex justify-between items-center md:justify-center">
                                <span className="md:hidden text-[10px] font-bold text-purple-500/70 uppercase tracking-wider">Today Qty</span>
                                <span className="text-purple-400/80 font-mono text-xs">{cat.today_qty.toLocaleString()}</span>
                              </div>
                            </td>
                            <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-slate-800 bg-purple-900/10">
                              <div className="flex justify-between items-center md:justify-center">
                                <span className="md:hidden text-[10px] font-bold text-purple-400 uppercase tracking-wider font-bold">Today %</span>
                                <span className="text-purple-400 font-bold font-mono text-xs">{cat.today_percent.toFixed(2)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-slate-500"
              >
                <div className="p-4 bg-slate-900 rounded-full mb-4">
                  <Database className="w-8 h-8 text-slate-700" />
                </div>
                <p className="text-lg">Belum ada data Maintenance Progress.</p>
                <p className="text-sm mt-1">Gunakan script init-db untuk mengisi data awal.</p>
                <button
                  onClick={() => toast.info('Data diperbarui secara real-time dari Firestore')}
                  className="mt-6 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Coba Muat Ulang
                </button>
              </motion.div>
            )
          )}

          {activeTab === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Search & Filters */}
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Cari perangkat atau kategori..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none backdrop-blur-sm transition-all"
                />
              </div>

              {/* Progress Update Table */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="hidden md:table-header-group bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-medium">Perangkat</th>
                        <th className="px-6 py-4 font-medium text-center">Plan Qty</th>
                        <th className="px-6 py-4 font-medium text-center">Plan Period</th>
                        <th className="px-6 py-4 font-medium text-center w-32">Actual Qty</th>
                        <th className="px-6 py-4 font-medium text-center">Progress</th>
                        <th className="px-6 py-4 font-medium">Remark</th>
                        <th className="px-6 py-4 font-medium text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="block md:table-row-group divide-y divide-slate-800/50 md:divide-slate-800 p-4 md:p-0">
                      {filteredActivities.length > 0 ? (
                        filteredActivities.map((activity: MaintenanceProgress) => (
                          <ActivityRow
                            key={activity.id}
                            activity={activity}
                            onUpdate={handleUpdateProgress}
                            onDelete={handleDelete}
                            isSaving={saving === activity.id}
                          />
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-600">
                            {loading ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                <span>Memuat data...</span>
                              </div>
                            ) : (
                              "Tidak ada data perangkat yang ditemukan."
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl shadow-indigo-500/40 flex items-center justify-center z-[50] group"
      >
        <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
      </motion.button>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 md:border md:border-slate-800 rounded-3xl md:rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] md:max-h-none"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-400" />
                  Tambah Perangkat Baru
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white transition-colors">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

               <div className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Kategori</label>
                    <input
                      type="text"
                      list="categories"
                      value={newProgress.category}
                      onChange={(e) => setNewProgress({ ...newProgress, category: e.target.value })}
                      placeholder="Contoh: A. ELECTRICAL SYSTEM"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 md:p-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    />
                    {/* ... datalist ... */}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Nama Perangkat</label>
                    <input
                      type="text"
                      value={newProgress.equipment_name}
                      onChange={(e) => setNewProgress({ ...newProgress, equipment_name: e.target.value })}
                      placeholder="Contoh: TRANSFORMATOR 01"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 md:p-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Plan Qty</label>
                    <input
                      type="number"
                      value={newProgress.plan_qty}
                      onChange={(e) => setNewProgress({ ...newProgress, plan_qty: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 md:p-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Actual Qty (Awal)</label>
                    <input
                      type="number"
                      value={newProgress.actual_qty}
                      onChange={(e) => setNewProgress({ ...newProgress, actual_qty: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 md:p-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Start</label>
                      <input
                        type="text"
                        placeholder="23-Feb"
                        value={newProgress.plan_start}
                        onChange={(e) => setNewProgress({ ...newProgress, plan_start: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 md:p-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Finish</label>
                      <input
                        type="text"
                        placeholder="27-Feb"
                        value={newProgress.plan_finish}
                        onChange={(e) => setNewProgress({ ...newProgress, plan_finish: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 md:p-3.5 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Catatan (Remark)</label>
                  <textarea
                    value={newProgress.remark}
                    onChange={(e) => setNewProgress({ ...newProgress, remark: e.target.value })}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-none"
                    placeholder="Masukkan catatan jika ada..."
                  />
                </div>

                <div className="flex flex-col md:flex-row gap-3 md:gap-4 pt-4">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="order-2 md:order-1 flex-1 px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleAddItem}
                    disabled={loading}
                    className="order-1 md:order-2 flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
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

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutModal(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <LogOut className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Konfirmasi Logout</h3>
              <p className="text-slate-400 mb-8">
                Yakin ingin keluar dari akun <span className="text-indigo-400 font-medium">{user?.email}</span>?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => logout()}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-600/20"
                >
                  Ya, Logout Sekarang
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-all"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

  return (
    <tr className="block md:table-row bg-slate-900/30 md:bg-transparent border border-slate-800 md:border-none rounded-2xl mb-4 md:mb-0 overflow-hidden hover:bg-white/[0.02] transition-colors">
      <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-none">
        <div className="flex flex-col">
          <span className="md:hidden text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Perangkat</span>
          <p className="font-medium text-slate-200">{activity.equipment_name}</p>
          <p className="text-xs text-slate-500">{activity.category}</p>
        </div>
      </td>
      <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-none">
        <div className="flex justify-between items-center md:justify-center">
          <span className="md:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan Qty</span>
          <span className="text-slate-400 font-mono">{activity.plan_qty}</span>
        </div>
      </td>
      <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-none">
        <div className="flex justify-between items-center md:justify-center">
          <span className="md:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan Period</span>
          <div className="flex items-center gap-3 md:flex-col md:gap-0.5 text-xs text-slate-500">
            <span>{activity.plan_start}</span>
            <ArrowRight className="w-3 h-3 md:rotate-90" />
            <span>{activity.plan_finish}</span>
          </div>
        </div>
      </td>
      <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-none">
        <div className="flex flex-col gap-1.5">
          <span className="md:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actual Qty</span>
          <input
            type="number"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              setHasChanges(true);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-center text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
          />
        </div>
      </td>
      <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-none">
        <div className="flex justify-between items-center md:flex-col md:gap-1.5">
          <span className="md:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progress</span>
          <div className="flex flex-col items-center gap-1">
            <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  progressPercent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>
            <span className={`text-xs font-mono font-bold ${
              progressPercent >= 100 ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              {progressPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </td>
      <td className="block md:table-cell px-6 py-4 border-b border-slate-800 md:border-none">
        <div className="flex flex-col gap-1.5">
          <span className="md:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remark</span>
          <input
            type="text"
            value={remark}
            placeholder="Tambahkan catatan..."
            onChange={(e) => {
              setRemark(e.target.value);
              setHasChanges(true);
            }}
            className="w-full bg-slate-950/30 md:bg-transparent border border-slate-800 md:border-none rounded-xl px-4 py-2 md:p-0 outline-none text-slate-400 placeholder-slate-700 text-sm focus:text-white transition-all"
          />
        </div>
      </td>
      <td className="block md:table-cell px-6 py-4">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => {
              onUpdate(activity.id, parseFloat(qty) || 0, remark);
              setHasChanges(false);
            }}
            disabled={!hasChanges || isSaving}
            className={`flex-1 md:flex-none flex items-center justify-center h-12 w-full md:w-12 rounded-xl transition-all ${
              hasChanges 
                ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20' 
                : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
            }`}
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <Save className="w-5 h-5 md:mr-0 mr-2" />
                <span className="md:hidden">Simpan</span>
              </>
            )}
          </button>
          <button
            onClick={() => onDelete(activity.id)}
            disabled={isSaving}
            className="flex-1 md:flex-none p-3 md:p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all disabled:opacity-50 border border-rose-500/20 md:border-none flex items-center justify-center gap-2"
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
