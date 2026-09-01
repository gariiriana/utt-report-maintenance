// ============================================================================
// FILE: HSEFindingsArchive.tsx
// Deskripsi: Komponen Arsip Dokumen Temuan K3 / HSE (HSE Finding Archive).
//            Menampilkan daftar seluruh temuan HSE (Open & Close)
//            dalam format arsip dengan filter, pencarian, statistik,
//            tindak lanjut penutupan temuan (Close), serta export PDF.
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  CheckCircle2,
  Clock,
  FileDown,
  Eye,
  RefreshCw,
  MapPin,
  Calendar,
  UserCheck,
  Maximize2,
  X,
  Layers,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
  Archive,
  SlidersHorizontal,
  Camera,
  Upload,
  Trash2,
  Check,
  Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';
import { compressImage } from '@/utils/imageCompression';
import {
  HSEFindingItem,
  HSEFindingCategory,
  HSEFindingSeverity,
  HSEFindingStatus,
  HSE_CATEGORY_LABELS,
  HSE_SEVERITY_CONFIG,
  HSE_STATUS_CONFIG
} from '@/types/hseFinding';
import {
  exportSingleHSEFindingPDF,
  exportHSEFindingsRecapPDF
} from '@/utils/HSEFindingPdfExport';

// Helper: Format date safely
const formatDate = (dateVal: any): string => {
  if (!dateVal) return '-';
  try {
    if (dateVal?.toDate) return dateVal.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return '-'; }
};

const formatDateTime = (dateVal: any): string => {
  if (!dateVal) return '-';
  try {
    const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) + ' — ' +
      d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch { return '-'; }
};

