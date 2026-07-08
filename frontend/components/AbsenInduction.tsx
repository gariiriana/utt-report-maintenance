import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, FileText, FileSpreadsheet,
  Plus, Trash2, Search, RefreshCw,
  Folder, ChevronLeft, Pencil,
  Camera, X, Save, Users, Building2, MessageSquare
} from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { loadLogoBase64 } from '@/utils/ReportPdfExport';

// ─── Interfaces ───
interface InductionRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  nama: string;
  perusahaan: string;
  foto: string; // legacy field, kept for compatibility
  remark: string;
}

interface DocumentationRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  isDocumentation: boolean;
  photos: Array<{ base64: string; description: string }>;
}

// ─── Helper Functions ───
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

const compressImage = (file: File | Blob, maxSize = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let w = img.width;
        let h = img.height;
        if (w > h) { if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; } }
        else { if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; } }
        canvas.width = w;
        canvas.height = h;
        ctx?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve('');
    };
    reader.onerror = () => resolve('');
  });
};

// ─── Main Component ───
export function AbsenInduction() {
  // Data state
  const [allRecords, setAllRecords] = useState<InductionRecord[]>([]);
  const [docRecords, setDocRecords] = useState<DocumentationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Folder navigation
  const [viewLevel, setViewLevel] = useState<'month' | 'date' | 'records'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  // Checklist (input rows) — no foto per person
  const [checklist, setChecklist] = useState<Array<{
    nama: string;
    perusahaan: string;
    remark: string;
  }>>([{ nama: '', perusahaan: '', remark: '' }]);

  // Multiple activity photos for the induction event
  const [activityPhotos, setActivityPhotos] = useState<Array<{ base64: string; description: string }>>([]);

  // Inline edit state for existing records
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editedNama, setEditedNama] = useState('');
  const [editedPerusahaan, setEditedPerusahaan] = useState('');
  const [editedRemark, setEditedRemark] = useState('');

  // Photo preview modal
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // File input ref for activity photo
  const activityPhotoRef = useRef<HTMLInputElement | null>(null);

  // Tab and Chart refs
  const [activeRightTab, setActiveRightTab] = useState<'chart' | 'list'>('chart');
  const webChartCanvasRef = useRef<HTMLCanvasElement>(null);

  // ─── Firestore Realtime Listener ───
  useEffect(() => {
    const q = query(collection(db, 'absen_induction'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: InductionRecord[] = [];
      const docs: DocumentationRecord[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.isDocumentation) {
          docs.push({
            id: docSnap.id,
            tanggal: data.tanggal || '',
            isDocumentation: true,
            photos: data.photos || []
          });
          return;
        }
        if (data.isPersonnel) return;
        records.push({
          id: docSnap.id,
          tanggal: data.tanggal || '',
          nama: data.nama || '',
          perusahaan: data.perusahaan || data.jabatan || '',
          foto: data.foto || '',
          remark: data.remark || '',
        });
      });
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

  // ─── Filtered Records ───
  const filteredRecords = useMemo(() => {
    return allRecords.filter(rec => {
      const matchDate = (!startDate || rec.tanggal >= startDate) && (!endDate || rec.tanggal <= endDate);
      const term = searchTerm.toLowerCase();
      const matchText = rec.nama.toLowerCase().includes(term) ||
                        rec.perusahaan.toLowerCase().includes(term) ||
                        rec.remark.toLowerCase().includes(term);
      return matchDate && matchText;
    });
  }, [allRecords, startDate, endDate, searchTerm]);

  // ─── Statistics ───
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const uniqueDates = new Set(filteredRecords.map(r => r.tanggal)).size;
    const uniqueCompanies = new Set(filteredRecords.map(r => r.perusahaan).filter(Boolean)).size;

    // Group by date for chart
    const dateGroups: Record<string, number> = {};
    filteredRecords.forEach(r => {
      dateGroups[r.tanggal] = (dateGroups[r.tanggal] || 0) + 1;
    });
    const chartData = Object.entries(dateGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tanggal, count]) => ({ tanggal, count }));

    // Group by company for leaderboard
    const companyGroups: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const comp = r.perusahaan?.trim() || 'Lainnya';
      companyGroups[comp] = (companyGroups[comp] || 0) + 1;
    });
    const companyStats = Object.entries(companyGroups)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { total, uniqueDates, uniqueCompanies, chartData, companyStats };
  }, [filteredRecords]);

  // Draw web chart for induction (Person & Days KPI)
  useEffect(() => {
    if (activeRightTab !== 'chart' || !webChartCanvasRef.current) return;
    const canvas = webChartCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ── LEFT SIDE: Company Distribution Donut Chart ──
    const donutCx = 220;
    const donutCy = 180;
    const donutR = 75;
    const donutInner = 48;

    // Title
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#ffffff'; // White text
    ctx.textAlign = 'center';
    ctx.fillText('PORSI KONTRAKTOR', donutCx, 45);

    const totalCount = stats.total;
    const topStats = stats.companyStats.slice(0, 4);
    const otherCount = stats.companyStats.slice(4).reduce((sum, item) => sum + item.count, 0);

    const donutData: Array<{ name: string; count: number; color: string }> = [];
    const colors = ['#00599c', '#3b82f6', '#60a5fa', '#10b981', '#64748b'];

    topStats.forEach((item, idx) => {
      donutData.push({ name: item.name, count: item.count, color: colors[idx] });
    });
    if (otherCount > 0) {
      donutData.push({ name: 'Lainnya', count: otherCount, color: colors[4] });
    }

    let currentAngle = -Math.PI / 2;
    donutData.forEach(item => {
      const share = totalCount > 0 ? item.count / totalCount : 0;
      const angle = share * Math.PI * 2;

      ctx.beginPath();
      ctx.moveTo(donutCx, donutCy);
      ctx.arc(donutCx, donutCy, donutR, currentAngle, currentAngle + angle);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();

      currentAngle += angle;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(donutCx, donutCy, donutInner, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a'; // Matches dashboard background (slate-900 / slate-950)
    ctx.fill();

    // Center stats
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${totalCount}`, donutCx, donutCy - 5);
    ctx.font = '10px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Total Orang', donutCx, donutCy + 15);

    // Legend below Donut
    const legYStart = donutCy + donutR + 15;
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    
    donutData.slice(0, 3).forEach((item, idx) => {
      ctx.fillStyle = item.color;
      const label = item.name.length > 10 ? item.name.substring(0, 10) + '..' : item.name;
      ctx.fillText(`● ${label}: ${item.count}`, donutCx - 100 + (idx * 75), legYStart);
    });
    if (donutData.length > 3) {
      ctx.fillStyle = donutData[3].color;
      const label4 = donutData[3].name.length > 10 ? donutData[3].name.substring(0, 10) + '..' : donutData[3].name;
      ctx.fillText(`● ${label4}: ${donutData[3].count}`, donutCx - 70, legYStart + 15);
      if (donutData.length > 4) {
        ctx.fillStyle = donutData[4].color;
        ctx.fillText(`● Lainnya: ${donutData[4].count}`, donutCx + 15, legYStart + 15);
      }
    }

    // ── RIGHT SIDE: Weekly Induction activity chart (People & Days) ──
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
    ctx.fillText('AKTIVITAS INDUCTION MINGGUAN', leftMargin + chartW / 2, 45);

    // Helper for weekly ranges
    const getWeeksInRange = (startStr: string, endStr: string) => {
      const list: Array<{ start: Date; end: Date; label: string }> = [];
      const parseLocalDate = (dateStr: string) => {
        const parts = dateStr.split('-');
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      };
      
      const start = parseLocalDate(startStr);
      const limit = parseLocalDate(endStr);
      
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

    // Group records and calculate unique dates per week
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

      const uniqueDays = new Set(recs.map(r => r.tanggal)).size;
      return {
        label: w.label,
        peopleCount: recs.length,
        dayCount: uniqueDays
      };
    });

    // Find max value for y-axis scaling
    let maxVal = 10;
    weeklyData.forEach(d => {
      if (d.peopleCount > maxVal) maxVal = d.peopleCount;
      if (d.dayCount > maxVal) maxVal = d.dayCount;
    });
    // Round maxVal to nice increment
    maxVal = Math.ceil(maxVal / 5) * 5;

    // Draw axes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftMargin, topMargin);
    ctx.lineTo(leftMargin, topMargin + chartH);
    ctx.lineTo(canvas.width - rightMargin, topMargin + chartH);
    ctx.stroke();

    // Draw horizontal grid lines (y-axis grid)
    ctx.font = '10px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const val = (maxVal / gridLines) * i;
      const y = topMargin + chartH - (i * (chartH / gridLines));
      
      // grid line
      if (i > 0) {
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(canvas.width - rightMargin, y);
        ctx.stroke();
      }
      
      ctx.fillText(String(Math.round(val)), leftMargin - 10, y);
    }

    // Draw bars
    const numWeeks = weeklyData.length;
    const weekW = chartW / (numWeeks || 1);
    const barSpacing = Math.max(3, weekW * 0.15);
    const barW = Math.max(4, (weekW - barSpacing * 2) / 2 - 2);

    weeklyData.forEach((d, idx) => {
      const weekCenterX = leftMargin + (idx * weekW) + weekW / 2;
      const leftBarX = weekCenterX - barW - 1;
      const rightBarX = weekCenterX + 1;

      // Heights
      const leftBarH = (d.peopleCount / maxVal) * chartH;
      const rightBarH = (d.dayCount / maxVal) * chartH;

      const yBase = topMargin + chartH;

      // Draw left bar (People: DME Blue)
      if (d.peopleCount > 0) {
        ctx.fillStyle = '#00599c';
        ctx.fillRect(leftBarX, yBase - leftBarH, barW, leftBarH);
        
        // value label on top of bar
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(d.peopleCount), leftBarX + barW / 2, yBase - leftBarH - 6);
      }

      // Draw right bar (Days: Emerald)
      if (d.dayCount > 0) {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(rightBarX, yBase - rightBarH, barW, rightBarH);
        
        // value label on top of bar
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(d.dayCount), rightBarX + barW / 2, yBase - rightBarH - 6);
      }

      // x-axis label (rotated slightly if many weeks)
      ctx.fillStyle = '#94a3b8';
      ctx.font = numWeeks > 6 ? '8px Arial' : '9px Arial';
      ctx.textAlign = 'center';
      
      const labelY = yBase + 15;
      if (numWeeks > 5) {
        ctx.save();
        ctx.translate(weekCenterX, labelY);
        ctx.rotate(-Math.PI / 12);
        ctx.fillText(d.label, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(d.label, weekCenterX, labelY);
      }
    });

    // Draw Weekly chart legend
    const legendWeeklyY = topMargin + chartH + 35;
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00599c';
    ctx.fillText('● Jumlah Orang Di-induction', leftMargin + chartW / 2 - 80, legendWeeklyY);
    ctx.fillStyle = '#10b981';
    ctx.fillText('● Jumlah Hari Kegiatan', leftMargin + chartW / 2 + 80, legendWeeklyY);

  }, [activeRightTab, stats, startDate, endDate, filteredRecords]);

  // ─── Folder Navigation Data ───
  const monthFolders = useMemo(() => {
    const months: Record<string, { count: number; dates: Set<string> }> = {};
    filteredRecords.forEach(rec => {
      const monthKey = rec.tanggal.substring(0, 7); // YYYY-MM
      if (!months[monthKey]) months[monthKey] = { count: 0, dates: new Set() };
      months[monthKey].count++;
      months[monthKey].dates.add(rec.tanggal);
    });
    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, val]) => ({ key, label: getIndonesianMonthYear(key + '-01'), count: val.count, dateCount: val.dates.size }));
  }, [filteredRecords]);

  const dateFolders = useMemo(() => {
    if (!selectedMonth) return [];
    const dates: Record<string, number> = {};
    filteredRecords.forEach(rec => {
      if (rec.tanggal.startsWith(selectedMonth)) {
        dates[rec.tanggal] = (dates[rec.tanggal] || 0) + 1;
      }
    });
    return Object.entries(dates)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, count]) => ({ date, label: formatIndonesianDate(date), count }));
  }, [filteredRecords, selectedMonth]);

  const dateRecords = useMemo(() => {
    if (!selectedDate) return [];
    return filteredRecords.filter(r => r.tanggal === selectedDate);
  }, [filteredRecords, selectedDate]);

  const selectedDateDoc = useMemo(() => {
    if (!selectedDate) return null;
    return docRecords.find(d => d.tanggal === selectedDate);
  }, [docRecords, selectedDate]);

  // ─── Checklist Actions ───
  const updateChecklistItem = (index: number, key: keyof typeof checklist[0], value: string) => {
    setChecklist(prev => prev.map((item, idx) => idx === index ? { ...item, [key]: value } : item));
  };

  const addRow = () => {
    setChecklist(prev => [...prev, { nama: '', perusahaan: '', remark: '' }]);
  };

  const removeRow = (index: number) => {
    setChecklist(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleActivityPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsCompressing(true);
    const newPhotos: Array<{ base64: string; description: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const compressed = await compressImage(file);
      if (compressed) {
        newPhotos.push({ base64: compressed, description: '' });
      }
    }
    setActivityPhotos(prev => [...prev, ...newPhotos]);
    setIsCompressing(false);
    e.target.value = '';
  };

  const removeActivityPhoto = (index: number) => {
    setActivityPhotos(prev => prev.filter((_, idx) => idx !== index));
  };

  const updatePhotoDescription = (index: number, desc: string) => {
    setActivityPhotos(prev => prev.map((p, idx) => idx === index ? { ...p, description: desc } : p));
  };

  // ─── Submit ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = checklist.filter(item => item.nama.trim());
    if (validRows.length === 0) {
      toast.error("Minimal satu baris harus memiliki Nama");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Save participant rows
      const batchPromises = validRows.map(item =>
        addDoc(collection(db, 'absen_induction'), {
          tanggal: formDate,
          nama: item.nama.trim(),
          perusahaan: item.perusahaan.trim(),
          foto: '', // legacy compat
          remark: item.remark.trim(),
          createdAt: serverTimestamp()
        })
      );
      await Promise.all(batchPromises);

      // 2. Save or update documentation document for the selected date
      if (activityPhotos.length > 0) {
        const existingDoc = docRecords.find(d => d.tanggal === formDate);
        if (existingDoc) {
          const docRef = doc(db, 'absen_induction', existingDoc.id);
          await updateDoc(docRef, {
            photos: activityPhotos,
            updatedAt: serverTimestamp()
          });
        } else {
          await addDoc(collection(db, 'absen_induction'), {
            tanggal: formDate,
            isDocumentation: true,
            photos: activityPhotos,
            createdAt: serverTimestamp()
          });
        }
      }

      toast.success(`Berhasil menyimpan ${validRows.length} data induction!`);

      // Auto-expand date filter range if the submitted date is outside the current range
      if (formDate > endDate) {
        setEndDate(formDate);
      }
      if (formDate < startDate) {
        setStartDate(formDate);
      }

      // Reset
      setChecklist([{ nama: '', perusahaan: '', remark: '' }]);
      setActivityPhotos([]);
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Gagal menyimpan data: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Inline Edit ───
  const startEditing = (rec: InductionRecord) => {
    setEditingRecordId(rec.id);
    setEditedNama(rec.nama);
    setEditedPerusahaan(rec.perusahaan);
    setEditedRemark(rec.remark);
  };

  const handleUpdateRecord = async (id: string) => {
    if (!editedNama.trim()) {
      toast.error("Nama tidak boleh kosong");
      return;
    }
    try {
      await updateDoc(doc(db, 'absen_induction', id), {
        nama: editedNama.trim(),
        perusahaan: editedPerusahaan.trim(),
        remark: editedRemark.trim()
      });
      toast.success("Data berhasil diperbarui!");
      setEditingRecordId(null);
    } catch (err: any) {
      toast.error("Gagal memperbarui data: " + err.message);
    }
  };

  // ─── Delete ───
  const handleDelete = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus data ini?")) return;
    try {
      await deleteDoc(doc(db, 'absen_induction', id));
      toast.success("Data berhasil dihapus");
    } catch (err: any) {
      toast.error("Gagal menghapus data: " + err.message);
    }
  };

  const handleDeleteEntireDate = (dateStr: string) => {
    setDateToDelete(dateStr);
    setDeleteConfirmOpen(true);
  };

  const executeDeleteDate = async (dateStr: string) => {
    try {
      const toDelete = allRecords.filter(r => r.tanggal === dateStr);
      await Promise.all(toDelete.map(r => deleteDoc(doc(db, 'absen_induction', r.id))));

      const existingDoc = docRecords.find(d => d.tanggal === dateStr);
      if (existingDoc) {
        await deleteDoc(doc(db, 'absen_induction', existingDoc.id));
      }

      toast.success(`Berhasil menghapus seluruh data tanggal ${formatIndonesianDate(dateStr)}!`);
      if (selectedDate === dateStr) {
        setSelectedDate(null);
        setViewLevel('date');
      }
    } catch (err: any) {
      toast.error("Gagal menghapus data: " + err.message);
    }
  };

  // ─── Export Excel ───
  const handleExportExcel = async () => {
    if (filteredRecords.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Absen Induction');

    // Header
    ws.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Tanggal', key: 'tanggal', width: 18 },
      { header: 'Nama', key: 'nama', width: 30 },
      { header: 'Perusahaan', key: 'perusahaan', width: 25 },
      { header: 'Remark', key: 'remark', width: 30 },
    ];

    // Style header
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00599C' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 24;

    // Data rows
    filteredRecords.forEach((rec, idx) => {
      ws.addRow({
        no: idx + 1,
        tanggal: formatIndonesianDate(rec.tanggal),
        nama: rec.nama,
        perusahaan: rec.perusahaan,
        remark: rec.remark,
      });
    });

    // Borders
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Collect documentation photos within filter date range
    const filterStart = startDate || '';
    const filterEnd = endDate || '';
    const matchedDocs = docRecords.filter(d => {
      return (!filterStart || d.tanggal >= filterStart) && (!filterEnd || d.tanggal <= filterEnd);
    });

    const exportPhotos: Array<{ tanggal: string; base64: string; description: string }> = [];
    matchedDocs.forEach(d => {
      if (d.photos) {
        d.photos.forEach(p => {
          exportPhotos.push({
            tanggal: d.tanggal,
            base64: p.base64,
            description: p.description
          });
        });
      }
    });

    if (exportPhotos.length > 0) {
      ws.addRow([]);
      ws.addRow([]);
      const titleRow = ws.addRow(['DOKUMENTASI FOTO KEGIATAN INDUCTION']);
      titleRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF00599C' } };
      ws.addRow([]);

      let startRow = filteredRecords.length + 5; // Baris setelah tabel + gap

      for (const item of exportPhotos) {
        ws.getRow(startRow).getCell(1).value = `Foto Kegiatan - ${formatIndonesianDate(item.tanggal)}`;
        ws.getRow(startRow).getCell(1).font = { bold: true, size: 9 };
        
        // Show description below label if exists
        const hasDesc = !!item.description;
        if (hasDesc) {
          ws.getRow(startRow + 1).getCell(1).value = `Keterangan: ${item.description}`;
          ws.getRow(startRow + 1).getCell(1).font = { italic: true, size: 8, color: { argb: 'FF555555' } };
        }

        try {
          const imgId = wb.addImage({
            base64: item.base64,
            extension: 'jpeg',
          });
          
          ws.addImage(imgId, {
            tl: { col: 0, row: startRow + (hasDesc ? 2 : 1) },
            ext: { width: 320, height: 180 }
          });
          
          startRow += hasDesc ? 13 : 12; // beri jarak vertikal untuk gambar & deskripsi
        } catch (e) {
          console.error("Gagal export foto ke Excel:", e);
          startRow += 2;
        }
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Absen_Induction_${startDate}_${endDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File Excel berhasil diunduh!");
  };

  // ─── Export PDF ───
  const handleExportPDF = async () => {
    if (filteredRecords.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const docPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = docPdf.internal.pageSize.getWidth();
    const margin = 12;
    const contentW = pageWidth - 2 * margin;

    // Top stripe
    docPdf.setFillColor(0, 89, 156);
    docPdf.rect(0, 0, pageWidth, 2.5, 'F');

    // Header
    const headerH = 22;
    const headerY = 6;
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setLineWidth(0.1);
    docPdf.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');

    const col1W = 35;
    const col3W = 35;
    docPdf.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
    docPdf.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);

    let leftLogoBase64 = '';
    let rightLogoBase64 = '';
    try {
      leftLogoBase64 = await loadLogoBase64(logoDwimitra);
      rightLogoBase64 = await loadLogoBase64(logoNeutraDC);
    } catch (e) { console.error(e); }

    if (leftLogoBase64) {
      docPdf.addImage(leftLogoBase64, 'JPEG', margin + 3, headerY + 4, col1W - 6, 14, undefined, 'FAST');
    }
    if (rightLogoBase64) {
      docPdf.addImage(rightLogoBase64, 'JPEG', pageWidth - margin - col3W + 5, headerY + 5.5, col3W - 10, 11, undefined, 'FAST');
    }

    const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
    docPdf.setFontSize(10).setFont('helvetica', 'bold').setTextColor(0, 89, 156);
    docPdf.text('LAPORAN ABSENSI INDUCTION', centerX, headerY + 6.5, { align: 'center' });

    docPdf.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(30, 30, 30);
    docPdf.text('PT DWIMITRA EKATAMA MANDIRI', centerX, headerY + 11.5, { align: 'center' });

    docPdf.setFontSize(7).setFont('helvetica', 'normal').setTextColor(100, 100, 100);
    docPdf.text(`Periode: ${startDate || '-'} s.d. ${endDate || '-'}`, centerX, headerY + 16, { align: 'center' });
    docPdf.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, centerX, headerY + 20, { align: 'center' });

    // Summary
    let y = headerY + headerH + 5;
    docPdf.setFillColor(248, 250, 252);
    docPdf.roundedRect(margin, y, contentW, 18, 1.5, 1.5, 'F');
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setLineWidth(0.15);
    docPdf.roundedRect(margin, y, contentW, 18, 1.5, 1.5, 'D');

    docPdf.setTextColor(15, 23, 42);
    docPdf.setFontSize(9.5).setFont('helvetica', 'bold');
    docPdf.text('RINGKASAN', margin + 6, y + 7);
    docPdf.setFontSize(8).setFont('helvetica', 'normal').setTextColor(71, 85, 105);
    docPdf.text(`Total Peserta: ${stats.total}  |  Perusahaan: ${stats.uniqueCompanies}`, margin + 6, y + 14);

    y += 23;

    // Table
    const tableData = filteredRecords.map((rec, idx) => [
      idx + 1,
      formatIndonesianDate(rec.tanggal),
      rec.nama,
      rec.perusahaan,
      rec.remark
    ]);

    autoTable(docPdf, {
      startY: y,
      head: [['No', 'Tanggal', 'Nama', 'Perusahaan', 'Remark']],
      body: tableData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [0, 89, 156], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    // Kumpulkan foto unik per tanggal
    // Collect documentation photos within filter date range
    const filterStart = startDate || '';
    const filterEnd = endDate || '';
    const matchedDocs = docRecords.filter(d => {
      return (!filterStart || d.tanggal >= filterStart) && (!filterEnd || d.tanggal <= filterEnd);
    });

    const exportPhotos: Array<{ tanggal: string; base64: string; description: string }> = [];
    matchedDocs.forEach(d => {
      if (d.photos) {
        d.photos.forEach(p => {
          exportPhotos.push({
            tanggal: d.tanggal,
            base64: p.base64,
            description: p.description
          });
        });
      }
    });

    if (exportPhotos.length > 0) {
      docPdf.addPage();
      
      // Header Halaman Dokumentasi
      docPdf.setFillColor(0, 89, 156);
      docPdf.rect(0, 0, pageWidth, 2.5, 'F');
      
      docPdf.setDrawColor(226, 232, 240);
      docPdf.setLineWidth(0.1);
      docPdf.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');
      docPdf.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
      docPdf.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);

      if (leftLogoBase64) {
        docPdf.addImage(leftLogoBase64, 'JPEG', margin + 3, headerY + 4, col1W - 6, 14, undefined, 'FAST');
      }
      if (rightLogoBase64) {
        docPdf.addImage(rightLogoBase64, 'JPEG', pageWidth - margin - col3W + 5, headerY + 5.5, col3W - 10, 11, undefined, 'FAST');
      }

      docPdf.setFontSize(10).setFont('helvetica', 'bold').setTextColor(0, 89, 156);
      docPdf.text('DOKUMENTASI FOTO KEGIATAN INDUCTION', centerX, headerY + 6.5, { align: 'center' });

      docPdf.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(30, 30, 30);
      docPdf.text('PT DWIMITRA EKATAMA MANDIRI', centerX, headerY + 11.5, { align: 'center' });

      docPdf.setFontSize(7).setFont('helvetica', 'normal').setTextColor(100, 100, 100);
      docPdf.text(`Periode: ${startDate || '-'} s.d. ${endDate || '-'}`, centerX, headerY + 16, { align: 'center' });
      docPdf.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, centerX, headerY + 20, { align: 'center' });

      let imgY = headerY + headerH + 12;
      
      exportPhotos.forEach((item, idx) => {
        const isLeft = idx % 2 === 0;
        const colW = (contentW - 6) / 2;
        const imgX = isLeft ? margin : margin + colW + 6;
        
        if (!isLeft && idx > 0) {
          // No shift on Y
        } else if (idx > 0) {
          imgY += 66; // Tinggi baris foto + label + gap + deskripsi
        }

        if (imgY + 58 > docPdf.internal.pageSize.getHeight() - margin) {
          docPdf.addPage();
          docPdf.setFillColor(0, 89, 156);
          docPdf.rect(0, 0, pageWidth, 2.5, 'F');
          imgY = 15;
        }

        docPdf.setFontSize(8).setFont('helvetica', 'bold').setTextColor(30, 30, 30);
        docPdf.text(`Foto Kegiatan - ${formatIndonesianDate(item.tanggal)}`, imgX, imgY - 2);

        docPdf.setDrawColor(200, 200, 200);
        docPdf.setLineWidth(0.15);
        docPdf.roundedRect(imgX, imgY, colW, 45, 1, 1, 'D');

        try {
          docPdf.addImage(item.base64, 'JPEG', imgX + 1, imgY + 1, colW - 2, 43, undefined, 'FAST');
        } catch (e) {
          console.error("Gagal export foto ke PDF:", e);
        }

        if (item.description) {
          docPdf.setFontSize(7).setFont('helvetica', 'oblique').setTextColor(100, 100, 100);
          docPdf.text(item.description, imgX, imgY + 49, { maxWidth: colW });
        }
      });
    }

    docPdf.save(`Absen_Induction_${startDate}_${endDate}.pdf`);
    toast.success("File PDF berhasil diunduh!");
  };

  // ─── Render ───
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <RefreshCw className="w-8 h-8 text-blue-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg shadow-blue-500/20">
              <Users className="w-6 h-6 text-white" />
            </div>
            Absen Induction
          </h2>
          <p className="text-slate-400 text-sm mt-1">Input dan kelola data absensi induction</p>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportPDF}
            className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
          >
            <FileText className="w-4 h-4" /> PDF
          </motion.button>
        </div>
      </div>

      {/* ─── Statistics Cards & Chart Section ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Summary Cards */}
        <div className="space-y-4 font-sans">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Peserta</p>
              <h3 className="text-2xl font-black text-white mt-1">{stats.total} orang</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jumlah Hari</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{stats.uniqueDates} hari</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Calendar className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Kontraktor</p>
              <h3 className="text-2xl font-black text-purple-400 mt-1">{stats.uniqueCompanies} perusahaan</h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <Building2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Right Side: Charts & Leaderboard */}
        <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col justify-start gap-4 min-h-[380px]">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500" />
              Performa & Aktivitas Induction
            </h2>
            <div className="flex bg-slate-800/40 p-0.5 rounded-lg border border-slate-700/50">
              <button
                onClick={() => setActiveRightTab('chart')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition duration-200 ${
                  activeRightTab === 'chart'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Grafik
              </button>
              <button
                onClick={() => setActiveRightTab('list')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition duration-200 ${
                  activeRightTab === 'list'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Kontraktor
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
                {stats.companyStats.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-sm py-12">
                    <Building2 className="w-10 h-10 mb-2 opacity-30" />
                    Belum ada data induction.
                  </div>
                ) : (
                  stats.companyStats.map((item, idx) => {
                    const pct = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
                    return (
                      <div key={idx} className="space-y-1.5 w-full">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                          <div className="flex items-center gap-2 truncate max-w-[70%]">
                            <span className="text-slate-500 font-mono text-[9px]">{idx + 1}.</span>
                            <span className="truncate text-white">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-normal text-slate-500">({item.count} orang)</span>
                            <span className="text-blue-400">{pct}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden border border-slate-700/30">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-600 to-blue-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main Grid: Input Form + Data Browser ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── LEFT: Input Form ─── */}
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-blue-500/10 to-blue-500/5 border-b border-slate-800/50">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              Input Data Induction
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Date */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tanggal</label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                title="Tanggal"
                className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
            </div>

            {/* Checklist Rows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Data Peserta</label>
                <button
                  type="button"
                  onClick={addRow}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Tambah Baris
                </button>
              </div>

              {checklist.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-400">#{idx + 1}</span>
                    {checklist.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-red-400/60 hover:text-red-400 transition-colors"
                        title="Hapus baris"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Nama */}
                  <input
                    type="text"
                    value={item.nama}
                    onChange={e => updateChecklistItem(idx, 'nama', e.target.value)}
                    placeholder="Nama..."
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
                  />

                  {/* Perusahaan */}
                  <input
                    type="text"
                    value={item.perusahaan}
                    onChange={e => updateChecklistItem(idx, 'perusahaan', e.target.value)}
                    placeholder="Perusahaan..."
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
                  />

                  {/* Remark */}
                  <input
                    type="text"
                    value={item.remark}
                    onChange={e => updateChecklistItem(idx, 'remark', e.target.value)}
                    placeholder="Remark / Keterangan..."
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
                  />
                </motion.div>
              ))}
            </div>

            {/* ─── Foto Kegiatan Induction (Multi-Photo) ─── */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Camera className="w-3 h-3" /> Foto Kegiatan Induction (Bisa Upload Lebih dari Satu)
              </label>
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3 space-y-3">
                <input
                  ref={activityPhotoRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleActivityPhotoUpload}
                  title="Upload Foto Kegiatan"
                  className="hidden"
                />
                
                {activityPhotos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activityPhotos.map((p, idx) => (
                      <div key={idx} className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-2 space-y-2 relative group">
                        <div className="relative aspect-video rounded-md overflow-hidden bg-slate-950">
                          <img
                            src={p.base64}
                            alt={`Foto kegiatan ${idx + 1}`}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setPreviewPhoto(p.base64)}
                          />
                          <button
                            type="button"
                            onClick={() => removeActivityPhoto(idx)}
                            title="Hapus foto"
                            className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                        <div>
                          <input
                            type="text"
                            value={p.description}
                            onChange={e => updatePhotoDescription(idx, e.target.value)}
                            placeholder="Tulis deskripsi foto..."
                            className="w-full text-[10px] bg-slate-900 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => activityPhotoRef.current?.click()}
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-dashed border-slate-650/40 rounded-lg text-xs text-slate-400 hover:text-blue-400 hover:border-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <Camera className="w-4 h-4 text-blue-400" />
                  {activityPhotos.length > 0 ? "Tambah Foto Kegiatan Lain" : "Ambil / Upload Foto Kegiatan"}
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {isSubmitting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...</>
              ) : isCompressing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Kompresi foto...</>
              ) : (
                <><Save className="w-4 h-4" /> Simpan Data Induction</>
              )}
            </motion.button>
          </form>
        </div>

        {/* ─── RIGHT: Data Browser ─── */}
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl overflow-hidden">
          {/* Browser Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-slate-800/60 to-slate-800/30 border-b border-slate-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {viewLevel !== 'month' && (
                  <button
                    onClick={() => {
                      if (viewLevel === 'records') {
                        setSelectedDate(null);
                        setViewLevel('date');
                      } else {
                        setSelectedMonth(null);
                        setViewLevel('month');
                      }
                    }}
                    title="Kembali"
                    className="p-1.5 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Folder className="w-4 h-4 text-amber-400" />
                  {viewLevel === 'month' && 'Arsip Bulanan'}
                  {viewLevel === 'date' && (selectedMonth ? getIndonesianMonthYear(selectedMonth + '-01') : '')}
                  {viewLevel === 'records' && (selectedDate ? formatIndonesianDate(selectedDate) : '')}
                </h3>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Cari..."
                    className="pl-7 pr-3 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded-lg text-[10px] text-white w-28 focus:outline-none focus:ring-1 focus:ring-teal-500/40 placeholder:text-slate-600 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Date range filter */}
            <div className="flex items-center gap-2 mt-3">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                title="Tanggal Mulai"
                className="flex-1 px-2 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded-lg text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all"
              />
              <span className="text-[10px] text-slate-500">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                title="Tanggal Selesai"
                className="flex-1 px-2 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded-lg text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all"
              />
            </div>
          </div>

          {/* Browser Content */}
          <div className="p-4 max-h-[600px] overflow-y-auto space-y-2 custom-scrollbar">
            {/* Month folders */}
            {viewLevel === 'month' && (
              monthFolders.length === 0 ? (
                <div className="text-center py-12">
                  <Folder className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Belum ada data induction</p>
                </div>
              ) : (
                monthFolders.map(folder => (
                  <motion.button
                    key={folder.key}
                    whileHover={{ x: 4 }}
                    onClick={() => {
                      setSelectedMonth(folder.key);
                      setViewLevel('date');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/20 hover:border-teal-500/20 rounded-xl transition-all group"
                  >
                    <Folder className="w-5 h-5 text-amber-400 group-hover:text-amber-300" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-white">{folder.label}</p>
                      <p className="text-[10px] text-slate-500">{folder.dateCount} hari · {folder.count} peserta</p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-600 rotate-180" />
                  </motion.button>
                ))
              )
            )}

            {/* Date folders */}
            {viewLevel === 'date' && (
              dateFolders.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Tidak ada data di bulan ini</p>
                </div>
              ) : (
                dateFolders.map(folder => (
                  <div key={folder.date} className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ x: 4 }}
                      onClick={() => {
                        setSelectedDate(folder.date);
                        setViewLevel('records');
                      }}
                      className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/20 hover:border-teal-500/20 rounded-xl transition-all group"
                    >
                      <Calendar className="w-5 h-5 text-teal-400 group-hover:text-teal-300" />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-bold text-white">{folder.label}</p>
                        <p className="text-[10px] text-slate-500">{folder.count} peserta</p>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-slate-600 rotate-180" />
                    </motion.button>
                    <button
                      onClick={() => handleDeleteEntireDate(folder.date)}
                      className="p-2 text-red-400/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Hapus semua data tanggal ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )
            )}

             {/* Individual records */}
             {viewLevel === 'records' && (
               dateRecords.length === 0 ? (
                 <div className="text-center py-12">
                   <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                   <p className="text-sm text-slate-500">Tidak ada data untuk tanggal ini</p>
                 </div>
               ) : (
                 <div className="space-y-3">
                   {/* Dokumentasi Foto Tanggal */}
                   {selectedDateDoc && selectedDateDoc.photos && selectedDateDoc.photos.length > 0 && (
                     <div className="bg-slate-800/40 border border-slate-750 rounded-xl p-3 space-y-2 mb-2">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                         <Camera className="w-3.5 h-3.5 text-blue-400" /> Dokumentasi Kegiatan ({selectedDateDoc.photos.length} Foto)
                       </p>
                       <div className="grid grid-cols-2 gap-2">
                         {selectedDateDoc.photos.map((ph, idx) => (
                           <div key={idx} className="bg-slate-900/60 rounded-lg p-1.5 border border-slate-800 space-y-1 relative group">
                             <div className="aspect-video w-full rounded overflow-hidden bg-black">
                               <img
                                 src={ph.base64}
                                 alt={ph.description || `Foto ${idx + 1}`}
                                 className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                 onClick={() => setPreviewPhoto(ph.base64)}
                               />
                             </div>
                             {ph.description && (
                               <p className="text-[9px] text-slate-400 italic truncate px-0.5" title={ph.description}>
                                 {ph.description}
                               </p>
                             )}
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {/* Daftar Peserta */}
                   <div className="space-y-2">
                     {dateRecords.map((rec, idx) => (
                       <motion.div
                         key={rec.id}
                         initial={{ opacity: 0, y: 5 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: idx * 0.03 }}
                         className="bg-slate-800/30 border border-slate-700/20 rounded-xl p-3 group"
                       >
                         {editingRecordId === rec.id ? (
                           /* Edit mode */
                           <div className="space-y-2">
                             <input
                               value={editedNama}
                               onChange={e => setEditedNama(e.target.value)}
                               placeholder="Nama..."
                               className="w-full px-3 py-1.5 bg-slate-900/50 border border-blue-500/30 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                             />
                             <input
                               value={editedPerusahaan}
                               onChange={e => setEditedPerusahaan(e.target.value)}
                               placeholder="Perusahaan..."
                               className="w-full px-3 py-1.5 bg-slate-900/50 border border-blue-500/30 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                             />
                             <input
                               value={editedRemark}
                               onChange={e => setEditedRemark(e.target.value)}
                               placeholder="Remark..."
                               className="w-full px-3 py-1.5 bg-slate-900/50 border border-blue-500/30 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                             />
                             <div className="flex gap-2">
                               <button
                                 onClick={() => handleUpdateRecord(rec.id)}
                                 className="flex-1 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all"
                               >
                                 <Save className="w-3 h-3" /> Simpan
                               </button>
                               <button
                                 onClick={() => setEditingRecordId(null)}
                                 className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition-all"
                               >
                                 Batal
                               </button>
                             </div>
                           </div>
                         ) : (
                           /* View mode */
                           <div className="flex items-start gap-3">
                             {/* Icon placeholder (replacing individual photos) */}
                             <div className="w-10 h-10 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center flex-shrink-0">
                               <Users className="w-5 h-5 text-blue-400" />
                             </div>

                             {/* Info */}
                             <div className="flex-1 min-w-0">
                               <p className="text-sm font-bold text-white truncate">{rec.nama || '-'}</p>
                               <p className="text-[10px] text-blue-400 flex items-center gap-1">
                                 <Building2 className="w-3 h-3" />
                                 {rec.perusahaan || '-'}
                               </p>
                               {rec.remark && (
                                 <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                   <MessageSquare className="w-3 h-3" />
                                   {rec.remark}
                                 </p>
                               )}
                             </div>

                             {/* Actions */}
                             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                               <button
                                 onClick={() => startEditing(rec)}
                                 className="p-1.5 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-blue-400 transition-all"
                                 title="Edit"
                               >
                                 <Pencil className="w-3.5 h-3.5" />
                               </button>
                               <button
                                 onClick={() => handleDelete(rec.id)}
                                 className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                                 title="Hapus"
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                             </div>
                           </div>
                         )}
                       </motion.div>
                     ))}
                   </div>
                 </div>
               )
             )}
          </div>
        </div>
      </div>

      {/* ─── Delete Date Confirmation Modal ─── */}
      <AnimatePresence>
        {deleteConfirmOpen && dateToDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setDeleteConfirmOpen(false); setDateToDelete(null); }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-slate-900 border border-red-500/30 rounded-2xl p-6 z-[110] shadow-2xl"
            >
              <h3 className="text-lg font-bold text-white mb-2">Hapus Data Tanggal</h3>
              <p className="text-sm text-slate-400 mb-4">
                Apakah Anda yakin ingin menghapus <span className="text-red-400 font-bold">seluruh data</span> pada tanggal{' '}
                <span className="text-white font-bold">{formatIndonesianDate(dateToDelete)}</span>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setDeleteConfirmOpen(false); setDateToDelete(null); }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    executeDeleteDate(dateToDelete);
                    setDeleteConfirmOpen(false);
                    setDateToDelete(null);
                  }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all"
                >
                  Hapus Semua
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Photo Preview Modal ─── */}
      <AnimatePresence>
        {previewPhoto && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewPhoto(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] max-w-[90vw] max-h-[90vh]"
            >
              <button
                onClick={() => setPreviewPhoto(null)}
                title="Tutup"
                className="absolute -top-3 -right-3 p-2 bg-slate-800 rounded-full border border-slate-700 text-white hover:bg-slate-700 transition-all z-10"
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={previewPhoto}
                alt="Preview"
                className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain border border-slate-700/50 shadow-2xl"
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
