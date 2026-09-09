// ============================================================================
// FILE: DeleteRequestsManager.tsx
// Deskripsi: Komponen Dasbor Khusus QC DME (qcdme@dme.com) untuk Meninjau, 
//            Menyetujui (Hapus Permanen), atau Menolak Pengajuan Hapus Berkas & Dokumen 
//            dari Semua Role (Admin, Engineer, Standby Engineer, HSE, dll).
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { useAuth } from '@/components/AuthContext';
import { toast } from 'sonner';
import {
  Trash2,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  Search,
  Download,
  AlertOctagon,
  RefreshCw,
  RotateCcw
} from 'lucide-react';
import { generateCMReportPDF } from '@/utils/CMReportPdfExport';
import { exportSLAReportToExcel } from '@/utils/excelExport';
import { generatePIRReportPDF } from '@/utils/PIRReportPdfExport';

export interface UnifiedDeleteRequest {
  id: string; // Unique key for react (e.g. `files_${docId}`)
  realDocId: string;
  collectionName: string;
  sourceType: 'files' | 'corrective' | 'technical' | 'hse';
  sourceLabel: string;
  sourceBadgeColor: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  category?: string;
  uploadedBy?: string;
  uploadedAt?: any;
  deleteRequested: boolean;
  deleteRequestedBy: string;
  deleteRequestedRole?: string;
  deleteRequestedTo?: string;
  deleteReason: string;
  deleteRequestedAt?: any;
  fileUrl?: string;
  rawDoc?: any;
}