// Helper: Status icon
const StatusIcon = ({ status }: { status: HSEFindingStatus }) => {
  switch (status) {
    case 'open': return <Clock className="w-4 h-4" />;
    case 'close': return <CheckCircle2 className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
};

// ============================================================================
// Komponen Utama: HSEFindingsArchive
// ============================================================================
export function HSEFindingsArchive() {
  const { user } = useAuth();

  // Data & Loading
  const [findings, setFindings] = useState<HSEFindingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | HSEFindingStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | HSEFindingCategory>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | HSEFindingSeverity>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all'); // Format: YYYY-MM or 'all'
  const [showFilters, setShowFilters] = useState(false);

  // Detail Modal
  const [selectedFinding, setSelectedFinding] = useState<HSEFindingItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Resolve Modal (Tutup Temuan)
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolveData, setResolveData] = useState<{
    afterPhoto: string;
    afterNotes: string;
  }>({
    afterPhoto: '',
    afterNotes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const afterFileInputRef = useRef<HTMLInputElement>(null);

  // Edit Modal State (Full Edit: Status Open/Close, Data, Foto Before & Foto After)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    title: string;
    description: string;
    location: string;
    inspectorName: string;
    category: string;
    severity: HSEFindingSeverity;
    status: HSEFindingStatus;
    targetPerson: string;
    findingDate: string;
    findingTime: string;
    beforePhoto: string;
    beforeNotes: string;
    afterPhoto: string;
    afterNotes: string;
    resolvedAt: string;
  }>({
    title: '',
    description: '',
    location: '',
    inspectorName: '',
    category: '',
    severity: 'medium',
    status: 'open',
    targetPerson: '',
    findingDate: '',
    findingTime: '',
    beforePhoto: '',
    beforeNotes: '',
    afterPhoto: '',
    afterNotes: '',
    resolvedAt: ''
  });
  const editBeforeFileInputRef = useRef<HTMLInputElement>(null);
  const editAfterFileInputRef = useRef<HTMLInputElement>(null);

  // Delete Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [findingToDelete, setFindingToDelete] = useState<HSEFindingItem | null>(null);

  // Lightbox State
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Sort
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'severity_desc' | 'severity_asc'>('date_desc');

  // --------------------------------------------------------------------------
  // Realtime Data Subscription dari Firestore 'hse_findings'
  // --------------------------------------------------------------------------
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'hse_findings'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: HSEFindingItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            id: docSnap.id,
            ...(docSnap.data() as any)
          });
        });
        setFindings(items);
        setIsLoading(false);
      },
      (error) => {
        console.warn('Fallback onSnapshot without ordering:', error);
        const fallbackUnsubscribe = onSnapshot(collection(db, 'hse_findings'), (snap) => {
          const items: HSEFindingItem[] = [];
          snap.forEach((docSnap) => {
            items.push({
              id: docSnap.id,
              ...(docSnap.data() as any)
            });
          });
          items.sort((a, b) => {
            const timeB = b.createdAt?.toMillis?.() || new Date(b.findingDate || 0).getTime();
            const timeA = a.createdAt?.toMillis?.() || new Date(a.findingDate || 0).getTime();
            return timeB - timeA;
          });
          setFindings(items);
          setIsLoading(false);
        });
        return () => fallbackUnsubscribe();
      }
    );

    return () => unsubscribe();
  }, []);

  // --------------------------------------------------------------------------
  // Computed: Available months for filter
  // --------------------------------------------------------------------------
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    findings.forEach(f => {
      if (f.findingDate) {
        const ym = f.findingDate.substring(0, 7); // YYYY-MM
        months.add(ym);
      } else if (f.createdAt?.toDate) {
        const d = f.createdAt.toDate();
        months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    });
    return Array.from(months).sort().reverse();
  }, [findings]);

  // --------------------------------------------------------------------------
  // Computed: Statistics
  // --------------------------------------------------------------------------
  const stats = useMemo(() => {
    const total = findings.length;
    const open = findings.filter(f => f.status === 'open').length;
    const close = findings.filter(f => f.status === 'close').length;
    return { total, open, close };
  }, [findings]);

  // --------------------------------------------------------------------------
  // Computed: Filtered & Sorted Data
  // --------------------------------------------------------------------------
  const severityOrder: Record<HSEFindingSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

  const filteredFindings = useMemo(() => {
    let result = [...findings];

    if (statusFilter !== 'all') {
      result = result.filter(f => f.status === statusFilter);
    }
    if (categoryFilter !== 'all') {
      result = result.filter(f => f.category === categoryFilter);
    }
    if (severityFilter !== 'all') {
      result = result.filter(f => f.severity === severityFilter);
    }
    if (monthFilter !== 'all') {
      result = result.filter(f => {
        if (f.findingDate) return f.findingDate.startsWith(monthFilter);
        if (f.createdAt?.toDate) {
          const d = f.createdAt.toDate();
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return ym === monthFilter;
        }
        return false;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.title?.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q) ||
        f.location?.toLowerCase().includes(q) ||
        f.category?.toLowerCase().includes(q) ||
        f.inspectorName?.toLowerCase().includes(q) ||
        f.reportedBy?.toLowerCase().includes(q) ||
        f.targetPerson?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': {
          const tA = a.createdAt?.toMillis?.() || new Date(a.findingDate || 0).getTime();
          const tB = b.createdAt?.toMillis?.() || new Date(b.findingDate || 0).getTime();
          return tA - tB;
        }
        case 'severity_desc':
          return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        case 'severity_asc':
          return (severityOrder[a.severity] || 0) - (severityOrder[b.severity] || 0);
        case 'date_desc':
        default: {
          const tA = a.createdAt?.toMillis?.() || new Date(a.findingDate || 0).getTime();
          const tB = b.createdAt?.toMillis?.() || new Date(b.findingDate || 0).getTime();
          return tB - tA;
        }
      }
    });

    return result;
  }, [findings, statusFilter, categoryFilter, severityFilter, monthFilter, searchQuery, sortBy]);

  // --------------------------------------------------------------------------
  // Handlers: After Photo Upload & Resolve Finding
  // --------------------------------------------------------------------------
  const handleAfterPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading('Mengompres foto bukti perbaikan...', { id: 'compress-after' });
      const base64 = await compressImage(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.65 });
      setResolveData((prev) => ({ ...prev, afterPhoto: base64 }));
      toast.success('Foto perbaikan berhasil diunggah', { id: 'compress-after' });
    } catch (error) {
      console.error('Error compressing image:', error);
      toast.error('Gagal mengompres gambar', { id: 'compress-after' });
    } finally {
      if (afterFileInputRef.current) afterFileInputRef.current.value = '';
    }
  };

  const handleOpenResolveModal = (finding: HSEFindingItem) => {
    setSelectedFinding(finding);
    setResolveData({
      afterPhoto: finding.afterPhoto || '',
      afterNotes: finding.afterNotes || ''
    });
    setIsResolveModalOpen(true);
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFinding?.id) return;

    if (!resolveData.afterPhoto) {
      toast.error('Foto bukti perbaikan (After) wajib diunggah untuk menutup temuan');
      return;
    }
    if (!resolveData.afterNotes.trim()) {
      toast.error('Catatan tindakan perbaikan wajib diisi');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Menutup temuan K3...');

    try {
      const updatePayload: any = {
        status: 'close',
        afterPhoto: resolveData.afterPhoto,
        afterNotes: resolveData.afterNotes.trim(),
        updatedAt: serverTimestamp(),
        resolvedBy: user?.email || 'HSE Officer',
        resolvedAt: new Date().toISOString().split('T')[0]
      };

      await updateDoc(doc(db, 'hse_findings', selectedFinding.id), updatePayload);

      toast.success('Temuan berhasil diselesaikan & ditutup (Close)!', { id: toastId });
      setIsResolveModalOpen(false);
      if (isDetailOpen) {
        setSelectedFinding(prev => prev ? { ...prev, ...updatePayload } : null);
      }
    } catch (error) {
      console.error('Error closing finding:', error);
      toast.error('Gagal memperbarui status temuan', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Handlers: Full Edit Temuan (Status Open/Close, Data, Foto Before & After)
  // --------------------------------------------------------------------------
  const handleOpenEditModal = (finding: HSEFindingItem) => {
    setSelectedFinding(finding);
    setEditFormData({
      title: finding.title || '',
      description: finding.description || '',
      location: finding.location || '',
      inspectorName: finding.inspectorName || finding.reportedBy || '',
      category: finding.category || '',
      severity: finding.severity || 'medium',
      status: finding.status || 'open',
      targetPerson: finding.targetPerson || '',
      findingDate: finding.findingDate || new Date().toISOString().split('T')[0],
      findingTime: finding.findingTime || '09:00',
      beforePhoto: finding.beforePhoto || '',
      beforeNotes: finding.beforeNotes || '',
      afterPhoto: finding.afterPhoto || '',
      afterNotes: finding.afterNotes || finding.closingNotes || '',
      resolvedAt: finding.resolvedAt ? (typeof finding.resolvedAt === 'string' ? finding.resolvedAt : new Date(finding.resolvedAt).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]
    });
    setIsEditModalOpen(true);
  };

  const handleEditBeforePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading('Mengompres foto temuan...', { id: 'compress-edit-before' });
      const base64 = await compressImage(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.65 });
      setEditFormData(prev => ({ ...prev, beforePhoto: base64 }));
      toast.success('Foto temuan berhasil diunggah', { id: 'compress-edit-before' });
    } catch (error) {
      console.error('Error compressing image:', error);
      toast.error('Gagal mengompres gambar', { id: 'compress-edit-before' });
    } finally {
      if (editBeforeFileInputRef.current) editBeforeFileInputRef.current.value = '';
    }
  };

  const handleEditAfterPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading('Mengompres foto bukti perbaikan...', { id: 'compress-edit-after' });
      const base64 = await compressImage(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.65 });
      setEditFormData(prev => ({ ...prev, afterPhoto: base64 }));
      toast.success('Foto perbaikan berhasil diunggah', { id: 'compress-edit-after' });
    } catch (error) {
      console.error('Error compressing image:', error);
      toast.error('Gagal mengompres gambar', { id: 'compress-edit-after' });
    } finally {
      if (editAfterFileInputRef.current) editAfterFileInputRef.current.value = '';
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFinding?.id) return;

    if (!editFormData.title.trim()) {
      toast.error('Judul temuan wajib diisi');
      return;
    }
    if (!editFormData.location.trim()) {
      toast.error('Lokasi temuan wajib diisi');
      return;
    }
    if (!editFormData.inspectorName.trim()) {
      toast.error('Nama petugas inspeksi wajib diisi');
      return;
    }
    if (editFormData.status === 'close' && !editFormData.afterPhoto) {
      toast.error('Foto bukti perbaikan (After) wajib dilampirkan jika status CLOSE');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Menyimpan perubahan data temuan...');

    try {
      const updatePayload: any = {
        title: editFormData.title.trim(),
        description: editFormData.description.trim(),
        location: editFormData.location.trim(),
        inspectorName: editFormData.inspectorName.trim(),
        category: editFormData.category.trim(),
        severity: editFormData.severity,
        status: editFormData.status,
        targetPerson: editFormData.targetPerson.trim() || '-',
        findingDate: editFormData.findingDate,
        findingTime: editFormData.findingTime,
        beforePhoto: editFormData.beforePhoto,
        beforeNotes: editFormData.beforeNotes.trim(),
        afterPhoto: editFormData.afterPhoto,
        afterNotes: editFormData.afterNotes.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editFormData.status === 'close') {
        updatePayload.resolvedBy = user?.email || 'HSE Officer';
        updatePayload.resolvedAt = editFormData.resolvedAt || new Date().toISOString().split('T')[0];
      } else {
        updatePayload.resolvedAt = null;
        updatePayload.resolvedBy = null;
      }

      await updateDoc(doc(db, 'hse_findings', selectedFinding.id), updatePayload);

      toast.success('Data temuan K3 berhasil diperbarui!', { id: toastId });
      setIsEditModalOpen(false);
      if (isDetailOpen) {
        setSelectedFinding(prev => prev ? { ...prev, ...updatePayload } : null);
      }
    } catch (error) {
      console.error('Error updating finding:', error);
      toast.error('Gagal memperbarui data temuan', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Handlers: Delete Finding
  // --------------------------------------------------------------------------
  const handleDeleteFinding = async () => {
    if (!findingToDelete?.id) return;
    setIsSubmitting(true);
    const toastId = toast.loading('Menghapus data temuan...');

    try {
      await deleteDoc(doc(db, 'hse_findings', findingToDelete.id));
      toast.success('Data temuan berhasil dihapus!', { id: toastId });
      setIsDeleteModalOpen(false);
      setFindingToDelete(null);
      if (isDetailOpen && selectedFinding?.id === findingToDelete.id) {
        setIsDetailOpen(false);
        setSelectedFinding(null);
      }
    } catch (error) {
      console.error('Error deleting finding:', error);
      toast.error('Gagal menghapus data temuan', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Handlers: Export PDF
  // --------------------------------------------------------------------------
  const handleExportSingle = async (finding: HSEFindingItem) => {
    try {
      toast.loading('Menyiapkan PDF temuan...', { id: 'export-single' });
      await exportSingleHSEFindingPDF(finding);
      toast.success('PDF berhasil diunduh!', { id: 'export-single' });
    } catch (err) {
      console.error('Export single PDF error:', err);
      toast.error('Gagal mengunduh PDF temuan.', { id: 'export-single' });
    }
  };

  const handleExportRecap = async () => {
    try {
      toast.loading('Menyiapkan PDF Rekap...', { id: 'export-recap' });
      await exportHSEFindingsRecapPDF(filteredFindings);
      toast.success('PDF Rekap berhasil diunduh!', { id: 'export-recap' });
    } catch (err) {
      console.error('Export recap PDF error:', err);
      toast.error('Gagal mengunduh PDF Rekap.', { id: 'export-recap' });
    }
  };

  const getMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${monthNames[parseInt(m, 10) - 1]} ${y}`;
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ===== Header Section ===== */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 shadow-sm p-5 sm:p-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-100 rounded-2xl">
              <Archive className="w-6 h-6 text-teal-700" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Arsip Dokumen Temuan HSE</h2>
              <p className="text-xs sm:text-sm text-slate-500">Seluruh data temuan keselamatan kerja — Open (Terbuka) & Close (Ditutup)</p>
            </div>
          </div>

          {/* Export Recap Button */}
          {filteredFindings.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportRecap}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-2xl shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export Rekap PDF</span>
              <span className="sm:hidden">Export</span>
            </motion.button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Total Temuan', value: stats.total, icon: Layers, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200', filter: 'all' as const },
            { label: 'Open (Terbuka)', value: stats.open, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', filter: 'open' as const },
            { label: 'Close (Ditutup)', value: stats.close, icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', filter: 'close' as const },
          ].map((s, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (s.filter === 'all') {
                  setStatusFilter('all');
                  setSeverityFilter('all');
                } else {
                  setStatusFilter(s.filter);
                  setSeverityFilter('all');
                }
              }}
              className={`text-left p-3.5 rounded-2xl border ${s.bg} transition-all cursor-pointer ${
                statusFilter === s.filter && severityFilter === 'all' ? 'ring-2 ring-offset-1 ring-teal-400' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-slate-500 font-medium">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ===== Search & Filter Bar ===== */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 shadow-sm p-4 sm:p-5"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, lokasi, pelapor, atau pihak terkait..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition"
            />
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="date_desc">Terbaru</option>
            <option value="date_asc">Terlama</option>
            <option value="severity_desc">Risiko Tertinggi</option>
            <option value="severity_asc">Risiko Terendah</option>
          </select>

          {/* Toggle Advanced Filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-2xl text-sm font-medium transition-colors cursor-pointer ${
              showFilters ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filter</span>
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Advanced Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-100 mt-3">
                {/* Status Filter */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="all">Semua Status</option>
                    <option value="open">Open (Terbuka)</option>
                    <option value="close">Close (Ditutup)</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Kategori</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="all">Semua Kategori</option>
                    {Object.entries(HSE_CATEGORY_LABELS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>

                {/* Severity Filter */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Tingkat Risiko</label>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="all">Semua Risiko</option>
                    {Object.entries(HSE_SEVERITY_CONFIG).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>

                {/* Month Filter */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Bulan</label>
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="all">Semua Bulan</option>
                    {availableMonths.map(ym => (
                      <option key={ym} value={ym}>{getMonthLabel(ym)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clear Filters */}
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setCategoryFilter('all');
                    setSeverityFilter('all');
                    setMonthFilter('all');
                    setSearchQuery('');
                  }}
                  className="text-xs text-teal-600 hover:text-teal-800 font-medium cursor-pointer"
                >
                  Reset Semua Filter
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Filter Tags */}
        {(statusFilter !== 'all' || categoryFilter !== 'all' || severityFilter !== 'all' || monthFilter !== 'all') && (
          <div className="flex flex-wrap gap-2 mt-3">
            {statusFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${HSE_STATUS_CONFIG[statusFilter].badge}`}>
                <StatusIcon status={statusFilter} />
                {HSE_STATUS_CONFIG[statusFilter].label.split(' (')[0]}
                <button onClick={() => setStatusFilter('all')} className="ml-1 hover:opacity-70 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
            {categoryFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${HSE_CATEGORY_LABELS[categoryFilter].badgeColor}`}>
                {HSE_CATEGORY_LABELS[categoryFilter].label.split(' (')[0]}
                <button onClick={() => setCategoryFilter('all')} className="ml-1 hover:opacity-70 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
            {severityFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${HSE_SEVERITY_CONFIG[severityFilter].badge}`}>
                {HSE_SEVERITY_CONFIG[severityFilter].label}
                <button onClick={() => setSeverityFilter('all')} className="ml-1 hover:opacity-70 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
            {monthFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border bg-slate-50 text-slate-700 border-slate-200">
                <Calendar className="w-3 h-3" />
                {getMonthLabel(monthFilter)}
                <button onClick={() => setMonthFilter('all')} className="ml-1 hover:opacity-70 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* ===== Result Count ===== */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-slate-500">
          Menampilkan <strong className="text-slate-700">{filteredFindings.length}</strong> dari {findings.length} temuan
        </p>
      </div>

      {/* ===== Loading State ===== */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Memuat data arsip temuan HSE...</p>
          </div>
        </div>
      )}

      {/* ===== Empty State ===== */}
      {!isLoading && filteredFindings.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 shadow-sm p-10 text-center"
        >
          <div className="inline-flex p-4 bg-slate-100 rounded-2xl mb-4">
            <Archive className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Belum Ada Data Temuan</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || severityFilter !== 'all' || monthFilter !== 'all'
              ? 'Tidak ada temuan yang sesuai dengan filter yang aktif. Coba ubah atau reset filter pencarian.'
              : 'Belum ada data temuan keselamatan kerja yang dicatat. Silakan input temuan baru di menu "Input Temuan K3".'
            }
          </p>
        </motion.div>
      )}

      {/* ===== Finding Cards ===== */}
      {!isLoading && filteredFindings.length > 0 && (
        <div className="space-y-4">
          {filteredFindings.map((finding, index) => {
            const statusCfg = HSE_STATUS_CONFIG[finding.status] || HSE_STATUS_CONFIG.open;
            const severityCfg = HSE_SEVERITY_CONFIG[finding.severity] || HSE_SEVERITY_CONFIG.medium;
            const categoryLabel = HSE_CATEGORY_LABELS[finding.category as keyof typeof HSE_CATEGORY_LABELS]?.label || finding.category || 'Umum';
            const categoryBadgeColor = HSE_CATEGORY_LABELS[finding.category as keyof typeof HSE_CATEGORY_LABELS]?.badgeColor || 'bg-slate-50 text-slate-700 border-slate-200';

            return (
              <motion.div
                key={finding.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all group overflow-hidden"
              >
                <div className="p-5 sm:p-6">
                  {/* Row 1: Title + Badges + Quick Actions */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${severityCfg.dot}`} />
                        <h3 className="text-base font-bold text-slate-900 truncate">
                           {finding.title}
                        </h3>
                      </div>

                      {/* Badges Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusCfg.badge}`}>
                          <StatusIcon status={finding.status} />
                          {statusCfg.label.split(' (')[0]}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${severityCfg.badge}`}>
                          {severityCfg.label}
                        </span>
                        {finding.category && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${categoryBadgeColor}`}>
                            {categoryLabel.split(' (')[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Tombol Edit Data Temuan */}
                      <button
                        onClick={() => handleOpenEditModal(finding)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                        title="Edit Data Temuan & Status (Open / Close)"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>

                      {/* Tombol Tindak Lanjut jika status masih OPEN */}
                      {finding.status === 'open' && (
                        <button
                          onClick={() => handleOpenResolveModal(finding)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                          title="Tutup & Selesaikan Temuan"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Tutup</span>
                        </button>
                      )}

                      <button
                        onClick={() => { setSelectedFinding(finding); setIsDetailOpen(true); }}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-teal-50 text-slate-500 hover:text-teal-700 transition-colors cursor-pointer"
                        title="Lihat Detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExportSingle(finding)}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-teal-50 text-slate-500 hover:text-teal-700 transition-colors cursor-pointer"
                        title="Download PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setFindingToDelete(finding); setIsDeleteModalOpen(true); }}
                        className="p-2 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Hapus Temuan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Meta Info */}
                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs text-slate-500 my-2">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(finding.findingDate)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {finding.location || '-'}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-teal-50/80 border border-teal-200/60 px-2 py-0.5 rounded-lg">
                      <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                      Inspector: <strong className="text-teal-900">{finding.inspectorName || finding.reportedBy || '-'}</strong>
                    </span>
                    {finding.targetPerson && (
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        Pihak Terkait: <strong>{finding.targetPerson}</strong>
                      </span>
                    )}
                  </div>

                  {/* Row 3: Description preview */}
                  {finding.description && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {finding.description}
                    </p>
                  )}

                  {/* Row 4: Photo Thumbnails */}
                  {(finding.beforePhoto || finding.afterPhoto) && (
                    <div className="flex items-center gap-3 mt-3.5">
                      {finding.beforePhoto && (
                        <button
                          onClick={() => setLightboxImage({ url: finding.beforePhoto, title: 'Foto Kondisi Awal (Before)' })}
                          className="relative w-20 h-20 rounded-xl overflow-hidden border border-amber-300 hover:border-amber-500 transition-colors group/thumb cursor-pointer"
                        >
                          <img src={finding.beforePhoto} alt="Before" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/20 transition-colors flex items-center justify-center">
                            <Maximize2 className="w-3.5 h-3.5 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
                          </div>
                          <span className="absolute bottom-0 left-0 right-0 bg-amber-600/90 text-white text-[8px] text-center py-0.5 font-bold">BEFORE</span>
                        </button>
                      )}
                      {finding.afterPhoto && (
                        <button
                          onClick={() => setLightboxImage({ url: finding.afterPhoto!, title: 'Foto Bukti Perbaikan (After)' })}
                          className="relative w-20 h-20 rounded-xl overflow-hidden border border-emerald-300 hover:border-emerald-500 transition-colors group/thumb cursor-pointer"
                        >
                          <img src={finding.afterPhoto} alt="After" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/20 transition-colors flex items-center justify-center">
                            <Maximize2 className="w-3.5 h-3.5 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
                          </div>
                          <span className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 text-white text-[8px] text-center py-0.5 font-bold">AFTER</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ===== Detail Modal ===== */}
      <AnimatePresence>
        {isDetailOpen && selectedFinding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsDetailOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Detail Header */}
              <div className="sticky top-0 bg-white border-b border-slate-100 p-5 rounded-t-3xl z-10">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{selectedFinding.title}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${HSE_STATUS_CONFIG[selectedFinding.status].badge}`}>
                        <StatusIcon status={selectedFinding.status} />
                        {HSE_STATUS_CONFIG[selectedFinding.status].label}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${HSE_SEVERITY_CONFIG[selectedFinding.severity].badge}`}>
                        {HSE_SEVERITY_CONFIG[selectedFinding.severity].label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setIsDetailOpen(false);
                        handleOpenEditModal(selectedFinding);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="Edit Data Temuan"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    {selectedFinding.status === 'open' && (
                      <button
                        onClick={() => handleOpenResolveModal(selectedFinding)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Tutup Temuan</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleExportSingle(selectedFinding)}
                      className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors cursor-pointer"
                      title="Download PDF"
                    >
                      <FileDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsDetailOpen(false)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Detail Body */}
              <div className="p-6 space-y-5">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal Temuan</label>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">{formatDate(selectedFinding.findingDate)}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lokasi</label>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">{selectedFinding.location || '-'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Petugas Inspeksi (Inspector)</label>
                    <p className="text-xs sm:text-sm font-bold text-teal-800 mt-0.5 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                      {selectedFinding.inspectorName || selectedFinding.reportedBy || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pelapor Akun</label>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">{selectedFinding.reportedBy || '-'}</p>
                  </div>
                  {selectedFinding.category && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kategori</label>
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">
                        {HSE_CATEGORY_LABELS[selectedFinding.category as keyof typeof HSE_CATEGORY_LABELS]?.label || selectedFinding.category}
                      </p>
                    </div>
                  )}
                  {selectedFinding.targetPerson && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pihak Terkait / Subkon</label>
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">{selectedFinding.targetPerson}</p>
                    </div>
                  )}
                </div>

                {/* Description */}
                {selectedFinding.description && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deskripsi / Kronologi</label>
                    <p className="text-xs sm:text-sm text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      {selectedFinding.description}
                    </p>
                  </div>
                )}

                {/* Before Photo */}
                {selectedFinding.beforePhoto && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Foto Kondisi Awal (Before)</label>
                    <button
                      onClick={() => setLightboxImage({ url: selectedFinding.beforePhoto, title: 'Foto Kondisi Awal (Before)' })}
                      className="mt-2 relative rounded-2xl overflow-hidden border border-amber-300 hover:border-amber-500 transition-colors max-w-sm block cursor-pointer"
                    >
                      <img src={selectedFinding.beforePhoto} alt="Before" className="w-full max-h-64 object-cover" />
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Maximize2 className="w-3 h-3" /> Perbesar
                      </div>
                    </button>
                    {selectedFinding.beforeNotes && (
                      <p className="text-xs text-slate-500 mt-2 italic">{selectedFinding.beforeNotes}</p>
                    )}
                  </div>
                )}

                {/* After Photo (if closed) */}
                {selectedFinding.afterPhoto && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Foto Bukti Perbaikan (After)</label>
                    <button
                      onClick={() => setLightboxImage({ url: selectedFinding.afterPhoto!, title: 'Foto Bukti Perbaikan (After)' })}
                      className="mt-2 relative rounded-2xl overflow-hidden border border-emerald-300 hover:border-emerald-500 transition-colors max-w-sm block cursor-pointer"
                    >
                      <img src={selectedFinding.afterPhoto} alt="After" className="w-full max-h-64 object-cover" />
                      <div className="absolute bottom-2 right-2 bg-emerald-600/90 text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Maximize2 className="w-3 h-3" /> Perbesar
                      </div>
                    </button>
                    {selectedFinding.afterNotes && (
                      <p className="text-xs text-slate-700 mt-2 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                        <strong>Tindakan Perbaikan:</strong> {selectedFinding.afterNotes}
                      </p>
                    )}
                  </div>
                )}

                {/* Resolution Info */}
                {selectedFinding.status === 'close' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <label className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 block">Info Penutupan Temuan (Closing)</label>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {selectedFinding.resolvedBy && (
                        <div>
                          <span className="text-emerald-600">Diverifikasi / Ditutup oleh:</span>
                          <p className="text-emerald-900 font-bold mt-0.5">{selectedFinding.resolvedBy}</p>
                        </div>
                      )}
                      {selectedFinding.resolvedAt && (
                        <div>
                          <span className="text-emerald-600">Tanggal Selesai:</span>
                          <p className="text-emerald-900 font-bold mt-0.5">{formatDateTime(selectedFinding.resolvedAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>Dibuat: {formatDateTime(selectedFinding.createdAt)}</span>
                  <button
                    onClick={() => { setFindingToDelete(selectedFinding); setIsDeleteModalOpen(true); }}
                    className="text-red-500 hover:text-red-700 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Temuan</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Edit Finding Modal (Full Edit: Status, Data, Before & After) ===== */}
      <AnimatePresence>
        {isEditModalOpen && selectedFinding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                    <Pencil className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold">Edit & Update Temuan K3</h2>
                    <p className="text-xs text-amber-100">Perbarui status temuan, rincian data, atau unggah bukti penutupan (After)</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSubmitting}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* 1. Status Temuan Toggle */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Status Temuan Saat Ini <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, status: 'open' })}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm border transition-all cursor-pointer ${
                        editFormData.status === 'open'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/20'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>OPEN (Temuan Terbuka)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, status: 'close' })}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm border transition-all cursor-pointer ${
                        editFormData.status === 'close'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-600/20'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>CLOSE (Selesai / Ditutup)</span>
                    </button>
                  </div>
                </div>

                {/* 2. Informasi Utama Temuan */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Informasi & Lokasi Temuan
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Judul Temuan <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.title}
                      onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        Lokasi Temuan <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editFormData.location}
                        onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        Petugas Inspeksi <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editFormData.inspectorName}
                        onChange={(e) => setEditFormData({ ...editFormData, inspectorName: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Pihak Terkait / Subkon
                      </label>
                      <input
                        type="text"
                        value={editFormData.targetPerson}
                        onChange={(e) => setEditFormData({ ...editFormData, targetPerson: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Tingkat Bahaya / Risiko
                      </label>
                      <select
                        value={editFormData.severity}
                        onChange={(e) => setEditFormData({ ...editFormData, severity: e.target.value as any })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      >
                        {Object.entries(HSE_SEVERITY_CONFIG).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1 cursor-pointer">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Tanggal Temuan
                      </label>
                      <input
                        type="date"
                        value={editFormData.findingDate}
                        onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch (err) {} }}
                        onChange={(e) => setEditFormData({ ...editFormData, findingDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1 cursor-pointer">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Jam Temuan
                      </label>
                      <input
                        type="time"
                        value={editFormData.findingTime}
                        onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch (err) {} }}
                        onChange={(e) => setEditFormData({ ...editFormData, findingTime: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Uraian & Kronologi Temuan
                    </label>
                    <textarea
                      rows={3}
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      placeholder="Jelaskan kondisi temuan secara rinci..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* 3. Foto Bukti Temuan (Before) */}
                <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Foto Bukti Temuan (BEFORE)
                    </label>
                    {editFormData.beforePhoto && (
                      <button
                        type="button"
                        onClick={() => setEditFormData({ ...editFormData, beforePhoto: '' })}
                        className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Foto</span>
                      </button>
                    )}
                  </div>

                  {editFormData.beforePhoto ? (
                    <div className="relative aspect-video max-h-48 bg-slate-900 rounded-xl overflow-hidden border border-amber-300">
                      <img
                        src={editFormData.beforePhoto}
                        alt="Preview Foto Before"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => editBeforeFileInputRef.current?.click()}
                        className="absolute bottom-2 right-2 flex items-center gap-1 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white rounded-lg text-xs font-bold backdrop-blur-sm cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Ganti Foto</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-amber-300 rounded-xl bg-white/80 text-center">
                      <Camera className="w-7 h-7 text-amber-600 mb-1" />
                      <button
                        type="button"
                        onClick={() => editBeforeFileInputRef.current?.click()}
                        className="mt-1 flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Unggah Foto Before</span>
                      </button>
                    </div>
                  )}

                  <input
                    ref={editBeforeFileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleEditBeforePhotoChange}
                    className="hidden"
                  />

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Catatan Foto Before
                    </label>
                    <input
                      type="text"
                      value={editFormData.beforeNotes}
                      onChange={(e) => setEditFormData({ ...editFormData, beforeNotes: e.target.value })}
                      placeholder="Catatan kondisi foto temuan..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>

                {/* 4. Bukti Perbaikan & Penutupan (After) */}
                <div className={`p-4 rounded-2xl border transition-colors space-y-3 ${
                  editFormData.status === 'close'
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Bukti Tindak Lanjut / Perbaikan (AFTER) {editFormData.status === 'close' && <span className="text-red-500">*</span>}
                    </label>
                    {editFormData.afterPhoto && (
                      <button
                        type="button"
                        onClick={() => setEditFormData({ ...editFormData, afterPhoto: '' })}
                        className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Foto After</span>
                      </button>
                    )}
                  </div>

                  {editFormData.afterPhoto ? (
                    <div className="relative aspect-video max-h-48 bg-slate-900 rounded-xl overflow-hidden border border-emerald-300">
                      <img
                        src={editFormData.afterPhoto}
                        alt="Preview Foto After"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => editAfterFileInputRef.current?.click()}
                        className="absolute bottom-2 right-2 flex items-center gap-1 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white rounded-lg text-xs font-bold backdrop-blur-sm cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Ganti Foto</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-emerald-300 rounded-xl bg-white text-center">
                      <Camera className="w-7 h-7 text-emerald-600 mb-1" />
                      <p className="text-xs text-slate-600 mb-2">Unggah bukti foto bahwa perbaikan K3 telah dilakukan</p>
                      <button
                        type="button"
                        onClick={() => editAfterFileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Unggah Foto Bukti After</span>
                      </button>
                    </div>
                  )}

                  <input
                    ref={editAfterFileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleEditAfterPhotoChange}
                    className="hidden"
                  />

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Catatan Tindakan Perbaikan / Closing Notes {editFormData.status === 'close' && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      rows={2}
                      value={editFormData.afterNotes}
                      onChange={(e) => setEditFormData({ ...editFormData, afterNotes: e.target.value })}
                      placeholder="Jelaskan tindakan korektif yang telah diselesaikan..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {editFormData.status === 'close' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1 cursor-pointer">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Tanggal Selesai (Closing Date)
                      </label>
                      <input
                        type="date"
                        value={editFormData.resolvedAt}
                        onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch (err) {} }}
                        onChange={(e) => setEditFormData({ ...editFormData, resolvedAt: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Menyimpan Perubahan...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Simpan Perubahan Data</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== Resolve / Close Modal ===== */}
      <AnimatePresence>
        {isResolveModalOpen && selectedFinding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8"
            >
              <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold">Tutup Temuan K3 (Close)</h2>
                    <p className="text-xs text-emerald-100">Unggah foto bukti perbaikan (After) untuk menyelesaikan temuan ini</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsResolveModalOpen(false)}
                  disabled={isSubmitting}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleResolveSubmit} className="p-6 space-y-5">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Judul Temuan:</span>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">{selectedFinding.title}</p>
                </div>

                {/* Upload Foto After */}
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-emerald-900 uppercase tracking-wider">
                      Foto Bukti Perbaikan (AFTER) <span className="text-red-500">*</span>
                    </label>
                    {resolveData.afterPhoto && (
                      <button
                        type="button"
                        onClick={() => setResolveData({ ...resolveData, afterPhoto: '' })}
                        className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Foto</span>
                      </button>
                    )}
                  </div>

                  {resolveData.afterPhoto ? (
                    <div className="relative aspect-video max-h-56 bg-slate-900 rounded-2xl overflow-hidden border border-emerald-300">
                      <img
                        src={resolveData.afterPhoto}
                        alt="Preview Foto After"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-300 rounded-2xl bg-white/80 text-center">
                      <Camera className="w-8 h-8 text-emerald-600 mb-2" />
                      <p className="text-xs font-bold text-slate-800 mb-1">Ambil Foto atau Unggah Bukti After</p>
                      <button
                        type="button"
                        onClick={() => afterFileInputRef.current?.click()}
                        className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Pilih Foto</span>
                      </button>
                    </div>
                  )}

                  <input
                    ref={afterFileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleAfterPhotoChange}
                    className="hidden"
                  />
                </div>

                {/* Catatan Tindakan Perbaikan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Catatan Tindakan Perbaikan <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={resolveData.afterNotes}
                    onChange={(e) => setResolveData({ ...resolveData, afterNotes: e.target.value })}
                    placeholder="Contoh: Barikade pengaman telah dipasang, teknisi telah diberikan briefing K3 dan memakai APD lengkap..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsResolveModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Tutup & Selesaikan Temuan</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== Delete Confirmation Modal ===== */}
      <AnimatePresence>
        {isDeleteModalOpen && findingToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-3 bg-red-100 rounded-2xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Hapus Data Temuan?</h3>
                  <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                Temuan: <strong>"{findingToDelete.title}"</strong>
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteFinding}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Hapus</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== Image Lightbox ===== */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setLightboxImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative max-w-4xl max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute -top-3 -right-3 p-2 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors z-10 cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-700" />
              </button>
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-w-full max-h-[85vh] object-contain rounded-2xl"
              />
              <p className="text-center text-white text-sm mt-3 font-medium">{lightboxImage.title}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
