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

// ─── SCHEDULE DATA (from official 2026 PM spreadsheet) ────────────────────────

interface PMScheduleItem {
  device: string;
  location: string;
  months: (string | null)[]; // 12 months: Jan..Dec, null = no plan
  remarks: string;
  category: 'electrical' | 'mechanical' | 'safety' | 'hvac' | 'civil' | 'general';
}

const SCHEDULE_DATA: PMScheduleItem[] = [
  {
    device: 'UPS',
    location: 'Elecroom and Power Room',
    months: [null, null, '02 - 06', null, null, '02 - 08', null, null, '01 - 07', null, null, '07 - 11'],
    remarks: '- Offline Maintenance\na. Deep cleaning module (partial)\nb. Tightening torque termination\n- Special Test\na. Test bypass static & manual bypass\nb. Mechanical test\nc. Electrical test\nd. Alarm test\ne. Integration system test',
    category: 'electrical'
  },
  {
    device: 'CRAC Data Hall & Supporting Room',
    location: 'CRAC Room 3 & 4',
    months: [null, null, '25 - 31', null, null, '22 - 26', null, null, '21 - 25', null, null, '07 - 11'],
    remarks: '- Special Test\na. EC Fan and motorized valve control\nb. Simulated alarm test\nc. Automatic back up test\nd. ATS test\ne. Interlock simulation',
    category: 'hvac'
  },
  {
    device: 'Chiller',
    location: '1F Power House',
    months: [null, '18 - 24', null, null, '18 - 22', null, null, '18 - 24', null, null, '16 - 20', null],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'hvac'
  },
  {
    device: 'Cooling Tower',
    location: '4F Power House',
    months: [null, '18 - 24', null, null, '18 - 22', null, null, '18 - 24', null, null, '16 - 20', null],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'hvac'
  },
  {
    device: 'Cooling Pump',
    location: '1F Power House',
    months: [null, null, '09 - 13', null, null, '08 - 12', null, null, '07 - 11', null, null, '07 - 11'],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'mechanical'
  },
  {
    device: 'ATS',
    location: 'Power Room and Elec Room',
    months: [null, null, '02 - 06', null, null, '02 - 08', null, null, '01 - 07', null, null, '07 - 11'],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'electrical'
  },
  {
    device: 'Transformer',
    location: 'Power Room and Trafo Room',
    months: [null, '23 - 27', null, null, '22 - 29', null, null, '24 - 31', null, null, '16 - 20', null],
    remarks: '- Offline Maintenance\na. Repaint (if necessary)\nb. Tightening torque termination\nc. TTR measurement\nd. Insulation measurement\n- Special Test\na. Protection system test (Protection Relay, Temperature control)',
    category: 'electrical'
  },
  {
    device: 'Generator & Fuel System',
    location: '2F Power House',
    months: [null, '16 - 23', null, null, '18 - 22', null, null, '18 - 31', null, null, '16 - 20', null],
    remarks: '- Consumable Material Replacement\na. Oil engine & oil filter\nb. Filter water separator\nc. Oil separator water element\nd. Air filter & coolant (if necessary)\ne. Fuel pre-filter & fuel filter\n- Special Test\na. Test performance with dummy load\nb. Fuel, oil, and coolant test lab',
    category: 'electrical'
  },
  {
    device: 'MV and RMU Panel',
    location: 'MV Room',
    months: [null, null, '23 - 27', null, null, '15 - 22', null, null, '14 - 18', null, null, '14 - 18'],
    remarks: '- Offline Maintenance\na. Cleaning CT/VT, cubicle, circuit breaker, protection relay\nb. Tightening torque termination\n- Special Test\na. Protection relay test\nb. Mechanical test\nc. Electrical test',
    category: 'electrical'
  },
  {
    device: 'LV Panel',
    location: 'Power Room',
    months: [null, '23 - 27', null, null, '04 - 08', null, null, '03 - 07', null, null, '02 - 06', null],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'electrical'
  },
  {
    device: 'PDU Panel',
    location: 'CRAC Room 1-4',
    months: [null, '13 - 20', null, null, '18 - 22', null, null, '18 - 24', null, null, '16 - 20', null],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'electrical'
  },
  {
    device: 'FSS',
    location: 'ALL Area Campus',
    months: [null, '16 - 27', null, null, '18 - 29', null, null, '17 - 28', null, null, '16 - 30', null],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'safety'
  },
  {
    device: 'Hydrant System',
    location: 'ALL Area Campus',
    months: ['19 - 23', null, null, '20 - 24', null, null, '20 - 24', null, null, '19 - 23', null, null],
    remarks: '- Consumable Material Replacement\na. Oil engine & oil filter\nb. Filter water separator\nc. Oil separator water element\nd. Air filter & coolant (if necessary)\ne. Accu\n- Special Test\na. Fuel and oil lab test',
    category: 'safety'
  },
  {
    device: 'Pre-Action System',
    location: 'ALL Area Campus',
    months: [null, '02 - 06', null, null, '04 - 08', null, null, '03 - 07', null, null, '02 - 06', null],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'safety'
  },
  {
    device: 'Lighting Point',
    location: 'ALL Area Campus',
    months: [null, null, '16 - 27', null, null, '15 - 26', null, null, '14 - 25', null, null, '07 - 18'],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'electrical'
  },
  {
    device: 'Grounding System',
    location: 'ALL Area Campus',
    months: [null, null, '16 - 27', null, null, '15 - 26', null, null, '14 - 25', null, null, '07 - 18'],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'electrical'
  },
  {
    device: 'Lightning Protection System',
    location: 'ALL Area Campus',
    months: [null, '09 - 13', null, null, '11 - 18', null, null, '10 - 14', null, null, '09 - 13', null],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'electrical'
  },
  {
    device: 'Water Leak',
    location: 'ALL Area Campus',
    months: ['05 - 08', null, null, '06 - 10', null, null, '06 - 10', null, null, '05 - 09', null, null],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'safety'
  },
  {
    device: 'Fuel Leak',
    location: 'Ground Tank',
    months: ['12 - 19', null, null, '13 - 17', null, null, '13 - 17', null, null, '12 - 16', null, null],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'safety'
  },
  {
    device: 'FCU',
    location: 'ALL Area Campus',
    months: ['05 - 14', null, null, '06 - 15', null, null, '06 - 15', null, null, '05 - 14', null, null],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'hvac'
  },
  {
    device: 'AHU',
    location: 'ALL Area Campus',
    months: ['27 - 30', null, null, '27 - 30', null, null, '27 - 30', null, null, '26 - 29', null, null],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'hvac'
  },
  {
    device: 'VRV',
    location: 'Office',
    months: [null, '16 - 27', null, null, '18 - 29', null, null, '18 - 31', null, null, '09 - 20', null],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'hvac'
  },
  {
    device: 'AC Splits',
    location: 'Office and Campus',
    months: [null, '24 - 27', null, null, '25 - 29', null, null, '24 - 28', null, null, '23 - 27', null],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'hvac'
  },
  {
    device: 'Cooling Tower Water Treatment',
    location: '4F Power House',
    months: ['05 - 09', '02 - 06', '02 - 06', '06 - 10', '04 - 08', '02 - 05', '06 - 10', '03 - 07', '01 - 04', '05 - 09', '02 - 06', '07 - 11'],
    remarks: '- Consumable Material Replacement\na. Chemical refill',
    category: 'hvac'
  },
  {
    device: 'Lift Units',
    location: 'Office and Campus',
    months: ['08 - 15', '09 - 13', '09 - 13', '13 - 17', '11 - 19', '08 - 15', '06 - 10', '10 - 14', '07 - 11', '05 - 09', '09 - 13', '07 - 11'],
    remarks: '- Consumable Material Replacement\na. Battery',
    category: 'mechanical'
  },
  {
    device: 'Panel LDB & RDB (Distribution)',
    location: 'All Area',
    months: [null, null, '04 - 13', null, null, '16 - 26', null, null, '16 - 25', null, null, '09 - 18'],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'electrical'
  },
  {
    device: 'PJU',
    location: 'Outdoor Area',
    months: ['19 - 30', null, null, null, '18 - 29', null, null, '18 - 31', null, null, '16 - 27', null],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'electrical'
  },
  {
    device: 'Gate',
    location: 'Outdoor Area',
    months: ['26 - 30', null, null, '24 - 30', null, null, '27 - 31', null, null, '26 - 30', null, null],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'mechanical'
  },
  {
    device: 'Road Blocker',
    location: 'Outdoor Area',
    months: [null, null, null, null, '04 - 05', null, null, null, null, null, '05 - 06', null],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'mechanical'
  },
  {
    device: 'Dock Leveler',
    location: 'CAMPUS 1',
    months: ['12 - 15', null, null, '13 - 17', null, null, '13 - 17', null, null, '12 - 16', null, null],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'mechanical'
  },
  {
    device: 'X-Ray',
    location: 'Post Bravo',
    months: [null, '12 - 13', null, '13 - 14', null, '11 - 12', null, '10 - 11', null, '12 - 13', null, '14 - 15'],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'safety'
  },
  {
    device: 'Pressurization & Degassing',
    location: '1F Power House',
    months: [null, null, '25 - 27', null, null, '24 - 26', null, null, '22 - 24', null, null, '16 - 18'],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'safety'
  },
  {
    device: 'Pumps',
    location: 'All Area',
    months: [null, null, '10 - 14', null, null, '09 - 13', null, null, '08 - 12', null, null, '01 - 05'],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'mechanical'
  },
  {
    device: 'STP & Plumbing',
    location: 'All Area',
    months: ['26 - 30', null, null, '23 - 30', null, null, '27 - 31', null, null, '26 - 30', null, null],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'civil'
  },
  {
    device: 'Door',
    location: 'All Area',
    months: ['12 - 15', null, null, '13 - 17', null, null, '13 - 17', null, null, '12 - 16', null, null],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'civil'
  },
  {
    device: 'Water Softener',
    location: 'Water Softener Room',
    months: [null, '23 - 25', null, null, '25 - 28', null, null, '26 - 28', null, null, '23 - 25', null],
    remarks: '- Consumable Material Replacement\na. Chemical/brine refill',
    category: 'mechanical'
  },
  {
    device: 'Exhaust Fan',
    location: 'PH and Campus',
    months: ['26 - 30', null, null, '24 - 30', null, null, '27 - 31', null, null, '26 - 30', null, null],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'hvac'
  },
  {
    device: 'Busduct',
    location: 'PH and Campus',
    months: [null, null, '09 - 13', null, null, '08 - 12', null, null, '07 - 11', null, null, '07 - 11'],
    remarks: "Maintenance activity doesn't interfere equipment that is in operation condition",
    category: 'electrical'
  },
  {
    device: 'Capacitor Bank',
    location: 'Campus and PH Office',
    months: ['26 - 30', null, null, '27 - 30', null, null, '27 - 31', null, null, '26 - 30', null, null],
    remarks: '- Special Test\na. Capacitance and impedance measurement (partial)',
    category: 'electrical'
  },
  {
    device: 'Physical Cooling Automation',
    location: 'All Area',
    months: [null, null, '16 - 31', null, null, '15 - 30', null, null, '17 - 30', null, null, '07 - 18'],
    remarks: 'Maintenance activity performed in operation condition',
    category: 'hvac'
  },
];

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
