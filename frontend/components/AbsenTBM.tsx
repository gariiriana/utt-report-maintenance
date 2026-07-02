import { useState, useEffect, useMemo, Fragment, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, FileText, FileSpreadsheet,
  Plus, Trash2, Search, RefreshCw,
  TrendingUp, CheckCircle, XCircle,
  Folder, ChevronLeft, Pencil, Camera, Upload, X, UserPlus, Save
} from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp, where, updateDoc } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { loadLogoBase64 } from '@/utils/ReportPdfExport';

interface AttendanceRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  nama: string;
  kehadiran: 'Hadir' | 'Tidak Hadir';
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

  // Folder navigation state
  const [viewLevel, setViewLevel] = useState<'month' | 'date' | 'records'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  // Form State
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState<'Semua' | 'UTT Daily' | 'UTT Mobile' | 'DME' | 'Manual'>('Semua');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionPhotos, setSubmissionPhotos] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);

  // Inline edit state for logs
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editedNama, setEditedNama] = useState('');
  const [editedJabatan, setEditedJabatan] = useState('');
  const [editedKehadiran, setEditedKehadiran] = useState<'Hadir' | 'Tidak Hadir'>('Hadir');
  const [editedRemark, setEditedRemark] = useState('');

  // Checklist state for the active team
  const [checklist, setChecklist] = useState<Array<{
    nama: string;
    jabatan: string;
    kehadiran: 'Hadir' | 'Tidak Hadir';
    remark: string;
    category?: string;
  }>>([]);

  // Load personnel list from Firestore
  useEffect(() => {
    const q = query(collection(db, 'absen_tbm'), where('isPersonnel', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Personnel[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          nama: data.nama || '',
          jabatan: data.jabatan || '',
          category: data.category || '',
        });
      });
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
              promises.push(
                addDoc(collection(db, 'absen_tbm'), {
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

  // Auto-fill checklist when Category or personnelList changes
  useEffect(() => {
    if (personnelLoading) return;
    if (formCategory === 'Semua') {
      setChecklist(personnelList.map(e => ({
        nama: e.nama,
        jabatan: e.jabatan,
        category: e.category,
        kehadiran: 'Hadir',
        remark: ''
      })));
    } else if (formCategory !== 'Manual') {
      const filtered = personnelList.filter(e => e.category === formCategory);
      setChecklist(filtered.map(e => ({
        nama: e.nama,
        jabatan: e.jabatan,
        category: e.category,
        kehadiran: 'Hadir',
        remark: ''
      })));
    } else {
      setChecklist([{
        nama: '',
        jabatan: '',
        category: 'Manual',
        kehadiran: 'Hadir',
        remark: ''
      }]);
    }
  }, [formCategory, personnelList, personnelLoading]);

  const updateChecklistItem = (index: number, key: 'kehadiran' | 'remark' | 'nama' | 'jabatan', value: any) => {
    setChecklist(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [key]: value };
      }
      return item;
    }));
  };

  const addManualRow = () => {
    setChecklist(prev => [...prev, {
      nama: '',
      jabatan: '',
      kehadiran: 'Hadir',
      remark: '',
      category: 'Manual'
    }]);
  };

  const removeManualRow = (index: number) => {
    setChecklist(prev => prev.filter((_, idx) => idx !== index));
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
      const matchDate = (!startDate || rec.tanggal >= startDate) && (!endDate || rec.tanggal <= endDate);
      const matchText = rec.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        rec.jabatan.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        rec.remark.toLowerCase().includes(searchTerm.toLowerCase());
      return matchDate && matchText;
    });
  }, [allRecords, startDate, endDate, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    let total = filteredRecords.length;
    let hadir = filteredRecords.filter(r => r.kehadiran === 'Hadir').length;
    let tidakHadir = total - hadir;
    let rate = total > 0 ? Math.round((hadir / total) * 100) : 0;
    
    // Group by Date for Bar Chart
    const dateGroups: Record<string, { tanggal: string; Hadir: number; 'Tidak Hadir': number }> = {};
    filteredRecords.forEach(r => {
      if (!dateGroups[r.tanggal]) {
        dateGroups[r.tanggal] = { tanggal: r.tanggal, Hadir: 0, 'Tidak Hadir': 0 };
      }
      if (r.kehadiran === 'Hadir') {
        dateGroups[r.tanggal].Hadir += 1;
      } else {
        dateGroups[r.tanggal]['Tidak Hadir'] += 1;
      }
    });

    const chartData = Object.values(dateGroups).sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    const pieData = [
      { name: 'Hadir', value: hadir, color: '#10b981' },
      { name: 'Tidak Hadir', value: tidakHadir, color: '#f43f5e' }
    ];

    return { total, hadir, tidakHadir, rate, chartData, pieData };
  }, [filteredRecords]);

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

  // Handle Add Attendance Record
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = checklist.some(item => !item.nama.trim() || !item.jabatan.trim());
    if (invalid) {
      toast.error("Semua baris harus memiliki Nama dan Jabatan");
      return;
    }

    setIsSubmitting(true);
    try {
      // Save all checklist items to Firestore
      const batchPromises = checklist.map(item => 
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
      
      toast.success(`Berhasil menyimpan absensi ${checklist.length} karyawan!`);
      // Reset checklist remarks & photos
      setChecklist(prev => prev.map(item => ({ ...item, remark: '', kehadiran: 'Hadir' })));
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
    docPdf.text('PT UNITED TRANSWORLD TRADING', centerX, headerY + 11.5, { align: 'center' });

    docPdf.setFontSize(7).setFont('helvetica', 'normal').setTextColor(100, 100, 100);
    docPdf.text(`Periode: ${startDate || '-'} s.d. ${endDate || '-'}`, centerX, headerY + 16, { align: 'center' });
    docPdf.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, centerX, headerY + 20, { align: 'center' });

    // Summary Card
    let y = headerY + headerH + 5;
    docPdf.setFillColor(248, 250, 252); // Slate-50
    docPdf.rect(margin, y, contentW, 28, 'F');
    docPdf.setDrawColor(226, 232, 240); // Slate-200
    docPdf.rect(margin, y, contentW, 28, 'D');

    docPdf.setTextColor(15, 23, 42); // Slate-900
    docPdf.setFontSize(10);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('RINGKASAN STATISTIK KEHADIRAN', margin + 5, y + 6);

    docPdf.setFontSize(8);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text(`Total Log Kehadiran: ${stats.total} record`, margin + 5, y + 14);
    docPdf.text(`Hadir: ${stats.hadir} kali | Tidak Hadir: ${stats.tidakHadir} kali`, margin + 5, y + 21);
    docPdf.text(`Persentase Kehadiran (Attendance Rate): ${stats.rate}%`, margin + 95, y + 14);

    // Visual Percentage Bar
    docPdf.setFillColor(244, 63, 94); // Red
    docPdf.rect(margin + 95, y + 18, 75, 4, 'F');
    if (stats.rate > 0) {
      docPdf.setFillColor(16, 185, 129); // Green
      docPdf.rect(margin + 95, y + 18, (stats.rate / 100) * 75, 4, 'F');
    }

    // ─── Draw Daily Attendance Bar Chart ──────────────────────────
    let chartY = y + 32;
    docPdf.setFillColor(248, 250, 252);
    docPdf.rect(margin, chartY, contentW, 40, 'F');
    docPdf.setDrawColor(226, 232, 240);
    docPdf.rect(margin, chartY, contentW, 40, 'D');

    docPdf.setTextColor(15, 23, 42);
    docPdf.setFontSize(8.5);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('GRAFIK HARIAN KEHADIRAN (Hadir vs Tidak Hadir)', margin + 5, chartY + 6);

    const chartW = contentW - 20;
    const chartH = 22;
    const startX = margin + 10;
    const startY = chartY + 34;

    // Draw axis lines
    docPdf.setDrawColor(148, 163, 184);
    docPdf.setLineWidth(0.2);
    docPdf.line(startX, startY, startX + chartW, startY); // X axis
    docPdf.line(startX, startY, startX, startY - chartH); // Y axis

    const daysCount = stats.chartData.length;
    if (daysCount > 0) {
      let maxVal = 1;
      stats.chartData.forEach(d => {
        if (d.Hadir > maxVal) maxVal = d.Hadir;
        if (d['Tidak Hadir'] > maxVal) maxVal = d['Tidak Hadir'];
      });

      const colW = chartW / daysCount;
      stats.chartData.forEach((day, idx) => {
        const dx = startX + idx * colW + 2;
        const limitW = Math.max(2, (colW - 4) / 2);

        // Hadir Bar (Green)
        if (day.Hadir > 0) {
          const barH = (day.Hadir / maxVal) * (chartH - 4);
          docPdf.setFillColor(16, 185, 129);
          docPdf.rect(dx, startY - barH, limitW, barH, 'F');
        }

        // Tidak Hadir Bar (Red)
        if (day['Tidak Hadir'] > 0) {
          const barH = (day['Tidak Hadir'] / maxVal) * (chartH - 4);
          docPdf.setFillColor(244, 63, 94);
          docPdf.rect(dx + limitW + 1, startY - barH, limitW, barH, 'F');
        }

        // Label Tanggal
        docPdf.setTextColor(100, 116, 139);
        docPdf.setFontSize(6);
        try {
          const parts = day.tanggal.split('-');
          const dateLabel = parts.length >= 3 ? `${parts[2]}/${parts[1]}` : day.tanggal;
          docPdf.text(dateLabel, dx + colW / 4, startY + 4, { align: 'center' });
        } catch(e) {}
      });
    }

    // Auto Table
    const tableData = filteredRecords.map((r, i) => [
      i + 1,
      r.tanggal,
      r.nama,
      r.jabatan,
      r.kehadiran,
      r.remark || '-'
    ]);

    autoTable(docPdf, {
      startY: chartY + 46,
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

    // Set Row Heights and columns width
    worksheet.getRow(1).height = 45;
    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 18;

    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'LAPORAN KEHADIRAN ABSENSI TBM';
    titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF00599C' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('A2:F2');
    const subtitleCell1 = worksheet.getCell('A2');
    subtitleCell1.value = 'PT UNITED TRANSWORLD TRADING';
    subtitleCell1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF334155' } };
    subtitleCell1.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('A3:F3');
    const subtitleCell2 = worksheet.getCell('A3');
    subtitleCell2.value = 'Data Center Maintenance System';
    subtitleCell2.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
    subtitleCell2.alignment = { vertical: 'middle', horizontal: 'center' };

    // Apply borders around the Header Block (A1:F3)
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 6; c++) {
        const cell = worksheet.getCell(r, c);
        cell.border = {
          top: r === 1 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          bottom: r === 3 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          left: c === 1 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          right: c === 6 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
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
        tl: { col: 5.2, row: 0.2 },
        ext: { width: 85, height: 32 }
      });
    }

    worksheet.addRow([]);
    worksheet.addRow([`Periode: ${startDate || 'all'} s.d. ${endDate || 'all'}`]);
    worksheet.addRow([`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`]);
    worksheet.addRow([]);

    // Summary Rows
    worksheet.addRow(['RINGKASAN STATISTIK']);
    worksheet.addRow([`Total Log Kehadiran`, stats.total]);
    worksheet.addRow([`Hadir`, stats.hadir]);
    worksheet.addRow([`Tidak Hadir`, stats.tidakHadir]);
    worksheet.addRow([`Persentase Kehadiran`, `${stats.rate}%`]);
    worksheet.addRow([]);

    worksheet.getCell('A8').font = { bold: true };
    for (let r = 9; r <= 12; r++) {
      worksheet.getCell(`A${r}`).font = { bold: true };
      worksheet.getCell(`B${r}`).alignment = { horizontal: 'left' };
    }

    // Table Header
    const headers = ['No', 'Tanggal', 'Nama', 'Jabatan', 'Status Kehadiran', 'Keterangan'];
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 24;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle' };
    
    for (let col = 1; col <= 6; col++) {
      headerRow.getCell(col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00599C' }
      };
      headerRow.getCell(col).border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    }

    // Rows Data
    filteredRecords.forEach((rec, idx) => {
      const row = worksheet.addRow([
        idx + 1,
        rec.tanggal,
        rec.nama,
        rec.jabatan,
        rec.kehadiran,
        rec.remark || '-'
      ]);
      row.height = 20;
      row.alignment = { vertical: 'middle' };
      
      const statusCell = row.getCell(5);
      if (rec.kehadiran === 'Hadir') {
        statusCell.font = { color: { argb: 'FF10B981' }, bold: true };
      } else {
        statusCell.font = { color: { argb: 'FFF43F5E' }, bold: true };
      }

      for (let col = 1; col <= 6; col++) {
        row.getCell(col).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      }
    });

    worksheet.columns.forEach((col, idx) => {
      if (idx === 0) col.width = 6;
      else if (idx === 1) col.width = 15;
      else if (idx === 2) col.width = 25;
      else if (idx === 3) col.width = 20;
      else if (idx === 4) col.width = 18;
      else if (idx === 5) col.width = 25;
    });

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
            <div className="p-3 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl shadow-lg shadow-pink-500/20">
              <Calendar className="w-6 h-6 text-white" />
            </div>
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
                        {personnelList.map((p, idx) => (
                          <tr key={p.id} className="hover:bg-slate-800/10 text-slate-300">
                            <td className="px-3 py-2.5 font-mono text-slate-500">{idx + 1}.</td>
                            <td className="px-3 py-2.5 font-bold text-white">{p.nama}</td>
                            <td className="px-3 py-2.5">{p.jabatan}</td>
                            <td className="px-3 py-2.5 text-slate-400">{p.category}</td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeletePersonnel(p.id)}
                                className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition active:scale-90 animate-none"
                                title="Hapus Personil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
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

        {/* Right Side: Charts Display */}
        <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[300px]">
          <div>
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-pink-500 rounded-full shadow-lg shadow-pink-500" />
              Grafik Kehadiran Harian
            </h2>
          </div>
          <div className="flex-1 w-full h-[220px]">
            {stats.chartData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                <Calendar className="w-10 h-10 mb-2 opacity-30" />
                Belum ada data untuk grafik.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="tanggal" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="Hadir" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Tidak Hadir" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
                onChange={e => setFormDate(e.target.value)}
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
                  return checklist.map((item, index) => {
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
                            <div className="flex items-center justify-center gap-2">
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

          {/* Documentation Upload */}
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
              disabled={isSubmitting || checklist.length === 0}
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
                  Simpan Absensi Checklist ({checklist.length} Karyawan)
                </>
              )}
            </button>
          </div>
        </form>
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
            </div>
          </div>

          {viewLevel !== 'month' && (
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
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700/50 transition active:scale-95 animate-none"
            >
              <ChevronLeft className="w-4 h-4" />
              Kembali
            </button>
          )}
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
              const categories = Array.from(new Set(dayRecords.map(r => r.category || 'Lainnya')));

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
                        {categories.map(cat => {
                          const catRecords = dayRecords.filter(r => (r.category || 'Lainnya') === cat);
                          return (
                            <Fragment key={cat}>
                              {/* Category Header Row */}
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
                                        </div>
                                      ) : (
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                          rec.kehadiran === 'Hadir'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                        }`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${
                                            rec.kehadiran === 'Hadir' ? 'bg-emerald-400 shadow-md' : 'bg-rose-400 shadow-md'
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
                                            onClick={() => handleUpdateRecord(rec.id)}
                                            className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg transition active:scale-90 animate-none"
                                            title="Simpan"
                                          >
                                            <Save className="w-3.5 h-3.5" />
                                          </button>
                                          <button
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
                                            onClick={() => startEditing(rec)}
                                            className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700/50 rounded-lg transition active:scale-90 animate-none"
                                            title="Edit"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
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
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
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
