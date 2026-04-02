import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
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
  LogIn,
  ShieldCheck,
  UserCircle
} from 'lucide-react';
import logoUTT from '@/assets/logo_utt.png';
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
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { toast } from 'sonner';
import { 
  calculateMaintenanceSummary, 
  type MaintenanceProgress, 
  type MaintenanceSummary 
} from '@/utils/MaintenanceLogic';

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
      className="flex flex-col items-center justify-center p-3 md:p-6 rounded-[2.5rem] bg-slate-950/20 border border-white/5 backdrop-blur-xl hover:border-white/10 transition-all duration-500 group relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      
      <div className="relative w-20 h-20 md:w-32 md:h-32 flex items-center justify-center mb-3 md:mb-5">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 drop-shadow-[0_0_8px_rgba(0,0,0,0.3)]">
          <defs>
            <linearGradient id={`gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={glowColor} stopOpacity="1" />
            </linearGradient>
            <filter id={`glow-${uniqueId}`}>
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {/* Background Track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-white/[0.03]"
            strokeWidth="4"
          />
          {/* Progress Stroke */}
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={`url(#gradient-${uniqueId})`}
            strokeWidth="5"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ delay: delay + 0.4, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ 
              strokeDasharray: circumference,
              filter: `drop-shadow(0 0 5px ${glowColor}66)`
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-baseline">
            <span className="text-sm md:text-3xl font-black text-white tracking-tighter">
              {label === 'Harian' && percent > 0 ? '+' : ''}{percent.toFixed(2)}
            </span>
            <span className="text-[8px] md:text-sm font-bold text-white/50 ml-0.5">%</span>
          </div>
          {sublabel && (
            <span className="hidden md:block text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-widest leading-none">
              {sublabel}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-1">
        <p className="text-[8px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] group-hover:text-white transition-colors duration-300">
          {label}
        </p>
        <div className="h-0.5 w-4 rounded-full bg-white/10 group-hover:w-8 group-hover:bg-indigo-500 transition-all duration-500" />
      </div>
    </motion.div>
  );
}

export function SiteManagerDashboard({ onLogin }: { onLogin?: () => void }) {
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

  // Direct Auto-Adjustment for Excel Data - Full Reset (v5 - 31 Mar 2026)
  useEffect(() => {
    if (user && activities.length > 0 && !localStorage.getItem('excel_sync_v5_done')) {
      handleExcelSync(true).then(() => {
        localStorage.setItem('excel_sync_v5_done', 'true');
      });
    }
  }, [user, activities.length]);

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
    } finally {
      setLoading(false);
    }
  };

  const handleExcelSync = async (isAuto = false) => {
    if (!isAuto && !window.confirm('Ingin melakukan reset penuh database dengan data Excel 31 Mar 2026? Semua data lama untuk periode ini akan dihapus dan dibuat ulang.')) return;
    
    setLoading(true);
    try {
      // ========================================================
      // DATA FINAL - PROGRESS Q1 2026, per 31 Mar 2026
      // TOTAL PLAN: 5110 | YESTERDAY: 4558.67 (89.21%) | TODAY: 4589 (89.80%)
      // Verified manually per-item from spreadsheet screenshot
      // ========================================================
      const officialData = [
        // A. ELECTRICAL SYSTEM: Plan=640, Yes=524, Today=541
        // Verification: 8+15+20+7+52+161+175+119+19+6+4+40+14 = 640 ✓
        // Yes: 8+15+0+7+52+130+154+111+19+6+0+22+0 = 524 ✓
        // Today: 8+15+0+7+52+130+154+111+19+6+0+39+0 = 541 ✓
        { cat: "A. ELECTRICAL SYSTEM", name: "TRANSFORMATOR",                   plan: 8,    yes: 8,      today: 8    },
        { cat: "A. ELECTRICAL SYSTEM", name: "AUTOMATIC TRANSFER SWITCH (ATS)", plan: 15,   yes: 15,     today: 15   },
        { cat: "A. ELECTRICAL SYSTEM", name: "MV & RMU PANEL",                  plan: 20,   yes: 0,      today: 0    },
        { cat: "A. ELECTRICAL SYSTEM", name: "LV PANEL",                        plan: 7,    yes: 7,      today: 7    },
        { cat: "A. ELECTRICAL SYSTEM", name: "PDU PANEL",                       plan: 52,   yes: 52,     today: 52   },
        { cat: "A. ELECTRICAL SYSTEM", name: "LDB & RDB PANEL",                 plan: 161,  yes: 130,    today: 130  },
        { cat: "A. ELECTRICAL SYSTEM", name: "GROUNDING",                       plan: 175,  yes: 154,    today: 154  },
        { cat: "A. ELECTRICAL SYSTEM", name: "LIGHTNING PROTECTION",            plan: 119,  yes: 111,    today: 111  },
        { cat: "A. ELECTRICAL SYSTEM", name: "UNINTERRUPTIBLE POWER SUPPLY (UPS)",plan: 19, yes: 19,     today: 19   },
        { cat: "A. ELECTRICAL SYSTEM", name: "GENERATOR SET (GENSET)",          plan: 6,    yes: 6,      today: 6    },
        { cat: "A. ELECTRICAL SYSTEM", name: "LOAD & CAP BANK",                 plan: 4,    yes: 0,      today: 0    },
        { cat: "A. ELECTRICAL SYSTEM", name: "BUSDUCT",                         plan: 40,   yes: 22,     today: 39   },
        { cat: "A. ELECTRICAL SYSTEM", name: "EXHAUST FAN",                     plan: 14,   yes: 0,      today: 0    },

        // B. COOLING SYSTEM: Plan=371, Yes=160, Today=162
        // Verification: 3+12+133+3+40+25+126+12+11+6 = 371 ✓
        // Yes: 3+0+0+0+0+25+112+12+8+0 = 160 ✓ | Today: 3+0+0+0+0+25+114+12+8+0 = 162 ✓
        { cat: "B. COOLING SYSTEM", name: "COOLING TOWER",                      plan: 3,    yes: 3,      today: 3    },
        { cat: "B. COOLING SYSTEM", name: "COOLING PUMP",                       plan: 12,   yes: 0,      today: 0    },
        { cat: "B. COOLING SYSTEM", name: "PHYSICAL COOLING AUTOMATION & TEST TAN", plan: 133, yes: 0,   today: 0    },
        { cat: "B. COOLING SYSTEM", name: "CHILLER",                            plan: 3,    yes: 0,      today: 0    },
        { cat: "B. COOLING SYSTEM", name: "CRAC",                               plan: 40,   yes: 0,      today: 0    },
        { cat: "B. COOLING SYSTEM", name: "FCU",                                plan: 25,   yes: 25,     today: 25   },
        { cat: "B. COOLING SYSTEM", name: "VRV",                                plan: 126,  yes: 112,    today: 114  },
        { cat: "B. COOLING SYSTEM", name: "PAHU",                               plan: 12,   yes: 12,     today: 12   },
        { cat: "B. COOLING SYSTEM", name: "SPLITWALL",                          plan: 11,   yes: 8,      today: 8    },
        { cat: "B. COOLING SYSTEM", name: "Presuraziation & Degassing",         plan: 6,    yes: 0,      today: 0    },

        // C. FIRE SYSTEM: Plan=1116, Yes=970, Today=997
        // Verification: 942+167+7 = 1116 ✓ | Yes: 834+129+7=970 ✓ | Today: 861+129+7=997 ✓
        { cat: "C. FIRE SYSTEM", name: "FSS",                                   plan: 942,  yes: 834,    today: 861  },
        { cat: "C. FIRE SYSTEM", name: "Hydrant System",                        plan: 167,  yes: 129,    today: 129  },
        { cat: "C. FIRE SYSTEM", name: "PREACTION",                             plan: 7,    yes: 7,      today: 7    },

        // D. FUEL SYSTEM: Plan=27, Yes=27, Today=27
        // Verification: 13+14 = 27 ✓
        { cat: "D. FUEL SYSTEM", name: "Fuel Pump",                             plan: 13,   yes: 13,     today: 13   },
        { cat: "D. FUEL SYSTEM", name: "FUEL TANK",                             plan: 14,   yes: 14,     today: 14   },

        // E. LIFTING SYSTEM (formerly PESAWAT ANGKUT): Plan=24, Yes=7.67, Today=17
        // Lift Units: 3 rows x 7 = 21 plan | Yes=4.67, Today=14 (3x row: 14.00 @ 66.67%)
        // Dock Leveller: plan=3, yes=3, today=3
        // Total: 21+3=24 ✓ | Yes: 4.67+3=7.67 ✓ | Today: 14+3=17 ✓
        { cat: "E. LIFTING SYSTEM", name: "Lift Units",                         plan: 21,   yes: 4.67,   today: 14   },
        { cat: "E. LIFTING SYSTEM", name: "DOCK LEVELLER",                      plan: 3,    yes: 3,      today: 3    },

        // F. LEAK DETECTION: Plan=115, Yes=115, Today=115
        // Verification: 75+40 = 115 ✓
        { cat: "F. LEAK DETECTION", name: "Water Leak",                         plan: 75,   yes: 75,     today: 75   },
        { cat: "F. LEAK DETECTION", name: "FUEL LEAK DETECTION",                plan: 40,   yes: 40,     today: 40   },

        // G. PLUMBING SYSTEM: Plan=40, Yes=5, Today=5
        // STP: 4 | Water Treatment: 3 rows x 1 = 3 total plan, yes=1, today=1 | Pump: 33
        // Total: 4+3+33 = 40 ✓ | Yes: 4+1+0=5 ✓ | Today: 4+1+0=5 ✓
        { cat: "G. PLUMBING SYSTEM", name: "STP",                               plan: 4,    yes: 4,      today: 4    },
        { cat: "G. PLUMBING SYSTEM", name: "WATER TREATMENT",                   plan: 3,    yes: 1,      today: 1    },
        { cat: "G. PLUMBING SYSTEM", name: "PUMP",                              plan: 33,   yes: 0,      today: 0    },

        // H. GATE & DOOR: Plan=27, Yes=0, Today=10
        // Gate: 7, yes=0, today=4 (57.14%) | Road Blocker: PM Q2 (plan=0, skip) | Door: 14 | X-Ray: 6
        // Total: 7+14+6 = 27 ✓ | Yes: 0 ✓ | Today: 4+0+6 = 10 ✓
        { cat: "H. GATE & DOOR", name: "Gate",                                  plan: 7,    yes: 0,      today: 4    },
        { cat: "H. GATE & DOOR", name: "DOOR",                                  plan: 14,   yes: 0,      today: 0    },
        { cat: "H. GATE & DOOR", name: "X-RAY",                                 plan: 6,    yes: 0,      today: 6    },

        // I. LIGHTING SYSTEM: Plan=2750, Yes=2750, Today=2715
        // PJU & ALL LIGHTING: 2750, today=2715 (98.73%)
        { cat: "I. LIGHTING SYSTEM", name: "PJU & ALL LIGHTING",                plan: 2750, yes: 2750,   today: 2715 },
      ];

      // STRATEGY: Full DELETE then INSERT for guaranteed 100% accuracy
      // Step 1: Fetch all current records for this period
      const existingQuery = query(
        collection(db, 'maintenance_progress'),
        where('year', '==', selectedYear),
        where('quarter', '==', selectedQuarter)
      );
      const existingSnap = await getDocs(existingQuery);

      // Step 2: Delete everything in this period
      const deleteBatch = writeBatch(db);
      existingSnap.docs.forEach(d => deleteBatch.delete(d.ref));
      await deleteBatch.commit();

      // Step 3: Insert fresh from officialData
      const insertBatch = writeBatch(db);
      officialData.forEach(item => {
        const newRef = doc(collection(db, 'maintenance_progress'));
        insertBatch.set(newRef, {
          category:       item.cat,
          equipment_name: item.name,
          plan_qty:       item.plan,
          yesterday_qty:  item.yes,
          actual_qty:     item.today,
          year:           selectedYear,
          quarter:        selectedQuarter,
          remark:         '',
          createdAt:      serverTimestamp()
        });
      });
      await insertBatch.commit();

      toast.success('✅ Database direset & disinkronkan sempurna! Total: 5110 unit | 89.80%');
    } catch (err) {
      console.error(err);
      toast.error('Gagal sinkronisasi excel');
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
    <div className="min-h-screen text-slate-200">
      <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex flex-col py-3 md:py-4 gap-3 md:gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3 min-w-0 max-w-[65%] md:max-w-none">
                {user ? (
                  <>
                    <div className="hidden sm:block p-3 bg-slate-900 border border-slate-800 rounded-2xl">
                       <LayoutDashboard className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                       <h1 className="text-sm md:text-3xl font-black text-white tracking-tight leading-none mb-1 uppercase">
                          Dashboard Progres
                       </h1>
                       <div className="flex items-center gap-2 text-indigo-400 text-[8px] sm:text-xs font-bold uppercase tracking-wider">
                          <ShieldCheck className="w-3.5 h-3.5" /> Monitoring Real-time
                       </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <img
                      src={logoUTT}
                      alt="PT United Transworld Trading"
                      className="w-8 h-8 sm:w-10 sm:h-10 md:w-16 md:h-16 flex-shrink-0 object-contain"
                    />
                    <div className="min-w-0">
                      <h1 className="text-[9px] sm:text-sm md:text-lg font-black text-white tracking-tight leading-none mb-0.5 uppercase whitespace-nowrap overflow-hidden text-ellipsis">
                        PT United Transworld Trading
                      </h1>
                      <div className="flex items-center gap-2 text-indigo-400 text-[7px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                        Maintenance Progress Report
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!user ? (
                <button
                  onClick={onLogin}
                  className="px-3 py-1.5 md:px-8 md:py-3 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all flex items-center justify-center gap-1.5 font-black text-[9px] md:text-sm tracking-wide flex-shrink-0 ml-1"
                >
                  <LogIn className="w-3.5 h-3.5 md:w-5 md:h-5" />
                  <span>Login</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="p-2 md:px-4 md:py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2 group flex-shrink-0"
                >
                  <UserCircle className="w-5 h-5 md:w-6 md:h-6" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-xl border border-white/5">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-transparent text-slate-300 text-[10px] sm:text-xs font-bold px-2 py-1 outline-none cursor-pointer uppercase"
                >
                  <option value={2026} className="bg-slate-900">2026</option>
                  <option value={2025} className="bg-slate-900">2025</option>
                </select>
                <div className="w-px h-3 bg-white/10" />
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  className="bg-transparent text-slate-300 text-[10px] sm:text-xs font-bold px-2 py-1 outline-none cursor-pointer uppercase"
                >
                  <option value="Q1" className="bg-slate-900">Q1</option>
                  <option value="Q2" className="bg-slate-900">Q2</option>
                  <option value="Q3" className="bg-slate-900">Q3</option>
                  <option value="Q4" className="bg-slate-900">Q4</option>
                </select>
              </div>

              {user && (
                <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-xl border border-white/5 ml-auto">
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-3 py-1.5 rounded-lg transition-all text-[10px] sm:text-xs font-bold uppercase ${
                      activeTab === 'summary' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Summary
                  </button>
                  <button
                    onClick={() => setActiveTab('input')}
                    className={`px-3 py-1.5 rounded-lg transition-all text-[10px] sm:text-xs font-bold uppercase ${
                      activeTab === 'input' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Input Data
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'summary' ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {summary && (
                <>
                  <div className="grid grid-cols-3 gap-3 md:gap-12 max-w-5xl mx-auto py-6">
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

                  <div className="bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
                    <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between">
                      <h3 className="text-xs md:text-lg font-black uppercase tracking-widest text-slate-400">Ringkasan Progres</h3>
                      {user && (
                        <button
                          onClick={() => import('@/utils/ResumePdfExport').then(m => m.generateResumePdf(summary))}
                          className="p-2 md:px-4 md:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all flex items-center gap-2 text-[10px] md:text-sm font-bold uppercase tracking-wider"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">PDF Report</span>
                        </button>
                      )}
                    </div>
                    
                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
                      <table className="w-full text-center border-collapse min-w-[700px]">
                        <thead>
                          <tr className="bg-slate-900/50 text-[8px] md:text-[11px] font-black tracking-[0.2em] text-slate-400 uppercase">
                            <th rowSpan={3} className="sticky left-0 z-30 bg-slate-950 p-3 md:px-4 border border-white/5 w-10 md:w-16 shadow-[2px_0_10px_rgba(0,0,0,0.3)]">NO</th>
                            <th rowSpan={3} className="sticky left-10 md:left-16 z-30 bg-slate-950 p-3 md:px-6 border border-white/5 min-w-[140px] md:min-w-[280px] text-center shadow-[4px_0_15px_rgba(0,0,0,0.3)]">KATEGORI</th>
                            <th colSpan={2} className="p-3 border border-white/5 bg-indigo-500/10 text-indigo-400">PLAN</th>
                            <th colSpan={4} className="p-3 border border-white/5 bg-emerald-500/10 text-emerald-400">PROGRESS</th>
                          </tr>
                          <tr className="bg-white/[0.01] text-[7px] md:text-[9px]">
                            <th rowSpan={2} className="p-1 md:p-3 border border-white/5 bg-indigo-500/5">QTY</th>
                            <th rowSpan={2} className="p-1 md:p-3 border border-white/5 bg-indigo-500/5">WEIGHT %</th>
                            <th colSpan={2} className="p-1 md:p-3 border border-white/5 bg-emerald-500/5">YESTERDAY</th>
                            <th colSpan={2} className="p-1 md:p-3 border border-white/5 bg-purple-500/5 text-purple-400">TODAY</th>
                          </tr>
                          <tr className="text-[6px] md:text-[8px] text-slate-600">
                            <th className="p-1 md:p-2 border border-white/5">QTY</th>
                            <th className="p-1 md:p-2 border border-white/5">%</th>
                            <th className="p-1 md:p-2 border border-white/5">QTY</th>
                            <th className="p-1 md:p-2 border border-white/5">%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {summary.category_summaries.map((cat, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.02] transition-all group">
                              <td className="sticky left-0 z-20 bg-slate-900 group-hover:bg-slate-800/90 p-2 md:px-4 border border-white/5 text-slate-500 font-bold font-mono">
                                1.{idx + 1}
                              </td>
                              <td className="sticky left-10 md:left-16 z-20 bg-slate-900 group-hover:bg-slate-800/90 p-2 md:px-6 border border-white/5 text-center">
                                <span className="font-bold text-slate-200 uppercase text-[9px] md:text-sm tracking-tight">{cat.category}</span>
                              </td>
                              <td className="p-2 md:p-4 border border-white/5 text-slate-400">{cat.plan_qty.toLocaleString()}</td>
                              <td className="p-2 md:p-4 border border-white/5 text-indigo-400 font-bold">{cat.weight_percent.toFixed(2)}%</td>
                              <td className="p-2 md:p-4 border border-white/5 text-slate-500">{cat.yesterday_qty.toLocaleString()}</td>
                              <td className="p-2 md:p-4 border border-white/5 text-emerald-400 font-black">{cat.yesterday_percent.toFixed(2)}%</td>
                              <td className="p-2 md:p-4 border border-white/5 text-slate-500">{cat.today_qty.toLocaleString()}</td>
                              <td className="p-2 md:p-4 border border-white/5 text-purple-400 font-black">{cat.today_percent.toFixed(2)}%</td>
                            </tr>
                          ))}
                          <tr className="bg-slate-950 font-black text-[10px] md:text-base border-t-2 border-indigo-500/30">
                            <td colSpan={2} className="sticky left-0 z-20 bg-slate-950 p-4 md:p-8 text-white uppercase tracking-[0.3em] text-right border border-white/5">
                              TOTAL
                            </td>
                            <td className="p-2 border border-white/5 text-slate-400">{summary.total_plan_qty.toLocaleString()}</td>
                            <td className="p-2 border border-white/5 text-indigo-400">100.00%</td>
                            <td className="p-2 border border-white/5 text-slate-500">{summary.total_yesterday_qty.toLocaleString()}</td>
                            <td className="p-2 border border-white/5 text-emerald-400 tracking-tighter">{summary.total_yesterday_percent.toFixed(2)}%</td>
                            <td className="p-2 border border-white/5 text-slate-500">{summary.total_today_qty.toLocaleString()}</td>
                            <td className="p-2 border border-white/5 text-purple-400 tracking-tighter">{summary.total_today_percent.toFixed(2)}%</td>
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
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search equipment or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={handleEndDay}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all flex items-center gap-2 border border-white/5"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Akhiri Hari & Freeze
                </button>
              </div>

              <div className="bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-white/[0.02] text-slate-500 text-[10px] font-black uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4 text-left">Equipment</th>
                        <th className="px-6 py-4 text-center">Plan Qty</th>
                        <th className="px-6 py-4 text-center">Period</th>
                        <th className="px-6 py-4 text-center w-32">Actual</th>
                        <th className="px-6 py-4 text-center">Progres</th>
                        <th className="px-6 py-4 text-left">Remark</th>
                        <th className="px-6 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
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
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {user && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 group border-b-4 border-indigo-800"
        >
          <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
        </motion.button>
      )}

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
          <div className="flex items-center gap-2 text-[10px] md:text-[11px] text-slate-500 font-medium">
            <span>{activity.plan_start}</span>
            <ArrowRight className="w-3 h-3 text-slate-600" />
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
