// ============================================================================
// FILE: PMSchedule.tsx
// Deskripsi: Matriks Kalender Jadwal Pemeliharaan Berkala (PM Schedule 2026).
//            Menampilkan 34 perangkat Data Center NeutraDC Cikarang lengkap dengan
//            rentang tanggal eksekusi per bulan (Januari - Desember), lokasi spesifik,
//            catatan prosedur pengujian khusus (Special Test / Offline Maintenance),
//            serta integrasi tombol Pengingat WhatsApp Gateway otomatis.
// ============================================================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Info,
  X,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { WAGatewayModal } from '@/components/WAGatewayModal';
import { MASTER_PM_SCHEDULES } from '@/utils/monthlyReportData';

// ─── SCHEDULE DATA (Synchronized from MASTER_PM_SCHEDULES / 2026 PM spreadsheet) ─────────

export interface PMScheduleItem {
  device: string;
  location: string;
  months: (string | null)[]; // 12 months: Jan..Dec, null = no plan
  remarks: string;
  category: 'electrical' | 'mechanical' | 'safety' | 'hvac' | 'civil' | 'general';
}

function mapScheduleCategory(cat: string = '', device: string = ''): 'electrical' | 'mechanical' | 'safety' | 'hvac' | 'civil' | 'general' {
  const d = device.toLowerCase().trim();
  if (d === 'door' || d.includes('civil') || d.includes('arsitektur') || d.includes('building')) return 'civil';
  const c = cat.toLowerCase().trim();
  if (c === 'cooling' || c === 'hvac') return 'hvac';
  if (c === 'security' || c === 'safety') return 'safety';
  if (c === 'plumbing' || c === 'mechanical') return 'mechanical';
  if (c === 'electrical') return 'electrical';
  if (c === 'civil') return 'civil';
  return 'general';
}

export const SCHEDULE_DATA: PMScheduleItem[] = MASTER_PM_SCHEDULES.map(s => ({
  device: s.device,
  location: s.location,
  months: s.months,
  remarks: s.remark || "Maintenance activity doesn't interfere equipment that is in operation condition",
  category: mapScheduleCategory(s.category, s.device)
}));

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const QUARTER_FILTERS = [
  { label: 'Semua', value: 'all' },
  { label: 'Q1 (Jan-Mar)', value: 'q1' },
  { label: 'Q2 (Apr-Jun)', value: 'q2' },
  { label: 'Q3 (Jul-Sep)', value: 'q3' },
  { label: 'Q4 (Okt-Des)', value: 'q4' },
];

const CATEGORY_FILTERS = [
  { label: 'Semua Kategori', value: 'all' },
  { label: 'Electrical', value: 'electrical' },
  { label: 'Mechanical', value: 'mechanical' },
  { label: 'Safety', value: 'safety' },
  { label: 'HVAC', value: 'hvac' },
  { label: 'Civil', value: 'civil' },
];

function getCurrentMonthIndex(): number {
  return new Date().getMonth();
}

function getDeviceScopeBadges(remarks: string) {
  const badges: string[] = [];
  const lower = remarks.toLowerCase();

  if (lower.includes('offline maintenance')) {
    badges.push('Offline PM');
  }

  if (lower.includes('operation condition') || lower.includes('operation')) {
    badges.push('Online PM');
  }

  if (lower.includes('consumable material')) {
    badges.push('Consumable');
  }

  if (lower.includes('special test')) {
    badges.push('Special Test');
  }

  if (badges.length === 0) {
    badges.push('Online PM');
  }

  return badges;
}

