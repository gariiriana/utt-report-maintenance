import { useState, useEffect, useMemo, Fragment, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, FileText, FileSpreadsheet,
  Plus, Trash2, Search, RefreshCw,
  TrendingUp, CheckCircle, XCircle,
  Folder, ChevronLeft, Pencil, Camera, Upload, X, UserPlus, Save
} from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp, where, updateDoc, writeBatch, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { loadLogoBase64 } from '@/utils/ReportPdfExport';

interface AttendanceRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  nama: string;
  kehadiran: 'Hadir' | 'Tidak Hadir' | 'Libur';
  jabatan: string;
  remark: string;
  category?: string;
}

interface Personnel {
  id: string;
  nama: string;
  jabatan: string;
  category: string;
}

interface DocumentationRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  isDocumentation: true;
  photos: string[]; // array of base64 compressed photos
  category?: string;
}

const TBM_LISTS: Record<'UTT Daily' | 'UTT Mobile' | 'DME', Array<{ nama: string; jabatan: string }>> = {
  'UTT Daily': [
    { nama: 'ACEP FAAIZANIE KARIM MULYADI', jabatan: 'Teknisi' },
    { nama: 'TONGGO SIJABAT', jabatan: 'Teknisi' },
    { nama: 'MUHAMMAD RAMADHAN', jabatan: 'Teknisi' },
    { nama: 'GARI IRIANA', jabatan: 'Teknisi' },
    { nama: 'ADI SETIAWAN', jabatan: 'Teknisi' },
    { nama: 'HESTI MUJI', jabatan: 'Admin' },
    { nama: 'AULIA GUSLIANA', jabatan: 'Admin' },
    { nama: 'MAMIEK SLAMET SUGIYANTO', jabatan: 'Teknisi' },
    { nama: 'TUGINO', jabatan: 'Teknisi' },
    { nama: 'ASEP MUHAMMAD FAUZI', jabatan: 'Shift Engineer' },
    { nama: 'FERY HALASSON S', jabatan: 'Teknisi' },
    { nama: 'PETRA N.B WARBANARAN', jabatan: 'Teknisi' },
    { nama: 'ARIF BUDIMAN', jabatan: 'Project Manager' },
    { nama: 'IFRIADI', jabatan: 'Teknisi' },
    { nama: 'IMRON', jabatan: 'Teknisi' },
    { nama: 'AGUNG SETYABUDI', jabatan: 'Teknisi' },
    { nama: 'AGIL ZAKIA RAHMAN', jabatan: 'Shift Engineer' },
    { nama: 'MUHAMMAD SALMAN ABDUROHMAN', jabatan: 'Shift Engineer' },
    { nama: 'BUDI PURWO DARSONO', jabatan: 'Teknisi' },
    { nama: 'DISON MINTUNO ANDARBENI', jabatan: 'Shift Engineer' },
    { nama: 'NUGROHO GILANG RAMADHAN', jabatan: 'Shift Engineer' },
    { nama: 'RIYAN BUDI NUGROHO', jabatan: 'Teknisi' },
    { nama: 'TOPIK HIDAYAT', jabatan: 'Teknisi' },
    { nama: 'MUHAMMAD NISKA LEGIANA', jabatan: 'Teknisi' },
    { nama: 'HENDRI KUSUMA WIJAYA', jabatan: 'Teknisi' },
  ],
  'UTT Mobile': [
    { nama: 'TAUFIK HIDAYATULLOH', jabatan: 'Project Koordinator' },
    { nama: 'EKO WAHYONO', jabatan: 'Teknisi' },
    { nama: 'EKO WALUYO', jabatan: 'Teknisi' },
    { nama: 'SULARDI', jabatan: 'Teknisi' },
    { nama: 'AGUS SAPUTRA', jabatan: 'Teknisi' },
    { nama: 'INDRA MULYADI', jabatan: 'Teknisi' },
    { nama: 'SURYADI', jabatan: 'Teknisi' },
    { nama: 'SUKANWAR', jabatan: 'Teknisi' },
    { nama: 'ROFIQ ROSYADI', jabatan: 'Teknisi' },
    { nama: 'MUHTAS', jabatan: 'Teknisi' },
    { nama: 'RAHMAT ARIEF', jabatan: 'Teknisi' },
  ],
  'DME': [
    { nama: 'WAHYUDI MURSAL', jabatan: 'Teknisi' },
    { nama: 'DWI TASMIYADI', jabatan: 'Project Manager' },
    { nama: 'JOHAN', jabatan: 'Co Pm' },
    { nama: 'RIZKI NOVRI YANDA', jabatan: 'Teknisi' },
    { nama: 'MUHAMMAD RIFALDI', jabatan: 'Teknisi' },
    { nama: 'SANDI RIANTORO KHOTIADI', jabatan: 'Teknisi' },
  ]
};

const getIndonesianMonthYear = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 2) return dateStr;
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${monthNames[monthIdx]} ${parts[0]}`;
};

const formatIndonesianDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${parts[2]} ${monthNames[monthIdx]} ${parts[0]}`;
};

