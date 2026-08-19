// ============================================================================
// FILE: frontend/components/MOPMonitoringDashboard.tsx
// Deskripsi: Dashboard Monitoring MOP Workflow — menampilkan statistik grafis,
//            distribusi status MOP (Donut Chart), trend bulanan (Bar Chart),
//            dan tabel ringkasan dengan filter/search.
// ============================================================================

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3, FileText, CheckCircle2, Clock, AlertCircle,
  Send, Shield, TrendingUp, Calendar, Search
} from 'lucide-react';
import type { MOPWorkflowDoc, MOPStatus } from '@/types/mopTypes';
import { MOP_STATUS_LABELS, MOP_STATUS_COLORS } from '@/types/mopTypes';

// ─── SUB-COMPONENT: Stat Donut (Reused pattern from SiteManagerDashboard) ─────

function StatDonut({ label, value, total, color, glowColor, delay = 0 }: {
  label: string;
  value: number;
  total: number;
  color: string;
  glowColor: string;
  delay?: number;
}) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  const uniqueId = label.toLowerCase().replace(/\s+/g, '-');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center p-4 md:p-5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm backdrop-blur-xl hover:border-blue-200 transition-all duration-500 group relative overflow-hidden text-slate-800"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />

      <div className="relative w-20 h-20 md:w-24 md:h-24 flex items-center justify-center mb-2.5">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          <defs>
            <linearGradient id={`mop-gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={glowColor} stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-slate-200" strokeWidth="5" />
          <motion.circle
            cx="50" cy="50" r={radius} fill="none"
            stroke={`url(#mop-gradient-${uniqueId})`}
            strokeWidth="6" strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ delay: delay + 0.4, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ strokeDasharray: circumference }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter">{value}</span>
          <span className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
        </div>
      </div>
      <span className="text-xs text-slate-500 font-bold">{percent.toFixed(0)}%</span>
    </motion.div>
  );
}

// ─── SUB-COMPONENT: Activity Timeline ─────────────────────────────────────────