export function PMSchedule() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [quarterFilter, setQuarterFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedRemarksItem, setSelectedRemarksItem] = useState<PMScheduleItem | null>(null);
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);

  const isDwimitraAdmin = user?.email?.toLowerCase() === 'dwimitra@co.id';

  const currentMonth = getCurrentMonthIndex();

  const visibleMonths = useMemo(() => {
    switch (quarterFilter) {
      case 'q1': return [0, 1, 2];
      case 'q2': return [3, 4, 5];
      case 'q3': return [6, 7, 8];
      case 'q4': return [9, 10, 11];
      default: return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    }
  }, [quarterFilter]);

  const filteredData = useMemo(() => {
    return SCHEDULE_DATA.filter(item => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchDevice = item.device.toLowerCase().includes(q);
        const matchLocation = item.location.toLowerCase().includes(q);
        if (!matchDevice && !matchLocation) return false;
      }
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (quarterFilter !== 'all') {
        const hasAnyPlanInQuarter = visibleMonths.some(m => item.months[m] !== null);
        if (!hasAnyPlanInQuarter) return false;
      }
      return true;
    });
  }, [searchQuery, quarterFilter, categoryFilter, visibleMonths]);

  const totalDevices = SCHEDULE_DATA.length;
  const totalPlannedActivities = SCHEDULE_DATA.reduce((sum, item) => sum + item.months.filter(m => m !== null).length, 0);

  const getCellBadgeStyle = (plan: string | null, remarks: string = ''): string => {
    if (!plan) return '';
    const r = remarks.toLowerCase();
    if (r.includes('offline maintenance')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (r.includes('consumable') || r.includes('special test')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  return (
    <div className="w-full min-w-0 max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Preventive Maintenance Schedule 2026
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            PT Dwimitra Ekatama Mandiri / PT UTT — Neutra DC Cikarang
          </p>
        </div>

        {/* Stats Summary & WA Gateway Button */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {isDwimitraAdmin && (
            <button
              onClick={() => setIsWaModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-emerald-100" />
              WhatsApp Gateway &amp; H-60 Reminders
            </button>
          )}

          <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium">Total Equipment: </span>
            <span className="font-bold text-slate-900">{totalDevices}</span>
          </div>
          <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium">Total Rencana PM: </span>
            <span className="font-bold text-slate-900">{totalPlannedActivities}</span>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        {/* Left: Quarter Tabs (Compact Small Pills) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto no-scrollbar w-fit max-w-full shrink-0">
          {QUARTER_FILTERS.map((q) => (
            <button
              key={q.value}
              onClick={() => setQuarterFilter(q.value)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap shrink-0 ${
                quarterFilter === q.value
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Right: Search & Category Select */}
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-slate-400 shrink-0"
          >
            {CATEGORY_FILTERS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari equipment..."
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-slate-400 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* ── Legend Bar ── */}
      <div className="flex items-center gap-6 mb-3 px-1 text-xs text-slate-600 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
          <span>Offline PM</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span>Online PM</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span>Consumable / Special Test</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 ring-2 ring-sky-300 ring-offset-1 inline-block" />
          <span className="font-semibold text-slate-900">Bulan ini ({MONTHS_SHORT[currentMonth]})</span>
        </div>
      </div>

      {/* ── Enterprise Clean Table ── */}
      <div className="border border-slate-200 rounded-lg shadow-xs bg-white w-full min-w-0 max-w-full overflow-hidden">
        <div
          className="overflow-x-auto lg:overflow-y-auto lg:max-h-[calc(100vh-230px)] w-full min-w-0 max-w-full"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <table className="border-collapse text-left" style={{ width: '1280px', minWidth: '1280px' }}>
            <thead>
              <tr className="bg-slate-900 text-slate-200 text-xs font-semibold">
                <th className="sticky top-0 left-0 z-30 bg-slate-900 px-3 py-3 border-b border-slate-800 w-[150px] sm:w-[200px] min-w-[150px] sm:min-w-[200px] shadow-sm">
                  Equipment
                </th>
                <th className="lg:sticky lg:top-0 lg:z-20 bg-slate-900 px-3 py-3 border-b border-slate-800 w-[130px] min-w-[130px]">
                  Lokasi
                </th>
                {MONTHS_SHORT.map((month, idx) => (
                  <th
                    key={month}
                    className={`lg:sticky lg:top-0 lg:z-20 px-1 py-3 text-center border-b border-slate-800 w-[65px] min-w-[65px] ${
                      idx === currentMonth ? 'bg-sky-950 text-sky-300 font-bold' : ''
                    } ${!visibleMonths.includes(idx) ? 'opacity-40' : ''}`}
                  >
                    {month}
                  </th>
                ))}
                <th className="lg:sticky lg:top-0 lg:z-20 bg-slate-900 px-3 py-3 border-b border-slate-800 w-[240px] min-w-[200px]">
                  Catatan / Remarks
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={15} className="text-center py-12 text-slate-400">
                    Tidak ada data equipment yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, rowIdx) => {
                  return (
                    <tr
                      key={rowIdx}
                      className={`hover:bg-slate-50 transition-colors ${
                        rowIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      {/* Device Name Column (Sticky Freeze on Left) */}
                      <td className={`sticky left-0 z-10 px-3 py-3 font-semibold text-slate-900 border-r border-slate-200/90 shadow-sm w-[150px] sm:w-[200px] min-w-[150px] sm:min-w-[200px] ${
                        rowIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                      }`}>
                        <div>
                          <p className="font-extrabold text-slate-900 text-xs sm:text-sm tracking-tight">{item.device}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {getDeviceScopeBadges(item.remarks).map((b, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/80"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Location Column */}
                      <td className="px-3 py-2.5 text-slate-600">
                        {item.location}
                      </td>

                      {/* 12 Months Columns */}
                      {item.months.map((plan, monthIdx) => {
                        const isCurrentMonth = monthIdx === currentMonth;
                        return (
                          <td
                            key={monthIdx}
                            className={`px-1 py-2 text-center ${
                              isCurrentMonth ? 'bg-sky-50/60' : ''
                            } ${!visibleMonths.includes(monthIdx) ? 'opacity-30' : ''}`}
                          >
                            {plan ? (
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold border ${getCellBadgeStyle(plan, item.remarks)} ${
                                  isCurrentMonth ? 'ring-1 ring-sky-400' : ''
                                }`}
                                title={`${item.device} — ${MONTHS_FULL[monthIdx]}: ${plan}`}
                              >
                                {plan}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Remarks Column */}
                      <td className="px-3 py-2.5 text-slate-600">
                        <div className="flex items-center justify-between gap-2">
                          <p className="line-clamp-1 text-[11px] text-slate-500" title={item.remarks}>
                            {item.remarks}
                          </p>
                          <button
                            onClick={() => setSelectedRemarksItem(item)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer shrink-0"
                            title="Detail Remarks"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>Menampilkan {filteredData.length} dari {totalDevices} equipment</span>
        <span>Schedule PM 2026 — PT DEM / PT UTT</span>
      </div>

      {/* ── Modal Detail Remarks ── */}
      <AnimatePresence>
        {selectedRemarksItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRemarksItem(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[100]"
            />
            <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden"
              >
                <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                  <span className="font-semibold text-sm">Catatan Remarks — {selectedRemarksItem.device}</span>
                  <button
                    onClick={() => setSelectedRemarksItem(null)}
                    className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 space-y-3 text-xs">
                  <div className="flex justify-between text-slate-500 border-b border-slate-100 pb-2">
                    <span>Lokasi: <strong className="text-slate-800">{selectedRemarksItem.location}</strong></span>
                    <span>Kategori: <strong className="text-slate-800 uppercase">{selectedRemarksItem.category}</strong></span>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-700 block mb-1">Detail Instruksi / Catatan:</span>
                    <pre className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {selectedRemarksItem.remarks}
                    </pre>
                  </div>
                </div>

                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setSelectedRemarksItem(null)}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded transition cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── WhatsApp Gateway & Reminders Modal ── */}
      <WAGatewayModal
        isOpen={isWaModalOpen}
        onClose={() => setIsWaModalOpen(false)}
        currentUser={user}
        pmScheduleData={SCHEDULE_DATA}
      />
    </div>
  );
}