export function DeleteRequestsManager() {
  const { user, userRole } = useAuth();
  const userEmailLower = (user?.email || '').toLowerCase();
  const isQcDme = userRole === 'qc_dme' || userEmailLower.includes('qcdme') || userEmailLower === 'qcdme@dme.com' || userEmailLower === 'qc@gmail.com';

  const [requests, setRequests] = useState<UnifiedDeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSourceFilter, setActiveSourceFilter] = useState<'all' | 'files' | 'corrective' | 'technical'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modals state
  const [modalMode, setModalMode] = useState<'approve' | 'reject' | null>(null);
  const [targetRequests, setTargetRequests] = useState<UnifiedDeleteRequest[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Format bytes
  const formatBytes = (bytes?: number) => {
    if (!bytes || isNaN(bytes)) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Format timestamp
  const formatDateTime = (val: any) => {
    if (!val) return '-';
    try {
      let date: Date;
      if (val instanceof Date) date = val;
      else if (val?.toMillis) date = new Date(val.toMillis());
      else if (val?.seconds) date = new Date(val.seconds * 1000);
      else date = new Date(val);

      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  // Listeners across collections
  useEffect(() => {
    setLoading(true);

    let listFiles: UnifiedDeleteRequest[] = [];
    let listCorrective: UnifiedDeleteRequest[] = [];
    let listTechnical: UnifiedDeleteRequest[] = [];

    const syncAll = () => {
      const combined = [...listFiles, ...listCorrective, ...listTechnical];
      // Sort newest requested first
      combined.sort((a, b) => {
        const getMs = (v: any) => {
          if (!v) return 0;
          if (v instanceof Date) return v.getTime();
          if (v?.toMillis) return v.toMillis();
          if (v?.seconds) return v.seconds * 1000;
          return 0;
        };
        return getMs(b.deleteRequestedAt) - getMs(a.deleteRequestedAt);
      });
      setRequests(combined);
      setLoading(false);
    };

    // 1. Files collection (Manajemen File: ISO, SOP, MOP, JSEA, etc.)
    const qFiles = query(collection(db, 'files'), where('deleteRequested', '==', true));
    const unsubFiles = onSnapshot(qFiles, (snapshot) => {
      listFiles = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: `files_${d.id}`,
          realDocId: d.id,
          collectionName: 'files',
          sourceType: 'files',
          sourceLabel: 'Manajemen File',
          sourceBadgeColor: 'bg-orange-100 text-orange-700 border-orange-200',
          fileName: data.fileName || 'Berkas Tanpa Nama',
          fileType: data.fileType,
          fileSize: data.fileSize,
          category: data.category || 'Dokumen',
          uploadedBy: data.uploadedByEmail || data.uploadedBy || '-',
          uploadedAt: data.uploadedAt,
          deleteRequested: true,
          deleteRequestedBy: data.deleteRequestedBy || 'User',
          deleteRequestedRole: data.deleteRequestedRole || 'Admin / User',
          deleteRequestedTo: data.deleteRequestedTo,
          deleteReason: data.deleteReason || 'Tidak ada alasan khusus',
          deleteRequestedAt: data.deleteRequestedAt,
          fileUrl: data.fileUrl,
          rawDoc: data,
        };
      });
      syncAll();
    }, (err) => {
      console.error('Error listening to files delete requests:', err);
      syncAll();
    });

    // 2. Corrective reports collection (Standby Engineer reports)
    const qCorrective = query(collection(db, 'corrective_reports'), where('deleteRequested', '==', true));
    const unsubCorrective = onSnapshot(qCorrective, (snapshot) => {
      listCorrective = snapshot.docs.map((d) => {
        const data = d.data();
        const docTitle = data.incidentName || data.ticketName || data.equipmentName || data.issue || data.fileName || `Laporan CM #${d.id.slice(0, 6)}`;
        return {
          id: `corrective_${d.id}`,
          realDocId: d.id,
          collectionName: 'corrective_reports',
          sourceType: 'corrective',
          sourceLabel: 'Arsip Standby / CM',
          sourceBadgeColor: 'bg-rose-100 text-rose-700 border-rose-200',
          fileName: docTitle,
          fileType: data.reportType || 'Corrective',
          category: data.category || data.reportType || 'Corrective Maintenance',
          uploadedBy: data.engineer || data.reportedByEmail || data.reportedBy || '-',
          uploadedAt: data.createdAt || data.date,
          deleteRequested: true,
          deleteRequestedBy: data.deleteRequestedBy || 'Standby Engineer',
          deleteRequestedRole: 'Standby Engineer',
          deleteReason: data.deleteReason || 'Tidak ada alasan khusus',
          deleteRequestedAt: data.deleteRequestedAt,
          rawDoc: data,
        };
      });
      syncAll();
    }, (err) => {
      console.error('Error listening to corrective reports delete requests:', err);
      syncAll();
    });

    // 3. Technical Documents & HSE collections
    const techCollections = [
      'electrical_documents',
      'mechanical_documents',
      'civil_documents',
      'electronic_documents',
      'hse'
    ];

    const techUnsubs: (() => void)[] = [];
    const techDataMap: { [col: string]: UnifiedDeleteRequest[] } = {};

    techCollections.forEach((colName) => {
      const qCol = query(collection(db, colName), where('deleteRequested', '==', true));
      const un = onSnapshot(qCol, (snapshot) => {
        techDataMap[colName] = snapshot.docs.map((d) => {
          const data = d.data();
          const title = data.fileName || data.title || `${colName.replace('_documents', '')} #${d.id.slice(0, 6)}`;
          return {
            id: `${colName}_${d.id}`,
            realDocId: d.id,
            collectionName: colName,
            sourceType: 'technical',
            sourceLabel: colName === 'hse' ? 'Dokumen HSE' : `Dokumen ${colName.replace('_documents', '').toUpperCase()}`,
            sourceBadgeColor: colName === 'hse' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200',
            fileName: title,
            fileType: data.documentType || 'Dokumen',
            category: data.category || colName,
            uploadedBy: data.authorEmail || data.author || data.uploadedBy || '-',
            uploadedAt: data.createdAt || data.date,
            deleteRequested: true,
            deleteRequestedBy: data.deleteRequestedBy || 'Engineer',
            deleteRequestedRole: 'Engineer / HSE',
            deleteReason: data.deleteReason || 'Tidak ada alasan khusus',
            deleteRequestedAt: data.deleteRequestedAt,
            fileUrl: data.pdfUrl || data.downloadUrl,
            rawDoc: data,
          };
        });

        // Flatten all techDataMap
        listTechnical = Object.values(techDataMap).flat();
        syncAll();
      }, (err) => {
        console.error(`Error listening to ${colName} delete requests:`, err);
      });
      techUnsubs.push(un);
    });

    return () => {
      unsubFiles();
      unsubCorrective();
      techUnsubs.forEach((un) => un());
    };
  }, []);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((item) => {
      // Source filter
      if (activeSourceFilter !== 'all' && item.sourceType !== activeSourceFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.fileName.toLowerCase().includes(q);
        const matchesRequester = item.deleteRequestedBy.toLowerCase().includes(q);
        const matchesReason = item.deleteReason.toLowerCase().includes(q);
        const matchesCat = (item.category || '').toLowerCase().includes(q);
        return matchesName || matchesRequester || matchesReason || matchesCat;
      }
      return true;
    });
  }, [requests, activeSourceFilter, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    return {
      all: requests.length,
      files: requests.filter((r) => r.sourceType === 'files').length,
      corrective: requests.filter((r) => r.sourceType === 'corrective').length,
      technical: requests.filter((r) => r.sourceType === 'technical').length,
    };
  }, [requests]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredRequests.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Download / Preview handler
  const handleDownload = async (item: UnifiedDeleteRequest) => {
    const toastId = toast.loading(`Mempersiapkan pratinjau ${item.fileName}...`);
    try {
      if (item.sourceType === 'corrective') {
        const rData = item.rawDoc;
        if (rData?.reportType === 'SLA') {
          await exportSLAReportToExcel(rData);
          toast.success('Berhasil mengunduh Laporan SLA Excel!', { id: toastId });
        } else if (rData?.reportType === 'PIR') {
          await generatePIRReportPDF(rData);
          toast.success('Berhasil mengunduh Report PIR PDF!', { id: toastId });
        } else {
          await generateCMReportPDF(rData);
          toast.success('Berhasil mengunduh Report CM PDF!', { id: toastId });
        }
        return;
      }

      // If there is direct url
      if (item.fileUrl) {
        window.open(item.fileUrl, '_blank');
        toast.success('Membuka file di tab baru', { id: toastId });
        return;
      }

      // If file is stored in chunks under collection 'files'
      if (item.collectionName === 'files') {
        const chunksSnapshot = await getDocs(
          query(collection(db, 'files', item.realDocId, 'chunks'), orderBy('index'))
        );

        if (chunksSnapshot.empty) {
          toast.error('Data file tidak ditemukan atau telah kadaluarsa', { id: toastId });
          return;
        }

        const byteArrays: Uint8Array[] = [];
        let mimeString = item.fileType || 'application/octet-stream';

        chunksSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.data) {
            let base64Part = data.data;
            if (base64Part.includes(';base64,')) {
              const parts = base64Part.split(';base64,');
              if (parts[0].startsWith('data:')) {
                const extractedMime = parts[0].replace('data:', '').trim();
                if (extractedMime) mimeString = extractedMime;
              }
              base64Part = parts[1];
            } else if (base64Part.includes(',')) {
              base64Part = base64Part.split(',')[1];
            }
            base64Part = base64Part.replace(/[\r\n\s]/g, '');

            const byteCharacters = atob(base64Part);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
          }
        });

        const blob = new Blob(byteArrays as any[], { type: mimeString });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = item.fileName;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success('File berhasil diunduh!', { id: toastId });
        return;
      }

      toast.info('Tidak ada berkas fisik yang dapat diunduh langsung', { id: toastId });
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Gagal mengunduh berkas: ' + (error?.message || 'Error'), { id: toastId });
    }
  };

  // Open modal single
  const openApproveModalSingle = (item: UnifiedDeleteRequest) => {
    setTargetRequests([item]);
    setModalMode('approve');
  };

  const openRejectModalSingle = (item: UnifiedDeleteRequest) => {
    setTargetRequests([item]);
    setModalMode('reject');
  };

  // Open modal bulk
  const openApproveModalBulk = () => {
    const selected = requests.filter((r) => selectedIds.includes(r.id));
    if (selected.length === 0) return;
    setTargetRequests(selected);
    setModalMode('approve');
  };

  const openRejectModalBulk = () => {
    const selected = requests.filter((r) => selectedIds.includes(r.id));
    if (selected.length === 0) return;
    setTargetRequests(selected);
    setModalMode('reject');
  };

  // Execute approval (Permanent Delete by QC DME)
  const executeApproveDelete = async () => {
    if (!isQcDme) {
      toast.error('Hanya akun QC DME (qcdme@dme.com) yang berwenang menyetujui penghapusan berkas.');
      return;
    }
    if (targetRequests.length === 0) return;

    setIsProcessing(true);
    const toastId = toast.loading(`Menghapus permanen ${targetRequests.length} berkas yang disetujui...`);

    try {
      for (const item of targetRequests) {
        if (item.collectionName === 'files') {
          // Delete chunks subcollection if any
          try {
            const chunksSnap = await getDocs(collection(db, 'files', item.realDocId, 'chunks'));
            for (const cDoc of chunksSnap.docs) {
              await deleteDoc(cDoc.ref);
            }
          } catch (cErr) {
            console.warn('Error deleting chunks:', cErr);
          }
          await deleteDoc(doc(db, 'files', item.realDocId));
        } else {
          await deleteDoc(doc(db, item.collectionName, item.realDocId));
        }
      }

      toast.success(
        `Berhasil menyetujui & menghapus permanen ${targetRequests.length} berkas/laporan!`,
        { id: toastId }
      );
      setSelectedIds((prev) => prev.filter((id) => !targetRequests.some((t) => t.id === id)));
      setModalMode(null);
      setTargetRequests([]);
    } catch (error: any) {
      console.error('Error approving delete request:', error);
      toast.error('Gagal menghapus berkas: ' + (error?.message || 'Terjadi kesalahan'), { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute reject (Restore to normal status)
  const executeRejectRequest = async () => {
    if (!isQcDme) {
      toast.error('Hanya akun QC DME (qcdme@dme.com) yang berwenang menolak pengajuan.');
      return;
    }
    if (targetRequests.length === 0) return;

    setIsProcessing(true);
    const toastId = toast.loading(`Menolak ${targetRequests.length} pengajuan hapus...`);

    try {
      for (const item of targetRequests) {
        const updatePayload = {
          deleteRequested: deleteField(),
          deleteRequestedBy: deleteField(),
          deleteRequestedTo: deleteField(),
          deleteRequestedRole: deleteField(),
          deleteReason: deleteField(),
          deleteRequestedAt: deleteField(),
        };

        await updateDoc(doc(db, item.collectionName, item.realDocId), updatePayload);
      }

      toast.success(
        `Pengajuan hapus untuk ${targetRequests.length} berkas ditolak. Berkas tetap aman tersimpan di arsip.`,
        { id: toastId }
      );
      setSelectedIds((prev) => prev.filter((id) => !targetRequests.some((t) => t.id === id)));
      setModalMode(null);
      setTargetRequests([]);
    } catch (error: any) {
      console.error('Error rejecting delete request:', error);
      toast.error('Gagal memproses penolakan: ' + (error?.message || 'Terjadi kesalahan'), { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-900 via-slate-900 to-rose-950 p-6 sm:p-8 text-white shadow-xl border border-rose-800/30">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs font-semibold backdrop-blur-md">
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              <span>Pusat Persetujuan Resmi — Khusus Akun QC DME (qcdme@dme.com)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Trash2 className="w-8 h-8 text-rose-400" />
              <span>Daftar Pengajuan Hapus Berkas</span>
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
              Tinjau, tolak, atau setujui permohonan hapus berkas dan laporan dari semua divisi (Admin, Engineer, Standby Engineer, HSE). Hanya akun Anda yang memiliki otoritas untuk menghapus dokumen secara permanen.
            </p>
          </div>

          {/* Quick Counter Card */}
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-5 py-4 rounded-2xl border border-white/10 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-rose-500/30 flex items-center justify-center border border-rose-400/40">
              <AlertTriangle className="w-6 h-6 text-rose-300" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-200 uppercase tracking-wider">Menunggu Tinjauan</p>
              <p className="text-2xl sm:text-3xl font-black text-white">{counts.all} <span className="text-sm font-normal text-slate-300">Berkas</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards Filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setActiveSourceFilter('all')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeSourceFilter === 'all'
              ? 'bg-rose-50 border-rose-300 shadow-md ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Semua Sumber</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-700">
              {counts.all}
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-800">Semua Pengajuan</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveSourceFilter('files')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeSourceFilter === 'files'
              ? 'bg-orange-50 border-orange-300 shadow-md ring-2 ring-orange-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Manajemen File</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-orange-100 text-orange-700">
              {counts.files}
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-800">ISO, SOP, MOP, JSEA</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveSourceFilter('corrective')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeSourceFilter === 'corrective'
              ? 'bg-rose-50 border-rose-300 shadow-md ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Arsip Standby</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-700">
              {counts.corrective}
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-800">Laporan CM & SLA</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveSourceFilter('technical')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeSourceFilter === 'technical'
              ? 'bg-blue-50 border-blue-300 shadow-md ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Dokumen Teknis & HSE</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-700">
              {counts.technical}
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-800">Teknis, HSE & Form</p>
        </button>
      </div>

      {/* Search & Bulk Action Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama berkas, pemohon, atau alasan pengajuan..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-slate-50/50"
            />
          </div>

          {/* Quick Refresh */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                toast.info('Sinkronisasi data pengajuan...');
              }}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
              title="Perbarui data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bulk Action Controls */}
        {filteredRequests.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="select-all-requests"
                checked={
                  filteredRequests.length > 0 &&
                  filteredRequests.every((r) => selectedIds.includes(r.id))
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <label
                htmlFor="select-all-requests"
                className="text-xs sm:text-sm font-bold text-slate-700 cursor-pointer select-none"
              >
                Pilih Semua ({filteredRequests.length} Berkas)
              </label>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 mr-1">
                  {selectedIds.length} berkas dipilih
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={openRejectModalBulk}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                  <span>Tolak Pengajuan ({selectedIds.length})</span>
                </button>
                <button
                  type="button"
                  onClick={openApproveModalBulk}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition flex items-center gap-1.5 shadow-sm shadow-rose-500/20 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Setujui & Hapus Permanen ({selectedIds.length})</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content: Request List Cards */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3 shadow-xs">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent" />
          <p className="text-slate-500 font-semibold text-sm">Memuat daftar pengajuan hapus berkas...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Semua Berkas Bersih & Aman</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mt-1">
              {searchQuery
                ? 'Tidak ada pengajuan hapus yang cocok dengan kata kunci pencarian Anda.'
                : 'Saat ini tidak ada permohonan hapus berkas yang menunggu persetujuan QC DME.'}
            </p>
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Hapus Filter Pencarian
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all duration-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isSelected
                    ? 'border-rose-500 bg-rose-50/20 shadow-md ring-1 ring-rose-500/30'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Left side: Checkbox + File Info */}
                <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(item.id)}
                      className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>

                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600">
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    {/* Header Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${item.sourceBadgeColor}`}>
                        {item.sourceLabel}
                      </span>
                      {item.category && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.category}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-700" />
                        <span>Menunggu Otorisasi QC</span>
                      </span>
                    </div>

                    {/* File Name */}
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate" title={item.fileName}>
                      {item.fileName}
                    </h4>

                    {/* Metadata details */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Diajukan oleh: <strong className="text-slate-700 font-semibold">{item.deleteRequestedBy}</strong></span>
                      </span>
                      {item.deleteRequestedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Waktu: {formatDateTime(item.deleteRequestedAt)}</span>
                        </span>
                      )}
                      {item.fileSize && (
                        <span>Ukuran: {formatBytes(item.fileSize)}</span>
                      )}
                    </div>

                    {/* Alasan / Remark Box */}
                    <div className="mt-2 p-2.5 sm:p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2 max-w-2xl">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-bold text-amber-800">Alasan / Catatan Pemohon:</p>
                        <p className="italic text-slate-800 mt-0.5 whitespace-pre-wrap">{item.deleteReason}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side: Action Buttons */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end">
                  {/* Download / Preview */}
                  <button
                    type="button"
                    onClick={() => handleDownload(item)}
                    className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Pratinjau / Download Berkas"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Unduh</span>
                  </button>

                  {/* Tolak Pengajuan */}
                  <button
                    type="button"
                    onClick={() => openRejectModalSingle(item)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="Tolak pengajuan dan kembalikan berkas ke status normal"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-600" />
                    <span>Tolak</span>
                  </button>

                  {/* Setujui & Hapus Permanen */}
                  <button
                    type="button"
                    onClick={() => openApproveModalSingle(item)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-rose-500/20 cursor-pointer"
                    title="Setujui dan hapus berkas secara permanen"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Setujui & Hapus</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog: Konfirmasi Tolak Pengajuan */}
      <AnimatePresence>
        {modalMode === 'reject' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isProcessing && setModalMode(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 z-10 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <RotateCcw className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Tolak Pengajuan Hapus ({targetRequests.length} Berkas)?
                </h3>
                <p className="text-slate-600 text-sm mt-1">
                  Berkas yang ditolak akan dikembalikan ke status normal dan tetap aman tersimpan di sistem. Pemohon dapat melihat bahwa berkas tidak jadi dihapus.
                </p>
              </div>

              {/* Items preview list */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {targetRequests.map((req, idx) => (
                  <div key={req.id} className="text-xs text-slate-700 flex items-center gap-2">
                    <span className="font-bold text-slate-400">{idx + 1}.</span>
                    <span className="truncate font-semibold">{req.fileName}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">({req.sourceLabel})</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={executeRejectRequest}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? 'Memproses...' : 'Ya, Tolak Pengajuan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Dialog: Konfirmasi Setujui & Hapus Permanen */}
      <AnimatePresence>
        {modalMode === 'approve' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isProcessing && setModalMode(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-rose-200 z-10 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertOctagon className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Setujui & Hapus Permanen ({targetRequests.length} Berkas)?
                </h3>
                <p className="text-rose-600 font-semibold text-xs mt-1">
                  PERINGATAN: Tindakan ini bersifat PERMANEN dan tidak dapat dibatalkan. Berkas dan seluruh lampirannya akan dihapus selamanya dari basis data.
                </p>
              </div>

              {/* Items preview list */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                {targetRequests.map((req, idx) => (
                  <div key={req.id} className="text-xs text-slate-800 flex items-center gap-2">
                    <span className="font-bold text-rose-400">{idx + 1}.</span>
                    <span className="truncate font-semibold">{req.fileName}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">({req.sourceLabel})</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={executeApproveDelete}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-md shadow-rose-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? 'Menghapus...' : 'Ya, Hapus Permanen'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