export function AbsenTBM() {
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [docRecords, setDocRecords] = useState<DocumentationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRightTab, setActiveRightTab] = useState<'chart' | 'list'>('chart');
  const webChartCanvasRef = useRef<HTMLCanvasElement>(null);

  // Folder navigation state
  const [viewLevel, setViewLevel] = useState<'month' | 'date' | 'records'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [recordsViewMode, setRecordsViewMode] = useState<'folder' | 'matrix'>('matrix');

  // Date delete confirmation modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);

  // Dynamic Personnel state
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [personnelLoading, setPersonnelLoading] = useState(true);
  const [isPersonnelPanelOpen, setIsPersonnelPanelOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonJabatan, setNewPersonJabatan] = useState('');
  const [newPersonCategory, setNewPersonCategory] = useState<'UTT Daily' | 'UTT Mobile' | 'DME'>('UTT Daily');
  const [editingPersonnelId, setEditingPersonnelId] = useState<string | null>(null);
  const [editPersonName, setEditPersonName] = useState('');
  const [editPersonJabatan, setEditPersonJabatan] = useState('');
  const [editPersonCategory, setEditPersonCategory] = useState<'UTT Daily' | 'UTT Mobile' | 'DME'>('UTT Daily');

  const [formDate, setFormDate] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    if (day === 0) { // Sunday
      d.setDate(d.getDate() - 2); // Friday
    } else if (day === 6) { // Saturday
      d.setDate(d.getDate() - 1); // Friday
    }
    return d.toISOString().split('T')[0];
  });
  const isWeekend = useMemo(() => {
    if (!formDate) return false;
    const parts = formDate.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const day = d.getDay();
    return day === 0 || day === 6;
  }, [formDate]);
  const [formCategory, setFormCategory] = useState<'Semua' | 'UTT Daily' | 'UTT Mobile' | 'DME' | 'Manual'>('Semua');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionPhotos, setSubmissionPhotos] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);

  // Inline edit state for logs
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editedNama, setEditedNama] = useState('');
  const [editedJabatan, setEditedJabatan] = useState('');
  const [editedKehadiran, setEditedKehadiran] = useState<'Hadir' | 'Tidak Hadir' | 'Libur'>('Hadir');
  const [editedRemark, setEditedRemark] = useState('');

  // Checklist state for standard personnel
  const [checklist, setChecklist] = useState<Array<{
    nama: string;
    jabatan: string;
    kehadiran: 'Hadir' | 'Tidak Hadir' | 'Libur';
    remark: string;
    category?: string;
  }>>([]);

  // Checklist state for manual inputs
  const [manualChecklist, setManualChecklist] = useState<Array<{
    nama: string;
    jabatan: string;
    kehadiran: 'Hadir' | 'Tidak Hadir' | 'Libur';
    remark: string;
    category?: string;
  }>>([
    { nama: '', jabatan: '', kehadiran: 'Hadir', remark: '', category: 'Manual' }
  ]);

  // Derived visible checklist based on selected category
  const visibleChecklist = useMemo(() => {
    if (formCategory === 'Semua') {
      return checklist;
    } else if (formCategory === 'Manual') {
      return manualChecklist;
    } else {
      return checklist.filter(item => item.category === formCategory);
    }
  }, [checklist, manualChecklist, formCategory]);

  // Load personnel list from Firestore
  useEffect(() => {
    const q = query(collection(db, 'absen_tbm'), where('isPersonnel', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Personnel[] = [];
      const seenNames = new Set<string>();
      const duplicatesToDelete: string[] = [];

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const name = (data.nama || '').trim().toUpperCase();
        if (name) {
          if (seenNames.has(name)) {
            duplicatesToDelete.push(docSnap.id);
            return; // Skip adding to local list to immediately clean UI
          }
          seenNames.add(name);
        }

        list.push({
          id: docSnap.id,
          nama: data.nama || '',
          jabatan: data.jabatan || '',
          category: data.category || '',
        });
      });

      // Automatically clean up duplicate documents from the database
      if (duplicatesToDelete.length > 0) {
        console.log("Removing duplicate personnel documents from database:", duplicatesToDelete);
        duplicatesToDelete.forEach(async (dupId) => {
          try {
            await deleteDoc(doc(db, 'absen_tbm', dupId));
            console.log(`Successfully deleted duplicate doc ${dupId}`);
          } catch (err) {
            console.error(`Failed to delete duplicate doc ${dupId}:`, err);
          }
        });
      }

      // Sort alphabetically by name
      list.sort((a, b) => a.nama.localeCompare(b.nama));
      setPersonnelList(list);
      setPersonnelLoading(false);
    }, (error) => {
      console.error("Error loading personnel:", error);
      setPersonnelLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Seeding initial personnel to Firestore if empty
  useEffect(() => {
    if (!personnelLoading && personnelList.length === 0) {
      const seedData = async () => {
        try {
          const promises: Promise<any>[] = [];
          Object.entries(TBM_LISTS).forEach(([category, members]) => {
            members.forEach(m => {
              // Use a deterministic document ID to prevent duplicates under hot-reload/strict mode
              const docId = `personnel_${m.nama.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
              promises.push(
                setDoc(doc(db, 'absen_tbm', docId), {
                  isPersonnel: true,
                  nama: m.nama,
                  jabatan: m.jabatan,
                  category: category,
                  createdAt: serverTimestamp()
                })
              );
            });
          });
          await Promise.all(promises);
          toast.success("Berhasil menginisialisasi personil TBM awal ke database!");
        } catch (e: any) {
          console.error("Failed to seed personnel:", e);
        }
      };
      seedData();
    }
  }, [personnelLoading, personnelList.length]);

  // Auto-fill checklist when personnelList or formDate changes
  useEffect(() => {
    if (personnelLoading) return;
    
    const getLocalDay = (dateStr: string) => {
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.getDay();
    };
    const day = getLocalDay(formDate);
    const defaultKehadiran: 'Hadir' | 'Tidak Hadir' | 'Libur' = (day === 0 || day === 6) ? 'Libur' : 'Hadir';

    // Populate all standard personnel
    setChecklist(personnelList.map(e => ({
      nama: e.nama,
      jabatan: e.jabatan,
      category: e.category,
      kehadiran: defaultKehadiran,
      remark: ''
    })));

    // Reset manual list
    setManualChecklist([{
      nama: '',
      jabatan: '',
      category: 'Manual',
      kehadiran: defaultKehadiran,
      remark: ''
    }]);
  }, [personnelList, personnelLoading, formDate]);

  const updateChecklistItem = (index: number, key: 'kehadiran' | 'remark' | 'nama' | 'jabatan', value: any) => {
    if (formCategory === 'Manual') {
      setManualChecklist(prev => prev.map((item, idx) => {
        if (idx === index) {
          return { ...item, [key]: value };
        }
        return item;
      }));
    } else {
      // Find the item name at the index in visibleChecklist
      const targetItem = visibleChecklist[index];
      if (!targetItem) return;

      // Update the correct person in standard checklist
      setChecklist(prev => prev.map(item => {
        if (item.nama === targetItem.nama) {
          return { ...item, [key]: value };
        }
        return item;
      }));
    }
  };

  const addManualRow = () => {
    setManualChecklist(prev => [...prev, {
      nama: '',
      jabatan: '',
      kehadiran: 'Hadir',
      remark: '',
      category: 'Manual'
    }]);
  };

  const removeManualRow = (index: number) => {
    setManualChecklist(prev => prev.filter((_, idx) => idx !== index));
  };

  // Firestore Realtime Listener for logs & documentation
  useEffect(() => {
    const q = query(collection(db, 'absen_tbm'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: AttendanceRecord[] = [];
      const docs: DocumentationRecord[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.isPersonnel) {
          return; // Skip personnel definitions
        }
        if (data.isDocumentation) {
          docs.push({
            id: docSnap.id,
            tanggal: data.tanggal || '',
            isDocumentation: true,
            photos: data.photos || [],
            category: data.category || ''
          });
        } else {
          records.push({
            id: docSnap.id,
            tanggal: data.tanggal || '',
            nama: data.nama || '',
            kehadiran: data.kehadiran || 'Hadir',
            jabatan: data.jabatan || '',
            remark: data.remark || '',
            category: data.category || '',
          });
        }
      });
      // Sort records by tanggal desc
      records.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      setAllRecords(records);
      setDocRecords(docs);
      setLoading(false);
    }, (error) => {
      console.error("Firestore listener failed:", error);
      toast.error("Gagal sinkronisasi data real-time");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filtered Records for statistics / search
  const filteredRecords = useMemo(() => {
    return allRecords.filter(rec => {
      // Exclude Saturdays and Sundays completely from display and statistics
      if (rec.tanggal) {
        const parts = rec.tanggal.split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const day = d.getDay();
        if (day === 0 || day === 6) return false;
      }

      const matchDate = (!startDate || rec.tanggal >= startDate) && (!endDate || rec.tanggal <= endDate);
      const matchText = rec.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        rec.jabatan.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        rec.remark.toLowerCase().includes(searchTerm.toLowerCase());
      return matchDate && matchText;
    });
  }, [allRecords, startDate, endDate, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const statsRecords = filteredRecords.filter(r => r.kehadiran !== 'Libur');
    let total = statsRecords.length;
    let hadir = statsRecords.filter(r => r.kehadiran === 'Hadir').length;
    let tidakHadir = statsRecords.filter(r => r.kehadiran === 'Tidak Hadir').length;
    let rate = total > 0 ? Math.round((hadir / total) * 100) : 0;
    
    // Group by Date for Bar Chart
    const dateGroups: Record<string, { tanggal: string; Hadir: number; 'Tidak Hadir': number; Total: number }> = {};
    statsRecords.forEach(r => {
      if (!dateGroups[r.tanggal]) {
        dateGroups[r.tanggal] = { tanggal: r.tanggal, Hadir: 0, 'Tidak Hadir': 0, Total: 0 };
      }
      if (r.kehadiran === 'Hadir') {
        dateGroups[r.tanggal].Hadir += 1;
      } else if (r.kehadiran === 'Tidak Hadir') {
        dateGroups[r.tanggal]['Tidak Hadir'] += 1;
      }
      dateGroups[r.tanggal].Total += 1;
    });

    const chartData = Object.values(dateGroups).sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    // Group by Name for Personnel Stats
    const personGroups: Record<string, { nama: string; jabatan: string; category: string; hadir: number; total: number }> = {};
    filteredRecords.forEach(r => {
      if (!personGroups[r.nama]) {
        let category = r.category || '';
        if (!category) {
          if (TBM_LISTS['UTT Daily'].some(p => p.nama === r.nama)) {
            category = 'UTT Daily';
          } else if (TBM_LISTS['UTT Mobile'].some(p => p.nama === r.nama)) {
            category = 'UTT Mobile';
          } else if (TBM_LISTS['DME'].some(p => p.nama === r.nama)) {
            category = 'DME';
          }
        }
        if (!category) {
          const found = personnelList.find(p => p.nama === r.nama);
          if (found) {
            category = found.category;
          }
        }
        personGroups[r.nama] = { nama: r.nama, jabatan: r.jabatan, category: category || 'Manual', hadir: 0, total: 0 };
      }
      if (r.kehadiran !== 'Libur') {
        personGroups[r.nama].total += 1;
        if (r.kehadiran === 'Hadir') {
          personGroups[r.nama].hadir += 1;
        }
      }
    });

    const personStats = Object.values(personGroups).map(p => ({
      nama: p.nama,
      jabatan: p.jabatan,
      category: p.category,
      rate: p.total > 0 ? Math.round((p.hadir / p.total) * 100) : 0,
      hadir: p.hadir,
      total: p.total
    })).sort((a, b) => b.rate - a.rate || a.nama.localeCompare(b.nama));

    const pieData = [
      { name: 'Hadir', value: hadir, color: '#10b981' },
      { name: 'Tidak Hadir', value: tidakHadir, color: '#f43f5e' }
    ];

    return { total, hadir, tidakHadir, rate, chartData, pieData, personStats };
  }, [filteredRecords, personnelList]);

  // Draw web chart
  useEffect(() => {
    if (activeRightTab !== 'chart' || !webChartCanvasRef.current) return;
    const canvas = webChartCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ── LEFT SIDE: Overall Donut Chart ──
    const donutCx = 220;
    const donutCy = 180;
    const donutR = 75;
    const donutInner = 48;

    // Title
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#ffffff'; // White text
    ctx.textAlign = 'center';
    ctx.fillText('GRAFIK KESELURUHAN', donutCx, 45);

    const totalCount = stats.total;
    const hadirCount = stats.hadir;
    const tidakHadirCount = stats.tidakHadir;
    const pct = totalCount > 0 ? hadirCount / totalCount : 0;
    const angle = pct * Math.PI * 2;
    const pctDisplay = totalCount > 0 ? Math.round(pct * 100) : 0;

    // Hadir slice (emerald)
    ctx.beginPath();
    ctx.moveTo(donutCx, donutCy);
    ctx.arc(donutCx, donutCy, donutR, -Math.PI / 2, -Math.PI / 2 + angle);
    ctx.closePath();
    ctx.fillStyle = '#10b981';
    ctx.fill();

    // Tidak Hadir slice (rose)
    if (tidakHadirCount > 0) {
      ctx.beginPath();
      ctx.moveTo(donutCx, donutCy);
      ctx.arc(donutCx, donutCy, donutR, -Math.PI / 2 + angle, -Math.PI / 2 + Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = '#f43f5e';
      ctx.fill();
    }

    // Donut hole (matches dark background of the card: #0f172a / #030712)
    ctx.beginPath();
    ctx.arc(donutCx, donutCy, donutInner, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Center %
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${pctDisplay}%`, donutCx, donutCy - 3);
    ctx.font = '11px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Kehadiran', donutCx, donutCy + 16);

    // Legend below Donut
    const legDonutY = donutCy + donutR + 15;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#10b981';
    ctx.fillText(`● Hadir: ${hadirCount}`, donutCx - 55, legDonutY);
    ctx.fillStyle = '#f43f5e';
    ctx.fillText(`● TH: ${tidakHadirCount}`, donutCx + 55, legDonutY);
    ctx.font = '11px Arial';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Total: ${totalCount} record`, donutCx, legDonutY + 15);


    // ── RIGHT SIDE: Weekly Bar Chart ──
    const leftMargin = 450;
    const rightMargin = 40;
    const topMargin = 75;
    const bottomMargin = 50;
    const chartW = canvas.width - leftMargin - rightMargin;
    const chartH = canvas.height - topMargin - bottomMargin;

    // Title
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('GRAFIK KEHADIRAN MINGGUAN', leftMargin + chartW / 2, 45);

    // Generate weekly date ranges from startDate to endDate starting from Monday
    const getWeeksInRange = (startStr: string, endStr: string) => {
      const list: Array<{ start: Date; end: Date; label: string }> = [];
      
      const parseLocalDate = (dateStr: string) => {
        const parts = dateStr.split('-');
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      };
      
      const start = parseLocalDate(startStr);
      const limit = parseLocalDate(endStr);
      
      // Align start to the Monday of its week
      const startDay = start.getDay();
      const diffToMonday = startDay === 0 ? -6 : 1 - startDay;
      const current = new Date(start);
      current.setDate(current.getDate() + diffToMonday);
      
      let weekNum = 1;
      
      while (current <= limit) {
        const wStart = new Date(current);
        const wEnd = new Date(current);
        wEnd.setDate(wEnd.getDate() + 6);
        
        const formatDateShort = (d: Date) => {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          return `${dd}/${mm}`;
        };
        
        list.push({
          start: wStart,
          end: wEnd,
          label: `Mgg ${weekNum} (${formatDateShort(wStart)}-${formatDateShort(wEnd)})`
        });
        
        current.setDate(current.getDate() + 7);
        weekNum++;
      }
      return list;
    };

    const weeks = getWeeksInRange(startDate, endDate);
    
    // Group records into those weeks
    const weeklyData = weeks.map(w => {
      const recs = filteredRecords.filter(r => {
        const parts = r.tanggal.split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        d.setHours(0, 0, 0, 0);
        
        const startNorm = new Date(w.start);
        startNorm.setHours(0, 0, 0, 0);
        
        const endNorm = new Date(w.end);
        endNorm.setHours(0, 0, 0, 0);
        
        return d >= startNorm && d <= endNorm;
      });
      const hadir = recs.filter(r => r.kehadiran === 'Hadir').length;
      const tidakHadir = recs.filter(r => r.kehadiran === 'Tidak Hadir').length;
      return {
        label: w.label,
        hadir,
        tidakHadir
      };
    });

    // Find max value to determine scale
    const maxVal = Math.max(...weeklyData.map(d => Math.max(d.hadir, d.tidakHadir)), 5);
    const yScale = chartH / (maxVal * 1.18);

    // Draw Y grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; // subtle white grid lines
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gridY = topMargin + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(leftMargin, gridY);
      ctx.lineTo(leftMargin + chartW, gridY);
      ctx.stroke();
      
      const val = Math.round(maxVal - (maxVal / 4) * i);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(String(val), leftMargin - 10, gridY + 4);
    }

    // Draw X base line
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftMargin, topMargin + chartH);
    ctx.lineTo(leftMargin + chartW, topMargin + chartH);
    ctx.stroke();

    const itemW = chartW / weeklyData.length;
    const barW = Math.min(30, (itemW * 0.65) / 2);

    weeklyData.forEach((w, idx) => {
      const groupCenterX = leftMargin + (idx + 0.5) * itemW;
      const barHadirX = groupCenterX - barW - 3;
      const barThX = groupCenterX + 3;
      const yZero = topMargin + chartH;

      const hHadir = w.hadir * yScale;
      const hTh = w.tidakHadir * yScale;

      // Hadir bar
      if (hHadir > 0) {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(barHadirX, yZero - hHadir, barW, hHadir);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(w.hadir), barHadirX + barW / 2, yZero - hHadir - 6);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('0', barHadirX + barW / 2, yZero - 6);
      }

      // Tidak Hadir bar
      if (hTh > 0) {
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(barThX, yZero - hTh, barW, hTh);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(w.tidakHadir), barThX + barW / 2, yZero - hTh - 6);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('0', barThX + barW / 2, yZero - 6);
      }

      // X label
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(w.label, groupCenterX, yZero + 20);
    });

    // Divider line between donut & bar chart
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(400, 40);
    ctx.lineTo(400, canvas.height - 20);
    ctx.stroke();
  }, [activeRightTab, filteredRecords, startDate, endDate, stats]);

  const progressRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.width = `${stats.rate}%`;
    }
  }, [stats.rate]);

  // Photo handlers for submission
  const handleAddSubmissionPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsCompressing(true);
    const promises = Array.from(files).map(file => {
      return new Promise<string>((resolve) => {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`Ukuran ${file.name} melebihi 20MB`);
          resolve('');
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX = 800;
            let w = img.width;
            let h = img.height;
            if (w > h) { if (w > MAX) { h = (h * MAX) / w; w = MAX; } }
            else { if (h > MAX) { w = (w * MAX) / h; h = MAX; } }
            canvas.width = w;
            canvas.height = h;
            ctx?.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.7);
            resolve(compressed);
          };
          img.onerror = () => resolve('');
        };
        reader.onerror = () => resolve('');
      });
    });

    Promise.all(promises).then(compressedPhotos => {
      const validPhotos = compressedPhotos.filter(p => p !== '');
      setSubmissionPhotos(prev => [...prev, ...validPhotos]);
      setIsCompressing(false);
    });
    e.target.value = '';
  };

  const removeSubmissionPhoto = (idx: number) => {
    setSubmissionPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  // Add personnel handler
  const handleAddPersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim() || !newPersonJabatan.trim()) {
      toast.error("Nama dan Jabatan tidak boleh kosong");
      return;
    }

    try {
      await addDoc(collection(db, 'absen_tbm'), {
        isPersonnel: true,
        nama: newPersonName.trim(),
        jabatan: newPersonJabatan.trim(),
        category: newPersonCategory,
        createdAt: serverTimestamp()
      });
      toast.success("Personil berhasil ditambahkan!");
      setNewPersonName('');
      setNewPersonJabatan('');
    } catch (err: any) {
      console.error("Error adding personnel:", err);
      toast.error("Gagal menambahkan personil: " + err.message);
    }
  };

  // Delete personnel handler
  const handleDeletePersonnel = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus personil ini?")) return;
    try {
      await deleteDoc(doc(db, 'absen_tbm', id));
      toast.success("Personil berhasil dihapus");
    } catch (err: any) {
      console.error("Error deleting personnel:", err);
      toast.error("Gagal menghapus personil: " + err.message);
    }
  };

  // Update personnel handler
  const handleUpdatePersonnel = async (id: string) => {
    if (!editPersonName.trim() || !editPersonJabatan.trim()) {
      toast.error("Nama dan Jabatan tidak boleh kosong");
      return;
    }
    
    const toastId = toast.loading("Memperbarui data personil...");
    try {
      // 1. Update the personnel definition document in Firestore
      await updateDoc(doc(db, 'absen_tbm', id), {
        nama: editPersonName.trim(),
        jabatan: editPersonJabatan.trim(),
        category: editPersonCategory
      });
      
      // 2. Update historical attendance records where name equals the old name
      const oldPerson = personnelList.find(p => p.id === id);
      if (oldPerson && oldPerson.nama !== editPersonName.trim()) {
        const snapshot = await getDocs(query(collection(db, 'absen_tbm'), where('nama', '==', oldPerson.nama)));
        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (!data.isPersonnel && !data.isDocumentation) {
            batch.update(docSnap.ref, { 
              nama: editPersonName.trim(),
              jabatan: editPersonJabatan.trim()
            });
          }
        });
        await batch.commit();
      }
      
      toast.success("Data personil berhasil diperbarui!", { id: toastId });
      setEditingPersonnelId(null);
    } catch (err: any) {
      console.error("Error updating personnel:", err);
      toast.error("Gagal memperbarui data personil: " + err.message, { id: toastId });
    }
  };

  // Handle Add Attendance Record
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemsToSubmit = visibleChecklist;
    const invalid = itemsToSubmit.some(item => !item.nama.trim() || !item.jabatan.trim());
    if (invalid) {
      toast.error("Semua baris harus memiliki Nama dan Jabatan");
      return;
    }

    setIsSubmitting(true);
    try {
      // Save all visible checklist items to Firestore
      const batchPromises = itemsToSubmit.map(item => 
        addDoc(collection(db, 'absen_tbm'), {
          tanggal: formDate,
          nama: item.nama.trim(),
          kehadiran: item.kehadiran,
          jabatan: item.jabatan.trim(),
          remark: item.remark.trim(),
          category: item.category || formCategory,
          createdAt: serverTimestamp()
        })
      );
      await Promise.all(batchPromises);

      // Save documentation photo if uploaded
      if (submissionPhotos.length > 0) {
        await addDoc(collection(db, 'absen_tbm'), {
          tanggal: formDate,
          isDocumentation: true,
          photos: submissionPhotos,
          category: formCategory,
          createdAt: serverTimestamp()
        });
      }
      
      toast.success(`Berhasil menyimpan absensi ${itemsToSubmit.length} karyawan!`);

      // Reset only the submitted checklist items & photos
      const getLocalDay = (dateStr: string) => {
        const parts = dateStr.split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.getDay();
      };
      const day = getLocalDay(formDate);
      const defaultKehadiran: 'Hadir' | 'Tidak Hadir' | 'Libur' = (day === 0 || day === 6) ? 'Libur' : 'Hadir';

      if (formCategory === 'Manual') {
        setManualChecklist([{
          nama: '',
          jabatan: '',
          category: 'Manual',
          kehadiran: defaultKehadiran,
          remark: ''
        }]);
      } else {
        const submittedNames = new Set(itemsToSubmit.map(item => item.nama));
        setChecklist(prev => prev.map(item => {
          if (submittedNames.has(item.nama)) {
            return { ...item, remark: '', kehadiran: defaultKehadiran };
          }
          return item;
        }));
      }
      setSubmissionPhotos([]);
    } catch (err: any) {
      console.error("Save checklist error:", err);
      toast.error("Gagal menyimpan absensi: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inline edit actions
  const startEditing = (rec: AttendanceRecord) => {
    setEditingRecordId(rec.id);
    setEditedNama(rec.nama);
    setEditedJabatan(rec.jabatan);
    setEditedKehadiran(rec.kehadiran);
    setEditedRemark(rec.remark);
  };

  const handleUpdateRecord = async (id: string) => {
    if (!editedNama.trim() || !editedJabatan.trim()) {
      toast.error("Nama dan Jabatan tidak boleh kosong");
      return;
    }
    try {
      await updateDoc(doc(db, 'absen_tbm', id), {
        nama: editedNama.trim(),
        jabatan: editedJabatan.trim(),
        kehadiran: editedKehadiran,
        remark: editedRemark.trim()
      });
      toast.success("Data absen berhasil diperbarui!");
      setEditingRecordId(null);
    } catch (err: any) {
      console.error("Error updating record:", err);
      toast.error("Gagal memperbarui data: " + err.message);
    }
  };

  const startEditingNew = (person: Personnel) => {
    setEditingRecordId("new_" + person.id);
    setEditedNama(person.nama);
    setEditedJabatan(person.jabatan);
    setEditedKehadiran('Hadir');
    setEditedRemark('');
  };

  const handleSaveNewRecord = async (person: Personnel) => {
    if (!selectedDate) {
      toast.error("Tanggal tidak terpilih");
      return;
    }
    const toastId = toast.loading("Menyimpan data absensi baru...");
    try {
      await addDoc(collection(db, 'absen_tbm'), {
        tanggal: selectedDate,
        nama: person.nama,
        jabatan: person.jabatan,
        kehadiran: editedKehadiran,
        remark: editedRemark.trim(),
        category: person.category || '',
        createdAt: serverTimestamp()
      });
      toast.success("Absensi berhasil disimpan!", { id: toastId });
      setEditingRecordId(null);
    } catch (err: any) {
      console.error("Error creating record:", err);
      toast.error("Gagal menyimpan data: " + err.message, { id: toastId });
    }
  };

  // Handle Delete Attendance Record
  const handleDelete = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus catatan absen ini?")) return;
    try {
      await deleteDoc(doc(db, 'absen_tbm', id));
      toast.success("Absen berhasil dihapus");
    } catch (err: any) {
      console.error("Delete record error:", err);
      toast.error("Gagal menghapus absen: " + err.message);
    }
  };

  // Handle Delete Entire Date Logs (Attendance & Documentation)
  const handleDeleteEntireDate = (dateStr: string) => {
    setDateToDelete(dateStr);
    setDeleteConfirmOpen(true);
  };

  const executeDeleteDate = async (dateStr: string) => {
    const formatted = formatIndonesianDate(dateStr);
    try {
      // Find all records with this date
      const attendanceToDelete = allRecords.filter(r => r.tanggal === dateStr);
      const docsToDelete = docRecords.filter(d => d.tanggal === dateStr);

      const promises: Promise<any>[] = [];
      attendanceToDelete.forEach(r => {
        promises.push(deleteDoc(doc(db, 'absen_tbm', r.id)));
      });
      docsToDelete.forEach(d => {
        promises.push(deleteDoc(doc(db, 'absen_tbm', d.id)));
      });

      await Promise.all(promises);
      toast.success(`Berhasil menghapus seluruh log absensi tanggal ${formatted}!`);
    } catch (err: any) {
      console.error("Error deleting entire date logs:", err);
      toast.error("Gagal menghapus data: " + err.message);
    }
  };

  // Find documentation record for the selected date
  const selectedDateDoc = useMemo(() => {
    if (!selectedDate) return null;
    return docRecords.find(d => d.tanggal === selectedDate);
  }, [selectedDate, docRecords]);

  // Upload/Edit photo for existing date
  const handleUpdateDatePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedDate) return;
    const files = e.target.files;
    if (!files) return;

    setIsCompressing(true);
    const promises = Array.from(files).map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX = 800;
            let w = img.width;
            let h = img.height;
            if (w > h) { if (w > MAX) { h = (h * MAX) / w; w = MAX; } }
            else { if (h > MAX) { w = (w * MAX) / h; h = MAX; } }
            canvas.width = w;
            canvas.height = h;
            ctx?.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.7);
            resolve(compressed);
          };
          img.onerror = () => resolve('');
        };
        reader.onerror = () => resolve('');
      });
    });

    const newPhotos = (await Promise.all(promises)).filter(p => p !== '');
    setIsCompressing(false);

    if (newPhotos.length === 0) return;

    try {
      if (selectedDateDoc) {
        const updatedPhotos = [...selectedDateDoc.photos, ...newPhotos];
        await updateDoc(doc(db, 'absen_tbm', selectedDateDoc.id), {
          photos: updatedPhotos
        });
        toast.success("Dokumentasi foto berhasil diperbarui!");
      } else {
        await addDoc(collection(db, 'absen_tbm'), {
          tanggal: selectedDate,
          isDocumentation: true,
          photos: newPhotos,
          category: 'Semua',
          createdAt: serverTimestamp()
        });
        toast.success("Dokumentasi foto berhasil ditambahkan!");
      }
    } catch (err: any) {
      console.error("Error updating date photo:", err);
      toast.error("Gagal menyimpan foto: " + err.message);
    }
    e.target.value = '';
  };

  const handleRemoveDatePhoto = async (photoIndex: number) => {
    if (!selectedDateDoc) return;
    if (!window.confirm("Apakah Anda yakin ingin menghapus foto dokumentasi ini?")) return;

    try {
      const updatedPhotos = selectedDateDoc.photos.filter((_, idx) => idx !== photoIndex);
      if (updatedPhotos.length === 0) {
        await deleteDoc(doc(db, 'absen_tbm', selectedDateDoc.id));
      } else {
        await updateDoc(doc(db, 'absen_tbm', selectedDateDoc.id), {
          photos: updatedPhotos
        });
      }
      toast.success("Foto dokumentasi berhasil dihapus");
    } catch (err: any) {
      console.error("Error removing photo:", err);
      toast.error("Gagal menghapus foto: " + err.message);
    }
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (filteredRecords.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const docPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = docPdf.internal.pageSize.getWidth();
    const margin = 12;
    const contentW = pageWidth - 2 * margin;

    // Draw blue stripe at the very top edge
    docPdf.setFillColor(0, 89, 156);
    docPdf.rect(0, 0, pageWidth, 2.5, 'F');

    // Header box (rounded border)
    const headerH = 22;
    const headerY = 6;
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setLineWidth(0.1);
    docPdf.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');

    // Separators
    const col1W = 35;
    const col3W = 35;
    docPdf.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
    docPdf.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);

    // Load Logos
    let leftLogoBase64 = '';
    let rightLogoBase64 = '';
    try {
      leftLogoBase64 = await loadLogoBase64(logoDwimitra);
      rightLogoBase64 = await loadLogoBase64(logoNeutraDC);
    } catch (e) {
      console.error(e);
    }

    if (leftLogoBase64) {
      docPdf.addImage(leftLogoBase64, 'JPEG', margin + 3, headerY + 4, col1W - 6, 14, undefined, 'FAST');
    }
    if (rightLogoBase64) {
      docPdf.addImage(rightLogoBase64, 'JPEG', pageWidth - margin - col3W + 5, headerY + 5.5, col3W - 10, 11, undefined, 'FAST');
    }

    const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
    docPdf.setFontSize(10).setFont('helvetica', 'bold').setTextColor(0, 89, 156);
    docPdf.text('LAPORAN KEHADIRAN ABSENSI TBM', centerX, headerY + 6.5, { align: 'center' });

    docPdf.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(30, 30, 30);
    docPdf.text('PT DWIMITRA EKATAMA MANDIRI', centerX, headerY + 11.5, { align: 'center' });

    docPdf.setFontSize(7).setFont('helvetica', 'normal').setTextColor(100, 100, 100);
    docPdf.text(`Periode: ${startDate || '-'} s.d. ${endDate || '-'}`, centerX, headerY + 16, { align: 'center' });
    docPdf.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, centerX, headerY + 20, { align: 'center' });

    // Summary Card
    let y = headerY + headerH + 5;
    docPdf.setFillColor(248, 250, 252); // Slate-50
    docPdf.roundedRect(margin, y, contentW, 30, 1.5, 1.5, 'F');
    docPdf.setDrawColor(226, 232, 240); // Slate-200
    docPdf.setLineWidth(0.15);
    docPdf.roundedRect(margin, y, contentW, 30, 1.5, 1.5, 'D');

    docPdf.setTextColor(15, 23, 42); // Slate-900
    docPdf.setFontSize(9.5);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('RINGKASAN STATISTIK KEHADIRAN', margin + 6, y + 7);

    docPdf.setFontSize(8);
    docPdf.setFont('helvetica', 'normal');
    docPdf.setTextColor(71, 85, 105); // Slate-600
    docPdf.text(`Total Log Kehadiran: ${stats.total} record`, margin + 6, y + 15);
    docPdf.text(`Hadir: ${stats.hadir} kali | Tidak Hadir: ${stats.tidakHadir} kali`, margin + 6, y + 21);
    const periodeFrom = startDate || 'Awal';
    const periodeTo = endDate || 'Sekarang';
    docPdf.text(`Periode: ${periodeFrom}  s/d  ${periodeTo}`, margin + 6, y + 27);

    // ─── Draw Charts (Overall Donut + Weekly Bar Chart side-by-side) ───
    const chartCanvasW = 1200;
    const chartCanvasH = 340;
    const chartCanvas = document.createElement('canvas');
    chartCanvas.width = chartCanvasW;
    chartCanvas.height = chartCanvasH;
    const ctx = chartCanvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chartCanvasW, chartCanvasH);

    // ── LEFT SIDE: Overall Donut Chart ──
    const donutCx = 220;
    const donutCy = 180;
    const donutR = 75;
    const donutInner = 48;

    // Title
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText('GRAFIK KESELURUHAN', donutCx, 45);

    const totalCount = stats.total;
    const hadirCount = stats.hadir;
    const tidakHadirCount = stats.tidakHadir;
    const pct = totalCount > 0 ? hadirCount / totalCount : 0;
    const angle = pct * Math.PI * 2;
    const pctDisplay = totalCount > 0 ? Math.round(pct * 100) : 0;

    // Hadir slice (emerald)
    ctx.beginPath();
    ctx.moveTo(donutCx, donutCy);
    ctx.arc(donutCx, donutCy, donutR, -Math.PI / 2, -Math.PI / 2 + angle);
    ctx.closePath();
    ctx.fillStyle = '#10b981';
    ctx.fill();

    // Tidak Hadir slice (rose)
    if (tidakHadirCount > 0) {
      ctx.beginPath();
      ctx.moveTo(donutCx, donutCy);
      ctx.arc(donutCx, donutCy, donutR, -Math.PI / 2 + angle, -Math.PI / 2 + Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = '#f43f5e';
      ctx.fill();
    }

    // Donut hole
    ctx.beginPath();
    ctx.arc(donutCx, donutCy, donutInner, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Center %
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${pctDisplay}%`, donutCx, donutCy - 3);
    ctx.font = '11px Arial';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Kehadiran', donutCx, donutCy + 16);

    // Legend below Donut
    const legDonutY = donutCy + donutR + 15;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#10b981';
    ctx.fillText(`● Hadir: ${hadirCount}`, donutCx - 55, legDonutY);
    ctx.fillStyle = '#f43f5e';
    ctx.fillText(`● TH: ${tidakHadirCount}`, donutCx + 55, legDonutY);
    ctx.font = '11px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Total: ${totalCount} record`, donutCx, legDonutY + 15);


    // ── RIGHT SIDE: Weekly Bar Chart ──
    const leftMargin = 450;
    const rightMargin = 40;
    const topMargin = 75;
    const bottomMargin = 50;
    const chartW = chartCanvasW - leftMargin - rightMargin;
    const chartH = chartCanvasH - topMargin - bottomMargin;

    // Title
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText('GRAFIK KEHADIRAN MINGGUAN', leftMargin + chartW / 2, 45);

    // Generate weekly date ranges from startDate to endDate starting from Monday
    const getWeeksInRange = (startStr: string, endStr: string) => {
      const list: Array<{ start: Date; end: Date; label: string }> = [];
      
      const parseLocalDate = (dateStr: string) => {
        const parts = dateStr.split('-');
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      };
      
      const start = parseLocalDate(startStr);
      const limit = parseLocalDate(endStr);
      
      // Align start to the Monday of its week
      const startDay = start.getDay();
      const diffToMonday = startDay === 0 ? -6 : 1 - startDay;
      const current = new Date(start);
      current.setDate(current.getDate() + diffToMonday);
      
      let weekNum = 1;
      
      while (current <= limit) {
        const wStart = new Date(current);
        const wEnd = new Date(current);
        wEnd.setDate(wEnd.getDate() + 6);
        
        const formatDateShort = (d: Date) => {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          return `${dd}/${mm}`;
        };
        
        list.push({
          start: wStart,
          end: wEnd,
          label: `Mgg ${weekNum} (${formatDateShort(wStart)}-${formatDateShort(wEnd)})`
        });
        
        current.setDate(current.getDate() + 7);
        weekNum++;
      }
      return list;
    };

    const weeks = getWeeksInRange(startDate, endDate);
    
    // Group records into those weeks
    const weeklyData = weeks.map(w => {
      const recs = filteredRecords.filter(r => {
        const parts = r.tanggal.split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        d.setHours(0, 0, 0, 0);
        
        const startNorm = new Date(w.start);
        startNorm.setHours(0, 0, 0, 0);
        
        const endNorm = new Date(w.end);
        endNorm.setHours(0, 0, 0, 0);
        
        return d >= startNorm && d <= endNorm;
      });
      const hadir = recs.filter(r => r.kehadiran === 'Hadir').length;
      const tidakHadir = recs.filter(r => r.kehadiran === 'Tidak Hadir').length;
      return {
        label: w.label,
        hadir,
        tidakHadir
      };
    });

    // Find max value to determine scale
    const maxVal = Math.max(...weeklyData.map(d => Math.max(d.hadir, d.tidakHadir)), 5);
    const yScale = chartH / (maxVal * 1.18);

    // Draw Y grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gridY = topMargin + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(leftMargin, gridY);
      ctx.lineTo(leftMargin + chartW, gridY);
      ctx.stroke();
      
      const val = Math.round(maxVal - (maxVal / 4) * i);
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(String(val), leftMargin - 10, gridY + 4);
    }

    // Draw X base line
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftMargin, topMargin + chartH);
    ctx.lineTo(leftMargin + chartW, topMargin + chartH);
    ctx.stroke();

    const itemW = chartW / weeklyData.length;
    const barW = Math.min(30, (itemW * 0.65) / 2);

    weeklyData.forEach((w, idx) => {
      const groupCenterX = leftMargin + (idx + 0.5) * itemW;
      const barHadirX = groupCenterX - barW - 3;
      const barThX = groupCenterX + 3;
      const yZero = topMargin + chartH;

      const hHadir = w.hadir * yScale;
      const hTh = w.tidakHadir * yScale;

      // Hadir bar
      if (hHadir > 0) {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(barHadirX, yZero - hHadir, barW, hHadir);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(w.hadir), barHadirX + barW / 2, yZero - hHadir - 6);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('0', barHadirX + barW / 2, yZero - 6);
      }

      // Tidak Hadir bar
      if (hTh > 0) {
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(barThX, yZero - hTh, barW, hTh);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(w.tidakHadir), barThX + barW / 2, yZero - hTh - 6);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('0', barThX + barW / 2, yZero - 6);
      }

      // X label
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(w.label, groupCenterX, yZero + 20);
    });

    // Divider line between donut & bar chart
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(400, 40);
    ctx.lineTo(400, chartCanvasH - 20);
    ctx.stroke();

    // Convert canvas to image and add to PDF
    const chartImgData = chartCanvas.toDataURL('image/png');
    const chartPdfW = contentW;
    const chartPdfH = (chartCanvasH / chartCanvasW) * chartPdfW;
    const chartInsertY = y + 34;
    docPdf.addImage(chartImgData, 'PNG', margin, chartInsertY, chartPdfW, chartPdfH);

    // ─── Table 1: Rangkuman Kehadiran per Personil ──────────────────────
    let chartY = chartInsertY + chartPdfH + 5;

    docPdf.setTextColor(15, 23, 42);
    docPdf.setFontSize(9);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('RANGKUMAN KEHADIRAN PER PERSONIL', margin, chartY - 2.5);

    const summaryHead = [['No', 'Nama Personil', 'Jabatan', 'Hadir', 'Tidak Hadir', 'Total', '%']];
    const summaryBody = stats.personStats.map((p, idx) => {
      const tidakHadir = p.total - p.hadir;
      return [
        idx + 1,
        p.nama,
        p.jabatan,
        p.hadir,
        tidakHadir,
        p.total,
        `${p.rate}%`
      ];
    });

    autoTable(docPdf, {
      startY: chartY,
      head: summaryHead,
      body: summaryBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], halign: 'center', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 55, halign: 'left' },
        2: { cellWidth: 40, halign: 'left' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' }
      },
      styles: { fontSize: 8, cellPadding: 2 },
      willDrawCell: (data) => {
        if (data.section === 'body') {
          // Color the % column (index 6 now)
          if (data.column.index === 6) {
            const raw = String(data.cell.raw).replace('%', '');
            const pct = parseInt(raw);
            if (pct >= 80) {
              data.cell.styles.textColor = [16, 185, 129]; // emerald
              data.cell.styles.fontStyle = 'bold';
            } else if (pct >= 50) {
              data.cell.styles.textColor = [245, 158, 11]; // amber
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [244, 63, 94]; // rose
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // Color Hadir column green (index 3 now)
          if (data.column.index === 3) {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          }
          // Color Tidak Hadir column red (index 4 now)
          if (data.column.index === 4) {
            const val = Number(data.cell.raw);
            if (val > 0) {
              data.cell.styles.textColor = [244, 63, 94];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      }
    });

    // ─── Table 2: Detail Riwayat Absensi ──────────────────────
    const tableData = filteredRecords.map((r, i) => [
      i + 1,
      r.tanggal,
      r.nama,
      r.jabatan,
      r.kehadiran,
      r.remark || '-'
    ]);

    docPdf.setTextColor(15, 23, 42);
    docPdf.setFontSize(9);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('DETAIL RIWAYAT ABSENSI TBM', margin, (docPdf as any).lastAutoTable.finalY + 8);

    autoTable(docPdf, {
      startY: (docPdf as any).lastAutoTable.finalY + 11,
      head: [['No', 'Tanggal', 'Nama', 'Jabatan', 'Status Kehadiran', 'Keterangan']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 89, 156], halign: 'left' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 25 },
        2: { cellWidth: 45 },
        3: { cellWidth: 40 },
        4: { cellWidth: 30 },
        5: { cellWidth: contentW - 150 }
      },
      styles: { fontSize: 8.5 }
    });

    // ─── Add Documentation Photos ────────────────────────────────────
    const filteredDocs = docRecords.filter(d => {
      const matchDate = (!startDate || d.tanggal >= startDate) && (!endDate || d.tanggal <= endDate);
      return matchDate && d.photos && d.photos.length > 0;
    }).sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    if (filteredDocs.length > 0) {
      docPdf.addPage();
      let currentY = margin + 10;
      const pageHeight = docPdf.internal.pageSize.getHeight();
      
      docPdf.setTextColor(0, 89, 156);
      docPdf.setFontSize(12);
      docPdf.setFont('helvetica', 'bold');
      docPdf.text('LAMPIRAN DOKUMENTASI KEHADIRAN TBM', margin, currentY);
      currentY += 8;
      
      filteredDocs.forEach(docGroup => {
        const dateLabel = formatIndonesianDate(docGroup.tanggal) + (docGroup.category ? ` (${docGroup.category})` : '');
        
        if (currentY + 20 > pageHeight - margin - 10) {
          docPdf.addPage();
          currentY = margin + 10;
        }
        
        docPdf.setTextColor(15, 23, 42);
        docPdf.setFontSize(9.5);
        docPdf.setFont('helvetica', 'bold');
        docPdf.text(`Tanggal: ${dateLabel}`, margin, currentY);
        currentY += 6;
        
        const photoWidth = 82;
        const photoHeight = 60;
        const spacingX = 6;
        const spacingY = 6;
        
        docGroup.photos.forEach((photoData, idx) => {
          const col = idx % 2;
          const posX = margin + col * (photoWidth + spacingX);
          
          if (col === 0 && currentY + photoHeight > pageHeight - margin - 10) {
            docPdf.addPage();
            currentY = margin + 10;
            docPdf.setTextColor(100, 100, 100);
            docPdf.setFontSize(7.5);
            docPdf.setFont('helvetica', 'italic');
            docPdf.text(`Dokumentasi Tanggal: ${dateLabel} (sambungan)`, margin, currentY);
            currentY += 6;
          }
          
          try {
            let format = 'JPEG';
            if (photoData.includes('image/png') || photoData.includes('png')) {
              format = 'PNG';
            }
            docPdf.addImage(photoData, format, posX, currentY, photoWidth, photoHeight, undefined, 'FAST');
          } catch (err) {
            console.error("Error adding photo to PDF:", err);
            docPdf.setDrawColor(226, 232, 240);
            docPdf.rect(posX, currentY, photoWidth, photoHeight, 'D');
            docPdf.setFontSize(8).setFont('helvetica', 'italic').setTextColor(150, 150, 150);
            docPdf.text('Gagal memuat gambar', posX + photoWidth / 2, currentY + photoHeight / 2, { align: 'center' });
          }
          
          if (col === 1 || idx === docGroup.photos.length - 1) {
            currentY += photoHeight + spacingY;
          }
        });
        
        currentY += 4;
      });
    }

    // ─── Add Page Numbers & Blue Grid Footer to ALL pages ─────────────
    const totalPages = docPdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      docPdf.setPage(i);
      const pageW = docPdf.internal.pageSize.getWidth();
      const pageH = docPdf.internal.pageSize.getHeight();

      // Blue grid stripe at bottom
      const stripeH = 8;
      const stripeY = pageH - stripeH;
      // Main blue bar
      docPdf.setFillColor(0, 89, 156); // UTT Blue
      docPdf.rect(0, stripeY, pageW, stripeH, 'F');

      // Page number text
      docPdf.setFontSize(7);
      docPdf.setFont('helvetica', 'normal');
      docPdf.setTextColor(255, 255, 255);
      const pageText = `Page ${i} of ${totalPages}`;
      const textW = docPdf.getTextWidth(pageText);
      docPdf.text(pageText, pageW - margin - textW, stripeY + 5.5);

      // Left side: report label
      docPdf.setTextColor(255, 255, 255);
      docPdf.setFontSize(6.5);
      docPdf.text('Laporan Absensi TBM — PT Dwimitra Ekatama Mandiri', margin, stripeY + 5.5);
    }

    docPdf.save(`Laporan_Absen_TBM_${startDate || 'all'}_to_${endDate || 'all'}.pdf`);
    toast.success("PDF Laporan Absen TBM berhasil diunduh!");
  };

  // Export Excel
  const handleExportExcel = async () => {
    if (filteredRecords.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Absensi TBM');

    // Set Column Widths early (before any data is written)
    worksheet.getColumn(1).width = 6;   // A - No
    worksheet.getColumn(2).width = 28;  // B
    worksheet.getColumn(3).width = 25;  // C
    worksheet.getColumn(4).width = 20;  // D
    worksheet.getColumn(5).width = 18;  // E
    worksheet.getColumn(6).width = 20;  // F
    worksheet.getColumn(7).width = 20;  // G

    // Load Logos
    let leftLogoBase64 = '';
    let rightLogoBase64 = '';
    try {
      leftLogoBase64 = await loadLogoBase64(logoDwimitra);
      rightLogoBase64 = await loadLogoBase64(logoNeutraDC);
    } catch (e) {
      console.error(e);
    }

    let leftLogoId: number | null = null;
    let rightLogoId: number | null = null;

    if (leftLogoBase64) {
      leftLogoId = workbook.addImage({
        base64: leftLogoBase64,
        extension: 'png',
      });
    }
    if (rightLogoBase64) {
      rightLogoId = workbook.addImage({
        base64: rightLogoBase64,
        extension: 'png',
      });
    }

    // Set Row Heights for Header Block
    worksheet.getRow(1).height = 45;
    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 18;

    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'LAPORAN KEHADIRAN ABSENSI TBM';
    titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF00599C' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('A2:G2');
    const subtitleCell1 = worksheet.getCell('A2');
    subtitleCell1.value = 'PT DWIMITRA EKATAMA MANDIRI';
    subtitleCell1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF334155' } };
    subtitleCell1.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('A3:G3');
    const subtitleCell2 = worksheet.getCell('A3');
    subtitleCell2.value = 'Data Center Maintenance System';
    subtitleCell2.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
    subtitleCell2.alignment = { vertical: 'middle', horizontal: 'center' };

    // Apply borders around the Header Block (A1:G3)
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 7; c++) {
        const cell = worksheet.getCell(r, c);
        cell.border = {
          top: r === 1 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          bottom: r === 3 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          left: c === 1 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          right: c === 7 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        };
      }
    }

    if (leftLogoId !== null) {
      worksheet.addImage(leftLogoId, {
        tl: { col: 0.1, row: 0.2 },
        ext: { width: 90, height: 35 }
      });
    }

    if (rightLogoId !== null) {
      worksheet.addImage(rightLogoId, {
        tl: { col: 6.1, row: 0.2 },
        ext: { width: 85, height: 32 }
      });
    }

    // Set row heights for metadata
    worksheet.getRow(4).height = 15;
    worksheet.getRow(5).height = 18;
    worksheet.getRow(6).height = 18;
    worksheet.getRow(7).height = 15;

    worksheet.getCell('A5').value = `Periode: ${startDate || 'all'} s.d. ${endDate || 'all'}`;
    worksheet.getCell('A5').font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };
    worksheet.getCell('A6').value = `Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`;
    worksheet.getCell('A6').font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };

    // Pre-calculate indices for dynamic formulas
    const t1StartRow = 31;
    const t1EndRow = 30 + stats.personStats.length;
    const t2TitleRowIndex = t1EndRow + 3;
    const t2HeaderRowIndex = t2TitleRowIndex + 1;
    const t2StartRow = t2HeaderRowIndex + 1;
    const t2EndRow = t2StartRow + filteredRecords.length - 1;

    // Summary Card Block (Rows 8 to 12, Columns A to D)
    worksheet.mergeCells('A8:D8');
    const summaryTitleCell = worksheet.getCell('A8');
    summaryTitleCell.value = 'RINGKASAN STATISTIK KEHADIRAN';
    summaryTitleCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    summaryTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const setSummaryRow = (rowNum: number, label: string, valOrFormula: any, isPercent = false) => {
      worksheet.mergeCells(`A${rowNum}:B${rowNum}`);
      const lblCell = worksheet.getCell(`A${rowNum}`);
      lblCell.value = label;
      lblCell.font = { name: 'Arial', size: 8.5, color: { argb: 'FF475569' } };
      lblCell.alignment = { vertical: 'middle', horizontal: 'left' };

      worksheet.mergeCells(`C${rowNum}:D${rowNum}`);
      const valCell = worksheet.getCell(`C${rowNum}`);
      valCell.value = valOrFormula;
      valCell.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF0F172A' } };
      valCell.alignment = { vertical: 'middle', horizontal: 'left' };
      if (isPercent) {
        valCell.numFmt = '0%';
      }
    };

    setSummaryRow(9, 'Total Log Kehadiran:', { formula: `COUNTA(E${t2StartRow}:E${t2EndRow})`, result: stats.total });
    setSummaryRow(10, 'Hadir:', { formula: `COUNTIF(E${t2StartRow}:E${t2EndRow},"Hadir")`, result: stats.hadir });
    setSummaryRow(11, 'Tidak Hadir:', { formula: `COUNTIF(E${t2StartRow}:E${t2EndRow},"Tidak Hadir")`, result: stats.tidakHadir });
    setSummaryRow(12, 'Persentase Kehadiran:', { formula: `IF(C9>0,C10/C9,0)`, result: stats.rate / 100 }, true);

    // Style Card Block Background & Border
    for (let r = 8; r <= 12; r++) {
      worksheet.getRow(r).height = 18;
      for (let c = 1; c <= 4; c++) {
        const cell = worksheet.getCell(r, c);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' } // Slate-50
        };
        cell.border = {
          top: r === 8 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          bottom: r === 12 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          left: c === 1 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          right: c === 4 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        };
      }
    }

    // Generate Chart Image (Render on in-memory canvas)
    const chartCanvasW = 1200;
    const chartCanvasH = 340;
    const chartCanvas = document.createElement('canvas');
    chartCanvas.width = chartCanvasW;
    chartCanvas.height = chartCanvasH;
    const ctx = chartCanvas.getContext('2d');

    if (ctx) {
      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, chartCanvasW, chartCanvasH);

      // ── LEFT SIDE: Overall Donut Chart ──
      const donutCx = 220;
      const donutCy = 180;
      const donutR = 75;
      const donutInner = 48;

      // Title
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.fillText('GRAFIK KESELURUHAN', donutCx, 45);

      const totalCount = stats.total;
      const hadirCount = stats.hadir;
      const tidakHadirCount = stats.tidakHadir;
      const pct = totalCount > 0 ? hadirCount / totalCount : 0;
      const angle = pct * Math.PI * 2;
      const pctDisplay = totalCount > 0 ? Math.round(pct * 100) : 0;

      // Hadir slice (emerald)
      ctx.beginPath();
      ctx.moveTo(donutCx, donutCy);
      ctx.arc(donutCx, donutCy, donutR, -Math.PI / 2, -Math.PI / 2 + angle);
      ctx.closePath();
      ctx.fillStyle = '#10b981';
      ctx.fill();

      // Tidak Hadir slice (rose)
      if (tidakHadirCount > 0) {
        ctx.beginPath();
        ctx.moveTo(donutCx, donutCy);
        ctx.arc(donutCx, donutCy, donutR, -Math.PI / 2 + angle, -Math.PI / 2 + Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = '#f43f5e';
        ctx.fill();
      }

      // Donut hole
      ctx.beginPath();
      ctx.arc(donutCx, donutCy, donutInner, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Center %
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pctDisplay}%`, donutCx, donutCy - 3);
      ctx.font = '11px Arial';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Kehadiran', donutCx, donutCy + 16);

      // Legend below Donut
      const legDonutY = donutCy + donutR + 15;
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#10b981';
      ctx.fillText(`● Hadir: ${hadirCount}`, donutCx - 55, legDonutY);
      ctx.fillStyle = '#f43f5e';
      ctx.fillText(`● TH: ${tidakHadirCount}`, donutCx + 55, legDonutY);
      ctx.font = '11px Arial';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Total: ${totalCount} record`, donutCx, legDonutY + 15);

      // ── RIGHT SIDE: Weekly Bar Chart ──
      const leftMargin = 450;
      const rightMargin = 40;
      const topMargin = 75;
      const bottomMargin = 50;
      const chartW = chartCanvasW - leftMargin - rightMargin;
      const chartH = chartCanvasH - topMargin - bottomMargin;

      // Title
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.fillText('GRAFIK KEHADIRAN MINGGUAN', leftMargin + chartW / 2, 45);

      // Generate weekly date ranges from startDate to endDate starting from Monday
      const getWeeksInRange = (startStr: string, endStr: string) => {
        const list: Array<{ start: Date; end: Date; label: string }> = [];
        
        const parseLocalDate = (dateStr: string) => {
          const parts = dateStr.split('-');
          return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        };
        
        const start = parseLocalDate(startStr);
        const limit = parseLocalDate(endStr);
        
        // Align start to the Monday of its week
        const startDay = start.getDay();
        const diffToMonday = startDay === 0 ? -6 : 1 - startDay;
        const current = new Date(start);
        current.setDate(current.getDate() + diffToMonday);
        
        let weekNum = 1;
        
        while (current <= limit) {
          const wStart = new Date(current);
          const wEnd = new Date(current);
          wEnd.setDate(wEnd.getDate() + 6);
          
          const formatDateShort = (d: Date) => {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            return `${dd}/${mm}`;
          };
          
          list.push({
            start: wStart,
            end: wEnd,
            label: `Mgg ${weekNum} (${formatDateShort(wStart)}-${formatDateShort(wEnd)})`
          });
          
          current.setDate(current.getDate() + 7);
          weekNum++;
        }
        return list;
      };

      const weeks = getWeeksInRange(startDate, endDate);
      
      // Group records into those weeks
      const weeklyData = weeks.map(w => {
        const recs = filteredRecords.filter(r => {
          const parts = r.tanggal.split('-');
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          d.setHours(0, 0, 0, 0);
          
          const startNorm = new Date(w.start);
          startNorm.setHours(0, 0, 0, 0);
          
          const endNorm = new Date(w.end);
          endNorm.setHours(0, 0, 0, 0);
          
          return d >= startNorm && d <= endNorm;
        });
        const hadir = recs.filter(r => r.kehadiran === 'Hadir').length;
        const tidakHadir = recs.filter(r => r.kehadiran === 'Tidak Hadir').length;
        return {
          label: w.label,
          hadir,
          tidakHadir
        };
      });

      // Find max value to determine scale
      const maxVal = Math.max(...weeklyData.map(d => Math.max(d.hadir, d.tidakHadir)), 5);
      const yScale = chartH / (maxVal * 1.18);

      // Draw Y grid lines
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const gridY = topMargin + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(leftMargin, gridY);
        ctx.lineTo(leftMargin + chartW, gridY);
        ctx.stroke();
        
        const val = Math.round(maxVal - (maxVal / 4) * i);
        ctx.fillStyle = '#64748b';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(String(val), leftMargin - 10, gridY + 4);
      }

      // Draw X base line
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(leftMargin, topMargin + chartH);
      ctx.lineTo(leftMargin + chartW, topMargin + chartH);
      ctx.stroke();

      const itemW = chartW / weeklyData.length;
      const barW = Math.min(30, (itemW * 0.65) / 2);

      weeklyData.forEach((w, idx) => {
        const groupCenterX = leftMargin + (idx + 0.5) * itemW;
        const barHadirX = groupCenterX - barW - 3;
        const barThX = groupCenterX + 3;
        const yZero = topMargin + chartH;

        const hHadir = w.hadir * yScale;
        const hTh = w.tidakHadir * yScale;

        // Hadir bar
        if (hHadir > 0) {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(barHadirX, yZero - hHadir, barW, hHadir);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(String(w.hadir), barHadirX + barW / 2, yZero - hHadir - 6);
        } else {
          ctx.fillStyle = '#64748b';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('0', barHadirX + barW / 2, yZero - 6);
        }

        // Tidak Hadir bar
        if (hTh > 0) {
          ctx.fillStyle = '#f43f5e';
          ctx.fillRect(barThX, yZero - hTh, barW, hTh);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(String(w.tidakHadir), barThX + barW / 2, yZero - hTh - 6);
        } else {
          ctx.fillStyle = '#64748b';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('0', barThX + barW / 2, yZero - 6);
        }

        // X label
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(w.label, groupCenterX, yZero + 20);
      });

      // Divider line between donut & bar chart
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(400, 40);
      ctx.lineTo(400, chartCanvasH - 20);
      ctx.stroke();

      const chartImgData = chartCanvas.toDataURL('image/png');
      const chartImgId = workbook.addImage({
        base64: chartImgData,
        extension: 'png',
      });

      // Position charts in Row 14 to Row 27
      for (let r = 14; r <= 27; r++) {
        worksheet.getRow(r).height = 20;
      }

      worksheet.addImage(chartImgId, {
        tl: { col: 0, row: 13 } as any,
        br: { col: 7, row: 27 } as any
      });
    }

    worksheet.getRow(28).height = 15; // blank spacer

    // ─── Table 1: Rangkuman Kehadiran per Personil ──────────────────────
    const table1TitleRow = worksheet.getRow(29);
    table1TitleRow.height = 20;
    worksheet.mergeCells('A29:G29');
    const t1TitleCell = worksheet.getCell('A29');
    t1TitleCell.value = 'RANGKUMAN KEHADIRAN PER PERSONIL';
    t1TitleCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    t1TitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const t1Headers = ['No', 'Nama Personil', 'Jabatan', 'Hadir', 'Tidak Hadir', 'Total', '%'];
    const t1HeaderRow = worksheet.getRow(30);
    t1HeaderRow.height = 24;
    t1Headers.forEach((h, idx) => {
      const cell = t1HeaderRow.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: idx === 0 || idx >= 3 ? 'center' : 'left' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' } // Dark Slate header
      };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    let currentRow = 31;
    stats.personStats.forEach((p, idx) => {
      const row = worksheet.getRow(currentRow);
      row.height = 20;
      const thCount = p.total - p.hadir;

      row.getCell(1).value = idx + 1;
      row.getCell(2).value = p.nama;
      row.getCell(3).value = p.jabatan;

      // Hadir (Col D)
      row.getCell(4).value = {
        formula: `COUNTIFS(C$${t2StartRow}:C$${t2EndRow},B${currentRow},E$${t2StartRow}:E$${t2EndRow},"Hadir")`,
        result: p.hadir
      };

      // Tidak Hadir (Col E)
      row.getCell(5).value = {
        formula: `COUNTIFS(C$${t2StartRow}:C$${t2EndRow},B${currentRow},E$${t2StartRow}:E$${t2EndRow},"Tidak Hadir")`,
        result: thCount
      };

      // Total (Col F)
      row.getCell(6).value = {
        formula: `SUM(D${currentRow}:E${currentRow})`,
        result: p.total
      };

      // % (Col G)
      row.getCell(7).value = {
        formula: `IF(F${currentRow}>0,D${currentRow}/F${currentRow},0)`,
        result: p.rate / 100
      };
      row.getCell(7).numFmt = '0%';

      // Alignments
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

      // Colors & Fonts
      row.getCell(1).font = { name: 'Arial', size: 8.5 };
      row.getCell(2).font = { name: 'Arial', size: 8.5 };
      row.getCell(3).font = { name: 'Arial', size: 8.5 };
      
      row.getCell(4).font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF10B981' } }; // Hadir = Green
      
      if (thCount > 0) {
        row.getCell(5).font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFF43F5E' } }; // TH > 0 = Red
      } else {
        row.getCell(5).font = { name: 'Arial', size: 8.5, color: { argb: 'FF64748B' } };
      }

      row.getCell(6).font = { name: 'Arial', size: 8.5 };

      // % Color Coding
      if (p.rate >= 80) {
        row.getCell(7).font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF10B981' } }; // >= 80% Green
      } else if (p.rate >= 50) {
        row.getCell(7).font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFF59E0B' } }; // >= 50% Amber
      } else {
        row.getCell(7).font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFF43F5E' } }; // < 50% Red
      }

      // Borders
      for (let col = 1; col <= 7; col++) {
        row.getCell(col).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      }

      currentRow++;
    });

    // Space after Table 1
    worksheet.getRow(currentRow).height = 15;
    worksheet.getRow(currentRow + 1).height = 15;
    currentRow += 2;

    // ─── Table 2: Detail Riwayat Absensi TBM ──────────────────────
    const table2TitleRow = worksheet.getRow(currentRow);
    table2TitleRow.height = 20;
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    const t2TitleCell = worksheet.getCell(`A${currentRow}`);
    t2TitleCell.value = 'DETAIL RIWAYAT ABSENSI TBM';
    t2TitleCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    t2TitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    currentRow++;

    const t2Headers = ['No', 'Tanggal', 'Nama', 'Jabatan', 'Status Kehadiran', 'Keterangan'];
    const t2HeaderRow = worksheet.getRow(currentRow);
    t2HeaderRow.height = 24;
    t2Headers.forEach((h, idx) => {
      // Note: Keterangan will span column F and G
      const colPos = idx + 1;
      let cell;
      if (h === 'Keterangan') {
        worksheet.mergeCells(`F${currentRow}:G${currentRow}`);
        cell = worksheet.getCell(`F${currentRow}`);
      } else {
        cell = t2HeaderRow.getCell(colPos);
      }

      cell.value = h;
      cell.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: idx === 0 || idx === 1 || idx === 4 ? 'center' : 'left' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00599C' } // UTT Blue header
      };

      // Apply borders to header cells including the merged G column header
      const borderConfig: any = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };

      if (h === 'Keterangan') {
        worksheet.getCell(`F${currentRow}`).border = borderConfig;
        worksheet.getCell(`G${currentRow}`).border = borderConfig;
      } else {
        cell.border = borderConfig;
      }
    });

    currentRow++;

    filteredRecords.forEach((rec, idx) => {
      const row = worksheet.getRow(currentRow);
      row.height = 20;

      row.getCell(1).value = idx + 1;
      row.getCell(2).value = rec.tanggal;
      row.getCell(3).value = rec.nama;
      row.getCell(4).value = rec.jabatan;
      row.getCell(5).value = rec.kehadiran;
      
      // Merge Keterangan columns F and G
      worksheet.mergeCells(`F${currentRow}:G${currentRow}`);
      worksheet.getCell(`F${currentRow}`).value = rec.remark || '-';

      // Alignment
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getCell(`F${currentRow}`).alignment = { vertical: 'middle', horizontal: 'left' };

      // Font size & colors
      for (let col = 1; col <= 4; col++) {
        row.getCell(col).font = { name: 'Arial', size: 8.5 };
      }
      
      if (rec.kehadiran === 'Hadir') {
        row.getCell(5).font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF10B981' } }; // Hadir = Green
      } else {
        row.getCell(5).font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFF43F5E' } }; // Tidak Hadir = Red
      }
      
      worksheet.getCell(`F${currentRow}`).font = { name: 'Arial', size: 8.5 };

      // Apply borders to all columns A:G
      for (let col = 1; col <= 7; col++) {
        const c = worksheet.getCell(currentRow, col);
        c.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        // Ensure data cells are editable
        c.protection = { locked: false };
      }

      currentRow++;
    });

    // (Column widths already set at worksheet creation)

    // Add dynamic conditional formatting rules
    try {
      // Column G (%) in Table 1
      worksheet.addConditionalFormatting({
        ref: `G${t1StartRow}:G${t1EndRow}`,
        rules: [
          {
            priority: 1,
            type: 'cellIs',
            operator: 'lessThan',
            formulae: ['0.5'],
            style: { font: { color: { argb: 'FFF43F5E' }, bold: true } }
          },
          {
            priority: 2,
            type: 'cellIs',
            operator: 'between',
            formulae: ['0.5', '0.7999'],
            style: { font: { color: { argb: 'FFF59E0B' }, bold: true } }
          },
          {
            priority: 3,
            type: 'cellIs',
            operator: 'greaterThan',
            formulae: ['0.7999'],
            style: { font: { color: { argb: 'FF10B981' }, bold: true } }
          }
        ]
      });

      // Column E (Tidak Hadir) in Table 1
      worksheet.addConditionalFormatting({
        ref: `E${t1StartRow}:E${t1EndRow}`,
        rules: [
          {
            priority: 4,
            type: 'cellIs',
            operator: 'greaterThan',
            formulae: ['0'],
            style: { font: { color: { argb: 'FFF43F5E' }, bold: true } }
          }
        ]
      });

      // Column E (Status Kehadiran) in Table 2
      worksheet.addConditionalFormatting({
        ref: `E${t2StartRow}:E${t2EndRow}`,
        rules: [
          {
            priority: 5,
            type: 'cellIs',
            operator: 'equal',
            formulae: ['"Hadir"'],
            style: { font: { color: { argb: 'FF10B981' }, bold: true } }
          },
          {
            priority: 6,
            type: 'cellIs',
            operator: 'equal',
            formulae: ['"Tidak Hadir"'],
            style: { font: { color: { argb: 'FFF43F5E' }, bold: true } }
          }
        ]
      });
    } catch (cfError) {
      console.warn("Failed to add conditional formatting:", cfError);
    }

    // ─── Add Documentation Sheet ─────────────────────────────────────
    const filteredExcelDocs = docRecords.filter(d => {
      const matchDate = (!startDate || d.tanggal >= startDate) && (!endDate || d.tanggal <= endDate);
      return matchDate && d.photos && d.photos.length > 0;
    }).sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    if (filteredExcelDocs.length > 0) {
      const docSheet = workbook.addWorksheet('Dokumentasi Foto');
      
      // Title
      docSheet.mergeCells('A1:K1');
      const titleCell = docSheet.getCell('A1');
      titleCell.value = 'LAMPIRAN DOKUMENTASI KEHADIRAN TBM';
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00599C' } // UTT Blue
      };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      docSheet.getRow(1).height = 40;
      
      let currentRow = 3;
      
      filteredExcelDocs.forEach(docGroup => {
        const dateLabel = formatIndonesianDate(docGroup.tanggal) + (docGroup.category ? ` (${docGroup.category})` : '');
        
        // Date Header
        docSheet.mergeCells(`A${currentRow}:K${currentRow}`);
        const dateCell = docSheet.getCell(`A${currentRow}`);
        dateCell.value = `Tanggal: ${dateLabel}`;
        dateCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0F172A' } };
        dateCell.alignment = { vertical: 'middle', horizontal: 'left' };
        docSheet.getRow(currentRow).height = 25;
        
        currentRow += 2;
        
        const photoWidthCols = 4;
        const photoHeightRows = 12;
        
        for (let r = 0; r < photoHeightRows; r++) {
          docSheet.getRow(currentRow + r).height = 20;
        }
        
        docGroup.photos.forEach((photoData, idx) => {
          const colOffset = idx % 2;
          const startCol = colOffset === 0 ? 1 : 6;
          const endCol = startCol + photoWidthCols;
          
          try {
            const base64Clean = photoData.replace(/^data:image\/\w+;base64,/, "");
            const extension = photoData.includes('image/png') ? 'png' : 'jpeg';
            
            const imageId = workbook.addImage({
              base64: base64Clean,
              extension: extension as any,
            });
            
            docSheet.addImage(imageId, {
              tl: { col: startCol, row: currentRow - 1 } as any,
              br: { col: endCol, row: currentRow - 1 + photoHeightRows } as any,
              editAs: 'oneCell'
            });
          } catch (err) {
            console.error("Error adding photo to Excel:", err);
          }
          
          if (colOffset === 1 || idx === docGroup.photos.length - 1) {
            currentRow += photoHeightRows + 2;
          }
        });
        
        currentRow += 1;
      });
      
      docSheet.getColumn(1).width = 4;
      for (let c = 2; c <= 11; c++) {
        docSheet.getColumn(c).width = 15;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_Absen_TBM_${startDate || 'all'}_to_${endDate || 'all'}.xlsx`;
    link.click();
    toast.success("Excel Absensi TBM berhasil diunduh!");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* ─── Header ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">Absensi Checklist & Grafik TBM</h1>
              <p className="text-sm text-slate-400">Kelola dan analisis data absensi TBM secara real-time</p>
            </div>
          </div>
          <button
            onClick={() => setIsPersonnelPanelOpen(!isPersonnelPanelOpen)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/50 hover:border-slate-650 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition active:scale-95 animate-none"
          >
            <UserPlus className="w-4 h-4 text-pink-400" />
            {isPersonnelPanelOpen ? "Tutup Panel Personil" : "Kelola Personil TBM"}
          </button>
        </div>
      </motion.div>

      {/* ─── Personnel Panel ────────────────────────────────────── */}
      <AnimatePresence>
        {isPersonnelPanelOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Form */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 bg-pink-500 rounded-full" />
                  Tambah Personil Baru
                </h3>
                <form onSubmit={handleAddPersonnel} className="space-y-3.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">NAMA LENGKAP</label>
                    <input
                      type="text"
                      required
                      value={newPersonName}
                      onChange={e => setNewPersonName(e.target.value)}
                      placeholder="Masukkan nama lengkap..."
                      className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">JABATAN</label>
                    <input
                      type="text"
                      required
                      value={newPersonJabatan}
                      onChange={e => setNewPersonJabatan(e.target.value)}
                      placeholder="Contoh: Teknisi, Shift Engineer..."
                      className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">KATEGORI TIM</label>
                    <select
                      value={newPersonCategory}
                      onChange={e => setNewPersonCategory(e.target.value as any)}
                      title="Kategori Tim"
                      className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-500/50 font-bold font-sans"
                    >
                      <option value="UTT Daily">UTT Daily</option>
                      <option value="UTT Mobile">UTT Mobile</option>
                      <option value="DME">DME</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-pink-500/10 active:scale-95 animate-none"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Personil
                  </button>
                </form>
              </div>

              {/* Right List */}
              <div className="lg:col-span-2 space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 bg-violet-500 rounded-full" />
                  Daftar Personil Terdaftar ({personnelList.length})
                </h3>
                <div className="max-h-[250px] overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/20 font-sans">
                  {personnelList.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">Belum ada data personil.</div>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="px-3 py-2.5 w-12">No</th>
                          <th className="px-3 py-2.5">Nama</th>
                          <th className="px-3 py-2.5">Jabatan</th>
                          <th className="px-3 py-2.5">Kategori</th>
                          <th className="px-3 py-2.5 text-center w-16">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/60">
                        {personnelList.map((p, idx) => {
                          const isEditing = editingPersonnelId === p.id;
                          return (
                            <tr key={p.id} className="hover:bg-slate-800/10 text-slate-300">
                              <td className="px-3 py-2.5 font-mono text-slate-500">{idx + 1}.</td>
                              {isEditing ? (
                                <>
                                  <td className="px-2 py-2">
                                    <input
                                      type="text"
                                      value={editPersonName}
                                      onChange={e => setEditPersonName(e.target.value)}
                                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-500 w-full"
                                      placeholder="Nama"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="text"
                                      value={editPersonJabatan}
                                      onChange={e => setEditPersonJabatan(e.target.value)}
                                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-500 w-full"
                                      placeholder="Jabatan"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <select
                                      value={editPersonCategory}
                                      onChange={e => setEditPersonCategory(e.target.value as any)}
                                      title="Edit Kategori"
                                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-500 w-full"
                                    >
                                      <option value="UTT Daily">UTT Daily</option>
                                      <option value="UTT Mobile">UTT Mobile</option>
                                      <option value="DME">DME</option>
                                    </select>
                                  </td>
                                  <td className="px-3 py-2.5 text-center flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdatePersonnel(p.id)}
                                      className="p-1 hover:bg-emerald-500/10 text-emerald-500 hover:text-emerald-400 rounded transition active:scale-90 animate-none"
                                      title="Simpan Perubahan"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPersonnelId(null)}
                                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition active:scale-90 animate-none"
                                      title="Batal"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-3 py-2.5 font-bold text-white">{p.nama}</td>
                                  <td className="px-3 py-2.5">{p.jabatan}</td>
                                  <td className="px-3 py-2.5 text-slate-400">{p.category}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPersonnelId(p.id);
                                          setEditPersonName(p.nama);
                                          setEditPersonJabatan(p.jabatan);
                                          setEditPersonCategory(p.category as any);
                                        }}
                                        className="p-1 hover:bg-violet-500/10 text-slate-500 hover:text-violet-400 rounded transition active:scale-90 animate-none"
                                        title="Edit Personil"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePersonnel(p.id)}
                                        className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition active:scale-90 animate-none"
                                        title="Hapus Personil"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Filters & Actions Bar ──────────────────────────────── */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="text-xs font-bold text-slate-400 mb-1.5 block">TANGGAL MULAI</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              title="Tanggal Mulai"
              placeholder="Tanggal Mulai"
              className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-400 mb-1.5 block">TANGGAL SELESAI</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              title="Tanggal Selesai"
              placeholder="Tanggal Selesai"
              className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-400 mb-1.5 block">CARI NAMA / JABATAN</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari..."
              className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50 placeholder-slate-500"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            className="flex-1 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 animate-none"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex-1 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 animate-none"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* ─── Statistics Cards & Chart Section ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Summary Cards */}
        <div className="space-y-4 font-sans">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Record</p>
              <h3 className="text-2xl font-black text-white mt-1">{stats.total}</h3>
            </div>
            <div className="p-3 bg-slate-800 rounded-xl text-slate-300">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hadir</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{stats.hadir}</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tidak Hadir</p>
              <h3 className="text-2xl font-black text-rose-500 mt-1">{stats.tidakHadir}</h3>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
              <XCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rasio Kehadiran</p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 bg-slate-800 rounded-full h-3.5 overflow-hidden border border-slate-700/50">
                <div
                  ref={progressRef}
                  className="bg-gradient-to-r from-emerald-500 to-green-400 h-full transition-all duration-500"
                />
              </div>
              <span className="text-sm font-black text-white">{stats.rate}%</span>
            </div>
          </div>
        </div>

        {/* Right Side: Personnel Attendance Rates or Charts */}
        <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col justify-start gap-4 min-h-[380px]">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-pink-500 rounded-full shadow-lg shadow-pink-500" />
              Performa & Rasio Kehadiran
            </h2>
            <div className="flex bg-slate-800/40 p-0.5 rounded-lg border border-slate-700/50">
              <button
                onClick={() => setActiveRightTab('chart')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition duration-200 ${
                  activeRightTab === 'chart'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Grafik
              </button>
              <button
                onClick={() => setActiveRightTab('list')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition duration-200 ${
                  activeRightTab === 'list'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Rasio Personil
              </button>
            </div>
          </div>

          <div className="flex-1 w-full flex items-center justify-center">
            {activeRightTab === 'chart' ? (
              <div className="w-full flex justify-center items-center py-2">
                <canvas
                  ref={webChartCanvasRef}
                  width={1200}
                  height={340}
                  className="w-full max-w-[850px] h-auto object-contain"
                />
              </div>
            ) : (
              <div className="w-full max-h-[260px] overflow-y-auto pr-1 space-y-3.5 custom-scrollbar">
                {stats.personStats.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-sm py-12">
                    <Calendar className="w-10 h-10 mb-2 opacity-30" />
                    Belum ada data absensi.
                  </div>
                ) : (
                  stats.personStats.map((person, idx) => (
                    <div key={idx} className="space-y-1.5 w-full">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                        <div className="flex items-center gap-2 truncate max-w-[70%]">
                          <span className="text-slate-500 font-mono text-[9px]">{idx + 1}.</span>
                          <span className="truncate text-white">{person.nama}</span>
                          <span className="text-[9px] font-normal text-slate-500 truncate">({person.jabatan})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-normal text-slate-500">({person.hadir}/{person.total})</span>
                          <span className={person.rate >= 80 ? 'text-emerald-400' : person.rate >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                            {person.rate}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden border border-slate-700/30">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            person.rate >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : person.rate >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-rose-500 to-rose-400'
                          }`}
                          ref={(el) => {
                            if (el) el.style.width = `${person.rate}%`;
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ─── Form Section: Checklist Absen TBM ───────────────────── */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 bg-violet-500 rounded-full shadow-lg shadow-violet-500" />
            Checklist Kehadiran Harian TBM
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">TANGGAL ABSEN</label>
              <input
                type="date"
                value={formDate}
                onChange={e => {
                  const val = e.target.value;
                  if (!val) return;
                  const parts = val.split('-');
                  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                  const day = d.getDay();
                  if (day === 0 || day === 6) {
                    toast.error("Hari Sabtu dan Minggu tidak dapat dipilih untuk absensi!");
                    return;
                  }
                  setFormDate(val);
                }}
                title="Tanggal Absen"
                className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">TIM / KATEGORI</label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value as any)}
                title="Kategori TBM"
                className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50 font-bold font-sans"
              >
                <option value="Semua">Semua</option>
                <option value="UTT Daily">UTT Daily</option>
                <option value="UTT Mobile">UTT Mobile</option>
                <option value="DME">DME</option>
                <option value="Manual">Input Manual</option>
              </select>
            </div>
          </div>
        </div>

      {isWeekend ? (
        <div className="py-12 px-6 flex flex-col items-center justify-center text-center bg-slate-950/20 rounded-xl border border-white/5 space-y-3">
          <div className="p-3 bg-rose-500/10 rounded-full border border-rose-500/20">
            <Calendar className="w-8 h-8 text-rose-400" />
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">PENGINPUTAN DINONAKTIFKAN</h3>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed font-medium">
            Penginputan absensi TBM dinonaktifkan pada hari <strong className="text-rose-400">Sabtu & Minggu</strong> (hari libur kerja). Anda tidak dapat memasukkan atau menyimpan absensi pada tanggal ini.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/60 text-slate-300">
                  <th className="px-3 py-3 text-left w-12">No</th>
                  <th className="px-3 py-3 text-left">Nama Lengkap</th>
                  <th className="px-3 py-3 text-left w-48">Jabatan</th>
                  <th className="px-3 py-3 text-center w-60">Status Kehadiran</th>
                  <th className="px-3 py-3 text-left">Keterangan (Remark)</th>
                  {formCategory === 'Manual' && <th className="px-3 py-3 text-center w-16">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {(() => {
                  let lastCategory = '';
                  return visibleChecklist.map((item, index) => {
                    const isNewCategory = formCategory === 'Semua' && item.category !== lastCategory;
                    if (isNewCategory && item.category) {
                      lastCategory = item.category;
                    }
                    return (
                      <Fragment key={index}>
                        {isNewCategory && item.category && (
                          <tr className="bg-slate-800/40 text-slate-300 border-t border-slate-700/50">
                            <td colSpan={5} className="px-3 py-2 text-[10px] text-pink-400 font-black tracking-wider uppercase bg-slate-900/40">
                              {item.category}
                            </td>
                          </tr>
                        )}
                        <tr className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-3 py-3.5 text-slate-400 font-mono">{index + 1}.</td>
                          <td className="px-3 py-3.5 font-bold text-white">
                            {formCategory === 'Manual' ? (
                              <input
                                type="text"
                                value={item.nama}
                                onChange={e => updateChecklistItem(index, 'nama', e.target.value)}
                                placeholder="Ketik Nama Karyawan..."
                                title="Nama"
                                className="w-full bg-slate-800/40 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50"
                              />
                            ) : (
                              item.nama
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-slate-300 font-medium font-sans">
                            {formCategory === 'Manual' ? (
                              <input
                                type="text"
                                value={item.jabatan}
                                onChange={e => updateChecklistItem(index, 'jabatan', e.target.value)}
                                placeholder="Jabatan..."
                                title="Jabatan"
                                className="w-full bg-slate-800/40 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50"
                              />
                            ) : (
                              item.jabatan
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateChecklistItem(index, 'kehadiran', 'Hadir')}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                  item.kehadiran === 'Hadir'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                                    : 'bg-transparent text-slate-500 border-slate-700 hover:text-slate-400'
                                }`}
                              >
                                HADIR
                              </button>
                              <button
                                type="button"
                                onClick={() => updateChecklistItem(index, 'kehadiran', 'Tidak Hadir')}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                  item.kehadiran === 'Tidak Hadir'
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-sm shadow-rose-500/10'
                                    : 'bg-transparent text-slate-500 border-slate-700 hover:text-slate-400'
                                }`}
                              >
                                TIDAK HADIR
                              </button>
                              <button
                                type="button"
                                onClick={() => updateChecklistItem(index, 'kehadiran', 'Libur')}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                  item.kehadiran === 'Libur'
                                    ? 'bg-violet-500/20 text-violet-400 border-violet-500/40 shadow-sm shadow-violet-500/10'
                                    : 'bg-transparent text-slate-500 border-slate-700 hover:text-slate-400'
                                }`}
                              >
                                LIBUR
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-1.5">
                              {['Izin', 'Sakit', 'Mobile'].map((opt) => {
                                const isChecked = item.remark === opt;
                                return (
                                  <button
                                    type="button"
                                    key={opt}
                                    onClick={() => {
                                      const newValue = isChecked ? '' : opt;
                                      updateChecklistItem(index, 'remark', newValue);
                                    }}
                                    className={`px-2 py-1 rounded-lg border text-[9px] font-black transition-all cursor-pointer ${
                                      isChecked
                                        ? 'bg-violet-500/20 text-violet-400 border-violet-500/40 shadow-sm'
                                        : 'bg-slate-800/40 text-slate-500 border-slate-700/50 hover:border-slate-600 hover:text-slate-400'
                                    }`}
                                  >
                                    {opt.toUpperCase()}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          {formCategory === 'Manual' && (
                            <td className="px-3 py-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeManualRow(index)}
                                title="Hapus Baris"
                                className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      </Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-950/20 rounded-xl border border-white/5 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-pink-400" />
                Unggah Foto Dokumentasi TBM
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Unggah bukti foto dokumentasi kehadiran TBM untuk hari ini.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <label className="cursor-pointer px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/50 hover:border-slate-650 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition active:scale-95 animate-none">
                <Upload className="w-4 h-4 text-pink-400" />
                Pilih Berkas Foto
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleAddSubmissionPhoto}
                  className="hidden"
                />
              </label>

              {isCompressing && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-pink-500" />
                  Mengompresi gambar...
                </div>
              )}
            </div>

            {submissionPhotos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                {submissionPhotos.map((photo, pIdx) => (
                  <div key={pIdx} className="relative group aspect-square bg-slate-900 rounded-xl overflow-hidden border border-white/10">
                    <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeSubmissionPhoto(pIdx)}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-lg transition active:scale-90"
                      title="Hapus"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/10">
            <div>
              {formCategory === 'Manual' && (
                <button
                  type="button"
                  onClick={addManualRow}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 animate-none"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Baris Manual
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || visibleChecklist.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-violet-500/25 active:scale-95 transition"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Menyimpan Absensi...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Simpan Absensi Checklist ({visibleChecklist.length} Karyawan)
                </>
              )}
            </button>
          </div>
        </form>
      )}
      </div>

      {/* ─── Table/Folder Section: Records List ────────────────── */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-6">
        
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500" />
              Daftar Log Kehadiran Absen TBM
            </h2>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {recordsViewMode === 'matrix' ? (
                <span className="text-slate-200">Log Absen / Tabel Matriks</span>
              ) : (
                <>
                  <button 
                    onClick={() => { setViewLevel('month'); setSelectedMonth(null); setSelectedDate(null); }}
                    className="hover:text-white transition"
                  >
                    Log Absen
                  </button>
                  {selectedMonth && (
                    <>
                      <span className="text-slate-600">/</span>
                      <button 
                        onClick={() => { setViewLevel('date'); setSelectedDate(null); }}
                        className="hover:text-white transition"
                      >
                        {selectedMonth}
                      </button>
                    </>
                  )}
                  {selectedDate && (
                    <>
                      <span className="text-slate-600">/</span>
                      <span className="text-slate-200">{formatIndonesianDate(selectedDate)}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-950/40 p-0.5 rounded-lg border border-white/5">
              <button
                type="button"
                onClick={() => setRecordsViewMode('matrix')}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                  recordsViewMode === 'matrix'
                    ? 'bg-emerald-500 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tabel Matriks
              </button>
              <button
                type="button"
                onClick={() => setRecordsViewMode('folder')}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                  recordsViewMode === 'folder'
                    ? 'bg-emerald-500 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Lihat per Folder
              </button>
            </div>

            {viewLevel !== 'month' && recordsViewMode === 'folder' && (
              <button
                onClick={() => {
                  if (viewLevel === 'records') {
                    setViewLevel('date');
                    setSelectedDate(null);
                  } else if (viewLevel === 'date') {
                    setViewLevel('month');
                    setSelectedMonth(null);
                  }
                }}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700/50 transition active:scale-95 animate-none cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Kembali
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-pink-500 animate-spin" />
            <p className="text-slate-500 text-xs mt-2">Memuat log kehadiran...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            Tidak ada catatan kehadiran yang cocok dengan pencarian / rentang tanggal.
          </div>
        ) : (
          <div>
            {recordsViewMode === 'matrix' ? (() => {
              const dates = stats.chartData.map(d => d.tanggal);
              return (
                <div className="overflow-x-auto rounded-xl border border-white/10 max-h-[500px] custom-scrollbar">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-800/80 sticky top-0 text-slate-350 z-20">
                      <tr>
                        <th className="px-3 py-2.5 border border-white/5 w-10 text-center bg-slate-850">No</th>
                        <th className="px-4 py-2.5 border border-white/5 min-w-[150px] sticky left-0 bg-slate-850 z-30">Nama Personil</th>
                        <th className="px-4 py-2.5 border border-white/5 min-w-[120px] bg-slate-850">Jabatan</th>
                        {dates.map(date => {
                          const parts = date.split('-');
                          const label = parts.length >= 3 ? `${parts[2]}/${parts[1]}` : date;
                          return (
                            <th key={date} className="px-2 py-2.5 border border-white/5 text-center min-w-[55px] font-mono bg-slate-850">
                              {label}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                      {stats.personStats.map((person, pIdx) => (
                        <tr key={person.nama} className="hover:bg-white/5 transition-colors">
                          <td className="px-3 py-2 border border-white/5 text-center text-slate-500 font-mono">{pIdx + 1}</td>
                          <td className="px-4 py-2 border border-white/5 font-bold text-white truncate sticky left-0 bg-slate-900/90 backdrop-blur-sm z-10">{person.nama}</td>
                          <td className="px-4 py-2 border border-white/5 text-slate-400 truncate">{person.jabatan}</td>
                          {dates.map(date => {
                            const rec = filteredRecords.find(r => r.nama === person.nama && r.tanggal === date);
                            let symbol = '-';
                            let cellClass = 'text-slate-600';
                            if (rec) {
                              if (rec.kehadiran === 'Hadir') {
                                symbol = 'H';
                                cellClass = 'text-emerald-400 font-bold bg-emerald-500/10';
                              } else if (rec.kehadiran === 'Libur') {
                                symbol = 'L';
                                cellClass = 'text-violet-400 font-bold bg-violet-500/10';
                              } else {
                                symbol = rec.remark || 'TH';
                                cellClass = 'text-rose-400 font-bold bg-rose-500/10';
                              }
                            }
                            return (
                              <td key={date} className={`px-2 py-2 border border-white/5 text-center font-mono text-[10px] ${cellClass}`}>
                                {symbol}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })() : (
              <div>
                {/* LEVEL 1: MONTH FOLDERS */}
            {viewLevel === 'month' && (() => {
              const monthGroups: Record<string, number> = {};
              filteredRecords.forEach(r => {
                const mStr = getIndonesianMonthYear(r.tanggal);
                monthGroups[mStr] = (monthGroups[mStr] || 0) + 1;
              });

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(monthGroups).map(([month, count]) => (
                    <motion.button
                      key={month}
                      whileHover={{ scale: 1.02, x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedMonth(month);
                        setViewLevel('date');
                      }}
                      className="flex items-center gap-4 p-5 bg-slate-800/40 backdrop-blur-xl border border-slate-700/30 rounded-2xl hover:border-pink-500/30 hover:bg-slate-850/40 transition group text-left w-full animate-none"
                    >
                      <div className="p-3 bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl border border-amber-500/20 group-hover:scale-105 transition-transform flex-shrink-0 animate-none">
                        <Folder className="w-8 h-8 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white group-hover:text-pink-400 transition-colors truncate">{month}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{count} Log Kehadiran</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              );
            })()}

            {/* LEVEL 2: DATE FOLDERS */}
            {viewLevel === 'date' && (() => {
              const dateGroups: Record<string, number> = {};
              filteredRecords.forEach(r => {
                const mStr = getIndonesianMonthYear(r.tanggal);
                if (mStr === selectedMonth) {
                  dateGroups[r.tanggal] = (dateGroups[r.tanggal] || 0) + 1;
                }
              });

              const sortedDates = Object.entries(dateGroups).sort((a, b) => b[0].localeCompare(a[0]));

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedDates.map(([dateStr, count]) => (
                    <motion.div
                      key={dateStr}
                      whileHover={{ scale: 1.02, x: 2 }}
                      className="relative flex items-center justify-between p-5 bg-slate-800/40 backdrop-blur-xl border border-slate-700/30 rounded-2xl hover:border-pink-500/30 hover:bg-slate-850/40 transition group text-left w-full cursor-pointer animate-none"
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setViewLevel('records');
                      }}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-3 bg-gradient-to-br from-pink-500/10 to-rose-600/5 rounded-xl border border-pink-500/20 group-hover:scale-105 transition-transform flex-shrink-0 animate-none">
                          <Folder className="w-8 h-8 text-pink-400" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white group-hover:text-pink-400 transition-colors truncate">
                            {formatIndonesianDate(dateStr)}
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">{count} Log Kehadiran</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEntireDate(dateStr);
                        }}
                        className="p-2 bg-slate-800/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/30 rounded-xl transition active:scale-90 animate-none flex-shrink-0"
                        title="Hapus Seluruh Log Tanggal Ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              );
            })()}

            {/* LEVEL 3: DETAILED RECORDS */}
            {viewLevel === 'records' && (() => {
              const dayRecords = filteredRecords.filter(r => r.tanggal === selectedDate);

              return (
                <div className="space-y-6">
                  {/* Photo Documentation Section */}
                  <div className="bg-slate-950/20 p-5 rounded-2xl border border-slate-800/60 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Camera className="w-4 h-4 text-pink-400" />
                          Dokumentasi TBM - {formatIndonesianDate(selectedDate || '')}
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Bukti foto TBM untuk hari ini.</p>
                      </div>
                      <label className="cursor-pointer px-3.5 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/50 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition active:scale-95 animate-none">
                        <Upload className="w-4 h-4 text-pink-400" />
                        Ganti / Tambah Foto
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleUpdateDatePhoto}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {isCompressing && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-pink-500" />
                        Mengompresi foto...
                      </div>
                    )}

                    {!selectedDateDoc || selectedDateDoc.photos.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                        Tidak ada dokumentasi foto untuk tanggal ini. Klik tombol di kanan atas untuk mengunggah.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                        {selectedDateDoc.photos.map((photo, pIdx) => (
                          <div key={pIdx} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-900 border border-white/5 shadow-md shadow-black/10">
                            <img src={photo} alt={`TBM Documentation ${pIdx + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveDatePhoto(pIdx)}
                                className="p-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl transition active:scale-90 animate-none"
                                title="Hapus Foto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attendance Records Table */}
                  <div className="overflow-x-auto border border-slate-800/85 rounded-2xl bg-slate-900/10">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-800/50 text-slate-300 font-bold uppercase tracking-wider border-b border-slate-800/60">
                          <th className="px-4 py-3 text-left w-12">No</th>
                          <th className="px-4 py-3 text-left">Nama Lengkap</th>
                          <th className="px-4 py-3 text-left">Jabatan</th>
                          <th className="px-4 py-3 text-left w-36">Kehadiran</th>
                          <th className="px-4 py-3 text-left">Keterangan</th>
                          <th className="px-4 py-3 text-center w-28">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 bg-slate-950/5">
                        {(() => {
                          const standardCategories: Array<'UTT Daily' | 'UTT Mobile' | 'DME'> = ['UTT Daily', 'UTT Mobile', 'DME'];
                          const extraCategories = Array.from(new Set(dayRecords.map(r => r.category || 'Lainnya')))
                            .filter(cat => cat !== 'UTT Daily' && cat !== 'UTT Mobile' && cat !== 'DME');
                          const allCategories = [...standardCategories, ...extraCategories];

                          return allCategories.map(cat => {
                            const isStandard = cat === 'UTT Daily' || cat === 'UTT Mobile' || cat === 'DME';
                            if (isStandard) {
                              const catPersonnel = personnelList.filter(p => p.category === cat);
                              if (catPersonnel.length === 0) return null;
                              return (
                                <Fragment key={cat}>
                                  <tr className="bg-slate-800/30 border-t border-slate-850">
                                    <td colSpan={6} className="px-4 py-2 font-black uppercase text-[10px] text-pink-400 tracking-wider">
                                      Kategori: {cat}
                                    </td>
                                  </tr>
                                  {catPersonnel.map((person, index) => {
                                    const rec = dayRecords.find(r => r.nama === person.nama);
                                    const isEditing = rec ? editingRecordId === rec.id : (editingRecordId === "new_" + person.id);
                                    return (
                                      <tr key={person.nama} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-4 py-3.5 text-slate-500 font-mono">{index + 1}.</td>
                                        <td className="px-4 py-3.5 font-bold text-white">{person.nama}</td>
                                        <td className="px-4 py-3.5 text-slate-300 font-medium font-sans">{person.jabatan}</td>
                                        <td className="px-4 py-3.5">
                                          {rec || isEditing ? (
                                            isEditing ? (
                                              <div className="flex gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() => setEditedKehadiran('Hadir')}
                                                  className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                                    editedKehadiran === 'Hadir'
                                                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                      : 'bg-slate-800 border-slate-700 text-slate-500'
                                                  }`}
                                                >
                                                  Hadir
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setEditedKehadiran('Tidak Hadir')}
                                                  className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                                    editedKehadiran === 'Tidak Hadir'
                                                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                                                      : 'bg-slate-800 border-slate-700 text-slate-500'
                                                  }`}
                                                >
                                                  Tidak Hadir
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setEditedKehadiran('Libur')}
                                                  className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                                    editedKehadiran === 'Libur'
                                                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
                                                      : 'bg-slate-800 border-slate-700 text-slate-500'
                                                  }`}
                                                >
                                                  Libur
                                                </button>
                                              </div>
                                            ) : (
                                              rec && (
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                  rec.kehadiran === 'Hadir'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    : rec.kehadiran === 'Libur'
                                                    ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                }`}>
                                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                                    rec.kehadiran === 'Hadir' ? 'bg-emerald-400 shadow-md' : rec.kehadiran === 'Libur' ? 'bg-violet-400 shadow-md' : 'bg-rose-400 shadow-md'
                                                  }`} />
                                                  {rec.kehadiran}
                                                </span>
                                              )
                                            )
                                          ) : (
                                            <span className="text-slate-500 italic font-mono">- Belum Input -</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-400 italic">
                                          {rec || isEditing ? (
                                            isEditing ? (
                                              <div className="flex items-center gap-1.5">
                                                {['Izin', 'Sakit', 'Mobile'].map((opt) => {
                                                  const isChecked = editedRemark === opt;
                                                  return (
                                                    <button
                                                      type="button"
                                                      key={opt}
                                                      onClick={() => {
                                                        const newValue = isChecked ? '' : opt;
                                                        setEditedRemark(newValue);
                                                      }}
                                                      className={`px-2 py-1 rounded-lg border text-[9px] font-black transition-all cursor-pointer ${
                                                        isChecked
                                                          ? 'bg-pink-500/20 text-pink-400 border-pink-500/40 shadow-sm'
                                                          : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-450'
                                                      }`}
                                                    >
                                                      {opt.toUpperCase()}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            ) : (
                                              rec && (rec.remark || '—')
                                            )
                                          ) : (
                                            '—'
                                          )}
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                          {rec || isEditing ? (
                                            isEditing ? (
                                              <div className="flex justify-center gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() => rec ? handleUpdateRecord(rec.id) : handleSaveNewRecord(person)}
                                                  className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg transition active:scale-90 animate-none"
                                                  title="Simpan"
                                                >
                                                  <Save className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setEditingRecordId(null)}
                                                  className="p-1.5 bg-slate-800 text-slate-400 hover:bg-slate-750 border border-slate-700/50 rounded-lg transition active:scale-90 animate-none"
                                                  title="Batal"
                                                >
                                                  <X className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            ) : (
                                              rec && (
                                                <div className="flex justify-center gap-1.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => startEditing(rec)}
                                                    className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700/50 rounded-lg transition active:scale-90 animate-none"
                                                    title="Edit"
                                                  >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDelete(rec.id)}
                                                    className="p-1.5 bg-slate-800 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/20 rounded-lg transition active:scale-90 animate-none"
                                                    title="Hapus"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              )
                                            )
                                          ) : (
                                            <div className="flex justify-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => startEditingNew(person)}
                                                className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700/50 rounded-lg transition active:scale-90 animate-none"
                                                title="Input Absen"
                                              >
                                                <Pencil className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </Fragment>
                              );
                            } else {
                              const catRecords = dayRecords.filter(r => (r.category || 'Lainnya') === cat);
                              if (catRecords.length === 0) return null;
                              return (
                                <Fragment key={cat}>
                                  <tr className="bg-slate-800/30 border-t border-slate-850">
                                    <td colSpan={6} className="px-4 py-2 font-black uppercase text-[10px] text-pink-400 tracking-wider">
                                      Kategori: {cat}
                                    </td>
                                  </tr>
                                  {catRecords.map((rec, index) => {
                                    const isEditing = editingRecordId === rec.id;
                                    return (
                                      <tr key={rec.id} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-4 py-3.5 text-slate-500 font-mono">{index + 1}.</td>
                                        <td className="px-4 py-3.5 font-bold text-white">
                                          {isEditing ? (
                                            <input
                                              type="text"
                                              value={editedNama}
                                              onChange={e => setEditedNama(e.target.value)}
                                              title="Nama"
                                              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-pink-500"
                                            />
                                          ) : (
                                            rec.nama
                                          )}
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-300 font-medium font-sans">
                                          {isEditing ? (
                                            <input
                                              type="text"
                                              value={editedJabatan}
                                              onChange={e => setEditedJabatan(e.target.value)}
                                              title="Jabatan"
                                              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-pink-500"
                                            />
                                          ) : (
                                            rec.jabatan
                                          )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                          {isEditing ? (
                                            <div className="flex gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => setEditedKehadiran('Hadir')}
                                                className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                                  editedKehadiran === 'Hadir'
                                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                    : 'bg-slate-800 border-slate-700 text-slate-500'
                                                }`}
                                              >
                                                Hadir
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setEditedKehadiran('Tidak Hadir')}
                                                className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                                  editedKehadiran === 'Tidak Hadir'
                                                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                                                    : 'bg-slate-800 border-slate-700 text-slate-500'
                                                }`}
                                              >
                                                Tidak Hadir
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setEditedKehadiran('Libur')}
                                                className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                                  editedKehadiran === 'Libur'
                                                    ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
                                                    : 'bg-slate-800 border-slate-700 text-slate-500'
                                                }`}
                                              >
                                                Libur
                                              </button>
                                            </div>
                                          ) : (
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                              rec.kehadiran === 'Hadir'
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : rec.kehadiran === 'Libur'
                                                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                            }`}>
                                              <span className={`w-1.5 h-1.5 rounded-full ${
                                                rec.kehadiran === 'Hadir' ? 'bg-emerald-400 shadow-md' : rec.kehadiran === 'Libur' ? 'bg-violet-400 shadow-md' : 'bg-rose-400 shadow-md'
                                              }`} />
                                              {rec.kehadiran}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-400 italic">
                                          {isEditing ? (
                                            <div className="flex items-center gap-1.5">
                                              {['Izin', 'Sakit', 'Mobile'].map((opt) => {
                                                const isChecked = editedRemark === opt;
                                                return (
                                                  <button
                                                    type="button"
                                                    key={opt}
                                                    onClick={() => {
                                                      const newValue = isChecked ? '' : opt;
                                                      setEditedRemark(newValue);
                                                    }}
                                                    className={`px-2 py-1 rounded-lg border text-[9px] font-black transition-all cursor-pointer ${
                                                      isChecked
                                                        ? 'bg-pink-500/20 text-pink-400 border-pink-500/40 shadow-sm'
                                                        : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-450'
                                                    }`}
                                                  >
                                                    {opt.toUpperCase()}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          ) : (
                                            rec.remark || '—'
                                          )}
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                          {isEditing ? (
                                            <div className="flex justify-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateRecord(rec.id)}
                                                className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg transition active:scale-90 animate-none"
                                                title="Simpan"
                                              >
                                                <Save className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setEditingRecordId(null)}
                                                className="p-1.5 bg-slate-800 text-slate-400 hover:bg-slate-750 border border-slate-700/50 rounded-lg transition active:scale-90 animate-none"
                                                title="Batal"
                                              >
                                                <X className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex justify-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => startEditing(rec)}
                                                className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700/50 rounded-lg transition active:scale-90 animate-none"
                                                title="Edit"
                                              >
                                                <Pencil className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDelete(rec.id)}
                                                className="p-1.5 bg-slate-800 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/20 rounded-lg transition active:scale-90 animate-none"
                                                title="Hapus"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </Fragment>
                              );
                            }
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmOpen && dateToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-500">
                <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Hapus Log Kehadiran</h3>
                  <p className="text-xs text-slate-400 font-medium">Konfirmasi Penghapusan Permanen</p>
                </div>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed font-sans">
                Apakah Anda yakin ingin menghapus <span className="font-bold text-white font-sans text-xs">SELURUH</span> data absensi dan dokumentasi foto untuk tanggal <span className="font-bold text-rose-400 font-sans text-xs">{formatIndonesianDate(dateToDelete)}</span>? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setDateToDelete(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold transition active:scale-95 animate-none"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (dateToDelete) {
                      await executeDeleteDate(dateToDelete);
                    }
                    setDeleteConfirmOpen(false);
                    setDateToDelete(null);
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white rounded-xl text-xs font-bold transition active:scale-95 animate-none"
                >
                  Ya, Hapus Semua
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