function ActivityTimeline({ mops }: { mops: MOPWorkflowDoc[] }) {
  // Get last 10 activities (sorted by updatedAt)
  const activities = useMemo(() => {
    return [...mops]
      .sort((a, b) => (b.updatedAt?.toDate().getTime() || 0) - (a.updatedAt?.toDate().getTime() || 0))
      .slice(0, 10);
  }, [mops]);

  const getStatusIcon = (status: MOPStatus) => {
    switch (status) {
      case 'draft': return FileText;
      case 'review_ocs': return Send;
      case 'revision_ocs': return AlertCircle;
      case 'approved_ocs': return CheckCircle2;
      case 'review_tde': return Shield;
      case 'revision_tde': return AlertCircle;
      case 'completed': return CheckCircle2;
    }
  };

  return (
    <div className="space-y-2">
      {activities.map((mop, idx) => {
        const StatusIcon = getStatusIcon(mop.status);
        const colors = MOP_STATUS_COLORS[mop.status];
        return (
          <motion.div
            key={mop.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-3 px-3 py-2 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
          >
            <div className={`w-8 h-8 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
              <StatusIcon className={`w-4 h-4 ${colors.text}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-700 truncate">{mop.mopNumber} — {mop.title}</p>
              <p className="text-[10px] text-slate-400">
                {mop.equipmentType} • {MOP_STATUS_LABELS[mop.status]}
              </p>
            </div>
            <span className="text-[10px] text-slate-400 flex-shrink-0">
              {mop.updatedAt?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </span>
          </motion.div>
        );
      })}
      {activities.length === 0 && (
        <div className="text-center py-8">
          <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-medium">Belum ada aktivitas</p>
        </div>
      )}
    </div>
  );
}

// ─── SUB-COMPONENT: Monthly Trend (Simple Bar Chart via CSS) ──────────────────

function MonthlyTrend({ mops }: { mops: MOPWorkflowDoc[] }) {
  const monthlyData = useMemo(() => {
    const months: Record<string, { created: number; completed: number }> = {};
    const now = new Date();

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
      months[key] = { created: 0, completed: 0 };
    }

    mops.forEach(mop => {
      if (mop.createdAt) {
        const d = mop.createdAt.toDate();
        const key = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
        if (months[key]) months[key].created++;
      }
      if (mop.completedAt) { 
        const d = mop.completedAt.toDate();
        const key = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
        if (months[key]) months[key].completed++;
      }
    });

    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }, [mops]);

  const maxVal = Math.max(...monthlyData.map(d => Math.max(d.created, d.completed)), 1);

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span className="text-[10px] font-bold text-slate-500">Dibuat</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          <span className="text-[10px] font-bold text-slate-500">Selesai</span>
        </div>
      </div>

      <div className="flex items-end gap-2 h-32">
        {monthlyData.map((data, idx) => (
          <div key={data.month} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex gap-0.5 items-end h-24 w-full justify-center">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(data.created / maxVal) * 100}%` }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
                className="w-3 bg-blue-500 rounded-t-sm min-h-[2px]"
                title={`Dibuat: ${data.created}`}
              />
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(data.completed / maxVal) * 100}%` }}
                transition={{ delay: idx * 0.1 + 0.05, duration: 0.5 }}
                className="w-3 bg-emerald-500 rounded-t-sm min-h-[2px]"
                title={`Selesai: ${data.completed}`}
              />
            </div>
            <span className="text-[9px] font-bold text-slate-400 text-center">{data.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface MOPMonitoringDashboardProps {
  mops: MOPWorkflowDoc[];
}

export function MOPMonitoringDashboard({ mops }: MOPMonitoringDashboardProps) {
  const [filterStatus, setFilterStatus] = useState<MOPStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: mops.length,
    draft: mops.filter(m => m.status === 'draft').length,
    reviewOcs: mops.filter(m => m.status === 'review_ocs').length,
    revisionOcs: mops.filter(m => m.status === 'revision_ocs').length,
    approvedOcs: mops.filter(m => m.status === 'approved_ocs').length,
    reviewTde: mops.filter(m => m.status === 'review_tde').length,
    revisionTde: mops.filter(m => m.status === 'revision_tde').length,
    completed: mops.filter(m => m.status === 'completed').length,
  }), [mops]);

  const inProgressCount = stats.reviewOcs + stats.revisionOcs + stats.approvedOcs + stats.reviewTde + stats.revisionTde;

  // ─── Filtered table data ──────────────────────────────────────────────────

  const tableData = useMemo(() => {
    let filtered = mops;
    if (filterStatus !== 'all') {
      filtered = filtered.filter(m => m.status === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.mopNumber.toLowerCase().includes(q) ||
        m.equipmentType.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [mops, filterStatus, searchQuery]);

  // ─── Average completion time ──────────────────────────────────────────────

  const avgCompletionDays = useMemo(() => {
    const completed = mops.filter(m => m.completedAt && m.createdAt);
    if (completed.length === 0) return 0;
    const totalDays = completed.reduce((sum, m) => {
      const start = m.createdAt.toDate().getTime();
      const end = m.completedAt!.toDate().getTime();
      return sum + (end - start) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(totalDays / completed.length);
  }, [mops]);

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats Donut Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatDonut label="Total" value={stats.total} total={Math.max(stats.total, 1)} color="#3b82f6" glowColor="#60a5fa" delay={0} />
        <StatDonut label="Proses" value={inProgressCount} total={Math.max(stats.total, 1)} color="#f59e0b" glowColor="#fbbf24" delay={0.1} />
        <StatDonut label="Selesai" value={stats.completed} total={Math.max(stats.total, 1)} color="#10b981" glowColor="#34d399" delay={0.2} />
        <StatDonut label="Revisi" value={stats.revisionOcs + stats.revisionTde} total={Math.max(stats.total, 1)} color="#ef4444" glowColor="#f87171" delay={0.3} />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/90 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900">{avgCompletionDays}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Rata-rata Hari Selesai</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/90 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900">{inProgressCount}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Sedang Diproses</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/90 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 col-span-2 sm:col-span-1"
        >
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900">
              {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(0) : 0}%
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Completion Rate</p>
          </div>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/90 border border-slate-200/80 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-700">Trend Bulanan</h3>
          </div>
          <MonthlyTrend mops={mops} />
        </motion.div>

        {/* Activity Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white/90 border border-slate-200/80 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-700">Aktivitas Terbaru</h3>
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            <ActivityTimeline mops={mops} />
          </div>
        </motion.div>
      </div>

      {/* Table View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white/90 border border-slate-200/80 rounded-2xl overflow-hidden"
      >
        {/* Table Header */}
        <div className="px-5 py-3.5 border-b border-slate-200/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-700">Daftar Semua MOP</h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari..."
                className="w-full sm:w-44 pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as MOPStatus | 'all')}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">Semua Status</option>
              {Object.entries(MOP_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">No. MOP</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Judul</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Equipment</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quarter</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableData.map((mop) => {
                const colors = MOP_STATUS_COLORS[mop.status];
                return (
                  <tr key={mop.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-bold text-slate-600">{mop.mopNumber}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-700 max-w-[200px] truncate">{mop.title}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-semibold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">{mop.equipmentType}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{mop.quarter}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                        {MOP_STATUS_LABELS[mop.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">
                      {mop.createdAt?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">
                    Tidak ada data yang sesuai
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
